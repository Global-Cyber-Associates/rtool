import time
import traceback
import threading
import pythoncom
import subprocess
import json
import os
import sys
import runpy
import shutil
from dotenv import load_dotenv

from functions.system import get_system_info
from functions.ports import scan_ports
from functions.taskmanager import collect_process_info
from functions.installed_apps import get_installed_apps
from functions.sender import send_data, send_raw_network_scan
from functions.usbMonitor import monitor_usb, connect_socket, sio

# Load environment variables
load_dotenv()

def safe_print(*args, **kwargs):
    """Safe print that works even in --noconsole mode (prints to internal buffer or ignored)"""
    try:
        print(*args, **kwargs)
        sys.stdout.flush()
    except:
        pass

# ============================
# RESOURCE PATH (MEIPASS)
# ============================
def resource_path(relative):
    base = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base, relative)

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
        safe_print("[USB ERROR]", e)
        traceback.print_exc()
    finally:
        try:
            pythoncom.CoUninitialize()
        except:
            pass

# ==========================================================
# START SCANNER (NO TEMP FILES)
#
# Strategy:
#  - If python-embed/python.exe exists -> spawn subprocess with it (hidden).
#  - Else if running non-frozen (normal python) -> spawn subprocess with sys.executable.
#  - Else (frozen EXE without embed) -> run scanner_service.py in a background thread using runpy.
# ==========================================================
def start_visualizer_scanner():
    base = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
    original_scan = os.path.join(base, "visualizer-scanner", "scanner_service.py")
    if not os.path.exists(original_scan):
        safe_print("[SCAN ERROR] scanner_service.py missing:", original_scan)
        return None

    # prefer embedded python if present
    python_embed = os.path.join(base, "python-embed", "python.exe")
    if os.path.exists(python_embed):
        cmd = [python_embed, "-u", original_scan]
        try:
            proc = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                cwd=os.path.dirname(original_scan),
                creationflags=subprocess.CREATE_NO_WINDOW
            )
            threading.Thread(target=scanner_output_listener, args=(proc,), daemon=True).start()
            safe_print("[SCAN] started with embedded python")
            return proc
        except Exception as e:
            safe_print("[SCAN ERROR] embedded python failed:", e)
            traceback.print_exc()
            return None

    # if not frozen/pyinstaller (running as script), spawn normal python process
    if not getattr(sys, "frozen", False):
        try:
            cmd = [sys.executable, original_scan]
            proc = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                cwd=os.path.dirname(original_scan)
            )
            threading.Thread(target=scanner_output_listener, args=(proc,), daemon=True).start()
            safe_print("[SCAN] started via sys.executable")
            return proc
        except Exception as e:
            safe_print("[SCAN ERROR] starting scanner via sys.executable failed:", e)
            traceback.print_exc()
            return None

    # else: frozen EXE without embedded python — run scanner in-thread (no files, no subprocess)
    try:
        def run_scanner_in_thread():
            try:
                # run_path runs the script in its own globals; keep it daemon
                runpy.run_path(original_scan, run_name="__scanner_service__")
            except Exception as e:
                safe_print("[SCAN THREAD ERROR]", e)
                traceback.print_exc()

        t = threading.Thread(target=run_scanner_in_thread, daemon=True)
        t.start()
        safe_print("[SCAN] scanner service started in-thread (frozen mode)")
        return None  # no subprocess object
    except Exception as e:
        safe_print("[SCAN ERROR] cannot run scanner in-thread:", e)
        traceback.print_exc()
        return None

# ==========================================================
# SCANNER OUTPUT LISTENER (parses JSON arrays/objects)
# ==========================================================
def extract_first_json(s):
    s = s.strip()
    if not s:
        return None
    start = None
    for i, ch in enumerate(s):
        if ch in ("[", "{"):
            start = i
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
            if pairs.get(top) == c:
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
                continue
            try:
                parsed = json.loads(js)
                if isinstance(parsed, list):
                    send_raw_network_scan(parsed)
                elif isinstance(parsed, dict):
                    send_raw_network_scan([parsed])
            except Exception:
                pass
    except Exception as e:
        safe_print("[SCAN STREAM ERROR]", e)
        traceback.print_exc()

