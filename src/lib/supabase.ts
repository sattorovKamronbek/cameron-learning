import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY must be configured before starting the application.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/* ============ Core Types ============ */

export type Plan = 'free' | 'pro' | 'max';

export type Role = 'user' | 'judge' | 'admin';

export type UserStatus = 'active' | 'suspended' | 'banned';

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  plan: Plan;
  role: Role;
  bio: string | null;
  status: UserStatus;
  suspended_reason: string | null;
  suspended_at: string | null;
  country: string | null;
  school: string | null;
  preferences: Record<string, unknown>;
  email_verified_at: string | null;
  created_at: string;
  updated_at: string;
};

/* ============ Activity ============ */

export type UserActivity = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

/* ============ Saved Items ============ */

export type SavedItemType = 'course' | 'problem' | 'roadmap' | 'article';

export type SavedItem = {
  id: string;
  user_id: string;
  item_type: SavedItemType;
  item_slug: string;
  item_title: string;
  created_at: string;
};

/* ============ Certificates ============ */

export type Certificate = {
  id: string;
  user_id: string;
  title: string;
  course_slug: string | null;
  score: number | null;
  issued_at: string;
};

/* ============ App Notifications ============ */

export type AppNotification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  action_label: string | null;
  action_link: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

/* ============ Audit Logs ============ */

export type AuditLog = {
  id: string;
  actor_id: string;
  actor_email: string;
  actor_role: Role;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

/* ============ Admin Emails ============ */

export type AdminEmail = {
  id: string;
  email: string;
  added_by: string | null;
  created_at: string;
};

/* ============ Admin User View (from admin_list_users RPC) ============ */

export type AdminUserView = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: Role;
  status: UserStatus;
  plan: Plan;
  country: string | null;
  school: string | null;
  created_at: string;
  suspended_reason: string | null;
  suspended_at: string | null;
};
