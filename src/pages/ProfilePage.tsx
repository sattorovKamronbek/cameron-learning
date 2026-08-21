import { useCallback, useEffect, useState } from 'react';
import {
  Award, BarChart3, Calendar, CheckCircle2, Crown, Edit2, LogOut,
  Medal, RefreshCw, Save, Target, Trophy, UserRound, X, Zap,
} from 'lucide-react';
import { Link, useRouter } from '@/router';
import { useAuth } from '@/lib/auth';
import type { Plan } from '@/lib/supabase';
import { LoadingDots, LoadingState } from '@/components/LoadingState';
import {
  fetchMyContestStats,
  fetchMyRatingHistory,
  type MyContestStats,
  type MyRatingHistoryEntry,
} from '@/lib/ratings';
import { ActivityHeatmap, LevelProgressCard, SkillProgressBar, StreakCard } from '@/components/learning';
import { fetchLearningDashboard, type LearningDashboard } from '@/lib/learning';

const planInfo: Record<Plan, { name: string; icon: typeof Zap; color: string; bg: string; ring: string }> = {
  free: { name: 'Free', icon: UserRound, color: 'text-slate-700', bg: 'bg-slate-50', ring: 'ring-slate-200' },
  pro: { name: 'Pro', icon: Zap, color: 'text-indigo-700', bg: 'bg-indigo-50', ring: 'ring-indigo-200' },
  max: { name: 'Max', icon: Crown, color: 'text-electric-700', bg: 'bg-electric-50', ring: 'ring-electric-200' },
};

