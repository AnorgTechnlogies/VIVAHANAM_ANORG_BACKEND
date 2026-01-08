import User from "../models/userModel.js";
import ProfileUnlock from "../models/profileUnlockModel.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import Joi from "joi";
import nodemailer from "nodemailer";
import { cloudinary } from "../config/cloudinary.js";
import { trackUserLogin, trackUserLogout, trackUserActivity } from "./dashboardController.js";
import { FormField } from "../models/AdminRegistrationDynamicModel.js";
import DeviceSession from "../models/deviceSessionModel.js";
import UserPlan from "../models/userPlanModel.js";
import WeddingUser from "../models/WeddingUser.js";


// Environment Variables
const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret";
const FRONTEND_URI = process.env.FRONTEND_URI || "http://localhost:5173";
const EMAIL_USER = process.env.NODEMAILER_SENDING_EMAIL_ADDRESS;
const EMAIL_PASS = process.env.NODEMAILER_SENDING_EMAIL_PASSWORD;

// Nodemailer Transporter
const transport = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: { user: EMAIL_USER, pass: EMAIL_PASS },
  tls: { rejectUnauthorized: false },
});

// Rate limiting maps
const loginAttempts = new Map();
const forgotAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 10;
const MAX_FORGOT_ATTEMPTS = 10;
const LOCKOUT_TIME = 15 * 60 * 1000;

// Helper: Generate unique VIV ID
const generateVivId = async () => {
  let vivId;
  let isUnique = false;
  let attempts = 0;

  while (!isUnique && attempts < 10) {
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    vivId = `VIV${randomNum}`;
    const existingVivId = await User.findOne({ vivId });
    if (!existingVivId) isUnique = true;
    attempts++;
  }

  if (!isUnique) throw new Error("Failed to generate unique VIV ID");
  return vivId;
};

// Helper: Generate JWT
const generateToken = (user) => {
  return jwt.sign(
    { userId: user._id, email: user.email, role: user.role || "user", vivId: user.vivId },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
};

// Helper: Generate 6-digit code
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Cloudinary: Upload base64 image
const uploadBase64Image = async (base64String, folder = "vivahanam/profile_images") => {
  try {
    console.log("📤 Uploading base64 image to Cloudinary...");
    const result = await cloudinary.uploader.upload(base64String, {
      folder: folder,
      resource_type: "image",
      transformation: [
        { width: 500, height: 500, crop: "fill", gravity: "face", quality: "auto" },
      ],
    });
    console.log("✅ Image uploaded:", result.secure_url);
    return { success: true, url: result.secure_url, publicId: result.public_id };
  } catch (error) {
    console.error("❌ Image upload failed:", error);
    return { success: false, error: error.message };
  }
};

// Cloudinary: Upload base64 document
const uploadBase64Document = async (base64String, folder = "vivahanam/documents") => {
  try {
    console.log("📤 Uploading base64 document to Cloudinary...");
    const result = await cloudinary.uploader.upload(base64String, {
      folder: folder,
      resource_type: "auto",
    });
    console.log("✅ Document uploaded:", result.secure_url);
    return { success: true, url: result.secure_url, publicId: result.public_id };
  } catch (error) {
    console.error("❌ Document upload failed:", error);
    return { success: false, error: error.message };
  }
};

// Cloudinary: Delete image
const deleteCloudinaryImage = async (publicId) => {
  try {
    if (!publicId) return;
    await cloudinary.uploader.destroy(publicId);
    console.log("🗑️ Old image deleted:", publicId);
  } catch (error) {
    console.error("❌ Failed to delete old image:", error);
  }
};

// Utility: Send Verification Email
const sendVerificationEmail = async (email, code, name, vivId) => {
  const mailOptions = {
    from: EMAIL_USER,
    to: email,
    subject: "Verify Your Email - Vedic Indian Vivah",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 10px; overflow: hidden;">
        <div style="background: linear-gradient(to right, #b45309, #dc2626); padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Vedic Indian Vivah</h1>
        </div>
        <div style="padding: 25px;">
          <h2 style="color: #b45309;">Hello ${name},</h2>
          <p>Welcome to Vedic Indian Vivah! Your unique ID is: <strong>${vivId}</strong></p>
          <p>Complete your registration with this verification code:</p>
          <div style="text-align: center; margin: 30px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #dc2626; background: #fef3c7; padding: 15px 20px; border-radius: 8px; display: inline-block;">
              ${code}
            </span>
          </div>
          <p><strong>Expires in 10 minutes.</strong></p>
          <p><strong>Keep your VIV ID safe: ${vivId}</strong> - You'll need it for login and support.</p>
          <p>If you didn't sign up, please ignore this email.</p>
        </div>
        <div style="background: #fef3c7; padding: 15px; text-align: center; font-size: 12px; color: #78350f;">
          <p>© 2025 Vedic Indian Vivah. All rights reserved.</p>
        </div>
      </div>
    `,
  };
  try {
    await transport.sendMail(mailOptions);
    console.log(`✅ Verification email sent to: ${email}`);
    return true;
  } catch (error) {
    console.error("❌ Failed to send verification email:", error);
    return false;
  }
};

// Utility: Send Registration Success Email
const sendRegistrationSuccessEmail = async (email, name, vivId) => {
  const mailOptions = {
    from: EMAIL_USER,
    to: email,
    subject: "🎉 Registration Successful - Welcome to Vedic Indian Vivah!",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 10px; overflow: hidden;">
        <div style="background: linear-gradient(to right, #b45309, #dc2626); padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Vedic Indian Vivah</h1>
        </div>
        <div style="padding: 25px;">
          <h2 style="color: #b45309;">Congratulations ${name}!</h2>
          <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0369a1;">
            <h3 style="color: #0369a1; margin-top: 0;">🎉 Registration Successful!</h3>
            <p style="color: #0c4a6e; font-size: 16px;">
              <strong>Your VIV ID: ${vivId}</strong>
            </p>
            <p>Your email has been verified and your account is now active!</p>
          </div>
          <div style="background: #dcfce7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #16a34a;">
            <h3 style="color: #166534; margin-top: 0;">📝 Your Login Details:</h3>
            <p style="margin: 5px 0;"><strong>VIV ID:</strong> ${vivId}</p>
            <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
            <p style="margin: 5px 0;"><strong>Password:</strong> Your chosen password</p>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${FRONTEND_URI}/login" style="background: #dc2626; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Login to Your Account
            </a>
          </div>
          <p><strong>Important:</strong> Keep your VIV ID (${vivId}) safe. You'll need it for customer support and account recovery.</p>
          <p>Wishing you a blessed journey,<br><strong>The Vedic Indian Vivah Team</strong></p>
        </div>
        <div style="background: #fef3c7; padding: 15px; text-align: center; font-size: 12px; color: #78350f;">
          <p>© 2025 Vedic Indian Vivah. All rights reserved.</p>
        </div>
      </div>
    `,
  };
  try {
    await transport.sendMail(mailOptions);
    console.log(`✅ Registration success email sent to: ${email}`);
  } catch (error) {
    console.error("❌ Registration success email failed:", error);
  }
};

// ==================== VALIDATION SCHEMAS ====================

// Static schemas for authentication only
const simpleSignupSchema = Joi.object({
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
});

const loginSchema = Joi.object({
  loginId: Joi.string().required(),
  password: Joi.string().min(6).required(),
  deviceId: Joi.string().optional(), // Optional device ID for session management
});

// Dynamic validation helper
const validateDynamicFields = async (formData) => {
  try {
    const activeFields = await FormField.find({ 
      isActive: true, 
      $or: [{ isRequired: true }, { 'validation.required': true }] 
    });

    const missingFields = [];
    const errors = {};

    activeFields.forEach(field => {
      const value = formData?.[field.name];
      
      // Check required fields
      if ((field.isRequired || field.validation?.required) && (!value || value.toString().trim() === '')) {
        missingFields.push(field.label || field.name);
        errors[field.name] = `${field.label || field.name} is required`;
      }

      // Validate min length
      if (value && field.validation?.minLength && value.toString().trim().length < field.validation.minLength) {
        errors[field.name] = field.validation.message || `Minimum ${field.validation.minLength} characters required`;
      }

      // Validate max length
      if (value && field.validation?.maxLength && value.toString().trim().length > field.validation.maxLength) {
        errors[field.name] = field.validation.message || `Maximum ${field.validation.maxLength} characters allowed`;
      }

      // Validate pattern
      if (value && field.validation?.pattern && !new RegExp(field.validation.pattern).test(value.toString().trim())) {
        errors[field.name] = field.validation.message || "Invalid format";
      }
    });

    return { missingFields, errors, isValid: missingFields.length === 0 && Object.keys(errors).length === 0 };
  } catch (error) {
    console.error("❌ Dynamic validation error:", error);
    return { missingFields: [], errors: {}, isValid: true }; // Fallback to allow submission
  }
};

// ==================== CONTROLLER FUNCTIONS ====================

// 1. Simple Signup
export const simpleSignup = async (req, res) => {
  try {
    console.log("🔍 Simple signup request received");
    const { error, value } = simpleSignupSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    const { firstName, lastName, email, password } = value;
    const normalizedEmail = email.toLowerCase().trim();

    // Check if user exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email already registered",
      });
    }

    // Generate unique VIV ID
    const vivId = await generateVivId();

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Generate verification code
    const verificationCode = generateVerificationCode();
    const verificationCodeExpires = new Date(Date.now() + 10 * 60 * 1000);

    // Create full name
    const fullName = `${firstName} ${lastName}`.trim();

    // Create user with basic fields and empty formData
    const user = new User({
      vivId,
      name: fullName,
      firstName,
      lastName,
      email: normalizedEmail,
      password: hashedPassword,
      isVerified: false,
      verificationCode,
      verificationCodeExpires,
      profileCompleted: false,
      formData: new Map() // Initialize empty formData
    });

    await user.save();
    console.log(`✅ Simple signup successful: ${user._id}, VIV ID: ${vivId}`);

    // Send verification email
    const emailSent = await sendVerificationEmail(normalizedEmail, verificationCode, fullName, vivId);
    if (!emailSent) {
      await User.findByIdAndDelete(user._id);
      return res.status(500).json({
        success: false,
        message: "Failed to send verification email. Please try again.",
      });
    }

    res.status(201).json({
      success: true,
      message: "Signup successful! Verification code sent to your email.",
      userId: user._id,
      vivId,
      email: normalizedEmail,
      nextStep: "verify-email",
    });
  } catch (error) {
    console.error("❌ Simple signup error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during signup",
      error: error.message,
    });
  }
};

