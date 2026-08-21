import { Request, Response } from "express";
import { logAudit } from "../services/auditService";
import {
  PdfFormatterConfigurationError,
  PdfFormatterResponseError,
  PdfRenderingError,
  PdfRequestValidationError,
  PdfSampleIntegrityError,
  buildContestProblemHtml,
  fingerprintContestProblemPdfRequest,
  formatContestProblemWithAi,
  normalizeContestProblemPdfRequest,
  renderContestProblemPdf,
  safePdfFilename,
} from "../services/contestProblemPdfService";

const inFlightRequests = new Set<string>();

/** Generates an in-memory preview/download artifact; no problem or PDF is persisted. */
export async function generateContestProblemPdf(req: Request & { user?: { sub?: string } }, res: Response) {
  let request;
  try {
    request = normalizeContestProblemPdfRequest(req.body);
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Invalid PDF builder request" });
  }

  const actorId = req.user?.sub;
  const fingerprint = fingerprintContestProblemPdfRequest(request);
  const requestKey = `${actorId ?? "unknown"}:${fingerprint}`;
  if (inFlightRequests.has(requestKey)) return res.status(409).json({ error: "This PDF preview is already being generated" });
  inFlightRequests.add(requestKey);

  try {
    const formatted = await formatContestProblemWithAi(request);
    const html = buildContestProblemHtml(request, formatted);
    const pdf = await renderContestProblemPdf(html, request.options);
    const filename = safePdfFilename({ ...request.metadata, title: formatted.title || request.metadata.title });
    await logAudit(actorId, "generate_contest_problem_pdf", {
      contentHash: fingerprint,
      contentBytes: Buffer.byteLength(request.problemContent, "utf8"),
      publicSampleCount: request.samples.length,
      options: request.options,
      filename,
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=\"${filename}\"`);
    res.setHeader("Cache-Control", "no-store, private");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.status(200).send(pdf);
  } catch (error) {
    if (error instanceof PdfFormatterConfigurationError || error instanceof PdfRenderingError) {
      return res.status(503).json({ error: error.message });
    }
    if (error instanceof PdfSampleIntegrityError) return res.status(422).json({ error: error.message });
    if (error instanceof PdfFormatterResponseError) {
      return res.status(422).json({ error: "AI natijasi xavfsizlik tekshiruvidan o‘tmadi. Manba matni saqlanib qoldi; qayta urinib ko‘ring." });
    }
    if (error instanceof PdfRequestValidationError) return res.status(400).json({ error: error.message });
    return res.status(502).json({ error: "PDF previewni yaratib bo‘lmadi. Manba matni o‘zgartirilmadi." });
  } finally {
    inFlightRequests.delete(requestKey);
  }
}
