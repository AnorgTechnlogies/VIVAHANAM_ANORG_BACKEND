import mongoose from "mongoose";

// Define the schema
const userPlanSchema = new mongoose.Schema(
  {
    userVivId: {
      type: String,
      required: [true, "User VIV ID is required"],
      trim: true,
      uppercase: true,
      validate: {
        validator: async function (vivId) {
          const user = await mongoose.model("User").findOne({ vivId });
          return user !== null;
        },
        message: "User not found with this VIV ID",
      },
    },
    plan_name: {
      type: String,
      required: [true, "Plan name is required"],
      enum: {
        values: ["STARTER", "STANDARD", "PREMIUM", "FAMILY", "SILVER", "GOLD", "PLATINUM", "PAYASGO", "DIAMOND"],
        message: "Plan must be Starter, Standard, Premium, Family, Silver, Gold, Platinum, PayAsGo, or Diamond",
      },
      uppercase: true,
      trim: true,
    },
    planDisplayName: {
      type: String,
      trim: true,
    },
    planPrice: {
      type: Number,
      required: true,
    },
    planCurrency: {
      type: String,
      default: "USD",
    },
    plan_frequency: {
      type: String,
      enum: ["monthly", "yearly", "payasgo"],
      lowercase: true,
      required: true,
      default: "monthly",
    },
    payment_mode: {
      type: String,
      required: true,
      enum: ["RAZORPAY", "UPI", "WALLET"],
      uppercase: true,
    },
    payment_amount: {
      type: Number,
      required: true,
    },
    payment_date: {
      type: Date,
      default: Date.now,
      immutable: true,
    },
    payment_status: {
      type: String,
      enum: ["PENDING", "COMPLETED", "FAILED"],
      default: "PENDING",
      uppercase: true,
    },
    payment_reference: {
      type: String,
      trim: true,
    },
    plan_features: {
      type: [String],
      required: [true, "At least one feature required"],
      validate: {
        validator: function (features) {
          return Array.isArray(features) && features.length > 0;
        },
        message: "At least one plan feature is required",
      },
    },
    expires_at: { type: Date },
    validForDays: { type: Number },
    profilesAllocated: { type: Number, default: 0 },
    profilesUsed: { type: Number, default: 0 },
    profilesRemaining: { type: Number, default: 0 },
    profilesCarriedForwardFrom: { type: Number, default: 0 },
    profilesTransferredOut: { type: Number, default: 0 },
    profilesCarryForwardedAt: { type: Date },
    carriedForwardToPlanId: { type: mongoose.Schema.Types.ObjectId, ref: "UserPlan" },
    activatedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ──────────────────────────────────────────────────────────────
// Pre-validate: Auto-set frequency & expiry based on plan_name
// ──────────────────────────────────────────────────────────────
userPlanSchema.pre("validate", function (next) {
  if (this.isModified("plan_name") || !this.plan_frequency) {
    // PayAsGo plans (old and new)
    if (this.plan_name === "PAYASGO") {
      this.plan_frequency = "payasgo";
      this.expires_at = null;
    } 
    // Yearly plans
    else if (this.plan_name === "PLATINUM" || this.plan_name === "PREMIUM" || this.plan_name === "FAMILY") {
      this.plan_frequency = "yearly";
      const validityDays = this.plan_name === "FAMILY" ? 365 : 
                          this.plan_name === "PREMIUM" ? 180 : 365;
      this.expires_at = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000);
      this.validForDays = validityDays;
    } 
    // Monthly plans (default)
    else {
      this.plan_frequency = "monthly";
      const validityDays = this.plan_name === "STANDARD" ? 120 : 
                          this.plan_name === "STARTER" ? 60 : 30;
      this.expires_at = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000);
      this.validForDays = validityDays;
    }
  }
  next();
});

// ──────────────────────────────────────────────────────────────
// Pre-save: Force uppercase where needed
// ──────────────────────────────────────────────────────────────
userPlanSchema.pre("save", function (next) {
  if (this.isModified("plan_name")) this.plan_name = this.plan_name.toUpperCase();
  if (this.isModified("payment_mode")) this.payment_mode = this.payment_mode.toUpperCase();
  if (this.isModified("payment_status")) this.payment_status = this.payment_status.toUpperCase();
  next();
});

// ──────────────────────────────────────────────────────────────
// Virtual: isActive
// ──────────────────────────────────────────────────────────────
userPlanSchema.virtual("isActive").get(function () {
  if (this.plan_frequency === "payasgo") {
    return this.payment_status === "COMPLETED";
  }
  return this.payment_status === "COMPLETED" && this.expires_at > new Date();
});

// ──────────────────────────────────────────────────────────────
// Indexes
// ──────────────────────────────────────────────────────────────
userPlanSchema.index({ userVivId: 1, createdAt: -1 });
userPlanSchema.index({ userVivId: 1, payment_status: 1 });

// ──────────────────────────────────────────────────────────────
// THIS IS THE MOST IMPORTANT LINE – Prevents OverwriteModelError
// ──────────────────────────────────────────────────────────────
const UserPlan =
  mongoose.models.UserPlan || mongoose.model("UserPlan", userPlanSchema);

export default UserPlan;