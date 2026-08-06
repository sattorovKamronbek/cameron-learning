import express from "express";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { createContest, editContest, publishContest, archiveContest, deleteContest, listContests, getContest } from "../controllers/contestController";

const router = express.Router();

// public
router.get("/", listContests);
router.get("/:id", getContest);

// admin
router.post("/", requireAuth, requireRole(["ADMIN"]), createContest);
router.put("/:id", requireAuth, requireRole(["ADMIN"]), editContest);
router.post("/:id/publish", requireAuth, requireRole(["ADMIN"]), publishContest);
router.post("/:id/archive", requireAuth, requireRole(["ADMIN"]), archiveContest);
router.delete("/:id", requireAuth, requireRole(["ADMIN"]), deleteContest);

export default router;
