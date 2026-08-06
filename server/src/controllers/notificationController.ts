import { Request, Response } from "express";
import { createNotification, listNotifications, markNotificationRead } from "../services/notificationService";
import { prisma, redis } from "../index";

export async function getNotifications(req: any, res: Response) {
  const userId = req.user?.sub;
  const page = Math.max(1, Number(req.query.page || 1));
  const perPage = Math.min(100, Number(req.query.perPage || 50));
  const skip = (page - 1) * perPage;
  const list = await listNotifications(userId, skip, perPage);
  res.json({ notifications: list });
}

export async function postNotification(req: any, res: Response) {
  const { userId, title, body, meta, sendEmail } = req.body;
  if (!userId || !title) return res.status(400).json({ error: 'Missing fields' });
  const n = await createNotification(userId, title, body, meta, Boolean(sendEmail));
  res.status(201).json({ notification: n });
}

export async function readNotification(req: any, res: Response) {
  const id = req.params.id;
  try {
    const n = await markNotificationRead(id);
    res.json({ notification: n });
  } catch (err: any) { res.status(400).json({ error: err.message }); }
}

// SSE endpoint for realtime notifications for the authenticated user
export async function subscribeNotifications(req: any, res: Response) {
  const userId = req.user?.sub;
  if (!userId) return res.status(401).end();
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  const send = (data: any) => {
    try { res.write(`data: ${JSON.stringify(data)}\n\n`); } catch (e) {}
  };
  // subscribe to redis pubsub
  const sub = redis.duplicate();
  await sub.connect();
  await sub.subscribe('notifications', (message) => {
    try {
      const parsed = JSON.parse(message);
      if (parsed.userId === userId) send(parsed);
    } catch (e) {}
  });
  // send ping
  const interval = setInterval(() => send({ type: 'ping', ts: Date.now() }), 20_000);
  req.on('close', async () => {
    clearInterval(interval);
    try { await sub.unsubscribe('notifications'); await sub.disconnect(); } catch (e) {}
  });
}
