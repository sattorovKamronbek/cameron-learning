import { Request, Response } from "express";
import { prisma } from "../index";
import { logAudit } from "../services/auditService";

export async function createCourse(req: any, res: Response) {
  try {
    const data = req.body;
    const course = await prisma.course.create({ data: { ...data, slug: data.slug || data.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") } as any });
    await logAudit(req.user?.sub, "create_course", { courseId: course.id });
    res.status(201).json({ course });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function editCourse(req: any, res: Response) {
  const id = req.params.id;
  try {
    const data = req.body;
    const course = await prisma.course.update({ where: { id }, data } as any);
    await logAudit(req.user?.sub, "edit_course", { courseId: id });
    res.json({ course });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function publishCourse(req: any, res: Response) {
  const id = req.params.id;
  try {
    const course = await prisma.course.update({ where: { id }, data: { isPublished: true } });
    await logAudit(req.user?.sub, "publish_course", { courseId: id });
    res.json({ course });
  } catch (err: any) { res.status(400).json({ error: err.message }); }
}

export async function unpublishCourse(req: any, res: Response) {
  const id = req.params.id;
  try {
    const course = await prisma.course.update({ where: { id }, data: { isPublished: false } });
    await logAudit(req.user?.sub, "unpublish_course", { courseId: id });
    res.json({ course });
  } catch (err: any) { res.status(400).json({ error: err.message }); }
}

export async function archiveCourse(req: any, res: Response) {
  const id = req.params.id;
  try {
    const course = await prisma.course.update({ where: { id }, data: { isArchived: true } });
    await logAudit(req.user?.sub, "archive_course", { courseId: id });
    res.json({ course });
  } catch (err: any) { res.status(400).json({ error: err.message }); }
}

export async function deleteCourse(req: any, res: Response) {
  const id = req.params.id;
  try {
    await prisma.course.delete({ where: { id } });
    await logAudit(req.user?.sub, "delete_course", { courseId: id });
    res.json({ message: "Deleted" });
  } catch (err: any) { res.status(400).json({ error: err.message }); }
}

export async function listCourses(req: Request, res: Response) {
  const { category, q } = req.query as any;
  const where: any = { isPublished: true, isArchived: false };
  if (category) where.categoryId = category;
  if (q) where.OR = [{ title: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }];
  const courses = await prisma.course.findMany({ where, select: { id: true, title: true, slug: true, summary: true, coverImage: true, instructorId: true } });
  res.json({ courses });
}

export async function getCourse(req: Request, res: Response) {
  const idOrSlug = req.params.id;
  const course = await prisma.course.findFirst({
    where: { isPublished: true, isArchived: false, OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    include: {
      chapters: { include: { lessons: { select: { id: true, title: true, slug: true, type: true, order: true, timeEstimateMin: true } } } },
      quizzes: { select: { id: true, title: true, instruction: true, timeLimitSec: true } },
      assignments: { select: { id: true, title: true, description: true, dueAt: true, maxScore: true } },
      instructor: { select: { id: true, name: true } },
    },
  });
  if (!course) return res.status(404).json({ error: "Not found" });
  res.json({ course });
}

export async function addChapter(req: any, res: Response) {
  const courseId = req.params.id;
  try {
    const { title, order } = req.body;
    const chapter = await prisma.chapter.create({ data: { courseId, title, order: order ?? 0 } });
    await logAudit(req.user?.sub, "add_chapter", { courseId, chapterId: chapter.id });
    res.status(201).json({ chapter });
  } catch (err: any) { res.status(400).json({ error: err.message }); }
}

export async function addLesson(req: any, res: Response) {
  const chapterId = req.params.chapterId;
  try {
    const data = req.body;
    data.slug = data.slug || (data.title || "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const lesson = await prisma.lesson.create({ data: { ...data, chapterId } as any });
    await logAudit(req.user?.sub, "add_lesson", { chapterId, lessonId: lesson.id });
    res.status(201).json({ lesson });
  } catch (err: any) { res.status(400).json({ error: err.message }); }
}
