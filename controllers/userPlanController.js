import UserPlan from "../models/userPlanModel.js";
import User from "../models/userModel.js";
import ProfileUnlock from "../models/profileUnlockModel.js";
import MatchmakingPlan from "../models/MatchmakingPlan.js";

const PLAN_CATALOG = {
  starter: {
    planCode: "STARTER",
    displayName: "Starter Plan",
    price: 30,
    currency: "USD",
    profiles: 10,
    validityDays: 60,
    frequency: "monthly",
    features: [
      "10 Profile Views",
      "Basic Matching",
      "Email Support",
      "60 Days Access",
    ],
  },
  standard: {
    planCode: "STANDARD",
    displayName: "Standard Plan",
    price: 60,
    currency: "USD",
    profiles: 25,
    validityDays: 120,
    frequency: "monthly",
    features: [
      "25 Profile Views",
      "Advanced Matching",
      "Priority Support",
      "120 Days Access",
      "Message Templates",
    ],
  },
  premium: {
    planCode: "PREMIUM",
    displayName: "Premium Plan",
    price: 120,
    currency: "USD",
    profiles: 60,
    validityDays: 180,
    frequency: "yearly",
    features: [
      "60 Profile Views",
      "Premium Matching",
      "24/7 Support",
      "180 Days Access",
      "Unlimited Messages",
      "Profile Highlight",
    ],
  },
  family: {
    planCode: "FAMILY",
    displayName: "Family Plan",
    price: 400,
    currency: "USD",
    profiles: 300,
    validityDays: 365,
    frequency: "yearly",
    features: [
      "300 Profile Views",
      "Family Management Tools",
      "Dedicated Manager",
      "1 Year Access",
      "All Premium Features",
      "Custom Matching",
    ],
  },
};

const escapeRegExp = (text = "") =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const mapDbPlanToConfig = (planDoc) => {
  if (!planDoc) return null;

  const profiles =
    planDoc.profiles ??
    planDoc.profilesAllocated ??
    0;
  const validityDays =
    planDoc.validityDays ?? planDoc.validForDays ?? null;
  const normalizedFrequency = (() => {
    const unit = (planDoc.validityUnit || "").toLowerCase();
    if (unit === "years") return "yearly";
    if (unit === "months") return "monthly";
    if (unit === "quarters") return "quarterly";
    return planDoc.frequency || "custom";
  })();

  return {
    planSource: "database",
    planCode: planDoc.planCode || planDoc.planName,
    displayName:
      planDoc.planDisplayName || planDoc.planName || planDoc.planCode,
    planDisplayName:
      planDoc.planDisplayName || planDoc.planName || planDoc.planCode,
    planName: planDoc.planName || planDoc.planDisplayName || planDoc.planCode,
    plan_features: planDoc.plan_features || planDoc.features || [],
    features: planDoc.plan_features || planDoc.features || [],
    price: planDoc.price ?? planDoc.planPrice ?? 0,
    currency: planDoc.currency || planDoc.planCurrency || "USD",
    profiles,
    validityDays,
    frequency: normalizedFrequency,
    description: planDoc.description || "",
    tagline: planDoc.tagline || "",
    bestValue: planDoc.bestValue || false,
    popular: planDoc.popular || false,
  };
};

const FEATURE_CATALOG = [
  {
    id: "view_profile",
    name: "View full profile",
    description: "Unlock biodata, documents, and photos for any member",
    cost: 1,
    icon: "eye",
    category: "profiles",
  },
  {
    id: "send_message",
    name: "Send direct message",
    description: "Start a conversation with the member you like",
    cost: 1,
    icon: "message-circle",
    category: "communication",
  },
  {
    id: "express_interest",
    name: "Express interest",
    description: "Notify the member that you are interested",
    cost: 1,
    icon: "heart",
    category: "engagement",
  },
  {
    id: "view_contact",
    name: "View contact details",
    description: "Unlock phone number and email after mutual interest",
    cost: 3,
    icon: "phone",
    category: "communication",
  },
  {
    id: "priority_listing",
    name: "Priority listing",
    description: "Feature your profile in search results for 7 days",
    cost: 5,
    icon: "star",
    category: "visibility",
  },
  {
    id: "astro_report",
    name: "Astrology compatibility report",
    description: "Detailed horoscope matching with the selected profile",
    cost: 4,
    icon: "sparkles",
    category: "addons",
  },
];

