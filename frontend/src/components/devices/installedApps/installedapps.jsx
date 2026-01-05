import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Smartphone, Info, Calendar, User, Package, X, RefreshCw, AlertCircle } from "lucide-react";
import "./installedapps.css";

const InstalledApps = () => {
  const { id: agentId } = useParams();
  const navigate = useNavigate();
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [selectedApp, setSelectedApp] = useState(null);

  useEffect(() => {
    if (!agentId) return;

    const fetchApps = async () => {
      try {
        const token = sessionStorage.getItem("token");
        const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/installed-apps/${agentId}`, {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });

        if (!res.ok) throw new Error("Synchronization failed.");

        const json = await res.json();
        if (json.success && json.data) {
          setApps(json.data.data?.apps || []);
        }
      } catch (err) {
        console.error("Fetch error:", err);
        setError("Unable to retrieve application inventory.");
      } finally {
        setLoading(false);
      }
    };

    fetchApps();
  }, [agentId]);

  const filteredApps = apps.filter((a) =>
    a.name?.toLowerCase().includes(search.toLowerCase())
  );

  const formatInstallDate = (dateStr) => {
    if (!dateStr) return "N/A";
    if (dateStr.length === 8) {
      const year = dateStr.slice(0, 4);
      const month = dateStr.slice(4, 6);
      const day = dateStr.slice(6, 8);
      return new Date(`${year}-${month}-${day}`).toLocaleDateString();
    }
    return new Date(dateStr).toLocaleDateString();
  };

  if (loading) return (
    <div className="installed-apps-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: '20px' }}>
      <RefreshCw size={40} className="animate-spin" style={{ color: '#00b4d8' }} />
      <p style={{ color: '#8ca8b3' }}>Inventorying remote software environment...</p>
    </div>
  );

  if (error) return (
    <div className="installed-apps-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: '20px' }}>
      <AlertCircle size={48} style={{ color: '#ef4444' }} />
      <p style={{ color: '#ef4444', fontWeight: 'bold' }}>{error}</p>
      <button className="back-btn" onClick={() => navigate(-1)}><ArrowLeft size={16} /> Infrastructure</button>
    </div>
  );

  return (
    <div className="installed-apps-wrapper">
      <div className="usb-header">
        <div className="header-left">
          <button className="back-btn" onClick={() => navigate(-1)}>
            <ArrowLeft size={16} /> Infrastructure
          </button>
          <div className="header-text">
            <h1>Software Inventory</h1>
            <p>Active Repository for <span className="agent-id">{agentId}</span></p>
          </div>
        </div>
        <div className="search-wrapper">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Filter applications..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="app-search"
          />
        </div>
      </div>

      {!apps.length ? (
        <div style={{ textAlign: 'center', padding: '100px', color: '#8ca8b3' }}>
          <Package size={48} style={{ margin: '0 auto 20px', opacity: 0.3 }} />
          <p>No valid software records detected for this node.</p>
        </div>
      ) : (
        <div className="table-container">
          <div className="table-wrapper">
            <table className="usb-table">
              <thead>
                <tr>
                  <th>Software Asset</th>
                  <th>Version</th>
                  <th>Developer / Publisher</th>
                  <th>Discovered On</th>
                </tr>
              </thead>
              <tbody>
                {filteredApps.map((app, i) => (
                  <tr key={i} onClick={() => setSelectedApp(app)}>
                    <td className="app-name-cell">
                      {app.name || "System Binary"}
                    </td>
                    <td>
                      <span className="version-badge">{app.version || "STABLE"}</span>
                    </td>
                    <td>{app.publisher || "N/A"}</td>
                    <td>{formatInstallDate(app.install_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedApp && (
        <div className="app-modal" onClick={() => setSelectedApp(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Asset Intelligence</h2>
              <button style={{ background: 'transparent', border: 'none', color: '#8ca8b3', cursor: 'pointer' }} onClick={() => setSelectedApp(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '25px', padding: '15px', background: 'rgba(0, 180, 216, 0.05)', borderRadius: '12px', border: '1px solid rgba(0, 180, 216, 0.1)' }}>
                <h3 style={{ margin: '0 0 5px 0', color: '#f1faee' }}>{selectedApp.name}</h3>
                <p style={{ margin: 0, color: '#00b4d8', fontSize: '13px', fontWeight: '600' }}>v{selectedApp.version || "N/A"}</p>
              </div>

              <div className="info-pair">
                <span className="info-label">Publisher</span>
                <span className="info-value" style={{ fontSize: '14px' }}>{selectedApp.publisher || "—"}</span>
              </div>

              <div className="info-pair">
                <span className="info-label">Discovery Date</span>
                <span className="info-value" style={{ fontSize: '14px' }}>{formatInstallDate(selectedApp.install_date)}</span>
              </div>

              <div className="info-pair">
                <span className="info-label">System Registry Key</span>
                <span className="long-text">{selectedApp.registry_key || "N/A"}</span>
              </div>

              <div className="info-pair">
                <span className="info-label">Deployment Path</span>
                <span className="long-text">{selectedApp.install_location || "Unknown"}</span>
              </div>

              <div className="info-pair">
                <span className="info-label">Decommission Link</span>
                <span className="long-text">{selectedApp.uninstall_string || "N/A"}</span>
              </div>

              <button className="close-btn" onClick={() => setSelectedApp(null)}>Acknowledge</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InstalledApps;
