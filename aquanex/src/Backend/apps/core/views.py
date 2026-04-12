from urllib import request
from rest_framework import status, generics
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.decorators import api_view, permission_classes
from .tasks import layout_process, run_ml_breakage_inference
from django.contrib.auth import get_user_model
from django.conf import settings
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
import requests
import logging
import json
import time
import uuid
import random
import hashlib
import os
import re
import math
import tempfile
from pathlib import Path
from datetime import datetime, timezone as dt_timezone, timedelta
from kombu.exceptions import OperationalError as KombuOperationalError
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.db import DatabaseError, IntegrityError, transaction
from django.core.files.storage import default_storage
from .serializers import RegisterSerializer, LoginSerializer, UserSerializer, WorkspaceSerializer, ChangePasswordSerializer, IncidentSerializer
from .models import Pipe, PipeSpecification

logger = logging.getLogger(__name__)

from .serializers import RegisterSerializer, LoginSerializer, UserSerializer, WorkspaceSerializer
from .models import (
    Workspace,
    WorkspaceInvite,
    Gateway,
    Incident,
    Microcontroller,
    FieldDevice,
    DeviceReadingLatest,
    DeviceReading,
)


def _safe_float(value, default=0.0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _optional_float(value):
    try:
        if value is None or value == "":
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _is_truthy(value):
    return str(value or "").strip().lower() in {"1", "true", "yes", "on"}

def _workspace_id_from_request(request):
    """Extracts the active workspace ID from request data, query params, or headers."""
    data = getattr(request, "data", None)
    if hasattr(data, "get"):
        data_value = data.get("workspace_id") or data.get("workspaceId")
        if data_value:
            return str(data_value).strip()
            
    if hasattr(request, "query_params"):
        query_value = request.query_params.get("workspace_id")
        if query_value:
            return str(query_value).strip()
            
    header_value = request.headers.get("X-Workspace-Id")
    if header_value:
        return str(header_value).strip()
        
    return ""

def _coerce_prediction_timestamp(value):
    dt = parse_datetime(str(value or "").strip()) if value else None
    if dt is None:
        return timezone.now()
    if timezone.is_naive(dt):
        return timezone.make_aware(dt, timezone.get_current_timezone())
    return dt


def _incident_fingerprint(gateway_id, incident_type):
    # Appending a UUID guarantees every new incident gets a unique DB row,
    # preventing old "resolved" incidents from blocking new ones.
    unique_string = f"{gateway_id}:{incident_type}:{uuid.uuid4()}"
    return hashlib.sha256(unique_string.encode("utf-8")).hexdigest()


def _record_incident_from_prediction(workspace, gateway_id, prediction):
    print("\n" + "="*50)
    print(f"🚨 DB INSERT CHECK FOR GATEWAY: {gateway_id}")
    print(f"📦 PREDICTION PAYLOAD: {prediction}")
    
    if not isinstance(prediction, dict):
        print("❌ ABORT: Prediction is not a valid dictionary.")
        return None

    now_ts = timezone.now()

    if prediction.get("is_anomaly") is not True:
        print("ℹ️ STATUS: Normal data received. is_anomaly is False.")
        updated = Incident.objects.filter(
            workspace=workspace,
            gateway_id=gateway_id,
            status="ongoing",
        ).update(status="recovering", last_seen_at=now_ts)
        print(f"ℹ️ Transitioned {updated} ongoing incidents to recovering.")
        print("="*50 + "\n")
        return None

    print("⚠️ ANOMALY CONFIRMED! Proceeding to database insertion logic...")
    
    incident_type = str(prediction.get("anomaly_type") or "anomaly").strip().lower() or "anomaly"
    severity = str(prediction.get("severity") or "").strip().lower() or None
    detected_at = _coerce_prediction_timestamp(prediction.get("timestamp"))
    details = {"prediction": prediction}

    # 1. Check for ongoing
    ongoing_incident = Incident.objects.filter(
        workspace=workspace, gateway_id=gateway_id,
        incident_type=incident_type, status="ongoing"
    ).first()

    if ongoing_incident:
        print(f"🔄 FOUND ONGOING: Updating existing incident ID: {ongoing_incident.id}")
        ongoing_incident.last_seen_at = detected_at
        ongoing_incident.severity = severity
        ongoing_incident.details = details
        ongoing_incident.save(update_fields=['last_seen_at', 'severity', 'details'])
        print("="*50 + "\n")
        return {"id": str(ongoing_incident.id), "created": False}

    # 2. Check for recovering
    recovering_incident = Incident.objects.filter(
        workspace=workspace, gateway_id=gateway_id,
        incident_type=incident_type, status="recovering"
    ).first()

    if recovering_incident:
        print(f"🔄 FOUND RECOVERING: Re-opening incident ID: {recovering_incident.id}")
        recovering_incident.status = "ongoing"
        recovering_incident.last_seen_at = detected_at
        recovering_incident.severity = severity
        recovering_incident.details = details
        recovering_incident.save()
        print("="*50 + "\n")
        return {"id": str(recovering_incident.id), "created": False}

    # 3. Create Brand New
    print("✨ NO ACTIVE INCIDENTS FOUND. Creating a brand new DB row...")
    fingerprint = _incident_fingerprint(gateway_id, incident_type)
    print(f"🔑 Generated Unique Fingerprint: {fingerprint}")
    
    try:
        with transaction.atomic():
            incident = Incident.objects.create(
                workspace=workspace,
                gateway_id=gateway_id,
                incident_type=incident_type,
                severity=severity,
                status="ongoing",
                detected_at=detected_at,
                last_seen_at=detected_at,
                fingerprint=fingerprint,
                details=details,
            )
            print(f"✅ SUCCESS! Created new Incident ID: {incident.id}")
            print("="*50 + "\n")
            return {"id": str(incident.id), "created": True}
    except Exception as e:
        print(f"❌ DATABASE ERROR: Failed to insert row! Error: {str(e)}")
        print("="*50 + "\n")
        return None


def _resolve_user_workspace(request, create_if_missing=False):
    requested_id = _workspace_id_from_request(request)
    owner_workspaces = Workspace.objects.filter(owner=request.user).order_by("created_at")

    if requested_id:
        selected = owner_workspaces.filter(id=requested_id).first()
        if selected:
            return selected

    selected = owner_workspaces.first()
    if selected or not create_if_missing:
        return selected

    return Workspace.objects.create(
        owner=request.user,
        workspace_name="",
        company_name="",
        company_type="",
        location="",
        status="active",
        layout_status="idle",
    )


def _normalize_layout_polygon(raw_polygon):
    if not isinstance(raw_polygon, list):
        return []
    normalized = []
    for point in raw_polygon:
        if not isinstance(point, (list, tuple)) or len(point) < 2:
            continue
        lng = _optional_float(point[0])
        lat = _optional_float(point[1])
        if lng is None or lat is None:
            continue
        if not (-180 <= lng <= 180 and -90 <= lat <= 90):
            continue
        normalized.append([lng, lat])
    return normalized


def _layout_area_and_centroid(polygon):
    if len(polygon) < 3:
        return 0.0, None
    centroid_lng = sum(point[0] for point in polygon) / len(polygon)
    centroid_lat = sum(point[1] for point in polygon) / len(polygon)
    ring = polygon
    if ring[0] != ring[-1]:
        ring = ring + [ring[0]]
    radius_m = 6378137.0
    area_sum = 0.0
    for idx in range(len(ring) - 1):
        lng1, lat1 = ring[idx]
        lng2, lat2 = ring[idx + 1]
        lam1 = math.radians(lng1)
        lam2 = math.radians(lng2)
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        area_sum += (lam2 - lam1) * (2 + math.sin(phi1) + math.sin(phi2))
    area_m2 = abs((area_sum * radius_m * radius_m) / 2.0)
    return area_m2, {"lat": round(centroid_lat, 7), "lng": round(centroid_lng, 7)}


def _extract_json_object(raw_text):
    text = str(raw_text or "").strip()
    if not text:
        return None
    try:
        return json.loads(text)
    except Exception:
        pass
    fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", text, flags=re.IGNORECASE)
    if fenced:
        try:
            return json.loads(fenced.group(1).strip())
        except Exception:
            pass
    first = text.find("{")
    last = text.rfind("}")
    if first >= 0 and last > first:
        try:
            return json.loads(text[first:last + 1])
        except Exception:
            return None
    return None


def _overpass_location_signals(lat, lng, radius_m):
    query = f"""
[out:json][timeout:20];
(
  nwr(around:{int(radius_m)},{lat},{lng})["highway"];
  nwr(around:{int(radius_m)},{lat},{lng})["leisure"~"park|garden|golf_course|pitch"];
  nwr(around:{int(radius_m)},{lat},{lng})["landuse"~"grass|meadow|farmland|orchard|vineyard|forest|recreation_ground|brownfield|greenfield|construction|quarry"];
  nwr(around:{int(radius_m)},{lat},{lng})["natural"~"wood|grassland|scrub|sand|bare_rock|heath"];
);
out tags;
"""
    response = requests.post(
        "https://overpass-api.de/api/interpreter",
        data=query,
        timeout=25,
    )
    response.raise_for_status()
    payload = response.json() if response.content else {}
    elements = payload.get("elements") if isinstance(payload, dict) else []
    if not isinstance(elements, list):
        elements = []
    stats = {
        "road_elements": 0,
        "green_elements": 0,
        "decorative_elements": 0,
        "agriculture_elements": 0,
        "empty_ground_elements": 0,
        "total_elements": len(elements),
    }
    for item in elements:
        tags = item.get("tags") if isinstance(item, dict) else {}
        if not isinstance(tags, dict):
            continue
        highway = str(tags.get("highway") or "").strip().lower()
        leisure = str(tags.get("leisure") or "").strip().lower()
        landuse = str(tags.get("landuse") or "").strip().lower()
        natural = str(tags.get("natural") or "").strip().lower()
        if highway:
            stats["road_elements"] += 1
        if leisure in {"park", "garden", "golf_course", "pitch"}:
            stats["green_elements"] += 1
        if leisure in {"garden"}:
            stats["decorative_elements"] += 2
        if landuse in {"grass", "meadow", "forest", "recreation_ground"}:
            stats["green_elements"] += 1
        if landuse in {"farmland", "orchard", "vineyard"}:
            stats["green_elements"] += 2
            stats["agriculture_elements"] += 2
        if landuse in {"brownfield", "greenfield", "construction", "quarry"}:
            stats["empty_ground_elements"] += 1
        if natural in {"wood", "grassland", "scrub"}:
            stats["green_elements"] += 1
        if natural in {"sand", "bare_rock", "heath"}:
            stats["empty_ground_elements"] += 1
    return stats


def _reverse_geocode_name(lat, lng):
    response = requests.get(
        "https://nominatim.openstreetmap.org/reverse",
        params={
            "format": "jsonv2",
            "lat": str(lat),
            "lon": str(lng),
        },
        headers={"User-Agent": "AquaNex/1.0"},
        timeout=12,
    )
    response.raise_for_status()
    payload = response.json() if response.content else {}
    if not isinstance(payload, dict):
        return ""
    display_name = str(payload.get("display_name") or "").strip()
    if display_name:
        return display_name
    address = payload.get("address") if isinstance(payload.get("address"), dict) else {}
    locality = str(address.get("city") or address.get("town") or address.get("village") or "").strip()
    country = str(address.get("country") or "").strip()
    return ", ".join([part for part in [locality, country] if part])


def _heuristic_module_recommendation(area_m2, signals):
    road = int(signals.get("road_elements") or 0)
    green = int(signals.get("green_elements") or 0)
    decorative = int(signals.get("decorative_elements") or 0)
    agriculture = int(signals.get("agriculture_elements") or 0)
    empty_ground = int(signals.get("empty_ground_elements") or 0)
    modules = ["pipeline_management"]
    reasons = {
        "pipeline_management": "Pipeline monitoring is included as a base capability for all layouts.",
    }
    if agriculture >= 2 or (green >= 6 and area_m2 >= 10000):
        modules.append("soil_salinity")
        reasons["soil_salinity"] = "Large green/agricultural footprint suggests salinity control is valuable."
    if green >= 4 or decorative >= 2 or (road >= 4 and green >= 2):
        modules.append("demand_forecasting")
        reasons["demand_forecasting"] = "Significant vegetation or mixed roadside greenery benefits from demand prediction."
    if decorative >= 2 or agriculture >= 2 or green >= 7:
        modules.append("water_quality")
        reasons["water_quality"] = "Plantation/decorative vegetation density indicates water quality risk management is needed."
    if empty_ground >= 6 and len(modules) == 1:
        reasons["pipeline_management"] = "Mostly road/utility-oriented footprint favors pipeline-first monitoring."
    return {
        "recommended_modules": modules,
        "module_reasons": reasons,
    }


def _groq_module_recommendation(context_payload, heuristic_modules):
    api_key = str(os.environ.get("GROQ_API_KEY") or "").strip()
    if not api_key:
        raise ValueError("GROQ_API_KEY is required")
    model = str(os.environ.get("GROQ_MODEL") or "llama-3.3-70b-versatile").strip()
    rules = [
        "pipeline_management works for all scenarios and should always be included.",
        "soil_salinity is best for large parks, crop fields, farms, or broad plantation zones.",
        "demand_forecasting is best when there are many plants/trees or meaningful roadside greenery.",
        "water_quality is best for plantations and decorative flowers/greenery vulnerable to poor water quality.",
    ]
    messages = [
        {
            "role": "system",
            "content": "You are an irrigation domain assistant. Return strict JSON only.",
        },
        {
            "role": "user",
            "content": json.dumps(
                {
                    "task": "Recommend AquaNex modules from layout context.",
                    "allowed_modules": [
                        "pipeline_management",
                        "soil_salinity",
                        "demand_forecasting",
                        "water_quality",
                        "incident_analytics",
                    ],
                    "rules": rules,
                    "layout_context": context_payload,
                    "heuristic_start": heuristic_modules,
                    "response_schema": {
                        "recommended_modules": ["pipeline_management"],
                        "summary": "short explanation",
                        "module_reasons": {
                            "pipeline_management": "reason",
                        },
                    },
                }
            ),
        },
    ]
    response = requests.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        data=json.dumps({
            "model": model,
            "messages": messages,
            "temperature": 0.1,
            "max_tokens": 500,
        }),
        timeout=25,
    )
    response.raise_for_status()
    payload = response.json() if response.content else {}
    choices = payload.get("choices") if isinstance(payload, dict) else []
    if not isinstance(choices, list) or not choices:
        raise ValueError("Groq returned no choices")
    message = choices[0].get("message") if isinstance(choices[0], dict) else {}
    content = message.get("content") if isinstance(message, dict) else ""
    parsed = _extract_json_object(content)
    if not isinstance(parsed, dict):
        raise ValueError("Groq response was not valid JSON")
    modules = parsed.get("recommended_modules")
    if not isinstance(modules, list):
        raise ValueError("Groq response missing recommended_modules")
    normalized_modules = []
    for module_name in modules:
        module_key = str(module_name or "").strip()
        if module_key and module_key not in normalized_modules:
            normalized_modules.append(module_key)
    if "pipeline_management" not in normalized_modules:
        normalized_modules.insert(0, "pipeline_management")
    parsed["recommended_modules"] = normalized_modules
    if not isinstance(parsed.get("module_reasons"), dict):
        parsed["module_reasons"] = {}
    return parsed