// ✅ EXPORTED: Resolve plan configuration
export const resolvePlanConfig = async (inputPlan) => {
  if (!inputPlan) return null;
  const normalizedOriginal = inputPlan.toString().trim();
  const normalized = normalizedOriginal.toLowerCase();

  // Try dynamic matchmaking plans first
  const dbPlan = await MatchmakingPlan.findOne({
    isActive: true,
    $or: [
      { planCode: normalizedOriginal.toUpperCase() },
      { planCode: normalizedOriginal },
      { planCode: normalized.toUpperCase() },
      {
        planName: {
          $regex: new RegExp(`^${escapeRegExp(normalizedOriginal)}$`, "i"),
        },
      },
      {
        planDisplayName: {
          $regex: new RegExp(`^${escapeRegExp(normalizedOriginal)}$`, "i"),
        },
      },
    ],
  }).lean();

  if (dbPlan) {
    return mapDbPlanToConfig(dbPlan);
  }

  if (PLAN_CATALOG[normalized]) {
    return PLAN_CATALOG[normalized];
  }
  // Allow passing the exact code
  const match = Object.values(PLAN_CATALOG).find(
    (plan) => plan.planCode.toLowerCase() === normalized
  );
  return match || null;
};

// ✅ EXPORTED: Collect carry forward balances
export const collectCarryForwardBalances = async (vivId) => {
  const rolloverPlans = await UserPlan.find({
    userVivId: vivId,
    payment_status: "COMPLETED",
    profilesRemaining: { $gt: 0 },
    carriedForwardToPlanId: { $in: [null, undefined] },
  }).sort({ createdAt: -1 });

  const carryForwardTotal = rolloverPlans.reduce(
    (sum, plan) => sum + (plan.profilesRemaining || 0),
    0
  );

  return { rolloverPlans, carryForwardTotal };
};

// ✅ EXPORTED: Build plan summary
export const buildPlanSummary = (planDoc, userDoc = null) => {
  if (!planDoc) return null;

  const totalProfiles =
    (planDoc.profilesAllocated || 0) +
    (planDoc.profilesCarriedForwardFrom || 0);

  return {
    planId: planDoc._id,
    planCode: planDoc.plan_name,
    planName: planDoc.planDisplayName || planDoc.plan_name,
    price: planDoc.planPrice,
    currency: planDoc.planCurrency,
    paymentMode: planDoc.payment_mode,
    profilesTotal: totalProfiles,
    profilesUsed: planDoc.profilesUsed || 0,
    profilesRemaining: planDoc.profilesRemaining || 0,
    carriedForward: planDoc.profilesCarriedForwardFrom || 0,
    activatedAt: planDoc.activatedAt || planDoc.createdAt,
    expiresAt: planDoc.expires_at || null,
    validForDays: planDoc.validForDays || 0,
    userVivId: planDoc.userVivId,
    userName: userDoc?.name,
  };
};

// ✅ EXPORTED: Require authenticated user
// In userPlanController.js - Update requireAuthenticatedUser function
export const requireAuthenticatedUser = async (req) => {
  console.log('🔍 requireAuthenticatedUser called');
  console.log('🔍 Request user:', req.user);
  console.log('🔍 Request admin:', req.admin);
  console.log('🔍 User ID from request:', req.user?.userId || req.user?._id);
  
  // Check if admin is making the request (from adminMiddleware)
  if (req.admin) {
    console.log('✅ Admin request detected, returning admin as user');
    // For admin requests, return the admin object
    // Admins don't exist in User collection, so we create a user-like object
    const adminUser = {
      _id: req.admin._id,
      vivId: 'ADMIN',
      name: req.admin.adminName,
      email: req.admin.adminEmailId,
      isAdmin: true,
      role: 'admin',
      isVerified: true,
      profileCompleted: true
    };
    
    // Also set req.user for compatibility with other middleware
    req.user = adminUser;
    return adminUser;
  }

  // Check if we already have a user object (from userMiddleware)
  if (req.user && req.user._id && req.user.email) {
    console.log('✅ User already attached to request:', req.user.email);
    
    // If it's an admin user (from adminMiddleware), return as is
    if (req.user.vivId === 'ADMIN' || req.user.role === 'admin' || req.user.isAdmin === true) {
      console.log('✅ Returning admin user from request');
      return req.user;
    }
    
    // For regular users, verify they exist in User collection
    try {
      const dbUser = await User.findById(req.user._id);
      if (!dbUser) {
        console.log('❌ User not found in database with ID:', req.user._id);
        const error = new Error("User not found");
        error.statusCode = 404;
        throw error;
      }
      console.log('✅ Regular user verified in database:', dbUser.email);
      return dbUser;
    } catch (error) {
      console.error('Error verifying user:', error);
      throw error;
    }
  }

  // Fallback: check for user ID in request body/params
  const userId = req.userId || req.body.userId || req.query.userId;
  if (userId) {
    console.log('🔍 Looking for user by ID:', userId);
    const user = await User.findById(userId);
    if (!user) {
      console.log('❌ User not found with ID:', userId);
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }
    req.user = user;
    return user;
  }

  console.log('❌ No authentication found in request');
  const error = new Error("Authentication required");
  error.statusCode = 401;
  throw error;
};

