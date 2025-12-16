// models/ContactInfo.js
import mongoose from "mongoose";

const contactInfoSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      lowercase: true,
    },
    office: {
      type: String,
      required: [true, "Office location is required"],
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    additionalPhones: [{
      type: String,
      trim: true,
    }],
    additionalEmails: [{
      type: String,
      trim: true,
      lowercase: true,
    }],
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      zipCode: String,
    },
    workingHours: {
      monday: { open: String, close: String, closed: Boolean },
      tuesday: { open: String, close: String, closed: Boolean },
      wednesday: { open: String, close: String, closed: Boolean },
      thursday: { open: String, close: String, closed: Boolean },
      friday: { open: String, close: String, closed: Boolean },
      saturday: { open: String, close: String, closed: Boolean },
      sunday: { open: String, close: String, closed: Boolean },
    },
    socialMedia: {
      facebook: String,
      twitter: String,
      instagram: String,
      linkedin: String,
      youtube: String,
    },
    supportDetails: {
      supportEmail: String,
      supportPhone: String,
      emergencyContact: String,
      responseTime: String,
    },
  },
  { timestamps: true }
);

// Export ContactInfo model safely
const ContactInfo =
  mongoose.models.ContactInfo ||
  mongoose.model("ContactInfo", contactInfoSchema);

export default ContactInfo;