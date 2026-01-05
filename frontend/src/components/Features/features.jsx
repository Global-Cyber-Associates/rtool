import React from "react";
import "./features.css";
import TopNav from "../navigation/topnav.jsx";
import { Monitor, Usb, Cpu, Network, Activity, Lock, Unlock, Scan, Smartphone } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { apiGet, apiPost } from "../../utils/api";

const Features = () => {
  const navigate = useNavigate();
  const [unlockedFeatures, setUnlockedFeatures] = React.useState({});
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let isMounted = true;
    const fetchUnlockedFeatures = async () => {
      try {
        const response = await apiGet("/api/features");
        if (response.ok && isMounted) {
          const data = await response.json();
          const unlockedMap = {};
          if (data && data.unlockedFeatures) {
            data.unlockedFeatures.forEach(id => unlockedMap[id] = true);
          }
          setUnlockedFeatures(unlockedMap);
        }
      } catch (err) {
        console.error("Failed to fetch features landing page:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchUnlockedFeatures();
    return () => { isMounted = false; };
  }, []);

  const features = [
    {
      id: "devices",
      title: "Connected Devices",
      description: "View and manage all connected systems across your infrastructure in real-time.",
      icon: <Monitor size={26} />,
      route: "/devices",
      price: 0
    },
    {
      id: "usb",
      title: "USB Manager",
      description: "Monitor, approve, or block USB devices connected to your endpoints instantly.",
      icon: <Usb size={26} />,
      route: "/usb",
      price: 0
    },
    {
      id: "tasks",
      title: "Task Manager",
      description: "Track and control active processes and system operations from a central interface.",
      icon: <Cpu size={26} />,
      route: "/devices",
      price: 0
    },
    {
      id: "apps",
      title: "Application Manager",
      description: "Inventory and monitor all installed software across your managed endpoints.",
      icon: <Smartphone size={26} />,
      route: "/devices",
      price: 0
    },
    {
      id: "visualizer",
      title: "Network Visualizer",
      description: "Visualize your full network topology, device connections, and communication paths.",
      icon: <Network size={26} />,
      route: "/visualizer",
      price: 0
    },
    {
      id: "scan",
      title: "Scanner",
      description: "Perform deep security scans and vulnerability assessments across your network.",
      icon: <Scan size={26} />,
      route: "/scan",
      price: 0
    },
    {
      id: "logs",
      title: "Logs & Monitoring",
      description: "Live activity logs, alerts, and system events across all network assets.",
      icon: <Activity size={26} />,
      route: "/logs",
      price: 0
    },
  ];

  const handleUnlock = async (feature) => {
    if (feature.price > 0) {
      console.log(`Loading Razorpay for ${feature.title} at $${feature.price}`);
      alert("Redirecting to Razorpay payment gateway...");
    } else {
      try {
        const response = await apiPost("/api/features/unlock", { featureId: feature.id });
        const data = await response.json();

        if (data.success) {
          const unlockedMap = {};
          data.unlockedFeatures.forEach(id => unlockedMap[id] = true);
          setUnlockedFeatures(unlockedMap);

          // Still updating localStorage as a secondary cache for immediate sidebar feedback 
          // without needing full re-fetches between navigation
          localStorage.setItem("unlockedFeatures", JSON.stringify(unlockedMap));

          alert(`${feature.title} has been successfully unlocked!`);
        }
      } catch (err) {
        alert("Failed to unlock feature. Please try again.");
      }
    }
  };

  return (
    <div className="features-content-wrapper">
      <h1 className="features-title">Platform Features</h1>
      <p className="features-subtitle">
        Key modules that power monitoring, control, and visibility across your environment.
      </p>

      {loading ? (
        <div className="loading-spinner">Loading features...</div>
      ) : (
        <div className="features-grid">
          {features.map((feature, index) => {
            const isUnlocked = unlockedFeatures[feature.id];
            return (
              <div key={index} className={`feature-card ${!isUnlocked ? "locked" : "unlocked"}`}>
                <div className="feature-icon-wrapper">
                  <div className="feature-icon">{feature.icon}</div>
                  {!isUnlocked && <div className="lock-badge"><Lock size={14} /></div>}
                </div>

                <h2>{feature.title}</h2>
                <p>{feature.description}</p>

                <div className="feature-footer">
                  <span className="feature-price">{feature.price === 0 ? "FREE" : `$${feature.price}`}</span>
                  {isUnlocked ? (
                    <button
                      className="open-btn"
                      onClick={() => navigate(feature.route)}
                    >
                      Open
                    </button>
                  ) : (
                    <button
                      className="unlock-btn"
                      onClick={() => handleUnlock(feature)}
                    >
                      Unlock
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Features;
