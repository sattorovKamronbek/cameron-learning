import { supabase } from '@/lib/supabase';
import type { ArchiveTestCase } from '@/lib/testcase-archive';

export type TestcaseGeneratorLanguage = 'javascript' | 'python3' | 'cpp17';
export type GeneratorSources = { generatorSource: string; referenceSource: string };
export type GeneratorRequest = GeneratorSources & { language: TestcaseGeneratorLanguage; count: number; seed: number };

export const generatorLanguageOptions: { value: TestcaseGeneratorLanguage; label: string }[] = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'python3', label: 'Python 3' },
  { value: 'cpp17', label: 'C++17' },
];

export const generatorExamples: Record<TestcaseGeneratorLanguage, GeneratorSources> = {
  javascript: {
    generatorSource: `function random(seed) {
  let value = seed >>> 0;
  return () => ((value = (value * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function generate(seed) {
  const next = random(seed);
  const a = Math.floor(next() * 1000) + 1;
  const b = Math.floor(next() * 1000) + 1;
  return \`${'${a} ${b}'}\\n\`;
}`,
    referenceSource: `function solve(input) {
  const [a, b] = input.trim().split(/\\s+/).map(Number);
  return String(a + b) + '\\n';
}`,
  },
  python3: {
    generatorSource: `def generate(seed: int) -> str:
    import random
    random.seed(seed)
    a = random.randint(1, 1000)
    b = random.randint(1, 1000)
    return f"{a} {b}\\n"`,
    referenceSource: `def solve(input_text: str) -> str:
    a, b = map(int, input_text.split())
    return f"{a + b}\\n"`,
  },
  cpp17: {
    generatorSource: `#include <bits/stdc++.h>
using namespace std;

int main(int argc, char** argv) {
  mt19937 rng(argc > 1 ? stoul(argv[1]) : 1);
  cout << uniform_int_distribution<int>(1, 1000)(rng) << ' '
       << uniform_int_distribution<int>(1, 1000)(rng) << '\\n';
}`,
    referenceSource: `#include <bits/stdc++.h>
using namespace std;

int main() {
  long long a, b;
  cin >> a >> b;
  cout << a + b << '\\n';
}`,
  },
};

function validate(request: GeneratorRequest): void {
  if (!request.generatorSource.trim() || !request.referenceSource.trim()) throw new Error('Generator va reference solution kodini kiriting.');
  if (!Number.isInteger(request.count) || request.count < 1 || request.count > 25) throw new Error('Testlar soni 1 dan 25 gacha bo‘lishi kerak.');
}

function workerScript(): string {
  return `self.onmessage = ({ data }) => {
  try {
    const generate = Function('"use strict"; ' + data.generatorSource + '; return typeof generate === "function" ? generate : null;')();
    const solve = Function('"use strict"; ' + data.referenceSource + '; return typeof solve === "function" ? solve : null;')();
    if (!generate || !solve) throw new Error('generate(seed) va solve(input) funksiyalarini yozing.');
    const tests = [];
    for (let index = 0; index < data.count; index += 1) {
      const input = generate(data.seed + index);
      if (typeof input !== 'string' || !input.trim()) throw new Error('generate(seed) bo‘sh bo‘lmagan matn qaytarishi kerak.');
      const output = solve(input);
      if (typeof output !== 'string') throw new Error('solve(input) matn qaytarishi kerak.');
      tests.push({ input, output });
    }
    self.postMessage({ tests });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
};`;
}

/** Trusted JavaScript generator runs outside the editor UI thread. */
export function generateJavaScriptTestCases(request: GeneratorRequest): Promise<ArchiveTestCase[]> {
  validate(request);
  return new Promise((resolve, reject) => {
    const workerUrl = URL.createObjectURL(new Blob([workerScript()], { type: 'text/javascript' }));
    const worker = new Worker(workerUrl);
    const finish = () => { worker.terminate(); URL.revokeObjectURL(workerUrl); };
    const timeout = window.setTimeout(() => { finish(); reject(new Error('Generator 5 soniyada tugamadi. Kodni soddalashtiring.')); }, 5_000);
    worker.onmessage = ({ data }: MessageEvent<{ tests?: ArchiveTestCase[]; error?: string }>) => {
      window.clearTimeout(timeout); finish();
      if (data.error) reject(new Error(data.error));
      else resolve(data.tests ?? []);
    };
    worker.onerror = () => { window.clearTimeout(timeout); finish(); reject(new Error('JavaScript generator ishga tushmadi.')); };
    worker.postMessage(request);
  });
}

/** C++ and Python run in the isolated judge API (VITE_JUDGE_API_URL, or same-origin /api). */
export async function generateRemoteTestCases(request: GeneratorRequest): Promise<ArchiveTestCase[]> {
  validate(request);
  const { data: sessionData } = await supabase.auth.getSession();
  const apiBase = (import.meta.env.VITE_JUDGE_API_URL ?? '').replace(/\/$/, '');
  const response = await fetch(`${apiBase}/api/problems/testcase-generator/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(sessionData.session?.access_token ? { Authorization: `Bearer ${sessionData.session.access_token}` } : {}) },
    body: JSON.stringify(request),
  });
  const payload = await response.json().catch(() => ({})) as { error?: string; details?: string; testCases?: ArchiveTestCase[] };
  if (!response.ok) throw new Error(payload.details || payload.error || 'Generator xizmati testlarni yarata olmadi.');
  return payload.testCases ?? [];
}
