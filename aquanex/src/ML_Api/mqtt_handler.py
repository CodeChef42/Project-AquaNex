'''import json
import asyncio
from datetime import datetime
import paho.mqtt.client as mqtt
from database import SessionLocal
from ml_service import predict_breakage

# MQTT Configuration
MQTT_BROKER = "test.mosquitto.org"  # Alternative broker
MQTT_PORT = 1883
MQTT_TOPIC = "aquanex/sensors/#"

class MQTTHandler:
    def __init__(self):
        self.client = mqtt.Client()
        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message
        
    def on_connect(self, client, userdata, flags, rc):
        print(f"Connected to MQTT broker with code {rc}")
        client.subscribe(MQTT_TOPIC)
        
    def on_message(self, client, userdata, msg):
        try:
            payload = json.loads(msg.payload.decode())
            print(f"Received: {payload}")
            
            # Extract sensor data
            sensor_data = {
                'pressure': payload.get('pressure'),
                'flow_rate': payload.get('flow_rate'),
                'vibration': payload.get('vibration'),
                'temperature': payload.get('temperature')
            }
            
            # Run prediction
            result = predict_breakage(sensor_data)
            print(f"Prediction: {result}")
            
            # Store in database (optional)
            self.store_prediction(sensor_data, result)
            
        except Exception as e:
            print(f"Error processing message: {e}")
    
    def store_prediction(self, sensor_data, prediction):
        # Store to your database
        pass
        
    def start(self):
        self.client.connect(MQTT_BROKER, MQTT_PORT, 60)
        self.client.loop_start()
        
    def stop(self):
        self.client.loop_stop()
        self.client.disconnect()'''
