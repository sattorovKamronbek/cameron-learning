import express from "express";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { createCourse, editCourse, publishCourse, unpublishCourse, archiveCourse, deleteCourse, listCourses, getCourse, addChapter, addLesson } from "../controllers/courseController";

const router = express.Router();

// public
router.get("/", listCourses);
router.get("/:id", getCourse);

// instructor/admin
router.post("/", requireAuth, requireRole(["ADMIN", "JUDGE"]), createCourse);
router.put("/:id", requireAuth, requireRole(["ADMIN", "JUDGE"]), editCourse);
router.post("/:id/publish", requireAuth, requireRole(["ADMIN", "JUDGE"]), publishCourse);
router.post("/:id/unpublish", requireAuth, requireRole(["ADMIN", "JUDGE"]), unpublishCourse);
router.post("/:id/archive", requireAuth, requireRole(["ADMIN", "JUDGE"]), archiveCourse);
router.delete("/:id", requireAuth, requireRole(["ADMIN", "JUDGE"]), deleteCourse);
router.post("/:id/chapters", requireAuth, requireRole(["ADMIN", "JUDGE"]), addChapter);
router.post("/chapters/:chapterId/lessons", requireAuth, requireRole(["ADMIN", "JUDGE"]), addLesson);

export default router;
