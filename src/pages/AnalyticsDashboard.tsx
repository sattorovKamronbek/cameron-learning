import { useEffect, useMemo, useState } from 'react';
import {
  Target, TrendingUp, Flame, Trophy, CheckCircle2, Award,
  Calendar, Zap, ChevronUp, ChevronDown, Minus, BarChart3,
  Activity, Clock, BookOpen,
} from 'lucide-react';
import {
  subjectPerformance, strongTopics, weakTopics,
  difficultyDistribution, monthlyProgress, yearlyProgress,
  heatmapData, contestHistory, ratingGrowth,
  getAnalyticsSummary,
} from '@/data/analytics';
import { getRatingColorData } from '@/data/ratings';
import { PageHeader } from '@/components/PageHeader';
import { supabase, type UserActivity } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { LoadingState } from '@/components/LoadingState';

export function AnalyticsDashboard() {
  const { user } = useAuth();
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [loading, setLoading] = useState(Boolean(user));

  useEffect(() => {
    if (!user) { setActivities([]); setLoading(false); return; }
    let active = true;
    supabase.from('user_activity').select('*').order('created_at', { ascending: false }).limit(100)
      .then(({ data }) => { if (active) { setActivities((data ?? []) as UserActivity[]); setLoading(false); } });
    return () => { active = false; };
  }, [user]);

  const accepted = activities.filter((activity) => activity.type === 'submission_accepted').length;
  const completedLessons = activities.filter((activity) => activity.type === 'complete_lesson').length;
  const contestEntries = activities.filter((activity) => activity.type === 'contest_joined').length;

  return (
    <div className="container-page py-10">
      <PageHeader eyebrow="Analytics" title="Your activity" description="Metrics are calculated only from your recorded platform activity." />
      {!user ? (
        <div className="card mt-8 p-10 text-center text-sm text-slate-500">Sign in to see your personal activity.</div>
      ) : loading ? (
        <LoadingState className="card mt-8" message="Faollik ma’lumotlari yuklanmoqda" />
      ) : (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Activity} label="Recorded activity" value={String(activities.length)} sub="last 100 events" color="from-indigo-500 to-indigo-700" />
            <StatCard icon={CheckCircle2} label="Accepted solutions" value={String(accepted)} sub="recorded accepted submissions" color="from-success-500 to-electric-600" />
            <StatCard icon={BookOpen} label="Lessons completed" value={String(completedLessons)} sub="recorded completions" color="from-electric-500 to-electric-700" />
            <StatCard icon={Trophy} label="Contest entries" value={String(contestEntries)} sub="recorded registrations" color="from-sun-500 to-sun-600" />
          </div>
          <div className="card mt-6 overflow-hidden">
            <div className="border-b border-slate-100 p-5"><h2 className="text-sm font-bold text-slate-900">Recent activity</h2></div>
            {activities.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">No activity has been recorded yet. Statistics will appear after you learn, join contests, or submit solutions.</div>
            ) : (
              <div className="divide-y divide-slate-100">{activities.slice(0, 20).map((activity) => <div key={activity.id} className="flex items-center justify-between gap-4 p-4"><span className="text-sm font-semibold text-slate-700">{activity.title}</span><time className="shrink-0 text-xs text-slate-400">{new Date(activity.created_at).toLocaleString()}</time></div>)}</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function LegacyAnalyticsDashboard() {
  const summary = getAnalyticsSummary();
  const heatmapCells = useMemo(() => heatmapData, []);
  const weeks = useMemo(() => {
    const set = new Set<number>();
    heatmapCells.forEach((c) => set.add(c.week));
    return Array.from(set).sort((a, b) => a - b);
  }, [heatmapCells]);

  return (
    <div className="container-page py-10">
      <PageHeader
        eyebrow="Analytics"
        title="Performance Dashboard"
        description="Track your progress across subjects, identify strengths and weaknesses, and visualize your learning journey over time."
      />

      {/* Summary stat cards */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={CheckCircle2}
          label="Total Solved"
          value={String(summary.totalSolved)}
          sub="across all subjects"
          color="from-indigo-500 to-indigo-700"
        />
        <StatCard
          icon={Target}
          label="Avg Accuracy"
          value={`${summary.avgAccuracy}%`}
          sub="overall accuracy rate"
          color="from-success-500 to-electric-600"
        />
        <StatCard
          icon={Trophy}
          label="Avg Rank"
          value={`#${summary.avgRank}`}
          sub="average contest rank"
          color="from-sun-500 to-sun-600"
        />
        <StatCard
          icon={Flame}
          label="Current Streak"
          value={`${summary.currentStreak} days`}
          sub={`best: ${summary.longestStreak} days`}
          color="from-error-500 to-orange-600"
        />
      </div>

      {/* Rating Growth Graph + Monthly Progress */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Rating Growth */}
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-400">
              <TrendingUp className="h-4 w-4 text-indigo-500" />
              Rating Growth
            </h3>
            <span className="chip bg-success-500/10 text-success-600">
              <ChevronUp className="h-3 w-3" />
              +{summary.ratingProgression}
            </span>
          </div>
          <div className="mt-4">
            <RatingGrowthChart data={ratingGrowth} />
          </div>
        </div>

        {/* Monthly Progress */}
        <div className="card p-6">
          <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-400">
            <BarChart3 className="h-4 w-4 text-electric-500" />
            Monthly Progress
          </h3>
          <div className="mt-4">
            <MonthlyBars data={monthlyProgress} />
          </div>
        </div>
      </div>

      {/* Heatmap */}
      <div className="card mt-6 p-6">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-400">
            <Activity className="h-4 w-4 text-indigo-500" />
            Activity Heatmap
          </h3>
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span>Less</span>
            {[0, 1, 2, 3, 4].map((l) => (
              <span
                key={l}
                className={`h-3 w-3 rounded-sm ${
                  l === 0 ? 'bg-slate-100' :
                  l === 1 ? 'bg-success-200' :
                  l === 2 ? 'bg-success-400' :
                  l === 3 ? 'bg-success-500' :
                  'bg-success-700'
                }`}
              />
            ))}
            <span>More</span>
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <Heatmap cells={heatmapCells} weeks={weeks} />
        </div>
      </div>

      {/* Performance by Subject */}
      <div className="card mt-6 p-6">
        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-400">
          <BookOpen className="h-4 w-4 text-indigo-500" />
          Performance by Subject
        </h3>
        <div className="mt-4 space-y-3">
          {subjectPerformance.map((subj) => {
            const colorData = getRatingColorData(subj.rating);
            return (
              <div key={subj.slug} className="flex items-center gap-4 rounded-2xl bg-slate-50/50 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-800">{subj.subject}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-display text-base font-extrabold tabular-nums" style={{ color: colorData.hex }}>
                        {subj.rating}
                      </span>
                      <span className={`flex items-center gap-0.5 text-xs font-bold ${
                        subj.trend === 'up' ? 'text-success-600' : subj.trend === 'down' ? 'text-error-600' : 'text-slate-400'
                      }`}>
                        {subj.trend === 'up' ? <ChevronUp className="h-3 w-3" /> : subj.trend === 'down' ? <ChevronDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                        {Math.abs(subj.trendValue)}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
                    <span>{subj.solved} solved</span>
                    <span>·</span>
                    <span>Avg rank #{subj.avgRank}</span>
                    <span>·</span>
                    <span>{subj.accuracy}% accuracy</span>
                  </div>
                  {/* Accuracy bar */}
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${subj.accuracy}%`, background: `linear-gradient(90deg, ${colorData.hex}80, ${colorData.hex})` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Strong + Weak Topics */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Strong Topics */}
        <div className="card p-6">
          <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-400">
            <Zap className="h-4 w-4 text-success-500" />
            Strong Topics
          </h3>
          <div className="mt-4 space-y-2">
            {strongTopics.map((topic, i) => (
              <TopicBar key={i} topic={topic} color="from-success-400 to-electric-500" />
            ))}
          </div>
        </div>

        {/* Weak Topics */}
        <div className="card p-6">
          <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-400">
            <Target className="h-4 w-4 text-error-500" />
            Weak Topics
          </h3>
          <div className="mt-4 space-y-2">
            {weakTopics.map((topic, i) => (
              <TopicBar key={i} topic={topic} color="from-error-400 to-sun-500" />
            ))}
          </div>
        </div>
      </div>

      {/* Difficulty Distribution */}
      <div className="card mt-6 p-6">
        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-400">
          <BarChart3 className="h-4 w-4 text-purple-500" />
          Difficulty Distribution
        </h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {difficultyDistribution.map((d) => (
            <div key={d.difficulty} className="rounded-2xl bg-slate-50/50 p-4">
              <div className={`h-2 rounded-full bg-gradient-to-r ${d.color}`} />
              <p className="mt-3 text-sm font-bold text-slate-800">{d.difficulty}</p>
              <p className="font-display text-2xl font-extrabold tabular-nums text-slate-900">{d.count}</p>
              <p className="mt-1 text-xs text-slate-400">{d.accuracy}% accuracy</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                <div className={`h-full rounded-full bg-gradient-to-r ${d.color}`} style={{ width: `${d.accuracy}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Yearly Progress */}
      <div className="card mt-6 p-6">
        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-400">
          <Calendar className="h-4 w-4 text-indigo-500" />
          Yearly Progress
        </h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {yearlyProgress.map((y) => (
            <div key={y.year} className="rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 p-5">
              <p className="font-display text-xl font-extrabold text-slate-900">{y.year}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div>
                  <p className="text-lg font-bold tabular-nums text-indigo-600">{y.solved}</p>
                  <p className="text-[10px] text-slate-400">Solved</p>
                </div>
                <div>
                  <p className="text-lg font-bold tabular-nums text-electric-600">{y.contests}</p>
                  <p className="text-[10px] text-slate-400">Contests</p>
                </div>
                <div>
                  <p className="text-lg font-bold tabular-nums text-success-600">{y.rating}</p>
                  <p className="text-[10px] text-slate-400">Peak Rating</p>
                </div>
                <div>
                  <p className="text-lg font-bold tabular-nums text-sun-600">{y.accuracy}%</p>
                  <p className="text-[10px] text-slate-400">Accuracy</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Contest History */}
      <div className="card mt-6 overflow-hidden">
        <div className="p-6 pb-0">
          <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-400">
            <Clock className="h-4 w-4 text-electric-500" />
            Contest History
          </h3>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-bold uppercase tracking-wider text-slate-400">
                <th className="px-6 py-2 text-left">Contest</th>
                <th className="hidden px-4 py-2 text-left sm:table-cell">Date</th>
                <th className="px-4 py-2 text-right">Rank</th>
                <th className="hidden px-4 py-2 text-right md:table-cell">Solved</th>
                <th className="hidden px-4 py-2 text-right lg:table-cell">Accuracy</th>
                <th className="px-6 py-2 text-right">Rating</th>
              </tr>
            </thead>
            <tbody>
              {contestHistory.map((c) => {
                const colorData = getRatingColorData(c.newRating);
                return (
                  <tr key={c.id} className="border-b border-slate-50 transition-colors hover:bg-slate-50/60">
                    <td className="px-6 py-3">
                      <p className="text-sm font-bold text-slate-700">{c.name}</p>
                      <p className="text-xs text-slate-400">{c.subject}</p>
                    </td>
                    <td className="hidden px-4 py-3 text-sm text-slate-500 sm:table-cell">
                      {new Date(c.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-bold tabular-nums text-slate-700">
                        #{c.rank}
                      </span>
                      <span className="block text-[10px] text-slate-400">/ {c.participants}</span>
                    </td>
                    <td className="hidden px-4 py-3 text-right text-sm font-bold text-slate-700 md:table-cell">
                      {c.solved}/{c.total}
                    </td>
                    <td className="hidden px-4 py-3 text-right text-sm font-bold text-slate-700 lg:table-cell">
                      {c.accuracy}%
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="font-display text-sm font-extrabold tabular-nums" style={{ color: colorData.hex }}>
                          {c.newRating}
                        </span>
                        <span className={`flex items-center gap-0.5 text-xs font-bold ${
                          c.delta > 0 ? 'text-success-600' : c.delta < 0 ? 'text-error-600' : 'text-slate-400'
                        }`}>
                          {c.delta > 0 ? <ChevronUp className="h-3 w-3" /> : c.delta < 0 ? <ChevronDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                          {Math.abs(c.delta)}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ============ Sub-components ============ */

function StatCard({
  icon: Icon, label, value, sub, color,
}: {
  icon: typeof Target; label: string; value: string; sub: string; color: string;
}) {
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

function RatingGrowthChart({ data }: { data: typeof ratingGrowth }) {
  const maxR = Math.max(...data.map((d) => d.rating));
  const minR = Math.min(...data.map((d) => d.rating));
  const range = maxR - minR || 1;
  const w = 500;
  const h = 180;
  const padX = 30;
  const padY = 20;
  const chartW = w - padX * 2;
  const chartH = h - padY * 2;

  const pts = data.map((d, i) => ({
    x: padX + (i / (data.length - 1)) * chartW,
    y: padY + chartH - ((d.rating - minR) / range) * chartH,
    rating: d.rating,
    label: d.label,
  }));

  const linePath = pts.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');
  const areaPath = `${linePath} L ${pts[pts.length - 1].x} ${padY + chartH} L ${pts[0].x} ${padY + chartH} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
      <defs>
        <linearGradient id="ratingGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map((f) => (
        <line key={f} x1={padX} y1={padY + chartH * f} x2={padX + chartW} y2={padY + chartH * f} stroke="#e2e8f0" strokeWidth="0.5" strokeDasharray="3 3" />
      ))}
      <path d={areaPath} fill="url(#ratingGrad)" />
      <path d={linePath} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => {
        const colorData = getRatingColorData(p.rating);
        return (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={i === pts.length - 1 ? 5 : 3} fill={colorData.hex} stroke="white" strokeWidth="1.5" />
            <text x={p.x} y={h - 4} fontSize="9" fill="#94a3b8" textAnchor="middle" className="font-semibold">{p.label}</text>
          </g>
        );
      })}
      <text x={padX - 4} y={padY + 4} fontSize="9" fill="#94a3b8" textAnchor="end" className="font-semibold">{maxR}</text>
      <text x={padX - 4} y={padY + chartH + 4} fontSize="9" fill="#94a3b8" textAnchor="end" className="font-semibold">{minR}</text>
    </svg>
  );
}

function MonthlyBars({ data }: { data: typeof monthlyProgress }) {
  const max = Math.max(...data.map((d) => d.solved));
  return (
    <div className="flex items-end justify-between gap-1" style={{ height: 180 }}>
      {data.map((d) => (
        <div key={d.short} className="flex flex-1 flex-col items-center gap-1">
          <span className="text-[9px] font-bold tabular-nums text-slate-500">{d.solved}</span>
          <div className="flex w-full flex-1 items-end">
            <div
              className="w-full rounded-t-lg bg-gradient-to-t from-indigo-500 to-electric-400 transition-all duration-500 hover:from-indigo-600 hover:to-electric-500"
              style={{ height: `${(d.solved / max) * 100}%` }}
            />
          </div>
          <span className="text-[9px] font-semibold text-slate-400">{d.short}</span>
        </div>
      ))}
    </div>
  );
}

function TopicBar({ topic, color }: { topic: { topic: string; subject: string; accuracy: number; attempted: number }; color: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-slate-50/50 p-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span className="truncate text-sm font-semibold text-slate-700">{topic.topic}</span>
          <span className="text-sm font-bold tabular-nums text-slate-800">{topic.accuracy}%</span>
        </div>
        <p className="text-[10px] text-slate-400">{topic.subject} · {topic.attempted} attempted</p>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-700`} style={{ width: `${topic.accuracy}%` }} />
        </div>
      </div>
    </div>
  );
}

function Heatmap({ cells, weeks }: { cells: typeof heatmapData; weeks: number[] }) {
  const dayLabels = ['Mon', 'Wed', 'Fri'];
  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function cellColor(level: number): string {
    switch (level) {
      case 0: return 'bg-slate-100';
      case 1: return 'bg-success-200';
      case 2: return 'bg-success-400';
      case 3: return 'bg-success-500';
      case 4: return 'bg-success-700';
      default: return 'bg-slate-100';
    }
  }

  return (
    <div className="flex gap-2">
      {/* Day labels */}
      <div className="flex flex-col gap-1 pt-5">
        {dayLabels.map((d) => (
          <span key={d} className="h-3 text-[9px] font-semibold text-slate-400" style={{ marginBottom: '8px' }}>{d}</span>
        ))}
      </div>

      {/* Grid */}
      <div className="flex-1">
        {/* Month labels */}
        <div className="mb-1 flex justify-between">
          {monthLabels.map((m, i) => (
            <span key={m} className="text-[9px] font-semibold text-slate-400" style={{ width: `${100 / 12}%` }}>{m}</span>
          ))}
        </div>
        {/* Cells */}
        <div className="flex gap-1 overflow-x-auto">
          {weeks.map((week) => (
            <div key={week} className="flex flex-col gap-1">
              {[0, 1, 2, 3, 4, 5, 6].map((day) => {
                const cell = cells.find((c) => c.week === week && c.day === day);
                if (!cell) return <div key={day} className="h-3 w-3 rounded-sm" />;
                return (
                  <div
                    key={day}
                    className={`h-3 w-3 rounded-sm ${cellColor(cell.level)} transition-all hover:ring-2 hover:ring-indigo-300`}
                    title={`${new Date(cell.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: ${cell.count} solved`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
