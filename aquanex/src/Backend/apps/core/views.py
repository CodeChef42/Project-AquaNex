from rest_framework import status, generics
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.decorators import api_view, permission_classes
from .tasks import layout_process, run_ml_breakage_inference
import requests
import logging
import json
import time
import uuid
import random
import hashlib
import os
import re
from pathlib import Path
from datetime import datetime, timezone as dt_timezone
from kombu.exceptions import OperationalError as KombuOperationalError
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.db import DatabaseError, IntegrityError, transaction
from django.core.files.storage import default_storage
from .serializers import RegisterSerializer, LoginSerializer, UserSerializer, WorkspaceSerializer, ChangePasswordSerializer, IncidentSerializer


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
        # If normal data comes in, transition 'open' incidents to 'recovering'
        # This signals the frontend to ask for confirmation.
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

    # Check for recovering incidents first - if we get a new anomaly for a recovering incident, reopen it
    recovering = Incident.objects.filter(
        workspace=workspace,
        gateway_id=gateway_id,
        incident_type=incident_type,
        status="recovering"
    ).first()

    if recovering:
        recovering.status = "open"
        recovering.last_seen_at = detected_at
        recovering.severity = severity
        recovering.details = details
        recovering.save()
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


def _workspace_id_from_request(request):
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
        workspace_name="Workspace 1",
        company_name="",
        company_type="",
        status="active",
        layout_status="idle",
    )


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
    }
    return aliases.get(key)


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
    suffix = Path(layout_file.name).suffix or ".bin"
    tmp_path = Path("/tmp") / f"layout_sync_{uuid.uuid4().hex}{suffix}"
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
        refresh = RefreshToken.for_user(user)
        return Response({
            'user': UserSerializer(user).data,
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        }, status=status.HTTP_201_CREATED)


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
        workspace = _resolve_user_workspace(request, create_if_missing=False)
        create_new_workspace = _is_truthy(data.get("createNewWorkspace"))
        fallback_workspace = Workspace.objects.filter(owner=user).order_by("created_at").first()

        if workspace and create_new_workspace:
            workspace = None

        if workspace is None:
            workspace = Workspace.objects.create(
                owner=user,
                workspace_name=data.get('workspaceName', '') or "New Workspace",
                company_name=data.get('companyName', '') or '',
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
            workspace.workspace_name = data.get('workspaceName', workspace.workspace_name or workspace.company_name)
            workspace.company_name = data.get('companyName', workspace.company_name)
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


class WorkspaceListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        workspaces = Workspace.objects.filter(owner=request.user).order_by("created_at")
        active = _resolve_user_workspace(request, create_if_missing=False)
        return Response({
            "workspaces": WorkspaceSerializer(workspaces, many=True).data,
            "active_workspace_id": str(active.id) if active else None,
        })


class GatewayDiscoverView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        gateway_id = (request.data.get("gateway_id") or "").strip()
        protocol = str(request.data.get("protocol") or "").strip().lower()
        force_refresh = bool(request.data.get("force_refresh", False))
        preview_only = bool(request.data.get("preview_only", False))
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
            return Response({
                "success": True,
                "gateway_id": gateway_id,
                "source": "gateway_memory",
                "devices": workspace.devices,
                "microcontrollers": _microcontrollers_from_devices(workspace.devices),
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
        return Response({
            'error': 'ML service unavailable',
            'details': str(e),
        }, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    except Exception as e:
        return Response({
            'error': 'Internal server error',
            'details': str(e),
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class IncidentListView(generics.ListAPIView):
    serializer_class = IncidentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        workspace = _resolve_user_workspace(self.request)
        if not workspace:
            return Incident.objects.none()
        
        # Return open or recovering incidents
        return Incident.objects.filter(
            workspace=workspace, 
            status__in=["open", "recovering"]
        ).order_by('-last_seen_at')


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
