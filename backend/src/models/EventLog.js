import mongoose from "mongoose";

const eventLogSchema = new mongoose.Schema(
    {
        agentId: {
            type: String,
            required: true,
            index: true,
        },
        tenantKey: {
            type: String,
            required: true,
            index: true,
        },
        eventId: {
            type: Number,
            required: true,
        },
        eventType: {
            type: String,
            required: true,
        },
        timestamp: {
            type: Date,
            required: true,
            index: true,
        },
        source: {
            type: String,
            default: "",
        },
        computer: {
            type: String,
            default: "",
        },
        category: {
            type: Number,
            default: 0,
        },
        severity: {
            type: String,
            enum: ["info", "warning", "error", "success", "failure"],
            default: "info",
        },
        description: {
            type: String,
            default: "",
        },
        details: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
        receivedAt: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: true,
    }
);

// Compound indexes for efficient queries
eventLogSchema.index({ agentId: 1, timestamp: -1 });
eventLogSchema.index({ tenantKey: 1, timestamp: -1 });
eventLogSchema.index({ agentId: 1, eventId: 1, timestamp: -1 });
eventLogSchema.index({ tenantKey: 1, severity: 1, timestamp: -1 });

// TTL index - auto-delete events older than 30 days
eventLogSchema.index({ receivedAt: 1 }, { expireAfterSeconds: 2592000 });

export default mongoose.model("EventLog", eventLogSchema);