// 2. Verify Email
export const verifyEmail = async (req, res) => {
  const { email, verificationCode } = req.body;
  if (!email || !verificationCode) {
    return res.status(400).json({
      success: false,
      message: "Email and verification code required",
    });
  }

  try {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail }).select(
      "+verificationCode +verificationCodeExpires"
    );

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: "Email already verified. Please login.",
      });
    }

    if (user.verificationCode !== verificationCode) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification code",
      });
    }

    if (Date.now() > user.verificationCodeExpires) {
      return res.status(400).json({
        success: false,
        message: "Verification code expired. Please request a new one.",
      });
    }

    // Mark as verified
    user.isVerified = true;
    user.verificationCode = null;
    user.verificationCodeExpires = null;
    await user.save();

    console.log(`✅ User verified: ${user.email}, VIV ID: ${user.vivId}`);

    // Send registration success email
    await sendRegistrationSuccessEmail(user.email, user.name, user.vivId);

    // Generate JWT token
    const token = generateToken(user);

    // Convert formData to object for response
    let formDataObject = {};
    if (user.formData) {
      try {
        if (user.formData instanceof Map) {
          formDataObject = Object.fromEntries(user.formData);
        } else if (user.formData.entries) {
          formDataObject = Object.fromEntries(user.formData.entries());
        } else {
          formDataObject = user.formData;
        }
      } catch (error) {
        console.error("Error converting formData:", error);
        formDataObject = {};
      }
    }

    res.status(200).json({
      success: true,
      message: "Email verified successfully!",
      token,
      user: {
        id: user._id,
        vivId: user.vivId,
        name: user.name,
        email: user.email,
        profileCompleted: user.profileCompleted,
        formData: formDataObject
      },
    });
  } catch (error) {
    console.error("❌ Verify email error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during verification",
      error: error.message,
    });
  }
};

// 3. Complete Registration with Dynamic Fields
export const completeRegistration = async (req, res) => {
  try {
    console.log("🔍 Complete registration request received");

    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required. Please login first.",
      });
    }

    const { formData, profileImage, documents } = req.body;

    console.log("📋 Form data received:", Object.keys(formData || {}));
    console.log("🖼️ Profile image:", profileImage ? "Present" : "Missing");
    console.log("📄 Documents:", documents ? `${documents.length} documents` : "Missing");

    // Validate required files
    if (!profileImage) {
      return res.status(400).json({
        success: false,
        message: "Profile image is required",
      });
    }

    if (!documents || documents.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one document is required",
      });
    }

    // Validate dynamic fields
    const validation = await validateDynamicFields(formData);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: validation.missingFields.length > 0 
          ? `Please fill all required fields: ${validation.missingFields.join(', ')}`
          : 'Please fix validation errors',
        errors: validation.errors,
        missingFields: validation.missingFields
      });
    }

    const existingUser = await User.findById(userId);
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: "User not found. Please signup first.",
      });
    }

    if (existingUser.profileCompleted) {
      return res.status(400).json({
        success: false,
        message: "Profile already completed. Use update profile instead.",
      });
    }

    console.log("📤 Uploading files to Cloudinary...");

    // Upload profile image
    const profileUploadResult = await uploadBase64Image(profileImage);
    if (!profileUploadResult.success) {
      return res.status(500).json({
        success: false,
        message: "Failed to upload profile image",
        error: profileUploadResult.error
      });
    }

    // Upload documents
    const documentUploadPromises = documents.map(doc => uploadBase64Document(doc));
    const documentUploadResults = await Promise.all(documentUploadPromises);
    
    const failedUploads = documentUploadResults.filter(result => !result.success);
    if (failedUploads.length > 0) {
      return res.status(500).json({
        success: false,
        message: "Failed to upload some documents",
        errors: failedUploads.map(result => result.error)
      });
    }

    // Extract essential fields for top-level storage (for querying)
    const essentialFields = {
      mobileNo: formData.mobileNo || '',
      gender: formData.gender || '',
      dateOfBirth: formData.dateOfBirth || null,
      maritalStatus: formData.maritalStatus || '',
      religion: formData.religion || '',
      city: formData.city || '',
      state: formData.state || '',
      country: formData.country || '',
    };

    // Update user with both essential fields and formData
    const updateData = {
      ...essentialFields,
      formData: new Map(Object.entries(formData || {})),
      profileImage: profileUploadResult.url,
      profileImagePublicId: profileUploadResult.publicId,
      documents: documentUploadResults.map(result => result.url),
      documentPublicIds: documentUploadResults.map(result => result.publicId),
      profileCompleted: true
    };

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select("-password -verificationCode -verificationCodeExpires");

    console.log(`✅ Registration completed for VIV ID: ${updatedUser.vivId}`);

    // Convert formData for response
    let formDataObject = {};
    if (updatedUser.formData) {
      try {
        if (updatedUser.formData instanceof Map) {
          formDataObject = Object.fromEntries(updatedUser.formData);
        } else if (updatedUser.formData.entries) {
          formDataObject = Object.fromEntries(updatedUser.formData.entries());
        } else {
          formDataObject = updatedUser.formData;
        }
      } catch (error) {
        console.error("Error converting formData:", error);
        formDataObject = {};
      }
    }

    res.status(200).json({
      success: true,
      message: "Registration completed successfully!",
      user: {
        ...updatedUser.toObject(),
        formData: formDataObject
      },
      nextStep: "/dashboard",
    });
  } catch (error) {
    console.error("❌ Complete registration error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during registration completion",
      error: error.message,
    });
  }
};

// 4. Login - UPDATED with proper login tracking
export const login = async (req, res) => {
  const clientIp = req.ip || req.connection.remoteAddress || "unknown";
  const attempt = loginAttempts.get(clientIp) || { count: 0, lockedUntil: null };

  if (attempt.lockedUntil && Date.now() < attempt.lockedUntil) {
    const mins = Math.ceil((attempt.lockedUntil - Date.now()) / 60000);
    return res.status(429).json({
      success: false,
      message: `Too many attempts. Try again in ${mins} minute(s).`,
    });
  }

  const { error, value } = loginSchema.validate(req.body);
  if (error) {
    console.error("Login validation error:", error.details);
    return res.status(400).json({ success: false, message: "Invalid input format", details: error.details });
  }

  const { loginId, password, deviceId } = value;

  try {
    // Find user by email or VIV ID
    const user = await User.findOne({
      $or: [
        { email: loginId.toLowerCase().trim() },
        { vivId: loginId.toUpperCase().trim() }
      ]
    }).select("+password");

    if (!user || !(await bcrypt.compare(password, user.password))) {
      const newCount = attempt.count + 1;
      const lockout = newCount >= MAX_LOGIN_ATTEMPTS;
      loginAttempts.set(clientIp, {
        count: newCount,
        lockedUntil: lockout ? Date.now() + LOCKOUT_TIME : null,
      });
      return res.status(401).json({
        success: false,
        message: "Invalid login ID or password",
      });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        success: false,
        message: "Please verify your email first.",
      });
    }

    loginAttempts.delete(clientIp);
    
    // UPDATED: Use instance method to update login time
    await user.updateLoginTime();

    // Track user login for active status
    trackUserLogin(user._id);

    // ========== DEVICE SESSION MANAGEMENT ==========
    // Get device info from request (deviceId from validated value or headers)
    const currentDeviceId = deviceId || req.headers["x-device-id"] || "unknown";
    const userAgent = req.headers["user-agent"] || "unknown";
    const ipAddress = clientIp;

    // Get user's active plan to determine device limit
    const activePlan = await UserPlan.findOne({
      userVivId: user.vivId,
      payment_status: "COMPLETED",
    })
      .sort({ createdAt: -1 })
      .lean();

    // Determine device limit based on plan
    let deviceLimit = 1; // Default: 1 device (single device login)
    if (activePlan) {
      const planName = activePlan.plan_name?.toUpperCase();
      if (planName === "FAMILY") {
        deviceLimit = 3; // Family plan: 3 devices
      } else {
        deviceLimit = 1; // All other plans: 1 device
      }
    }

    // Get active device sessions for this user
    const activeSessions = await DeviceSession.getActiveSessions(user._id);
    const activeSessionCount = activeSessions.length;

    // Check if device limit is exceeded
    if (activeSessionCount >= deviceLimit) {
      // Find the oldest active session to logout
      const oldestSession = await DeviceSession.getOldestActiveSession(user._id);
      
      if (oldestSession) {
        // Deactivate the oldest session
        await oldestSession.deactivate();
        console.log(`🔄 Auto-logged out oldest session for user ${user.vivId}`);
      } else {
        // If no oldest session found, deactivate all and create new one
        await DeviceSession.deactivateAllSessions(user._id);
        console.log(`🔄 Deactivated all sessions for user ${user.vivId}`);
      }
    }

    // Generate token
    const token = generateToken(user);

    // Create new device session
    const deviceInfo = {
      userAgent,
      ipAddress,
      platform: req.headers["sec-ch-ua-platform"] || "unknown",
      browser: userAgent.split(" ")[0] || "unknown",
    };

    await DeviceSession.create({
      userId: user._id,
      deviceId: currentDeviceId,
      deviceInfo,
      token,
      lastActive: new Date(),
      loginTime: new Date(),
      isActive: true,
    });

    console.log(`✅ User ${user.vivId} logged in successfully (Device: ${currentDeviceId}, Limit: ${deviceLimit})`);

    // Convert formData to object for response
    let formDataObject = {};
    if (user.formData) {
      try {
        if (user.formData instanceof Map) {
          formDataObject = Object.fromEntries(user.formData);
        } else if (user.formData.entries) {
          formDataObject = Object.fromEntries(user.formData.entries());
        } else {
          formDataObject = user.formData;
        }
      } catch (error) {
        console.error("Error converting formData:", error);
        formDataObject = {};
      }
    }

    res.json({
      success: true,
      message: "Login successful!",
      token,
      deviceLimit,
      activeDevices: activeSessionCount >= deviceLimit ? deviceLimit : activeSessionCount + 1,
      user: {
        id: user._id,
        vivId: user.vivId,
        name: user.name,
        email: user.email,
        profileCompleted: user.profileCompleted,
        formData: formDataObject,
        lastLogin: user.lastLogin
      },
    });
  } catch (error) {
    console.error("❌ Login error:", error);
    res.status(500).json({ success: false, message: "Server error during login" });
  }
};

