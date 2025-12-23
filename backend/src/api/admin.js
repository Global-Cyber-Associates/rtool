import express from "express";
import {
  getPendingRequests,
  approveClient,
  getTenantsSummary
} from "../controllers/adminController.js";
import { authMiddleware, adminOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

// --------------------------------------------------
// GLOBAL ADMIN ROUTES
// --------------------------------------------------

// Get all pending client registration requests
router.get("/requests", authMiddleware, adminOnly, getPendingRequests);

// Approve a client request (creates tenant)
router.post("/approve/:id", authMiddleware, adminOnly, approveClient);

// Get all tenants with device stats
router.get("/tenants", authMiddleware, adminOnly, getTenantsSummary);

export default router;
