import React from "react";
import "./features.css";
import Sidebar from "../navigation/sidenav.jsx";
import TopNav from "../navigation/topnav.jsx";
import { Monitor, Usb, Cpu, Network, Activity } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Features = () => {
  const navigate = useNavigate();

  const features = [
    {
      title: "Connected Devices",
      description:
        "View and manage all connected systems across your infrastructure in real-time.",
      icon: <Monitor size={26} />,
      route: "/devices",
    },
    {
      title: "USB Manager",
      description:
        "Monitor, approve, or block USB devices connected to your endpoints instantly.",
      icon: <Usb size={26} />,
      route: "/usb",
    },
    {
      title: "Task Manager",
      description:
        "Track and control active processes and system operations from a central interface.",
      icon: <Cpu size={26} />,
      route: "/devices", // create a default overview page if needed
    },
    {
      title: "Network Visualizer",
      description:
        "Visualize your full network topology, device connections, and communication paths.",
      icon: <Network size={26} />,
      route: "/visualizer",
    },
    {
      title: "Logs & Monitoring",
      description:
        "View live activity logs, alerts, and system events across all network assets.",
      icon: <Activity size={26} />,
      route: "/logs",
    },
  ];

  return (
    <div className="features-content-wrapper">
      <h1 className="features-title">Platform Features</h1>
      <p className="features-subtitle">
        Key modules that power monitoring, control, and visibility across your environment.
      </p>

      <div className="features-grid">
        {features.map((feature, index) => (
          <div key={index} className="feature-card">
            <div className="feature-icon">{feature.icon}</div>
            <h2>{feature.title}</h2>
            <p>{feature.description}</p>
            <button
              className="buy-btn"
              onClick={() => navigate(feature.route)}
            >
              Open
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Features;
