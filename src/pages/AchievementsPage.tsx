import { useState } from 'react';
import {
  Trophy, Sparkles, Lock, CheckCircle2, Calendar,
  Crown, Medal, Diamond, Flame, Star,
} from 'lucide-react';
import {
  achievements, seasonalBadges,
  badgeTiers, badgeTierOrder,
  achievementCategoryMeta,
  getAchievementStats,
  type Achievement, type AchievementCategory, type BadgeTier, type SeasonalBadge,
} from '@/data/achievements';
import { PageHeader } from '@/components/PageHeader';

export function AchievementsPage() {
  const [filter, setFilter] = useState<AchievementCategory | 'all' | 'unlocked'>('all');
  const stats = getAchievementStats();

  const filteredAchievements = achievements.filter((a) => {
    if (filter === 'all') return true;
    if (filter === 'unlocked') return a.unlocked;
    return a.category === filter;
  });

  return (
    <div className="container-page py-10">
      <PageHeader
        eyebrow="Achievements"
        title="Badges & Achievements"
        description="Earn badges by mastering subjects, winning contests, and maintaining streaks. Show off your collection to the community."
      />

      {/* Progress summary */}
      <div className="mt-8 card overflow-hidden">
        <div className="relative bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 p-6 text-white">
          <div className="absolute inset-0 bg-grid-dark opacity-5" />
          <div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-purple-600/20 blur-3xl" />
          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Achievement Progress</p>
              <p className="mt-2 font-display text-4xl font-extrabold tabular-nums">
                {stats.unlocked}<span className="text-2xl text-slate-400">/{stats.total}</span>
              </p>
              <p className="text-sm text-slate-400">{stats.progress}% completed</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Seasonal Badges</p>
              <p className="mt-2 font-display text-4xl font-extrabold tabular-nums">
                {stats.seasonalEarned}<span className="text-2xl text-slate-400">/{stats.seasonalTotal}</span>
              </p>
            </div>
          </div>
          {/* Progress bar */}
          <div className="relative mt-4 h-3 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-sun-500 transition-all duration-1000"
              style={{ width: `${stats.progress}%` }}
            />
          </div>
        </div>

        {/* Badge tier legend */}
        <div className="flex flex-wrap items-center gap-3 p-4">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Badge Tiers:</span>
          {badgeTierOrder.map((tier) => {
            const meta = badgeTiers[tier];
            const Icon = meta.icon;
            return (
              <span key={tier} className={`chip ${meta.bg} ${meta.text} ring-1 ${meta.ring}`}>
                <Icon className="h-3 w-3" />
                {meta.name}
              </span>
            );
          })}
        </div>
      </div>

      {/* Seasonal Badges */}
      <div className="mt-8">
        <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900">
          <Sparkles className="h-5 w-5 text-purple-500" />
          Seasonal Event Badges
        </h3>
        <p className="mt-1 text-sm text-slate-500">Limited-time badges from special events and competitions.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {seasonalBadges.map((badge) => (
            <SeasonalBadgeCard key={badge.id} badge={badge} />
          ))}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="mt-10 flex flex-wrap gap-2">
        <FilterChip label="All" active={filter === 'all'} onClick={() => setFilter('all')} />
        <FilterChip label="Unlocked" active={filter === 'unlocked'} onClick={() => setFilter('unlocked')} icon={CheckCircle2} />
        <div className="mx-1 h-6 w-px bg-slate-200" />
        {(Object.keys(achievementCategoryMeta) as AchievementCategory[]).map((cat) => {
          const meta = achievementCategoryMeta[cat];
          return (
            <FilterChip
              key={cat}
              label={meta.label}
              active={filter === cat}
              onClick={() => setFilter(cat)}
              icon={meta.icon}
            />
          );
        })}
      </div>

      {/* Achievement grid */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredAchievements.map((achievement) => (
          <AchievementCard key={achievement.id} achievement={achievement} />
        ))}
      </div>
    </div>
  );
}

