// models/transactionModel.js
import mongoose from "mongoose";
import User from "../models/userModel.js"; // ✅ ADD THIS


const transactionSchema = new mongoose.Schema(
  {
    userVivId: {
      type: String,
      required: [true, "User VIV ID is required"],
      trim: true,
      uppercase: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    planId: {
      type: String,
      required: true,
    },
    planCode: {
      type: String,
      required: true,
    },
    planName: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: "USD",
    },
    paymentGateway: {
      type: String,
      enum: ["PAYPAL", "RAZORPAY", "UPI", "WALLET"],
      default: "PAYPAL",
      uppercase: true,
    },
    paymentMode: {
      type: String,
      enum: ["ONLINE", "WALLET", "MANUAL"],
      default: "ONLINE",
      uppercase: true,
    },
    paypalOrderId: {
      type: String,
      sparse: true,
    },
    paypalCaptureId: {
      type: String,
      sparse: true,
    },
    paymentReference: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['INITIATED', "CREATED", "PENDING", "COMPLETED", "FAILED", "CANCELLED", "REFUNDED"],
      default: "CREATED",
      uppercase: true,
    },
    transactionType: {
      type: String,
      enum: ["PLAN_PURCHASE", "CREDIT_TOPUP", "SUBSCRIPTION", "PROFILE_UNLOCK"],
      default: "PLAN_PURCHASE",
      uppercase: true,
    },
    payerEmail: String,
    payerId: String,
    paymentDetails: mongoose.Schema.Types.Mixed,
    failureReason: String,
    refundDetails: mongoose.Schema.Types.Mixed,
    metadata: mongoose.Schema.Types.Mixed,
    creditsAllocated: {
      type: Number,
      default: 0,
    },

purchasedProfiles: {
     type: Number,
  required: true,
 },

    creditsUsed: {
      type: Number,
      default: 0,
    },
    completedAt: Date,
    refundedAt: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for faster queries
transactionSchema.index({ userVivId: 1, createdAt: -1 });
transactionSchema.index({ paypalOrderId: 1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ userId: 1 });

const Transaction = mongoose.models.Transaction || mongoose.model("Transaction", transactionSchema);

export default Transaction;