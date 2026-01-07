import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./dashboard.css";
import socket from "../../utils/socket.js";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

// ================================
// SAFE FORMATTERS
// ================================
function formatCPU(cpu) {
  if (!cpu) return "-";
  return `${cpu.physical_cores}C/${cpu.logical_cores}T @ ${cpu.cpu_freq_mhz} MHz`;
}

function formatRAM(mem) {
  if (!mem) return "-";
  const gb = (mem.total_ram / 1024 / 1024 / 1024).toFixed(1);
  return `${gb} GB`;
}

function formatOS(os) {
  if (!os) return "-";
  return os;
}

const formatTime = (time) => {
  if (!time) return "Unknown";
  return new Date(time).toLocaleString();
};

const formatMAC = (mac) => {
  if (!mac || mac === "Unknown") return "Unknown";
  // Remove all non-hex chars
  const clean = mac.replace(/[^a-fA-F0-9]/g, "");
  if (clean.length !== 12) return mac; // Return as is if it doesn't look like a standard MAC
  // Split into pairs and join with colons
  return clean.match(/.{1,2}/g).join(":").toUpperCase();
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [snapshot, setSnapshot] = useState({
    summary: { all: 0, active: 0, inactive: 0, routers: 0, unknown: 0 },
    allDevices: [],
    activeAgents: [],
    inactiveAgents: [],
    unknownDevices: [],
    routers: [],
  });

  const [lastUpdated, setLastUpdated] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let currentDataHash = "";

    // 1️⃣ Initial Load
    const fetchSnap = async () => {
      try {
        setLoading(true);
        const token = sessionStorage.getItem("token");
        const res = await fetch(`${BACKEND_URL}/api/dashboard`, {
          headers: { "Authorization": `Bearer ${token}` },
        });

        if (!res.ok) throw new Error("Dashboard fetch failed");
        const snap = await res.json();
        console.log("📊 [Dashboard] Initial Fetch:", {
          unknownCount: snap.summary?.unknown,
          unknownArray: snap.unknownDevices?.length,
          fullSummary: snap.summary
        });
        // Stable hash of relevant data
        const newHash = JSON.stringify(snap.allDevices);
        currentDataHash = newHash;

        setSnapshot(snap);
        setLastUpdated(new Date());
      } catch (err) {
        console.error("Dashboard init load error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSnap();

    // 2️⃣ Real-time Listeners (Sync with Agreggator)
    socket.on("dashboard_update", (snap) => {
      const newHash = JSON.stringify(snap.allDevices);
      if (newHash === currentDataHash) return;

      currentDataHash = newHash;
      console.log("📊 [Dashboard] Socket Update Received (CHANGED):", {
        summary: snap.summary,
        count: snap.unknownDevices?.length
      });
      setSnapshot(snap);
      setLastUpdated(new Date());
    });

    return () => {
      socket.off("dashboard_update");
    };
  }, []);

  const {
    summary,
    activeAgents,
    inactiveAgents,
    unknownDevices,
    routers,
  } = snapshot;

  return (
    <div className="dashboard-content-wrapper">

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <h1 className="dashboard-title" style={{ margin: 0 }}>Network & Device Overview</h1>
          <div className="live-indicator">
            <span className="dot"></span>
            <span className="text">LIVE</span>
          </div>
        </div>
        <div style={{ fontSize: "0.85rem", color: "#94a3b8", backgroundColor: "rgba(30, 41, 59, 0.5)", padding: "4px 12px", borderRadius: "20px", border: "1px solid rgba(255,255,255,0.05)" }}>
          {loading ? "Syncing..." : `Sync: ${lastUpdated?.toLocaleTimeString()}`}
        </div>
      </div>

      {/* KPI SUMMARY */}
      <div className="stats-grid">
        <div className="stat-card gray">
          <div className="stat-label">All Devices</div>
          <div className="stat-value">
            { (summary.active || 0) + (summary.inactive || 0) + (summary.routers || 0) + (summary.unknown || unknownDevices.length || 0) }
          </div>
        </div>
        <div className="stat-card green">
          <div className="stat-label">Active Agents</div>
          <div className="stat-value">{summary.active}</div>
        </div>
        <div className="stat-card red">
          <div className="stat-label">Inactive Agents</div>
          <div className="stat-value">{summary.inactive}</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-label">Routers</div>
          <div className="stat-value">{summary.routers}</div>
        </div>
        <div className="stat-card orange">
          <div className="stat-label">Unknown Devices</div>
          <div className="stat-value">{summary.unknown ?? unknownDevices.length ?? 0}</div>
        </div>
      </div>

      {/* OFFICE VIEW (Agents + Routers) */}
      <div className="table-container">
        <h2>Active Devices</h2>
        <table className="activity-table">
          <thead>
            <tr>
              <th>Agent ID</th>
              <th>Hostname</th>
              <th>IP</th>
              <th>CPU</th>
              <th>RAM</th>
              <th>Version</th>
              <th>OS</th>
              <th>Last Seen</th>
            </tr>
          </thead>
          <tbody>
            {activeAgents.length > 0 ? activeAgents.map((a) => (
              <tr key={a.ip} onClick={() => navigate(`/devices/${a.agentId}`)} style={{ cursor: 'pointer' }}>
                <td data-label="Agent ID">{a.agentId || "-"}</td>
                <td data-label="Hostname">{a.hostname || a.system?.hostname || "-"}</td>
                <td data-label="IP">{a.ip}</td>
                <td data-label="CPU">{formatCPU(a.cpu)}</td>
                <td data-label="RAM">{formatRAM(a.memory)}</td>
                <td data-label="Version">{a.version || "0.0.0"}</td>
                <td data-label="OS">{formatOS(a.os)}</td>
                <td data-label="Last Seen">{formatTime(a.lastSeen)}</td>
              </tr>
            )) : (
              <tr><td colSpan="8" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>No active agents detected</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="table-container">
        <h2>Inactive Devices</h2>
        <table className="activity-table">
          <thead>
            <tr>
              <th>Agent ID</th>
              <th>Hostname</th>
              <th>IP</th>
              <th>CPU</th>
              <th>RAM</th>
              <th>Version</th>
              <th>OS</th>
              <th>Last Seen</th>
            </tr>
          </thead>
          <tbody>
            {inactiveAgents.length > 0 ? inactiveAgents.map((a) => (
              <tr key={a.ip} onClick={() => navigate(`/devices/${a.agentId}`)} style={{ cursor: 'pointer' }}>
                <td data-label="Agent ID">{a.agentId || "-"}</td>
                <td data-label="Hostname">{a.hostname || "-"}</td>
                <td data-label="IP">{a.ip}</td>
                <td data-label="CPU">{formatCPU(a.cpu)}</td>
                <td data-label="RAM">{formatRAM(a.memory)}</td>
                <td data-label="Version">{a.version || "0.0.0"}</td>
                <td data-label="OS">{formatOS(a.os)}</td>
                <td data-label="Last Seen">{formatTime(a.timestamp)}</td>
              </tr>
            )) : (
              <tr><td colSpan="8" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>No inactive agents recorded</td></tr>
            )}
          </tbody>
        </table>
      </div>


      <div className="table-container">
        <h2>Routers</h2>
        <table className="activity-table">
          <thead>
            <tr>
              <th>IP</th>
              <th>Hostname</th>
              <th>Vendor</th>
              <th>Detected At</th>
            </tr>
          </thead>
          <tbody>
            {routers.length > 0 ? routers.map((r) => (
              <tr key={r.ip}>
                <td data-label="IP">{r.ip}</td>
                <td data-label="Hostname">{r.hostname || "Gateway"}</td>
                <td data-label="Vendor">{r.vendor || "Unknown"}</td>
                <td data-label="Detected At">{formatTime(r.timestamp || r.createdAt)}</td>
              </tr>
            )) : (
              <tr><td colSpan="4" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>No routers identified</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="table-container">
        <h2>Unknown Devices (Scanner)</h2>
        <table className="activity-table">
          <thead>
            <tr>
              <th>IP</th>
              <th>MAC Address</th>
              <th>Vendor</th>
              <th>Detected At</th>
            </tr>
          </thead>
          <tbody>
            {unknownDevices && unknownDevices.length > 0 ? unknownDevices.map((d) => (
              <tr key={d.ip}>
                <td data-label="IP">{d.ip}</td>
                <td data-label="MAC Address" style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{formatMAC(d.mac)}</td>
                <td data-label="Vendor">{d.vendor || "Unknown"}</td>
                <td data-label="Detected At">{formatTime(d.timestamp || d.createdAt)}</td>
              </tr>
            )) : (
              <tr><td colSpan="4" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>No other devices detected on network</td></tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
};

export default Dashboard;
