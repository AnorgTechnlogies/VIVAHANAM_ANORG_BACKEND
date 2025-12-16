// utils/cloudinaryUpload.js
import { cloudinary } from "../config/cloudinary.js";

export const uploadToCloudinary = (fileBuffer, folder = "vivahanam/blogs") => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        transformation: [
          { width: 1200, height: 800, crop: "limit" },
          { quality: "auto" },
          { fetch_format: "auto" },
        ],
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      }
    );
    uploadStream.end(fileBuffer);
  });
};


 
export const deleteFromCloudinary = async (imageUrl) => {
  try {
    const publicId = imageUrl
      .split("/")
      .slice(-2)
      .join("/")
      .split(".")[0];
    await cloudinary.uploader.destroy(publicId);
    console.log("Deleted from Cloudinary:", publicId);
  } catch (err) {
    console.error("Cloudinary delete error:", err);
  }
};