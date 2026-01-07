import jwt from "jsonwebtoken";
import Tenant from "../models/Tenant.js";

export async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ⭐ Normalize user object (multi-tenant safe)
    req.user = {
      id: decoded.id,
      role: decoded.role,
      email: decoded.email,
      tenantId: decoded.tenantId,
    };

    // Skip tenant status check for global admins who might not have a tenantId
    if (req.user.role === "admin") {
      return next();
    }

    // ⭐ Enforce tenant context
    if (!req.user.tenantId) {
      return res.status(403).json({
        message: "Tenant context missing in token",
      });
    }

    // ⭐ Enforce tenant status
    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant || !tenant.isActive) {
      return res.status(403).json({
        message: "Access denied. Your company account is inactive.",
      });
    }

    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

export function adminOnly(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}
