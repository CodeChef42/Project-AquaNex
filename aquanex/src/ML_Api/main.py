import asyncio

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib
from healthping import start_health_ping


try:
    import numpy as np
except Exception:
    np = None
from pathlib import Path
import json
from datetime import datetime
import paho.mqtt.client as mqtt
import threading
import time
import re
import os
import tempfile
from typing import Any, Dict, List, Optional



app = FastAPI(title="AquaNex ML Service", version="1.0.0")



app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



# Global variables
model = None
mqtt_client = None
sensor_buffer = []  # Buffer to collect 4 readings
latest_sensor_data = {
    'flow_1': None,
    'pressure_1': None,
    'flow_2': None,
    'pressure_2': None
}
latest_prediction = None
last_prediction_time = 0
gateway_sensor_state: Dict[str, Dict[str, Optional[float]]] = {}
gateway_latest_prediction: Dict[str, Dict[str, Any]] = {}



# MQTT Configuration
MQTT_BROKER = "localhost"
MQTT_PORT = 1883
MQTT_TOPICS = [
    "aquanex/flowmeter/1",
    "aquanex/pressure/1",
    "aquanex/flowmeter/2",
    "aquanex/pressure/2"
]




class SensorData(BaseModel):
    flow_1: float
    pressure_1: float
    flow_2: float
    pressure_2: float




class PredictionResponse(BaseModel):
    is_anomaly: bool
    confidence: float
    event_type: str
    anomaly_type: Optional[str] = None
    severity: Optional[str] = None
    input_data: dict
    deltas: dict
    rule: dict
    ml: Optional[dict] = None
    timestamp: str




class LiveDataResponse(BaseModel):
    sensor_data: dict
    latest_prediction: dict = None


class TelemetryIngestRequest(BaseModel):
    gateway_id: str
    workspace_id: Optional[str] = None
    telemetry: List[Dict[str, Any]]
    devices: Optional[List[Dict[str, Any]]] = None




def calculate_deltas(flow_1, pressure_1, flow_2, pressure_2):
    """Calculate deltas between upstream and downstream sensors"""
    flow_delta = abs(flow_1 - flow_2)
    pressure_delta = abs(pressure_1 - pressure_2)
    flow_ratio = flow_2 / flow_1 if flow_1 > 0 else 0
    pressure_ratio = pressure_2 / pressure_1 if pressure_1 > 0 else 0
    
    return {
        'flow_delta': flow_delta,
        'pressure_delta': pressure_delta,
        'flow_ratio': flow_ratio,
        'pressure_ratio': pressure_ratio
    }


RULE_THRESHOLDS = {
    "breakage_disparity_ratio": float(os.environ.get("ML_BREAKAGE_DISPARITY_RATIO", "3.0")),
    "leakage_disparity_ratio": float(os.environ.get("ML_LEAKAGE_DISPARITY_RATIO", "1.5")),
    "breakage_relative_delta": float(os.environ.get("ML_BREAKAGE_RELATIVE_DELTA", "0.6")),
    "leakage_relative_delta": float(os.environ.get("ML_LEAKAGE_RELATIVE_DELTA", "0.25")),
    "breakage_flow_delta_abs": float(os.environ.get("ML_BREAKAGE_FLOW_DELTA_ABS", "50")),
    "leakage_flow_delta_abs": float(os.environ.get("ML_LEAKAGE_FLOW_DELTA_ABS", "20")),
    "breakage_pressure_delta_abs": float(os.environ.get("ML_BREAKAGE_PRESSURE_DELTA_ABS", "6")),
    "leakage_pressure_delta_abs": float(os.environ.get("ML_LEAKAGE_PRESSURE_DELTA_ABS", "2")),
}


def _disparity_ratio(a: float, b: float) -> float:
    top = max(abs(a), abs(b))
    bottom = max(min(abs(a), abs(b)), 1e-9)
    return float(top / bottom)


