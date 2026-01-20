import express from "express";
import {
    getEventLogsByAgent,
    getEventStats,
    getRecentEvents,
} from "../controllers/eventLogController.js";

const router = express.Router();

/**
 * @route   GET /api/event-logs/:agentId
 * @desc    Get event logs for a specific agent
 * @query   limit, page, severity, eventId, startDate, endDate
 */
router.get("/:agentId", getEventLogsByAgent);

/**
 * @route   GET /api/event-logs/:agentId/stats
 * @desc    Get event statistics for an agent
 * @query   hours (default: 24)
 */
router.get("/:agentId/stats", getEventStats);

/**
 * @route   GET /api/event-logs/:agentId/recent
 * @desc    Get recent events (for real-time display)
 * @query   limit (default: 50)
 */
router.get("/:agentId/recent", getRecentEvents);

export default router;
