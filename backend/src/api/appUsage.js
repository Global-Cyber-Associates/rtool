import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { getAgentUsage } from "../controllers/usageController.js";

const router = express.Router();

// GET /api/app-usage/:agentId
router.get("/:agentId", authMiddleware, async (req, res) => {
    try {
        const { agentId } = req.params;
        const { tenantId } = req.user;

        const usageData = await getAgentUsage(agentId, tenantId);

        res.json({ success: true, data: usageData });
    } catch (err) {
        console.error("❌ App Usage API error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

export default router;