// 5. Update Profile - Dynamic Fields Only
export const updateProfile = async (req, res) => {
  try {
    console.log("📥 Update profile request received");
    
    const userId = req.user?.id || req.user?._id || req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: "User ID not found in request" 
      });
    }

    console.log("🔍 Using User ID:", userId);

    // Get ALL data from req.body as dynamic formData
    const formDataUpdate = { ...req.body };
    
    // Remove any undefined fields
    Object.keys(formDataUpdate).forEach(key => {
      if (formDataUpdate[key] === undefined) {
        delete formDataUpdate[key];
      }
    });

    console.log("🔄 Processed formDataUpdate:", formDataUpdate);

    // Extract essential fields for top-level storage
    const essentialFields = {
      mobileNo: formDataUpdate.mobileNo || '',
      gender: formDataUpdate.gender || '',
      dateOfBirth: formDataUpdate.dateOfBirth || null,
      maritalStatus: formDataUpdate.maritalStatus || '',
      religion: formDataUpdate.religion || '',
      city: formDataUpdate.city || '',
      state: formDataUpdate.state || '',
      country: formDataUpdate.country || '',
    };

    // Build update object
    const updateObj = {
      $set: {
        ...essentialFields,
        formData: new Map(Object.entries(formDataUpdate)),
        profileCompleted: true
      }
    };

    console.log("📤 MongoDB update object:", updateObj);

    const user = await User.findByIdAndUpdate(
      userId,
      updateObj,
      { new: true, runValidators: true }
    );

    if (!user) {
      console.log("❌ User not found with ID:", userId);
      return res.status(404).json({ 
        success: false, 
        message: "User not found" 
      });
    }

    console.log("✅ User updated successfully:", user._id);

    // Convert formData to object for response
    let formDataObject = {};
    if (user.formData) {
      try {
        if (user.formData instanceof Map) {
          formDataObject = Object.fromEntries(user.formData);
        } else if (user.formData.entries) {
          formDataObject = Object.fromEntries(user.formData.entries());
        } else {
          formDataObject = user.formData;
        }
      } catch (error) {
        console.error("Error converting formData:", error);
        formDataObject = {};
      }
    }

    res.json({
      success: true,
      message: "Profile updated successfully",
      user: formDataObject
    });
  } catch (error) {
    console.error("❌ Update profile error:", error);
    res.status(500).json({ 
      success: false,
      message: "Failed to update profile",
      error: error.message 
    });
  }
};

