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


# ---------------- PATH HANDLER (WORKS FOR EXE + PYTHON) ----------------
def resource_path(relative_path):
    """
    Returns correct path for both script & PyInstaller EXE.
    """
    if hasattr(sys, "_MEIPASS"):
        return os.path.join(sys._MEIPASS, relative_path)
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), relative_path)


# ---------------- USB MONITOR ----------------
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



# ---------------- NETWORK SCANNER (SAFE FOR EXE) ----------------
def start_network_scanner():
    stabilizer_path = resource_path("visualizer-scanner/stabilizer.py")

    print("STABILIZER PATH =", stabilizer_path)

    # IMPORTANT:
    # Never use sys.executable for launching stabilizer
    # (to avoid recursive agent.exe spawning)
    return subprocess.Popen(
        ["python", stabilizer_path],   # FIXED — safe, no recursion
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True
    )



def read_scanner_output(process):
    print("[📡] Stabilizer listener ACTIVE. Waiting for stable lines...")

    for line in process.stdout:
        line = line.strip()
        if not line:
            continue

        print("[STABILIZER RAW] ->", line)

        try:
            devices = json.loads(line)
            send_raw_network_scan(devices)
            print("[STABLE JSON SENT] ->", len(devices), "devices")
        except Exception as e:
            print("STABILIZER JSON ERROR:", e)
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



# ---------------- SINGLE INSTANCE LOCK (PREVENT MULTIPLE AGENTS) ----------------
def already_running():
    import psutil
    current = psutil.Process().pid
    exe_name = os.path.basename(sys.executable).lower()

    count = 0
    for p in psutil.process_iter(['pid', 'name']):
        try:
            if p.info['name'] and exe_name in p.info['name'].lower():
                count += 1
        except:
            pass

    return count > 1



# ---------------- MAIN ENTRY ----------------
if __name__ == "__main__":
    # Prevent multiple agents from running
    try:
        import psutil
        if already_running():
            print("[⚠️] Another agent instance already running. Exiting.")
            sys.exit(0)
    except ImportError:
        print("[⚠️] psutil missing — cannot enforce single instance lock.")

    # USB monitor thread
    threading.Thread(target=start_usb_monitor, daemon=True).start()

    # NETWORK SCANNER (SAFE MODE)
    scanner_process = start_network_scanner()
    threading.Thread(target=read_scanner_output, args=(scanner_process,), daemon=True).start()

    # Main periodic scans
    while True:
        run_scans()
        time.sleep(3)
