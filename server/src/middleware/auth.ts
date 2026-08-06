import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../services/authService";
import { redis } from "../index";

export interface AuthRequest extends Request {
  user?: any;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: "Missing Authorization" });
  const parts = auth.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return res.status(401).json({ error: "Invalid Authorization" });
  try {
    const payload: any = verifyAccessToken(parts[1] as string);
    req.user = payload;
    // update last seen in redis for online users
    try {
      const uid = (payload as any).sub;
      if (uid) {
        const key = `user:lastseen:${uid}`;
        redis.set(key, String(Date.now()), { EX: 60 * 5 }).catch(()=>{});
        // also add to a set of online users with expiry via key count
      }
    } catch (e) {}
    return next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