// 6. Resend Verification Code
export const resendVerificationCode = async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, message: "Email required" });
  }

  try {
    const user = await User.findOne({
      email: email.toLowerCase().trim(),
      isVerified: false,
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "User not found or already verified",
      });
    }

    const newCode = generateVerificationCode();
    const expires = new Date(Date.now() + 10 * 60 * 1000);
    user.verificationCode = newCode;
    user.verificationCodeExpires = expires;
    await user.save();

    const sent = await sendVerificationEmail(user.email, newCode, user.name, user.vivId);
    if (!sent) {
      return res.status(500).json({
        success: false,
        message: "Failed to resend verification code",
      });
    }

    res.json({ success: true, message: "Verification code resent" });
  } catch (error) {
    console.error("❌ Resend verification error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// 7. Forgot Password
export const forgotPassword = async (req, res) => {
  const { loginId } = req.body;
  if (!loginId) {
    return res.status(400).json({ success: false, message: "Email or VIV ID required" });
  }

  const clientIp = req.ip || "unknown";
  const attempt = forgotAttempts.get(clientIp) || { count: 0, lockedUntil: null };

  if (attempt.lockedUntil && Date.now() < attempt.lockedUntil) {
    const mins = Math.ceil((attempt.lockedUntil - Date.now()) / 60000);
    return res.status(429).json({
      success: false,
      message: `Too many requests. Try again in ${mins} minute(s).`,
    });
  }

  try {
    const user = await User.findOne({
      $or: [
        { email: loginId.toLowerCase().trim() },
        { vivId: loginId.toUpperCase().trim() }
      ]
    });

    if (!user) {
      return res.json({
        success: true,
        message: "If account exists, a verification code was sent",
      });
    }

    const newCount = attempt.count + 1;
    const lockout = newCount >= MAX_FORGOT_ATTEMPTS;
    forgotAttempts.set(clientIp, {
      count: newCount,
      lockedUntil: lockout ? Date.now() + LOCKOUT_TIME : null,
    });

    const verificationCode = generateVerificationCode();
    const hashedCode = await bcrypt.hash(verificationCode, 10);
    user.resetPasswordCode = hashedCode;
    user.resetPasswordExpires = Date.now() + 600000;
    await user.save();

    const mailOptions = {
      from: EMAIL_USER,
      to: user.email,
      subject: "Password Reset - Vedic Indian Vivah",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
          <div style="background: linear-gradient(to right, #b45309, #dc2626); padding: 25px; text-align: center;">
            <h1 style="color: white; margin: 0;">Password Reset</h1>
          </div>
          <div style="padding: 30px;">
            <p>Hello ${user.name},</p>
            <p>Your verification code is:</p>
            <div style="text-align: center; margin: 30px 0;">
              <span style="font-size: 32px; font-weight: bold; color: #dc2626; background: #fef3c7; padding: 15px 20px; border-radius: 8px; display: inline-block; letter-spacing: 8px;">
                ${verificationCode}
              </span>
            </div>
            <p><strong>Expires in 10 minutes</strong></p>
          </div>
        </div>
      `,
    };

    await transport.sendMail(mailOptions);
    res.json({ success: true, message: "Verification code sent", email: user.email });
  } catch (error) {
    console.error("❌ Forgot password error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// 8. Reset Password
// 8. Reset Password - FIXED VERSION
export const resetPassword = async (req, res) => {
  const { email, verificationCode, newPassword } = req.body;
  
  console.log("🔧 Reset Password Request Received:");
  console.log("Email:", email);
  console.log("Verification Code:", verificationCode);
  console.log("New Password:", newPassword);
  
  if (!email || !verificationCode || !newPassword) {
    console.error("❌ Missing fields");
    return res.status(400).json({
      success: false,
      message: "Email, verification code, and new password are required",
    });
  }

  if (newPassword.length < 6) {
    console.error("❌ Password too short");
    return res.status(400).json({
      success: false,
      message: "Password must be at least 6 characters long",
    });
  }

  try {
    // Find user by email (case-insensitive)
    const normalizedEmail = email.toLowerCase().trim();
    
    console.log("🔍 Looking for user with email:", normalizedEmail);
    
    const user = await User.findOne({
      email: normalizedEmail,
      resetPasswordExpires: { $gt: Date.now() }, // Check expiration
    }).select("+resetPasswordCode");

    console.log("🔍 User found:", user ? "Yes" : "No");
    
    if (!user) {
      console.error("❌ User not found or OTP expired");
      return res.status(400).json({
        success: false,
        message: "Verification code expired or invalid. Please request a new code.",
      });
    }

    console.log("🔍 User's hashed OTP:", user.resetPasswordCode ? "Present" : "Missing");
    console.log("🔍 OTP expires at:", user.resetPasswordExpires);
    console.log("🔍 Current time:", Date.now());

    if (!user.resetPasswordCode) {
      console.error("❌ No OTP found for user");
      return res.status(400).json({
        success: false,
        message: "Verification code expired or invalid",
      });
    }

    // Compare the plain text OTP with hashed OTP
    const isCodeValid = await bcrypt.compare(verificationCode.trim(), user.resetPasswordCode);
    
    console.log("🔐 OTP Comparison Result:", isCodeValid);
    console.log("📧 Input OTP:", verificationCode);
    console.log("🔑 Stored Hash:", user.resetPasswordCode);

    if (!isCodeValid) {
      console.error("❌ Invalid OTP provided");
      return res.status(400).json({
        success: false,
        message: "Invalid verification code. Please check and try again.",
      });
    }

    console.log("✅ OTP verified successfully");

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    // Update user
    user.password = hashedPassword;
    user.resetPasswordCode = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    console.log("✅ Password reset successful for:", user.email);

    // Send confirmation email (optional)
    try {
      const mailOptions = {
        from: EMAIL_USER,
        to: user.email,
        subject: "Password Reset Successful - Vedic Indian Vivah",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 10px; overflow: hidden;">
            <div style="background: linear-gradient(to right, #059669, #10b981); padding: 25px; text-align: center;">
              <h1 style="color: white; margin: 0;">Password Reset Successful</h1>
            </div>
            <div style="padding: 30px;">
              <p>Hello ${user.name},</p>
              <p>Your password has been <strong>successfully reset</strong>.</p>
              <div style="background: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
                <h3 style="color: #047857; margin-top: 0;">Security Information:</h3>
                <p>Password reset completed at: ${new Date().toLocaleString()}</p>
              </div>
              <p>If you did not request this password reset, please contact our support team immediately.</p>
            </div>
          </div>
        `,
      };
      
      await transport.sendMail(mailOptions);
      console.log("✅ Confirmation email sent to:", user.email);
    } catch (emailError) {
      console.error("⚠️ Failed to send confirmation email:", emailError);
      // Continue even if email fails
    }

    res.json({ 
      success: true, 
      message: "Password reset successfully. You can now login with your new password." 
    });
  } catch (error) {
    console.error("❌ Reset password error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error during password reset",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 9. Get User Info - Dynamic formData + essential static fields
export const getUserInfo = async (req, res) => {
  const userId = req.user?.userId || req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, message: "Authentication required" });
  }

  try {
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Convert formData to object (dynamic data)
    let formDataObject = {};
    if (user.formData) {
      try {
        if (user.formData instanceof Map) {
          formDataObject = Object.fromEntries(user.formData);
        } else if (user.formData.entries) {
          formDataObject = Object.fromEntries(user.formData.entries());
        } else {
          formDataObject = user.formData;
        }
      } catch (error) {
        console.error("Error converting formData:", error);
        formDataObject = {};
      }
    }

    // Combine essential static fields with dynamic formData
    const userResponse = {
      // Essential static fields
      _id: user._id,
      vivId: user.vivId,
      name: user.name,
      email: user.email,
      profileImage: user.profileImage,
      profileImagePublicId: user.profileImagePublicId,
      documents: user.documents,
      documentPublicIds: user.documentPublicIds,
      isVerified: user.isVerified,
      profileCompleted: user.profileCompleted,
      role: user.role,
      lastLogin: user.lastLogin,
      lastLogout: user.lastLogout,
      
      // Essential top-level fields
      mobileNo: user.mobileNo,
      gender: user.gender,
      dateOfBirth: user.dateOfBirth,
      maritalStatus: user.maritalStatus,
      religion: user.religion,
      city: user.city,
      state: user.state,
      country: user.country,
      
      // Dynamic formData fields
      ...formDataObject,
      
      // Virtual fields
      age: user.age,
      isOnline: user.isOnline
    };

    res.json({ 
      success: true, 
      user: userResponse
    });
  } catch (error) {
    console.error("❌ Fetch user info error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// 10. Delete Profile Image
export const deleteProfileImage = async (req, res) => {
  const userId = req.user?.userId;
  if (!userId) {
    return res.status(401).json({ success: false, message: "Authentication required" });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (user.profileImagePublicId) {
      await deleteCloudinaryImage(user.profileImagePublicId);
    }

    user.profileImage = null;
    user.profileImagePublicId = null;
    await user.save();

    res.json({ success: true, message: "Profile image deleted successfully" });
  } catch (error) {
    console.error("❌ Delete profile image error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete profile image",
      error: error.message,
    });
  }
};

// 11. Get All Users for Admin - Hybrid approach
export const getAllUsersForAdmin = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 100, 
      search = "", 
      isVerified, 
      userType,
      lastLogin,
      profileCompleted,
      gender,
      maritalStatus,
      religion,
      sortBy = "createdAt",
      sortOrder = "desc"
    } = req.query;
    
    // Build query object
    const query = {};
    
    // Search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { vivId: { $regex: search, $options: "i" } },
        { mobileNo: { $regex: search, $options: "i" } },
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
      ];
    }
    
    // Filter by verification status
    if (isVerified !== undefined && isVerified !== '') {
      query.isVerified = isVerified === 'true' || isVerified === '1';
    }
    
    // Filter by profile completion
    if (profileCompleted !== undefined && profileCompleted !== '') {
      query.profileCompleted = profileCompleted === 'true' || profileCompleted === '1';
    }

    // Filter by gender
    if (gender && gender !== 'all') {
      query.gender = gender;
    }

    // Filter by marital status
    if (maritalStatus && maritalStatus !== 'all') {
      query.maritalStatus = maritalStatus;
    }

    // Filter by religion
    if (religion && religion !== 'all') {
      query.religion = { $regex: religion, $options: "i" };
    }

    // Filter by active status (last login within 30 minutes)
    if (lastLogin === 'active') {
      query.lastLogin = { $gte: new Date(Date.now() - 30 * 60 * 1000) };
      query.lastLogout = { $or: [{ $lt: '$lastLogin' }, { $exists: false }] };
    }

    console.log('🔍 User query parameters:', { 
      query, 
      page, 
      limit, 
      search,
      isVerified,
      lastLogin,
      profileCompleted,
      gender,
      maritalStatus,
      religion
    });

    // Build sort object
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const users = await User.find(query)
      .select("-password -verificationCode -verificationCodeExpires -resetPasswordCode -resetPasswordExpires")
      .sort(sortOptions)
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    const totalUsers = await User.countDocuments(query);

    // Process users to include both static and dynamic data
    const processedUsers = users.map(user => {
      // Convert formData to object
      let formDataObject = {};
      if (user.formData) {
        try {
          if (user.formData instanceof Map) {
            formDataObject = Object.fromEntries(user.formData);
          } else if (user.formData.entries) {
            formDataObject = Object.fromEntries(user.formData.entries());
          } else {
            formDataObject = user.formData;
          }
        } catch (error) {
          console.error("Error converting formData:", error);
          formDataObject = {};
        }
      }

      // Return hybrid data
      return {
        // Static fields
        _id: user._id,
        vivId: user.vivId,
        name: user.name,
        email: user.email,
        profileImage: user.profileImage,
        isVerified: user.isVerified,
        profileCompleted: user.profileCompleted,
        role: user.role,
        lastLogin: user.lastLogin,
        lastLogout: user.lastLogout,
        createdAt: user.createdAt,
        
        // Essential top-level fields
        mobileNo: user.mobileNo,
        gender: user.gender,
        dateOfBirth: user.dateOfBirth,
        maritalStatus: user.maritalStatus,
        religion: user.religion,
        city: user.city,
        state: user.state,
        country: user.country,
        
        // Dynamic formData
        ...formDataObject,
        
        // Virtual fields
        age: user.age,
        isOnline: user.isOnline
      };
    });

    console.log(`✅ Found ${users.length} users out of ${totalUsers} total`);

    res.status(200).json({
      success: true,
      message: "Users fetched successfully",
      data: {
        users: processedUsers,
        pagination: {
          total: totalUsers,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(totalUsers / parseInt(limit)),
        },
        filters: {
          search,
          isVerified,
          lastLogin,
          profileCompleted,
          gender,
          maritalStatus,
          religion
        }
      },
    });
  } catch (error) {
    console.error("❌ Error fetching users for admin:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching users",
      error: error.message,
    });
  }
};

// 12. Get User Statistics for Dashboard
export const getUserStatistics = async (req, res) => {
  try {
    const [
      totalUsers,
      verifiedUsers,
      unverifiedUsers,
      activeUsers,
      newToday,
      usersWithCompleteProfile,
      usersWithIncompleteProfile,
      // Gender statistics
      maleUsers,
      femaleUsers,
      // Marital status statistics
      neverMarriedUsers,
      divorcedUsers,
      widowedUsers,
      // New this week
      newThisWeek
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isVerified: true }),
      User.countDocuments({ isVerified: false }),
      User.countDocuments({
        lastLogin: { $gte: new Date(Date.now() - 30 * 60 * 1000) },
        lastLogout: { $or: [{ $lt: '$lastLogin' }, { $exists: false }] }
      }),
      User.countDocuments({
        createdAt: { 
          $gte: new Date(new Date().setHours(0, 0, 0, 0)) 
        }
      }),
      User.countDocuments({ profileCompleted: true }),
      User.countDocuments({ profileCompleted: false }),
      User.countDocuments({ gender: "Male" }),
      User.countDocuments({ gender: "Female" }),
      User.countDocuments({ maritalStatus: "Never Married" }),
      User.countDocuments({ maritalStatus: "Divorced" }),
      User.countDocuments({ maritalStatus: "Widowed" }),
      User.countDocuments({
        createdAt: { 
          $gte: new Date(new Date().setDate(new Date().getDate() - 7)) 
        }
      })
    ]);

    const userStats = {
      totalUsers,
      verifiedUsers,
      unverifiedUsers,
      activeUsers,
      newToday,
      newThisWeek,
      usersWithCompleteProfile,
      usersWithIncompleteProfile,
      verificationRate: totalUsers > 0 ? Math.round((verifiedUsers / totalUsers) * 100) : 0,
      completionRate: totalUsers > 0 ? Math.round((usersWithCompleteProfile / totalUsers) * 100) : 0,
      activeRate: totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0,
      
      // Gender statistics
      genderStats: {
        male: maleUsers,
        female: femaleUsers,
        other: totalUsers - maleUsers - femaleUsers
      },
      
      // Marital status statistics
      maritalStats: {
        neverMarried: neverMarriedUsers,
        divorced: divorcedUsers,
        widowed: widowedUsers,
        awaitingDivorce: totalUsers - neverMarriedUsers - divorcedUsers - widowedUsers
      }
    };

    console.log('📊 User statistics calculated:', userStats);

    res.status(200).json({
      success: true,
      data: userStats
    });
  } catch (error) {
    console.error("❌ Error fetching user statistics:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching user statistics",
      error: error.message,
    });
  }
};

