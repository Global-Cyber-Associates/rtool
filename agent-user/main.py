import time
import traceback
import threading
import subprocess
import shutil
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
from dotenv import load_dotenv

# Load env from current directory (where exe is)
load_dotenv()

# ============================
# UTILITIES
# ============================
def safe_print(*args, **kwargs):
    # SILENT MODE: No console output for production robustness
    # ENABLED FOR DEBUGGING
    try:
        print(*args, **kwargs)
        sys.stdout.flush()
    except:
        pass

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
            time.sleep(60) # Wait 60s before first check, then every hour? Or just loop. 
            # Let's check every 10 mins for dev, maybe 60 mins prod.
            # Using 10 mins for now to be responsive.
            
            # Load local version
            # When running as EXE, we want the dir of the EXE, not the temp extraction dir
            exe_dir = os.path.dirname(os.path.abspath(sys.executable))
            version_file = os.path.join(exe_dir, "version.json")
            local_version = "0.0.0"
            if os.path.exists(version_file):
                with open(version_file, "r") as f:
                    local_version = json.load(f).get("version", "0.0.0")

            SERVER_URL = os.getenv("SERVER_URL")
            if not SERVER_URL: continue

            # Get Manifest
            res = requests.get(f"{SERVER_URL}/api/agent/update", timeout=10)
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
    
    safe_print("="*60)
    safe_print("RUNNING VERSION 1.0.2 - LIVE UPDATE SUCCESSFUL!")
    safe_print("VERIFICATION CODE: [FLIGHT-102-BRAVO]")
    safe_print("="*60)
    
    # update checker
    threading.Thread(target=check_for_updates, daemon=True).start()

    # main loop
    import functions.sender as sender
    while True:
        if sender.IS_LICENSED:
            run_scans()
        else:
            # Wait for licensing...
            pass
        time.sleep(30) # Scans every 30s instead of loop-hammering
