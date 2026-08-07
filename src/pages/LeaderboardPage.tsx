import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Medal, RefreshCw, Trophy, Users } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { LoadingState } from '@/components/LoadingState';
import { ratingSubjects } from '@/data/ratings';
import { getRankBadge, getRatingColorHex } from '@/data/leaderboards';
import {
  fetchRatingLeaderboard,
  type RatingLeaderboardEntry,
} from '@/lib/ratings';

export function LeaderboardPage() {
  const [subject, setSubject] = useState('all');
  const [entries, setEntries] = useState<RatingLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLeaderboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRatingLeaderboard(subject === 'all' ? undefined : subject);
      setEntries(data);
    } catch (reason) {
      setEntries([]);
      setError(reason instanceof Error ? reason.message : 'Leaderboard could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [subject]);

  useEffect(() => {
    void loadLeaderboard();
  }, [loadLeaderboard]);

  return (
    <div className="container-page py-10">
      <PageHeader
        eyebrow="Rankings"
        title="Contest leaderboard"
        description="Rankings are shown only from completed, server-calculated rated contests."
      />

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <label className="text-sm font-semibold text-slate-600" htmlFor="leaderboard-subject">
          Subject
        </label>
        <select
          id="leaderboard-subject"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100"
        >
          <option value="all">All subjects</option>
          {ratingSubjects.map((item) => (
            <option key={item.slug} value={item.slug}>{item.name}</option>
          ))}
        </select>
        {!loading && !error && (
          <span className="ml-auto text-sm text-slate-400">
            {entries.length} rated competitor{entries.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      <section className="card mt-6 overflow-hidden" aria-live="polite">
        {loading ? (
          <LoadingState className="min-h-[18rem] rounded-none" message="Leaderboard yuklanmoqda" />
        ) : error ? (
          <div className="p-10 text-center">
            <AlertCircle className="mx-auto h-9 w-9 text-error-500" />
            <h2 className="mt-3 text-base font-bold text-slate-900">Leaderboard unavailable</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{error}</p>
            <button onClick={() => void loadLeaderboard()} className="btn-ghost mt-5 px-4 py-2 text-sm">
              <RefreshCw className="h-4 w-4" />
              Try again
            </button>
          </div>
        ) : entries.length === 0 ? (
          <div className="p-12 text-center">
            <Trophy className="mx-auto h-10 w-10 text-slate-300" />
            <h2 className="mt-4 text-lg font-bold text-slate-900">No rated results yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
              This leaderboard will appear after a real rated contest has been completed and finalized.
            </p>
          </div>
        ) : (
          <LeaderboardTable entries={entries} />
        )}
      </section>
    </div>
  );
}

function LeaderboardTable({ entries }: { entries: RatingLeaderboardEntry[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/50 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
            <th className="px-4 py-3">Rank</th>
            <th className="px-4 py-3">Competitor</th>
            <th className="hidden px-4 py-3 md:table-cell">Subject</th>
            <th className="px-4 py-3 text-right">Rating</th>
            <th className="px-4 py-3 text-right">Rated contests</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const badge = getRankBadge(entry.rank);
            const BadgeIcon = badge.icon;
            const ratingColor = getRatingColorHex(entry.rating);
            return (
              <tr key={entry.userId ?? `${entry.rank}-${entry.displayName}`} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                <td className="px-4 py-3.5">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-xl text-xs font-extrabold ${
                    badge.label ? `bg-gradient-to-br ${badge.color} text-white` : 'bg-slate-100 text-slate-500'
                  }`}>
                    {badge.label ? <BadgeIcon className="h-4 w-4" aria-label={`${badge.label} rank`} /> : entry.rank}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-electric-600 text-xs font-bold text-white">
                      {entry.displayName.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="text-sm font-bold text-slate-700">{entry.displayName}</span>
                  </div>
                </td>
                <td className="hidden px-4 py-3.5 text-sm text-slate-500 md:table-cell">
                  {entry.subject ?? '—'}
                </td>
                <td className="px-4 py-3.5 text-right">
                  <span className="font-display text-base font-extrabold tabular-nums" style={{ color: ratingColor }}>
                    {entry.rating}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-right">
                  <span className="inline-flex items-center gap-1 text-sm font-bold tabular-nums text-slate-700">
                    <Users className="h-3.5 w-3.5 text-slate-400" />
                    {entry.contestCount}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50/40 px-4 py-3 text-xs text-slate-400">
        <Medal className="h-3.5 w-3.5" />
        Ratings are recalculated only when contest results are finalized.
      </div>
    </div>
  );
}
