import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Medal, RefreshCw, Trophy, Users } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { LoadingState } from '@/components/LoadingState';
import { AppSelect } from '@/components/AppSelect';
import { useAuth } from '@/lib/auth';
import { ratingSubjects } from '@/data/ratings';
import { getRankBadge, getRatingColorHex } from '@/data/leaderboards';
import {
  fetchRatingLeaderboard,
  type RatingLeaderboardEntry,
} from '@/lib/ratings';
import { fetchLearningLeaderboard, formatXp, type LearningLeaderboardEntry } from '@/lib/learning';

export function LeaderboardPage() {
  const { user } = useAuth();
  const [subject, setSubject] = useState('all');
  const [entries, setEntries] = useState<RatingLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [learningScope, setLearningScope] = useState('overall');
  const [learningEntries, setLearningEntries] = useState<LearningLeaderboardEntry[]>([]);
  const [learningLoading, setLearningLoading] = useState(false);
  const [learningError, setLearningError] = useState<string | null>(null);

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

  const loadLearningLeaderboard = useCallback(async () => {
    if (!user) {
      setLearningEntries([]);
      return;
    }
    setLearningLoading(true);
    setLearningError(null);
    try {
      setLearningEntries(await fetchLearningLeaderboard(learningScope));
    } catch (reason) {
      setLearningEntries([]);
      setLearningError(reason instanceof Error ? reason.message : 'Learning leaderboard could not be loaded.');
    } finally {
      setLearningLoading(false);
    }
  }, [learningScope, user]);

  useEffect(() => {
    void loadLearningLeaderboard();
  }, [loadLearningLeaderboard]);

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
        <AppSelect
          id="leaderboard-subject"
          value={subject}
          onChange={setSubject}
          options={[{ value: 'all', label: 'All subjects' }, ...ratingSubjects.map((item) => ({ value: item.slug, label: item.name }))]}
          className="min-w-[180px]"
          ariaLabel="Subject"
        />
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

      <section className="mt-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Learning rankings</p>
            <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">Cameron XP leaderboard</h2>
            <p className="mt-1 text-sm text-slate-500">Separate from contest rating. Only active learners who opt in are shown.</p>
          </div>
          {user && <button type="button" onClick={() => void loadLearningLeaderboard()} disabled={learningLoading} className="btn-ghost px-4 py-2 text-sm disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${learningLoading ? 'animate-spin' : ''}`} />Refresh</button>}
        </div>
        <div className="mt-5 flex flex-wrap gap-2" role="tablist" aria-label="Learning leaderboard scope">
          {[['overall', 'Overall'], ['weekly', 'Weekly'], ['programming', 'Programming'], ['english', 'English'], ['mathematics', 'Mathematics']].map(([scope, label]) => <button key={scope} type="button" role="tab" aria-selected={learningScope === scope} onClick={() => setLearningScope(scope)} className={learningScope === scope ? 'rounded-xl bg-indigo-600 px-3 py-2 text-sm font-bold text-white' : 'rounded-xl bg-white px-3 py-2 text-sm font-bold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'}>{label}</button>)}
        </div>
        <section className="card mt-4 overflow-hidden" aria-live="polite">
          {!user ? <div className="p-10 text-center"><Trophy className="mx-auto h-9 w-9 text-slate-300" /><h3 className="mt-3 text-base font-bold text-slate-900">Sign in to view learning rankings</h3><p className="mt-1 text-sm text-slate-500">Learning leaderboards use verified XP and profile visibility preferences.</p></div> : learningLoading ? <LoadingState className="min-h-[14rem] rounded-none" message="Learning leaderboard loading" /> : learningError ? <div className="p-10 text-center"><AlertCircle className="mx-auto h-9 w-9 text-error-500" /><h3 className="mt-3 text-base font-bold text-slate-900">Learning leaderboard unavailable</h3><p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{learningError}</p><button type="button" onClick={() => void loadLearningLeaderboard()} className="btn-ghost mt-5 px-4 py-2 text-sm"><RefreshCw className="h-4 w-4" />Try again</button></div> : learningEntries.length ? <LearningLeaderboardTable entries={learningEntries} currentUserId={user.id} /> : <div className="p-10 text-center"><Trophy className="mx-auto h-9 w-9 text-slate-300" /><h3 className="mt-3 text-base font-bold text-slate-900">No verified XP yet</h3><p className="mt-1 text-sm text-slate-500">This leaderboard will appear once opted-in learners complete verified activities.</p></div>}
        </section>
      </section>
    </div>
  );
}

function LearningLeaderboardTable({ entries, currentUserId }: { entries: LearningLeaderboardEntry[]; currentUserId: string }) {
  return <div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b border-slate-100 bg-slate-50/50 text-left text-xs font-bold uppercase tracking-wider text-slate-400"><th className="px-4 py-3">Rank</th><th className="px-4 py-3">Learner</th><th className="hidden px-4 py-3 sm:table-cell">Level</th><th className="hidden px-4 py-3 md:table-cell">Mastery</th><th className="px-4 py-3 text-right">XP</th></tr></thead><tbody>{entries.map((entry) => <tr key={entry.userId} className={`border-b border-slate-50 last:border-0 ${entry.userId === currentUserId ? 'bg-indigo-50/60' : 'hover:bg-slate-50/60'}`}><td className="px-4 py-3.5"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-xs font-extrabold text-slate-600">{entry.rank}</span></td><td className="px-4 py-3.5"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-electric-600 text-xs font-bold text-white">{entry.displayName.slice(0, 2).toUpperCase()}</span><span className="text-sm font-bold text-slate-700">{entry.displayName}{entry.userId === currentUserId && <span className="ml-2 text-xs font-semibold text-indigo-600">You</span>}</span></div></td><td className="hidden px-4 py-3.5 text-sm font-semibold text-slate-600 sm:table-cell">{entry.level}</td><td className="hidden px-4 py-3.5 text-sm text-slate-500 md:table-cell">{entry.mastery}%</td><td className="px-4 py-3.5 text-right text-sm font-extrabold tabular-nums text-slate-800">{formatXp(entry.xp)}</td></tr>)}</tbody></table></div>;
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
