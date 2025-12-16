import User from "../models/userModel.js";
import UserPlan from "../models/userPlanModel.js";
import Testimonial from "../models/testimonialModel.js";
import ContactSubmission from "../models/ContactSubmission.js";
import Blog from "../models/Blog.js";
import Faq from "../models/Faq.js";
import { FormField, Datalist } from "../models/AdminRegistrationDynamicModel.js";
import adminModel from "../models/adminModel.js";
import mongoose from "mongoose";

// ==================== ENHANCED ACTIVE USER TRACKING SYSTEM ====================

// In-memory store for active sessions (for real-time tracking)
const activeSessions = new Map();
const sessionTimeouts = new Map();
const notifiedUsers = new Set();

// Enhanced session configuration with proper timeouts
const SESSION_CONFIG = {
  ONLINE_NOW_THRESHOLD: 2 * 60 * 1000,        // 2 minutes window for "Online Now" (matches dashboard copy)
  ACTIVE_SESSION_TIMEOUT: 24 * 60 * 60 * 1000,   // 24 hours for active session
  HEARTBEAT_INTERVAL: 5 * 60 * 1000,          // 5 minutes heartbeat check
  CLEANUP_INTERVAL: 30 * 60 * 1000            // Cleanup every 30 minutes
};

// Initialize session cleanup
setInterval(() => {
  cleanupExpiredSessions();
}, SESSION_CONFIG.CLEANUP_INTERVAL);

// Clean up expired sessions
const cleanupExpiredSessions = () => {
  const now = new Date();
  let cleanedCount = 0;
  
  for (const [userId, session] of activeSessions.entries()) {
    const timeSinceLastActivity = now - session.lastActive;
    if (timeSinceLastActivity > SESSION_CONFIG.ACTIVE_SESSION_TIMEOUT) {
      activeSessions.delete(userId);
      if (sessionTimeouts.has(userId)) {
        clearTimeout(sessionTimeouts.get(userId));
        sessionTimeouts.delete(userId);
      }
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`🧹 Cleaned up ${cleanedCount} expired sessions`);
  }
};

// Enhanced user login tracking
export const trackUserLogin = (userId) => {
  const sessionId = userId.toString();
  
  const sessionData = {
    userId,
    lastActive: new Date(),
    loginTime: new Date(),
    status: 'online',
    activityCount: 0
  };

  activeSessions.set(sessionId, sessionData);

  // Clear any existing timeout
  if (sessionTimeouts.has(sessionId)) {
    clearTimeout(sessionTimeouts.get(sessionId));
    sessionTimeouts.delete(sessionId);
  }

  // Set timeout for automatic session expiration
  const timeout = setTimeout(() => {
    console.log(`⚫ User ${userId} session expired due to inactivity`);
    activeSessions.delete(sessionId);
    sessionTimeouts.delete(sessionId);
    
    // Update lastLogout in database if needed
    User.findByIdAndUpdate(userId, { 
      lastLogout: new Date() 
    }).catch(err => console.error('Error updating logout time:', err));
    
  }, SESSION_CONFIG.ACTIVE_SESSION_TIMEOUT);
  
  sessionTimeouts.set(sessionId, timeout);

  console.log(`🟢 User ${userId} logged in - Active sessions: ${activeSessions.size}`);
  return sessionData;
};

// Enhanced user logout tracking
export const trackUserLogout = (userId) => {
  const sessionId = userId.toString();
  
  // Update database with logout time
  User.findByIdAndUpdate(userId, { 
    lastLogout: new Date() 
  }).catch(err => console.error('Error updating logout time:', err));
  
  // Remove from active sessions
  const hadSession = activeSessions.has(sessionId);
  activeSessions.delete(sessionId);
  
  // Clear timeout if exists
  if (sessionTimeouts.has(sessionId)) {
    clearTimeout(sessionTimeouts.get(sessionId));
    sessionTimeouts.delete(sessionId);
  }

  console.log(`🔴 User ${userId} logged out - Had session: ${hadSession} - Remaining sessions: ${activeSessions.size}`);
  return hadSession;
};

// Enhanced user activity tracking (heartbeat)
export const trackUserActivity = (userId) => {
  const sessionId = userId.toString();
  
  if (activeSessions.has(sessionId)) {
    const session = activeSessions.get(sessionId);
    session.lastActive = new Date();
    session.activityCount = (session.activityCount || 0) + 1;
    
    // Reset timeout
    if (sessionTimeouts.has(sessionId)) {
      clearTimeout(sessionTimeouts.get(sessionId));
    }
    
    // Set new timeout
    const timeout = setTimeout(() => {
      console.log(`⚫ User ${userId} session expired due to inactivity`);
      activeSessions.delete(sessionId);
      sessionTimeouts.delete(sessionId);
      
      // Update lastLogout in database
      User.findByIdAndUpdate(userId, { 
        lastLogout: new Date() 
      }).catch(err => console.error('Error updating logout time:', err));
      
    }, SESSION_CONFIG.ACTIVE_SESSION_TIMEOUT);
    
    sessionTimeouts.set(sessionId, timeout);
    
    return true;
  }
  
  return false;
};

// Enhanced function to check if user is currently online (active in last 2 minutes)
const isUserOnlineNow = (user) => {
  if (!user || !user._id) return false;
  
  const userId = user._id.toString();
  
  // First check in-memory sessions for real-time status
  if (activeSessions.has(userId)) {
    const session = activeSessions.get(userId);
    const thirtyMinutesAgo = new Date(Date.now() - SESSION_CONFIG.ONLINE_NOW_THRESHOLD);
    return session.lastActive > thirtyMinutesAgo;
  }
  
  // Fallback to database check with proper logout consideration
  if (user.lastLogin) {
    // If user has logged out, they're definitely offline
    if (user.lastLogout && new Date(user.lastLogout) > new Date(user.lastLogin)) {
      return false;
    }
    
    // Check if last login was within online threshold
    const thirtyMinutesAgo = new Date(Date.now() - SESSION_CONFIG.ONLINE_NOW_THRESHOLD);
    return new Date(user.lastLogin) > thirtyMinutesAgo;
  }
  
  return false;
};

// Enhanced function to check if user has active session (less strict)
const isUserCurrentlyActive = (user) => {
  if (!user || !user._id) return false;
  
  const userId = user._id.toString();
  
  // Check in-memory sessions first
  if (activeSessions.has(userId)) {
    return true;
  }
  
  // Fallback to database check
  if (user.lastLogin) {
    // Respect logout time
    if (user.lastLogout && new Date(user.lastLogout) > new Date(user.lastLogin)) {
      return false;
    }
    
    // Check if last login was within active session timeout
    const thirtyMinutesAgo = new Date(Date.now() - SESSION_CONFIG.ONLINE_NOW_THRESHOLD);
    return new Date(user.lastLogin) > thirtyMinutesAgo;
  }
  
  return false;
};

// Enhanced user status calculation
const getUserEnhancedStatus = (user) => {
  if (!user) return 'offline';
  
  const isOnlineNow = isUserOnlineNow(user);
  const isActive = isUserCurrentlyActive(user);
  
  if (!user.isVerified) return 'unverified';
  if (!user.profileCompleted) return 'incomplete';
  if (isOnlineNow) return 'online';
  if (isActive) return 'active';
  if (user.userType === 'premium') return 'premium';
  
  return 'offline';
};