def _classify_by_rules(snapshot: Dict[str, float], deltas: Dict[str, float]) -> Dict[str, Any]:
    flow_1 = float(snapshot["flow_1"])
    flow_2 = float(snapshot["flow_2"])
    pressure_1 = float(snapshot["pressure_1"])
    pressure_2 = float(snapshot["pressure_2"])

    flow_delta = float(deltas.get("flow_delta") or 0.0)
    pressure_delta = float(deltas.get("pressure_delta") or 0.0)

    flow_disparity = _disparity_ratio(flow_1, flow_2)
    pressure_disparity = _disparity_ratio(pressure_1, pressure_2)
    flow_rel = flow_delta / max(max(abs(flow_1), abs(flow_2)), 1e-9)
    pressure_rel = pressure_delta / max(max(abs(pressure_1), abs(pressure_2)), 1e-9)

    reasons: List[str] = []
    thresholds = RULE_THRESHOLDS.copy()
    metrics = {
        "flow_disparity": flow_disparity,
        "pressure_disparity": pressure_disparity,
        "flow_relative_delta": flow_rel,
        "pressure_relative_delta": pressure_rel,
    }

    breakage = (
        flow_disparity >= thresholds["breakage_disparity_ratio"]
        or pressure_disparity >= thresholds["breakage_disparity_ratio"]
        or flow_rel >= thresholds["breakage_relative_delta"]
        or pressure_rel >= thresholds["breakage_relative_delta"]
        or flow_delta >= thresholds["breakage_flow_delta_abs"]
        or pressure_delta >= thresholds["breakage_pressure_delta_abs"]
    )
    leakage = (
        flow_disparity >= thresholds["leakage_disparity_ratio"]
        or pressure_disparity >= thresholds["leakage_disparity_ratio"]
        or flow_rel >= thresholds["leakage_relative_delta"]
        or pressure_rel >= thresholds["leakage_relative_delta"]
        or flow_delta >= thresholds["leakage_flow_delta_abs"]
        or pressure_delta >= thresholds["leakage_pressure_delta_abs"]
    )

    if breakage:
        if flow_delta >= thresholds["breakage_flow_delta_abs"]:
            reasons.append("flow_delta_abs")
        if pressure_delta >= thresholds["breakage_pressure_delta_abs"]:
            reasons.append("pressure_delta_abs")
        if flow_disparity >= thresholds["breakage_disparity_ratio"]:
            reasons.append("flow_disparity_ratio")
        if pressure_disparity >= thresholds["breakage_disparity_ratio"]:
            reasons.append("pressure_disparity_ratio")
        if flow_rel >= thresholds["breakage_relative_delta"]:
            reasons.append("flow_relative_delta")
        if pressure_rel >= thresholds["breakage_relative_delta"]:
            reasons.append("pressure_relative_delta")
        return {
            "event_type": "anomaly",
            "anomaly_type": "breakage",
            "severity": "high",
            "confidence": 0.95,
            "reasons": reasons,
            "thresholds": thresholds,
            "metrics": metrics,
        }

    if leakage:
        if flow_delta >= thresholds["leakage_flow_delta_abs"]:
            reasons.append("flow_delta_abs")
        if pressure_delta >= thresholds["leakage_pressure_delta_abs"]:
            reasons.append("pressure_delta_abs")
        if flow_disparity >= thresholds["leakage_disparity_ratio"]:
            reasons.append("flow_disparity_ratio")
        if pressure_disparity >= thresholds["leakage_disparity_ratio"]:
            reasons.append("pressure_disparity_ratio")
        if flow_rel >= thresholds["leakage_relative_delta"]:
            reasons.append("flow_relative_delta")
        if pressure_rel >= thresholds["leakage_relative_delta"]:
            reasons.append("pressure_relative_delta")
        return {
            "event_type": "anomaly",
            "anomaly_type": "leakage",
            "severity": "medium",
            "confidence": 0.8,
            "reasons": reasons,
            "thresholds": thresholds,
            "metrics": metrics,
        }

    return {
        "event_type": "normal",
        "anomaly_type": None,
        "severity": None,
        "confidence": 0.2,
        "reasons": [],
        "thresholds": thresholds,
        "metrics": metrics,
    }


def _safe_float(value):
    try:
        if value is None or value == "":
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _infer_metric_family(metric, device_type):
    metric_key = str(metric or "").strip().lower()
    if metric_key in {"q_m3h", "flow_lpm", "flow", "flow_rate"}:
        return "flow"
    if metric_key in {"pressure_bar", "pressure"}:
        return "pressure"

    type_key = str(device_type or "").strip().lower()
    if "flow" in type_key:
        return "flow"
    if "pressure" in type_key:
        return "pressure"
    return None


