import paho.mqtt.client as mqtt
import json
import time
import random
import math

MQTT_BROKER = "localhost"
MQTT_PORT = 1883

scenario_start = time.time()

def get_daily_variation():
    now = time.time()
    daily_cycle = math.sin(now / 10.0) * 0.15
    return 1.0 + daily_cycle + (random.randint(-5, 5) / 100.0)

def main():
    client = mqtt.Client(client_id="mqtt_simulator")
    client.connect(MQTT_BROKER, MQTT_PORT, 60)
    client.loop_start()
    
    print("=" * 60)
    print("AquaNex MQTT Simulator")
    print("Publishing to localhost:1883")
    print("=" * 60)
    
    try:
        while True:
            elapsed = (time.time() - scenario_start) % 50.0
            if elapsed < 20.0:
                phase = "NORMAL"
                var1 = get_daily_variation()
                var2 = 1.0 + (math.sin(time.time() / 10.0) * 0.10) + (random.randint(-3, 3) / 100.0)
                flow_1 = 145.0 * var1
                pressure_1 = 11.0 * var2
                flow_2 = 142.0 * var1
                pressure_2 = 10.5 * var2
            elif elapsed < 35.0:
                phase = "LEAKAGE"
                var1 = get_daily_variation()
                var2 = 1.0 + (math.sin(time.time() / 12.0) * 0.08) + (random.randint(-4, 4) / 100.0)
                leak_factor = 0.78 + (random.randint(-4, 6) / 100.0)
                pressure_drop = 0.84 + (random.randint(-4, 4) / 100.0)
                flow_1 = 145.0 * var1
                pressure_1 = 11.0 * var2
                flow_2 = 145.0 * var1 * leak_factor
                pressure_2 = 11.0 * var2 * pressure_drop
            else:
                phase = "BREAKAGE"
                var1 = get_daily_variation()
                var2 = 1.0 + (math.sin(time.time() / 14.0) * 0.06) + (random.randint(-4, 4) / 100.0)
                break_flow_factor = 0.22 + (random.randint(-5, 8) / 100.0)
                break_pressure_factor = 0.28 + (random.randint(-6, 8) / 100.0)
                flow_1 = 145.0 * var1
                pressure_1 = 11.0 * var2
                flow_2 = 145.0 * var1 * break_flow_factor
                pressure_2 = 11.0 * var2 * break_pressure_factor
            
            # Publish each sensor separately (this triggers prediction after 4th message)
            print(f"\nPhase: {phase}")
            client.publish("aquanex/flowmeter/1", json.dumps({"flow_rate": round(flow_1, 2)}))
            print(f"Published Flow1: {flow_1:.2f}")
            time.sleep(0.5)
            
            client.publish("aquanex/pressure/1", json.dumps({"pressure": round(pressure_1, 2)}))
            print(f"Published Pressure1: {pressure_1:.2f}")
            time.sleep(0.5)
            
            client.publish("aquanex/flowmeter/2", json.dumps({"flow_rate": round(flow_2, 2)}))
            print(f"Published Flow2: {flow_2:.2f}")
            time.sleep(0.5)
            
            client.publish("aquanex/pressure/2", json.dumps({"pressure": round(pressure_2, 2)}))
            print(f"Published Pressure2: {pressure_2:.2f}")
            print("-" * 60)
            
            time.sleep(5)
            
    except KeyboardInterrupt:
        print("\nSimulator stopped")
        client.loop_stop()
        client.disconnect()

if __name__ == "__main__":
    main()