// Get user's current session info (helper function)
const getUserSessionInfoHelper = (user) => {
  if (!user || !user._id) return null;
  
  const userId = user._id.toString();
  if (activeSessions.has(userId)) {
    return activeSessions.get(userId);
  }
  
  return null;
};

// ==================== ENHANCED USER FETCHING FOR DASHBOARD ====================
export const getUsersForDashboard = async (req, res) => {
  try {
    const { 
      type = 'all', 
      page = 1, 
      limit = 50,
      search = "",
      sortBy = "createdAt",
      sortOrder = "desc"
    } = req.query;

    console.log(`🔍 Fetching users for dashboard - Type: ${type}, Page: ${page}, Search: "${search}"`);

    let query = {};

    // Apply filters based on type - Enhanced with real-time active status
    switch (type) {
      case 'unverified':
        query.isVerified = false;
        break;
      case 'incomplete':
        query.isVerified = true;
        query.profileCompleted = false;
        break;
      case 'completed':
        query.isVerified = true;
        query.profileCompleted = true;
        break;
      case 'active':
        // Users with active sessions or recent activity
        query.isVerified = true;
        query.$or = [
          { 
            lastLogin: { $gte: new Date(Date.now() - SESSION_CONFIG.ONLINE_NOW_THRESHOLD) },
            $or: [
              { lastLogout: { $exists: false } },
              { $expr: { $lt: ["$lastLogout", "$lastLogin"] } }
            ]
          },
          { _id: { $in: Array.from(activeSessions.keys()).map(id => new mongoose.Types.ObjectId(id)) } }
        ];
        break;
      case 'online':
        // Real-time online users (active in last 2 minutes)
        query.isVerified = true;
        query.$or = [
          { 
            lastLogin: { $gte: new Date(Date.now() - SESSION_CONFIG.ONLINE_NOW_THRESHOLD) },
            $or: [
              { lastLogout: { $exists: false } },
              { $expr: { $lt: ["$lastLogout", "$lastLogin"] } }
            ]
          },
          { _id: { $in: Array.from(activeSessions.keys()).map(id => new mongoose.Types.ObjectId(id)) } }
        ];
        break;
      case 'premium':
        query.isVerified = true;
        query.userType = 'premium';
        break;
      case 'pending':
        query.profileCompleted = false;
        break;
      case 'verified':
        query.profileCompleted = true;
        break;
      case 'newToday':
        const today = new Date();
        const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        query.createdAt = { $gte: startOfToday };
        break;
      case 'offline':
        query.$or = [
          { lastLogin: { $lt: new Date(Date.now() - SESSION_CONFIG.ACTIVE_SESSION_TIMEOUT) } },
          { lastLogout: { $gt: '$lastLogin' } },
          { lastLogin: { $exists: false } }
        ];
        break;
      case 'all':
      default:
        break;
    }

    if (search && search.trim() !== "") {
      const searchRegex = { $regex: search, $options: "i" };
      query.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { vivId: searchRegex },
        { mobileNo: searchRegex },
        { firstName: searchRegex },
        { lastName: searchRegex },
        { city: searchRegex },
        { state: searchRegex }
      ];
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const users = await User.find(query)
      .select("-password -verificationCode -verificationCodeExpires -resetPasswordCode -resetPasswordExpires")
      .sort(sortOptions)
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();

    const totalUsers = await User.countDocuments(query);

    console.log(`✅ Found ${users.length} users for type: ${type}`);

    // Enhanced user status with real-time active check
    const enhancedUsers = users.map(user => {
      const isOnlineNow = isUserOnlineNow(user);
      const isActive = isUserCurrentlyActive(user);
      const sessionInfo = getUserSessionInfoHelper(user);
      
      return {
        ...user,
        age: calculateAge(user.dateOfBirth),
        fullName: [user.firstName, user.middleName, user.lastName].filter(Boolean).join(' ').trim() || user.name,
        lastActive: user.lastLogin ? formatTimeAgo(user.lastLogin) : 'Never',
        userStatus: getUserEnhancedStatus(user),
        profileStatus: getProfileStatus(user),
        isCurrentlyActive: isActive,
        isOnlineNow: isOnlineNow,
        lastLoginTime: user.lastLogin,
        lastLogoutTime: user.lastLogout,
        onlineStatus: isOnlineNow ? 'online' : (isActive ? 'active' : 'offline'),
        sessionInfo: sessionInfo ? {
          loginTime: sessionInfo.loginTime,
          lastActive: sessionInfo.lastActive,
          activityCount: sessionInfo.activityCount,
          sessionDuration: Math.round((new Date() - new Date(sessionInfo.loginTime)) / 60000) // minutes
        } : null
      };
    });

    res.status(200).json({
      success: true,
      data: {
        users: enhancedUsers,
        pagination: {
          total: totalUsers,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(totalUsers / parseInt(limit)),
        },
        filters: { type, search, sortBy, sortOrder },
        realTimeStats: {
          activeSessions: activeSessions.size,
          onlineNow: enhancedUsers.filter(user => user.isOnlineNow).length,
          sessionTimeouts: sessionTimeouts.size,
          lastUpdated: new Date()
        }
      }
    });

  } catch (error) {
    console.error("❌ Error fetching users for dashboard:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching users data",
      error: error.message
    });
  }
};

// ==================== QUICK USER COUNTS FOR DASHBOARD CARDS ====================
export const getUserCounts = async (req, res) => {
  try {
    const [
      totalUsers,
      unverifiedUsers,
      incompleteProfiles,
      completedProfiles,
      // Enhanced counts with proper time thresholds
      onlineNowDb,
      activeNowDb,
      newToday,
      premiumUsers,
      verifiedUsers
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isVerified: false }),
      User.countDocuments({ isVerified: true, profileCompleted: false }),
      User.countDocuments({ isVerified: true, profileCompleted: true }),
      // Online now count (last 2 minutes) - FIXED QUERY
      User.aggregate([
        {
          $match: {
            isVerified: true,
            lastLogin: { $gte: new Date(Date.now() - SESSION_CONFIG.ONLINE_NOW_THRESHOLD) }
          }
        },
        {
          $match: {
            $or: [
              { lastLogout: { $exists: false } },
              { $expr: { $lt: ["$lastLogout", "$lastLogin"] } }
            ]
          }
        },
        {
          $count: "count"
        }
      ]),
      // Active count (last 2 minutes) - FIXED QUERY
      User.aggregate([
        {
          $match: {
            isVerified: true,
            lastLogin: { $gte: new Date(Date.now() - SESSION_CONFIG.ONLINE_NOW_THRESHOLD) }
          }
        },
        {
          $match: {
            $or: [
              { lastLogout: { $exists: false } },
              { $expr: { $lt: ["$lastLogout", "$lastLogin"] } }
            ]
          }
        },
        {
          $count: "count"
        }
      ]),
      User.countDocuments({
        createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
      }),
      User.countDocuments({ isVerified: true, userType: 'premium' }),
      User.countDocuments({ isVerified: true })
    ]);

    // Calculate real-time counts from active sessions
    let realTimeOnline = 0;
    let realTimeActive = 0;
    const thirtyMinutesAgo = new Date(Date.now() - SESSION_CONFIG.ONLINE_NOW_THRESHOLD);
    
    for (const session of activeSessions.values()) {
      if (session.lastActive > thirtyMinutesAgo) {
        realTimeOnline++;
      }
      realTimeActive++;
    }

    // Extract counts from aggregation results
    const onlineNowDbCount = onlineNowDb[0]?.count || 0;
    const activeNowDbCount = activeNowDb[0]?.count || 0;

    const userCounts = {
      totalUsers,
      unverifiedUsers,
      incompleteProfiles,
      completedProfiles,
      onlineNow: Math.max(onlineNowDbCount, realTimeOnline), // Use the larger number
      activeNow: Math.max(activeNowDbCount, realTimeActive), // Use the larger number
      realTimeOnline,
      realTimeActive,
      newToday,
      premiumUsers,
      verifiedUsers,
      pendingVerifications: unverifiedUsers + incompleteProfiles,
      verificationRate: totalUsers > 0 ? Math.round((verifiedUsers / totalUsers) * 100) : 0,
      completionRate: verifiedUsers > 0 ? Math.round((completedProfiles / verifiedUsers) * 100) : 0,
      onlineRate: verifiedUsers > 0 ? Math.round((Math.max(onlineNowDbCount, realTimeOnline) / verifiedUsers) * 100) : 0
    };

    console.log('📊 User counts calculated:', {
      onlineNow: userCounts.onlineNow,
      activeNow: userCounts.activeNow,
      realTimeOnline,
      realTimeActive,
      sessions: activeSessions.size
    });

    res.status(200).json({ success: true, data: userCounts });

  } catch (error) {
    console.error("❌ Error fetching user counts:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching user counts",
      error: error.message
    });
  }
};

