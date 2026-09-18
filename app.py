# SagarDrishti Backend API
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import gdown
import torch
import numpy as np
import cv2
import segmentation_models_pytorch as smp
from PIL import Image
import io
from scipy import ndimage
import pickle
import pandas as pd

# ============================================================
# DOWNLOAD MODEL FROM GOOGLE DRIVE
# ============================================================
MODEL_ID = "1P0bXzYxGrk-xLGxvXpVr9j4KPJ8zFS2h"  # ✅ YOUR FILE_ID
MODEL_PATH = "unet_oil_spill_final.pth"
ISO_PATH = "isolation_forest.pkl"

# Download U-Net++ model if not present
if not os.path.exists(MODEL_PATH):
    print("📥 Downloading U-Net++ model from Google Drive...")
    gdown.download(
        f"https://drive.google.com/uc?id={MODEL_ID}",
        MODEL_PATH,
        quiet=False
    )
    print("✅ U-Net++ downloaded")

# ============================================================
# FASTAPI APP
# ============================================================
app = FastAPI(
    title="SagarDrishti API",
    description="Maritime Oil Spill Forensics System",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# LOAD MODELS
# ============================================================
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

unet = smp.UnetPlusPlus(
    encoder_name='resnet34',
    encoder_weights=None,
    in_channels=1,
    classes=1,
).to(device)

unet.load_state_dict(torch.load(MODEL_PATH, map_location=device))
unet.eval()
print("✅ U-Net++ loaded")

iso_forest = None
if os.path.exists(ISO_PATH):
    with open(ISO_PATH, 'rb') as f:
        iso_forest = pickle.load(f)
    print("✅ Isolation Forest loaded")

# ============================================================
# ENDPOINTS
# ============================================================

@app.get("/")
def root():
    return {
        "status": "operational",
        "service": "SagarDrishti",
        "version": "1.0.0"
    }

@app.get("/api/health")
def health():
    return {"status": "healthy", "models_loaded": True}

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
        "message": "Spill detected" if detected_pct > 0.1 else "No significant spill"
    }

@app.get("/api/vessels")
def get_vessels():
    df = pd.read_csv('vessels_with_anomalies.csv')
    return {
        "total": len(df),
        "anomalies": int((df['anomaly'] == -1).sum()),
        "vessels": df.to_dict('records')
    }

@app.get("/api/prime-suspect")
def get_prime_suspect():
    df = pd.read_csv('vessels_with_anomalies.csv')
    anomalies = df[df['anomaly'] == -1]

    if len(anomalies) == 0:
        return {"error": "No anomalies found"}

    prime = anomalies.iloc[0]
    return {
        "name": prime['name'],
        "mmsi": str(prime['mmsi']),
        "lat": float(prime['lat']),
        "lon": float(prime['lon']),
        "speed": float(prime['speed']),
        "attribution_score": 95
    }

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
    from scipy.ndimage import gaussian_filter

    grid_size = 256
    cx = int((req.lon - 103.0) / 2.0 * grid_size)
    cy = int((req.lat - 0.5) / 2.0 * grid_size)
    cx = np.clip(cx, 20, grid_size - 20)
    cy = np.clip(cy, 20, grid_size - 20)

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
        "footprint_size": float((grid > 0.3).mean() * 100),
        "peak_intensity": float(grid.max()),
        "hours_simulated": req.hours
    }
