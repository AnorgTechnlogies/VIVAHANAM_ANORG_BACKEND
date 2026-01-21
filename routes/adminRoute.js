import express from "express";
import adminMiddleware from "../middleware/adminMiddleware.js";const router = express.Router();


import {
  registerAdmin,
  loginAdmin,
  logoutAdmin,
  sendVerificationCode,
  verifyVerificationCode,
  changePassword,
  sendForgotPasswordCode,
  verifyForgotPasswordCode,
  getAdmin,
} from "../controllers/adminController.js";


import {
  createFaq,
  getFaqs,
  updateFaq,
  deleteFaq,
  createBlog,
  getBlogs,
  getBlogBySlug,
  updateBlog,
  deleteBlog,
  saveContactSubmission,
  getAllContactSubmissions,
  deleteContactSubmission,
  createContactInfo,
  getContactInfo,
  getActiveContactInfo,
  updateContactInfo,
  deleteContactInfo,
  setActiveContactInfo,
  submitTestimonial,
  getTestimonials,
  getAllTestimonialsAdmin,
  approveTestimonial,
  createTestimonial,
  updateTestimonial,
  deleteTestimonial,
  createMatchmakingPlan,
  getMatchmakingPlans,
  getMatchmakingPlanById,
  updateMatchmakingPlan,
  deleteMatchmakingPlan,
  toggleMatchmakingPlanStatus,
  getAllWeddingUsers,
  deleteWeddingUser
} from "../controllers/otherAdminController.js";


// Import from the new dynamic form controller
import {
  getFormFields as getDynamicFormFields,
  getActiveFormFields,
  getFormField,
  createFormField,
  updateFormField,
  deleteFormField,
  toggleFieldStatus,
  reorderFields,
  getDatalists,
  createDatalist,
  updateDatalist,
  deleteDatalist,
  addDatalistOption,
  removeDatalistOption,
  toggleDatalistOption,
  getFormConfiguration,
  exportFormConfiguration,
  importFormConfiguration,
  migrateFieldType
} from "../controllers/dynamicFormController.js";

import {
  getDashboardStats,
  getAnalyticsData,
  handleQuickAction,
  getContentOverview,
  getSystemHealth,
  globalSearch,
  getWidgetData,
  getUsersForDashboard,
  getUserCounts,
  bulkUserActions,
  getRealTimeActiveUsers,
  checkNewUsers
} from "../controllers/dashboardController.js";

import MatchmakingPlan from "../models/MatchmakingPlan.js";


// ==========================================================
// HEALTH CHECK ENDPOINT
// ==========================================================
router.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running and healthy",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

/* ==========================================================
   1️⃣ ADMIN AUTHENTICATION & PROFILE MANAGEMENT
   ========================================================== */
router.post("/register", registerAdmin);
router.post("/login", loginAdmin);
router.get("/get-admin", adminMiddleware, getAdmin);
router.get("/logout", adminMiddleware, logoutAdmin);

router.patch("/send-verification-code", adminMiddleware, sendVerificationCode);
router.patch("/verify-verification-code", adminMiddleware, verifyVerificationCode);
router.patch("/change-password", adminMiddleware, changePassword);
router.patch("/send-forgot-password-code", sendForgotPasswordCode);
router.patch("/verify-forgot-password-code", verifyForgotPasswordCode);

/* ==========================================================
   2️⃣ CONTACT FORM (PUBLIC + ADMIN)
   ========================================================== */
router.post("/contact", saveContactSubmission); // Public endpoint
router.get("/contact-submissions", adminMiddleware, getAllContactSubmissions);
router.delete("/contact-submissions/:id", adminMiddleware, deleteContactSubmission);

/* ==========================================================
   3️⃣ BLOG MANAGEMENT (ADMIN ONLY)
   ========================================================== */
router.post("/blogs", adminMiddleware, createBlog);
router.get("/blogs", adminMiddleware, getBlogs); // Admin list
router.get("/blogs/public", getBlogs); // Public list
router.get("/blogs/public/:slug", getBlogBySlug); // Public single blog
router.put("/blogs/:id", adminMiddleware, updateBlog);
router.delete("/blogs/:id", adminMiddleware, deleteBlog);

/* ==========================================================
   4️⃣ FAQ MANAGEMENT (ADMIN ONLY)
   ========================================================== */
