import mongoose from "mongoose";

const DashboardSchema = new mongoose.Schema(
  {
    // _id will be auto-generated or composite
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", index: true },

    timestamp: Date,

    summary: {
      all: Number,
      active: Number,
      inactive: Number,
      unknown: Number,
      routers: Number,
    },

    allDevices: Array,
    activeAgents: Array,
    inactiveAgents: Array,
    routers: Array,
    unknownDevices: Array,
  },
  { collection: "dashboard" }
);

// ⭐ ESM default export
const Dashboard = mongoose.model("Dashboard", DashboardSchema);
export default Dashboard;
