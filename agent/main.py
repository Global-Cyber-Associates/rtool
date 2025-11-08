import time
import traceback

from functions.system import get_system_info
from functions.ports import scan_ports
from functions.taskmanager import collect_process_info
from functions.installed_apps import get_installed_apps
from functions.usbMonitor import get_usb_devices_once
from functions.sender import send_data


def run_scans():
    print("[⚙️] Running all scans...")

    try:
        # --- 1. System Info ---
        print("[🧠] Collecting system information...")
        sys_info = get_system_info()
        send_data("system_info", sys_info)
        print("    ✔ System info collected and saved.")

        # --- 2. Port Scan ---
        print("[🌐] Scanning ports 1-1024 on localhost...")
        port_data = scan_ports("127.0.0.1", "1-1024")
        send_data("port_scan", port_data)
        print("    ✔ Port scan completed and saved.")

        # --- 3. Task Manager ---
        print("[🧩] Collecting running processes...")
        process_data = collect_process_info()
        send_data("task_info", process_data)
        print("    ✔ Process info collected and saved.")

        # --- 4. Installed Apps ---
        print("[💻] Gathering installed applications...")
        app_data = get_installed_apps()
        send_data("installed_apps", {"apps": app_data, "count": len(app_data)})
        print(f"    ✔ Found {len(app_data)} installed apps.")

        # --- 5. USB Devices ---
        print("[🔌] Checking connected USB devices...")
        usb_data = get_usb_devices_once()
        send_data("usb_devices", usb_data)
        print("    ✔ USB device data collected and saved.")

        print("\n✅ All scans completed successfully.\n")

    except Exception as e:
        print(f"[❌] Error during scans: {e}")
        print(traceback.format_exc())


if __name__ == "__main__":
    while True:
        run_scans()
        print("[⏳] Waiting 60 seconds before next scan...\n")
        time.sleep(5)
