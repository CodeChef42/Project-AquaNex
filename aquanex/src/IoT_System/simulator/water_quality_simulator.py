#!/usr/bin/env python3
"""
AquaNex Water Quality Simulator
================================
Simulates 2 pH sensors and 2 turbidity sensors sending realistic readings
to the AquaNex backend, including periodic anomalies for demonstration.

Scenario cycle (70 seconds):
  0–30s   Normal      — all parameters within optimal range
  30–45s  pH Spike    — sensor 1 alkaline, sensor 2 acidic
  45–55s  Turbidity   — both turbidity sensors spike (rain/runoff event)
  55–65s  Combined    — mild pH drift + elevated turbidity
  65–70s  Recovery    — values returning toward normal

Usage:
    python water_quality_simulator.py

Environment variables:
    BACKEND_URL       Backend base URL  (default: http://127.0.0.1:8000)
    GATEWAY_ID        Gateway identifier (default: WQ-GATEWAY-01)
    AQUANEX_USERNAME  Login username (required for device registration)
    AQUANEX_PASSWORD  Login password (required for device registration)
    SEND_INTERVAL     Seconds between telemetry batches (default: 5)
"""

import math
import os
import random
import sys
import time
from datetime import datetime, timezone

import requests

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
BACKEND_URL = os.environ.get("BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")
GATEWAY_ID = os.environ.get("GATEWAY_ID", "WQ-GATEWAY-01")
USERNAME = os.environ.get("AQUANEX_USERNAME", "")
PASSWORD = os.environ.get("AQUANEX_PASSWORD", "")
SEND_INTERVAL = float(os.environ.get("SEND_INTERVAL", "5"))

# ---------------------------------------------------------------------------
# Device definitions
# ---------------------------------------------------------------------------
DEVICES = [
    {
        "id": "WQ-PH-01",
        "microcontroller_id": "WQ-MCU-01",
        "type": "ph_sensor",
        "metric": "ph",
        "lat": 25.2060,
        "lng": 55.2720,
        "label": "pH Sensor A (North)",
    },
    {
        "id": "WQ-PH-02",
        "microcontroller_id": "WQ-MCU-01",
        "type": "ph_sensor",
        "metric": "ph",
        "lat": 25.2035,
        "lng": 55.2695,
        "label": "pH Sensor B (South)",
    },
    {
        "id": "WQ-TURB-01",
        "microcontroller_id": "WQ-MCU-02",
        "type": "turbidity_sensor",
        "metric": "turbidity_ntu",
        "lat": 25.2070,
        "lng": 55.2730,
        "label": "Turbidity Sensor A (East)",
    },
    {
        "id": "WQ-TURB-02",
        "microcontroller_id": "WQ-MCU-02",
        "type": "turbidity_sensor",
        "metric": "turbidity_ntu",
        "lat": 25.2025,
        "lng": 55.2685,
        "label": "Turbidity Sensor B (West)",
    },
]

# ---------------------------------------------------------------------------
# Scenario phases
# ---------------------------------------------------------------------------
SCENARIO_DURATION = 70.0  # seconds per full cycle

PHASES = [
    (0,  30, "normal"),
    (30, 45, "ph_spike"),
    (45, 55, "turbidity_spike"),
    (55, 65, "combined"),
    (65, 70, "recovery"),
]


def get_phase(elapsed: float) -> str:
    e = elapsed % SCENARIO_DURATION
    for start, end, name in PHASES:
        if start <= e < end:
            return name
    return "normal"


# ---------------------------------------------------------------------------
# Value generators
# ---------------------------------------------------------------------------
def _noise(sigma: float) -> float:
    return random.gauss(0.0, sigma)


def _diurnal(amplitude: float = 0.05) -> float:
    """Slow sinusoidal drift representing daily temperature/light cycles."""
    return math.sin(time.time() / 3600.0 * math.pi) * amplitude


