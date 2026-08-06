import { useState, useEffect } from 'react';
import {
  Check, Clock, Users, Trophy, Calendar, ArrowRight, Zap, Flame, Star,
} from 'lucide-react';
import { Link } from '@/router';
import type { Contest, Difficulty, ContestStatus, ContestType } from '@/data/contests';
import {
  difficultyColors, statusColors, typeColors, formatDuration, formatDateTime,
} from '@/data/contests';
import { getContestCategory } from '@/data/contests';

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return (
    <span className={`chip ${difficultyColors[difficulty]}`}>
      {difficulty}
    </span>
  );
}

export function StatusBadge({ status }: { status: ContestStatus }) {
  const styles: Record<ContestStatus, string> = {
    Live: 'bg-success-500 text-white',
    Upcoming: 'bg-indigo-100 text-indigo-700',
    Finished: 'bg-slate-100 text-slate-500',
  };
  return (
    <span className={`chip ${styles[status]}`}>
      {status === 'Live' && (
        <span className="mr-0.5 flex h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
      )}
      {status}
    </span>
  );
}

export function TypeBadge({ type }: { type: ContestType }) {
  return (
    <span className={`chip ${typeColors[type]}`}>
      {type}
    </span>
  );
}

export function ContestCard({ contest }: { contest: Contest }) {
  const cat = getContestCategory(contest.subjectSlug);
  const Icon = cat?.icon;
  const startFmt = formatDateTime(contest.startTime);

  return (
    <Link
      to={`/contests/${contest.slug}`}
      className="card-hover group flex h-full flex-col overflow-hidden"
    >
      <div className="relative h-28 overflow-hidden">
        <div className={`absolute inset-0 bg-gradient-to-br ${cat?.color ?? 'from-slate-600 to-slate-800'}`} />
        <div className="absolute inset-0 bg-dots opacity-20" />
        <div className="absolute inset-0 flex items-center justify-between p-4">
          <div className="flex items-center gap-2.5">
            {Icon && (
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm ring-1 ring-white/20">
                <Icon className="h-4.5 w-4.5 text-white" />
              </div>
            )}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/70">
                {contest.subject}
              </p>
              <TypeBadge type={contest.type} />
            </div>
          </div>
          <StatusBadge status={contest.status} />
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-base font-bold leading-snug text-slate-900 transition-colors group-hover:text-indigo-700">
          {contest.name}
        </h3>
        <p className="mt-1.5 line-clamp-2 text-sm text-slate-500">{contest.description}</p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <DifficultyBadge difficulty={contest.difficulty} />
          {contest.prize && (
            <span className="chip bg-sun-500/10 text-sun-600 ring-1 ring-sun-500/20">
              <Trophy className="h-3 w-3" />
              Prize
            </span>
          )}
        </div>

        <div className="mt-auto grid grid-cols-2 gap-x-4 gap-y-2 pt-4 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            {formatDuration(contest.durationMinutes)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-slate-400" />
            {contest.participants.toLocaleString()} joined
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            {startFmt.date}
          </span>
          <span className="inline-flex items-center gap-1.5 font-semibold text-indigo-600">
            <Zap className="h-3.5 w-3.5" />
            {startFmt.relative}
          </span>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
          <span className="text-xs text-slate-400">by {contest.organizer}</span>
          <span className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 transition-transform group-hover:translate-x-0.5">
            View details
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}

export function FeaturedContestCard({ contest }: { contest: Contest }) {
  const cat = getContestCategory(contest.subjectSlug);
  const Icon = cat?.icon;
  const startFmt = formatDateTime(contest.startTime);
  const fillPercent = Math.round((contest.participants / contest.maxParticipants) * 100);

  return (
    <Link
      to={`/contests/${contest.slug}`}
      className="card-hover group flex h-full flex-col overflow-hidden"
    >
      <div className="relative overflow-hidden">
        <div className={`absolute inset-0 bg-gradient-to-br ${cat?.color ?? 'from-slate-600 to-slate-800'}`} />
        <div className="absolute inset-0 bg-dots opacity-20" />
        <div className="relative flex items-start justify-between p-5">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm ring-1 ring-white/20">
                <Icon className="h-5.5 w-5.5 text-white" />
              </div>
            )}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70">
                {contest.subject}
              </p>
              <div className="mt-1 flex gap-1.5">
                <TypeBadge type={contest.type} />
                <DifficultyBadge difficulty={contest.difficulty} />
              </div>
            </div>
          </div>
          <StatusBadge status={contest.status} />
        </div>
        <div className="relative px-5 pb-4">
          <h3 className="font-display text-lg font-bold leading-snug text-white">
            {contest.name}
          </h3>
          <p className="mt-1 line-clamp-2 text-sm text-white/70">{contest.description}</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl bg-slate-50 p-3 text-center">
            <Clock className="mx-auto h-4 w-4 text-slate-400" />
            <p className="mt-1.5 text-[11px] text-slate-400">Duration</p>
            <p className="text-sm font-bold text-slate-900">{formatDuration(contest.durationMinutes)}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3 text-center">
            <Users className="mx-auto h-4 w-4 text-slate-400" />
            <p className="mt-1.5 text-[11px] text-slate-400">Participants</p>
            <p className="text-sm font-bold text-slate-900">{contest.participants.toLocaleString()}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3 text-center">
            <Calendar className="mx-auto h-4 w-4 text-slate-400" />
            <p className="mt-1.5 text-[11px] text-slate-400">Starts</p>
            <p className="text-sm font-bold text-slate-900">{startFmt.date}</p>
          </div>
        </div>

        {/* Participant fill bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700">{fillPercent}% filled</span>
            <span className="text-slate-400">{contest.maxParticipants.toLocaleString()} max</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-electric-500 transition-all duration-500"
              style={{ width: `${fillPercent}%` }}
            />
          </div>
        </div>

        {contest.prize && (
          <div className="mt-4 flex items-center gap-2 rounded-2xl bg-gradient-to-r from-sun-500/10 to-sun-500/5 p-3 ring-1 ring-sun-500/20">
            <Trophy className="h-5 w-5 flex-shrink-0 text-sun-600" />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-sun-600">Prize</p>
              <p className="text-sm font-bold text-slate-900">{contest.prize}</p>
            </div>
          </div>
        )}

        <div className="mt-auto flex items-center justify-between pt-4">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            {contest.rating && (
              <span className="inline-flex items-center gap-1 font-semibold text-indigo-600">
                <Star className="h-3.5 w-3.5 fill-indigo-500 text-indigo-500" />
                {contest.rating}
              </span>
            )}
            <span>{startFmt.relative}</span>
          </div>
          <span className="btn-primary px-4 py-2 text-xs">
            {contest.status === 'Live' ? 'Join now' : contest.status === 'Finished' ? 'View results' : 'Register'}
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}

export function CategoryCard({
  category,
  delay = 0,
}: {
  category: ReturnType<typeof getContestCategory> extends infer T ? NonNullable<T> : never;
  delay?: number;
}) {
  const Icon = category.icon;
  return (
    <Link
      to={`/contests?subject=${category.slug}`}
      className="card-hover group flex h-full flex-col p-5"
    >
      <div className="flex items-center justify-between">
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${category.color} shadow-soft transition-transform group-hover:scale-105`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
        <ArrowRight className="h-4 w-4 text-slate-300 transition-all group-hover:translate-x-1 group-hover:text-indigo-600" />
      </div>
      <h3 className="mt-4 text-sm font-bold text-slate-900 group-hover:text-indigo-700">
        {category.name}
      </h3>
      <div className="mt-3 space-y-1.5 text-xs text-slate-500">
        <p className="inline-flex items-center gap-1.5">
          <Trophy className="h-3.5 w-3.5 text-slate-400" />
          {category.contestCount} contests
        </p>
        <p className="inline-flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-slate-400" />
          {category.activeUsers.toLocaleString()} active
        </p>
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-xl bg-slate-50 p-2.5 ring-1 ring-slate-100">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-electric-600 text-[10px] font-bold text-white">
          {category.topPlayer.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-slate-700">{category.topPlayer}</p>
          <p className="inline-flex items-center gap-1 text-[11px] text-slate-400">
            <Star className="h-2.5 w-2.5 fill-indigo-400 text-indigo-400" />
            {category.topPlayerRating}
          </p>
        </div>
        <Flame className="h-4 w-4 text-sun-500" />
      </div>
    </Link>
  );
}

export function ContestTypeCard({
  type,
  description,
  icon: Icon,
  delay = 0,
}: {
  type: ContestType;
  description: string;
  icon: typeof Trophy;
  delay?: number;
}) {
  return (
    <div
      className="card-hover flex items-center gap-4 p-5"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-electric-600 shadow-soft">
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div>
        <h3 className="text-sm font-bold text-slate-900">{type}</h3>
        <p className="mt-0.5 text-xs text-slate-500">{description}</p>
      </div>
      <Check className="ml-auto h-4 w-4 text-success-500" />
    </div>
  );
}

export function CountdownTimer({ targetIso }: { targetIso: string }) {
  const target = new Date(targetIso).getTime();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const diff = Math.max(0, target - now);
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  const blocks = [
    { label: 'Days', value: days },
    { label: 'Hours', value: hours },
    { label: 'Minutes', value: minutes },
    { label: 'Seconds', value: seconds },
  ];

  return (
    <div className="grid grid-cols-4 gap-2">
      {blocks.map(({ label, value }) => (
        <div key={label} className="rounded-2xl bg-slate-900 p-3 text-center">
          <p className="font-display text-2xl font-extrabold tabular-nums text-white">
            {String(value).padStart(2, '0')}
          </p>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            {label}
          </p>
        </div>
      ))}
    </div>
  );
}
