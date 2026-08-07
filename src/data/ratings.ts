import type { LucideIcon } from 'lucide-react';
import {
  Code2, Sigma, Atom, FlaskConical, BookOpen, Languages, GraduationCap,
  Brain, Shield, LineChart, Scale, Globe, MapPin, ClipboardList,
} from 'lucide-react';

export type RatingColor = 'gray' | 'green' | 'cyan' | 'blue' | 'purple' | 'orange' | 'red';

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

/* Static subject labels/icons only; rating values themselves come from RPCs. */

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