# ==========================================================
# MAIN SYSTEM SCANS
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

# ============================
# UPDATE CHECKER
# ============================
import hashlib
import requests

def calculate_hash(file_path):
    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        # Read and update hash string value in blocks of 4K
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()

def check_for_updates():
    """
    Checks for updates every 60 minutes.
    """
    while True:
        try:
            time.sleep(60) # Wait 60s before first check
            
            # 🔹 RESOLVE PATHS Correctly for compiled EXE
            if getattr(sys, 'frozen', False):
                exe_dir = os.path.dirname(os.path.abspath(sys.executable))
            else:
                exe_dir = os.path.dirname(os.path.abspath(__file__))
            
            version_file = os.path.join(exe_dir, "version.json")
            local_version = "0.0.0"
            if os.path.exists(version_file):
                try:
                    with open(version_file, "r") as f:
                        local_version = json.load(f).get("version", "0.0.0")
                except:
                    pass

            SERVER_URL = os.getenv("SERVER_URL")
            if not SERVER_URL: 
                time.sleep(10)
                continue

            # Get Manifest for AGENT-ADMIN
            safe_print(f"[UPDATE] Checking: {SERVER_URL}/api/agent/update?app=agent-admin")
            res = requests.get(f"{SERVER_URL}/api/agent/update?app=agent-admin", timeout=10)
            if res.status_code != 200:
                safe_print(f"[UPDATE] API Error: {res.status_code}")
                continue
            
            manifest = res.json()
            remote_version = manifest.get("version")
            
            if remote_version != local_version:
                safe_print(f"[UPDATE] New version found: {remote_version} (Current: {local_version})")
                
                # Download Zip
                download_url = manifest.get("url")
                if not download_url.startswith("http"): 
                    download_url = f"{SERVER_URL}{download_url}"
                
                temp_zip = os.path.join(exe_dir, "update.zip")
                safe_print(f"[UPDATE] Downloading from: {download_url}")
                
                r = requests.get(download_url, stream=True, timeout=30)
                if r.status_code == 200:
                    safe_print(f"[UPDATE] Saving to: {temp_zip}")
                    with open(temp_zip, 'wb') as f:
                        for chunk in r.iter_content(chunk_size=8192):
                            f.write(chunk)
                    safe_print("[UPDATE] Download complete.")
                    
                    # Verify Hash
                    if manifest.get("hash"):
                        safe_print("[UPDATE] Verifying hash...")
                        file_hash = calculate_hash(temp_zip)
                        if file_hash != manifest.get("hash"):
                            safe_print(f"[UPDATE] ERROR: Hash mismatch! Expected {manifest.get('hash')}, got {file_hash}")
                            os.remove(temp_zip)
                            continue
                        safe_print("[UPDATE] Hash verified.")
                    
                    # Launch Updater
                    safe_print("[UPDATE] Preparing updater...")
                    root_dir = os.path.abspath(os.path.join(exe_dir, ".."))
                    updater_filename = "updater.exe"
                    
                    # 1. Find the updater
                    source_updater = os.path.join(exe_dir, updater_filename)
                    if not os.path.exists(source_updater):
                        source_updater = os.path.join(root_dir, updater_filename)
                    
                    if not os.path.exists(source_updater):
                        safe_print(f"[UPDATE] updater.exe not found in {exe_dir} or {root_dir}")
                        continue
                        
                    # 2. To avoid locking agent_current, we COPY updater to root_dir if it's not already there
                    target_updater = os.path.join(root_dir, updater_filename)
                    if os.path.abspath(source_updater) != os.path.abspath(target_updater):
                        try:
                            shutil.copy2(source_updater, target_updater)
                            safe_print(f"[UPDATE] Copied updater to root: {target_updater}")
                        except Exception as e:
                            safe_print(f"[UPDATE] Warning: Could not copy updater to root: {e}")
                            # We'll try to run from source anyway, though it might fail with WinError 32
                    
                    # 3. Move the ZIP file to root_dir as well so its path stays stable during folder rename
                    target_zip = os.path.join(root_dir, "update.zip")
                    try:
                        if os.path.exists(target_zip):
                            os.remove(target_zip)
                        shutil.move(temp_zip, target_zip)
                        safe_print(f"[UPDATE] Moved ZIP to root: {target_zip}")
                    except Exception as zip_err:
                        safe_print(f"[UPDATE] Warning: Could not move ZIP to root: {zip_err}")
                        target_zip = temp_zip # Fallback to original path
                    
                    safe_print(f"[UPDATE] Launching updater: {target_updater}")
                    
                    try:
                        # 4. Spawning updater from root CWD
                        subprocess.Popen([
                            target_updater,
                            "--pid", str(os.getpid()),
                            "--zip", target_zip,
                            "--root", root_dir,
                            "--exe", os.path.basename(sys.executable)
                        ], creationflags=subprocess.CREATE_NEW_CONSOLE, cwd=root_dir)
                        
                        safe_print("[UPDATE] Updater spawned. Forcing application exit...")
                        # Force exit of the entire process, not just this thread
                        os._exit(0)
                    except Exception as spawn_err:
                        safe_print(f"[UPDATE] FATAL: Could not spawn updater: {spawn_err}")
                    
        except Exception as e:
            safe_print(f"[UPDATE] Check failed: {traceback.format_exc()}")

        time.sleep(600) # Check every 10 minutes

