import { Request, Response } from "express";
import { prisma } from "../index";
import { logAudit } from "../services/auditService";

export async function createProblem(req: any, res: Response) {
  const data = req.body;
  try {
    const problem = await prisma.problem.create({ data: { ...data, tags: data.tags || [] } as any });
    await logAudit(req.user?.sub, "create_problem", { problemId: problem.id });
    res.status(201).json({ problem });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function editProblem(req: any, res: Response) {
  const id = req.params.id;
  try {
    const data = req.body;
    const problem = await prisma.problem.update({ where: { id }, data } as any);
    await logAudit(req.user?.sub, "edit_problem", { problemId: id });
    res.json({ problem });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function deleteProblem(req: any, res: Response) {
  const id = req.params.id;
  try {
    await prisma.problem.delete({ where: { id } });
    await logAudit(req.user?.sub, "delete_problem", { problemId: id });
    res.json({ message: "Deleted" });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function getProblem(req: Request, res: Response) {
  const idOrSlug = req.params.id;
  const problem = await prisma.problem.findFirst({ where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] }, include: { testCases: false } });
  if (!problem) return res.status(404).json({ error: "Not found" });
  // Do not return hidden testcases
  res.json({ problem });
}

export async function addTestCase(req: any, res: Response) {
  const problemId = req.params.id;
  const { input, output, isHidden, weight } = req.body;
  try {
    const tc = await prisma.testCase.create({ data: { problemId, input, output, isHidden, weight } });
    await logAudit(req.user?.sub, "add_testcase", { problemId, testCaseId: tc.id });
    res.status(201).json({ testCase: tc });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}
