import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import socket from "../../../utils/socket";
import { ArrowLeft, Shield, AlertTriangle, CheckCircle, XCircle, Info, RefreshCw, Filter } from "lucide-react";
import "./eventlogs.css";

const EventLogs = () => {
    const { id } = useParams();
    const [events, setEvents] = useState([]);
    const [stats, setStats] = useState(null);
    const [device, setDevice] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filter, setFilter] = useState("all");
    const navigate = useNavigate();

    // Severity icon mapping
    const getSeverityIcon = (severity) => {
        switch (severity) {
            case "error":
                return <XCircle size={16} style={{ color: "#ef4444" }} />;
            case "warning":
                return <AlertTriangle size={16} style={{ color: "#f59e0b" }} />;
            case "success":
                return <CheckCircle size={16} style={{ color: "#10b981" }} />;
            case "failure":
                return <XCircle size={16} style={{ color: "#ef4444" }} />;
            default:
                return <Info size={16} style={{ color: "#3b82f6" }} />;
        }
    };

    // Severity badge style
    const getSeverityBadge = (severity) => {
        const styles = {
            error: { background: "#7f1d1d", color: "#fca5a5", border: "1px solid #991b1b" },
            warning: { background: "#78350f", color: "#fcd34d", border: "1px solid #92400e" },
            success: { background: "#14532d", color: "#86efac", border: "1px solid #166534" },
            failure: { background: "#7f1d1d", color: "#fca5a5", border: "1px solid #991b1b" },
            info: { background: "#1e3a8a", color: "#93c5fd", border: "1px solid #1e40af" },
        };
        return styles[severity] || styles.info;
    };

    useEffect(() => {
        if (!id) {
            setError("No agent identifier provided.");
            setLoading(false);
            return;
        }

        const fetchEvents = async () => {
            try {
                const token = sessionStorage.getItem("token");

                // Fetch recent events
                const eventsResponse = await fetch(
                    `${import.meta.env.VITE_BACKEND_URL}/api/event-logs/${id}/recent?limit=100`,
                    {
                        headers: { Authorization: `Bearer ${token}` },
                    }
                );

                const eventsData = await eventsResponse.json();
                if (eventsData.success) {
                    setEvents(eventsData.data);
                }

                // Fetch statistics
                const statsResponse = await fetch(
                    `${import.meta.env.VITE_BACKEND_URL}/api/event-logs/${id}/stats?hours=24`,
                    {
                        headers: { Authorization: `Bearer ${token}` },
                    }
                );

                const statsData = await statsResponse.json();
                if (statsData.success) {
                    setStats(statsData.data);
                }

                // Set device info from first event
                if (eventsData.data && eventsData.data.length > 0) {
                    setDevice({
                        hostname: eventsData.data[0].computer || `Agent ${id}`,
                        agentId: id,
                    });
                }

                setLoading(false);
            } catch (e) {
                console.error("API error:", e);
                setError("Failed to fetch event logs. Check connection.");
                setLoading(false);
            }
        };

        fetchEvents();

        // Listen for real-time updates
        socket.on("event_logs_update", (update) => {
            if (update.agentId === id) {
                // Refresh events
                fetchEvents();
            }
        });

        return () => {
            socket.off("event_logs_update");
        };
    }, [id]);

    const filteredEvents = events.filter((event) => {
        if (filter === "all") return true;
        return event.severity === filter;
    });

    if (loading)
        return (
            <div
                className="event-logs-container"
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100vh",
                    flexDirection: "column",
                    gap: "20px",
                }}
            >
                <RefreshCw size={40} className="animate-spin" style={{ color: "#00b4d8" }} />
                <p style={{ color: "#8ca8b3" }}>Loading security events...</p>
            </div>
        );

    if (error)
        return (
            <div
                className="event-logs-container"
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100vh",
                    flexDirection: "column",
                    gap: "20px",
                }}
            >
                <XCircle size={48} style={{ color: "#ef4444" }} />
                <p style={{ color: "#ef4444", fontWeight: "bold" }}>Error: {error}</p>
                <button className="back-btn" onClick={() => navigate("/devices")}>
                    <ArrowLeft size={14} /> Return to Devices
                </button>
            </div>
        );

    return (
        <div className="event-logs-container">
            {/* Header */}
            <div className="event-logs-header">
                <div className="header-left">
                    <button className="back-btn" onClick={() => navigate("/devices")}>
                        <ArrowLeft size={16} /> Devices
                    </button>
                    <div className="title-group">
                        <h1 className="event-logs-title">
                            <Shield size={24} style={{ marginRight: "10px" }} />
                            Security Event Monitor
                        </h1>
                        <p className="event-logs-subtitle">
                            Agent: <span className="highlight">{device?.hostname || id}</span>
                        </p>
                    </div>
                </div>
            </div>

            {/* Statistics Cards */}
            {stats && (
                <div className="stats-grid">
                    {stats.severityStats.map((stat) => (
                        <div key={stat._id} className="stat-card">
                            <div className="stat-icon">{getSeverityIcon(stat._id)}</div>
                            <div className="stat-content">
                                <div className="stat-value">{stat.count}</div>
                                <div className="stat-label">{stat._id}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Filters */}
            <div className="filters-bar">
                <Filter size={16} />
                <button
                    className={filter === "all" ? "filter-btn active" : "filter-btn"}
                    onClick={() => setFilter("all")}
                >
                    All
                </button>
                <button
                    className={filter === "error" ? "filter-btn active" : "filter-btn"}
                    onClick={() => setFilter("error")}
                >
                    Errors
                </button>
                <button
                    className={filter === "warning" ? "filter-btn active" : "filter-btn"}
                    onClick={() => setFilter("warning")}
                >
                    Warnings
                </button>
                <button
                    className={filter === "success" ? "filter-btn active" : "filter-btn"}
                    onClick={() => setFilter("success")}
                >
                    Success
                </button>
                <button
                    className={filter === "failure" ? "filter-btn active" : "filter-btn"}
                    onClick={() => setFilter("failure")}
                >
                    Failures
                </button>
            </div>

            {/* Events Table */}
            <div className="events-section">
                <div className="section-header">
                    <h2>Recent Events</h2>
                    <span className="event-count">{filteredEvents.length} events</span>
                </div>

                <div className="events-table">
                    <div className="table-header">
                        <div>Time</div>
                        <div>Event ID</div>
                        <div>Type</div>
                        <div>Severity</div>
                        <div>Details</div>
                    </div>

                    <div className="table-body">
                        {filteredEvents.length > 0 ? (
                            filteredEvents.map((event, idx) => (
                                <div key={idx} className="event-row">
                                    <div className="event-time">
                                        {new Date(event.timestamp).toLocaleString()}
                                    </div>
                                    <div className="event-id">{event.eventId}</div>
                                    <div className="event-type">{event.eventType}</div>
                                    <div className="event-severity">
                                        <span
                                            className="severity-badge"
                                            style={getSeverityBadge(event.severity)}
                                        >
                                            {getSeverityIcon(event.severity)}
                                            {event.severity}
                                        </span>
                                    </div>
                                    <div className="event-details">
                                        {event.details?.targetUser && (
                                            <span className="detail-item">User: {event.details.targetUser}</span>
                                        )}
                                        {event.details?.objectName && (
                                            <span className="detail-item">Object: {event.details.objectName}</span>
                                        )}
                                        {event.details?.processName && (
                                            <span className="detail-item">Process: {event.details.processName}</span>
                                        )}
                                        {!event.details?.targetUser &&
                                            !event.details?.objectName &&
                                            !event.details?.processName && (
                                                <span className="detail-item">{event.description}</span>
                                            )}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="empty-state">
                                <Info size={48} style={{ color: "#4b5563", marginBottom: "10px" }} />
                                <p>No events found for selected filter</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Top Event Types */}
            {stats && stats.topEventTypes && stats.topEventTypes.length > 0 && (
                <div className="top-events-section">
                    <div className="section-header">
                        <h2>Top Event Types (24h)</h2>
                    </div>
                    <div className="top-events-grid">
                        {stats.topEventTypes.map((eventType, idx) => (
                            <div key={idx} className="top-event-card">
                                <div className="top-event-name">{eventType._id}</div>
                                <div className="top-event-count">{eventType.count}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default EventLogs;
