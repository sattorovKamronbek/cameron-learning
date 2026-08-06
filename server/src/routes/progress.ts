import express from "express";
import { requireAuth } from "../middleware/auth";
import { enrollInCourse, markLessonComplete, getProgress } from "../controllers/progressController";

const router = express.Router();

router.post("/:id/enroll", requireAuth, enrollInCourse);
router.post("/lesson/:lessonId/complete", requireAuth, markLessonComplete);
router.get("/:id/progress", requireAuth, getProgress);

export default router;
