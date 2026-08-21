import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, RefreshCw, Sparkles } from 'lucide-react';
import { useRouter } from '@/router';
import { useAuth } from '@/lib/auth';
import { LoadingState } from '@/components/LoadingState';
import { MissionCard } from '@/components/learning';
import { fetchLearningMissions, type LearningMission } from '@/lib/learning';

export function MissionsPage() {
  const { user, loading: authLoading } = useAuth();
  const { navigate } = useRouter();
  const [missions, setMissions] = useState<LearningMission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { if (!user) return; setLoading(true); setError(null); try { setMissions(await fetchLearningMissions()); } catch (reason) { setMissions([]); setError(reason instanceof Error ? reason.message : 'Missions could not be loaded.'); } finally { setLoading(false); } }, [user]);
  useEffect(() => { if (!authLoading && !user) navigate('/login', { replace: true }); }, [authLoading, navigate, user]);
  useEffect(() => { void load(); }, [load]);
  const daily = useMemo(() => missions.filter((mission) => mission.missionType === 'daily'), [missions]);
  const weekly = useMemo(() => missions.filter((mission) => mission.missionType === 'weekly'), [missions]);
  if (authLoading || !user || loading) return <LoadingState variant="page" message="Missions are loading" />;
  return <div className="min-h-screen bg-slate-50/70"><section className="relative overflow-hidden bg-slate-950 pt-28 text-white"><div className="absolute inset-0 bg-grid-dark opacity-10" /><div className="container-page relative py-12"><p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-300">Learning missions</p><h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Stay consistent, earn verified XP</h1><p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">Mission progress and rewards update automatically from verified XP. Nothing needs to be claimed in the browser.</p></div></section><main className="container-page py-8 sm:py-10">{error ? <div className="card mx-auto max-w-lg p-9 text-center"><AlertCircle className="mx-auto h-10 w-10 text-error-500" /><h2 className="mt-4 text-xl font-extrabold text-slate-900">Missions unavailable</h2><p className="mt-2 text-sm text-slate-500">{error}</p><button type="button" onClick={() => void load()} className="btn-primary mt-6"><RefreshCw className="h-4 w-4" />Try again</button></div> : <div className="grid gap-7 lg:grid-cols-2"><MissionSection title="Daily missions" description="Reset at midnight UTC, based on server time." missions={daily} /><MissionSection title="Weekly missions" description="Reset every Monday at midnight UTC, based on server time." missions={weekly} /></div>}</main></div>;
}

function MissionSection({ title, description, missions }: { title: string; description: string; missions: LearningMission[] }) {
  return <section className="card p-5 sm:p-6"><h2 className="text-xl font-extrabold text-slate-900">{title}</h2><p className="mt-1 text-sm text-slate-500">{description}</p>{missions.length ? <div className="mt-5 space-y-3">{missions.map((mission) => <MissionCard key={mission.id} mission={mission} />)}</div> : <div className="mt-5 rounded-2xl bg-slate-50 p-8 text-center"><Sparkles className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-sm font-bold text-slate-700">You’re all caught up.</p><p className="mt-1 text-sm text-slate-500">New missions will appear here.</p></div>}</section>;
}
