import { NextFunction, Response } from "express";
import { AuthRequest } from "./auth";
import { verifyAccessToken } from "../services/authService";

type SupabaseUser = { id?: unknown };

/**
 * The learner-facing app uses Supabase sessions while the legacy judge API
 * also supports its own JWT sessions. Practice preview has no Prisma problem
 * lookup, so accepting either verified session is safe and keeps the runner
 * usable from the actual Practice UI.
 */
export async function requirePracticeAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authorization = req.headers.authorization;
  if (!authorization) return res.status(401).json({ error: "Kirish talab qilinadi" });
  const [scheme, token] = authorization.split(" ");
  if (scheme !== "Bearer" || !token) return res.status(401).json({ error: "Kirish tokeni noto‘g‘ri" });
  try {
    req.user = verifyAccessToken(token);
    return next();
  } catch {
    // Continue with the Supabase verifier used by the frontend session.
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(503).json({ error: "Practice runner auth sozlanmagan" });
  }
  try {
    const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/user`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return res.status(401).json({ error: "Kirish sessiyasi tugagan. Qayta kiring." });
    const user = await response.json() as SupabaseUser;
    if (typeof user.id !== "string" || !user.id) return res.status(401).json({ error: "Kirish sessiyasi noto‘g‘ri" });
    req.user = { sub: user.id, provider: "supabase" };
    return next();
  } catch {
    return res.status(503).json({ error: "Kirish sessiyasini tekshirib bo‘lmadi" });
  }
}