def _infer_sensor_index(*parts):
    for raw in parts:
        token = str(raw or "").strip().lower()
        if token in {"1", "upstream", "inlet", "source", "f1", "p1"}:
            return 1
        if token in {"2", "downstream", "outlet", "sink", "f2", "p2"}:
            return 2

    descriptor = " ".join(str(p or "") for p in parts).lower()
    if re.search(r"(^|[^0-9])(1|f1|p1|upstream|inlet)([^0-9]|$)", descriptor):
        return 1
    if re.search(r"(^|[^0-9])(2|f2|p2|downstream|outlet)([^0-9]|$)", descriptor):
        return 2
    return None


def _predict_from_snapshot(snapshot):
    deltas = calculate_deltas(
        snapshot["flow_1"],
        snapshot["pressure_1"],
        snapshot["flow_2"],
        snapshot["pressure_2"],
    )
    rule_result = _classify_by_rules(snapshot, deltas)

    ml_payload = None
    ml_is_anomaly = None
    ml_confidence = None
    if model is not None and np is not None:
        features = np.array([[
            deltas["flow_delta"],
            deltas["pressure_delta"],
            deltas["flow_ratio"],
            deltas["pressure_ratio"],
        ]])
        prediction = model.predict(features)[0]
        probability = model.predict_proba(features)[0]
        ml_is_anomaly = bool(prediction)
        ml_confidence = float(probability[int(prediction)])
        ml_payload = {
            "is_anomaly": ml_is_anomaly,
            "confidence": ml_confidence,
        }

    is_anomaly = rule_result["event_type"] == "anomaly"
    confidence = float(rule_result["confidence"])
    if not is_anomaly and ml_confidence is not None:
        is_anomaly = bool(ml_is_anomaly)
        confidence = float(ml_confidence)

    return {
        "is_anomaly": bool(is_anomaly),
        "confidence": confidence,
        "event_type": rule_result["event_type"],
        "anomaly_type": rule_result["anomaly_type"],
        "severity": rule_result["severity"],
        "input_data": snapshot,
        "deltas": deltas,
        "rule": {
            "reasons": rule_result["reasons"],
            "thresholds": rule_result["thresholds"],
            "metrics": rule_result["metrics"],
        },
        "ml": ml_payload,
        "timestamp": datetime.now().isoformat(),
    }




def run_prediction():
    """Run prediction only when all 4 sensor values are available"""
    global latest_sensor_data, latest_prediction, model, last_prediction_time
    
    # Check if we have all sensor readings
    if not all(v is not None for v in latest_sensor_data.values()):
        return
    
    # Prevent duplicate predictions (only predict once per cycle)
    current_time = time.time()
    if current_time - last_prediction_time < 1:  # Minimum 1 second between predictions
        return
    
    last_prediction_time = current_time
    
    try:
        snapshot = {
            "flow_1": float(latest_sensor_data["flow_1"]),
            "pressure_1": float(latest_sensor_data["pressure_1"]),
            "flow_2": float(latest_sensor_data["flow_2"]),
            "pressure_2": float(latest_sensor_data["pressure_2"]),
        }
        latest_prediction = _predict_from_snapshot(snapshot)
        label = latest_prediction.get("anomaly_type") or latest_prediction.get("event_type")
        conf = latest_prediction.get("confidence")
        deltas = latest_prediction.get("deltas") or {}
        print(f"\nPrediction: {str(label).upper()} | Confidence: {float(conf):.2%}")
        print(f"   Upstream   - Flow: {snapshot['flow_1']:.2f}, Pressure: {snapshot['pressure_1']:.2f}")
        print(f"   Downstream - Flow: {snapshot['flow_2']:.2f}, Pressure: {snapshot['pressure_2']:.2f}")
        print(f"   Delta      - Flow: {float(deltas.get('flow_delta') or 0):.2f}, Pressure: {float(deltas.get('pressure_delta') or 0):.2f}")
        print(f"   Ratio      - Flow: {float(deltas.get('flow_ratio') or 0):.2f}, Pressure: {float(deltas.get('pressure_ratio') or 0):.2f}")
    except Exception as e:
        print(f"Prediction error: {e}")
    finally:
        latest_sensor_data['flow_1'] = None
        latest_sensor_data['pressure_1'] = None
        latest_sensor_data['flow_2'] = None
        latest_sensor_data['pressure_2'] = None




