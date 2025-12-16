import mongoose from "mongoose";

const profileUnlockSchema = new mongoose.Schema(
  {
    viewerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    viewerVivId: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    targetUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    targetVivId: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserPlan",
      required: true,
      index: true,
    },
    cost: {
      type: Number,
      default: 1,
    },
    unlockedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

profileUnlockSchema.index(
  { viewerUserId: 1, targetUserId: 1 },
  { unique: true }
);

const ProfileUnlock =
  mongoose.models.ProfileUnlock ||
  mongoose.model("ProfileUnlock", profileUnlockSchema);

export default ProfileUnlock;

