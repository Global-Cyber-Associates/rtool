import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet, apiPost } from "../../utils/api";
import { Check, Power } from "lucide-react";
import { toast } from "../../utils/toast";
import "./ManageUsers.css";

function ManageTenants() {
    const [tenants, setTenants] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    // Load tenants summary
    const loadTenants = async () => {
        try {
            const res = await apiGet("/api/admin/tenants");
            if (res.ok) {
                const data = await res.json();
                setTenants(data);
            }
        } catch (err) {
            console.error("Failed to load tenants:", err);
            toast.error("Network error: Could not load client tenants.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadTenants();
    }, []);

    // Enable / Disable tenant status
    const toggleTenantActivation = async (tenant) => {
        const confirmMsg = tenant.isActive
            ? `Temporarily deactivate ${tenant.name}? All users under this company will lose access instantly.`
            : `Re-activate ${tenant.name}? Company users will regain access.`;

        if (!window.confirm(confirmMsg)) return;

        try {
            const res = await apiPost(`/api/admin/tenants/${tenant.id}/toggle`, {
                isActive: !tenant.isActive,
            });

            const data = await res.json();
            if (res.ok) {
                toast.success(data.message);
                loadTenants();
            } else {
                toast.error(data.message || "Toggle failed");
            }
        } catch (err) {
            toast.error("System error while toggling tenant status.");
        }
    };

    return (
        <div className="manage-users-content">
            <div className="manage-users">
                <div className="header-row">
                    <div>
                        <h2>Manage Client Tenants</h2>
                        <p style={{ color: '#8ca8b3', fontSize: '0.9rem' }}>
                            Control organization-wide system access.
                        </p>
                    </div>
                </div>


                {loading ? (
                    <div className="empty-state">Loading tenants...</div>
                ) : (
                    <table className="users-table">
                        <thead>
                            <tr>
                                <th>Company Name</th>
                                <th>Owner Email</th>
                                <th>Enrollment Key</th>
                                <th>Devices</th>
                                <th>Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>

                        <tbody>
                            {tenants.map((t) => (
                                <tr key={t.id} className={!t.isActive ? "disabled-row" : ""}>
                                    <td data-label="Company Name"><strong>{t.name}</strong></td>
                                    <td data-label="Owner Email">{t.ownerEmail}</td>
                                    <td data-label="Enrollment Key" style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{t.enrollmentKey}</td>
                                    <td data-label="Devices">{t.deviceCount}</td>
                                    <td data-label="Status">
                                        <div className={`status-badge ${t.isActive ? "active" : "disabled"}`}>
                                            <div className="status-dot"></div>
                                            {t.isActive ? "Active" : "Disabled"}
                                        </div>
                                    </td>

                                    <td data-label="Action">
                                        <button
                                            className={`toggle-action-btn ${t.isActive ? "deactivate" : "activate"}`}
                                            onClick={() => toggleTenantActivation(t)}
                                        >
                                            {t.isActive ? <Power size={14} /> : <Check size={14} />}
                                            {t.isActive ? "Deactivate" : "Activate"}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

export default ManageTenants;
