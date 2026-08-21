import { supabase } from '@/lib/supabase';

type JsonRecord = Record<string, unknown>;

export type LevelProgress = {
  level: number;
  currentLevelXp: number;
  xpForNextLevel: number;
  progressPercent: number;
};

export type LearningSkill = {
  id: string;
  slug: string;
  name: string;
  description?: string;
  icon: string;
  parentSkillId: string | null;
  sortOrder: number;
  xp: number;
  mastery: number;
  level: number;
  locked: boolean;
  prerequisites: LearningSkillPrerequisite[];
};

export type LearningSkillPrerequisite = {
  skillId: string;
  name: string;
  requiredMastery: number;
  currentMastery: number;
};

export type LearningActivityDay = {
  date: string;
  effort: number;
};

export type LearningAchievement = {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  xpReward: number;
  earnedAt: string | null;
  progress: number;
  target: number;
  isEarned: boolean;
};

export type LearningMission = {
  id: string;
  slug: string;
  title: string;
  description: string;
  missionType: 'daily' | 'weekly';
  targetValue: number;
  xpReward: number;
  currentValue: number;
  completedAt: string | null;
  expiresAt: string;
};

export type LearningLeaderboardEntry = {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  level: number;
  xp: number;
  mastery: number;
};

export type LearningDashboard = {
  totalXp: number;
  levelProgress: LevelProgress;
  streak: { current: number; longest: number; lastActivityDate: string | null };
  skills: LearningSkill[];
  activity: LearningActivityDay[];
  recentAchievements: LearningAchievement[];
};

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function record(value: unknown): JsonRecord {
  return isRecord(value) ? value : {};
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function nullableText(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function number(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function boolean(value: unknown): boolean {
  return value === true;
}

function achievement(value: unknown): LearningAchievement {
  const item = record(value);
  const rarity = text(item.rarity, 'common');
  return {
    id: text(item.id),
    slug: text(item.slug),
    name: text(item.name, 'Achievement'),
    description: text(item.description),
    icon: text(item.icon, 'Award'),
    category: text(item.category, 'learning'),
    rarity: rarity === 'rare' || rarity === 'epic' || rarity === 'legendary' ? rarity : 'common',
    xpReward: number(item.xpReward),
    earnedAt: nullableText(item.earnedAt),
    progress: number(item.progress),
    target: Math.max(1, number(item.target, 1)),
    isEarned: boolean(item.isEarned),
  };
}

function skill(value: unknown): LearningSkill {
  const item = record(value);
  return {
    id: text(item.id),
    slug: text(item.slug),
    name: text(item.name, 'Skill'),
    description: text(item.description) || undefined,
    icon: text(item.icon, 'Sparkles'),
    parentSkillId: nullableText(item.parentSkillId),
    sortOrder: number(item.sortOrder),
    xp: number(item.xp),
    mastery: number(item.mastery),
    level: Math.max(1, number(item.level, 1)),
    locked: boolean(item.locked),
    prerequisites: list(item.prerequisites).map((prerequisite) => {
      const requirement = record(prerequisite);
      return {
        skillId: text(requirement.skillId),
        name: text(requirement.name, 'Required skill'),
        requiredMastery: number(requirement.requiredMastery),
        currentMastery: number(requirement.currentMastery),
      };
    }),
  };
}

function levelProgress(value: unknown): LevelProgress {
  const item = record(value);
  return {
    level: Math.max(1, number(item.level, 1)),
    currentLevelXp: number(item.currentLevelXp),
    xpForNextLevel: number(item.xpForNextLevel),
    progressPercent: Math.min(100, Math.max(0, number(item.progressPercent))),
  };
}

function dashboard(value: unknown): LearningDashboard {
  const item = record(value);
  const streak = record(item.streak);
  return {
    totalXp: number(item.totalXp),
    levelProgress: levelProgress(item.levelProgress),
    streak: {
      current: number(streak.current),
      longest: number(streak.longest),
      lastActivityDate: nullableText(streak.lastActivityDate),
    },
    skills: list(item.skills).map(skill),
    activity: list(item.activity).map((day) => {
      const item = record(day);
      return { date: text(item.date), effort: number(item.effort) };
    }).filter((day) => day.date.length > 0),
    recentAchievements: list(item.recentAchievements).map(achievement),
  };
}

function mission(value: unknown): LearningMission {
  const item = record(value);
  const missionType = text(item.missionType);
  return {
    id: text(item.id),
    slug: text(item.slug),
    title: text(item.title, 'Mission'),
    description: text(item.description),
    missionType: missionType === 'weekly' ? 'weekly' : 'daily',
    targetValue: Math.max(1, number(item.targetValue, 1)),
    xpReward: number(item.xpReward),
    currentValue: number(item.currentValue),
    completedAt: nullableText(item.completedAt),
    expiresAt: text(item.expiresAt),
  };
}

function rpcError(error: { message: string } | null, fallback: string): never | void {
  if (error) throw new Error(error.message || fallback);
}

export async function fetchLearningDashboard(): Promise<LearningDashboard> {
  const { data, error } = await supabase.rpc('get_my_learning_dashboard');
  rpcError(error, 'Learning dashboard could not be loaded.');
  return dashboard(data);
}

export async function fetchLearningSkillTree(): Promise<LearningSkill[]> {
  const { data, error } = await supabase.rpc('get_my_learning_skill_tree');
  rpcError(error, 'Skills could not be loaded.');
  return list(data).map(skill);
}

export async function fetchLearningMissions(): Promise<LearningMission[]> {
  const { data, error } = await supabase.rpc('get_my_learning_missions');
  rpcError(error, 'Missions could not be loaded.');
  return list(data).map(mission);
}

export async function fetchLearningAchievements(): Promise<LearningAchievement[]> {
  const { data, error } = await supabase.rpc('get_my_learning_achievements');
  rpcError(error, 'Achievements could not be loaded.');
  return list(data).map(achievement);
}

export async function fetchLearningLeaderboard(scope: string, limit = 50, offset = 0): Promise<LearningLeaderboardEntry[]> {
  const { data, error } = await supabase.rpc('get_learning_leaderboard', {
    p_scope: scope,
    p_limit: limit,
    p_offset: offset,
  });
  rpcError(error, 'Learning leaderboard could not be loaded.');
  return list(data).map((entry) => {
    const item = record(entry);
    return {
      rank: number(item.rank),
      userId: text(item.user_id),
      displayName: text(item.display_name, 'Cameron learner'),
      avatarUrl: nullableText(item.avatar_url),
      level: Math.max(1, number(item.level, 1)),
      xp: number(item.xp),
      mastery: number(item.mastery),
    };
  });
}

export function formatXp(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}
