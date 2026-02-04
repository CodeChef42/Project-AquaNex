from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib
import numpy as np
from pathlib import Path

app = FastAPI(title="AquaNex ML Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model = None

@app.on_event("startup")
async def load_model():
    global model
    model_path = Path(__file__).parent.parent / "ML_models" / "models" / "breakage_detection_model.pkl"
    try:
        model = joblib.load(model_path)
        print(f"✅ Model loaded from {model_path}")
    except Exception as e:
        print(f"❌ Failed to load model: {e}")

class SensorData(BaseModel):
    flow_1: float
    pressure_1: float
    flow_2: float
    pressure_2: float

class PredictionResponse(BaseModel):
    is_anomaly: bool
    confidence: float
    input_data: dict

@app.get("/")
async def root():
    return {"service": "AquaNex ML Service", "status": "running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "model_loaded": model is not None}

@app.post("/predict", response_model=PredictionResponse)
async def predict_breakage(data: SensorData):
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    try:
        features = np.array([[data.flow_1, data.pressure_1, data.flow_2, data.pressure_2]])
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
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
