import { Request, Response } from "express";
import { prisma, redis } from "../index";
import { enqueueJob } from "../services/judgeQueueService";
import { logAudit } from "../services/auditService";

export async function submitSolution(req: any, res: Response) {
  const userId = req.user?.sub;
  const { contestId, problemId } = req.params;
  const { source, language } = req.body;
  if (typeof source !== "string" || !source.trim() || Buffer.byteLength(source, "utf8") > 256 * 1024) {
    return res.status(400).json({ error: "Source must be between 1 and 262144 bytes" });
  }
  if (typeof language !== "string" || !["cpp17", "c++17", "python3", "java17"].includes(language.toLowerCase())) {
    return res.status(400).json({ error: "Unsupported language" });
  }
  try {
    const problem = await prisma.problem.findUnique({ where: { id: problemId } });
    if (!problem) return res.status(404).json({ error: "Problem not found" });
    if (contestId) {
      const contest = await prisma.contest.findUnique({ where: { id: contestId }, include: { problems: { where: { problemId } } } });
      const now = new Date();
      if (!contest || !contest.isPublished || contest.problems.length === 0 || (contest.startAt && contest.startAt > now) || (contest.endAt && contest.endAt <= now)) {
        return res.status(403).json({ error: "Contest submissions are not available" });
      }
    }
    const size = Buffer.byteLength(source, "utf8");
    const submission = await prisma.submission.create({ data: { userId, contestId: contestId || null, problemId, language, source, size } as any });
    // enqueue judge job
    await enqueueJob({ submissionId: submission.id });
    await logAudit(req.user?.sub, "submit_solution", { submissionId: submission.id, problemId });
    res.status(201).json({ submissionId: submission.id });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function getSubmission(req: any, res: Response) {
  const id = req.params.id;
  const submission = await prisma.submission.findUnique({ where: { id }, include: { runs: true } });
  if (!submission) return res.status(404).json({ error: "Not found" });
  // Only owner, admins, or judges can view full details
  const requester = req.user?.sub;
  if (submission.userId !== requester) {
    const user = await prisma.user.findUnique({ where: { id: requester } });
    if (!user || (user.role !== "ADMIN" && user.role !== "JUDGE")) return res.status(403).json({ error: "Forbidden" });
  }
  res.json({ submission });
}

export async function listSubmissions(req: any, res: Response) {
  const { problemId } = req.query;
  const requester = req.user?.sub;
  const requesterUser = await prisma.user.findUnique({ where: { id: requester }, select: { role: true } });
  if (!requesterUser) return res.status(401).json({ error: "Unauthorized" });
  const where: any = requesterUser.role === "USER" ? { userId: requester } : {};
  if (problemId) where.problemId = String(problemId);
  const subs = await prisma.submission.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, userId: true, contestId: true, problemId: true, language: true, verdict: true, score: true, timeMs: true, memoryKb: true, createdAt: true, updatedAt: true },
  });
  res.json({ submissions: subs });
}
