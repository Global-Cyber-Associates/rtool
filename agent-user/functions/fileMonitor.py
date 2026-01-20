import os
import time
import logging
import threading
from datetime import datetime
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from .sender import send_data

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("FileMonitor")

class FileMonitorHandler(FileSystemEventHandler):
    """
    Handles file system events and sends them to the backend server.
    """
    def __init__(self):
        super().__init__()
        # Ignore common temporary files and system noise
        self.ignored_extensions = {
            '.tmp', '.log', '.crdownload', '.ini', '.dat', '.db', '.lnk', 
            '.tmp.driveupload', '.part', '.swp', '.lock'
        }
        self.ignored_dirs = {
            'AppData', 'Local', 'Temp', 'Roaming', '$Recycle.Bin', 
            'System Volume Information', 'node_modules', '.git', '.next',
            '__pycache__', '.venv', 'venv'
        }
        self.last_event_time = {} # For minimal debouncing if necessary

    def is_ignored(self, path):
        # Check extensions
        if any(path.lower().endswith(ext) for ext in self.ignored_extensions):
            return True
        
        # Check directories in path
        path_parts = path.split(os.sep)
        if any(part in self.ignored_dirs for part in path_parts):
            return True
            
        return False

    def on_created(self, event):
        if not event.is_directory and not self.is_ignored(event.src_path):
            self._send_event("Created", event.src_path)

    def on_modified(self, event):
        # Modified events can be very frequent, added a tiny throttle
        if not event.is_directory and not self.is_ignored(event.src_path):
            now = time.time()
            last_time = self.last_event_time.get(event.src_path, 0)
            if now - last_time > 1.0: # 1 second throttle per file
                self.last_event_time[event.src_path] = now
                self._send_event("Modified", event.src_path)

    def on_deleted(self, event):
        # Note: deleted events don't have a file to check for extensions in some cases,
        # but event.src_path still contains the name.
        if not event.is_directory and not self.is_ignored(event.src_path):
            self._send_event("Deleted", event.src_path)

    def on_moved(self, event):
        if not event.is_directory and not self.is_ignored(event.src_path):
            self._send_event("Moved", event.src_path, dest_path=event.dest_path)

    def _send_event(self, event_type, src_path, dest_path=None):
        try:
            # Map watchdog events to backend-expected types (Rename, Rewrite, Delete)
            mapped_type = "Rewrite"
            if event_type == "Deleted":
                mapped_type = "Delete"
            elif event_type == "Moved":
                mapped_type = "Rename"
            
            # Create a descriptive message
            filename = os.path.basename(src_path)
            description = f"File {event_type.lower()} at {src_path}"
            if dest_path:
                description = f"File moved from {src_path} to {dest_path}"

            # Construct the event object according to backend EventLog model expectations
            event = {
                "eventType": mapped_type,
                "timestamp": datetime.now().isoformat(),
                "source": "watchdog",
                "description": description,
                "details": {
                    "original_event": event_type,
                    "src_path": src_path,
                    "dest_path": dest_path,
                    "filename": filename
                }
            }

            # Wrap in the 'event_logs' format that save.js expects
            payload = {
                "events": [event]
            }

            # Send to backend via sender module with type 'event_logs'
            send_data("event_logs", payload)
            logger.info(f"[🔍] {mapped_type.upper()} ({event_type}): {src_path}")
            
        except Exception as e:
            logger.error(f"Error processing file event: {e}")

def start_file_monitor():
    """
    Initializes and starts the file monitoring process.
    Usually run in a daemon thread from main.py
    """
    logger.info("🚀 Initializing Premium File Monitor (Watchdog)...")
    
    # Target path: On Windows, we monitor the User folder.
    # Monitoring C:\ is possible but can lead to 1000s of events/sec in Windows/System32
    base_path = "C:\\Users"
    if not os.path.exists(base_path):
        base_path = os.path.expanduser("~")

    event_handler = FileMonitorHandler()
    observer = Observer()
    
    try:
        # Schedule the observer
        observer.schedule(event_handler, base_path, recursive=True)
        logger.info(f"✅ Monitoring started for path: {base_path}")
    except Exception as e:
        logger.error(f"❌ Failed to schedule monitoring for {base_path}: {e}")
        # Robust fallback
        try:
            base_path = os.path.expanduser("~")
            observer.schedule(event_handler, base_path, recursive=True)
            logger.info(f"✅ Fallback monitoring started for: {base_path}")
        except Exception as e2:
            logger.error(f"❌ Fallback monitoring failed: {e2}")
            return

    observer.start()
    
    try:
        # Keep the thread alive while the observer is running
        while True:
            time.sleep(10)
    except (KeyboardInterrupt, SystemExit):
        observer.stop()
    except Exception as e:
        logger.error(f"⚠️ File monitor loop encountered error: {e}")
        observer.stop()
        
    observer.join()
    logger.info("🛑 File monitor stopped.")

if __name__ == "__main__":
    # Test execution
    start_file_monitor()
