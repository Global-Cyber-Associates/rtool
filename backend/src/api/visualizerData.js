import express from "express";
import VisualizerData from "../models/VisualizerData.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

// GET /api/visualizer
router.get("/", authMiddleware, async (req, res) => {
  try {
    const data = await VisualizerData.find({ tenantId: req.user.tenantId });
    res.json(data);
  } catch (err) {
    console.error("Error fetching visualizer data:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