// 13. Bulk Verify Users
export const bulkVerifyUsers = async (req, res) => {
  try {
    const { userIds } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "User IDs array is required"
      });
    }

    const result = await User.updateMany(
      { _id: { $in: userIds } },
      { 
        $set: { 
          isVerified: true,
          verifiedAt: new Date()
        } 
      }
    );

    console.log(`✅ Bulk verified ${result.modifiedCount} users`);

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} users verified successfully`,
      data: {
        verifiedCount: result.modifiedCount
      }
    });
  } catch (error) {
    console.error("❌ Error in bulk verify users:", error);
    res.status(500).json({
      success: false,
      message: "Server error while verifying users",
      error: error.message,
    });
  }
};


// 14. Get Partners - Fixed and Enhanced
// Enhanced getPartners controller with comprehensive filtering
// controllers/userController.js - Fixed getPartners function

export const getPartners = async (req, res) => {
  try {
    console.log("🔍 Fetching partners with filters...");
    console.log("Query Parameters:", req.query);

    const {
      page = 1,
      limit = 12,
      search = "",
      diet,
      gender,
      religion,
      maritalStatus,
      motherTongue,
      caste,
      occupation,
      complextion,
      hobbies,
      zodiacSign,
      zodiacsign,
      gotra,
      state,
      city,
      educationLevel,
      educationlevel,
      fieldofstudy,
      citizenshipStatus,
      citizenshipstatus,
      userType,
      country,
      languages,
      height,
      indianReligious,
      ageMin,
      ageMax,
      heightMin,
      heightMax,
    } = req.query;

    const currentUserId = req.user?.userId || req.user?.id || req.user?._id;

    if (!currentUserId) {
      console.warn("⚠️ No authenticated user found");
      return res.status(401).json({
        success: false,
        message: "Authentication required to view partners",
      });
    }

    console.log("✅ Current User ID:", currentUserId);

    const filter = {
      profileCompleted: true,
      isVerified: true,
      _id: { $ne: currentUserId },
    };

    const andConditions = [];

    // Enhanced search to include all possible fields
    if (search && search.trim()) {
      andConditions.push({
        $or: [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
          { vivId: { $regex: search, $options: "i" } },
          { "formData.firstName": { $regex: search, $options: "i" } },
          { "formData.lastName": { $regex: search, $options: "i" } },
          { "formData.middleName": { $regex: search, $options: "i" } },
          { "formData.occupation": { $regex: search, $options: "i" } },
          { "formData.occupationDetails": { $regex: search, $options: "i" } },
          { "formData.country": { $regex: search, $options: "i" } },
          { "formData.state": { $regex: search, $options: "i" } },
          { "formData.city": { $regex: search, $options: "i" } },
          { "formData.aboutMe": { $regex: search, $options: "i" } },
          { "formData.familyDetails": { $regex: search, $options: "i" } },
        ],
      });
    }

    const addFilterCondition = (fieldName, queryValue, alternativeFields = []) => {
      if (!queryValue) return;
      const values = Array.isArray(queryValue) ? queryValue : [queryValue];
      const cleaned = values.filter((value) => value !== undefined && value !== "");
      
      if (cleaned.length > 0) {
        // Create an array of field checks
        const fieldChecks = [];
        
        // Add primary field name
        fieldChecks.push({ [`formData.${fieldName}`]: { $in: cleaned } });
        
        // Add alternative fields if provided
        alternativeFields.forEach(altField => {
          fieldChecks.push({ [`formData.${altField}`]: { $in: cleaned } });
        });
        
        // Also check root level fields
        fieldChecks.push({ [fieldName]: { $in: cleaned } });
        
        // If we have multiple fields to check, use $or
        if (fieldChecks.length > 1) {
          andConditions.push({ $or: fieldChecks });
        } else {
          andConditions.push(fieldChecks[0]);
        }
      }
    };

    const addNumericFilter = (fieldNames, minValue, maxValue) => {
      const numericQuery = {};
      if (Number.isFinite(minValue)) numericQuery.$gte = Number(minValue);
      if (Number.isFinite(maxValue)) numericQuery.$lte = Number(maxValue);
      if (Object.keys(numericQuery).length === 0) return;
      
      const fieldChecks = fieldNames.map((field) => ({
        [`formData.${field}`]: numericQuery,
      }));
      
      andConditions.push({ $or: fieldChecks });
    };

    // Apply all filters
    addFilterCondition("diet", diet);
    addFilterCondition("gender", gender);
    addFilterCondition("religion", religion);
    addFilterCondition("maritalStatus", maritalStatus);
    addFilterCondition("motherTongue", motherTongue, ["mothertongue"]);
    addFilterCondition("caste", caste);
    addFilterCondition("occupation", occupation);
    addFilterCondition("complextion", complextion);
    addFilterCondition("hobbies", hobbies);
    addFilterCondition("zodiacsign", zodiacSign || zodiacsign, ["zodiacSign"]);
    addFilterCondition("gotra", gotra);
    addFilterCondition("state", state);
    addFilterCondition("city", city);
    
    const educationLevelValue = educationLevel || educationlevel;
    if (educationLevelValue) {
      addFilterCondition("educationlevel", educationLevelValue, ["educationLevel"]);
    }
    
    if (fieldofstudy) {
      addFilterCondition("fieldofstudy", fieldofstudy, ["fieldOfStudy"]);
    }
    
    const citizenshipValue = citizenshipStatus || citizenshipstatus;
    if (citizenshipValue) {
      addFilterCondition("citizenshipstatus", citizenshipValue, ["citizenshipStatus"]);
    }
    
    addFilterCondition("userType", userType);
    addFilterCondition("country", country);
    addFilterCondition("indianReligious", indianReligious);
    
    // Handle height as select filter
    if (height) {
      addFilterCondition("height", height, ["heightInches", "heightCm", "heightFeet"]);
    }
    
    // Handle languages - special case for array fields
    if (languages) {
      const langValues = Array.isArray(languages) ? languages : [languages];
      const cleanedLangs = langValues.filter((value) => value !== undefined && value !== "");
      if (cleanedLangs.length > 0) {
        andConditions.push({
          $or: [
            { "formData.languages": { $in: cleanedLangs } },
            { "formData.languages": { $elemMatch: { $in: cleanedLangs } } }
          ]
        });
      }
    }

    // Handle numeric ranges
    const parsedAgeMin = ageMin ? parseInt(ageMin, 10) : null;
    const parsedAgeMax = ageMax ? parseInt(ageMax, 10) : null;
    if (!isNaN(parsedAgeMin) || !isNaN(parsedAgeMax)) {
      addNumericFilter(["age"], parsedAgeMin, parsedAgeMax);
    }

    const parsedHeightMin = heightMin ? parseInt(heightMin, 10) : null;
    const parsedHeightMax = heightMax ? parseInt(heightMax, 10) : null;
    if (!isNaN(parsedHeightMin) || !isNaN(parsedHeightMax)) {
      addNumericFilter(
        ["heightInches", "height", "heightCm", "heightFeet"],
        parsedHeightMin,
        parsedHeightMax
      );
    }

    if (andConditions.length > 0) {
      filter.$and = andConditions;
    }

    console.log("🔍 MongoDB filter:", JSON.stringify(filter, null, 2));

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    // Fetch users with all necessary fields
    let partners = await User.find(filter)
      .select("name email vivId profileImage profileCompleted isVerified createdAt formData dateOfBirth age")
      .skip(skip)
      .limit(limitNum)
      .sort({ createdAt: -1 })
      .lean();

    console.log(`✅ Found ${partners.length} partners from database`);

    // Helper functions
    const computeAge = (dob) => {
      if (!dob) return null;
      const birthDate = new Date(dob);
      if (isNaN(birthDate.getTime())) return null;
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age;
    };

    const parseHeightValue = (value) => {
      if (value === null || value === undefined) return null;
      if (typeof value === "number") return value;
      if (typeof value === "string") {
        const numeric = parseFloat(value);
        if (!isNaN(numeric)) return numeric;
        const match = value.match(/(\d+)\s*'?\s*(\d+)?/);
        if (match) {
          const feet = parseInt(match[1], 10);
          const inches = match[2] ? parseInt(match[2], 10) : 0;
          if (!isNaN(feet) && !isNaN(inches)) {
            return feet * 12 + inches;
          }
        }
      }
      return null;
    };

    // Transform partners
    let transformedPartners = partners.map((partner) => {
      try {
        let formData = {};
        if (partner.formData) {
          if (partner.formData instanceof Map) {
            formData = Object.fromEntries(partner.formData);
          } else if (typeof partner.formData === "object") {
            formData = partner.formData;
          }
        }

        // Mask VIV ID
        const maskedVivId = partner.vivId
          ? partner.vivId.length > 3
            ? `${partner.vivId.slice(0, -3)}***`
            : partner.vivId
          : "N/A";

        // Calculate age
        const derivedAge = formData.age || partner.age || computeAge(formData.dateOfBirth || partner.dateOfBirth);

        // Calculate height
        const derivedHeight = parseHeightValue(formData.heightInches) ||
                              parseHeightValue(formData.height) ||
                              parseHeightValue(formData.heightCm) ||
                              parseHeightValue(formData.heightFeet);

        return {
          _id: partner._id,
          vivId: maskedVivId,
          name: partner.name || "Anonymous",
          email: partner.email,
          profileImage: partner.profileImage || null,
          hasProfileImage: !!partner.profileImage,
          profileCompleted: partner.profileCompleted,
          isVerified: partner.isVerified,
          
          // Extract all relevant fields from formData with fallbacks
          firstName: formData.firstName || "",
          lastName: formData.lastName || "",
          middleName: formData.middleName || "",
          gender: formData.gender || "",
          diet: formData.diet || "",
          maritalStatus: formData.maritalStatus || "",
          religion: formData.religion || "",
          caste: formData.caste || "",
          complextion: formData.complextion || "",
          occupation: formData.occupation || "",
          occupationDetails: formData.occupationDetails || "",
          country: formData.country || "",
          state: formData.state || "",
          city: formData.city || "",
          motherTongue: formData.motherTongue || formData.mothertongue || "",
          zodiacSign: formData.zodiacSign || formData.zodiacsign || "",
          gotra: formData.gotra || "",
          educationLevel: formData.educationLevel || formData.educationlevel || "",
          fieldofstudy: formData.fieldofstudy || formData.fieldOfStudy || "",
          citizenshipStatus: formData.citizenshipStatus || formData.citizenshipstatus || "",
          userType: formData.userType || "",
          indianReligious: formData.indianReligious || "",
          hobbies: Array.isArray(formData.hobbies) ? formData.hobbies : 
                  (typeof formData.hobbies === 'string' ? formData.hobbies.split(',') : []),
          languages: Array.isArray(formData.languages) ? formData.languages : 
                    (typeof formData.languages === 'string' ? formData.languages.split(',') : []),
          aboutMe: formData.aboutMe || "",
          familyDetails: formData.familyDetails || "",
          age: derivedAge,
          heightInches: derivedHeight,
          formData: formData, // Include full formData for debugging
        };
      } catch (error) {
        console.error("❌ Error transforming partner:", partner._id, error);
        return null;
      }
    }).filter((p) => p !== null);

    // Apply client-side numeric filtering (as backup)
    transformedPartners = transformedPartners.filter((partner) => {
      const ageOk = !parsedAgeMin || !parsedAgeMax || 
                   (partner.age >= parsedAgeMin && partner.age <= parsedAgeMax);
      const heightOk = !parsedHeightMin || !parsedHeightMax || 
                      (partner.heightInches >= parsedHeightMin && partner.heightInches <= parsedHeightMax);
      return ageOk && heightOk;
    });

    const total = await User.countDocuments(filter);
    const totalPages = Math.ceil(total / limitNum);

    console.log(
      `📊 Final response: ${transformedPartners.length} partners, page ${pageNum}/${totalPages}`
    );

    res.json({
      success: true,
      data: {
        partners: transformedPartners,
        pagination: {
          page: pageNum,
          totalPages,
          total,
          limit: limitNum,
          showing: transformedPartners.length,
        },
      },
    });
  } catch (error) {
    console.error("❌ Fetch partners error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching partners",
      error: error.message,
    });
  }
};

// 14.1. Get Partners WITHOUT Login - Public Access
export const getPartnersWithoutLogin = async (req, res) => {
  try {
    console.log("🔓 PUBLIC Partners WITHOUT LOGIN request");
    console.log("Query Parameters:", req.query);

    const {
      page = 1,
      limit = 20,
      search = "",
      diet,
      gender,
      religion,
      maritalStatus,
      motherTongue,
      caste,
      occupation,
      complextion,
      hobbies,
    } = req.query;

    console.log("✅ NO authentication required - Public access");

    const query = {
      profileCompleted: true,
      isVerified: true,
    };

    const andConditions = [];

    if (search && search.trim()) {
      andConditions.push({
        $or: [
          { name: { $regex: search, $options: "i" } },
          { vivId: { $regex: search, $options: "i" } },
          { "formData.firstName": { $regex: search, $options: "i" } },
          { "formData.lastName": { $regex: search, $options: "i" } },
          { "formData.occupation": { $regex: search, $options: "i" } },
          { "formData.city": { $regex: search, $options: "i" } },
        ],
      });
    }

    const addFilterCondition = (fieldName, queryValue) => {
      if (!queryValue) return;
      const values = Array.isArray(queryValue) ? queryValue : [queryValue];
      const cleaned = values.filter((value) => value !== undefined && value !== "");
      if (cleaned.length > 0) {
        const orConditions = [
          { [`formData.${fieldName}`]: { $in: cleaned } },
          { [fieldName]: { $in: cleaned } }
        ];
        andConditions.push({ $or: orConditions });
      }
    };

    // Add filters
    addFilterCondition("diet", diet);
    addFilterCondition("gender", gender);
    addFilterCondition("religion", religion);
    addFilterCondition("maritalStatus", maritalStatus);
    addFilterCondition("motherTongue", motherTongue);
    addFilterCondition("caste", caste);
    addFilterCondition("occupation", occupation);
    addFilterCondition("complextion", complextion);
    
    // Handle hobbies array
    if (hobbies) {
      const hobbyValues = Array.isArray(hobbies) ? hobbies : [hobbies];
      const cleanedHobbies = hobbyValues.filter((value) => value !== undefined && value !== "");
      if (cleanedHobbies.length > 0) {
        andConditions.push({
          $or: [
            { "formData.hobbies": { $in: cleanedHobbies } },
            { "formData.hobbies": { $elemMatch: { $in: cleanedHobbies } } },
            { hobbies: { $in: cleanedHobbies } }
          ]
        });
      }
    }

    if (andConditions.length > 0) {
      query.$and = andConditions;
    }

    console.log("🔍 MongoDB PUBLIC filter:", JSON.stringify(query, null, 2));

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    // Fetch with ALL necessary fields for public view
    let partners = await User.find(query)
      .select("name vivId profileImage profileCompleted isVerified createdAt updatedAt formData gender religion maritalStatus motherTongue caste occupation complextion hobbies country state city age")
      .skip(skip)
      .limit(limitNum)
      .sort({ createdAt: -1 })
      .lean();

    console.log(`✅ Found ${partners.length} PUBLIC partners (no login)`);

    // Transform for PUBLIC view
    const publicPartners = partners.map((partner) => {
      try {
        // Extract formData
        let formData = {};
        if (partner.formData) {
          if (partner.formData instanceof Map) {
            formData = Object.fromEntries(partner.formData);
          } else if (typeof partner.formData === "object") {
            formData = partner.formData;
          }
        }

        // Mask VIV ID for public view
        const maskedVivId = partner.vivId
          ? partner.vivId.length > 6
            ? `${partner.vivId.slice(0, 3)}***${partner.vivId.slice(-3)}`
            : "***" + partner.vivId.slice(-3)
          : "N/A";

        // Helper to get field value with priority: formData > root > default
        const getField = (fieldName, defaultValue = "") => {
          if (formData[fieldName] !== undefined && formData[fieldName] !== "") {
            return formData[fieldName];
          }
          if (partner[fieldName] !== undefined && partner[fieldName] !== "") {
            return partner[fieldName];
          }
          return defaultValue;
        };

        // Get array field
        const getArrayField = (fieldName) => {
          const formValue = formData[fieldName];
          const rootValue = partner[fieldName];
          
          if (Array.isArray(formValue) && formValue.length > 0) return formValue;
          if (Array.isArray(rootValue) && rootValue.length > 0) return rootValue;
          
          if (typeof formValue === 'string') return formValue.split(',').map(s => s.trim());
          if (typeof rootValue === 'string') return rootValue.split(',').map(s => s.trim());
          
          return [];
        };

        return {
          _id: partner._id,
          vivId: maskedVivId,
          name: partner.name || getField("firstName", "Anonymous") + " " + getField("lastName", ""),
          email: null, // Hide email for public
          
          // Basic info with fallbacks
          gender: getField("gender"),
          religion: getField("religion"),
          maritalStatus: getField("maritalStatus"),
          motherTongue: getField("motherTongue"),
          caste: getField("caste"),
          occupation: getField("occupation"),
          complextion: getField("complextion"),
          hobbies: getArrayField("hobbies"),
          country: getField("country"),
          state: getField("state"),
          city: getField("city"),
          
          // Profile image
          hasProfileImage: !!partner.profileImage,
          profileImage: partner.profileImage || "/placeholder.jpg",
          profileCompleted: partner.profileCompleted,
          isVerified: partner.isVerified,
          
          // Additional fields that might be needed
          age: partner.age || null,
          createdAt: partner.createdAt,
          
          // Flags
          isPublic: true,
          isPremium: partner.isPremium || false,
          currentPlan: partner.currentPlan || null,
        };
      } catch (error) {
        console.error("❌ Error transforming public partner:", error);
        return null;
      }
    }).filter((p) => p !== null);

    const total = await User.countDocuments(query);
    const totalPages = Math.ceil(total / limitNum);

    console.log(`📊 PUBLIC (no login) response: ${publicPartners.length} partners`);

    // Debug info
    if (publicPartners.length > 0) {
      console.log("🔍 First partner sample:", {
        id: publicPartners[0]._id,
        vivId: publicPartners[0].vivId,
        name: publicPartners[0].name,
        gender: publicPartners[0].gender,
        occupation: publicPartners[0].occupation,
        hasProfileImage: publicPartners[0].hasProfileImage,
      });
    }

    res.json({
      success: true,
      data: {
        partners: publicPartners,
        pagination: {
          page: pageNum,
          totalPages,
          total,
          limit: limitNum,
          showing: publicPartners.length,
        },
        message: "Public partners data - No login required",
        debug: {
          query: query,
          totalMatching: total,
          showing: publicPartners.length
        }
      },
    });
  } catch (error) {
    console.error("❌ Fetch PUBLIC partners (no login) error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching public partners",
      error: error.message,
    });
  }
};

const REQUIRED_FILTER_TEMPLATES = {
  diet: {
    label: "Diet",
    options: ["Vegetarian", "Eggetarian", "Non-Vegetarian", "Vegan"],
  },
  gender: { label: "Gender", options: ["Male", "Female", "Other"] },
  religion: {
    label: "Religion",
    options: ["Hindu", "Jain", "Christian", "Muslim", "Sikh", "Buddhist"],
  },
  maritalStatus: {
    label: "Marital Status",
    options: ["Never Married", "Divorced", "Widowed", "Awaiting Divorce"],
  },
  motherTongue: {
    label: "Mother Tongue",
    options: [
      "Hindi",
      "English",
      "Bengali",
      "Tamil",
      "Telugu",
      "Marathi",
      "Gujarati",
      "Punjabi",
      "Malayalam",
      "Kannada",
      "Odia",
      "Urdu",
    ],
  },
  caste: {
    label: "Caste",
    options: ["Brahmin", "Kshatriya", "Vaishya", "Shudra", "General", "OBC"],
  },
  occupation: {
    label: "Occupation",
    options: [
      "Software Engineer",
      "Teacher",
      "Doctor",
      "Business",
      "Government Service",
      "Self-employed",
    ],
  },
  complextion: {
    label: "Complexion",
    options: ["Fair", "Wheatish", "Medium", "Dark"],
  },
  hobbies: {
    label: "Hobbies / Interests",
    options: [
      "Reading",
      "Sports",
      "Music",
      "Dance",
      "Travel",
      "Cooking",
      "Photography",
    ],
  },
  zodiacSign: {
    label: "Zodiac Sign",
    options: [
      "Aries",
      "Taurus",
      "Gemini",
      "Cancer",
      "Leo",
      "Virgo",
      "Libra",
      "Scorpio",
      "Sagittarius",
      "Capricorn",
      "Aquarius",
      "Pisces",
    ],
  },
  gotra: { label: "Gotra", options: [] },
  state: { label: "State", options: [] },
  city: { label: "City", options: [] },
  educationLevel: {
    label: "Education Level",
    options: ["High School", "Graduate", "Post Graduate", "Doctorate"],
  },
  citizenshipStatus: {
    label: "Citizenship Status",
    options: ["Indian", "NRI", "OCI", "PIO", "Other"],
  },
};

export const getPartnerFilterOptions = async (req, res) => {
  try {
    const filterableTypes = ["select", "radio", "checkbox", "datalist"];

    const activeFields = await FormField.find({
      isActive: true,
      type: { $in: filterableTypes },
    })
      .sort({ sectionOrder: 1, fieldOrder: 1 })
      .select("name label type options isMultiple section sectionTitle");

    const optionBasedFilters = [];
    const requiresDistinct = [];

    activeFields.forEach((field) => {
      if (!field.name) return;

      const baseConfig = {
        key: field.name,
        label: field.label,
        type: field.type,
        section: field.section,
        sectionTitle: field.sectionTitle,
        multiSelect: field.isMultiple || field.type === "checkbox",
      };

      const sanitizedOptions =
        field.options
          ?.map((option) => {
            if (!option || option.label === undefined || option.value === undefined) {
              return null;
            }
            const label = option.label.toString().trim();
            const value = option.value.toString().trim();
            if (!label || !value || option.isActive === false) {
              return null;
            }
            return { label, value };
          })
          .filter((opt) => opt !== null) || [];

      if (sanitizedOptions.length > 0) {
        optionBasedFilters.push({
          ...baseConfig,
          options: sanitizedOptions,
        });
      } else {
        requiresDistinct.push(baseConfig);
      }
    });

    const baseUserFilter = { profileCompleted: true, isVerified: true };

    const distinctResults = await Promise.all(
      requiresDistinct.map(async (config) => {
        const values = await User.distinct(`formData.${config.key}`, baseUserFilter);
        if (!values || values.length === 0) {
          return null;
        }

        const flattened = values.flatMap((value) =>
          Array.isArray(value) ? value : [value]
        );

        const cleaned = [
          ...new Set(
            flattened
              .map((value) =>
                typeof value === "string" ? value.trim() : value?.toString()?.trim()
              )
              .filter((value) => value !== null && value !== undefined && value !== "")
          ),
        ];

        if (cleaned.length === 0) {
          return null;
        }

        return {
          ...config,
          options: cleaned.map((value) => ({ label: value, value })),
        };
      })
    );

    const filtersMap = new Map();

    optionBasedFilters.forEach((filterConfig) => {
      filtersMap.set(filterConfig.key, filterConfig);
    });

    distinctResults
      .filter((entry) => entry !== null)
      .forEach((filterConfig) => {
        filtersMap.set(filterConfig.key, filterConfig);
      });

    Object.entries(REQUIRED_FILTER_TEMPLATES).forEach(
      ([key, templateConfig]) => {
        if (!filtersMap.has(key)) {
          filtersMap.set(key, {
            key,
            label: templateConfig.label,
            type: "select",
            section: "matchmaking",
            sectionTitle: "Matchmaking Filters",
            multiSelect: true,
            options:
              templateConfig.options.length > 0
                ? templateConfig.options.map((value) => ({
                    label: value,
                    value,
                  }))
                : [],
          });
        }
      }
    );

    const filters = Array.from(filtersMap.values()).sort((a, b) =>
      a.label.localeCompare(b.label)
    );

    const ranges = {
      ageRange: { label: "Age Range", min: 18, max: 60 },
      heightRange: { label: "Height Range", min: 48, max: 84 },
    };

    res.json({
      success: true,
      data: {
        filters,
        ranges,
        count: filters.length,
        generatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error("❌ Fetch partner filter options error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load partner filter options",
      error: error.message,
    });
  }
};

// 15. Logout - UPDATED with proper logout tracking
export const logout = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const token = req.headers.authorization?.split(" ")[1] || req.cookies?.jwt;
    
    if (userId) {
      // Deactivate device session
      if (token) {
        await DeviceSession.deactivateByToken(token);
        console.log(`🔄 Device session deactivated for user ${userId}`);
      }
      
      // Update user's logout time in database
      const user = await User.findById(userId);
      if (user) {
        await user.updateLogoutTime();
        console.log(`✅ User ${user.vivId} logout time updated in database`);
      }
      
      // Track user logout in session tracking
      trackUserLogout(userId);
      console.log(`✅ User ${userId} logged out successfully`);
    }

    res.json({
      success: true,
      message: "Logout successful!"
    });
  } catch (error) {
    console.error("❌ Logout error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error during logout" 
    });
  }
};

// 16. Activity Tracking Middleware - UPDATED
export const trackActivity = async (req, res, next) => {
  try {
    const userId = req.user?.userId;
    
    if (userId) {
      // Update last active timestamp in session
      trackUserActivity(userId);
      
      // Update lastLogin in database periodically (every 10 minutes)
      const user = await User.findById(userId);
      if (user) {
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        if (!user.lastLogin || user.lastLogin < tenMinutesAgo) {
          user.lastLogin = new Date();
          await user.save({ validateBeforeSave: false });
        }
      }
    }
    
    next();
  } catch (error) {
    console.error("❌ Activity tracking error:", error);
    next();
  }
};

// 17. Delete User Account
// 17. Delete User Account - Updated for your middleware
export const deleteAccount = async (req, res) => {
  try {
    console.log("🗑️ Delete account request received");
    
    // Your middleware attaches user to req.user
    const userId = req.user?.userId || req.user?._id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Prevent admin accounts from being deleted via this route
    if (req.user?.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: "Admin accounts cannot be deleted via this endpoint",
      });
    }

    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    console.log(`🗑️ Deleting account for user: ${user.vivId} (${user.email})`);

    // Optional: Log deletion for audit purposes
    console.log(`📝 Audit: User ${user.vivId} (${user.email}) requested account deletion at ${new Date().toISOString()}`);

    // Delete profile image from Cloudinary if exists
    if (user.profileImagePublicId) {
      try {
        await deleteCloudinaryImage(user.profileImagePublicId);
        console.log("✅ Profile image deleted from Cloudinary");
      } catch (cloudinaryError) {
        console.error("⚠️ Failed to delete profile image from Cloudinary:", cloudinaryError);
        // Continue with deletion even if Cloudinary fails
      }
    }

    // Delete documents from Cloudinary if exist
    if (user.documentPublicIds && user.documentPublicIds.length > 0) {
      try {
        const deletePromises = user.documentPublicIds
          .filter(publicId => publicId && publicId.trim() !== '')
          .map(publicId => deleteCloudinaryImage(publicId));
        
        await Promise.allSettled(deletePromises);
        console.log(`✅ ${user.documentPublicIds.length} document(s) deleted from Cloudinary`);
      } catch (cloudinaryError) {
        console.error("⚠️ Failed to delete documents from Cloudinary:", cloudinaryError);
        // Continue with deletion even if Cloudinary fails
      }
    }

    // Track user logout before deletion
    try {
      if (userId) {
        trackUserLogout(userId);
        console.log("✅ User logout tracked");
      }
    } catch (trackingError) {
      console.error("⚠️ Failed to track user logout:", trackingError);
      // Continue with deletion
    }

    // Delete the user from database
    await User.findByIdAndDelete(userId);
    
    console.log(`✅ User ${user.vivId} account deleted successfully`);

    // Send confirmation email (optional)
    try {
      const mailOptions = {
        from: EMAIL_USER,
        to: user.email,
        subject: "Account Deleted - Vedic Indian Vivah",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 10px; overflow: hidden;">
            <div style="background: #fef2f2; padding: 20px; text-align: center; border-bottom: 1px solid #fecaca;">
              <h1 style="color: #dc2626; margin: 0;">Account Deleted</h1>
            </div>
            <div style="padding: 25px;">
              <h2 style="color: #374151;">Hello ${user.name},</h2>
              <p>This email confirms that your account has been <strong>permanently deleted</strong> from Vedic Indian Vivah.</p>
              
              <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #d97706;">
                <h3 style="color: #92400e; margin-top: 0;">Account Details (Deleted):</h3>
                <p style="margin: 5px 0;"><strong>Name:</strong> ${user.name}</p>
                <p style="margin: 5px 0;"><strong>VIV ID:</strong> ${user.vivId}</p>
                <p style="margin: 5px 0;"><strong>Email:</strong> ${user.email}</p>
                <p style="margin: 5px 0;"><strong>Deletion Date:</strong> ${new Date().toLocaleDateString()}</p>
              </div>
              
              <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0369a1;">
                <h3 style="color: #0369a1; margin-top: 0;">What this means:</h3>
                <ul style="margin: 10px 0; padding-left: 20px;">
                  <li>All your personal data has been removed from our systems</li>
                  <li>Your profile is no longer visible to other users</li>
                  <li>All matches and connections have been terminated</li>
                  <li>This action cannot be undone</li>
                </ul>
              </div>
              
              <p>If you did not request this deletion or have any concerns, please contact our support team immediately.</p>
              
              <p>We're sorry to see you go. If you ever wish to return, you'll need to create a new account.</p>
              
              <p>Thank you for being part of our community,<br><strong>The Vedic Indian Vivah Team</strong></p>
            </div>
            <div style="background: #fef3c7; padding: 15px; text-align: center; font-size: 12px; color: #78350f;">
              <p>© 2025 Vedic Indian Vivah. All rights reserved.</p>
            </div>
          </div>
        `,
      };
      
      await transport.sendMail(mailOptions);
      console.log(`✅ Account deletion confirmation email sent to ${user.email}`);
    } catch (emailError) {
      console.error("⚠️ Failed to send deletion confirmation email:", emailError);
      // Continue even if email fails
    }

    res.status(200).json({
      success: true,
      message: "Account deleted successfully. All your data has been permanently removed.",
      deletedAt: new Date(),
      vivId: user.vivId, // Return VIV ID for reference
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error("❌ Delete account error:", error);
    
    // More specific error messages
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format",
      });
    }
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Duplicate entry error",
      });
    }
    
    res.status(500).json({
      success: false,
      message: "Failed to delete account. Please try again later.",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// 18========== DEVICE SESSION MANAGEMENT ==========

// Get active device sessions for current user
export const getActiveDeviceSessions = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const activeSessions = await DeviceSession.getActiveSessions(userId);
    
    // Get user's plan to determine device limit
    const user = await User.findById(userId);
    const activePlan = await UserPlan.findOne({
      userVivId: user.vivId,
      payment_status: "COMPLETED",
    })
      .sort({ createdAt: -1 })
      .lean();

    let deviceLimit = 1;
    if (activePlan) {
      const planName = activePlan.plan_name?.toUpperCase();
      if (planName === "FAMILY") {
        deviceLimit = 3;
      }
    }

    const sessions = activeSessions.map((session) => ({
      id: session._id,
      deviceId: session.deviceId,
      deviceInfo: session.deviceInfo,
      loginTime: session.loginTime,
      lastActive: session.lastActive,
      isCurrent: session.token === (req.headers.authorization?.split(" ")[1] || req.cookies?.jwt),
    }));

    res.json({
      success: true,
      data: {
        sessions,
        deviceLimit,
        activeCount: activeSessions.length,
      },
    });
  } catch (error) {
    console.error("Get active device sessions error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch device sessions",
    });
  }
};

