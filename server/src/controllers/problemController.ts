import { Request, Response } from "express";
import { spawn } from "child_process";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { prisma } from "../index";
import { logAudit } from "../services/auditService";

const GENERATED_TEST_LIMIT = 25;
const GENERATED_TEXT_LIMIT = 128 * 1024;

type DockerResult = { stdout: string; stderr: string; code: number };

function dockerRun(workdir: string, image: string, command: string, timeoutSeconds: number): Promise<DockerResult> {
  const args = [
    "run", "--rm", "--network", "none", "--pids-limit", "64", "--cap-drop=ALL",
    "--security-opt", "no-new-privileges", "--read-only", "--memory", "192m", "--cpus", "0.5",
    "--tmpfs", "/tmp:rw,noexec,nosuid,size=32m", "-v", `${workdir}:/workspace:rw`, image,
    "/bin/sh", "-c", command,
  ];
  return new Promise((resolve) => {
    const process = spawn("docker", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    process.stdout.on("data", (data) => { stdout += String(data); });
    process.stderr.on("data", (data) => { stderr += String(data); });
    const killer = setTimeout(() => { process.kill("SIGKILL"); }, (timeoutSeconds + 2) * 1000);
    process.on("error", (error) => { clearTimeout(killer); resolve({ stdout, stderr: `${stderr}${error.message}`, code: 125 }); });
    process.on("close", (code) => { clearTimeout(killer); resolve({ stdout, stderr, code: code ?? 125 }); });
  });
}

function languageConfig(language: string) {
  const normalized = language.toLowerCase();
  if (["cpp17", "c++17"].includes(normalized)) return {
    image: "gcc:12",
    generatorFile: "generator.cpp",
    referenceFile: "reference.cpp",
    compile: "cd /workspace && g++ -O2 -std=gnu++17 generator.cpp -o generator && g++ -O2 -std=gnu++17 reference.cpp -o reference",
    generator: (seed: number) => `cd /workspace && timeout 2 ./generator ${seed}`,
    reference: "cd /workspace && timeout 2 ./reference",
  };
  if (normalized === "python3") return {
    image: "python:3.12-alpine",
    generatorFile: "generator.py",
    referenceFile: "reference.py",
    compile: null,
    generator: (seed: number) => `cd /workspace && timeout 2 python3 generator.py ${seed}`,
    reference: "cd /workspace && timeout 2 python3 reference.py",
  };
  throw new Error("Test generator supports cpp17 and python3 only");
}

/** Runs generator and oracle code in isolated containers; never in Node/the host. */
export async function generateTestCases(req: any, res: Response) {
  const problemId = req.params.id;
  const language = typeof req.body?.language === "string" ? req.body.language : "";
  const generatorSource = typeof req.body?.generatorSource === "string" ? req.body.generatorSource : "";
  const referenceSource = typeof req.body?.referenceSource === "string" ? req.body.referenceSource : "";
  const count = Number(req.body?.count);
  const seed = Number.isInteger(Number(req.body?.seed)) ? Number(req.body.seed) : Date.now();
  if (!Number.isInteger(count) || count < 1 || count > GENERATED_TEST_LIMIT) return res.status(400).json({ error: `count must be between 1 and ${GENERATED_TEST_LIMIT}` });
  if (!generatorSource.trim() || !referenceSource.trim() || Buffer.byteLength(generatorSource) > GENERATED_TEXT_LIMIT || Buffer.byteLength(referenceSource) > GENERATED_TEXT_LIMIT) {
    return res.status(400).json({ error: "Generator and reference source are required and must be at most 128 KiB" });
  }
  try {
    const problem = await prisma.problem.findUnique({ where: { id: problemId }, select: { id: true, createdById: true } });
    const actor = await prisma.user.findUnique({ where: { id: req.user?.sub }, select: { role: true } });
    if (!problem || !actor || (actor.role !== "ADMIN" && problem.createdById !== req.user.sub)) return res.status(403).json({ error: "You cannot generate tests for this problem" });
    const config = languageConfig(language);
    const workdir = await fs.mkdtemp(path.join(os.tmpdir(), "judge-generator-"));
    try {
      await fs.writeFile(path.join(workdir, config.generatorFile), generatorSource, "utf8");
      await fs.writeFile(path.join(workdir, config.referenceFile), referenceSource, "utf8");
      if (config.compile) {
        const compilation = await dockerRun(workdir, config.image, config.compile, 15);
        if (compilation.code !== 0) return res.status(400).json({ error: "Generator or reference compilation failed", details: compilation.stderr.slice(0, 8_000) });
      }
      const testCases: { problemId: string; input: string; output: string; isHidden: boolean; weight: number }[] = [];
      for (let index = 0; index < count; index += 1) {
        const generated = await dockerRun(workdir, config.image, config.generator(seed + index), 3);
        const input = generated.stdout;
        if (generated.code !== 0 || !input.trim() || Buffer.byteLength(input) > GENERATED_TEXT_LIMIT) {
          return res.status(400).json({ error: `Generator failed at case ${index + 1}`, details: generated.stderr.slice(0, 4_000) });
        }
        await fs.writeFile(path.join(workdir, "input.txt"), input, "utf8");
        const expected = await dockerRun(workdir, config.image, `${config.reference} < input.txt`, 3);
        if (expected.code !== 0 || Buffer.byteLength(expected.stdout) > GENERATED_TEXT_LIMIT) {
          return res.status(400).json({ error: `Reference solution failed at case ${index + 1}`, details: expected.stderr.slice(0, 4_000) });
        }
        testCases.push({ problemId, input, output: expected.stdout, isHidden: true, weight: 1 });
      }
      await prisma.testCase.createMany({ data: testCases });
      await logAudit(req.user.sub, "generate_testcases", { problemId, language, count });
      res.status(201).json({ generated: testCases.length });
    } finally {
      await fs.rm(workdir, { recursive: true, force: true });
    }
  } catch (error: any) {
    res.status(400).json({ error: error?.message || "Testcase generation failed" });
  }
}

export async function createProblem(req: any, res: Response) {
  const data = req.body;
  try {
    const problem = await prisma.problem.create({ data: { ...data, tags: data.tags || [], createdById: req.user?.sub } as any });
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
    const [problem, actor] = await Promise.all([
      prisma.problem.findUnique({ where: { id }, select: { createdById: true } }),
      prisma.user.findUnique({ where: { id: req.user?.sub }, select: { role: true } }),
    ]);
    if (!problem || !actor || (actor.role !== "ADMIN" && problem.createdById !== req.user?.sub)) return res.status(403).json({ error: "You cannot edit this problem" });
    const updatedProblem = await prisma.problem.update({ where: { id }, data } as any);
    await logAudit(req.user?.sub, "edit_problem", { problemId: id });
    res.json({ problem: updatedProblem });
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
    const [problem, actor] = await Promise.all([
      prisma.problem.findUnique({ where: { id: problemId }, select: { createdById: true } }),
      prisma.user.findUnique({ where: { id: req.user?.sub }, select: { role: true } }),
    ]);
    if (!problem || !actor || (actor.role !== "ADMIN" && problem.createdById !== req.user?.sub)) return res.status(403).json({ error: "You cannot add tests to this problem" });
    const tc = await prisma.testCase.create({ data: { problemId, input, output, isHidden, weight } });
    await logAudit(req.user?.sub, "add_testcase", { problemId, testCaseId: tc.id });
    res.status(201).json({ testCase: tc });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}
