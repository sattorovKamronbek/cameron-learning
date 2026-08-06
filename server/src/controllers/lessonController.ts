import { Request, Response } from "express";
import { prisma } from "../index";

export async function getLesson(req: any, res: Response) {
  const idOrSlug = req.params.id;
  const lesson = await prisma.lesson.findFirst({ where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] }, include: { chapter: { include: { course: true } } } });
  if (!lesson) return res.status(404).json({ error: "Not found" });
  // for coding lessons, include skeleton
  res.json({ lesson });
}

export async function getLessonContent(req: any, res: Response) {
  const id = req.params.id;
  const lesson = await prisma.lesson.findUnique({ where: { id } });
  if (!lesson) return res.status(404).json({ error: "Not found" });
  if (lesson.type === 'VIDEO') return res.json({ videoUrl: lesson.videoUrl, title: lesson.title });
  return res.json({ content: lesson.content, codingSkeleton: lesson.codingSkeleton });
}
