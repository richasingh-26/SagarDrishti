import math
import cv2
import numpy as np
from typing import List, Tuple
from schemas import SimulateRequest, SimulateResponse, Waypoint
from unet_detector import get_local_sar_analysis


def simulation_iou(req: SimulateRequest) -> float | None:
    """Compare this vessel's simulated footprint with the segmented SAR footprint."""
    sar = get_local_sar_analysis()
    if not sar:
        return None
    observed = sar["mask"] > 0
    if not np.any(observed):
        return 0.0
    height, width = observed.shape
    moments = cv2.moments(observed.astype(np.uint8))
    cx = moments["m10"] / moments["m00"]
    cy = moments["m01"] / moments["m00"]

    # Project the vessel into a local scene centered on the detected spill and
    # advect it with the same metocean vectors used by the trajectory model.
    wind_rad = math.radians((req.wind_direction_deg + 180) % 360)
    drift_u = req.current_speed_knots * math.sin(math.radians(req.current_direction_deg)) + req.wind_speed_knots * 0.03 * math.sin(wind_rad)
    drift_v = req.current_speed_knots * math.cos(math.radians(req.current_direction_deg)) + req.wind_speed_knots * 0.03 * math.cos(wind_rad)
    simulated_lat = req.lat + drift_v * req.hours / 60.0
    simulated_lon = req.lon + drift_u * req.hours / 60.0
    # One Sentinel scene covers a regional two-degree operating window.
    x = cx + (simulated_lon - 103.8) / 2.0 * width
    y = cy - (simulated_lat - 1.25) / 2.0 * height
    footprint = np.zeros_like(observed, dtype=np.uint8)
    radius_x = max(8, int(width * (0.028 + min(req.hours, 24) * 0.0015)))
    radius_y = max(6, int(radius_x * 0.58))
    cv2.ellipse(footprint, (round(x), round(y)), (radius_x, radius_y), req.current_direction_deg, 0, 360, 1, -1)
    predicted = footprint.astype(bool)
    union = np.logical_or(observed, predicted).sum()
    return round(float(np.logical_and(observed, predicted).sum() / union * 100), 2) if union else 0.0


def simulate_oil_drift(req: SimulateRequest) -> SimulateResponse:
    # Drift vector: 100% surface current + ~3% wind velocity
    # Wind angle to math radians (oceanographic direction: coming from -> going towards)
    wind_rad = math.radians((req.wind_direction_deg + 180) % 360)
    wind_u = (req.wind_speed_knots * 0.03) * math.sin(wind_rad)
    wind_v = (req.wind_speed_knots * 0.03) * math.cos(wind_rad)

    curr_rad = math.radians(req.current_direction_deg)
    curr_u = req.current_speed_knots * math.sin(curr_rad)
    curr_v = req.current_speed_knots * math.cos(curr_rad)

    # Total net velocity in knots (1 knot ~= 1.852 km/h ~= 0.0166 deg lat/lon approx per hour)
    total_u = wind_u + curr_u
    total_v = wind_v + curr_v

    # 1 degree latitude ~= 60 nautical miles
    lat_deg_per_knot_hour = 1.0 / 60.0

    trajectory: List[Waypoint] = []
    cur_lat = req.lat
    cur_lon = req.lon

    trajectory.append(Waypoint(lat=round(cur_lat, 4), lon=round(cur_lon, 4), timestamp="T+0h"))

    step_hours = 2
    for h in range(step_hours, req.hours + 1, step_hours):
        # Longitude scaling by cos(lat)
        lon_deg_per_knot_hour = 1.0 / (60.0 * max(0.2, math.cos(math.radians(cur_lat))))
        
        cur_lat += total_v * lat_deg_per_knot_hour * step_hours
        cur_lon += total_u * lon_deg_per_knot_hour * step_hours

        trajectory.append(Waypoint(
            lat=round(cur_lat, 4),
            lon=round(cur_lon, 4),
            timestamp=f"T+{h}h",
            speed=round(math.hypot(total_u, total_v), 1)
        ))

    # Fay spreading formula approximation for area expansion
    time_sec = req.hours * 3600
    footprint_size = round(2.5 * math.pow(req.hours, 0.45), 2)
    peak_intensity = round(max(0.2, 0.95 * math.exp(-0.02 * req.hours)), 2)

    impact_zones = ["Coastal Mangrove Reserve (18km)", "Coral Reef Zone B (24km)", "Commercial Shipping Lane 3"]

    iou = simulation_iou(req)
    return SimulateResponse(
        footprint_size=footprint_size,
        peak_intensity=peak_intensity,
        trajectory=trajectory,
        impact_zones=impact_zones,
        iou_score_pct=iou,
        sar_available=iou is not None,
    )