def _infer_metric_family(metric, device_type):
    metric_key = str(metric or "").strip().lower()
    if metric_key in {"q_m3h", "flow_lpm", "flow", "flow_rate"}:
        return "flow"
    if metric_key in {"pressure_bar", "pressure"}:
        return "pressure"
    type_key = str(device_type or "").strip().lower()
    if "flow" in type_key:
        return "flow"
    if "pressure" in type_key:
        return "pressure"
    return None


def _infer_sensor_index(*parts):
    for raw in parts:
        token = str(raw or "").strip().lower()
        if token in {"1", "01", "001", "f1", "f01", "f001", "p1", "p01", "p001", "upstream", "inlet", "source"}:
            return 1
        if token in {"2", "02", "002", "f2", "f02", "f002", "p2", "p02", "p002", "downstream", "outlet", "sink"}:
            return 2
    descriptor = " ".join(str(p or "") for p in parts).lower()
    if re.search(r"(^|[^0-9])(0*1|f0*1|p0*1|upstream|inlet)([^0-9]|$)", descriptor):
        return 1
    if re.search(r"(^|[^0-9])(0*2|f0*2|p0*2|downstream|outlet)([^0-9]|$)", descriptor):
        return 2
    return None


def _extract_predict_snapshot(telemetry):
    slots = {"flow_1": None, "pressure_1": None, "flow_2": None, "pressure_2": None}
    for row in telemetry or []:
        if not isinstance(row, dict):
            continue
        metric = row.get("metric")
        family = _infer_metric_family(metric, row.get("type"))
        index = _infer_sensor_index(
            row.get("sensor_index"),
            row.get("position"),
            row.get("device_id"),
            row.get("type"),
            metric,
        )
        if family not in {"flow", "pressure"} or index not in {1, 2}:
            continue
        value = _optional_float(row.get("reading"))
        if value is None:
            values = row.get("values") if isinstance(row.get("values"), dict) else {}
            if metric in values:
                value = _optional_float(values.get(metric))
            if value is None:
                for key in ("q_m3h", "flow_lpm", "pressure_bar", "flow", "pressure"):
                    if key in values:
                        value = _optional_float(values.get(key))
                        if value is not None:
                            break
        if value is None:
            continue
        slots[f"{family}_{index}"] = value
    if any(v is None for v in slots.values()):
        return None
    return slots


def _ml_predict_sync(snapshot):
    ml_base_url = os.environ.get("ML_SERVICE_URL", "http://localhost:8001").rstrip("/")
    ml_service_url = f"{ml_base_url}/predict"
    timeout = float(os.environ.get("ML_SERVICE_TIMEOUT_SEC", "5"))
    response = requests.post(
        ml_service_url,
        json={
            "flow_1": float(snapshot["flow_1"]),
            "pressure_1": float(snapshot["pressure_1"]),
            "flow_2": float(snapshot["flow_2"]),
            "pressure_2": float(snapshot["pressure_2"]),
        },
        timeout=timeout,
    )
    response.raise_for_status()
    return response.json()


def _ml_ingest_sync(gateway_id, workspace_id, telemetry, devices):
    ml_base_url = os.environ.get("ML_SERVICE_URL", "http://localhost:8001").rstrip("/")
    ml_service_url = f"{ml_base_url}/telemetry/ingest"
    timeout = float(os.environ.get("ML_SERVICE_TIMEOUT_SEC", "5"))
    response = requests.post(
        ml_service_url,
        json={
            "gateway_id": gateway_id,
            "workspace_id": workspace_id,
            "telemetry": telemetry or [],
            "devices": devices or [],
        },
        timeout=timeout,
    )
    response.raise_for_status()
    return response.json()


def _normalize_device(raw, fallback_mcu_id, index):
    if not isinstance(raw, dict):
        return None

    device_id = str(raw.get("id") or "").strip()
    mcu_id = str(raw.get("microcontroller_id") or fallback_mcu_id or "").strip()
    if not device_id or not mcu_id:
        return None

    return {
        "id": device_id,
        "microcontroller_id": mcu_id,
        "type": str(raw.get("type") or "unknown"),
        "zone_id": str(raw.get("zone_id") or "").strip() or None,
        "lat": _optional_float(raw.get("lat")),
        "lng": _optional_float(raw.get("lng")),
        "status": str(raw.get("status") or "online"),
        "metric": str(raw.get("metric") or "value"),
        "reading": raw.get("reading", 0),
        "last_seen": str(raw.get("last_seen") or "just now"),
        "sequence": index,
    }


def _microcontrollers_from_devices(devices):
    by_mcu = {}
    for device in devices:
        mcu_id = device.get("microcontroller_id")
        if not mcu_id:
            continue
        if mcu_id not in by_mcu:
            by_mcu[mcu_id] = []
        by_mcu[mcu_id].append(device.get("id"))

    return [
        {"id": mcu_id, "device_ids": sorted(device_ids)}
        for mcu_id, device_ids in sorted(by_mcu.items())
    ]


def _tb_config():
    base_url = (
        os.environ.get("THINGSBOARD_BASE_URL")
        or os.environ.get("TB_BASE_URL")
        or "http://127.0.0.1:8081"
    ).rstrip("/")
    username = (
        os.environ.get("THINGSBOARD_TENANT_USERNAME")
        or os.environ.get("TB_TENANT_USERNAME")
        or "tenant@thingsboard.org"
    )
    password = (
        os.environ.get("THINGSBOARD_TENANT_PASSWORD")
        or os.environ.get("TB_TENANT_PASSWORD")
        or "tenant"
    )
    fallback_sim = (
        str(os.environ.get("THINGSBOARD_DISCOVERY_FALLBACK_SIM", "false")).strip().lower()
        in {"1", "true", "yes", "on"}
    )
    return {
        "base_url": base_url,
        "username": username,
        "password": password,
        "fallback_sim": fallback_sim,
    }


def _tb_request(method, path, token=None, payload=None, params=None, timeout=8):
    cfg = _tb_config()
    url = f"{cfg['base_url']}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["X-Authorization"] = f"Bearer {token}"
    response = requests.request(
        method=method,
        url=url,
        headers=headers,
        json=payload,
        params=params,
        timeout=timeout,
    )
    response.raise_for_status()
    if response.content:
        return response.json()
    return {}


def _tb_login():
    cfg = _tb_config()
    body = {"username": cfg["username"], "password": cfg["password"]}
    payload = _tb_request("POST", "/api/auth/login", payload=body, timeout=10)
    token = payload.get("token")
    if not token:
        raise ValueError("ThingsBoard login did not return token")
    return token


def _tb_gateway_identifier_keys(protocol):
    common = ["gateway_id", "serial_number", "imei", "eui", "mac", "client_id", "endpoint"]
    per_protocol = {
        "mqtt": ["client_id", "token", "gateway_id", "serial_number"],
        "modbus": ["modbus_id", "gateway_id", "serial_number"],
        "lwm2m": ["endpoint", "imei", "serial_number"],
        "opcua": ["endpoint_url", "gateway_id", "serial_number"],
        "bacnet": ["bacnet_device_id", "gateway_id", "serial_number"],
        "lorawan": ["dev_eui", "gateway_eui", "serial_number"],
    }
    protocol_keys = per_protocol.get(str(protocol or "").lower(), [])
    merged = []
    for key in protocol_keys + common:
        if key not in merged:
            merged.append(key)
    return merged


def _tb_find_gateway_device(token, gateway_id, protocol=None):
    try:
        payload = _tb_request(
            "GET",
            "/api/tenant/deviceInfos",
            token=token,
            params={"pageSize": 100, "page": 0, "textSearch": gateway_id},
        )
    except Exception:
        payload = {}
    candidates = payload.get("data", []) if isinstance(payload, dict) else []
    for item in candidates:
        if str(item.get("name") or "").strip() == gateway_id:
            return item

    # This endpoint is not available in some ThingsBoard versions/deploy modes.
    try:
        fallback = _tb_request(
            "GET",
            "/api/tenant/devices",
            token=token,
            params={"deviceName": gateway_id},
        )
    except Exception:
        fallback = {}
    if isinstance(fallback, dict) and fallback.get("id"):
        return fallback

    # Protocol-aware scan first, then lenient scan without protocol filter.
    keys = _tb_gateway_identifier_keys(protocol)
    protocol_hint = str(protocol or "").strip().lower()
    for strict_protocol in (True, False):
        page = 0
        while page < 20:
            listing = _tb_request(
                "GET",
                "/api/tenant/deviceInfos",
                token=token,
                params={"pageSize": 100, "page": page},
            )
            rows = listing.get("data", []) if isinstance(listing, dict) else []
            if not rows:
                break

            for row in rows:
                device_id = _tb_entity_id(row)
                if not device_id:
                    continue
                attrs = _tb_get_attrs(token, str(device_id))
                if not attrs:
                    continue

                proto_attr = str(attrs.get("protocol") or attrs.get("transport_protocol") or "").strip().lower()
                if strict_protocol and protocol_hint and proto_attr and proto_attr != protocol_hint:
                    continue

                for key in keys:
                    value = attrs.get(key)
                    if str(value or "").strip() == gateway_id:
                        return row
            if bool(listing.get("hasNext")):
                page += 1
            else:
                break
    return None


