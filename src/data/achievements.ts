import type { LucideIcon } from 'lucide-react';
import {
  Trophy, Target, Star, Flame, Crown, Award, Zap, Medal,
  Calendar, CheckCircle2, TrendingUp, Code2, Brain, Shield,
  Snowflake, Heart, Sun, Ghost, Gift, Sparkles, Diamond,
} from 'lucide-react';

/* ============ Badge Tiers ============ */

export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'diamond' | 'legendary';

export type BadgeTierMeta = {
  tier: BadgeTier;
  name: string;
  icon: LucideIcon;
  gradient: string;
  ring: string;
  text: string;
  bg: string;
  glow: string;
  hex: string;
};

export const badgeTiers: Record<BadgeTier, BadgeTierMeta> = {
  bronze: {
    tier: 'bronze', name: 'Bronze', icon: Medal,
    gradient: 'from-orange-400 to-orange-700',
    ring: 'ring-orange-400/30', text: 'text-orange-600', bg: 'bg-orange-500/10',
    glow: 'shadow-[0_0_16px_rgba(251,146,60,0.3)]',
    hex: '#d97706',
  },
  silver: {
    tier: 'silver', name: 'Silver', icon: Medal,
    gradient: 'from-slate-300 to-slate-500',
    ring: 'ring-slate-300/40', text: 'text-slate-600', bg: 'bg-slate-400/10',
    glow: 'shadow-[0_0_16px_rgba(148,163,184,0.3)]',
    hex: '#94a3b8',
  },
  gold: {
    tier: 'gold', name: 'Gold', icon: Medal,
    gradient: 'from-sun-300 to-sun-600',
    ring: 'ring-sun-400/30', text: 'text-sun-600', bg: 'bg-sun-500/10',
    glow: 'shadow-[0_0_20px_rgba(245,158,11,0.35)]',
    hex: '#f59e0b',
  },
  diamond: {
    tier: 'diamond', name: 'Diamond', icon: Diamond,
    gradient: 'from-cyan-300 to-electric-600',
    ring: 'ring-cyan-400/30', text: 'text-cyan-600', bg: 'bg-cyan-500/10',
    glow: 'shadow-[0_0_24px_rgba(6,182,212,0.4)]',
    hex: '#0891b2',
  },
  legendary: {
    tier: 'legendary', name: 'Legendary', icon: Crown,
    gradient: 'from-purple-400 via-pink-400 to-orange-500',
    ring: 'ring-purple-400/40', text: 'text-purple-600', bg: 'bg-purple-500/10',
    glow: 'shadow-[0_0_28px_rgba(168,85,247,0.45)]',
    hex: '#a855f7',
  },
};

export const badgeTierOrder: BadgeTier[] = ['bronze', 'silver', 'gold', 'diamond', 'legendary'];

/* ============ Achievement Types ============ */

export type AchievementCategory =
  | 'contests'
  | 'problems'
  | 'rating'
  | 'streak'
  | 'winning'
  | 'special';

export type Achievement = {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  category: AchievementCategory;
  tier: BadgeTier;
  unlocked: boolean;
  progress: number;
  maxProgress: number;
  date?: string;
};

/* ============ Achievement Definitions ============ */

