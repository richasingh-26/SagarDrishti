# SagarDrishti Backend

A high-performance FastAPI backend for Maritime Intelligence, AIS Vessel Tracking, ML Anomaly Detection, and SAR Oil Spill Detection.

---

## 🚀 Running Locally

```bash
cd backend
python -m uvicorn main:app --reload --port 8000
```
Interactive Swagger Documentation will be available at: **http://127.0.0.1:8000/docs**

---

## 🌐 Running in Google Colab

To run this backend in Google Colab with an ngrok tunnel:

```python
# Cell 1: Install dependencies
!pip install fastapi uvicorn pydantic python-multipart pyngrok pandas numpy shapely geopandas scipy scikit-learn opencv-python pillow

# Cell 2: Run FastAPI with ngrok
import nest_asyncio
import uvicorn
from pyngrok import ngrok

# Authenticate ngrok (get free token from ngrok.com)
ngrok.set_auth_token("YOUR_NGROK_AUTHTOKEN")

# Open HTTP tunnel on port 8000
public_url = ngrok.connect(8000).public_url
print("🚀 SagarDrishti Backend Tunnel URL:", public_url)

# Copy the generated public_url and set it in SagarDrishti Settings or api.ts!

# Start server
from main import app
nest_asyncio.apply()
uvicorn.run(app, host="0.0.0.0", port=8000)
```

---

## 📡 Key Endpoints

- `GET /api/health` - Check backend and ML status
- `GET /api/vessels` - Get list of vessels with trajectories and anomaly scores
- `POST /api/vessels/upload` - Upload custom AIS CSV or JSON dataset
- `POST /api/vessels/add` - Add single vessel & route waypoints
- `GET /api/prime-suspect` - Prime suspect calculation based on spill proximity & AIS history
- `POST /api/detect` - SAR Image oil spill detection
- `POST /api/simulate` - Hydrodynamic oil slick drift simulation
- `POST /api/origin-reconstruction` - Spill origin reconstruction & vessel attribution