// ✅ EXPORTED: Calculate expiry date
export const calculateExpiryDate = async (planCode, startDate = new Date()) => {
  const planConfig = await resolvePlanConfig(planCode);
  if (!planConfig) {
    throw new Error(`Invalid plan code: ${planCode}`);
  }

  const start = new Date(startDate);
  
  switch (planConfig.frequency) {
    case 'monthly':
      return new Date(start.setMonth(start.getMonth() + 1));
    case 'quarterly':
      return new Date(start.setMonth(start.getMonth() + 3));
    case 'yearly':
      return new Date(start.setFullYear(start.getFullYear() + 1));
    default:
      // Default to validityDays if specified
      if (planConfig.validityDays) {
        return new Date(start.getTime() + planConfig.validityDays * 24 * 60 * 60 * 1000);
      }
      throw new Error(`Unsupported plan frequency: ${planConfig.frequency}`);
  }
};

// ✅ EXPORTED: Get credits for plan
export const getCreditsForPlan = async (planCode) => {
  const planConfig = await resolvePlanConfig(planCode);
  return planConfig ? planConfig.profiles : 0;
};

// Internal helper functions (not exported)
const sanitizePartnerProfile = (userDoc) => {
  if (!userDoc) return null;
  const safeUser = userDoc.toObject ? userDoc.toObject() : userDoc;
  let formData = {};
  if (safeUser.formData) {
    if (safeUser.formData instanceof Map) {
      formData = Object.fromEntries(safeUser.formData);
    } else if (typeof safeUser.formData === "object") {
      formData = safeUser.formData;
    }
  }

  return {
    _id: safeUser._id,
    vivId: safeUser.vivId,
    name: safeUser.name,
    email: safeUser.email,
    profileImage: safeUser.profileImage,
    profileCompleted: safeUser.profileCompleted,
    isVerified: safeUser.isVerified,
    formData,
  };
};

const ensureProfileAccess = (user) => {
  if (!user.isVerified) {
    const error = new Error("Please verify your email before purchasing a plan");
    error.statusCode = 403;
    throw error;
  }

  if (!user.profileCompleted) {
    const error = new Error("Complete your profile to purchase matchmaking plans");
    error.statusCode = 403;
    throw error;
  }
};

const fetchLatestPlanForUser = async (vivId) => {
  return UserPlan.findOne({
    userVivId: vivId,
    payment_status: "COMPLETED",
  })
    .sort({ createdAt: -1 })
    .lean();
};

