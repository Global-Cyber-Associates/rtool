import zipfile
import json
import hashlib
import os

# Paths
UPDATE_DIR = r"e:\GCA\tools\cloud\ntool\backend\public\updates"
ZIP_NAME = "agent-user.zip"
MANIFEST_NAME = "manifest-user.json"

def create_update_package():
    # 1. Create a dummy version.json for the update
    v_data = {"version": "1.0.1"}
    
    zip_path = os.path.join(UPDATE_DIR, ZIP_NAME)
    
    print(f"Creating {zip_path}...")
    with zipfile.ZipFile(zip_path, 'w') as zf:
        # Write version.json into the zip
        zf.writestr("version.json", json.dumps(v_data, indent=2))
        # Add a dummy text file to prove it updated
        zf.writestr("update_success.txt", "This file proves the update was downloaded!")

    # 2. Calculate Hash
    sha = hashlib.sha256()
    with open(zip_path, 'rb') as f:
        while chunk := f.read(8192):
            sha.update(chunk)
    file_hash = sha.hexdigest()
    
    print(f"SHA256: {file_hash}")

    # 3. Update Manifest
    manifest_path = os.path.join(UPDATE_DIR, MANIFEST_NAME)
    with open(manifest_path, 'r') as f:
        manifest = json.load(f)
    
    manifest["hash"] = file_hash
    manifest["version"] = "1.0.1" # Ensure version matches
    
    with open(manifest_path, 'w') as f:
        json.dump(manifest, f, indent=2)
        
    print(f"Updated {MANIFEST_NAME} with new hash.")

if __name__ == "__main__":
    if not os.path.exists(UPDATE_DIR):
        os.makedirs(UPDATE_DIR)
    create_update_package()