router.post("/faqs", adminMiddleware, createFaq);
router.get("/faqs", adminMiddleware, getFaqs); // Admin list
router.get("/faqs/public", getFaqs); // Public list
router.put("/faqs/:id", adminMiddleware, updateFaq);
router.delete("/faqs/:id", adminMiddleware, deleteFaq);



/* ==========================================================
   7️⃣ TESTIMONIAL MANAGEMENT
   ========================================================== */
// Public routes
router.get("/testimonials", getTestimonials);
router.post("/testimonials/submit", submitTestimonial);

// Admin routes
router.get("/testimonials/all", adminMiddleware, getAllTestimonialsAdmin);
router.post("/testimonials/create", adminMiddleware, createTestimonial);
router.patch("/testimonials/approve/:id", adminMiddleware, approveTestimonial);
router.put("/testimonials/update/:id", adminMiddleware, updateTestimonial);
router.delete("/testimonials/delete/:id", adminMiddleware, deleteTestimonial);

/* ==========================================================
   8️⃣ DYNAMIC FORM MANAGEMENT ROUTES
   ========================================================== */

// Form Fields CRUD
router.get('/form-fields', adminMiddleware, getDynamicFormFields);
router.get('/form-fields/active', getActiveFormFields); // Public endpoint for registration form
router.get('/form-fields/:id', adminMiddleware, getFormField);
router.post('/form-fields', adminMiddleware, createFormField);
router.put('/form-fields/:id', adminMiddleware, updateFormField);
router.delete('/form-fields/:id', adminMiddleware, deleteFormField);
router.patch('/form-fields/:id/toggle-status', adminMiddleware, toggleFieldStatus);
router.patch('/form-fields/reorder', adminMiddleware, reorderFields);

// Datalists CRUD
router.get('/datalists', adminMiddleware, getDatalists);
router.post('/datalists', adminMiddleware, createDatalist);
router.put('/datalists/:id', adminMiddleware, updateDatalist);
router.delete('/datalists/:id', adminMiddleware, deleteDatalist);
router.post('/datalists/:id/options', adminMiddleware, addDatalistOption);
router.delete('/datalists/:id/options/:optionId', adminMiddleware, removeDatalistOption);
router.patch('/datalists/:id/options/:optionId/toggle', adminMiddleware, toggleDatalistOption);

// Form Configuration
router.get('/form-configuration', getFormConfiguration); // Public endpoint for frontend
router.get('/form-configuration/export', adminMiddleware, exportFormConfiguration);
router.post('/form-configuration/import', adminMiddleware, importFormConfiguration);

/* ==========================================================
   9️⃣ ENHANCED DASHBOARD & USER MANAGEMENT ROUTES
   ========================================================== */

// Main dashboard statistics
router.get("/stats", adminMiddleware, getDashboardStats);

// Enhanced user fetching for dashboard modals
router.get("/users", adminMiddleware, getUsersForDashboard);

// Quick user counts for dashboard cards
router.get("/user-counts", adminMiddleware, getUserCounts);

// Bulk user actions (verify, delete, etc.)
router.post("/users/bulk-actions", adminMiddleware, bulkUserActions);

// Analytics and charts data
router.get("/analytics", adminMiddleware, getAnalyticsData);

// Quick actions
router.post("/quick-actions", adminMiddleware, handleQuickAction);

// Content management overview
router.get("/content-overview", adminMiddleware, getContentOverview);

// System health and performance
router.get("/system-health", adminMiddleware, getSystemHealth);

// Global search functionality
router.get("/search", adminMiddleware, globalSearch);

// Widget-specific data
router.get("/widgets", adminMiddleware, getWidgetData);

// REAL-TIME ACTIVE USERS AND NEW USER CHECKING
router.get("/active-users/realtime", adminMiddleware, getRealTimeActiveUsers);
router.get("/check-new-users", adminMiddleware, checkNewUsers);

/* ==========================================================
   1️⃣0️⃣ MATCHMAKING PLAN MANAGEMENT
   ========================================================== */

