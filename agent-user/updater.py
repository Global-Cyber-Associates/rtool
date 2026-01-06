import os
import sys
import shutil
import time
import subprocess
import zipfile
import argparse
import traceback

# ==================================================================================
# UPDATER CONFIGURATION
# ==================================================================================
# The updater expects to run FROM the root directory (e.g., C:\visun\)
# Structure:
#   C:\visun\updater.exe
#   C:\visun\agent_current\  (Active Agent)
#   C:\visun\agent_previous\ (Backup)
#   C:\visun\agent_new\      (Temp extraction)

AGENT_DIR_NAME = "agent_current"
BACKUP_DIR_NAME = "agent_previous"
TEMP_DIR_NAME = "agent_new"

# Use absolute path for log file in the same directory as the updater EXE
if getattr(sys, 'frozen', False):
    EXE_DIR = os.path.dirname(sys.executable)
else:
    EXE_DIR = os.path.dirname(os.path.abspath(__file__))

LOG_FILE = os.path.join(EXE_DIR, "updater.log")
log_handle = None

def log(msg):
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
    entry = f"[{timestamp}] {msg}"
    print(entry)
    try:
        with open(LOG_FILE, "a") as f:
            f.write(entry + "\n")
    except Exception as e:
        print(f"CRITICAL: FAILED TO WRITE TO {LOG_FILE}: {e}")

# Initial log to confirm path
print(f"--- UPDATER STARTING (LOG: {LOG_FILE}) ---")
log("Updater process started.")

def safe_rename(src, dst, retries=5, delay=2):
    """Attempts to rename with retries for Windows locking issues."""
    for i in range(retries):
        try:
            if os.path.exists(dst):
                if os.path.isdir(dst): shutil.rmtree(dst)
                else: os.remove(dst)
            os.rename(src, dst)
            return True
        except Exception as e:
            log(f"Rename attempt {i+1} failed ({src} -> {dst}): {e}")
            time.sleep(delay)
    return False

def safe_rmtree(path, retries=5, delay=2):
    """Attempts to remove directory with retries."""
    for i in range(retries):
        try:
            if os.path.exists(path):
                shutil.rmtree(path)
            return True
        except Exception as e:
            log(f"Remove attempt {i+1} failed ({path}): {e}")
            time.sleep(delay)
    return False

def wait_for_pid(pid):
    """Waits for the specified process ID to terminate."""
    if not pid:
        return
    log(f"Waiting for PID {pid} to terminate...")
    try:
        # Windows specific wait
        while True:
            try:
                # OpenProcess with SYNCHRONIZE (0x00100000)
                # If process doesn't exist, OSError will likely be raised or handle invalid
                import ctypes
                kernel32 = ctypes.windll.kernel32
                handle = kernel32.OpenProcess(0x00100000, False, int(pid))
                if handle == 0:
                    break # Process already gone
                
                # Check status
                ret = kernel32.WaitForSingleObject(handle, 1000) # Wait 1 sec
                kernel32.CloseHandle(handle)
                
                if ret == 0: # WAIT_OBJECT_0 (Signaled/Terminated)
                    break
            except:
                break
    except Exception as e:
        log(f"Error waiting for PID: {e}")
    
    # Extra safety grace period for file handles to close
    time.sleep(2)
    log("Process terminated.")

def restore_backup(root_dir):
    """Restores agent_previous to agent_current."""
    log("[!] INITIATING ROLLBACK...")
    current_path = os.path.join(root_dir, AGENT_DIR_NAME)
    backup_path = os.path.join(root_dir, BACKUP_DIR_NAME)
    
    try:
        # Rename broken current to broken_timestamp
        if os.path.exists(current_path):
            broken_name = f"agent_broken_{int(time.time())}"
            if safe_rename(current_path, os.path.join(root_dir, broken_name)):
                log(f"Moved broken agent to {broken_name}")
            
        # Move backup to current
        if os.path.exists(backup_path):
            if safe_rename(backup_path, current_path):
                log("Restored backup to agent_current")
                return True
        else:
            log("[x] CRITICAL: No backup found to restore!")
            return False
            
    except Exception as e:
        log(f"[x] Rollback failed: {e}")
        return False

