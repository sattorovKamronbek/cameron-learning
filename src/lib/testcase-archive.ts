import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

export type ArchiveTestCase = { input: string; output: string };

const manifestName = 'manifest.json';

function caseName(index: number): string {
  return String(index + 1).padStart(4, '0');
}

/** A portable archive: tests/0001.in, tests/0001.out, ... */
export function createTestcaseArchive(testCases: ArchiveTestCase[]): Uint8Array {
  const files: Record<string, Uint8Array> = {
    [manifestName]: strToU8(JSON.stringify({ format: 'cameron-testcases', version: 1, count: testCases.length }, null, 2)),
  };
  testCases.forEach((testCase, index) => {
    const name = caseName(index);
    files[`tests/${name}.in`] = strToU8(testCase.input);
    files[`tests/${name}.out`] = strToU8(testCase.output);
  });
  return zipSync(files, { level: 6 });
}

export function downloadTestcaseArchive(testCases: ArchiveTestCase[], baseName = 'testcases'): void {
  if (!testCases.length) throw new Error('ZIP yuklab olish uchun kamida bitta test kerak.');
  const archive = createTestcaseArchive(testCases);
  const objectUrl = URL.createObjectURL(new Blob([archive], { type: 'application/zip' }));
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = `${baseName.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '') || 'testcases'}.zip`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

/** Reads the archive above and conventional .in/.out ZIP pairs. */
export function readTestcaseArchive(buffer: ArrayBuffer): ArchiveTestCase[] {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(new Uint8Array(buffer));
  } catch {
    throw new Error('ZIP faylni o‘qib bo‘lmadi. To‘g‘ri .zip arxiv yuklang.');
  }

  const inputs = new Map<string, string>();
  const outputs = new Map<string, string>();
  for (const [fileName, contents] of Object.entries(files)) {
    const normalized = fileName.replace(/\\/g, '/').replace(/^\.\//, '');
    if (normalized === manifestName || normalized.endsWith('/')) continue;
    const match = normalized.match(/^(.*)\.(in|out)$/i);
    if (!match) continue;
    const key = match[1].replace(/^tests\//i, '');
    if (match[2].toLowerCase() === 'in') inputs.set(key, strFromU8(contents));
    else outputs.set(key, strFromU8(contents));
  }

  const names = [...inputs.keys()].sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
  if (!names.length) throw new Error('ZIP ichida .in fayllar topilmadi. Masalan: tests/0001.in va tests/0001.out.');
  const missingOutput = names.filter((name) => !outputs.has(name));
  if (missingOutput.length) throw new Error(`${missingOutput.slice(0, 3).join(', ')} uchun .out fayl topilmadi.`);
  const missingInput = [...outputs.keys()].filter((name) => !inputs.has(name));
  if (missingInput.length) throw new Error(`${missingInput.slice(0, 3).join(', ')} uchun .in fayl topilmadi.`);

  return names.map((name) => ({ input: inputs.get(name) ?? '', output: outputs.get(name) ?? '' }));
}
