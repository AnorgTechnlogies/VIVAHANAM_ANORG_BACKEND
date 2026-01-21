import jwt from "jsonwebtoken";
import {
  sendVerificationCodeSchema,
  acceptCodeSchema,
  changePasswordSchema,
  registerSchemaForAdmin,
  loginSchemaForAdmin,
  sendForgotPasswordCodeForAdminSchema,
} from "../middleware/validator.js";
import adminModel from "../models/adminModel.js";
import {
  comparePassword,
  hashPassword,
  hmacProcess,
} from "../utils/hashing.js";
import { v2 as cloudinary } from "cloudinary";
import transport from "../middleware/sendMail.js";
import csv from "csvtojson";
import fs from "fs";
import Joi from "joi";
import axios from "axios";
import sendEmailNotification from "../middleware/sendEmailNotification.js";
import mongoose from "mongoose";

const registerAdmin= async (req, res) => {
  const {
    adminEmailId,
    adminPassword,
    adminName,
  } = req.body;

  try {
    // First check if any admin already exists in the system
    const existingAdminCount = await adminModel.countDocuments();
    if (existingAdminCount > 0) {
      return res.status(403).json({
        success: false,
        message:
          "System already has an admin. Multiple administrators are not allowed.",
      });
    }

    // Validate input data
    const { error, value } = registerSchemaForAdmin.validate({
      adminEmailId,
      adminPassword,
      adminName,
     
    });

    if (error) {
      return res
        .status(401)
        .json({ success: false, message: error.details[0].message });
    }

    // Double check specifically for email (extra safety)
    const existingAdmin = await adminModel.findOne({ adminEmailId });
    if (existingAdmin) {
      return res
        .status(401)
        .json({ success: false, message: "Admin already exists!" });
    }

    // Hash the password
    const hashedPassword = await hashPassword(adminPassword, 12);

    const verificationCodeValidation = Date.now() + 24 * 60 * 60 * 1000; // 24 hours validity

    // Prepare the admin object
    const adminData = {
      adminEmailId,
      adminPassword: hashedPassword,
      adminName,
     
      
      verified: false,
      verificationCodeValidation,
      adminImagelink: {
        public_id: "",
        url: "",
      },
      isFirstAdmin: true, // Flag to mark this as the primary admin
    };

    // Handle image upload if a file is provided
    if (req.file) {
      const { path: imageTempPath } = req.file;

      if (imageTempPath) {
        try {
          const cloudinaryResponse = await cloudinary.uploader.upload(
            imageTempPath,
            { folder: "ADMIN_IMAGES" }
          );

          if (!cloudinaryResponse || cloudinaryResponse.error) {
            fs.unlinkSync(imageTempPath);
            return res.json({
              success: false,
              message: "Failed to upload image to Cloudinary",
            });
          }

          adminData.adminImagelink.public_id = cloudinaryResponse.public_id;
          adminData.adminImagelink.url = cloudinaryResponse.secure_url;

          fs.unlinkSync(imageTempPath);
        } catch (error) {
          if (fs.existsSync(imageTempPath)) {
            fs.unlinkSync(imageTempPath);
          }
          return res.json({
            success: false,
            message: "An error occurred while uploading the image",
          });
        }
      }
    }

    // Create and save the new admin
    const admin = new adminModel(adminData);
    const result = await admin.save();

    // Remove sensitive data from response
    result.adminPassword = undefined;
    result.verificationCodeValidation = undefined;

    res.status(201).json({
      success: true,
      message:
        "Admin account created successfully. You are the primary administrator.",
      result,
    });
  } catch (error) {
    console.error("Error in Register admin:", error);
    res.status(500).json({
      success: false,
      message: "Error registering admin. Please try again later.",
    });
  }
};

