import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import User from "../models/User.js";

dotenv.config();

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined in .env");
}

/* ---------------------- REGISTER ---------------------- */
router.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;

    const existing = await User.findOne({ username });
    if (existing) return res.status(400).json({ message: "User already exists" });

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = new User({ username, password: passwordHash });
    await newUser.save();

    // ✅ Log registration
    await addLog("USER_REGISTERED", `New user registered: ${username}`, username, {
      userId: newUser._id,
    });

    res.json({ message: "User registered successfully" });
  } catch (err) {
    console.error("[Register Error]", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

/* ---------------------- LOGIN ---------------------- */
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) {
      await addLog("FAILED_LOGIN", `Login attempt for non-existent user: ${username}`);
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      await addLog("FAILED_LOGIN", `Invalid password for user: ${username}`, username);
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign({ username: user.username }, JWT_SECRET, { expiresIn: "1h" });

    // ✅ Log successful login
    await addLog("USER_LOGIN", `User logged in successfully: ${username}`, username, {
      loginTime: new Date(),
      ip: req.ip,
    });

    res.json({ token });
  } catch (err) {
    console.error("[Login Error]", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

export default router;
