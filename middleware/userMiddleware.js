// middleware/userMiddleware.js

import jwt from "jsonwebtoken";
import User from "../models/userModel.js";
import adminModel from "../models/adminModel.js"; // ← ADD THIS
import DeviceSession from "../models/deviceSessionModel.js";

const userMiddleware = async (req, res, next) => {
  try {
    let token = null;

    // === 1. Extract token from Authorization header ===
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1].trim();
    }

    // === 2. Fallback: from cookie ===
    if (!token && req.cookies?.jwt) {
      token = req.cookies.jwt;
      if (token.startsWith("Bearer ")) {
        token = token.split(" ")[1].trim();
      }
    }

    // === 3. No token? → reject ===
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
      });
    }

    // === 4. Verify JWT ===
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    let foundUser = null;
    let role = "user";

    // === 5. Try normal user (token has userId) ===
    if (decoded.userId) {
      foundUser = await User.findById(decoded.userId).select(
        "_id email role vivId isVerified profileCompleted name"
      );
      if (foundUser) role = foundUser.role || "user";
    }

    // === 6. Try admin user (token has adminId) ===
    if (!foundUser && decoded.adminId) {
      const admin = await adminModel.findById(decoded.adminId);
      if (admin) {
        foundUser = admin;
        role = "admin"; // Force admin role
      }
    }

    // === 7. Still no user? → invalid token ===
    if (!foundUser) {
      return res.status(401).json({
        success: false,
        message: "Invalid token. User/Admin not found.",
      });
    }

    // === 8. Check device session for regular users (not admins) ===
    if (role === "user" && decoded.userId) {
      const deviceSession = await DeviceSession.findOne({
        token,
        userId: decoded.userId,
        isActive: true,
      });

      if (!deviceSession) {
        return res.status(401).json({
          success: false,
          message: "Your session has been terminated. Another device has logged in.",
          code: "SESSION_TERMINATED",
        });
      }

      // Update last active time
      await DeviceSession.updateLastActive(token);
    }

    // === 9. Attach clean user object to req.user ===
    req.user = {
      userId: foundUser._id.toString(),
      _id: foundUser._id,
      email: foundUser.email || foundUser.adminEmailId,
      name: foundUser.name || foundUser.adminName || "Admin",
      role: role, // ← "admin" or "user"
      isVerified: foundUser.isVerified ?? foundUser.verified ?? false,
      profileCompleted: foundUser.profileCompleted ?? true,
      // Add anything else you need
    };

    next();
  } catch (error) {
    console.error("userMiddleware error:", error.name, error.message);

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Session expired. Please log in again.",
      });
    }

    return res.status(401).json({
      success: false,
      message: "Invalid or expired token.",
    });
  }
};

export default userMiddleware;