// 19 Force logout a specific device session
export const logoutDevice = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { sessionId } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: "Session ID is required",
      });
    }

    // Find and deactivate the session
    const session = await DeviceSession.findOne({
      _id: sessionId,
      userId,
      isActive: true,
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Session not found or already inactive",
      });
    }

    await session.deactivate();

    res.json({
      success: true,
      message: "Device logged out successfully",
    });
  } catch (error) {
    console.error("Logout device error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to logout device",
    });
  }
};


// 1. Create new wedding user (Form submission)
export const createWeddingUser = async (req, res) => {
  try {
    // Require authenticated user
    const authUserId = req.user?.id || req.user?._id;
    if (!authUserId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Get form data from request body
    const userData = req.body;
    
    console.log('=== Creating Wedding User ===');
    console.log('Data received:', userData);

    // Get service names from IDs (if IDs are sent)
    const serviceMap = {
      1: 'Match Making',
      2: 'Pre-Wedding Consultation',
      3: 'Auspicious Date Discovery',
      4: 'Priest Support',
      5: 'Location Services',
      6: 'Event Management',
      7: 'Decoration',
      8: 'Food/Catering',
      9: 'Transportation & Logistics',
      10: 'Marriage Registration'
    };
    
    // Convert IDs to service names if needed
    let selectedServices = userData.selectedServices || [];
    if (selectedServices.length > 0 && typeof selectedServices[0] === 'number') {
      selectedServices = selectedServices.map(id => serviceMap[id]).filter(Boolean);
    }

    // If this user already submitted, return early
    const existingForUser = await WeddingUser.findOne({ userId: authUserId });
    if (existingForUser) {
      return res.status(200).json({
        success: true,
        alreadySubmitted: true,
        message: 'Wedding service form already submitted for this user',
        data: existingForUser,
      });
    }

    // Check if mobile number already exists
    const existingByMobile = await WeddingUser.findOne({ 
      mobileNumber: userData.mobileNumber 
    });

    if (existingByMobile) {
      return res.status(400).json({
        success: false,
        message: 'This mobile number is already registered. Please use a different number.'
      });
    }

    // Check if whatsapp number already exists (if provided)
    if (userData.whatsappNumber && userData.whatsappNumber.trim() !== '') {
      const existingByWhatsapp = await WeddingUser.findOne({ 
        whatsappNumber: userData.whatsappNumber 
      });

      if (existingByWhatsapp) {
        return res.status(400).json({
          success: false,
          message: 'This WhatsApp number is already registered. Please use a different number.'
        });
      }
    }

    // Create user data
    const weddingUserData = {
      userId: authUserId,
      firstName: userData.firstName || '',
      middleName: userData.middleName || '',
      lastName: userData.lastName || '',
      mobileNumber: userData.mobileNumber || '',
      whatsappNumber: userData.whatsappNumber || '',
      userType: userData.userType || 'self',
      gender: userData.gender || 'other',
      motherTongue: userData.motherTongue || '',
      religion: userData.religion || '',
      country: userData.country || '',
      state: userData.state || '',
      city: userData.city || '',
      postalCode: userData.postalCode || '',
      streetAddress: userData.streetAddress || '',
      selectedServices: selectedServices,
      status: 'pending',
      isActive: true
    };

    console.log('Saving user data:', weddingUserData);

    // Create and save user
    const newUser = new WeddingUser(weddingUserData);
    const savedUser = await newUser.save();
    
    console.log('User saved successfully:', savedUser._id);

    res.status(201).json({
      success: true,
      message: 'Wedding service registration successful',
      data: {
        id: savedUser._id,
        firstName: savedUser.firstName,
        lastName: savedUser.lastName,
        mobileNumber: savedUser.mobileNumber,
        whatsappNumber: savedUser.whatsappNumber,
        userType: savedUser.userType,
        selectedServices: savedUser.selectedServices
      }
    });

  } catch (error) {
    console.error('=== ERROR ===');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors
      });
    }

    // Handle duplicate key error
    if (error.code === 11000) {
      // Check which field caused the duplicate error
      if (error.message.includes('mobileNumber')) {
        return res.status(400).json({
          success: false,
          message: 'This mobile number is already registered. Please use a different number.'
        });
      } else if (error.message.includes('whatsappNumber')) {
        return res.status(400).json({
          success: false,
          message: 'This WhatsApp number is already registered. Please use a different number.'
        });
      }
      
      return res.status(400).json({
        success: false,
        message: 'Duplicate entry found. Please check your contact details.'
      });
    }

    // General error
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
};

