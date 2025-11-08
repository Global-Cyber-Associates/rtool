import express from "express";
import http from "http";
import cors from "cors";
import fs from "fs";
import path from "path";
import { Server } from "socket.io";
import mongoose from "mongoose";

import { connectMongo } from "./db.js";
import { saveAgentData } from "./save.js";
import * as GetData from "./get.js";

// ✅ Visualizer-only imports
import visualizerDataRoute from "./api/visualizerData.js";
import "./visualizer-script/visualizerScanner.js";

const configPath = path.resolve("./config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

const CORS_ORIGIN = config.cors_origin || "*";
const SOCKET_PORT = config.socket_port || 5000;

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

// ---------------------------
// 🔹 Health Check
// ---------------------------
app.get("/health", (_req, res) =>
  res.json({ status: "ok", ts: new Date().toISOString() })
);

// ---------------------------
// 🔹 Visualizer Route
// ---------------------------
app.use("/api/visualizer-data", visualizerDataRoute);

// ---------------------------
// 🔹 Socket.IO Setup
// ---------------------------
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: CORS_ORIGIN, methods: ["GET", "POST"] },
});

io.on("connection", (socket) => {
  console.log(`⚡ Client connected: ${socket.id}`);

  socket.on("agent_data", async (payload) => {
    try {
      if (!payload?.type || !payload?.data || !payload?.agentId) {
        console.warn("⚠️ Invalid payload received:", payload);
        return;
      }

      payload.ip =
        socket.handshake.address ||
        (socket.handshake.headers["x-forwarded-for"]?.split(",")[0] || "unknown");

      console.log(`📥 Received [${payload.type}] from agent ${payload.agentId} (${payload.ip})`);
      await saveAgentData(payload);
    } catch (err) {
      console.error("❌ Error saving agent data:", err);
    }
  });

  socket.on("get_data", async (params, callback) => {
    try {
      const result = await GetData.fetchData(params);
      callback(result);
    } catch (err) {
      console.error("❌ Error fetching data:", err);
      callback({ error: "Failed to fetch data" });
    }
  });

  socket.on("disconnect", (reason) => {
    console.log(`🔌 Client disconnected: ${socket.id} (${reason})`);
  });
});

// ---------------------------
// 🔹 Start Server
// ---------------------------
async function start() {
  try {
    await connectMongo(config.mongo_uri);
    console.log("✅ MongoDB connected");

    server.listen(SOCKET_PORT, "0.0.0.0", () => {
      console.log(`✅ Socket Server running on port ${SOCKET_PORT}`);
      console.log("🧠 Continuous scanner + visualizer loop active");
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  }
}

start();
