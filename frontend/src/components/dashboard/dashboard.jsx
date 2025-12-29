import React, { useEffect, useState } from "react";
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

function formatTime(t) {
  if (!t) return "-";
  return new Date(t).toLocaleString();
}

const Dashboard = () => {
  const [snapshot, setSnapshot] = useState({
    summary: { all: 0, active: 0, inactive: 0, unknown: 0, routers: 0 },
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
      console.log("📊 Dashboard socket update received (CHANGED):", snap.summary);
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
          <div className="stat-value">{summary.all}</div>
        </div>
        <div className="stat-card green">
          <div className="stat-label">Active Agents</div>
          <div className="stat-value">{summary.active}</div>
        </div>
        <div className="stat-card red">
          <div className="stat-label">Inactive Agents</div>
          <div className="stat-value">{summary.inactive}</div>
        </div>
        <div className="stat-card orange">
          <div className="stat-label">Unknown Devices</div>
          <div className="stat-value">{summary.unknown}</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-label">Routers</div>
          <div className="stat-value">{summary.routers}</div>
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
              <th>OS</th>
              <th>Last Seen</th>
            </tr>
          </thead>
          <tbody>
            {activeAgents.length > 0 ? activeAgents.map((a) => (
              <tr key={a.ip}>
                <td>{a.agentId || "-"}</td>
                <td>{a.hostname || a.system?.hostname || "-"}</td>
                <td>{a.ip}</td>
                <td>{formatCPU(a.cpu)}</td>
                <td>{formatRAM(a.memory)}</td>
                <td>{formatOS(a.os)}</td>
                <td>{formatTime(a.lastSeen)}</td>
              </tr>
            )) : (
              <tr><td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>No active agents detected</td></tr>
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
              <th>OS</th>
              <th>Last Seen</th>
            </tr>
          </thead>
          <tbody>
            {inactiveAgents.length > 0 ? inactiveAgents.map((a) => (
              <tr key={a.ip}>
                <td>{a.agentId || "-"}</td>
                <td>{a.hostname || "-"}</td>
                <td>{a.ip}</td>
                <td>{formatCPU(a.cpu)}</td>
                <td>{formatRAM(a.memory)}</td>
                <td>{formatOS(a.os)}</td>
                <td>{formatTime(a.timestamp)}</td>
              </tr>
            )) : (
              <tr><td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>No inactive agents recorded</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="table-container">
        <h2>Unknown Network Devices</h2>
        <table className="activity-table">
          <thead>
            <tr>
              <th>IP</th>
              <th>Hostname / Discovery</th>
              <th>Vendor Hint</th>
              <th>Detected At</th>
            </tr>
          </thead>
          <tbody>
            {unknownDevices.length > 0 ? unknownDevices.map((d) => (
              <tr key={d.ip}>
                <td>{d.ip}</td>
                <td>{d.hostname || "Unscanned Device"}</td>
                <td>{d.vendor || "-"}</td>
                <td>{formatTime(d.timestamp)}</td>
              </tr>
            )) : (
              <tr><td colSpan="4" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>No unknown devices on this subnet</td></tr>
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
                <td>{r.ip}</td>
                <td>{r.hostname || "Gateway"}</td>
                <td>{r.vendor || "Unknown"}</td>
                <td>{formatTime(r.timestamp || r.createdAt)}</td>
              </tr>
            )) : (
              <tr><td colSpan="4" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>No routers identified</td></tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
};

export default Dashboard;
