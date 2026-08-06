import express from "express";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { getNotifications, postNotification, readNotification, subscribeNotifications } from "../controllers/notificationController";

const router = express.Router();

router.use(requireAuth);
router.get("/", getNotifications);
router.post("/", requireRole(["ADMIN", "JUDGE"]), postNotification);
router.post("/:id/read", readNotification);
router.get("/subscribe", subscribeNotifications);

export default router;