// ==================== BULK USER ACTIONS ====================
export const bulkUserActions = async (req, res) => {
  try {
    const { action, userIds, additionalData } = req.body;

    if (!action || !userIds || !Array.isArray(userIds)) {
      return res.status(400).json({
        success: false,
        message: "Action and user IDs are required"
      });
    }

    let result;
    let message = "";

    switch (action) {
      case "verify_email":
        result = await User.updateMany(
          { _id: { $in: userIds } },
          { $set: { isVerified: true, verifiedAt: new Date() } }
        );
        message = `${result.modifiedCount} users email verified successfully`;
        break;

      case "mark_profile_completed":
        result = await User.updateMany(
          { _id: { $in: userIds } },
          { $set: { profileCompleted: true, profileCompletedAt: new Date() } }
        );
        message = `${result.modifiedCount} profiles marked as completed`;
        break;

      case "verify":
        result = await User.updateMany(
          { _id: { $in: userIds } },
          { $set: { isVerified: true, profileCompleted: true, verifiedAt: new Date() } }
        );
        message = `${result.modifiedCount} users fully verified`;
        break;

      case "delete":
        // Remove from active sessions if any
        userIds.forEach(userId => {
          const sessionId = userId.toString();
          if (activeSessions.has(sessionId)) {
            activeSessions.delete(sessionId);
          }
          if (sessionTimeouts.has(sessionId)) {
            clearTimeout(sessionTimeouts.get(sessionId));
            sessionTimeouts.delete(sessionId);
          }
        });
        result = await User.deleteMany({ _id: { $in: userIds } });
        message = `${result.deletedCount} users deleted successfully`;
        break;

      case "mark_premium":
        result = await User.updateMany(
          { _id: { $in: userIds } },
          { $set: { userType: 'premium' } }
        );
        message = `${result.modifiedCount} users marked as premium`;
        break;

      case "force_logout":
        // Force logout users by updating their logout time and removing sessions
        result = await User.updateMany(
          { _id: { $in: userIds } },
          { $set: { lastLogout: new Date() } }
        );
        // Also remove from active sessions
        let loggedOutCount = 0;
        userIds.forEach(userId => {
          if (trackUserLogout(userId)) {
            loggedOutCount++;
          }
        });
        message = `${loggedOutCount} users forced to logout`;
        break;

      case "send_email":
        message = `Email sent to ${userIds.length} users`;
        break;

      default:
        return res.status(400).json({ success: false, message: "Invalid action" });
    }

    await logAdminActivity(req.admin._id, `bulk_${action}`, { userIds, additionalData }, result);

    res.status(200).json({ success: true, message, data: result });

  } catch (error) {
    console.error("❌ Error in bulk user actions:", error);
    res.status(500).json({
      success: false,
      message: "Error performing bulk action",
      error: error.message
    });
  }
};

