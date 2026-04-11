#!/usr/bin/env python3
"""
AquaNex Water Quality Simulator
================================
Simulates 2 pH sensors and 2 turbidity sensors with realistic long-duration
anomalies. Each full cycle takes ~14 minutes, with anomalies persisting for
2–3 minutes at a time (as they would in real irrigation systems).

Scenario cycle (~840 seconds / 14 minutes):
  0–120s    Normal          — optimal readings across all sensors
  120–270s  Alkaline Drift  — slow pH rise (algae bloom / lime leaching)
  270–315s  pH Recovery     — gradual return toward normal
  315–405s  Normal          — stable window
  405–585s  Turbidity Event — sustained sediment / rain runoff
  585–645s  Turb Recovery   — clearing
  645–765s  Combined Stress — multiple parameters elevated simultaneously
  765–840s  Full Recovery   — all sensors normalising

Send interval: 15 seconds (configurable via SEND_INTERVAL env var)

Usage:
    python water_quality_simulator.py

Environment variables:
    BACKEND_URL    Backend base URL  (default: http://127.0.0.1:8000)
    GATEWAY_ID     Gateway identifier (default: WQ-GATEWAY-01)
    SEND_INTERVAL  Seconds between sends (default: 15)

Note: configure devices in the Water Quality page before running.
"""

import math
import os
import random
import sys
import time
from datetime import datetime, timezone

import requests

# ── Config ────────────────────────────────────────────────────────────────────
BACKEND_URL   = os.environ.get("BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")
GATEWAY_ID    = os.environ.get("GATEWAY_ID", "WQ-GATEWAY-01")
SEND_INTERVAL = float(os.environ.get("SEND_INTERVAL", "15"))

# ── Device definitions ────────────────────────────────────────────────────────
DEVICES = [
    {"id": "WQ-PH-01",   "mcu_id": "WQ-MCU-01", "type": "ph_sensor",        "metric": "ph",            "lat": 25.2060, "lng": 55.2720, "label": "pH Sensor A (North)"},
    {"id": "WQ-PH-02",   "mcu_id": "WQ-MCU-01", "type": "ph_sensor",        "metric": "ph",            "lat": 25.2035, "lng": 55.2695, "label": "pH Sensor B (South)"},
    {"id": "WQ-TURB-01", "mcu_id": "WQ-MCU-02", "type": "turbidity_sensor", "metric": "turbidity_ntu", "lat": 25.2070, "lng": 55.2730, "label": "Turbidity Sensor A (East)"},
    {"id": "WQ-TURB-02", "mcu_id": "WQ-MCU-02", "type": "turbidity_sensor", "metric": "turbidity_ntu", "lat": 25.2025, "lng": 55.2685, "label": "Turbidity Sensor B (West)"},
]

# ── Scenario phases ───────────────────────────────────────────────────────────
# (start_sec, end_sec, phase_name)
SCENARIO_DURATION = 840.0   # 14 minutes per full cycle

PHASES = [
    (0,   120,  "normal"),
    (120, 270,  "alkaline_drift"),   # sustained pH rise — 2.5 min
    (270, 315,  "ph_recovery"),
    (315, 405,  "normal"),
    (405, 585,  "turbidity_event"),  # sustained runoff — 3 min
    (585, 645,  "turb_recovery"),
    (645, 765,  "combined_stress"),  # multiple params — 2 min
    (765, 840,  "full_recovery"),
]


def get_phase(elapsed: float) -> str:
    e = elapsed % SCENARIO_DURATION
    for start, end, name in PHASES:
        if start <= e < end:
            return name
    return "normal"


def phase_progress(elapsed: float) -> float:
    """0.0 → 1.0 progress within the current phase (for smooth transitions)."""
    e = elapsed % SCENARIO_DURATION
    for start, end, name in PHASES:
        if start <= e < end:
            return (e - start) / (end - start)
    return 0.0


# ── Value generators ──────────────────────────────────────────────────────────
def _noise(sigma: float) -> float:
    return random.gauss(0.0, sigma)

