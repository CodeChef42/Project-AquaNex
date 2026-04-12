#!/usr/bin/env python3
"""
AquaNex Water Quality Simulator  (state-based, smooth trajectories)
====================================================================
Values carry state between readings — no sudden jumps. Each sensor has a
current value that drifts toward a phase-dependent target at a physically
bounded rate. Noise is tiny relative to the movement.

Scenario cycle (~840 seconds / 14 minutes):
  0–120s    Normal          — optimal readings across all sensors
  120–270s  Alkaline Drift  — slow pH rise (algae bloom / lime leaching)
  270–315s  pH Recovery     — gradual return toward normal
  315–405s  Normal          — stable window
  405–585s  Turbidity Event — sustained sediment / rain runoff ramp + plateau
  585–645s  Turb Recovery   — natural settling
  645–765s  Combined Stress — pH + turbidity both elevated simultaneously
  765–840s  Full Recovery   — all sensors normalising

Why state-based?
  Without carrying state, each reading is computed independently from the
  phase/progress which causes sudden jumps whenever the formula produces a
  large value before noise smoothing kicks in. With persistent state:
    - The sensor can never move faster than `max_rate` per tick
    - Small Gaussian noise rides on top of the smooth trajectory
    - Phase transitions are invisible — the sensor just starts chasing a
      new target at the same bounded rate

Send interval: 15 seconds (configurable via SEND_INTERVAL env var)

Usage:
    python water_quality_simulator.py

Environment variables:
    BACKEND_URL    Backend base URL  (default: http://127.0.0.1:8000)
    GATEWAY_ID     Gateway identifier (default: WQ-GATEWAY-01)
    SEND_INTERVAL  Seconds between sends (default: 15)
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
SCENARIO_DURATION = 840.0   # 14 minutes per full cycle

PHASES = [
    (0,   120,  "normal"),
    (120, 270,  "alkaline_drift"),   # 2.5 min sustained pH rise
    (270, 315,  "ph_recovery"),
    (315, 405,  "normal"),
    (405, 585,  "turbidity_event"),  # 3 min sustained runoff
    (585, 645,  "turb_recovery"),
    (645, 765,  "combined_stress"),  # 2 min — pH + turbidity together
    (765, 840,  "full_recovery"),
]


def get_phase(elapsed: float) -> str:
    e = elapsed % SCENARIO_DURATION
    for start, end, name in PHASES:
        if start <= e < end:
            return name
    return "normal"


def phase_progress(elapsed: float) -> float:
    """0.0 → 1.0 progress within the current phase."""
    e = elapsed % SCENARIO_DURATION
    for start, end, name in PHASES:
        if start <= e < end:
            return (e - start) / (end - start)
    return 0.0


# ── Persistent sensor state ───────────────────────────────────────────────────
# This is the core of smooth simulation — values carry over between ticks.
_state: dict[str, float] = {
    "WQ-PH-01":   7.10,
    "WQ-PH-02":   7.05,
    "WQ-TURB-01": 0.90,
    "WQ-TURB-02": 0.85,
}


def _diurnal_ph() -> float:
    """Very slow sinusoidal pH background drift (±0.05 over hours)."""
    return math.sin(time.time() / 7200.0 * math.pi) * 0.05


def _target_ph(device_id: str, phase: str, progress: float) -> tuple[float, float]:
    """
    Return (target_value, max_change_per_step) for a pH sensor.

    max_rate is how many pH units the sensor is allowed to move in one
    SEND_INTERVAL tick.  Keeping this bounded is what prevents sudden jumps.
    """
    base = 7.10 + _diurnal_ph()

    if phase == "normal":
        return base, 0.04

    elif phase == "alkaline_drift":
        # Sensor A rises to 8.9, Sensor B follows to 8.3 (simulates upstream/downstream lag)
        peak = 8.90 if device_id == "WQ-PH-01" else 8.30
        target = base + (peak - base) * progress
        return target, 0.22  # algae bloom consumes CO₂ fairly quickly

    elif phase == "ph_recovery":
        peak = 8.90 if device_id == "WQ-PH-01" else 8.30
        target = peak - (peak - base) * progress
        return target, 0.16  # recovery a touch slower than onset

    elif phase == "combined_stress":
        if device_id == "WQ-PH-01":
            return 8.20 + progress * 0.30, 0.18
        else:
            return 6.10 - progress * 0.20, 0.12  # slight acid shift on downstream sensor

    elif phase == "full_recovery":
        return base, 0.10

    return base, 0.04


def _target_turbidity(device_id: str, phase: str, progress: float) -> tuple[float, float]:
    """
    Return (target_value, max_change_per_step) for a turbidity sensor.
    """
    base = 0.90

    if phase == "normal":
        return base, 0.05

    elif phase == "turbidity_event":
        # Ramp up in first ~55 % of the phase, then plateau (mimics runoff peak)
        ramp = min(progress * 1.8, 1.0)
        peak = 14.5 if device_id == "WQ-TURB-01" else 9.2
        target = base + (peak - base) * ramp
        return target, 1.6  # fast onset — sediment hits quickly

    elif phase == "turb_recovery":
        # Exponential-style settling
        if device_id == "WQ-TURB-01":
            target = 14.5 * (1.0 - progress) ** 1.4 + base
        else:
            target = 9.2 * (1.0 - progress) ** 1.4 + base
        return target, 1.2  # gravity-driven settling, slightly slower than onset

    elif phase == "combined_stress":
        if device_id == "WQ-TURB-01":
            return 5.8 + progress * 0.8, 0.7
        else:
            return 4.1 + progress * 0.5, 0.5

    elif phase == "full_recovery":
        if device_id == "WQ-TURB-01":
            target = 5.8 * (1.0 - progress) ** 2.0 + base
        else:
            target = 4.1 * (1.0 - progress) ** 2.0 + base
        return target, 0.5

    return base, 0.05


def _smooth_step(current: float, target: float, max_rate: float, noise_sigma: float) -> float:
    """
    Move `current` toward `target` by at most `max_rate`, plus tiny Gaussian noise.

    The noise_sigma here is much smaller than in the old random-recompute approach —
    it only represents sensor measurement jitter, not the value change itself.
    """
    diff = target - current
    step = math.copysign(min(abs(diff), max_rate), diff)
    return current + step + random.gauss(0.0, noise_sigma)


def update_state(phase: str, progress: float) -> None:
    """Advance all sensor states one tick toward their phase targets."""
    for d in DEVICES:
        did = d["id"]
        cur = _state[did]

        if d["type"] == "ph_sensor":
            target, rate = _target_ph(did, phase, progress)
            nxt = _smooth_step(cur, target, rate, 0.012)   # ±0.012 measurement jitter
            _state[did] = round(max(2.0, min(14.0, nxt)), 2)

        elif d["type"] == "turbidity_sensor":
            target, rate = _target_turbidity(did, phase, progress)
            nxt = _smooth_step(cur, target, rate, 0.055)   # slightly noisier (particle counts)
            _state[did] = round(max(0.0, nxt), 2)


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


def send_telemetry() -> None:
    now_iso = datetime.now(timezone.utc).isoformat()
    telemetry = [
        {
            "device_id": d["id"],
            "mcu_id":    d["mcu_id"],
            "values":    {d["metric"]: _state[d["id"]]},
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
            # 20s allows Supabase cold-start connection pooling (~10-15s on first tick)
            # while still preventing indefinite blocking across multiple send intervals.
            timeout=20,
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
        print(f"  → TIMEOUT — backend at {BACKEND_URL} took >20s. Retrying next tick…")
    except requests.exceptions.ConnectionError:
        print(f"  → WAITING — backend not reachable at {BACKEND_URL}. Retrying next tick…")
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


def print_tick(phase: str, elapsed: float) -> None:
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
        val = _state[d["id"]]
        st  = _status_str(d["type"], val)
        print(f"  {d['label']:<34s}  {d['metric']}={val:>6.2f}  [{st}]")


# ── Main ──────────────────────────────────────────────────────────────────────
def main() -> None:
    print("=" * 64)
    print("  AquaNex Water Quality Simulator  (smooth / state-based)")
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
            update_state(phase, progress)   # advance state before display/send
            print_tick(phase, elapsed)
            send_telemetry()
            time.sleep(SEND_INTERVAL)
    except KeyboardInterrupt:
        print("\n\n  Simulator stopped.")
        sys.exit(0)


if __name__ == "__main__":
    main()
