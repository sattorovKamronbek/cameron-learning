import { Request, Response, NextFunction } from "express";
import { prisma } from "../index";
import { AuthRequest } from "./auth";

export function requireRole(roles: string[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const userId = (req.user as any).sub;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    if (user.isSuspended || user.isBanned) return res.status(403).json({ error: "Account suspended or banned" });
    if (!roles.includes(user.role)) return res.status(403).json({ error: "Insufficient role" });
    // Admin panel extra check: ensure admin's email is in allowlist
    if (user.role === "ADMIN") {
      const allow = await prisma.adminAllowlist.findUnique({ where: { email: user.email } });
      if (!allow) return res.status(403).json({ error: "Admin not allowlisted" });
    }
    return next();
  };
}