// ✅ EXPORTED: Create user plan
export const createUserPlan = async (req, res) => {
  try {
    const user = await requireAuthenticatedUser(req);
    ensureProfileAccess(user);

    const {
      planKey,
      plan_name: planNameFromBody,
      payment_mode = "RAZORPAY",
      payment_reference,
    } = req.body;

    const planConfig = await resolvePlanConfig(planKey || planNameFromBody);
    if (!planConfig) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid plan selected. Use starter, standard, premium or family.",
      });
    }

    const { rolloverPlans, carryForwardTotal } =
      await collectCarryForwardBalances(user.vivId);

    const totalProfiles = planConfig.profiles + carryForwardTotal;
    const expiresAt = planConfig.validityDays
      ? new Date(Date.now() + planConfig.validityDays * 24 * 60 * 60 * 1000)
      : null;

    const plan = await UserPlan.create({
      userVivId: user.vivId,
      plan_name: planConfig.planCode,
      planDisplayName: planConfig.displayName,
      planPrice: planConfig.price,
      planCurrency: planConfig.currency,
      plan_frequency: planConfig.frequency,
      payment_mode: payment_mode.toUpperCase(),
      payment_amount: planConfig.price,
      payment_reference,
      payment_status: "COMPLETED",
      plan_features: planConfig.features,
      expires_at: expiresAt,
      validForDays: planConfig.validityDays,
      profilesAllocated: planConfig.profiles,
      profilesRemaining: totalProfiles,
      profilesCarriedForwardFrom: carryForwardTotal,
    });

    if (rolloverPlans.length > 0) {
      await Promise.all(
        rolloverPlans.map((rolloverPlan) =>
          UserPlan.findByIdAndUpdate(rolloverPlan._id, {
            $set: {
              profilesTransferredOut: rolloverPlan.profilesRemaining,
              profilesRemaining: 0,
              profilesCarryForwardedAt: new Date(),
              carriedForwardToPlanId: plan._id,
            },
          })
        )
      );
    }

    user.currentPlan = planConfig.displayName;
    user.planExpiresAt = expiresAt;
    user.isPremium = true;
    user.lastPlanActivated = new Date();
    user.currentPlanProfilesTotal = totalProfiles;
    user.currentPlanProfilesRemaining = totalProfiles;
    user.currentPlanProfilesUsed = 0;
    await user.save({ validateBeforeSave: false });

    res.status(201).json({
      success: true,
      message: "Plan activated successfully",
      data: {
        plan: buildPlanSummary(plan, user),
      },
    });
  } catch (error) {
    console.error("Create Plan Error:", error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Server error while creating plan",
    });
  }
};

// ✅ EXPORTED: Get plan summary
export const getPlanSummary = async (req, res) => {
  try {
    const user = await requireAuthenticatedUser(req);
    const plan = await fetchLatestPlanForUser(user.vivId);

    if (!plan) {
      return res.json({
        success: true,
        data: {
          plan: null,
          isActive: false,
        },
      });
    }

    res.json({
      success: true,
      data: {
        plan: buildPlanSummary(plan, user),
        isActive: plan.isActive,
      },
    });
  } catch (error) {
    console.error("Plan summary error:", error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Unable to load plan summary",
    });
  }
};

// ✅ EXPORTED: Get my active plan
export const getMyActivePlan = async (req, res) => {
  try {
    const { vivId } = req.params;
    if (!vivId) {
      return res.status(400).json({
        success: false,
        message: "VIV ID is required as URL parameter",
      });
    }

    const requestingUser = await requireAuthenticatedUser(req);
    if (
      requestingUser.role !== "admin" &&
      requestingUser.vivId.toUpperCase() !== vivId.toUpperCase()
    ) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to view another user's plan",
      });
    }

    const user = await User.findOne({ vivId: vivId.toUpperCase() });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found with this VIV ID",
      });
    }

    const plan = await fetchLatestPlanForUser(vivId.toUpperCase());
    if (!plan) {
      return res.json({
        success: true,
        plan: null,
        isActive: false,
        currentPlan: "Free",
        planExpiresAt: null,
        message: "No active plan found",
      });
    }

    res.json({
      success: true,
      plan,
      isActive: plan.isActive,
      currentPlan: user.currentPlan || plan.plan_name,
      planExpiresAt: user.planExpiresAt || plan.expires_at,
    });
  } catch (error) {
    console.error("Get Active Plan Error:", error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Unable to fetch plan",
    });
  }
};

// ✅ EXPORTED: Get my transactions
export const getMyTransactions = async (req, res) => {
  try {
    const { vivId } = req.params;
    if (!vivId) {
      return res.status(400).json({
        success: false,
        message: "VIV ID is required as URL parameter",
      });
    }

    const requestingUser = await requireAuthenticatedUser(req);
    if (
      requestingUser.role !== "admin" &&
      requestingUser.vivId.toUpperCase() !== vivId.toUpperCase()
    ) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to view another user's transactions",
      });
    }

    const user = await User.findOne({ vivId: vivId.toUpperCase() });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found with this VIV ID",
      });
    }

    const transactions = await UserPlan.find({
      userVivId: vivId.toUpperCase(),
    })
      .sort({ payment_date: -1, createdAt: -1 })
      .select(
        "plan_name planDisplayName payment_amount payment_date payment_status plan_frequency plan_features expires_at isActive profilesAllocated profilesUsed profilesRemaining profilesCarriedForwardFrom validForDays"
      )
      .lean();

    res.json({
      success: true,
      totalTransactions: transactions.length,
      user: {
        vivId: user.vivId,
        name: user.name,
        currentPlan: user.currentPlan,
      },
      transactions,
    });
  } catch (error) {
    console.error("Get Transactions Error:", error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Unable to fetch transactions",
    });
  }
};

