import express from "express";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { createProblem, editProblem, deleteProblem, getProblem, addTestCase } from "../controllers/problemController";

const router = express.Router();

router.get("/:id", getProblem);

// admin/problem manager
router.post("/", requireAuth, requireRole(["ADMIN", "JUDGE"]), createProblem);
router.put("/:id", requireAuth, requireRole(["ADMIN", "JUDGE"]), editProblem);
router.delete("/:id", requireAuth, requireRole(["ADMIN"]), deleteProblem);
router.post("/:id/testcase", requireAuth, requireRole(["ADMIN", "JUDGE"]), addTestCase);

export default router;
