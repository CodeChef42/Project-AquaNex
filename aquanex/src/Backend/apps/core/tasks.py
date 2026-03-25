from celery import shared_task
from .models import Workspace, Incident
import math
import re
import defusedxml.ElementTree as ET
import logging
import os
import hashlib
from pathlib import Path
from typing import Optional
import tempfile
import requests
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.db import IntegrityError, transaction

try:
    from pypdf import PdfReader
except Exception:
    PdfReader = None

try:
    from pyproj import Transformer, Geod
except Exception:
    Transformer = None
    Geod = None

try:
    from django.core.files.storage import default_storage
except Exception:
    default_storage = None


logger = logging.getLogger(__name__)


def _coerce_prediction_timestamp(value):
    dt = parse_datetime(str(value or "").strip()) if value else None
    if dt is None:
        return timezone.now()
    if timezone.is_naive(dt):
        return timezone.make_aware(dt, timezone.get_current_timezone())
    return dt


def _incident_fingerprint(gateway_id, incident_type):
    return hashlib.sha256(f"{gateway_id}:{incident_type}".encode("utf-8")).hexdigest()


def _record_incident_from_prediction(workspace, gateway_id, prediction):
    if not isinstance(prediction, dict):
        return None

    now_ts = timezone.now()
    if prediction.get("is_anomaly") is not True:
        Incident.objects.filter(
            workspace=workspace,
            gateway_id=gateway_id,
            status="open",
        ).update(status="recovering", last_seen_at=now_ts)
        return None

    incident_type = str(prediction.get("anomaly_type") or "anomaly").strip().lower() or "anomaly"
    severity = str(prediction.get("severity") or "").strip().lower() or None
    detected_at = _coerce_prediction_timestamp(prediction.get("timestamp"))
    fingerprint = _incident_fingerprint(gateway_id, incident_type)
    details = {"prediction": prediction}

    recovering = Incident.objects.filter(
        workspace=workspace,
        gateway_id=gateway_id,
        incident_type=incident_type,
        status="recovering",
    ).first()
    if recovering:
        recovering.status = "open"
        recovering.last_seen_at = detected_at
        recovering.severity = severity
        recovering.details = details
        recovering.save(update_fields=["status", "last_seen_at", "severity", "details"])
        return {"id": str(recovering.id), "created": False}

    try:
        with transaction.atomic():
            incident = Incident.objects.create(
                workspace=workspace,
                gateway_id=gateway_id,
                incident_type=incident_type,
                severity=severity,
                status="open",
                detected_at=detected_at,
                last_seen_at=detected_at,
                fingerprint=fingerprint,
                details=details,
            )
            return {"id": str(incident.id), "created": True}
    except IntegrityError:
        updated = Incident.objects.filter(
            workspace=workspace,
            gateway_id=gateway_id,
            incident_type=incident_type,
            status="open",
        ).update(
            last_seen_at=detected_at,
            severity=severity,
            details=details,
        )
        if updated:
            incident = Incident.objects.filter(
                workspace=workspace,
                gateway_id=gateway_id,
                incident_type=incident_type,
                status="open",
            ).first()
            if incident:
                return {"id": str(incident.id), "created": False}
    return None


def _calculate_area(coords):
    if len(coords) < 3:
        return 0.0

    if Geod is not None:
        geod = Geod(ellps="WGS84")
        lons = [lng for lng, _ in coords]
        lats = [lat for _, lat in coords]
        area, _ = geod.polygon_area_perimeter(lons, lats)
        return float(abs(area))

    lats = [lat for _, lat in coords]
    lngs = [lng for lng, _ in coords]
    lat0 = (min(lats) + max(lats)) / 2
    lng0 = (min(lngs) + max(lngs)) / 2
    earth_radius = 6371000.0

    projected = []
    for lng, lat in coords:
        x = ((lng - lng0) * math.pi / 180.0) * earth_radius * math.cos(lat0 * math.pi / 180.0)
        y = ((lat - lat0) * math.pi / 180.0) * earth_radius
        projected.append((x, y))

    area_raw = 0.0
    for i, (x1, y1) in enumerate(projected):
        x2, y2 = projected[(i + 1) % len(projected)]
        area_raw += x1 * y2 - x2 * y1
    return abs(area_raw) / 2.0


def _normalize_polygon(coords):
    normalized = []
    for lng, lat in coords:
        if -180 <= lng <= 180 and -90 <= lat <= 90:
            normalized.append([round(lng, 7), round(lat, 7)])
    if len(normalized) >= 2 and normalized[0] == normalized[-1]:
        normalized = normalized[:-1]
    return normalized


