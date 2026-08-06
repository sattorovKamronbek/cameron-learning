import { useState, useMemo } from 'react';
import {
  Globe, MapPin, GraduationCap, Trophy, Sigma, ChevronUp, ChevronDown,
  Flame, TrendingUp, Users, Crown, Medal, ChevronLeft, ChevronRight,
  Code2,
} from 'lucide-react';
import { Link } from '@/router';
import {
  type LeaderboardScope, type TimePeriod, type LeaderboardUser,
  getLeaderboard, countryLeaderboard, schoolLeaderboard,
  scopeMeta, periodMeta, getRatingColorHex,
} from '@/data/leaderboards';
import { ratingSubjects } from '@/data/ratings';
import { PageHeader } from '@/components/PageHeader';

export function LeaderboardPage() {
  const [scope, setScope] = useState<LeaderboardScope>('global');
  const [period, setPeriod] = useState<TimePeriod>('yearly');
  const [subjectSlug, setSubjectSlug] = useState('programming');
  const [page, setPage] = useState(0);

  const pageSize = 20;
  const users = useMemo(() => getLeaderboard(scope, period, subjectSlug), [scope, period, subjectSlug]);
  const totalPages = Math.ceil(users.length / pageSize);
  const pagedUsers = users.slice(page * pageSize, (page + 1) * pageSize);

  const handleScopeChange = (s: LeaderboardScope) => {
    setScope(s);
    setPage(0);
  };

  const handlePeriodChange = (p: TimePeriod) => {
    setPeriod(p);
    setPage(0);
  };

  return (
    <div className="container-page py-10">
      <PageHeader
        eyebrow="Rankings"
        title="Global Leaderboards"
        description="Compete with learners worldwide across every subject. Climb the ranks, earn badges, and prove your mastery."
      />

      {/* Scope tabs */}
      <div className="mt-8 flex flex-wrap gap-2">
        {(Object.keys(scopeMeta) as LeaderboardScope[]).map((s) => {
          const meta = scopeMeta[s];
          const Icon = meta.icon;
          const active = scope === s;
          return (
            <button
              key={s}
              onClick={() => handleScopeChange(s)}
              className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition-all ${
                active
                  ? 'bg-gradient-to-r from-indigo-500 to-electric-500 text-white shadow-soft'
                  : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-slate-300 hover:bg-slate-50'
              }`}
            >
              <Icon className="h-4 w-4" />
              {meta.label}
            </button>
          );
        })}
      </div>

      {/* Period + subject filters */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {/* Period selector */}
        <div className="flex rounded-2xl bg-slate-100 p-1">
          {(Object.keys(periodMeta) as TimePeriod[]).map((p) => (
            <button
              key={p}
              onClick={() => handlePeriodChange(p)}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                period === p ? 'bg-white text-indigo-700 shadow-soft' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {periodMeta[p].label}
            </button>
          ))}
        </div>

        {/* Subject selector (only for subject scope) */}
        {scope === 'subject' && (
          <select
            value={subjectSlug}
            onChange={(e) => { setSubjectSlug(e.target.value); setPage(0); }}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100"
          >
            {ratingSubjects.map((s) => (
              <option key={s.slug} value={s.slug}>{s.name}</option>
            ))}
          </select>
        )}

        {/* Result count */}
        <span className="ml-auto text-sm text-slate-400">
          {users.length} competitors
        </span>
      </div>

      {/* Leaderboard content */}
      <div className="mt-6">
        {scope === 'country' ? (
          <CountryLeaderboard />
        ) : scope === 'school' ? (
          <SchoolLeaderboard />
        ) : (
          <UserLeaderboard users={pagedUsers} period={period} />
        )}
      </div>

      {/* Pagination */}
      {(scope === 'global' || scope === 'subject' || scope === 'friends') && totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white ring-1 ring-slate-200 transition-colors hover:bg-slate-50 disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4 text-slate-600" />
          </button>
          {Array.from({ length: totalPages }).slice(0, 7).map((_, i) => (
            <button
              key={i}
              onClick={() => setPage(i)}
              className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold transition-all ${
                page === i
                  ? 'bg-gradient-to-r from-indigo-500 to-electric-500 text-white shadow-soft'
                  : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
              }`}
            >
              {i + 1}
            </button>
          ))}
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white ring-1 ring-slate-200 transition-colors hover:bg-slate-50 disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4 text-slate-600" />
          </button>
        </div>
      )}
    </div>
  );
}

