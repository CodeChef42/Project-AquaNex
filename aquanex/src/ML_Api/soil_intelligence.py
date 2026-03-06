"""
AquaNex Soil Intelligence Router
---------------------------------
FastAPI router implementing:
  - IDW spatial interpolation of EC sensor readings
  - Linear rate-of-salinization via numpy polyfit
  - Leaching requirement calculator (FAO formula)
  - Gypsum requirement calculator (US Bureau of Reclamation formula)
"""

import math
from typing import List, Optional

import numpy as np
from fastapi import APIRouter

from soil_models import (
    ZoneAnalysisRequest,
    ZoneAnalysisResponse,
    LeachingRequest,
    LeachingResult,
    GypsumRequest,
    GypsumResult,
    IDWPoint,
    SensorReading,
    HistoryPoint,
)

router = APIRouter(prefix='/soil', tags=['soil'])

# Field capacity (vol/vol) by texture for leaching volume estimation
_FIELD_CAPACITY = {
    'sandy': 0.15,
    'loam':  0.27,
    'clay':  0.38,
}
_DEFAULT_FC = 0.27  # loam fallback

# Grid resolution for IDW heatmap
_GRID_STEPS = 8  # 8x8 = 64 interpolation points


# ---------------------------------------------------------------------------
# Internal algorithm functions
# ---------------------------------------------------------------------------

def _idw_interpolate(readings: List[SensorReading], grid_steps: int = _GRID_STEPS) -> List[IDWPoint]:
    """Inverse Distance Weighting interpolation on a regular lat/lng grid.

    Weight = 1 / d^2 (power=2). Returns grid_steps² IDWPoint objects.
    Falls back to raw sensor locations when there are 0 or 1 readings.
    """
    if not readings:
        return []

    if len(readings) == 1:
        r = readings[0]
        return [IDWPoint(lat=r.location.lat, lng=r.location.lng, ec_estimate=round(r.ec_value, 3))]

    lats = [r.location.lat for r in readings]
    lngs = [r.location.lng for r in readings]
    min_lat, max_lat = min(lats), max(lats)
    min_lng, max_lng = min(lngs), max(lngs)

    # Avoid zero-range grids (all sensors at same coordinate)
    lat_range = max_lat - min_lat or 0.001
    lng_range = max_lng - min_lng or 0.001

    results: List[IDWPoint] = []
    for i in range(grid_steps):
        for j in range(grid_steps):
            glat = min_lat + (i / (grid_steps - 1)) * lat_range
            glng = min_lng + (j / (grid_steps - 1)) * lng_range

            weights = []
            for r in readings:
                d = math.hypot(glat - r.location.lat, glng - r.location.lng)
                if d < 1e-10:
                    # Grid point coincides with sensor — use sensor value directly
                    weights = [(1e10, r.ec_value)]
                    break
                weights.append((1.0 / (d ** 2), r.ec_value))

            total_w = sum(w for w, _ in weights)
            ec_est = sum(w * v for w, v in weights) / total_w if total_w else 0.0
            results.append(IDWPoint(lat=round(glat, 6), lng=round(glng, 6), ec_estimate=round(ec_est, 3)))

    return results


def _salinization_rate(history: List[HistoryPoint]) -> Optional[float]:
    """Linear regression over the EC time series.

    Returns slope in dS/m per day. Positive = salinization worsening.
    Returns None if fewer than 2 history points.
    """
    if len(history) < 2:
        return None

    from datetime import date as _date
    try:
        dates = [_date.fromisoformat(h.date) for h in history]
    except ValueError:
        return None

    day0 = dates[0]
    x = np.array([(d - day0).days for d in dates], dtype=float)
    y = np.array([h.ec_avg for h in history], dtype=float)
    coeffs = np.polyfit(x, y, 1)
    return round(float(coeffs[0]), 6)  # slope = dS/m per day