def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print(f"Connected to MQTT broker: {MQTT_BROKER}")
        for topic in MQTT_TOPICS:
            client.subscribe(topic)
            print(f"Subscribed to: {topic}")
    else:
        print(f"Failed to connect to MQTT broker, return code {rc}")




def on_message(client, userdata, msg):
    global latest_sensor_data
    
    try:
        payload = json.loads(msg.payload.decode())
        topic = msg.topic
        
        # Update sensor data based on topic
        if topic == "aquanex/flowmeter/1":
            latest_sensor_data['flow_1'] = payload.get('flow_rate')
            print(f"Received Flow1: {latest_sensor_data['flow_1']:.2f}")
        elif topic == "aquanex/pressure/1":
            latest_sensor_data['pressure_1'] = payload.get('pressure')
            print(f"Received Pressure1: {latest_sensor_data['pressure_1']:.2f}")
        elif topic == "aquanex/flowmeter/2":
            latest_sensor_data['flow_2'] = payload.get('flow_rate')
            print(f"Received Flow2: {latest_sensor_data['flow_2']:.2f}")
        elif topic == "aquanex/pressure/2":
            latest_sensor_data['pressure_2'] = payload.get('pressure')
            print(f"Received Pressure2: {latest_sensor_data['pressure_2']:.2f}")
        
        # Count how many values we have
        filled = sum(1 for v in latest_sensor_data.values() if v is not None)
        print(f"Buffer: {filled}/4")
        
        # Run prediction only when we have all 4 values
        if filled == 4:
            print("Running prediction...")
            run_prediction()
            
    except Exception as e:
        print(f"Error processing MQTT message: {e}")




def start_mqtt():
    global mqtt_client
    mqtt_client = mqtt.Client(client_id="aquanex_ml_service")
    mqtt_client.on_connect = on_connect
    mqtt_client.on_message = on_message
    
    try:
        mqtt_client.connect(MQTT_BROKER, MQTT_PORT, 60)
        mqtt_client.loop_forever()
    except Exception as e:
        print(f"Failed to start MQTT client: {e}")




def stop_mqtt():
    global mqtt_client
    if mqtt_client:
        mqtt_client.loop_stop()
        mqtt_client.disconnect()
        print("MQTT client stopped")




@app.on_event("startup")
async def startup_event():
    global model
    model_path = Path(__file__).parent.parent / "ML_models" / "models" / "breakage_detection_model.pkl"
    loaded = False
    try:
        model = joblib.load(model_path)
        loaded = True
        print(f"Model loaded from {model_path}")
    except Exception as e:
        print(f"Failed to load local model: {e}")

    if not loaded and os.getenv("MODEL_BUCKET") and os.getenv("AWS_S3_ENDPOINT_URL"):
        try:
            import boto3

            s3_client = boto3.client(
                "s3",
                endpoint_url=os.getenv("AWS_S3_ENDPOINT_URL"),
                aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
                aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
            )
            bucket = os.getenv("MODEL_BUCKET")
            candidates = [
                os.getenv("MODEL_KEY") or "",
                "models/breakage_detection_model.pkl",
                "models/breakage_detection.pkl",
                "models/breakage_detection_model.pkl",
            ]
            candidates = [c for c in candidates if c]
            last_error = None
            for key in candidates:
                try:
                    with tempfile.NamedTemporaryFile(suffix=".pkl", delete=False) as tmp:
                        s3_client.download_file(bucket, key, tmp.name)
                        model = joblib.load(tmp.name)
                    os.unlink(tmp.name)
                    loaded = True
                    print(f"Model loaded from bucket={bucket} key={key}")
                    break
                except Exception as inner:
                    last_error = inner
                    continue
            if not loaded and last_error:
                raise last_error
        except Exception as e:
            print(f"Failed to load model from object storage: {e}")
    
    # Start MQTT in a separate thread
    mqtt_thread = threading.Thread(target=start_mqtt, daemon=True)
    mqtt_thread.start()
    print("AquaNex ML Service with Delta-based Anomaly Detection started")
    asyncio.create_task(start_health_ping()) 