// 2. Check wedding form status for authenticated user
export const getWeddingFormStatus = async (req, res) => {
  try {
    const authUserId = req.user?.id || req.user?._id;
    if (!authUserId) {
      return res.status(401).json({
      success: false,
        message: 'Authentication required',
    });
  }

    const existing = await WeddingUser.findOne({ userId: authUserId }).lean();
    res.status(200).json({
      success: true,
      completed: !!existing,
      data: existing ? {
        id: existing._id,
        firstName: existing.firstName,
        lastName: existing.lastName,
        mobileNumber: existing.mobileNumber,
      } : null,
    });
  } catch (error) {
    console.error('Error checking wedding form status:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};



// 4. Check if mobile/whatsapp exists (optional API for frontend validation)
export const checkContactExists = async (req, res) => {
  try {
    const { mobileNumber, whatsappNumber } = req.query;
    
    let existingUser = null;
    let message = '';
    let exists = false;

    if (mobileNumber) {
      existingUser = await WeddingUser.findOne({ mobileNumber });
      if (existingUser) {
        exists = true;
        message = 'Mobile number already registered';
      }
    }

    if (whatsappNumber && !exists) {
      existingUser = await WeddingUser.findOne({ whatsappNumber });
      if (existingUser) {
        exists = true;
        message = 'WhatsApp number already registered';
      }
    }

    res.status(200).json({
      success: true,
      exists: exists,
      message: exists ? message : 'Number available'
    });

  } catch (error) {
    console.error('Error checking contact:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};




export { transport };