const loginAdmin = async (req, res) => {
  // console.log(req.body);
  const { adminEmailId, adminPassword } = req.body; // Change email to adminEmailId
  try {
    // Validate input data
    const { error } = loginSchemaForAdmin.validate({
      adminEmailId,
      adminPassword,
    });

    if (error) {
      return res
        .status(401)
        .json({ success: false, message: error.details[0].message });
    }

    // Check if admin exists
    const existingAdmin = await adminModel
      .findOne({ adminEmailId })
      .select("+adminPassword");
    // console.log(existingAdmin, 'this is existing');

    if (!existingAdmin) {
      return res
        .status(401)
        .json({ success: false, message: "You are not an admin!" });
    }

    // Compare passwords
    const result = await comparePassword(
      adminPassword,
      existingAdmin.adminPassword
    );

    if (!result) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials!" });
    }

    // Generate token
// Generate token (you already have this)
// Generate token (you already have this)
// Generate token
const token = jwt.sign(
  {
    adminId: existingAdmin._id,
    adminEmailId: existingAdmin.adminEmailId,
    verified: existingAdmin.verified,
  },
  process.env.JWT_SECRET,
  { expiresIn: process.env.JWT_EXPIRE || "7d" }
);

// FINAL 100% WORKING COOKIE FOR LOCALHOST + PRODUCTION
return res.cookie("adminToken", token, {
  httpOnly: true,
  secure: false,        // THIS WAS THE FINAL BLOCKER
  sameSite: "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/"
})
.status(200)
.json({
  success: true,
  message: "Logged in successfully",
  token,
  admin: {
    _id: existingAdmin._id,
    adminName: existingAdmin.adminName,
    adminEmailId: existingAdmin.adminEmailId,
    verified: existingAdmin.verified
  }
});

  } catch (error) {
    console.log(error);
    res.json({
      success: false,
      message: "Something went wrong in login admin",
    });
  }
};

const getAdmin = async (req, res) => {
  try {
    // req.admin comes from adminMiddleware — it's the full admin document
    const admin = req.admin;

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Admin not authenticated",
      });
    }

    // Optional: Fetch fresh data (recommended)
    const freshAdmin = await adminModel
      .findById(admin._id)
      .select("-adminPassword -verificationCode -forgotPasswordCode"); // Hide sensitive fields

    if (!freshAdmin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found in database",
      });
    }

    return res.status(200).json({
      success: true,
      result: freshAdmin, // ← consistent with your login response
      message: "Admin fetched successfully",
    });

  } catch (error) {
    console.error("Error in getAdmin:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching admin",
    });
  }
};



const logoutAdmin = async (req, res) => {
  res.clearCookie("adminToken", { path: "/" });  // Add path!
  return res.status(200).json({
    success: true,
    message: "Logged out successfully"
  });
};


const sendVerificationCode = async (req, res) => {
  const { email } = req.body;

  try {
    const { error, value } = sendVerificationCodeSchema.validate({ email });
    if (error) {
      return res
        .status(401)
        .json({ success: false, message: error.details[0].message });
    }

    const existingAdmin = await adminModel.findOne({ email });
    if (!existingAdmin) {
      return res.status(404).json({
        success: false,
        message: "Admin does not exists!",
      });
    }
    if (existingAdmin.verified) {
      return res
        .status(400)
        .json({ success: false, message: "you are already verified" });
    }
    //dont use this method in production any one can think this codevalue
    const codeValue = Math.floor(Math.random() * 1000000).toString();

    let info = await transport.sendMail({
      from: process.env.NODEMAILER_SENDING_EMAIL_ADDRESS,
      to: existingAdmin.email,
      subject: "verification code",
      html: "<h1>" + codeValue + "</h1>",
    });
    if (info.accepted[0] === existingAdmin.email) {
      const hashedCodeValue = hmacProcess(
        codeValue,
        process.env.HMAC_VERIFICATION_CODE_SECRET
      );
      existingAdmin.verificationCode = hashedCodeValue;
      existingAdmin.verificationCodeValidation = Date.now();
      await existingAdmin.save();
      return res.status(200).json({ success: true, message: "Code Sent!" });
    }
    return res
      .status(400)
      .json({ success: false, message: `${error}Code sent failed` });
  } catch (error) {
    console.log(error);
    return res.status(400).json({
      success: false,
      message: `${error} error in last Code sent failed`,
    });
  }
};

