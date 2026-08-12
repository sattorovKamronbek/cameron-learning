import { Request, Response } from "express";
import { prisma } from "../index";
import { logAudit } from "../services/auditService";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export async function listCheatingCases(req: Request, res: Response) {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const cases = await prisma.cheatingCase.findMany({
    where: status ? { status: status as any } : undefined,
    include: {
      user: { select: { id: true, email: true, name: true, cheatingStrikes: true, isBanned: true } },
      contest: { select: { id: true, title: true, slug: true } },
      submission: { select: { id: true, language: true, problemId: true, createdAt: true } },
      matchedSubmission: { select: { id: true, userId: true, language: true, createdAt: true } },
      appeal: true,
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  res.json({ cases });
}

export async function resolveCheatingCase(req: any, res: Response) {
  const caseId = req.params.id;
  const decision = String(req.body?.decision || "").toLowerCase();
  const appealDays = Number(req.body?.appealDays);
  const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 5_000) : null;
  if (decision !== "confirm" && decision !== "dismiss") return res.status(400).json({ error: "Decision must be confirm or dismiss" });
  if (!Number.isInteger(appealDays) || appealDays < 0 || appealDays > 30) return res.status(400).json({ error: "appealDays must be between 0 and 30" });
  try {
    const result = await prisma.$transaction(async (tx) => {
      const caseRecord = await tx.cheatingCase.findUnique({ where: { id: caseId }, include: { user: true } });
      if (!caseRecord) throw new Error("Cheating case not found");
      if (caseRecord.status !== "SUSPECTED") throw new Error("This case has already been resolved");
      if (decision === "dismiss") {
        return tx.cheatingCase.update({ where: { id: caseId }, data: { status: "DISMISSED", resolvedById: req.user.sub, resolvedAt: new Date(), resolutionNote: note } });
      }
      const user = caseRecord.user;
      const nextStrikes = caseRecord.strikesApplied ? user.cheatingStrikes : user.cheatingStrikes + 1;
      if (!caseRecord.strikesApplied) {
        await tx.user.update({
          where: { id: user.id },
          data: {
            cheatingStrikes: { increment: 1 },
            ...(nextStrikes >= 3 ? { isBanned: true, isSuspended: true } : {}),
          },
        });
      }
      return tx.cheatingCase.update({
        where: { id: caseId },
        data: {
          status: "CONFIRMED",
          strikesApplied: true,
          appealDeadline: appealDays ? new Date(Date.now() + appealDays * 86_400_000) : null,
          resolvedById: req.user.sub,
          resolvedAt: new Date(),
          resolutionNote: note,
        },
      });
    });
    await logAudit(req.user.sub, "cheating_case_resolved", { caseId, decision, appealDays });
    res.json({ case: result, message: decision === "confirm" ? "Cheating confirmed; strike applied." : "Case dismissed." });
  } catch (error) {
    res.status(400).json({ error: errorMessage(error, "Case could not be resolved") });
  }
}

export async function createCheatingAppeal(req: any, res: Response) {
  const caseId = req.params.id;
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  if (message.length < 20 || message.length > 5_000) return res.status(400).json({ error: "Appeal must be between 20 and 5000 characters" });
  try {
    const caseRecord = await prisma.cheatingCase.findUnique({ where: { id: caseId } });
    if (!caseRecord || caseRecord.userId !== req.user.sub) return res.status(404).json({ error: "Cheating case not found" });
    if (caseRecord.status !== "CONFIRMED" || !caseRecord.appealDeadline || caseRecord.appealDeadline < new Date()) {
      return res.status(403).json({ error: "The appeal window is closed" });
    }
    const appeal = await prisma.cheatingAppeal.create({ data: { caseId, userId: req.user.sub, message } });
    await logAudit(req.user.sub, "cheating_appeal_created", { caseId });
    res.status(201).json({ appeal });
  } catch (error) {
    res.status(400).json({ error: errorMessage(error, "Appeal could not be submitted") });
  }
}

export async function listMyCheatingAppeals(req: any, res: Response) {
  const appeals = await prisma.cheatingAppeal.findMany({
    where: { userId: req.user.sub },
    include: { cheatingCase: { select: { id: true, status: true, appealDeadline: true, similarityScore: true, aiSummary: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json({ appeals });
}

export async function reviewCheatingAppeal(req: any, res: Response) {
  const appealId = req.params.id;
  const decision = String(req.body?.decision || "").toLowerCase();
  const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 5_000) : null;
  if (decision !== "accept" && decision !== "reject") return res.status(400).json({ error: "Decision must be accept or reject" });
  try {
    const appeal = await prisma.$transaction(async (tx) => {
      const current = await tx.cheatingAppeal.findUnique({ where: { id: appealId }, include: { cheatingCase: true } });
      if (!current) throw new Error("Appeal not found");
      if (current.status !== "PENDING") throw new Error("Appeal has already been reviewed");
      await tx.cheatingAppeal.update({ where: { id: appealId }, data: { status: decision === "accept" ? "ACCEPTED" : "REJECTED", reviewedById: req.user.sub, reviewedAt: new Date(), reviewNote: note } });
      if (decision === "accept") {
        if (current.cheatingCase.strikesApplied) {
          const user = await tx.user.update({ where: { id: current.userId }, data: { cheatingStrikes: { decrement: 1 } }, select: { cheatingStrikes: true } });
          if (user.cheatingStrikes < 3) await tx.user.update({ where: { id: current.userId }, data: { isBanned: false, isSuspended: false } });
        }
        await tx.cheatingCase.update({ where: { id: current.caseId }, data: { status: "DISMISSED", strikesApplied: false, resolutionNote: note } });
      }
      return tx.cheatingAppeal.findUnique({ where: { id: appealId } });
    });
    await logAudit(req.user.sub, "cheating_appeal_reviewed", { appealId, decision });
    res.json({ appeal });
  } catch (error) {
    res.status(400).json({ error: errorMessage(error, "Appeal could not be reviewed") });
  }
}
