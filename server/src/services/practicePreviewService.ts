import { spawn } from "child_process";
import fs from "fs/promises";
import os from "os";
import path from "path";

const MAX_SOURCE_BYTES = 256 * 1024;
const MAX_PUBLIC_TESTS = 8;
const MAX_TEST_BYTES = 64 * 1024;
const MAX_OUTPUT_BYTES = 64 * 1024;

export type PracticePreviewLanguage = "cpp17" | "python3" | "java17";
export type PracticePreviewExample = { input: string; output: string };
export type PracticePreviewResult = {
  status: "Accepted" | "Wrong answer" | "Runtime error" | "Time limit" | "Compilation error";
  stdout: string;
  stderr: string;
};

type LanguageConfig = { image: string; sourceFile: string; compile?: string; command: string };
type DockerResult = { stdout: string; stderr: string; code: number; timedOut: boolean };

export class PracticePreviewValidationError extends Error {}

function configFor(language: unknown): LanguageConfig {
  const value = typeof language === "string" ? language.toLowerCase() : "";
  if (value === "cpp17" || value === "c++17") return { image: "gcc:12", sourceFile: "main.cpp", compile: "g++ -O2 -std=gnu++17 main.cpp -o main 2> compile.err", command: "./main" };
  if (value === "python3") return { image: "python:3.12-alpine", sourceFile: "main.py", command: "python3 main.py" };
  if (value === "java17") return { image: "openjdk:17", sourceFile: "Main.java", compile: "javac Main.java 2> compile.err", command: "java -Xmx128M Main" };
  throw new PracticePreviewValidationError("C++17, Python 3 yoki Java 17 ni tanlang");
}

function appendLimited(current: string, next: Buffer, limit = MAX_OUTPUT_BYTES): string {
  if (current.length >= limit) return current;
  return `${current}${next.toString("utf8")}`.slice(0, limit);
}

function dockerRun(workdir: string, image: string, command: string, timeoutSeconds: number): Promise<DockerResult> {
  const args = [
    "run", "--rm", "--network", "none", "--pids-limit", "64", "--cap-drop=ALL", "--security-opt", "no-new-privileges", "--read-only",
    "--memory", "192m", "--cpus", "0.5", "--tmpfs", "/tmp:rw,noexec,nosuid,size=32m", "-v", `${workdir}:/workspace:rw`, image,
    "/bin/sh", "-c", command,
  ];
  return new Promise((resolve) => {
    const process = spawn("docker", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    process.stdout.on("data", (data: Buffer) => { stdout = appendLimited(stdout, data); });
    process.stderr.on("data", (data: Buffer) => { stderr = appendLimited(stderr, data); });
    const killer = setTimeout(() => { timedOut = true; process.kill("SIGKILL"); }, (timeoutSeconds + 2) * 1000);
    process.on("error", (error) => { clearTimeout(killer); resolve({ stdout, stderr: appendLimited(stderr, Buffer.from(error.message)), code: 125, timedOut }); });
    process.on("close", (code) => { clearTimeout(killer); resolve({ stdout, stderr, code: code ?? 125, timedOut }); });
  });
}

function normalizedOutput(value: string): string {
  return value.trim().split(/\s+/).filter(Boolean).join(" ");
}

export function validatePracticePreviewRequest(body: unknown): { source: string; config: LanguageConfig; examples: PracticePreviewExample[] } {
  if (!body || typeof body !== "object") throw new PracticePreviewValidationError("Kod va samplelar talab qilinadi");
  const input = body as Record<string, unknown>;
  const source = typeof input.source === "string" ? input.source : "";
  if (!source.trim() || Buffer.byteLength(source, "utf8") > MAX_SOURCE_BYTES) throw new PracticePreviewValidationError("Kod 1–256 KiB oralig‘ida bo‘lishi kerak");
  const rawExamples = Array.isArray(input.examples) ? input.examples : [];
  if (!rawExamples.length || rawExamples.length > MAX_PUBLIC_TESTS) throw new PracticePreviewValidationError(`1 dan ${MAX_PUBLIC_TESTS} tagacha public sample tanlang`);
  const examples = rawExamples.map((entry, index): PracticePreviewExample => {
    if (!entry || typeof entry !== "object") throw new PracticePreviewValidationError(`Namuna ${index + 1} noto‘g‘ri`);
    const sample = entry as Record<string, unknown>;
    const example = { input: typeof sample.input === "string" ? sample.input : "", output: typeof sample.output === "string" ? sample.output : "" };
    if (Buffer.byteLength(example.input, "utf8") + Buffer.byteLength(example.output, "utf8") > MAX_TEST_BYTES) throw new PracticePreviewValidationError(`Namuna ${index + 1} juda katta`);
    return example;
  });
  return { source, config: configFor(input.language), examples };
}

/** Runs only public examples in an isolated container; it never reads hidden tests. */
export async function runPracticePreview(body: unknown): Promise<PracticePreviewResult[]> {
  const { source, config, examples } = validatePracticePreviewRequest(body);
  const workdir = await fs.mkdtemp(path.join(os.tmpdir(), "practice-preview-"));
  try {
    await fs.writeFile(path.join(workdir, config.sourceFile), source, "utf8");
    if (config.compile) {
      const compilation = await dockerRun(workdir, config.image, `cd /workspace && ${config.compile}`, 15);
      const compilerOutput = await fs.readFile(path.join(workdir, "compile.err"), "utf8").catch(() => compilation.stderr);
      if (compilation.code !== 0 || compilation.timedOut) {
        return examples.map(() => ({ status: "Compilation error", stdout: "", stderr: compilerOutput.slice(0, MAX_OUTPUT_BYTES) }));
      }
    }
    const results: PracticePreviewResult[] = [];
    for (let index = 0; index < examples.length; index += 1) {
      const inputName = `input-${index}.txt`;
      await fs.writeFile(path.join(workdir, inputName), examples[index].input, "utf8");
      const execution = await dockerRun(workdir, config.image, `cd /workspace && timeout 3 ${config.command} < ${inputName}`, 5);
      const status: PracticePreviewResult["status"] = execution.timedOut || execution.code === 124
        ? "Time limit"
        : execution.code !== 0
          ? "Runtime error"
          : normalizedOutput(execution.stdout) === normalizedOutput(examples[index].output)
            ? "Accepted"
            : "Wrong answer";
      results.push({ status, stdout: execution.stdout, stderr: execution.stderr });
    }
    return results;
  } finally {
    await fs.rm(workdir, { recursive: true, force: true });
  }
}
