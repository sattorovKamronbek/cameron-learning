import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowRight, Award, BookOpen, RefreshCw, Sparkles, Target } from 'lucide-react';
import { Link, useRouter } from '@/router';
import { useAuth } from '@/lib/auth';
import { LoadingState } from '@/components/LoadingState';
import { AchievementCard, LevelProgressCard, MissionCard, SkillProgressBar, StreakCard } from '@/components/learning';
import { fetchLearningDashboard, fetchLearningMissions, type LearningDashboard, type LearningMission } from '@/lib/learning';

export function LearningDashboardPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const { navigate } = useRouter();
  const [dashboard, setDashboard] = useState<LearningDashboard | null>(null);
  const [missions, setMissions] = useState<LearningMission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [nextDashboard, nextMissions] = await Promise.all([fetchLearningDashboard(), fetchLearningMissions()]);
      setDashboard(nextDashboard);
      setMissions(nextMissions);
    } catch (reason) {
      setDashboard(null);
      setMissions([]);
      setError(reason instanceof Error ? reason.message : 'Learning progress could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) navigate('/login', { replace: true });
  }, [authLoading, navigate, user]);

  useEffect(() => { void load(); }, [load]);

  const dailyMissions = useMemo(() => missions.filter((mission) => mission.missionType === 'daily'), [missions]);
  const skills = dashboard?.skills.slice(0, 4) ?? [];
  const name = profile?.full_name?.trim() || 'there';

  if (authLoading || !user || loading) return <LoadingState variant="page" message="Your learning dashboard is loading" />;

  if (error || !dashboard) {
    return <DashboardError message={error ?? 'Learning dashboard could not be loaded.'} onRetry={load} />;
  }

  return (
    <div className="min-h-screen bg-slate-50/70">
      <section className="relative overflow-hidden bg-slate-950 pt-28 text-white">
        <div className="absolute inset-0 bg-grid-dark opacity-10" />
        <div className="container-page relative py-12 sm:py-14">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-300">Learning dashboard</p>
          <div className="mt-3 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div><h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Welcome back, {name}</h1><p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-300">Your progress is built only from verified Cameron Learning activity.</p></div>
            <div className="flex gap-3"><div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"><p className="text-xs text-slate-400">Current streak</p><p className="mt-1 text-lg font-extrabold"><span aria-hidden="true">🔥 </span>{dashboard.streak.current} days</p></div><Link to="/profile" className="btn bg-white text-slate-900 hover:bg-slate-100">View profile <ArrowRight className="h-4 w-4" /></Link></div>
          </div>
        </div>
      </section>

      <main className="container-page space-y-7 py-8 sm:py-10">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(220px,.6fr)]"><LevelProgressCard levelProgress={dashboard.levelProgress} totalXp={dashboard.totalXp} /><StreakCard current={dashboard.streak.current} longest={dashboard.streak.longest} /></div>

        <div className="grid gap-7 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,.8fr)]">
          <div className="space-y-7">
            <section className="card p-5 sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Current skills</p><h2 className="mt-1 text-xl font-extrabold text-slate-900">Build skill, one verified activity at a time</h2></div><Link to="/skills" className="btn-ghost shrink-0 px-3 py-2 text-sm">All skills <ArrowRight className="h-4 w-4" /></Link></div>{skills.length > 0 ? <div className="mt-6 grid gap-5 sm:grid-cols-2">{skills.map((skill) => <SkillProgressBar key={skill.id} skill={skill} />)}</div> : <EmptyProgress />}</section>
            <section className="card p-5 sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Today’s missions</p><h2 className="mt-1 text-xl font-extrabold text-slate-900">Keep a steady pace</h2></div><Link to="/missions" className="btn-ghost shrink-0 px-3 py-2 text-sm">All missions <ArrowRight className="h-4 w-4" /></Link></div>{dailyMissions.length ? <div className="mt-5 grid gap-3">{dailyMissions.slice(0, 3).map((mission) => <MissionCard key={mission.id} mission={mission} />)}</div> : <div className="mt-5 rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">You’re all caught up. New missions will appear here.</div>}</section>
          </div>

          <aside className="space-y-7"><section className="card p-5"><Award className="h-6 w-6 text-sun-600" /><h2 className="mt-4 text-lg font-extrabold text-slate-900">Recent achievements</h2>{dashboard.recentAchievements.length ? <div className="mt-4 space-y-3">{dashboard.recentAchievements.map((achievement) => <AchievementCard key={achievement.id} achievement={achievement} />)}</div> : <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-500">No achievements yet. Complete verified learning activities to earn your first badge.</div>}<Link to="/achievements" className="btn-ghost mt-4 w-full text-sm">View achievements</Link></section>
            <section className="card p-5"><Target className="h-6 w-6 text-electric-600" /><h2 className="mt-4 text-lg font-extrabold text-slate-900">Recommended next</h2><p className="mt-2 text-sm leading-relaxed text-slate-500">Choose a real course, practice problem, or contest to grow the skills you care about. Recommendations will become more specific as verified activity accumulates.</p><div className="mt-4 grid gap-2"><Link to="/problems" className="btn-ghost w-full justify-between text-sm">Practice problems <ArrowRight className="h-4 w-4" /></Link><Link to="/contests" className="btn-ghost w-full justify-between text-sm">Explore contests <ArrowRight className="h-4 w-4" /></Link><Link to="/courses" className="btn-ghost w-full justify-between text-sm">Browse courses <BookOpen className="h-4 w-4" /></Link></div></section></aside>
        </div>
      </main>
    </div>
  );
}

function EmptyProgress() {
  return <div className="mt-6 rounded-2xl bg-slate-50 p-6 text-center"><Sparkles className="mx-auto h-7 w-7 text-slate-300" /><p className="mt-3 text-sm font-bold text-slate-700">Your skill progress starts with verified activity.</p><p className="mt-1 text-sm text-slate-500">Complete a contest, lesson, or other supported activity to begin.</p></div>;
}

function DashboardError({ message, onRetry }: { message: string; onRetry: () => Promise<void> }) {
  return <div className="container-page py-28"><div className="card mx-auto max-w-lg p-9 text-center"><AlertCircle className="mx-auto h-10 w-10 text-error-500" /><h1 className="mt-4 text-xl font-extrabold text-slate-900">Learning dashboard unavailable</h1><p className="mt-2 text-sm leading-relaxed text-slate-500">{message}</p><button type="button" onClick={() => void onRetry()} className="btn-primary mt-6"><RefreshCw className="h-4 w-4" />Try again</button></div></div>;
}