/* ============ User Leaderboard Table ============ */

function UserLeaderboard({ users, period }: { users: LeaderboardUser[]; period: TimePeriod }) {
  return (
    <div className="card overflow-hidden">
      {/* Desktop table */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50 text-xs font-bold uppercase tracking-wider text-slate-400">
              <th className="px-4 py-3 text-left">Rank</th>
              <th className="px-4 py-3 text-left">User</th>
              <th className="px-4 py-3 text-left">Country</th>
              <th className="px-4 py-3 text-left hidden xl:table-cell">School</th>
              <th className="px-4 py-3 text-right">Rating</th>
              <th className="px-4 py-3 text-right">Solved</th>
              <th className="px-4 py-3 text-right hidden xl:table-cell">Accuracy</th>
              <th className="px-4 py-3 text-center hidden xl:table-cell">Streak</th>
              <th className="px-4 py-3 text-left hidden 2xl:table-cell">Favorite</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <UserRow key={user.id} user={user} period={period} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="divide-y divide-slate-100 lg:hidden">
        {users.map((user) => (
          <UserCard key={user.id} user={user} period={period} />
        ))}
      </div>
    </div>
  );
}

function UserRow({ user, period }: { user: LeaderboardUser; period: TimePeriod }) {
  const ratingHex = getRatingColorHex(user.rating);
  const isTop3 = user.rank <= 3;
  const FavIcon = user.favoriteSubjectIcon;
  const delta = period === 'weekly' ? user.ratingChange : user.ratingChange;

  return (
    <tr className="group border-b border-slate-50 transition-colors hover:bg-slate-50/60">
      {/* Rank */}
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-2">
          {isTop3 ? (
            <span className={`flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br ${
              user.rank === 1 ? 'from-sun-400 to-sun-600' : user.rank === 2 ? 'from-slate-300 to-slate-500' : 'from-orange-400 to-orange-700'
            } text-xs font-extrabold text-white shadow-soft`}>
              {user.rank}
            </span>
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-xs font-bold text-slate-500">
              {user.rank}
            </span>
          )}
        </div>
      </td>

      {/* User */}
      <td className="px-4 py-3.5">
        <Link to="/profile" className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-electric-600 text-xs font-bold text-white">
            {user.username.slice(0, 2).toUpperCase()}
          </span>
          <span className="text-sm font-bold text-slate-700 group-hover:text-indigo-700">{user.username}</span>
        </Link>
      </td>

      {/* Country */}
      <td className="px-4 py-3.5">
        <span className="flex items-center gap-2">
          <span className="text-lg">{user.flag}</span>
          <span className="hidden text-sm text-slate-500 sm:inline">{user.country}</span>
        </span>
      </td>

      {/* School */}
      <td className="hidden px-4 py-3.5 xl:table-cell">
        <span className="text-sm text-slate-500">{user.school}</span>
      </td>

      {/* Rating */}
      <td className="px-4 py-3.5 text-right">
        <div className="flex items-center justify-end gap-2">
          <span className="font-display text-base font-extrabold tabular-nums" style={{ color: ratingHex }}>
            {user.rating}
          </span>
          {delta !== 0 && (
            <span className={`flex items-center gap-0.5 text-xs font-bold ${delta > 0 ? 'text-success-600' : 'text-error-600'}`}>
              {delta > 0 ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {Math.abs(delta)}
            </span>
          )}
        </div>
      </td>

      {/* Solved */}
      <td className="px-4 py-3.5 text-right">
        <span className="text-sm font-bold tabular-nums text-slate-700">{user.solved}</span>
      </td>

      {/* Accuracy */}
      <td className="hidden px-4 py-3.5 text-right xl:table-cell">
        <div className="flex items-center justify-end gap-2">
          <div className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-slate-200 sm:block">
            <div className="h-full rounded-full bg-gradient-to-r from-success-400 to-electric-500" style={{ width: `${user.accuracy}%` }} />
          </div>
          <span className="text-sm font-bold tabular-nums text-slate-700">{user.accuracy}%</span>
        </div>
      </td>

      {/* Streak */}
      <td className="hidden px-4 py-3.5 text-center xl:table-cell">
        <span className="inline-flex items-center gap-1 text-sm font-bold text-sun-600">
          <Flame className="h-3.5 w-3.5" />
          {user.currentStreak}
        </span>
      </td>

      {/* Favorite Subject */}
      <td className="hidden px-4 py-3.5 2xl:table-cell">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
          <FavIcon className="h-3.5 w-3.5 text-indigo-500" />
          {user.favoriteSubject}
        </span>
      </td>
    </tr>
  );
}

function UserCard({ user, period }: { user: LeaderboardUser; period: TimePeriod }) {
  const ratingHex = getRatingColorHex(user.rating);
  const isTop3 = user.rank <= 3;
  const FavIcon = user.favoriteSubjectIcon;
  const delta = user.ratingChange;

  return (
    <div className="p-4">
      <div className="flex items-center gap-3">
        {isTop3 ? (
          <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-xs font-extrabold text-white shadow-soft ${
            user.rank === 1 ? 'from-sun-400 to-sun-600' : user.rank === 2 ? 'from-slate-300 to-slate-500' : 'from-orange-400 to-orange-700'
          }`}>
            {user.rank}
          </span>
        ) : (
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-500">
            {user.rank}
          </span>
        )}
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-electric-600 text-xs font-bold text-white">
          {user.username.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-800">{user.username}</p>
          <p className="text-xs text-slate-400">{user.flag} {user.school}</p>
        </div>
        <div className="text-right">
          <p className="font-display text-lg font-extrabold tabular-nums" style={{ color: ratingHex }}>{user.rating}</p>
          {delta !== 0 && (
            <p className={`text-xs font-bold ${delta > 0 ? 'text-success-600' : 'text-error-600'}`}>
              {delta > 0 ? '+' : ''}{delta}
            </p>
          )}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2">
        <div className="rounded-lg bg-slate-50 p-2 text-center">
          <p className="text-xs font-bold text-slate-700">{user.solved}</p>
          <p className="text-[10px] text-slate-400">Solved</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-2 text-center">
          <p className="text-xs font-bold text-slate-700">{user.accuracy}%</p>
          <p className="text-[10px] text-slate-400">Accuracy</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-2 text-center">
          <p className="text-xs font-bold text-sun-600">{user.currentStreak}</p>
          <p className="text-[10px] text-slate-400">Streak</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-2 text-center">
          <FavIcon className="mx-auto h-3.5 w-3.5 text-indigo-500" />
          <p className="mt-0.5 truncate text-[10px] text-slate-400">{user.favoriteSubject}</p>
        </div>
      </div>
    </div>
  );
}

/* ============ Country Leaderboard ============ */

function CountryLeaderboard() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {countryLeaderboard.map((entry) => (
        <div key={entry.code} className="card-hover p-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{entry.flag}</span>
              <div>
                <p className="text-sm font-bold text-slate-900">{entry.name}</p>
                <p className="text-xs text-slate-400">{entry.competitors.toLocaleString()} competitors</p>
              </div>
            </div>
            <span className={`flex h-8 w-8 items-center justify-center rounded-xl text-xs font-extrabold ${
              entry.rank <= 3 ? 'bg-gradient-to-br from-sun-400 to-sun-600 text-white' : 'bg-slate-100 text-slate-500'
            }`}>
              {entry.rank}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-slate-50 p-2.5 text-center">
              <p className="text-sm font-extrabold tabular-nums text-slate-900">{entry.topRating}</p>
              <p className="text-[10px] text-slate-400">Top Rating</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-2.5 text-center">
              <p className="text-sm font-extrabold tabular-nums text-slate-900">{entry.avgRating}</p>
              <p className="text-[10px] text-slate-400">Avg Rating</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-2.5 text-center">
              <p className="flex items-center justify-center gap-1 text-sm font-extrabold tabular-nums text-sun-600">
                <Medal className="h-3 w-3" />
                {entry.goldMedals}
              </p>
              <p className="text-[10px] text-slate-400">Golds</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============ School Leaderboard ============ */

function SchoolLeaderboard() {
  return (
    <div className="card overflow-hidden">
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50 text-xs font-bold uppercase tracking-wider text-slate-400">
              <th className="px-4 py-3 text-left">Rank</th>
              <th className="px-4 py-3 text-left">School</th>
              <th className="px-4 py-3 text-left">Country</th>
              <th className="px-4 py-3 text-right">Top Rating</th>
              <th className="px-4 py-3 text-right">Avg Rating</th>
              <th className="px-4 py-3 text-right">Students</th>
              <th className="px-4 py-3 text-right">Gold Medals</th>
            </tr>
          </thead>
          <tbody>
            {schoolLeaderboard.map((entry) => (
              <tr key={entry.name} className="group border-b border-slate-50 transition-colors hover:bg-slate-50/60">
                <td className="px-4 py-3.5">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-xl text-xs font-extrabold ${
                    entry.rank <= 3 ? 'bg-gradient-to-br from-sun-400 to-sun-600 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {entry.rank}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-indigo-500" />
                    <span className="text-sm font-bold text-slate-700 group-hover:text-indigo-700">{entry.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3.5">
                  <span className="flex items-center gap-2">
                    <span className="text-lg">{entry.flag}</span>
                    <span className="text-sm text-slate-500">{entry.country}</span>
                  </span>
                </td>
                <td className="px-4 py-3.5 text-right font-bold tabular-nums text-slate-700">{entry.topRating}</td>
                <td className="px-4 py-3.5 text-right font-bold tabular-nums text-slate-700">{entry.avgRating}</td>
                <td className="px-4 py-3.5 text-right">
                  <span className="flex items-center justify-end gap-1 text-sm font-bold text-slate-700">
                    <Users className="h-3.5 w-3.5 text-slate-400" />
                    {entry.students}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-right">
                  <span className="flex items-center justify-end gap-1 text-sm font-bold text-sun-600">
                    <Medal className="h-3.5 w-3.5" />
                    {entry.goldMedals}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="divide-y divide-slate-100 lg:hidden">
        {schoolLeaderboard.map((entry) => (
          <div key={entry.name} className="p-4">
            <div className="flex items-center gap-3">
              <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-xs font-extrabold ${
                entry.rank <= 3 ? 'bg-gradient-to-br from-sun-400 to-sun-600 text-white' : 'bg-slate-100 text-slate-500'
              }`}>
                {entry.rank}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-800">{entry.name}</p>
                <p className="text-xs text-slate-400">{entry.flag} {entry.country}</p>
              </div>
              <div className="text-right">
                <p className="font-display text-lg font-extrabold tabular-nums text-slate-900">{entry.topRating}</p>
                <p className="text-[10px] text-slate-400">Top rating</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-slate-50 p-2 text-center">
                <p className="text-xs font-bold text-slate-700">{entry.avgRating}</p>
                <p className="text-[10px] text-slate-400">Avg</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-2 text-center">
                <p className="text-xs font-bold text-slate-700">{entry.students}</p>
                <p className="text-[10px] text-slate-400">Students</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-2 text-center">
                <p className="text-xs font-bold text-sun-600">{entry.goldMedals}</p>
                <p className="text-[10px] text-slate-400">Golds</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