@app.on_event("shutdown")
async def shutdown_event():
    stop_mqtt()




@app.get("/")
async def root():
    return {
        "service": "AquaNex ML Service",
        "status": "running",
        "mqtt_connected": mqtt_client.is_connected() if mqtt_client else False,
        "model_loaded": model is not None,
        "detection_method": "Delta-based (Flow & Pressure differences)"
    }




@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "model_loaded": model is not None,
        "mqtt_connected": mqtt_client.is_connected() if mqtt_client else False,
        "latest_data_available": all(v is not None for v in latest_sensor_data.values())
    }




@app.get("/live-data", response_model=LiveDataResponse)
async def get_live_data():
    """Get the latest sensor data and prediction from MQTT stream"""
    return LiveDataResponse(
        sensor_data=latest_sensor_data,
        latest_prediction=latest_prediction
    )




@app.post("/predict", response_model=PredictionResponse)
async def predict_breakage(data: SensorData):
    """Manual prediction endpoint (for testing without MQTT)"""
    try:
        result = _predict_from_snapshot({
            "flow_1": data.flow_1,
            "pressure_1": data.pressure_1,
            "flow_2": data.flow_2,
            "pressure_2": data.pressure_2,
        })
        return PredictionResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")


@app.post("/telemetry/ingest")
async def ingest_telemetry(data: TelemetryIngestRequest):
    gateway_id = str(data.gateway_id or "").strip()
    if not gateway_id:
        raise HTTPException(status_code=400, detail="gateway_id is required")

    state = gateway_sensor_state.setdefault(
        gateway_id,
        {"flow_1": None, "pressure_1": None, "flow_2": None, "pressure_2": None},
    )
    devices = data.devices or []
    device_map = {str(d.get("id") or ""): d for d in devices if isinstance(d, dict)}

    updated = []
    for row in data.telemetry:
        if not isinstance(row, dict):
            continue
        device_id = str(row.get("device_id") or "").strip()
        row_metric = row.get("metric")
        reading = _safe_float(row.get("reading"))
        values = row.get("values") if isinstance(row.get("values"), dict) else {}
        if reading is None and values:
            if row_metric in values:
                reading = _safe_float(values.get(row_metric))
            if reading is None:
                for key in ("q_m3h", "flow_lpm", "pressure_bar", "flow", "pressure"):
                    if key in values:
                        row_metric = key
                        reading = _safe_float(values.get(key))
                        if reading is not None:
                            break

        if reading is None:
            continue

        device_meta = device_map.get(device_id, {})
        metric = row_metric or device_meta.get("metric")
        family = _infer_metric_family(metric, device_meta.get("type"))
        index = _infer_sensor_index(
            row.get("sensor_index"),
            row.get("position"),
            device_meta.get("sensor_index"),
            device_meta.get("position"),
            device_meta.get("channel"),
            device_meta.get("line"),
            device_id,
            device_meta.get("id"),
            device_meta.get("type"),
            metric,
        )
        if family not in {"flow", "pressure"} or index not in {1, 2}:
            continue

        slot = f"{family}_{index}"
        state[slot] = reading
        updated.append({"slot": slot, "value": reading, "device_id": device_id})

    missing = [key for key, value in state.items() if value is None]
    prediction = None
    if not missing:
        snapshot = {
            "flow_1": state["flow_1"],
            "pressure_1": state["pressure_1"],
            "flow_2": state["flow_2"],
            "pressure_2": state["pressure_2"],
        }
        prediction = _predict_from_snapshot(snapshot)
        prediction["gateway_id"] = gateway_id
        prediction["workspace_id"] = data.workspace_id
        gateway_latest_prediction[gateway_id] = prediction
        print(
            f"[gateway={gateway_id}] ML {'ANOMALY' if prediction['is_anomaly'] else 'NORMAL'} "
            f"conf={prediction['confidence']:.2%} deltas={prediction['deltas']}"
        )

    return {
        "success": True,
        "gateway_id": gateway_id,
        "updated": updated,
        "state": state,
        "prediction_ready": prediction is not None,
        "missing_slots": missing,
        "prediction": prediction,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
