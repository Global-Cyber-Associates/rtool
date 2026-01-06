import os
import logging
import platform
from datetime import datetime
from dotenv import load_dotenv
import socketio
import time
import threading
from queue import Queue
import subprocess
import json
import sys
from .license import generate_fingerprint, load_license_token, save_license_token, verify_license_locally
import requests

logging.basicConfig(level=logging.INFO)

load_dotenv()
SERVER_URL = os.getenv("SERVER_URL")
AGENT_ID = os.getenv("AGENT_ID", platform.node())
FINGERPRINT = generate_fingerprint()
IS_LICENSED = False

def get_local_version():
    """
    Finds version.json in EXE dir, Script dir, or CWD.
    """
    candidates = []
    
    # 1. EXE/Script Directory
    if getattr(sys, 'frozen', False):
        candidates.append(os.path.dirname(os.path.abspath(sys.executable)))
    else:
        # Script dir
        script_dir = os.path.dirname(os.path.abspath(__file__))
        if os.path.basename(script_dir) == "functions":
            script_dir = os.path.dirname(script_dir)
        candidates.append(script_dir)
    
    # 2. Current Working Directory
    candidates.append(os.getcwd())
    
    # 3. Parent of script (extra safety)
    try:
        candidates.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
    except: pass

    for base in candidates:
        v_path = os.path.join(base, "version.json")
        if os.path.exists(v_path):
            try:
                with open(v_path, "r") as f:
                    ver = json.load(f).get("version", "0.0.0")
                    if ver != "0.0.0":
                        logging.info(f"[ℹ️] Found version {ver} at {v_path}")
                        return ver
            except Exception as e:
                logging.debug(f"Failed to read {v_path}: {e}")
    
    logging.warning("[⚠️] Could not resolve local version. Defaulting to 0.0.0")
    return "0.0.0"

LOCAL_VERSION = get_local_version()


# -----------------------------------------------------------
# SOCKET.IO CLIENT
# -----------------------------------------------------------
sio = socketio.Client(
    reconnection=True,
    reconnection_attempts=0,
    reconnection_delay=3
)

send_queue = Queue()


# -----------------------------------------------------------
# SOCKET EVENTS
# -----------------------------------------------------------
@sio.event
def connect():
    logging.info(f"[🔌] Connected to backend Socket.IO at {SERVER_URL}")

    # ⭐ REGISTER AGENT WITH FINGERPRINT
    try:
        sio.emit("register_agent", {
            "agentId": AGENT_ID,
            "fingerprint": FINGERPRINT,
            "version": LOCAL_VERSION
        })
        logging.info(f"[🆔] Registered agent: {AGENT_ID} (FP: {FINGERPRINT[:8]}...)")
    except Exception as e:
        logging.error(f"[❌] Failed to register agent: {e}")

    flush_queue()


@sio.event
def disconnect():
    logging.warning("[⚠️] Disconnected from backend server.")


@sio.event
def connect_error(data):
    logging.error(f"[❌] Socket connection error: {data}")


@sio.on("license_approved")
def on_license_approved(data):
    logging.info(f"[🔓] {data.get('message')}")
    # Trigger activation request now that we know we are approved
    activate_license()

# -----------------------------------------------------------
# LICENSE HANDLERS
# -----------------------------------------------------------
@sio.on("registration_status")
def handle_registration_status(data):
    logging.info(f"[ℹ️] Registration status received: {data}")
    global IS_LICENSED
    IS_LICENSED = data.get("isLicensed", False)
    
    if IS_LICENSED:
        token = load_license_token()
        valid, msg = verify_license_locally(token, FINGERPRINT)
        if not valid:
            logging.warning(f"[🔑] License token invalid: {msg}. Requesting activation...")
            activate_license()
        else:
            logging.info("[✔️] License verified locally.")
    else:
        logging.warning("[⚠️] Agent not licensed. Requesting activation...")
        activate_license()

