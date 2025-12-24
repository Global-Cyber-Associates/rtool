// routes/system.js
import express from "express";
import SystemInfo from "../models/SystemInfo.js";

const router = express.Router();

// POST /api/system
// POST /api/system
router.post("/system", async (req, res) => {
  try {
    const systemData = req.body.system;
    if (!systemData) {
      return res.status(400).json({ message: "No system data provided" });
    }

    // Check if system already exists
    const existing = await SystemInfo.findOne({ machine_id: systemData.machine_id });
    if (existing) {
      return res.status(200).json({ message: "System already exists", id: existing._id });
    }

    const newSystem = new SystemInfo(systemData);
    await newSystem.save();

    res.status(201).json({ message: "System info saved", id: newSystem._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to save system info", error: err.message });
  }
});


import os from "os";

// ... (previous routes)

// ✅ GET /api/system/server-ip — returns server's primary LAN IP
router.get("/server-ip", (req, res) => {
  try {
    const interfaces = os.networkInterfaces();
    let bestIp = "127.0.0.1";

    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === "IPv4" && !iface.internal) {
          // Prefer 192, 10, or 172 ranges
          if (
            iface.address.startsWith("192.") ||
            iface.address.startsWith("10.") ||
            iface.address.startsWith("172.")
          ) {
            return res.json({ ip: iface.address });
          }
          bestIp = iface.address;
        }
      }
    }
    res.json({ ip: bestIp });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;