import React, { useState, useEffect } from "react";
import Sidebar from "../navigation/sidenav.jsx";
import FloorManager from "./view/FloorManager.jsx";
import FloorGrid from "./view/FloorGrid.jsx";
import socket from "../../utils/socket.js";
import { apiGet } from "../../utils/api.js";
import "./visualizer.css";

export default function Visualizer() {
  const [allFetchedDevices, setAllFetchedDevices] = useState([]);
  const [viewMode, setViewMode] = useState("my_office"); // "my_office" or "unknown"
  const [floors, setFloors] = useState([{ id: 1, name: "Floor 1", devices: [] }]);
  const [activeFloor, setActiveFloor] = useState(1);
  const [loading, setLoading] = useState(false);

  // ✅ Fetch devices via API (HTTP) for reliable load
  useEffect(() => {
    let currentHash = "";

    const processDevices = (list) => {
      const dataHash = JSON.stringify(list);
      if (dataHash === currentHash) return null;
      currentHash = dataHash;

      return list.map(d => {
        const rawName = d.hostname || d.agentId || "";
        // Client-side fallback for router detection
        const isRouterDetected = d.isRouter ||
          (d.ip && d.ip.endsWith(".1")) ||
          (d.ip && d.ip.endsWith(".254")) ||
          /router|gateway|modem|dlink|tplink/i.test(rawName);
        return { ...d, isRouter: isRouterDetected };
      });
    };

    setLoading(true);
    apiGet("/api/visualizer-data")
      .then((res) => res.json())
      .then((data) => {
        if (!Array.isArray(data)) return;
        const devices = processDevices(data);
        if (devices) setAllFetchedDevices(devices);
      })
      .catch((err) => console.error("❌ Failed to fetch devices:", err))
      .finally(() => setLoading(false));

    // ✅ Listen for bulk refresh from aggregator
    socket.on("visualizer_refresh", (newList) => {
      console.log("🎨 Visualizer Socket Refresh:", newList.length, "devices");
      const devices = processDevices(newList);
      if (devices) setAllFetchedDevices(devices);
    });

    return () => {
      socket.off("visualizer_refresh");
    };
  }, []);

  // Filter and Map devices whenever allFetchedDevices or viewMode changes
  useEffect(() => {
    const filtered = allFetchedDevices.filter(d => {
      // "My Office" includes agents and routers
      if (viewMode === "my_office") return !d.noAgent || d.isRouter;
      // "Unknown" includes everything else
      return d.noAgent && !d.isRouter;
    });

    const mapped = filtered.map((d, i) => ({
      ...d,
      id: d.ip || `device-${i}`,
      name: d.agentId && d.agentId !== "unknown" ? d.agentId : (d.hostname && d.hostname !== "Unknown" ? d.hostname : d.ip),
      ip: d.ip || "N/A",
      mac: d.mac || "Unknown",
      noAgent: d.noAgent,
      isRouter: d.isRouter,
      x: (i % 6) * 120,
      y: Math.floor(i / 6) * 120,
    }));

    setFloors([{ id: 1, name: "Floor 1", devices: mapped }]);
  }, [allFetchedDevices, viewMode]);

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
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <h1>Network Visualizer</h1>

          <div className="segment-control">
            <button
              className={`segment-btn ${viewMode === 'my_office' ? 'active' : ''}`}
              onClick={() => setViewMode('my_office')}
            >
              My Office
            </button>
            <button
              className={`segment-btn ${viewMode === 'unknown' ? 'active' : ''}`}
              onClick={() => setViewMode('unknown')}
            >
              Unknown Devices
            </button>
          </div>
        </div>

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