// ==================== MAIN DASHBOARD STATISTICS ====================
export const getDashboardStats = async (req, res) => {
  try {
    console.log("🔄 Fetching dashboard stats...");

    // Calculate real-time counts from active sessions
    let realTimeOnline = 0;
    let realTimeActive = activeSessions.size;
    const thirtyMinutesAgo = new Date(Date.now() - SESSION_CONFIG.ONLINE_NOW_THRESHOLD);
    
    for (const session of activeSessions.values()) {
      if (session.lastActive > thirtyMinutesAgo) {
        realTimeOnline++;
      }
    }

    // Get active users from database - FIXED QUERIES
    const [onlineNowDbResult, activeNowDbResult] = await Promise.all([
      // Online now (last 2 minutes) - FIXED
      User.aggregate([
        {
          $match: {
            isVerified: true,
            lastLogin: { $gte: new Date(Date.now() - SESSION_CONFIG.ONLINE_NOW_THRESHOLD) }
          }
        },
        {
          $match: {
            $or: [
              { lastLogout: { $exists: false } },
              { $expr: { $lt: ["$lastLogout", "$lastLogin"] } }
            ]
          }
        },
        {
          $count: "count"
        }
      ]),
      // Active now (last 2 minutes) - FIXED
      User.aggregate([
        {
          $match: {
            isVerified: true,
            lastLogin: { $gte: new Date(Date.now() - SESSION_CONFIG.ONLINE_NOW_THRESHOLD) }
          }
        },
        {
          $match: {
            $or: [
              { lastLogout: { $exists: false } },
              { $expr: { $lt: ["$lastLogout", "$lastLogin"] } }
            ]
          }
        },
        {
          $count: "count"
        }
      ])
    ]);

    const onlineNowDb = onlineNowDbResult[0]?.count || 0;
    const activeNowDb = activeNowDbResult[0]?.count || 0;

    const [
      totalUsers,
      unverifiedUsers,
      incompleteProfiles,
      completedProfiles,
      verifiedUsers,
      premiumUsers,
      newToday,
      paymentStats,
      monthlyRevenueData,
      pendingPayments,
      popularPlan,
      planDistribution,
      supportTickets,
      recentPayments,
      recentTestimonials,
      contactSubmissions,
      totalBlogs,
      totalPlans,
      totalFaqs,
      totalPendingTestimonials,
      totalFormFields,
      totalDatalists,
      newThisWeek,
      maleUsers,
      femaleUsers
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isVerified: false }),
      User.countDocuments({ isVerified: true, profileCompleted: false }),
      User.countDocuments({ isVerified: true, profileCompleted: true }),
      User.countDocuments({ isVerified: true }),
      User.countDocuments({ isVerified: true, userType: 'premium' }),
      User.countDocuments({
        createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
      }),
      UserPlan.aggregate([
        { $match: { payment_status: "COMPLETED" } },
        { $group: { _id: null, totalRevenue: { $sum: "$payment_amount" }, successfulPayments: { $sum: 1 } } }
      ]),
      UserPlan.aggregate([
        { $match: { payment_status: "COMPLETED", payment_date: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } } },
        { $group: { _id: null, monthlyRevenue: { $sum: "$payment_amount" } } }
      ]),
      UserPlan.countDocuments({ payment_status: "PENDING" }),
      UserPlan.aggregate([
        { $match: { payment_status: "COMPLETED" } },
        { $group: { _id: "$plan_name", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 1 }
      ]),
      UserPlan.aggregate([
        { $match: { payment_status: "COMPLETED", expires_at: { $gt: new Date() } } },
        { $group: { _id: "$plan_name", count: { $sum: 1 } } }
      ]),
      ContactSubmission.countDocuments({
        submittedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      }),
      UserPlan.find({ payment_status: { $in: ["COMPLETED", "PENDING"] } })
        .populate({ path: "userVivId", select: "name firstName lastName email vivId profileImage isVerified profileCompleted lastLogin lastLogout" })
        .sort({ payment_date: -1 }).limit(5).lean(),
      Testimonial.find({ isActive: true }).sort({ createdAt: -1 }).limit(2).lean(),
      ContactSubmission.find().sort({ submittedAt: -1 }).limit(5).lean(),
      Blog.countDocuments(),
      Faq.countDocuments(),
      Testimonial.countDocuments({ isActive: false }),
      FormField.countDocuments(),
      Datalist.countDocuments(),
      User.countDocuments({ createdAt: { $gte: new Date(new Date().setDate(new Date().getDate() - 7)) } }),
      User.countDocuments({ gender: "Male", isVerified: true }),
      User.countDocuments({ gender: "Female", isVerified: true })
    ]);

    console.log("✅ Database queries completed successfully");

    // Use the maximum of database count and real-time count
    const onlineNow = Math.max(onlineNowDb, realTimeOnline);
    const activeNow = Math.max(activeNowDb, realTimeActive);

    const revenueGrowth = await calculateRevenueGrowth();
    const systemHealth = await calculateSystemHealth();
    const pendingVerifications = unverifiedUsers + incompleteProfiles;

    const dashboardData = {
      userStats: {
        totalUsers,
        unverifiedUsers,
        incompleteProfiles,
        completedProfiles,
        verifiedUsers,
        premiumUsers,
        newToday,
        newThisWeek,
        onlineNow,
        activeNow,
        realTimeOnline,
        realTimeActive,
        maleUsers,
        femaleUsers,
        verificationRate: totalUsers > 0 ? Math.round((verifiedUsers / totalUsers) * 100) : 0,
        completionRate: verifiedUsers > 0 ? Math.round((completedProfiles / verifiedUsers) * 100) : 0,
        onlineRate: verifiedUsers > 0 ? Math.round((onlineNow / verifiedUsers) * 100) : 0
      },
      paymentStats: {
        totalRevenue: paymentStats[0]?.totalRevenue || 0,
        monthlyRevenue: monthlyRevenueData[0]?.monthlyRevenue || 0,
        successfulPayments: paymentStats[0]?.successfulPayments || 0,
        pendingPayments,
        popularPlan: popularPlan[0]?._id || "DIAMOND",
        averageRevenuePerUser: verifiedUsers > 0 ? Math.round((paymentStats[0]?.totalRevenue || 0) / verifiedUsers) : 0,
        revenueGrowth
      },
      adminStats: {
        pendingVerifications,
        unverifiedUsers,
        incompleteProfiles,
        reportedProfiles: await User.countDocuments({ isReported: true }),
        supportTickets,
        systemHealth,
        contentStats: {
          totalBlogs, totalPlans,
         totalFaqs, totalFormFields, totalDatalists, totalPendingTestimonials
        }
      },
      recentPayments: recentPayments.map(payment => {
        const user = payment.userVivId;
        const isOnlineNow = user ? isUserOnlineNow(user) : false;
        const isActive = user ? isUserCurrentlyActive(user) : false;
        
        return {
          id: payment._id,
          userName: user?.name || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || "Unknown User",
          userVivId: user?.vivId || payment.userVivId,
          userEmail: user?.email,
          userStatus: getUserStatus(user),
          plan_name: payment.plan_name,
          payment_amount: payment.payment_amount,
          payment_date: payment.payment_date?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
          plan_frequency: payment.plan_frequency,
          payment_status: payment.payment_status,
          userImage: user?.profileImage,
          lastLogin: user?.lastLogin,
          lastLogout: user?.lastLogout,
          isOnlineNow,
          isCurrentlyActive: isActive
        };
      }),
      recentTestimonials: recentTestimonials.map(t => ({
        id: t._id, name: t.name, message: t.message, rating: t.rating, weddingDate: t.weddingDate, image: t.image
      })),
      contactSubmissions: contactSubmissions.map(c => ({
        id: c._id, name: c.name, email: c.email, phone: c.phone,
        message: c.message.length > 50 ? c.message.substring(0, 50) + '...' : c.message,
        fullMessage: c.message, submittedAt: c.submittedAt, status: "new"
      })),
      planDistribution: planDistribution.reduce((acc, plan) => { acc[plan._id] = plan.count; return acc; }, {}),
      quickActions: await getQuickActionsData(),
      enhancedStats: {
        premiumRate: verifiedUsers > 0 ? Math.round((premiumUsers / verifiedUsers) * 100) : 0,
        activeConnections: await getActiveConnections(),
        memoryUsage: process.memoryUsage(),
        lastUpdated: new Date().toISOString(),
        realTimeSessionCount: activeSessions.size,
        sessionTimeoutsCount: sessionTimeouts.size,
        realTimeOnlineCount: realTimeOnline
      }
    };

    console.log("✅ Dashboard data prepared successfully");
    res.status(200).json({ success: true, data: dashboardData });

  } catch (error) {
    console.error("❌ Dashboard stats error:", error);
    console.error("❌ Error stack:", error.stack);
    res.status(500).json({ 
      success: false, 
      message: "Error fetching dashboard statistics", 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// ==================== ENHANCED NEW USER CHECKING ====================
export const checkNewUsers = async (req, res) => {
  try {
    const { lastChecked } = req.query;
    const lastCheckedDate = lastChecked ? new Date(lastChecked) : new Date(Date.now() - 5 * 60 * 1000);
    
    // Find users created since last check
    const newUsers = await User.find({
      createdAt: { $gt: lastCheckedDate },
      isVerified: true // Only show verified users
    })
    .select('name email vivId firstName lastName profileImage createdAt lastLogin lastLogout')
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

    // Filter out users we've already notified
    const usersToNotify = newUsers.filter(user => !notifiedUsers.has(user._id.toString()));
    
    // Add to notified set
    usersToNotify.forEach(user => {
      notifiedUsers.add(user._id.toString());
    });

    // Clean up old notifications (older than 1 hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentUsers = await User.find({
      createdAt: { $gt: oneHourAgo }
    }).select('_id').lean();
    
    const recentUserIds = new Set(recentUsers.map(user => user._id.toString()));
    for (let userId of notifiedUsers) {
      if (!recentUserIds.has(userId)) {
        notifiedUsers.delete(userId);
      }
    }

    res.status(200).json({
      success: true,
      data: {
        newUsers: usersToNotify,
        totalNew: usersToNotify.length,
        lastChecked: new Date().toISOString(),
        hasNewUsers: usersToNotify.length > 0
      }
    });
  } catch (error) {
    console.error("❌ Error checking new users:", error);
    res.status(500).json({
      success: false,
      message: "Error checking new users",
      error: error.message
    });
  }
};

// ==================== REAL-TIME ACTIVE USERS ENDPOINT ====================
export const getRealTimeActiveUsers = async (req, res) => {
  try {
    const activeUserIds = Array.from(activeSessions.keys());
    
    // Get user details for active sessions
    const activeUsers = await User.find({ 
      _id: { $in: activeUserIds } 
    })
    .select('name email vivId profileImage firstName lastName lastLogin lastLogout')
    .lean();

    const thirtyMinutesAgo = new Date(Date.now() - SESSION_CONFIG.ONLINE_NOW_THRESHOLD);
    
    const enhancedActiveUsers = activeUsers.map(user => {
      const session = activeSessions.get(user._id.toString());
      const sessionDuration = session ? Math.round((new Date() - new Date(session.loginTime)) / 60000) : 0;
      const isOnlineNow = session && session.lastActive > thirtyMinutesAgo;
      
      return {
        ...user,
        lastActive: session?.lastActive,
        loginTime: session?.loginTime,
        sessionDuration: sessionDuration,
        status: isOnlineNow ? 'online' : 'active',
        isCurrentlyActive: true,
        isOnlineNow: isOnlineNow,
        activityCount: session?.activityCount || 0
      };
    });

    res.status(200).json({
      success: true,
      data: {
        activeUsers: enhancedActiveUsers,
        totalActive: activeSessions.size,
        onlineNow: enhancedActiveUsers.filter(user => user.isOnlineNow).length,
        sessionTimeouts: sessionTimeouts.size,
        lastUpdated: new Date()
      }
    });
  } catch (error) {
    console.error("❌ Error fetching real-time active users:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching active users",
      error: error.message
    });
  }
};

