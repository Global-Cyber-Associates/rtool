import mongoose from "mongoose";

const VulnFlagSchema = new mongoose.Schema(
  {
    description: String,
    impact: {
      type: String,
      enum: ["Info", "Low", "Medium", "High", "Critical"],
      default: "Info",
    },
  },
  { _id: false }
);

const HostSchema = new mongoose.Schema(
  {
    ip: String,
    mac: String,
    open_ports: Object,
    impact_level: {
      type: String,
      enum: ["Info", "Low", "Medium", "High", "Critical"],
      default: "Info",
    },
    vuln_flags: [VulnFlagSchema],
  },
  { _id: false }
);

const ScanResultSchema = new mongoose.Schema(
  {
    // ⭐ MULTI-TENANT KEY
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },

    ok: {
      type: Boolean,
      default: true,
    },

    network: String,

    scanned_at: String,

    duration_seconds: Number,

    hosts: [HostSchema],

    overall_impact: {
      type: String,
      enum: ["Info", "Low", "Medium", "High", "Critical"],
      default: "Info",
    },

    raw: Object, // full original scanner output

    source: {
      type: String,
      default: "local-scanner",
    },

    updated_at: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// ⭐ Tenant-safe lookup
ScanResultSchema.index({ tenantId: 1 });

export default mongoose.model("ScanResult", ScanResultSchema);
