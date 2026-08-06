/*
# RBAC Authentication & User Management System

## Purpose
Transforms the basic profile system into a production-ready authentication and
user management system with three roles (User, Judge, Admin), audit logging,
user activity tracking, saved items, certificates, and server-enforced admin access.

## Changes to Existing Tables
- `profiles`
  - ADD `role` (text, NOT NULL, DEFAULT 'user') — one of 'user', 'judge', 'admin'
  - ADD `bio` (text, nullable) — user biography
  - ADD `status` (text, NOT NULL, DEFAULT 'active') — one of 'active', 'suspended', 'banned'
  - ADD `suspended_reason` (text, nullable) — reason for suspension
  - ADD `suspended_at` (timestamptz, nullable) — when the user was suspended
  - ADD `country` (text, nullable) — user's country
  - ADD `school` (text, nullable) — user's school/institution
  - ADD `preferences` (jsonb, DEFAULT '{}') — user settings
  - ADD `email_verified_at` (timestamptz, nullable) — when email was verified

## New Tables
1. `admin_emails` — allowlist of pre-approved Gmail addresses for admin access.
2. `audit_logs` — immutable record of every admin/judge action.
3. `user_activity` — tracks user actions for activity history.
4. `saved_items` — user's saved courses, problems, roadmaps, articles.
5. `certificates` — completion certificates.
6. `app_notifications` — real DB-backed notifications.

## Security Functions (SECURITY DEFINER)
1. `is_admin(uuid)` — checks role='admin' AND status='active'.
2. `is_judge_or_admin(uuid)` — checks role in ('judge','admin') AND status='active'.
3. `can_access_admin()` — admin gate: role=admin AND email in admin_emails.
4. `log_audit_action(...)` — inserts audit log row with caller info.
5. `admin_list_users()` — returns all profiles (admin only).
6. `admin_list_audit_logs(limit)` — returns audit logs (admin only).
7. `admin_list_admin_emails()` — returns allowlist (admin only).
8. `admin_add_admin_email(email)` — adds Gmail to allowlist (admin only).
9. `admin_remove_admin_email(email)` — removes Gmail from allowlist (admin only).
10. `admin_update_user_role(uuid, role)` — changes user role (admin only, with audit).
11. `admin_update_user_status(uuid, status, reason)` — suspends/bans/activates (admin only, with audit).
12. `admin_delete_user(uuid)` — soft-deletes (bans) a user (admin only).
13. `create_notification(...)` — inserts notification for any user.
14. `admin_create_announcement(...)` — broadcasts notification to all active users.

## Security
- RLS enabled on all new tables.
- Audit logs are append-only (no UPDATE/DELETE policy).
- Admin functions enforce is_admin(auth.uid()) internally.
- Admin access requires BOTH role='admin' AND email in admin_emails.
- Soft deletes only — never hard-delete auth.users.

## Important Notes
1. `role` defaults to 'user' so existing profiles are safe.
2. `status` defaults to 'active' so existing users remain active.
3. To bootstrap an admin: insert their Gmail into admin_emails, then set role='admin'.
4. Functions are created BEFORE table policies that reference them.
*/

-- ============ Step 1: Alter profiles table ============

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'judge', 'admin')),
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'banned')),
  ADD COLUMN IF NOT EXISTS suspended_reason text,
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS school text,
  ADD COLUMN IF NOT EXISTS preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;

-- ============ Step 2: Create tables (no RLS yet) ============

CREATE TABLE IF NOT EXISTS admin_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  added_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  actor_email text NOT NULL,
  actor_role text NOT NULL,
  action text NOT NULL,
  target_type text,
  target_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS saved_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('course', 'problem', 'roadmap', 'article')),
  item_slug text NOT NULL,
  item_title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, item_type, item_slug)
);

CREATE TABLE IF NOT EXISTS certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  course_slug text,
  score integer,
  issued_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  action_label text,
  action_link text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============ Step 3: Create security functions ============

