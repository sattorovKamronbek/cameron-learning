import sanitizeHtml from "sanitize-html";
import { Request, Response, NextFunction } from "express";

const rawExecutionFields = new Set(["source", "generatorSource", "referenceSource", "input", "output"]);

function sanitizeObject(obj: any): any {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
  const out: any = {};
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (typeof v === "string") {
      // These values are written to a sandboxed compiler/test store and never
      // rendered as HTML. Sanitizing them corrupts valid operators such as <
      // and >, so output encoding belongs at every display boundary instead.
      out[k] = rawExecutionFields.has(k) ? v : sanitizeHtml(v, { allowedTags: [], allowedAttributes: {} });
    } else if (typeof v === "object") {
      out[k] = sanitizeObject(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function sanitizeMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.body) req.body = sanitizeObject(req.body);
    if (req.query) req.query = sanitizeObject(req.query as any) as any;
  } catch (e) {
    // ignore
  }
  return next();
}
