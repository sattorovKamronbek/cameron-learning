import { supabase } from '@/lib/supabase';

export type ContestProblemPdfMetadata = {
  contestName?: string;
  problemLetter?: string;
  title?: string;
  timeLimitMs?: number;
  memoryLimitMb?: number;
  author?: string;
  language?: string;
};

export type ContestProblemPdfOptions = {
  includeBranding: boolean;
  includeContestName: boolean;
  includeProblemLetter: boolean;
  includeLimits: boolean;
  includePageNumbers: boolean;
  includeFooter: boolean;
};

export type ContestProblemPdfSample = {
  input: string;
  output: string;
  explanation?: string;
};

export type ContestProblemPdfRequest = {
  problemContent: string;
  metadata: ContestProblemPdfMetadata;
  options: ContestProblemPdfOptions;
  samples: ContestProblemPdfSample[];
};

export type ContestProblemPdfArtifact = {
  blob: Blob;
  filename: string;
};

function filenameFromDisposition(value: string | null): string {
  const match = value?.match(/filename="?([^";]+)"?/i);
  const candidate = match?.[1]?.trim().replace(/[\\/\0]/g, '-');
  return candidate && candidate.toLowerCase().endsWith('.pdf') ? candidate : 'cameron-learning-problem.pdf';
}

async function responseError(response: Response): Promise<Error> {
  const text = await response.text();
  try {
    const payload = JSON.parse(text) as { error?: string; details?: string };
    return new Error(payload.details || payload.error || 'PDF previewni yaratib bo‘lmadi.');
  } catch {
    return new Error('PDF previewni yaratib bo‘lmadi.');
  }
}

/** Calls the protected server endpoint; no AI credential is ever present here. */
export async function generateContestProblemPdf(request: ContestProblemPdfRequest): Promise<ContestProblemPdfArtifact> {
  const { data } = await supabase.auth.getSession();
  const apiBase = (import.meta.env.VITE_JUDGE_API_URL ?? '').replace(/\/$/, '');
  const response = await fetch(`${apiBase}/api/contest-problem-pdf/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {}),
    },
    body: JSON.stringify(request),
  });
  if (!response.ok) throw await responseError(response);
  if (!response.headers.get('content-type')?.includes('application/pdf')) throw new Error('Server PDF faylini qaytarmadi.');
  return { blob: await response.blob(), filename: filenameFromDisposition(response.headers.get('content-disposition')) };
}

export function downloadContestProblemPdf(artifact: ContestProblemPdfArtifact): void {
  const url = URL.createObjectURL(artifact.blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = artifact.filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