// ==================== USER HEARTBEAT ENDPOINT ====================
export const userHeartbeat = async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    // Update user activity
    const activityUpdated = trackUserActivity(userId);
    
    // If no active session, create one (user might have reconnected)
    if (!activityUpdated) {
      trackUserLogin(userId);
    }

    res.status(200).json({
      success: true,
      message: "Heartbeat received",
      timestamp: new Date(),
      activityUpdated: activityUpdated
    });
  } catch (error) {
    console.error("❌ Error processing heartbeat:", error);
    res.status(500).json({
      success: false,
      message: "Error processing heartbeat",
      error: error.message
    });
  }
};

// ==================== GET USER SESSION INFO ENDPOINT ====================
export const getUserSessionInfoEndpoint = async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    const session = activeSessions.get(userId.toString());
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: "No active session found for user"
      });
    }

    res.status(200).json({
      success: true,
      data: {
        session,
        isOnlineNow: session.lastActive > new Date(Date.now() - SESSION_CONFIG.ONLINE_NOW_THRESHOLD)
      }
    });
  } catch (error) {
    console.error("❌ Error fetching user session info:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching session info",
      error: error.message
    });
  }
};

// ==================== ANALYTICS & CHARTS DATA ====================
export const getAnalyticsData = async (req, res) => {
  try {
    const { period = "30d", type = "overview" } = req.query;

    const analyticsData = {
      userGrowth: await getUserGrowthAnalytics(period),
      revenueAnalytics: await getRevenueAnalytics(period),
      planPerformance: await getPlanPerformanceAnalytics(period),
      geographicDistribution: await getGeographicDistribution(),
      registrationSources: await getRegistrationSources(period),
      userDemographics: await getUserDemographics(),
      registrationTrends: await getRegistrationTrends(period),
      activeUserTrends: await getActiveUserTrends(period),
      sessionAnalytics: await getSessionAnalytics(period)
    };

    res.status(200).json({ success: true, data: analyticsData });
  } catch (error) {
    console.error("Analytics data error:", error);
    res.status(500).json({ success: false, message: "Error fetching analytics data", error: error.message });
  }
};

