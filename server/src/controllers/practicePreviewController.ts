import { Request, Response } from "express";
import { logAudit } from "../services/auditService";
import { PracticePreviewValidationError, runPracticePreview } from "../services/practicePreviewService";

export async function previewPracticeSolution(req: Request & { user?: { sub?: string } }, res: Response) {
  try {
    const results = await runPracticePreview(req.body);
    // Supabase learner ids are not part of the legacy Prisma User table. A
    // failed optional legacy audit write must never hide a valid runner result.
    await logAudit(req.user?.sub, "practice_solution_preview", { sampleCount: results.length, language: req.body?.language }).catch(() => undefined);
    return res.json({ results });
  } catch (error) {
    if (error instanceof PracticePreviewValidationError) return res.status(400).json({ error: error.message });
    return res.status(400).json({ error: "Kod samplelarda ishga tushmadi. Kod va tilni tekshirib qayta urinib ko‘ring." });
  }
}
