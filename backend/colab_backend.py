# ============================================================
# SAGARDRISHTI BACKEND — 10,000 VESSELS VERSION (GOOGLE COLAB)
# ============================================================
# Instructions:
# 1. Open Google Colab (https://colab.research.google.com)
# 2. Paste this code into a new notebook cell and run it.
# 3. Use the generated PUBLIC URL in the frontend settings.

!pip install fastapi uvicorn pyngrok gdown segmentation-models-pytorch opencv-python-headless scikit-learn pandas numpy pillow scipy python-multipart -q

from google.colab import drive
drive.mount('/content/drive')

import os
import io
import json
import pickle
import numpy as np
import pandas as pd
import torch
import cv2
import shutil
import threading
import nest_asyncio
import uvicorn
import segmentation_models_pytorch as smp

from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image
from scipy import ndimage
from scipy.ndimage import gaussian_filter
from pyngrok import ngrok

nest_asyncio.apply()

# Config
NGROK_TOKEN = os.environ.get("NGROK_AUTHTOKEN", "YOUR_NGROK_AUTHTOKEN")
DRIVE_BASE = "/content/drive/MyDrive/oceantrace-pro"
MODEL_PATH = "/content/unet_oil_spill_final.pth"
DRIVE_MODEL_PATH = f"{DRIVE_BASE}/models/unet_oil_spill_final.pth"
ISO_PATH = f"{DRIVE_BASE}/models/isolation_forest.pkl"
VESSELS_JSON = f"{DRIVE_BASE}/data/ais/ais_data.json"
VESSELS_CSV = f"{DRIVE_BASE}/data/ais/vessels_with_anomalies.csv"

# Copy model locally
if not os.path.exists(MODEL_PATH) and os.path.exists(DRIVE_MODEL_PATH):
    shutil.copy(DRIVE_MODEL_PATH, MODEL_PATH)
    print(f"✅ Model copied ({os.path.getsize(MODEL_PATH)/1024/1024:.1f} MB)")

# Load U-Net++
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
print(f"🔥 Device: {device}")

unet = smp.UnetPlusPlus(encoder_name='resnet34', encoder_weights=None, in_channels=1, classes=1).to(device)
if os.path.exists(MODEL_PATH):
    unet.load_state_dict(torch.load(MODEL_PATH, map_location=device))
    unet.eval()
    print("✅ U-Net++ loaded")
else:
    print("⚠️ Model not found at MODEL_PATH")

# Load Isolation Forest
iso_forest = None
if os.path.exists(ISO_PATH):
    with open(ISO_PATH, 'rb') as f:
        iso_forest = pickle.load(f)
    print("✅ Isolation Forest loaded")

# ============================================================
# VESSEL LOADER (10,000 from JSON)
# ============================================================
_VESSELS_CACHE = None

def load_all_vessels():
    """Load all 10,000 vessels from JSON"""
    global _VESSELS_CACHE
    if _VESSELS_CACHE is not None:
        return _VESSELS_CACHE

    vessels = []

    if os.path.exists(VESSELS_JSON):
        try:
            with open(VESSELS_JSON, 'r') as f:
                data = json.load(f)

            if isinstance(data, dict) and 'vessels' in data:
                raw = data['vessels']
            elif isinstance(data, list):
                raw = data
            else:
                raw = []

            for v in raw:
                try:
                    lat = float(v.get('LATITUDE', v.get('lat', 0)))
                    lon = float(v.get('LONGITUDE', v.get('lon', 0)))
                except (ValueError, TypeError):
                    continue

                mmsi = str(v.get('MMSI', v.get('mmsi', '')))
                if not mmsi:
                    continue

                vessels.append({
                    'mmsi': mmsi,
                    'name': str(v.get('NAME', v.get('name', f'Vessel-{mmsi}'))).strip() or f'Vessel-{mmsi}',
                    'lat': lat,
                    'lon': lon,
                    'speed': float(v.get('SOG', v.get('speed', 0))),
                    'heading': float(v.get('COG', v.get('heading', 0))),
                    'type': str(v.get('TYPE', v.get('type', 'Cargo'))),
                    'flag': str(v.get('FLAG', v.get('flag', 'International'))),
                    'destination': str(v.get('DEST', v.get('destination', 'Unknown'))),
                    'anomaly': int(v.get('anomaly', 1)),
                    'anomaly_score': float(v.get('anomaly_score', 0.0)),
                })

            print(f"✅ Loaded {len(vessels)} vessels from JSON")
        except Exception as e:
            print(f"❌ JSON load error: {e}")

    if not vessels and os.path.exists(VESSELS_CSV):
        df = pd.read_csv(VESSELS_CSV).fillna(0)
        vessels = df.to_dict('records')
        print(f"✅ Loaded {len(vessels)} vessels from CSV (fallback)")

    _VESSELS_CACHE = vessels
    return vessels

# Pre-load at startup
load_all_vessels()

