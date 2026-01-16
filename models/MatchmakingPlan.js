// models/MatchmakingPlan.js
import mongoose from "mongoose";

const matchmakingPlanSchema = new mongoose.Schema(
  {
    planCode: {
      type: String,
      required: [true, "Plan code is required"],
      unique: true,
      trim: true,
      uppercase: true,
    },
    planName: {
      type: String,
      required: [true, "Plan name is required"],
      trim: true,
    },
    planDisplayName: {
      type: String,
      trim: true,
    },
    tagline: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price must be positive"],
    },
    currency: {
      type: String,
      default: "USD",
      trim: true,
      uppercase: true,
    },
    profiles: {
      type: Number,
      required: [true, "Number of profiles is required"],
      min: [0, "Profiles must be positive"],
    },
    profilesAllocated: {
      type: Number,
      default: function() {
        return this.profiles;
      },
    },
    users: {
      type: Number,
      default: 1,
      min: [1, "At least 1 user is required"],
    },
    validityDays: {
      type: Number,
      required: [true, "Validity days is required"],
      min: [1, "Validity must be at least 1 day"],
    },
    validityUnit: {
      type: String,
      default: "days",
      enum: ["days", "months", "years"],
    },
    
    features: {
      type: [String],
      default: [],
    },
    plan_features: {
      type: [String],
      default: function() {
        return this.features;
      },
    },
    popular: {
      type: Boolean,
      default: false,
    },
    bestValue: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },

    // Optional: mark plan as special free / trial plan
    isFreeTrial: {
      type: Boolean,
      default: false,
    },

    // Optional: control visibility window for free / promotional plans
    freeFrom: {
      type: Date,
    },
    freeTo: {
      type: Date,
    },

    // Optional: restrict visibility to specific users (by vivId)
    allowedVivIds: [
      {
        type: String,
        uppercase: true,
        trim: true,
      },
    ],
    creditRate: {
      type: String,
      trim: true,
    },
    theme: {
      gradient: {
        type: String,
        default: "from-slate-500 via-slate-600 to-slate-700",
      },
      icon: {
        type: String,
        default: "Sparkles",
      },
      iconColor: {
        type: String,
        default: "text-slate-300",
      },
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Indexes
matchmakingPlanSchema.index({ planCode: 1 });
matchmakingPlanSchema.index({ isActive: 1, order: 1 });

// Export MatchmakingPlan model safely
const MatchmakingPlan =
  mongoose.models.MatchmakingPlan ||
  mongoose.model("MatchmakingPlan", matchmakingPlanSchema);

export default MatchmakingPlan;
