import mongoose from "mongoose";

const AppUsageSchema = new mongoose.Schema({
    agentId: { type: String, required: true },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true },
    appName: { type: String, required: true },
    totalDuration: { type: Number, default: 0 }, // Total accumulated time in ms
    lastTitle: { type: String, default: "" },
    activeSession: {
        pid: { type: Number },
        openedAt: { type: Date }, // stored in UTC usually
    },
    lastUpdated: { type: Date, default: Date.now },
});

// Composite index for efficient lookups
AppUsageSchema.index({ agentId: 1, appName: 1, tenantId: 1 }, { unique: true });

const AppUsage = mongoose.model("AppUsage", AppUsageSchema);
export default AppUsage;
