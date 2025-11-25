import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import ScanResult from "../models/VisualizerScanner.js";   // NEW RAW SCAN FORMAT
import SystemInfo from "../models/SystemInfo.js";
import VisualizerData from "../models/VisualizerData.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.resolve(__dirname, "../config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
const MONGO_URI = config.mongo_uri;

let connected = false;

async function connectDB() {
  if (!connected) {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    connected = true;
    console.log("✅ MongoDB connected for visualizer update");
  }
}

export async function runVisualizerUpdate() {
  try {
    await connectDB();

    // 1️⃣ Load ALL raw scanner results
    const allScans = await ScanResult.find({});
    if (!allScans.length) {
      console.log("⚠️ No scan results found.");
      return;
    }

    // 2️⃣ Load all agents' system info
    const systems = await SystemInfo.find();
    const ipToHostname = new Map();
    const ipToAgentId = new Map();
    const agentIPs = new Set();

    systems.forEach((sys) => {
      const wlanInfo = sys.data?.wlan_info || sys.wlan_ip || [];
      const hostname = sys.data?.hostname || sys.hostname || "Unknown";
      const agentId = sys.agentId || sys.agent_id || "unknown";

      wlanInfo.forEach((iface) => {
        const ip = (iface.address || "").trim();
        if (ip) {
          agentIPs.add(ip);
          ipToHostname.set(ip, hostname);
          ipToAgentId.set(ip, agentId);
        }
      });
    });

    // 3️⃣ ALL entries in VisualizerScanner are alive
    const aliveDevices = allScans.filter((dev) => !!dev.ip);

    if (!aliveDevices.length) {
      console.log("⚠️ No active devices detected — nothing updated.");
      return;
    }

    // 4️⃣ Normalize final output
    const finalDevices = aliveDevices.map((dev) => {
      const ip = dev.ip.trim();
      const hasAgent = agentIPs.has(ip);

      return {
        agentId: hasAgent ? ipToAgentId.get(ip) : "unknown",
        ip,
        mac: dev.mac || "Unknown",
        vendor: dev.vendor || "Unknown",
        hostname: hasAgent ? ipToHostname.get(ip) : "Unknown",
        noAgent: !hasAgent,
        createdAt: new Date(),
      };
    });

    // 5️⃣ Save into VisualizerData table
    await VisualizerData.deleteMany({});
    await VisualizerData.insertMany(finalDevices);

    console.log(
      `[${new Date().toLocaleTimeString()}] ✅ Visualizer updated — ${finalDevices.length} active devices stored`
    );

  } catch (err) {
    console.error(
      `[${new Date().toLocaleTimeString()}] ❌ Visualizer update failed:`,
      err.message
    );
  }
}
