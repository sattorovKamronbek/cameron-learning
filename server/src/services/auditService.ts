import { prisma } from "../index";

export async function logAudit(actorId: string | undefined, action: string, details?: any) {
  await prisma.auditLog.create({ data: { actorId, action, details } });
}
