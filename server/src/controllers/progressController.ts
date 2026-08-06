import { Request, Response } from "express";
import { prisma } from "../index";
import { logAudit } from "../services/auditService";

export async function enrollInCourse(req: any, res: Response) {
  const userId = req.user?.sub;
  const courseId = req.params.id;
  try {
    const course = await prisma.course.findFirst({ where: { id: courseId, isPublished: true, isArchived: false } });
    if (!course) return res.status(404).json({ error: "Course not found" });
    const enrollment = await prisma.enrollment.upsert({
      where: { courseId_userId: { courseId, userId } },
      update: {},
      create: { courseId, userId },
    });
    await logAudit(userId, "enroll_course", { courseId });
    res.status(201).json({ enrollment });
  } catch (err: any) { res.status(400).json({ error: err.message }); }
}

export async function markLessonComplete(req: any, res: Response) {
  const userId = req.user?.sub;
  const lessonId = req.params.lessonId;
  try {
    // create or find enrollment for this course
    const lesson = await prisma.lesson.findUnique({ where: { id: lessonId }, include: { chapter: true } });
    if (!lesson) return res.status(404).json({ error: 'Lesson not found' });
    const courseId = lesson.chapter.courseId;
    const enroll = await prisma.enrollment.findUnique({ where: { courseId_userId: { courseId, userId } } });
    if (!enroll) return res.status(403).json({ error: "Enroll in this course before completing lessons" });
    await prisma.courseProgress.upsert({
      where: { enrollmentId_lessonId: { enrollmentId: enroll.id, lessonId } },
      update: { completed: true, completedAt: new Date() },
      create: { enrollmentId: enroll.id, lessonId, completed: true, completedAt: new Date() },
    });
    await logAudit(userId, "complete_lesson", { lessonId });
    res.json({ message: 'Marked complete' });
  } catch (err: any) { res.status(400).json({ error: err.message }); }
}

export async function getProgress(req: any, res: Response) {
  const userId = req.user?.sub;
  const courseId = req.params.id;
  try {
    const enroll = await prisma.enrollment.findFirst({ where: { userId, courseId }, include: { progress: true } });
    if (!enroll) return res.json({ completed: 0, total: 0 });
    const total = await prisma.lesson.count({ where: { chapter: { courseId } } });
    const completed = enroll.progress.filter((progress) => progress.completed).length;
    res.json({ completed, total });
  } catch (err: any) { res.status(400).json({ error: err.message }); }
}
