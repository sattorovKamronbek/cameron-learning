import { prisma, redis } from "../index";
import { sendEmail } from "./emailService";

export async function createNotification(userId: string, title: string, body?: string, meta?: any, sendEmailFlag = false) {
  const n = await prisma.notification.create({ data: { userId, title, body, meta } });
  // publish to redis channel for realtime subscribers
  try {
    await redis.publish("notifications", JSON.stringify({ userId, id: n.id, title, body, meta }));
  } catch (e) {}
  if (sendEmailFlag) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user && user.email) {
      await sendEmail(user.email, title, `<p>${body || ""}</p>`).catch(()=>{});
    }
  }
  return n;
}

export async function markNotificationRead(id: string) {
  return prisma.notification.update({ where: { id }, data: { read: true } });
}

export async function listNotifications(userId: string, skip = 0, take = 50) {
  return prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, skip, take });
}