export const achievements: Achievement[] = [
  // Contest achievements
  {
    id: 'first-contest',
    name: 'First Contest',
    description: 'Participate in your first contest',
    icon: Target,
    category: 'contests',
    tier: 'bronze',
    unlocked: true,
    progress: 1,
    maxProgress: 1,
    date: '2026-01-15',
  },
  {
    id: 'contest-veteran',
    name: 'Contest Veteran',
    description: 'Participate in 50 contests',
    icon: Calendar,
    category: 'contests',
    tier: 'silver',
    unlocked: true,
    progress: 52,
    maxProgress: 50,
    date: '2026-03-20',
  },
  {
    id: 'contest-master',
    name: 'Contest Master',
    description: 'Participate in 200 contests',
    icon: Calendar,
    category: 'contests',
    tier: 'gold',
    unlocked: false,
    progress: 52,
    maxProgress: 200,
  },
  // Problem achievements
  {
    id: '100-problems',
    name: 'Century',
    description: 'Solve 100 problems',
    icon: CheckCircle2,
    category: 'problems',
    tier: 'silver',
    unlocked: true,
    progress: 142,
    maxProgress: 100,
    date: '2026-02-10',
  },
  {
    id: '500-problems',
    name: 'Problem Solver',
    description: 'Solve 500 problems',
    icon: CheckCircle2,
    category: 'problems',
    tier: 'gold',
    unlocked: false,
    progress: 142,
    maxProgress: 500,
  },
  {
    id: '1000-problems',
    name: 'Grand Solver',
    description: 'Solve 1000 problems',
    icon: CheckCircle2,
    category: 'problems',
    tier: 'diamond',
    unlocked: false,
    progress: 142,
    maxProgress: 1000,
  },
  // Rating achievements
  {
    id: '1000-rating',
    name: 'Rising Star',
    description: 'Reach 1000 rating',
    icon: TrendingUp,
    category: 'rating',
    tier: 'bronze',
    unlocked: true,
    progress: 1850,
    maxProgress: 1000,
    date: '2026-01-20',
  },
  {
    id: '2000-rating',
    name: 'Expert Coder',
    description: 'Reach 2000 rating',
    icon: TrendingUp,
    category: 'rating',
    tier: 'gold',
    unlocked: false,
    progress: 1850,
    maxProgress: 2000,
  },
  {
    id: '2500-rating',
    name: 'Grandmaster',
    description: 'Reach 2500 rating',
    icon: Crown,
    category: 'rating',
    tier: 'diamond',
    unlocked: false,
    progress: 1850,
    maxProgress: 2500,
  },
  {
    id: 'legend',
    name: 'Legend',
    description: 'Reach 3000 rating',
    icon: Sparkles,
    category: 'rating',
    tier: 'legendary',
    unlocked: false,
    progress: 1850,
    maxProgress: 3000,
  },
  // Streak achievements
  {
    id: '7-day-streak',
    name: 'On Fire',
    description: 'Maintain a 7-day streak',
    icon: Flame,
    category: 'streak',
    tier: 'bronze',
    unlocked: true,
    progress: 45,
    maxProgress: 7,
    date: '2026-02-01',
  },
  {
    id: '30-day-streak',
    name: 'Unstoppable',
    description: 'Maintain a 30-day streak',
    icon: Flame,
    category: 'streak',
    tier: 'silver',
    unlocked: true,
    progress: 45,
    maxProgress: 30,
    date: '2026-02-24',
  },
  {
    id: '100-day-streak',
    name: 'Relentless',
    description: 'Maintain a 100-day streak',
    icon: Flame,
    category: 'streak',
    tier: 'gold',
    unlocked: false,
    progress: 45,
    maxProgress: 100,
  },
  // Winning achievements
  {
    id: 'perfect-score',
    name: 'Perfect Score',
    description: 'Get a perfect score in a contest',
    icon: Star,
    category: 'winning',
    tier: 'silver',
    unlocked: true,
    progress: 1,
    maxProgress: 1,
    date: '2026-03-05',
  },
  {
    id: 'weekly-winner',
    name: 'Weekly Winner',
    description: 'Win a weekly contest',
    icon: Trophy,
    category: 'winning',
    tier: 'gold',
    unlocked: true,
    progress: 1,
    maxProgress: 1,
    date: '2026-04-12',
  },
  {
    id: 'monthly-winner',
    name: 'Monthly Champion',
    description: 'Win a monthly contest',
    icon: Trophy,
    category: 'winning',
    tier: 'diamond',
    unlocked: false,
    progress: 0,
    maxProgress: 1,
  },
  {
    id: 'championship',
    name: 'Championship Winner',
    description: 'Win a championship tournament',
    icon: Crown,
    category: 'winning',
    tier: 'legendary',
    unlocked: false,
    progress: 0,
    maxProgress: 1,
  },
  // Special achievements
  {
    id: 'polymath',
    name: 'Polymath',
    description: 'Reach 1500+ in 5 different subjects',
    icon: Brain,
    category: 'special',
    tier: 'diamond',
    unlocked: true,
    progress: 6,
    maxProgress: 5,
    date: '2026-04-01',
  },
  {
    id: 'security-expert',
    name: 'Security Expert',
    description: 'Reach 2000+ in Cyber Security',
    icon: Shield,
    category: 'special',
    tier: 'gold',
    unlocked: false,
    progress: 1600,
    maxProgress: 2000,
  },
];

