import express from "express";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import {
  createCheatingAppeal,
  listCheatingCases,
  listMyCheatingAppeals,
  resolveCheatingCase,
  reviewCheatingAppeal,
} from "../controllers/integrityController";

const router = express.Router();

router.use(requireAuth);
router.get("/appeals/me", listMyCheatingAppeals);
router.post("/cases/:id/appeal", createCheatingAppeal);

router.get("/cases", requireRole(["ADMIN"]), listCheatingCases);
router.post("/cases/:id/resolve", requireRole(["ADMIN"]), resolveCheatingCase);
router.post("/appeals/:id/review", requireRole(["ADMIN"]), reviewCheatingAppeal);

export default router;
