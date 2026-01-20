import time
import psutil
import threading
from datetime import datetime, timezone
import logging
from .sender import send_data

# Optional imports for window titles
try:
    import win32gui
    import win32process
    HAS_WIN32 = True
except ImportError:
    HAS_WIN32 = False

class AppUsageTracker:
    def __init__(self, check_interval=2.0):
        self.check_interval = check_interval
        self.active_processes = {}  # pid -> { name, start_time (UTC), title }
        self.running = False

    def get_window_title(self, pid):
        if not HAS_WIN32:
            return ""
        title = ""
        def callback(hwnd, _):
            nonlocal title
            if win32gui.IsWindowVisible(hwnd):
                _, found_pid = win32process.GetWindowThreadProcessId(hwnd)
                if found_pid == pid:
                    t = win32gui.GetWindowText(hwnd)
                    if t:
                        title = t
        try:
            win32gui.EnumWindows(callback, None)
        except:
            pass
        return title

    def scan(self):
        try:
            # Snapshot current PIDs
            current_pids = set(psutil.pids())
            tracked_pids = set(self.active_processes.keys())
            
            # 1. Identify New Processes
            new_pids = current_pids - tracked_pids
            for pid in new_pids:
                try:
                    p = psutil.Process(pid)
                    name = p.name()
                    
                    if not name: continue
                    
                    # Capture initial title
                    title = self.get_window_title(pid)
                    
                    now_utc = datetime.now(timezone.utc)
                    
                    self.active_processes[pid] = {
                        "name": name,
                        "start_time": now_utc,
                        "title": title
                    }
                    
                    # Emit OPEN Event
                    send_data("app_usage", {
                        "eventType": "OPEN",
                        "appName": name,
                        "pid": pid,
                        "timestamp": now_utc.isoformat(),
                        "title": title
                    })
                    
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue
                except Exception as e:
                    logging.error(f"[AppTracker] New PID Error: {e}")

            # 2. Identify Closed Processes
            closed_pids = tracked_pids - current_pids
            for pid in closed_pids:
                info = self.active_processes.pop(pid)
                
                close_time = datetime.now(timezone.utc)
                duration_ms = (close_time - info["start_time"]).total_seconds() * 1000
                
                # Emit CLOSE Event
                send_data("app_usage", {
                    "eventType": "CLOSE",
                    "appName": info["name"],
                    "pid": pid,
                    "timestamp": close_time.isoformat(),
                    "title": info["title"], # Last known title
                    "duration": int(duration_ms)
                })

            # 3. Update Titles for Active Processes
            # We optimize by enumerating windows ONCE and mapping back to PIDs
            if HAS_WIN32:
                pid_title_map = {}
                def enum_cb(hwnd, _):
                    if win32gui.IsWindowVisible(hwnd):
                        try:
                            _, p = win32process.GetWindowThreadProcessId(hwnd)
                            t = win32gui.GetWindowText(hwnd)
                            if t and p in self.active_processes:
                                pid_title_map[p] = t
                        except: pass
                
                try:
                    win32gui.EnumWindows(enum_cb, None)
                    
                    # Check for changes
                    for pid, new_title in pid_title_map.items():
                        process_info = self.active_processes[pid]
                        if new_title != process_info["title"]:
                            process_info["title"] = new_title
                            
                            # Emit UPDATE_TITLE Event
                            send_data("app_usage", {
                                "eventType": "UPDATE_TITLE",
                                "appName": process_info["name"],
                                "pid": pid,
                                "timestamp": datetime.now(timezone.utc).isoformat(),
                                "title": new_title
                            })
                except Exception as e:
                    pass

        except Exception as e:
            logging.error(f"[AppTracker] Scan Error: {e}")

    def loop(self):
        self.running = True
        while self.running:
            self.scan()
            time.sleep(self.check_interval)

    def start(self):
        logging.info("[AppTracker] Starting usage tracker thread...")
        threading.Thread(target=self.loop, daemon=True).start()