/* ============ Seasonal Event Badges ============ */

export type SeasonalBadge = {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  season: string;
  gradient: string;
  ring: string;
  glow: string;
  earned: boolean;
  date?: string;
};

export const seasonalBadges: SeasonalBadge[] = [
  {
    id: 'winter-2026',
    name: 'Winter Champion',
    description: 'Top 10 in any Winter 2026 contest',
    icon: Snowflake,
    season: 'Winter 2026',
    gradient: 'from-cyan-300 to-electric-500',
    ring: 'ring-cyan-400/40',
    glow: 'shadow-[0_0_20px_rgba(6,182,212,0.4)]',
    earned: true,
    date: '2026-01-22',
  },
  {
    id: 'valentine-2026',
    name: 'Code Heart',
    description: 'Participate in the Valentine Day Special',
    icon: Heart,
    season: "Valentine's Day 2026",
    gradient: 'from-rose-400 to-pink-600',
    ring: 'ring-rose-400/40',
    glow: 'shadow-[0_0_20px_rgba(244,63,94,0.4)]',
    earned: true,
    date: '2026-02-14',
  },
  {
    id: 'spring-2026',
    name: 'Spring Sprint',
    description: 'Complete 50 problems during Spring 2026',
    icon: Sun,
    season: 'Spring 2026',
    gradient: 'from-success-400 to-sun-500',
    ring: 'ring-success-400/40',
    glow: 'shadow-[0_0_20px_rgba(16,185,129,0.4)]',
    earned: true,
    date: '2026-03-30',
  },
  {
    id: 'halloween-2025',
    name: 'Spooky Solver',
    description: 'Participate in Halloween CTF 2025',
    icon: Ghost,
    season: 'Halloween 2025',
    gradient: 'from-purple-500 to-slate-800',
    ring: 'ring-purple-500/40',
    glow: 'shadow-[0_0_20px_rgba(168,85,247,0.4)]',
    earned: false,
  },
  {
    id: 'holiday-2025',
    name: 'Holiday Hero',
    description: 'Top 50 in any Holiday 2025 contest',
    icon: Gift,
    season: 'Holiday 2025',
    gradient: 'from-error-400 to-indigo-600',
    ring: 'ring-error-400/40',
    glow: 'shadow-[0_0_20px_rgba(220,38,38,0.4)]',
    earned: false,
  },
  {
    id: 'summer-2026',
    name: 'Summer Sprint',
    description: 'Participate in Summer 2026 Championship',
    icon: Sun,
    season: 'Summer 2026',
    gradient: 'from-sun-400 to-orange-600',
    ring: 'ring-sun-400/40',
    glow: 'shadow-[0_0_20px_rgba(245,158,11,0.4)]',
    earned: false,
  },
];

/* ============ Helper Functions ============ */

export const achievementCategoryMeta: Record<AchievementCategory, { label: string; icon: LucideIcon }> = {
  contests: { label: 'Contests', icon: Calendar },
  problems: { label: 'Problems', icon: CheckCircle2 },
  rating: { label: 'Rating', icon: TrendingUp },
  streak: { label: 'Streaks', icon: Flame },
  winning: { label: 'Winning', icon: Trophy },
  special: { label: 'Special', icon: Sparkles },
};

export function getUnlockedAchievements(): Achievement[] {
  return achievements.filter((a) => a.unlocked);
}

export function getLockedAchievements(): Achievement[] {
  return achievements.filter((a) => !a.unlocked);
}

export function getAchievementStats() {
  const unlocked = achievements.filter((a) => a.unlocked).length;
  const total = achievements.length;
  const seasonalEarned = seasonalBadges.filter((b) => b.earned).length;
  const seasonalTotal = seasonalBadges.length;
  return {
    unlocked,
    total,
    progress: Math.round((unlocked / total) * 100),
    seasonalEarned,
    seasonalTotal,
  };
}
