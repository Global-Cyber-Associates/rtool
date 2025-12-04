import time
import traceback
import threading
import pythoncom
import subprocess
import json
import os
import sys
import tempfile
import shutil

from functions.system import get_system_info
from functions.ports import scan_ports
from functions.taskmanager import collect_process_info
from functions.installed_apps import get_installed_apps
from functions.sender import send_data, send_raw_network_scan
from functions.usbMonitor import monitor_usb, connect_socket, sio

# ============================
#  SAFE UTF-8 PRINT WRAPPER
# ============================
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


# ============================
#  RESOURCE PATH (MEIPASS FIX)
# ============================
def resource_path(relative_path):
    """Return correct path inside EXE or source."""
    base = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base, relative_path)


# ============================
#  USB MONITOR THREAD
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
        safe_print("[USB] monitor crash:", e)
        traceback.print_exc()
    finally:
        try:
            pythoncom.CoUninitialize()
        except:
            pass


# ==========================================================
#  VISUALIZER SCANNER — USE EMBEDDED PYTHON 3.14 RUNTIME
# ==========================================================
def start_visualizer_scanner():
    """
    Run scanner_service.py using embedded python runtime.
    Works on ANY Windows machine without Python installed.
    """

    base = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))

    python_embed = os.path.join(base, "python-embed", "python.exe")
    if not os.path.exists(python_embed):
        safe_print("[SCAN ERROR] Embedded python not found:", python_embed)
        return None

    original_scan = os.path.join(base, "visualizer-scanner", "scanner_service.py")
    if not os.path.exists(original_scan):
        safe_print("[SCAN ERROR] scanner_service.py missing:", original_scan)
        return None

    # Copy scanner to temp folder to avoid locking issues
    tempdir = tempfile.mkdtemp(prefix="visun_scanner_")
    temp_scan = os.path.join(tempdir, "scanner_service.py")
    shutil.copy2(original_scan, temp_scan)

    safe_print("[SCAN] Scanner copied to tempdir:", tempdir)

    cmd = [python_embed, "-u", temp_scan]

    try:
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            cwd=tempdir,
        )
    except Exception as e:
        safe_print("[SCAN ERROR] Failed to start scanner:", e)
        traceback.print_exc()
        return None

    threading.Thread(target=scanner_output_listener, args=(proc,), daemon=True).start()

    safe_print("[SCAN] Scanner running using embedded Python.")
    return proc


# ==========================================================
#  SCANNER OUTPUT LISTENER
# ==========================================================
def extract_first_json(s: str):
    """Extract first JSON in a line."""
    s = s.strip()
    if not s:
        return None

    start = None
    opening = None

    for i, ch in enumerate(s):
        if ch in ("[", "{"):
            start = i
            opening = ch
            break
    if start is None:
        return None

    pairs = {"{": "}", "[": "]"}
    stack = []

    for j in range(start, len(s)):
        c = s[j]
        if c in ("{", "["):
            stack.append(c)
        elif c in ("}", "]"):
            if not stack:
                continue
            top = stack[-1]
            if pairs[top] == c:
                stack.pop()
                if not stack:
                    return s[start:j+1]
    return None


def scanner_output_listener(proc):
    if not proc or not getattr(proc, "stdout", None):
        return

    try:
        for raw in proc.stdout:
            if not raw:
                continue

            line = raw.strip()
            js = extract_first_json(line)

            if not js:
                if line.startswith("[") or line.startswith("{"):
                    js = line

            if js:
                try:
                    parsed = json.loads(js)
                    if isinstance(parsed, list):
                        send_raw_network_scan(parsed)
                    elif isinstance(parsed, dict):
                        send_raw_network_scan([parsed])
                except:
                    pass

    except Exception as e:
        safe_print("[SCAN STREAM ERROR]", e)
    finally:
        try:
            rc = proc.poll()
            if rc is None:
                rc = proc.wait(timeout=0.3)
        except:
            rc = None

        safe_print("[SCANNER] child exited code:", rc)


# ==========================================================
#  MAIN SYSTEM SCANS
# ==========================================================
def run_scans():
    try:
        send_data("system_info", get_system_info())
        send_data("port_scan", scan_ports("127.0.0.1", "1-1024"))
        send_data("task_info", collect_process_info())

        apps = get_installed_apps()
        send_data("installed_apps", {"apps": apps, "count": len(apps)})
    except Exception as e:
        safe_print("[SCAN ERROR]", e)
        traceback.print_exc()


# ==========================================================
#  SINGLE INSTANCE LOCK
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
            if p.info['name'] and exe in p.info['name'].lower():
                count += 1
        except:
            pass

    return count > 1


# ==========================================================
#  MAIN ENTRY
# ==========================================================
if __name__ == "__main__":
    safe_print("=== VISUN ADMIN AGENT STARTED ===")
    safe_print("Executable:", sys.executable)

    try:
        import psutil
        if already_running():
            safe_print("[WARNING] Another instance already running. Exiting.")
            sys.exit(0)
    except:
        pass

    # Start socket thread
    def start_socket():
        try:
            connect_socket()

            @sio.event
            def connect():
                safe_print("[SOCKET] CONNECTED")

            @sio.event
            def disconnect():
                safe_print("[SOCKET] DISCONNECTED")

            sio.wait()

        except Exception as e:
            safe_print("[SOCKET ERROR]", e)
            traceback.print_exc()
            while True:
                time.sleep(3)

    threading.Thread(target=start_socket, daemon=False).start()

    # USB monitor
    threading.Thread(target=start_usb_monitor, daemon=True).start()

    # Start embedded scanner
    sp = start_visualizer_scanner()
    if sp:
        safe_print("[SCAN] Scanner launched.")
    else:
        safe_print("[SCAN] Scanner NOT launched.")

    # Main loop
    while True:
        run_scans()
        time.sleep(3)
