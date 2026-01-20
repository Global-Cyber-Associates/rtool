import React, { useEffect, useState } from "react";
import { apiGet } from "../../utils/api";
import { toast } from "../../utils/toast";
import { FileText, ArrowLeft, RefreshCw, User } from "lucide-react";
import "./filemonitor.css";

const FileMonitor = () => {
    const [agents, setAgents] = useState([]);
    const [selectedAgent, setSelectedAgent] = useState(null);
    const [fileLogs, setFileLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [logsLoading, setLogsLoading] = useState(false);
    const [counts, setCounts] = useState({ rename: 0, rewrite: 0, delete: 0 });

    // Fetch all agents with file logs
    useEffect(() => {
        fetchAgents();
    }, []);

    const fetchAgents = async () => {
        try {
            setLoading(true);
            const response = await apiGet("/api/file-monitor/agents");
            if (response.ok) {
                const data = await response.json();
                setAgents(data.agents || []);
            } else {
                toast.error("Failed to fetch agents");
            }
        } catch (err) {
            console.error("Failed to fetch agents:", err);
            toast.error("Failed to fetch agents");
        } finally {
            setLoading(false);
        }
    };

    // Fetch file logs for selected agent
    const fetchAgentLogs = async (agentId) => {
        try {
            setLogsLoading(true);
            const response = await apiGet(`/api/file-monitor/logs/${agentId}`);
            if (response.ok) {
                const data = await response.json();
                setFileLogs(data.logs || []);
                setCounts(data.counts || { rename: 0, rewrite: 0, delete: 0 });
            } else {
                toast.error("Failed to fetch file logs");
            }
        } catch (err) {
            console.error("Failed to fetch file logs:", err);
            toast.error("Failed to fetch file logs");
        } finally {
            setLogsLoading(false);
        }
    };

    const handleAgentClick = (agent) => {
        setSelectedAgent(agent);
        fetchAgentLogs(agent.agentId);
    };

    const handleBack = () => {
        setSelectedAgent(null);
        setFileLogs([]);
        setCounts({ rename: 0, rewrite: 0, delete: 0 });
    };

    const getRowClass = (type) => {
        switch (type) {
            case "Rename":
                return "log-rename";
            case "Rewrite":
                return "log-rewrite";
            case "Delete":
                return "log-delete";
            default:
                return "";
        }
    };

    // Agent List View
    if (!selectedAgent) {
        return (
            <div className="filemonitor-wrapper">
                <div className="filemonitor-header">
                    <h1 className="filemonitor-title">
                        <FileText size={28} />
                        File Monitor
                    </h1>
                    <button className="refresh-btn" onClick={fetchAgents}>
                        <RefreshCw size={18} />
                        Refresh
                    </button>
                </div>

                <p className="filemonitor-subtitle">
                    Select an agent to view their file activity logs
                </p>

                {loading ? (
                    <div className="loading-state">Loading agents...</div>
                ) : agents.length === 0 ? (
                    <div className="empty-state">
                        <FileText size={48} />
                        <p>No agents with file logs found</p>
                    </div>
                ) : (
                    <div className="agents-grid">
                        {agents.map((agent, idx) => (
                            <div
                                key={idx}
                                className="agent-card"
                                onClick={() => handleAgentClick(agent)}
                            >
                                <div className="agent-icon">
                                    <User size={32} />
                                </div>
                                <div className="agent-info">
                                    <h3>{agent.agentId}</h3>
                                    <p className="agent-hostname">{agent.hostname || "Unknown"}</p>
                                    <div className="agent-counts">
                                        <span className="count-rename">{agent.renameCount || 0} Rename</span>
                                        <span className="count-rewrite">{agent.rewriteCount || 0} Rewrite</span>
                                        <span className="count-delete">{agent.deleteCount || 0} Delete</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    // Agent Detail View with Logs
    return (
        <div className="filemonitor-wrapper">
            <div className="filemonitor-header">
                <button className="back-btn" onClick={handleBack}>
                    <ArrowLeft size={18} />
                    Back to Agents
                </button>
                <h1 className="filemonitor-title">
                    <FileText size={28} />
                    {selectedAgent.agentId} - File Logs
                </h1>
                <button className="refresh-btn" onClick={() => fetchAgentLogs(selectedAgent.agentId)}>
                    <RefreshCw size={18} />
                    Refresh
                </button>
            </div>

            {/* Count Boxes */}
            <div className="file-event-counts">
                <div className="count-box count-rename">
                    <span className="count-value">{counts.rename}</span>
                    <span className="count-label">Rename</span>
                </div>
                <div className="count-box count-rewrite">
                    <span className="count-value">{counts.rewrite}</span>
                    <span className="count-label">Rewrite</span>
                </div>
                <div className="count-box count-delete">
                    <span className="count-value">{counts.delete}</span>
                    <span className="count-label">Delete</span>
                </div>
            </div>

            {/* Logs Table */}
            <div className="logs-table-container">
                {logsLoading ? (
                    <div className="loading-state">Loading logs...</div>
                ) : fileLogs.length === 0 ? (
                    <div className="empty-state">
                        <p>No file logs found for this agent</p>
                    </div>
                ) : (
                    <table className="logs-table">
                        <thead>
                            <tr>
                                <th>Timestamp</th>
                                <th>Filename</th>
                                <th>File Directory</th>
                                <th>File Modified Type</th>
                                <th>Description</th>
                            </tr>
                        </thead>
                        <tbody>
                            {fileLogs.map((log, i) => (
                                <tr key={i} className={`log-row ${getRowClass(log.eventType)}`}>
                                    <td>{new Date(log.timestamp).toLocaleString()}</td>
                                    <td>{log.details?.filename || "Unknown"}</td>
                                    <td>{log.details?.directory || "Unknown"}</td>
                                    <td>{log.eventType}</td>
                                    <td>{log.description || "-"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <p className="logs-footer">
                Showing {fileLogs.length} file events
            </p>
        </div>
    );
};

export default FileMonitor;
