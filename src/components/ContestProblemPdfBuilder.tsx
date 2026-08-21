import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileText, Loader2, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import {
  downloadContestProblemPdf,
  generateContestProblemPdf,
  type ContestProblemPdfArtifact,
  type ContestProblemPdfMetadata,
  type ContestProblemPdfOptions,
} from '@/lib/contest-problem-pdf';
import type { ProblemExample } from '@/lib/programming';

type EditorProblemSource = {
  title: string;
  statement: string;
  inputDescription: string;
  outputDescription: string;
  constraints: string;
  timeLimitMs: string;
  memoryLimitMb: string;
  examples: ProblemExample[];
};

type PdfBuilderProps = {
  problem: EditorProblemSource;
  contestName?: string;
  defaultProblemLetter?: string;
};

const defaultOptions: ContestProblemPdfOptions = {
  includeBranding: true,
  includeContestName: true,
  includeProblemLetter: true,
  includeLimits: true,
  includePageNumbers: true,
  includeFooter: true,
};

function sourceFromProblem(problem: EditorProblemSource): string {
  return [
    problem.statement.trim(),
    problem.inputDescription.trim() ? `## Kirish ma’lumotlari\n${problem.inputDescription.trim()}` : '',
    problem.outputDescription.trim() ? `## Chiqish ma’lumotlari\n${problem.outputDescription.trim()}` : '',
    problem.constraints.trim() ? `## Cheklovlar\n${problem.constraints.trim()}` : '',
  ].filter(Boolean).join('\n\n');
}

function optionLabel(key: keyof ContestProblemPdfOptions): string {
  return {
    includeBranding: 'Cameron Learning brendi',
    includeContestName: 'Contest nomi',
    includeProblemLetter: 'Masala harfi',
    includeLimits: 'Vaqt va xotira limitlari',
    includePageNumbers: 'Sahifa raqamlari',
    includeFooter: 'Footer',
  }[key];
}

