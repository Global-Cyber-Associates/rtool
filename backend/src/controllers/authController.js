import User from "../models/User.js";
import Tenant from "../models/Tenant.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

// --------------------------------------------------
// ⭐ LOGIN
// --------------------------------------------------
export async function login(req, res) {
  try {
    const { email, password } = req.body;

    // 1️⃣ Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // 2️⃣ Block disabled users
    if (!user.isActive) {
      return res.status(403).json({
        message: "Account is disabled. Contact administrator.",
      });
    }

    // 2.5️⃣ Block unapproved clients
    if (user.role === "client" && !user.isApproved) {
      return res.status(403).json({
        message: "Account pending approval. Please wait for an administrator to approve your request.",
      });
    }

    // 3️⃣ Check password
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: "Invalid password" });
    }

    // 4️⃣ Generate JWT (⭐ tenantId added)
    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
        email: user.email,
        tenantId: user.tenantId, // ⭐ MULTI-TENANT CONTEXT
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // 5️⃣ Update last login
    user.lastLogin = new Date();
    await user.save();

    // 6️⃣ Send response
    res.json({
      message: "Login successful",
      token,
      role: user.role,
      name: user.name,
      tenantId: user.tenantId, // optional but useful
    });
  } catch (err) {
    res.status(500).json({
      message: "Login failed",
      error: err.message,
    });
  }
}

// --------------------------------------------------
// ⭐ CHANGE PASSWORD (Logged-in user)
// --------------------------------------------------
export async function changePassword(req, res) {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        message: "Old password and new password are required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        message: "New password must be at least 6 characters",
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const match = await bcrypt.compare(oldPassword, user.password);
    if (!match) {
      return res.status(401).json({
        message: "Old password is incorrect",
      });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ message: "Password changed successfully" });
  } catch (err) {
    res.status(500).json({
      message: "Failed to change password",
      error: err.message,
    });
  }
}

// --------------------------------------------------
// ⭐ GET CURRENT USER PROFILE
// --------------------------------------------------
export async function getMe(req, res) {
  try {
    const user = await User.findById(req.user.id)
      .select("-password")
      .populate("tenantId"); // ⭐ Populate tenant details (for enrollmentKey)

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({
      message: "Failed to fetch profile",
      error: err.message,
    });
  }
}

// --------------------------------------------------
// ⭐ REGISTER (Client Request)
// --------------------------------------------------
export async function register(req, res) {
  try {
    const { name, email, password, companyName } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      companyName,
      role: "client",
      isApproved: false, // Must be approved by admin
    });

    await newUser.save();

    res.status(201).json({
      message: "Registration request submitted. You will be able to login once an administrator approves your account.",
    });
  } catch (err) {
    res.status(500).json({
      message: "Registration failed",
      error: err.message,
    });
  }
}
