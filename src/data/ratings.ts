import type { LucideIcon } from 'lucide-react';
import {
  Code2, Sigma, Atom, FlaskConical, BookOpen, Languages, GraduationCap,
  Brain, Shield, LineChart, Scale, Globe, MapPin, ClipboardList,
} from 'lucide-react';

/* ============ Rating System Types ============ */

export type RatingColor = 'gray' | 'green' | 'cyan' | 'blue' | 'purple' | 'orange' | 'red';

export type Division = {
  id: string;
  name: string;
  minRating: number;
  maxRating: number;
  color: string;
  description: string;
};

export type RatingHistoryEntry = {
  contestName: string;
  contestSlug: string;
  date: string;
  oldRating: number;
  newRating: number;
  rank: number;
  delta: number;
};

export type SubjectRating = {
  subjectSlug: string;
  subjectName: string;
  icon: LucideIcon;
  color: string;
  accent: string;
  currentRating: number;
  peakRating: number;
  highestRank: number;
  contestCount: number;
  winRate: number;
  division: Division;
  history: RatingHistoryEntry[];
};

/* ============ Rating Color System ============ */

export const ratingColors: Record<RatingColor, {
  name: string;
  hex: string;
  text: string;
  bg: string;
  ring: string;
  gradient: string;
}> = {
  gray: {
    name: 'Novice', hex: '#808080',
    text: 'text-slate-500', bg: 'bg-slate-100', ring: 'ring-slate-300',
    gradient: 'from-slate-400 to-slate-600',
  },
  green: {
    name: 'Pupil', hex: '#008000',
    text: 'text-success-600', bg: 'bg-success-500/10', ring: 'ring-success-500/30',
    gradient: 'from-success-400 to-success-600',
  },
  cyan: {
    name: 'Specialist', hex: '#03a89e',
    text: 'text-cyan-600', bg: 'bg-cyan-500/10', ring: 'ring-cyan-500/30',
    gradient: 'from-cyan-400 to-cyan-600',
  },
  blue: {
    name: 'Expert', hex: '#0000ff',
    text: 'text-electric-600', bg: 'bg-electric-500/10', ring: 'ring-electric-500/30',
    gradient: 'from-electric-400 to-electric-600',
  },
  purple: {
    name: 'Master', hex: '#9b27b0',
    text: 'text-purple-600', bg: 'bg-purple-500/10', ring: 'ring-purple-500/30',
    gradient: 'from-purple-400 to-purple-600',
  },
  orange: {
    name: 'Grandmaster', hex: '#ff8b00',
    text: 'text-sun-600', bg: 'bg-sun-500/10', ring: 'ring-sun-500/30',
    gradient: 'from-sun-400 to-sun-600',
  },
  red: {
    name: 'Legend', hex: '#dc0a0a',
    text: 'text-error-600', bg: 'bg-error-500/10', ring: 'ring-error-500/30',
    gradient: 'from-error-400 to-error-600',
  },
};

export function getRatingColor(rating: number): RatingColor {
  if (rating < 1200) return 'gray';
  if (rating < 1400) return 'green';
  if (rating < 1600) return 'cyan';
  if (rating < 1900) return 'blue';
  if (rating < 2200) return 'purple';
  if (rating < 2500) return 'orange';
  return 'red';
}

export function getRatingColorData(rating: number) {
  return ratingColors[getRatingColor(rating)];
}

/* ============ Division Definitions ============ */

export const programmingDivisions: Division[] = [
  { id: 'div4', name: 'Div 4', minRating: 0, maxRating: 1199, color: 'text-slate-500', description: 'Beginner-friendly contests for new programmers' },
  { id: 'div3', name: 'Div 3', minRating: 1200, maxRating: 1599, color: 'text-success-600', description: 'For developing competitive programmers' },
  { id: 'div2', name: 'Div 2', minRating: 1600, maxRating: 2099, color: 'text-electric-600', description: 'Intermediate-level algorithmic challenges' },
  { id: 'div1', name: 'Div 1', minRating: 2100, maxRating: 9999, color: 'text-sun-600', description: 'Top-tier contests for elite competitors' },
];

