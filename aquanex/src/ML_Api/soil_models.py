from pydantic import BaseModel, Field
from typing import List, Optional


class SensorLocation(BaseModel):
    lat: float
    lng: float


class SensorReading(BaseModel):
    sensor_id: str
    location: SensorLocation
    ec_value: float = Field(..., description='Electrical conductivity in dS/m')


class HistoryPoint(BaseModel):
    date: str = Field(..., description='ISO date string YYYY-MM-DD')
    ec_avg: float


class ZoneAnalysisRequest(BaseModel):
    zone_id: str
    area_ha: float
    soil_texture: str = Field(..., description='sandy | loam | clay')
    ec_threshold: float = Field(default=4.0, description='Alert threshold in dS/m')
    ec_water: float = Field(default=1.5, description='Irrigation water EC in dS/m')
    readings: List[SensorReading] = Field(default_factory=list)
    history: List[HistoryPoint] = Field(default_factory=list)


class LeachingRequest(BaseModel):
    ec_current: float = Field(..., description='Current soil EC in dS/m')
    ec_threshold: float = Field(default=4.0, description='Crop tolerance threshold in dS/m')
    ec_water: float = Field(default=1.5, description='Irrigation water EC in dS/m')
    soil_texture: str = Field(default='loam', description='sandy | loam | clay')
    area_ha: float = Field(default=1.0)
    depth_cm: float = Field(default=30.0, description='Root zone depth in cm')


class GypsumRequest(BaseModel):
    esp_initial: float = Field(..., description='Initial exchangeable sodium percentage')
    esp_target: float = Field(default=10.0, description='Target ESP after treatment')
    cec: float = Field(..., description='Cation exchange capacity in meq/100g')
    bulk_density: float = Field(default=1.4, description='Soil bulk density in g/cm³')
    depth_cm: float = Field(default=30.0, description='Depth of treatment layer in cm')
    area_ha: float = Field(default=1.0)


class IDWPoint(BaseModel):
    lat: float
    lng: float
    ec_estimate: float


class LeachingResult(BaseModel):
    leaching_ratio: float
    water_volume_liters: float
    duration_hours_estimate: float


class GypsumResult(BaseModel):
    gypsum_tonnes_per_ha: float
    total_gypsum_tonnes: float


class ZoneAnalysisResponse(BaseModel):
    zone_id: str
    alert_level: str = Field(..., description='ok | warning | critical')
    salinization_rate: Optional[float] = Field(None, description='dS/m per day; positive = worsening')
    idw_map: List[IDWPoint] = Field(default_factory=list)
    leaching: Optional[LeachingResult] = None
    gypsum: Optional[GypsumResult] = None
    avg_ec: Optional[float] = None
