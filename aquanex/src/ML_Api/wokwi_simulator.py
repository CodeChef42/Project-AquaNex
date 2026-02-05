import requests
import time
import random
import math

FASTAPI_URL = "http://localhost:8001/predict"

break_mode = False
last_state_change = time.time()

def get_daily_variation():
    now = time.time()
    daily_cycle = math.sin(now / 10.0) * 0.15
    return 1.0 + daily_cycle + (random.randint(-5, 5) / 100.0)

def send_prediction():
    global break_mode
    
    if break_mode:
        # ANOMALY: Big deltas
        flow_1 = 145.0 * (1.4 + random.randint(0, 40) / 100.0)
        pressure_1 = 11.0 * (0.35 + random.randint(0, 15) / 100.0)
        flow_2 = 142.0 * (0.15 + random.randint(0, 15) / 100.0)
        pressure_2 = 10.5 * (0.10 + random.randint(0, 15) / 100.0)
    else:
        # NORMAL: Small deltas
        var1 = get_daily_variation()
        var2 = 1.0 + (math.sin(time.time() / 10.0) * 0.10) + (random.randint(-3, 3) / 100.0)
        flow_1 = 145.0 * var1
        pressure_1 = 11.0 * var2
        flow_2 = 142.0 * var1
        pressure_2 = 10.5 * var2
    
    data = {
        "flow_1": round(flow_1, 2),
        "pressure_1": round(pressure_1, 2),
        "flow_2": round(flow_2, 2),
        "pressure_2": round(pressure_2, 2)
    }
    
    print(f"\nSensor Data: Flow1={data['flow_1']}, P1={data['pressure_1']}, Flow2={data['flow_2']}, P2={data['pressure_2']}")
    
    try:
        response = requests.post(FASTAPI_URL, json=data, timeout=5)
        result = response.json()
        
        status = "ANOMALY" if result['is_anomaly'] else "Normal"
        print(f"Prediction: {status} | Confidence: {result['confidence']:.2%}")
        print(f"Deltas: Flow={result['deltas']['flow_delta']:.2f}, Pressure={result['deltas']['pressure_delta']:.2f}")
        
    except Exception as e:
        print(f"Error: {e}")

def main():
    global break_mode, last_state_change
    
    print("=" * 60)
    print("AquaNex Pipeline Simulator (HTTP Mode)")
    print("Sending to FastAPI at localhost:8001")
    print("=" * 60)
    
    try:
        while True:
            # Toggle break mode every 30 seconds
            if time.time() - last_state_change > 30:
                break_mode = not break_mode
                last_state_change = time.time()
                mode = "BREAK MODE" if break_mode else "NORMAL MODE"
                print(f"\n{'='*60}\n>>> Switched to {mode} <<<\n{'='*60}")
            
            send_prediction()
            time.sleep(5)
            
    except KeyboardInterrupt:
        print("\n\nSimulator stopped")

if __name__ == "__main__":
    main()