export const englishDivisions: Division[] = [
  { id: 'a1', name: 'A1', minRating: 0, maxRating: 1199, color: 'text-slate-500', description: 'Beginner — basic phrases and everyday expressions' },
  { id: 'a2', name: 'A2', minRating: 1200, maxRating: 1399, color: 'text-success-600', description: 'Elementary — simple communication on familiar topics' },
  { id: 'b1', name: 'B1', minRating: 1400, maxRating: 1699, color: 'text-cyan-600', description: 'Intermediate — handle most travel and daily situations' },
  { id: 'b2', name: 'B2', minRating: 1700, maxRating: 1999, color: 'text-electric-600', description: 'Upper-intermediate — fluent, spontaneous communication' },
  { id: 'c1', name: 'C1', minRating: 2000, maxRating: 2399, color: 'text-purple-600', description: 'Advanced — flexible, effective language use' },
  { id: 'c2', name: 'C2', minRating: 2400, maxRating: 9999, color: 'text-error-600', description: 'Proficiency — effortless, near-native mastery' },
];

export const mathDivisions: Division[] = [
  { id: 'beginner', name: 'Beginner', minRating: 0, maxRating: 1199, color: 'text-slate-500', description: 'Arithmetic, basic algebra, and geometry' },
  { id: 'intermediate', name: 'Intermediate', minRating: 1200, maxRating: 1699, color: 'text-cyan-600', description: 'Advanced algebra, trigonometry, and pre-calculus' },
  { id: 'advanced', name: 'Advanced', minRating: 1700, maxRating: 2199, color: 'text-electric-600', description: 'Calculus, linear algebra, and proofs' },
  { id: 'olympiad', name: 'Olympiad', minRating: 2200, maxRating: 9999, color: 'text-sun-600', description: 'Competition math — number theory, combinatorics, olympiad proofs' },
];

export type DivisionSet = {
  subjectSlug: string;
  label: string;
  divisions: Division[];
};

export const allDivisionSets: DivisionSet[] = [
  { subjectSlug: 'programming', label: 'Programming Divisions', divisions: programmingDivisions },
  { subjectSlug: 'english', label: 'English CEFR Levels', divisions: englishDivisions },
  { subjectSlug: 'ielts', label: 'IELTS Levels', divisions: englishDivisions },
  { subjectSlug: 'cefr', label: 'CEFR Levels', divisions: englishDivisions },
  { subjectSlug: 'mathematics', label: 'Math Divisions', divisions: mathDivisions },
];

export function getDivisionsForSubject(slug: string): Division[] {
  if (slug === 'programming') return programmingDivisions;
  if (slug === 'english' || slug === 'ielts' || slug === 'cefr') return englishDivisions;
  if (slug === 'mathematics') return mathDivisions;
  return programmingDivisions;
}

export function getDivisionForRating(subjectSlug: string, rating: number): Division {
  const divisions = getDivisionsForSubject(subjectSlug);
  return divisions.find((d) => rating >= d.minRating && rating <= d.maxRating) ?? divisions[0];
}

/* ============ Subject Metadata for Ratings ============ */

export type RatingSubjectMeta = {
  slug: string;
  name: string;
  icon: LucideIcon;
  color: string;
  accent: string;
};