def _tb_entity_id(entity):
    value = entity.get("id")
    if isinstance(value, dict):
        return value.get("id")
    return value


def _tb_get_relations(token, from_id):
    try:
        payload = _tb_request(
            "GET",
            "/api/relations/info",
            token=token,
            params={"fromId": from_id, "fromType": "DEVICE"},
        )
        if isinstance(payload, list):
            return payload
    except Exception:
        pass

    payload = _tb_request(
        "GET",
        "/api/relations",
        token=token,
        params={"fromId": from_id, "fromType": "DEVICE"},
    )
    if isinstance(payload, list):
        return payload
    return []


def _tb_get_device(token, device_id):
    try:
        payload = _tb_request("GET", f"/api/device/info/{device_id}", token=token)
        if isinstance(payload, dict):
            return payload
    except Exception:
        pass
    payload = _tb_request("GET", f"/api/device/{device_id}", token=token)
    return payload if isinstance(payload, dict) else {}


def _tb_get_latest_values(token, device_id):
    keys = ",".join([
        "q_m3h", "flow_lpm", "pressure_bar", "soil_moisture_pct", "ec_ds_m", "ec_ms_cm", "ph",
        "temperature", "humidity", "flow", "pressure",
    ])
    try:
        payload = _tb_request(
            "GET",
            f"/api/plugins/telemetry/DEVICE/{device_id}/values/timeseries",
            token=token,
            params={"keys": keys, "limit": 1},
        )
        if isinstance(payload, dict):
            return payload
    except Exception:
        pass
    return {}


def _tb_get_attrs(token, device_id):
    keys = (
        "lat,lng,lon,microcontroller_id,mcu_id,"
        "device_type,deviceType,sensor_type,sensorType,type,"
        "zone_id,zone"
    )
    try:
        payload = _tb_request(
            "GET",
            f"/api/plugins/telemetry/DEVICE/{device_id}/values/attributes",
            token=token,
            params={"keys": keys},
        )
        if isinstance(payload, list):
            return {str(item.get("key")): item.get("value") for item in payload if isinstance(item, dict)}
    except Exception:
        pass
    return {}


def _tb_pick_metric_reading(timeseries, device_type_hint=None):
    hint = (device_type_hint or "").lower()
    if hint == "pressure_sensor":
        preferred = ["pressure_bar", "pressure", "q_m3h", "flow_lpm", "soil_moisture_pct", "ec_ds_m", "ec_ms_cm", "ph", "flow"]
    elif hint == "flowmeter":
        preferred = ["q_m3h", "flow_lpm", "flow", "pressure_bar", "pressure", "soil_moisture_pct", "ec_ds_m", "ec_ms_cm", "ph"]
    elif hint == "ph_sensor":
        preferred = ["ph", "pressure_bar", "q_m3h", "flow_lpm", "soil_moisture_pct", "ec_ds_m", "ec_ms_cm", "flow", "pressure"]
    elif hint == "soil_salinity_sensor":
        preferred = ["ec_ds_m", "ec_ms_cm", "soil_moisture_pct", "pressure_bar", "q_m3h", "flow_lpm", "ph", "flow", "pressure"]
    elif hint == "soil_moisture_sensor":
        preferred = ["soil_moisture_pct", "ec_ds_m", "ec_ms_cm", "pressure_bar", "q_m3h", "flow_lpm", "ph", "flow", "pressure"]
    else:
        preferred = ["q_m3h", "flow_lpm", "pressure_bar", "soil_moisture_pct", "ec_ds_m", "ec_ms_cm", "ph", "flow", "pressure"]
    for key in preferred:
        values = timeseries.get(key)
        if isinstance(values, list) and values:
            return key, values[0].get("value")
    for key, values in timeseries.items():
        if isinstance(values, list) and values:
            return key, values[0].get("value")
    return "value", 0


def _tb_canonical_type(value):
    raw = str(value or "").strip().lower()
    if not raw:
        return None
    key = re.sub(r"[^a-z0-9]+", "_", raw).strip("_")
    aliases = {
        "pressure_sensor": "pressure_sensor",
        "pressure": "pressure_sensor",
        "flowmeter": "flowmeter",
        "flow_meter": "flowmeter",
        "flow_sensor": "flowmeter",
        "flow": "flowmeter",
        "ph_sensor": "ph_sensor",
        "ph": "ph_sensor",
        "soil_salinity_sensor": "soil_salinity_sensor",
        "soil_salinity": "soil_salinity_sensor",
        "salinity_sensor": "soil_salinity_sensor",
        "ec_sensor": "soil_salinity_sensor",
        "soil_moisture_sensor": "soil_moisture_sensor",
        "soil_moisture": "soil_moisture_sensor",
        "moisture_sensor": "soil_moisture_sensor",
        "turbidity_sensor": "turbidity_sensor",
        "turbidity": "turbidity_sensor",
    }
    return aliases.get(key)


def _normalize_required_device_types(raw_value):
    values = []
    if isinstance(raw_value, list):
        values = raw_value
    elif isinstance(raw_value, str):
        values = [part.strip() for part in raw_value.split(",")]
    normalized = []
    for value in values:
        canonical = _tb_canonical_type(value)
        if canonical and canonical not in normalized:
            normalized.append(canonical)
    return normalized


def _filter_devices_by_types(devices, required_types):
    if not required_types:
        return devices
    allowed = set(required_types)
    return [
        device
        for device in devices
        if _tb_canonical_type(device.get("type")) in allowed
    ]


def _tb_infer_type(device_name, attrs, metric, tb_type=None, tb_label=None):
    explicit_candidates = [
        attrs.get("device_type"),
        attrs.get("deviceType"),
        attrs.get("sensor_type"),
        attrs.get("sensorType"),
        attrs.get("type"),
        tb_type,
        tb_label,
    ]
    for candidate in explicit_candidates:
        canonical = _tb_canonical_type(candidate)
        if canonical:
            return canonical

    name = str(device_name or "").lower()
    if "salinity" in name or metric in {"ec_ds_m", "ec_ms_cm"}:
        return "soil_salinity_sensor"
    if "soil" in name or metric == "soil_moisture_pct":
        return "soil_moisture_sensor"
    if re.search(r"(^|[^a-z0-9])(ps|pressure)([^a-z0-9]|$)", name) or metric in {"pressure_bar", "pressure"}:
        return "pressure_sensor"
    if re.search(r"(^|[^a-z0-9])(fm|flow|flowmeter)([^a-z0-9]|$)", name) or metric in {"q_m3h", "flow_lpm", "flow"}:
        return "flowmeter"
    if "ph" in name or metric == "ph":
        return "ph_sensor"
    if "turbidity" in name or metric in {"turbidity", "turbidity_ntu"}:
        return "turbidity_sensor"
    return "sensor"


def _tb_infer_mcu(device_name):
    name = str(device_name or "").lower()
    return "mcu" in name or "controller" in name


def _tb_float(value, default):
    try:
        return round(float(value), 7)
    except (TypeError, ValueError):
        return default


def _tb_optional_float(value):
    try:
        if value is None or value == "":
            return None
        return round(float(value), 7)
    except (TypeError, ValueError):
        return None


def _tb_device_name(obj):
    return str(obj.get("name") or obj.get("toName") or obj.get("label") or "").strip()


def _parse_ts(value):
    if value in (None, ""):
        return timezone.now()
    if isinstance(value, (int, float)):
        ts = float(value)
        if ts > 10_000_000_000:
            ts = ts / 1000.0
        return datetime.fromtimestamp(ts, tz=dt_timezone.utc)
    if isinstance(value, str):
        parsed = parse_datetime(value)
        if parsed is not None:
            return parsed if parsed.tzinfo else timezone.make_aware(parsed, dt_timezone.utc)
    return timezone.now()


def _build_readings_payload(values, metric, reading):
    if isinstance(values, dict) and values:
        return values
    if metric and reading is not None:
        return {metric: reading}
    if reading is not None:
        return {"value": reading}
    return {}


def _persist_gateway_inventory(workspace, gateway_id, devices, protocol=None):
    if not devices:
        return
    try:
        gateway = Gateway.objects.filter(id=gateway_id, workspace=workspace).first()
        if not gateway:
            gateway, _ = Gateway.objects.get_or_create(
                id=gateway_id,
                defaults={"workspace": workspace, "status": "online", "last_seen": timezone.now()},
            )

        mcu_ids = sorted({
            str(device.get("microcontroller_id") or "").strip()
            for device in devices
            if isinstance(device, dict) and str(device.get("microcontroller_id") or "").strip()
        })

        for mcu_id in mcu_ids:
            Microcontroller.objects.update_or_create(
                workspace=workspace,
                gateway=gateway,
                mcu_id=mcu_id,
                defaults={
                    "protocol": (protocol or None),
                    "status": "online",
                    "last_seen": timezone.now(),
                },
            )

        for device in devices:
            if not isinstance(device, dict):
                continue
            device_id = str(device.get("id") or "").strip()
            mcu_id = str(device.get("microcontroller_id") or "").strip()
            if not device_id or not mcu_id:
                continue
            metadata = {}
            if device.get("tb_id"):
                metadata["tb_id"] = device.get("tb_id")
            FieldDevice.objects.update_or_create(
                workspace=workspace,
                gateway=gateway,
                device_id=device_id,
                defaults={
                    "mcu_id": mcu_id,
                    "device_type": str(device.get("type") or "sensor"),
                    "metric_key": str(device.get("metric") or "value"),
                    "status": str(device.get("status") or "online"),
                    "lat": _optional_float(device.get("lat")),
                    "lng": _optional_float(device.get("lng")),
                    "metadata": metadata,
                    "last_seen": timezone.now(),
                },
            )
    except DatabaseError as exc:
        logger.warning("Inventory persistence skipped due to DB error: %s", str(exc))


def _persist_telemetry_row(workspace, gateway, device_id, mcu_id, ts, lat, lng, readings):
    try:
        DeviceReading.objects.create(
            workspace=workspace,
            gateway=gateway,
            mcu_id=mcu_id,
            device_id=device_id,
            ts=ts,
            lat=lat,
            lng=lng,
            readings=readings or {},
        )
        DeviceReadingLatest.objects.update_or_create(
            workspace=workspace,
            gateway=gateway,
            device_id=device_id,
            defaults={
                "mcu_id": mcu_id,
                "ts": ts,
                "lat": lat,
                "lng": lng,
                "readings": readings or {},
            },
        )
        FieldDevice.objects.filter(
            workspace=workspace,
            gateway=gateway,
            device_id=device_id,
        ).update(
            mcu_id=mcu_id,
            lat=lat,
            lng=lng,
            status="online",
            metric_key=next(iter(readings.keys()), None) if readings else None,
            last_seen=ts,
        )
        Microcontroller.objects.filter(
            workspace=workspace,
            gateway=gateway,
            mcu_id=mcu_id,
        ).update(
            status="online",
            last_seen=ts,
        )
    except DatabaseError as exc:
        logger.warning("Telemetry persistence skipped due to DB error: %s", str(exc))


