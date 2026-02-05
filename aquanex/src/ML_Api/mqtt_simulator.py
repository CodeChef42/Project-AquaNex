import paho.mqtt.client as mqtt
import json
import time
import random
import math

MQTT_BROKER = "localhost"
MQTT_PORT = 1883

break_mode = False
last_state_change = time.time()

def get_daily_variation():
    now = time.time()
    daily_cycle = math.sin(now / 10.0) * 0.15
    return 1.0 + daily_cycle + (random.randint(-5, 5) / 100.0)

def main():
    global break_mode, last_state_change
    
    client = mqtt.Client(client_id="mqtt_simulator")
    client.connect(MQTT_BROKER, MQTT_PORT, 60)
    client.loop_start()
    
    print("=" * 60)
    print("AquaNex MQTT Simulator")
    print("Publishing to localhost:1883")
    print("=" * 60)
    
    try:
        while True:
            # Toggle break mode every 30 seconds
            if time.time() - last_state_change > 30:
                break_mode = not break_mode
                last_state_change = time.time()
                mode = "BREAK MODE" if break_mode else "NORMAL MODE"
                print(f"\n>>> Switched to {mode} <<<\n")
            
            # Generate values
            if break_mode:
                flow_1 = 145.0 * (1.4 + random.randint(0, 40) / 100.0)
                pressure_1 = 11.0 * (0.35 + random.randint(0, 15) / 100.0)
                flow_2 = 142.0 * (0.15 + random.randint(0, 15) / 100.0)
                pressure_2 = 10.5 * (0.10 + random.randint(0, 15) / 100.0)
            else:
                var1 = get_daily_variation()
                var2 = 1.0 + (math.sin(time.time() / 10.0) * 0.10) + (random.randint(-3, 3) / 100.0)
                flow_1 = 145.0 * var1
                pressure_1 = 11.0 * var2
                flow_2 = 142.0 * var1
                pressure_2 = 10.5 * var2
            
            # Publish each sensor separately (this triggers prediction after 4th message)
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
