import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import EventLog from "../models/EventLog.js";
import Agent from "../models/Agent.js";

const router = express.Router();

// Get all agents that have file logs
router.get("/agents", authMiddleware, async (req, res) => {
    try {
        const tenantId = req.user.tenantId;

        // Get unique agent IDs with file logs
        const agentIds = await EventLog.distinct("agentId", {
            tenantKey: tenantId.toString(),
            source: "watchdog"
        });

        // Get agent details and counts
        const agents = await Promise.all(
            agentIds.map(async (agentId) => {
                // Get agent info
                const agent = await Agent.findOne({ agentId, tenantId }).lean();

                // Get counts by event type
                const counts = await EventLog.aggregate([
                    {
                        $match: {
                            agentId,
                            tenantKey: tenantId.toString(),
                            source: "watchdog"
                        }
                    },
                    {
                        $group: {
                            _id: "$eventType",
                            count: { $sum: 1 }
                        }
                    }
                ]);

                const countMap = {};
                counts.forEach(c => {
                    countMap[c._id] = c.count;
                });

                return {
                    agentId,
                    hostname: agent?.hostname || agent?.os || "Unknown",
                    status: agent?.status || "unknown",
                    renameCount: countMap["Rename"] || 0,
                    rewriteCount: countMap["Rewrite"] || 0,
                    deleteCount: countMap["Delete"] || 0,
                    totalCount: (countMap["Rename"] || 0) + (countMap["Rewrite"] || 0) + (countMap["Delete"] || 0)
                };
            })
        );

        res.json({
            success: true,
            agents: agents.filter(a => a.totalCount > 0)
        });
    } catch (err) {
        console.error("[FileMonitor] Error fetching agents:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Get file logs for a specific agent
router.get("/logs/:agentId", authMiddleware, async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const { agentId } = req.params;
        const { limit = 200 } = req.query;

        // Get file logs for the agent
        const logs = await EventLog.find({
            agentId,
            tenantKey: tenantId.toString(),
            source: "watchdog"
        })
            .sort({ timestamp: -1 })
            .limit(parseInt(limit))
            .lean();

        // Calculate counts
        let renameCount = 0;
        let rewriteCount = 0;
        let deleteCount = 0;

        logs.forEach(log => {
            if (log.eventType === "Rename") renameCount++;
            else if (log.eventType === "Rewrite") rewriteCount++;
            else if (log.eventType === "Delete") deleteCount++;
        });

        res.json({
            success: true,
            logs,
            counts: {
                rename: renameCount,
                rewrite: rewriteCount,
                delete: deleteCount
            }
        });
    } catch (err) {
        console.error("[FileMonitor] Error fetching logs:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

export default router;
