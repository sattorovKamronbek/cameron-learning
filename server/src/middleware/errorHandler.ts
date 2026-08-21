import { Request, Response, NextFunction } from "express";

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  console.error(err);
  if (res.headersSent) return next(err);
  if (err?.type === "entity.too.large") return res.status(413).json({ error: "Request payload is too large" });
  res.status(500).json({ error: err?.message || "Internal Server Error" });
}
