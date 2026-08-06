import type { LucideIcon } from 'lucide-react';
import {
  Users, Trophy, FileText, Megaphone, BarChart3, Award,
  Shield, ClipboardList, TrendingUp, Star, CheckCircle2,
  Clock, AlertCircle, Eye,
} from 'lucide-react';
import type { ContestType, Difficulty } from '@/data/contests';

/* ============ Admin Stats ============ */

export type AdminStat = {
  id: string;
  label: string;
  value: string;
  change: string;
  trend: 'up' | 'down' | 'stable';
  icon: LucideIcon;
  color: string;
};

export const adminStats: AdminStat[] = [
  { id: 'users', label: 'Total Users', value: '48,250', change: '+12.4%', trend: 'up', icon: Users, color: 'from-indigo-500 to-indigo-700' },
  { id: 'contests', label: 'Active Contests', value: '127', change: '+8', trend: 'up', icon: Trophy, color: 'from-electric-500 to-electric-700' },
  { id: 'submissions', label: 'Submissions Today', value: '3,840', change: '+15.2%', trend: 'up', icon: FileText, color: 'from-success-500 to-electric-600' },
  { id: 'revenue', label: 'Monthly Revenue', value: '$24,800', change: '+8.7%', trend: 'up', icon: TrendingUp, color: 'from-sun-500 to-sun-600' },
];

/* ============ Admin User Management ============ */

export type AdminUser = {
  id: string;
  username: string;
  email: string;
  fullName: string;
  country: string;
  flag: string;
  plan: 'free' | 'pro' | 'max';
  status: 'active' | 'suspended' | 'banned';
  joinedDate: string;
  totalSolved: number;
  rating: number;
  contests: number;
  lastActive: string;
};

export const adminUsers: AdminUser[] = [
  { id: 'u1', username: 'alex_code', email: 'alex@example.com', fullName: 'Alex Chen', country: 'United States', flag: 'US', plan: 'max', status: 'active', joinedDate: '2025-06-15', totalSolved: 142, rating: 1842, contests: 38, lastActive: '5m ago' },
  { id: 'u2', username: 'math_wiz', email: 'sarah@example.com', fullName: 'Sarah Kim', country: 'China', flag: 'CN', plan: 'pro', status: 'active', joinedDate: '2025-07-20', totalSolved: 76, rating: 1675, contests: 24, lastActive: '1h ago' },
  { id: 'u3', username: 'quantum_leap', email: 'max@example.com', fullName: 'Max Mueller', country: 'Germany', flag: 'DE', plan: 'pro', status: 'active', joinedDate: '2025-08-01', totalSolved: 42, rating: 1456, contests: 16, lastActive: '30m ago' },
  { id: 'u4', username: 'neural_net', email: 'yuki@example.com', fullName: 'Yuki Tanaka', country: 'Japan', flag: 'JP', plan: 'max', status: 'active', joinedDate: '2025-05-10', totalSolved: 54, rating: 1750, contests: 20, lastActive: '2h ago' },
  { id: 'u5', username: 'algo_beast', email: 'raj@example.com', fullName: 'Raj Patel', country: 'India', flag: 'IN', plan: 'free', status: 'suspended', joinedDate: '2025-09-15', totalSolved: 31, rating: 1320, contests: 12, lastActive: '3d ago' },
  { id: 'u6', username: 'wordsmith', email: 'emma@example.com', fullName: 'Emma Wilson', country: 'United Kingdom', flag: 'GB', plan: 'pro', status: 'active', joinedDate: '2025-06-28', totalSolved: 98, rating: 1850, contests: 31, lastActive: '15m ago' },
  { id: 'u7', username: 'white_hat', email: 'carlos@example.com', fullName: 'Carlos Silva', country: 'Brazil', flag: 'BR', plan: 'free', status: 'active', joinedDate: '2025-10-05', totalSolved: 38, rating: 1600, contests: 15, lastActive: '6h ago' },
  { id: 'u8', username: 'matrix_solver', email: 'ivan@example.com', fullName: 'Ivan Petrov', country: 'Russia', flag: 'RU', plan: 'free', status: 'banned', joinedDate: '2025-11-20', totalSolved: 22, rating: 1180, contests: 8, lastActive: '1w ago' },
];

