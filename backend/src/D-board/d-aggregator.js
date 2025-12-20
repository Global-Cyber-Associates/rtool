// backend/src/D-board/d-aggregator.js

import VisualizerData from "../models/VisualizerData.js";
import SystemInfo from "../models/SystemInfo.js";
import Dashboard from "../models/Dashboard.js";
import Agent from "../models/Agent.js";

// -----------------------------------------
// Helper: Parse timestamps safely
// -----------------------------------------
function parseDate(v) {
  if (!v) return null;
  if (typeof v === "object") {
    if (v.$date) return new Date(v.$date);
    if (v.$numberLong) return new Date(Number(v.$numberLong));
  }
  return new Date(v);
}

// -----------------------------------------
// Extract all possible IPs from a SystemInfo doc
// -----------------------------------------
function extractIPs(sys) {
  if (!sys) return [];
  const d = sys.data || sys;
  const ips = [];

  if (d.ip) ips.push(d.ip);
  if (d.address) ips.push(d.address);

  if (Array.isArray(d.wlan_info)) {
    d.wlan_info.forEach((w) => w?.address && ips.push(w.address));
  }
  if (Array.isArray(d.wlan_ip)) {
    d.wlan_ip.forEach((w) => w?.address && ips.push(w.address));
  }

  return ips.filter(Boolean);
}

// -----------------------------------------
// MAIN WORKER
// -----------------------------------------
async function runDashboardWorker(interval = 4500) {
  console.log(`📊 Dashboard Worker running every ${interval}ms`);

  const routerEndings = [1, 250, 253, 254];

  const loop = async () => {
    // 0. Iterate Active Tenants
    const tenants = global.ACTIVE_TENANTS ? [...global.ACTIVE_TENANTS] : []; // defensive copy

    // If no active tenants, we might still want to process if we want background updates, 
    // but typically we only care about active ones.
    // However, for correct "Dashboard" loading on login, we might need data even if socket just connected.
    // Let's assume ACTIVE_TENANTS includes anyone with socket open (User or Agent).

    for (const tenantId of tenants) {
      try {
        // 1. Fetch Scoped Data
        const agents = await Agent.find({ tenantId }).lean();
        const sysRaw = await SystemInfo.find({ tenantId }).lean();
        const vizRaw = await VisualizerData.find({ tenantId }).lean();

        // 2. Map System Info by AgentId
        const sysByAgentId = {};
        sysRaw.forEach((sys) => {
          if (sys.agentId) sysByAgentId[sys.agentId] = sys;
        });

        // 3. Classify Agents
        const activeAgents = [];
        const inactiveAgents = [];

        agents.forEach((agent) => {
          const sys = sysByAgentId[agent.agentId] || {};
          const sysData = sys.data || {};

          // Merge
          const richAgent = {
            agentId: agent.agentId,
            ip: agent.ip || sysData.ip || "unknown",
            hostname: sysData.hostname || "Unknown",
            status: agent.status || "offline",
            lastSeen: agent.lastSeen,
            cpu: sysData.cpu,
            memory: sysData.memory,
            os: sysData.os_type,
            system: sysData,
            mac: agent.mac || sysData.mac || null,
            timestamp: agent.lastSeen,
            tenantId // Keep context
          };

          if (agent.status === 'online') {
            activeAgents.push(richAgent);
          } else {
            inactiveAgents.push(richAgent);
          }
        });

        // 4. Build "All Devices" Map
        const allDevicesMap = new Map();

        // Helper to add device
        const addOrUpdateDevice = (device, isAgent) => {
          // Try to find existing by MAC
          if (device.mac && allDevicesMap.has(device.mac)) {
            const existing = allDevicesMap.get(device.mac);
            if (isAgent) {
              allDevicesMap.set(device.mac, { ...existing, ...device, source: 'agent', noAgent: false });
            } else {
              if (existing.source !== 'agent') {
                allDevicesMap.set(device.mac, { ...existing, ...device });
              }
            }
            return;
          }

          // Try to find existing by IP
          if (device.ip && device.ip !== 'unknown' && allDevicesMap.has(device.ip)) {
            const existing = allDevicesMap.get(device.ip);
            if (isAgent) {
              allDevicesMap.set(device.ip, { ...existing, ...device, source: 'agent', noAgent: false });
            } else {
              if (existing.source !== 'agent') {
                allDevicesMap.set(device.ip, { ...existing, ...device });
              }
            }
            return;
          }

          // New
          let key = device.mac || device.ip;
          if ((!key || key === 'unknown') && isAgent) {
            key = device.agentId;
          }
          if (key && key !== 'unknown') {
            allDevicesMap.set(key, { ...device, source: isAgent ? 'agent' : 'scanner', noAgent: !isAgent });
          }
        };

        // A. ADD AGENTS
        [...activeAgents, ...inactiveAgents].forEach(a => addOrUpdateDevice(a, true));

        // B. ADD SCANNER DATA
        const routers = [];
        const unknownDevices = [];

        vizRaw.forEach(scan => {
          if (!scan.ip) return;
          const device = {
            ip: scan.ip,
            hostname: scan.hostname || "Unknown",
            mac: scan.mac || null,
            vendor: scan.vendor || "Unknown",
            createdAt: scan.createdAt || scan.timestamp,
            timestamp: scan.createdAt || scan.timestamp,
            tenantId
          };
          addOrUpdateDevice(device, false);
        });

        // Re-process map
        const finalDevices = Array.from(allDevicesMap.values());

        finalDevices.forEach(d => {
          if (d.source === 'agent') return;
          const lastOctet = Number(d.ip.split('.').pop());
          if (routerEndings.includes(lastOctet)) {
            routers.push(d);
          } else {
            unknownDevices.push(d);
          }
        });

        const allDevices = finalDevices;

        // 5. Final Snapshot
        const snapshot = {
          tenantId, // ⭐ Scoped
          timestamp: new Date(),
          summary: {
            all: allDevices.length,
            active: activeAgents.length,
            inactive: inactiveAgents.length,
            unknown: unknownDevices.length,
            routers: routers.length,
          },
          allDevices,
          activeAgents,
          inactiveAgents,
          routers,
          unknownDevices,
        };

        await Dashboard.findOneAndUpdate(
          { tenantId },
          { $set: snapshot },
          { upsert: true }
        );

        // console.log(`✅ Dashboard updated for tenant ${tenantId}`);

      } catch (err) {
        console.error(`❌ Dashboard loop error for tenant ${tenantId}:`, err);
      }
    }
  };

  await loop();
  setInterval(loop, interval);
}

export default runDashboardWorker;
