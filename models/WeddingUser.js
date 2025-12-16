import mongoose from "mongoose";

const weddingUserSchema = new mongoose.Schema(
  {
    // Link to authenticated user
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
      unique: true,
    },

    // Basic Information
    firstName: {
      type: String,
      required: true,
      trim: true
    },
    middleName: {
      type: String,
      trim: true,
      default: ''
    },
    lastName: {
      type: String,
      required: true,
      trim: true
    },
    mobileNumber: {
      type: String,
      required: true,
      trim: true
    },
    whatsappNumber: {
      type: String,
      trim: true
    },
    
    // User Details
    userType: {
      type: String,
      enum: ['self', 'parents', 'sibling', 'relative'],
      required: true
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
      required: true
    },
    motherTongue: {
      type: String,
      required: true
    },
    religion: {
      type: String,
      required: true
    },
    
    // Address Details
    country: {
      type: String,
      required: true
    },
    state: {
      type: String,
      required: true
    },
    city: {
      type: String,
      required: true
    },
    postalCode: {
      type: String,
      required: true
    },
    streetAddress: {
      type: String,
      required: true
    },
    
    // Selected Services
    selectedServices: [{
      type: String,
      default: []
    }],
    
    // Basic Status
    status: {
      type: String,
      enum: ['pending', 'active', 'inactive'],
      default: 'pending'
    },
    
    // Simple flags
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { 
    timestamps: true
  }
);

// Index for mobile and whatsapp numbers (both should be unique)
weddingUserSchema.index({ mobileNumber: 1 }, { unique: true });
weddingUserSchema.index({ whatsappNumber: 1 }, { sparse: true });

export default mongoose.model('WeddingUser', weddingUserSchema);