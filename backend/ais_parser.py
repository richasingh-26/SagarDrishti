import io
import json
import pandas as pd
from typing import List, Dict, Any, Tuple
from schemas import Vessel, Waypoint


COLUMN_MAPPINGS = {
    "mmsi": ["mmsi", "mmsi_id", "vessel_id", "ship_id", "imo", "vessel_number"],
    "name": ["vesselname", "vessel_name", "shipname", "ship_name", "name"],
    "lat": ["lat", "latitude", "y", "lat_deg"],
    "lon": ["lon", "long", "longitude", "x", "lon_deg"],
    "speed": ["sog", "speed", "speed_over_ground", "velocity", "spd"],
    "heading": ["cog", "heading", "course", "course_over_ground", "hdg", "direction"],
    "type": ["vesseltype", "vessel_type", "shiptype", "ship_type", "type"],
    "timestamp": ["basedatetime", "timestamp", "datetime", "time", "date_time", "utc_time"],
    "flag": ["flag", "country", "nationality"],
    "destination": ["destination", "dest", "port_dest"],
    "status": ["status", "nav_status", "navigational_status"],
    "length": ["length", "len", "loa"],
    "width": ["width", "beam"],
    "draught": ["draught", "draft"],
    "cargo_type": ["cargo", "cargo_type", "cargotype"]
}


def find_column(df_cols: List[str], targets: List[str]) -> str:
    cleaned = {c.lower().replace(" ", "").replace("_", "").replace("-", ""): c for c in df_cols}
    for t in targets:
        target_clean = t.lower().replace(" ", "").replace("_", "").replace("-", "")
        if target_clean in cleaned:
            return cleaned[target_clean]
    return ""


def parse_csv_or_json(content: bytes, filename: str) -> List[Vessel]:
    if filename.endswith(".json"):
        data = json.loads(content.decode("utf-8"))
        if isinstance(data, list):
            df = pd.DataFrame(data)
        elif isinstance(data, dict) and "vessels" in data:
            df = pd.DataFrame(data["vessels"])
        else:
            df = pd.DataFrame([data])
    else:
        df = pd.read_csv(io.BytesIO(content))

    cols = list(df.columns)
    
    col_mmsi = find_column(cols, COLUMN_MAPPINGS["mmsi"])
    col_name = find_column(cols, COLUMN_MAPPINGS["name"])
    col_lat = find_column(cols, COLUMN_MAPPINGS["lat"])
    col_lon = find_column(cols, COLUMN_MAPPINGS["lon"])
    col_speed = find_column(cols, COLUMN_MAPPINGS["speed"])
    col_heading = find_column(cols, COLUMN_MAPPINGS["heading"])
    col_type = find_column(cols, COLUMN_MAPPINGS["type"])
    col_time = find_column(cols, COLUMN_MAPPINGS["timestamp"])
    col_flag = find_column(cols, COLUMN_MAPPINGS["flag"])
    col_dest = find_column(cols, COLUMN_MAPPINGS["destination"])
    col_status = find_column(cols, COLUMN_MAPPINGS["status"])
    col_length = find_column(cols, COLUMN_MAPPINGS["length"])
    col_width = find_column(cols, COLUMN_MAPPINGS["width"])
    col_draught = find_column(cols, COLUMN_MAPPINGS["draught"])
    col_cargo = find_column(cols, COLUMN_MAPPINGS["cargo_type"])

    if not col_lat or not col_lon:
        raise ValueError("Dataset must contain Latitude and Longitude columns.")

    if not col_mmsi:
        if col_name:
            df["mmsi_generated"] = df[col_name].astype(str)
            col_mmsi = "mmsi_generated"
        else:
            df["mmsi_generated"] = [f"MMSI-{i+1:05d}" for i in range(len(df))]
            col_mmsi = "mmsi_generated"

    if col_time:
        try:
            df["_parsed_time"] = pd.to_datetime(df[col_time], errors="coerce")
            df = df.sort_values(by=["_parsed_time"])
        except Exception:
            pass

    vessels: List[Vessel] = []

    # Group records by MMSI to reconstruct vessel tracks
    for mmsi_val, group in df.groupby(col_mmsi):
        name_val = str(group[col_name].iloc[-1]) if col_name and pd.notna(group[col_name].iloc[-1]) else f"Vessel-{mmsi_val}"
        type_val = str(group[col_type].iloc[-1]) if col_type and pd.notna(group[col_type].iloc[-1]) else "Cargo"
        flag_val = str(group[col_flag].iloc[-1]) if col_flag and pd.notna(group[col_flag].iloc[-1]) else "Panama"
        dest_val = str(group[col_dest].iloc[-1]) if col_dest and pd.notna(group[col_dest].iloc[-1]) else "Singapore"
        status_val = str(group[col_status].iloc[-1]) if col_status and pd.notna(group[col_status].iloc[-1]) else "Underway"
        cargo_val = str(group[col_cargo].iloc[-1]) if col_cargo and pd.notna(group[col_cargo].iloc[-1]) else "General Cargo"

        # Extract latest point
        latest_row = group.iloc[-1]
        latest_lat = float(latest_row[col_lat])
        latest_lon = float(latest_row[col_lon])
        latest_speed = float(latest_row[col_speed]) if col_speed and pd.notna(latest_row[col_speed]) else 12.0
        latest_heading = float(latest_row[col_heading]) if col_heading and pd.notna(latest_row[col_heading]) else 0.0

        length_val = float(latest_row[col_length]) if col_length and pd.notna(latest_row[col_length]) else 180.0
        width_val = float(latest_row[col_width]) if col_width and pd.notna(latest_row[col_width]) else 28.0
        draught_val = float(latest_row[col_draught]) if col_draught and pd.notna(latest_row[col_draught]) else 9.5

        # Reconstruct route waypoints
        route: List[Waypoint] = []
        for _, row in group.iterrows():
            if pd.notna(row[col_lat]) and pd.notna(row[col_lon]):
                w_time = str(row[col_time]) if col_time and pd.notna(row[col_time]) else None
                w_spd = float(row[col_speed]) if col_speed and pd.notna(row[col_speed]) else None
                w_hdg = float(row[col_heading]) if col_heading and pd.notna(row[col_heading]) else None
                route.append(Waypoint(
                    lat=float(row[col_lat]),
                    lon=float(row[col_lon]),
                    timestamp=w_time,
                    speed=w_spd,
                    heading=w_hdg
                ))

        vessels.append(Vessel(
            name=name_val,
            mmsi=str(mmsi_val),
            imo=str(mmsi_val) if len(str(mmsi_val)) == 7 else None,
            flag=flag_val,
            type=type_val,
            lat=latest_lat,
            lon=latest_lon,
            speed=round(latest_speed, 1),
            heading=round(latest_heading, 1),
            length=length_val,
            width=width_val,
            draught=draught_val,
            destination=dest_val,
            status=status_val,
            cargo_type=cargo_val,
            route=route
        ))

    return vessels
