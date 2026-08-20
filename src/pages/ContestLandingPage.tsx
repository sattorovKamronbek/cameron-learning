import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowRight, ClipboardList, Flame, KeyRound, LockKeyhole, RefreshCw, ShieldCheck, Trophy, Users } from 'lucide-react';
import { Link, useRouter } from '@/router';
import { ContestCard } from '@/components/ContestCard';
import { ContestFilterBar, defaultFilters, type FilterState } from '@/components/ContestFilters';
import { LoadingState } from '@/components/LoadingState';
import { useAccessControl } from '@/lib/access';
import { fetchPublicContests, redeemPrivateContestAccess, type Contest } from '@/lib/contests';

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
  const { query, navigate } = useRouter();
  const { canManageContests } = useAccessControl();
  const [contests, setContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>(() => filtersForQuery(query));
  const [unavailableMode, setUnavailableMode] = useState<string | null>(() => unavailableModeForQuery(query));
  const [privateCode, setPrivateCode] = useState('');
  const [privateBusy, setPrivateBusy] = useState(false);
  const [privateError, setPrivateError] = useState<string | null>(null);

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

  const unlockPrivateContest = async () => {
    if (!privateCode.trim()) return;
    setPrivateBusy(true);
    setPrivateError(null);
    try {
      const slug = await redeemPrivateContestAccess(privateCode);
      navigate(`/contests/${slug}`);
    } catch (reason) {
      setPrivateError(reason instanceof Error ? reason.message : 'Private contest ochilmadi.');
    } finally {
      setPrivateBusy(false);
    }
  };

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
  const competitiveContests = filtered.filter((contest) => contest.mode === 'Contest');
  const gymContests = filtered.filter((contest) => contest.mode === 'Gym');
  const languageTests = filtered.filter((contest) => contest.mode === 'Test');

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
          <div className="mx-auto mt-7 max-w-xl rounded-2xl border border-white/15 bg-slate-950/20 p-3 text-left backdrop-blur-sm">
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="sr-only" htmlFor="private-contest-code">Private contest kodi</label>
              <div className="relative flex-1"><KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-indigo-200" /><input id="private-contest-code" value={privateCode} onChange={(event) => setPrivateCode(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void unlockPrivateContest(); }} className="h-11 w-full rounded-xl border border-white/15 bg-white/10 pl-10 pr-3 text-sm text-white placeholder:text-slate-400 outline-none ring-0 transition focus:border-indigo-300" placeholder="Private contest access kodi" /></div>
              <button type="button" disabled={privateBusy || !privateCode.trim()} onClick={() => void unlockPrivateContest()} className="btn h-11 bg-white px-4 text-sm text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"><LockKeyhole className="h-4 w-4" />{privateBusy ? 'Tekshirilmoqda…' : 'Ochish'}</button>
            </div>
            {privateError && <p role="alert" className="mt-2 text-xs text-error-200">{privateError}</p>}
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
              <div className="space-y-10">
                {competitiveContests.length > 0 && <ContestCollection title="Rated & Unrated contests" description="Rasmiy jadval, yakuniy natijalar va Rated contestlarda server hisoblagan reyting." contests={competitiveContests} />}
                {gymContests.length > 0 && <ContestCollection title="Gym" description="Unrated mashg‘ulotlar: yangi g‘oyalarni sinash va masalalarni xavfsiz mashq qilish uchun alohida maydon." contests={gymContests} gym />}
                {languageTests.length > 0 && <ContestCollection title="IELTS & CEFR testlar" description="Individual testlar: boshlash vaqtini o‘zingiz tanlaysiz, Listening → Reading → Writing ketma-ketligi esa server timeri bilan saqlanadi." contests={languageTests} test />}
              </div>
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

function ContestCollection({ title, description, contests, gym = false, test = false }: { title: string; description: string; contests: Contest[]; gym?: boolean; test?: boolean }) {
  const palette = gym ? 'border-cyan-100 bg-cyan-50/35' : test ? 'border-emerald-100 bg-emerald-50/35' : 'border-slate-200 bg-white';
  const countPalette = gym ? 'bg-cyan-100 text-cyan-800' : test ? 'bg-emerald-100 text-emerald-800' : 'bg-violet-100 text-violet-800';
  return <section className={`rounded-3xl border p-5 sm:p-6 ${palette}`}><div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-display text-xl font-extrabold text-slate-900">{title}</h2><p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500">{description}</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${countPalette}`}>{contests.length}</span></div><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{contests.map((contest) => <ContestCard key={contest.id} contest={contest} />)}</div></section>;
}

function RealMetric({ icon: Icon, label, value }: { icon: typeof Trophy; label: string; value: string }) {
  return (
    <div className="card flex items-center gap-4 p-5">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700"><Icon className="h-5 w-5" /></div>
      <div><p className="font-display text-2xl font-extrabold tabular-nums text-slate-900">{value}</p><p className="text-sm text-slate-500">{label}</p></div>
    </div>
  );
}
