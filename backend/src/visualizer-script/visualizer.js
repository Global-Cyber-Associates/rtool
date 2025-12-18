import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import VisualizerScanner from "../models/VisualizerScanner.js";
import SystemInfo from "../models/SystemInfo.js";
import VisualizerData from "../models/VisualizerData.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.resolve(__dirname, "../config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
const MONGO_URI = config.mongo_uri;

let connected = false;

// (DEFAULT TENANT REMOVED)

async function connectDB() {
  if (!connected) {
    await mongoose.connect(MONGO_URI);
    connected = true;
    console.log("✅ MongoDB connected for visualizer update");
  }
}

export async function runVisualizerUpdate(tenantId) {
  try {
    await connectDB();

    // 1️⃣ Load all scanner devices for this tenant
    const scans = await VisualizerScanner.find({
      tenantId,
    });

    if (!scans.length) {
      console.log("⚠️ No scanner devices found");
      return;
    }

    // 2️⃣ Load all system info (same tenant)
    const systems = await SystemInfo.find({
      tenantId,
    });

    const ipToHostname = new Map();
    const ipToAgentId = new Map();
    const agentIPs = new Set();

    systems.forEach((sys) => {
      const wlanInfo = sys.data?.wlan_info || [];
      const hostname = sys.data?.hostname || "Unknown";
      const agentId = sys.agentId || "unknown";

      wlanInfo.forEach((iface) => {
        const ip = iface.address?.trim();
        if (ip) {
          agentIPs.add(ip);
          ipToHostname.set(ip, hostname);
          ipToAgentId.set(ip, agentId);
        }
      });
    });

    // 3️⃣ Normalize final visualizer output
    const finalDevices = scans.map((dev) => {
      const ip = dev.ip.trim();
      const hasAgent = agentIPs.has(ip);

      return {
        tenantId,
        agentId: hasAgent ? ipToAgentId.get(ip) : "unknown",
        ip,
        mac: dev.mac || "Unknown",
        vendor: dev.vendor || "Unknown",
        hostname: hasAgent ? ipToHostname.get(ip) : "Unknown",
        noAgent: !hasAgent,
      };
    });

    // 4️⃣ Replace visualizer data (tenant-scoped)
    await VisualizerData.deleteMany({
      tenantId,
    });

    await VisualizerData.insertMany(finalDevices);

    console.log(
      `[${new Date().toLocaleTimeString()}] ✅ Visualizer updated for tenant ${tenantId} — ${finalDevices.length} devices`
    );
  } catch (err) {
    console.error(
      `[${new Date().toLocaleTimeString()}] ❌ Visualizer update failed:`,
      err.message
    );
  }
}
