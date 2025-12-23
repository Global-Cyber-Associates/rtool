import React, { useEffect, useState } from "react";
import { apiGet } from "../../utils/api";
import { Download as DownloadIcon, Shield, User, Copy, FileText, CheckCircle, AlertCircle, Monitor, ExternalLink, Info, Check } from "lucide-react";
import "./Download.css";

function DownloadPage() {
    const [profile, setProfile] = useState(null);
    const [tenantInfo, setTenantInfo] = useState(null);
    const [copied, setCopied] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [agentId, setAgentId] = useState("");

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await apiGet("/api/auth/me");
                if (!res.ok) throw new Error("Authentication context lost");
                const userData = await res.json();
                setProfile(userData);

                if (userData.tenantId && typeof userData.tenantId === 'object' && userData.tenantId.enrollmentKey) {
                    setTenantInfo(userData.tenantId);
                } else if (userData.tenantId) {
                    const role = sessionStorage.getItem("role");
                    if (role === "admin") {
                        const tRes = await apiGet("/api/admin/tenants");
                        if (tRes.ok) {
                            const tenants = await tRes.json();
                            const myTenant = tenants.find(t => t.id === userData.tenantId);
                            if (myTenant) {
                                setTenantInfo({ enrollmentKey: myTenant.enrollmentKey });
                            }
                        }
                    }
                }
            } catch (err) {
                console.error("Fetch error:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const enrollmentKey = tenantInfo?.enrollmentKey || "NOT_ASSIGNED";

    const handleDownloadAdmin = () => {
        const url = import.meta.env.VITE_ADMIN_AGENT_DOWNLOAD_URL || "/visun-agent-admin.exe";
        window.open(url, '_blank');
    };

    const handleDownloadUser = () => {
        const url = import.meta.env.VITE_USER_AGENT_DOWNLOAD_URL || "/visun-agent-user.exe";
        window.open(url, '_blank');
    };

    const handleDownloadEnv = () => {
        const serverUrl = window.location.origin.replace(":5173", ":5000").replace(":3000", ":5000");
        const envContent = `SERVER_URL=${serverUrl}\nAGENT_ID=${agentId}\nTENANT_KEY=${enrollmentKey}\n`;
        const blob = new Blob([envContent], { type: "application/octet-stream" });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = ".env";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    };

    const copyToClipboard = () => {
        if (enrollmentKey === "NOT_ASSIGNED") return;
        navigator.clipboard.writeText(enrollmentKey);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (loading) return (
        <div className="dl-minimal-wrapper">
            <div className="dl-section dl-loading" style={{ alignItems: 'center', justifyContent: 'center', minWidth: '320px' }}>
                <div className="dl-spinner-modern"></div>
                <p style={{ marginTop: '20px', color: '#94a3b8', fontSize: '0.9rem' }}>Securing workstation tunnel...</p>
            </div>
        </div>
    );

    return (
        <div className="dl-minimal-wrapper">
            <div className="dl-minimal-container">
                <div className="dl-minimal-content">

                    {/* STEP 1: CONFIGURATION */}
                    <section className="dl-section">
                        <div className="dl-section-header">
                            <div className="header-icon-box">
                                <Monitor size={20} />
                            </div>
                            <h2>1. Endpoint Identity</h2>
                        </div>

                        <div className="dl-field">
                            <label className="dl-field-label">Tenant Enrollment Key</label>
                            <div className="dl-key-card">
                                <code>{enrollmentKey}</code>
                                <button onClick={copyToClipboard} className="dl-icon-button" title="Copy Key">
                                    {copied ? <Check size={16} color="#00f2c3" /> : <Copy size={16} />}
                                </button>
                            </div>
                        </div>

                        <div className="dl-field">
                            <label className="dl-field-label">Agent Identifier (Device / User Name)</label>
                            <div className="dl-input-wrapper">
                                <input
                                    type="text"
                                    className="dl-input-modern"
                                    placeholder="e.g. John-Doe or Project-Laptop-01"
                                    value={agentId}
                                    onChange={(e) => setAgentId(e.target.value)}
                                />
                            </div>
                            <p className="dl-note" style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '6px' }}>
                                Use a name that identifies this system, such as the machine's purpose or the person who operates it.
                            </p>
                            {!agentId.trim() && (
                                <p className="dl-input-hint">
                                    <AlertCircle size={12} /> Identifier required for configuration
                                </p>
                            )}
                        </div>

                        <button
                            className="dl-action-btn"
                            onClick={handleDownloadEnv}
                            disabled={enrollmentKey === "NOT_ASSIGNED" || !agentId.trim()}
                        >
                            <FileText size={18} />
                            Download .env Config
                        </button>

                        <p style={{ marginTop: '20px', fontSize: '0.8rem', color: '#64748b', textAlign: 'center' }}>
                            Place the downloaded file in the same folder as the agent binary.
                        </p>
                    </section>

                    {/* STEP 2: BINARY DEPLOYMENT */}
                    <section className="dl-section">
                        <div className="dl-section-header">
                            <div className="header-icon-box">
                                <DownloadIcon size={20} />
                            </div>
                            <h2>2. Deploy Executables</h2>
                        </div>

                        <div className="dl-exe-stack">
                            <div className="dl-exe-card">
                                <div className="dl-exe-meta">
                                    <div className="dl-exe-icon admin">
                                        <Shield size={24} />
                                    </div>
                                    <div className="dl-exe-text">
                                        <h3>Admin Agent</h3>
                                        <p>Global scanning & policy enforcement.</p>
                                    </div>
                                </div>
                                <button className="dl-download-btn-small" onClick={handleDownloadAdmin}>
                                    Get <ExternalLink size={14} style={{ marginLeft: '4px' }} />
                                </button>
                            </div>

                            <div className="dl-exe-card">
                                <div className="dl-exe-meta">
                                    <div className="dl-exe-icon user">
                                        <User size={24} />
                                    </div>
                                    <div className="dl-exe-text">
                                        <h3>User Agent</h3>
                                        <p>Endpoint visibility & log forwarding.</p>
                                    </div>
                                </div>
                                <button className="dl-download-btn-small" onClick={handleDownloadUser}>
                                    Get <ExternalLink size={14} style={{ marginLeft: '4px' }} />
                                </button>
                            </div>
                        </div>

                        <div className="dl-process-card">
                            <h4><Info size={14} /> Recommended Workflow</h4>
                            <p>
                                Deploy <span className="process-highlight">User Agents</span> on all network endpoints (e.g. 9/10 PCs).
                                Reserve the <span className="process-highlight">Admin Agent</span> for 1 management station.
                            </p>
                        </div>
                    </section>
                </div>

                {error && (
                    <div className="dl-error-toast">
                        <AlertCircle size={18} />
                        <span>{error}</span>
                    </div>
                )}
            </div>
        </div>
    );
}

export default DownloadPage;
