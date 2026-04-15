# AquaNex Smart Irrigation Platform

AquaNex is an advanced, AI-driven smart irrigation and water management platform designed for large-scale agricultural and industrial workspaces. It integrates real-time IoT telemetry, machine learning for anomaly detection, and comprehensive workspace management to optimize water usage and detect infrastructure failures like leaks and pipe breakages.

## Access Links
The official production version is available at: [https://aquanex.app](https://aquanex.app)

Youtube product demo video link: https://youtu.be/lELn8OGBGAc

---

## 🛠 Project Logic & Architecture

AquaNex is built on a distributed microservices architecture:

1.  **Frontend (React/TypeScript):** A modern, responsive dashboard for workspace visualization, real-time monitoring, and data analytics.
2.  **Backend (Django/DRF):** The core business logic, handling authentication, workspace management, user onboarding, and incident tracking.
3.  **ML API (FastAPI):** A specialized service that processes high-frequency sensor data (flow/pressure) via MQTT and uses both rule-based logic and XGBoost models to detect anomalies.
4.  **IoT System:** Includes MQTT-based simulators and handlers for real-time telemetry ingestion from field devices.
5.  **Task Orchestration:** Uses Celery and Redis for background processing, such as processing large workspace layout uploads and automated reports.

---

## ✨ Key Features

-   **Multi-Workspace Management:** Create and manage multiple farms or industrial sites under a single account.
-   **Interactive Map Visualization:** Geofencing and layout definition using Leaflet. Visualize pipelines, sensors, and field devices on an interactive map.
-   **Real-Time Monitoring:** Live telemetry stream for flow rates, pressure, and soil salinity/moisture.
-   **AI Anomaly Detection:** Automated detection of pipe breakages and leakages using a combination of hydraulic rules and Machine Learning.----0-09

-   **Incident Management:** Automated incident logging, severity assessment, and recovery tracking.
-   **Demand Forecasting:** Predict water requirements based on crop types, soil conditions, and system efficiency.
-   **User Onboarding:** A streamlined process for setting up organizations, inviting team members, and configuring IoT gateways/devices.

---

## 🔐 Authentication & Security

-   **JWT-Based Auth:** Secure token-based authentication (Access & Refresh tokens).
-   **Google OAuth:** Support for seamless Social Login.
-   **Role-Based Access:** Support for Owners, Technicians, and Customers with varying permission levels.
-   **Secure API:** Internal communication between services is protected via internal tokens.

---

## 📋 Onboarding Process

1.  **Organization Setup:** Define company name, location, and industry type.
2.  **Module Selection:** Choose specific features (Pipeline Monitoring, Soil Analysis, etc.).
3.  **Gateway Configuration:** Connect your IoT Gateway ID.
4.  **Device Setup:** Map physical sensors to the digital workspace.
5.  **Layout Definition:** Upload a site map or draw your field boundaries directly on the interactive map.

---

## 💻 Local Development

### Prerequisites
-   Node.js 20+
-   Python 3.10+
-   PostgreSQL
-   Redis (for Celery)
-   MQTT Broker (e.g., Mosquitto)

### Installation

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/your-repo/Project-AquaNex.git
    cd Project-AquaNex
    ```

2.  **Frontend Setup:**
    ```bash
    cd aquanex/src/Frontend
    npm install
    npm run dev
    ```

3.  **Backend Setup:**
    ```bash
    cd aquanex/src/Backend
    python -m venv venv
    source venv/bin/activate  # On Windows: venv\Scripts\activate
    pip install -r requirements.txt
    python manage.py migrate
    python manage.py runserver
    ```

4.  **ML API Setup:**
    ```bash
    cd aquanex/src/ML_Api
    python -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    uvicorn main:app --port 8001 --reload
    ```

For detailed instructions on each component, please refer to the specific READMEs:
-   [Frontend Documentation](./aquanex/src/Frontend/README.md)
-   [Backend Documentation](./aquanex/src/Backend/README.md)
-   [ML API Documentation](./aquanex/src/ML_Api/README.md)

---
## ⚙️ Web Platform Configuration

### Common Configurations

- The platform requires users to partake in entering information to be able to make full use of the features.
- For the IoT layer, we have configured sample devices on the thingsboard IoT platform. The devices are connected to specific gateways that act as the bridge between the IoT layer and the AquaNex platform.

- Below are the gateway configurations users are required to enter in the scan devices field for each page, except the incidents analytics page:
  1. Pipelines Management: AQN-GW-001   
  2. Soil Salinity Console: AQN-GW-002   
  3. Water Quality Monitoring: WQ-GATEWAY-01  
  4. Water Demand Forecasting: AQN-GW-003   

#### NOTE: If the device registration does not work as expected, or it maybe displaying invalid coordinates, please use the 'rescan devices' option which is found at the beginning of the page.


### Page-specific Configuration

1. Pipeline registry: This action applies to the pipelines management and water quality monitoring pages, where the user is required to register a new pipeline based on specification documents, or select an existing pipeline depending on the workspace.
2. Plant data registry: This action applies only to the water demand forecasting page, where the user is required to enter details of a zone, a type of plant in that zone, and the number of plants. This is used as a demand forecasting metric.

---
Developed by **Technium**.

Developers: Israr, Saad, Bilal, Abrar and Atsushi.
