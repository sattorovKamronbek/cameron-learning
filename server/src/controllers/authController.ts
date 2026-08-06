import { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import { registerUser, authenticateUser, signAccessToken, signRefreshToken, createSession, destroySession, getSession, verifyAccessToken } from "../services/authService";
import { prisma } from "../index";
import { sendEmail } from "../services/emailService";

export const validateRegister = [
  body("email").isEmail(),
  body("password").isLength({ min: 8 }),
  body("name").optional().isString(),
];

export async function register(req: Request, res: Response) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { email, password, name } = req.body;
  try {
    const user = await registerUser(email, password, name);
    // issue email verification token
    const token = signAccessToken({ sub: user.id, type: "email_verification" });
    const verifyUrl = `${req.protocol}://${req.get("host")}/api/auth/verify-email?token=${token}`;
    await sendEmail(email, "Verify your email", `<p>Please verify: <a href=\"${verifyUrl}\">${verifyUrl}</a></p>`);
    return res.status(201).json({ message: "Registered. Check email to verify." });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
}

export const validateLogin = [body("email").isEmail(), body("password").isString()];
export async function login(req: Request, res: Response) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { email, password } = req.body;
  try {
    const user = await authenticateUser(email, password);
    const access = signAccessToken({ sub: user.id, role: user.role });
    const refresh = signRefreshToken({ sub: user.id });
    await createSession(user.id, refresh, req.ip, req.get("User-Agent") || undefined);
    // set httpOnly cookie
    res.cookie("refreshToken", refresh, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/auth",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    });
    return res.json({ accessToken: access });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
}

export async function logout(req: Request, res: Response) {
  const token = req.cookies?.refreshToken || req.body?.refreshToken;
  if (token) {
    await destroySession(token);
    res.clearCookie("refreshToken", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/auth" });
  }
  return res.json({ message: "Logged out" });
}

export async function verifyEmail(req: Request, res: Response) {
  const { token } = req.query as any;
  if (!token) return res.status(400).json({ error: "Missing token" });
  try {
    const decoded: any = verifyAccessToken(token);
    if (decoded?.type !== "email_verification") return res.status(400).json({ error: "Invalid token" });
    await prisma.user.update({ where: { id: decoded.sub }, data: { emailVerified: true } });
    return res.json({ message: "Email verified" });
  } catch (err: any) {
    return res.status(400).json({ error: "Invalid or expired token" });
  }
}

export async function refreshToken(req: Request, res: Response) {
  const token = req.cookies?.refreshToken || req.body?.refreshToken;
  if (!token) return res.status(401).json({ error: "Missing refresh token" });
  try {
    const decoded: any = (await import("jsonwebtoken")).verify(token, process.env.JWT_REFRESH_SECRET!);
    const session = await getSession(token);
    if (!session || session.userId !== decoded.sub || session.user.isSuspended) throw new Error("Invalid session");
    // Rotate refresh tokens to limit replay if a token is compromised.
    await destroySession(token);
    const refresh = signRefreshToken({ sub: session.user.id });
    await createSession(session.user.id, refresh, req.ip, req.get("User-Agent") || undefined);
    res.cookie("refreshToken", refresh, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/auth",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    });
    const access = signAccessToken({ sub: session.user.id, role: session.user.role });
    return res.json({ accessToken: access });
  } catch (err: any) {
    return res.status(401).json({ error: "Invalid refresh token" });
  }
}
