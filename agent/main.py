import time
import traceback
import threading
import pythoncom
import subprocess
import json
import os
import sys

from functions.system import get_system_info
from functions.ports import scan_ports
from functions.taskmanager import collect_process_info
from functions.installed_apps import get_installed_apps
from functions.sender import send_data, send_raw_network_scan
from functions.usbMonitor import monitor_usb, connect_socket, sio


def start_usb_monitor():
    pythoncom.CoInitialize()
    try:
        connect_socket()
        sio.latest_usb_status = None

        @sio.on("usb_validation")
        def handle_usb_validation(data):
            sio.latest_usb_status = data

        monitor_usb(interval=3, timeout=5)

    except Exception as e:
        print(f"[❌] USB monitor failed: {e}")
        traceback.print_exc()
    finally:
        pythoncom.CoUninitialize()


# ---------------- NETWORK SCANNER ----------------
def start_network_scanner():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    scanner_path = os.path.abspath(
        os.path.join(base_dir, "visualizer-scanner", "scanner_service.py")
    )

    print("SCANNER PATH =", scanner_path)

    return subprocess.Popen(
        [sys.executable, scanner_path],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,    # ⭐ Capture all scanner errors
        text=True
    )


def read_scanner_output(process):
    print("[📡] Scanner listener ACTIVE. Waiting for lines...")
    for line in process.stdout:
        line = line.strip()
        if not line:
            continue

        print("[SCANNER OUTPUT RAW] ->", line)  # ⭐ Debug print

        try:
            devices = json.loads(line)
            send_raw_network_scan(devices)
            print("[SCANNER JSON SENT] ->", len(devices), "devices")
        except Exception as e:
            print("SCANNER JSON ERROR:", e)
            print("LINE WAS:", line)


# ---------------- MAIN AGENT SCANS ----------------
def run_scans():
    try:
        sys_info = get_system_info()
        send_data("system_info", sys_info)

        port_data = scan_ports("127.0.0.1", "1-1024")
        send_data("port_scan", port_data)

        process_data = collect_process_info()
        send_data("task_info", process_data)

        app_data = get_installed_apps()
        send_data("installed_apps", {"apps": app_data, "count": len(app_data)})

        if hasattr(sio, "latest_usb_status"):
            send_data("usb_devices", {"connected_devices": []})

    except Exception as e:
        print(f"[❌] Error during scans: {e}")
        print(traceback.format_exc())


if __name__ == "__main__":
    # USB monitor
    threading.Thread(target=start_usb_monitor, daemon=True).start()

    # NETWORK SCANNER ⭐
    scanner_process = start_network_scanner()
    threading.Thread(target=read_scanner_output, args=(scanner_process,), daemon=True).start()

    # AGENT SCANS
    while True:
        run_scans()
        time.sleep(5)