def _leaching_requirement(
    ec_water: float,
    ec_threshold: float,
    soil_texture: str,
    area_ha: float,
    depth_cm: float,
) -> LeachingResult:
    """Compute leaching requirement.

    LR  = EC_w / (5 × EC_t − EC_w)          [FAO]
    V   = FC × (depth/100) × area_ha × 10000  [m³ total]
    V_l = V / (1 − LR)                        [total irrigation volume in liters]
    """
    ec_t = max(ec_threshold, 0.01)
    lr = ec_water / max(5.0 * ec_t - ec_water, 0.01)
    lr = max(0.0, min(lr, 0.95))  # clamp to [0, 95%]

    fc = _FIELD_CAPACITY.get(soil_texture.lower(), _DEFAULT_FC)
    # Volume of water needed to wet the root zone (m³), scaled to liters
    root_zone_vol_liters = fc * (depth_cm / 100.0) * area_ha * 10_000 * 1_000
    total_vol_liters = root_zone_vol_liters / max(1.0 - lr, 0.05)

    # Rough duration estimate at 2 mm/h drip equivalent
    # 1 mm over 1 ha = 10,000 liters
    area_m2 = area_ha * 10_000
    application_rate_lph = 2.0 * area_m2  # 2 mm/h in liters/hour
    duration_h = total_vol_liters / max(application_rate_lph, 1.0)

    return LeachingResult(
        leaching_ratio=round(lr, 4),
        water_volume_liters=round(total_vol_liters, 1),
        duration_hours_estimate=round(duration_h, 2),
    )


def _gypsum_requirement(
    esp_initial: float,
    esp_target: float,
    cec: float,
    bulk_density: float,
    depth_cm: float,
    area_ha: float,
) -> GypsumResult:
    """Compute gypsum requirement (US Bureau of Reclamation formula).

    GR (t/ha) = 0.0345 × (ESP_i − ESP_f) × CEC × ρ_b × (depth / 100)
    """
    delta_esp = max(esp_initial - esp_target, 0.0)
    gr_per_ha = 0.0345 * delta_esp * cec * bulk_density * (depth_cm / 100.0)
    total = gr_per_ha * area_ha

    return GypsumResult(
        gypsum_tonnes_per_ha=round(gr_per_ha, 3),
        total_gypsum_tonnes=round(total, 3),
    )


def _alert_level(avg_ec: float, threshold: float, rate: Optional[float]) -> str:
    """Derive alert level from EC magnitude and trend direction."""
    if avg_ec >= threshold * 1.5:
        return 'critical'
    if avg_ec >= threshold or (rate is not None and rate > 0.05):
        return 'warning'
    return 'ok'


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post('/analyze', response_model=ZoneAnalysisResponse)
async def analyze_zone(req: ZoneAnalysisRequest) -> ZoneAnalysisResponse:
    """Run all four soil intelligence algorithms for a zone."""
    idw_map = _idw_interpolate(req.readings)
    rate = _salinization_rate(req.history)

    avg_ec = (
        sum(r.ec_value for r in req.readings) / len(req.readings)
        if req.readings else None
    )

    leaching = _leaching_requirement(
        ec_water=req.ec_water,
        ec_threshold=req.ec_threshold,
        soil_texture=req.soil_texture,
        area_ha=req.area_ha,
        depth_cm=30.0,
    )

    # Only compute gypsum recommendation when EC is above threshold
    gypsum = None
    if avg_ec and avg_ec > req.ec_threshold:
        # Estimate ESP from EC (rough proxy: ESP ≈ EC * 5 for sodic soils)
        estimated_esp = min(avg_ec * 5, 80.0)
        gypsum = _gypsum_requirement(
            esp_initial=estimated_esp,
            esp_target=10.0,
            cec=20.0,   # typical loam CEC meq/100g
            bulk_density=1.4,
            depth_cm=30.0,
            area_ha=req.area_ha,
        )

    alert = _alert_level(avg_ec or 0.0, req.ec_threshold, rate)

    return ZoneAnalysisResponse(
        zone_id=req.zone_id,
        alert_level=alert,
        salinization_rate=rate,
        idw_map=idw_map,
        leaching=leaching,
        gypsum=gypsum,
        avg_ec=round(avg_ec, 3) if avg_ec is not None else None,
    )


@router.post('/leaching', response_model=LeachingResult)
async def leaching_calculator(req: LeachingRequest) -> LeachingResult:
    """Standalone leaching requirement calculator."""
    return _leaching_requirement(
        ec_water=req.ec_water,
        ec_threshold=req.ec_threshold,
        soil_texture=req.soil_texture,
        area_ha=req.area_ha,
        depth_cm=req.depth_cm,
    )


@router.post('/gypsum', response_model=GypsumResult)
async def gypsum_calculator(req: GypsumRequest) -> GypsumResult:
    """Standalone gypsum requirement calculator."""
    return _gypsum_requirement(
        esp_initial=req.esp_initial,
        esp_target=req.esp_target,
        cec=req.cec,
        bulk_density=req.bulk_density,
        depth_cm=req.depth_cm,
        area_ha=req.area_ha,
    )
