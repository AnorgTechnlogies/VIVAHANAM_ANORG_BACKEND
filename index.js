import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { config } from "dotenv";
import ip from "ip";
import mongoose from "mongoose";
import path from 'path';
import { fileURLToPath } from 'url';
import connectDB from "./config/mongodb.js";
// Routes
import userPlanRoutes from "./routes/userPlanRoutes.js";
import adminRouter from "./routes/adminRoute.js";
import userRouter from "./routes/userRoutes.js";
import paymentRoutes from './routes/paymentRoutes.js';


config();
const app = express();

// 🧱 Middlewares
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Get __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// 🧩 Connect Database
connectDB();

const isDev = process.env.NODE_ENV === "development";

const baseOrigins = [
  process.env.FRONTEND_URI,
  process.env.FRONTEND_URI_SECOND,
  process.env.FRONTEND_URI_THIRD,
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:5175",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://localhost:3000",
].filter(Boolean);

// Add LAN IP (e.g. 192.168.1.9) in dev mode
if (isDev) {
  const lan = ip.address();
  ["3000", "5173", "5174", "5175"].forEach(port => {
    baseOrigins.push(`http://${lan}:${port}`);
    baseOrigins.push(`https://${lan}:${port}`);
  });
}

// Remove duplicates
const allowedOrigins = [...new Set(baseOrigins)];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow tools with no origin (Postman, curl)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`CORS blocked origin: ${origin}`);
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
  })
);


// Serve uploads folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ✅ Catch invalid JSON early
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && "body" in err) {
    console.error("Invalid JSON received:", err.message);
    return res.status(400).json({
      success: false,
      message: "Invalid JSON format in request body",
    });
  }
  next();
});

// ✅ API Routes
app.use("/api/userplan", userPlanRoutes);
app.use("/api/admin", adminRouter);
app.use("/api/user", userRouter);
app.use('/api/payment', paymentRoutes);

// 🏠 Health Check Route
app.get("/", (req, res) => {
  res.send("Vivahanam Backend Server is Running Successfully...");
});

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running successfully",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// 🚫 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// 💥 Global Error Handler
app.use((err, req, res, next) => {
  console.error("Server Error:", err.stack);
  res.status(500).json({
    success: false,
    message: "Internal Server Error",
  });
});

// 🚀 Start Server
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log("✅ MongoDB & Cloudinary Connected Successfully");
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log('❌ Unhandled Rejection at:', promise, 'reason:', err);
  process.exit(1);
});