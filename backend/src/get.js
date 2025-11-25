import Agent from "./models/Agent.js";
import SystemInfo from "./models/SystemInfo.js";
import InstalledApps from "./models/InstalledApps.js";
import USBDevice from "./models/usbdevices.js";
import PortScanData from "./models/PortScan.js";
import TaskInfo from "./models/TaskInfo.js";

import VisualizerData from "./models/VisualizerData.js";
import VisualizerScanner from "./models/VisualizerScanner.js";

export async function fetchData({ type, agentId }) {
  try {
    console.log(`📡 Fetching [${type}] for agent: ${agentId || "ALL"}`);

    // =========================================================================
    // ⭐ OVERRIDE HANDLER FOR VISUALIZER DATA
    // =========================================================================
    if (type === "visualizer_data") {
      console.log("📡 Building visualizer dataset...");

      // Load raw scanner devices
      const scans = await VisualizerScanner.find({});
      // Load all system info from agents
      const systems = await SystemInfo.find({});

      const systemIPs = new Set();
      const ipToAgent = new Map();
      const ipToHostname = new Map();

      // Build agent mapping
      systems.forEach((sys) => {
        const wlanInfo = sys.data?.wlan_info || [];
        const agentId = sys.agentId || "unknown";
        const hostname = sys.data?.hostname || "Unknown";

        wlanInfo.forEach((iface) => {
          const ip = iface.address?.trim();
          if (ip) {
            systemIPs.add(ip);
            ipToAgent.set(ip, agentId);
            ipToHostname.set(ip, hostname);
          }
        });
      });

      // Merge raw scan + agent info
      const output = scans.map((dev) => {
        const ip = dev.ip?.trim();
        const isAgent = systemIPs.has(ip);

        return {
          id: dev._id.toString(),      // ⭐ REQUIRED FOR FRONTEND
          ip,
          mac: dev.mac || "Unknown",
          vendor: dev.vendor || "Unknown",
          agentId: isAgent ? ipToAgent.get(ip) : "Unknown",
          hostname: isAgent ? ipToHostname.get(ip) : "Unknown",
          noAgent: !isAgent,
        };
      });

      return {
        success: true,
        message: "Visualizer data fetched successfully",
        data: output,
      };
    }

    // =========================================================================
    // ⭐ ORIGINAL LOGIC (UNTOUCHED)
    // =========================================================================

    let Model;

    switch (type) {
      case "system_info":
        Model = SystemInfo;
        break;
      case "installed_apps":
        Model = InstalledApps;
        break;
      case "usb_devices":
        Model = USBDevice;
        break;
      case "port_scan":
        Model = PortScanData;
        break;
      case "task_info":
        Model = TaskInfo;
        break;

      case "agents":
        const agents = await Agent.find({});
        return {
          success: true,
          message: "Agents fetched successfully",
          data: agents,
        };

      default:
        console.warn(`⚠ Invalid type requested: ${type}`);
        return {
          success: false,
          message: "Invalid data type",
          data: [],
        };
    }

    let result;

    if (agentId) {
      const doc = await Model.findOne({ agentId }).sort({ timestamp: -1 });

      if (!doc) {
        return {
          success: false,
          message: `No ${type} data found for agent ${agentId}`,
          data: [],
        };
      }

      if (type === "task_info") {
        const systemInfo = await SystemInfo.findOne({ agentId }).sort({ timestamp: -1 });
        const combined = {
          agentId: doc.agentId,
          device: systemInfo
            ? {
                hostname: systemInfo.data.hostname,
                os_type: systemInfo.data.os_type,
                os_version: systemInfo.data.os_version,
              }
            : null,
          data: doc.data,
          timestamp: doc.timestamp,
        };
        result = [combined];
      } else {
        result = [doc];
      }
    } else {
      result = await Model.find({});
    }

    return {
      success: true,
      message: `${type} data fetched successfully`,
      data: result,
    };

  } catch (err) {
    console.error(`🔥 Error fetching [${type}] for ${agentId}:`, err);
    return {
      success: false,
      message: "Internal server error",
      error: err.message,
      data: [],
    };
  }
}