def _centroid(coords):
    if not coords:
        return None
    lng = sum(p[0] for p in coords) / len(coords)
    lat = sum(p[1] for p in coords) / len(coords)
    return (lng, lat)


def _convex_hull(points):
    pts = sorted(set((round(x, 7), round(y, 7)) for x, y in points))
    if len(pts) <= 2:
        return [[x, y] for x, y in pts]

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    lower = []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)

    upper = []
    for p in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)

    hull = lower[:-1] + upper[:-1]
    return [[x, y] for x, y in hull]


def _extract_en_pairs(text: str):
    pattern = re.compile(
        r"E\s*=\s*(-?\d+(?:\.\d+)?)"
        r"(?:\s*[,;|/\-]?\s*|\s+)"
        r"N\s*=\s*(-?\d+(?:\.\d+)?)",
        re.IGNORECASE,
    )
    return [(float(e), float(n)) for e, n in pattern.findall(text)]


def _infer_utm_epsg(easting: float, northing: float, location_hint: str = ""):
    hint = (location_hint or "").lower()
    if "dubai" in hint or "uae" in hint or "emirates" in hint:
        return 32640

    if 100000 <= easting <= 900000 and 0 <= northing <= 10000000:
        return 32640 if northing > 2000000 else 32639
    return None


def _utm_zone_from_longitude(lng: float) -> int:
    return int((lng + 180.0) / 6.0) + 1


def _candidate_epsg_codes(
    easting: float,
    northing: float,
    location_hint: str = "",
    crs_override: str = "auto",
    reference_point=None,
):
    override_map = {
        "utm39n": [32639],
        "utm40n": [32640],
        "uae_grid": [3997],
    }
    override_key = (crs_override or "auto").lower()
    if override_key in override_map:
        return override_map[override_key]

    hint = (location_hint or "").lower()
    if "dubai" in hint or "uae" in hint or "emirates" in hint:
        return [3997, 32640, 32639]

    if reference_point:
        ref_lng = reference_point[0]
        zone = max(1, min(60, _utm_zone_from_longitude(ref_lng)))
        return [32600 + z for z in [zone - 1, zone, zone + 1] if 1 <= z <= 60] + [3997]

    if 100000 <= easting <= 900000 and 0 <= northing <= 10000000:
        return [3997, 32640, 32639]

    return [32640, 32639, 3997]


def _convert_en_to_lnglat(
    en_points,
    location_hint="",
    reference_point=None,
    crs_override="auto",
):
    if Transformer is None:
        return []
    if not en_points:
        return []

    e0, n0 = en_points[0]
    candidate_epsg = _candidate_epsg_codes(
        e0,
        n0,
        location_hint=location_hint,
        crs_override=crs_override,
        reference_point=reference_point,
    )

    fallback_ref = None
    hint = (location_hint or "").lower()
    if reference_point is None and ("dubai" in hint or "uae" in hint or "emirates" in hint):
        fallback_ref = (55.27, 25.20)
    target = reference_point or fallback_ref

    best = []
    best_epsg = None
    best_score = None
    for epsg in candidate_epsg:
        try:
            transformer = Transformer.from_crs(f"EPSG:{epsg}", "EPSG:4326", always_xy=True)
        except Exception:
            continue

        lnglat = []
        for easting, northing in en_points:
            try:
                lng, lat = transformer.transform(easting, northing)
            except Exception:
                continue
            if -180 <= lng <= 180 and -90 <= lat <= 90:
                lnglat.append((lng, lat))

        normalized = _normalize_polygon(lnglat)
        if len(normalized) < 3:
            continue

        score = 0.0
        if target:
            c = _centroid(normalized)
            score = math.hypot(c[0] - target[0], c[1] - target[1]) if c else 1e9

        if best_score is None or score < best_score:
            best = normalized
            best_epsg = epsg
            best_score = score

    return best, best_epsg


def _extract_enclosure_from_engineering_text(
    text: str,
    location_hint: str = "",
    reference_polygon=None,
    crs_override: str = "auto",
):
    en_points = _extract_en_pairs(text)
    if len(en_points) < 3:
        return [], [], None
    ref_point = _centroid(reference_polygon or [])
    lnglat_points, epsg_used = _convert_en_to_lnglat(
        en_points,
        location_hint=location_hint,
        reference_point=ref_point,
        crs_override=crs_override,
    )
    if len(lnglat_points) < 3:
        return [], lnglat_points, epsg_used
    return _convex_hull(lnglat_points), lnglat_points, epsg_used


