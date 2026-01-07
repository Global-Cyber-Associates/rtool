import mongoose from "mongoose";

const AgentDownloadSchema = new mongoose.Schema(
    {
        tenantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Tenant",
            index: true,
            required: true,
        },
        appName: {
            type: String,
            required: true,
        },
        ip: String,
        userAgent: String,
        timestamp: {
            type: Date,
            default: Date.now,
        },
    },
    { timestamps: true }
);

export default mongoose.model("AgentDownload", AgentDownloadSchema);
