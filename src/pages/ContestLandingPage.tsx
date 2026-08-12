import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowRight, ClipboardList, Flame, RefreshCw, ShieldCheck, Trophy, Users } from 'lucide-react';
import { Link, useRouter } from '@/router';
import { ContestCard } from '@/components/ContestCard';
import { ContestFilterBar, defaultFilters, type FilterState } from '@/components/ContestFilters';
import { LoadingState } from '@/components/LoadingState';
import { useAccessControl } from '@/lib/access';
import { fetchPublicContests, type Contest } from '@/lib/contests';

const statusFromQuery: Record<string, FilterState['status']> = {
  live: 'Live',
  upcoming: 'Upcoming',
  finished: 'Finished',
};

function filtersForQuery(query: URLSearchParams): FilterState {
  const status = statusFromQuery[query.get('status')?.toLowerCase() ?? '']
    ?? statusFromQuery[query.get('filter')?.toLowerCase() ?? '']
    ?? 'all';

  return {
    ...defaultFilters,
    subject: query.get('subject') || 'all',
    status,
  };
}

function unavailableModeForQuery(query: URLSearchParams): string | null {
  const legacyFilter = query.get('filter')?.toLowerCase();
  if (legacyFilter === 'practice') return 'Practice problems are not available yet.';
  if (legacyFilter === 'virtual') return 'Virtual contests are not available yet.';
  if (legacyFilter === 'history') return 'Your personal contest history is available from your profile.';
  return null;
}

export function ContestLandingPage() {
  const { query } = useRouter();
  const { canManageContests } = useAccessControl();
  const [contests, setContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>(() => filtersForQuery(query));
  const [unavailableMode, setUnavailableMode] = useState<string | null>(() => unavailableModeForQuery(query));

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setContests(await fetchPublicContests());
    } catch (reason) {
      setContests([]);
      setError(reason instanceof Error ? reason.message : 'Contestlar yuklanmadi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    setFilters(filtersForQuery(query));
    setUnavailableMode(unavailableModeForQuery(query));
  }, [query]);

  const filtered = useMemo(() => {
    const needle = filters.search.trim().toLowerCase();
    return contests
      .filter((contest) => {
        if (needle && ![contest.title, contest.subject, contest.description, ...contest.tags].some((value) => value.toLowerCase().includes(needle))) return false;
        return (filters.subject === 'all' || contest.subjectSlug === filters.subject)
          && (filters.difficulty === 'all' || contest.difficulty === filters.difficulty)
          && (filters.status === 'all' || contest.status === filters.status)
          && (filters.type === 'all' || contest.type === filters.type);
      })
      .sort((left, right) => {
        if (filters.sortBy === 'participants') return right.participants - left.participants;
        if (filters.sortBy === 'duration') return left.durationMinutes - right.durationMinutes;
        return new Date(left.startTime).getTime() - new Date(right.startTime).getTime();
      });
  }, [contests, filters]);

  const liveCount = contests.filter((contest) => contest.status === 'Live').length;
  const upcomingCount = contests.filter((contest) => contest.status === 'Upcoming').length;
  const subjectCount = new Set(contests.map((contest) => contest.subjectSlug)).size;

  return (
    <>
      <section className="theme-dark-section relative overflow-hidden pt-28 text-white">
        <div className="absolute inset-0 bg-grid-dark opacity-10" />
        <div className="theme-orb-primary absolute -left-40 top-4 h-96 w-96 rounded-full blur-3xl" />
        <div className="theme-orb-secondary absolute -right-40 top-20 h-96 w-96 rounded-full blur-3xl" />
        <div className="container-page relative py-16 text-center sm:py-20">
          <span className="chip bg-white/10 text-indigo-200 ring-1 ring-white/20"><Flame className="h-3.5 w-3.5" />{liveCount ? `${liveCount} contest live` : 'Real contest calendar'}</span>
          <h1 className="mx-auto mt-6 max-w-3xl font-display text-4xl font-extrabold tracking-tight sm:text-5xl">Faqat haqiqiy contestlarda qatnashing</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-slate-300">Ro‘yxatdan o‘tish, savollar, javoblar, natijalar va reytinglar serverda saqlanadi. Demo botlar yoki soxta natijalar ko‘rsatilmaydi.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href="#all-contests" className="btn-gradient px-5 py-3 text-sm">Contestsni ko‘rish <ArrowRight className="h-4 w-4" /></a>
            {canManageContests && <Link to="/contest-management" className="btn bg-white/10 px-5 py-3 text-sm text-white ring-1 ring-white/20 hover:bg-white/15"><ShieldCheck className="h-4 w-4" />Contest boshqaruvi</Link>}
          </div>
        </div>
      </section>

      <section className="bg-white py-8">
        <div className="container-page grid gap-4 sm:grid-cols-3">
          <RealMetric icon={Flame} label="Jonli contestlar" value={loading ? '—' : String(liveCount)} />
          <RealMetric icon={Trophy} label="Rejalashtirilgan contestlar" value={loading ? '—' : String(upcomingCount)} />
          <RealMetric icon={ClipboardList} label="Faol mavzular" value={loading ? '—' : String(subjectCount)} />
        </div>
      </section>

      <section id="all-contests" className="scroll-mt-20">
        {unavailableMode && (
          <div className="border-b border-amber-100 bg-amber-50">
            <div className="container-page py-3" role="status">
              <p className="text-sm text-amber-800">{unavailableMode} Showing currently available real contests instead.</p>
            </div>
          </div>
        )}
        <ContestFilterBar filters={filters} onChange={setFilters} resultCount={filtered.length} />
        <div className="bg-slate-50/50 py-10">
          <div className="container-page">
            {loading ? (
              <LoadingState className="card min-h-[20rem]" message="Haqiqiy contestlar yuklanmoqda" />
            ) : error ? (
              <div className="card p-12 text-center">
                <AlertCircle className="mx-auto h-10 w-10 text-error-500" />
                <h2 className="mt-4 text-lg font-bold text-slate-900">Contestlar yuklanmadi</h2>
                <p className="mx-auto mt-2 max-w-lg text-sm text-slate-500">{error}</p>
                <button type="button" onClick={() => void load()} className="btn-ghost mt-5"><RefreshCw className="h-4 w-4" />Qayta urinib ko‘ring</button>
              </div>
            ) : filtered.length ? (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{filtered.map((contest) => <ContestCard key={contest.id} contest={contest} />)}</div>
            ) : (
              <div className="card p-12 text-center">
                <Users className="mx-auto h-10 w-10 text-slate-300" />
                <h2 className="mt-4 text-lg font-bold text-slate-900">Hozircha contest yo‘q</h2>
                <p className="mx-auto mt-2 max-w-lg text-sm text-slate-500">Faqat judge yoki admin savollari tayyor va e’lon qilingan contestni bu yerda chiqara oladi.</p>
                {canManageContests && <Link to="/contest-management" className="btn-primary mt-5">Birinchi contestni tayyorlash <ArrowRight className="h-4 w-4" /></Link>}
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

function RealMetric({ icon: Icon, label, value }: { icon: typeof Trophy; label: string; value: string }) {
  return (
    <div className="card flex items-center gap-4 p-5">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700"><Icon className="h-5 w-5" /></div>
      <div><p className="font-display text-2xl font-extrabold tabular-nums text-slate-900">{value}</p><p className="text-sm text-slate-500">{label}</p></div>
    </div>
  );
}
