// routes/usb.js
import express from "express";
import UsbDevice from "../models/usbdevices.js";

import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

/* =======================================================
   Fetch all USBDevices documents (Tenant Scoped)
======================================================= */
router.get("/", authMiddleware, async (req, res) => {
  try {
    const devices = await UsbDevice.find({ tenantId: req.user.tenantId });
    res.json(devices);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =======================================================
   Update a user's USB status (Tenant Scoped)
   POST /api/usb/status
   Body: { serial, username, status }
======================================================= */
router.post("/status", authMiddleware, async (req, res) => {
  const { serial, username, status } = req.body;

  if (!serial || !username || !status) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    // Find the agent within the TENANT
    const agent = await UsbDevice.findOne({
      agentId: username,
      tenantId: req.user.tenantId
    });

    if (!agent) return res.status(404).json({ message: "User not found" });

    // Find the device in this agent
    const device = agent.data.connected_devices.find((d) => d.serial_number === serial);
    if (!device) return res.status(404).json({ message: "Device not found" });

    // Update status
    device.status = status;
    await agent.save();

    res.json({ message: "Status updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
