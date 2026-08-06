import { useState, useEffect } from 'react';
import {
  Clock, Trophy, Megaphone, MessageSquare, History, Users,
  Crown, ChevronRight, Flame, Zap, Star, TrendingUp, AlertTriangle, Info,
} from 'lucide-react';
import {
  type LeaderboardEntry, type SubmissionRecord, type Announcement,
  type Clarification, type SolveStatus, type ContestStyle,
  formatTime, formatMemory, formatContestTime, verdictColors, verdictShort,
  contestStyles,
} from '@/data/contestProblems';
import { problems } from '@/data/contestProblems';

type Tab = 'standings' | 'announcements' | 'clarifications' | 'submissions';

export function ContestInfoPanel({
  endTimeIso,
  leaderboard,
  submissions,
  announcements,
  clarifications,
  contestStyle,
  yourHandle,
}: {
  endTimeIso: string;
  leaderboard: LeaderboardEntry[];
  submissions: SubmissionRecord[];
  announcements: Announcement[];
  clarifications: Clarification[];
  contestStyle: ContestStyle;
  yourHandle: string;
}) {
  const [tab, setTab] = useState<Tab>('standings');

  const tabs: { id: Tab; label: string; icon: typeof Trophy; count?: number }[] = [
    { id: 'standings', label: 'Standings', icon: Trophy },
    { id: 'announcements', label: 'Announcements', icon: Megaphone, count: announcements.length },
    { id: 'clarifications', label: 'Clarifications', icon: MessageSquare, count: clarifications.length },
    { id: 'submissions', label: 'My Submissions', icon: History, count: submissions.length },
  ];

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Sticky timer */}
      <ContestTimer endTimeIso={endTimeIso} />

      {/* Contest style badge */}
      <div className="border-b border-slate-100 px-4 py-2.5">
        <div className="flex items-center justify-between">
          <span className="chip bg-indigo-50 text-indigo-700">
            <Trophy className="h-3 w-3" />
            {contestStyle} style
          </span>
          <span className="text-[11px] text-slate-400">
            {contestStyles[contestStyle].scoring}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-100 px-2 pt-2">
        {tabs.map(({ id, label, icon: Icon, count }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`relative flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold transition-colors ${
              tab === id ? 'text-indigo-700' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden xl:inline">{label}</span>
            {count !== undefined && count > 0 && (
              <span className={`rounded-full px-1.5 text-[10px] font-bold ${
                tab === id ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'
              }`}>
                {count}
              </span>
            )}
            {tab === id && (
              <span className="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-indigo-500 to-electric-500" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'standings' && (
          <StandingsTab leaderboard={leaderboard} yourHandle={yourHandle} />
        )}
        {tab === 'announcements' && <AnnouncementsTab announcements={announcements} />}
        {tab === 'clarifications' && <ClarificationsTab clarifications={clarifications} />}
        {tab === 'submissions' && <SubmissionsTab submissions={submissions} />}
      </div>
    </div>
  );
}

/* ---------- Contest Timer ---------- */
function ContestTimer({ endTimeIso }: { endTimeIso: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const diff = Math.max(0, new Date(endTimeIso).getTime() - now);
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  const isUrgent = diff < 30 * 60 * 1000;

  return (
    <div className={`border-b p-4 ${isUrgent ? 'border-error-500/20 bg-error-500/5' : 'border-slate-100 bg-slate-50/50'}`}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          <Clock className="h-3.5 w-3.5" />
          Remaining
        </span>
        {isUrgent && (
          <span className="flex items-center gap-1 text-[11px] font-bold text-error-600">
            <Flame className="h-3 w-3" />
            Final sprint!
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div className={`flex-1 rounded-xl p-2 text-center ${isUrgent ? 'bg-error-500/10' : 'bg-white ring-1 ring-slate-100'}`}>
          <p className={`font-display text-xl font-extrabold tabular-nums ${isUrgent ? 'text-error-600' : 'text-slate-900'}`}>
            {String(hours).padStart(2, '0')}
          </p>
          <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">Hrs</p>
        </div>
        <p className={`font-display text-xl font-bold ${isUrgent ? 'text-error-400' : 'text-slate-300'}`}>:</p>
        <div className={`flex-1 rounded-xl p-2 text-center ${isUrgent ? 'bg-error-500/10' : 'bg-white ring-1 ring-slate-100'}`}>
          <p className={`font-display text-xl font-extrabold tabular-nums ${isUrgent ? 'text-error-600' : 'text-slate-900'}`}>
            {String(minutes).padStart(2, '0')}
          </p>
          <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">Min</p>
        </div>
        <p className={`font-display text-xl font-bold ${isUrgent ? 'text-error-400' : 'text-slate-300'}`}>:</p>
        <div className={`flex-1 rounded-xl p-2 text-center ${isUrgent ? 'bg-error-500/10' : 'bg-white ring-1 ring-slate-100'}`}>
          <p className={`font-display text-xl font-extrabold tabular-nums ${isUrgent ? 'text-error-600' : 'text-slate-900'}`}>
            {String(seconds).padStart(2, '0')}
          </p>
          <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">Sec</p>
        </div>
      </div>
    </div>
  );
}

/* ---------- Standings Tab ---------- */
function StandingsTab({ leaderboard, yourHandle }: { leaderboard: LeaderboardEntry[]; yourHandle: string }) {
  return (
    <div>
      {/* Your rank summary */}
      {(() => {
        const you = leaderboard.find((e) => e.isYou || e.handle === yourHandle);
        if (!you) return null;
        return (
          <div className="border-b border-slate-100 bg-indigo-50/40 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Your standing</p>
            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-electric-600 text-xs font-bold text-white">
                  {you.rank}
                </span>
                <div>
                  <p className="text-sm font-bold text-slate-900">{you.handle}</p>
                  <p className="text-[11px] text-slate-400">{you.solved} solved · {you.penalty} min penalty</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-display text-lg font-bold text-indigo-600">{you.totalPoints}</p>
                <p className="text-[10px] text-slate-400">points</p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Problem header row */}
      <div className="sticky top-0 z-10 flex items-center border-b border-slate-100 bg-white/90 px-3 py-1.5 backdrop-blur-md">
        <span className="w-8 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">#</span>
        <span className="flex-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Handle</span>
        {problems.slice(0, 4).map((p) => (
          <span key={p.id} className="w-7 text-center text-[10px] font-bold text-slate-400">{p.index}</span>
        ))}
        <span className="w-12 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">Pts</span>
      </div>

      {/* Leaderboard rows */}
      {leaderboard.map((entry) => (
        <div
          key={entry.handle}
          className={`flex items-center border-b border-slate-50 px-3 py-2 transition-colors ${
            entry.isYou ? 'bg-indigo-50/30' : 'hover:bg-slate-50'
          }`}
        >
          <span className={`flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-bold ${
            entry.rank === 1 ? 'bg-sun-500/15 text-sun-600' :
            entry.rank === 2 ? 'bg-slate-300/50 text-slate-600' :
            entry.rank === 3 ? 'bg-sun-600/10 text-sun-600' :
            'text-slate-400'
          }`}>
            {entry.rank === 1 && <Crown className="h-3 w-3 text-sun-500" />}
            {entry.rank !== 1 && entry.rank}
          </span>
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-electric-600 text-[9px] font-bold text-white">
              {entry.initials}
            </span>
            <div className="min-w-0">
              <p className={`truncate text-xs font-semibold ${entry.isYou ? 'text-indigo-700' : 'text-slate-700'}`}>
                {entry.handle}
              </p>
              <p className="text-[10px] text-slate-400">{entry.country}</p>
            </div>
          </div>
          {problems.slice(0, 4).map((p) => {
            const status = entry.problemStatus[p.id] ?? 'unsolved';
            return (
              <span key={p.id} className="w-7 text-center">
                <ProblemStatusPill status={status} />
              </span>
            );
          })}
          <span className="w-12 text-center">
            <p className="text-xs font-bold tabular-nums text-slate-900">{entry.totalPoints}</p>
            <p className="text-[9px] text-slate-400">{entry.solved} sol</p>
          </span>
        </div>
      ))}
    </div>
  );
}

function ProblemStatusPill({ status }: { status: SolveStatus }) {
  if (status === 'solved') {
    return <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-success-500 text-[9px] font-bold text-white">+</span>;
  }
  if (status === 'attempted') {
    return <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-sun-500/20 text-[9px] font-bold text-sun-600">?</span>;
  }
  return <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-slate-100 text-[9px] font-bold text-slate-300">·</span>;
}

/* ---------- Announcements Tab ---------- */
function AnnouncementsTab({ announcements }: { announcements: Announcement[] }) {
  return (
    <div className="p-3 space-y-3">
      {announcements.map((a) => {
        const timeAgo = getTimeAgo(a.timestamp);
        return (
          <div
            key={a.id}
            className={`rounded-2xl p-3 ring-1 ${
              a.severity === 'warning'
                ? 'bg-sun-500/5 ring-sun-500/15'
                : 'bg-slate-50 ring-slate-100'
            }`}
          >
            <div className="flex items-start gap-2">
              {a.severity === 'warning' ? (
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-sun-500" />
              ) : (
                <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-500" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-900">{a.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">{a.body}</p>
                <p className="mt-1.5 text-[10px] text-slate-400">{timeAgo}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Clarifications Tab ---------- */
function ClarificationsTab({ clarifications }: { clarifications: Clarification[] }) {
  return (
    <div className="p-3 space-y-3">
      <button className="btn-ghost w-full py-2 text-xs">
        <MessageSquare className="h-3.5 w-3.5" />
        Ask a question
      </button>
      {clarifications.map((c) => (
        <div key={c.id} className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100">
          <div className="flex items-center gap-2">
            <span className="chip bg-indigo-50 text-indigo-700">Problem {c.problemIndex}</span>
            <span className="text-[10px] text-slate-400">{getTimeAgo(c.timestamp)}</span>
          </div>
          <p className="mt-2 text-xs font-semibold text-slate-900">Q: {c.question}</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">A: {c.answer}</p>
        </div>
      ))}
    </div>
  );
}

/* ---------- Submissions Tab ---------- */
function SubmissionsTab({ submissions }: { submissions: SubmissionRecord[] }) {
  if (submissions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <History className="h-8 w-8 text-slate-300" />
        <p className="mt-3 text-sm text-slate-400">No submissions yet</p>
        <p className="mt-1 text-xs text-slate-400">Your submission history will appear here</p>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-2">
      {submissions.map((s) => (
        <div key={s.id} className="rounded-2xl bg-white p-3 ring-1 ring-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600">
                {s.problemIndex}
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-slate-900">{s.problemTitle}</p>
                <p className="text-[10px] text-slate-400">{s.language} · {formatContestTime(s.contestTimeMinutes)}</p>
              </div>
            </div>
            <span className={`chip ${verdictColors[s.verdict]} text-[10px]`}>
              {verdictShort[s.verdict]}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-4 text-[10px] text-slate-400">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatTime(s.timeMs)}
            </span>
            <span className="inline-flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              {formatMemory(s.memoryKB)}
            </span>
            <span className="ml-auto">{getTimeAgo(s.timestamp)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function getTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
