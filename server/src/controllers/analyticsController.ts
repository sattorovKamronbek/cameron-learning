import { Request, Response } from "express";
import { prisma, redis } from "../index";

const CACHE_TTL = 30; // seconds

export async function getPlatformAnalytics(req: Request, res: Response) {
  // try cache
  try {
    const cached = await redis.get('analytics:platform');
    if (cached) return res.json(JSON.parse(cached));
  } catch (e) {}

  // compute metrics
  const now = new Date();
  const dayAgo = new Date(Date.now() - 1000 * 60 * 60 * 24);
  const monthAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30);

  const [activeUsers, onlineCount, contestParticipants, acceptedSubmissions, totalSubmissions, courseCompletions, newUsersMonth] = await Promise.all([
    // active users in last 30 days (based on audit logs or lastSeen keys)
    prisma.user.count({ where: { updatedAt: { gte: monthAgo } } }),
    // online users via redis scanning lastseen keys
    (async () => {
      try {
        const keys = await redis.keys('user:lastseen:*');
        return keys.length;
      } catch (e) { return 0; }
    })(),
    prisma.submission.groupBy({ by: ['userId'], where: { createdAt: { gte: dayAgo } }, _count: { userId: true } }).then((groups) => groups.length),
    prisma.submission.count({ where: { verdict: 'ACCEPTED' } }),
    prisma.submission.count(),
    // course completions: count of courseProgress completed in last 30 days
    prisma.courseProgress.count({ where: { completed: true, completedAt: { gte: monthAgo } } }),
    prisma.user.count({ where: { createdAt: { gte: monthAgo } } }),
  ]);

  const payload = { timestamp: Date.now(), activeUsers, onlineCount, contestParticipants, acceptedSubmissions, totalSubmissions, courseCompletions, newUsersMonth };
  try { await redis.set('analytics:platform', JSON.stringify(payload), { EX: CACHE_TTL }); } catch (e) {}
  res.json(payload);
}

export async function getUsageByDay(req: Request, res: Response) {
  // return user growth by day for last N days
  const days = Math.min(90, Number(req.query.days || 30));
  const results: { date: string; users: number; submissions: number }[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const end = new Date(start.getTime() + 24 * 3600 * 1000);
    const [users, submissions] = await Promise.all([
      prisma.user.count({ where: { createdAt: { gte: start, lt: end } } }),
      prisma.submission.count({ where: { createdAt: { gte: start, lt: end } } }),
    ]);
    results.push({ date: start.toISOString().slice(0,10), users, submissions });
  }
  res.json({ results });
}
