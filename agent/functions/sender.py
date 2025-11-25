import os
import logging
import platform
from datetime import datetime
from dotenv import load_dotenv
import socketio
import time
import threading
from queue import Queue

logging.basicConfig(level=logging.INFO)

load_dotenv()
SERVER_URL = os.getenv("SERVER_URL")
AGENT_ID = os.getenv("AGENT_ID", platform.node())

sio = socketio.Client(reconnection=True, reconnection_attempts=5, reconnection_delay=3)
send_queue = Queue()


@sio.event
def connect():
    logging.info(f"[🔌] Connected to backend Socket.IO at {SERVER_URL}")
    flush_queue()


@sio.event
def disconnect():
    logging.warning("[⚠️] Disconnected from backend server.")


def connect_socket():
    try:
        if not sio.connected:
            sio.connect(SERVER_URL)
    except Exception as e:
        logging.error(f"[⚠️] Socket connection failed: {e}")


def flush_queue():
    while not send_queue.empty() and sio.connected:
        entry = send_queue.get()
        try:
            sio.emit("agent_data", entry)
            logging.info(f"[📡] Sent queued data: {entry['type']}")
        except Exception as e:
            logging.error(f"[❌] Failed to send queued data: {e}")
            send_queue.put(entry)
            break


def send_data(data_type, payload):
    try:
        entry = {
            "timestamp": datetime.now().isoformat(),
            "agentId": AGENT_ID,
            "type": data_type,
            "data": payload,
        }

        send_queue.put(entry)

        if sio.connected:
            flush_queue()
        else:
            logging.info(f"[ℹ️] Socket not connected. Queued data: {data_type}")

    except Exception as e:
        logging.error(f"[❌] Failed to enqueue {data_type}: {e}")


# ⭐ RAW LAN SCAN SENDER
def send_raw_network_scan(devices_list):
    try:
        sio.emit("network_scan_raw", devices_list)
    except Exception as e:
        logging.error(f"[❌] Failed to send raw network scan: {e}")


def start_queue_worker():
    def worker():
        while True:
            if sio.connected:
                flush_queue()
            time.sleep(2)

    threading.Thread(target=worker, daemon=True).start()


start_queue_worker()
connect_socket()
