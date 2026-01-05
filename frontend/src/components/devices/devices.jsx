import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import socket from "../../utils/socket.js";
import { apiGet } from "../../utils/api.js";
import { getRole } from "../../utils/authService.js";
import {
  Monitor, Cpu, Smartphone, Shield, LogOut, Lock, Search,
  RefreshCw, Clock, Globe, WifiOff, Radar, CheckCircle2, AlertCircle
} from "lucide-react";
import { toast } from "../../utils/toast";
import "./devices.css";

const Devices = () => {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [unlockedFeatures, setUnlockedFeatures] = useState({});
  const navigate = useNavigate();
  const role = getRole();

  useEffect(() => {
    const token = sessionStorage.getItem("token");

    // ⭐ FETCH CLEAN AGGREGATED DATA
    fetch(`${import.meta.env.VITE_BACKEND_URL}/api/agents`, {
      headers: { "Authorization": `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setAgents(data);
        else setError("Infrastructure synchronization failed.");
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch agents:", err);
        setError("Network communication error.");
        setLoading(false);
      });

    // ⭐ LISTEN FOR STABLE UPDATES
    socket.on("agent_update", (updatedAgent) => {
      setAgents((prev) => {
        const idx = prev.findIndex((a) => a.agentId === updatedAgent.agentId);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], ...updatedAgent };
          return updated;
        } else {
          return [...prev, updatedAgent];
        }
      });
    });

    apiGet("/api/features")
      .then(res => res.json())
      .then(data => {
        const map = {};
        if (data?.unlockedFeatures) {
          data.unlockedFeatures.forEach(id => map[id] = true);
        }
        setUnlockedFeatures(map);
      })
      .catch(err => console.error("Failed to fetch features:", err));

    return () => socket.off("agent_update");
  }, []);


  const formatLastSeen = (date) => {
    if (!date) return "N/A";
    const d = new Date(date);
    const now = new Date();
    const diff = Math.floor((now - d) / 1000);

    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className="devices-content-wrapper">
      <div className="devices-header">
        <div className="header-left-group">
          <h1 className="devices-title">Managed Infrastructure</h1>
          <p className="devices-subtitle-main">Real-time status of all deployed agents and nodes.</p>
        </div>
      </div>

      {loading && (
        <div className="state-container">
          <RefreshCw size={44} className="animate-spin text-primary" />
          <p>Analyzing network topology...</p>
        </div>
      )}

      {error && (
        <div className="state-container error">
          <AlertCircle size={44} />
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && agents.length === 0 && (
        <div className="state-container">
          <Monitor size={48} style={{ opacity: 0.2 }} />
          <p>No nodes registered in this network.</p>
        </div>
      )}

      <div className="device-list">
        {agents.map((agent) => {
          const isOnline = agent.status === "online";
          const canAccessTasks = role === 'admin' || unlockedFeatures.tasks;
          const canAccessApps = role === 'admin' || unlockedFeatures.apps;

          return (
            <div
              key={agent.agentId}
              className={`device-card-premium ${!isOnline ? 'offline-node' : ''}`}
              onClick={() => navigate(`/devices/${agent.agentId}`)}
            >
              <div className="node-main">
                <div className={`node-icon ${isOnline ? 'online' : 'offline'}`}>
                  {isOnline ? <CheckCircle2 size={24} /> : <Monitor size={24} />}
                </div>

                <div className="node-identity">
                  <div className="node-meta">
                    <span className="node-os-tag">{agent.os || "OS"}</span>
                    <span className="node-ip-tag">{agent.ip || "0.0.0.0"}</span>
                  </div>
                  <div className="node-name-label">{agent.hostname || agent.agentId}</div>
                  <div className="node-id-sub">SID: {agent.agentId}</div>
                </div>
              </div>

              <div className="node-health">
                <div className="health-stat">
                  <span className="health-label">Uptime Status</span>
                  <span className={`health-value ${isOnline ? 'text-success' : 'text-danger'}`}>
                    {isOnline ? "ONLINE" : "OFFLINE"}
                  </span>
                </div>
                <div className="health-stat">
                  <span className="health-label">Last Synchronization</span>
                  <span className="health-value text-muted">{formatLastSeen(agent.lastSeen)}</span>
                </div>
              </div>

              <div className="node-actions">
                <div className="action-button-group">
                  <button
                    className={`node-action-btn ${!canAccessTasks ? 'locked' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!canAccessTasks) navigate("/features");
                      else navigate(`/tasks/${agent.agentId}`);
                    }}
                    title="Task Manager"
                  >
                    {!canAccessTasks ? <Lock size={16} /> : <Cpu size={16} />}
                    <span>Manager</span>
                  </button>

                  <button
                    className={`node-action-btn ${!canAccessApps ? 'locked' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!canAccessApps) navigate("/features");
                      else navigate(`/apps/${agent.agentId}`);
                    }}
                    title="Software Inventory"
                  >
                    {!canAccessApps ? <Lock size={16} /> : <Smartphone size={16} />}
                    <span>Software</span>
                  </button>
                </div>

                <div className="action-button-group utility">
                  <button
                    className="node-action-btn util"
                    onClick={(e) => {
                      e.stopPropagation();
                      toast.info("Remote decommission Capability: Coming Soon");
                    }}
                  >
                    <WifiOff size={16} />
                  </button>
                  <button
                    className="node-action-btn util"
                    onClick={(e) => {
                      e.stopPropagation();
                      toast.info("Node Vulnerability Scan: Coming Soon");
                    }}
                  >
                    <Radar size={16} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Devices;
