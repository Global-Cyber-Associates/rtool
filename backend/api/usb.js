import express from "express";
import UsbDevice from "../models/UsbDevices.js";

const router = express.Router();

/* =======================================================
   Create New USB Request
======================================================= */
router.post("/request", async (req, res) => {
  try {
    const { username, model, pnpid, drive } = req.body;
    if (!username || !pnpid)
      return res.status(400).json({ message: "username and pnpid required" });

    const PNPID = String(pnpid).toUpperCase().trim();
    const existing = await UsbDevice.findOne({ pnpid: PNPID });

    if (existing) {
      return res.status(200).json({
        message: `Device already exists with status: ${existing.status}`,
        device: existing,
      });
    }

    const device = await UsbDevice.create({
      username: username.trim(),
      model: model?.trim() || "Unknown",
      pnpid: PNPID,
      drive: drive?.trim() || "",
      status: "pending",
    });

    res.status(201).json({ message: "Request created", device });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =======================================================
   Approve Request
======================================================= */
router.post("/approve", async (req, res) => {
  try {
    const { pnpid } = req.body;
    if (!pnpid) return res.status(400).json({ message: "pnpid required" });

    const device = await UsbDevice.findOneAndUpdate(
      { pnpid: String(pnpid).toUpperCase().trim() },
      { status: "approved" },
      { new: true }
    );

    if (!device) return res.status(404).json({ message: "Device not found" });
    res.json({ message: "Device approved", device });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =======================================================
   Deny Request
======================================================= */
router.post("/deny", async (req, res) => {
  try {
    const { pnpid } = req.body;
    if (!pnpid) return res.status(400).json({ message: "pnpid required" });

    const device = await UsbDevice.findOneAndUpdate(
      { pnpid: String(pnpid).toUpperCase().trim() },
      { status: "denied" },
      { new: true }
    );

    if (!device) return res.status(404).json({ message: "Device not found" });
    res.json({ message: "Device denied", device });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =======================================================
   Block Device
======================================================= */
router.post("/block", async (req, res) => {
  try {
    const { pnpid } = req.body;
    if (!pnpid) return res.status(400).json({ message: "pnpid required" });

    const device = await UsbDevice.findOneAndUpdate(
      { pnpid: String(pnpid).toUpperCase().trim() },
      { status: "blocked" },
      { new: true }
    );

    if (!device) return res.status(404).json({ message: "Device not found" });
    res.json({ message: "Device blocked", device });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =======================================================
   Unblock Device → Moves Back to Pending
======================================================= */
router.post("/unblock", async (req, res) => {
  try {
    const { pnpid } = req.body;
    if (!pnpid) return res.status(400).json({ message: "pnpid required" });

    const device = await UsbDevice.findOneAndUpdate(
      { pnpid: String(pnpid).toUpperCase().trim() },
      { status: "pending" },
      { new: true }
    );

    if (!device) return res.status(404).json({ message: "Device not found" });
    res.json({ message: "Device unblocked (back to pending)", device });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =======================================================
   Fetch Lists by Status
======================================================= */
router.get("/:status", async (req, res) => {
  try {
    const validStatuses = ["pending", "approved", "denied", "blocked"];
    const { status } = req.params;

    if (!validStatuses.includes(status))
      return res.status(400).json({ message: "Invalid status" });

    const devices = await UsbDevice.find({ status }).sort({ updatedAt: -1 });
    res.json(devices);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =======================================================
   Fetch All Devices
======================================================= */
router.get("/", async (_, res) => {
  try {
    const devices = await UsbDevice.find().sort({ createdAt: -1 });
    res.json(devices);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
