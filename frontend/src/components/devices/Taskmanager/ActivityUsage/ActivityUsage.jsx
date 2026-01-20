import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Activity, Monitor, AlertCircle, RefreshCw, Layers } from "lucide-react";
import "./activityusage.css";

const ActivityUsage = () => {
    const { id } = useParams(); // agentId
    const [usageData, setUsageData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Initial Fetch
    useEffect(() => {
        const fetchUsage = async () => {
            try {
                const token = sessionStorage.getItem("token");
                const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/task-manager/${id}/usage`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                const res = await response.json();
                if (res.success) {
                    setUsageData(res.data);
                } else {
                    setError(res.message);
                }
            } catch (err) {
                console.error("Failed to fetch usage:", err);
                setError("Failed to load activity usage.");
            } finally {
                setLoading(false);
            }
        };

        fetchUsage();
    }, [id]);

    // Live Timer for Open Apps
    useEffect(() => {
        const timer = setInterval(() => {
            setUsageData(prev => prev.map(app => {
                if (!app.isOpen) return app;
                return {
                    ...app,
                    currentOpenDuration: (app.currentOpenDuration || 0) + 1000
                };
            }));
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const formatDuration = (ms) => {
        if (!ms) return "0s";
        const totalSeconds = Math.floor(ms / 1000);
        const seconds = totalSeconds % 60;
        const minutes = Math.floor(totalSeconds / 60) % 60;
        const hours = Math.floor(totalSeconds / 3600);

        let str = "";
        if (hours > 0) str += `${hours}h `;
        if (minutes > 0) str += `${minutes}m `;
        str += `${seconds}s`;

        return str.trim();
    };

    const activeApps = usageData.filter(d => d.isOpen);
    const inactiveApps = usageData.filter(d => !d.isOpen);

    const renderTable = (apps, title, icon) => (
        <div className="au-section">
            <div className="au-sub-header">
                {icon} {title} ({apps.length})
            </div>
            <div className="au-table">
                <div className="au-row au-head">
                    <div className="au-cell name">Application</div>
                    <div className="au-cell duration">Total Usage</div>
                    {title === "Active Applications" && <div className="au-cell session">Current Session (Live)</div>}
                    <div className="au-cell content">Last Content/Page</div>
                </div>
                {apps.length === 0 ? (
                    <div className="au-empty">No applications in this category.</div>
                ) : (
                    apps.map((app, idx) => (
                        <div key={idx} className="au-row">
                            <div className="au-cell name">
                                <Monitor size={14} style={{ marginRight: '8px', opacity: 0.7 }} />
                                {app.appName}
                            </div>
                            <div className="au-cell duration">
                                {formatDuration((app.totalUsage || 0) + (app.isOpen ? (app.currentOpenDuration || 0) : 0))}
                            </div>
                            {title === "Active Applications" && (
                                <div className="au-cell session">
                                    <span style={{ color: '#34d399', fontWeight: 'bold' }}>
                                        {formatDuration(app.currentOpenDuration)}
                                    </span>
                                </div>
                            )}
                            <div className="au-cell content" title={app.lastTitle}>
                                {app.lastTitle || <span className="text-muted">N/A</span>}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );

    if (loading) return (
        <div className="au-loading">
            <RefreshCw size={24} className="animate-spin" />
            <span>Loading usage analytics...</span>
        </div>
    );

    if (error) return (
        <div className="au-error">
            <AlertCircle size={20} />
            <span>{error}</span>
        </div>
    );

    return (
        <div className="au-container-wrapper">
            <div className="au-header-main">
                <Activity size={18} className="au-icon" />
                <h2>Application Usage Activity</h2>
            </div>

            {renderTable(activeApps, "Active Applications", <Activity size={16} color="#34d399" />)}

            <div style={{ height: '20px' }}></div>

            {renderTable(inactiveApps, "Inactive Applications", <Layers size={16} color="#94a3b8" />)}
        </div>
    );
};

export default ActivityUsage;
