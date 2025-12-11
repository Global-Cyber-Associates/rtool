// backend/src/D-board/d-aggregator.js

import VisualizerData from "../models/VisualizerData.js";
import SystemInfo from "../models/SystemInfo.js";
import Dashboard from "../models/Dashboard.js";

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

  const ROUTER_ENDINGS = [1, 250, 253, 254];
  const ACTIVE_TIMEOUT = 15000; // 15 sec timeout for active agents

  const loop = async () => {
    try {
      const vizRaw = await VisualizerData.find({}).lean();
      const sysRaw = await SystemInfo.find({}).lean();

      if (!vizRaw.length && !sysRaw.length) {
        console.log("📭 No data yet — skipping");
        return;
      }

      // -----------------------------------------
      // Latest VisualizerData per IP
      // -----------------------------------------
      const latest = {};
      vizRaw.forEach((d) => {
        if (!d.ip) return;

        const existing = latest[d.ip];
        const newT = parseDate(d.createdAt || d.timestamp);
        const oldT = existing ? parseDate(existing.createdAt || existing.timestamp) : null;

        if (!existing || (newT && oldT && newT > oldT) || (newT && !oldT)) {
          latest[d.ip] = d;
        }
      });

      const visualizerData = Object.values(latest);

      // -----------------------------------------
      // Build SystemInfo map by IP
      // -----------------------------------------
      const sysByIP = {};
      sysRaw.forEach((s) => {
        extractIPs(s).forEach((ip) => {
          sysByIP[ip] = s;
        });
      });

      const now = Date.now();

      // -----------------------------------------
      // ACTIVE AGENTS = Recent SystemInfo + VisualizerData
      // -----------------------------------------
      const activeAgents = sysRaw
        .filter((s) => {
          const lastSeen = new Date(s.timestamp).getTime();
          const isFresh = now - lastSeen <= ACTIVE_TIMEOUT;

          const ips = extractIPs(s);
          const seenInViz = ips.some((ip) =>
            visualizerData.some((v) => v.ip === ip && !v.noAgent)
          );

          return isFresh && seenInViz;
        })
        .map((s) => {
          const ip = extractIPs(s)[0];
          const viz = visualizerData.find((v) => v.ip === ip) || {};

          return {
            ...viz,
            system: s.data,
            cpu: s.data.cpu,
            memory: s.data.memory,
            os: s.data.os_type,
            lastSeen: s.timestamp,
          };
        });

      // -----------------------------------------
      // INACTIVE AGENTS = SystemInfo exists, but expired OR not in visualizer
      // -----------------------------------------
      const inactiveAgents = sysRaw.filter((s) => {
        const lastSeen = new Date(s.timestamp).getTime();
        const expired = now - lastSeen > ACTIVE_TIMEOUT;

        const ips = extractIPs(s);
        const seenInViz = ips.some((ip) =>
          visualizerData.some((v) => v.ip === ip && !v.noAgent)
        );

        return expired || !seenInViz;
      });

      const inactiveAsDevices = inactiveAgents.map((s) => {
        const ip = extractIPs(s)[0];
        return {
          ip,
          hostname: s.data.hostname || "Unknown",
          agentId: s.agentId,
          noAgent: false,
          cpu: s.data.cpu,
          memory: s.data.memory,
          os: s.data.os_type,
          timestamp: s.timestamp,
          system: s.data,
        };
      });

      // -----------------------------------------
      // Unknown unmanaged visualizer devices
      // -----------------------------------------
      const unmanaged = visualizerData.filter((d) => d.noAgent === true);

      const routers = unmanaged.filter((d) => {
        const last = Number(d.ip.split(".")[3]);
        const subnet = d.ip.split(".").slice(0, 3).join(".");
        const agentSubnets = sysRaw.map((s) =>
          extractIPs(s)[0]?.split(".").slice(0, 3).join(".")
        );

        return ROUTER_ENDINGS.includes(last) && agentSubnets.includes(subnet);
      });

      const unknownDevices = unmanaged.filter(
        (d) => !routers.some((r) => r.ip === d.ip)
      );

      // -----------------------------------------
      // Final ALL DEVICES = visualizer devices (except routers) + inactive agents
      // -----------------------------------------
      const allDevices = [
        ...visualizerData.filter((d) => !routers.some((r) => r.ip === d.ip)),
        ...inactiveAsDevices,
      ];

      // -----------------------------------------
      // FINAL SNAPSHOT
      // -----------------------------------------
      const snapshot = {
        _id: "dashboard_latest",
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

      await Dashboard.updateOne(
        { _id: "dashboard_latest" },
        { $set: snapshot },
        { upsert: true }
      );

      console.log("✅ Dashboard snapshot updated");
    } catch (err) {
      console.error("❌ Dashboard Worker Error:", err);
    }
  };

  await loop();
  setInterval(loop, interval);
}

export default runDashboardWorker;