export const ratingSubjects: RatingSubjectMeta[] = [
  { slug: 'programming', name: 'Programming', icon: Code2, color: 'from-indigo-500 to-indigo-700', accent: '#6366f1' },
  { slug: 'mathematics', name: 'Mathematics', icon: Sigma, color: 'from-electric-500 to-electric-700', accent: '#3b82f6' },
  { slug: 'physics', name: 'Physics', icon: Atom, color: 'from-indigo-600 to-electric-800', accent: '#4f46e5' },
  { slug: 'chemistry', name: 'Chemistry', icon: FlaskConical, color: 'from-electric-400 to-indigo-500', accent: '#60a5fa' },
  { slug: 'biology', name: 'Biology', icon: BookOpen, color: 'from-success-500 to-electric-600', accent: '#10b981' },
  { slug: 'english', name: 'English', icon: Languages, color: 'from-electric-400 to-electric-600', accent: '#60a5fa' },
  { slug: 'ielts', name: 'IELTS', icon: GraduationCap, color: 'from-indigo-500 to-electric-600', accent: '#6366f1' },
  { slug: 'cefr', name: 'CEFR', icon: GraduationCap, color: 'from-electric-600 to-indigo-700', accent: '#2563eb' },
  { slug: 'sat', name: 'SAT', icon: ClipboardList, color: 'from-slate-600 to-slate-800', accent: '#475569' },
  { slug: 'ai-ml', name: 'AI & ML', icon: Brain, color: 'from-electric-600 to-indigo-700', accent: '#2563eb' },
  { slug: 'cyber-security', name: 'Cyber Security', icon: Shield, color: 'from-slate-700 to-indigo-800', accent: '#475569' },
  { slug: 'economics', name: 'Economics', icon: Scale, color: 'from-sun-500 to-sun-600', accent: '#f59e0b' },
  { slug: 'history', name: 'History', icon: Globe, color: 'from-slate-500 to-slate-700', accent: '#64748b' },
  { slug: 'geography', name: 'Geography', icon: MapPin, color: 'from-success-500 to-electric-500', accent: '#10b981' },
  { slug: 'data-science', name: 'Data Science', icon: LineChart, color: 'from-electric-500 to-electric-700', accent: '#3b82f6' },
];

export function getRatingSubject(slug: string): RatingSubjectMeta | undefined {
  return ratingSubjects.find((s) => s.slug === slug);
}

/* ============ Mock Rating Data Generator ============ */

function genHistory(
  startRating: number,
  currentRating: number,
  count: number,
  contestNames: string[],
): RatingHistoryEntry[] {
  const entries: RatingHistoryEntry[] = [];
  let rating = startRating;
  const step = (currentRating - startRating) / (count - 1);
  for (let i = 0; i < count; i++) {
    const target = startRating + Math.round(step * i);
    const noise = Math.round((Math.random() - 0.4) * 80);
    const newR = Math.max(0, target + noise);
    const delta = newR - rating;
    entries.push({
      contestName: contestNames[i % contestNames.length],
      contestSlug: `contest-${i}`,
      date: new Date(Date.now() - (count - i) * 7 * 24 * 60 * 60 * 1000).toISOString(),
      oldRating: rating,
      newRating: newR,
      rank: Math.floor(Math.random() * 500) + 1,
      delta,
    });
    rating = newR;
  }
  if (entries.length > 0) {
    const last = entries[entries.length - 1];
    last.newRating = currentRating;
    last.delta = last.newRating - last.oldRating;
  }
  return entries;
}

