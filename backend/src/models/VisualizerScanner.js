import mongoose from "mongoose";

const scannerDeviceSchema = new mongoose.Schema(
  {
    ip: { type: String, required: true, unique: true, index: true },
    mac: { type: String, default: null },
    vendor: { type: String, default: null },
    ping_only: { type: Boolean, default: true },
    lastSeen: { type: Date, default: Date.now }
  },
  { timestamps: true } // ⭐ add this for createdAt / updatedAt
);

export default mongoose.model("VisualizerScanner", scannerDeviceSchema);
