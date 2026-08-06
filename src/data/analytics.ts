/* ============ Analytics Data Types ============ */

export type SubjectPerformance = {
  subject: string;
  slug: string;
  accuracy: number;
  solved: number;
  avgRank: number;
  rating: number;
  trend: 'up' | 'down' | 'stable';
  trendValue: number;
};

export type TopicPerformance = {
  topic: string;
  subject: string;
  accuracy: number;
  attempted: number;
  category: 'strong' | 'weak';
};

export type DifficultyDistribution = {
  difficulty: string;
  count: number;
  accuracy: number;
  color: string;
};

export type MonthlyProgress = {
  month: string;
  short: string;
  solved: number;
  rating: number;
  contests: number;
  accuracy: number;
};

export type HeatmapCell = {
  date: string;
  day: number;
  week: number;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
};

export type ContestHistoryEntry = {
  id: string;
  name: string;
  subject: string;
  subjectSlug: string;
  date: string;
  rank: number;
  participants: number;
  oldRating: number;
  newRating: number;
  delta: number;
  solved: number;
  total: number;
  accuracy: number;
};

export type RatingGrowthPoint = {
  date: string;
  rating: number;
  label: string;
};

/* ============ Subject Performance ============ */

export const subjectPerformance: SubjectPerformance[] = [
  { subject: 'Programming', slug: 'programming', accuracy: 72, solved: 142, avgRank: 145, rating: 1842, trend: 'up', trendValue: 45 },
  { subject: 'English', slug: 'english', accuracy: 78, solved: 98, avgRank: 89, rating: 1850, trend: 'up', trendValue: 62 },
  { subject: 'Mathematics', slug: 'mathematics', accuracy: 65, solved: 76, avgRank: 210, rating: 1675, trend: 'up', trendValue: 30 },
  { subject: 'AI & ML', slug: 'ai-ml', accuracy: 68, solved: 54, avgRank: 175, rating: 1750, trend: 'stable', trendValue: 0 },
  { subject: 'Physics', slug: 'physics', accuracy: 58, solved: 42, avgRank: 280, rating: 1456, trend: 'down', trendValue: -15 },
  { subject: 'Cyber Security', slug: 'cyber-security', accuracy: 63, solved: 38, avgRank: 220, rating: 1600, trend: 'up', trendValue: 20 },
  { subject: 'Chemistry', slug: 'chemistry', accuracy: 54, solved: 31, avgRank: 310, rating: 1320, trend: 'stable', trendValue: 5 },
  { subject: 'IELTS', slug: 'ielts', accuracy: 71, solved: 28, avgRank: 195, rating: 1620, trend: 'up', trendValue: 35 },
  { subject: 'SAT', slug: 'sat', accuracy: 66, solved: 24, avgRank: 240, rating: 1540, trend: 'down', trendValue: -10 },
  { subject: 'Data Science', slug: 'data-science', accuracy: 69, solved: 22, avgRank: 185, rating: 1520, trend: 'up', trendValue: 25 },
];

/* ============ Topic Performance (Strong + Weak) ============ */

export const topicPerformance: TopicPerformance[] = [
  { topic: 'Dynamic Programming', subject: 'Programming', accuracy: 91, attempted: 28, category: 'strong' },
  { topic: 'Graph Algorithms', subject: 'Programming', accuracy: 88, attempted: 32, category: 'strong' },
  { topic: 'Grammar', subject: 'English', accuracy: 85, attempted: 24, category: 'strong' },
  { topic: 'Neural Networks', subject: 'AI & ML', accuracy: 82, attempted: 18, category: 'strong' },
  { topic: 'Web Security', subject: 'Cyber Security', accuracy: 79, attempted: 15, category: 'strong' },
  { topic: 'Data Structures', subject: 'Programming', accuracy: 86, attempted: 40, category: 'strong' },
  { topic: 'Thermodynamics', subject: 'Physics', accuracy: 42, attempted: 12, category: 'weak' },
  { topic: 'Organic Chemistry', subject: 'Chemistry', accuracy: 38, attempted: 10, category: 'weak' },
  { topic: 'Quantum Mechanics', subject: 'Physics', accuracy: 35, attempted: 8, category: 'weak' },
  { topic: 'Calculus', subject: 'Mathematics', accuracy: 48, attempted: 22, category: 'weak' },
  { topic: 'Genetics', subject: 'Biology', accuracy: 44, attempted: 9, category: 'weak' },
  { topic: 'Game Theory', subject: 'Economics', accuracy: 41, attempted: 7, category: 'weak' },
];

