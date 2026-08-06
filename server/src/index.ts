import express from "express";
import dotenv from "dotenv";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { PrismaClient } from "@prisma/client";
import { createClient } from "redis";
import authRoutes from "./routes/auth";
import adminRoutes from "./routes/admin";
import profileRoutes from "./routes/profile";
import contestRoutes from "./routes/contest";
import problemRoutes from "./routes/problem";
import submissionRoutes from "./routes/submission";
import courseRoutes from "./routes/courses";
import progressRoutes from "./routes/progress";
import notificationRoutes from "./routes/notifications";
import analyticsRoutes from "./routes/analytics";
import { errorHandler } from "./middleware/errorHandler";
import { generalRateLimiter, authRateLimiter } from "./middleware/rateLimiter";
import { sanitizeMiddleware } from "./middleware/sanitize";

dotenv.config();

const app = express();
app.use(helmet());
const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
if (process.env.NODE_ENV === "production" && allowedOrigins.length === 0) {
  throw new Error("CORS_ORIGIN must list allowed browser origins in production");
}
app.use(cors({
  origin(origin, callback) {
    // Non-browser clients have no Origin header. Browser clients must be explicitly allowed.
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Origin is not allowed by CORS"));
  },
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
// global middlewares
app.use(sanitizeMiddleware);
app.use(generalRateLimiter);
// apply stricter rate limits to auth endpoints later when mounting

// Prisma client
export const prisma = new PrismaClient();

// Redis client (for sessions / refresh tokens)
export const redis = createClient({ url: process.env.REDIS_URL });
redis.connect().catch((err) => console.error("Redis connect error:", err));

// Routes
app.use("/api/auth", authRateLimiter, authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/contests", contestRoutes);
app.use("/api/problems", problemRoutes);
app.use("/api/submissions", authRateLimiter, submissionRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/progress", progressRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/analytics", analyticsRoutes);

app.use(errorHandler);

const port = process.env.PORT || 4000;
app.listen(port, async () => {
  console.log(`Server listening on ${port}`);
  try {
    await prisma.$connect();
    console.log("Connected to database");
    // start judge worker in background; import dynamically so worker code doesn't block startup
    import("./worker/judgeWorker").then(mod => {
      try { mod.default.loop(); } catch (e) { console.warn("Judge worker failed to start:", e); }
    }).catch(e => console.warn("Judge worker import failed:", e));
  } catch (err) {
    console.error("Prisma connection error:", err);
  }
});
