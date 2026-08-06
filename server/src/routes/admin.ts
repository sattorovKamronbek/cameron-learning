import express from "express";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import {
  getStats,
  listUsers,
  getUser,
  createUser,
  updateUser,
  assignRole,
  bulkSuspendUsers,
  bulkDeleteUsers,
  deleteUser,
  listCoursesAdmin,
  listProblemsAdmin,
  listSubmissionsAdmin,
  rejudgeSubmission,
  bulkRejudge,
  listAuditLogs,
  getSetting,
  upsertSetting,
  searchAll
} from "../controllers/adminController";

const router = express.Router();

// All admin routes require valid auth and admin role
router.use(requireAuth);
router.use(requireRole(["ADMIN"]));

router.get("/stats", getStats);

// users
router.get("/users", listUsers);
router.get("/users/:id", getUser);
router.post("/users", createUser);
router.put("/users/:id", updateUser);
router.post("/users/:id/assign-role", assignRole);
router.post("/users/bulk-suspend", bulkSuspendUsers);
router.post("/users/bulk-delete", bulkDeleteUsers);
router.delete("/users/:id", deleteUser);

// courses/problems/submissions
router.get("/courses", listCoursesAdmin);
router.get("/problems", listProblemsAdmin);
router.get("/submissions", listSubmissionsAdmin);
router.post("/submissions/:id/rejudge", rejudgeSubmission);
router.post("/submissions/bulk-rejudge", bulkRejudge);

// audit & settings
router.get("/audit", listAuditLogs);
router.get("/settings/:key", getSetting);
router.put("/settings/:key", upsertSetting);

// global search
router.get("/search", searchAll);

export default router;
