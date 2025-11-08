import Agent from "./models/Agent.js";
import SystemInfo from "./models/SystemInfo.js";
import InstalledApps from "./models/InstalledApps.js";
import USBDevice from "./models/UsbDevices.js";
import PortScanData from "./models/PortScan.js";
import TaskInfo from "./models/TaskInfo.js";

export async function fetchData({ type, agentId }) {
  try {
    console.log(`📡 Fetching [${type}] for agent: ${agentId || "ALL"}`);

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
        console.log("➡ Fetching all agents...");
        const agents = await Agent.find({});
        console.log(`✅ Found ${agents.length} agents`);
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
      console.log(`🔍 Looking for latest ${type} entry for agent ${agentId}...`);
      const doc = await Model.findOne({ agentId }).sort({ timestamp: -1 });

      if (!doc) {
        console.warn(`❌ No ${type} data found for ${agentId}`);
        return {
          success: false,
          message: `No ${type} data found for agent ${agentId}`,
          data: [],
        };
      }

      if (type === "task_info") {
        console.log("🔧 Combining task_info with system_info...");
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

        console.log(`✅ Combined task_info result for ${agentId}:`, JSON.stringify(combined, null, 2));
        result = [combined];
      } else {
        console.log(`✅ Found ${type} document for ${agentId}`);
        result = [doc];
      }
    } else {
      console.log(`📋 Fetching all ${type} records...`);
      result = await Model.find({});
      console.log(`✅ Found ${result.length} records`);
    }

    console.log(`📤 Returning ${type} data for ${agentId || "ALL"}`);
    return {
      success: true,
      message: `${type} data fetched successfully`,
      data: result,
    };
  } catch (err) {
    console.error(`🔥 Error fetching [${type}] for ${agentId}:`, err);
    return {
      success: false,
      message: "Internal server error while fetching data",
      error: err.message,
      data: [],
    };
  }
}
