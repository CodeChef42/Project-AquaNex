from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib
import numpy as np
from pathlib import Path
import json
from datetime import datetime
import paho.mqtt.client as mqtt
import threading
import time



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
    input_data: dict
    deltas: dict
    timestamp: str




class LiveDataResponse(BaseModel):
    sensor_data: dict
    latest_prediction: dict = None




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
    
    # Calculate deltas
    deltas = calculate_deltas(
        latest_sensor_data['flow_1'],
        latest_sensor_data['pressure_1'],
        latest_sensor_data['flow_2'],
        latest_sensor_data['pressure_2']
    )
    
    # Run prediction using deltas
    if model is not None:
        try:
            # Features: flow_delta, pressure_delta, flow_ratio, pressure_ratio
            features = np.array([[
                deltas['flow_delta'],
                deltas['pressure_delta'],
                deltas['flow_ratio'],
                deltas['pressure_ratio']
            ]])
            
            prediction = model.predict(features)[0]
            probability = model.predict_proba(features)[0]
            
            latest_prediction = {
                'is_anomaly': bool(prediction),
                'confidence': float(probability[int(prediction)]),
                'input_data': latest_sensor_data.copy(),
                'deltas': deltas,
                'timestamp': datetime.now().isoformat()
            }
            
            status = "ANOMALY DETECTED" if prediction else "Normal"
            print(f"\nPrediction: {status} | Confidence: {probability[int(prediction)]:.2%}")
            print(f"   Upstream   - Flow: {latest_sensor_data['flow_1']:.2f}, Pressure: {latest_sensor_data['pressure_1']:.2f}")
            print(f"   Downstream - Flow: {latest_sensor_data['flow_2']:.2f}, Pressure: {latest_sensor_data['pressure_2']:.2f}")
            print(f"   Delta      - Flow: {deltas['flow_delta']:.2f}, Pressure: {deltas['pressure_delta']:.2f}")
            print(f"   Ratio      - Flow: {deltas['flow_ratio']:.2f}, Pressure: {deltas['pressure_ratio']:.2f}")
            
            # Reset buffer after prediction
            latest_sensor_data['flow_1'] = None
            latest_sensor_data['pressure_1'] = None
            latest_sensor_data['flow_2'] = None
            latest_sensor_data['pressure_2'] = None
            
        except Exception as e:
            print(f"Prediction error: {e}")




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
    try:
        model = joblib.load(model_path)
        print(f"Model loaded from {model_path}")
    except Exception as e:
        print(f"Failed to load model: {e}")
    
    # Start MQTT in a separate thread
    mqtt_thread = threading.Thread(target=start_mqtt, daemon=True)
    mqtt_thread.start()
    print("AquaNex ML Service with Delta-based Anomaly Detection started")




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
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    try:
        # Calculate deltas
        deltas = calculate_deltas(data.flow_1, data.pressure_1, data.flow_2, data.pressure_2)
        
        # Features: flow_delta, pressure_delta, flow_ratio, pressure_ratio
        features = np.array([[
            deltas['flow_delta'],
            deltas['pressure_delta'],
            deltas['flow_ratio'],
            deltas['pressure_ratio']
        ]])
        
        prediction = model.predict(features)[0]
        probability = model.predict_proba(features)[0]
        
        return PredictionResponse(
            is_anomaly=bool(prediction),
            confidence=float(probability[int(prediction)]),
            input_data={
                "flow_1": data.flow_1,
                "pressure_1": data.pressure_1,
                "flow_2": data.flow_2,
                "pressure_2": data.pressure_2
            },
            deltas=deltas,
            timestamp=datetime.now().isoformat()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")




if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