/* ============ Achievement Card ============ */

function AchievementCard({ achievement }: { achievement: Achievement }) {
  const tier = badgeTiers[achievement.tier];
  const Icon = achievement.icon;
  const progressPct = Math.min(100, Math.round((achievement.progress / achievement.maxProgress) * 100));

  return (
    <div
      className={`card relative overflow-hidden p-5 transition-all duration-300 ${
        achievement.unlocked ? `hover:-translate-y-1 hover:shadow-lift ${tier.glow}` : 'opacity-90'
      }`}
    >
      {/* Background glow for unlocked */}
      {achievement.unlocked && (
        <div className={`absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gradient-to-br ${tier.gradient} opacity-10 blur-2xl`} />
      )}

      <div className="relative flex items-start gap-4">
        {/* Badge icon */}
        <div
          className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl ${
            achievement.unlocked
              ? `bg-gradient-to-br ${tier.gradient} ${tier.glow}`
              : 'bg-slate-100'
          }`}
        >
          {achievement.unlocked ? (
            <Icon className="h-7 w-7 text-white" />
          ) : (
            <Lock className="h-6 w-6 text-slate-400" />
          )}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className={`text-sm font-bold ${achievement.unlocked ? 'text-slate-900' : 'text-slate-500'}`}>
              {achievement.name}
            </h4>
            <span className={`chip text-[10px] ${tier.bg} ${tier.text} ring-1 ${tier.ring}`}>
              {tier.name}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">{achievement.description}</p>

          {achievement.unlocked ? (
            <div className="mt-3 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success-500" />
              <span className="text-xs font-bold text-success-600">Unlocked</span>
              {achievement.date && (
                <span className="text-xs text-slate-400">
                  · {new Date(achievement.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              )}
            </div>
          ) : (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-500">
                  {achievement.progress} / {achievement.maxProgress}
                </span>
                <span className="font-bold text-slate-400">{progressPct}%</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${tier.gradient} transition-all duration-700`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============ Seasonal Badge Card ============ */

function SeasonalBadgeCard({ badge }: { badge: SeasonalBadge }) {
  const Icon = badge.icon;
  return (
    <div
      className={`card relative overflow-hidden p-5 transition-all duration-300 ${
        badge.earned ? `hover:-translate-y-1 hover:shadow-lift ${badge.glow}` : 'opacity-75'
      }`}
    >
      {badge.earned && (
        <div className={`absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gradient-to-br ${badge.gradient} opacity-10 blur-2xl`} />
      )}

      <div className="relative flex items-center gap-4">
        <div
          className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl ${
            badge.earned ? `bg-gradient-to-br ${badge.gradient} ${badge.glow}` : 'bg-slate-100'
          }`}
        >
          {badge.earned ? (
            <Icon className="h-7 w-7 text-white" />
          ) : (
            <Lock className="h-6 w-6 text-slate-400" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h4 className={`text-sm font-bold ${badge.earned ? 'text-slate-900' : 'text-slate-500'}`}>{badge.name}</h4>
          <p className="text-xs text-slate-500">{badge.description}</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="chip bg-slate-100 text-slate-500 text-[10px]">{badge.season}</span>
            {badge.earned ? (
              <span className="flex items-center gap-1 text-xs font-bold text-success-600">
                <CheckCircle2 className="h-3 w-3" />Earned
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs font-bold text-slate-400">
                <Lock className="h-3 w-3" />Locked
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============ Filter Chip ============ */

function FilterChip({
  label, active, onClick, icon: Icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon?: typeof Trophy;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-2xl px-3.5 py-2 text-xs font-bold transition-all ${
        active
          ? 'bg-gradient-to-r from-indigo-500 to-electric-500 text-white shadow-soft'
          : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-slate-300 hover:bg-slate-50'
      }`}
    >
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}