const contestNamePool: Record<string, string[]> = {
  programming: ['Spring Code Sprint', 'Weekly Algo Warmup', 'Graph Algorithms Cup', 'DP Championship', 'Data Structures Round'],
  mathematics: ['Calculus Showdown', 'Algebra Open', 'Olympiad Qualifier', 'Geometry Cup', 'Probability Round'],
  physics: ['Mechanics Cup', 'Electromagnetism Open', 'Quantum Challenge', 'Thermodynamics Round', 'Optics Sprint'],
  chemistry: ['Organic Speed Run', 'Inorganic Open', 'Stoichiometry Cup', 'Acids & Bases Round', 'Reaction Mechanisms'],
  biology: ['Genetics Cup', 'Cell Biology Open', 'Ecology Challenge', 'Physiology Round', 'Evolution Sprint'],
  english: ['Grammar Cup', 'Vocabulary Open', 'Reading Comprehension', 'Writing Challenge', 'Speaking Round'],
  ielts: ['IELTS Speaking Practice', 'IELTS Writing Task', 'IELTS Reading Sprint', 'IELTS Listening Round', 'IELTS Mock Test'],
  cefr: ['CEFR B1 Challenge', 'CEFR B2 Open', 'CEFR C1 Cup', 'CEFR A2 Round', 'CEFR Mock Exam'],
  sat: ['SAT Math Blitz', 'SAT Reading Open', 'SAT Writing Cup', 'SAT Practice Test', 'SAT Sprint'],
  'ai-ml': ['Neural Networks Challenge', 'NLP Cup', 'Computer Vision Open', 'Transformers Round', 'ML Sprint'],
  'cyber-security': ['Web Security CTF', 'Crypto Challenge', 'Reverse Engineering Cup', 'Network Forensics', 'CTF Sprint'],
  economics: ['Game Theory Tournament', 'Microeconomics Open', 'Macroeconomics Cup', 'Trade Round', 'Econometrics Challenge'],
  history: ['World Wars Cup', 'Ancient Civilizations Open', 'Revolution Challenge', 'Modern Era Round', 'Historiography Sprint'],
  geography: ['World Capitals Cup', 'Physical Geography Open', 'Climate Challenge', 'Map Reading Round', 'Demographics Sprint'],
  'data-science': ['SQL Query Olympiad', 'Data Viz Cup', 'Statistics Open', 'ML Pipeline Round', 'Pandas Sprint'],
};

