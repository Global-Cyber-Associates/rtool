// /backend/src/controllers/dashboardController.js

import Dashboard from "../models/Dashboard.js";

export async function getDashboard(req, res) {
  try {
    const { tenantId } = req.user;
    const snapshot = await Dashboard.findOne({ tenantId }).lean();
    if (!snapshot) {
      // Return empty structure if not ready yet
      return res.json({
        summary: { all: 0, active: 0, inactive: 0, unknown: 0, routers: 0 },
        allDevices: [], activeAgents: [], inactiveAgents: [], routers: [], unknownDevices: []
      });
    }
    res.json(snapshot);
  } catch (err) {
    console.error("Dashboard fetch error:", err);
    res.status(500).json({ error: "internal" });
  }
}

export async function getSummary(req, res) {
  try {
    const { tenantId } = req.user;
    const doc = await Dashboard.findOne(
      { tenantId },
      "summary timestamp"
    ).lean();

    if (!doc) {
      return res.json({
        summary: { all: 0, active: 0, inactive: 0, unknown: 0, routers: 0 }
      });
    }

    res.json(doc);
  } catch (err) {
    console.error("Dashboard summary error:", err);
    res.status(500).json({ error: "internal" });
  }
}
