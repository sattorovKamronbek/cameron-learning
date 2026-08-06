import express from "express";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../index";

const router = express.Router();
router.use(requireAuth);

router.get("/me", async (req: any, res) => {
  const userId = req.user?.sub;
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { achievements: true, notifications: true, savedCourses: true, savedProblems: true, certificates: true, activities: true } });
  if (!user) return res.status(404).json({ error: "User not found" });
  // Hide sensitive fields
  // @ts-ignore
  delete user.passwordHash;
  res.json({ user });
});

export default router;
