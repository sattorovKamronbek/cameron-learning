import express from "express";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { getPlatformAnalytics, getUsageByDay } from "../controllers/analyticsController";

const router = express.Router();

// analytics is admin-only
router.use(requireAuth);
router.use(requireRole(["ADMIN"]));

router.get("/platform", getPlatformAnalytics);
router.get("/usage", getUsageByDay);

export default router;
