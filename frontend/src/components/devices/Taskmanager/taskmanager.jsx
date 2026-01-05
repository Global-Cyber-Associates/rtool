import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import socket from "../../../utils/socket";
import { ArrowLeft, Cpu, Layers, Activity, Server, RefreshCw, AlertCircle } from "lucide-react";
import "./taskmanager.css";

const TaskManager = () => {
  const { id } = useParams();
  const [tasks, setTasks] = useState({ applications: [], background_processes: [] });
  const [device, setDevice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!id) {
      setError("No agent identifier provided.");
      setLoading(false);
      return;
    }

    const fetchTasks = async () => {
      try {
        const token = sessionStorage.getItem("token");
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/task-manager/${id}`, {
          headers: { "Authorization": `Bearer ${token}` }
        });

        const res = await response.json();
        if (!res?.success || !res?.data?.length) {
          setError(`No task data synchronized for ${id}`);
          setLoading(false);
          return;
        }

        const doc = res.data[0];
        setDevice({
          hostname: doc.device?.hostname || `Agent ${doc.agentId}`,
          os_type: doc.device?.os_type || "Unknown OS",
          os_version: doc.device?.os_version || "",
          machine_id: doc.agentId,
        });

        setTasks({
          applications: doc.data.applications || [],
          background_processes: doc.data.background_processes || [],
        });

      } catch (e) {
        console.error("API error:", e);
        setError("Synchronization failed. Check connection.");
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();

    socket.on("task_info_update", (update) => {
      if (update.agentId === id) {
        setTasks({
          applications: update.data.applications || [],
          background_processes: update.data.background_processes || [],
        });
      }
    });

    return () => {
      socket.off("task_info_update");
    };
  }, [id]);

  if (loading) return (
    <div className="pc-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: '20px' }}>
      <RefreshCw size={40} className="animate-spin" style={{ color: '#00b4d8' }} />
      <p style={{ color: '#8ca8b3' }}>Analyzing remote processes...</p>
    </div>
  );

  if (error) return (
    <div className="pc-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: '20px' }}>
      <AlertCircle size={48} style={{ color: '#ef4444' }} />
      <p style={{ color: '#ef4444', fontWeight: 'bold' }}>Sync Error: {error}</p>
      <button className="back-btn" onClick={() => navigate("/devices")}><ArrowLeft size={14} /> Return to Infrastructure</button>
    </div>
  );

  return (
    <div className="pc-container">
      <div className="task-header">
        <div className="header-left">
          <button className="back-btn" onClick={() => navigate("/devices")}>
            <ArrowLeft size={16} /> Infrastructure
          </button>
          <div className="task-title-group">
            <h1 className="task-title">Operational Task Manager</h1>
            <p className="task-sub">Active Node: <span style={{ color: '#f1faee', fontWeight: '600' }}>{device?.hostname}</span></p>
          </div>
        </div>
        <div className="header-right">
          <p><strong>Kernel:</strong> {device?.os_type} {device?.os_version}</p>
          <p><strong>Node ID:</strong> {device?.machine_id}</p>
        </div>
      </div>

      <div className="pc-section">
        <div className="section-header">
          <Server size={18} style={{ color: '#00b4d8' }} />
          <h2>Applications</h2>
        </div>
        <div className="table">
          <div className="table-header">
            <div>Process Name</div>
            <div>PID</div>
            <div>CPU Activity</div>
            <div>Memory Load</div>
          </div>
          <div className="table-body">
            {tasks.applications.length ? (
              tasks.applications.map((app, idx) => (
                <div key={idx} className="task-row">
                  <div className="task-name">
                    <Activity size={14} style={{ color: '#00b4d8', opacity: 0.7 }} />
                    {app.name} {app.title ? <span style={{ color: '#8ca8b3', fontSize: '11px' }}>({app.title})</span> : ""}
                  </div>
                  <div className="task-stat" style={{ color: '#8ca8b3' }}>{app.pid}</div>
                  <div className="task-stat">{app.cpu_percent}%</div>
                  <div className="task-stat">{app.memory_percent}%</div>
                </div>
              ))
            ) : (
              <div className="empty">No foreground applications detected.</div>
            )}
          </div>
        </div>
      </div>

      <div className="pc-section" style={{ marginTop: '30px' }}>
        <div className="section-header">
          <Layers size={18} style={{ color: '#00b4d8' }} />
          <h2>System Sub-processes</h2>
        </div>
        <div className="table">
          <div className="table-header">
            <div>Binary Name</div>
            <div>PID</div>
            <div>CPU Activity</div>
            <div>Memory Load</div>
          </div>
          <div className="table-body">
            {tasks.background_processes.length ? (
              tasks.background_processes.map((proc, idx) => (
                <div key={idx} className="task-row">
                  <div className="task-name">
                    <Cpu size={14} style={{ color: '#8ca8b3', opacity: 0.5 }} />
                    {proc.name}
                  </div>
                  <div className="task-stat" style={{ color: '#8ca8b3' }}>{proc.pid}</div>
                  <div className="task-stat">{proc.cpu_percent}%</div>
                  <div className="task-stat">{proc.memory_percent}%</div>
                </div>
              ))
            ) : (
              <div className="empty">No background processes recorded.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskManager;
