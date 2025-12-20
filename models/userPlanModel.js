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
    // "custom" added for dynamic plans (arbitrary validity days)
    enum: ["monthly", "yearly", "payasgo", "custom"],
      lowercase: true,
      required: true,
      default: "monthly",
    },
    payment_mode: {
      type: String,
      required: true,
      // PAYPAL ko bhi valid mode me add kiya
      enum: ["RAZORPAY", "UPI", "WALLET", "PAYPAL"],
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
      // Testing / special plans ke liye empty features par error na aaye
      default: [],
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
// Pre-validate: Auto-set frequency & expiry for OLD static plans
// NOTE: For dynamic admin plans we already set validForDays/expires_at
//       from MatchmakingPlan, so don't overwrite if they are present.
// ──────────────────────────────────────────────────────────────
userPlanSchema.pre("validate", function (next) {
  // If validity is already set (dynamic MatchmakingPlan), respect it
  const hasCustomValidity = !!(this.validForDays || this.expires_at);
  if (hasCustomValidity) {
    // Just ensure we have some frequency default
    if (!this.plan_frequency) {
      this.plan_frequency = this.plan_name === "PAYASGO" ? "payasgo" : "monthly";
    }
    return next();
  }

  if (this.isModified("plan_name") || !this.plan_frequency) {
    // PayAsGo plans
    if (this.plan_name === "PAYASGO") {
      this.plan_frequency = "payasgo";
      this.expires_at = null;
    }
    // Yearly plans (legacy static)
    else if (
      this.plan_name === "PLATINUM" ||
      this.plan_name === "PREMIUM" ||
      this.plan_name === "FAMILY"
    ) {
      this.plan_frequency = "yearly";
      const validityDays =
        this.plan_name === "FAMILY"
          ? 365
          : this.plan_name === "PREMIUM"
          ? 180
          : 365;
      this.expires_at = new Date(
        Date.now() + validityDays * 24 * 60 * 60 * 1000
      );
      this.validForDays = validityDays;
    }
    // Monthly plans (legacy static)
    else {
      this.plan_frequency = "monthly";
      const validityDays =
        this.plan_name === "STANDARD"
          ? 120
          : this.plan_name === "STARTER"
          ? 60
          : 30;
      this.expires_at = new Date(
        Date.now() + validityDays * 24 * 60 * 60 * 1000
      );
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