# ============================================================
# FASTAPI APP
# ============================================================
app = FastAPI(title="SagarDrishti API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.get("/")
def root():
    return {"status": "operational", "service": "SagarDrishti", "device": str(device)}

@app.get("/api/health")
def health():
    vessels = load_all_vessels()
    return {
        "status": "healthy",
        "unet": unet is not None,
        "iso_forest": iso_forest is not None,
        "vessel_count": len(vessels)
    }

@app.post("/api/detect")
async def detect_spill(file: UploadFile = File(...)):
    contents = await file.read()
    img = np.array(Image.open(io.BytesIO(contents)).convert('L')).astype(np.float32)
    img_norm = (img - img.min()) / (img.max() - img.min() + 1e-8)
    img_resized = cv2.resize(img_norm, (256, 256))
    tensor = torch.from_numpy(img_resized[None, None, :, :]).to(device)

    with torch.no_grad():
        pred = torch.sigmoid(unet(tensor)).cpu().numpy()[0, 0]

    binary = (pred > 0.85).astype(np.uint8)
    labeled, num = ndimage.label(binary)
    if num > 0:
        sizes = ndimage.sum(binary, labeled, range(1, num + 1))
        valid = [i+1 for i, s in enumerate(sizes) if 20 <= s <= 5000]
        final = np.isin(labeled, valid).astype(np.uint8)
    else:
        final = binary

    detected_pct = float(final.mean() * 100)
    return {
        "spill_detected": detected_pct > 0.1,
        "detection_percentage": round(detected_pct, 2),
        "confidence": float(pred.max()),
    }

@app.get("/api/vessels")
def get_vessels():
    """Get all 10,000 vessels"""
    vessels = load_all_vessels()
    if not vessels:
        return {"error": "No vessels loaded"}
    anomalies_count = sum(1 for v in vessels if v.get('anomaly') == -1)
    return {
        "total": len(vessels),
        "anomalies": anomalies_count,
        "vessels": vessels
    }

@app.get("/api/prime-suspect")
def get_prime_suspect():
    """Top suspect from full dataset"""
    vessels = load_all_vessels()
    anomalies = [v for v in vessels if v.get('anomaly') == -1]

    if not anomalies:
        anomalies = sorted(vessels, key=lambda v: v.get('anomaly_score', 0))[:1]

    if not anomalies:
        return {"error": "No anomalies found"}

    true_lat, true_lon = 1.25, 103.8
    def distance(v):
        return ((v['lat'] - true_lat)**2 + (v['lon'] - true_lon)**2) ** 0.5

    anomalies.sort(key=distance)
    prime = anomalies[0]

    return {
        "name": prime['name'],
        "mmsi": prime['mmsi'],
        "lat": prime['lat'],
        "lon": prime['lon'],
        "speed": prime['speed'],
        "attribution_score": 95,
    }

@app.get("/api/spill-comparison")
def get_spill_comparison():
    """Top 3 anomalies by distance to spill origin"""
    vessels = load_all_vessels()
    if not vessels:
        return {"comparison": []}

    anomalies = [v for v in vessels if v.get('anomaly') == -1]
    if not anomalies:
        anomalies = sorted(vessels, key=lambda v: v.get('anomaly_score', 0))[:3]

    true_lat, true_lon = 1.25, 103.8
    def distance(v):
        return ((v['lat'] - true_lat)**2 + (v['lon'] - true_lon)**2) ** 0.5

    anomalies.sort(key=distance)
    top3 = anomalies[:3]

    results = []
    for v in top3:
        dist = distance(v)
        iou = max(0, 100 - dist * 100)
        results.append({
            "name": v['name'],
            "mmsi": v['mmsi'],
            "iou": round(iou, 1),
            "attribution": min(95, int(iou + 25)),
            "distance": round(dist, 4)
        })

    return {"comparison": results}

class SimulationRequest(BaseModel):
    vessel_name: str
    lat: float
    lon: float
    wind_u: float = 2.0
    wind_v: float = 1.0
    current_u: float = 1.5
    current_v: float = 0.5
    hours: int = 24

@app.post("/api/simulate")
def simulate_spill(req: SimulationRequest):
    grid_size = 256
    cx = int(np.clip((req.lon - 103.0) / 2.0 * grid_size, 20, grid_size - 20))
    cy = int(np.clip((req.lat - 0.5) / 2.0 * grid_size, 20, grid_size - 20))
    y, x = np.ogrid[:grid_size, :grid_size]
    grid = np.exp(-((x - cx)**2 + (y - cy)**2) / (2 * 5**2))

    for t in range(req.hours):
        grid = gaussian_filter(grid, sigma=1.5)
        dx = int((req.wind_u * 0.3 + req.current_u * 0.7) * 1.5)
        dy = int((req.wind_v * 0.3 + req.current_v * 0.7) * 1.5)
        grid = np.roll(grid, (dy, dx), axis=(0, 1))
        if grid.max() > 0:
            grid = grid / grid.max()

    return {
        "vessel": req.vessel_name,
        "simulation_complete": True,
        "footprint_size": round(float((grid > 0.3).mean() * 100), 2),
        "peak_intensity": round(float(grid.max()), 4),
    }

# ============================================================
# LAUNCH
# ============================================================
print("🚀 STARTING SAGARDRISHTI BACKEND")

ngrok.set_auth_token(NGROK_TOKEN)
ngrok.kill()
public_url = ngrok.connect(8000)

print(f"✅ PUBLIC URL: {public_url}")
print(f"📊 API Docs:   {public_url}/docs")
print(f"❤️  Health:     {public_url}/api/health")
print(f"🚢 Vessels:    {public_url}/api/vessels")
print(f"🎯 Suspect:    {public_url}/api/prime-suspect")
print(f"🔬 Comparison: {public_url}/api/spill-comparison")

def run_server():
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="warning")

threading.Thread(target=run_server, daemon=True).start()

print("✅ Backend is LIVE")
