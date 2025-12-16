import jwt from "jsonwebtoken";
import adminModel from "../models/adminModel.js";

const adminMiddleware = async (req, res, next) => {
  try {
    // Check adminToken FIRST (this is what you set)
    let token = req.cookies?.adminToken || req.cookies?.token;

    // Fallback to Authorization header
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1];
      }
    }

    console.log("Admin Middleware - Token found:", !!token);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No token provided. Please log in.",
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("✅ Token decoded:", decoded);

    // Get admin ID from decoded token
    const adminId = decoded.adminId || decoded.id || decoded._id;
    
    if (!adminId) {
      return res.status(401).json({ 
        success: false, 
        message: "Invalid token format." 
      });
    }

    // Find admin in database
    const admin = await adminModel.findById(adminId).select("-adminPassword");
    
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Admin not found. Please log in again.",
      });
    }

    console.log("Admin authenticated:", admin.adminEmailId, "| Name:", admin.adminName);
    
    // Attach admin to request
    req.admin = admin;
    req.user = admin; // for compatibility
    
    next();

  } catch (error) {
    console.error("❌ Admin Middleware Error:", error.message);
    
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token. Please log in again.",
      });
    }
    
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired. Please log in again.",
      });
    }

    return res.status(401).json({
      success: false,
      message: "Authentication failed.",
    });
  }
};

export { adminMiddleware };