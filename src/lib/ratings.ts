import { supabase } from '@/lib/supabase';

type RpcRow = Record<string, unknown>;

export type RatingLeaderboardEntry = {
  rank: number;
  userId: string | null;
  displayName: string;
  subject: string | null;
  rating: number;
  contestCount: number;
};

export type MyContestStats = {
  contestsEntered: number;
  acceptedSubmissions: number;
  problemsSolved: number;
  currentRating: number | null;
  peakRating: number | null;
  globalRank: number | null;
};

export type MyRatingHistoryEntry = {
  id: string;
  contestId: string | null;
  contestName: string;
  subject: string | null;
  completedAt: string | null;
  rank: number | null;
  oldRating: number | null;
  newRating: number;
  delta: number | null;
};

function record(value: unknown): RpcRow {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as RpcRow
    : {};
}

function rows(value: unknown): RpcRow[] {
  if (Array.isArray(value)) return value.map(record);
  return value == null ? [] : [record(value)];
}

function firstDefined(row: RpcRow, keys: string[]): unknown {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null) return row[key];
  }
  return undefined;
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function nullableNumber(value: unknown): number | null {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function number(value: unknown, fallback = 0): number {
  return nullableNumber(value) ?? fallback;
}

/**
 * Reads only server-calculated rating rows. No client-side scores, users, or
 * period adjustments are generated here.
 */
export async function fetchRatingLeaderboard(subject?: string): Promise<RatingLeaderboardEntry[]> {
  const { data, error } = await supabase.rpc(
    'get_rating_leaderboard',
    subject ? { p_subject: subject } : {},
  );
  if (error) throw new Error(error.message);

  return rows(data).map((row, index) => ({
    rank: number(firstDefined(row, ['rank', 'position']), index + 1),
    userId: text(firstDefined(row, ['user_id', 'userId', 'profile_id', 'id'])) || null,
    displayName: text(firstDefined(row, ['display_name', 'full_name', 'username', 'name']), 'Unnamed competitor'),
    subject: text(firstDefined(row, ['subject', 'subject_name', 'subject_slug'])) || null,
    rating: number(firstDefined(row, ['rating', 'current_rating'])),
    contestCount: number(firstDefined(row, ['contest_count', 'contests_entered', 'contests'])),
  }));
}

/** Reads the authenticated user's server-calculated contest totals. */
export async function fetchMyContestStats(): Promise<MyContestStats> {
  const { data, error } = await supabase.rpc('get_my_contest_stats');
  if (error) throw new Error(error.message);

  const row = rows(data)[0] ?? {};
  return {
    contestsEntered: number(firstDefined(row, ['contests_entered', 'contest_count', 'contests'])),
    acceptedSubmissions: number(firstDefined(row, ['accepted_submissions', 'accepted_count'])),
    problemsSolved: number(firstDefined(row, ['problems_solved', 'solved_count', 'solved'])),
    currentRating: nullableNumber(firstDefined(row, ['current_rating', 'rating'])),
    peakRating: nullableNumber(firstDefined(row, ['peak_rating', 'highest_rating'])),
    globalRank: nullableNumber(firstDefined(row, ['global_rank', 'rank'])),
  };
}

/** Reads immutable rated-contest results for the authenticated user. */
export async function fetchMyRatingHistory(): Promise<MyRatingHistoryEntry[]> {
  const { data, error } = await supabase.rpc('get_my_rating_history');
  if (error) throw new Error(error.message);

  return rows(data).map((row, index) => {
    const oldRating = nullableNumber(firstDefined(row, ['old_rating', 'rating_before']));
    const newRating = number(firstDefined(row, ['new_rating', 'rating_after', 'rating']));
    const reportedDelta = nullableNumber(firstDefined(row, ['delta', 'rating_delta']));

    return {
      id: text(firstDefined(row, ['id', 'result_id', 'contest_result_id']), `rating-history-${index}`),
      contestId: text(firstDefined(row, ['contest_id', 'contestId'])) || null,
      contestName: text(firstDefined(row, ['contest_name', 'title', 'contest_title']), 'Rated contest'),
      subject: text(firstDefined(row, ['subject', 'subject_name', 'subject_slug'])) || null,
      completedAt: text(firstDefined(row, ['completed_at', 'rated_at', 'ended_at', 'created_at'])) || null,
      rank: nullableNumber(firstDefined(row, ['rank', 'position'])),
      oldRating,
      newRating,
      delta: reportedDelta ?? (oldRating == null ? null : newRating - oldRating),
    };
  });
}
