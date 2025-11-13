import express from "express";
import http from "http";
import cors from "cors";
import fs from "fs";
import path from "path";
import { Server } from "socket.io";
import { connectMongo } from "./db.js";
import { saveAgentData } from "./save.js";
import * as GetData from "./get.js";
import { checkUsbStatus } from "./controllers/usbhandler.js";
import usbRoutes from "./api/usb.js";
import visualizerDataRoute from "./api/visualizerData.js";
import systemRoutes from "./api/system.js";
import { getLogsSnapshot } from "./controllers/logsController.js";
import logsStatusRoute from "./api/logs.js";
import scanRunRouter from "./api/scanRun.js";
import { isRouterIP } from "./utils/networkHelpers.js"; // ✅ Router detection utility
import LogsStatus from "./models/Log.js"; // ✅ Model for logs snapshot

import "./visualizer-script/visualizerScanner.js";

// Load config
const configPath = path.resolve("./config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

const app = express();
app.use(cors({ origin: config.cors_origin || "*" }));
app.use(express.json());

// Register API routes
app.use("/api/visualizer-data", visualizerDataRoute);
app.use("/api", systemRoutes);
app.use("/api/logs-status", logsStatusRoute);
app.use("/api/usb", usbRoutes);
app.use("/api/scan", scanRunRouter);

app.get("/health", (_req, res) =>
  res.json({ status: "ok", ts: new Date().toISOString() })
);

// --- Create HTTP and WebSocket server ---
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: config.cors_origin || "*", methods: ["GET", "POST"] },
  pingTimeout: 20000,
  pingInterval: 5000,
});

// --- Log path for incoming agent data ---
const logPath = path.join(process.cwd(), "agent_data_log.json");

// 🧠 Emit live logs snapshot every 10 seconds
setInterval(async () => {
  try {
    // Get snapshot (system info + unknown devices + server status)
    let snapshot = await getLogsSnapshot();

    // 🧩 Filter out routers/hotspots from unknownDevices
    snapshot.unknownDevices = snapshot.unknownDevices.filter(
      (dev) => !isRouterIP(dev.ip, dev.hostname, dev.vendor)
    );

    // 🧹 Keep only ONE entry in LogsStatus (replace each cycle)
    await LogsStatus.findOneAndUpdate({}, { $set: snapshot }, { upsert: true, new: true });

    // Emit to connected clients
    io.emit("logs_status_update", snapshot);
    console.log("[🧠] Logs snapshot updated & broadcast:", new Date().toISOString());
  } catch (err) {
    console.error("❌ logs broadcast error:", err);
  }
}, 5000);

// --- Socket.IO agent communication ---
io.on("connection", (socket) => {
  const ip =
    socket.handshake.headers["x-forwarded-for"]?.split(",")[0] ||
    socket.handshake.address ||
    "unknown";
  console.log(`🔌 Agent connected: ${socket.id} (${ip})`);

  socket.on("agent_data", async (payload) => {
    try {
      if (!payload?.type || !payload?.data || !payload?.agentId) {
        socket.emit("agent_response", { success: false, message: "Invalid payload format" });
        return;
      }

      payload.ip = ip;

      // --- Optional local JSON log for debugging ---
      try {
        const logs = fs.existsSync(logPath)
          ? JSON.parse(fs.readFileSync(logPath, "utf-8"))
          : [];
        logs.push({ timestamp: new Date().toISOString(), payload });
        fs.writeFileSync(logPath, JSON.stringify(logs.slice(-200), null, 2), "utf-8"); // keep last 200 only
      } catch (err) {
        console.error("❌ Failed to log agent data:", err);
      }

      console.log(`[📦] Received ${payload.type} from agent ${payload.agentId} (${ip})`);

      // --- Handle USB devices separately ---
      if (payload.type === "usb_devices") {
        const connectedDevices = payload.data.connected_devices || [];
        console.log("[🔹] Connected devices received:", connectedDevices);

        const devicesWithStatus = await checkUsbStatus(payload.agentId, connectedDevices);
        socket.emit("usb_validation", { devices: devicesWithStatus });
        console.log("[✅] USB statuses sent to agent:", devicesWithStatus);
        return;
      }

      // --- Save data for all other agent types ---
      await saveAgentData(payload);
      socket.emit("agent_response", {
        success: true,
        message: `${payload.type} saved successfully`,
      });
    } catch (err) {
      console.error("❌ Error handling agent data:", err);
      socket.emit("agent_response", {
        success: false,
        message: "Failed to save agent data",
        error: err.message,
      });
    }
  });

  socket.on("get_data", async (params, callback) => {
    try {
      const result = await GetData.fetchData(params);
      callback(result);
    } catch (err) {
      console.error("❌ Error fetching data:", err);
      callback({
        success: false,
        message: "Failed to fetch data",
        error: err.message,
        data: [],
      });
    }
  });

  socket.on("disconnect", (reason) => {
    console.log(`⚠️ Agent disconnected: ${socket.id} (${reason})`);
  });
});

// --- Start server ---
async function start() {
  try {
    await connectMongo(config.mongo_uri);
    console.log("✅ MongoDB connected");

    server.listen(config.socket_port || 5000, "0.0.0.0", () => {
      console.log(`🚀 Socket server running on port ${config.socket_port || 5000}`);
    });
  } catch (err) {
    console.error("💥 Failed to start server:", err);
    process.exit(1);
  }
}

start();