export const strongTopics = topicPerformance.filter((t) => t.category === 'strong');
export const weakTopics = topicPerformance.filter((t) => t.category === 'weak');

/* ============ Difficulty Distribution ============ */

export const difficultyDistribution: DifficultyDistribution[] = [
  { difficulty: 'Easy', count: 89, accuracy: 88, color: 'from-success-400 to-success-600' },
  { difficulty: 'Medium', count: 124, accuracy: 68, color: 'from-sun-400 to-sun-600' },
  { difficulty: 'Hard', count: 67, accuracy: 45, color: 'from-indigo-400 to-indigo-600' },
  { difficulty: 'Expert', count: 23, accuracy: 28, color: 'from-error-400 to-error-600' },
];

/* ============ Monthly Progress (12 months) ============ */

export const monthlyProgress: MonthlyProgress[] = [
  { month: 'January', short: 'Jan', solved: 42, rating: 1480, contests: 6, accuracy: 64 },
  { month: 'February', short: 'Feb', solved: 58, rating: 1520, contests: 8, accuracy: 66 },
  { month: 'March', short: 'Mar', solved: 71, rating: 1580, contests: 10, accuracy: 67 },
  { month: 'April', short: 'Apr', solved: 65, rating: 1620, contests: 9, accuracy: 65 },
  { month: 'May', short: 'May', solved: 82, rating: 1680, contests: 11, accuracy: 70 },
  { month: 'June', short: 'Jun', solved: 76, rating: 1650, contests: 8, accuracy: 68 },
  { month: 'July', short: 'Jul', solved: 94, rating: 1720, contests: 12, accuracy: 72 },
  { month: 'August', short: 'Aug', solved: 88, rating: 1750, contests: 10, accuracy: 71 },
  { month: 'September', short: 'Sep', solved: 102, rating: 1780, contests: 13, accuracy: 73 },
  { month: 'October', short: 'Oct', solved: 95, rating: 1820, contests: 11, accuracy: 74 },
  { month: 'November', short: 'Nov', solved: 110, rating: 1850, contests: 14, accuracy: 76 },
  { month: 'December', short: 'Dec', solved: 98, rating: 1842, contests: 10, accuracy: 75 },
];

/* ============ Yearly Progress ============ */

export const yearlyProgress = [
  { year: '2024', solved: 320, rating: 1200, contests: 28, accuracy: 58 },
  { year: '2025', solved: 580, rating: 1480, contests: 52, accuracy: 64 },
  { year: '2026', solved: 982, rating: 1842, contests: 122, accuracy: 72 },
];

/* ============ Heatmap Data (52 weeks x 7 days) ============ */

export function generateHeatmap(): HeatmapCell[] {
  const cells: HeatmapCell[] = [];
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 364);

  for (let week = 0; week < 52; week++) {
    for (let day = 0; day < 7; day++) {
      const date = new Date(start);
      date.setDate(date.getDate() + week * 7 + day);
      if (date > today) continue;

      const seed = (week * 7 + day) * 13 + 7;
      const rand = Math.abs(Math.sin(seed) * 10000) % 1;
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const baseProb = isWeekend ? 0.3 : 0.7;

      let count = 0;
      let level: 0 | 1 | 2 | 3 | 4 = 0;
      if (rand < baseProb) {
        count = Math.floor(rand * 15) + 1;
        if (count <= 2) level = 1;
        else if (count <= 5) level = 2;
        else if (count <= 9) level = 3;
        else level = 4;
      }

      cells.push({
        date: date.toISOString(),
        day,
        week,
        count,
        level,
      });
    }
  }
  return cells;
}

export const heatmapData = generateHeatmap();

/* ============ Rating Growth Graph ============ */

