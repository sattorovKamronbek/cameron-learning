import rateLimit from "express-rate-limit";

function positiveIntegerFromEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export const authRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, slow down" }
});

export const generalRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, slow down" }
});

// Generator runs consume isolated compiler containers. Keep this deliberately
// tighter than ordinary API traffic to prevent resource exhaustion.
export const generatorRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many testcase generation requests, try again later" },
});

// AI formatting and Chromium rendering are comparatively expensive. This is
// mounted after authentication, so a user id can be used as the stable key.
export const contestPdfRateLimiter = rateLimit({
  windowMs: positiveIntegerFromEnv("CONTEST_PDF_RATE_WINDOW_MS", 15 * 60 * 1000),
  max: positiveIntegerFromEnv("CONTEST_PDF_RATE_LIMIT", 6),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as typeof req & { user?: { sub?: string } }).user?.sub || req.ip || "unknown",
  message: { error: "Too many PDF generation requests, try again later" },
});

export const practicePreviewRateLimiter = rateLimit({
  windowMs: positiveIntegerFromEnv("PRACTICE_PREVIEW_RATE_WINDOW_MS", 15 * 60 * 1000),
  max: positiveIntegerFromEnv("PRACTICE_PREVIEW_RATE_LIMIT", 20),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as typeof req & { user?: { sub?: string } }).user?.sub || req.ip || "unknown",
  message: { error: "Too many practice preview requests, try again later" },
});