const verifyVerificationCode = async (req, res) => {
  const { email, providedCode } = req.body;
  console.log(email, "this is emai and code", providedCode);
  try {
    const { error, value } = acceptCodeSchema.validate({ email, providedCode });
    if (error) {
      return res.status(401).json({
        success: false,
        message: error.details[0].message,
      });
    }

    const codeValue = providedCode.toString();
    const existingAdmin = await adminModel
      .findOne({ email })
      .select("+verificationCode +verificationCodeValidation");

    if (!existingAdmin) {
      return res
        .status(401)
        .json({ success: false, message: "admin does not exists" });
    }

    if (existingAdmin.verified) {
      return res
        .status(400)
        .json({ success: false, message: "you are already verified" });
    }

    if (
      !existingAdmin.verificationCode ||
      !existingAdmin.verificationCodeValidation
    ) {
      return res
        .status(400)
        .json({ success: false, message: "something is wrong with the code!" });
    }

    if (Date.now() - existingAdmin.verificationCodeValidation > 5 * 60 * 1000) {
      return res
        .status(400)
        .json({ success: false, message: "code has been expired" });
    }

    const hashedCodeValue = hmacProcess(
      codeValue,
      process.env.HMAC_VERIFICATION_CODE_SECRET
    );
    if (hashedCodeValue == existingAdmin.verificationCode) {
      existingAdmin.verified = true;
      existingAdmin.verificationCode = undefined;
      existingAdmin.verificationCodeValidation = undefined;
      await existingAdmin.save();
      return res
        .status(200)
        .json({ success: true, message: "your account has been verified" });
    }
    return res
      .status(400)
      .json({ success: false, message: "unexpected occured !!" });
  } catch (error) {
    console.log(error);
    return res.status(400).json({
      success: false,
      message: `${error} error in last Code verification failed`,
    });
  }
};

const changePassword = async (req, res) => {
  const { adminId, verified } = req.admin;
  console.log(verified);
  const { oldPassword, newPassword } = req.body;
  try {
    const { error, value } = changePasswordSchema.validate({
      oldPassword,
      newPassword,
    });
    if (error) {
      return res
        .status(401)
        .json({ success: false, message: error.details[0].message });
    }
    if (!verified) {
      return res
        .status(401)
        .json({ success: false, message: "You are not verified admin!" });
    }
    const existingAdmin = await adminModel
      .findOne({ _id: adminId })
      .select("+password");
    if (!existingAdmin) {
      return res
        .status(401)
        .json({ success: false, message: "Admin does not exists!" });
    }
    const result = await comparePassword(oldPassword, existingAdmin.password);
    if (!result) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials!" });
    }
    const hashedPassword = await hashPassword(newPassword, 12);
    existingAdmin.password = hashedPassword;
    await existingAdmin.save();
    return res
      .status(200)
      .json({ success: true, message: "Password updated!!" });
  } catch (error) {
    console.log(error);
  }
};

