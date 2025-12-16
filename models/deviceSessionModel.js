import mongoose from "mongoose";

const deviceSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    deviceId: {
      type: String,
      required: true,
      trim: true,
    },
    deviceInfo: {
      userAgent: { type: String },
      ipAddress: { type: String },
      platform: { type: String },
      browser: { type: String },
    },
    token: {
      type: String,
      required: true,
    },
    lastActive: {
      type: Date,
      default: Date.now,
      index: true,
    },
    loginTime: {
      type: Date,
      default: Date.now,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient queries
deviceSessionSchema.index({ userId: 1, isActive: 1, lastActive: -1 });
deviceSessionSchema.index({ token: 1 });
deviceSessionSchema.index({ deviceId: 1 });

// Method to mark session as inactive
deviceSessionSchema.methods.deactivate = function () {
  this.isActive = false;
  return this.save();
};

// Static method to get active sessions for a user
deviceSessionSchema.statics.getActiveSessions = function (userId) {
  return this.find({
    userId,
    isActive: true,
  }).sort({ lastActive: -1 });
};

// Static method to get oldest active session
deviceSessionSchema.statics.getOldestActiveSession = function (userId) {
  return this.findOne({
    userId,
    isActive: true,
  }).sort({ lastActive: 1 });
};

// Static method to deactivate all sessions for a user
deviceSessionSchema.statics.deactivateAllSessions = function (userId) {
  return this.updateMany(
    { userId, isActive: true },
    { isActive: false }
  );
};

// Static method to deactivate session by token
deviceSessionSchema.statics.deactivateByToken = function (token) {
  return this.findOneAndUpdate(
    { token, isActive: true },
    { isActive: false },
    { new: true }
  );
};

// Static method to update last active time
deviceSessionSchema.statics.updateLastActive = function (token) {
  return this.findOneAndUpdate(
    { token, isActive: true },
    { lastActive: new Date() },
    { new: true }
  );
};

// Cleanup expired sessions (older than 7 days)
deviceSessionSchema.statics.cleanupExpiredSessions = function () {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return this.deleteMany({
    lastActive: { $lt: sevenDaysAgo },
    isActive: false,
  });
};

const DeviceSession =
  mongoose.models.DeviceSession ||
  mongoose.model("DeviceSession", deviceSessionSchema);

export default DeviceSession;

