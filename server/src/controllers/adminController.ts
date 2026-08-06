import { Request, Response } from "express";
import { prisma, redis } from "../index";
import { enqueueJob } from "../services/judgeQueueService";

function parsePagination(req: Request) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const perPage = Math.min(200, Math.max(1, Number(req.query.perPage) || 20));
  const skip = (page - 1) * perPage;
  return { page, perPage, skip };
}

export async function getStats(req: Request, res: Response) {
  const [userCount, verifiedCount, suspendedCount, courseCount, publishedCourses, contestCount, activeContests, submissionCount, pendingSubmissions] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { emailVerified: true } }),
    prisma.user.count({ where: { isSuspended: true } }),
    prisma.course.count(),
    prisma.course.count({ where: { isPublished: true } }),
    prisma.contest.count(),
    prisma.contest.count({ where: { isPublished: true, startAt: { lte: new Date() }, endAt: { gte: new Date() } } }),
    prisma.submission.count(),
    prisma.submission.count({ where: { verdict: { in: ['PENDING', 'JUDGING'] } } }),
  ]);
  // quick redis queue length
  let queueLen = 0;
  try { queueLen = await redis.lLen("judge:queue"); } catch (e) {}
  res.json({ userCount, verifiedCount, suspendedCount, courseCount, publishedCourses, contestCount, activeContests, submissionCount, pendingSubmissions, queueLen });
}

export async function listUsers(req: Request, res: Response) {
  const { perPage, skip } = parsePagination(req);
  const q = String(req.query.q || "");
  const role = String(req.query.role || "");
  const where: any = {};
  if (q) where.OR = [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }];
  if (role) where.role = role;
  const [users, total] = await Promise.all([
    prisma.user.findMany({ where, select: { id: true, email: true, name: true, role: true, emailVerified: true, isSuspended: true, createdAt: true }, skip, take: perPage, orderBy: { createdAt: 'desc' } }),
    prisma.user.count({ where }),
  ]);
  res.json({ users, total, perPage });
}

export async function getUser(req: Request, res: Response) {
  const id = req.params.id;
  const user = await prisma.user.findUnique({ where: { id }, include: { achievements: true, notifications: true } });
  if (!user) return res.status(404).json({ error: 'Not found' });
  // hide sensitive
  // @ts-ignore
  delete user.passwordHash;
  res.json({ user });
}

