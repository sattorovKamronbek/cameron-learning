import express from "express";
import { generateContestProblemPdf } from "../controllers/contestProblemPdfController";
import { requireAuth } from "../middleware/auth";
import { contestPdfRateLimiter } from "../middleware/rateLimiter";
import { requireRole } from "../middleware/rbac";

const router = express.Router();

// This endpoint deliberately receives only editor-entered public statement and
// public examples. It never reads hidden tests or jury solutions from storage.
router.post("/generate", requireAuth, requireRole(["ADMIN", "JUDGE"]), contestPdfRateLimiter, generateContestProblemPdf);

export default router;
