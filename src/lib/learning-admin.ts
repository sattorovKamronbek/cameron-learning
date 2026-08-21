import { supabase } from '@/lib/supabase';

type JsonRecord = Record<string, unknown>;

export type AdminLearningSkill = { id: string; slug: string; name: string; parent_skill_id: string | null; sort_order: number; is_active: boolean };
export type AdminLearningAchievement = { id: string; slug: string; name: string; rarity: string; xp_reward: number; is_active: boolean; is_hidden: boolean };
export type AdminLearningMission = { id: string; slug: string; title: string; mission_type: string; target_value: number; xp_reward: number; is_active: boolean };
export type AdminLearningXpRule = { source_type: string; xp_amount: number; is_active: boolean };
export type AdminLearningSystem = { skills: AdminLearningSkill[]; achievements: AdminLearningAchievement[]; missions: AdminLearningMission[]; xpRules: AdminLearningXpRule[] };

function object(value: unknown): JsonRecord { return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}; }
function list(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function text(value: unknown): string { return typeof value === 'string' ? value : ''; }
function nullableText(value: unknown): string | null { return typeof value === 'string' ? value : null; }
function number(value: unknown): number { return typeof value === 'number' ? value : 0; }
function boolean(value: unknown): boolean { return value === true; }

export async function fetchAdminLearningSystem(): Promise<AdminLearningSystem> {
  const { data, error } = await supabase.rpc('admin_get_learning_system');
  if (error) throw new Error(error.message);
  const value = object(data);
  return {
    skills: list(value.skills).map((entry) => { const item = object(entry); return { id: text(item.id), slug: text(item.slug), name: text(item.name), parent_skill_id: nullableText(item.parent_skill_id), sort_order: number(item.sort_order), is_active: boolean(item.is_active) }; }),
    achievements: list(value.achievements).map((entry) => { const item = object(entry); return { id: text(item.id), slug: text(item.slug), name: text(item.name), rarity: text(item.rarity), xp_reward: number(item.xp_reward), is_active: boolean(item.is_active), is_hidden: boolean(item.is_hidden) }; }),
    missions: list(value.missions).map((entry) => { const item = object(entry); return { id: text(item.id), slug: text(item.slug), title: text(item.title), mission_type: text(item.mission_type), target_value: number(item.target_value), xp_reward: number(item.xp_reward), is_active: boolean(item.is_active) }; }),
    xpRules: list(value.xpRules).map((entry) => { const item = object(entry); return { source_type: text(item.source_type), xp_amount: number(item.xp_amount), is_active: boolean(item.is_active) }; }),
  };
}

export async function updateAdminLearningXpRule(sourceType: string, xpAmount: number, isActive: boolean): Promise<void> {
  const { error } = await supabase.rpc('admin_update_learning_xp_rule', { p_source_type: sourceType, p_xp_amount: xpAmount, p_is_active: isActive });
  if (error) throw new Error(error.message);
}
