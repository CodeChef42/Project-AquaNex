# AquaNex Backend

The AquaNex Backend is a robust Django-based service that powers the core business logic, data persistence, and orchestration for the AquaNex platform. It manages complex relationships between users, workspaces, IoT devices, and real-time incidents.

## 🛠 Tech Stack

-   **Framework:** [Django 5.0](https://www.djangoproject.com/)
-   **API:** [Django REST Framework (DRF)](https://www.django-rest-framework.org/)
-   **Database:** PostgreSQL
-   **Task Queue:** [Celery](https://docs.celeryq.dev/) with **Redis** broker
-   **Auth:** [SimpleJWT](https://django-rest-framework-simplejwt.readthedocs.io/)
-   **Cloud Integration:** AWS S3 / Boto3 for file storage (layout uploads)
-   **Web Server:** Gunicorn / Uvicorn (ASGI support)

---

## 🏗 Data Model Highlights

-   **User & Workspace:** Custom User model supporting multi-tenancy through `Workspace`.
-   **IoT Infrastructure:** Models for `Gateway`, `Microcontroller`, and `FieldDevice` with hierarchical relationships.
-   **Hydraulic Assets:** `Pipe` and `PipeSpecification` models for detailed infrastructure mapping.
-   **Telemetry:** `DeviceReading` (historical) and `DeviceReadingLatest` (unlogged table/fast access) for sensor data.
-   **Incident Tracking:** `Incident` model for logging AI-detected anomalies with status lifecycle management.

---

## ⚙️ Core Services

### 1. REST API
Provides endpoints for:
-   User authentication and profile management.
-   Workspace onboarding and configuration.
-   Device and sensor metadata management.
-   Incident reporting and resolution.
-   Historical telemetry retrieval for charts.

### 2. Background Processing (Celery)
Handles long-running tasks:
-   **Layout Processing:** Extracting data from uploaded CAD/PDF files for workspace layouts.
-   **Telemetry Aggregation:** Summarizing sensor data for long-term analytics.
-   **Automated Notifications:** Sending alerts based on detected incidents.

### 3. Incident Ingestion
A specialized endpoint (`/api/incidents/ingest/`) receives anomaly reports from the ML API, creates/updates `Incident` records, and triggers alerts.

---

## 🚀 Getting Started

### Prerequisites
-   Python 3.10+
-   PostgreSQL
-   Redis

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

3.  **Environment Configuration:**
    Create a `.env` file based on the project requirements (DB credentials, Secret Key, Redis URL, S3 credentials).

4.  **Database Migration:**
    ```bash
    python manage.py migrate
    ```

5.  **Run Server:**
    ```bash
    python manage.py runserver
    ```

6.  **Start Celery Worker:**
    ```bash
    celery -A apps.backend worker --loglevel=info
    ```

---

## 📂 Project Structure
-   `apps/core`: Main application logic and database models.
-   `apps/backend`: Project configuration (settings, URLs, WSGI/ASGI).
-   `manage.py`: Django's command-line utility.
-   `run_server.sh` / `run_worker.sh`: Utility scripts for deployment.
