// config/mongodb.js
import mongoose from "mongoose";
import { config } from "dotenv";

config({ path: "./config/config.env" });

const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is not defined in environment variables");
    }

    const conn = await mongoose.connect(process.env.MONGO_URI, {
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);

    const gracefulShutdown = (signal) => {
      console.log(`\n${signal} received: Closing MongoDB connection...`);
      mongoose.connection.close(() => {
        console.log("MongoDB connection closed.");
        process.exit(0);
      });
    };

    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

  } catch (error) {
    console.error("MongoDB Connection Failed:", error.message);
    process.exit(1); 
  }
};

export default connectDB;