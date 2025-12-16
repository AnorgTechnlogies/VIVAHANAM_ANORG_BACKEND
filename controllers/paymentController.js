// Ye controllers PayPal payment banane, confirm karne, credits add karne aur user ki transaction 
// history dikhane ka full backend system handle karte hain

import { client, createOrder, captureOrder } from '../utils/paypalClient.js';
import Transaction from '../models/paymentModel.js';
import UserPlan from '../models/userPlanModel.js';
import User from '../models/userModel.js';
import { 
  requireAuthenticatedUser, 
  buildPlanSummary, 
  resolvePlanConfig, 
  collectCarryForwardBalances,
  calculateExpiryDate 
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
    
    const order = await createOrder(amount, currency, customId);
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

// Capture PayPal payment and activate plan
export const capturePayPalOrder = async (req, res) => {
  try {
    const user = await requireAuthenticatedUser(req);
    const { orderID, transactionId } = req.body;

    console.log('🔍 Capturing PayPal order:', orderID, 'for transaction:', transactionId);

    const capture = await captureOrder(orderID);
    console.log('✅ PayPal capture completed:', capture.id);
    
    if (capture.status === 'COMPLETED') {
      // Get transaction details
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
        creditsAllocated: totalProfiles,
        metadata: {
          ...transaction.metadata,
          userPlanId: plan._id,
          carryForward: carryForwardTotal,
          finalCredits: totalProfiles
        }
      });

      res.json({
        success: true,
        message: 'Payment captured and plan activated successfully',
        data: {
          transaction: updatedTransaction,
          userPlan: buildPlanSummary(plan, user),
          paypalCapture: capture
        }
      });
    } else {
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