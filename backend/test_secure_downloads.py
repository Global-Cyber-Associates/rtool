import requests
import json
import os

# Configuration
SERVER_URL = "http://localhost:5000"
API_PATH = "/api/agent/update/download"

def test_secure_download():
    print("--- 🧪 SECURE DOWNLOAD TEST SUITE ---")
    
    # 1. Get a valid Tenant ID and Key from the database (simulated or fetched)
    # For this test, you'll need to provide a real ID from your MongoDB
    # You can get one from the Dashboard or by running a small JS script.
    
    tenant_id = input("Enter a valid Tenant ID (ObjectId) to test: ").strip()
    tenant_key = input("Enter the corresponding Tenant Enrollment Key: ").strip()
    
    if not tenant_id or not tenant_key:
        print("[!] Test skipped: Need real IDs to verify MongoDB matching.")
        return

    # TEST A: Valid Download via tenantId (Frontend Style)
    print(f"\n[TEST A] Downloading agent-user via tenantId...")
    url_a = f"{SERVER_URL}{API_PATH}?app=agent-user&tenantId={tenant_id}"
    res_a = requests.get(url_a, stream=True)
    if res_a.status_code == 200:
        print(f"✅ Success! Received file. Status: {res_a.status_code}")
    else:
        print(f"❌ Failed! Status: {res_a.status_code}, Msg: {res_a.text}")

    # TEST B: Valid Download via tenantKey (Agent Style)
    print(f"\n[TEST B] Downloading agent-admin via tenantKey...")
    url_b = f"{SERVER_URL}{API_PATH}?app=agent-admin&tenantKey={tenant_key}"
    res_b = requests.get(url_b, stream=True)
    if res_b.status_code == 200:
        print(f"✅ Success! Received file. Status: {res_b.status_code}")
    else:
        print(f"❌ Failed! Status: {res_b.status_code}, Msg: {res_b.text}")

    # TEST C: Invalid Tenant
    print(f"\n[TEST C] Downloading with FAKE tenant identifier...")
    url_c = f"{SERVER_URL}{API_PATH}?app=agent-user&tenantKey=fake_key_123"
    res_c = requests.get(url_c)
    if res_c.status_code == 403:
        print(f"✅ Correctly Blocked (403 Forbidden)")
    else:
        print(f"❌ Error: Expected 403, got {res_c.status_code}")

    # TEST D: Direct Static Access (Should be blocked now)
    print(f"\n[TEST D] Checking direct static access to /updates/agent-user.zip...")
    url_d = f"{SERVER_URL}/updates/agent-user.zip"
    res_d = requests.get(url_d)
    if res_d.status_code == 404 or res_d.status_code == 403:
        print(f"✅ Correctly Blocked/Hidden (Status: {res_d.status_code})")
    else:
        print(f"❌ Security Risk: Static access still works! Status: {res_d.status_code}")

    print("\n[DONE] Test suite finished.")
    print("Check your server console to see the '📡 [DOWNLOAD]' log entries!")

if __name__ == "__main__":
    test_secure_download()
