import { useEffect, useState } from 'react';
import { Activity, CheckCircle2, Clock, Trophy, TrendingUp } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { LoadingState } from '@/components/LoadingState';
import { useAuth } from '@/lib/auth';
import { supabase, type UserActivity } from '@/lib/supabase';
import { fetchMyContestStats, fetchMyRatingHistory, type MyContestStats, type MyRatingHistoryEntry } from '@/lib/ratings';

type AnalyticsData = {
  activities: UserActivity[];
  contestStats: MyContestStats;
  ratingHistory: MyRatingHistoryEntry[];
};

const emptyContestStats: MyContestStats = {
  contestsEntered: 0,
  acceptedSubmissions: 0,
  problemsSolved: 0,
  currentRating: null,
  peakRating: null,
  globalRank: null,
};

export function AnalyticsDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(Boolean(user));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    if (!user) {
      setData(null);
      setLoading(false);
      setError(null);
      return () => { active = false; };
    }

    setLoading(true);
    setError(null);

    Promise.all([
      supabase.from('user_activity').select('*').order('created_at', { ascending: false }).limit(100),
      fetchMyContestStats(),
      fetchMyRatingHistory(),
    ])
      .then(([activityResult, contestStats, ratingHistory]) => {
        if (!active) return;
        if (activityResult.error) throw activityResult.error;
        setData({
          activities: (activityResult.data ?? []) as UserActivity[],
          contestStats,
          ratingHistory,
        });
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Ma’lumotlarni yuklab bo‘lmadi.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [user]);

  return (
    <div className="container-page py-10">
      <PageHeader
        eyebrow="Analytics"
        title="Haqiqiy faoliyatingiz"
        description="Bu sahifadagi ko‘rsatkichlar faqat saqlangan faoliyat, contest ishtiroki va yakunlangan reyting natijalaridan hisoblanadi."
      />

      {!user ? (
        <EmptyPanel message="Shaxsiy statistikalarni ko‘rish uchun tizimga kiring." />
      ) : loading ? (
        <LoadingState className="card mt-8" message="Statistikalar yuklanmoqda" />
      ) : error ? (
        <EmptyPanel message={`Ma’lumotlarni yuklab bo‘lmadi: ${error}`} error />
      ) : (
        <AnalyticsContent data={data ?? { activities: [], contestStats: emptyContestStats, ratingHistory: [] }} />
      )}
    </div>
  );
}

function AnalyticsContent({ data }: { data: AnalyticsData }) {
  const { activities, contestStats, ratingHistory } = data;

  return (
    <>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Activity} label="Qayd etilgan faoliyat" value={String(activities.length)} sub="so‘nggi 100 hodisa" color="from-indigo-500 to-indigo-700" />
        <StatCard icon={Trophy} label="Contestlar" value={String(contestStats.contestsEntered)} sub="yakunlangan ishtiroklar" color="from-sun-500 to-sun-600" />
        <StatCard icon={CheckCircle2} label="Yechilgan savollar" value={String(contestStats.problemsSolved)} sub="server tasdiqlagan natijalar" color="from-success-500 to-electric-600" />
        <StatCard icon={TrendingUp} label="Joriy reyting" value={contestStats.currentRating == null ? '—' : String(contestStats.currentRating)} sub={contestStats.globalRank == null ? 'hali reyting yo‘q' : `global o‘rin #${contestStats.globalRank}`} color="from-electric-500 to-indigo-700" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card overflow-hidden">
          <div className="border-b border-slate-100 p-5">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <TrendingUp className="h-4 w-4 text-indigo-600" />
              Reyting tarixi
            </h2>
          </div>
          {ratingHistory.length === 0 ? (
            <div className="p-8 text-sm text-slate-500">Yakunlangan rated contest natijasi hali yo‘q.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {ratingHistory.slice(0, 10).map((entry) => (
                <div key={entry.id} className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-800">{entry.contestName}</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {[entry.subject, entry.rank == null ? null : `o‘rin #${entry.rank}`, entry.completedAt ? new Date(entry.completedAt).toLocaleDateString() : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-display text-lg font-extrabold tabular-nums text-slate-900">{entry.newRating}</p>
                    {entry.delta != null && (
                      <p className={`text-xs font-bold ${entry.delta >= 0 ? 'text-success-600' : 'text-error-600'}`}>
                        {entry.delta > 0 ? '+' : ''}{entry.delta}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card overflow-hidden">
          <div className="border-b border-slate-100 p-5">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Clock className="h-4 w-4 text-indigo-600" />
              So‘nggi faoliyat
            </h2>
          </div>
          {activities.length === 0 ? (
            <div className="p-8 text-sm text-slate-500">Faoliyat hali qayd etilmagan.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {activities.slice(0, 10).map((activity) => (
                <div key={activity.id} className="flex items-center justify-between gap-4 p-4">
                  <p className="min-w-0 truncate text-sm font-semibold text-slate-700">{activity.title}</p>
                  <time className="shrink-0 text-xs text-slate-400">{new Date(activity.created_at).toLocaleString()}</time>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function StatCard({ icon: Icon, label, value, sub, color }: { icon: typeof Activity; label: string; value: string; sub: string; color: string }) {
  return (
    <div className="card-hover p-5">
      <div className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${color} shadow-soft`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <p className="mt-3 font-display text-2xl font-extrabold tabular-nums text-slate-900">{value}</p>
      <p className="text-sm font-semibold text-slate-600">{label}</p>
      <p className="text-xs text-slate-400">{sub}</p>
    </div>
  );
}

function EmptyPanel({ message, error = false }: { message: string; error?: boolean }) {
  return (
    <div className={`card mt-8 p-10 text-center text-sm ${error ? 'text-error-600' : 'text-slate-500'}`}>
      {message}
    </div>
  );
}
