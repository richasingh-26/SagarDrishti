import numpy as np
from typing import List
from sklearn.ensemble import IsolationForest
from schemas import Vessel


def analyze_vessel_anomalies(vessels: List[Vessel]) -> List[Vessel]:
    if not vessels:
        return []

    # Features for anomaly detection: speed, heading variation, route length, speed variance
    features = []
    for v in vessels:
        speeds = [w.speed for w in v.route if w.speed is not None] if v.route else [v.speed]
        headings = [w.heading for w in v.route if w.heading is not None] if v.route else [v.heading]
        
        avg_spd = float(np.mean(speeds)) if speeds else v.speed
        std_spd = float(np.std(speeds)) if len(speeds) > 1 else 0.0
        std_hdg = float(np.std(headings)) if len(headings) > 1 else 0.0
        route_len = len(v.route)

        features.append([v.speed, avg_spd, std_spd, std_hdg, route_len])

    X = np.array(features)

    # Use Isolation Forest if enough vessels, otherwise kinematic heuristics
    if len(vessels) >= 4:
        try:
            iso = IsolationForest(contamination=0.25, random_state=42)
            preds = iso.fit_predict(X)  # -1 for anomaly, 1 for normal
            # decision_function is signed: negative values are Isolation Forest
            # anomalies.  Keep that real score rather than converting it to a UI
            # risk percentage so downstream selection can use its actual meaning.
            norm_scores = iso.decision_function(X)
        except Exception:
            norm_scores = np.zeros(len(vessels))
            preds = np.ones(len(vessels))
    else:
        norm_scores = np.zeros(len(vessels))
        preds = np.ones(len(vessels))

    # Apply kinematic checks
    for idx, v in enumerate(vessels):
        score = float(norm_scores[idx]) if len(norm_scores) > idx else 0.0

        # Preserve signed semantics for heuristic anomalies too.
        if 0.1 <= v.speed <= 3.5 and "tanker" in v.type.lower():
            score = min(score, -0.25)
        speeds = [w.speed for w in v.route if w.speed is not None]
        if speeds and np.std(speeds) > 4.0:
            score = min(score, -0.18)
        if "tanker" in v.type.lower() and v.speed < 2.0:
            score = min(score, -0.3)

        v.anomaly_score = round(score, 4)
        v.is_anomaly = v.anomaly_score < -0.1

    return vessels
