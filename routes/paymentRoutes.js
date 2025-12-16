// ye payment paypal ke routes hai isme 
import express from "express";
import {
  createPayPalOrder,
  capturePayPalOrder,
  getUserTransactions,
  getTransactionById,
} from "../controllers/paymentController.js";
import userMiddleware from "../middleware/userMiddleware.js";

const router = express.Router();

// PayPal payment routes
router.post("/create-paypal-order", userMiddleware, createPayPalOrder);
router.post("/capture-paypal-order", userMiddleware, capturePayPalOrder);

// Transaction history routes
router.get("/transactions/:vivId", userMiddleware, getUserTransactions);
router.get("/transaction/:transactionId", userMiddleware, getTransactionById);



export default router;