const sendForgotPasswordCode = async (req, res) => {
  const { adminEmailId } = req.body;
  try {
    const { error } = sendForgotPasswordCodeForAdminSchema.validate({
      adminEmailId,
    });
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    const existingAdmin = await adminModel.findOne({ adminEmailId });
    if (!existingAdmin) {
      return res.status(404).json({
        success: false,
        message: "Admin does not exist!",
      });
    }

    // Configure the authenticator to generate a 6-digit OTP
    authenticator.options = { digits: 6 };

    function generateOTP(secret) {
      return authenticator.generate(secret);
    }

    // You can use a unique secret per user or session
    const secret = authenticator.generateSecret();
    const codeValue = generateOTP(secret); // Example output: "749302"

    let info = await transport.sendMail({
      from: process.env.NODEMAILER_SENDING_EMAIL_ADDRESS,
      to: existingAdmin.adminEmailId,
      subject: "Psycortex: Password Reset Code",
      html: `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <div style="max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px; background-color: #1c1c1c; color: #f4f4f4;">
        <h2 style="color: #00ccff; text-align: center;">Psycortex</h2>
        <h3 style="text-align: center;">Password Reset Request</h3>
        <p>Hello ${existingAdmin.adminName},</p>
        <p>We received a request to reset your password. Please use the following verification code to proceed with the reset:</p>
        
        <div style="text-align: center; margin: 20px;">
          <span style="font-size: 24px; font-weight: bold; color: #ff6600;">${codeValue}</span>
        </div>

        <p>If you did not request a password reset, please disregard this message. Your account remains secure.</p>

        <div style="border-top: 1px solid #eaeaea; margin-top: 20px; padding-top: 10px;">
          <p style="font-size: 12px; text-align: center; color: #999;">
            &copy; ${new Date().getFullYear()} Psycortex. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  `,
    });

    if (info.accepted.includes(existingAdmin.adminEmailId)) {
      const hashedCodeValue = hmacProcess(
        codeValue,
        process.env.HMAC_VERIFICATION_CODE_SECRET
      );
      existingAdmin.forgotPasswordCode = hashedCodeValue;
      existingAdmin.forgotPasswordCodeValidation = Date.now();
      await existingAdmin.save();

      return res.status(200).json({
        success: true,
        message: "Code sent successfully!",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to send code!",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Error sending forgot password code!",
    });
  }
};

const verifyForgotPasswordCode = async (req, res) => {
  const { adminEmailId, providedCode, newPassword } = req.body;

  try {
    // Validate the input using schema
    const { error } = acceptFPCodeForAdminSchema.validate({
      adminEmailId,
      providedCode,
      newPassword,
    });
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    // Find admin by email
    const existingAdmin = await adminModel
      .findOne({ adminEmailId })
      .select("+forgotPasswordCode +forgotPasswordCodeValidation");

    if (!existingAdmin) {
      return res.status(404).json({
        success: false,
        message: "Admin does not exist!",
      });
    }

    if (
      !existingAdmin.forgotPasswordCode ||
      !existingAdmin.forgotPasswordCodeValidation
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired code!",
      });
    }

    // Check if the code has expired (valid for 5 minutes)
    if (
      Date.now() - existingAdmin.forgotPasswordCodeValidation >
      5 * 60 * 1000
    ) {
      return res.status(400).json({
        success: false,
        message: "Code has expired!",
      });
    }

    // Hash the provided code and compare it with the stored hashed code
    const hashedCodeValue = hmacProcess(
      providedCode,
      process.env.HMAC_VERIFICATION_CODE_SECRET
    );
    if (hashedCodeValue === existingAdmin.forgotPasswordCode) {
      // Hash the new password
      const hashedPassword = await hashPassword(newPassword, 12);

      // Update the password and clear forgot password fields
      existingAdmin.adminPassword = hashedPassword;
      existingAdmin.forgotPasswordCode = undefined;
      existingAdmin.forgotPasswordCodeValidation = undefined;

      // Save the updated admin
      await existingAdmin.save();

      return res.status(200).json({
        success: true,
        message: "Password updated successfully!",
      });
    }

    return res.status(400).json({
      success: false,
      message: "Invalid code provided!",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Error verifying forgot password code!",
    });
  }
};



export {
  registerAdmin,
  loginAdmin,
  getAdmin,
  logoutAdmin,
  sendVerificationCode,
  verifyVerificationCode,
  changePassword,
  sendForgotPasswordCode,
  verifyForgotPasswordCode,
};
