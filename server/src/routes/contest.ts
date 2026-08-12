import express from "express";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { createContest, editContest, publishContest, archiveContest, deleteContest, listContests, getContest } from "../controllers/contestController";

const router = express.Router();

// public
router.get("/", listContests);
router.get("/:id", getContest);

// admin
router.post("/", requireAuth, requireRole(["ADMIN", "JUDGE"]), createContest);
router.put("/:id", requireAuth, requireRole(["ADMIN", "JUDGE"]), editContest);
router.post("/:id/publish", requireAuth, requireRole(["ADMIN", "JUDGE"]), publishContest);
router.post("/:id/archive", requireAuth, requireRole(["ADMIN", "JUDGE"]), archiveContest);
router.delete("/:id", requireAuth, requireRole(["ADMIN", "JUDGE"]), deleteContest);

export default router;
