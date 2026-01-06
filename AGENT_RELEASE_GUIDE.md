# 📦 Agent Release Guide

This guide explains how to release a new version of the **User Agent** or **Admin Agent** with the auto-update system.

---

## 🛠️ Step 1: Update Version Metadata
Before building, you must increment the version number in **two places** for the specific agent.

### 1. Update `version.json`
Located in `agent-user/version.json` or `agent-admin/version.json`.
```json
{
    "version": "1.0.4"
}
```

### 2. Update `main.py`
Open `main.py` for the respective agent and update the startup print message to match your new version:
```python
safe_print("RUNNING VERSION 1.0.4 - LIVE UPDATE SUCCESSFUL!")
```

---

## 🏗️ Step 2: Run the Build Script
The project includes a unified build script `build_release.py` that handles compilation, ZIP packaging, SHA256 hashing, and manifest updates.

Open your terminal in the root directory and run:

### For User Agent:
```bash
python build_release.py --app user
```

### For Admin Agent:
```bash
python build_release.py --app admin
```

### For Both:
```bash
python build_release.py --app all
```

**What this script does:**
1.  Compiles the Python script into a single-file `.exe` using PyInstaller.
2.  Includes all data folders (like `visualizer-scanner`).
3.  Creates a ZIP archive in `backend/public/updates/`.
4.  Calculates the SHA256 hash of the ZIP.
5.  Updates the `manifest-user.json` or `manifest-admin.json` with the new version and hash.

---

## ✅ Step 3: Verification
Once the script finishes, verify the following:

1.  **ZIP exists**: Check `backend/public/updates/` for `agent-user.zip` or `agent-admin.zip`.
2.  **Manifest updated**: Check `backend/public/updates/manifest-user.json` (or admin). It should reflect the new version and the generated hash.
3.  **Local Test**: Run an older version of the agent. Within 60 seconds (or after a restart), it should detect the update, launch `updater.exe`, and restart as the new version.

---

## ⚠️ Important Notes
- **Don't delete `updater.exe`**: Always ensure `updater.exe` is in the `dist` folder and eventually in the client's `C:\visun\` root.
- **Port Compatibility**: Ensure the `SERVER_URL` in `.env` points to the correct backend address during build time if hardcoded anywhere, though it is primarily read from `.env` at runtime.
- **Dependencies**: If you add new folders to the agent that must be included in the release, update the `--add-data` flags in `build_release.py`.
