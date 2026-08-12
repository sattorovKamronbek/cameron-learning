import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ArrowLeft, Calendar, CheckCircle2, Clock, ClipboardList, Code2, Flame, Trophy, Users } from 'lucide-react';
import { Link, useRouter } from '@/router';
import { CountdownTimer, DifficultyBadge, StatusBadge, TypeBadge } from '@/components/ContestCard';
import { subjectGradient } from '@/lib/contest-appearance';
import { LoadingState } from '@/components/LoadingState';
import { useAuth } from '@/lib/auth';
import {
  fetchContestLeaderboard,
  fetchPublicContest,
  formatContestDate,
  formatContestDuration,
  registerForContest,
  type Contest,
  type ContestLeaderboardEntry,
} from '@/lib/contests';
import { fetchProgrammingContestOverview, problemLetter, type ProgrammingContestOverview } from '@/lib/programming';

export function ContestDetailPage({ slug }: { slug: string }) {
  const { navigate } = useRouter();
  const { user } = useAuth();
  const [contest, setContest] = useState<Contest | null>(null);
  const [leaderboard, setLeaderboard] = useState<ContestLeaderboardEntry[]>([]);
  const [programmingOverview, setProgrammingOverview] = useState<ProgrammingContestOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchPublicContest(slug);
      setContest(next);
      if (next?.subjectSlug === 'programming') {
        try { setProgrammingOverview(await fetchProgrammingContestOverview(slug)); } catch { setProgrammingOverview(null); }
      } else {
        setProgrammingOverview(null);
      }
      if (next && next.status === 'Finished' && next.isFinalized) {
        try { setLeaderboard(await fetchContestLeaderboard(slug)); } catch { setLeaderboard([]); }
      } else {
        setLeaderboard([]);
      }
    } catch (reason) {
      setContest(null);
      setError(reason instanceof Error ? reason.message : 'Contest yuklanmadi.');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { void load(); }, [load]);

  const register = async () => {
    if (!contest) return;
    if (!user) { navigate('/login'); return; }
    setRegistering(true);
    setActionError(null);
    try {
      await registerForContest(contest.id);
      await load();
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Ro‘yxatdan o‘tib bo‘lmadi.');
    } finally {
      setRegistering(false);
    }
  };

  if (loading) return <LoadingState className="min-h-[65vh]" message="Contest yuklanmoqda" />;
  if (!contest) {
    return (
      <div className="container-page py-32"><div className="card mx-auto max-w-xl p-10 text-center"><AlertCircle className="mx-auto h-10 w-10 text-error-500" /><h1 className="mt-4 text-xl font-bold text-slate-900">Contest topilmadi</h1><p className="mt-2 text-sm text-slate-500">{error ?? 'Bu contest e’lon qilinmagan yoki arxivlangan.'}</p><Link to="/contests" className="btn-primary mt-6">Contestlarga qaytish</Link></div></div>
    );
  }

  const start = formatContestDate(contest.startTime);
  const end = formatContestDate(contest.endTime);
  const fill = Math.min(100, Math.round((contest.participants / contest.maxParticipants) * 100));
  const canRegister = contest.status !== 'Finished' && !contest.registered && contest.participants < contest.maxParticipants;
  const isEnglishExam = contest.subjectSlug === 'ielts' || contest.subjectSlug === 'cefr';

  return (
    <>
      <section className={`relative overflow-hidden bg-gradient-to-br ${subjectGradient(contest.subjectSlug)} pt-28 text-white`}>
        <div className="absolute inset-0 bg-slate-950/35" />
        <div className="absolute inset-0 bg-grid-dark opacity-10" />
        <div className="container-page relative pb-14 pt-8">
          <Link to="/contests" className="inline-flex items-center gap-2 text-sm font-semibold text-white/75 hover:text-white"><ArrowLeft className="h-4 w-4" />Barcha contestlar</Link>
          <div className="mt-7 grid gap-8 lg:grid-cols-[1fr_320px]">
            <div>
              <div className="flex flex-wrap gap-2"><span className="chip bg-white/15 text-white ring-1 ring-white/20">{contest.subject}</span><TypeBadge type={contest.type} /><DifficultyBadge difficulty={contest.difficulty} /><StatusBadge status={contest.status} /></div>
              <h1 className="mt-5 font-display text-3xl font-extrabold tracking-tight sm:text-5xl">{contest.title}</h1>
              <p className="mt-4 max-w-3xl text-lg leading-relaxed text-white/80">{contest.description}</p>
              <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm text-white/75">
                <span className="inline-flex items-center gap-2"><Calendar className="h-4 w-4" />{start.date} · {start.time}</span>
                <span className="inline-flex items-center gap-2"><Clock className="h-4 w-4" />{formatContestDuration(contest.durationMinutes)}</span>
                <span className="inline-flex items-center gap-2"><Users className="h-4 w-4" />{contest.participants} real registrations</span>
              </div>
            </div>
            <aside className="rounded-3xl bg-slate-950/35 p-6 ring-1 ring-white/20 backdrop-blur-sm">
              {contest.status === 'Upcoming' && <div className="mb-5"><p className="mb-2 text-xs font-bold uppercase tracking-wider text-white/60">Starts in</p><CountdownTimer targetIso={contest.startTime} /></div>}
              {contest.status === 'Live' && <div className="mb-5 flex items-center gap-3 rounded-2xl bg-success-500/20 p-4 ring-1 ring-success-400/30"><Flame className="h-5 w-5 text-success-300" /><div><p className="text-sm font-bold">Contest is live</p><p className="text-xs text-white/70">{contest.subjectSlug === 'programming' ? 'Problem set ro‘yxatdan o‘tgan ishtirokchilar uchun ochiq.' : isEnglishExam ? 'Listening, Reading va Writing partlarini yakunlang.' : 'Saved answers are judged on the server.'}</p></div></div>}
              {contest.status === 'Finished' && <div className="mb-5 rounded-2xl bg-white/10 p-4 text-center"><Trophy className="mx-auto h-6 w-6 text-sun-300" /><p className="mt-2 text-sm font-bold">Contest finished</p><p className="text-xs text-white/65">{contest.isFinalized ? 'Final results are available below.' : isEnglishExam ? 'Writinglar tekshirilib, judge/admin yakunlagach natija va rating ochiladi.' : 'Natijalar judge yoki admin yakunlagach ochiladi.'}</p></div>}
              {actionError && <p role="alert" className="mb-3 rounded-xl bg-error-500/20 p-3 text-xs text-error-100">{actionError}</p>}
              {contest.status === 'Live' && contest.registered && (contest.subjectSlug === 'programming' ? <a href="#programming-problems" className="btn w-full bg-white py-3 text-indigo-700 hover:bg-indigo-50"><Code2 className="h-4 w-4" />Masalalarni ochish</a> : <Link to={`/contests/${contest.slug}/quiz`} className="btn w-full bg-white py-3 text-indigo-700 hover:bg-indigo-50"><ClipboardList className="h-4 w-4" />Contestga kirish</Link>)}
              {canRegister && <button type="button" disabled={registering} onClick={() => void register()} className="btn w-full bg-white py-3 text-indigo-700 hover:bg-indigo-50 disabled:opacity-60">{registering ? 'Saqlanmoqda…' : contest.status === 'Live' ? 'Hozir ro‘yxatdan o‘tish' : 'Ro‘yxatdan o‘tish'}</button>}
              {contest.status === 'Upcoming' && contest.registered && <div className="flex items-center gap-2 rounded-xl bg-success-500/20 p-3 text-sm font-semibold text-success-100"><CheckCircle2 className="h-4 w-4" />Ro‘yxatdan o‘tgansiz</div>}
              <div className="mt-5"><div className="flex justify-between text-xs text-white/65"><span>Capacity</span><span>{contest.participants} / {contest.maxParticipants}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-white transition-all" style={{ width: `${fill}%` }} /></div></div>
            </aside>
          </div>
        </div>
      </section>

      <section className="bg-white py-14"><div className="container-page grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="space-y-8">
          {contest.subjectSlug === 'programming' && <ProgrammingProblemSet contest={contest} overview={programmingOverview} />}
          <section className="card p-6"><h2 className="text-xl font-bold text-slate-900">Contest qoidalari</h2>{contest.rules.length ? <ol className="mt-5 space-y-3">{contest.rules.map((rule, index) => <li key={`${index}-${rule}`} className="flex gap-3 text-sm leading-relaxed text-slate-600"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-xs font-bold text-indigo-700">{index + 1}</span>{rule}</li>)}</ol> : <p className="mt-3 text-sm text-slate-500">Tashkilotchi alohida qoida kiritmagan. Platformaning halol ishtirok qoidalari amal qiladi.</p>}</section>
          <section className="card overflow-hidden"><div className="border-b border-slate-100 p-6"><h2 className="text-xl font-bold text-slate-900">Haqiqiy leaderboard</h2><p className="mt-1 text-sm text-slate-500">Faqat judge/admin yakunlagan, serverda saqlangan natijalar ko‘rsatiladi.</p></div>{!contest.isFinalized ? <div className="p-8 text-sm text-slate-500">Leaderboard contest tugab, judge yoki admin natijalarni yakunlagach ochiladi. Contest davomida ballar ko‘rsatilmaydi.</div> : leaderboard.length ? <Leaderboard entries={leaderboard} /> : <div className="p-8 text-sm text-slate-500">Yakunlangan ishtirokchi natijasi yo‘q.</div>}</section>
        </div>
        <aside className="space-y-5"><div className="card p-6"><h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Contest haqida</h2><dl className="mt-4 space-y-3 text-sm"><Fact label="Boshlanish" value={`${start.date} · ${start.time}`} /><Fact label="Tugashi" value={`${end.date} · ${end.time}`} /><Fact label={contest.subjectSlug === 'programming' ? 'Masalalar' : 'Savollar'} value={String(contest.questionCount)} /><Fact label="Turi" value={contest.type} /><Fact label="Tashkilotchi" value={contest.organizer} /></dl></div>{contest.tags.length > 0 && <div className="card p-6"><h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Mavzular</h2><div className="mt-4 flex flex-wrap gap-2">{contest.tags.map((tag) => <span key={tag} className="chip bg-slate-100 text-slate-600">{tag}</span>)}</div></div>}{contest.prize && <div className="card p-6"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Prize</p><p className="mt-2 text-sm font-bold text-sun-700">{contest.prize}</p></div>}</aside>
      </div></section>
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) { return <div className="flex justify-between gap-3"><dt className="text-slate-500">{label}</dt><dd className="text-right font-semibold text-slate-800">{value}</dd></div>; }

function Leaderboard({ entries }: { entries: ContestLeaderboardEntry[] }) {
  return <div className="divide-y divide-slate-100">{entries.slice(0, 50).map((entry) => <div key={entry.userId} className="flex items-center gap-4 p-4"><span className={`flex h-8 w-8 items-center justify-center rounded-xl text-xs font-extrabold ${entry.rank <= 3 ? 'bg-gradient-to-br from-sun-400 to-sun-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{entry.rank}</span><span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-700">{entry.displayName}</span><span className="text-xs text-slate-400">{entry.answeredCount}/{entry.totalQuestions} answered</span><span className="font-display text-base font-extrabold tabular-nums text-indigo-700">{entry.score}</span></div>)}</div>;
}

function ProgrammingProblemSet({ contest, overview }: { contest: Contest; overview: ProgrammingContestOverview | null }) {
  const problemRows = overview?.problems ?? [];
  const canOpen = contest.status === 'Finished' || (contest.status === 'Live' && contest.registered);
  return <section id="programming-problems" className="card scroll-mt-24 overflow-hidden"><div className="border-b border-slate-100 p-6"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700"><Code2 className="h-5 w-5" /></span><div><h2 className="text-xl font-bold text-slate-900">Programming problem set</h2><p className="mt-1 text-sm text-slate-500">Masalalar contest davomida ro‘yxatdan o‘tgan ishtirokchilar uchun ochiladi; tugagach Practice katalogida mavjud bo‘ladi.</p></div></div></div>{problemRows.length ? <div className="divide-y divide-slate-100">{problemRows.map((problem) => {
    const destination = contest.status === 'Finished' ? `/problems/${problem.slug}` : `/problems/${problem.slug}?contest=${contest.slug}`;
    const body = <><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-sm font-extrabold text-white">{problemLetter(problem.position)}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-slate-800">{problem.title}</span><span className="mt-1 block text-xs text-slate-500">{problem.difficulty} · {problem.timeLimitMs / 1000}s · {problem.memoryLimitMb} MB · {problem.points} ball</span></span><span className="hidden text-xs font-bold text-slate-400 sm:inline">{canOpen ? 'Open' : contest.status === 'Upcoming' ? 'Opens at start' : 'Registration required'}</span></>;
    return canOpen ? <Link key={problem.id} to={destination} className="flex items-center gap-4 p-5 transition-colors hover:bg-indigo-50/60">{body}</Link> : <div key={problem.id} className="flex items-center gap-4 p-5 opacity-75">{body}</div>;
  })}</div> : <div className="p-6 text-sm text-slate-500">Problem set e’lon qilinmagan.</div>}</section>;
}