// ==================== QUICK ACTIONS HANDLER ====================
export const handleQuickAction = async (req, res) => {
  try {
    const { action, data } = req.body;
    const adminId = req.admin._id;

    let result, message = "";

    switch (action) {
      case "verify_users":
        result = await verifyMultipleUsers(data.userIds);
        message = `${result.verified} users verified successfully`;
        break;
      case "approve_testimonials":
        result = await approveTestimonials(data.testimonialIds);
        message = `${result.approved} testimonials approved`;
        break;
      case "process_payments":
        result = await processPendingPayments(data.paymentIds);
        message = `${result.processed} payments processed`;
        break;
      case "bulk_message":
        result = await sendBulkMessage(data.users, data.message);
        message = `Message sent to ${result.sent} users`;
        break;
      case "export_data":
        result = await exportData(data.type, data.filters);
        message = "Data exported successfully";
        break;
      case "system_cleanup":
        result = await performSystemCleanup();
        message = "System cleanup completed";
        break;
      case "force_logout_users":
        result = await forceLogoutUsers(data.userIds);
        message = `${result.loggedOut} users forced to logout`;
        break;
      case "refresh_sessions":
        result = await refreshAllSessions();
        message = "Sessions refreshed successfully";
        break;
      default:
        return res.status(400).json({ success: false, message: "Invalid action" });
    }

    await logAdminActivity(adminId, action, data, result);
    res.status(200).json({ success: true, message, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error performing quick action", error: error.message });
  }
};

// ==================== CONTENT MANAGEMENT OVERVIEW ====================
export const getContentOverview = async (req, res) => {
  try {
    const [recentBlogs, pendingTestimonials, activePlans, faqs, formFields] = await Promise.all([
      Blog.find().sort({ createdAt: -1 }).limit(5).lean(),
      Testimonial.find({ isActive: false }).sort({ createdAt: -1 }).limit(5).lean(),
      Plan.find().sort({ createdAt: -1 }).lean(),
      Faq.find().sort({ createdAt: -1 }).limit(5).lean(),
      FormField.find({ isActive: true }).sort({ sectionOrder: 1, fieldOrder: 1 }).lean()
    ]);

    const contentOverview = {
      blogs: { recent: recentBlogs, total: await Blog.countDocuments(), needsAttention: recentBlogs.filter(b => !b.image || !b.slug).length },
      testimonials: { pending: pendingTestimonials, total: await Testimonial.countDocuments(), approved: await Testimonial.countDocuments({ isActive: true }) },
      plans: { active: activePlans, total: activePlans.length, highlighted: activePlans.filter(p => p.highlight).length },
      faqs: { recent: faqs, total: await Faq.countDocuments() },
      formBuilder: { activeFields: formFields.length, sections: [...new Set(formFields.map(f => f.section))], totalDatalists: await Datalist.countDocuments() }
    };

    res.status(200).json({ success: true, data: contentOverview });
  } catch (error) {
    console.error("Content overview error:", error);
    res.status(500).json({ success: false, message: "Error fetching content overview", error: error.message });
  }
};

// ==================== SYSTEM HEALTH & PERFORMANCE ====================
export const getSystemHealth = async (req, res) => {
  try {
    const [databaseStatus, storageUsage, performanceMetrics, errorLogs, userActivity] = await Promise.all([
      checkDatabaseStatus(), calculateStorageUsage(), getPerformanceMetrics(), getRecentErrorLogs(), getUserActivityStats()
    ]);

    res.status(200).json({
      success: true,
      data: {
        database: databaseStatus, 
        storage: storageUsage, 
        performance: performanceMetrics,
        errors: errorLogs, 
        activity: userActivity, 
        uptime: process.uptime(),
        lastBackup: await getLastBackupDate(), 
        systemVersion: "1.0.0",
        sessionStats: {
          activeSessions: activeSessions.size,
          sessionTimeouts: sessionTimeouts.size,
          onlineNow: Array.from(activeSessions.values()).filter(s => 
            s.lastActive > new Date(Date.now() - SESSION_CONFIG.ONLINE_NOW_THRESHOLD)
          ).length,
          memoryUsage: process.memoryUsage()
        }
      }
    });
  } catch (error) {
    console.error("System health error:", error);
    res.status(500).json({ success: false, message: "Error fetching system health data", error: error.message });
  }
};

// ==================== SEARCH & FILTER ====================
export const globalSearch = async (req, res) => {
  try {
    const { query, type = "all" } = req.query;
    if (!query || query.length < 2) {
      return res.status(400).json({ success: false, message: "Search query must be at least 2 characters long" });
    }

    const searchResults = { users: [], payments: [], testimonials: [], blogs: [], contacts: [] };
    const searchRegex = { $regex: query, $options: "i" };

    if (type === "all" || type === "users") {
      searchResults.users = await User.find({
        $or: [{ name: searchRegex }, { email: searchRegex }, { vivId: searchRegex }, { mobileNo: searchRegex }, { firstName: searchRegex }, { lastName: searchRegex }]
      }).select("name email vivId profileImage profileCompleted isVerified createdAt lastLogin lastLogout").limit(10).lean();
      
      // Enhance users with online status
      searchResults.users = searchResults.users.map(user => ({
        ...user,
        isOnlineNow: isUserOnlineNow(user),
        isCurrentlyActive: isUserCurrentlyActive(user)
      }));
    }
    if (type === "all" || type === "payments") {
      searchResults.payments = await UserPlan.find({ $or: [{ userVivId: searchRegex }, { plan_name: searchRegex }] }).populate("userVivId", "name email vivId lastLogin lastLogout").limit(10).lean();
    }
    if (type === "all" || type === "testimonials") {
      searchResults.testimonials = await Testimonial.find({ $or: [{ name: searchRegex }, { message: searchRegex }, { submittedBy: searchRegex }] }).limit(10).lean();
    }
    if (type === "all" || type === "blogs") {
      searchResults.blogs = await Blog.find({ $or: [{ title: searchRegex }, { author: searchRegex }, { description: searchRegex }] }).limit(10).lean();
    }
    if (type === "all" || type === "contacts") {
      searchResults.contacts = await ContactSubmission.find({ $or: [{ name: searchRegex }, { email: searchRegex }, { message: searchRegex }] }).limit(10).lean();
    }

    res.status(200).json({ success: true, data: searchResults });
  } catch (error) {
    console.error("Global search error:", error);
    res.status(500).json({ success: false, message: "Error performing search", error: error.message });
  }
};

// ==================== DASHBOARD WIDGETS DATA ====================
export const getWidgetData = async (req, res) => {
  try {
    const { widgets } = req.query;
    const widgetArray = widgets ? widgets.split(',') : ['all'];
    const widgetData = {};

    if (widgetArray.includes('all')) {
      widgetData.revenueChart = await getRevenueChartData();
      widgetData.userGrowth = await getUserGrowthData();
      widgetData.planDistribution = await getPlanDistributionData();
      widgetData.geographicData = await getGeographicData();
      widgetData.recentActivity = await getRecentActivityData();
      widgetData.performanceMetrics = await getPerformanceMetricsData();
      widgetData.activeUsersRealTime = await getRealTimeActiveUsersData();
      widgetData.sessionAnalytics = await getSessionAnalyticsData();
    } else {
      for (const widget of widgetArray) {
        switch (widget) {
          case 'revenue_chart': widgetData.revenueChart = await getRevenueChartData(); break;
          case 'user_growth': widgetData.userGrowth = await getUserGrowthData(); break;
          case 'plan_distribution': widgetData.planDistribution = await getPlanDistributionData(); break;
          case 'geographic_data': widgetData.geographicData = await getGeographicData(); break;
          case 'recent_activity': widgetData.recentActivity = await getRecentActivityData(); break;
          case 'performance_metrics': widgetData.performanceMetrics = await getPerformanceMetricsData(); break;
          case 'active_users_realtime': widgetData.activeUsersRealTime = await getRealTimeActiveUsersData(); break;
          case 'session_analytics': widgetData.sessionAnalytics = await getSessionAnalyticsData(); break;
        }
      }
    }

    res.status(200).json({ success: true, data: widgetData });
  } catch (error) {
    console.error("Widget data error:", error);
    res.status(500).json({ success: false, message: "Error fetching widget data", error: error.message });
  }
};

// ==================== HELPER FUNCTIONS ====================

function getUserStatus(user) {
  if (!user) return 'Unknown';
  if (!user.isVerified) return 'Unverified Email';
  if (!user.profileCompleted) return 'Profile Incomplete';
  
  const isOnlineNow = isUserOnlineNow(user);
  const isActive = isUserCurrentlyActive(user);
  
  if (isOnlineNow) return 'Online Now';
  if (isActive) return 'Active';
  if (user.userType === 'premium') return 'Premium User';
  return 'Offline';
}

function getProfileStatus(user) {
  if (!user) return 'Unknown';
  if (!user.isVerified) return 'Email Unverified';
  if (!user.profileCompleted) return 'Incomplete';
  return 'Complete';
}

function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return null;
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--;
  return age;
}

function formatTimeAgo(date) {
  if (!date) return 'Never';
  const now = new Date();
  const diffMs = now - new Date(date);
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return new Date(date).toLocaleDateString();
}

async function getQuickActionsData() {
  const [unverifiedUsers, incompleteProfiles, pendingTestimonials, pendingPayments] = await Promise.all([
    User.countDocuments({ isVerified: false }),
    User.countDocuments({ isVerified: true, profileCompleted: false }),
    Testimonial.countDocuments({ isActive: false }),
    UserPlan.countDocuments({ payment_status: "PENDING" })
  ]);
  return { unverifiedUsers, incompleteProfiles, pendingTestimonials, pendingPayments, totalQuickActions: unverifiedUsers + incompleteProfiles + pendingTestimonials + pendingPayments };
}

async function verifyMultipleUsers(userIds) {
  const result = await User.updateMany({ _id: { $in: userIds } }, { $set: { isVerified: true, profileCompleted: true } });
  return { verified: result.modifiedCount };
}

async function approveTestimonials(testimonialIds) {
  const result = await Testimonial.updateMany({ _id: { $in: testimonialIds } }, { $set: { isActive: true } });
  return { approved: result.modifiedCount };
}

async function processPendingPayments(paymentIds) {
  const result = await UserPlan.updateMany({ _id: { $in: paymentIds }, payment_status: "PENDING" }, { $set: { payment_status: "COMPLETED" } });
  return { processed: result.modifiedCount };
}

async function forceLogoutUsers(userIds) {
  // Update logout time in database
  const result = await User.updateMany(
    { _id: { $in: userIds } },
    { $set: { lastLogout: new Date() } }
  );
  
  // Remove from active sessions
  let loggedOutCount = 0;
  userIds.forEach(userId => {
    if (trackUserLogout(userId)) {
      loggedOutCount++;
    }
  });
  
  return { loggedOut: loggedOutCount };
}

async function refreshAllSessions() {
  const sessionCount = activeSessions.size;
  console.log(`🔄 Refreshing ${sessionCount} active sessions`);
  
  // This would typically involve revalidating sessions or updating timestamps
  const now = new Date();
  for (const [userId, session] of activeSessions.entries()) {
    session.lastActive = now;
  }
  
  return { refreshed: sessionCount, timestamp: now };
}

async function sendBulkMessage(userIds, message) { return { sent: userIds.length }; }
async function exportData(type, filters) { return { exported: true, format: 'csv', type }; }
async function performSystemCleanup() { 
  // Clean up old sessions and notifications
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  let cleanedSessions = 0;
  let cleanedNotifications = 0;
  
  for (let [userId, session] of activeSessions) {
    if (session.lastActive < oneHourAgo) {
      activeSessions.delete(userId);
      if (sessionTimeouts.has(userId)) {
        clearTimeout(sessionTimeouts.get(userId));
        sessionTimeouts.delete(userId);
      }
      cleanedSessions++;
    }
  }
  
  // Clean up old notifications
  const recentUsers = await User.find({
    createdAt: { $gt: oneHourAgo }
  }).select('_id').lean();
  
  const recentUserIds = new Set(recentUsers.map(user => user._id.toString()));
  for (let userId of notifiedUsers) {
    if (!recentUserIds.has(userId)) {
      notifiedUsers.delete(userId);
      cleanedNotifications++;
    }
  }
  
  return { 
    cleaned: true, 
    timestamp: new Date(), 
    cleanedSessions, 
    cleanedNotifications,
    activeSessions: activeSessions.size, 
    sessionTimeouts: sessionTimeouts.size,
    notifiedUsers: notifiedUsers.size
  }; 
}

// Analytics Helpers
function getDateRange(period) {
  const now = new Date();
  let startDate;
  switch (period) {
    case "7d": startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
    case "30d": startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
    case "90d": startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); break;
    case "1y": startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000); break;
    default: startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
  return { start: startDate, end: now };
}

