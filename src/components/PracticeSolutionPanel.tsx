import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Code2, Loader2, Play, RotateCcw, TerminalSquare, XCircle } from 'lucide-react';
import { Link } from '@/router';
import { useAuth } from '@/lib/auth';
import {
  practiceLanguageOptions,
  practiceTemplates,
  previewPracticeSolution,
  type PracticeExample,
  type PracticeLanguage,
  type PracticePreviewResult,
} from '@/lib/practice-preview';

type PracticeSolutionPanelProps = { problemSlug: string; examples: PracticeExample[] };

function draftKey(problemSlug: string): string { return `cameron-practice-draft:${problemSlug}`; }
function statusStyle(status: PracticePreviewResult['status']): string {
  return status === 'Accepted' ? 'bg-success-50 text-success-700' : status === 'Wrong answer' ? 'bg-error-50 text-error-700' : 'bg-sun-50 text-sun-700';
}

function CodeEditor({ source, onChange }: { source: string; onChange: (value: string) => void }) {
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLPreElement>(null);
  const lineNumbers = useMemo(() => Array.from({ length: Math.max(1, source.split('\n').length) }, (_, index) => index + 1).join('\n'), [source]);
  const syncScroll = () => { if (editorRef.current && gutterRef.current) gutterRef.current.scrollTop = editorRef.current.scrollTop; };
  return <div className="relative min-h-[34rem] overflow-hidden rounded-xl border border-slate-800 bg-[#111827] shadow-inner xl:min-h-[calc(100vh-17rem)]">
    <pre ref={gutterRef} aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-14 overflow-hidden border-r border-white/10 bg-slate-900 px-3 py-4 text-right font-mono text-xs leading-6 text-slate-500">{lineNumbers}</pre>
    <textarea ref={editorRef} value={source} onChange={(event) => onChange(event.target.value)} onScroll={syncScroll} spellCheck={false} autoCapitalize="off" autoCorrect="off" className="absolute inset-0 h-full w-full resize-none overflow-auto bg-transparent py-4 pl-[4.5rem] pr-4 font-mono text-[13px] leading-6 text-slate-100 outline-none caret-cyan-300 selection:bg-indigo-500/50" aria-label="Yechim kodi" />
  </div>;
}

export function PracticeSolutionPanel({ problemSlug, examples }: PracticeSolutionPanelProps) {
  const { user, loading: authLoading } = useAuth();
  const [language, setLanguage] = useState<PracticeLanguage>('cpp17');
  const [source, setSource] = useState(() => window.localStorage.getItem(draftKey(problemSlug)) ?? practiceTemplates.cpp17);
  const [results, setResults] = useState<PracticePreviewResult[] | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const publicExamples = useMemo(() => examples.slice(0, 8), [examples]);

  useEffect(() => { window.localStorage.setItem(draftKey(problemSlug), source); }, [problemSlug, source]);
  useEffect(() => {
    const stored = window.localStorage.getItem(draftKey(problemSlug));
    setSource(stored ?? practiceTemplates.cpp17);
    setLanguage('cpp17');
    setResults(null);
    setError(null);
  }, [problemSlug]);

  const changeLanguage = (next: PracticeLanguage) => {
    setLanguage(next);
    setSource(practiceTemplates[next]);
    setResults(null);
    setError(null);
  };
  const reset = () => { setSource(practiceTemplates[language]); setResults(null); setError(null); };
  const run = async () => {
    if (!source.trim()) { setError('Avval yechim kodini yozing.'); return; }
    if (!publicExamples.length) { setError('Bu masalada public sample yo‘q, shuning uchun preview ishga tushmaydi.'); return; }
    setRunning(true);
    setError(null);
    try {
      setResults(await previewPracticeSolution(source, language, publicExamples));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Samplelarda tekshirishni bajarib bo‘lmadi.');
    } finally {
      setRunning(false);
    }
  };

  return <section className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl shadow-slate-900/20">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-slate-900 px-4 py-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white"><Code2 className="h-5 w-5" /></span><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-indigo-300">Practice workspace</p><h2 className="truncate text-sm font-extrabold text-white">Yechim yozish va tekshirish</h2></div></div>
      <div className="flex flex-wrap items-center gap-2"><label className="sr-only" htmlFor={`practice-language-${problemSlug}`}>Dasturlash tili</label><select id={`practice-language-${problemSlug}`} value={language} onChange={(event) => changeLanguage(event.target.value as PracticeLanguage)} disabled={running} className="rounded-lg border border-white/10 bg-slate-800 px-2.5 py-2 text-xs font-bold text-slate-100 outline-none ring-indigo-500 focus:ring-2 disabled:opacity-50">{practiceLanguageOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><button type="button" onClick={reset} disabled={running} className="rounded-lg px-2.5 py-2 text-xs font-bold text-slate-300 hover:bg-white/10 hover:text-white disabled:opacity-50" title="Kod namunasini tiklash"><RotateCcw className="h-4 w-4" /><span className="sr-only">Kod namunasini tiklash</span></button>{authLoading ? <span className="px-2 text-xs text-slate-400">Kirish…</span> : user ? <button type="button" onClick={() => void run()} disabled={running || !publicExamples.length} className="inline-flex items-center gap-2 rounded-lg bg-success-500 px-3.5 py-2 text-xs font-extrabold text-white shadow-sm transition hover:bg-success-600 disabled:cursor-wait disabled:opacity-60">{running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}{running ? 'Ishga tushmoqda…' : 'Run'}</button> : <Link to="/login" className="rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-extrabold text-white hover:bg-indigo-700">Kirish</Link>}</div>
    </header>
    <div className="border-b border-white/10 bg-slate-900/70 px-4 py-2 text-xs leading-relaxed text-slate-400">Draft avtomatik saqlanadi · {publicExamples.length} ta public sample · Kod network’ga chiqmasdan izolyatsiyalangan containerda ishlaydi.</div>
    <div className="p-3 sm:p-4"><CodeEditor source={source} onChange={setSource} /></div>
    <section className="border-t border-white/10 bg-slate-900/80 p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><TerminalSquare className="h-4 w-4 text-cyan-300" /><h3 className="text-sm font-bold text-white">Natijalar</h3></div>{error && <p role="alert" className="max-w-xl text-xs font-semibold text-error-300">{error}</p>}</div>{running ? <div className="mt-4 grid gap-3 sm:grid-cols-2">{[0, 1].map((index) => <div key={index} className="h-20 animate-pulse rounded-xl bg-white/10" />)}</div> : results ? <div className="mt-4 grid gap-3 lg:grid-cols-2">{results.map((result, index) => <article key={index} className="rounded-xl border border-white/10 bg-slate-950 p-3"><div className="flex items-center justify-between gap-2"><p className="text-xs font-bold text-slate-200">Namuna {index + 1}</p><span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${statusStyle(result.status)}`}>{result.status === 'Accepted' ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}{result.status}</span></div>{result.status !== 'Accepted' && <><p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Sizning output</p><pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap rounded-lg bg-black/40 p-2 font-mono text-[11px] leading-5 text-slate-200">{result.stdout || '—'}</pre>{result.stderr && <><p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Xatolik</p><pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap rounded-lg bg-error-950/40 p-2 font-mono text-[11px] leading-5 text-error-200">{result.stderr}</pre></>}</>}</article>)}</div> : <p className="mt-3 text-xs text-slate-400">Kodni yozib, yuqoridagi <span className="font-bold text-white">Run</span> tugmasi orqali samplelarda tekshiring.</p>}</section>
  </section>;
}
