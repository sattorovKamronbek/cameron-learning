import type { LucideIcon } from 'lucide-react';
import {
  Code2, Sigma, Atom, FlaskConical, BookOpen, Languages, GraduationCap,
  Brain, Shield, LineChart, Scale, Globe, MapPin, ClipboardList,
} from 'lucide-react';

export type ContestType =
  | 'Rated'
  | 'Unrated'
  | 'Practice'
  | 'Virtual'
  | 'Team'
  | 'Weekly'
  | 'Monthly'
  | 'Championship';

export type Difficulty = 'Easy' | 'Medium' | 'Hard' | 'Expert';

export type ContestStatus = 'Upcoming' | 'Live' | 'Finished';

export type ContestCategory = {
  slug: string;
  name: string;
  icon: LucideIcon;
  color: string;
  contestCount: number;
  activeUsers: number;
  topPlayer: string;
  topPlayerRating: number;
};

export type Contest = {
  id: string;
  slug: string;
  name: string;
  subject: string;
  subjectSlug: string;
  type: ContestType;
  difficulty: Difficulty;
  status: ContestStatus;
  description: string;
  rules: string[];
  durationMinutes: number;
  startTime: string;
  endTime: string;
  participants: number;
  maxParticipants: number;
  organizer: string;
  organizerTitle: string;
  prize?: string;
  rating?: number;
  tags: string[];
};

export const contestCategories: ContestCategory[] = [
  { slug: 'programming', name: 'Programming', icon: Code2, color: 'from-indigo-500 to-indigo-700', contestCount: 48, activeUsers: 12400, topPlayer: 'alex_code', topPlayerRating: 2847 },
  { slug: 'mathematics', name: 'Mathematics', icon: Sigma, color: 'from-electric-500 to-electric-700', contestCount: 36, activeUsers: 8200, topPlayer: 'math_wiz', topPlayerRating: 2654 },
  { slug: 'physics', name: 'Physics', icon: Atom, color: 'from-indigo-600 to-electric-700', contestCount: 28, activeUsers: 6100, topPlayer: 'quantum_leap', topPlayerRating: 2498 },
  { slug: 'chemistry', name: 'Chemistry', icon: FlaskConical, color: 'from-electric-400 to-indigo-500', contestCount: 22, activeUsers: 4800, topPlayer: 'bond_maker', topPlayerRating: 2310 },
  { slug: 'biology', name: 'Biology', icon: BookOpen, color: 'from-success-500 to-electric-600', contestCount: 18, activeUsers: 3900, topPlayer: 'gene_dna', topPlayerRating: 2210 },
  { slug: 'english', name: 'English', icon: Languages, color: 'from-electric-400 to-electric-600', contestCount: 24, activeUsers: 7200, topPlayer: 'wordsmith', topPlayerRating: 2580 },
  { slug: 'ielts', name: 'IELTS', icon: GraduationCap, color: 'from-indigo-500 to-electric-600', contestCount: 16, activeUsers: 5400, topPlayer: 'fluent_speaker', topPlayerRating: 2390 },
  { slug: 'cefr', name: 'CEFR', icon: GraduationCap, color: 'from-electric-600 to-indigo-700', contestCount: 14, activeUsers: 4200, topPlayer: 'euro_lang', topPlayerRating: 2270 },
  { slug: 'sat', name: 'SAT', icon: ClipboardList, color: 'from-slate-600 to-slate-800', contestCount: 20, activeUsers: 6800, topPlayer: 'test_master', topPlayerRating: 2520 },
  { slug: 'ai-ml', name: 'AI & Machine Learning', icon: Brain, color: 'from-electric-600 to-indigo-700', contestCount: 26, activeUsers: 8900, topPlayer: 'neural_net', topPlayerRating: 2710 },
  { slug: 'cyber-security', name: 'Cyber Security', icon: Shield, color: 'from-slate-700 to-indigo-800', contestCount: 19, activeUsers: 5600, topPlayer: 'white_hat', topPlayerRating: 2640 },
  { slug: 'data-science', name: 'Data Science', icon: LineChart, color: 'from-electric-500 to-electric-700', contestCount: 30, activeUsers: 9100, topPlayer: 'data_miner', topPlayerRating: 2760 },
  { slug: 'economics', name: 'Economics', icon: Scale, color: 'from-sun-500 to-sun-600', contestCount: 15, activeUsers: 3400, topPlayer: 'supply_demand', topPlayerRating: 2180 },
  { slug: 'history', name: 'History', icon: Globe, color: 'from-slate-500 to-slate-700', contestCount: 12, activeUsers: 2800, topPlayer: 'time_traveler', topPlayerRating: 2090 },
  { slug: 'geography', name: 'Geography', icon: MapPin, color: 'from-success-500 to-electric-500', contestCount: 11, activeUsers: 2600, topPlayer: 'map_reader', topPlayerRating: 2050 },
  { slug: 'custom', name: 'Custom Subjects', icon: ClipboardList, color: 'from-indigo-400 to-electric-500', contestCount: 8, activeUsers: 1800, topPlayer: 'polymath', topPlayerRating: 1950 },
];

