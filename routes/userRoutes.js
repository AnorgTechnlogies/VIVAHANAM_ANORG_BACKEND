import express from "express";
import {
  simpleSignup,
  verifyEmail,
  resendVerificationCode,
  login,
  forgotPassword,
  resetPassword,
  updateProfile,
  completeRegistration,
  getUserInfo,
  deleteProfileImage,
  getAllUsersForAdmin,
  getUserStatistics,
  bulkVerifyUsers,
  getPartners,
  getPartnerFilterOptions,
  logout,
  trackActivity,
  deleteAccount,
  getActiveDeviceSessions,
  logoutDevice,
  createWeddingUser,
  checkContactExists,
  getWeddingFormStatus,
  getPartnersWithoutLogin
} from "../controllers/userController.js";
import userMiddleware from "../middleware/userMiddleware.js";
import adminMiddleware from "../middleware/adminMiddleware.js";
const router = express.Router();

// ============================================
// PUBLIC ROUTES (No authentication required)
// ============================================

// Authentication Routes
router.post("/signup", simpleSignup);
router.post("/verify-email", verifyEmail);
router.post("/resend-verification", resendVerificationCode);
router.post("/login", login);
router.post("/logout", userMiddleware, logout); // Ensure we know who logs out

// Password Recovery Routes
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

// Partners route (Public)
router.get("/partners/filters", userMiddleware, getPartnerFilterOptions);
router.get("/partners",userMiddleware, getPartners);
router.get("/partners-withoutlogin", getPartnersWithoutLogin);


// Test Email Endpoint
router.get("/test-email", async (req, res) => {
  try {
    const { transport } = await import("../controllers/userController.js");
    await transport.sendMail({
      from: process.env.NODEMAILER_SENDING_EMAIL_ADDRESS,
      to: process.env.NODEMAILER_SENDING_EMAIL_ADDRESS,
      subject: "Test Email - Vedic Vivah",
      html: "<h2>✅ Email system is working!</h2>",
    });
    res.json({ success: true, message: "Test email sent!" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// PROTECTED ROUTES (Authentication required)
// ============================================

// Profile Completion (First-time only - after email verification)
router.post("/complete-registration", userMiddleware, trackActivity, completeRegistration);

// Profile Update (For already completed profiles)
router.post("/update-profile", userMiddleware, trackActivity, updateProfile);

// Get Current User Info
router.get("/me", userMiddleware, trackActivity, getUserInfo);

// Add this to your user routes detele the user profile on profiule view page 
// DELETE Account route - Use userMiddleware
router.delete('/delete', userMiddleware, deleteAccount);

// Delete Profile Image
router.delete("/profile-image", userMiddleware, trackActivity, deleteProfileImage);

// Device Session Management
router.get("/devices", userMiddleware, getActiveDeviceSessions);
router.post("/devices/logout", userMiddleware, logoutDevice);

// ============================================
// ADMIN ROUTES (Admin middleware required)
// ============================================

// Get All Users (Admin only)
router.get("/users", adminMiddleware, getAllUsersForAdmin);

// Get User Statistics for Dashboard
router.get("/user-statistics", adminMiddleware, getUserStatistics);

// Bulk Verify Users
router.post("/users/bulk-verify", adminMiddleware, bulkVerifyUsers);

// wedding (authenticated)
router.post('/Weddinguser-form', userMiddleware, createWeddingUser);
router.get('/wedding-form/status', userMiddleware, getWeddingFormStatus);
router.get('/check-contact', checkContactExists);



export default router;