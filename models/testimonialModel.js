// models/testimonialModel.js
import mongoose from "mongoose";

const testimonialSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Couple name is required"],
      trim: true,
    },
    weddingDate: {
      type: String,
      required: [true, "Wedding date is required"],
    },
    message: {
      type: String,
      required: [true, "Testimonial message is required"],
      minlength: [50, "Message must be at least 50 characters"],
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    image: {
      public_id: { type: String, default: "" },
      url: { type: String, default: "" },
    },
    isActive: {
      type: Boolean,
      default: false, // false = pending, true = approved
    },
    submittedBy: {
      type: String, // optional: email or name
      default: "Guest",
    },
  },
  { timestamps: true }
);

const Testimonial =
  mongoose.models.testimonial || mongoose.model("testimonial", testimonialSchema);

export default Testimonial;