// Ye controllers PayPal payment banane, confirm karne, credits add karne aur user ki transaction 
// history dikhane ka full backend system handle karte hain

import { client, createOrder, captureOrder } from '../utils/paypalClient.js';
import PDFDocument from 'pdfkit';
import Transaction from '../models/paymentModel.js';
import UserPlan from '../models/userPlanModel.js';
import User from '../models/userModel.js';
import sendEmail from '../middleware/sendMail.js';
import { sendPaymentSuccessEmail } from '../middleware/paymentInvoiceService.js';

import { 
  requireAuthenticatedUser, 
  buildPlanSummary, 
  resolvePlanConfig, 
  collectCarryForwardBalances,
  calculateExpiryDate ,
} from './userPlanController.js';

// Create PayPal order
export const createPayPalOrder = async (req, res) => {
  let transaction = null;
  
  try {
    console.log('🔍 createPayPalOrder called with body:', req.body);
    
    const user = await requireAuthenticatedUser(req);
    console.log('🔍 User authenticated:', user.vivId);
    
    const { planKey, planCode, amount, currency = 'USD' } = req.body;

    // Validate required fields
    if (!planKey && !planCode) {
      console.log('❌ Missing planKey and planCode');
      return res.status(400).json({
        success: false,
        message: "Plan key or code is required",
      });
    }

    const planConfig = await resolvePlanConfig(planKey || planCode);
    if (!planConfig) {
      console.log('❌ Invalid plan config for:', planKey || planCode);
      return res.status(400).json({
        success: false,
        message: "Invalid plan selected",
      });
    }
    console.log('✅ Plan config found:', planConfig);

    // Get frontend URL
    let frontendUrl = process.env.FRONTEND_URI || 'http://localhost:5173';
    console.log('🔍 Using frontend URL:', frontendUrl);

    // Create transaction record
    transaction = await Transaction.create({
      userVivId: user.vivId,
      userId: user._id,
      planId: planConfig.planCode,
      planCode: planConfig.planCode,
      planName: planConfig.displayName,
      amount: parseFloat(amount),
      currency: currency,
      paymentGateway: "PAYPAL",
      paymentMode: "ONLINE",
      status: 'PENDING',
      transactionType: 'PLAN_PURCHASE',
      creditsAllocated: planConfig.profiles,
      purchasedProfiles: planConfig.profiles, // 🔥 RECEIPT SNAPSHOT
      metadata: {
        planConfig: planConfig,
        userInfo: {
          name: user.name,
          email: user.email
        },
        frontendUrl: frontendUrl
      }
    });

    console.log('✅ Transaction created:', transaction._id);

    // Create PayPal order
    const customId = `VIV_${user.vivId}_${planConfig.planCode}_${transaction._id}`;
    
    const orderData = {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: currency,
          value: amount.toString()
        },
        description: `Purchase of ${planConfig.displayName} plan`,
        custom_id: customId
      }],
      application_context: {
        brand_name: "Vivahanam",
        landing_page: "BILLING",
        user_action: "PAY_NOW",
        return_url: `${frontendUrl}/payment-success?transactionId=${transaction._id}`,
        cancel_url: `${frontendUrl}/payment-cancelled?transactionId=${transaction._id}`
      }
    };

    console.log('🔍 Creating PayPal order with data:', JSON.stringify(orderData, null, 2));
    
    // Ab hum full orderData backend PayPal SDK ko de rahe hain
    const order = await createOrder(orderData);
    console.log('✅ PayPal order created:', order.id);
    
    // Update transaction with PayPal order ID
    transaction.paypalOrderId = order.id;
    transaction.status = 'CREATED';
    transaction.metadata.paypalOrder = {
      id: order.id,
      status: order.status,
      create_time: order.create_time,
      links: order.links
    };
    await transaction.save();

    console.log('✅ Transaction updated with PayPal order ID');

    // Find the approval URL
    const approvalLink = order.links.find(link => link.rel === 'approve');
    if (!approvalLink) {
      throw new Error('No approval URL found in PayPal response');
    }

    res.json({
      success: true,
      orderID: order.id,
      transactionId: transaction._id,
      approvalUrl: approvalLink.href,
      data: {
        transaction: transaction,
        paypalOrder: order
      }
    });

  } catch (error) {
    console.error('❌ PayPal order creation error:', error);
    console.error('❌ Error stack:', error.stack);
    
    // Update transaction status to failed if it was created
    if (transaction && transaction._id) {
      try {
        await Transaction.findByIdAndUpdate(transaction._id, {
          status: 'FAILED',
          failureReason: error.message || 'PayPal order creation failed',
          metadata: {
            ...(transaction.metadata || {}),
            error: {
              message: error.message,
              stack: error.stack,
              timestamp: new Date()
            }
          }
        });
        console.log('✅ Updated transaction status to FAILED:', transaction._id);
      } catch (updateError) {
        console.error('❌ Failed to update transaction status:', updateError);
      }
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create PayPal order: ' + error.message
    });
  }
};

