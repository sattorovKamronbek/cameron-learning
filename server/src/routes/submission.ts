import express from "express";
import { requireAuth } from "../middleware/auth";
import { requirePracticeAuth } from "../middleware/practiceAuth";
import { submitSolution, getSubmission, listSubmissions } from "../controllers/submissionController";
import { previewPracticeSolution } from "../controllers/practicePreviewController";
import { practicePreviewRateLimiter } from "../middleware/rateLimiter";

const router = express.Router();

router.post("/practice-preview", requirePracticeAuth, practicePreviewRateLimiter, previewPracticeSolution);
router.post("/contests/:contestId/problems/:problemId/submit", requireAuth, submitSolution);
router.post("/problems/:problemId/submit", requireAuth, submitSolution); // practice submit without contest
router.get("/:id", requireAuth, getSubmission);
router.get("/", requireAuth, listSubmissions);

export default router;
