# AquaNex ML API

The AquaNex ML API is a high-performance FastAPI service dedicated to real-time anomaly detection in water infrastructure. It bridges the gap between raw IoT telemetry (via MQTT) and actionable insights.

## 🛠 Tech Stack

-   **Framework:** [FastAPI](https://fastapi.tiangolo.com/)
-   **Machine Learning:** Scikit-learn, XGBoost
-   **IoT Protocol:** MQTT ([Paho-MQTT](https://pypi.org/project/paho-mqtt/))
-   **Data Processing:** NumPy, Joblib
-   **Web Server:** Uvicorn
-   **Storage:** AWS S3 (for model weight synchronization)

---

## 🧠 Anomaly Detection Logic

The service uses a dual-layered approach to detect pipe breakages and leakages:

### 1. Rule-Based Engine
Calculates hydraulic deltas between upstream and downstream sensors:
-   **Flow Disparity:** Significant differences in flow rate between two points.
-   **Pressure Delta:** Unexpected drops in pressure relative to upstream values.
-   **Thresholds:** Uses configurable thresholds (`RULE_THRESHOLDS`) to classify events as `normal`, `leakage`, or `breakage`.

### 2. Machine Learning Model
An **XGBoost Classifier** trained on hydraulic simulation data provides a probability-based confidence score for each detected anomaly.
-   The model is loaded locally or synchronized from S3 on startup.
-   Features: Flow Delta, Pressure Delta, Flow Ratio, Pressure Ratio.

---

## 📡 Real-Time Telemetry Flow

1.  **Ingestion:** The service subscribes to MQTT topics (e.g., `aquanex/flowmeter/1`).
2.  **Buffering:** Telemetry is buffered until a complete "snapshot" of the infrastructure (Upstream vs. Downstream) is available.
3.  **Inference:** Once a snapshot is ready, it's passed through the Rule/ML engines.
4.  **Reporting:** If an anomaly is detected (`is_anomaly: true`), it is automatically reported to the Django Backend via the `/api/incidents/ingest/` endpoint.

---

## 🚀 Getting Started

### Installation

1.  **Set up Virtual Environment:**
    ```bash
    python -m venv venv
    source venv/bin/activate
    ```

2.  **Install Dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

3.  **Run Service:**
    ```bash
    uvicorn main:app --port 8001 --reload
    ```

### Environment Variables
-   `MQTT_BROKER`: Address of the MQTT broker (default: `localhost`).
-   `DJANGO_BACKEND_URL`: URL of the Django service.
-   `DJANGO_INTERNAL_TOKEN`: Shared secret for backend communication.
-   `MODEL_BUCKET` / `AWS_S3_ENDPOINT_URL`: For S3 model synchronization.

---

## 📂 Key Endpoints

-   `GET /health`: Service health and model status.
-   `GET /live-data`: Returns the latest sensor readings and current prediction.
-   `POST /telemetry/ingest`: Manual ingestion endpoint for gateway telemetry.
-   `POST /predict`: Testing endpoint for manual prediction snapshots.
