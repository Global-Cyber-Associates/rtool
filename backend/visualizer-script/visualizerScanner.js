import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import fs from "fs";
import Device from "../models/VisualizerScanner.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const scannerPath = path.join(__dirname, "scanner_service.py");
const configPath = path.join(__dirname, "../config.json");

// ---------------- CONFIG LOADER ----------------
function getMongoURI() {
  try {
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    return config.mongo_uri || "";
  } catch {
    return "";
  }
}

// ---------------- WAIT UNTIL CONFIG IS READY ----------------
async function waitForMongoURI() {
  let uri = getMongoURI();

  while (!uri.startsWith("mongodb://") && !uri.startsWith("mongodb+srv://")) {
    console.log("⚠️ Waiting for valid MongoDB Setup...");
    await new Promise((r) => setTimeout(r, 3000));
    uri = getMongoURI();
  }

  console.log("✅ MongoDB URI detected:", uri);
  return uri;
}

// ---------------- CONNECT TO MONGO ----------------
async function connectMongo() {
  const MONGO_URI = await waitForMongoURI();

  await mongoose
    .connect(MONGO_URI)
    .then(() => console.log("✅ Connected to MongoDB (scanner)"))
    .catch((err) => {
      console.error("❌ MongoDB connection failed:", err.message);
      process.exit(1);
    });
}

// ---------------- RUN SCANNER LOOP ----------------
async function runScannerCycle() {
  console.log("🚀 Starting Python scanner cycle...");

  return new Promise((resolve) => {
    const scannerProcess = spawn("python", [scannerPath], {
      cwd: __dirname,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let buffer = "";
    scannerProcess.stdout.setEncoding("utf8");

    scannerProcess.stdout.on("data", async (data) => {
      buffer += data.toString();

      if (buffer.trim().endsWith("]")) {
        try {
          const jsonStart = buffer.indexOf("[");
          const jsonText = buffer.slice(jsonStart).trim();
          const devices = JSON.parse(jsonText);

          console.log(`📡 Received ${devices.length} devices from Python`);
          const currentIPs = devices.map((d) => d.ips[0]);
          await Device.deleteMany({ "ips.0": { $nin: currentIPs } });

          for (const d of devices) {
            await Device.findOneAndUpdate(
              { "ips.0": d.ips[0] },
              { ...d, lastSeen: new Date() },
              { upsert: true, new: true }
            );
          }

          console.log(`✅ Synced ${devices.length} devices to DB`);

          // Lazy import of visualizer update AFTER setup
          console.log("⚙️ Running visualizer update after scan...");
          try {
            const { runVisualizerUpdate } = await import("./visualizer.js");
            await runVisualizerUpdate();
            console.log("✅ Visualizer update completed.");
          } catch (err) {
            console.error("❌ Visualizer update failed:", err.message);
          }

          buffer = "";
        } catch (err) {
          console.error("❌ JSON parse error:", err.message);
          buffer = "";
        }
      }
    });

    scannerProcess.stderr.on("data", (data) => {
      console.error("🔥 Python error:", data.toString());
    });

    scannerProcess.on("close", (code) => {
      console.log(`🔁 Scanner cycle finished with code ${code}`);
      resolve();
    });
  });
}

// ---------------- MAIN LOOP ----------------
async function startContinuousLoop() {
  await connectMongo();

  while (true) {
    console.log(`\n🌀 New scan cycle started at ${new Date().toLocaleTimeString()}`);
    await runScannerCycle();
    console.log("⏳ Waiting 5 seconds before next scan...");
    await new Promise((r) => setTimeout(r, 5000));
  }
}

startContinuousLoop();