function numberOrUndefined(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function initialMetadata(problem: EditorProblemSource, contestName?: string, defaultProblemLetter?: string): ContestProblemPdfMetadata {
  return {
    contestName: contestName ?? '', problemLetter: defaultProblemLetter ?? '', title: problem.title,
    timeLimitMs: numberOrUndefined(problem.timeLimitMs), memoryLimitMb: numberOrUndefined(problem.memoryLimitMb), language: 'Preserve original',
  };
}

export function ContestProblemPdfBuilder({ problem, contestName, defaultProblemLetter }: PdfBuilderProps) {
  const sourceFromEditor = sourceFromProblem(problem);
  const sourceKey = `${sourceFromEditor}\u0000${problem.title}\u0000${contestName ?? ''}\u0000${defaultProblemLetter ?? ''}`;
  const [problemContent, setProblemContent] = useState(sourceFromEditor);
  const [metadata, setMetadata] = useState<ContestProblemPdfMetadata>(() => initialMetadata(problem, contestName, defaultProblemLetter));
  const [options, setOptions] = useState(defaultOptions);
  const [artifact, setArtifact] = useState<ContestProblemPdfArtifact | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceDirty, setSourceDirty] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!sourceDirty) {
      setProblemContent(sourceFromEditor);
      setMetadata((current) => ({ ...current, contestName: contestName ?? '', problemLetter: defaultProblemLetter ?? '', title: problem.title, timeLimitMs: numberOrUndefined(problem.timeLimitMs), memoryLimitMb: numberOrUndefined(problem.memoryLimitMb) }));
    }
  }, [sourceKey, sourceFromEditor, sourceDirty, contestName, defaultProblemLetter, problem.title, problem.timeLimitMs, problem.memoryLimitMb]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.max(260, Math.min(textarea.scrollHeight, 720))}px`;
  }, [problemContent]);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const samples = useMemo(() => problem.examples.filter((sample) => sample.input || sample.output).map((sample) => ({ input: sample.input, output: sample.output, ...(sample.explanation?.trim() ? { explanation: sample.explanation.trim() } : {}) })), [problem.examples]);

  const generate = async () => {
    if (!problemContent.trim()) { setError('PDF uchun masala shartini kiriting.'); return; }
    setBusy(true);
    setError(null);
    try {
      const nextArtifact = await generateContestProblemPdf({ problemContent, metadata, options, samples });
      const nextPreviewUrl = URL.createObjectURL(nextArtifact.blob);
      setPreviewUrl((current) => { if (current) URL.revokeObjectURL(current); return nextPreviewUrl; });
      setArtifact(nextArtifact);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'PDF previewni yaratib bo‘lmadi.');
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setProblemContent(sourceFromEditor);
    setSourceDirty(false);
    setMetadata(initialMetadata(problem, contestName, defaultProblemLetter));
    setOptions(defaultOptions);
    setArtifact(null);
    setPreviewUrl((current) => { if (current) URL.revokeObjectURL(current); return null; });
    setError(null);
  };

  return <section className="space-y-5 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white"><Sparkles className="h-5 w-5" /></span><div><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">AI Problem PDF Builder</p><h3 className="mt-1 text-lg font-extrabold text-slate-900">AI Problem PDF Builder</h3><p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500">Mavjud masalani faqat print uchun formatlaydi. Shart, yechim mantig‘i va sample qiymatlari o‘zgarmaydi.</p></div></div>
      {artifact && <button type="button" onClick={() => downloadContestProblemPdf(artifact)} className="btn-primary px-4 py-2 text-xs"><Download className="h-4 w-4" />PDF yuklab olish</button>}
    </div>

    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,.9fr)]">
      <div className="space-y-4 rounded-xl border border-indigo-100 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-bold text-slate-800">Manba masala</p><p className="mt-1 text-xs text-slate-500">Editor’dagi public samplelar ({samples.length}) aynan saqlangan qiymatda alohida PDF’ga qo‘shiladi.</p></div><div className="flex gap-2"><button type="button" onClick={() => { setProblemContent(sourceFromEditor); setSourceDirty(false); setError(null); }} className="btn-ghost px-3 py-2 text-xs"><RefreshCw className="h-3.5 w-3.5" />Editor’dan yangilash</button><button type="button" onClick={reset} className="btn-ghost px-3 py-2 text-xs">Reset</button></div></div>
        <textarea ref={textareaRef} value={problemContent} onChange={(event) => { setProblemContent(event.target.value); setSourceDirty(true); }} spellCheck={false} className="input min-h-64 resize-y font-mono text-sm leading-6" placeholder="Mavjud programming masala shartini kiriting yoki editor’dagi shartni ishlating." aria-label="PDF uchun masala manbasi" />

        <details className="rounded-xl border border-slate-200 bg-slate-50 p-3" open><summary className="cursor-pointer text-sm font-bold text-slate-700">Metadata va ko‘rinish</summary><div className="mt-4 grid gap-3 sm:grid-cols-2"><PdfField label="Contest nomi" value={metadata.contestName ?? ''} onChange={(value) => setMetadata((current) => ({ ...current, contestName: value }))} /><PdfField label="Masala harfi" value={metadata.problemLetter ?? ''} onChange={(value) => setMetadata((current) => ({ ...current, problemLetter: value }))} /><PdfField label="Masala sarlavhasi" value={metadata.title ?? ''} onChange={(value) => setMetadata((current) => ({ ...current, title: value }))} /><PdfField label="Muallif (ixtiyoriy)" value={metadata.author ?? ''} onChange={(value) => setMetadata((current) => ({ ...current, author: value }))} /><PdfField label="Vaqt (ms)" type="number" value={metadata.timeLimitMs?.toString() ?? ''} onChange={(value) => setMetadata((current) => ({ ...current, timeLimitMs: numberOrUndefined(value) }))} /><PdfField label="Xotira (MB)" type="number" value={metadata.memoryLimitMb?.toString() ?? ''} onChange={(value) => setMetadata((current) => ({ ...current, memoryLimitMb: numberOrUndefined(value) }))} /><label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">Til</span><select value={metadata.language ?? 'Preserve original'} onChange={(event) => setMetadata((current) => ({ ...current, language: event.target.value }))} className="input h-10 py-2 text-sm"><option>Preserve original</option><option>English</option><option>Uzbek</option><option>Russian</option></select></label></div><div className="mt-4 grid gap-2 sm:grid-cols-2">{(Object.keys(options) as Array<keyof ContestProblemPdfOptions>).map((key) => <label key={key} className="flex cursor-pointer items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-medium text-slate-600 ring-1 ring-slate-100"><input type="checkbox" checked={options[key]} onChange={(event) => setOptions((current) => ({ ...current, [key]: event.target.checked }))} className="accent-indigo-600" />{optionLabel(key)}</label>)}</div></details>

        {error && <p role="alert" className="rounded-lg bg-error-50 px-3 py-2 text-xs font-semibold leading-relaxed text-error-700">{error}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="flex items-center gap-1.5 text-xs leading-relaxed text-slate-500"><ShieldCheck className="h-4 w-4 shrink-0 text-success-600" />AI kaliti brauzerga yuborilmaydi; hidden testlar yoki jury yechimlari ham yuborilmaydi.</p><button type="button" onClick={() => void generate()} disabled={busy} className="btn-primary px-4 py-2.5 text-sm disabled:cursor-wait disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}{busy ? 'Preview yaratilmoqda…' : artifact ? 'PDF previewni qayta yaratish' : 'PDF preview yaratish'}</button></div>
      </div>

      <div className="min-h-[34rem] overflow-hidden rounded-xl border border-slate-200 bg-slate-100"><div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3"><div><p className="text-sm font-bold text-slate-800">PDF preview</p><p className="mt-0.5 text-xs text-slate-500">Yuklab olishdan oldin tekshirib oling.</p></div>{artifact && <span className="rounded-full bg-success-50 px-2 py-1 text-[10px] font-bold text-success-700">Tayyor</span>}</div>{busy ? <div className="space-y-4 p-5"><div className="h-7 w-2/5 animate-pulse rounded bg-slate-200" /><div className="h-3 w-full animate-pulse rounded bg-slate-200" /><div className="h-3 w-5/6 animate-pulse rounded bg-slate-200" /><div className="h-28 animate-pulse rounded-lg bg-slate-200" /><div className="h-3 w-4/5 animate-pulse rounded bg-slate-200" /></div> : previewUrl ? <iframe src={previewUrl} title="Contest problem PDF preview" className="h-[33rem] w-full bg-white" /> : <div className="flex h-[29rem] flex-col items-center justify-center p-8 text-center"><FileText className="h-10 w-10 text-slate-300" /><p className="mt-3 text-sm font-bold text-slate-600">Preview hali tayyor emas</p><p className="mt-1 max-w-xs text-xs leading-relaxed text-slate-500">Mavjud masala matnini tekshiring va “PDF preview yaratish” tugmasini bosing.</p></div>}</div>
    </div>
  </section>;
}

function PdfField({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: 'text' | 'number' }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="input h-10 py-2 text-sm" /></label>;
}
