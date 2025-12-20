// ye payment paypal ke routes hai isme 
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
import userMiddleware from "../middleware/userMiddleware.js";

const router = express.Router();

// PayPal payment routes
router.post("/create-paypal-order", userMiddleware, createPayPalOrder);
router.post("/capture-paypal-order", userMiddleware, capturePayPalOrder);

// Transaction history routes
router.get("/transactions/:vivId", userMiddleware, getUserTransactions);
router.get("/transaction/:transactionId", userMiddleware, getTransactionById);
router.get("/plan-purchases", userMiddleware, getAllPlanPurchases);  


// NEW PAYMENT MANAGEMENT ROUTES FOR ADMIN 
// yha se admin ke pass matcmakingplanuser ki payment details show ho rhi hai is 3 routes se 
router.get("/history/:vivId", userMiddleware, getUserPaymentHistory);
router.get("/summary/:vivId", userMiddleware, getPaymentSummary);
router.delete("/:transactionId", userMiddleware, deletePaymentRecord);
router.get("/pdf/:transactionId", userMiddleware, downloadTransactionPDF);


export default router;