def _diurnal() -> float:
    """Slow daily sinusoidal baseline drift."""
    return math.sin(time.time() / 7200.0 * math.pi) * 0.06


def _generate_ph(sensor_index: int, phase: str, progress: float) -> float:
    base = 7.1 + _diurnal() + _noise(0.04)

    if phase == "normal":
        ph = base

    elif phase == "alkaline_drift":
        # Gradual rise — mimics algae bloom consuming CO₂
        # Sensor A rises higher; sensor B follows with lag
        if sensor_index == 1:
            peak = 8.9 + _noise(0.12)
            ph = base + (peak - base) * min(progress * 1.3, 1.0)
        else:
            peak = 8.3 + _noise(0.10)
            ph = base + (peak - base) * min(progress * 1.0, 1.0)

    elif phase == "ph_recovery":
        # Gradual return; sensor B recovers faster
        if sensor_index == 1:
            ph = 8.9 - (8.9 - base) * min(progress * 1.1, 1.0) + _noise(0.08)
        else:
            ph = 8.3 - (8.3 - base) * min(progress * 1.3, 1.0) + _noise(0.07)

    elif phase == "combined_stress":
        # Moderate alkaline drift + noise (compound event)
        if sensor_index == 1:
            ph = 8.2 + _noise(0.15) + progress * 0.3
        else:
            ph = 6.1 + _noise(0.12) - progress * 0.2  # mild acidic
        ph = max(5.0, min(10.0, ph))

    elif phase == "full_recovery":
        # Both sensors normalise
        ph = base + _noise(0.06) * (1.0 - progress)

    else:
        ph = base

    return round(max(2.0, min(14.0, ph)), 2)


def _generate_turbidity(sensor_index: int, phase: str, progress: float) -> float:
    base = 0.9 + abs(_diurnal() * 0.4) + abs(_noise(0.08))

    if phase == "normal":
        turb = base

    elif phase == "turbidity_event":
        # Sustained runoff — ramps up then plateaus
        ramp = min(progress * 2.0, 1.0)
        if sensor_index == 1:
            # Upstream sensor hit harder
            peak = 14.5 + _noise(1.0)
            turb = base + (peak - base) * ramp + _noise(0.5)
        else:
            peak = 9.2 + _noise(0.8)
            turb = base + (peak - base) * ramp + _noise(0.4)

    elif phase == "turb_recovery":
        # Exponential-style clearing
        if sensor_index == 1:
            turb = 14.5 * (1.0 - progress) ** 1.5 + base + _noise(0.4)
        else:
            turb = 9.2 * (1.0 - progress) ** 1.5 + base + _noise(0.3)

    elif phase == "combined_stress":
        # Moderately elevated turbidity alongside pH stress
        if sensor_index == 1:
            turb = 5.8 + _noise(0.5) + progress * 0.8
        else:
            turb = 4.1 + _noise(0.4) + progress * 0.5

    elif phase == "full_recovery":
        if sensor_index == 1:
            turb = 5.8 * (1.0 - progress) ** 2.0 + base + _noise(0.3)
        else:
            turb = 4.1 * (1.0 - progress) ** 2.0 + base + _noise(0.2)

    else:
        turb = base

    return round(max(0.0, turb), 2)


def generate_reading(device: dict, phase: str, progress: float) -> dict:
    idx = int(device["id"][-2:]) if device["id"][-2:].isdigit() else 1
    if device["type"] == "ph_sensor":
        return {"ph": _generate_ph(idx, phase, progress)}
    elif device["type"] == "turbidity_sensor":
        return {"turbidity_ntu": _generate_turbidity(idx, phase, progress)}
    return {}


# ── Status helpers ────────────────────────────────────────────────────────────
def _status_str(device_type: str, value: float) -> str:
    if device_type == "ph_sensor":
        if 6.5 <= value <= 7.5:  return "OPTIMAL "
        if 6.0 <= value <= 8.0:  return "WARNING "
        return "CRITICAL"
    if device_type == "turbidity_sensor":
        if value <= 3.0:  return " CLEAR  "
        if value <= 5.0:  return "WARNING "
        return "CRITICAL"
    return "UNKNOWN "