// Get all completed plan purchases (admin only) with filters
// ✅ Get all completed plan purchases (admin only) with filters
// In getAllPlanPurchases function - REPLACE the entire function with this:

export const getAllPlanPurchases = async (req, res) => {
  try {
    console.log('🔍 getAllPlanPurchases - Admin check:', req.admin?.adminEmailId);
    
    // For admin routes, we need to handle admin authentication differently
    if (!req.admin) {
      console.log('❌ No admin object in request');
      
      try {
        const adminUser = await requireAuthenticatedUser(req);
        console.log('✅ Got user from requireAuthenticatedUser:', adminUser.email);
        
        if (!adminUser.isAdmin && adminUser.role !== 'admin') {
          return res.status(403).json({
            success: false,
            message: 'Only admin can view all plan purchases',
          });
        }
      } catch (authError) {
        console.error('Auth error:', authError.message);
        return res.status(403).json({
          success: false,
          message: 'Admin authentication required',
        });
      }
    }

    // Extract parameters
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "25", 10), 1), 100);
    const { year, month, vivId, status } = req.query;

    console.log('🔍 Query params:', { page, limit, year, month, vivId, status });

    // Build query
    let query = {};

    // Check different possible status fields
    const sampleTx = await Transaction.findOne({});
    if (sampleTx) {
      if (sampleTx.status !== undefined) {
        query.status = status || 'COMPLETED';
      } else if (sampleTx.payment_status !== undefined) {
        query.payment_status = status || 'COMPLETED';
      }
    } else {
      query.status = 'COMPLETED';
    }

    // Filter by VIV ID
    if (vivId && vivId.trim() !== '') {
      query.userVivId = vivId.toUpperCase();
    }

    // Filter by year and month
    if (year || month) {
      query.completedAt = {};
      
      if (year) {
        const startDate = new Date(`${year}-01-01T00:00:00.000Z`);
        const endDate = new Date(`${parseInt(year) + 1}-01-01T00:00:00.000Z`);
        query.completedAt.$gte = startDate;
        query.completedAt.$lt = endDate;
      }
      
      if (month) {
        const currentYear = year || new Date().getFullYear();
        const startDate = new Date(`${currentYear}-${month.padStart(2, '0')}-01T00:00:00.000Z`);
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 1);
        
        if (query.completedAt.$gte) {
          if (query.completedAt.$gte < startDate) query.completedAt.$gte = startDate;
        } else {
          query.completedAt.$gte = startDate;
        }
        
        if (query.completedAt.$lt) {
          if (query.completedAt.$lt > endDate) query.completedAt.$lt = endDate;
        } else {
          query.completedAt.$lt = endDate;
        }
      }
    }

    console.log('🔍 Final query:', JSON.stringify(query, null, 2));

    // Get total count
    const total = await Transaction.countDocuments(query);
    console.log('🔍 Total matching transactions:', total);

    // Get paginated results
    const skip = (page - 1) * limit;
    const transactions = await Transaction.find(query)
      .sort({ completedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-__v')
      .lean();

    console.log('🔍 Found transactions:', transactions.length);

    // Enrich transactions with user and plan data
    const enrichedTransactions = await Promise.all(
      transactions.map(async (tx) => {
        try {
          console.log(`🔍 Processing transaction ${tx._id}`);
          console.log('🔍 User VIV ID from tx:', tx.userVivId);
          console.log('🔍 User ID from tx:', tx.userId);

          // Get user data - FIXED: properly find user
          let userData = null;
          if (tx.userId && tx.userId.toString().match(/^[0-9a-fA-F]{24}$/)) {
            console.log(`🔍 Looking up user by ObjectId: ${tx.userId}`);
            userData = await User.findById(tx.userId).select('name email vivId profileImage').lean();
          }
          
          // If still not found, try by VIV ID
          if (!userData && tx.userVivId) {
            console.log(`🔍 Looking up user by VIV ID: ${tx.userVivId}`);
            userData = await User.findOne({ vivId: tx.userVivId }).select('name email vivId profileImage').lean();
          }
          
          console.log('🔍 Found user data:', userData);

          // Get UserPlan data
          let userPlanData = null;
          if (tx._id) {
            console.log(`🔍 Looking up user plan for transaction: ${tx._id}`);
            userPlanData = await UserPlan.findOne({
              $or: [
                { transactionId: tx._id },
                { payment_reference: tx.paymentReference }
              ]
            })
            .select('planDisplayName plan_frequency expires_at profilesAllocated profilesRemaining validForDays isActive')
            .lean();
            console.log('🔍 Found user plan data:', userPlanData);
          }

          // Ensure amount and currency fields exist
          const amount = tx.amount || tx.planPrice || 0;
          const currency = tx.currency || tx.planCurrency || 'USD';
          const planName = tx.planName || tx.planDisplayName || tx.plan_name || 'N/A';
          const planCode = tx.planCode || tx.planId || 'N/A';

          // Get validity from metadata if available
          let validityDays = null;
          if (tx.metadata?.planConfig?.validityDays) {
            validityDays = tx.metadata.planConfig.validityDays;
          } else if (userPlanData?.validForDays) {
            validityDays = userPlanData.validForDays;
          }

          // Build user object with fallbacks
          const userObject = {
            _id: userData?._id || null,
            name: userData?.name || 
                  tx.metadata?.userInfo?.name || 
                  (tx.userVivId ? `User ${tx.userVivId}` : 'Unknown User'),
            email: userData?.email || tx.metadata?.userInfo?.email || 'N/A',
            vivId: userData?.vivId || tx.userVivId || 'N/A',
            profileImage: userData?.profileImage || null
          };

          // Build userPlan object
          const userPlanObject = userPlanData ? {
            displayName: userPlanData.planDisplayName,
            frequency: userPlanData.plan_frequency,
            expiresAt: userPlanData.expires_at,
            profilesAllocated: userPlanData.profilesAllocated,
            profilesRemaining: userPlanData.profilesRemaining,
            validForDays: userPlanData.validForDays || validityDays,
            isActive: userPlanData.isActive
          } : null;

          console.log('🔍 Final enriched object for transaction:', {
            id: tx._id,
            user: userObject,
            validity: validityDays
          });

          return {
            ...tx,
            amount: amount,
            currency: currency,
            planName: planName,
            planCode: planCode,
            planDisplayName: planName,
            purchasedProfiles: tx.purchasedProfiles || tx.creditsAllocated || 0,
            user: userObject,
            userPlan: userPlanObject
          };
        } catch (error) {
          console.error(`❌ Error enriching transaction ${tx._id}:`, error);
          return {
            ...tx,
            amount: tx.amount || 0,
            currency: tx.currency || 'USD',
            planName: tx.planName || 'N/A',
            planCode: tx.planCode || 'N/A',
            user: {
              vivId: tx.userVivId || 'N/A',
              name: tx.userVivId ? `User ${tx.userVivId}` : 'Unknown User',
              email: 'N/A'
            },
            userPlan: null
          };
        }
      })
    );

    // Debug: show what we're sending
    console.log('🔍 Sending enriched transactions:', enrichedTransactions.length);
    if (enrichedTransactions.length > 0) {
      console.log('🔍 First transaction sample:', JSON.stringify(enrichedTransactions[0], null, 2));
    }

    res.json({
      success: true,
      data: {
        transactions: enrichedTransactions,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        },
        filters: {
          year: year || null,
          month: month || null,
          vivId: vivId || null
        }
      },
      message: enrichedTransactions.length === 0 
        ? "No plan purchases found with current filters" 
        : `Found ${enrichedTransactions.length} plan purchase(s)`
    });

  } catch (error) {
    console.error('❌ Get all plan purchases (admin) error:', error);
    console.error('❌ Error stack:', error.stack);
    
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Unable to fetch plan purchases',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Capture PayPal payment and activate plan
export const capturePayPalOrder = async (req, res) => {
  try {
    const user = await requireAuthenticatedUser(req);
    const { orderID, transactionId } = req.body;

    console.log('🔍 Capturing PayPal order:', orderID, 'for transaction:', transactionId);

    // ─────────────────────────────────────────────
    // Idempotency check (unchanged)
    // ─────────────────────────────────────────────
    const existingTx = await Transaction.findById(transactionId);
    if (!existingTx) {
      throw new Error("Transaction not found");
    }

    if (existingTx.status === 'COMPLETED') {
      console.log('ℹ️ Transaction already completed, returning existing plan/credits');

      let existingPlan = null;
      if (existingTx.metadata?.userPlanId) {
        existingPlan = await UserPlan.findById(existingTx.metadata.userPlanId);
      } else {
        existingPlan = await UserPlan.findOne({ transactionId: existingTx._id });
      }

      return res.json({
        success: true,
        message: 'Payment was already captured earlier',
        data: {
          transaction: existingTx,
          userPlan: existingPlan ? buildPlanSummary(existingPlan, user) : null,
          paypalCapture: null
        }
      });
    }

    const existingPlanForTx = await UserPlan.findOne({ transactionId });
    if (existingPlanForTx) {
      console.log('ℹ️ UserPlan already exists for this transaction, skipping new plan creation');
      return res.json({
        success: true,
        message: 'Payment was already captured earlier',
        data: {
          transaction: existingTx,
          userPlan: buildPlanSummary(existingPlanForTx, user),
          paypalCapture: null
        }
      });
    }

    // ─────────────────────────────────────────────
    // Capture payment
    // ─────────────────────────────────────────────
    const capture = await captureOrder(orderID);
    console.log('✅ PayPal capture completed:', capture.id);
    
    if (capture.status === 'COMPLETED') {
      const transaction = await Transaction.findById(transactionId);
      if (!transaction) {
        throw new Error("Transaction not found");
      }

      // Update transaction record
      const updatedTransaction = await Transaction.findByIdAndUpdate(
        transactionId,
        {
          status: 'COMPLETED',
          paypalCaptureId: capture.id,
          payerEmail: capture.payer?.email_address,
          payerId: capture.payer?.payer_id,
          paymentDetails: capture.purchase_units[0]?.payments?.captures[0],
          completedAt: new Date(),
          paymentReference: `PAYPAL_${capture.id}`
        },
        { new: true }
      );

      // Get plan config
      const planConfig = await resolvePlanConfig(transaction.planCode);
      
      // Collect carry forward balances
      const { rolloverPlans, carryForwardTotal } = await collectCarryForwardBalances(user.vivId);
      const totalProfiles = planConfig.profiles + carryForwardTotal;
      const expiresAt = await calculateExpiryDate(planConfig.planCode);

      // Create user plan with transaction reference
      const planData = {
        userVivId: user.vivId,
        plan_name: planConfig.planCode,
        planDisplayName: planConfig.displayName,
        planPrice: planConfig.price,
        planCurrency: planConfig.currency,
        plan_frequency: planConfig.frequency,
        payment_mode: "PAYPAL",
        payment_amount: planConfig.price,
        payment_reference: `PAYPAL_${capture.id}`,
        payment_status: "COMPLETED",
        plan_features: planConfig.features,
        expires_at: expiresAt,
        validForDays: planConfig.validityDays,
        profilesAllocated: planConfig.profiles,
        profilesRemaining: totalProfiles,
        profilesCarriedForwardFrom: carryForwardTotal,
        transactionId: transaction._id
      };

      const plan = await UserPlan.create(planData);

      // Handle carry forward
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

      // Update user document
      await User.findByIdAndUpdate(user._id, {
        currentPlan: planConfig.displayName,
        planExpiresAt: expiresAt,
        isPremium: true,
        lastPlanActivated: new Date(),
        currentPlanProfilesTotal: totalProfiles,
        currentPlanProfilesRemaining: totalProfiles,
        currentPlanProfilesUsed: 0
      });

      // Update transaction with final details
      await Transaction.findByIdAndUpdate(transactionId, {
        creditsAllocated: transaction.purchasedProfiles,
        metadata: {
          ...transaction.metadata,
          userPlanId: plan._id,
          carryForward: carryForwardTotal,
          finalCredits: transaction.purchasedProfiles
        }
      });

      // ─────────────────────────────────────────────
      // ✅ SEND PAYMENT SUCCESS EMAIL WITH INVOICE
      // This runs after payment is confirmed but before sending response
      // ─────────────────────────────────────────────
      const emailResult = await sendPaymentSuccessEmail({
        user,
        transaction: updatedTransaction,
        planConfig,
        paypalCapture: capture,
        frontendUrl: transaction.metadata?.frontendUrl || process.env.FRONTEND_URI || 'http://localhost:5173'
      });

      console.log('📧 Email sending result:', emailResult);

      // Prepare response
      const response = {
        success: true,
        message: 'Payment captured and plan activated successfully',
        data: {
          transaction: updatedTransaction,
          userPlan: buildPlanSummary(plan, user),
          paypalCapture: capture,
          emailNotification: emailResult
        }
      };

      res.json(response);
    } else {
      // Payment failed
      await Transaction.findByIdAndUpdate(transactionId, {
        status: 'FAILED',
        failureReason: 'Payment not completed by PayPal'
      });
      
      res.status(400).json({
        success: false,
        message: 'Payment not completed'
      });
    }
  } catch (error) {
    console.error('PayPal capture error:', error);
    
    // Update transaction as failed
    if (req.body.transactionId) {
      await Transaction.findByIdAndUpdate(req.body.transactionId, {
        status: 'FAILED',
        failureReason: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Payment capture failed: ' + error.message
    });
  }
};
// Get user transaction history
export const getUserTransactions = async (req, res) => {
  try {
    const user = await requireAuthenticatedUser(req);
    const { vivId } = req.params;

    if (user.vivId !== vivId && user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to view another user's transactions"
      });
    }

    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "25", 10), 1), 100);

    const [transactions, total] = await Promise.all([
      Transaction.find({ userVivId: vivId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Transaction.countDocuments({ userVivId: vivId })
    ]);

    res.json({
      success: true,
      data: {
        transactions,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        }
      }
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Unable to fetch transactions'
    });
  }
};