export const contestTypes: { type: ContestType; description: string; icon: LucideIcon }[] = [
  { type: 'Rated', description: 'Affects your global rating', icon: Sigma },
  { type: 'Unrated', description: 'For fun — no rating impact', icon: BookOpen },
  { type: 'Practice', description: 'Past problems, no pressure', icon: ClipboardList },
  { type: 'Virtual', description: 'Participate in past contests', icon: Globe },
  { type: 'Team', description: 'Compete as a group', icon: LineChart },
  { type: 'Weekly', description: 'Recurring weekly challenges', icon: Atom },
  { type: 'Monthly', description: 'Monthly flagship events', icon: GraduationCap },
  { type: 'Championship', description: 'Seasonal top-tier tournaments', icon: Shield },
];

const now = new Date();
function iso(daysFromNow: number, hour = 18): string {
  const d = new Date(now);
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

export const contests: Contest[] = [
  {
    id: '1', slug: 'spring-code-sprint-2026', name: 'Spring Code Sprint 2026',
    subject: 'Programming', subjectSlug: 'programming', type: 'Rated', difficulty: 'Hard',
    status: 'Live',
    description: 'A 3-hour algorithmic sprint featuring 6 challenging problems covering graphs, dynamic programming, and number theory. Open to all rated programmers.',
    rules: [
      'Individual participation only',
      'Solutions judged by correctness and time complexity',
      'No external code libraries allowed',
      'Plagiarism results in immediate disqualification',
      'Ties broken by submission time',
    ],
    durationMinutes: 180, startTime: iso(0, 18), endTime: iso(0, 21),
    participants: 3420, maxParticipants: 5000,
    organizer: 'Cameron Contest Team', organizerTitle: 'Platform',
    prize: '$500 + Pro Max 6 months', rating: 2847,
    tags: ['Algorithms', 'DP', 'Graphs'],
  },
  {
    id: '2', slug: 'calculus-showdown', name: 'Calculus Showdown',
    subject: 'Mathematics', subjectSlug: 'mathematics', type: 'Rated', difficulty: 'Hard',
    status: 'Live',
    description: 'Test your calculus skills across limits, derivatives, integrals, and multivariable applications in this timed competition.',
    rules: [
      'Individual participation',
      'No calculators with CAS functionality',
      'Show all work for partial credit',
      '30 problems in 120 minutes',
    ],
    durationMinutes: 120, startTime: iso(0, 17), endTime: iso(0, 19),
    participants: 1850, maxParticipants: 3000,
    organizer: 'Dr. Elena Rossi', organizerTitle: 'Mathematics Professor',
    prize: '$300 + Pro 1 year', rating: 2654,
    tags: ['Calculus', 'Limits', 'Integrals'],
  },
  {
    id: '3', slug: 'neural-networks-challenge', name: 'Neural Networks Challenge',
    subject: 'AI & Machine Learning', subjectSlug: 'ai-ml', type: 'Team', difficulty: 'Expert',
    status: 'Upcoming',
    description: 'Design and train a neural network to solve a real-world classification problem. Teams of up to 3 compete over 48 hours.',
    rules: [
      'Teams of 1–3 members',
      'Pre-trained models allowed for transfer learning',
      'Submit a notebook with full code and explanation',
      'Judged on accuracy, efficiency, and clarity',
    ],
    durationMinutes: 2880, startTime: iso(3, 18), endTime: iso(5, 18),
    participants: 620, maxParticipants: 1000,
    organizer: 'Dr. Yuki Tanaka', organizerTitle: 'ML Research Engineer',
    prize: '$1,500 + Max 1 year', rating: 2710,
    tags: ['Deep Learning', 'PyTorch', 'Classification'],
  },
  {
    id: '4', slug: 'weekly-algo-warmup-42', name: 'Weekly Algo Warmup #42',
    subject: 'Programming', subjectSlug: 'programming', type: 'Weekly', difficulty: 'Easy',
    status: 'Upcoming',
    description: 'A relaxed weekly warmup with 3 beginner-friendly problems. Perfect for building your problem-solving habit.',
    rules: [
      'Individual participation',
      'All skill levels welcome',
      'Solutions auto-judged with instant feedback',
      'Unrated — focus on learning',
    ],
    durationMinutes: 90, startTime: iso(2, 20), endTime: iso(2, 21, ),
    participants: 2100, maxParticipants: 10000,
    organizer: 'Cameron Contest Team', organizerTitle: 'Platform',
    tags: ['Arrays', 'Strings', 'Basics'],
  },
  {
    id: '5', slug: 'physics-mechanics-cup', name: 'Physics Mechanics Cup',
    subject: 'Physics', subjectSlug: 'physics', type: 'Rated', difficulty: 'Medium',
    status: 'Upcoming',
    description: 'Classical mechanics under pressure: kinematics, forces, energy, and rotational dynamics across 25 problems.',
    rules: [
      'Individual participation',
      'Scientific calculator allowed',
      'Partial credit for correct method',
      '25 problems in 90 minutes',
    ],
    durationMinutes: 90, startTime: iso(5, 16), endTime: iso(5, 17, ),
    participants: 980, maxParticipants: 2000,
    organizer: 'Prof. James Whitfield', organizerTitle: 'Physics Professor',
    prize: '$200 + Pro 6 months', rating: 2498,
    tags: ['Mechanics', 'Kinematics', 'Energy'],
  },
  {
    id: '6', slug: 'sql-query-olympiad', name: 'SQL Query Olympiad',
    subject: 'Data Science', subjectSlug: 'data-science', type: 'Championship', difficulty: 'Hard',
    status: 'Upcoming',
    description: 'The flagship SQL championship. Complex queries, window functions, optimization challenges, and a final round on real-world datasets.',
    rules: [
      'Individual participation',
      'PostgreSQL syntax expected',
      '3 rounds: Easy, Medium, Expert',
      'Queries judged on correctness and performance',
    ],
    durationMinutes: 240, startTime: iso(7, 14), endTime: iso(7, 18),
    participants: 1450, maxParticipants: 2500,
    organizer: 'Marcus Lindqvist', organizerTitle: 'Database Architect',
    prize: '$800 + Max 1 year', rating: 2760,
    tags: ['SQL', 'PostgreSQL', 'Optimization'],
  },
  {
    id: '7', slug: 'ielts-speaking-practice-15', name: 'IELTS Speaking Practice #15',
    subject: 'IELTS', subjectSlug: 'ielts', type: 'Practice', difficulty: 'Medium',
    status: 'Live',
    description: 'Practice IELTS speaking tasks with AI-powered feedback on fluency, vocabulary, and pronunciation. Unrated practice session.',
    rules: [
      'Individual participation',
      'Microphone required for audio tasks',
      'AI feedback provided instantly',
      'Unrated — practice mode only',
    ],
    durationMinutes: 45, startTime: iso(0, 10), endTime: iso(0, 11, ),
    participants: 760, maxParticipants: 5000,
    organizer: 'Cameron Language Team', organizerTitle: 'Platform',
    tags: ['Speaking', 'Fluency', 'Practice'],
  },
  {
    id: '8', slug: 'web-security-ctf', name: 'Web Security CTF',
    subject: 'Cyber Security', subjectSlug: 'cyber-security', type: 'Team', difficulty: 'Expert',
    status: 'Finished',
    description: 'Capture-the-flag competition focused on web vulnerabilities: XSS, SQL injection, CSRF, and session management. Teams of up to 4.',
    rules: [
      'Teams of 1–4 members',
      'Flags submitted via the platform',
      'No attacking infrastructure outside scope',
      'Hints available with point deduction',
    ],
    durationMinutes: 360, startTime: iso(-7, 18), endTime: iso(-7, 24),
    participants: 890, maxParticipants: 1200,
    organizer: 'Cameron Security Team', organizerTitle: 'Platform',
    prize: '$1,000 + Max 1 year', rating: 2640,
    tags: ['CTF', 'Web Security', 'Penetration Testing'],
  },
  {
    id: '9', slug: 'organic-chemistry-speed-run', name: 'Organic Chemistry Speed Run',
    subject: 'Chemistry', subjectSlug: 'chemistry', type: 'Unrated', difficulty: 'Medium',
    status: 'Finished',
    description: 'Quick-fire organic chemistry: naming, reactions, mechanisms, and synthesis pathways. 40 questions in 60 minutes.',
    rules: [
      'Individual participation',
      'No reference materials',
      '40 multiple-choice + short-answer questions',
      'Unrated — focus on speed and accuracy',
    ],
    durationMinutes: 60, startTime: iso(-3, 19), endTime: iso(-3, 20),
    participants: 540, maxParticipants: 2000,
    organizer: 'Dr. Amara Okafor', organizerTitle: 'Chemistry Lecturer',
    tags: ['Organic', 'Reactions', 'Mechanisms'],
  },
  {
    id: '10', slug: 'sat-math-blitz', name: 'SAT Math Blitz',
    subject: 'SAT', subjectSlug: 'sat', type: 'Weekly', difficulty: 'Medium',
    status: 'Upcoming',
    description: 'Weekly SAT math practice under timed conditions. Covers algebra, problem-solving, data analysis, and advanced math.',
    rules: [
      'Individual participation',
      'No calculator for no-calculator section',
      'Timed exactly like the real SAT',
      'Score report provided after completion',
    ],
    durationMinutes: 75, startTime: iso(4, 11), endTime: iso(4, 12, ),
    participants: 1620, maxParticipants: 5000,
    organizer: 'Cameron Test Prep', organizerTitle: 'Platform',
    tags: ['SAT', 'Algebra', 'Test Prep'],
  },
  {
    id: '11', slug: 'economics-game-theory', name: 'Game Theory Tournament',
    subject: 'Economics', subjectSlug: 'economics', type: 'Rated', difficulty: 'Hard',
    status: 'Upcoming',
    description: 'Strategic decision-making under uncertainty. Nash equilibria, prisoner dilemmas, auctions, and repeated games.',
    rules: [
      'Individual participation',
      'Strategies submitted as written responses',
      'Rounds scored against all other participants',
      'Nash equilibrium bonus points',
    ],
    durationMinutes: 150, startTime: iso(10, 15), endTime: iso(10, 17, ),
    participants: 420, maxParticipants: 1000,
    organizer: 'Prof. Elena Rossi', organizerTitle: 'Economics Faculty',
    prize: '$250 + Pro 6 months', rating: 2180,
    tags: ['Game Theory', 'Strategy', 'Nash'],
  },
  {
    id: '12', slug: 'virtual-graph-algorithms', name: 'Virtual: Graph Algorithms',
    subject: 'Programming', subjectSlug: 'programming', type: 'Virtual', difficulty: 'Medium',
    status: 'Upcoming',
    description: 'Replay a classic graph algorithms contest at your own pace. BFS, DFS, shortest paths, MST, and network flow.',
    rules: [
      'Individual participation',
      'Virtual — participate any time within 7 days',
      'No rating impact',
      'Full editorial provided after completion',
    ],
    durationMinutes: 120, startTime: iso(1, 0), endTime: iso(8, 0),
    participants: 320, maxParticipants: 10000,
    organizer: 'Cameron Contest Team', organizerTitle: 'Platform',
    tags: ['Graphs', 'BFS', 'DFS', 'Shortest Path'],
  },
];

export const difficultyColors: Record<Difficulty, string> = {
  Easy: 'bg-success-500/10 text-success-600 ring-success-500/20',
  Medium: 'bg-sun-500/10 text-sun-600 ring-sun-500/20',
  Hard: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  Expert: 'bg-error-500/10 text-error-600 ring-error-500/20',
};

export const statusColors: Record<ContestStatus, string> = {
  Live: 'bg-success-500 text-white',
  Upcoming: 'bg-indigo-100 text-indigo-700',
  Finished: 'bg-slate-100 text-slate-500',
};

export const typeColors: Record<ContestType, string> = {
  Rated: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200',
  Unrated: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
  Practice: 'bg-electric-50 text-electric-700 ring-1 ring-electric-200',
  Virtual: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
  Team: 'from-indigo-500 to-electric-600 text-white',
  Weekly: 'bg-electric-50 text-electric-700 ring-1 ring-electric-200',
  Monthly: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200',
  Championship: 'from-sun-500 to-sun-600 text-white',
};

export function getContest(slug: string): Contest | undefined {
  return contests.find((c) => c.slug === slug);
}

export function getContestCategory(slug: string): ContestCategory | undefined {
  return contestCategories.find((c) => c.slug === slug);
}

export function getContestsBySubject(slug: string): Contest[] {
  return contests.filter((c) => c.subjectSlug === slug);
}

export function getCategory(slug: string): ContestCategory | undefined {
  return contestCategories.find((c) => c.slug === slug);
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h < 24) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh > 0 ? `${d}d ${rh}h` : `${d}d`;
}

export function formatDateTime(iso: string): { date: string; time: string; relative: string } {
  const d = new Date(iso);
  const nowDate = new Date();
  const diffMs = d.getTime() - nowDate.getTime();
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  const diffDays = Math.round(diffHours / 24);

  let relative: string;
  if (diffMs < 0) {
    const absHours = Math.abs(diffHours);
    if (absHours < 1) relative = 'Ended just now';
    else if (absHours < 24) relative = `Ended ${absHours}h ago`;
    else relative = `Ended ${Math.abs(diffDays)}d ago`;
  } else if (diffHours < 1) {
    relative = 'Starts soon';
  } else if (diffHours < 24) {
    relative = `Starts in ${diffHours}h`;
  } else {
    relative = `Starts in ${diffDays}d`;
  }

  return {
    date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    relative,
  };
}
