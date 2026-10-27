# SagarDrishti (सागर दृष्टि)

> **Next-Generation Maritime Oil Spill Intelligence & Dark Vessel Attribution Platform**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Vite](https://img.shields.io/badge/Frontend-Vite%20%2B%20React-646CFF?logo=vite)](https://vitejs.dev/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![PyTorch](https://img.shields.io/badge/Deep%20Learning-PyTorch-EE4C2C?logo=pytorch)](https://pytorch.org/)

---

## 🌊 Overview

**SagarDrishti** is an advanced AI/ML-driven maritime surveillance and intelligence dashboard. It delivers automated satellite SAR (Synthetic Aperture Radar) oil spill detection, reverse drift trajectory modeling, kinematic anomaly detection, and probabilistic dark-vessel attribution across high-density maritime corridors.

### 🌟 Key Features

- **Automated SAR Oil Spill Detection**: Deep-learning semantic segmentation using a fine-tuned **U-Net++ (ResNet-34 backbone)** detecting oil slicks from Sentinel-1 SAR imagery.
- **Vessel Tracking & AIS Integration**: Tracks 10,000+ real-time and historical AIS vessel feeds across high-traffic shipping lanes (e.g., Singapore Strait).
- **Kinematic & Behavioral Anomaly Detection**: Unsupervised **Isolation Forest** modeling to detect abnormal speed drops, heading variations, and loitering behaviors indicative of illegal bilge discharges.
- **Reverse Drift & Origin Reconstruction**: Backward Lagrangian hydrodynamic simulation driven by Copernicus ocean currents and marine wind fields to calculate the origin point and discharge time window.
- **Probabilistic Suspect Attribution**: Multi-factor scoring engine assessing spatiotemporal corridor proximity, route intersection, vessel cargo risk profiles, and kinematic anomalies to identify and rank candidate vessels.
- **Tactical 2D/3D Visualization**: Interactive MapLibre GL radar tracking views, tactical nautical charts, and Three.js 3D sea views.

---

## 🛠️ Architecture & Tech Stack

### Frontend
- **Framework**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS, Framer Motion
- **Maps & 3D**: MapLibre GL, Three.js, React Three Fiber
- **Charts & UI**: Recharts, Lucide Icons

### Backend & Machine Learning
- **Framework**: FastAPI, Uvicorn
- **Deep Learning**: PyTorch, Segmentation Models PyTorch (SMP U-Net++)
- **Machine Learning**: Scikit-Learn (Isolation Forest), SciPy, NumPy, OpenCV
- **Data Formats**: GeoTIFF (Sentinel-1 SAR), NetCDF (Copernicus currents/winds), AIS JSON/CSV

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- Python 3.10+
- Git

### 1. Clone & Setup Frontend
```bash
git clone https://github.com/richasingh-26/SagarDrishti.git
cd SagarDrishti
npm install
npm run dev
```
Frontend will be accessible at: `http://localhost:5173` (or `http://localhost:5174`)

### 2. Setup & Launch Backend
```bash
# In a separate terminal
python backend/main.py --port 8001
```
The FastAPI backend will start on: `http://127.0.0.1:8001`
Interactive Swagger Docs: `http://127.0.0.1:8001/docs`

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
