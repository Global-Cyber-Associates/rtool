import express from "express";
import { getDashboard, getSummary } from "../controllers/dashboardController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

// GET /api/dashboard  -> full snapshot
router.get("/", authMiddleware, getDashboard);

// GET /api/dashboard/summary -> small summary only
router.get("/summary", authMiddleware, getSummary);

export default router;
