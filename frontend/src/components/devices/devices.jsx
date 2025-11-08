import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../navigation/sidenav.jsx";
import socket from "../../utils/socket.js";
import "./devices.css";

const Devices = () => {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Request all agents
    socket.emit("get_data", { type: "agents" }, (response) => {
      if (!response?.success) {
        setError(response?.message || "Failed to fetch agents.");
        setLoading(false);
        return;
      }

      const data = Array.isArray(response.data) ? response.data : [];
      setAgents(data);
      setLoading(false);
    });

    // Listen for live updates (optional)
    socket.on("agent_update", (updatedAgent) => {
      setAgents((prev) => {
        const idx = prev.findIndex((a) => a.agentId === updatedAgent.agentId);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = updatedAgent;
          return updated;
        } else {
          return [...prev, updatedAgent];
        }
      });
    });

    return () => socket.off("agent_update");
  }, []);

  if (loading) return <div className="devices-container">Loading agents...</div>;
  if (error) return <div className="devices-container">{error}</div>;
  if (!agents.length)
    return <div className="devices-container">No agents found.</div>;

  return (
    <div className="device-page">
      <Sidebar />
      <div className="devices-container">
        <h1 className="devices-title">Devices with agents</h1>

        <div className="device-list">
          {agents.map((agent) => (
            <div
              key={agent._id}
              className="device-card"
              onClick={() => navigate(`/devices/${agent.agentId}`)}
            >
              <div className="device-left">
                <div className="device-icon">🖥️</div>
                <div className="device-info-wrapper">
                  <div className="device-name">{agent.agentId}</div>
                  <div className="device-info">
                    <p>
                      <strong>IP:</strong> {agent.ip || "unknown"}
                    </p>
                    <p>
                      <strong>Last Seen:</strong>{" "}
                      {agent.lastSeen
                        ? new Date(agent.lastSeen).toLocaleString()
                        : "N/A"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="device-actions">
                <button
                  className="action-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    alert(`Disconnect ${agent.agentId}`);
                  }}
                >
                  Disconnect
                </button>

                <button
                  className="action-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/tasks/${agent.agentId}`);
                  }}
                >
                  Task Manager
                </button>

                <button
                  className="action-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    alert(`Scan ${agent.agentId}`);
                  }}
                >
                  Scan
                </button>

                <button
                  className="action-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/apps/${agent.agentId}`);
                  }}
                >
                  Installed Apps
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Devices;
