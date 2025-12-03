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


# ---------------- PATH HANDLER ----------------
def resource_path(relative_path):
    if hasattr(sys, "_MEIPASS"):
        return os.path.join(sys._MEIPASS, relative_path)
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), relative_path)


# ---------------- USB MONITOR ----------------
def start_usb_monitor():
    try:
        pythoncom.CoInitialize()
    except:
        pass

    try:
        sio.latest_usb_status = None
    except:
        pass

    @sio.on("usb_validation")
    def handle_usb_validation(data):
        try:
            sio.latest_usb_status = data
        except:
            pass

    try:
        monitor_usb(interval=3, timeout=5)
    except Exception as e:
        print("[USB] monitor crash:", e)
    finally:
        try:
            pythoncom.CoUninitialize()
        except:
            pass


# ---------------- DIRECT FAST SCANNER ----------------
def start_fast_scanner_direct():
    scanner_path = resource_path("visualizer-scanner/scanner_service.py")

    si = subprocess.STARTUPINFO()
    si.dwFlags |= subprocess.STARTF_USESHOWWINDOW

    try:
        return subprocess.Popen(
            ["python", scanner_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            startupinfo=si,
            creationflags=subprocess.CREATE_NO_WINDOW
        )
    except Exception as e:
        print("[SCAN ERROR]", e)
        return None


def scanner_output_listener(process):
    if not process:
        return

    for line in process.stdout:
        line = line.strip()
        if not line:
            continue

        # DEBUG: print raw from scanner
        print("[SCANNER RAW] ->", line)

        try:
            devices = json.loads(line)
            if isinstance(devices, list):
                send_raw_network_scan(devices)
        except Exception as e:
            print("[SCAN JSON ERROR]", e)
            print("LINE:", line)


# ---------------- MAIN COLLECTORS ----------------
def run_scans():
    try:
        send_data("system_info", get_system_info())
        send_data("port_scan", scan_ports("127.0.0.1", "1-1024"))
        send_data("task_info", collect_process_info())

        apps = get_installed_apps()
        send_data("installed_apps", {"apps": apps, "count": len(apps)})
    except Exception as e:
        print("[SCAN ERROR]", e)
        traceback.print_exc()


# ---------------- SINGLE INSTANCE LOCK ----------------
def already_running():
    try:
        import psutil
    except:
        return False

    exe = os.path.basename(sys.executable).lower()
    count = 0

    for p in psutil.process_iter(['name']):
        try:
            if p.info['name'] and exe in p.info['name'].lower():
                count += 1
        except:
            pass

    return count > 1


# ---------------- MAIN ENTRY ----------------
if __name__ == "__main__":

    print("=== ADMIN AGENT STARTED ===")
    print("Executable:", sys.executable)

    # prevent multiple agents
    try:
        import psutil
        if already_running():
            print("[⚠️] Another instance running. Exiting.")
            sys.exit(0)
    except:
        pass

    # SOCKET THREAD
    def start_socket():
        try:
            connect_socket()

            @sio.event
            def connect():
                print("[SOCKET] CONNECTED")

            @sio.event
            def disconnect():
                print("[SOCKET] DISCONNECTED")

            try:
                sio.wait()
            except:
                while True:
                    time.sleep(60)

        except Exception as e:
            print("[SOCKET ERROR]", e)

    threading.Thread(target=start_socket, daemon=False).start()

    # USB MONITOR
    threading.Thread(target=start_usb_monitor, daemon=True).start()

    # FAST NETWORK SCANNER (DIRECT)
    sp = start_fast_scanner_direct()
    if sp:
        threading.Thread(target=scanner_output_listener, args=(sp,), daemon=True).start()

    # MAIN LOOP
    while True:
        run_scans()
        time.sleep(3)
