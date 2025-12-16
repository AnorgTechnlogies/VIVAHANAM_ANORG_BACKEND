import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    // --- Auth & Core ---
    vivId: { 
      type: String, 
      unique: true,
      required: true,
      uppercase: true,
      trim: true
    },
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, select: false },

    // Email Verification
    isVerified: { type: Boolean, default: false },
    verificationCode: { type: String, select: false },
    verificationCodeExpires: { type: Date, select: false },

    // Profile Status
    profileCompleted: { type: Boolean, default: false },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    lastLogin: { type: Date },
    lastLogout: { type: Date }, // ADDED: Track logout time
    currentPlan: { type: String, default: null },
    planExpiresAt: { type: Date, default: null },
    isPremium: { type: Boolean, default: false },
    lastPlanActivated: { type: Date, default: null },
    currentPlanProfilesTotal: { type: Number, default: 0 },
    currentPlanProfilesUsed: { type: Number, default: 0 },
    currentPlanProfilesRemaining: { type: Number, default: 0 },

    // --- Dynamic Form Data ---
    formData: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {}
    },

    // --- File Storage ---
    profileImage: { type: String, default: null },
    profileImagePublicId: { type: String, default: null },
    documents: [{ type: String }],
    documentPublicIds: [{ type: String }]
  },
  { 
    timestamps: true,
    toJSON: { 
      virtuals: true,
      transform: function(doc, ret) {
        delete ret.password;
        delete ret.verificationCode;
        delete ret.verificationCodeExpires;
        return ret;
      }
    }
  }
);

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ vivId: 1 });
userSchema.index({ profileCompleted: 1 });
userSchema.index({ "formData.gender": 1 });
userSchema.index({ "formData.maritalStatus": 1 });
userSchema.index({ lastLogin: 1 }); // ADDED: For active user queries
userSchema.index({ lastLogout: 1 }); // ADDED: For logout tracking

// Virtual for age calculation
userSchema.virtual('age').get(function() {
  const dob = this.formData.get('dateOfBirth');
  if (!dob) return null;
  
  const today = new Date();
  const birthDate = new Date(dob);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
});

// Virtual for online status
userSchema.virtual('isOnline').get(function() {
  if (!this.lastLogin) return false;
  if (this.lastLogout && this.lastLogout > this.lastLogin) return false;
  
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
  return this.lastLogin > fifteenMinutesAgo;
});

// Static method to find by login ID
userSchema.statics.findByLoginId = function(loginId) {
  const normalizedId = loginId.trim();
  return this.findOne({
    $or: [
      { email: normalizedId.toLowerCase() },
      { vivId: normalizedId.toUpperCase() }
    ]
  });
};

// Instance method to get safe user data
userSchema.methods.getSafeProfile = function() {
  const user = this.toObject();
  delete user.password;
  delete user.verificationCode;
  delete user.verificationCodeExpires;
  delete user.resetPasswordCode;
  delete user.resetPasswordExpires;
  return user;
};

// Instance method to update login time
userSchema.methods.updateLoginTime = function() {
  this.lastLogin = new Date();
  this.lastLogout = null; // Clear logout time when logging in
  return this.save({ validateBeforeSave: false });
};

// Instance method to update logout time
userSchema.methods.updateLogoutTime = function() {
  this.lastLogout = new Date();
  return this.save({ validateBeforeSave: false });
};

export default mongoose.model("User", userSchema);