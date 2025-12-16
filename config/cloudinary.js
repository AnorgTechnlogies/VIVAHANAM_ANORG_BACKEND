import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

try {
  await cloudinary.api.ping();
  console.log("✅ Cloudinary connected successfully");
} catch (err) {
  console.error("❌ Cloudinary connection failed:", err);
}

export { cloudinary };