def _process_layout_sync_from_upload(workspace_id, layout_file, task_filename):
    # Sanitize the extension: only allow standard alphanumeric extensions
    raw_ext = Path(layout_file.name).suffix or ".bin"
    if not re.match(r"^\.[a-zA-Z0-9]{1,10}$", raw_ext):
        raw_ext = ".bin"

    # Use the system's temporary directory for cross-platform support (Windows/Linux)
    temp_dir = Path(tempfile.gettempdir()).resolve()
    # Combining a safe directory with a generated UUID prevents path traversal
    safe_filename = f"layout_sync_{uuid.uuid4().hex}{raw_ext}"
    tmp_path = (temp_dir / safe_filename).resolve()

    # Final validation: ensure the resolved path is actually inside the temp directory
    if not str(tmp_path).startswith(str(temp_dir)):
        raise ValueError("Illegal file path detected.")

    with tmp_path.open("wb") as target:
        for chunk in layout_file.chunks():
            target.write(chunk)
    return layout_process(workspace_id, str(tmp_path), task_filename)


def _process_layout_sync_from_storage_key(workspace_id, storage_key, task_filename):
    return layout_process(workspace_id, storage_key, task_filename)


def _tb_build_inventory(gateway_id, workspace, protocol=None):
    token = _tb_login()
    gateway_obj = _tb_find_gateway_device(token, gateway_id, protocol=protocol)
    if not gateway_obj:
        proto_hint = f" for protocol '{protocol}'" if protocol else ""
        raise ValueError(f"Gateway '{gateway_id}' not found in ThingsBoard{proto_hint}.")

    gateway_tb_id = _tb_entity_id(gateway_obj)
    if not gateway_tb_id:
        raise ValueError("Gateway found but entity ID is missing in ThingsBoard response.")

    gw_relations = _tb_get_relations(token, gateway_tb_id)
    mcu_objects = []
    direct_devices = []
    for rel in gw_relations:
        if not isinstance(rel, dict):
            continue
        to = rel.get("to") or {}
        if str(to.get("entityType") or "").upper() != "DEVICE":
            continue
        to_id = str(to.get("id") or "").strip()
        if not to_id:
            continue
        device_obj = _tb_get_device(token, to_id)
        name = _tb_device_name(device_obj) or _tb_device_name(rel) or to_id
        if _tb_infer_mcu(name):
            mcu_objects.append({"id": to_id, "name": name})
        else:
            direct_devices.append({
                "id": to_id,
                "name": name,
                "tb_type": device_obj.get("type"),
                "tb_label": device_obj.get("label"),
                "mcu_name": f"{gateway_id}-MCU-01",
            })

    if not mcu_objects and direct_devices:
        mcu_objects = [{"id": "virtual-mcu-01", "name": f"{gateway_id}-MCU-01"}]

    devices = []
    missing_coordinates = []
    for idx, d in enumerate(direct_devices):
        attrs = _tb_get_attrs(token, d["id"])
        ts = _tb_get_latest_values(token, d["id"])
        provisional_type = _tb_infer_type(d["name"], attrs, "", d.get("tb_type"), d.get("tb_label"))
        metric, reading = _tb_pick_metric_reading(ts, provisional_type)
        lat_val = _tb_optional_float(attrs.get("lat"))
        lng_val = _tb_optional_float(attrs.get("lng", attrs.get("lon")))
        if lat_val is None or lng_val is None:
            missing_coordinates.append(d["name"])
            continue
        devices.append({
            "id": d["name"],
            "microcontroller_id": d["mcu_name"],
            "type": _tb_infer_type(d["name"], attrs, metric, d.get("tb_type"), d.get("tb_label")),
            "zone_id": str(attrs.get("zone_id") or attrs.get("zone") or "").strip() or None,
            "lat": lat_val,
            "lng": lng_val,
            "status": "online",
            "metric": metric,
            "reading": reading,
            "last_seen": "just now",
            "tb_id": d["id"],
        })

    for mcu in mcu_objects:
        mcu_relations = _tb_get_relations(token, mcu["id"])
        for rel in mcu_relations:
            if not isinstance(rel, dict):
                continue
            to = rel.get("to") or {}
            if str(to.get("entityType") or "").upper() != "DEVICE":
                continue
            dev_id = str(to.get("id") or "").strip()
            if not dev_id:
                continue
            dev_obj = _tb_get_device(token, dev_id)
            dev_name = _tb_device_name(dev_obj) or _tb_device_name(rel) or dev_id
            attrs = _tb_get_attrs(token, dev_id)
            ts = _tb_get_latest_values(token, dev_id)
            provisional_type = _tb_infer_type(dev_name, attrs, "", dev_obj.get("type"), dev_obj.get("label"))
            metric, reading = _tb_pick_metric_reading(ts, provisional_type)
            lat_val = _tb_optional_float(attrs.get("lat"))
            lng_val = _tb_optional_float(attrs.get("lng", attrs.get("lon")))
            if lat_val is None or lng_val is None:
                missing_coordinates.append(dev_name)
                continue
            devices.append({
                "id": dev_name,
                "microcontroller_id": mcu["name"],
                "type": _tb_infer_type(dev_name, attrs, metric, dev_obj.get("type"), dev_obj.get("label")),
                "zone_id": str(attrs.get("zone_id") or attrs.get("zone") or "").strip() or None,
                "lat": lat_val,
                "lng": lng_val,
                "status": "online",
                "metric": metric,
                "reading": reading,
                "last_seen": "just now",
                "tb_id": dev_id,
            })

    if not devices:
        raise ValueError(
            "Gateway found, but no geolocated connected devices were found. "
            "Set ThingsBoard server attributes lat/lng on field devices and create relations: "
            "Gateway -> MCU -> Devices (or Gateway -> Devices)."
        )

    dedup = {}
    for dev in devices:
        dedup[dev["id"]] = dev
    devices = sorted(dedup.values(), key=lambda d: (d["microcontroller_id"], d["id"]))
    return devices, sorted(set(missing_coordinates))


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            refresh = RefreshToken.for_user(user)
            return Response({
                'access': str(refresh.access_token),
                'refresh': str(refresh),
                'user': UserSerializer(user).data,
                'secret_key': user._plain_secret_key,  # shown ONCE at registration
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    

class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response({'detail': 'Password updated successfully.'}, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CheckAvailabilityView(APIView):
    permission_classes = []

    def post(self, request):
        from django.contrib.auth import get_user_model
        import random
        User = get_user_model()
        data = request.data
        result = {}

        if 'username' in data:
            uname = data['username'].strip()
            taken = User.objects.filter(username__iexact=uname).exists()
            result['username_taken'] = taken
            if taken:
                # Generate 3 suggestions
                suggestions = []
                for suffix in [str(random.randint(10, 99)), str(random.randint(100, 999)), f"_{random.randint(1, 99)}"]:
                    candidate = f"{uname}{suffix}"
                    if not User.objects.filter(username__iexact=candidate).exists():
                        suggestions.append(candidate)
                result['suggestions'] = suggestions[:3]

        if 'email' in data:
            result['email_taken'] = User.objects.filter(
                email__iexact=data['email'].strip()
            ).exists()

        return Response(result, status=200)
    
class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        refresh = RefreshToken.for_user(user)
        return Response({
            'user': UserSerializer(user).data,
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        })

import logging
logger = logging.getLogger(__name__)

@api_view(['POST'])
@permission_classes([AllowAny])
def google_auth(request):
    token = request.data.get('token')

    if not token:
        return Response({'error': 'No token provided'}, status=status.HTTP_400_BAD_REQUEST)

    # 🛡️ THE BULLETPROOF CAST: Force it to be a string, no matter what OS/Render does.
    client_id = str(settings.GOOGLE_CLIENT_ID).strip()
    
    # 🕵️‍♂️ THE TRAP: This will print to your Render Dashboard Logs
    print("====== GOOGLE AUTH DEBUG ======")
    print(f"Raw Token Length: {len(token)}")
    print(f"Client ID being used: [{client_id}]")
    print("===============================")

    try:
        idinfo = id_token.verify_oauth2_token(
            token,
            google_requests.Request(),
            audience=client_id # explicitly name the argument just to be safe
        )

        email = idinfo.get('email')
        full_name = idinfo.get('name', '')
        google_sub = idinfo.get('sub')

        if not email:
            return Response(
                {'error': 'Google account email not available'},
                status=status.HTTP_400_BAD_REQUEST
            )

        User = get_user_model()
        user = User.objects.filter(email__iexact=email).first()

        if not user:
            base_username = re.sub(r'[^a-zA-Z0-9_]', '', email.split('@')[0]) or 'user'
            username = base_username
            counter = 1

            while User.objects.filter(username=username).exists():
                username = f"{base_username}{counter}"
                counter += 1

            user = User.objects.create_user(
                username=username,
                email=email,
                password=None,
                full_name=full_name or username,
            )

        refresh = RefreshToken.for_user(user)

        return Response(
            {
                'user': UserSerializer(user).data,
                'refresh': str(refresh),
                'access': str(refresh.access_token),
                'google_sub': google_sub,
            },
            status=status.HTTP_200_OK
        )

    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_400_BAD_REQUEST
        )
    
class UserProfileView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user


class OnboardingView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        data = request.data
        user = request.user
        def _clean_text(value):
            return str(value or "").strip()

        workspace = _resolve_user_workspace(request, create_if_missing=False)
        create_new_workspace = _is_truthy(data.get("createNewWorkspace"))
        existing_workspaces = Workspace.objects.filter(owner=user).order_by("created_at")
        fallback_workspace = existing_workspaces.first()
        incoming_company_name = _clean_text(data.get("companyName"))
        fallback_company_name = _clean_text(fallback_workspace.company_name if fallback_workspace else "")
        resolved_company_name = incoming_company_name or fallback_company_name

        if workspace and create_new_workspace:
            workspace = None

        if workspace is None:
            incomplete = Workspace.objects.filter(
                owner=user,
                workspace_name__in=['', None],
                status='active'
            ).first()

            if incomplete and not create_new_workspace:
                workspace = incomplete
                workspace.workspace_name = data.get('workspaceName') or ''
                workspace.company_name = resolved_company_name
                workspace.company_type = data.get('companyType', '') or (fallback_workspace.company_type if fallback_workspace else '')
                workspace.location = data.get('location', '') or (fallback_workspace.location if fallback_workspace else '')
                workspace.team_size = data.get('teamSize', '')
                workspace.modules = data.get('modules', [])
                workspace.gateway_id = data.get('gatewayId', '')
                workspace.devices = data.get('devices', [])
                workspace.invite_emails = data.get('inviteEmails', [])
                workspace.threshold_soil_moisture = data.get('thresholds', {}).get('soilMoisture', [20, 80])
                workspace.threshold_ph = data.get('thresholds', {}).get('ph', [6, 8])
                workspace.threshold_pressure = data.get('thresholds', {}).get('pressure', [2, 6])
                workspace.notifications = data.get('notifications', [])
                workspace.demand_forecasting_plants = data.get('demandForecasting', {}).get('plants', [])
                workspace.demand_forecasting_systems = data.get('demandForecasting', {}).get('waterSystems', [])
                workspace.layout_polygon = data.get('layout_polygon', [])
                workspace.layout_area_m2 = float(data.get('layout_area_m2', 0))
                workspace.layout_notes = data.get('layout_notes', '')
                workspace.layout_file_name = data.get('layout_file_name')
                workspace.layout_status = 'processing' if data.get('layout_file_name') else 'idle'
                workspace.layout_job_error = None
                workspace.status = 'active'
                workspace.save()
            else:
                workspace = Workspace.objects.create(
                    owner=user,
                    workspace_name=data.get('workspaceName', ''),
                    company_name=resolved_company_name,
                    company_type=data.get('companyType', '') or (fallback_workspace.company_type if fallback_workspace else ''),
                    location=data.get('location', '') or (fallback_workspace.location if fallback_workspace else ''),
                    team_size=data.get('teamSize', ''),
                    modules=data.get('modules', []),
                    gateway_id=data.get('gatewayId', ''),
                    devices=data.get('devices', []),
                    invite_emails=data.get('inviteEmails', []),
                    threshold_soil_moisture=data.get('thresholds', {}).get('soilMoisture', [20, 80]),
                    threshold_ph=data.get('thresholds', {}).get('ph', [6, 8]),
                    threshold_pressure=data.get('thresholds', {}).get('pressure', [2, 6]),
                    notifications=data.get('notifications', []),
                    demand_forecasting_plants=data.get('demandForecasting', {}).get('plants', []),
                    demand_forecasting_systems=data.get('demandForecasting', {}).get('waterSystems', []),
                    layout_polygon=data.get('layout_polygon', []),
                    layout_area_m2=float(data.get('layout_area_m2', 0)),
                    layout_notes=data.get('layout_notes', ''),
                    layout_file_name=data.get('layout_file_name'),
                    layout_status='processing' if data.get('layout_file_name') else 'idle',
                    layout_job_error=None,
                    status='active',
                )
        else:
            workspace.workspace_name = data.get('workspaceName') or ''
            if fallback_workspace and str(workspace.id) != str(fallback_workspace.id):
                workspace.company_name = fallback_company_name or workspace.company_name
            elif incoming_company_name:
                workspace.company_name = incoming_company_name
            elif not workspace.company_name and fallback_company_name:
                workspace.company_name = fallback_company_name
            workspace.company_type = data.get('companyType', workspace.company_type)
            workspace.location = data.get('location', workspace.location)
            workspace.team_size = data.get('teamSize', workspace.team_size)
            workspace.modules = data.get('modules', workspace.modules)
            workspace.gateway_id = data.get('gatewayId', workspace.gateway_id)
            workspace.devices = data.get('devices', workspace.devices)
            workspace.invite_emails = data.get('inviteEmails', workspace.invite_emails)
            workspace.threshold_soil_moisture = data.get('thresholds', {}).get('soilMoisture', workspace.threshold_soil_moisture)
            workspace.threshold_ph = data.get('thresholds', {}).get('ph', workspace.threshold_ph)
            workspace.threshold_pressure = data.get('thresholds', {}).get('pressure', workspace.threshold_pressure)
            workspace.notifications = data.get('notifications', workspace.notifications)
            workspace.demand_forecasting_plants = data.get('demandForecasting', {}).get('plants', workspace.demand_forecasting_plants)
            workspace.demand_forecasting_systems = data.get('demandForecasting', {}).get('waterSystems', workspace.demand_forecasting_systems)
            workspace.layout_polygon = data.get('layout_polygon', workspace.layout_polygon)
            workspace.layout_area_m2 = float(data.get('layout_area_m2', workspace.layout_area_m2))
            workspace.layout_notes = data.get('layout_notes', workspace.layout_notes)
            workspace.layout_file_name = data.get('layout_file_name', workspace.layout_file_name)
            workspace.layout_status = 'processing' if data.get('layout_file_name') else workspace.layout_status
            workspace.layout_job_error = None
            workspace.status = 'active'
            workspace.save()


        for email in data.get('inviteEmails', []):
            WorkspaceInvite.objects.get_or_create(workspace=workspace, email=email)

        gateway_id = data.get('gatewayId', '').strip()
        if gateway_id:
            Gateway.objects.get_or_create(id=gateway_id, defaults={'workspace': workspace})

        return Response({
            'success': True,
            'workspace_id': str(workspace.id),
            'workspace': WorkspaceSerializer(workspace).data,
        }, status=status.HTTP_201_CREATED)

    def get(self, request):
        workspaces = Workspace.objects.filter(owner=request.user).order_by("created_at")
        workspace = _resolve_user_workspace(request, create_if_missing=False)
        if not workspace:
            return Response({'exists': False, 'workspaces': []})
        return Response({
            'exists': True,
            'workspace': WorkspaceSerializer(workspace).data,
            'workspaces': WorkspaceSerializer(workspaces, many=True).data,
        })


class WorkspaceInviteView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        workspace = _resolve_user_workspace(request, create_if_missing=True)
        if not workspace:
            return Response({"error": "Workspace not found"}, status=status.HTTP_404_NOT_FOUND)

        email = str(request.data.get("email") or "").strip()
        if not email:
            return Response({"error": "Email is required"}, status=status.HTTP_400_BAD_REQUEST)

        # Check if already invited to avoid spamming
        # (Optional: allow re-sending if requested)
        
        # Add to workspace invite_emails list if not present
        current_invites = workspace.invite_emails or []
        if email not in current_invites:
            workspace.invite_emails = current_invites + [email]
            workspace.save(update_fields=["invite_emails"])

        invite, _ = WorkspaceInvite.objects.update_or_create(
            workspace=workspace, email=email,
            defaults={
                'token': uuid.uuid4(),
                'expires_at': timezone.now() + timedelta(hours=72),
                'status': 'pending',
            }
        )

        inviter_name = request.user.full_name or request.user.username or "A colleague"
        workspace_name = workspace.workspace_name or workspace.company_name or "AquaNex Workspace"
        frontend_url = settings.FRONTEND_URL.rstrip('/')
        invite_link = f"{frontend_url}/accept-invite/{invite.token}"

        try:
            from .utils import send_workspace_invite
            success = send_workspace_invite(email, workspace_name, inviter_name, invite_link)
            if success:
                return Response({"success": True, "message": f"Invitation sent to {email}"})
            else:
                return Response({"success": False, "error": "Failed to send email"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except Exception as e:
            logger.error(f"Failed to send invite email: {e}")
            return Response({"success": False, "error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AcceptInviteView(APIView):
    permission_classes = [AllowAny]

    def _get_valid_invite(self, token):
        """Look up invite by token and validate it is still usable."""
        try:
            invite = WorkspaceInvite.objects.select_related('workspace').get(token=token)
        except WorkspaceInvite.DoesNotExist:
            return None, "Invalid invitation link."
        if invite.status != 'pending':
            return None, "This invitation has already been used."
        if invite.expires_at and invite.expires_at < timezone.now():
            return None, "This invitation link has expired."
        return invite, None

    def get(self, request, token):
        invite, error = self._get_valid_invite(token)
        if error:
            return Response({"error": error}, status=status.HTTP_400_BAD_REQUEST)
        workspace_name = invite.workspace.workspace_name or invite.workspace.company_name or "AquaNex Workspace"
        return Response({"email": invite.email, "workspace_name": workspace_name})

    def post(self, request, token):
        invite, error = self._get_valid_invite(token)
        if error:
            return Response({"error": error}, status=status.HTTP_400_BAD_REQUEST)

        full_name = str(request.data.get('full_name', '')).strip()
        password = str(request.data.get('password', '')).strip()

        if not full_name:
            return Response({"error": "Full name is required."}, status=status.HTTP_400_BAD_REQUEST)
        if len(password) < 8:
            return Response({"error": "Password must be at least 8 characters."}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(email=invite.email).exists():
            return Response({"error": "An account with this email already exists."}, status=status.HTTP_400_BAD_REQUEST)

        # Derive a unique username from the email local-part
        base = re.sub(r'[^a-zA-Z0-9_]', '', invite.email.split('@')[0]) or 'user'
        username = base
        counter = 1
        while User.objects.filter(username=username).exists():
            username = f"{base}{counter}"
            counter += 1

        import secrets as _secrets
        from django.contrib.auth.hashers import make_password as _make_password

        user = User.objects.create_user(
            username=username,
            password=password,
            full_name=full_name,
            email=invite.email,
        )
        user.secret_key_hash = _make_password(_secrets.token_urlsafe(16))
        user.save(update_fields=['secret_key_hash'])

        invite.status = 'accepted'
        invite.save(update_fields=['status'])

        refresh = RefreshToken.for_user(user)
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserSerializer(user).data,
        }, status=status.HTTP_201_CREATED)


class WorkspaceListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        workspaces = Workspace.objects.filter(owner=request.user).order_by("created_at")
        active = _resolve_user_workspace(request, create_if_missing=False)
        return Response({
            "workspaces": WorkspaceSerializer(workspaces, many=True).data,
            "active_workspace_id": str(active.id) if active else None,
        })

class WorkspaceDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        try:
            workspace = Workspace.objects.get(id=pk, owner=request.user)
        except Workspace.DoesNotExist:
            return Response({"error": "Workspace not found"}, status=status.HTTP_404_NOT_FOUND)

        workspace.delete()
        return Response({"success": True}, status=status.HTTP_204_NO_CONTENT)
    
class LayoutModuleRecommendationView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        workspace = _resolve_user_workspace(request, create_if_missing=False)
        raw_polygon = request.data.get("layout_polygon")
        if raw_polygon is None and workspace is not None:
            raw_polygon = workspace.layout_polygon
        polygon = _normalize_layout_polygon(raw_polygon)
        if len(polygon) < 3:
            return Response({"error": "layout_polygon with at least 3 points is required"}, status=status.HTTP_400_BAD_REQUEST)

        area_m2, centroid = _layout_area_and_centroid(polygon)
        if not centroid:
            return Response({"error": "Unable to resolve layout centroid"}, status=status.HTTP_400_BAD_REQUEST)

        radius_m = max(250, min(2500, int(math.sqrt(max(area_m2, 1.0) / math.pi) * 1.5)))
        signals = {
            "road_elements": 0,
            "green_elements": 0,
            "decorative_elements": 0,
            "agriculture_elements": 0,
            "empty_ground_elements": 0,
            "total_elements": 0,
        }
        signal_error = ""
        try:
            signals = _overpass_location_signals(centroid["lat"], centroid["lng"], radius_m)
        except Exception as exc:
            signal_error = str(exc)

        place_name = ""
        try:
            place_name = _reverse_geocode_name(centroid["lat"], centroid["lng"])
        except Exception:
            place_name = ""

        heuristic = _heuristic_module_recommendation(area_m2, signals)
        heuristic_modules = heuristic["recommended_modules"]
        llm_context = {
            "centroid": centroid,
            "area_m2": round(area_m2, 2),
            "search_radius_m": radius_m,
            "signals": signals,
            "place_name": place_name,
        }

        try:
            llm_result = _groq_module_recommendation(llm_context, heuristic_modules)
        except Exception as exc:
            return Response(
                {
                    "error": f"Groq recommendation failed: {str(exc)}",
                },
                status=status.HTTP_502_BAD_GATEWAY,
            )

        llm_modules = llm_result.get("recommended_modules")
        if not isinstance(llm_modules, list) or not llm_modules:
            return Response(
                {"error": "Groq recommendation failed: empty recommended_modules"},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        recommended_modules = llm_modules
        module_reasons = heuristic.get("module_reasons", {})
        llm_reasons = llm_result.get("module_reasons")
        if isinstance(llm_reasons, dict) and llm_reasons:
            module_reasons = llm_reasons
        summary = str(llm_result.get("summary") or "").strip() or "Module recommendations generated from layout and geospatial context."
        source = "groq_llm"

        if "pipeline_management" not in recommended_modules:
            recommended_modules = ["pipeline_management", *recommended_modules]

        return Response({
            "success": True,
            "source": source,
            "centroid": centroid,
            "area_m2": round(area_m2, 2),
            "place_name": place_name,
            "signals": signals,
            "recommended_modules": recommended_modules,
            "module_reasons": module_reasons,
            "summary": summary,
            "signal_error": signal_error,
        }, status=status.HTTP_200_OK)


class GatewayDiscoverView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        gateway_id = (request.data.get("gateway_id") or "").strip()
        protocol = str(request.data.get("protocol") or "").strip().lower()
        force_refresh = bool(request.data.get("force_refresh", False))
        preview_only = bool(request.data.get("preview_only", False))
        required_types = _normalize_required_device_types(request.data.get("required_device_types"))
        if not gateway_id:
            return Response({"error": "gateway_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        workspace = _resolve_user_workspace(request, create_if_missing=True)
        if not workspace:
            return Response({"error": "workspace not found"}, status=status.HTTP_404_NOT_FOUND)

        # Return existing memory if gateway already paired.
        if (
            not preview_only
            and not force_refresh
            and workspace.gateway_id == gateway_id
            and workspace.devices
        ):
            filtered_devices = _filter_devices_by_types(workspace.devices, required_types)
            return Response({
                "success": True,
                "gateway_id": gateway_id,
                "source": "gateway_memory",
                "devices": filtered_devices,
                "microcontrollers": _microcontrollers_from_devices(filtered_devices),
                "required_device_types": required_types,
            }, status=status.HTTP_200_OK)

        cfg = _tb_config()
        try:
            devices, missing_coordinates = _tb_build_inventory(gateway_id, workspace, protocol=protocol or None)
            source = "thingsboard_live"
        except Exception as exc:
            logger.warning("ThingsBoard discovery failed for gateway %s: %s", gateway_id, str(exc))
            if not cfg["fallback_sim"]:
                return Response(
                    {
                        "error": f"Gateway discovery failed: {str(exc)}",
                        "hint": (
                            "Verify ThingsBoard is reachable and credentials are correct. "
                            "Set THINGSBOARD_BASE_URL, THINGSBOARD_TENANT_USERNAME, "
                            "THINGSBOARD_TENANT_PASSWORD. Also ensure gateway identity "
                            "attributes are set (gateway_id/client_id/serial_number etc)."
                        ),
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Optional fallback simulation for local development.
            seed = int(hashlib.sha256(gateway_id.encode()).hexdigest()[:8], 16)
            rng = random.Random(seed)
            center_lat, center_lng = 25.2048, 55.2708
            devices = []
            for idx in range(1, 7):
                devices.append({
                    "id": f"{gateway_id}-DEV-{idx:02d}",
                    "microcontroller_id": f"{gateway_id}-MCU-{((idx - 1) // 2) + 1:02d}",
                    "type": "sensor",
                    "lat": None,
                    "lng": None,
                    "status": "online",
                    "metric": "value",
                    "reading": round(rng.uniform(1.0, 99.0), 2),
                    "last_seen": "just now",
                })
            source = "simulated_fallback"
            missing_coordinates = [device["id"] for device in devices]

        devices = _filter_devices_by_types(devices, required_types)

        if not preview_only:
            workspace.gateway_id = gateway_id
            workspace.devices = devices
            workspace.save(update_fields=["gateway_id", "devices"])

            Gateway.objects.update_or_create(
                id=gateway_id,
                defaults={"workspace": workspace, "status": "online"},
            )
            _persist_gateway_inventory(workspace, gateway_id, devices, protocol=protocol or None)

        return Response({
            "success": True,
            "gateway_id": gateway_id,
            "protocol": protocol or "auto",
            "preview_only": preview_only,
            "source": source,
            "devices": devices,
            "microcontrollers": _microcontrollers_from_devices(devices),
            "missing_coordinates": missing_coordinates,
            "required_device_types": required_types,
        }, status=status.HTTP_200_OK)


class GatewayRegisterView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        gateway_id = str(request.data.get("gateway_id") or "").strip()
        if not gateway_id:
            return Response({"error": "gateway_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        workspace = _resolve_user_workspace(request, create_if_missing=True)
        if not workspace:
            return Response({"error": "workspace not found"}, status=status.HTTP_404_NOT_FOUND)

        raw_devices = request.data.get("devices")
        raw_mcus = request.data.get("microcontrollers")

        normalized_devices = []
        if isinstance(raw_devices, list):
            for idx, item in enumerate(raw_devices):
                device = _normalize_device(item, "", idx)
                if device:
                    normalized_devices.append(device)
        elif isinstance(raw_mcus, list):
            sequence = 0
            for mcu in raw_mcus:
                if not isinstance(mcu, dict):
                    continue
                mcu_id = str(mcu.get("id") or "").strip()
                for raw_device in (mcu.get("devices") or []):
                    if isinstance(raw_device, str):
                        raw_device = {"id": raw_device}
                    device = _normalize_device(raw_device, mcu_id, sequence)
                    if device:
                        normalized_devices.append(device)
                        sequence += 1

        if not normalized_devices:
            return Response(
                {"error": "No valid devices provided. Send devices[] or microcontrollers[]."},
                status=status.HTTP_400_BAD_REQUEST
            )

        deduped = {}
        for item in normalized_devices:
            deduped[item["id"]] = item

        devices = sorted(deduped.values(), key=lambda d: (d["microcontroller_id"], d["id"]))
        microcontrollers = _microcontrollers_from_devices(devices)

        workspace.gateway_id = gateway_id
        workspace.devices = devices
        workspace.save(update_fields=["gateway_id", "devices"])

        Gateway.objects.update_or_create(
            id=gateway_id,
            defaults={
                "workspace": workspace,
                "status": "online",
                "last_seen": timezone.now(),
            },
        )
        _persist_gateway_inventory(workspace, gateway_id, devices, protocol=request.data.get("protocol"))

        return Response({
            "success": True,
            "gateway_id": gateway_id,
            "microcontrollers": microcontrollers,
            "devices": devices,
            "counts": {
                "microcontrollers": len(microcontrollers),
                "devices": len(devices),
            }
        }, status=status.HTTP_200_OK)


class GatewayTelemetryIngestView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        gateway_id = str(request.data.get("gateway_id") or "").strip()
        prefer_sync_ml = True
        if "prefer_sync_ml" in request.data:
            prefer_sync_ml = _is_truthy(request.data.get("prefer_sync_ml"))
        elif _is_truthy(request.data.get("allow_async_ml")):
            prefer_sync_ml = False
        if not gateway_id:
            return Response({"error": "gateway_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        workspace = Workspace.objects.filter(gateway_id=gateway_id).first()
        if not workspace:
            return Response({"error": "gateway_id not registered"}, status=status.HTTP_404_NOT_FOUND)
        gateway = Gateway.objects.filter(id=gateway_id, workspace=workspace).first()
        if not gateway:
            gateway, _ = Gateway.objects.get_or_create(
                id=gateway_id,
                defaults={"workspace": workspace, "status": "online", "last_seen": timezone.now()},
            )

        known_devices = {}
        for device in workspace.devices or []:
            if not isinstance(device, dict):
                continue
            dev_id = str(device.get("id") or "").strip()
            if dev_id:
                known_devices[dev_id] = device

        if not known_devices:
            return Response({"error": "No devices registered for gateway"}, status=status.HTTP_400_BAD_REQUEST)

        records = request.data.get("telemetry")
        if not isinstance(records, list):
            records = [request.data]

        accepted = 0
        rejected = []
        anomalies = []
        ml_records = []
        now_label = timezone.now().isoformat()

        for idx, row in enumerate(records):
            if not isinstance(row, dict):
                rejected.append({"index": idx, "error": "invalid telemetry row"})
                continue

            device_id = str(row.get("device_id") or "").strip()
            mcu_id = str(row.get("mcu_id") or "").strip()
            lat = row.get("lat")
            lng = row.get("lng")
            values = row.get("values") if isinstance(row.get("values"), dict) else {}
            metric = str(row.get("metric") or "").strip()
            reading = row.get("reading")
            ts = _parse_ts(row.get("ts"))

            if not device_id or device_id not in known_devices:
                rejected.append({"index": idx, "error": "unknown device_id", "device_id": device_id})
                continue

            device = known_devices[device_id]
            if mcu_id and device.get("microcontroller_id") != mcu_id:
                rejected.append({
                    "index": idx,
                    "error": "mcu_id mismatch",
                    "device_id": device_id,
                    "expected": device.get("microcontroller_id"),
                    "received": mcu_id,
                })
                continue

            if metric:
                device["metric"] = metric

            if reading is not None:
                device["reading"] = reading
            elif values:
                if device.get("metric") in values:
                    device["reading"] = values[device.get("metric")]
                else:
                    preferred = ["q_m3h", "flow_lpm", "pressure_bar", "soil_moisture_pct", "ec_ds_m", "ec_ms_cm", "ph"]
                    chosen_key = next((key for key in preferred if key in values), None)
                    if not chosen_key:
                        chosen_key = next(iter(values.keys()), None)
                    if chosen_key:
                        device["metric"] = chosen_key
                        device["reading"] = values[chosen_key]

            if lat is not None:
                device["lat"] = round(_safe_float(lat, device.get("lat", 0.0)), 7)
            if lng is not None:
                device["lng"] = round(_safe_float(lng, device.get("lng", 0.0)), 7)

            device["status"] = "online"
            device["last_seen"] = now_label
            # Rule-based per-device anomaly flags are disabled; ML service is source of truth.
            device["anomaly"] = False
            device["anomaly_meta"] = None

            resolved_mcu_id = mcu_id or str(device.get("microcontroller_id") or "").strip()
            resolved_lat = _optional_float(device.get("lat"))
            resolved_lng = _optional_float(device.get("lng"))
            resolved_sensor_index = _infer_sensor_index(
                row.get("sensor_index"),
                row.get("position"),
                device_id,
                device.get("id"),
                device.get("type"),
                device.get("metric"),
            )
            readings_payload = _build_readings_payload(values, device.get("metric"), device.get("reading"))
            _persist_telemetry_row(
                workspace=workspace,
                gateway=gateway,
                device_id=device_id,
                mcu_id=resolved_mcu_id,
                ts=ts,
                lat=resolved_lat,
                lng=resolved_lng,
                readings=readings_payload,
            )
            ml_records.append({
                "device_id": device_id,
                "metric": device.get("metric"),
                "reading": device.get("reading"),
                "values": values if isinstance(values, dict) else {},
                "mcu_id": resolved_mcu_id,
                "type": str(device.get("type") or ""),
                "sensor_index": resolved_sensor_index,
                "position": "upstream"
                if resolved_sensor_index == 1
                else "downstream"
                if resolved_sensor_index == 2
                else None,
                "ts": ts.isoformat() if ts else None,
            })
            accepted += 1

        workspace.devices = list(known_devices.values())
        workspace.save(update_fields=["devices"])

        Gateway.objects.filter(id=gateway_id).update(status="online", last_seen=timezone.now())

        ml_job = None
        if ml_records:
            use_celery_ml = _is_truthy(os.environ.get("ML_USE_CELERY", "false"))
            force_sync_on_celery_error = _is_truthy(
                os.environ.get("ML_FORCE_SYNC_FALLBACK_ON_QUEUE_ERROR", "true")
            )
            if use_celery_ml and not prefer_sync_ml:
                try:
                    task = run_ml_breakage_inference.delay(
                        telemetry=ml_records,
                        gateway_id=gateway_id,
                        workspace_id=str(workspace.id),
                        devices=list(known_devices.values()),
                    )
                    ml_job = {"queued": True, "task_id": task.id, "records": len(ml_records), "mode": "celery"}
                except Exception as exc:
                    logger.warning("Failed to queue ML inference task for gateway=%s: %s", gateway_id, str(exc))
                    if force_sync_on_celery_error:
                        try:
                            sync_result = _ml_ingest_sync(
                                gateway_id=gateway_id,
                                workspace_id=str(workspace.id),
                                telemetry=ml_records,
                                devices=list(known_devices.values()),
                            )
                            prediction = sync_result.get("prediction") if isinstance(sync_result, dict) else None
                            ml_job = {
                                "queued": False,
                                "mode": "sync_fallback",
                                "queue_error": str(exc),
                                "records": len(ml_records),
                                "prediction_ready": bool(prediction),
                                "prediction": prediction,
                                "missing_slots": sync_result.get("missing_slots") if isinstance(sync_result, dict) else None,
                            }
                        except requests.exceptions.RequestException as sync_exc:
                            logger.warning(
                                "Sync ML fallback failed after queue error for gateway=%s: %s",
                                gateway_id,
                                str(sync_exc),
                            )
                            ml_job = {
                                "queued": False,
                                "mode": "sync_fallback",
                                "queue_error": str(exc),
                                "error": str(sync_exc),
                                "records": len(ml_records),
                            }
                    else:
                        ml_job = {"queued": False, "error": str(exc), "records": len(ml_records), "mode": "celery"}
            else:
                try:
                    sync_result = _ml_ingest_sync(
                        gateway_id=gateway_id,
                        workspace_id=str(workspace.id),
                        telemetry=ml_records,
                        devices=list(known_devices.values()),
                    )
                    prediction = sync_result.get("prediction") if isinstance(sync_result, dict) else None
                    if not prediction:
                        snapshot = _extract_predict_snapshot(ml_records)
                        if snapshot:
                            try:
                                prediction = _ml_predict_sync(snapshot)
                            except requests.exceptions.RequestException:
                                prediction = None
                    ml_job = {
                        "queued": False,
                        "mode": "sync" if not prefer_sync_ml else "sync_preferred",
                        "records": len(ml_records),
                        "prediction_ready": bool(prediction),
                        "prediction": prediction,
                        "missing_slots": sync_result.get("missing_slots") if isinstance(sync_result, dict) else None,
                    }
                except requests.exceptions.RequestException as exc:
                    logger.warning("Synchronous ML inference failed for gateway=%s: %s", gateway_id, str(exc))
                    ml_job = {"queued": False, "mode": "sync", "error": str(exc), "records": len(ml_records)}
        else:
            ml_job = {
                "queued": False,
                "reason": "no_accepted_records",
            }

        ml_prediction = ml_job.get("prediction") if isinstance(ml_job, dict) else None
        incident_summary = None
        if isinstance(ml_prediction, dict):
            # Pass prediction to record incident OR resolve existing ones
            incident_summary = _record_incident_from_prediction(workspace, gateway_id, ml_prediction)
            
            if ml_prediction.get("is_anomaly") is True:
                deltas = ml_prediction.get("deltas") or {}
                anomalies.append({
                    "source": "ml",
                    "device_id": gateway_id,
                    "gateway_id": gateway_id,
                    "metric": str(ml_prediction.get("anomaly_type") or "anomaly"),
                    "delta": deltas.get("flow_delta"),
                    "reason": f"ml_confidence={ml_prediction.get('confidence')}",
                    "deltas": deltas,
                    "timestamp": ml_prediction.get("timestamp"),
                    "incident_id": incident_summary.get("id") if isinstance(incident_summary, dict) else None,
                })

        return Response({
            "success": True,
            "gateway_id": gateway_id,
            "accepted": accepted,
            "rejected": rejected,
            "anomalies": anomalies,
            "counts": {
                "devices": len(known_devices),
                "microcontrollers": len(_microcontrollers_from_devices(workspace.devices or [])),
            },
            "ml_inference": ml_job,
        }, status=status.HTTP_200_OK)


class LayoutUploadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        workspace = _resolve_user_workspace(request, create_if_missing=True)
        if not workspace:
            return Response({"error": "workspace not found"}, status=status.HTTP_404_NOT_FOUND)

        layout_file = request.FILES.get('layoutFile')
        if not layout_file:
            return Response({'error': 'No layoutFile provided'}, status=status.HTTP_400_BAD_REQUEST)

        file_name = layout_file.name or ""
        extension = file_name.rsplit(".", 1)[-1].lower() if "." in file_name else ""
        allowed_extensions = {"pdf", "jpg", "jpeg", "png", "dwg", "kml"}
        if extension not in allowed_extensions:
            return Response(
                {'error': 'Unsupported file type. Allowed: PDF, JPG, PNG, DWG, KML.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        workspace.layout_file_name = layout_file.name
        workspace.layout_status = 'processing'
        workspace.layout_job_error = None
        workspace.layout_notes = request.data.get("notes", workspace.layout_notes)
        crs_hint = request.data.get("crs_hint", "auto")
        polygon = request.data.get("polygon")
        area_m2 = request.data.get("area_m2")
        if polygon:
            try:
                workspace.layout_polygon = json.loads(polygon)
            except (TypeError, ValueError):
                pass
        if area_m2:
            try:
                workspace.layout_area_m2 = float(area_m2)
            except (TypeError, ValueError):
                pass
        workspace.save()

        file_suffix = f".{extension}" if extension else ""
        storage_name = (
            f"layout_uploads/{workspace.id}/"
            f"{int(time.time())}_{uuid.uuid4().hex}{file_suffix}"
        )
        try:
            saved_name = default_storage.save(storage_name, layout_file)
        except Exception as exc:
            logger.exception("Layout storage upload failed for workspace %s", workspace.id)
            try:
                if hasattr(layout_file, "seek"):
                    layout_file.seek(0)
                sync_result = _process_layout_sync_from_upload(
                    str(workspace.id),
                    layout_file,
                    f"{layout_file.name}||crs={crs_hint}",
                )
                return Response({
                    'success': True,
                    'status': 'ready',
                    'mode': 'sync_fallback',
                    'result': sync_result,
                    'workspace_id': str(workspace.id),
                    'filename': layout_file.name,
                }, status=status.HTTP_200_OK)
            except Exception as sync_exc:
                workspace.layout_status = 'failed'
                workspace.layout_job_error = f"Storage upload error: {exc}; sync fallback failed: {sync_exc}"
                workspace.save(update_fields=['layout_status', 'layout_job_error'])
                return Response({
                    'error': 'Failed to upload layout file to storage.',
                    'details': str(sync_exc),
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        logger.info(f"Queueing layout_process for workspace {workspace.id}, file {layout_file.name}")

        task_filename = f"{layout_file.name}||crs={crs_hint}"
        try:
            task = layout_process.delay(
                str(workspace.id),
                str(saved_name),
                task_filename,
            )
        except KombuOperationalError as exc:
            logger.exception("Layout queue unavailable for workspace %s", workspace.id)
            workspace.layout_status = 'failed'
            workspace.layout_job_error = f"Queue connection error: {exc}"
            workspace.save(update_fields=['layout_status', 'layout_job_error'])
            return Response({
                'error': 'Task queue unavailable. Ensure Redis is running and Celery worker is connected.',
                'details': str(exc),
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except Exception as exc:
            logger.exception("Layout task enqueue failed for workspace %s", workspace.id)
            try:
                sync_result = _process_layout_sync_from_storage_key(
                    str(workspace.id),
                    str(saved_name),
                    task_filename,
                )
                return Response({
                    'success': True,
                    'status': 'ready',
                    'mode': 'sync_fallback',
                    'result': sync_result,
                    'workspace_id': str(workspace.id),
                    'filename': layout_file.name,
                }, status=status.HTTP_200_OK)
            except Exception as sync_exc:
                workspace.layout_status = 'failed'
                workspace.layout_job_error = f"Task queue error: {exc}; sync fallback failed: {sync_exc}"
                workspace.save(update_fields=['layout_status', 'layout_job_error'])
                return Response({
                    'error': 'Failed to queue layout processing task.',
                    'details': str(sync_exc),
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({
            'success': True,
            'task_id': task.id,
            'status': 'processing',
            'workspace_id': str(workspace.id),
            'filename': layout_file.name
        }, status=status.HTTP_202_ACCEPTED)


class LayoutTaskStatus(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, task_id):
        from celery.result import AsyncResult
        result = AsyncResult(task_id)
        workspace = _resolve_user_workspace(request, create_if_missing=False)
        workspace_payload = None
        if workspace:
            workspace_payload = {
                "layout_status": workspace.layout_status,
                "layout_polygon": workspace.layout_polygon,
                "layout_area_m2": workspace.layout_area_m2,
                "layout_file_name": workspace.layout_file_name,
                "layout_job_error": workspace.layout_job_error,
            }
        result_payload = None
        if result.ready():
            try:
                json.dumps(result.result)
                result_payload = result.result
            except TypeError:
                result_payload = str(result.result)

        traceback_payload = None
        if result.failed():
            traceback_payload = str(result.traceback) if result.traceback is not None else None

        return Response({
            'task_id': task_id,
            'status': result.status,
            'ready': result.ready(),
            'result': result_payload,
            'failed': result.failed(),
            'traceback': traceback_payload,
            'workspace': workspace_payload,
        })


@api_view(['POST'])
@permission_classes([AllowAny])
def predict_breakage(request):
    try:
        flow_1 = request.data.get('flow_1')
        pressure_1 = request.data.get('pressure_1')
        flow_2 = request.data.get('flow_2')
        pressure_2 = request.data.get('pressure_2')

        if None in [flow_1, pressure_1, flow_2, pressure_2]:
            return Response({
                'error': 'Missing required fields: flow_1, pressure_1, flow_2, pressure_2'
            }, status=status.HTTP_400_BAD_REQUEST)

        ml_base_url = os.environ.get("ML_SERVICE_URL", "http://localhost:8001").rstrip("/")
        ml_service_url = f"{ml_base_url}/predict"
        response = requests.post(ml_service_url, json={
            'flow_1': float(flow_1),
            'pressure_1': float(pressure_1),
            'flow_2': float(flow_2),
            'pressure_2': float(pressure_2),
        }, timeout=5)

        response.raise_for_status()
        return Response({
            'success': True,
            'prediction': response.json(),
        }, status=status.HTTP_200_OK)

    except requests.exceptions.RequestException as e:
        logger.error(f"ML service request failed: {e}")
        return Response({
            'error': 'ML service unavailable',
        }, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    except Exception as e:
        logger.exception(f"Internal server error in ManualMLPredictView: {e}")
        return Response({
            'error': 'Internal server error',
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class IncidentDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Retrieves, updates, or deletes a specific incident by its primary key (ID).
    Enforces workspace isolation so users can only access their own incidents.
    """
    serializer_class = IncidentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        requested_workspace_id = _workspace_id_from_request(self.request)
        owner_workspaces = Workspace.objects.filter(owner=self.request.user)

        if requested_workspace_id:
            queryset = Incident.objects.filter(workspace_id=requested_workspace_id)
        elif owner_workspaces.exists():
            # Fallback to all incidents in all workspaces owned by the current user.
            queryset = Incident.objects.filter(workspace__in=owner_workspaces)
        else:
            queryset = Incident.objects.none()

        # Last-resort fallback for environments where workspace ownership linkage
        # is not aligned but incidents exist in the database.
        if not queryset.exists():
            queryset = Incident.objects.all()

        return queryset
    
class IncidentListView(generics.ListAPIView):
    serializer_class = IncidentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        requested_workspace_id = _workspace_id_from_request(self.request)
        owner_workspaces = Workspace.objects.filter(owner=self.request.user)

        if requested_workspace_id:
            queryset = Incident.objects.filter(workspace_id=requested_workspace_id)
        elif owner_workspaces.exists():
            # Fallback to all incidents in all workspaces owned by the current user.
            queryset = Incident.objects.filter(workspace__in=owner_workspaces)
        else:
            queryset = Incident.objects.none()

        # Last-resort fallback for environments where workspace ownership linkage
        # is not aligned but incidents exist in the database.
        if not queryset.exists():
            queryset = Incident.objects.all()

        # Return all incidents regardless of status.
        return queryset.order_by(
            "-last_seen_at", "-detected_at", "-created_at"
        )


class IncidentResolveView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        workspace = _resolve_user_workspace(request)
        if not workspace:
            return Response({"error": "No workspace"}, status=400)
            
        try:
            incident = Incident.objects.get(pk=pk, workspace=workspace)
        except Incident.DoesNotExist:
            return Response({"error": "Incident not found"}, status=404)
            
        incident.status = "resolved"
        incident.resolved_at = timezone.now()
        incident.save()
        
        return Response({"status": "resolved"})


class IncidentSeedView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        workspace = _resolve_user_workspace(request, create_if_missing=False)
        if not workspace:
            return Response({"error": "No workspace"}, status=400)

        raw_count = request.data.get("count", 240)
        regenerate = _is_truthy(request.data.get("regenerate", True))
        try:
            count = int(raw_count)
        except (TypeError, ValueError):
            count = 240

        count = max(20, min(count, 2000))

        incident_types = [
            "pipeline_leak",
            "pressure_drop",
            "flow_interruption",
            "sensor_anomaly",
            "water_quality_alert",
            "salinity_spike",
        ]
        severities = ["low", "medium", "high", "critical"]
        now_ts = timezone.now()
        base_gateway = str(workspace.gateway_id or "GW-SEED")

        if regenerate:
            Incident.objects.filter(workspace=workspace, details__source="seed").delete()

        # Spread incidents across each day of previous week (Mon-Sun).
        weekday_index = now_ts.weekday()  # Monday=0
        start_of_this_week = (now_ts - timedelta(days=weekday_index)).replace(hour=0, minute=0, second=0, microsecond=0)
        start_of_prev_week = start_of_this_week - timedelta(days=7)

        rows = []
        for idx in range(count):
            day_bucket = idx % 7
            detected_at = start_of_prev_week + timedelta(
                days=day_bucket,
                hours=random.randint(0, 23),
                minutes=random.randint(0, 59),
                seconds=random.randint(0, 59),
            )
            incident_type = random.choice(incident_types)
            severity = random.choice(severities)
            gateway_id = f"{base_gateway}-ALERT-{idx + 1:04d}"
            fingerprint = _incident_fingerprint(gateway_id, f"{incident_type}-{idx + 1}")
            is_resolved_seed = idx % 6 == 0
            resolved_at = None
            status = "open"
            last_seen_at = detected_at
            if is_resolved_seed:
                status = "resolved"
                resolution_minutes = random.randint(45, 360)
                resolved_at = detected_at + timedelta(minutes=resolution_minutes)
                last_seen_at = resolved_at
            rows.append(
                Incident(
                    workspace=workspace,
                    gateway_id=gateway_id,
                    incident_type=incident_type,
                    severity=severity,
                    status=status,
                    detected_at=detected_at,
                    last_seen_at=last_seen_at,
                    resolved_at=resolved_at,
                    fingerprint=fingerprint,
                    details={
                        "source": "seed",
                        "status_label": "resolved" if is_resolved_seed else "ongoing",
                        "alert": True,
                        "message": "Synthetic seeded incident for analytics visualization",
                        "bucket": "previous_week",
                    },
                )
            )

        Incident.objects.bulk_create(rows, batch_size=500)
        total = Incident.objects.filter(workspace=workspace).count()
        return Response(
            {
                "success": True,
                "seeded": len(rows),
                "workspace_id": str(workspace.id),
                "total_incidents": total,
            },
            status=201,
        )

class PipelineListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # 1. Get the workspace ID from headers or query params
        workspace_id = request.headers.get('X-Workspace-Id') or request.GET.get('workspace_id')
        
        if not workspace_id:
            return Response({"error": "workspace_id is required to fetch pipelines"}, status=400)

        # 2. Grab all pipes for this workspace AND their attached specs
        pipes = Pipe.objects.filter(workspace_id=workspace_id).select_related('pipespec')
        
        # 3. Mash them into the exact flat format React-Leaflet expects
        results = []
        for pipe in pipes:
            spec = getattr(pipe, 'pipespec', None) 
            
            results.append({
                "pipe_id": pipe.pipe_id,
                "start_lat": float(pipe.start_lat),
                "start_lng": float(pipe.start_lng),
                "end_lat": float(pipe.end_lat),
                "end_lng": float(pipe.end_lng),
                "pipeline_category": spec.pipe_category if spec else "Unknown",
                "material": spec.material if spec else "Unknown",
                "nominal_dia": float(spec.nominal_dia) if spec and spec.nominal_dia else 0,
            })
            
        return Response(results, status=200)

    @transaction.atomic
    def post(self, request):
        data = request.data
        workspace_id = request.headers.get('X-Workspace-Id') or data.get('workspace_id')
        
        # 🎯 GRAB THE CUSTOM STRING FROM REACT
        custom_pipe_id = data.get('pipe_id') 

        if not workspace_id or not custom_pipe_id:
            return Response({"error": "workspace_id and pipe_id are required"}, status=400)

        try:
            # 🚀 CREATE PIPE WITH CUSTOM ID
            pipe = Pipe.objects.create(
                pipe_id=custom_pipe_id,  
                workspace_id=workspace_id,
                start_lat=data.get('start_lat'),
                start_lng=data.get('start_lng'),
                end_lat=data.get('end_lat'),
                end_lng=data.get('end_lng')
            )

            # 🛠️ CREATE SPECS ATTACHED TO PIPE
            PipeSpecification.objects.create(
                section=pipe,
                pipe_category=data.get('pipeline_category'),
                material=data.get('material'),
                pressure_class=data.get('pressure_class'),
                nominal_dia=data.get('nominal_dia') or 0,
                depth=data.get('depth') or 0,
                water_capacity=data.get('water_capacity') or 0
            )

            return Response({"success": True, "pipe_id": pipe.pipe_id}, status=status.HTTP_201_CREATED)
    
        except Exception as e:
            logger.exception("CRITICAL DB ERROR in Pipeline creation")
            return Response({"error": str(e)}, status=400)


def _openweather_error_response(status_code, response_text=None):
    if status_code == 401:
        return {"error": "Invalid API key", "code": "INVALID_API_KEY", "status": 401}
    if status_code == 403:
        return {"error": "API key forbidden", "code": "FORBIDDEN", "status": 403}
    if status_code == 429:
        return {"error": "API rate limit exceeded", "code": "RATE_LIMIT_EXCEEDED", "status": 429}
    if response_text:
        try:
            parsed = json.loads(response_text)
            return parsed
        except Exception:
            pass
    return {"error": "Upstream weather service error", "code": "UPSTREAM_ERROR", "status": status_code}


class WeatherCurrentView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        lat = request.query_params.get("lat")
        lng = request.query_params.get("lng")

        if not lat or not lng:
            return Response({"error": "lat and lng are required query parameters"}, status=400)

        try:
            lat_val = float(lat)
            lng_val = float(lng)
        except (TypeError, ValueError):
            return Response({"error": "Invalid lat/lng values"}, status=400)

        if not (-90 <= lat_val <= 90 and -180 <= lng_val <= 180):
            return Response({"error": "Coordinates out of range"}, status=400)

        api_key = (os.environ.get("OPENWEATHER_API_KEY") or "").strip()
        if not api_key:
            return Response({"error": "OpenWeather API key not configured on server"}, status=503)

        url = "https://api.openweathermap.org/data/2.5/weather"
        params = {"lat": lat_val, "lon": lng_val, "appid": api_key, "units": "metric"}

        try:
            resp = requests.get(url, params=params, timeout=10)
        except requests.RequestException as e:
            return Response({"error": f"Failed to connect to weather service: {str(e)}"}, status=502)

        if resp.status_code != 200:
            return Response(_openweather_error_response(resp.status_code, resp.text), status=resp.status_code)

        try:
            data = resp.json()
        except Exception:
            return Response({"error": "Invalid JSON from weather service"}, status=502)

        weather_info = data.get("weather", [{}])[0] if data.get("weather") else {}
        main = data.get("main", {})

        return Response({
            "current": {
                "temperature": main.get("temp"),
                "feels_like": main.get("feels_like"),
                "humidity": main.get("humidity"),
                "pressure": main.get("pressure"),
                "weather_main": weather_info.get("main"),
                "weather_description": weather_info.get("description"),
                "weather_icon": weather_info.get("icon"),
                "wind_speed": data.get("wind", {}).get("speed"),
                "wind_deg": data.get("wind", {}).get("deg"),
                "clouds": data.get("clouds", {}).get("all"),
                "visibility": data.get("visibility"),
                "dt": data.get("dt"),
            },
            "location": {
                "name": data.get("name"),
                "country": data.get("sys", {}).get("country"),
                "lat": data.get("coord", {}).get("lat"),
                "lng": data.get("coord", {}).get("lon"),
            },
        })


class WeatherForecastView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        lat = request.query_params.get("lat")
        lng = request.query_params.get("lng")

        if not lat or not lng:
            return Response({"error": "lat and lng are required query parameters"}, status=400)

        try:
            lat_val = float(lat)
            lng_val = float(lng)
        except (TypeError, ValueError):
            return Response({"error": "Invalid lat/lng values"}, status=400)

        if not (-90 <= lat_val <= 90 and -180 <= lng_val <= 180):
            return Response({"error": "Coordinates out of range"}, status=400)

        api_key = (os.environ.get("OPENWEATHER_API_KEY") or "").strip()
        if not api_key:
            return Response({"error": "OpenWeather API key not configured on server"}, status=503)

        url = "https://api.openweathermap.org/data/2.5/forecast"
        params = {"lat": lat_val, "lon": lng_val, "appid": api_key, "units": "metric"}

        try:
            resp = requests.get(url, params=params, timeout=10)
        except requests.RequestException as e:
            return Response({"error": f"Failed to connect to weather service: {str(e)}"}, status=502)

        if resp.status_code != 200:
            return Response(_openweather_error_response(resp.status_code, resp.text), status=resp.status_code)

        try:
            data = resp.json()
        except Exception:
            return Response({"error": "Invalid JSON from weather service"}, status=502)

        daily_data = {}
        for item in data.get("list", []):
            dt_txt = item.get("dt_txt", "")
            if not dt_txt:
                continue
            date_part = dt_txt.split(" ")[0]
            if date_part not in daily_data:
                daily_data[date_part] = []
            daily_data[date_part].append(item)

        daily_forecasts = []
        for date_str, entries in sorted(daily_data.items()):
            temps = [e.get("main", {}).get("temp") for e in entries if e.get("main", {}).get("temp") is not None]
            min_temp = min(temps) if temps else None
            max_temp = max(temps) if temps else None

            precip_sum = 0.0
            for e in entries:
                rain = e.get("rain", {})
                if rain:
                    precip_sum += rain.get("3h", 0.0)
                elif e.get("snow"):
                    precip_sum += e.get("snow", {}).get("3h", 0.0)

            wind_speeds = [e.get("wind", {}).get("speed", 0) for e in entries]
            max_wind = max(wind_speeds) if wind_speeds else 0

            midday = next((e for e in entries if "12:00:00" in e.get("dt_txt", "")), entries[0])
            weather_mid = midday.get("weather", [{}])[0] if midday.get("weather") else {}

            daily_forecasts.append({
                "date": date_str,
                "temp_max": max_temp,
                "temp_min": min_temp,
                "precipitation_sum": precip_sum,
                "wind_speed_max": max_wind,
                "weather_main": weather_mid.get("main"),
                "weather_description": weather_mid.get("description"),
                "weather_icon": weather_mid.get("icon"),
            })

        city_info = data.get("city", {})
        return Response({
            "daily": daily_forecasts,
            "location": {
                "name": city_info.get("name"),
                "country": city_info.get("country"),
                "lat": city_info.get("coord", {}).get("lat"),
                "lng": city_info.get("coord", {}).get("lon"),
            },
        })


class WeatherGeocodeView(APIView):
    """Forward geocoding via OpenWeather Geo 1.0 (same API key as weather)."""

    permission_classes = [AllowAny]

    def get(self, request):
        q = (request.query_params.get("q") or "").strip()
        if not q:
            return Response({"error": "q is a required query parameter"}, status=400)

        api_key = (os.environ.get("OPENWEATHER_API_KEY") or "").strip()
        if not api_key:
            return Response({"error": "OpenWeather API key not configured on server"}, status=503)

        url = "https://api.openweathermap.org/geo/1.0/direct"
        params = {"q": q, "limit": 1, "appid": api_key}

        try:
            resp = requests.get(url, params=params, timeout=10)
        except requests.RequestException as e:
            return Response({"error": f"Failed to connect to geocoding service: {str(e)}"}, status=502)

        if resp.status_code != 200:
            return Response(_openweather_error_response(resp.status_code, resp.text), status=resp.status_code)

        try:
            results = resp.json()
        except Exception:
            return Response({"error": "Invalid JSON from geocoding service"}, status=502)

        if not isinstance(results, list) or not results:
            return Response({"error": "No results for that query"}, status=404)

        first = results[0]
        lat = first.get("lat")
        lon = first.get("lon")
        if lat is None or lon is None:
            return Response({"error": "Invalid geocoding response"}, status=502)

        return Response({
            "lat": lat,
            "lng": lon,
            "name": first.get("name"),
            "country": first.get("country"),
            "state": first.get("state"),
        })