// TEST ENDPOINT - For frontend connection check
router.get("/test-plans", async (req, res) => {
  try {
    console.log("📦 Test endpoint hit - checking database connection...");
    
    const planCount = await MatchmakingPlan.countDocuments({ isActive: true });
    
    res.status(200).json({
      success: true,
      message: "Backend is connected",
      data: { 
        activePlans: planCount,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error("❌ Test endpoint error:", error);
    res.status(500).json({
      success: false,
      message: "Database connection error"
    });
  }
});

// PUBLIC CATALOG ENDPOINT - For frontend to fetch active plans
router.get("/matchmaking-plans/catalog", async (req, res) => {
  try {
    console.log("📦 Fetching matchmaking plans catalog...");
    
    const plans = await MatchmakingPlan.find({ isActive: true })
      .sort({ order: 1, createdAt: -1 })
      .lean();

    console.log(`✅ Found ${plans.length} active plans`);
    
    // Return empty array if no plans found (don't throw error)
    if (plans.length === 0) {
      console.log("⚠️ No active plans found in database");
      return res.status(200).json({
        success: true,
        message: "No active plans found",
        data: { plans: [] }
      });
    }
    
    res.status(200).json({
      success: true,
      message: "Plans catalog fetched successfully",
      data: { plans }
    });
  } catch (error) {
    console.error("❌ Error fetching plan catalog:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error fetching plans catalog"
    });
  }
});


// ADMIN-ONLY ROUTES
router.post("/matchmaking-plans", adminMiddleware, createMatchmakingPlan);
router.get("/matchmaking-plans", adminMiddleware, getMatchmakingPlans);
router.get("/matchmaking-plans/:id", adminMiddleware, getMatchmakingPlanById);
router.put("/matchmaking-plans/:id", adminMiddleware, updateMatchmakingPlan);
router.delete("/matchmaking-plans/:id", adminMiddleware, deleteMatchmakingPlan);
router.patch("/matchmaking-plans/:id/toggle-status", adminMiddleware, toggleMatchmakingPlanStatus);

/* ==========================================================
   1️⃣1️⃣ CONTACT INFORMATION MANAGEMENT (ADMIN ONLY)
   ========================================================== */
router.post("/contact-info", adminMiddleware, createContactInfo);
router.get("/contact-info", adminMiddleware, getContactInfo);
router.get("/contact-info/active", getActiveContactInfo); // Public endpoint
router.put("/contact-info/:id", adminMiddleware, updateContactInfo);
router.delete("/contact-info/:id", adminMiddleware, deleteContactInfo);
router.patch("/contact-info/:id/set-active", adminMiddleware, setActiveContactInfo);

// Add this route to adminRoutes.js for debugging
router.get("/contact-info/debug-db", adminMiddleware, async (req, res) => {
  try {
    console.log("🔍 DEBUG: Checking database connection and data...");
    
    // Test basic connection
    const dbState = mongoose.connection.readyState;
    const dbStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];
    console.log(`📊 Database state: ${dbStates[dbState]} (${dbState})`);
    
    // Count all documents
    const totalCount = await ContactInfo.countDocuments();
    console.log(`📋 Total contact info documents: ${totalCount}`);
    
    // Get all documents
    const allDocs = await ContactInfo.find({}).lean();
    console.log("📄 All documents:", allDocs);
    
    // Try to find the specific document
    console.log("🔎 Looking for ID:", "672638b533acd63a3899a786");
    const specificDoc = await ContactInfo.findById("672638b533acd63a3899a786").lean();
    console.log("✅ Specific document found:", specificDoc);
    
    // Try with different query methods
    const findOneDoc = await ContactInfo.findOne({ _id: "672638b533acd63a3899a786" }).lean();
    console.log("🔍 FindOne result:", findOneDoc);
    
    res.status(200).json({
      success: true,
      data: {
        databaseState: dbStates[dbState],
        totalDocuments: totalCount,
        allDocuments: allDocs,
        specificDocument: specificDoc,
        findOneResult: findOneDoc,
        requestedId: "672638b533acd63a3899a786"
      }
    });
  } catch (error) {
    console.error("❌ Debug error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
      stack: error.stack
    });
  }
});


// Admin routes
router.get('/weddings/users' , getAllWeddingUsers);
router.delete('/weddings/users/:id', deleteWeddingUser);


// Field Type Migration Route (Admin only)
router.patch('/form-fields/:fieldId/migrate-type', adminMiddleware, migrateFieldType);

export default router;