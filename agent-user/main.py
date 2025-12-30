import time
import traceback
import threading
import pythoncom
import json
import os
import sys
import ctypes

from functions.system import get_system_info
from functions.taskmanager import collect_process_info
from functions.installed_apps import get_installed_apps
from functions.sender import send_data
from functions.usbMonitor import monitor_usb, connect_socket, sio

# ============================
# UTILITIES
# ============================
def safe_print(*args, **kwargs):
    # SILENT MODE: No console output for production robustness
    return

def resource_path(relative_path):
    """ Get absolute path to resource, works for dev and for PyInstaller """
    try:
        # PyInstaller creates a temp folder and stores path in _MEIPASS
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath(".")
    return os.path.join(base_path, relative_path)

# ============================
# USB MONITOR THREAD
# ============================
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
        # traceback.print_exc() (SILENT)
        pass
    finally:
        try:
            pythoncom.CoUninitialize()
        except:
            pass


# ============================
# SOCKET THREAD
# ============================
def start_socket():
    while True:
        try:
            connect_socket()
            
            if sio.connected:
                sio.wait()
            else:
                pass

        except Exception as e:
            # safe_print("[SOCKET ERROR]", e)
            pass
        
        time.sleep(5)


# ============================
# MAIN SYSTEM SCANS
# ============================
def run_scans():
    try:
        # 1. System Info
        sysinfo = get_system_info()
        send_data("system_info", sysinfo)

        # 2. Task Info
        send_data("task_info", collect_process_info())

        # 3. Installed Apps
        apps = get_installed_apps()
        send_data("installed_apps", {
            "apps": apps,
            "count": len(apps)
        })

    except Exception as e:
        pass


# ============================
# ENTRY POINT
# ============================
if __name__ == "__main__":
    # SINGLE INSTANCE CHECK
    mutex_name = "Global\\VisusAgentUserMutex"
    mutex = ctypes.windll.kernel32.CreateMutexW(None, False, mutex_name)
    last_error = ctypes.windll.kernel32.GetLastError()
    
    if last_error == 183:  # ERROR_ALREADY_EXISTS
        # Show Alert Box
        ctypes.windll.user32.MessageBoxW(0, "User Agent is already running!", "Agent Error", 0x10 | 0x1000) # MB_ICONHAND | MB_SYSTEMMODAL
        sys.exit(0)

    # socket thread
    threading.Thread(target=start_socket, daemon=False).start()

    # usb monitor
    threading.Thread(target=start_usb_monitor, daemon=True).start()

    # main loop
    import functions.sender as sender
    while True:
        if sender.IS_LICENSED:
            run_scans()
        else:
            # Wait for licensing...
            pass
        time.sleep(30) # Scans every 30s instead of loop-hammering