// ✅ EXPORTED: Unlock profile
export const unlockProfile = async (req, res) => {
  try {
    const viewer = await requireAuthenticatedUser(req);
    ensureProfileAccess(viewer);

    const { partnerId } = req.body;
    if (!partnerId) {
      return res.status(400).json({
        success: false,
        message: "partnerId is required",
      });
    }

    const partner = await User.findById(partnerId);
    if (!partner || !partner.profileCompleted || !partner.isVerified) {
      return res.status(404).json({
        success: false,
        message: "Requested profile is not available",
      });
    }

    let plan = await UserPlan.findOne({
      userVivId: viewer.vivId,
      payment_status: "COMPLETED",
    }).sort({ createdAt: -1 });

    if (!plan) {
      return res.status(403).json({
        success: false,
        message: "Purchase a plan to unlock profiles",
      });
    }

    if (plan.expires_at && new Date(plan.expires_at) < new Date()) {
      return res.status(403).json({
        success: false,
        message: "Your plan has expired. Please purchase a new plan.",
      });
    }

    let unlockRecord = await ProfileUnlock.findOne({
      viewerUserId: viewer._id,
      targetUserId: partner._id,
    });
    const unlockAlreadyExists = !!unlockRecord;

    if (!unlockRecord) {
      const updatedPlan = await UserPlan.findOneAndUpdate(
        {
          _id: plan._id,
          profilesRemaining: { $gt: 0 },
        },
        {
          $inc: {
            profilesRemaining: -1,
            profilesUsed: 1,
          },
        },
        { new: true }
      );

      if (!updatedPlan) {
        return res.status(403).json({
          success: false,
          message: "You have exhausted your profile views. Purchase a new plan.",
        });
      }

      plan = updatedPlan;

      unlockRecord = await ProfileUnlock.create({
        viewerUserId: viewer._id,
        viewerVivId: viewer.vivId,
        targetUserId: partner._id,
        targetVivId: partner.vivId,
        planId: plan._id,
        cost: 1,
      });

      viewer.currentPlanProfilesRemaining = plan.profilesRemaining;
      viewer.currentPlanProfilesUsed = plan.profilesUsed;
      await viewer.save({ validateBeforeSave: false });
    }

    res.json({
      success: true,
      message: "Profile unlocked successfully",
      data: {
        unlockId: unlockRecord._id,
        profile: sanitizePartnerProfile(partner),
        plan: buildPlanSummary(plan, viewer),
        alreadyUnlocked: unlockAlreadyExists,
        cost: unlockRecord.cost || 1,
      },
    });
  } catch (error) {
    console.error("Unlock profile error:", error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Unable to unlock profile",
    });
  }
};

// ✅ EXPORTED: Get unlocked profile
export const getUnlockedProfile = async (req, res) => {
  try {
    const viewer = await requireAuthenticatedUser(req);
    const { partnerId } = req.params;

    if (!partnerId) {
      return res.status(400).json({
        success: false,
        message: "partnerId is required",
      });
    }

    const unlockRecord = await ProfileUnlock.findOne({
      viewerUserId: viewer._id,
      targetUserId: partnerId,
    });

    if (!unlockRecord) {
      return res.status(403).json({
        success: false,
        message: "You have not unlocked this profile yet",
      });
    }

    const partner = await User.findById(partnerId);
    if (!partner) {
      return res.status(404).json({
        success: false,
        message: "Profile not found or no longer available",
      });
    }

    res.json({
      success: true,
      data: sanitizePartnerProfile(partner),
    });
  } catch (error) {
    console.error("Get unlocked profile error:", error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Unable to load profile",
    });
  }
};