def _generate_ph(sensor_index: int, phase: str) -> float:
    """Return a simulated pH reading for the given sensor and phase."""
    base = 7.05 + _diurnal(0.08) + _noise(0.04)

    if phase == "normal":
        ph = base

    elif phase == "ph_spike":
        if sensor_index == 1:
            # Alkaline spike — e.g. fertiliser overdose, lime leaching
            ph = 9.1 + _noise(0.25) + abs(_diurnal(0.3))
        else:
            # Acidic spike — e.g. acid rain, CO₂ dissolution
            ph = 5.0 + _noise(0.18)

    elif phase == "combined":
        if sensor_index == 1:
            ph = 8.1 + _noise(0.12)
        else:
            ph = 6.1 + _noise(0.10)

    elif phase == "recovery":
        # Trending back to normal; use a weighted average
        if sensor_index == 1:
            ph = 7.5 + _noise(0.08)
        else:
            ph = 6.7 + _noise(0.08)

    else:
        ph = base

    return round(max(2.0, min(14.0, ph)), 2)


def _generate_turbidity(sensor_index: int, phase: str) -> float:
    """Return a simulated turbidity reading (NTU)."""
    base = 1.0 + abs(_diurnal(0.3)) + abs(_noise(0.12))

    if phase == "normal":
        turb = base

    elif phase == "turbidity_spike":
        if sensor_index == 1:
            # Heavy runoff event
            turb = 12.5 + _noise(1.2) + abs(_diurnal(2.0))
        else:
            turb = 7.8 + _noise(0.9)

    elif phase == "combined":
        if sensor_index == 1:
            turb = 5.8 + _noise(0.5)
        else:
            turb = 4.2 + _noise(0.4)

    elif phase == "recovery":
        if sensor_index == 1:
            turb = 3.5 + _noise(0.3)
        else:
            turb = 2.8 + _noise(0.3)

    else:
        turb = base

    return round(max(0.0, turb), 2)


def generate_reading(device: dict, phase: str) -> dict:
    """Return the simulated `values` dict for one device."""
    dev_type = device["type"]
    idx = int(device["id"][-2:]) if device["id"][-2:].isdigit() else 1

    if dev_type == "ph_sensor":
        return {"ph": _generate_ph(idx, phase)}
    elif dev_type == "turbidity_sensor":
        return {"turbidity_ntu": _generate_turbidity(idx, phase)}
    return {}


# ---------------------------------------------------------------------------
# Backend communication
# ---------------------------------------------------------------------------
_session = requests.Session()
_access_token: str = ""


def login() -> bool:
    """Authenticate and store the JWT access token."""
    global _access_token
    if not USERNAME or not PASSWORD:
        print("[WARN] No AQUANEX_USERNAME / AQUANEX_PASSWORD set — device registration will be skipped.")
        return False
    try:
        resp = _session.post(
            f"{BACKEND_URL}/api/auth/login/",
            json={"username": USERNAME, "password": PASSWORD},
            timeout=10,
        )
        resp.raise_for_status()
        _access_token = resp.json().get("access", "")
        print(f"[AUTH] Logged in as {USERNAME}")
        return bool(_access_token)
    except Exception as exc:
        print(f"[AUTH] Login failed: {exc}")
        return False


def _auth_headers() -> dict:
    return {"Authorization": f"Bearer {_access_token}"} if _access_token else {}


def register_devices(workspace_id: str = "") -> bool:
    """Register the gateway and its water quality devices."""
    payload: dict = {
        "gateway_id": GATEWAY_ID,
        "protocol": "http",
        "devices": [
            {
                "id": d["id"],
                "microcontroller_id": d["microcontroller_id"],
                "type": d["type"],
                "metric": d["metric"],
                "lat": d["lat"],
                "lng": d["lng"],
                "status": "online",
            }
            for d in DEVICES
        ],
    }
    headers = _auth_headers()
    if workspace_id:
        headers["X-Workspace-Id"] = workspace_id
    try:
        resp = _session.post(
            f"{BACKEND_URL}/api/gateway-register/",
            json=payload,
            headers=headers,
            timeout=15,
        )
        if resp.status_code == 200:
            print(f"[REGISTER] Gateway {GATEWAY_ID} registered with {len(DEVICES)} devices")
            return True
        else:
            print(f"[REGISTER] Failed ({resp.status_code}): {resp.text[:200]}")
            return False
    except Exception as exc:
        print(f"[REGISTER] Error: {exc}")
        return False