/* ============ Admin Submission Review ============ */

export type AdminSubmission = {
  id: string;
  user: string;
  contest: string;
  problem: string;
  subject: string;
  status: 'accepted' | 'wrong' | 'timeout' | 'pending' | 'flagged';
  language: string;
  submittedAt: string;
  executionTime: string;
  memory: string;
  similarityScore?: number;
};

export const adminSubmissions: AdminSubmission[] = [
  { id: 's1', user: 'alex_code', contest: 'Spring Code Sprint 2026', problem: 'A — Two Sum', subject: 'Programming', status: 'accepted', language: 'Python', submittedAt: '5m ago', executionTime: '42ms', memory: '8.2MB' },
  { id: 's2', user: 'algo_beast', contest: 'Calculus Showdown', problem: 'Q15 — Integral', subject: 'Mathematics', status: 'flagged', language: 'Text', submittedAt: '12m ago', executionTime: '—', memory: '—', similarityScore: 78 },
  { id: 's3', user: 'neural_net', contest: 'Neural Networks Challenge', problem: 'Model Submission', subject: 'AI & ML', status: 'pending', language: 'Python', submittedAt: '25m ago', executionTime: '—', memory: '—' },
  { id: 's4', user: 'math_wiz', contest: 'Calculus Showdown', problem: 'Q08 — Derivative', subject: 'Mathematics', status: 'accepted', language: 'Text', submittedAt: '45m ago', executionTime: '—', memory: '—' },
  { id: 's5', user: 'dp_wizard', contest: 'Spring Code Sprint 2026', problem: 'C — Shortest Path', subject: 'Programming', status: 'timeout', language: 'Java', submittedAt: '1h ago', executionTime: '5000ms', memory: '256MB' },
  { id: 's6', user: 'wordsmith', contest: 'Grammar Cup', problem: 'Q12 — Tense', subject: 'English', status: 'accepted', language: 'Text', submittedAt: '2h ago', executionTime: '—', memory: '—' },
  { id: 's7', user: 'graph_guru', contest: 'Spring Code Sprint 2026', problem: 'B — Graph BFS', subject: 'Programming', status: 'wrong', language: 'C++', submittedAt: '3h ago', executionTime: '15ms', memory: '4.1MB' },
  { id: 's8', user: 'bayesian_badger', contest: 'Grammar Cup', problem: 'Q20 — Essay', subject: 'English', status: 'flagged', language: 'Text', submittedAt: '4h ago', executionTime: '—', memory: '—', similarityScore: 65 },
];

/* ============ Admin Announcements ============ */

export type AdminAnnouncement = {
  id: string;
  title: string;
  body: string;
  author: string;
  date: string;
  status: 'published' | 'draft' | 'scheduled';
  audience: 'all' | 'pro' | 'max' | 'contestants';
  pinned: boolean;
  views: number;
};

export const adminAnnouncements: AdminAnnouncement[] = [
  { id: 'a1', title: 'New question types: Audio & Video', body: 'We have added Audio and Video question types for language contests. IELTS and CEFR contests now support listening comprehension with real audio clips.', author: 'Cameron Team', date: '2026-08-01', status: 'published', audience: 'all', pinned: true, views: 12480 },
  { id: 'a2', title: 'Summer Championship 2026 registration open', body: 'Registration is now open for the Summer Championship 2026. Compete across 15 subjects for a total prize pool of $25,000.', author: 'Cameron Team', date: '2026-07-28', status: 'published', audience: 'all', pinned: false, views: 8920 },
  { id: 'a3', title: 'Pro plan discount — 40% off', body: 'Limited time offer: get 40% off the Pro plan for the first 3 months. Upgrade now to unlock unlimited contest participation.', author: 'Cameron Team', date: '2026-08-03', status: 'scheduled', audience: 'all', pinned: false, views: 0 },
  { id: 'a4', title: 'Scheduled maintenance — Aug 10', body: 'The platform will undergo scheduled maintenance on August 10 from 2:00 AM to 4:00 AM UTC. Contests during this window are rescheduled.', author: 'Cameron Team', date: '2026-08-02', status: 'draft', audience: 'all', pinned: false, views: 0 },
];

