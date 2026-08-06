import type { LucideIcon } from 'lucide-react';
import {
  Code2, Sigma, Atom, FlaskConical, BookOpen, Languages, GraduationCap,
  Brain, Shield, LineChart, Scale, Globe, MapPin, ClipboardList, Trophy,
} from 'lucide-react';
import { getRatingColorData } from '@/data/ratings';

/* ============ Types ============ */

export type TimePeriod = 'weekly' | 'monthly' | 'yearly';

export type LeaderboardScope =
  | 'global'
  | 'subject'
  | 'country'
  | 'school'
  | 'friends';

export type Country = {
  code: string;
  name: string;
  flag: string;
};

export type LeaderboardUser = {
  id: string;
  rank: number;
  username: string;
  avatar: string;
  countryCode: string;
  country: string;
  flag: string;
  school: string;
  rating: number;
  solved: number;
  accuracy: number;
  currentStreak: number;
  favoriteSubject: string;
  favoriteSubjectIcon: LucideIcon;
  ratingChange: number;
};

export type CountryLeaderboardEntry = {
  rank: number;
  code: string;
  name: string;
  flag: string;
  topRating: number;
  avgRating: number;
  competitors: number;
  goldMedals: number;
};

export type SchoolLeaderboardEntry = {
  rank: number;
  name: string;
  country: string;
  flag: string;
  topRating: number;
  avgRating: number;
  students: number;
  goldMedals: number;
};

export type LeaderboardMeta = {
  scope: LeaderboardScope;
  title: string;
  subtitle: string;
  totalUsers: number;
};

/* ============ Country Data ============ */

