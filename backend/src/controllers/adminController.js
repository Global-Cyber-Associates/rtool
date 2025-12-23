import User from "../models/User.js";
import Tenant from "../models/Tenant.js";
import crypto from "crypto";
import Agent from "../models/Agent.js";

// --------------------------------------------------
// ⭐ GET PENDING CLIENT REQUESTS
// --------------------------------------------------
export async function getPendingRequests(req, res) {
  try {
    const users = await User.find({ role: "client", isApproved: false }).select("-password");
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch requests" });
  }
}

// --------------------------------------------------
// ⭐ APPROVE CLIENT & CREATE TENANT
// --------------------------------------------------
export async function approveClient(req, res) {
  try {
    const { id } = req.params;
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (user.isApproved) {
      return res.status(400).json({ message: "User already approved" });
    }

    // 1. Create Tenant
    const key = "noc_" + crypto.randomBytes(16).toString("hex");
    const tenantName = user.companyName || `${user.name}'s Company`;
    
    const tenant = await Tenant.create({
      name: tenantName,
      enrollmentKey: key,
    });

    // 2. Update User
    user.isApproved = true;
    user.tenantId = tenant._id;
    await user.save();

    res.json({
      message: "Client approved and tenant created",
      tenant: {
        id: tenant._id,
        name: tenant.name,
        enrollmentKey: tenant.enrollmentKey,
      },
    });
  } catch (err) {
    res.status(500).json({
      message: "Approval failed",
      error: err.message,
    });
  }
}

// --------------------------------------------------
// ⭐ GET TENANTS LIST WITH STATS
// --------------------------------------------------
export async function getTenantsSummary(req, res) {
  try {
    const tenants = await Tenant.find();
    
    const summary = await Promise.all(
      tenants.map(async (t) => {
        const deviceCount = await Agent.countDocuments({ tenantId: t._id });
        const owner = await User.findOne({ tenantId: t._id, role: "client" });
        return {
          id: t._id,
          name: t.name,
          enrollmentKey: t.enrollmentKey,
          deviceCount,
          ownerEmail: owner ? owner.email : "N/A",
          createdAt: t.createdAt,
          isActive: t.isActive
        };
      })
    );
    
    res.json(summary);
  } catch (err) {
    res.status(500).json({
      message: "Failed to fetch tenants summary",
      error: err.message,
    });
  }
}