// Get transaction by ID
export const getTransactionById = async (req, res) => {
  try {
    const user = await requireAuthenticatedUser(req);
    const { transactionId } = req.params;

    const transaction = await Transaction.findById(transactionId)
      .populate('userId', 'name email vivId')
      .lean();

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found"
      });
    }

    if (transaction.userVivId !== user.vivId && user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to view this transaction"
      });
    }

    res.json({
      success: true,
      data: {
        transaction
      }
    });
  } catch (error) {
    console.error('Get transaction error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Unable to fetch transaction'
    });
  }
};







// paymentController.js - ADD THESE NEW FUNCTIONS

// Get user's payment history with plan details

export const getUserPaymentHistory = async (req, res) => {
  try {
    const user = await requireAuthenticatedUser(req);
    const { vivId } = req.params;

    if (user.vivId !== vivId && user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to view another user's payments"
      });
    }

    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "10", 10), 1), 50);

    // Get transactions with payment details
    const [transactions, total] = await Promise.all([
      Transaction.find({ 
        userVivId: vivId,
        status: 'COMPLETED'
      })
        .sort({ completedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('_id planName planCode amount currency purchasedProfiles completedAt paymentReference paymentGateway status')
        .lean(),
      Transaction.countDocuments({ 
        userVivId: vivId,
        status: 'COMPLETED'
      })
    ]);

    // Get user plans for each transaction
    const paymentHistory = await Promise.all(
      transactions.map(async (tx) => {
        const userPlan = await UserPlan.findOne({ 
          userVivId: vivId,
          $or: [
            { transactionId: tx._id },
            { payment_reference: tx.paymentReference }
          ]
        })
        .select('planDisplayName plan_frequency expires_at profilesAllocated profilesRemaining isActive')
        .lean();

        return {
          transactionId: tx._id,
          invoiceNumber: `INV-${tx._id.toString().slice(-8).toUpperCase()}`,
          planName: tx.planName,
          planCode: tx.planCode,
          amount: tx.amount,
          currency: tx.currency,
          profiles: tx.purchasedProfiles,
          paymentDate: tx.completedAt,
          paymentMethod: tx.paymentGateway,
          paymentReference: tx.paymentReference,
          status: tx.status,
          userPlan: userPlan ? {
            displayName: userPlan.planDisplayName,
            frequency: userPlan.plan_frequency,
            expiresAt: userPlan.expires_at,
            profilesAllocated: userPlan.profilesAllocated,
            profilesRemaining: userPlan.profilesRemaining,
            isActive: userPlan.isActive
          } : null
        };
      })
    );

    res.json({
      success: true,
      data: {
        payments: paymentHistory,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        },
        summary: {
          totalPayments: total,
          totalAmount: paymentHistory.reduce((sum, payment) => sum + payment.amount, 0),
          activePlans: paymentHistory.filter(p => p.userPlan?.isActive).length
        }
      }
    });
  } catch (error) {
    console.error('Get payment history error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Unable to fetch payment history'
    });
  }
};

