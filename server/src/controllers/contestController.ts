import { Request, Response } from "express";
import { prisma } from "../index";
import { hashPassword } from "../utils/hash";
import { logAudit } from "../services/auditService";

export async function createContest(req: any, res: Response) {
  const { title, slug, description, startAt, endAt, visibility, password, allowPractice, allowVirtual } = req.body;
  try {
    const passwordHash = password ? await hashPassword(password) : undefined;
    const contest = await prisma.contest.create({ data: { title, slug, description, startAt: startAt ? new Date(startAt) : null, endAt: endAt ? new Date(endAt) : null, visibility, passwordHash, allowPractice, allowVirtual, createdById: req.user?.sub } as any });
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
    if (data.password) data.passwordHash = await hashPassword(data.password);
    const contest = await prisma.contest.update({ where: { id }, data } as any);
    await logAudit(req.user?.sub, "edit_contest", { contestId: id });
    res.json({ contest });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function publishContest(req: any, res: Response) {
  const id = req.params.id;
  try {
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
    await prisma.contest.delete({ where: { id } });
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
