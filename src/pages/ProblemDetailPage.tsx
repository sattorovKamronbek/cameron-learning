import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowLeft, BookOpenCheck, Clock3, Code2, FileText, HardDrive, Lightbulb, Tag, Trophy } from 'lucide-react';
import { Link, useRouter } from '@/router';
import { LoadingState } from '@/components/LoadingState';
import { fetchProgrammingProblem, type ProgrammingProblem } from '@/lib/programming';

export function ProblemDetailPage({ slug }: { slug: string }) {
  const { query } = useRouter();
  const contestSlug = query.get('contest') || undefined;
  const [problem, setProblem] = useState<ProgrammingProblem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProblem(await fetchProgrammingProblem(slug, contestSlug));
    } catch (reason) {
      setProblem(null);
      setError(reason instanceof Error ? reason.message : 'Masala yuklanmadi.');
    } finally {
      setLoading(false);
    }
  }, [slug, contestSlug]);
  useEffect(() => { void load(); }, [load]);

  const statementLines = useMemo(() => problem?.statement.split(/\n{2,}/).filter(Boolean) ?? [], [problem]);
  if (loading) return <LoadingState className="min-h-[65vh]" message="Masala yuklanmoqda" />;
  if (!problem) return <div className="container-page py-32"><div className="card mx-auto max-w-xl p-10 text-center"><AlertCircle className="mx-auto h-10 w-10 text-error-500" /><h1 className="mt-4 text-xl font-bold text-slate-900">Masala topilmadi</h1><p className="mt-2 text-sm text-slate-500">{error ?? 'Masala hali Practice katalogida ochilmagan yoki mavjud emas.'}</p><Link to="/problems" className="btn-primary mt-6">Masalalar bankiga qaytish</Link></div></div>;

  return <div className="min-h-screen bg-slate-50 pt-24"><div className="container-page py-6"><Link to="/problems" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-indigo-700"><ArrowLeft className="h-4 w-4" />Masalalar banki</Link><div className="mt-5 grid gap-7 lg:grid-cols-[minmax(0,1fr)_300px]"><article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft"><header className="border-b border-slate-100 px-6 py-6 sm:px-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><span className="chip bg-indigo-50 text-indigo-700"><Code2 className="h-3.5 w-3.5" />Practice problem</span>{problem.publicationScope === 'contest' && <span className="chip bg-sun-50 text-sun-700"><Trophy className="h-3.5 w-3.5" />From contest</span>}</div><h1 className="mt-4 font-display text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">{problem.title}</h1></div><span className={`rounded-full px-3 py-1.5 text-xs font-bold ${problem.difficulty === 'Easy' ? 'bg-success-50 text-success-700' : problem.difficulty === 'Hard' ? 'bg-error-50 text-error-700' : 'bg-sun-50 text-sun-700'}`}>{problem.difficulty}</span></div></header><div className="px-6 py-7 sm:px-8"><section className="prose prose-slate max-w-none"><h2>Shart</h2>{statementLines.map((line, index) => <p key={index} className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{line}</p>)}</section>{problem.inputDescription && <StatementSection icon={FileText} title="Input"><p className="whitespace-pre-wrap">{problem.inputDescription}</p></StatementSection>}{problem.outputDescription && <StatementSection icon={FileText} title="Output"><p className="whitespace-pre-wrap">{problem.outputDescription}</p></StatementSection>}{problem.constraints && <StatementSection icon={Tag} title="Cheklovlar"><pre className="mt-3 overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">{problem.constraints}</pre></StatementSection>}{problem.examples.length > 0 && <section className="mt-9"><h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><BookOpenCheck className="h-5 w-5 text-indigo-600" />Namunalar</h2><div className="mt-4 space-y-4">{problem.examples.map((example, index) => <div key={index} className="overflow-hidden rounded-xl border border-slate-200"><div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-500">Namuna {index + 1}</div><div className="grid divide-y divide-slate-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0"><CodeBlock label="Input" value={example.input} /><CodeBlock label="Output" value={example.output} /></div>{example.explanation && <p className="border-t border-slate-100 px-4 py-3 text-sm leading-relaxed text-slate-600">{example.explanation}</p>}</div>)}</div></section>}{problem.editorial && <section className="mt-9 rounded-2xl border border-sun-100 bg-sun-50/50 p-5"><h2 className="flex items-center gap-2 text-lg font-bold text-sun-900"><Lightbulb className="h-5 w-5" />Editorial</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-sun-900/80">{problem.editorial}</p></section>}</div></article><aside className="space-y-5"><div className="card p-5"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Limits</p><dl className="mt-4 space-y-4"><Fact icon={Clock3} label="Time limit" value={`${problem.timeLimitMs / 1000} second`} /><Fact icon={HardDrive} label="Memory limit" value={`${problem.memoryLimitMb} MB`} /><Fact icon={Code2} label="Platform" value="Standard input/output" /></dl></div><div className="card p-5"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Teglar</p><div className="mt-4 flex flex-wrap gap-2">{problem.tags.length ? problem.tags.map((entry) => <span key={entry} className="chip bg-slate-100 text-slate-600">{entry}</span>) : <span className="text-sm text-slate-500">Teglar kiritilmagan</span>}</div></div><div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-5"><Code2 className="h-5 w-5 text-indigo-700" /><h2 className="mt-3 text-sm font-bold text-indigo-950">Yechim yuborish</h2><p className="mt-1 text-xs leading-relaxed text-indigo-800">Judge backend ulangan muhitda shu masala uchun C++17, Python 3 yoki Java 17 yechimi yuboriladi.</p></div></aside></div></div></div>;
}

function StatementSection({ icon: Icon, title, children }: { icon: typeof FileText; title: string; children: React.ReactNode }) {
  return <section className="mt-9"><h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><Icon className="h-5 w-5 text-indigo-600" />{title}</h2><div className="mt-3 text-sm leading-7 text-slate-700">{children}</div></section>;
}

function CodeBlock({ label, value }: { label: string; value: string }) { return <div className="p-4"><p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p><pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs leading-6 text-slate-800">{value}</pre></div>; }
function Fact({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: string }) { return <div className="flex items-center gap-3"><Icon className="h-4 w-4 text-indigo-600" /><div><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-0.5 text-sm font-semibold text-slate-800">{value}</dd></div></div>; }
