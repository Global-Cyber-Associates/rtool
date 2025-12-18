import mongoose from "mongoose";

const AgentSchema = new mongoose.Schema(
  {
    agentId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // ⭐ MULTI-TENANT LINK
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
      immutable: true, // ❗ agent cannot change tenant
    },

    socketId: { type: String },
    ip: { type: String },

    status: {
      type: String,
      enum: ["online", "offline"],
      default: "offline",
    },

    lastSeen: { type: Date, default: Date.now },
    mac: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("Agent", AgentSchema);
