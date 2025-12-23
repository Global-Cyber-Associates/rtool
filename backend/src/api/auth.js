import express from "express";
import {
  login,
  changePassword,
  getMe,
  register, 
} from "../controllers/authController.js";

import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

// Login
router.post("/login", login);

// Register (Client Request)
router.post("/register", register);

// Change password (logged-in user)
router.put("/change-password", authMiddleware, changePassword);

// ⭐ Get current logged-in user profile
router.get("/me", authMiddleware, getMe);

export default router;
