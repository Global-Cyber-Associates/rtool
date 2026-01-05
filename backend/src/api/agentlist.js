import express from "express";
import Agent from "../models/Agent.js";
import Dashboard from "../models/Dashboard.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * GET /api/agents
 * Optimized to serve "Clean" aggregated data from the dashboard snapshot
 * for better accuracy and deduplication.
 */
router.get("/", authMiddleware, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;

    // 1. Try to get the latest hyper-stable snapshot from the dashboard aggregator
    const snapshot = await Dashboard.findOne({ tenantId }).lean();

    if (snapshot && (snapshot.activeAgents || snapshot.inactiveAgents)) {
      // Merge active and inactive agents for the full list
      const combined = [
        ...(snapshot.activeAgents || []),
        ...(snapshot.inactiveAgents || [])
      ].sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen));

      return res.status(200).json(combined);
    }

    // 2. Fallback to raw Agent collection if no snapshot exists yet
    const agents = await Agent.find({ tenantId }).sort({ lastSeen: -1 }).lean();
    res.status(200).json(agents);
    
  } catch (err) {
    console.error("Error fetching agents snapshot:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
