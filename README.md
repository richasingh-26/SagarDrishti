# SagarDrishti: Multimodal AI Maritime Oil Spill Forensics

**Hacktoberfest Hack Day Chandigarh 2026 Submission**
**Track: Best Use of Gemma 4**

## Table of Contents
1. [The Problem Statement](#1-the-problem-statement)
2. [The Core Idea: Beyond Proximity](#2-the-core-idea-beyond-proximity)
3. [Deep Research: The ₹5.1 Crore Failure & Flaws in Legacy Systems](#3-deep-research-the-51-crore-failure--flaws-in-legacy-systems)
4. [Competitor Analysis](#4-competitor-analysis)
5. [Best Use of Gemma 4: The Autonomous Agent](#5-best-use-of-gemma-4-the-autonomous-agent)
6. [System Architecture & Tech Stack](#6-system-architecture--tech-stack)
7. [Installation & Setup](#7-installation--setup)
8. [Team ByteSquad](#8-team-bytesquad)

---

## 1. The Problem Statement
The National Technical Research Organisation (NTRO) faces a critical maritime security challenge: **up to 90% of oil spills are never attributed to a responsible vessel.** 

When a satellite detects a slick, authorities must identify the culprit. However, the ocean is dynamic. Wind and currents move the oil for hours or days before detection. Current forensic methods rely on manual investigation or simple "proximity matching" (finding the ship closest to the spill at the time of detection). This approach is scientifically flawed. It ignores ocean drift physics, resulting in weak circumstantial evidence that is easily contested in court, allowing polluters to escape accountability.

## 2. The Core Idea: Beyond Proximity
**SagarDrishti** (Sanskrit for "Ocean Vision") is an open-source, AI-powered maritime forensics platform built to provide legally defensible evidence.

Instead of asking *"Who is closest to the spill?"*, SagarDrishti asks *"Whose spill trajectory perfectly matches the crime scene?"* 

We built a **5-Factor Physics Engine** that evaluates every vessel in a 10,000-ship dataset based on:
1. **Corridor Proximity:** How close was the ship to the origin point?
2. **Temporal Match:** Was the ship there at the exact time of the release?
3. **Route Fit:** Does the ship's trajectory align with the ocean currents?
4. **Simulation IoU:** We simulate a spill from the ship's location using real-time wind and current data, then calculate the Intersection over Union (IoU) against the actual satellite spill.
5. **Behavioral Anomaly:** Did the ship exhibit suspicious AIS transponder gaps or erratic speed changes?

To make this complex physics data accessible, we integrated **Google's Gemma 4** as a multimodal vision agent to analyze the raw radar imagery and generate human-readable forensic reports.

## 3. Deep Research: The ₹5.1 Crore Failure & Flaws in Legacy Systems

We conducted deep research into why previous government and commercial attempts to solve maritime and environmental visibility issues failed.

### The ₹5.1 Crore CSIR-CIMFR Failure
A previous major initiative was the **CSIR-CIMFR "Vision Enhancement System"** (funded by MeitY). 
- **The Cost:** Over **₹5.1 Crore** was spent.
- **The Flaw:** The system focused on **vision enhancement** (helping operators see better through fog). However, helping a human *see* a spill does not tell you *which* ship caused it. It failed to address the core physics of attribution. 

### The Flaw in Legacy Oil Spill Systems
Earlier oil spill systems relied entirely on **Visual/SAR Thresholding** (looking for dark patches) and **Proximity Matching**. As maritime legal research notes, *"Proximity alone is circumstantial and legally weak."* Furthermore, if a ship turns off its AIS transponder (a common tactic for illegal dumping), legacy systems cannot attribute the spill. 

**Our Mission:** We abandoned legacy vision enhancement. SagarDrishti focuses on **physics-based attribution** and **multimodal AI** to provide court-defensible evidence.

## 4. Competitor Analysis
Most open-source and commercial solutions (like SkyTruth Cerulean) rely on static data or simple distance calculations. Here is how SagarDrishti outperforms them.

| Feature | Legacy Systems (e.g., SkyTruth) | **SagarDrishti (Our Solution)** |
| :--- | :--- | :--- |
| **Attribution** | Proximity-based (closest ship). | **5-Factor Physics Engine** (Proximity, Time, Route, Behavior, Simulation). |
| **Drift Tracking** | Basic linear tracking or none. | **Fay Spreading Law** + Haversine physics to simulate oil movement. |
| **Behavior Analysis**| Basic AIS tracking. | **Isolation Forest ML** detects anomalous AIS gaps and speed changes. |
| **Explainability** | Black Box / No explanation. | **Gemma 4 Multimodal Agent** writes human-readable forensic dossiers. |
| **Evidence Strength**| Circumstantial (was nearby). | **Physics-based** (Simulated spill matches actual satellite spill). |

**Our Novel Innovation:** The **Simulation IoU (Intersection over Union)**. We take a ship's position, simulate a spill using real wind and current vectors, and calculate the physical overlap with the real satellite-detected spill. This is mathematically sound, legal-grade evidence.

## 5. Best Use of Gemma 4: The Autonomous Agent
For the Hacktoberfest "Best Use of Gemma 4" track, we integrated Google's **Gemma 4 (26B A4B)** via the new `google-genai` SDK as an **Autonomous Multimodal Forensic Agent**.

### How We Used Gemma 4:
1. **Multimodal Vision Reasoning:** Raw Sentinel-1 SAR (Synthetic Aperture Radar) imagery is noisy and impossible for a human to read without specialized training. We send the raw image bytes directly to Gemma 4. The model *visually analyzes* the radar data, identifies the oil slick, and assesses severity.
2. **Bridging Physics and Humans:** Our backend calculates complex physics (drift vectors, IoU scores, Isolation Forest anomalies). Gemma 4 ingests this raw numerical data and generates a structured, human-readable **Forensic Dossier** recommending immediate containment actions for the Coast Guard.
3. **Native SDK Integration:** We utilized the latest `google-genai` SDK and the `gemma-4-26b-a4b-it` model, ensuring our application is at the absolute forefront of Google's open-weights AI ecosystem.

## 6. System Architecture & Tech Stack

**Frontend (The Command Center)**
- **React + Vite + TypeScript:** Fast, responsive UI.
- **Tailwind CSS:** Dark-mode maritime command aesthetic.
- **MapLibre GL:** Renders the tactical map and plots 10,000+ vessels.

**Backend (The Brain)**
- **FastAPI + Uvicorn:** High-performance Python API routing.
- **PyTorch (U-Net++):** Deep learning model for pixel-level spill segmentation on SAR imagery.
- **Scikit-Learn (Isolation Forest):** ML model to detect anomalous vessel behavior.
- **Google GenAI SDK:** Direct connection to Gemma 4.

**Data Sources**
- **Sentinel-1 SAR:** Real satellite radar imagery (Copernicus Open Access Hub).
- **10,000-Vessel AIS Dataset:** Massive historical dataset for fleet intelligence.
- **Copernicus & ERA5:** Real ocean current and wind data driving our physics engine.

## 7. Installation & Setup

**Prerequisites:** Python 3.10+, Node.js 18+, Google AI Studio API Key.

**Backend Setup:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
pip install google-genai python-multipart
