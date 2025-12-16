// models/Blog.js
import mongoose from "mongoose";

const blogSchema = new mongoose.Schema(
  {
    author: { type: String, required: true },
    date: { type: String, required: true },      // "2025-10-28"
    time: { type: String, required: true },      // "14:30"
    image: { type: String, required: true },     // Cloudinary URL
    title: { type: String, required: true },
    description: { type: String, required: true },
    slug: { type: String, unique: true, required: true },
  },
  { timestamps: true }
);

export default mongoose.model("Blog", blogSchema);