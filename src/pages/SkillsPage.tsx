import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowRight, LockKeyhole, RefreshCw, Sparkles } from 'lucide-react';
import { Link, useRouter } from '@/router';
import { useAuth } from '@/lib/auth';
import { LoadingState } from '@/components/LoadingState';
import { SkillProgressBar, SkillTreeNode } from '@/components/learning';
import { fetchLearningSkillTree, type LearningSkill } from '@/lib/learning';

export function SkillsPage() {
  const { user, loading: authLoading } = useAuth();
  const { navigate } = useRouter();
  const [skills, setSkills] = useState<LearningSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true); setError(null);
    try { setSkills(await fetchLearningSkillTree()); }
    catch (reason) { setSkills([]); setError(reason instanceof Error ? reason.message : 'Skills could not be loaded.'); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { if (!authLoading && !user) navigate('/login', { replace: true }); }, [authLoading, navigate, user]);
  useEffect(() => { void load(); }, [load]);

  const roots = useMemo(() => skills.filter((skill) => !skill.parentSkillId), [skills]);
  const childrenByParent = useMemo(() => skills.reduce<Record<string, LearningSkill[]>>((groups, skill) => {
    if (skill.parentSkillId) (groups[skill.parentSkillId] ??= []).push(skill);
    return groups;
  }, {}), [skills]);

  if (authLoading || !user || loading) return <LoadingState variant="page" message="Your skills are loading" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return <div className="min-h-screen bg-slate-50/70"><section className="relative overflow-hidden bg-slate-950 pt-28 text-white"><div className="absolute inset-0 bg-grid-dark opacity-10" /><div className="container-page relative py-12"><p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-300">Cameron Skills</p><h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Your learning skill tree</h1><p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">Progress is measured from verified Cameron Learning activity. Skill prerequisites only affect the learning path—they never modify contest access or results.</p></div></section><main className="container-page py-8 sm:py-10">{roots.length === 0 ? <section className="card p-12 text-center"><Sparkles className="mx-auto h-10 w-10 text-slate-300" /><h2 className="mt-4 text-lg font-extrabold text-slate-900">No skills are available yet</h2><p className="mt-2 text-sm text-slate-500">The learning system has not published any skills for this account yet.</p></section> : <div className="space-y-8">{roots.map((root) => <section key={root.id} className="card overflow-hidden"><div className="border-b border-slate-100 bg-white px-5 py-5 sm:px-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Skill path</p><h2 className="mt-1 text-2xl font-extrabold text-slate-900">{root.name}</h2>{root.description && <p className="mt-1 text-sm text-slate-500">{root.description}</p>}</div><div className="w-full sm:w-64"><SkillProgressBar skill={root} /></div></div></div><div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">{(childrenByParent[root.id] ?? []).length ? (childrenByParent[root.id] ?? []).map((skill) => <SkillTreeNode key={skill.id} skill={skill} />) : <SkillTreeNode skill={root} />}</div></section>)}</div>}<section className="mt-8 rounded-2xl border border-indigo-100 bg-indigo-50 p-5"><div className="flex items-start gap-3"><LockKeyhole className="mt-0.5 h-5 w-5 text-indigo-700" /><div><h2 className="font-bold text-slate-900">About locked skills</h2><p className="mt-1 text-sm leading-relaxed text-slate-600">A lock shows the verified mastery target needed to reveal the next part of a skill path. It never changes existing course, contest, exam, or problem permissions.</p><Link to="/dashboard" className="btn-ghost mt-3 px-0 text-sm text-indigo-700">Back to dashboard <ArrowRight className="h-4 w-4" /></Link></div></div></section></main></div>;
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => Promise<void> }) {
  return <div className="container-page py-28"><div className="card mx-auto max-w-lg p-9 text-center"><AlertCircle className="mx-auto h-10 w-10 text-error-500" /><h1 className="mt-4 text-xl font-extrabold text-slate-900">Skills unavailable</h1><p className="mt-2 text-sm text-slate-500">{message}</p><button type="button" onClick={() => void onRetry()} className="btn-primary mt-6"><RefreshCw className="h-4 w-4" />Try again</button></div></div>;
}
