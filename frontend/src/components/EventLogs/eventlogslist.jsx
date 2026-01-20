import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import socket from "../../utils/socket";
import { Shield, Search, Server, Activity, AlertCircle, RefreshCw } from "lucide-react";
import "./eventlogslist.css";

const EventLogsList = () => {
    const [agents, setAgents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        const fetchAgents = async () => {
            try {
                const token = sessionStorage.getItem("token");
                const response = await fetch(
                    `${import.meta.env.VITE_BACKEND_URL}/api/agents`,
                    {
                        headers: { Authorization: `Bearer ${token}` },
                    }
                );

                const data = await response.json();
                if (data.success) {
                    setAgents(data.agents || []);
                } else {
                    setError("Failed to load agents");
                }
            } catch (e) {
                console.error("API error:", e);
                setError("Failed to fetch agents. Check connection.");
            } finally {
                setLoading(false);
            }
        };

        fetchAgents();

        // Listen for agent status updates
        socket.on("agent_status_update", (update) => {
            setAgents((prev) =>
                prev.map((agent) =>
                    agent.agentId === update.agentId
                        ? { ...agent, status: update.status }
                        : agent
                )
            );
        });

        return () => {
            socket.off("agent_status_update");
        };
    }, []);

    const filteredAgents = agents.filter(
        (agent) =>
            agent.agentId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            agent.hostname?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleAgentClick = (agentId) => {
        navigate(`/task/user/${agentId}`);
    };

    if (loading) {
        return (
            <div className="event-logs-list-container loading-state">
                <RefreshCw size={40} className="animate-spin" style={{ color: "#00b4d8" }} />
                <p style={{ color: "#8ca8b3" }}>Loading agents...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="event-logs-list-container error-state">
                <AlertCircle size={48} style={{ color: "#ef4444" }} />
                <p style={{ color: "#ef4444", fontWeight: "bold" }}>Error: {error}</p>
            </div>
        );
    }

    return (
        <div className="event-logs-list-container">
            {/* Header */}
            <div className="event-logs-list-header">
                <div className="header-content">
                    <div className="title-section">
                        <Shield size={32} style={{ color: "#00b4d8" }} />
                        <div>
                            <h1 className="page-title">Security Event Monitor</h1>
                            <p className="page-subtitle">
                                Monitor Windows security events across all agents
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="stats-overview">
                <div className="stat-box">
                    <div className="stat-icon">
                        <Server size={24} style={{ color: "#00b4d8" }} />
                    </div>
                    <div className="stat-info">
                        <div className="stat-value">{agents.length}</div>
                        <div className="stat-label">Total Agents</div>
                    </div>
                </div>
                <div className="stat-box">
                    <div className="stat-icon">
                        <Activity size={24} style={{ color: "#10b981" }} />
                    </div>
                    <div className="stat-info">
                        <div className="stat-value">
                            {agents.filter((a) => a.status === "online").length}
                        </div>
                        <div className="stat-label">Online</div>
                    </div>
                </div>
                <div className="stat-box">
                    <div className="stat-icon">
                        <AlertCircle size={24} style={{ color: "#8ca8b3" }} />
                    </div>
                    <div className="stat-info">
                        <div className="stat-value">
                            {agents.filter((a) => a.status === "offline").length}
                        </div>
                        <div className="stat-label">Offline</div>
                    </div>
                </div>
            </div>

            {/* Search Bar */}
            <div className="search-section">
                <div className="search-bar">
                    <Search size={20} style={{ color: "#8ca8b3" }} />
                    <input
                        type="text"
                        placeholder="Search by Agent ID or Hostname..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-input"
                    />
                </div>
            </div>

            {/* Agents Grid */}
            <div className="agents-grid">
                {filteredAgents.length > 0 ? (
                    filteredAgents.map((agent) => (
                        <div
                            key={agent.agentId}
                            className="agent-card"
                            onClick={() => handleAgentClick(agent.agentId)}
                        >
                            <div className="agent-card-header">
                                <div className="agent-icon">
                                    <Shield size={24} />
                                </div>
                                <div
                                    className={`status-badge ${agent.status === "online" ? "online" : "offline"
                                        }`}
                                >
                                    <div className="status-dot"></div>
                                    {agent.status}
                                </div>
                            </div>
                            <div className="agent-card-body">
                                <h3 className="agent-hostname">
                                    {agent.hostname || "Unknown Host"}
                                </h3>
                                <p className="agent-id">{agent.agentId}</p>
                                {agent.lastSeen && (
                                    <p className="agent-last-seen">
                                        Last seen: {new Date(agent.lastSeen).toLocaleString()}
                                    </p>
                                )}
                            </div>
                            <div className="agent-card-footer">
                                <button className="view-logs-btn">
                                    <Shield size={16} />
                                    View Event Logs
                                </button>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="no-agents">
                        <Server size={64} style={{ color: "#4b5563", opacity: 0.5 }} />
                        <p>No agents found</p>
                        {searchTerm && (
                            <button
                                className="clear-search-btn"
                                onClick={() => setSearchTerm("")}
                            >
                                Clear Search
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default EventLogsList;
