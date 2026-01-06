import requests
import json
import os
import hashlib
import sys

# Configuration
# Adjust SERVER_URL if your backend is on a different port/IP
SERVER_URL = "http://localhost:5000" 
AGENT_TYPE = "agent-user" # or agent-admin

# Path to where the agent is supposedly installed
AGENT_DIR = r"C:\visun\agent_current"
VERSION_FILE = os.path.join(AGENT_DIR, "version.json")

def get_local_version():
    if not os.path.exists(VERSION_FILE):
        print(f"⚠️  Version file not found at {VERSION_FILE}")
        return "0.0.0"
    try:
        with open(VERSION_FILE, 'r') as f:
            data = json.load(f)
            return data.get("version", "0.0.0")
    except Exception as e:
        print(f"❌ Error reading version.json: {e}")
        return "0.0.0"

def check_update():
    print(f"=== TEST UPDATE FLOW ({AGENT_TYPE}) ===")
    
    # 1. Local Version
    local_v = get_local_version()
    print(f"[INFO] Local Version:  {local_v}")
    
    # 2. Check Backend
    url = f"{SERVER_URL}/api/agent/update?app={AGENT_TYPE}"
    print(f"[INFO] Checking URL:   {url}")
    
    try:
        res = requests.get(url, timeout=5)
        if res.status_code != 200:
            print(f"[ERR] Backend returned status {res.status_code}")
            return
            
        manifest = res.json()
        remote_v = manifest.get("version")
        print(f"[INFO] Remote Version: {remote_v}")
        
        # 3. Compare
        if remote_v == local_v:
            print("[OK] Status: System is UP TO DATE.")
            print("     (To test update, change version in manifest-user.json on backend to higher value)")
            return
            
        print(f"[UP] Status: Update Available! ({local_v} -> {remote_v})")
        
        # 4. Download & Verify
        dl_url = manifest.get('url')
        if not dl_url:
            print("[ERR] No URL in manifest.")
            return

        if not dl_url.startswith('http'):
            dl_url = f"{SERVER_URL}{dl_url}"
            
        print(f"     Downloading from: {dl_url}")
        
        r = requests.get(dl_url, stream=True)
        if r.status_code == 200:
            total = 0
            sha = hashlib.sha256()
            
            # Streaming download (don't save to disk for test, just hash)
            for chunk in r.iter_content(chunk_size=8192):
                total += len(chunk)
                sha.update(chunk)
            
            calc_hash = sha.hexdigest()
            manifest_hash = manifest.get('hash', "")
            
            print(f"     Size: {total} bytes")
            print(f"     Calculated Hash: {calc_hash}")
            print(f"     Manifest Hash:   {manifest_hash}")
            
            if manifest_hash:
                if calc_hash == manifest_hash:
                    print("     [MATCH] HASH MATCH: The update package is valid and secure.")
                    print("     [PASS] flow verification PASSED. The agent would launch updater.exe now.")
                else:
                    print("     [FAIL] HASH MISMATCH: The download is corrupt or tampered.")
            else:
                print("     [WARN] WARNING: No hash in manifest to verify against.")
        else:
            print(f"     [FAIL] Download failed with status {r.status_code}")
                
    except requests.exceptions.ConnectionError:
        print(f"[ERR] Connection Refused. Is the backend running on {SERVER_URL}?")
    except Exception as e:
        print(f"[ERR] Error: {e}")

if __name__ == "__main__":
    check_update()