export async function createUser(req: Request, res: Response) {
  const { email, name, role, password } = req.body;
  try {
    const user = await prisma.user.create({ data: { email, name, role } as any });
    await prisma.auditLog.create({ data: { actorId: (req as any).user?.sub, action: 'create_user', details: { id: user.id } } });
    res.status(201).json({ user });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function updateUser(req: Request, res: Response) {
  const id = req.params.id;
  const data = req.body;
  try {
    const user = await prisma.user.update({ where: { id }, data } as any);
    await prisma.auditLog.create({ data: { actorId: (req as any).user?.sub, action: 'update_user', details: { id } } });
    res.json({ user });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function assignRole(req: Request, res: Response) {
  const id = req.params.id;
  const { role } = req.body;
  try {
    const user = await prisma.user.update({ where: { id }, data: { role } as any });
    await prisma.auditLog.create({ data: { actorId: (req as any).user?.sub, action: 'assign_role', details: { id, role } } });
    res.json({ user });
  } catch (err: any) { res.status(400).json({ error: err.message }); }
}

export async function bulkSuspendUsers(req: Request, res: Response) {
  const ids: string[] = req.body.ids || [];
  try {
    const result = await prisma.user.updateMany({ where: { id: { in: ids } }, data: { isSuspended: true } });
    await prisma.auditLog.create({ data: { actorId: (req as any).user?.sub, action: 'bulk_suspend_users', details: { ids } } });
    res.json({ count: result.count });
  } catch (err: any) { res.status(400).json({ error: err.message }); }
}

export async function bulkDeleteUsers(req: Request, res: Response) {
  const ids: string[] = req.body.ids || [];
  try {
    const result = await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.auditLog.create({ data: { actorId: (req as any).user?.sub, action: 'bulk_delete_users', details: { ids } } });
    res.json({ count: result.count });
  } catch (err: any) { res.status(400).json({ error: err.message }); }
}

export async function deleteUser(req: Request, res: Response) {
  const id = req.params.id;
  try {
    await prisma.user.delete({ where: { id } });
    await prisma.auditLog.create({ data: { actorId: (req as any).user?.sub, action: "delete_user", details: { target: id } } });
    res.json({ message: "Deleted" });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function listCoursesAdmin(req: Request, res: Response) {
  const { perPage, skip } = parsePagination(req);
  const q = String(req.query.q || "");
  const where: any = {};
  if (q) where.OR = [{ title: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }];
  const [courses, total] = await Promise.all([
    prisma.course.findMany({ where, skip, take: perPage, orderBy: { createdAt: 'desc' } }),
    prisma.course.count({ where }),
  ]);
  res.json({ courses, total, perPage });
}

export async function listProblemsAdmin(req: Request, res: Response) {
  const { perPage, skip } = parsePagination(req);
  const q = String(req.query.q || "");
  const where: any = {};
  if (q) where.OR = [{ title: { contains: q, mode: 'insensitive' } }, { statement: { contains: q, mode: 'insensitive' } }];
  const [problems, total] = await Promise.all([
    prisma.problem.findMany({ where, skip, take: perPage, orderBy: { createdAt: 'desc' } }),
    prisma.problem.count({ where }),
  ]);
  res.json({ problems, total, perPage });
}

export async function listSubmissionsAdmin(req: Request, res: Response) {
  const { perPage, skip } = parsePagination(req);
  const q = String(req.query.q || "");
  const status = String(req.query.status || "");
  const where: any = {};
  if (q) where.OR = [{ id: { contains: q } }, { language: { contains: q, mode: 'insensitive' } }];
  if (status) where.verdict = status as any;
  const [subs, total] = await Promise.all([
    prisma.submission.findMany({ where, skip, take: perPage, orderBy: { createdAt: 'desc' } }),
    prisma.submission.count({ where }),
  ]);
  res.json({ submissions: subs, total, perPage });
}

export async function rejudgeSubmission(req: Request, res: Response) {
  const id = req.params.id;
  try {
    await prisma.submission.update({ where: { id }, data: { verdict: 'PENDING' } as any });
    await enqueueJob({ submissionId: id });
    await prisma.auditLog.create({ data: { actorId: (req as any).user?.sub, action: 'rejudge_submission', details: { id } } });
    res.json({ message: 'Rejudge enqueued' });
  } catch (err: any) { res.status(400).json({ error: err.message }); }
}

export async function bulkRejudge(req: Request, res: Response) {
  const ids: string[] = req.body.ids || [];
  try {
    for (const id of ids) {
      await prisma.submission.update({ where: { id }, data: { verdict: 'PENDING' } as any });
      await enqueueJob({ submissionId: id });
    }
    await prisma.auditLog.create({ data: { actorId: (req as any).user?.sub, action: 'bulk_rejudge', details: { ids } } });
    res.json({ count: ids.length });
  } catch (err: any) { res.status(400).json({ error: err.message }); }
}

export async function listAuditLogs(req: Request, res: Response) {
  const { perPage, skip } = parsePagination(req);
  const where: any = {};
  const logs = await prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: perPage });
  const total = await prisma.auditLog.count({ where });
  res.json({ logs, total, perPage });
}

export async function getSetting(req: Request, res: Response) {
  const key = req.params.key;
  const s = await prisma.siteSetting.findUnique({ where: { key } });
  if (!s) return res.status(404).json({ error: 'Not found' });
  res.json({ setting: s });
}

export async function upsertSetting(req: Request, res: Response) {
  const key = req.params.key;
  const value = req.body.value;
  try {
    const s = await prisma.siteSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
    await prisma.auditLog.create({ data: { actorId: (req as any).user?.sub, action: 'update_setting', details: { key } } });
    res.json({ setting: s });
  } catch (err: any) { res.status(400).json({ error: err.message }); }
}

export async function searchAll(req: Request, res: Response) {
  const q = String(req.query.q || "");
  if (!q) return res.status(400).json({ error: 'Missing query' });
  const [users, courses, problems] = await Promise.all([
    prisma.user.findMany({ where: { OR: [{ email: { contains: q, mode: 'insensitive' } }, { name: { contains: q, mode: 'insensitive' } }] }, take: 10 }),
    prisma.course.findMany({ where: { OR: [{ title: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }] }, take: 10 }),
    prisma.problem.findMany({ where: { OR: [{ title: { contains: q, mode: 'insensitive' } }, { statement: { contains: q, mode: 'insensitive' } }] }, take: 10 }),
  ]);
  res.json({ users, courses, problems });
}