// ✅ EXPORTED: Get unlock history
export const getUnlockHistory = async (req, res) => {
  try {
    const viewer = await requireAuthenticatedUser(req);
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "25", 10), 1), 100);

    const [records, total, aggregateStats] = await Promise.all([
      ProfileUnlock.find({ viewerUserId: viewer._id })
        .sort({ unlockedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate({
          path: "targetUserId",
          select:
            "vivId name email profileImage profileCompleted isVerified gender religion city state country maritalStatus occupation formData",
        })
        .populate({
          path: "planId",
          select: "plan_name planDisplayName planPrice planCurrency profilesAllocated profilesRemaining plan_features",
        })
        .lean(),
      ProfileUnlock.countDocuments({ viewerUserId: viewer._id }),
      ProfileUnlock.aggregate([
        { $match: { viewerUserId: viewer._id } },
        {
          $group: {
            _id: null,
            totalCost: { $sum: "$cost" },
            lastUnlockedAt: { $max: "$unlockedAt" },
          },
        },
      ]),
    ]);

    const statsDoc = aggregateStats[0] || { totalCost: 0, lastUnlockedAt: null };

    const history = records.map((record) => ({
      id: record._id,
      unlockedAt: record.unlockedAt,
      cost: record.cost,
      plan: record.planId
        ? {
            id: record.planId._id,
            code: record.planId.plan_name,
            name: record.planId.planDisplayName || record.planId.plan_name,
          }
        : null,
      profile: sanitizePartnerProfile(record.targetUserId),
    }));

    res.json({
      success: true,
      data: {
        history,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        },
        stats: {
          totalUnlocked: total,
          totalCreditsUsed: statsDoc.totalCost || 0,
          lastUnlockedAt: statsDoc.lastUnlockedAt,
        },
      },
    });
  } catch (error) {
    console.error("Unlock history error:", error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Unable to fetch unlock history",
    });
  }
};

// ✅ EXPORTED: Get plan catalog
// ✅ EXPORTED: Get plan catalog - ONLY DATABASE DATA
export const getPlanCatalog = async (_req, res) => {
  try {
    // Fetch only active plans from database
    const dbPlans = await MatchmakingPlan.find({ isActive: true })
      .sort({ order: 1, createdAt: -1 })
      .lean();

    // If no plans in database, return empty array with message
    if (!dbPlans || dbPlans.length === 0) {
      return res.json({
        success: true,
        data: {
          plans: [], // Empty array instead of fallback
          lastUpdated: new Date(),
          source: "database",
          message: "No subscription plans are currently available. Please check back later."
        },
      });
    }

    // Map database plans to the expected format
    const plans = dbPlans.map((plan) => {
      const key = (plan.planCode || "").toLowerCase();
      const profiles = plan.profiles || plan.profilesAllocated || 0;
      const price = plan.price || plan.planPrice || 0;
      
      return {
        id: key,
        planCode: plan.planCode,
        planName: plan.planName,
        planDisplayName: plan.planDisplayName || plan.planName,
        displayName: plan.planDisplayName || plan.planName,
        tagline: plan.tagline || plan.description || "",
        description: plan.description || plan.tagline || "",
        price: price,
        planPrice: price,
        currency: plan.currency || "USD",
        planCurrency: plan.currency || "USD",
        profiles: profiles,
        profilesAllocated: profiles,
        validityDays: plan.validityDays,
        validForDays: plan.validityDays,
        frequency: plan.validityUnit === "days" ? "monthly" : "yearly",
        features: plan.features || plan.plan_features || [],
        plan_features: plan.plan_features || plan.features || [],
        popular: plan.popular || false,
        bestValue: plan.bestValue || false,
        creditRate: price > 0 && profiles > 0 
          ? `$${(price / profiles).toFixed(2)} per credit`
          : null,
      };
    });

    return res.json({
      success: true,
      data: {
        plans,
        lastUpdated: new Date(),
        source: "database",
      },
    });
    
  } catch (error) {
    console.error("Plan catalog error:", error);
    // Return empty array on error - NO STATIC FALLBACK
    return res.status(500).json({
      success: false,
      data: {
        plans: [], // Empty array
        lastUpdated: new Date(),
        source: "database-error",
      },
      message: "Unable to load plans. Please try again later."
    });
  }
};

// ✅ EXPORTED: Get feature catalog
export const getFeatureCatalog = async (_req, res) => {
  try {
    res.json({
      success: true,
      data: {
        features: FEATURE_CATALOG,
        lastUpdated: new Date(),
      },
    });
  } catch (error) {
    console.error("Feature catalog error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to load feature catalog",
    });
  }
};