export const countries: Country[] = [
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'CN', name: 'China', flag: '🇨🇳' },
  { code: 'IN', name: 'India', flag: '🇮🇳' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  { code: 'KR', name: 'South Korea', flag: '🇰🇷' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'RU', name: 'Russia', flag: '🇷🇺' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬' },
  { code: 'EG', name: 'Egypt', flag: '🇪🇬' },
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬' },
];

/* ============ Subject Map for Fav ============ */

const subjectIconMap: Record<string, LucideIcon> = {
  Programming: Code2,
  Mathematics: Sigma,
  Physics: Atom,
  Chemistry: FlaskConical,
  Biology: BookOpen,
  English: Languages,
  IELTS: GraduationCap,
  CEFR: GraduationCap,
  SAT: ClipboardList,
  'AI & ML': Brain,
  'Cyber Security': Shield,
  'Data Science': LineChart,
  Economics: Scale,
  History: Globe,
  Geography: MapPin,
};

const schools = [
  'MIT', 'Stanford University', 'Tsinghua University', 'IIT Bombay', 'ETH Zurich',
  'University of Tokyo', 'KAIST', 'University of Cambridge', 'NUS Singapore',
  'University of Toronto', 'Moscow State University', 'University of Melbourne',
  'Nanyang Technological University', 'Cairo University', 'University of Lagos',
];

const usernames = [
  'alex_code', 'quantum_leap', 'math_wiz', 'neural_net', 'data_miner',
  'bond_maker', 'gene_dna', 'wordsmith', 'fluent_speaker', 'white_hat',
  'test_master', 'supply_demand', 'time_traveler', 'map_reader', 'polymath',
  'code_ninja', 'algo_beast', 'matrix_solver', 'lambda_calculus', 'big_o_master',
  'proof_by_beauty', 'topology_tank', 'fourier_fan', 'entropy_boy', 'string_theory',
  'regex_ranger', 'binary_bard', 'cache_queen', 'dp_wizard', 'graph_guru',
  'stat_sage', 'bayesian_badger', 'tensor_titan', 'loss_lord', 'gradient_king',
];

const favSubjects = [
  'Programming', 'Mathematics', 'Physics', 'Chemistry', 'Biology',
  'English', 'IELTS', 'SAT', 'AI & ML', 'Cyber Security',
  'Data Science', 'Economics', 'History', 'Geography',
];

/* ============ Generate Mock Leaderboard ============ */

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function generateUsers(count: number, period: TimePeriod): LeaderboardUser[] {
  const users: LeaderboardUser[] = [];
  for (let i = 0; i < count; i++) {
    const seed = i + 1;
    const rand = seededRandom(seed);
    const rating = Math.round(2900 - i * 35 - rand * 50);
    const country = countries[Math.floor(seededRandom(seed + 100) * countries.length)];
    const school = schools[Math.floor(seededRandom(seed + 200) * schools.length)];
    const favSubj = favSubjects[Math.floor(seededRandom(seed + 300) * favSubjects.length)];

    const periodMultiplier = period === 'weekly' ? 0.15 : period === 'monthly' ? 0.4 : 1;
    const solved = Math.round((3000 - i * 20) * periodMultiplier + rand * 50);
    const accuracy = Math.round(95 - i * 0.3 + rand * 5);
    const streak = Math.round(seededRandom(seed + 400) * 120);
    const ratingChange = Math.round((seededRandom(seed + 500) - 0.35) * (period === 'weekly' ? 80 : period === 'monthly' ? 150 : 400));

    users.push({
      id: `u-${i}`,
      rank: i + 1,
      username: usernames[i % usernames.length] + (i >= usernames.length ? `_${Math.floor(i / usernames.length) + 1}` : ''),
      avatar: '',
      countryCode: country.code,
      country: country.name,
      flag: country.flag,
      school,
      rating: Math.max(800, rating),
      solved: Math.max(10, solved),
      accuracy: Math.max(50, Math.min(99, accuracy)),
      currentStreak: streak,
      favoriteSubject: favSubj,
      favoriteSubjectIcon: subjectIconMap[favSubj] ?? Code2,
      ratingChange,
    });
  }
  return users;
}

export const globalLeaderboard: LeaderboardUser[] = generateUsers(100, 'yearly');

export function getLeaderboard(scope: LeaderboardScope, period: TimePeriod, subjectSlug?: string): LeaderboardUser[] {
  let users = [...globalLeaderboard];

  if (scope === 'subject' && subjectSlug) {
    const subjectName = favSubjects.find((s) => s.toLowerCase().includes(subjectSlug)) ?? 'Programming';
    users = users.filter((u) => u.favoriteSubject === subjectName);
    if (users.length < 20) {
      // Pad with users from other subjects
      const others = globalLeaderboard.filter((u) => u.favoriteSubject !== subjectName);
      users = [...users, ...others.slice(0, 30 - users.length)];
    }
  }

  if (scope === 'country') {
    // Top 2 per country
    const byCountry = new Map<string, LeaderboardUser[]>();
    users.forEach((u) => {
      const arr = byCountry.get(u.countryCode) ?? [];
      arr.push(u);
      byCountry.set(u.countryCode, arr);
    });
    users = [];
    byCountry.forEach((arr) => {
      users.push(...arr.slice(0, 2));
    });
  }

  if (scope === 'friends') {
    // Simulate: take a subset as "friends"
    users = users.slice(5, 25);
  }

  // Apply period adjustments
  if (period === 'weekly') {
    users = users.map((u) => ({
      ...u,
      rating: Math.max(800, u.rating - Math.round(seededRandom(u.rank) * 200)),
      solved: Math.round(u.solved * 0.12),
      ratingChange: Math.round((seededRandom(u.rank + 700) - 0.4) * 60),
    }));
  } else if (period === 'monthly') {
    users = users.map((u) => ({
      ...u,
      rating: Math.max(800, u.rating - Math.round(seededRandom(u.rank) * 100)),
      solved: Math.round(u.solved * 0.35),
      ratingChange: Math.round((seededRandom(u.rank + 800) - 0.38) * 120),
    }));
  }

  // Re-rank
  users.sort((a, b) => b.rating - a.rating);
  users.forEach((u, i) => { u.rank = i + 1; });

  return users;
}

/* ============ Country Leaderboard ============ */

export const countryLeaderboard: CountryLeaderboardEntry[] = [
  { rank: 1, code: 'CN', name: 'China', flag: '🇨🇳', topRating: 2950, avgRating: 1820, competitors: 18400, goldMedals: 48 },
  { rank: 2, code: 'US', name: 'United States', flag: '🇺🇸', topRating: 2890, avgRating: 1750, competitors: 15200, goldMedals: 36 },
  { rank: 3, code: 'IN', name: 'India', flag: '🇮🇳', topRating: 2780, avgRating: 1620, competitors: 22100, goldMedals: 28 },
  { rank: 4, code: 'JP', name: 'Japan', flag: '🇯🇵', topRating: 2720, avgRating: 1680, competitors: 8900, goldMedals: 22 },
  { rank: 5, code: 'KR', name: 'South Korea', flag: '🇰🇷', topRating: 2690, avgRating: 1640, competitors: 7600, goldMedals: 19 },
  { rank: 6, code: 'RU', name: 'Russia', flag: '🇷🇺', topRating: 2650, avgRating: 1590, competitors: 9200, goldMedals: 17 },
  { rank: 7, code: 'DE', name: 'Germany', flag: '🇩🇪', topRating: 2580, avgRating: 1550, competitors: 6800, goldMedals: 12 },
  { rank: 8, code: 'GB', name: 'United Kingdom', flag: '🇬🇧', topRating: 2540, avgRating: 1520, competitors: 5400, goldMedals: 10 },
  { rank: 9, code: 'SG', name: 'Singapore', flag: '🇸🇬', topRating: 2510, avgRating: 1580, competitors: 3200, goldMedals: 8 },
  { rank: 10, code: 'FR', name: 'France', flag: '🇫🇷', topRating: 2480, avgRating: 1490, competitors: 5100, goldMedals: 7 },
  { rank: 11, code: 'BR', name: 'Brazil', flag: '🇧🇷', topRating: 2420, avgRating: 1410, competitors: 6700, goldMedals: 5 },
  { rank: 12, code: 'CA', name: 'Canada', flag: '🇨🇦', topRating: 2390, avgRating: 1480, competitors: 4800, goldMedals: 5 },
  { rank: 13, code: 'EG', name: 'Egypt', flag: '🇪🇬', topRating: 2350, avgRating: 1380, competitors: 4200, goldMedals: 3 },
  { rank: 14, code: 'AU', name: 'Australia', flag: '🇦🇺', topRating: 2310, avgRating: 1450, competitors: 3600, goldMedals: 3 },
  { rank: 15, code: 'NG', name: 'Nigeria', flag: '🇳🇬', topRating: 2270, avgRating: 1340, competitors: 3900, goldMedals: 2 },
];

/* ============ School Leaderboard ============ */

export const schoolLeaderboard: SchoolLeaderboardEntry[] = [
  { rank: 1, name: 'MIT', country: 'United States', flag: '🇺🇸', topRating: 2890, avgRating: 1980, students: 420, goldMedals: 32 },
  { rank: 2, name: 'Tsinghua University', country: 'China', flag: '🇨🇳', topRating: 2840, avgRating: 1920, students: 380, goldMedals: 28 },
  { rank: 3, name: 'Stanford University', country: 'United States', flag: '🇺🇸', topRating: 2780, avgRating: 1880, students: 350, goldMedals: 24 },
  { rank: 4, name: 'IIT Bombay', country: 'India', flag: '🇮🇳', topRating: 2720, avgRating: 1820, students: 510, goldMedals: 20 },
  { rank: 5, name: 'University of Tokyo', country: 'Japan', flag: '🇯🇵', topRating: 2680, avgRating: 1780, students: 290, goldMedals: 18 },
  { rank: 6, name: 'ETH Zurich', country: 'Switzerland', flag: '🇨🇭', topRating: 2640, avgRating: 1750, students: 240, goldMedals: 14 },
  { rank: 7, name: 'KAIST', country: 'South Korea', flag: '🇰🇷', topRating: 2610, avgRating: 1730, students: 270, goldMedals: 12 },
  { rank: 8, name: 'University of Cambridge', country: 'United Kingdom', flag: '🇬🇧', topRating: 2570, avgRating: 1700, students: 220, goldMedals: 10 },
  { rank: 9, name: 'NUS Singapore', country: 'Singapore', flag: '🇸🇬', topRating: 2540, avgRating: 1720, students: 310, goldMedals: 9 },
  { rank: 10, name: 'Moscow State University', country: 'Russia', flag: '🇷🇺', topRating: 2500, avgRating: 1670, students: 330, goldMedals: 8 },
  { rank: 11, name: 'University of Toronto', country: 'Canada', flag: '🇨🇦', topRating: 2470, avgRating: 1650, students: 280, goldMedals: 6 },
  { rank: 12, name: 'Nanyang Technological University', country: 'Singapore', flag: '🇸🇬', topRating: 2430, avgRating: 1630, students: 260, goldMedals: 5 },
];

/* ============ Scope Metadata ============ */

export const scopeMeta: Record<LeaderboardScope, { label: string; icon: LucideIcon; description: string }> = {
  global: { label: 'Global', icon: Globe, description: 'All competitors worldwide' },
  subject: { label: 'Subject', icon: Sigma, description: 'Filtered by subject area' },
  country: { label: 'Country', icon: MapPin, description: 'Ranked by nation' },
  school: { label: 'School', icon: GraduationCap, description: 'Ranked by institution' },
  friends: { label: 'Friends', icon: Trophy, description: 'Your connected friends' },
};

export const periodMeta: Record<TimePeriod, { label: string; icon: LucideIcon }> = {
  weekly: { label: 'Weekly', icon: Trophy },
  monthly: { label: 'Monthly', icon: Globe },
  yearly: { label: 'Yearly', icon: MapPin },
};

/* ============ Helper ============ */

export function getRankBadge(rank: number): { color: string; icon: typeof Trophy; label: string } {
  if (rank === 1) return { color: 'from-sun-400 to-sun-600', icon: Trophy, label: 'Gold' };
  if (rank === 2) return { color: 'from-slate-300 to-slate-500', icon: Trophy, label: 'Silver' };
  if (rank === 3) return { color: 'from-orange-400 to-orange-700', icon: Trophy, label: 'Bronze' };
  return { color: 'from-slate-100 to-slate-200', icon: Trophy, label: '' };
}

export function getRatingColorHex(rating: number): string {
  return getRatingColorData(rating).hex;
}