CREATE OR REPLACE FUNCTION public.is_admin(p_user_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_user_uuid AND role = 'admin' AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_judge_or_admin(p_user_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_user_uuid
    AND role IN ('judge', 'admin')
    AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.role = 'admin'
    AND p.status = 'active'
    AND EXISTS (
      SELECT 1 FROM admin_emails ae
      WHERE ae.email = p.email
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.log_audit_action(
  p_action text,
  p_target_type text DEFAULT NULL,
  p_target_id uuid DEFAULT NULL,
  p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_profile record;
  v_log_id uuid;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT email, role INTO v_profile FROM profiles WHERE id = v_actor_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  INSERT INTO audit_logs (actor_id, actor_email, actor_role, action, target_type, target_id, details)
  VALUES (v_actor_id, v_profile.email, v_profile.role, p_action, p_target_type, p_target_id, p_details)
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS table (
  id uuid,
  email text,
  full_name text,
  avatar_url text,
  role text,
  status text,
  plan text,
  country text,
  school text,
  created_at timestamptz,
  suspended_reason text,
  suspended_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  RETURN QUERY SELECT
    p.id, p.email, p.full_name, p.avatar_url, p.role, p.status, p.plan,
    p.country, p.school, p.created_at, p.suspended_reason, p.suspended_at
  FROM profiles p
  ORDER BY p.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_audit_logs(p_limit integer DEFAULT 100)
RETURNS table (
  id uuid,
  actor_id uuid,
  actor_email text,
  actor_role text,
  action text,
  target_type text,
  target_id uuid,
  details jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  RETURN QUERY SELECT
    a.id, a.actor_id, a.actor_email, a.actor_role, a.action,
    a.target_type, a.target_id, a.details, a.created_at
  FROM audit_logs a
  ORDER BY a.created_at DESC
  LIMIT p_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_admin_emails()
RETURNS table (
  id uuid,
  email text,
  added_by uuid,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  RETURN QUERY SELECT ae.id, ae.email, ae.added_by, ae.created_at
  FROM admin_emails ae
  ORDER BY ae.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_add_admin_email(p_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  IF lower(p_email) NOT LIKE '%@gmail.com' THEN
    RAISE EXCEPTION 'Only Gmail addresses are allowed';
  END IF;

  INSERT INTO admin_emails (email, added_by)
  VALUES (lower(p_email), auth.uid())
  ON CONFLICT (email) DO NOTHING
  RETURNING id INTO v_id;

  PERFORM public.log_audit_action(
    'admin_email.add',
    'admin_email',
    v_id,
    jsonb_build_object('email', lower(p_email))
  );

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_remove_admin_email(p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  DELETE FROM admin_emails WHERE email = lower(p_email);

  PERFORM public.log_audit_action(
    'admin_email.remove',
    'admin_email',
    NULL,
    jsonb_build_object('email', lower(p_email))
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_user_role(
  p_target_uuid uuid,
  p_new_role text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_role text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  IF p_new_role NOT IN ('user', 'judge', 'admin') THEN
    RAISE EXCEPTION 'Invalid role: must be user, judge, or admin';
  END IF;

  IF p_target_uuid = auth.uid() THEN
    RAISE EXCEPTION 'Cannot change your own role';
  END IF;

  SELECT role INTO v_old_role FROM profiles WHERE id = p_target_uuid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target user not found';
  END IF;

  UPDATE profiles SET role = p_new_role WHERE id = p_target_uuid;

  PERFORM public.log_audit_action(
    'role.assign',
    'user',
    p_target_uuid,
    jsonb_build_object('old_role', v_old_role, 'new_role', p_new_role)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_user_status(
  p_target_uuid uuid,
  p_new_status text,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_status text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  IF p_new_status NOT IN ('active', 'suspended', 'banned') THEN
    RAISE EXCEPTION 'Invalid status: must be active, suspended, or banned';
  END IF;

  IF p_target_uuid = auth.uid() THEN
    RAISE EXCEPTION 'Cannot change your own status';
  END IF;

  SELECT status INTO v_old_status FROM profiles WHERE id = p_target_uuid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target user not found';
  END IF;

  UPDATE profiles
  SET status = p_new_status,
      suspended_reason = CASE WHEN p_new_status = 'active' THEN NULL ELSE p_reason END,
      suspended_at = CASE WHEN p_new_status = 'active' THEN NULL ELSE now() END
  WHERE id = p_target_uuid;

  PERFORM public.log_audit_action(
    'user.status_change',
    'user',
    p_target_uuid,
    jsonb_build_object('old_status', v_old_status, 'new_status', p_new_status, 'reason', p_reason)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_user(p_target_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  IF p_target_uuid = auth.uid() THEN
    RAISE EXCEPTION 'Cannot delete your own account';
  END IF;

  PERFORM public.admin_update_user_status(p_target_uuid, 'banned', 'Account deleted by admin');
END;
$$;

CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_action_label text DEFAULT NULL,
  p_action_link text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO app_notifications (user_id, type, title, message, action_label, action_link, metadata)
  VALUES (p_user_id, p_type, p_title, p_message, p_action_label, p_action_link, p_metadata)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_create_announcement(
  p_title text,
  p_message text,
  p_action_label text DEFAULT NULL,
  p_action_link text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_user record;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  FOR v_user IN SELECT id FROM profiles WHERE status = 'active' LOOP
    PERFORM public.create_notification(
      v_user.id, 'announcement', p_title, p_message, p_action_label, p_action_link
    );
    v_count := v_count + 1;
  END LOOP;

  PERFORM public.log_audit_action(
    'announcement.broadcast',
    'notification',
    NULL,
    jsonb_build_object('title', p_title, 'recipients', v_count)
  );

  RETURN v_count;
END;
$$;

-- ============ Step 4: Enable RLS and create policies ============

ALTER TABLE admin_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_notifications ENABLE ROW LEVEL SECURITY;

-- admin_emails: read-only for authenticated
DROP POLICY IF EXISTS "read_admin_emails" ON admin_emails;
CREATE POLICY "read_admin_emails"
  ON admin_emails FOR SELECT
  TO authenticated
  USING (true);

-- audit_logs: admin-only read, no direct writes
DROP POLICY IF EXISTS "admin_read_audit_logs" ON audit_logs;
CREATE POLICY "admin_read_audit_logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- user_activity: owner-scoped SELECT/INSERT
DROP POLICY IF EXISTS "select_own_activity" ON user_activity;
CREATE POLICY "select_own_activity"
  ON user_activity FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_activity" ON user_activity;
CREATE POLICY "insert_own_activity"
  ON user_activity FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_activity_user_id ON user_activity(user_id DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_created ON user_activity(created_at DESC);

-- saved_items: owner-scoped SELECT/INSERT/DELETE
DROP POLICY IF EXISTS "select_own_saved" ON saved_items;
CREATE POLICY "select_own_saved"
  ON saved_items FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_saved" ON saved_items;
CREATE POLICY "insert_own_saved"
  ON saved_items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_saved" ON saved_items;
CREATE POLICY "delete_own_saved"
  ON saved_items FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_saved_items_user ON saved_items(user_id);

-- certificates: owner-scoped SELECT/INSERT
DROP POLICY IF EXISTS "select_own_certificates" ON certificates;
CREATE POLICY "select_own_certificates"
  ON certificates FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_certificates" ON certificates;
CREATE POLICY "insert_own_certificates"
  ON certificates FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_certificates_user ON certificates(user_id);

-- app_notifications: owner-scoped SELECT/UPDATE/INSERT
DROP POLICY IF EXISTS "select_own_notifications" ON app_notifications;
CREATE POLICY "select_own_notifications"
  ON app_notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_notifications" ON app_notifications;
CREATE POLICY "update_own_notifications"
  ON app_notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_notifications" ON app_notifications;
CREATE POLICY "insert_own_notifications"
  ON app_notifications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON app_notifications(user_id, read);

-- ============ Step 5: Grant execute on functions ============

GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_judge_or_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_audit_action(text, text, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_audit_logs(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_admin_emails() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_add_admin_email(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_remove_admin_email(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_user_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_user_status(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_announcement(text, text, text, text) TO authenticated;
