// payAsyoy go model ke routes hai totally 
import express from "express";
import {
  createUserPlan,
  getMyActivePlan,
  getMyTransactions,
  getPlanSummary,
  unlockProfile,
  getUnlockedProfile,
  getUnlockHistory,
  getPlanCatalog,
  getFeatureCatalog,
} from "../controllers/userPlanController.js";
import userMiddleware from "../middleware/userMiddleware.js";

const router = express.Router();


router.post("/create", userMiddleware, createUserPlan);
router.post("/purchase", userMiddleware, createUserPlan);
router.get("/summary", userMiddleware, getPlanSummary);
router.post("/unlock", userMiddleware, unlockProfile);
router.get("/unlocked/:partnerId", userMiddleware, getUnlockedProfile);
router.get("/unlocks/history", userMiddleware, getUnlockHistory);
router.get("/catalog", userMiddleware, getPlanCatalog);
router.get("/features", userMiddleware, getFeatureCatalog);
router.get("/my-plan/:vivId", userMiddleware, getMyActivePlan);
router.get("/my-transactions/:vivId", userMiddleware, getMyTransactions);



export default router;