//  Delete a payment record (admin only or user's own)
 
export const deletePaymentRecord = async (req, res) => {
  try {
    const user = await requireAuthenticatedUser(req);
    const { transactionId } = req.params;

    // Find transaction
    const transaction = await Transaction.findById(transactionId);
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    // Check permission
    if (transaction.userVivId !== user.vivId && user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to delete this transaction'
      });
    }

    // Admin can delete completed transactions, regular users cannot
    if (transaction.status === 'COMPLETED' && user.role !== 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete completed transactions. Please contact admin.'
      });
    }

    // Delete transaction
    await Transaction.findByIdAndDelete(transactionId);

    // Also delete associated user plan if exists
    await UserPlan.findOneAndDelete({ transactionId });

    res.json({
      success: true,
      message: 'Payment record deleted successfully',
      data: {
        deletedTransactionId: transactionId
      }
    });

  } catch (error) {
    console.error('Delete payment error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Unable to delete payment record'
    });
  }
};

//  Get payment summary for user

export const getPaymentSummary = async (req, res) => {
  console.log("payment n aaya ")
  try {
    const user = await requireAuthenticatedUser(req);
    const { vivId } = req.params;

    if (user.vivId !== vivId && user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to view another user's payment summary"
      });
    }

    const [transactions, activePlans] = await Promise.all([
      Transaction.find({ 
        userVivId: vivId,
        status: 'COMPLETED'
      })
      .select('amount currency completedAt planName')
      .lean(),
      
      UserPlan.find({ 
        userVivId: vivId,
        payment_status: 'COMPLETED',
        expires_at: { $gt: new Date() }
      })
      .select('planDisplayName expires_at profilesRemaining')
      .lean()
    ]);

    const totalAmount = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    const lastPayment = transactions.length > 0 
      ? transactions.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))[0]
      : null;

    res.json({
      success: true,
      data: {
        totalTransactions: transactions.length,
        totalAmount,
        currency: transactions[0]?.currency || 'USD',
        activePlans: activePlans.length,
        lastPayment: lastPayment ? {
          date: lastPayment.completedAt,
          amount: lastPayment.amount,
          plan: lastPayment.planName
        } : null,
        activePlanDetails: activePlans.map(plan => ({
          name: plan.planDisplayName,
          expiresAt: plan.expires_at,
          profilesRemaining: plan.profilesRemaining
        }))
      }
    });
  } catch (error) {
    console.error('Get payment summary error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Unable to fetch payment summary'
    });
  }
};

