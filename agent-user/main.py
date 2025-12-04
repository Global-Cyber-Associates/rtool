import time
import traceback
import threading
import pythoncom
import json
import os
import sys

from functions.system import get_system_info
from functions.taskmanager import collect_process_info
from functions.installed_apps import get_installed_apps
from functions.sender import send_data
from functions.usbMonitor import monitor_usb, connect_socket, sio

# ==========================================================
# SAFE PRINT (fixes Windows 10 UnicodeEncodeError)
# ==========================================================
def safe_print(*args, **kwargs):
    try:
        print(*args, **kwargs)
    except Exception:
        cleaned = []
        for a in args:
            if isinstance(a, str):
                cleaned.append(a.encode("ascii", "ignore").decode())
            else:
                cleaned.append(a)
        print(*cleaned, **kwargs)


# ==========================================================
# SINGLE INSTANCE LOCK
# ==========================================================
def already_running():
    try:
        import psutil
    except:
        return False

    exe = os.path.basename(sys.executable).lower()
    count = 0

    for p in psutil.process_iter(['name']):
        try:
            if p.info["name"] and exe in p.info["name"].lower():
                count += 1
        except:
            pass

    return count > 1


# ==========================================================
# USB MONITOR THREAD
# ==========================================================
def start_usb_monitor():
    try:
        pythoncom.CoInitialize()
    except Exception as e:
        safe_print("[USB] CoInitialize failed:", e)

    safe_print("[USB] Monitor thread started")

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
        safe_print("[USB] monitor_usb crashed:", e)
        traceback.print_exc()
    finally:
        try:
            pythoncom.CoUninitialize()
        except:
            pass


# ==========================================================
# SOCKET THREAD
# ==========================================================
def start_socket():
    safe_print("[SOCKET] Starting socket...")

    try:
        connect_socket()

        @sio.event
        def connect():
            safe_print("[SOCKET] CONNECTED")

        @sio.event
        def disconnect():
            safe_print("[SOCKET] DISCONNECTED")

        if hasattr(sio, "wait"):
            sio.wait()
        else:
            while True:
                time.sleep(60)

    except Exception as e:
        safe_print("[SOCKET] Thread crashed:", e)
        traceback.print_exc()


# ==========================================================
# MAIN USER SCANS
# ==========================================================
def run_scans():
    try:
        send_data("system_info", get_system_info())
        send_data("task_info", collect_process_info())

        apps = get_installed_apps()
        send_data("installed_apps", {"apps": apps, "count": len(apps)})

    except Exception as e:
        safe_print("[SCAN ERROR]", e)
        traceback.print_exc()


# ==========================================================
# MAIN ENTRY
# ==========================================================
if __name__ == "__main__":
    safe_print("=== USER AGENT STARTED ===")
    safe_print("Executable:", sys.executable)
    safe_print("CWD:", os.getcwd())
    safe_print("Frozen:", getattr(sys, "frozen", False))

    try:
        import psutil
        if already_running():
            safe_print("[WARNING] Another instance is running. Exiting.")
            sys.exit(0)
    except:
        pass

    threading.Thread(target=start_socket, daemon=False).start()
    threading.Thread(target=start_usb_monitor, daemon=True).start()

    while True:
        run_scans()
        time.sleep(3)
