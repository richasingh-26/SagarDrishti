from typing import List, Optional
from pydantic import BaseModel, Field


class Waypoint(BaseModel):
    lat: float
    lon: float
    timestamp: Optional[str] = None
    speed: Optional[float] = None
    heading: Optional[float] = None


class Vessel(BaseModel):
    name: str
    mmsi: str
    imo: Optional[str] = None
    callsign: Optional[str] = None
    flag: Optional[str] = "Unknown"
    type: str = "Cargo"
    lat: float
    lon: float
    speed: float = 0.0
    heading: float = 0.0
    length: Optional[float] = None
    width: Optional[float] = None
    draught: Optional[float] = None
    destination: Optional[str] = "Unknown"
    eta: Optional[str] = None
    cargo_type: Optional[str] = "General"
    status: str = "Underway"
    anomaly_score: float = 0.0
    is_anomaly: bool = False
    is_prime_suspect: bool = False
    attribution_score: Optional[float] = None
    route: List[Waypoint] = Field(default_factory=list)


class VesselsResponse(BaseModel):
    total: int
    anomalies: int
    vessels: List[Vessel]


class HealthResponse(BaseModel):
    status: str
    unet: bool
    iso_forest: bool
    vessel_count: int
    sar_available: bool = False
    sar_file: Optional[str] = None


class PrimeSuspectResponse(BaseModel):
    name: str
    mmsi: str
    attribution_score: Optional[float] = None
    type: Optional[str] = "Tanker"
    reason: Optional[str] = "Spatial-temporal trajectory intersects spill origin zone during estimated discharge window."
    lat: Optional[float] = None
    lon: Optional[float] = None
    attribution_components: dict[str, Optional[float]] = Field(default_factory=dict)


class DetectResponse(BaseModel):
    spill_detected: bool
    detection_percentage: float
    confidence: float
    area_km2: Optional[float] = None
    coordinates: List[List[float]] = Field(default_factory=list)


class SimulateRequest(BaseModel):
    vessel_name: Optional[str] = "Unknown"
    lat: float
    lon: float
    hours: Optional[int] = 24
    wind_speed_knots: Optional[float] = 12.0
    wind_direction_deg: Optional[float] = 220.0
    current_speed_knots: Optional[float] = 1.2
    current_direction_deg: Optional[float] = 135.0


class SimulateResponse(BaseModel):
    footprint_size: float
    peak_intensity: float
    trajectory: List[Waypoint] = Field(default_factory=list)
    impact_zones: List[str] = Field(default_factory=list)
    iou_score_pct: Optional[float] = None
    sar_available: bool = False


class OriginReconstructionRequest(BaseModel):
    slick_lat: float
    slick_lon: float
    detection_time: Optional[str] = "2026-09-18 10:30 UTC"
    backtrack_hours: Optional[int] = 8
    wind_speed_knots: Optional[float] = 12.0
    wind_direction_deg: Optional[float] = 220.0
    current_speed_knots: Optional[float] = 1.2
    current_direction_deg: Optional[float] = 135.0
    spill_volume_m3: Optional[float] = 450.0


class OriginReconstructionResponse(BaseModel):
    slick_lat: float
    slick_lon: float
    origin_lat: float
    origin_lon: float
    origin_radius_km: float
    backtrack_hours: int = 8
    estimated_time: str
    discharge_window: str = "06:00 - 08:30 UTC"
    confidence_pct: Optional[float] = None
    iou_score_pct: Optional[float] = None
    backtrack_trajectory: List[Waypoint] = Field(default_factory=list)
    prime_suspect: Optional[PrimeSuspectResponse] = None
    candidate_vessels: List[Vessel] = Field(default_factory=list)


class SuspectRankingRequest(BaseModel):
    slick_lat: Optional[float] = 1.25
    slick_lon: Optional[float] = 103.80
    wind_speed_knots: Optional[float] = 12.0
    wind_direction_deg: Optional[float] = 220.0
    current_speed_knots: Optional[float] = 1.2
    current_direction_deg: Optional[float] = 135.0
    backtrack_hours: Optional[int] = 8
    limit: Optional[int] = 10


class RankedSuspect(BaseModel):
    rank: int
    name: str
    mmsi: str
    type: str
    cargo_type: Optional[str] = None
    lat: float
    lon: float
    speed: float
    heading: float
    anomaly_score: float
    attribution_score: float
    confidence_pct: float
    distance_to_spill_km: float
    distance_to_origin_km: float
    temporal_proximity_hrs: float
    risk_level: str
    score_breakdown: dict[str, float] = Field(default_factory=dict)
    suspect_evidence: List[str] = Field(default_factory=list)
    recommended_action: str


class SuspectRankingResponse(BaseModel):
    slick_lat: float
    slick_lon: float
    origin_lat: float
    origin_lon: float
    backtrack_hours: int
    total_evaluated_vessels: int
    top_suspects: List[RankedSuspect] = Field(default_factory=list)
    algorithm_info: dict[str, str] = Field(default_factory=dict)

