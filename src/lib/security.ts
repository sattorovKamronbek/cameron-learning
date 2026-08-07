import { supabase } from '@/lib/supabase';
import type { Role } from '@/lib/supabase';
import { CheckCircle2, ShieldCheck, AlertTriangle, type LucideIcon } from 'lucide-react';

export type SecurityFeature = {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  status: 'active' | 'monitoring' | 'attention';
  details: string[];
};

export const statusMeta: Record<SecurityFeature['status'], { label: string; color: string; icon: LucideIcon }> = {
  active: { label: 'Active', color: 'bg-success-500/10 text-success-600', icon: CheckCircle2 },
  monitoring: { label: 'Monitoring', color: 'bg-electric-500/10 text-electric-600', icon: ShieldCheck },
  attention: { label: 'Needs review', color: 'bg-sun-500/10 text-sun-600', icon: AlertTriangle },
};

export const severityColors = {
  low: { bg: 'bg-electric-50', text: 'text-electric-600', ring: 'ring-electric-100' },
  medium: { bg: 'bg-sun-50', text: 'text-sun-600', ring: 'ring-sun-100' },
  high: { bg: 'bg-error-50', text: 'text-error-600', ring: 'ring-error-100' },
} as const;

// Security state must come from the authenticated backend. These empty collections
// deliberately avoid presenting fabricated operational data as real telemetry.
export const securityFeatures: SecurityFeature[] = [];
export const securityEvents: Array<{ id: string; severity: keyof typeof severityColors; type: string; description: string; user: string; contest: string; timestamp: string; resolved: boolean; action: string }> = [];
export const deviceLogs: Array<{ id: string; user: string; lastActive: string; device: string; browser: string; location: string; ipAddress: string; trusted: boolean }> = [];
export const securityCategoryMeta = {};

/* ============ Permission Matrix ============ */

export type Permission =
  | 'admin.access'
  | 'user.view_all'
  | 'user.create'
  | 'user.edit_role'
  | 'user.suspend'
  | 'user.ban'
  | 'user.delete'
  | 'contest.create'
  | 'contest.edit'
  | 'contest.delete'
  | 'problem.create'
  | 'problem.edit'
  | 'problem.delete'
  | 'submission.review'
  | 'submission.flag'
  | 'announcement.publish'
  | 'badge.manage'
  | 'rating.adjust'
  | 'audit.view'
  | 'admin_emails.manage'
  | 'analytics.view';

const PERMISSIONS: Record<Role, Permission[]> = {
  user: [],
  judge: [
    // Ownership is enforced by the database functions. These permissions only
    // control which management affordances the client may display.
    'contest.create',
    'contest.edit',
    'contest.delete',
    'problem.create',
    'problem.edit',
    'submission.review',
    'submission.flag',
    'analytics.view',
  ],
  admin: [
    'admin.access',
    'user.view_all',
    'user.create',
    'user.edit_role',
    'user.suspend',
    'user.ban',
    'user.delete',
    'contest.create',
    'contest.edit',
    'contest.delete',
    'problem.create',
    'problem.edit',
    'problem.delete',
    'submission.review',
    'submission.flag',
    'announcement.publish',
    'badge.manage',
    'rating.adjust',
    'audit.view',
    'admin_emails.manage',
    'analytics.view',
  ],
};

export function hasPermission(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return PERMISSIONS[role]?.includes(permission) ?? false;
}

export function getPermissions(role: Role): Permission[] {
  return PERMISSIONS[role] ?? [];
}

/* ============ Role Metadata ============ */

export const roleMeta: Record<Role, { label: string; color: string; bg: string; ring: string }> = {
  user: { label: 'User', color: 'text-slate-600', bg: 'bg-slate-100', ring: 'ring-slate-200' },
  judge: { label: 'Judge', color: 'text-electric-700', bg: 'bg-electric-100', ring: 'ring-electric-200' },
  admin: { label: 'Admin', color: 'text-purple-700', bg: 'bg-purple-100', ring: 'ring-purple-200' },
};

/* ============ Admin Access Check ============ */

/**
 * Checks if the current authenticated user can access the admin panel.
 * This calls the server-side `can_access_admin()` function which enforces
 * BOTH role='admin' AND email in the admin_emails allowlist.
 */
export async function checkAdminAccess(): Promise<boolean> {
  const { data, error } = await supabase.rpc('can_access_admin');
  if (error) {
    console.error('Admin access check failed:', error.message);
    return false;
  }
  return data === true;
}

