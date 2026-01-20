import { EventLog } from "../models/index.js";

/**
 * Process incoming event logs from agent
 */
export const processEventLogs = async (data) => {
    try {
        const { agentId, tenantKey, events } = data;

        if (!agentId || !tenantKey || !events || !Array.isArray(events)) {
            console.error("[EventLog] Invalid data received:", { agentId, tenantKey, eventCount: events?.length });
            return { success: false, error: "Invalid data format" };
        }

        // Prepare events for bulk insert
        const eventDocs = events.map(event => ({
            agentId,
            tenantKey,
            eventId: event.eventId,
            eventType: event.eventType,
            timestamp: new Date(event.timestamp),
            source: event.source || "",
            computer: event.computer || "",
            category: event.category || 0,
            severity: event.severity || "info",
            description: event.description || "",
            details: event.details || {},
            receivedAt: new Date(),
        }));

        // Bulk insert events
        const result = await EventLog.insertMany(eventDocs, { ordered: false });

        console.log(`[EventLog] Stored ${result.length} events for agent ${agentId}`);

        return {
            success: true,
            count: result.length,
        };
    } catch (error) {
        console.error("[EventLog] Error processing events:", error);
        return {
            success: false,
            error: error.message,
        };
    }
};

/**
 * Get event logs for a specific agent
 */
export const getEventLogsByAgent = async (req, res) => {
    try {
        const { agentId } = req.params;
        const { limit = 100, page = 1, severity, eventId, startDate, endDate } = req.query;

        // Build query
        const query = { agentId };

        if (severity) {
            query.severity = severity;
        }

        if (eventId) {
            query.eventId = parseInt(eventId);
        }

        if (startDate || endDate) {
            query.timestamp = {};
            if (startDate) query.timestamp.$gte = new Date(startDate);
            if (endDate) query.timestamp.$lte = new Date(endDate);
        }

        // Execute query with pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const events = await EventLog.find(query)
            .sort({ timestamp: -1 })
            .limit(parseInt(limit))
            .skip(skip)
            .lean();

        const total = await EventLog.countDocuments(query);

        res.json({
            success: true,
            data: events,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit)),
            },
        });
    } catch (error) {
        console.error("[EventLog] Error fetching events:", error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
};

/**
 * Get event statistics for an agent
 */
export const getEventStats = async (req, res) => {
    try {
        const { agentId } = req.params;
        const { hours = 24 } = req.query;

        const since = new Date(Date.now() - hours * 60 * 60 * 1000);

        // Aggregate statistics
        const stats = await EventLog.aggregate([
            {
                $match: {
                    agentId,
                    timestamp: { $gte: since },
                },
            },
            {
                $group: {
                    _id: "$severity",
                    count: { $sum: 1 },
                },
            },
        ]);

        // Event type distribution
        const eventTypes = await EventLog.aggregate([
            {
                $match: {
                    agentId,
                    timestamp: { $gte: since },
                },
            },
            {
                $group: {
                    _id: "$eventType",
                    count: { $sum: 1 },
                },
            },
            {
                $sort: { count: -1 },
            },
            {
                $limit: 10,
            },
        ]);

        // Recent critical events
        const criticalEvents = await EventLog.find({
            agentId,
            severity: { $in: ["error", "failure"] },
            timestamp: { $gte: since },
        })
            .sort({ timestamp: -1 })
            .limit(10)
            .lean();

        res.json({
            success: true,
            data: {
                severityStats: stats,
                topEventTypes: eventTypes,
                recentCritical: criticalEvents,
                period: `${hours} hours`,
            },
        });
    } catch (error) {
        console.error("[EventLog] Error fetching stats:", error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
};

/**
 * Get recent events (for real-time display)
 */
export const getRecentEvents = async (req, res) => {
    try {
        const { agentId } = req.params;
        const { limit = 50 } = req.query;

        const events = await EventLog.find({ agentId })
            .sort({ timestamp: -1 })
            .limit(parseInt(limit))
            .lean();

        res.json({
            success: true,
            data: events,
        });
    } catch (error) {
        console.error("[EventLog] Error fetching recent events:", error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
};

/**
 * Delete old events (cleanup)
 */
export const cleanupOldEvents = async (daysToKeep = 30) => {
    try {
        const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

        const result = await EventLog.deleteMany({
            receivedAt: { $lt: cutoffDate },
        });

        console.log(`[EventLog] Cleanup: Deleted ${result.deletedCount} old events`);

        return {
            success: true,
            deletedCount: result.deletedCount,
        };
    } catch (error) {
        console.error("[EventLog] Error during cleanup:", error);
        return {
            success: false,
            error: error.message,
        };
    }
};