def health_check(root_dir, main_executable):
    """
    Monitor the new process for 10 seconds.
    If it dies, return False.
    """
    executable_path = os.path.join(root_dir, AGENT_DIR_NAME, main_executable)
    log(f"Launching new agent for Health Check: {executable_path}")
    
    try:
        # Launch detached
        # Launch with new console but NOT detached (prevents WinError 87)
        process = subprocess.Popen(
            [executable_path],
            cwd=os.path.join(root_dir, AGENT_DIR_NAME),
            creationflags=subprocess.CREATE_NEW_CONSOLE
        )
        
        log(f"New process started with PID {process.pid}. Monitoring for 10s...")
        
        for i in range(10):
            time.sleep(1)
            if process.poll() is not None:
                log(f"[x] New agent crashed immediately! Exit code: {process.returncode}")
                return False
        
        log("[v] Health Check Passed! Agent is stable.")
        return True
        
    except Exception as e:
        log(f"[x] Failed to launch new agent: {e}")
        return False

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--pid", help="PID of the running agent to wait for")
    parser.add_argument("--zip", help="Path to the update zip file")
    parser.add_argument("--root", default=os.getcwd(), help="Root installation directory")
    parser.add_argument("--exe", default="main.exe", help="Name of the main executable to launch")
    args = parser.parse_args()

    log("="*50)
    log("UPDATER STARTED")
    log("="*50)
    
    root_dir = os.path.abspath(args.root)
    zip_path = os.path.abspath(args.zip)
    target_exe = args.exe

    # Change CWD to root to avoid locking agent_current
    os.chdir(root_dir)
    log(f"Switched CWD to {root_dir}")
    
    if not os.path.exists(zip_path):
        log(f"[x] Zip file not found: {zip_path}")
        return

    # 1. Wait for Main Agent to exit
    wait_for_pid(args.pid)

    # Paths
    current_path = os.path.join(root_dir, AGENT_DIR_NAME)
    backup_path = os.path.join(root_dir, BACKUP_DIR_NAME)
    temp_extract_path = os.path.join(root_dir, TEMP_DIR_NAME)

    try:
        # 2. BLUE/GREEN: Create Backup
        if os.path.exists(backup_path):
            safe_rmtree(backup_path)
        
        if os.path.exists(current_path):
            log(f"Backing up {current_path} -> {backup_path}")
            if not safe_rename(current_path, backup_path):
                raise PermissionError(f"Failed to backup {AGENT_DIR_NAME}. Directory might be locked.")
        else:
            log("No existing agent found to backup.")

        # 3. Install New Version
        log(f"Extracting update from {zip_path}...")
        if os.path.exists(temp_extract_path):
            safe_rmtree(temp_extract_path)
            
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(temp_extract_path)
            
        # Move extracted -> agent_current
        log(f"Installing to {current_path}...")
        if not safe_rename(temp_extract_path, current_path):
            raise PermissionError("Failed to install new version. Directory might be locked.")
        
        # 3.5 Restore persistent files from backup (.env)
        # These files are machine-specific and usually not in the update zip
        persistent_files = [".env"]
        for pf in persistent_files:
            pf_source = os.path.join(backup_path, pf)
            pf_dest = os.path.join(current_path, pf)
            if os.path.exists(pf_source):
                log(f"Restoring persistent file from backup: {pf}")
                try:
                    shutil.copy2(pf_source, pf_dest)
                except Exception as e:
                    log(f"Warning: Could not restore {pf}: {e}")
        
        # 4. Launch & Health Check
        # Use provided exe name, fallback to check existence
        main_exe_path = os.path.join(current_path, target_exe)
        if not os.path.exists(main_exe_path):
             # Try fallback to main.py if target_exe was default and not found?
             if os.path.exists(os.path.join(current_path, "main.py")):
                 target_exe = "main.py"
             else:
                 log(f"[x] Could not find {target_exe} or main.py in update!")
                 raise FileNotFoundError(f"{target_exe} missing")

        if not health_check(root_dir, target_exe):
            # 5. ROLLBACK on Failure
            log("Triggering rollback due to health check failure...")
            
            # Kill the failed process (logic inside health_check handles clean exit check, 
            # effectively if it returns False, the process is likely dead or we assume it's bad.
            # If it's a "zombie" (stuck but health check timed out? No, we wait 10s and check poll).
            # If poll is None, it means it IS running. 
            # Wait, my logic: "if process.poll() is not None: return False". 
            # So if it returns False, it CRASHED. We don't need to kill it.
            
            success = restore_backup(root_dir)
            if success:
                # Try to launch the backup
                log("Launching restored backup...")
                try:
                    subprocess.Popen(
                        [os.path.join(current_path, target_exe)],
                        cwd=current_path,
                        creationflags=subprocess.CREATE_NEW_CONSOLE
                    )
                except Exception as launch_err:
                    log(f"[x] Critical: Failed to launch restored backup: {launch_err}")
            else:
                log("[x] FATAL: Rollback failed. Agent is dead.")

    except Exception as e:
        log(f"[x] Update failed validation/install: {traceback.format_exc()}")
        log("Attempting rollback...")
        restore_backup(root_dir)
        # Attempt restart of backup
        try:
             subprocess.Popen(
                [os.path.join(root_dir, AGENT_DIR_NAME, target_exe)],
                cwd=os.path.join(root_dir, AGENT_DIR_NAME),
                creationflags=subprocess.CREATE_NEW_CONSOLE | subprocess.DETACHED_PROCESS
            )
        except:
            pass

if __name__ == "__main__":
    try:
        main()
        log("Update finished. Window will close in 5 seconds...")
        time.sleep(5)
    except Exception as e:
        err_msg = f"CRITICAL UPDATER ERROR: {traceback.format_exc()}"
        print("\n" + "!"*60)
        print(err_msg)
        print("!"*60)
        try:
            with open(LOG_FILE, "a") as f:
                f.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {err_msg}\n")
        except:
            pass
        input("\nPress Enter to close this window...")
