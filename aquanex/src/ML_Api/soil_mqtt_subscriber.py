import json
import asyncio
import paho.mqtt.client as mqtt
import requests
import base64
import struct
from datetime import datetime
import logging
from config import MQTT_BROKER, MQTT_PORT, MQTT_TOPIC_SOIL, API_URL

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def parse_lorawan_payload(payload_b64):
    """Example parser for LoRaWAN Base64 payload.
    Assuming first 4 bytes are a float for EC."""
    try:
        data = base64.b64decode(payload_b64)
        if len(data) >= 4:
            ec_value = struct.unpack('!f', data[:4])[0]
            return round(ec_value, 2)
    except Exception as e:
        logger.error(f"LoRaWAN parse error: {e}")
    return None

def parse_sdi12_payload(payload_str):
    """Example parser for SDI-12 format: '0+1.23+4.56'"""
    try:
        parts = payload_str.replace('+', ' ').replace('-', ' -').split()
        if len(parts) >= 2:
            return float(parts[1]) # First measurement after address
    except Exception as e:
        logger.error(f"SDI-12 parse error: {e}")
    return None

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        logger.info("Connected to MQTT broker")
        client.subscribe(MQTT_TOPIC_SOIL)
        logger.info(f"Subscribed to {MQTT_TOPIC_SOIL}")
    else:
        logger.error(f"Failed to connect to MQTT broker with code {rc}")

def on_message(client, userdata, msg):
    try:
        topic_parts = msg.topic.split('/')
        if len(topic_parts) < 4:
            logger.warning(f"Ignoring malformed topic: {msg.topic}")
            return

        workspace_id = topic_parts[2]
        sensor_id = topic_parts[3]
        
        payload = json.loads(msg.payload.decode())
        logger.info(f"Received message on topic {msg.topic}: {payload}")

        # 3.4 Protocol Parsing (Multi-protocol support)
        ec_value = payload.get('ec_value')
        
        # LoRaWAN base64
        if 'data_b64' in payload:
            ec_value = parse_lorawan_payload(payload['data_b64'])
        # SDI-12 raw string
        elif 'sdi12_raw' in payload:
            ec_value = parse_sdi12_payload(payload['sdi12_raw'])
        # Modbus hex
        elif 'modbus_hex' in payload:
            try:
                # Assuming 2-byte integer for EC * 100
                val = int(payload['modbus_hex'], 16)
                ec_value = val / 100.0
            except: pass

        # 3.3 Signal Cleaning & Validation
        if ec_value is None or not (0 <= ec_value <= 100): # Physical bounds check
            logger.warning(f"Invalid EC value received: {ec_value}")
            return
            
        # Assuming zone_id is sent in payload or can be derived
        zone_id = payload.get('zone_id') 
        if not zone_id:
            logger.warning("zone_id missing from payload")
            return

        reading_data = {
            "workspace": workspace_id,
            "sensor": sensor_id,
            "zone": zone_id,
            "ec_value": ec_value,
            "timestamp": payload.get("timestamp", datetime.utcnow().isoformat())
        }

        # 2.2 Data Ingestion
        response = requests.post(API_URL, json=reading_data)
        if response.status_code == 201:
            logger.info(f"Successfully ingested reading for sensor {sensor_id}")
        else:
            logger.error(f"Failed to ingest reading: {response.status_code} {response.text}")

    except json.JSONDecodeError:
        logger.error("Failed to decode JSON payload")
    except Exception as e:
        logger.error(f"An error occurred: {e}")

def main():
    client = mqtt.Client()
    client.on_connect = on_connect
    client.on_message = on_message

    try:
        client.connect(MQTT_BROKER, MQTT_PORT, 60)
        client.loop_forever()
    except Exception as e:
        logger.error(f"Could not start MQTT client: {e}")

if __name__ == "__main__":
    main()
