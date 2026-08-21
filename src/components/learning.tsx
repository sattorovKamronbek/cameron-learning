import { Award, Flame, LockKeyhole, Sparkles, Trophy } from 'lucide-react';
import type { LearningAchievement, LearningActivityDay, LearningMission, LearningSkill, LevelProgress } from '@/lib/learning';
import { formatXp } from '@/lib/learning';

export function LevelProgressCard({ levelProgress, totalXp, compact = false }: { levelProgress: LevelProgress; totalXp: number; compact?: boolean }) {
  const current = formatXp(levelProgress.currentLevelXp);
  const required = formatXp(levelProgress.xpForNextLevel);
  return (
    <div className={compact ? '' : 'card p-5'}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Cameron level</p>
          <p className="mt-1 font-display text-3xl font-extrabold text-slate-900">Level {levelProgress.level}</p>
        </div>
        <p className="text-right text-sm font-bold tabular-nums text-slate-700">{formatXp(totalXp)} XP</p>
      </div>
      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100" aria-label={`Level progress: ${levelProgress.progressPercent}%`}>
        <div className="h-full rounded-full bg-indigo-600 transition-[width] duration-500" style={{ width: `${levelProgress.progressPercent}%` }} />
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {levelProgress.xpForNextLevel > 0 ? `${current} / ${required} XP to the next level` : 'Maximum level reached'}
      </p>
    </div>
  );
}

export function SkillProgressBar({ skill, showXp = true }: { skill: Pick<LearningSkill, 'name' | 'mastery' | 'xp' | 'level'>; showXp?: boolean }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-bold text-slate-800">{skill.name}</p>
        <p className="shrink-0 text-xs font-semibold tabular-nums text-slate-500">{skill.mastery}%</p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-electric-500" style={{ width: `${skill.mastery}%` }} />
      </div>
      {showXp && <p className="mt-1.5 text-xs text-slate-400">Level {skill.level} · {formatXp(skill.xp)} XP</p>}
    </div>
  );
}

const rarityClasses: Record<LearningAchievement['rarity'], string> = {
  common: 'border-slate-200 bg-slate-50 text-slate-700',
  rare: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  epic: 'border-violet-200 bg-violet-50 text-violet-700',
  legendary: 'border-sun-200 bg-sun-50 text-sun-700',
};

