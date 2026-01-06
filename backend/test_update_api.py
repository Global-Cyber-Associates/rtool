import requests
import json
import sys

BASE_URL = "http://localhost:5000/api/agent/update"

def test_endpoint(params=None, description=""):
    print(f"Testing: {description}")
    try:
        url = BASE_URL
        if params:
            import urllib.parse
            url += "?" + urllib.parse.urlencode(params)
        
        print(f"  GET {url}")
        res = requests.get(url, timeout=2)
        
        if res.status_code == 200:
            data = res.json()
            print(f"  [OK] Success: Got manifest for version {data.get('version')}")
            print(f"  [URL] URL: {data.get('url')}")
            return data
        else:
            print(f"  [FAIL] Failed: Status {res.status_code}")
            return None
    except Exception as e:
        print(f"  [ERR] Error: {e}")
        return None
    print("-" * 40)

def main():
    print("=== BACKEND UPDATE API TEST ===\n")

    # 1. Default (Agent User)
    data = test_endpoint(None, "Default (No params) -> Should be Agent User")
    if data and "agent-user.zip" not in data.get("url", ""):
        print("  ⚠️ WARNING: Expected agent-user.zip in URL")

    print("-" * 40)

    # 2. Explicit Agent User
    data = test_endpoint({"app": "agent-user"}, "?app=agent-user -> Should be Agent User")
    if data and "agent-user.zip" not in data.get("url", ""):
        print("  ⚠️ WARNING: Expected agent-user.zip in URL")

    print("-" * 40)

    # 3. Agent Admin
    data = test_endpoint({"app": "agent-admin"}, "?app=agent-admin -> Should be Agent Admin")
    if data and "agent-admin.zip" not in data.get("url", ""):
        print("  ⚠️ WARNING: Expected agent-admin.zip in URL")
        
    print("-" * 40)
    
    # 4. Unknown App (Should default to User)
    data = test_endpoint({"app": "foo-bar"}, "?app=foo-bar -> Should default to Agent User")
    if data and "agent-user.zip" not in data.get("url", ""):
        print("  ⚠️ WARNING: Expected fallback to agent-user.zip")

if __name__ == "__main__":
    main()