# ── Telemetry sender ──────────────────────────────────────────────────────────
_session = requests.Session()


def send_telemetry(phase: str, progress: float) -> None:
    now_iso = datetime.now(timezone.utc).isoformat()
    telemetry = [
        {
            "device_id": d["id"],
            "mcu_id":    d["mcu_id"],
            "values":    generate_reading(d, phase, progress),
            "lat":       d["lat"],
            "lng":       d["lng"],
            "ts":        now_iso,
        }
        for d in DEVICES
    ]
    try:
        resp = _session.post(
            f"{BACKEND_URL}/api/gateway-telemetry/",
            json={"gateway_id": GATEWAY_ID, "telemetry": telemetry, "prefer_sync_ml": False},
            timeout=30,
        )
        data      = resp.json()
        accepted  = data.get("accepted", "?")
        rejected  = data.get("rejected", [])
        anomalies = data.get("anomalies", [])
        alert_str = (
            f"  ⚠  {len(anomalies)} alert(s): " +
            ", ".join(a.get("device_type", "?") for a in anomalies)
        ) if anomalies else ""
        rej_str = f"  ✗ {len(rejected)} rejected" if rejected else ""
        print(f"  → sent {accepted}/{len(telemetry)}{alert_str}{rej_str}")
    except requests.exceptions.Timeout:
        print("  → TIMEOUT (data may still have been saved)")
    except Exception as exc:
        print(f"  → ERROR: {exc}")


# ── Display ───────────────────────────────────────────────────────────────────
_PHASE_LABELS = {
    "normal":           "Normal",
    "alkaline_drift":   "Alkaline Drift  (pH rising)",
    "ph_recovery":      "pH Recovery",
    "turbidity_event":  "Turbidity Event (runoff)",
    "turb_recovery":    "Turbidity Recovery",
    "combined_stress":  "Combined Stress",
    "full_recovery":    "Full Recovery",
}


def print_tick(phase: str, elapsed: float, progress: float) -> None:
    e = elapsed % SCENARIO_DURATION
    bar_w = 32
    bar   = int(bar_w * e / SCENARIO_DURATION)
    prog  = "[" + "=" * bar + ">" + " " * (bar_w - bar) + "]"
    label = _PHASE_LABELS.get(phase, phase)
    mins  = int(e // 60)
    secs  = int(e % 60)
    total_mins = int(SCENARIO_DURATION // 60)

    print(f"\n{'='*64}")
    print(f"  {label}")
    print(f"  {prog}  {mins:02d}:{secs:02d} / {total_mins:02d}:00")
    print(f"{'='*64}")
    for d in DEVICES:
        vals = generate_reading(d, phase, progress)
        metric, val = next(iter(vals.items()))
        st = _status_str(d["type"], val)
        print(f"  {d['label']:<34s}  {metric}={val:>6.2f}  [{st}]")


# ── Main ──────────────────────────────────────────────────────────────────────
def main() -> None:
    print("=" * 64)
    print("  AquaNex Water Quality Simulator")
    print(f"  Backend  : {BACKEND_URL}")
    print(f"  Gateway  : {GATEWAY_ID}")
    print(f"  Devices  : {len(DEVICES)}  (2×pH + 2×turbidity)")
    print(f"  Interval : {SEND_INTERVAL}s")
    print(f"  Cycle    : {int(SCENARIO_DURATION/60)} min  (anomalies last 2–3 min each)")
    print("=" * 64)
    print("\n  Ensure devices are configured in the Water Quality page first.")
    print("  Press Ctrl+C to stop.\n")

    start = time.time()
    try:
        while True:
            elapsed  = time.time() - start
            phase    = get_phase(elapsed)
            progress = phase_progress(elapsed)
            print_tick(phase, elapsed, progress)
            send_telemetry(phase, progress)
            time.sleep(SEND_INTERVAL)
    except KeyboardInterrupt:
        print("\n\n  Simulator stopped.")
        sys.exit(0)


if __name__ == "__main__":
    main()