export const subjectRatings: SubjectRating[] = [
  {
    subjectSlug: 'programming', subjectName: 'Programming',
    icon: Code2, color: 'from-indigo-500 to-indigo-700', accent: '#6366f1',
    currentRating: 1842, peakRating: 1920, highestRank: 42,
    contestCount: 38, winRate: 64,
    division: getDivisionForRating('programming', 1842),
    history: genHistory(800, 1842, 12, contestNamePool.programming),
  },
  {
    subjectSlug: 'mathematics', subjectName: 'Mathematics',
    icon: Sigma, color: 'from-electric-500 to-electric-700', accent: '#3b82f6',
    currentRating: 1675, peakRating: 1710, highestRank: 78,
    contestCount: 24, winRate: 58,
    division: getDivisionForRating('mathematics', 1675),
    history: genHistory(900, 1675, 10, contestNamePool.mathematics),
  },
  {
    subjectSlug: 'physics', subjectName: 'Physics',
    icon: Atom, color: 'from-indigo-600 to-electric-800', accent: '#4f46e5',
    currentRating: 1456, peakRating: 1502, highestRank: 120,
    contestCount: 16, winRate: 52,
    division: getDivisionForRating('physics', 1456),
    history: genHistory(800, 1456, 8, contestNamePool.physics),
  },
  {
    subjectSlug: 'chemistry', subjectName: 'Chemistry',
    icon: FlaskConical, color: 'from-electric-400 to-indigo-500', accent: '#60a5fa',
    currentRating: 1320, peakRating: 1380, highestRank: 185,
    contestCount: 12, winRate: 48,
    division: getDivisionForRating('chemistry', 1320),
    history: genHistory(900, 1320, 7, contestNamePool.chemistry),
  },
  {
    subjectSlug: 'biology', subjectName: 'Biology',
    icon: BookOpen, color: 'from-success-500 to-electric-600', accent: '#10b981',
    currentRating: 1180, peakRating: 1220, highestRank: 240,
    contestCount: 9, winRate: 44,
    division: getDivisionForRating('biology', 1180),
    history: genHistory(800, 1180, 6, contestNamePool.biology),
  },
  {
    subjectSlug: 'english', subjectName: 'English',
    icon: Languages, color: 'from-electric-400 to-electric-600', accent: '#60a5fa',
    currentRating: 1850, peakRating: 1890, highestRank: 35,
    contestCount: 31, winRate: 67,
    division: getDivisionForRating('english', 1850),
    history: genHistory(1000, 1850, 11, contestNamePool.english),
  },
  {
    subjectSlug: 'ielts', subjectName: 'IELTS',
    icon: GraduationCap, color: 'from-indigo-500 to-electric-600', accent: '#6366f1',
    currentRating: 1620, peakRating: 1650, highestRank: 90,
    contestCount: 18, winRate: 55,
    division: getDivisionForRating('ielts', 1620),
    history: genHistory(1000, 1620, 8, contestNamePool.ielts),
  },
  {
    subjectSlug: 'sat', subjectName: 'SAT',
    icon: ClipboardList, color: 'from-slate-600 to-slate-800', accent: '#475569',
    currentRating: 1540, peakRating: 1580, highestRank: 110,
    contestCount: 14, winRate: 51,
    division: getDivisionForRating('sat', 1540),
    history: genHistory(1000, 1540, 7, contestNamePool.sat),
  },
  {
    subjectSlug: 'ai-ml', subjectName: 'AI & ML',
    icon: Brain, color: 'from-electric-600 to-indigo-700', accent: '#2563eb',
    currentRating: 1750, peakRating: 1800, highestRank: 60,
    contestCount: 20, winRate: 60,
    division: getDivisionForRating('ai-ml', 1750),
    history: genHistory(900, 1750, 9, contestNamePool['ai-ml']),
  },
  {
    subjectSlug: 'cyber-security', subjectName: 'Cyber Security',
    icon: Shield, color: 'from-slate-700 to-indigo-800', accent: '#475569',
    currentRating: 1600, peakRating: 1640, highestRank: 85,
    contestCount: 15, winRate: 53,
    division: getDivisionForRating('cyber-security', 1600),
    history: genHistory(900, 1600, 8, contestNamePool['cyber-security']),
  },
  {
    subjectSlug: 'economics', subjectName: 'Economics',
    icon: Scale, color: 'from-sun-500 to-sun-600', accent: '#f59e0b',
    currentRating: 1390, peakRating: 1420, highestRank: 160,
    contestCount: 10, winRate: 47,
    division: getDivisionForRating('economics', 1390),
    history: genHistory(900, 1390, 6, contestNamePool.economics),
  },
  {
    subjectSlug: 'history', subjectName: 'History',
    icon: Globe, color: 'from-slate-500 to-slate-700', accent: '#64748b',
    currentRating: 1250, peakRating: 1290, highestRank: 200,
    contestCount: 8, winRate: 45,
    division: getDivisionForRating('history', 1250),
    history: genHistory(800, 1250, 5, contestNamePool.history),
  },
  {
    subjectSlug: 'geography', subjectName: 'Geography',
    icon: MapPin, color: 'from-success-500 to-electric-500', accent: '#10b981',
    currentRating: 1190, peakRating: 1230, highestRank: 220,
    contestCount: 7, winRate: 43,
    division: getDivisionForRating('geography', 1190),
    history: genHistory(800, 1190, 5, contestNamePool.geography),
  },
  {
    subjectSlug: 'data-science', subjectName: 'Data Science',
    icon: LineChart, color: 'from-electric-500 to-electric-700', accent: '#3b82f6',
    currentRating: 1520, peakRating: 1560, highestRank: 100,
    contestCount: 13, winRate: 50,
    division: getDivisionForRating('data-science', 1520),
    history: genHistory(900, 1520, 7, contestNamePool['data-science']),
  },
];

export function getSubjectRating(slug: string): SubjectRating | undefined {
  return subjectRatings.find((r) => r.subjectSlug === slug);
}

export function getTopSubjects(limit = 5): SubjectRating[] {
  return [...subjectRatings].sort((a, b) => b.currentRating - a.currentRating).slice(0, limit);
}

export function getOverallStats() {
  const avg = Math.round(subjectRatings.reduce((s, r) => s + r.currentRating, 0) / subjectRatings.length);
  const totalContests = subjectRatings.reduce((s, r) => s + r.contestCount, 0);
  const best = [...subjectRatings].sort((a, b) => b.currentRating - a.currentRating)[0];
  return { avgRating: avg, totalContests, bestSubject: best };
}
