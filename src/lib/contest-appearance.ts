const subjectGradients: Record<string, string> = {
  programming: 'from-indigo-600 to-electric-600',
  science: 'from-cyan-600 to-blue-700',
  mathematics: 'from-electric-500 to-cyan-600',
  physics: 'from-violet-600 to-indigo-700',
  chemistry: 'from-emerald-500 to-teal-700',
  biology: 'from-success-500 to-emerald-700',
  english: 'from-sky-500 to-electric-700',
  ielts: 'from-amber-500 to-orange-600',
  cefr: 'from-emerald-500 to-teal-700',
  'ai-ml': 'from-fuchsia-600 to-indigo-700',
  'data-science': 'from-cyan-600 to-blue-700',
};

export function subjectGradient(subjectSlug: string): string {
  return subjectGradients[subjectSlug] ?? 'from-slate-600 to-slate-800';
}
