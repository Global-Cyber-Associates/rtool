import express from "express";
import http from "http";
import cors from "cors";
import fs from "fs";
import path from "path";
import { Server } from "socket.io";
import { connectMongo } from "./db.js";

import { saveAgentData, saveNetworkScan } from "./save.js";
import { runVisualizerUpdate } from "./visualizer-script/visualizer.js";

import * as GetData from "./get.js";
import { checkUsbStatus } from "./controllers/usbhandler.js";
import usbRoutes from "./api/usb.js";
import visualizerDataRoute from "./api/visualizerData.js";
import systemRoutes from "./api/system.js";
import { getLogsSnapshot } from "./controllers/logsController.js";
import logsStatusRoute from "./api/logs.js";
import scanRunRouter from "./api/scanRun.js";
import { isRouterIP } from "./utils/networkHelpers.js";
import LogsStatus from "./models/Log.js";

const configPath = path.resolve("./config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

const app = express();
app.use(cors({ origin: config.cors_origin || "*" }));
app.use(express.json());

app.use("/api/visualizer-data", visualizerDataRoute);
app.use("/api", systemRoutes);
app.use("/api/logs-status", logsStatusRoute);
app.use("/api/usb", usbRoutes);
app.use("/api/scan", scanRunRouter);

app.get("/health", (_req, res) =>
  res.json({ status: "ok", ts: new Date().toISOString() })
);

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: config.cors_origin || "*", methods: ["GET", "POST"] },
  pingTimeout: 20000,
  pingInterval: 5000,
});

const logPath = path.join(process.cwd(), "agent_data_log.json");


// -----------------------------------------------------
// LOG SNAPSHOT LOOP (UNCHANGED)
// -----------------------------------------------------
setInterval(async () => {
  try {
    let snapshot = await getLogsSnapshot();

    snapshot.unknownDevices = snapshot.unknownDevices.filter(
      (dev) => !isRouterIP(dev.ip, dev.hostname, dev.vendor)
    );

    await LogsStatus.findOneAndUpdate({}, { $set: snapshot }, { upsert: true });

    io.emit("logs_status_update", snapshot);
    console.log("[🧠] Logs snapshot updated");

  } catch (err) {
    console.error("❌ logs broadcast error:", err);
  }
}, 5000);


// -----------------------------------------------------
// SOCKET.IO
// -----------------------------------------------------
io.on("connection", (socket) => {
  const ip =
    socket.handshake.headers["x-forwarded-for"]?.split(",")[0] ||
    socket.handshake.address ||
    "unknown";

  console.log(`🔌 Agent connected: ${socket.id} (${ip})`);


  // -----------------------------------------------------
  // ⭐ RAW NETWORK SCAN HANDLER
  // -----------------------------------------------------
  socket.on("network_scan_raw", async (devicesList) => {
    console.log("📡 RAW SCAN RECEIVED:", devicesList?.length);
    await saveNetworkScan(devicesList);
  });


  // -----------------------------------------------------
  // ⭐ RESTORED get_data HANDLER (REQUIRED BY FRONTEND)
  // -----------------------------------------------------
  socket.on("get_data", async (params, callback) => {
    try {
      const result = await GetData.fetchData(params);
      callback(result);
    } catch (err) {
      console.error("❌ Error fetching data:", err);
      callback({ success: false, message: "Failed", data: [] });
    }
  });


  // -----------------------------------------------------
  // ⭐ EXISTING agent_data
  // -----------------------------------------------------
  socket.on("agent_data", async (payload) => {
    try {
      if (!payload?.type || !payload?.data || !payload?.agentId) {
        socket.emit("agent_response", { success: false, message: "Invalid payload format" });
        return;
      }

      payload.ip = ip;

      try {
        const logs = fs.existsSync(logPath)
          ? JSON.parse(fs.readFileSync(logPath, "utf8"))
          : [];
        logs.push({ timestamp: new Date().toISOString(), payload });
        fs.writeFileSync(logPath, JSON.stringify(logs.slice(-200), null, 2), "utf8");
      } catch (err) {
        console.error("❌ Failed to log agent data:", err);
      }

      if (payload.type === "usb_devices") {
        const connected = payload.data.connected_devices || [];
        const deviceStatus = await checkUsbStatus(payload.agentId, connected);
        socket.emit("usb_validation", { devices: deviceStatus });
        return;
      }

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


  socket.on("disconnect", (reason) => {
    console.log(`⚠️ Agent disconnected: ${socket.id} (${reason})`);
  });
});


// -----------------------------------------------------
// START SERVER (WITH VISUALIZER INTERVAL)
// -----------------------------------------------------
async function start() {
  try {
    await connectMongo(config.mongo_uri);
    console.log("✅ MongoDB connected");

    // ⭐ ADD ONLY THIS — NOTHING ELSE ⭐
    setInterval(runVisualizerUpdate, 500);

    server.listen(config.socket_port || 5000, "0.0.0.0", () =>
      console.log(`🚀 Socket server running on port ${config.socket_port || 5000}`)
    );

  } catch (err) {
    console.error("💥 Failed to start server:", err);
    process.exit(1);
  }
}

start();
