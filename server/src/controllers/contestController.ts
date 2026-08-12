import { Request, Response } from "express";
import { prisma } from "../index";
import { hashPassword } from "../utils/hash";
import { logAudit } from "../services/auditService";

export async function createContest(req: any, res: Response) {
  const { title, slug, description, startAt, endAt, visibility, password, allowPractice, allowVirtual, mode = "CONTEST" } = req.body;
  try {
    const actor = await prisma.user.findUnique({ where: { id: req.user?.sub }, select: { role: true, isSuspended: true, isBanned: true } });
    if (!actor || actor.isSuspended || actor.isBanned) return res.status(403).json({ error: "Account cannot create contests" });
    if (actor.role === "JUDGE" && mode !== "GYM") return res.status(403).json({ error: "Judges can create Gym contests only" });
    const passwordHash = password ? await hashPassword(password) : undefined;
    const contest = await prisma.contest.create({ data: { title, slug, description, startAt: startAt ? new Date(startAt) : null, endAt: endAt ? new Date(endAt) : null, visibility, passwordHash, allowPractice, allowVirtual, mode, createdById: req.user?.sub } as any });
    await logAudit(req.user?.sub, "create_contest", { contestId: contest.id });
    res.status(201).json({ contest });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function editContest(req: any, res: Response) {
  const id = req.params.id;
  try {
    const data = req.body;
    const [contest, actor] = await Promise.all([
      prisma.contest.findUnique({ where: { id }, select: { createdById: true, mode: true } }),
      prisma.user.findUnique({ where: { id: req.user?.sub }, select: { role: true, isSuspended: true, isBanned: true } }),
    ]);
    if (!contest || !actor || actor.isSuspended || actor.isBanned || (actor.role !== "ADMIN" && (contest.createdById !== req.user?.sub || contest.mode !== "GYM"))) return res.status(403).json({ error: "You cannot edit this contest" });
    if (actor.role === "JUDGE" && data.mode && data.mode !== "GYM") return res.status(403).json({ error: "Judges can manage Gym contests only" });
    if (data.password) data.passwordHash = await hashPassword(data.password);
    const updatedContest = await prisma.contest.update({ where: { id }, data } as any);
    await logAudit(req.user?.sub, "edit_contest", { contestId: id });
    res.json({ contest: updatedContest });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function publishContest(req: any, res: Response) {
  const id = req.params.id;
  try {
    const [existing, actor] = await Promise.all([
      prisma.contest.findUnique({ where: { id }, select: { createdById: true, mode: true } }),
      prisma.user.findUnique({ where: { id: req.user?.sub }, select: { role: true } }),
    ]);
    if (!existing || !actor || (actor.role !== "ADMIN" && (existing.createdById !== req.user?.sub || existing.mode !== "GYM"))) return res.status(403).json({ error: "You cannot publish this contest" });
    const contest = await prisma.contest.update({ where: { id }, data: { isPublished: true } });
    await logAudit(req.user?.sub, "publish_contest", { contestId: id });
    res.json({ contest });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function archiveContest(req: any, res: Response) {
  const id = req.params.id;
  try {
    const [existing, actor] = await Promise.all([
      prisma.contest.findUnique({ where: { id }, select: { createdById: true, mode: true } }),
      prisma.user.findUnique({ where: { id: req.user?.sub }, select: { role: true } }),
    ]);
    if (!existing || !actor || (actor.role !== "ADMIN" && (existing.createdById !== req.user?.sub || existing.mode !== "GYM"))) return res.status(403).json({ error: "You cannot archive this contest" });
    const contest = await prisma.contest.update({ where: { id }, data: { isPublished: false } });
    await logAudit(req.user?.sub, "archive_contest", { contestId: id });
    res.json({ contest });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function deleteContest(req: any, res: Response) {
  const id = req.params.id;
  try {
    const [contest, actor] = await Promise.all([
      prisma.contest.findUnique({ where: { id }, include: { problems: true, submissions: { take: 1 }, scoreboardEntries: { take: 1 } } }),
      prisma.user.findUnique({ where: { id: req.user?.sub }, select: { role: true } }),
    ]);
    if (!contest || !actor || (actor.role !== "ADMIN" && (contest.createdById !== req.user?.sub || contest.mode !== "GYM"))) return res.status(403).json({ error: "You cannot delete this contest" });
    if (contest.isPublished || contest.submissions.length || contest.scoreboardEntries.length) return res.status(400).json({ error: "Only unused draft contests can be deleted" });
    await prisma.$transaction([
      prisma.contestProblem.deleteMany({ where: { contestId: id } }),
      prisma.announcement.deleteMany({ where: { contestId: id } }),
      prisma.clarification.deleteMany({ where: { contestId: id } }),
      prisma.contest.delete({ where: { id } }),
    ]);
    await logAudit(req.user?.sub, "delete_contest", { contestId: id });
    res.json({ message: "Deleted" });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function listContests(req: Request, res: Response) {
  const contests = await prisma.contest.findMany({ where: { isPublished: true }, select: { id: true, title: true, slug: true, startAt: true, endAt: true, visibility: true } });
  res.json({ contests });
}

export async function getContest(req: Request, res: Response) {
  const idOrSlug = req.params.id;
  const contest = await prisma.contest.findFirst({
    where: { isPublished: true, visibility: "PUBLIC", OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    include: {
      problems: { orderBy: { order: "asc" }, include: { problem: { select: { id: true, title: true, slug: true, difficulty: true, tags: true, timeLimitMs: true, memoryLimitKb: true, statement: true, inputDesc: true, outputDesc: true, constraints: true } } } },
      announcements: true,
    },
  });
  if (!contest) return res.status(404).json({ error: "Not found" });
  res.json({ contest });
}
