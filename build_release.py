import os
import sys
import shutil
import zipfile
import json
import hashlib
import subprocess
import traceback

PROJECT_ROOT = r"e:\GCA\tools\cloud\ntool"
PUBLIC_UPDATES = os.path.join(PROJECT_ROOT, "backend", "public", "updates")

def build_app(app_id):
    """
    Builds a specific app (agent-user or agent-admin)
    """
    if app_id == "agent-user":
        name = "visun-agent-user"
        dir_name = "agent-user"
        manifest_name = "manifest-user.json"
    elif app_id == "agent-admin":
        name = "visun-agent-admin"
        dir_name = "agent-admin"
        manifest_name = "manifest-admin.json"
    else:
        print(f"[ERR] Unknown app_id: {app_id}")
        return

    print(f"\n[START] RELEASE BUILD FOR {app_id.upper()}")
    
    app_dir = os.path.join(PROJECT_ROOT, dir_name)
    dist_dir = os.path.join(app_dir, "dist")
    version_file = os.path.join(app_dir, "version.json")
    manifest_file = os.path.join(PUBLIC_UPDATES, manifest_name)
    
    if not os.path.exists(version_file):
        print(f"[FAIL] version.json missing in {app_dir}")
        return

    # 1. Read Version
    with open(version_file, "r") as f:
        v_data = json.load(f)
        version = v_data["version"]
    print(f"[INFO] Target Version: {version}")

    # 2. Compile
    print(f"[BUILD] Compiling {name}.exe...")
    
    pyinstaller_cmd = [
        "pyinstaller", 
        "--onefile", 
        # "--noconsole", 
        "--name", name, 
        os.path.join(app_dir, "main.py"),
        "--noconfirm"
    ]
    
    # 🔹 ADD DATA for Admin Agent
    if app_id == "agent-admin":
        # Bundling visualizer-scanner and python-embed
        pyinstaller_cmd.extend([
            "--add-data", f"visualizer-scanner;visualizer-scanner",
            "--add-data", f"python-embed;python-embed"
        ])
        
    subprocess.check_call(pyinstaller_cmd, cwd=app_dir)
    
    exe_path = os.path.join(dist_dir, f"{name}.exe")
    if not os.path.exists(exe_path):
        print("[FAIL] Compilation failed: Executable not found.")
        return

    # 3. Create ZIP
    zip_name = f"{app_id}.zip"
    zip_output_path = os.path.join(PUBLIC_UPDATES, zip_name)
    
    print(f"[ZIP] Creating ZIP: {zip_output_path}")
    if not os.path.exists(PUBLIC_UPDATES):
        os.makedirs(PUBLIC_UPDATES)

    with zipfile.ZipFile(zip_output_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        zf.write(exe_path, f"{name}.exe")
        zf.write(version_file, "version.json")
        
    # 4. Calculate Hash
    print("[HASH] Calculating SHA256...")
    sha = hashlib.sha256()
    with open(zip_output_path, 'rb') as f:
        while chunk := f.read(8192):
            sha.update(chunk)
    file_hash = sha.hexdigest()
    
    # 5. Update Manifest
    print(f"[MANIFEST] Updating {manifest_name}...")
    if not os.path.exists(manifest_file):
        # Create default manifest if missing
        manifest = {"version": "0.0.0", "url": "", "hash": "", "required": False}
    else:
        with open(manifest_file, 'r') as f:
            manifest = json.load(f)
        
    manifest["version"] = version
    manifest["hash"] = file_hash
    manifest["url"] = f"/updates/{zip_name}"
    
    with open(manifest_file, 'w') as f:
        json.dump(manifest, f, indent=2)

    print(f"[DONE] {app_id.upper()} COMPLETE!")
    print(f"   Version: {version}")
    print(f"   Hash:    {file_hash}")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--app", choices=["user", "admin", "all"], default="user")
    args = parser.parse_args()

    try:
        if args.app == "user":
            build_app("agent-user")
        elif args.app == "admin":
            build_app("agent-admin")
        else:
            build_app("agent-user")
            build_app("agent-admin")
    except Exception as e:
        print(f"[ERR] Error during build: {traceback.format_exc()}")
