import { Trophy } from 'lucide-react';
import { getRatingColorData } from '@/data/ratings';

/** Presentation helpers only. Leaderboard rows come from `src/lib/ratings.ts`. */
export function getRankBadge(rank: number): { color: string; icon: typeof Trophy; label: string } {
  if (rank === 1) return { color: 'from-sun-400 to-sun-600', icon: Trophy, label: 'Gold' };
  if (rank === 2) return { color: 'from-slate-300 to-slate-500', icon: Trophy, label: 'Silver' };
  if (rank === 3) return { color: 'from-orange-400 to-orange-700', icon: Trophy, label: 'Bronze' };
  return { color: 'from-slate-100 to-slate-200', icon: Trophy, label: '' };
}

export function getRatingColorHex(rating: number): string {
  return getRatingColorData(rating).hex;
}
