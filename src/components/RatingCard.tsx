import { useState } from 'react';
import {
  TrendingUp, TrendingDown, Minus, Trophy, Target, Crown,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import { Link } from '@/router';
import type { SubjectRating } from '@/data/ratings';
import { getRatingColorData, getDivisionsForSubject } from '@/data/ratings';
import { RatingGraph } from '@/components/RatingGraph';

export function RatingCard({
  rating,
  expanded = false,
  delay = 0,
}: {
  rating: SubjectRating;
  expanded?: boolean;
  delay?: number;
}) {
  const [showHistory, setShowHistory] = useState(expanded);
  const colorData = getRatingColorData(rating.currentRating);
  const Icon = rating.icon;
  const lastEntry = rating.history[rating.history.length - 1];
  const delta = lastEntry ? lastEntry.delta : 0;
  const divisions = getDivisionsForSubject(rating.subjectSlug);

  return (
    <div
      className={`card-hover group relative overflow-hidden ${showHistory ? 'ring-2 ring-indigo-200' : ''}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={`h-1.5 bg-gradient-to-r ${rating.color}`} />

      <div className="p-5">
        {/* Top row */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br ${rating.color} shadow-soft`}>
              <Icon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">{rating.subjectName}</h3>
              <span className={`text-[11px] font-semibold ${rating.division.color}`}>
                {rating.division.name}
              </span>
            </div>
          </div>
          <span className={`chip ${colorData.bg} ${colorData.text} ring-1 ${colorData.ring}`}>
            {colorData.name}
          </span>
        </div>

        {/* Rating number + delta */}
        <div className="mt-4 flex items-end justify-between">
          <div>
            <p
              className="font-display text-3xl font-extrabold tabular-nums leading-none"
              style={{ color: colorData.hex }}
            >
              {rating.currentRating}
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              {delta > 0 ? (
                <span className="inline-flex items-center gap-0.5 text-xs font-bold text-success-600">
                  <TrendingUp className="h-3 w-3" />+{delta}
                </span>
              ) : delta < 0 ? (
                <span className="inline-flex items-center gap-0.5 text-xs font-bold text-error-600">
                  <TrendingDown className="h-3 w-3" />{delta}
                </span>
              ) : (
                <span className="inline-flex items-center gap-0.5 text-xs font-bold text-slate-400">
                  <Minus className="h-3 w-3" />0
                </span>
              )}
              <span className="text-[11px] text-slate-400">last contest</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Peak</p>
            <p className="text-lg font-bold tabular-nums text-slate-700">{rating.peakRating}</p>
          </div>
        </div>

        {/* Mini sparkline */}
        <div className="mt-3 -mx-1">
          <RatingGraph history={rating.history} width={280} height={60} accent={rating.accent} showAxis={false} />
        </div>

        {/* Stats grid */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <StatMini icon={Crown} label="Best Rank" value={`#${rating.highestRank}`} color="text-sun-600" />
          <StatMini icon={Target} label="Win Rate" value={`${rating.winRate}%`} color="text-success-600" />
          <StatMini icon={Trophy} label="Contests" value={String(rating.contestCount)} color="text-indigo-600" />
        </div>

        {/* Division progress */}
        {divisions.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              <span>Division Progress</span>
              <span>{rating.division.name}</span>
            </div>
            <div className="mt-1.5 flex gap-1">
              {divisions.map((d) => {
                const isCurrent = d.id === rating.division.id;
                const isPassed = rating.currentRating >= d.maxRating + 1;
                return (
                  <div
                    key={d.id}
                    className={`h-1.5 flex-1 rounded-full transition-all ${
                      isCurrent ? '' : isPassed ? 'bg-slate-300' : 'bg-slate-100'
                    }`}
                    style={isCurrent ? { backgroundColor: colorData.hex } : undefined}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Expandable history */}
        <button
          onClick={() => setShowHistory((v) => !v)}
          className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl bg-slate-50 py-2 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100"
        >
          {showHistory ? <><ChevronUp className="h-3.5 w-3.5" />Hide history</> : <><ChevronDown className="h-3.5 w-3.5" />View rating history</>}
        </button>

        {showHistory && (
          <div className="mt-3 space-y-2">
            <div className="rounded-xl border border-slate-100 p-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Full Rating Graph</p>
              <RatingGraph history={rating.history} width={280} height={120} accent={rating.accent} />
            </div>
            <div className="max-h-48 space-y-1.5 overflow-y-auto">
              {[...rating.history].reverse().map((h, i) => {
                const hColor = getRatingColorData(h.newRating);
                return (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-slate-700">{h.contestName}</p>
                      <p className="text-[10px] text-slate-400">
                        {new Date(h.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · Rank #{h.rank}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold tabular-nums" style={{ color: hColor.hex }}>{h.newRating}</span>
                      <span className={`flex items-center gap-0.5 font-bold ${h.delta > 0 ? 'text-success-600' : h.delta < 0 ? 'text-error-600' : 'text-slate-400'}`}>
                        {h.delta > 0 ? <TrendingUp className="h-3 w-3" /> : h.delta < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                        {h.delta > 0 ? `+${h.delta}` : h.delta}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatMini({
  icon: Icon, label, value, color,
}: {
  icon: typeof Crown; label: string; value: string; color: string;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-2.5 text-center">
      <Icon className={`mx-auto h-3.5 w-3.5 ${color}`} />
      <p className="mt-1 text-sm font-bold tabular-nums text-slate-900">{value}</p>
      <p className="text-[10px] text-slate-400">{label}</p>
    </div>
  );
}

/* ============ Rating Overview Card ============ */

export function RatingOverviewCard({ ratings }: { ratings: SubjectRating[] }) {
  const topRating = [...ratings].sort((a, b) => b.currentRating - a.currentRating)[0];
  const avgRating = Math.round(ratings.reduce((sum, r) => sum + r.currentRating, 0) / ratings.length);
  const totalContests = ratings.reduce((sum, r) => sum + r.contestCount, 0);
  const overallColor = getRatingColorData(avgRating);

  return (
    <div className="card overflow-hidden">
      <div className="relative bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 p-6 text-white">
        <div className="absolute inset-0 bg-grid opacity-5" />
        <div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-indigo-600/20 blur-3xl" />
        <div className="relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-sun-400" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">Contest Ratings</h3>
            </div>
            <span className="chip bg-white/10 text-white ring-1 ring-white/20">{ratings.length} subjects</span>
          </div>

          <div className="mt-5 flex items-end gap-6">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Average Rating</p>
              <p className="font-display text-4xl font-extrabold tabular-nums leading-none" style={{ color: overallColor.hex }}>
                {avgRating}
              </p>
              <span className="mt-1 inline-block text-xs font-semibold" style={{ color: overallColor.hex }}>{overallColor.name}</span>
            </div>
            <div className="border-l border-white/10 pl-6">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Best Subject</p>
              <div className="mt-1 flex items-center gap-2">
                <div className={`flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br ${topRating.color}`}>
                  <topRating.icon className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold">{topRating.subjectName}</p>
                  <p className="text-xs text-slate-400">{topRating.currentRating} · {totalContests} contests</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 p-4">
        {ratings.map((r) => {
          const colorData = getRatingColorData(r.currentRating);
          const Icon = r.icon;
          return (
            <Link
              key={r.subjectSlug}
              to={`/contests?subject=${r.subjectSlug}`}
              className="group inline-flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-1.5 ring-1 ring-slate-100 transition-all hover:ring-indigo-200 hover:bg-indigo-50/30"
            >
              <div className={`flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br ${r.color}`}>
                <Icon className="h-3 w-3 text-white" />
              </div>
              <span className="text-xs font-semibold text-slate-600">{r.subjectName}</span>
              <span className="text-xs font-extrabold tabular-nums" style={{ color: colorData.hex }}>{r.currentRating}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