/* ============ Audit Logging ============ */

/**
 * Logs an action to the audit_logs table via the SECURITY DEFINER function.
 * This captures the actor's email and role at the time of the action.
 */
export async function logAuditAction(
  action: string,
  targetType?: string,
  targetId?: string,
  details?: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase.rpc('log_audit_action', {
    p_action: action,
    p_target_type: targetType ?? null,
    p_target_id: targetId ?? null,
    p_details: details ?? {},
  });
  if (error) {
    console.error('Failed to log audit action:', error.message);
  }
}

/* ============ Admin User Management RPCs ============ */

export async function adminListUsers() {
  const { data, error } = await supabase.rpc('admin_list_users');
  if (error) throw new Error(error.message);
  return data;
}

export async function adminUpdateUserRole(targetUuid: string, newRole: Role): Promise<void> {
  const { error } = await supabase.rpc('admin_update_user_role', {
    p_target_uuid: targetUuid,
    p_new_role: newRole,
  });
  if (error) throw new Error(error.message);
}

export async function adminUpdateUserStatus(
  targetUuid: string,
  newStatus: 'active' | 'suspended' | 'banned',
  reason?: string,
): Promise<void> {
  const { error } = await supabase.rpc('admin_update_user_status', {
    p_target_uuid: targetUuid,
    p_new_status: newStatus,
    p_reason: reason ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function adminDeleteUser(targetUuid: string): Promise<void> {
  const { error } = await supabase.rpc('admin_delete_user', {
    p_target_uuid: targetUuid,
  });
  if (error) throw new Error(error.message);
}

export async function adminListAuditLogs(limit = 100) {
  const { data, error } = await supabase.rpc('admin_list_audit_logs', { p_limit: limit });
  if (error) throw new Error(error.message);
  return data;
}

export async function adminListAdminEmails() {
  const { data, error } = await supabase.rpc('admin_list_admin_emails');
  if (error) throw new Error(error.message);
  return data;
}

export async function adminAddAdminEmail(email: string): Promise<void> {
  const { error } = await supabase.rpc('admin_add_admin_email', { p_email: email });
  if (error) throw new Error(error.message);
}

export async function adminRemoveAdminEmail(email: string): Promise<void> {
  const { error } = await supabase.rpc('admin_remove_admin_email', { p_email: email });
  if (error) throw new Error(error.message);
}

export async function adminCreateAnnouncement(
  title: string,
  message: string,
  actionLabel?: string,
  actionLink?: string,
): Promise<number> {
  const { data, error } = await supabase.rpc('admin_create_announcement', {
    p_title: title,
    p_message: message,
    p_action_label: actionLabel ?? null,
    p_action_link: actionLink ?? null,
  });
  if (error) throw new Error(error.message);
  return data as number;
}

/* ============ User Activity ============ */

export async function logUserActivity(
  type: string,
  title: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase.from('user_activity').insert({
    type,
    title,
    metadata: metadata ?? {},
  });
  if (error) {
    console.error('Failed to log user activity:', error.message);
  }
}

export async function fetchUserActivity(limit = 20) {
  const { data, error } = await supabase
    .from('user_activity')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data;
}

/* ============ Saved Items ============ */

export async function fetchSavedItems() {
  const { data, error } = await supabase
    .from('saved_items')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function saveItem(
  itemType: 'course' | 'problem' | 'roadmap' | 'article',
  itemSlug: string,
  itemTitle: string,
): Promise<void> {
  const { error } = await supabase.from('saved_items').insert({
    item_type: itemType,
    item_slug: itemSlug,
    item_title: itemTitle,
  });
  if (error) throw new Error(error.message);
}

export async function unsaveItem(itemType: string, itemSlug: string): Promise<void> {
  const { error } = await supabase
    .from('saved_items')
    .delete()
    .eq('item_type', itemType)
    .eq('item_slug', itemSlug);
  if (error) throw new Error(error.message);
}

/* ============ Certificates ============ */

export async function fetchCertificates() {
  const { data, error } = await supabase
    .from('certificates')
    .select('*')
    .order('issued_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

/* ============ App Notifications ============ */

export async function fetchNotifications() {
  const { data, error } = await supabase
    .from('app_notifications')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase
    .from('app_notifications')
    .update({ read: true })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await supabase
    .from('app_notifications')
    .update({ read: true })
    .eq('read', false);
  if (error) throw new Error(error.message);
}
