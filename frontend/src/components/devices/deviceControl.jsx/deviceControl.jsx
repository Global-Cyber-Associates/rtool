import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import socket from "../../../utils/socket.js";
import { ArrowLeft, Monitor, Database, Users as UsersIcon, Clock, HardDrive, Cpu, Activity, RefreshCw, AlertCircle } from "lucide-react";
import "./deviceControl.css";

const bytesToGB = (bytes) => (bytes / 1024 ** 3).toFixed(2);

const DeviceDetail = () => {
  const { id } = useParams();
  const [device, setDevice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!id) return;

    socket.emit("get_data", { type: "system_info", agentId: id }, (res) => {
      if (res?.success) {
        const data = Array.isArray(res.data) ? res.data[0] : res.data;
        setDevice(data?.data || null);
        setError(null);
      } else {
        setError("Failed to retrieve system telemetrics.");
      }
      setLoading(false);
    });
  }, [id]);

  if (loading) return (
    <div className="pc-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: '20px' }}>
      <RefreshCw size={40} className="animate-spin" style={{ color: '#00b4d8' }} />
      <p style={{ color: '#8ca8b3' }}>Synchronizing local node data...</p>
    </div>
  );

  if (error || !device) return (
    <div className="pc-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: '20px' }}>
      <AlertCircle size={48} style={{ color: '#ef4444' }} />
      <p style={{ color: '#ef4444', fontWeight: 'bold' }}>{error || "Node Unreachable"}</p>
      <button className="back-btn" onClick={() => navigate("/devices")}><ArrowLeft size={16} /> Infrastructure</button>
    </div>
  );

  const cpu = device.cpu || {};
  const memory = device.memory || {};
  const disk = device.disk || {};
  const users = device.users || [];
  const collected = device.timestamp || new Date().toISOString();

  return (
    <div className="pc-container">
      <div className="pc-header">
        <div className="pc-title-group">
          <h1 className="pc-title">{device.hostname || "Unknown Node"}</h1>
          <p className="pc-subtitle">Hardware Identification: {device.machine_id}</p>
        </div>
        <button className="back-btn" onClick={() => navigate("/devices")}>
          <ArrowLeft size={16} /> Infrastructure
        </button>
      </div>

      <div className="pc-section">
        <div className="section-title">
          <Monitor size={20} /> System Architecture
        </div>
        <div className="system-info-grid">
          <div className="info-item">
            <span className="info-label">OS Environment</span>
            <span className="info-value">{device.os_type} {device.os_version} (Release {device.os_release})</span>
          </div>
          <div className="info-item">
            <span className="info-label">Processing Power</span>
            <span className="info-value">{cpu.physical_cores} Cores / {cpu.logical_cores} Threads @ {cpu.cpu_freq_mhz} MHz</span>
          </div>
          <div className="info-item">
            <span className="info-label">Memory Utilization</span>
            <span className="info-value">{bytesToGB(memory.used_ram)} / {bytesToGB(memory.total_ram)} GB ({memory.ram_percent}%)</span>
            <div className="progress-container">
              <div className="pc-progress-bar">
                <div className="progress-bar-fill memory-fill" style={{ width: `${memory.ram_percent || 0}%` }}></div>
              </div>
            </div>
          </div>
          <div className="info-item">
            <span className="info-label">Local Active Users</span>
            <span className="info-value">{users.length > 0 ? users.join(", ") : "No active sessions"}</span>
          </div>
        </div>
      </div>

      <div className="pc-section">
        <div className="section-title">
          <Database size={20} /> Storage & Volumes
        </div>
        <div className="drives-grid">
          {Object.keys(disk).map((drive) => {
            const d = disk[drive];
            const p = d.percent || 0;
            let statusClass = "";
            if (p > 90) statusClass = "danger";
            else if (p > 75) statusClass = "warning";

            return (
              <div key={drive} className="drive-card">
                <div className="drive-header">
                  <div className="drive-name"><HardDrive size={18} style={{ color: '#00b4d8' }} /> {drive}</div>
                  <div className="drive-size">{p}% Full</div>
                </div>
                <div className="progress-container">
                  <div className="progress-labels">
                    <span>{bytesToGB(d.used)} GB Used</span>
                    <span>{bytesToGB(d.total)} GB Total</span>
                  </div>
                  <div className="pc-progress-bar">
                    <div className={`progress-bar-fill disk-fill ${statusClass}`} style={{ width: `${p}%` }}></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="collected-badge">
        <Clock size={14} />
        <span>Last synchronization: {new Date(collected).toLocaleString()}</span>
      </div>
    </div>
  );
};

export default DeviceDetail;
