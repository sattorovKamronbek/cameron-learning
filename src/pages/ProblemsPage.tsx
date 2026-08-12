import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowRight, BookOpenCheck, Clock3, Code2, LibraryBig, RefreshCw, Search, SlidersHorizontal, Trophy } from 'lucide-react';
import { Link } from '@/router';
import { LoadingState } from '@/components/LoadingState';
import { fetchPublicProgrammingProblems, formatProblemLimit, type ProgrammingDifficulty, type ProgrammingProblem } from '@/lib/programming';

type DifficultyFilter = 'all' | ProgrammingDifficulty;

export function ProblemsPage() {
  const [problems, setProblems] = useState<ProgrammingProblem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [difficulty, setDifficulty] = useState<DifficultyFilter>('all');
  const [tag, setTag] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProblems(await fetchPublicProgrammingProblems());
    } catch (reason) {
      setProblems([]);
      setError(reason instanceof Error ? reason.message : 'Masalalar yuklanmadi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const tags = useMemo(() => [...new Set(problems.flatMap((problem) => problem.tags))].sort(), [problems]);
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return problems.filter((problem) => {
      const matchesText = !needle || [problem.title, ...problem.tags].some((value) => value.toLowerCase().includes(needle));
      return matchesText && (difficulty === 'all' || problem.difficulty === difficulty) && (tag === 'all' || problem.tags.includes(tag));
    });
  }, [problems, search, difficulty, tag]);

  return (
    <div className="min-h-screen bg-slate-50">
      <section className="relative overflow-hidden bg-slate-950 pt-28 text-white">
        <div className="absolute inset-0 bg-grid-dark opacity-10" />
        <div className="container-page relative grid gap-8 py-14 lg:grid-cols-[1fr_auto] lg:items-end">
          <div><span className="inline-flex items-center gap-2 rounded-full bg-indigo-400/15 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-indigo-200"><Code2 className="h-3.5 w-3.5" />Practice</span><h1 className="mt-4 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">Masalalar banki</h1><p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-300">Programming masalalarini yeching. Contest uchun yaratilgan masalalar contest tugashi bilan bu katalogga avtomatik qo‘shiladi.</p></div>
          <div className="flex gap-3 text-sm"><div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4"><p className="font-display text-2xl font-extrabold">{loading ? '—' : problems.length}</p><p className="mt-1 text-xs text-slate-400">Practice masala</p></div><div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4"><p className="font-display text-2xl font-extrabold">{loading ? '—' : tags.length}</p><p className="mt-1 text-xs text-slate-400">Mavzu</p></div></div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white"><div className="container-page flex flex-wrap items-center gap-3 py-4"><div className="relative min-w-[220px] flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} className="input pl-9" placeholder="Masala yoki teg qidiring" /></div><div className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4 text-slate-400" /><select value={difficulty} onChange={(event) => setDifficulty(event.target.value as DifficultyFilter)} className="input w-auto"><option value="all">Barcha darajalar</option><option value="Easy">Easy</option><option value="Medium">Medium</option><option value="Hard">Hard</option></select><select value={tag} onChange={(event) => setTag(event.target.value)} className="input w-auto"><option value="all">Barcha teglar</option>{tags.map((entry) => <option key={entry} value={entry}>{entry}</option>)}</select></div></div></section>

      <main className="container-page py-9">{loading ? <LoadingState className="card min-h-[22rem]" message="Masalalar yuklanmoqda" /> : error ? <div className="card p-10 text-center"><AlertCircle className="mx-auto h-10 w-10 text-error-500" /><h2 className="mt-4 text-lg font-bold text-slate-900">Masalalar yuklanmadi</h2><p className="mx-auto mt-2 max-w-lg text-sm text-slate-500">{error}</p><button type="button" onClick={() => void load()} className="btn-ghost mt-5"><RefreshCw className="h-4 w-4" />Qayta urinish</button></div> : filtered.length ? <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft"><div className="hidden grid-cols-[64px_minmax(0,1fr)_120px_145px_180px] gap-4 border-b border-slate-100 bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-400 md:grid"><span>#</span><span>Masala</span><span>Qiyinlik</span><span>Cheklovlar</span><span>Teglar</span></div><div className="divide-y divide-slate-100">{filtered.map((problem, index) => <ProblemRow key={problem.id} problem={problem} number={index + 1} />)}</div></div> : <div className="card p-12 text-center"><LibraryBig className="mx-auto h-10 w-10 text-slate-300" /><h2 className="mt-4 text-lg font-bold text-slate-900">Mos masala topilmadi</h2><p className="mt-2 text-sm text-slate-500">Qidiruv yoki filterlarni o‘zgartirib ko‘ring.</p></div>}</main>
    </div>
  );
}

function ProblemRow({ problem, number }: { problem: ProgrammingProblem; number: number }) {
  return <Link to={`/problems/${problem.slug}`} className="grid gap-3 px-5 py-4 transition-colors hover:bg-indigo-50/50 md:grid-cols-[64px_minmax(0,1fr)_120px_145px_180px] md:items-center md:gap-4"><div className="flex items-center gap-2 text-sm font-bold text-slate-400"><span className="hidden md:inline">{number}</span><span className="md:hidden"><BookOpenCheck className="h-4 w-4 text-indigo-600" /></span></div><div className="min-w-0"><p className="truncate font-semibold text-slate-800">{problem.title}</p><p className="mt-1 text-xs text-slate-500 md:hidden">{formatProblemLimit(problem.timeLimitMs, problem.memoryLimitMb)}</p></div><DifficultyBadge difficulty={problem.difficulty} /><div className="hidden text-sm text-slate-500 md:flex md:items-center md:gap-2"><Clock3 className="h-3.5 w-3.5" />{formatProblemLimit(problem.timeLimitMs, problem.memoryLimitMb)}</div><div className="flex flex-wrap gap-1.5">{problem.tags.slice(0, 3).map((entry) => <span key={entry} className="chip bg-slate-100 text-slate-600">{entry}</span>)}{problem.publicationScope === 'contest' && <span className="chip bg-sun-50 text-sun-700"><Trophy className="h-3 w-3" />Contest</span>}</div><ArrowRight className="hidden h-4 w-4 text-slate-400 md:block" /></Link>;
}

function DifficultyBadge({ difficulty }: { difficulty: ProgrammingDifficulty }) {
  const styles: Record<ProgrammingDifficulty, string> = { Easy: 'bg-success-50 text-success-700', Medium: 'bg-sun-50 text-sun-700', Hard: 'bg-error-50 text-error-700' };
  return <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-bold ${styles[difficulty]}`}>{difficulty}</span>;
}