/* ============ Admin Contest Form Types ============ */

export type ContestFormData = {
  title: string;
  subject: string;
  difficulty: Difficulty;
  type: ContestType;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  rules: string[];
  prize: string;
  visibility: 'public' | 'private' | 'pro' | 'invite';
  description: string;
  maxParticipants: number;
  tags: string[];
  organizer: string;
};

export const emptyContestForm: ContestFormData = {
  title: '',
  subject: 'programming',
  difficulty: 'Medium',
  type: 'Rated',
  startTime: '',
  endTime: '',
  durationMinutes: 120,
  rules: [],
  prize: '',
  visibility: 'public',
  description: '',
  maxParticipants: 5000,
  tags: [],
  organizer: '',
};

export const visibilityOptions: { value: ContestFormData['visibility']; label: string; description: string }[] = [
  { value: 'public', label: 'Public', description: 'Visible to all users' },
  { value: 'private', label: 'Private', description: 'Only accessible via direct link' },
  { value: 'pro', label: 'Pro Only', description: 'Only Pro and Max plan subscribers' },
  { value: 'invite', label: 'Invite Only', description: 'Requires invitation code' },
];

/* ============ Admin Section Metadata ============ */

export type AdminSection = {
  id: string;
  label: string;
  icon: LucideIcon;
  description: string;
};

export const adminSections: AdminSection[] = [
  { id: 'overview', label: 'Overview', icon: BarChart3, description: 'Platform metrics and summary' },
  { id: 'contests', label: 'Contests', icon: Trophy, description: 'Create, edit, and manage contests' },
  { id: 'subjects', label: 'Subjects', icon: ClipboardList, description: 'Manage subject categories' },
  { id: 'problems', label: 'Problems', icon: FileText, description: 'Manage problem bank' },
  { id: 'users', label: 'Users', icon: Users, description: 'Manage user accounts' },
  { id: 'ratings', label: 'Ratings', icon: Star, description: 'Review and adjust ratings' },
  { id: 'announcements', label: 'Announcements', icon: Megaphone, description: 'Publish platform announcements' },
  { id: 'submissions', label: 'Submissions', icon: CheckCircle2, description: 'Review flagged submissions' },
  { id: 'analytics', label: 'Analytics', icon: TrendingUp, description: 'Platform-wide analytics' },
  { id: 'badges', label: 'Badges', icon: Award, description: 'Manage achievements and badges' },
  { id: 'security', label: 'Security', icon: Shield, description: 'Anti-cheat and integrity monitoring' },
];

/* ============ Status Colors ============ */

export const userStatusColors: Record<AdminUser['status'], string> = {
  active: 'bg-success-500/10 text-success-600 ring-success-500/20',
  suspended: 'bg-sun-500/10 text-sun-600 ring-sun-500/20',
  banned: 'bg-error-500/10 text-error-600 ring-error-500/20',
};

export const submissionStatusColors: Record<AdminSubmission['status'], string> = {
  accepted: 'bg-success-500/10 text-success-600 ring-success-500/20',
  wrong: 'bg-error-500/10 text-error-600 ring-error-500/20',
  timeout: 'bg-sun-500/10 text-sun-600 ring-sun-500/20',
  pending: 'bg-slate-100 text-slate-500 ring-slate-200',
  flagged: 'bg-purple-500/10 text-purple-600 ring-purple-500/20',
};

export const announcementStatusColors: Record<AdminAnnouncement['status'], string> = {
  published: 'bg-success-500/10 text-success-600 ring-success-500/20',
  draft: 'bg-slate-100 text-slate-500 ring-slate-200',
  scheduled: 'bg-electric-500/10 text-electric-600 ring-electric-500/20',
};

export const planColors: Record<AdminUser['plan'], string> = {
  free: 'bg-slate-100 text-slate-600',
  pro: 'bg-indigo-100 text-indigo-700',
  max: 'bg-electric-100 text-electric-700',
};