export const ratingGrowth: RatingGrowthPoint[] = [
  { date: '2026-01-01', rating: 1200, label: 'Jan' },
  { date: '2026-02-01', rating: 1520, label: 'Feb' },
  { date: '2026-03-01', rating: 1580, label: 'Mar' },
  { date: '2026-04-01', rating: 1620, label: 'Apr' },
  { date: '2026-05-01', rating: 1680, label: 'May' },
  { date: '2026-06-01', rating: 1650, label: 'Jun' },
  { date: '2026-07-01', rating: 1720, label: 'Jul' },
  { date: '2026-08-01', rating: 1780, label: 'Aug' },
  { date: '2026-09-01', rating: 1820, label: 'Sep' },
  { date: '2026-10-01', rating: 1850, label: 'Oct' },
  { date: '2026-11-01', rating: 1842, label: 'Nov' },
];

/* ============ Contest History ============ */

export const contestHistory: ContestHistoryEntry[] = [
  { id: 'c1', name: 'Spring Code Sprint 2026', subject: 'Programming', subjectSlug: 'programming', date: '2026-08-01', rank: 42, participants: 3420, oldRating: 1797, newRating: 1842, delta: 45, solved: 5, total: 6, accuracy: 83 },
  { id: 'c2', name: 'Grammar Cup', subject: 'English', subjectSlug: 'english', date: '2026-07-28', rank: 35, participants: 2100, oldRating: 1788, newRating: 1850, delta: 62, solved: 18, total: 20, accuracy: 90 },
  { id: 'c3', name: 'Calculus Showdown', subject: 'Mathematics', subjectSlug: 'mathematics', date: '2026-07-20', rank: 78, participants: 1850, oldRating: 1645, newRating: 1675, delta: 30, solved: 19, total: 30, accuracy: 63 },
  { id: 'c4', name: 'Neural Networks Challenge', subject: 'AI & ML', subjectSlug: 'ai-ml', date: '2026-07-15', rank: 60, participants: 620, oldRating: 1750, newRating: 1750, delta: 0, solved: 3, total: 5, accuracy: 60 },
  { id: 'c5', name: 'Mechanics Cup', subject: 'Physics', subjectSlug: 'physics', date: '2026-07-10', rank: 120, participants: 980, oldRating: 1471, newRating: 1456, delta: -15, solved: 15, total: 25, accuracy: 60 },
  { id: 'c6', name: 'Weekly Algo Warmup #42', subject: 'Programming', subjectSlug: 'programming', date: '2026-07-05', rank: 156, participants: 2100, oldRating: 1760, newRating: 1797, delta: 37, solved: 3, total: 3, accuracy: 100 },
  { id: 'c7', name: 'IELTS Speaking Practice #15', subject: 'IELTS', subjectSlug: 'ielts', date: '2026-06-28', rank: 90, participants: 760, oldRating: 1585, newRating: 1620, delta: 35, solved: 6, total: 8, accuracy: 75 },
  { id: 'c8', name: 'Web Security CTF', subject: 'Cyber Security', subjectSlug: 'cyber-security', date: '2026-06-20', rank: 85, participants: 890, oldRating: 1580, newRating: 1600, delta: 20, solved: 8, total: 12, accuracy: 67 },
  { id: 'c9', name: 'SAT Math Blitz', subject: 'SAT', subjectSlug: 'sat', date: '2026-06-15', rank: 110, participants: 1620, oldRating: 1550, newRating: 1540, delta: -10, solved: 22, total: 30, accuracy: 73 },
  { id: 'c10', name: 'Game Theory Tournament', subject: 'Economics', subjectSlug: 'economics', date: '2026-06-08', rank: 160, participants: 420, oldRating: 1395, newRating: 1390, delta: -5, solved: 8, total: 15, accuracy: 53 },
];

/* ============ Summary Stats ============ */

export function getAnalyticsSummary() {
  const totalSolved = subjectPerformance.reduce((s, p) => s + p.solved, 0);
  const avgAccuracy = Math.round(subjectPerformance.reduce((s, p) => s + p.accuracy, 0) / subjectPerformance.length);
  const avgRank = Math.round(subjectPerformance.reduce((s, p) => s + p.avgRank, 0) / subjectPerformance.length);
  const bestSubject = [...subjectPerformance].sort((a, b) => b.rating - a.rating)[0];
  const currentStreak = 45;
  const longestStreak = 62;
  const totalContests = 52;
  const ratingProgression = 642; // current - start

  return {
    totalSolved,
    avgAccuracy,
    avgRank,
    bestSubject,
    currentStreak,
    longestStreak,
    totalContests,
    ratingProgression,
  };
}
