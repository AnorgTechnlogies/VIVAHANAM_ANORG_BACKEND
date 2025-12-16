// middleware/deviceSessionMiddleware.js
import DeviceSession from "../models/deviceSessionModel.js";
import jwt from "jsonwebtoken";

/**
 * Middleware to validate device session on each request
 * Checks if the token has an active device session
 */
const deviceSessionMiddleware = async (req, res, next) => {
  try {
    // Extract token
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1].trim();
    } else if (req.cookies?.jwt) {
      token = req.cookies.jwt;
      if (token.startsWith("Bearer ")) {
        token = token.split(" ")[1].trim();
      }
    }

    if (!token) {
      return next(); // Let userMiddleware handle token validation
    }

    // Check if device session exists and is active
    const deviceSession = await DeviceSession.findOne({
      token,
      isActive: true,
    });

    if (!deviceSession) {
      // Session was deactivated (e.g., by another device login)
      return res.status(401).json({
        success: false,
        message: "Your session has been terminated. Another device has logged in.",
        code: "SESSION_TERMINATED",
      });
    }

    // Update last active time
    await DeviceSession.updateLastActive(token);

    // Attach device session info to request
    req.deviceSession = deviceSession;

    next();
  } catch (error) {
    console.error("Device session middleware error:", error);
    // Don't block the request, let other middleware handle it
    next();
  }
};

export default deviceSessionMiddleware;

