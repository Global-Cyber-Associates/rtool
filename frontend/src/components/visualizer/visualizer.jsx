import React, { useState, useEffect } from "react";
import Sidebar from "../navigation/sidenav.jsx";
import TopNav from "../navigation/topnav.jsx";
import FloorManager from "./view/FloorManager.jsx";
import FloorGrid from "./view/FloorGrid.jsx";
import socket, { fetchData } from "../../utils/socket.js";
import "./visualizer.css";

export default function Visualizer() {
  const [floors, setFloors] = useState([{ id: 1, name: "Floor 1", devices: [] }]);
  const [activeFloor, setActiveFloor] = useState(1);
  const [loading, setLoading] = useState(false);

  // ✅ Fetch devices via socket
  // ✅ Fetch devices via API (HTTP) for reliable load
  useEffect(() => {
    setLoading(true);
    const token = sessionStorage.getItem("token");

    fetch(`${import.meta.env.VITE_BACKEND_URL}/api/visualizer-data`, {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    })
      .then((res) => res.json())
      .then((data) => {
        if (!Array.isArray(data)) return;

        const fetchedDevices = data.map((d, i) => ({
          ...d,
          id: i + 1,
          name: d.agentId || d.hostname || "Unknown",
          ip: d.ip || "N/A",
          mac: d.mac || "Unknown",
          noAgent: d.noAgent,
          x: (i % 6) * 120,
          y: Math.floor(i / 6) * 120,
        }));

        setFloors([{ id: 1, name: "Floor 1", devices: fetchedDevices }]);
      })
      .catch((err) => console.error("❌ Failed to fetch devices:", err))
      .finally(() => setLoading(false));

    // ✅ Fix for socket update overwriting agentId
    socket.on("visualizer_update", (deviceUpdate) => {
      setFloors((prev) =>
        prev.map((f) =>
          f.id === 1
            ? {
              ...f,
              devices: f.devices.map((d) =>
                d.ip === deviceUpdate.ip
                  ? {
                    ...d,
                    ...deviceUpdate,
                    name: deviceUpdate.agentId || deviceUpdate.hostname || d.agentId || d.hostname || d.name || "Unknown", // 🔥 force agentId display
                  }
                  : d
              ),
            }
            : f
        )
      );
    });

    return () => {
      socket.off("visualizer_update");
    };
  }, []);

  const addFloor = () => {
    const newId = floors.length + 1;
    setFloors([...floors, { id: newId, name: `Floor ${newId}`, devices: [] }]);
    setActiveFloor(newId);
  };

  const updateFloorDevices = (floorId, devices) => {
    setFloors((prev) =>
      prev.map((f) => (f.id === floorId ? { ...f, devices } : f))
    );
  };

  return (
    <div className="visualizer-content-wrapper">
      <div className="visualizer-header">
        <h1>Network Visualizer</h1>
        <FloorManager
          floors={floors}
          activeFloor={activeFloor}
          onAdd={addFloor}
          onSwitch={setActiveFloor}
        />
      </div>

      <FloorGrid
        key={activeFloor}
        floor={floors.find((f) => f.id === activeFloor)}
        updateDevices={(devices) => updateFloorDevices(activeFloor, devices)}
      />
      {loading && <div className="loading-overlay">Fetching devices...</div>}
    </div>
  );
}