def _extract_polygon_from_kml(file_path):
    root = ET.parse(file_path).getroot()
    coords = []
    for node in root.iter():
        if node.tag.lower().endswith("coordinates") and node.text:
            for token in node.text.strip().split():
                parts = token.split(",")
                if len(parts) >= 2:
                    try:
                        lng = float(parts[0])
                        lat = float(parts[1])
                    except ValueError:
                        continue
                    coords.append((lng, lat))
            if len(coords) >= 3:
                break
    return _normalize_polygon(coords)


def _extract_polygon_from_text(file_path):
    raw = Path(file_path).read_bytes()
    text = raw.decode("utf-8", errors="ignore")
    matches = re.findall(r"(-?\d{1,3}\.\d+)\s*[, ]\s*(-?\d{1,3}\.\d+)", text)
    coords = []
    for first, second in matches:
        a = float(first)
        b = float(second)
        if -180 <= a <= 180 and -90 <= b <= 90:
            coords.append((a, b))
        elif -90 <= a <= 90 and -180 <= b <= 180:
            coords.append((b, a))
        if len(coords) >= 200:
            break
    return _normalize_polygon(coords)


def _extract_text_from_pdf(file_path: Path) -> Optional[str]:
    if PdfReader is None:
        return None
    try:
        reader = PdfReader(str(file_path))
    except Exception:
        return None

    chunks = []
    for page in reader.pages:
        try:
            page_text = page.extract_text() or ""
        except Exception:
            page_text = ""
        if page_text:
            chunks.append(page_text)
    return "\n".join(chunks) if chunks else None


def _extract_polygon_from_pdf(file_path: Path):
    pdf_text = _extract_text_from_pdf(file_path)
    if not pdf_text:
        return []

    matches = re.findall(r"(-?\d{1,3}\.\d+)\s*[, ]\s*(-?\d{1,3}\.\d+)", pdf_text)
    coords = []
    for first, second in matches:
        a = float(first)
        b = float(second)
        if -180 <= a <= 180 and -90 <= b <= 90:
            coords.append((a, b))
        elif -90 <= a <= 90 and -180 <= b <= 180:
            coords.append((b, a))
        if len(coords) >= 200:
            break
    return _normalize_polygon(coords)


@shared_task
def layout_process(workspace_id, file_path, original_filename, crs_override="auto"):
    workspace = None
    temp_local_path = None
    try:
        filename_for_response = original_filename
        if isinstance(original_filename, str) and "||crs=" in original_filename:
            base_name, _, crs_marker = original_filename.partition("||crs=")
            filename_for_response = base_name or original_filename
            marker = (crs_marker or "").strip().lower()
            if marker:
                crs_override = marker

        workspace = Workspace.objects.get(id=workspace_id)

        # 1. Determine if the file_path is a safe local path or a storage key
        temp_dir = Path(tempfile.gettempdir()).resolve()
        candidate_path = Path(file_path).resolve()

        is_safe_local_path = False
        try:
            if candidate_path.exists() and str(candidate_path).startswith(str(temp_dir)):
                is_safe_local_path = True
        except Exception:
            pass

        storage_key = None
        path_obj = candidate_path

        if not is_safe_local_path and default_storage is not None:
            # 2. Sanitize storage_key to prevent path traversal in storage backends
            # We treat the key as a POSIX-style relative path.
            normalized_key = os.path.normpath(str(file_path)).replace("\\", "/")
            if normalized_key.startswith(("/", "..")):
                raise ValueError(f"Illegal storage key detected: {file_path}")

            storage_key = normalized_key
            logger.info(f"[Celery] Attempting to open storage key: {storage_key}")
            suffix = Path(storage_key).suffix or ".bin"
            try:
                with default_storage.open(storage_key, "rb") as source:
                    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                        tmp.write(source.read())
                        temp_local_path = tmp.name
            except Exception as e:
                logger.error(f"[Celery] Failed to open storage key: {storage_key} — {e}")
                raise FileNotFoundError(f"Storage key missing or illegal path: {storage_key}")
            path_obj = Path(temp_local_path).resolve()

        # Final safety check: path_obj MUST be in temp_dir before we read it
        if not str(path_obj).startswith(str(temp_dir)):
            raise ValueError(f"Illegal file path or storage key detected: {file_path}")

        extension = path_obj.suffix.lower().lstrip(".")

        location_hint = (workspace.location or "") if workspace else ""
        reference_polygon = workspace.layout_polygon or []

        extracted_points = []
        epsg_used = None

        if extension == "kml":
            extracted = _extract_polygon_from_kml(path_obj)
            extracted_points = extracted[:]
        elif extension == "pdf":
            pdf_text = _extract_text_from_pdf(path_obj) or ""
            extracted, extracted_points, epsg_used = _extract_enclosure_from_engineering_text(
                pdf_text,
                location_hint=location_hint,
                reference_polygon=reference_polygon,
                crs_override=crs_override,
            )
            if len(extracted) < 3:
                extracted = _extract_polygon_from_pdf(path_obj)
                extracted_points = extracted[:]
            if len(extracted) < 3:
                extracted = _extract_polygon_from_text(path_obj)
                extracted_points = extracted[:]
        else:
            raw_text = Path(path_obj).read_bytes().decode("utf-8", errors="ignore")
            extracted, extracted_points, epsg_used = _extract_enclosure_from_engineering_text(
                raw_text,
                location_hint=location_hint,
                reference_polygon=reference_polygon,
                crs_override=crs_override,
            )
            if len(extracted) < 3:
                extracted = _extract_polygon_from_text(path_obj)
                extracted_points = extracted[:]

        if len(extracted) < 3:
            raise ValueError(
                f"No valid polygon coordinates found in {original_filename}. "
                "Use manual polygon drawing or upload a georeferenced KML."
            )

        workspace.layout_polygon = extracted
        workspace.layout_area_m2 = _calculate_area(extracted)
        workspace.layout_status = 'ready'
        workspace.layout_job_error = None
        workspace.save(update_fields=['layout_polygon', 'layout_area_m2', 'layout_status', 'layout_job_error'])

        if temp_local_path:
            try:
                Path(temp_local_path).unlink(missing_ok=True)
            except Exception:
                pass
        if storage_key and default_storage:
            try:
                default_storage.delete(storage_key)
            except Exception:
                pass

        return {
            "status": "ready",
            "source": "upload",
            "points": len(extracted),
            "filename": filename_for_response,
            "crs_used": f"EPSG:{epsg_used}" if epsg_used else "unknown",
            "extracted_points": extracted_points,
        }
    except Exception as e:
        if workspace is None:
            workspace = Workspace.objects.filter(id=workspace_id).first()
        if workspace:
            workspace.layout_status = 'failed'
            workspace.layout_job_error = str(e)
            workspace.save(update_fields=['layout_status', 'layout_job_error'])

        try:
            if temp_local_path:
                Path(temp_local_path).unlink(missing_ok=True)
            if storage_key and default_storage:
                try:
                    default_storage.delete(storage_key)
                except Exception:
                    pass
        except Exception:
            pass
        raise


