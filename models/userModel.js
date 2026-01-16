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

    // Password Reset Fields
    resetPasswordCode: { type: String, select: false },
    resetPasswordExpires: { type: Date, select: false },

    // Profile Status
    profileCompleted: { type: Boolean, default: false },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    lastLogin: { type: Date },
    lastLogout: { type: Date },
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
    // For backward compatibility - single image
    profileImage: { type: String, default: null },
    profileImagePublicId: { type: String, default: null },
    
    // NEW: For multiple profile images
    profileImages: [{
      url: {
        type: String,
        required: true
      },
      publicId: {
        type: String,
        required: true
      },
      isPrimary: {
        type: Boolean,
        default: false
      },
      order: {
        type: Number,
        default: 0
      },
      uploadedAt: {
        type: Date,
        default: Date.now
      }
    }],
    
    profileImagesCount: {
      type: Number,
      default: 0
    },
    
    // Additional images in formData (optional, for easy access)
    additionalImages: [{ type: String }],
    additionalImagePublicIds: [{ type: String }],
    
    documents: [{ type: String }],
    documentPublicIds: [{ type: String }],
    
    // Metadata
    lastProfileUpdate: {
      type: Date,
      default: null
    }
  },
  { 
    timestamps: true,
    toJSON: { 
      virtuals: true,
      transform: function(doc, ret) {
        delete ret.password;
        delete ret.verificationCode;
        delete ret.verificationCodeExpires;
        delete ret.resetPasswordCode;
        delete ret.resetPasswordExpires;
        
        // Ensure profileImages array is properly formatted
        if (ret.profileImages && ret.profileImages.length > 0) {
          // Sort by order
          ret.profileImages.sort((a, b) => a.order - b.order);
        }
        
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
userSchema.index({ lastLogin: 1 });
userSchema.index({ lastLogout: 1 });
userSchema.index({ profileImagesCount: 1 }); // NEW: For filtering by images count
userSchema.index({ "profileImages.isPrimary": 1 }); // NEW: For finding primary image

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

// Virtual to get primary profile image
userSchema.virtual('primaryProfileImage').get(function() {
  if (this.profileImages && this.profileImages.length > 0) {
    const primary = this.profileImages.find(img => img.isPrimary);
    if (primary) return primary.url;
    // Return first image if no primary found
    return this.profileImages[0].url;
  }
  return this.profileImage || null;
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
  
  // Ensure profileImages is properly sorted
  if (user.profileImages && user.profileImages.length > 0) {
    user.profileImages.sort((a, b) => a.order - b.order);
  }
  
  return user;
};

// NEW: Instance method to get all profile images
userSchema.methods.getAllProfileImages = function() {
  const images = [];
  
  // Add images from profileImages array
  if (this.profileImages && this.profileImages.length > 0) {
    const sortedImages = [...this.profileImages].sort((a, b) => a.order - b.order);
    images.push(...sortedImages);
  }
  
  // Add additional images if any
  if (this.additionalImages && this.additionalImages.length > 0) {
    this.additionalImages.forEach((url, index) => {
      images.push({
        url,
        publicId: this.additionalImagePublicIds[index] || '',
        isPrimary: false,
        order: images.length + index,
        uploadedAt: new Date()
      });
    });
  }
  
  return images;
};

// NEW: Instance method to add profile image
userSchema.methods.addProfileImage = function(url, publicId, isPrimary = false) {
  if (!this.profileImages) {
    this.profileImages = [];
  }
  
  const image = {
    url,
    publicId,
    isPrimary,
    order: this.profileImages.length,
    uploadedAt: new Date()
  };
  
  // If this is primary, unset previous primary
  if (isPrimary) {
    this.profileImages.forEach(img => {
      img.isPrimary = false;
    });
  }
  
  this.profileImages.push(image);
  this.profileImagesCount = this.profileImages.length;
  
  // Update single profileImage for backward compatibility
  if (isPrimary || this.profileImages.length === 1) {
    this.profileImage = url;
    this.profileImagePublicId = publicId;
  }
  
  this.lastProfileUpdate = new Date();
  return this.save();
};

// NEW: Instance method to remove profile image
userSchema.methods.removeProfileImage = function(publicId) {
  if (!this.profileImages) return this;
  
  const index = this.profileImages.findIndex(img => img.publicId === publicId);
  if (index === -1) return this;
  
  const removedImage = this.profileImages[index];
  this.profileImages.splice(index, 1);
  
  // Reorder remaining images
  this.profileImages.forEach((img, idx) => {
    img.order = idx;
  });
  
  this.profileImagesCount = this.profileImages.length;
  
  // If removed image was primary or the only image, update primary image
  if (removedImage.isPrimary || this.profileImages.length === 0) {
    if (this.profileImages.length > 0) {
      // Set first image as primary
      this.profileImages[0].isPrimary = true;
      this.profileImage = this.profileImages[0].url;
      this.profileImagePublicId = this.profileImages[0].publicId;
    } else {
      this.profileImage = null;
      this.profileImagePublicId = null;
    }
  }
  
  this.lastProfileUpdate = new Date();
  return this.save();
};

// NEW: Instance method to set primary image
userSchema.methods.setPrimaryImage = function(publicId) {
  if (!this.profileImages) return this;
  
  // Find the image to set as primary
  const image = this.profileImages.find(img => img.publicId === publicId);
  if (!image) return this;
  
  // Unset all primary flags
  this.profileImages.forEach(img => {
    img.isPrimary = false;
  });
  
  // Set this image as primary
  image.isPrimary = true;
  
  // Update single profileImage for backward compatibility
  this.profileImage = image.url;
  this.profileImagePublicId = image.publicId;
  
  this.lastProfileUpdate = new Date();
  return this.save();
};

// Instance method to update login time
userSchema.methods.updateLoginTime = function() {
  this.lastLogin = new Date();
  this.lastLogout = null;
  return this.save({ validateBeforeSave: false });
};

// Instance method to update logout time
userSchema.methods.updateLogoutTime = function() {
  this.lastLogout = new Date();
  return this.save({ validateBeforeSave: false });
};

// Middleware to update profileImagesCount before save
userSchema.pre('save', function(next) {
  if (this.profileImages) {
    this.profileImagesCount = this.profileImages.length;
  }
  next();
});

export default mongoose.model("User", userSchema);