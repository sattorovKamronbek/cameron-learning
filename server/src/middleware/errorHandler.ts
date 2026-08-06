import { Request, Response, NextFunction } from "express";

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: err?.message || "Internal Server Error" });
}
