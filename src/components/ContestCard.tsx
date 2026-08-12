import { useEffect, useState } from 'react';
import { ArrowRight, Calendar, Clock, LockKeyhole, Sparkles, Trophy, Users } from 'lucide-react';
import { Link } from '@/router';
import { subjectGradient } from '@/lib/contest-appearance';
import {
  formatContestDate,
  formatContestDuration,
  type Contest,
  type ContestDifficulty,
  type ContestMode,
  type ContestStatus,
  type ContestType,
} from '@/lib/contests';

const difficultyClasses: Record<ContestDifficulty, string> = {
  Easy: 'bg-success-500/10 text-success-700 ring-success-500/20',
  Medium: 'bg-sun-500/10 text-sun-700 ring-sun-500/20',
  Hard: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  Expert: 'bg-error-500/10 text-error-700 ring-error-500/20',
};

export function DifficultyBadge({ difficulty }: { difficulty: ContestDifficulty }) {
  return <span className={`chip ring-1 ${difficultyClasses[difficulty]}`}>{difficulty}</span>;
}

export function StatusBadge({ status }: { status: ContestStatus }) {
  const className: Record<ContestStatus, string> = {
    Live: 'bg-success-500 text-white',
    Upcoming: 'bg-indigo-100 text-indigo-700',
    Finished: 'bg-slate-100 text-slate-600',
  };
  return (
    <span className={`chip ${className[status]}`}>
      {status === 'Live' && <span className="mr-0.5 h-1.5 w-1.5 rounded-full bg-white animate-pulse" />}
      {status}
    </span>
  );
}

export function TypeBadge({ type }: { type: ContestType }) {
  return (
    <span className={`chip ${type === 'Rated' ? 'bg-white/15 text-white ring-1 ring-white/25' : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200'}`}>
      {type}
    </span>
  );
}

export function ModeBadge({ mode }: { mode: ContestMode }) {
  return <span className={`chip ${mode === 'Gym' ? 'bg-cyan-400/15 text-cyan-100 ring-1 ring-cyan-200/30' : 'bg-violet-400/15 text-violet-100 ring-1 ring-violet-200/30'}`}>{mode === 'Gym' ? <Sparkles className="h-3 w-3" /> : <Trophy className="h-3 w-3" />}{mode}</span>;
}

export function ContestCard({ contest }: { contest: Contest }) {
  const start = formatContestDate(contest.startTime);
  const atCapacity = contest.participants >= contest.maxParticipants;

  return (
    <Link to={`/contests/${contest.slug}`} className="card-hover group flex h-full flex-col overflow-hidden">
      <div className={`relative bg-gradient-to-br ${subjectGradient(contest.subjectSlug)} p-5 text-white`}>
        <div className="absolute inset-0 bg-dots opacity-15" />
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/70">{contest.subject}</p>
            <div className="mt-1 flex flex-wrap gap-1.5"><ModeBadge mode={contest.mode} /><TypeBadge type={contest.type} /></div>
          </div>
          <StatusBadge status={contest.status} />
        </div>
        <h3 className="relative mt-5 font-display text-lg font-bold leading-snug">{contest.title}</h3>
        <p className="relative mt-1 line-clamp-2 text-sm text-white/75">{contest.description}</p>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap gap-2">
          <DifficultyBadge difficulty={contest.difficulty} />
          {contest.visibility === 'Private' && <span className="chip bg-slate-900 text-white"><LockKeyhole className="h-3 w-3" />Private</span>}
          {contest.prize && <span className="chip bg-sun-500/10 text-sun-700 ring-1 ring-sun-500/20"><Trophy className="h-3 w-3" />Prize</span>}
          {contest.registered && <span className="chip bg-success-500/10 text-success-700 ring-1 ring-success-500/20">Registered</span>}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-x-3 gap-y-3 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{formatContestDuration(contest.durationMinutes)}</span>
          <span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />{contest.participants}/{contest.maxParticipants}</span>
          <span className="inline-flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{start.date}</span>
          <span className={atCapacity ? 'font-semibold text-error-600' : 'font-semibold text-indigo-600'}>{atCapacity ? 'Capacity reached' : start.relative}</span>
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-4 text-xs">
          <span className="truncate text-slate-400">by {contest.organizer}</span>
          <span className="inline-flex items-center gap-1 font-bold text-indigo-600 group-hover:translate-x-0.5 transition-transform">Details <ArrowRight className="h-3.5 w-3.5" /></span>
        </div>
      </div>
    </Link>
  );
}

export function CountdownTimer({ targetIso }: { targetIso: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const seconds = Math.max(0, Math.floor((new Date(targetIso).getTime() - now) / 1000));
  const units = [
    ['Days', Math.floor(seconds / 86400)],
    ['Hours', Math.floor((seconds % 86400) / 3600)],
    ['Minutes', Math.floor((seconds % 3600) / 60)],
    ['Seconds', seconds % 60],
  ] as const;

  return (
    <div className="grid grid-cols-4 gap-2">
      {units.map(([label, value]) => (
        <div key={label} className="rounded-xl bg-slate-950/70 p-2 text-center ring-1 ring-white/10">
          <p className="font-display text-lg font-extrabold tabular-nums text-white">{String(value).padStart(2, '0')}</p>
          <p className="text-[9px] font-bold uppercase tracking-wide text-white/55">{label}</p>
        </div>
      ))}
    </div>
  );
}
