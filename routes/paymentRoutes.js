import express from "express";
import {
  createPayPalOrder,
  capturePayPalOrder,
  getUserTransactions,
  getTransactionById,
  getAllPlanPurchases,
  deletePaymentRecord,
  getUserPaymentHistory,
  getPaymentSummary,
  downloadTransactionPDF
} from "../controllers/paymentController.js";
import adminMiddleware from "../middleware/adminMiddleware.js";
import userMiddleware from "../middleware/userMiddleware.js";

const router = express.Router();

// ✅ PayPal payment routes
router.post("/create-paypal-order", userMiddleware, createPayPalOrder);
router.post("/capture-paypal-order", userMiddleware, capturePayPalOrder);

// ✅ Transaction history routes (for users)
router.get("/transactions/:vivId", userMiddleware, getUserTransactions);
router.get("/transaction/:transactionId", userMiddleware, getTransactionById);

// ✅ ADMIN DASHBOARD ROUTES - Use adminMiddleware only
router.get("/plan-purchases", adminMiddleware, getAllPlanPurchases);

// ✅ User payment management routes
router.get("/history/:vivId", userMiddleware, getUserPaymentHistory);
router.get("/summary/:vivId", userMiddleware, getPaymentSummary);

// ✅ Delete payment record (admin only - fixed middleware)
router.delete("/:transactionId", adminMiddleware, deletePaymentRecord);

// ✅ Download PDF (both admin and user)
router.get("/pdf/:transactionId", userMiddleware, downloadTransactionPDF);

export default router;