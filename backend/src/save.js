import mongoose from "mongoose";

import Agent from "./models/Agent.js";
import SystemInfo from "./models/SystemInfo.js";
import InstalledApps from "./models/InstalledApps.js";
import PortScanData from "./models/PortScan.js";
import TaskInfo from "./models/TaskInfo.js";
import VisualizerScanner from "./models/VisualizerScanner.js";
import ScanResult from "./models/ScanResult.js";
import EventLog from "./models/EventLog.js";
import { extractIPs, resolveBestIP } from "./utils/networkHelpers.js";

// (DEFAULT TENANT REMOVED)

// =====================================================
// 🔒 RESOLVE AGENT + TENANT (SINGLE SOURCE OF TRUTH)
// =====================================================
async function resolveAgent(payload) {
  const { agentId } = payload;

  let agent = await Agent.findOne({ agentId });

  // First time agent → must have valid tenantId passed
  if (!agent) {
    if (!payload.tenantId) {
      throw new Error("Cannot register new agent without tenantId");
    }
    agent = await Agent.create({
      agentId,
      tenantId: payload.tenantId,
      socketId: payload.socket_id || null,
      ip: payload.ip || "unknown",
      lastSeen: new Date(),
      status: "online",
      mac: payload.mac || payload.data?.mac || null,
    });
  }

  return agent;
}

// =====================================================
// ⭐ SAVE AGENT DATA (TENANT ENFORCED)
// =====================================================
export async function saveAgentData(payload, tenantId) {
  try {
    if (!payload?.type || !payload?.data || !payload?.agentId) {
      console.error("❌ Invalid agent payload");
      return;
    }

    const { type, agentId, data } = payload;
    const timestamp = payload.timestamp || new Date().toISOString();

    // 1️⃣ Resolve agent + tenant
    // We pass tenantId to resolveAgent to ensure new agents are bound correctly
    const agent = await resolveAgent({ ...payload, tenantId });

    // Verify tenant match if agent already existed
    if (agent.tenantId.toString() !== tenantId.toString()) {
      console.warn(`⚠️ Agent ${agentId} tried to report for wrong tenant ${tenantId} (actual: ${agent.tenantId})`);
      // We could throw here, but for now let's just enforce the agent's actual tenant
      // Or better: update the agent's record if we trust the new binding? 
      // No, agent.tenantId is immutable.
      // So we must use agent.tenantId.
    }

    // Use the reliable tenantId from the DB (or the one just created)
    const finalTenantId = agent.tenantId;

    // ⭐ INTELLIGENT IP RESOLUTION
    // If it's system_info, try to find the "real" LAN IP from wlan_info etc.
    let resolvedIP = payload.ip || "unknown";
    if (type === "system_info") {
      const candidates = extractIPs(data);
      resolvedIP = resolveBestIP(candidates, resolvedIP);
    }

    // 2️⃣ Update agent heartbeat (tenant-safe)
    const updateObj = {
      socketId: payload.socket_id || null,
      ip: resolvedIP,
      lastSeen: new Date(),
      status: "online",
      mac: payload.mac || payload.data?.mac || null,
    };

    if (type === "system_info") {
      if (data.hostname) updateObj.hostname = data.hostname;
      if (data.os_type) updateObj.os = data.os_type;
    }

    await Agent.findOneAndUpdate(
      { agentId, tenantId: finalTenantId },
      { $set: updateObj }
    );

    // 3️⃣ Event logs (file monitor events) - handle separately
    if (type === "event_logs") {
      const events = data.events || [];
      if (events.length > 0) {
        const eventDocs = events.map(event => ({
          agentId,
          tenantKey: finalTenantId.toString(),
          eventId: event.eventId || Date.now(),
          eventType: event.eventType || "unknown",
          timestamp: new Date(event.timestamp || Date.now()),
          source: event.source || "watchdog",
          computer: event.computer || "",
          category: event.category || 0,
          severity: event.severity || "info",
          description: event.description || "",
          details: event.details || {},
          receivedAt: new Date(),
        }));
        await EventLog.insertMany(eventDocs, { ordered: false });
        console.log(`📁 Stored ${eventDocs.length} file events from ${agentId}`);
      }
      return;
    }

    // 4️⃣ USB handled elsewhere
    if (type === "usb_devices") return;

    // 4️⃣ Resolve model
    let Model;
    switch (type) {
      case "system_info":
        Model = SystemInfo;
        break;
      case "installed_apps":
        Model = InstalledApps;
        break;
      case "port_scan":
        Model = PortScanData;
        break;
      case "task_info":
        Model = TaskInfo;
        break;
      default:
        console.warn(`⚠️ Unknown agent data type: ${type}`);
        return;
    }

    // 5️⃣ TENANT + AGENT scoped upsert
    await Model.findOneAndUpdate(
      { tenantId: finalTenantId, agentId },
      {
        $set: {
          tenantId: finalTenantId,
          agentId,
          timestamp,
          type,
          data,
        },
      },
      { upsert: true }
    );
  } catch (err) {
    console.error("❌ saveAgentData failed:", err);
  }
}

// =====================================================
// ⭐ NETWORK SCAN (ADMIN / TENANT ONLY)
// =====================================================
export async function saveNetworkScan(devicesList, tenantId) {
  try {
    if (!Array.isArray(devicesList)) return;

    if (!tenantId) return;

    const aliveIPs = devicesList
      .map((d) => d.ip?.trim())
      .filter(Boolean);

    // Remove stale devices for this tenant
    await VisualizerScanner.deleteMany({
      tenantId,
      ip: { $nin: aliveIPs },
    });

    // Upsert current scan
    for (const dev of devicesList) {
      if (!dev.ip) continue;

      await VisualizerScanner.findOneAndUpdate(
        { tenantId, ip: dev.ip.trim() },
        {
          $set: {
            tenantId,
            ip: dev.ip.trim(),
            mac: dev.mac || null,
            vendor: dev.vendor || null,
            ping_only: dev.ping_only ?? true,
            lastSeen: new Date(),
          },
        },
        { upsert: true }
      );
    }
  } catch (err) {
    console.error("❌ saveNetworkScan failed:", err);
  }
}

// =====================================================
// ⭐ VULNERABILITY SCAN (TENANT SAFE)
// =====================================================
export async function saveVulnerabilityScan(scanObject, tenantId) {
  try {
    if (!scanObject?.hosts) return;

    if (!tenantId) return;

    const order = ["Info", "Low", "Medium", "High", "Critical"];
    const impacts = scanObject.hosts.map(
      (h) => h.impact_level || "Info"
    );

    const overall_impact =
      impacts.length > 0
        ? impacts.sort(
          (a, b) => order.indexOf(b) - order.indexOf(a)
        )[0]
        : "Info";

    await ScanResult.findOneAndUpdate(
      { tenantId },
      {
        $set: {
          tenantId,
          ok: scanObject.ok,
          network: scanObject.network,
          scanned_at: scanObject.scanned_at,
          duration_seconds: scanObject.duration_seconds,
          hosts: scanObject.hosts,
          overall_impact,
          raw: scanObject,
          updated_at: new Date(),
        },
      },
      { upsert: true }
    );
  } catch (err) {
    console.error("❌ saveVulnerabilityScan failed:", err);
  }
}
