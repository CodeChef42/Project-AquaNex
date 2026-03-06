import requests
import time
import random
import math

FASTAPI_URL = "http://localhost:8001/predict"

scenario_start = time.time()

def get_daily_variation():
    now = time.time()
    daily_cycle = math.sin(now / 10.0) * 0.15
    return 1.0 + daily_cycle + (random.randint(-5, 5) / 100.0)

def send_prediction():
    elapsed = (time.time() - scenario_start) % 50.0
    if elapsed < 20.0:
        phase = "normal"
        var1 = get_daily_variation()
        var2 = 1.0 + (math.sin(time.time() / 10.0) * 0.10) + (random.randint(-3, 3) / 100.0)
        flow_1 = 145.0 * var1
        pressure_1 = 11.0 * var2
        flow_2 = 142.0 * var1
        pressure_2 = 10.5 * var2
    elif elapsed < 35.0:
        phase = "leakage"
        var1 = get_daily_variation()
        var2 = 1.0 + (math.sin(time.time() / 12.0) * 0.08) + (random.randint(-4, 4) / 100.0)
        leak_factor = 0.78 + (random.randint(-4, 6) / 100.0)
        pressure_drop = 0.84 + (random.randint(-4, 4) / 100.0)
        flow_1 = 145.0 * var1
        pressure_1 = 11.0 * var2
        flow_2 = 145.0 * var1 * leak_factor
        pressure_2 = 11.0 * var2 * pressure_drop
    else:
        phase = "breakage"
        var1 = get_daily_variation()
        var2 = 1.0 + (math.sin(time.time() / 14.0) * 0.06) + (random.randint(-4, 4) / 100.0)
        break_flow_factor = 0.22 + (random.randint(-5, 8) / 100.0)
        break_pressure_factor = 0.28 + (random.randint(-6, 8) / 100.0)
        flow_1 = 145.0 * var1
        pressure_1 = 11.0 * var2
        flow_2 = 145.0 * var1 * break_flow_factor
        pressure_2 = 11.0 * var2 * break_pressure_factor
    
    data = {
        "flow_1": round(flow_1, 2),
        "pressure_1": round(pressure_1, 2),
        "flow_2": round(flow_2, 2),
        "pressure_2": round(pressure_2, 2)
    }
    
    print(f"\nPhase={phase} Sensor Data: Flow1={data['flow_1']}, P1={data['pressure_1']}, Flow2={data['flow_2']}, P2={data['pressure_2']}")
    
    try:
        response = requests.post(FASTAPI_URL, json=data, timeout=5)
        result = response.json()
        
        status = result.get("anomaly_type") or ("ANOMALY" if result.get("is_anomaly") else "Normal")
        print(f"Prediction: {status} | Confidence: {result['confidence']:.2%}")
        print(f"Deltas: Flow={result['deltas']['flow_delta']:.2f}, Pressure={result['deltas']['pressure_delta']:.2f}")
        
    except Exception as e:
        print(f"Error: {e}")

def main():
    print("=" * 60)
    print("AquaNex Pipeline Simulator (HTTP Mode)")
    print("Sending to FastAPI at localhost:8001")
    print("=" * 60)
    
    try:
        while True:
            send_prediction()
            time.sleep(5)
            
    except KeyboardInterrupt:
        print("\n\nSimulator stopped")

if __name__ == "__main__":
    main()
