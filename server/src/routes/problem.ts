import express from "express";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { generatorRateLimiter } from "../middleware/rateLimiter";
import { createProblem, editProblem, deleteProblem, getProblem, addTestCase, generateTestCases } from "../controllers/problemController";

const router = express.Router();

router.get("/:id", getProblem);

// admin/problem manager
router.post("/", requireAuth, requireRole(["ADMIN", "JUDGE"]), createProblem);
router.put("/:id", requireAuth, requireRole(["ADMIN", "JUDGE"]), editProblem);
router.delete("/:id", requireAuth, requireRole(["ADMIN"]), deleteProblem);
router.post("/:id/testcase", requireAuth, requireRole(["ADMIN", "JUDGE"]), addTestCase);
router.post("/:id/testcase-generator", requireAuth, requireRole(["ADMIN", "JUDGE"]), generatorRateLimiter, generateTestCases);

export default router;
