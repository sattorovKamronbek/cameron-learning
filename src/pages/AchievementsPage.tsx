import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Award, LockKeyhole, RefreshCw, Trophy } from 'lucide-react';
import { useRouter } from '@/router';
import { useAuth } from '@/lib/auth';
import { LoadingState } from '@/components/LoadingState';
import { AchievementCard } from '@/components/learning';
import { fetchLearningAchievements, type LearningAchievement } from '@/lib/learning';

type Filter = 'all' | 'earned' | 'in-progress' | 'locked';

export function AchievementsPage() {
  const { user, loading: authLoading } = useAuth();
  const { navigate } = useRouter();
  const [achievements, setAchievements] = useState<LearningAchievement[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { if (!user) return; setLoading(true); setError(null); try { setAchievements(await fetchLearningAchievements()); } catch (reason) { setAchievements([]); setError(reason instanceof Error ? reason.message : 'Achievements could not be loaded.'); } finally { setLoading(false); } }, [user]);
  useEffect(() => { if (!authLoading && !user) navigate('/login', { replace: true }); }, [authLoading, navigate, user]);
  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => achievements.filter((achievement) => {
    if (filter === 'earned') return achievement.isEarned;
    if (filter === 'in-progress') return !achievement.isEarned && achievement.progress > 0;
    if (filter === 'locked') return !achievement.isEarned && achievement.progress === 0;
    return true;
  }), [achievements, filter]);
  const earned = achievements.filter((achievement) => achievement.isEarned).length;
  if (authLoading || !user || loading) return <LoadingState variant="page" message="Achievements are loading" />;
  return <div className="min-h-screen bg-slate-50/70"><section className="relative overflow-hidden bg-slate-950 pt-28 text-white"><div className="absolute inset-0 bg-grid-dark opacity-10" /><div className="container-page relative flex flex-col gap-5 py-12 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-300">Achievements</p><h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Verified milestones</h1><p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">Badges are evaluated server-side from real learning activity. They cannot be claimed or edited from the browser.</p></div><div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4"><p className="text-xs text-slate-400">Earned</p><p className="mt-1 font-display text-2xl font-extrabold">{earned} <span className="text-sm font-semibold text-slate-400">/ {achievements.length}</span></p></div></div></section><main className="container-page py-8 sm:py-10">{error ? <div className="card mx-auto max-w-lg p-9 text-center"><AlertCircle className="mx-auto h-10 w-10 text-error-500" /><h2 className="mt-4 text-xl font-extrabold text-slate-900">Achievements unavailable</h2><p className="mt-2 text-sm text-slate-500">{error}</p><button type="button" onClick={() => void load()} className="btn-primary mt-6"><RefreshCw className="h-4 w-4" />Try again</button></div> : <><div className="flex flex-wrap gap-2" role="tablist" aria-label="Achievement filters">{([{ id: 'all', label: 'All', icon: Award }, { id: 'earned', label: 'Earned', icon: Trophy }, { id: 'in-progress', label: 'In progress', icon: RefreshCw }, { id: 'locked', label: 'Locked', icon: LockKeyhole }] as const).map(({ id, label, icon: Icon }) => <button key={id} type="button" role="tab" aria-selected={filter === id} onClick={() => setFilter(id)} className={filter === id ? 'inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white' : 'inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-bold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'}><Icon className="h-4 w-4" />{label}</button>)}</div>{visible.length ? <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visible.map((achievement) => <AchievementCard key={achievement.id} achievement={achievement} />)}</div> : <div className="card mt-6 p-12 text-center"><Award className="mx-auto h-10 w-10 text-slate-300" /><h2 className="mt-4 text-lg font-extrabold text-slate-900">No achievements in this section</h2><p className="mt-2 text-sm text-slate-500">Complete verified learning activities to make progress.</p></div>}</>}</main></div>;
}
