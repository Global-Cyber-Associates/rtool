import express from "express";
import Tenant from "../models/Tenant.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

// Get unlocked features for the current tenant
router.get("/", authMiddleware, async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) {
      return res.status(404).json({ message: "Tenant not found" });
    }
    res.json({ unlockedFeatures: tenant.unlockedFeatures || [] });
  } catch (err) {
    res.status(500).json({ message: "Error fetching features", error: err.message });
  }
});

// Unlock a feature for the current tenant
router.post("/unlock", authMiddleware, async (req, res) => {
  const { featureId } = req.body;
  
  if (!featureId) {
    return res.status(400).json({ message: "Feature ID is required" });
  }

  try {
    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) {
      return res.status(404).json({ message: "Tenant not found" });
    }

    if (!tenant.unlockedFeatures) {
      tenant.unlockedFeatures = [];
    }

    if (!tenant.unlockedFeatures.includes(featureId)) {
      tenant.unlockedFeatures.push(featureId);
      await tenant.save();
    }

    res.json({ success: true, unlockedFeatures: tenant.unlockedFeatures });
  } catch (err) {
    res.status(500).json({ message: "Error unlocking feature", error: err.message });
  }
});

export default router;