def _ml_ingest_url():
    raw = os.environ.get("ML_SERVICE_URL", "http://localhost:8001").strip()
    base = raw[:-1] if raw.endswith("/") else raw
    return f"{base}/telemetry/ingest"


@shared_task(
    bind=True,
    autoretry_for=(requests.exceptions.RequestException,),
    retry_backoff=True,
    retry_jitter=True,
    retry_kwargs={"max_retries": 3},
)
def run_ml_breakage_inference(self, telemetry, gateway_id=None, workspace_id=None, devices=None):
    timeout = float(os.environ.get("ML_SERVICE_TIMEOUT_SEC", "5"))
    url = _ml_ingest_url()

    payload = {
        "gateway_id": gateway_id,
        "workspace_id": workspace_id,
        "telemetry": telemetry or [],
        "devices": devices or [],
    }

    response = requests.post(url, json=payload, timeout=timeout)
    response.raise_for_status()
    result = response.json()

    prediction = result.get("prediction") if isinstance(result, dict) else None
    if isinstance(prediction, dict):
        pred = prediction.get("is_anomaly")
        confidence = prediction.get("confidence")
        label = "ANOMALY" if pred else "NORMAL"
        logger.info(
            "ML inference [%s] gateway=%s workspace=%s confidence=%s deltas=%s",
            label,
            gateway_id or "unknown",
            workspace_id or "unknown",
            f"{confidence:.4f}" if isinstance(confidence, (int, float)) else confidence,
            prediction.get("deltas"),
        )
    else:
        logger.info(
            "ML inference deferred gateway=%s workspace=%s missing_slots=%s",
            gateway_id or "unknown",
            workspace_id or "unknown",
            result.get("missing_slots") if isinstance(result, dict) else "unknown",
        )

    if isinstance(prediction, dict) and gateway_id and workspace_id:
        workspace = Workspace.objects.filter(id=workspace_id).first()
        if workspace:
            incident_summary = _record_incident_from_prediction(workspace, gateway_id, prediction)
            logger.info(
                "Incident upsert from async ML gateway=%s workspace=%s incident_id=%s created=%s",
                gateway_id,
                workspace_id,
                incident_summary.get("id") if isinstance(incident_summary, dict) else None,
                incident_summary.get("created") if isinstance(incident_summary, dict) else None,
            )
    return {
        "gateway_id": gateway_id,
        "workspace_id": workspace_id,
        "prediction": prediction,
        "result": result,
    }