export function ProfilePage() {
  const { user, profile, loading, signOut, updateProfile } = useAuth();
  const { navigate } = useRouter();
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [contestStats, setContestStats] = useState<MyContestStats | null>(null);
  const [ratingHistory, setRatingHistory] = useState<MyRatingHistoryEntry[]>([]);
  const [contestLoading, setContestLoading] = useState(false);
  const [contestError, setContestError] = useState<string | null>(null);
  const [learningDashboard, setLearningDashboard] = useState<LearningDashboard | null>(null);
  const [learningLoading, setLearningLoading] = useState(false);
  const [learningError, setLearningError] = useState<string | null>(null);
  const [learningProfilePublic, setLearningProfilePublic] = useState(true);

  useEffect(() => {
    if (!loading && !user) navigate('/login', { replace: true });
  }, [loading, user, navigate]);

  useEffect(() => {
    setFullName(profile?.full_name ?? '');
    setLearningProfilePublic(profile?.is_learning_profile_public ?? true);
  }, [profile?.full_name, profile?.is_learning_profile_public]);

  const loadContestData = useCallback(async () => {
    if (!user) {
      setContestStats(null);
      setRatingHistory([]);
      return;
    }

    setContestLoading(true);
    setContestError(null);
    try {
      const [stats, history] = await Promise.all([
        fetchMyContestStats(),
        fetchMyRatingHistory(),
      ]);
      setContestStats(stats);
      setRatingHistory(history);
    } catch (reason) {
      setContestStats(null);
      setRatingHistory([]);
      setContestError(reason instanceof Error ? reason.message : 'Contest records could not be loaded.');
    } finally {
      setContestLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadContestData();
  }, [loadContestData]);

  const loadLearningData = useCallback(async () => {
    if (!user) {
      setLearningDashboard(null);
      return;
    }
    setLearningLoading(true);
    setLearningError(null);
    try {
      setLearningDashboard(await fetchLearningDashboard());
    } catch (reason) {
      setLearningDashboard(null);
      setLearningError(reason instanceof Error ? reason.message : 'Learning progress could not be loaded.');
    } finally {
      setLearningLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadLearningData();
  }, [loadLearningData]);

  if (loading || !user) {
    return <LoadingState className="min-h-[60vh] rounded-none" message="Profilingiz yuklanmoqda" />;
  }

  const currentPlan = profile?.plan ?? 'free';
  const planData = planInfo[currentPlan];
  const PlanIcon = planData.icon;
  const initials = (profile?.full_name || user.email || '?')
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'Recently';

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    const { error } = await updateProfile({ full_name: fullName || null, is_learning_profile_public: learningProfilePublic });
    setSaving(false);
    if (error) setSaveError(error);
    else setEditing(false);
  };

  return (
    <>
      <section className="relative overflow-hidden pt-28 text-white">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950" />
        <div className="absolute inset-0 bg-grid opacity-10" />
        <div className="container-page relative py-12">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-5">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-400 to-electric-500 text-2xl font-extrabold shadow-lift">
                {initials}
              </div>
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{profile?.full_name || 'Welcome back'}</h1>
                <p className="mt-1 text-slate-400">{user.email}</p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <span className={`chip ${planData.bg} ${planData.color} ring-1 ${planData.ring}`}>
                    <PlanIcon className="h-3.5 w-3.5" />
                    {planData.name} plan
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                    <Calendar className="h-3.5 w-3.5" />
                    Member since {memberSince}
                  </span>
                  {learningDashboard && <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-200"><Zap className="h-3.5 w-3.5" />Level {learningDashboard.levelProgress.level} · {learningDashboard.totalXp} XP</span>}
                </div>
              </div>
            </div>
            <button onClick={() => signOut().then(() => navigate('/'))} className="btn bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/15">
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      </section>

      <section className="bg-slate-50/50 py-12">
        <div className="container-page grid gap-6 lg:grid-cols-3">
          <aside className="space-y-6 lg:col-span-1">
            <div className="card p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">Profile</h2>
                {!editing ? (
                  <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-700 hover:text-indigo-800">
                    <Edit2 className="h-3.5 w-3.5" /> Edit
                  </button>
                ) : (
                  <button onClick={() => { setEditing(false); setFullName(profile?.full_name ?? ''); setSaveError(null); }} className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-700">
                    <X className="h-3.5 w-3.5" /> Cancel
                  </button>
                )}
              </div>

              <div className="mt-6 space-y-5">
                <ProfileField label="Full name">
                  {editing ? (
                    <input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Your name" className="w-full rounded-xl border-0 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                  ) : <p className="text-sm font-semibold text-slate-900">{profile?.full_name || 'Not set'}</p>}
                </ProfileField>
                <ProfileField label="Email"><p className="break-all text-sm font-semibold text-slate-900">{user.email}</p></ProfileField>
                <ProfileField label="Current plan">
                  <div className="flex items-center justify-between gap-3">
                    <span className={`chip ${planData.bg} ${planData.color} ring-1 ${planData.ring}`}><PlanIcon className="h-3.5 w-3.5" />{planData.name}</span>
                    <Link to="/pricing" className="text-sm font-semibold text-indigo-700 hover:text-indigo-800">Manage</Link>
                  </div>
                </ProfileField>
                <ProfileField label="Learning profile visibility">
                  {editing ? (
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600 ring-1 ring-slate-200">
                      <input type="checkbox" checked={learningProfilePublic} onChange={(event) => setLearningProfilePublic(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                      <span><span className="block font-semibold text-slate-800">Show me on learning leaderboards</span><span className="mt-0.5 block text-xs leading-relaxed text-slate-500">Only your display name, avatar, level, and XP can appear—never your email or private results.</span></span>
                    </label>
                  ) : <p className="text-sm font-semibold text-slate-900">{profile?.is_learning_profile_public ? 'Visible on learning leaderboards' : 'Hidden from learning leaderboards'}</p>}
                </ProfileField>
              </div>

              {editing && (
                <div className="mt-6">
                  {saveError && <p className="mb-3 text-sm text-error-600">{saveError}</p>}
                  <button onClick={handleSave} disabled={saving} className="btn-primary w-full">
                    {saving ? <><LoadingDots /> Saving...</> : <><Save className="h-4 w-4" /> Save changes</>}
                  </button>
                </div>
              )}
            </div>

            <div className="card p-6">
              <Trophy className="h-7 w-7 text-indigo-600" />
              <h2 className="mt-3 text-lg font-bold text-slate-900">Contest records</h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">
                Ratings and results appear here only after a contest is judged and finalized.
              </p>
              <Link to="/contests" className="btn-ghost mt-5 w-full">Browse contests</Link>
            </div>

            <div className="card p-6">
              <Zap className="h-7 w-7 text-electric-600" />
              <h2 className="mt-3 text-lg font-bold text-slate-900">Learning dashboard</h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">View verified XP, skill paths, missions, and achievements.</p>
              <Link to="/dashboard" className="btn-ghost mt-5 w-full">Open dashboard</Link>
            </div>
          </aside>

          <main className="space-y-6 lg:col-span-2">
            <section>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Your learning profile</p><h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">Verified learning progress</h2></div>
                <button onClick={() => void loadLearningData()} disabled={learningLoading} className="btn-ghost px-4 py-2 text-sm disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${learningLoading ? 'animate-spin' : ''}`} /> Refresh</button>
              </div>
              {learningLoading ? <LoadingState className="card mt-5 min-h-[12rem]" message="Learning progress loading" /> : learningError ? <div className="card mt-5 p-7 text-center"><X className="mx-auto h-8 w-8 text-error-500" /><h3 className="mt-3 text-base font-bold text-slate-900">Learning progress unavailable</h3><p className="mt-1 text-sm text-slate-500">{learningError}</p></div> : learningDashboard ? <div className="mt-5 space-y-5"><div className="grid gap-4 sm:grid-cols-2"><LevelProgressCard levelProgress={learningDashboard.levelProgress} totalXp={learningDashboard.totalXp} /><StreakCard current={learningDashboard.streak.current} longest={learningDashboard.streak.longest} /></div><div className="card p-5"><h3 className="text-base font-bold text-slate-900">Strongest skills</h3>{learningDashboard.skills.length ? <div className="mt-4 grid gap-4 sm:grid-cols-2">{learningDashboard.skills.slice(0, 6).map((skill) => <SkillProgressBar key={skill.id} skill={skill} />)}</div> : <p className="mt-3 text-sm text-slate-500">Start a verified learning activity to begin building skills.</p>}</div><ActivityHeatmap activity={learningDashboard.activity} /></div> : null}
            </section>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Your contest record</p>
                <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">Verified results only</h2>
              </div>
              <button onClick={() => void loadContestData()} disabled={contestLoading} className="btn-ghost px-4 py-2 text-sm disabled:opacity-60">
                <RefreshCw className={`h-4 w-4 ${contestLoading ? 'animate-spin' : ''}`} /> Refresh
              </button>
            </div>

            {contestLoading ? (
              <LoadingState className="card min-h-[16rem]" message="Contest records loading" />
            ) : contestError ? (
              <div className="card p-8 text-center">
                <X className="mx-auto h-8 w-8 text-error-500" />
                <h3 className="mt-3 text-base font-bold text-slate-900">Contest records unavailable</h3>
                <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{contestError}</p>
                <button onClick={() => void loadContestData()} className="btn-ghost mt-5 px-4 py-2 text-sm"><RefreshCw className="h-4 w-4" /> Try again</button>
              </div>
            ) : (
              <>
                <ContestStats stats={contestStats} />
                <RatingHistory history={ratingHistory} />
              </>
            )}
          </main>
        </div>
      </section>
    </>
  );
}

function ProfileField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
      {children}
    </div>
  );
}

function ContestStats({ stats }: { stats: MyContestStats | null }) {
  const hasActivity = Boolean(stats && (
    stats.contestsEntered > 0 || stats.acceptedSubmissions > 0 || stats.problemsSolved > 0 || stats.currentRating !== null
  ));

  if (!stats || !hasActivity) {
    return (
      <div className="card p-10 text-center">
        <Trophy className="mx-auto h-10 w-10 text-slate-300" />
        <h3 className="mt-4 text-lg font-bold text-slate-900">No contest activity yet</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
          Your verified submissions, contest entries, and rating will appear after you participate in a real contest.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <ContestStatCard icon={Trophy} label="Finalized contests" value={String(stats.contestsEntered)} />
      <ContestStatCard icon={CheckCircle2} label="Correct answers" value={String(stats.acceptedSubmissions)} />
      <ContestStatCard icon={Target} label="Problems solved" value={String(stats.problemsSolved)} />
      <ContestStatCard icon={Medal} label="Current rating" value={stats.currentRating == null ? '—' : String(stats.currentRating)} />
      {stats.peakRating != null && <ContestStatCard icon={Award} label="Peak rating" value={String(stats.peakRating)} />}
      {stats.globalRank != null && <ContestStatCard icon={BarChart3} label="Global rank" value={`#${stats.globalRank}`} />}
    </div>
  );
}

function ContestStatCard({ icon: Icon, label, value }: { icon: typeof Trophy; label: string; value: string }) {
  return (
    <div className="card p-4">
      <Icon className="h-5 w-5 text-indigo-600" />
      <p className="mt-4 font-display text-2xl font-extrabold tabular-nums text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{label}</p>
    </div>
  );
}

function RatingHistory({ history }: { history: MyRatingHistoryEntry[] }) {
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-slate-100 p-5">
        <BarChart3 className="h-5 w-5 text-indigo-600" />
        <div>
          <h3 className="text-base font-bold text-slate-900">Rating history</h3>
          <p className="text-xs text-slate-400">Only finalized rated-contest results are shown.</p>
        </div>
      </div>
      {history.length === 0 ? (
        <div className="p-10 text-center text-sm text-slate-500">No rated contest history yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3">Contest</th>
                <th className="hidden px-4 py-3 sm:table-cell">Completed</th>
                <th className="hidden px-4 py-3 md:table-cell">Rank</th>
                <th className="px-4 py-3 text-right">Rating</th>
                <th className="px-4 py-3 text-right">Change</th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => (
                <tr key={entry.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3.5">
                    <p className="text-sm font-semibold text-slate-700">{entry.contestName}</p>
                    {entry.subject && <p className="mt-0.5 text-xs text-slate-400">{entry.subject}</p>}
                  </td>
                  <td className="hidden px-4 py-3.5 text-sm text-slate-500 sm:table-cell">{formatDate(entry.completedAt)}</td>
                  <td className="hidden px-4 py-3.5 text-sm font-semibold tabular-nums text-slate-700 md:table-cell">{entry.rank == null ? '—' : `#${entry.rank}`}</td>
                  <td className="px-4 py-3.5 text-right text-sm font-bold tabular-nums text-slate-800">{entry.newRating}</td>
                  <td className={`px-4 py-3.5 text-right text-sm font-bold tabular-nums ${entry.delta == null ? 'text-slate-400' : entry.delta > 0 ? 'text-success-600' : entry.delta < 0 ? 'text-error-600' : 'text-slate-500'}`}>
                    {formatDelta(entry.delta)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDelta(value: number | null): string {
  if (value == null) return '—';
  return value > 0 ? `+${value}` : String(value);
}
