import os
import pandas as pd
from typing import List
from schemas import Vessel, Waypoint
from ais_parser import parse_csv_or_json


def load_real_ais_dataset() -> List[Vessel]:
    # Prefer the complete raw AIS feed.  It contains one record per MMSI and is
    # deliberately kept ahead of the small anomaly-training extract below.
    json_path = os.path.join(os.path.dirname(__file__), "data", "ais", "ais_data.json")
    if os.path.exists(json_path):
        try:
            with open(json_path, "rb") as source:
                vessels = parse_csv_or_json(source.read(), json_path)
            if vessels:
                return vessels
        except Exception as e:
            print(f"Error loading {json_path}: {e}")

    # Look for real dataset CSV file
    csv_paths = [
        os.path.join(os.path.dirname(__file__), "data", "ais", "vessels_with_anomalies.csv"),
        os.path.join(os.path.dirname(__file__), "data", "ais", "singapore_vessels_20260918.csv"),
        os.path.join(os.path.dirname(__file__), "sample_ais.csv"),
    ]

    for path in csv_paths:
        if os.path.exists(path):
            try:
                df = pd.read_csv(path)
                vessels_dict = {}
                
                # Check for anomaly column
                has_anomaly_col = "anomaly" in df.columns
                has_anomaly_score_col = "anomaly_score" in df.columns

                for _, row in df.iterrows():
                    mmsi = str(row.get("mmsi", ""))
                    name = str(row.get("name", row.get("VesselName", f"Vessel-{mmsi}")))
                    lat = float(row.get("lat", row.get("LAT", 1.25)))
                    lon = float(row.get("lon", row.get("LON", 103.8)))
                    speed = float(row.get("speed", row.get("SOG", 10.0)))
                    heading = float(row.get("heading", row.get("COG", 0.0)))
                    time_str = str(row.get("time", row.get("BaseDateTime", "")))

                    # Anomaly calculation from dataset
                    is_anomaly = False
                    raw_anomaly_score = 0.15

                    if has_anomaly_col:
                        # -1 represents anomaly in Isolation Forest output
                        is_anomaly = int(row.get("anomaly", 1)) == -1
                    
                    if has_anomaly_score_col:
                        # Normalize raw isolation score
                        raw_s = float(row.get("anomaly_score", 0.0))
                        if is_anomaly:
                            raw_anomaly_score = round(min(0.98, max(0.65, 0.75 - raw_s)), 2)
                        else:
                            raw_anomaly_score = round(min(0.45, max(0.05, 0.25 - raw_s)), 2)

                    # Determine type & flag heuristics
                    vtype = "Cargo Ship"
                    flag = "Singapore"
                    if "FERRY" in name or "PASSION" in name:
                        vtype = "Passenger Ferry"
                    elif "ASPHALT" in name or "SERENITY" in name or "SOLIDARITY" in name or "TARPON" in name or "AULAC" in name:
                        vtype = "Crude Oil Tanker"
                    elif "SAMURAI" in name or "CENTAURUS" in name:
                        vtype = "Chemical Tanker"
                    elif "HAIPHONG" in name or "GIANT" in name or "EVER" in name or "TASMANIA" in name or "MSC" in name:
                        vtype = "Container Ship (ULCV)"
                        flag = "Liberia" if "TASMANIA" in name else "Panama"
                    elif "PSA" in name:
                        vtype = "Tug / Pilot Vessel"
                    elif "GUARDIAN" in name or "PATROL" in name:
                        vtype = "Patrol Vessel"

                    waypoint = Waypoint(
                        lat=lat,
                        lon=lon,
                        timestamp=time_str[-12:-4] if len(time_str) > 12 else time_str,
                        speed=speed,
                        heading=heading
                    )

                    if mmsi not in vessels_dict:
                        is_msc = "TASMANIA" in name
                        vlength = 366.0 if is_msc else (240.0 if "Tanker" in vtype else 180.0)
                        vwidth = 51.2 if is_msc else (38.0 if "Tanker" in vtype else 28.0)
                        vdraught = 15.8 if is_msc else (12.5 if "Tanker" in vtype else 8.5)
                        vdest = "Singapore Port / Jurong" if is_msc else ("Singapore Anchorage" if speed < 2.0 else "Jurong Port")
                        vcargo = "Containerized Dangerous Goods / Fuel" if is_msc else ("Crude Oil / Bitumen" if "Tanker" in vtype else "General Cargo")

                        vessels_dict[mmsi] = Vessel(
                            name=name,
                            mmsi=mmsi,
                            imo="9839911" if is_msc else (mmsi[:7] if len(mmsi) >= 7 else None),
                            flag=flag,
                            type=vtype,
                            lat=lat,
                            lon=lon,
                            speed=speed,
                            heading=heading,
                            length=vlength,
                            width=vwidth,
                            draught=vdraught,
                            destination=vdest,
                            status="Underway Using Engine" if speed > 0.5 else "At Anchor",
                            cargo_type=vcargo,
                            anomaly_score=raw_anomaly_score,
                            is_anomaly=is_anomaly,
                            is_prime_suspect=False,
                            attribution_score=0.0,
                            route=[waypoint]
                        )
                    else:
                        # Append waypoint to existing vessel track
                        vessels_dict[mmsi].route.append(waypoint)
                        # Update latest position
                        vessels_dict[mmsi].lat = lat
                        vessels_dict[mmsi].lon = lon
                        vessels_dict[mmsi].speed = speed
                        vessels_dict[mmsi].heading = heading

                if vessels_dict:
                    return list(vessels_dict.values())
            except Exception as e:
                print(f"Error loading {path}: {e}")

    # Fallback default
    return []


def get_default_vessels() -> List[Vessel]:
    # Never insert demonstration vessels when a real AIS source is absent.
    return load_real_ais_dataset()
