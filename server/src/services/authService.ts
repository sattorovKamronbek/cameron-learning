import { prisma, redis } from "../index";
import jwt, { type Secret, type SignOptions } from "jsonwebtoken";
import crypto from "crypto";
import dotenv from "dotenv";
import { hashPassword, verifyPassword } from "../utils/hash";

dotenv.config();

function requiredSecret(name: "JWT_ACCESS_SECRET" | "JWT_REFRESH_SECRET"): Secret {
  const value = process.env[name];
  if (!value || value.length < 32) {
    throw new Error(`${name} must be configured with at least 32 characters`);
  }
  return value;
}

const ACCESS_SECRET = requiredSecret("JWT_ACCESS_SECRET");
const REFRESH_SECRET = requiredSecret("JWT_REFRESH_SECRET");
const ACCESS_EXPIRES = (process.env.ACCESS_TOKEN_EXPIRES_IN || "15m") as SignOptions["expiresIn"];
const REFRESH_EXPIRES = (process.env.REFRESH_TOKEN_EXPIRES_IN || "7d") as SignOptions["expiresIn"];

export function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function signAccessToken(payload: object) {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES });
}

export function signRefreshToken(payload: object) {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES });
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, ACCESS_SECRET);
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, REFRESH_SECRET);
}

export async function registerUser(email: string, password: string, name?: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("Email already registered");
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({ data: { email, passwordHash, name } });
  return user;
}

export async function authenticateUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("Invalid credentials");
  if (user.isSuspended) throw new Error("Account suspended");
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) throw new Error("Invalid credentials");
  return user;
}

export async function createSession(userId: string, refreshToken: string, ip?: string, userAgent?: string, expiresAt?: Date) {
  const exp = expiresAt || new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7d
  const tokenHash = hashRefreshToken(refreshToken);
  await prisma.session.create({ data: { userId, refreshToken: tokenHash, ip, userAgent, expiresAt: exp } });
  // Save a mapping in redis for quick invalidation
  try {
    await redis.set(`refresh:${tokenHash}`, userId, { EX: 60 * 60 * 24 * 7 });
  } catch (err) {
    console.warn("Redis not available:", err);
  }
}

export async function destroySession(refreshToken: string) {
  const tokenHash = hashRefreshToken(refreshToken);
  await prisma.session.deleteMany({ where: { refreshToken: tokenHash } });
  try {
    await redis.del(`refresh:${tokenHash}`);
  } catch (err) {}
}

export async function getSession(refreshToken: string) {
  const tokenHash = hashRefreshToken(refreshToken);
  const session = await prisma.session.findUnique({ where: { refreshToken: tokenHash }, include: { user: true } });
  if (!session || session.expiresAt <= new Date()) return null;
  return session;
}
