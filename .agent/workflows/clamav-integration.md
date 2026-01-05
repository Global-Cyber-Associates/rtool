---
description: Design and Implementation Plan for ClamAV Antivirus Integration
---

# ClamAV Antivirus Integration Workflow

This workflow outlines the architectural design and implementation steps for integrating **ClamAV** into the VisuN Agent ecosystem. This will provide real-time malware detection and manual file scanning capabilities across all managed endpoints.

## 1. Agent Architecture (Endpoint Scanning) 
- **Dependency**: Ensure `clamd` (daemon) or `clamscan` (CLI) is installed on the host machine.
- **Process Management**:
    - The VisuN Agent (Go/Node) will spawn a child process to interact with `clamscan`.
    - Real-time protection can be achieved by monitoring file system events (e.g., using `fsnotify` in Go or `chokidar` in Node) and passing new files to `clamd` via unix socket or TCP.
- **Data Collection**:
    - Filter and parse CLI output to extract: `Infected files count`, `Threat names`, `Scan duration`, and `Resource usage`.
    - Send periodic progress updates (percentage) to the backend via Socket.io.

## 2. Backend Logic (Orchestration & Reporting)
- **Database Schema**:
    - Extend the `Agent` or `Scan` models to include a `malwareScans` array.
    - Fields: `scanId`, `timestamp`, `status` (Running, Completed, Quarantined), `infectedFiles` (array of paths + threat names).
- **Control Endpoints**:
    - `POST /api/scan/antivirus/:agentId`: Trigger a scan on a specific agent.
    - `POST /api/scan/antivirus/report`: Endpoint for agents to submit final scan results.
- **Socket.io Integration**:
    - Emit `START_AV_SCAN` event to specific agents.
    - Listen for `AV_SCAN_PROGRESS` and `AV_THREAT_DETECTED` events for real-time dashboard updates.

## 3. Frontend Implementation (Visibility & Control)
- **UI Component**:
    - Create `frontend/src/components/scan/AntivirusScan.jsx`.
    - Features: 
        - **Scan Dashboard**: Total threats detected across the fleet.
        - **Real-time Console**: A stream of scanned files and their status.
        - **Threat Table**: Filterable list of infected files with action buttons (Quarantine, Delete, Whitelist).
- **Visualization**:
    - Update the Dashboard metrics to show "Fleet Health Index" based on AV data.
    - Add a "Security Suite" tab in the Device Detail page to manage local AV settings.

## 4. Implementation Steps (Phased Rollout)
1. **Phase 1 (Design)**: Define JSON structures for threat reports.
2. **Phase 2 (Agent)**: Implement the bridge between the VisuN Agent and the local ClamAV installation.
3. **Phase 3 (Backend)**: Build the persistence layer for AV history.
4. **Phase 4 (Frontend)**: Design the "Antivirus Hub" in the web console using the current premium theme.

## 5. Security & Performance
- **Resource Capping**: Configure the agent to run scans with low process priority (nice/cpulimit) to ensure zero impact on host performance.
- **Privacy**: Only upload file metadata (path, hash, threat name) to the server, never the actual file contents.