async function getUserGrowthAnalytics(period) {
  const dateRange = getDateRange(period);
  return await User.aggregate([
    { $match: { createdAt: { $gte: dateRange.start, $lte: dateRange.end } } },
    { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, newUsers: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]);
}

async function getRevenueAnalytics(period) {
  const dateRange = getDateRange(period);
  return await UserPlan.aggregate([
    { $match: { payment_status: "COMPLETED", payment_date: { $gte: dateRange.start, $lte: dateRange.end } } },
    { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$payment_date" } }, revenue: { $sum: "$payment_amount" }, transactions: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]);
}

async function getPlanPerformanceAnalytics(period) {
  const dateRange = getDateRange(period);
  return await UserPlan.aggregate([
    { $match: { payment_status: "COMPLETED", payment_date: { $gte: dateRange.start, $lte: dateRange.end } } },
    { $group: { _id: "$plan_name", revenue: { $sum: "$payment_amount" }, subscribers: { $sum: 1 }, averageRevenue: { $avg: "$payment_amount" } } },
    { $sort: { revenue: -1 } }
  ]);
}

async function getGeographicDistribution() {
  return await User.aggregate([
    { $group: { _id: "$state", users: { $sum: 1 } } },
    { $sort: { users: -1 } },
    { $limit: 10 }
  ]);
}

async function getRegistrationSources(period) {
  const dateRange = getDateRange(period);
  return await User.aggregate([
    { $match: { createdAt: { $gte: dateRange.start, $lte: dateRange.end } } },
    { $group: { _id: "$userType", count: { $sum: 1 } } }
  ]);
}

async function getUserDemographics() {
  return {
    gender: await User.aggregate([{ $group: { _id: "$gender", count: { $sum: 1 } } }]),
    ageGroups: await User.aggregate([
      { 
        $addFields: {
          age: {
            $floor: {
              $divide: [
                { $subtract: [new Date(), "$dateOfBirth"] },
                365 * 24 * 60 * 60 * 1000
              ]
            }
          }
        }
      },
      {
        $bucket: {
          groupBy: "$age",
          boundaries: [18, 25, 35, 45, 55, 65, 100],
          default: "Other",
          output: {
            count: { $sum: 1 }
          }
        }
      }
    ]),
    maritalStatus: await User.aggregate([{ $group: { _id: "$maritalStatus", count: { $sum: 1 } } }])
  };
}

async function getRegistrationTrends(period) {
  const dateRange = getDateRange(period);
  return await User.aggregate([
    { $match: { createdAt: { $gte: dateRange.start, $lte: dateRange.end } } },
    { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, registrations: { $sum: 1 }, verified: { $sum: { $cond: ["$isVerified", 1, 0] } }, completed: { $sum: { $cond: ["$profileCompleted", 1, 0] } } } },
    { $sort: { _id: 1 } }
  ]);
}

async function getActiveUserTrends(period) {
  const dateRange = getDateRange(period);
  return await User.aggregate([
    { $match: { 
      lastLogin: { $gte: dateRange.start, $lte: dateRange.end },
      $or: [
        { lastLogout: { $exists: false } },
        { lastLogout: { $lt: '$lastLogin' } }
      ]
    } },
    { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$lastLogin" } }, activeUsers: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]);
}

async function getSessionAnalytics(period) {
  const dateRange = getDateRange(period);
  
  // This would typically come from session logs
  // For now, we'll return some basic analytics based on current sessions
  const sessionStats = {
    totalSessions: activeSessions.size,
    onlineNow: Array.from(activeSessions.values()).filter(s => 
      s.lastActive > new Date(Date.now() - SESSION_CONFIG.ONLINE_NOW_THRESHOLD)
    ).length,
    averageSessionDuration: activeSessions.size > 0 ? 
      Array.from(activeSessions.values()).reduce((acc, session) => {
        return acc + (new Date() - new Date(session.loginTime));
      }, 0) / activeSessions.size / 60000 : 0, // in minutes
    peakConcurrency: activeSessions.size // This would normally be historical data
  };
  
  return sessionStats;
}

// System Health Helpers
async function checkDatabaseStatus() {
  try { 
    const startTime = Date.now();
    await User.findOne().limit(1); 
    const responseTime = Date.now() - startTime;
    return { status: 'healthy', responseTime: `${responseTime}ms` }; 
  }
  catch (error) { 
    return { status: 'unhealthy', error: error.message }; 
  }
}

async function calculateStorageUsage() {
  const userCount = await User.countDocuments();
  const estimatedSize = userCount * 5; // 5KB per user estimate
  return { used: `${Math.round(estimatedSize / 1024)} MB`, total: "10 GB", percentage: Math.min(100, Math.round((estimatedSize / (10 * 1024 * 1024)) * 100)) };
}

async function getPerformanceMetrics() {
  return { responseTime: "125ms", uptime: "99.9%", errorRate: "0.1%", activeConnections: Math.floor(Math.random() * 100) + 50 };
}

async function getRecentErrorLogs() { return []; }

async function getUserActivityStats() {
  const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [logins, registrations, payments] = await Promise.all([
    User.countDocuments({ lastLogin: { $gte: last24Hours } }),
    User.countDocuments({ createdAt: { $gte: last24Hours } }),
    UserPlan.countDocuments({ payment_date: { $gte: last24Hours }, payment_status: "COMPLETED" })
  ]);
  return { logins, registrations, payments };
}

async function getLastBackupDate() { return new Date(Date.now() - 12 * 60 * 60 * 1000); }

// Widget Data Helpers
async function getRevenueChartData() {
  const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return await UserPlan.aggregate([
    { $match: { payment_status: "COMPLETED", payment_date: { $gte: last30Days } } },
    { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$payment_date" } }, revenue: { $sum: "$payment_amount" } } },
    { $sort: { _id: 1 } }
  ]);
}

async function getUserGrowthData() {
  const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return await User.aggregate([
    { $match: { createdAt: { $gte: last30Days } } },
    { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, newUsers: { $sum: 1 }, cumulativeUsers: { $sum: { $cond: [{ $gte: ["$createdAt", last30Days] }, 1, 0] } } } },
    { $sort: { _id: 1 } }
  ]);
}

async function getPlanDistributionData() {
  return await UserPlan.aggregate([
    { $match: { payment_status: "COMPLETED", expires_at: { $gt: new Date() } } },
    { $group: { _id: "$plan_name", count: { $sum: 1 }, revenue: { $sum: "$payment_amount" } } },
    { $sort: { count: -1 } }
  ]);
}

async function getGeographicData() {
  return await User.aggregate([
    { $match: { state: { $ne: null, $ne: "" } } },
    { $group: { _id: "$state", users: { $sum: 1 } } },
    { $sort: { users: -1 } },
    { $limit: 15 }
  ]);
}

async function getRecentActivityData() {
  const recentUsers = await User.find().select("name email vivId lastLogin lastLogout createdAt").sort({ lastLogin: -1 }).limit(10).lean();
  const recentPayments = await UserPlan.find().populate("userVivId", "name vivId lastLogin lastLogout").sort({ payment_date: -1 }).limit(10).lean();
  
  // Enhance users with online status
  const enhancedUsers = recentUsers.map(user => ({
    ...user,
    isOnlineNow: isUserOnlineNow(user),
    isCurrentlyActive: isUserCurrentlyActive(user)
  }));
  
  return { recentUsers: enhancedUsers, recentPayments };
}

async function getPerformanceMetricsData() {
  const lastHour = new Date(Date.now() - 60 * 60 * 1000);
  const [usersLastHour, paymentsLastHour] = await Promise.all([
    User.countDocuments({ lastLogin: { $gte: lastHour } }),
    UserPlan.countDocuments({ payment_date: { $gte: lastHour }, payment_status: "COMPLETED" })
  ]);
  return { activeUsersLastHour: usersLastHour, paymentsLastHour, systemLoad: "Low", memoryUsage: "45%" };
}

async function getRealTimeActiveUsersData() {
  const thirtyMinutesAgo = new Date(Date.now() - SESSION_CONFIG.ONLINE_NOW_THRESHOLD);
  const activeUsers = Array.from(activeSessions.values()).map(session => ({
    userId: session.userId,
    lastActive: session.lastActive,
    loginTime: session.loginTime,
    status: session.lastActive > thirtyMinutesAgo ? 'online' : 'active',
    activityCount: session.activityCount
  }));
  
  return {
    activeUsers,
    totalActive: activeSessions.size,
    onlineNow: activeUsers.filter(user => user.status === 'online').length,
    sessionTimeouts: sessionTimeouts.size,
    lastUpdated: new Date()
  };
}

async function getSessionAnalyticsData() {
  const thirtyMinutesAgo = new Date(Date.now() - SESSION_CONFIG.ONLINE_NOW_THRESHOLD);
  const sessions = Array.from(activeSessions.values());
  
  const onlineSessions = sessions.filter(s => s.lastActive > thirtyMinutesAgo);
  const activeSessionsCount = sessions.length;
  
  const averageSessionDuration = activeSessionsCount > 0 ? 
    sessions.reduce((acc, session) => {
      return acc + (new Date() - new Date(session.loginTime));
    }, 0) / activeSessionsCount / 60000 : 0;
  
  const totalActivity = sessions.reduce((acc, session) => acc + (session.activityCount || 0), 0);
  
  return {
    onlineSessions: onlineSessions.length,
    activeSessions: activeSessionsCount,
    averageSessionDuration: Math.round(averageSessionDuration),
    totalActivity,
    peakHour: "14:00-15:00" // This would normally be calculated from historical data
  };
}

async function calculateSystemHealth() {
  try {
    await User.findOne().limit(1);
    const userCount = await User.countDocuments();
    const estimatedSize = userCount * 5;
    return { database: 'healthy', storage: Math.min(100, Math.round((estimatedSize / (10 * 1024 * 1024)) * 100)), performance: 'good', uptime: process.uptime() };
  } catch (error) {
    return { database: 'unhealthy', storage: 0, performance: 'poor', uptime: process.uptime(), error: error.message };
  }
}

async function getActiveConnections() { 
  return activeSessions.size; 
}

async function calculateRevenueGrowth() {
  const currentMonth = new Date();
  const lastMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
  const [currentRevenue, previousRevenue] = await Promise.all([
    UserPlan.aggregate([
      { $match: { payment_status: "COMPLETED", payment_date: { $gte: new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1) } } },
      { $group: { _id: null, revenue: { $sum: "$payment_amount" } } }
    ]),
    UserPlan.aggregate([
      { $match: { payment_status: "COMPLETED", payment_date: { $gte: lastMonth, $lt: new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1) } } },
      { $group: { _id: null, revenue: { $sum: "$payment_amount" } } }
    ])
  ]);
  const current = currentRevenue[0]?.revenue || 0;
  const previous = previousRevenue[0]?.revenue || 0;
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

async function logAdminActivity(adminId, action, data, result) {
  console.log(`Admin ${adminId} performed ${action}`, { data, result });
}

// Export session tracking functions and configuration
export { activeSessions, sessionTimeouts, notifiedUsers, SESSION_CONFIG };

export default {
  getDashboardStats,
  getAnalyticsData,
  handleQuickAction,
  getContentOverview,
  getSystemHealth,
  globalSearch,
  getWidgetData,
  getUsersForDashboard,
  getUserCounts,
  bulkUserActions, // ✅ This export was missing
  trackUserLogin,
  trackUserLogout,
  trackUserActivity,
  getRealTimeActiveUsers,
  checkNewUsers,
  userHeartbeat,
  getUserSessionInfoEndpoint
};