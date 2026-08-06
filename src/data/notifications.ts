import type { LucideIcon } from 'lucide-react';
import {
  Clock, TrendingUp, CheckCircle2, Trophy, Megaphone, Award,
  Calendar, AlertCircle, Flame, Star, Bell,
} from 'lucide-react';

/* ============ Notification Types ============ */

export type NotificationType =
  | 'contest-reminder'
  | 'rating-change'
  | 'submission-result'
  | 'achievement-unlocked'
  | 'new-contest'
  | 'announcement'
  | 'weekly-summary';

export type Notification = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  icon: LucideIcon;
  color: string;
  actionLabel?: string;
  actionLink?: string;
  meta?: {
    contestName?: string;
    ratingBefore?: number;
    ratingAfter?: number;
    ratingDelta?: number;
    subject?: string;
    achievementName?: string;
    badgeTier?: string;
  };
};

/* ============ Mock Notifications ============ */

export const notifications: Notification[] = [
  {
    id: 'n1',
    type: 'contest-reminder',
    title: 'Contest starts in 1 hour',
    message: 'Spring Code Sprint 2026 begins at 6:00 PM. Make sure you are ready!',
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    read: false,
    icon: Clock,
    color: 'from-indigo-500 to-indigo-700',
    actionLabel: 'Enter contest',
    actionLink: '/contests/spring-code-sprint-2026',
    meta: { contestName: 'Spring Code Sprint 2026' },
  },
  {
    id: 'n2',
    type: 'rating-change',
    title: 'Your Programming rating increased',
    message: 'You gained +45 rating points in Spring Code Sprint 2026.',
    timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    read: false,
    icon: TrendingUp,
    color: 'from-success-500 to-electric-600',
    actionLabel: 'View rating',
    actionLink: '/profile',
    meta: { ratingBefore: 1797, ratingAfter: 1842, ratingDelta: 45, subject: 'Programming' },
  },
  {
    id: 'n3',
    type: 'achievement-unlocked',
    title: 'Achievement unlocked: Weekly Winner',
    message: 'You won a weekly contest and earned a Gold badge!',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    read: false,
    icon: Trophy,
    color: 'from-sun-400 to-sun-600',
    actionLabel: 'View badges',
    actionLink: '/achievements',
    meta: { achievementName: 'Weekly Winner', badgeTier: 'gold' },
  },
  {
    id: 'n4',
    type: 'submission-result',
    title: 'Submission accepted',
    message: 'Your solution for Problem C — Graph Shortest Path was accepted.',
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    read: true,
    icon: CheckCircle2,
    color: 'from-success-500 to-success-700',
    actionLabel: 'View submission',
    actionLink: '/contests/spring-code-sprint-2026/workspace',
    meta: { contestName: 'Spring Code Sprint 2026' },
  },
  {
    id: 'n5',
    type: 'new-contest',
    title: 'New contest available',
    message: 'Neural Networks Challenge is now open for registration. Teams of up to 3.',
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    read: true,
    icon: Calendar,
    color: 'from-electric-500 to-indigo-600',
    actionLabel: 'Register now',
    actionLink: '/contests/neural-networks-challenge',
  },
  {
    id: 'n6',
    type: 'announcement',
    title: 'Platform update: New question types',
    message: 'We have added Audio and Video question types for language contests. Try them out!',
    timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    read: true,
    icon: Megaphone,
    color: 'from-purple-500 to-pink-600',
    actionLabel: 'Read more',
    actionLink: '/resources',
  },
  {
    id: 'n7',
    type: 'rating-change',
    title: 'Your English rating increased',
    message: 'You gained +62 rating points in Grammar Cup.',
    timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    read: true,
    icon: TrendingUp,
    color: 'from-success-500 to-electric-600',
    actionLabel: 'View rating',
    actionLink: '/profile',
    meta: { ratingBefore: 1788, ratingAfter: 1850, ratingDelta: 62, subject: 'English' },
  },
  {
    id: 'n8',
    type: 'weekly-summary',
    title: 'Your weekly summary',
    message: 'This week you solved 28 problems, participated in 3 contests, and maintained a 45-day streak.',
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    read: true,
    icon: Flame,
    color: 'from-error-500 to-orange-600',
    actionLabel: 'View analytics',
    actionLink: '/analytics',
  },
  {
    id: 'n9',
    type: 'achievement-unlocked',
    title: 'Achievement unlocked: Polymath',
    message: 'You reached 1500+ rating in 5 different subjects!',
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    read: true,
    icon: Award,
    color: 'from-cyan-400 to-electric-600',
    actionLabel: 'View badges',
    actionLink: '/achievements',
    meta: { achievementName: 'Polymath', badgeTier: 'diamond' },
  },
  {
    id: 'n10',
    type: 'submission-result',
    title: 'Submission rejected',
    message: 'Your solution for Problem A — Two Sum exceeded the time limit.',
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    read: true,
    icon: AlertCircle,
    color: 'from-error-500 to-error-700',
    actionLabel: 'View submission',
    actionLink: '/contests/spring-code-sprint-2026/workspace',
  },
];

/* ============ Helpers ============ */

export function getUnreadCount(): number {
  return notifications.filter((n) => !n.read).length;
}

export function getNotificationsByType(type: NotificationType): Notification[] {
  return notifications.filter((n) => n.type === type);
}

export function formatTimeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export const notificationTypeMeta: Record<NotificationType, { label: string; icon: LucideIcon; color: string }> = {
  'contest-reminder': { label: 'Contest Reminders', icon: Clock, color: 'text-indigo-600' },
  'rating-change': { label: 'Rating Changes', icon: TrendingUp, color: 'text-success-600' },
  'submission-result': { label: 'Submission Results', icon: CheckCircle2, color: 'text-electric-600' },
  'achievement-unlocked': { label: 'Achievements', icon: Trophy, color: 'text-sun-600' },
  'new-contest': { label: 'New Contests', icon: Calendar, color: 'text-electric-600' },
  'announcement': { label: 'Announcements', icon: Megaphone, color: 'text-purple-600' },
  'weekly-summary': { label: 'Weekly Summaries', icon: Flame, color: 'text-error-600' },
};