# ==========================================================
# MAIN ENTRY (NO FILE CREATION)
# ==========================================================
if __name__ == "__main__":

    import ctypes
    
    # SINGLE INSTANCE CHECK
    # Mutex name must be unique per agent type
    mutex_name = "Global\\VisusAgentAdminMutex"
    mutex = ctypes.windll.kernel32.CreateMutexW(None, False, mutex_name)
    last_error = ctypes.windll.kernel32.GetLastError()
    
    if last_error == 183:  # ERROR_ALREADY_EXISTS
        safe_print("[STARTUP] Agent is already running.")
        # Show Alert Box
        ctypes.windll.user32.MessageBoxW(0, "Agent is already running!", "Agent Error", 0x10 | 0x1000) # MB_ICONHAND | MB_SYSTEMMODAL
        sys.exit(0)

    safe_print("=== ADMIN AGENT START ===")
    safe_print("="*60)
    safe_print("RUNNING VERSION 1.0.3 - LIVE UPDATE SUCCESSFUL!")
    safe_print("VERIFICATION CODE: [ADMIN-UPDATE-PASS]")
    safe_print("="*60)

    # socket thread
    def start_socket():
        while True:
            try:
                safe_print("[SOCKET] connecting...")
                connect_socket()
                
                # If we are here, we might be connected or just returned. 
                # We need to keep the thread alive and listening or retrying.
                # connect_socket() in sender.py is a one-off attempt usually, 
                # but if we want to ensure we stay connected or wait:
                
                if sio.connected:
                   safe_print("[SOCKET] Connected.")
                   sio.wait() # This blocks until disconnect
                   safe_print("[SOCKET] socket.wait() returned (disconnected).")
                else:
                   safe_print("[SOCKET] Not connected, retrying in 5s...")
                   
            except Exception as e:
                safe_print("[SOCKET ERROR]", e)
            
            # safeguard sleep before retry
            time.sleep(5)

    threading.Thread(target=start_socket, daemon=False).start()

    # usb monitor
    threading.Thread(target=start_usb_monitor, daemon=True).start()

    # start scanner (no temp files)
    sp = start_visualizer_scanner()
    if not sp:
        safe_print("[SCAN] Scanner started in-thread or failed to spawn subprocess.")

    # update checker
    threading.Thread(target=check_for_updates, daemon=True).start()

    # main loop
    # main loop
    import functions.sender as sender
    while True:
        if sender.IS_LICENSED:
            run_scans()
        else:
            # Maybe run minimal heartbeat if not licensed
            pass
        time.sleep(3)
