import fs from "fs/promises";
import path from "path";
import os from "os";
import { spawn } from "child_process";
import { prisma } from "../index";
import { dequeueJob } from "../services/judgeQueueService";
import { scanSubmissionForSimilarity } from "../services/codeSimilarityService";

const WORKDIR = process.env.JUDGE_WORKDIR || "/tmp/judge";

async function ensureDir() {
  try { await fs.mkdir(WORKDIR, { recursive: true }); } catch (e) {}
}

function execDocker(commands: string[], image: string, mounts: string[], cpu?: string, memory?: string, timeoutSec = 5) {
  // Build docker run command args
  const args = [
    "run", "--rm", "--network", "none", "--pids-limit", "100",
    "--cap-drop=ALL", "--security-opt", "no-new-privileges", "--read-only",
    "--tmpfs", "/tmp:rw,noexec,nosuid,size=64m",
  ];
  if (memory) args.push("--memory", memory);
  if (cpu) args.push("--cpus", cpu);
  mounts.forEach(m => args.push("-v", m));
  args.push(image, "/bin/sh", "-c", commands.join(" && "));
  return new Promise<{ stdout: string; stderr: string; code: number }>((resolve) => {
    const proc = spawn("docker", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    proc.stdout.on("data", d => stdout += d.toString());
    proc.stderr.on("data", d => stderr += d.toString());
    const kill = setTimeout(() => { try { proc.kill(); } catch(e){} }, timeoutSec * 1000 + 2000);
    proc.on("error", (error) => { clearTimeout(kill); resolve({ stdout, stderr: `${stderr}${error.message}`, code: 125 }); });
    proc.on("close", code => { clearTimeout(kill); resolve({ stdout, stderr, code: code ?? 0 }); });
  });
}

async function handleSubmission(job: any) {
  const { submissionId } = job;
  const submission = await prisma.submission.findUnique({ where: { id: submissionId }, include: { problem: { include: { testCases: true } } , user: true } });
  if (!submission) return;
  await prisma.submission.update({ where: { id: submissionId }, data: { verdict: 'JUDGING' } as any });
  const tmp = path.join(WORKDIR, submissionId);
  await fs.rm(tmp, { recursive: true }).catch(()=>{});
  await fs.mkdir(tmp, { recursive: true });
  // write source
  let sourceFile = "solution";
  let compileCmd = null;
  let runCmd = null;
  let image = "";
  const lang = submission.language.toLowerCase();
  if (lang.includes("c") || lang.includes("cpp") || lang.includes("c++")) {
    sourceFile = "main.cpp";
    await fs.writeFile(path.join(tmp, sourceFile), submission.source, "utf8");
    compileCmd = "g++ -O2 -std=gnu++17 main.cpp -o main 2> compile.err";
    runCmd = "./main";
    image = "gcc:12";
  } else if (lang.includes("java")) {
    sourceFile = "Main.java";
    await fs.writeFile(path.join(tmp, sourceFile), submission.source, "utf8");
    compileCmd = "javac Main.java 2> compile.err";
    runCmd = "java -Xmx128M Main";
    image = "openjdk:17";
  } else if (lang.includes("python")) {
    sourceFile = "solution.py";
    await fs.writeFile(path.join(tmp, sourceFile), submission.source, "utf8");
    compileCmd = null;
    runCmd = "python3 solution.py";
    image = "python:3.10-slim";
  } else {
    await prisma.submission.update({ where: { id: submissionId }, data: { verdict: 'COMPILATION_ERROR', compileError: 'Unsupported language' } as any });
    return;
  }

  // copy testcases to local tmp
  const tcs = submission.problem.testCases;
  // compile step
  const mounts = [`${tmp}:/workspace`];
  if (compileCmd) {
    const { stdout, stderr, code } = await execDocker([`cd /workspace`, compileCmd], image, mounts, "0.5", "256m", 20);
    const compileErr = await fs.readFile(path.join(tmp, "compile.err")).then(b=>b.toString()).catch(()=>stdout+stderr);
    if (code !== 0) {
      await prisma.submission.update({ where: { id: submissionId }, data: { verdict: 'COMPILATION_ERROR', compileError: compileErr } as any });
      return;
    }
  }

  // execute per testcase
  let overallVerdict: any = 'ACCEPTED';
  let totalScore = 0;
  for (const tc of tcs) {
    const inPath = path.join(tmp, `in_${tc.id}.txt`);
    await fs.writeFile(inPath, tc.input, "utf8");
    // run with timeout and capture output
    const commands = [`cd /workspace`, `timeout 5 ${runCmd} < ${path.basename(inPath)} > out_${tc.id}.txt 2> err_${tc.id}.txt || exit 124`];
    const { stdout, stderr, code } = await execDocker(commands, image, mounts, "0.5", `${submission.problem.memoryLimitKb}k`, Math.max(5, Math.ceil(submission.problem.timeLimitMs/1000)+2));
    // read outputs
    const out = await fs.readFile(path.join(tmp, `out_${tc.id}.txt`)).then(b=>b.toString()).catch(()=>"");
    const err = await fs.readFile(path.join(tmp, `err_${tc.id}.txt`)).then(b=>b.toString()).catch(()=>"");
    let verdict = 'ACCEPTED';
    if (code === 124) verdict = 'TIME_LIMIT_EXCEEDED';
    // simple compare trimmed
    const expected = (tc.output || "").trim();
    const actual = out.trim();
    if (verdict === 'ACCEPTED' && expected !== actual) verdict = 'WRONG_ANSWER';
    if (verdict !== 'ACCEPTED') overallVerdict = verdict;
    if (verdict === 'ACCEPTED') {
      totalScore += (tc.weight || 1);
    }
    await prisma.run.create({ data: { submissionId, testCaseId: tc.id, verdict, stdout: out, stderr: err } as any });
  }

  await prisma.submission.update({ where: { id: submissionId }, data: { verdict: overallVerdict, score: totalScore } as any });
  if (overallVerdict === 'ACCEPTED') {
    // Review creation is deliberately best-effort: judging stays available if
    // an integrity provider is temporarily unavailable.
    scanSubmissionForSimilarity(submissionId).catch((error) => console.error("Similarity scan failed:", error));
  }
}

async function loop() {
  await ensureDir();
  while (true) {
    try {
      const job = await dequeueJob(10);
      if (!job) continue;
      await handleSubmission(job);
    } catch (err) {
      console.error("Judge worker error:", err);
      await new Promise(r=>setTimeout(r, 2000));
    }
  }
}

if (require.main === module) {
  loop();
}

export default { loop };