// Download PDF invoice for a transaction (admin or user)
export const downloadTransactionPDF = async (req, res) => {
  try {
    const user = await requireAuthenticatedUser(req);
    const { transactionId } = req.params;

    const transaction = await Transaction.findById(transactionId)
      .populate('userId', 'name email vivId')
      .lean();

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    // Check permission
    if (transaction.userVivId !== user.vivId && user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view this transaction'
      });
    }

    // Get UserPlan if exists
    const userPlan = await UserPlan.findOne({
      $or: [
        { transactionId: transaction._id },
        { payment_reference: transaction.paymentReference }
      ]
    }).lean();

    // Create PDF
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const buffers = [];
    
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(buffers);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="Invoice_${transaction._id}.pdf"`);
      res.send(pdfBuffer);
    });

    // PDF Content
    doc.fontSize(20).fillColor('#16a34a').text('Vivahanam - Payment Receipt', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).fillColor('#111827');
    doc.text(`Transaction ID: ${transaction._id}`);
    doc.text(`Invoice #: INV-${transaction._id.toString().slice(-8).toUpperCase()}`);
    doc.moveDown();
    doc.text(`User Name: ${transaction.userId?.name || 'N/A'}`);
    doc.text(`Email: ${transaction.userId?.email || 'N/A'}`);
    doc.text(`VIV ID: ${transaction.userId?.vivId || transaction.userVivId}`);
    doc.moveDown();
    doc.text(`Plan Name: ${transaction.planName || 'N/A'}`);
    doc.text(`Plan Code: ${transaction.planCode || 'N/A'}`);
    doc.text(`Profiles: ${transaction.purchasedProfiles || transaction.creditsAllocated || 0}`);
    doc.text(`Amount: ${transaction.currency || 'USD'} ${transaction.amount}`);
    if (userPlan) {
      doc.text(`Validity: ${userPlan.validForDays || 'N/A'} days`);
      doc.text(`Expires At: ${userPlan.expires_at ? new Date(userPlan.expires_at).toLocaleDateString() : 'N/A'}`);
    }
    doc.moveDown();
    doc.text(`Payment Method: ${transaction.paymentGateway || 'N/A'}`);
    doc.text(`Payment Reference: ${transaction.paymentReference || 'N/A'}`);
    doc.text(`Payment Date: ${transaction.completedAt ? new Date(transaction.completedAt).toLocaleString() : 'N/A'}`);
    doc.text(`Status: ${transaction.status || 'N/A'}`);
    doc.moveDown();
    doc.fontSize(10).fillColor('#6b7280');
    doc.text('This is a system-generated receipt. It is not a tax invoice.', { align: 'center' });
    doc.text(`© ${new Date().getFullYear()} Vivahanam. All rights reserved.`, { align: 'center' });

    doc.end();
  } catch (error) {
    console.error('PDF download error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Unable to generate PDF'
    });
  }
};