export function AchievementCard({ achievement }: { achievement: LearningAchievement }) {
  const percent = Math.min(100, Math.round((achievement.progress / achievement.target) * 100));
  return (
    <article className={`rounded-2xl border p-4 ${achievement.isEarned ? rarityClasses[achievement.rarity] : 'border-slate-200 bg-white text-slate-600'}`}>
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/70 ring-1 ring-black/5">
          <Award className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900">{achievement.name}</h3>
            <span className="text-[10px] font-extrabold uppercase tracking-wider">{achievement.rarity}</span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">{achievement.description}</p>
          {achievement.isEarned ? (
            <p className="mt-3 text-xs font-semibold text-slate-600">Earned {achievement.earnedAt ? new Date(achievement.earnedAt).toLocaleDateString() : ''}</p>
          ) : (
            <>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-slate-500" style={{ width: `${percent}%` }} /></div>
              <p className="mt-1.5 text-xs text-slate-500">{Math.min(achievement.progress, achievement.target)} / {achievement.target}</p>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

export function MissionCard({ mission }: { mission: LearningMission }) {
  const completed = Boolean(mission.completedAt);
  const percent = Math.min(100, Math.round((mission.currentValue / mission.targetValue) * 100));
  const expires = mission.expiresAt ? new Date(mission.expiresAt).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : 'soon';
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${completed ? 'bg-success-50 text-success-700' : 'bg-indigo-50 text-indigo-700'}`}>
          {completed ? <Trophy className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3"><h3 className="text-sm font-bold text-slate-900">{mission.title}</h3><span className="shrink-0 text-xs font-bold text-indigo-700">+{mission.xpReward} XP</span></div>
          {mission.description && <p className="mt-1 text-xs leading-relaxed text-slate-500">{mission.description}</p>}
          <div className="mt-4 flex items-center justify-between text-xs"><span className="font-semibold text-slate-600">{Math.min(mission.currentValue, mission.targetValue)} / {mission.targetValue}</span><span className={completed ? 'font-bold text-success-700' : 'text-slate-400'}>{completed ? 'Completed' : `Ends ${expires}`}</span></div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${completed ? 'bg-success-500' : 'bg-indigo-600'}`} style={{ width: `${percent}%` }} /></div>
        </div>
      </div>
    </article>
  );
}

export function StreakCard({ current, longest }: { current: number; longest: number }) {
  return (
    <div className="card p-5">
      <Flame className="h-6 w-6 text-sun-500" />
      <p className="mt-4 font-display text-2xl font-extrabold tabular-nums text-slate-900">{current} day{current === 1 ? '' : 's'}</p>
      <p className="mt-1 text-sm font-bold text-slate-700">Current streak</p>
      <p className="mt-1 text-xs text-slate-400">Longest: {longest} day{longest === 1 ? '' : 's'}</p>
    </div>
  );
}

export function ActivityHeatmap({ activity }: { activity: LearningActivityDay[] }) {
  const effortByDate = new Map(activity.map((item) => [item.date, item.effort]));
  const maxEffort = Math.max(...activity.map((item) => item.effort), 1);
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - 364);
  const cells = Array.from({ length: 365 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    const key = day.toISOString().slice(0, 10);
    const effort = effortByDate.get(key) ?? 0;
    const intensity = effort === 0 ? 0 : Math.min(4, Math.ceil((effort / maxEffort) * 4));
    return { key, effort, intensity };
  });
  const colors = ['bg-slate-100', 'bg-indigo-100', 'bg-indigo-300', 'bg-indigo-500', 'bg-indigo-700'];
  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-slate-900">Learning activity</h2><p className="mt-1 text-sm text-slate-500">Verified learning activity in the last year.</p></div><span className="text-xs text-slate-400">Less <span className="mx-1 inline-flex gap-0.5 align-middle">{colors.map((color) => <i key={color} className={`h-3 w-3 rounded-sm ${color}`} />)}</span> More</span></div>
      <div className="mt-5 overflow-x-auto pb-1"><div className="grid w-max grid-flow-col grid-rows-7 gap-1" aria-label="Learning activity heatmap">{cells.map((cell) => <span key={cell.key} title={`${cell.key}: ${cell.effort} XP from verified activity`} aria-label={`${cell.key}: ${cell.effort} XP from verified activity`} className={`h-3 w-3 rounded-[3px] ${colors[cell.intensity]}`} />)}</div></div>
    </section>
  );
}

export function SkillTreeNode({ skill }: { skill: LearningSkill }) {
  return (
    <article className={`rounded-2xl border p-4 ${skill.locked ? 'border-slate-200 bg-slate-50' : skill.mastery >= 100 ? 'border-success-200 bg-success-50/40' : 'border-indigo-100 bg-white'}`}>
      <div className="flex items-start gap-3"><div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${skill.locked ? 'bg-slate-200 text-slate-500' : 'bg-indigo-50 text-indigo-700'}`}>{skill.locked ? <LockKeyhole className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}</div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><h3 className="text-sm font-bold text-slate-900">{skill.name}</h3><span className="text-xs font-bold tabular-nums text-slate-500">{skill.mastery}%</span></div>{skill.description && <p className="mt-1 text-xs leading-relaxed text-slate-500">{skill.description}</p>}<div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${skill.locked ? 'bg-slate-300' : 'bg-electric-500'}`} style={{ width: `${skill.mastery}%` }} /></div>{skill.locked && skill.prerequisites.length > 0 ? <p className="mt-2 text-xs text-slate-500">Reach {skill.prerequisites[0].requiredMastery}% in {skill.prerequisites[0].name} to unlock.</p> : <p className="mt-2 text-xs text-slate-400">Level {skill.level} · {formatXp(skill.xp)} XP</p>}</div></div>
    </article>
  );
}