def activate_license():
    def on_activation_response(res):
        global IS_LICENSED
        if res.get("success"):
            save_license_token(res["token"])
            IS_LICENSED = True
            logging.info("[✔️] License activated and token saved.")
        else:
            logging.error(f"[❌] License activation failed: {res.get('message')}")

    sio.emit("license_activate", {
        "agentId": AGENT_ID,
        "fingerprint": FINGERPRINT
    }, callback=on_activation_response)


# -----------------------------------------------------------
# ⭐ BOOTSTRAP: AUTO-RESOLVE TENANT KEY
# -----------------------------------------------------------
def bootstrap_license():
    """
    Attempts to find the TENANT_KEY via hardware fingerprint or license.key file.
    """
    try:
        # 1. Try Hardware Lookup first (Success if machine was already registered)
        logging.info("[🔍] Attempting zero-touch hardware identification...")
        res = requests.post(f"{SERVER_URL}/api/license/verify-hardware", json={"fingerprint": FINGERPRINT}, timeout=10)
        if res.status_code == 200:
            data = res.json()
            if data.get("success"):
                save_to_env("TENANT_KEY", data["tenantKey"])
                logging.info(f"[✔️] Hardware recognized! Associated with {data['companyName']}")
                return data["tenantKey"]

        # 2. Try license.key file from root
        license_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "license.key")
        if os.path.exists(license_file):
            with open(license_file, "r") as f:
                license_key = f.read().strip()
                if license_key:
                    logging.info(f"[🔑] Found license.key! Bootstrapping...")
                    res = requests.post(f"{SERVER_URL}/api/license/bootstrap", json={
                        "licenseKey": license_key,
                        "fingerprint": FINGERPRINT,
                        "agentId": AGENT_ID
                    }, timeout=10)
                    if res.status_code == 200:
                        data = res.json()
                        if data.get("success"):
                            save_to_env("TENANT_KEY", data["tenantKey"])
                            logging.info(f"[✔️] Bootstrap successful! Associated with {data['companyName']}")
                            return data["tenantKey"]
        
        logging.warning("[⚠️] No TENANT_KEY found and bootstrap failed. Waiting for manual entry or license.key file.")
        return None
    except Exception as e:
        logging.error(f"[❌] Bootstrap error: {e}")
        return None

def save_to_env(key, value):
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env")
    lines = []
    if os.path.exists(env_path):
        with open(env_path, "r") as f:
            lines = f.readlines()
    
    # Update or add
    found = False
    new_lines = []
    for line in lines:
        if line.startswith(f"{key}="):
            new_lines.append(f"{key}={value}\n")
            found = True
        else:
            new_lines.append(line)
    
    if not found:
        new_lines.append(f"{key}={value}\n")
    
    with open(env_path, "w") as f:
        f.writelines(new_lines)
    
    # Also update current process env
    os.environ[key] = value

# -----------------------------------------------------------
# CONNECT FUNCTION (UPDATED FOR BOOTSTRAP)
# -----------------------------------------------------------
def connect_socket():
    try:
        if not sio.connected:
            token = os.getenv("TENANT_KEY")
            
            # ⭐ If no token, try to bootstrap automatically
            if not token:
                logging.info("[ℹ️] TENANT_KEY missing. Starting bootstrap...")
                token = bootstrap_license()
            
            if token:
                auth_payload = {"token": token}
                sio.connect(SERVER_URL, auth=auth_payload)
            else:
                logging.error("[❌] Cannot connect: TENANT_KEY not resolved.")
    except Exception as e:
        logging.error(f"[⚠️] Socket connection failed: {e}")


# -----------------------------------------------------------
# QUEUE FLUSHING
# -----------------------------------------------------------
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


# -----------------------------------------------------------
# SEND AGENT DATA
# -----------------------------------------------------------
def send_data(data_type, payload):
    if not IS_LICENSED:
        logging.warning(f"[🔒] Data transmission blocked: User Agent not licensed ({data_type})")
        return

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


# -----------------------------------------------------------
# BACKGROUND QUEUE WORKER
# -----------------------------------------------------------
def start_queue_worker():
    def worker():
        while True:
            if sio.connected:
                flush_queue()
            time.sleep(2)

    threading.Thread(target=worker, daemon=True).start()


start_queue_worker()
connect_socket()
