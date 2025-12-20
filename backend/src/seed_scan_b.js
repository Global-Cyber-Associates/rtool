
import { connectMongo } from "./db.js";
import mongoose from "mongoose";
import VisualizerScanner from "./models/VisualizerScanner.js";
import Tenant from "./models/Tenant.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

async function seedScanData() {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const configPath = path.join(__dirname, "config.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

    await connectMongo(config.mongo_uri);

    // Find Tenant B
    const tenant = await Tenant.findOne({ name: "Tenant B (Test)" });
    if (!tenant) {
        console.error("Tensor B not found!");
        process.exit(1);
    }

    console.log(`Creating dummy scan data for Tenant: ${tenant.name} (${tenant._id})`);

    // Dummy devices
    const devices = [
        {
            ip: "192.168.1.100", // Will be matched with Agent if IP is same
            mac: "AA:BB:CC:DD:EE:FF",
            vendor: "VirtualBox",
            hostname: "Simulated-Switch",
            status: "online",
            tenantId: tenant._id
        },
        {
            ip: "192.168.1.101",
            mac: "11:22:33:44:55:66",
            vendor: "Unknown",
            hostname: "Guest-Device",
            status: "online",
            tenantId: tenant._id
        },
        {
            ip: "192.168.1.4", // Simulate matching Laptop 2 IP if possible, or just standard
            mac: "AB:CD:EF:12:34:56",
            vendor: "Laptop-Vendor",
            hostname: "Laptop-2-Sim",
            status: "online",
            tenantId: tenant._id
        }
    ];

    await VisualizerScanner.deleteMany({ tenantId: tenant._id });
    await VisualizerScanner.insertMany(devices);

    console.log("✅ Dummy network scan data injected.");
    process.exit(0);
}

seedScanData();