def get_workspace_id() -> str:
    """Fetch the user's active workspace ID."""
    try:
        resp = _session.get(
            f"{BACKEND_URL}/api/workspaces/",
            headers=_auth_headers(),
            timeout=10,
        )
        resp.raise_for_status()
        workspaces = resp.json()
        if isinstance(workspaces, list) and workspaces:
            return str(workspaces[0].get("id", ""))
        if isinstance(workspaces, dict):
            results = workspaces.get("results") or []
            if results:
                return str(results[0].get("id", ""))
    except Exception as exc:
        print(f"[WORKSPACE] Could not fetch workspace: {exc}")
    return ""


def send_telemetry(phase: str) -> None:
    """Build and POST a telemetry batch for all four devices."""
    now_iso = datetime.now(timezone.utc).isoformat()
    telemetry = []
    for device in DEVICES:
        values = generate_reading(device, phase)
        telemetry.append({
            "device_id": device["id"],
            "mcu_id": device["microcontroller_id"],
            "values": values,
            "lat": device["lat"],
            "lng": device["lng"],
            "ts": now_iso,
        })

    payload = {
        "gateway_id": GATEWAY_ID,
        "telemetry": telemetry,
        "prefer_sync_ml": False,
    }

    try:
        resp = _session.post(
            f"{BACKEND_URL}/api/gateway-telemetry/",
            json=payload,
            timeout=10,
        )
        data = resp.json()
        accepted = data.get("accepted", "?")
        anomalies = data.get("anomalies", [])
        anomaly_str = (
            f"  ⚠  {len(anomalies)} alert(s): " +
            ", ".join(a.get("device_type", "?") for a in anomalies)
            if anomalies else ""
        )
        print(f"  → accepted={accepted}{anomaly_str}")
    except Exception as exc:
        print(f"  → ERROR sending telemetry: {exc}")


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------
def print_readings(phase: str, elapsed: float) -> None:
    e = elapsed % SCENARIO_DURATION
    bar_width = 30
    bar = int(bar_width * e / SCENARIO_DURATION)
    progress = "[" + "=" * bar + ">" + " " * (bar_width - bar) + "]"

    print(f"\n{'='*60}")
    print(f"  Phase: {phase.upper():20s}  {progress}  t={e:.1f}s/{SCENARIO_DURATION:.0f}s")
    print(f"{'='*60}")
    for device in DEVICES:
        values = generate_reading(device, phase)
        label = device["label"]
        metric, val = next(iter(values.items()))
        status = _value_status(device["type"], val)
        print(f"  {label:<30s}  {metric}={val:>6.2f}  [{status}]")


def _value_status(device_type: str, value: float) -> str:
    if device_type == "ph_sensor":
        if 6.5 <= value <= 7.5:
            return "OPTIMAL"
        elif 6.0 <= value <= 8.0:
            return "WARNING"
        else:
            return "CRITICAL"
    elif device_type == "turbidity_sensor":
        if value <= 3.0:
            return " CLEAR "
        elif value <= 5.0:
            return "WARNING"
        else:
            return "CRITICAL"
    return "UNKNOWN"


def main() -> None:
    print("=" * 60)
    print("  AquaNex Water Quality Simulator")
    print(f"  Backend : {BACKEND_URL}")
    print(f"  Gateway : {GATEWAY_ID}")
    print(f"  Devices : {len(DEVICES)}  (2×pH + 2×turbidity)")
    print(f"  Interval: {SEND_INTERVAL}s")
    print("=" * 60)

    # Authenticate and register devices
    workspace_id = ""
    if login():
        workspace_id = get_workspace_id()
        register_devices(workspace_id)
    else:
        print("[INFO] Running without auth — telemetry will still be sent if gateway is already registered.")

    scenario_start = time.time()
    print("\n[SIM] Starting simulation loop. Press Ctrl+C to stop.\n")

    try:
        while True:
            elapsed = time.time() - scenario_start
            phase = get_phase(elapsed)
            print_readings(phase, elapsed)
            send_telemetry(phase)
            time.sleep(SEND_INTERVAL)

    except KeyboardInterrupt:
        print("\n\n[SIM] Simulator stopped.")
        sys.exit(0)


if __name__ == "__main__":
    main()
