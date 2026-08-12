-- Harden the Supabase-side administration boundary.
--
-- This migration deliberately removes legacy bootstrap addresses from the
-- allowlist.  A new, confirmed administrator must be provisioned explicitly
-- after this migration has been applied; do not put that credential in source
-- control or in a browser-visible environment variable.

-- Keep the allowlist canonical before applying a case-insensitive invariant.
DELETE FROM public.admin_emails
WHERE lower(btrim(email)) IN (
  'sattorovkamronbek1@gmail.com',
  'sattorovkamronbek2@gmail.com'
);

-- The legacy bootstrap migrations also promoted existing profiles.  Remove
-- those grants so that the addresses cannot retain administrative or contest
-- management access through a stale role.
UPDATE public.profiles
SET role = 'user'
WHERE role = 'admin'
  AND lower(btrim(email)) IN (
    'sattorovkamronbek1@gmail.com',
    'sattorovkamronbek2@gmail.com'
  );

-- Case-sensitive UNIQUE(email) is not enough for an email allowlist.  Retain
-- the oldest row when historical casing/whitespace variants collide, then
-- canonicalize all remaining values.
WITH ranked_emails AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY lower(btrim(email))
      ORDER BY created_at ASC, id ASC
    ) AS duplicate_rank
  FROM public.admin_emails
)
DELETE FROM public.admin_emails ae
USING ranked_emails ranked
WHERE ae.id = ranked.id
  AND ranked.duplicate_rank > 1;

UPDATE public.admin_emails
SET email = lower(btrim(email))
WHERE email IS DISTINCT FROM lower(btrim(email));

ALTER TABLE public.admin_emails
  DROP CONSTRAINT IF EXISTS admin_emails_email_is_normalized;

ALTER TABLE public.admin_emails
  ADD CONSTRAINT admin_emails_email_is_normalized
  CHECK (email = lower(btrim(email)));

CREATE UNIQUE INDEX IF NOT EXISTS admin_emails_normalized_email_key
  ON public.admin_emails (lower(email));

-- No browser role may enumerate the allowlist directly.  The protected RPC
-- below is the only browser-facing read path and checks the full admin gate.
ALTER TABLE public.admin_emails ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_admin_emails" ON public.admin_emails;
DROP POLICY IF EXISTS "admin_read_admin_emails" ON public.admin_emails;
REVOKE ALL ON TABLE public.admin_emails FROM PUBLIC, anon, authenticated;

-- Audit records are intentionally available only through the authorized
-- dashboard RPC; direct table access is not part of the application contract.
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_read_audit_logs" ON public.audit_logs;
REVOKE ALL ON TABLE public.audit_logs FROM PUBLIC, anon, authenticated;

-- Profile rows are created by the Auth trigger. Allowing a browser client to
-- delete and reinsert its row would let it choose role/status fields before
-- update triggers run. Keep the normal self-service UPDATE policy, but remove
-- client-side creation/deletion entirely.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "insert_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "delete_own_profile" ON public.profiles;
REVOKE INSERT, DELETE ON TABLE public.profiles FROM PUBLIC, anon, authenticated;

-- A learner may read their own certificate and mark their own notification as
-- read, but must never be able to mint a certificate, fabricate analytics, or
-- create a platform notification. Those records are server-authored only.
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "insert_own_certificates" ON public.certificates;
REVOKE INSERT ON TABLE public.certificates FROM PUBLIC, anon, authenticated;

ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "insert_own_activity" ON public.user_activity;
REVOKE INSERT ON TABLE public.user_activity FROM PUBLIC, anon, authenticated;

ALTER TABLE public.app_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "insert_own_notifications" ON public.app_notifications;
REVOKE INSERT ON TABLE public.app_notifications FROM PUBLIC, anon, authenticated;
-- Browser clients may only acknowledge their own notification; message/action
-- content remains immutable after a trusted server writes it.
REVOKE UPDATE ON TABLE public.app_notifications FROM PUBLIC, anon, authenticated;
GRANT UPDATE (read) ON TABLE public.app_notifications TO authenticated;

-- Narrow account-status helper for RLS policies. Unlike active_profile(uuid),
-- this exposes no arbitrary-user lookup to a browser role.
CREATE OR REPLACE FUNCTION public.can_use_account()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.active_profile(auth.uid());
$$;

-- Account status is enforced for every remaining browser-side mutation. A
-- suspended or banned session may still read its own status for a clear signout
-- message, but cannot alter its profile, saved catalogue, or notifications.
DROP POLICY IF EXISTS "update_own_profile" ON public.profiles;
CREATE POLICY "update_own_profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id AND public.can_use_account())
  WITH CHECK (auth.uid() = id AND public.can_use_account());

DROP POLICY IF EXISTS "insert_own_saved" ON public.saved_items;
CREATE POLICY "insert_own_saved"
  ON public.saved_items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.can_use_account());

DROP POLICY IF EXISTS "delete_own_saved" ON public.saved_items;
CREATE POLICY "delete_own_saved"
  ON public.saved_items FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id AND public.can_use_account());

DROP POLICY IF EXISTS "update_own_notifications" ON public.app_notifications;
CREATE POLICY "update_own_notifications"
  ON public.app_notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND public.can_use_account())
  WITH CHECK (auth.uid() = user_id AND public.can_use_account());

-- Public contest data is intentionally exposed only through the curated RPCs;
-- direct table reads otherwise leak implementation-only columns such as the
-- organizer's UUID.
ALTER TABLE public.contests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS public_can_read_published_contests ON public.contests;
REVOKE SELECT ON TABLE public.contests FROM PUBLIC, anon, authenticated;

-- Canonical, server-side definition of an administrator.  It checks the
-- current Auth email (rather than a potentially stale profile copy), requires
-- confirmation, and requires all of role, active status, and allowlist entry.
CREATE OR REPLACE FUNCTION public.has_admin_access(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT p_user_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.profiles AS p
      JOIN auth.users AS u
        ON u.id = p.id
      JOIN public.admin_emails AS ae
        ON ae.email = lower(u.email)
      WHERE p.id = p_user_id
        AND p.role = 'admin'
        AND p.status = 'active'
        AND u.email IS NOT NULL
        AND u.email_confirmed_at IS NOT NULL
    );
$$;

-- Preserve legacy helper names, but make their meaning match the real admin
-- boundary.  Existing callers of is_admin() now receive the stronger check.
CREATE OR REPLACE FUNCTION public.is_admin(p_user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.has_admin_access(p_user_uuid);
$$;

-- Judges retain their own-contest privileges.  Admins retain those privileges
-- only when they pass the same allowlist gate as the admin console.
CREATE OR REPLACE FUNCTION public.is_judge_or_admin(p_user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE p.id = p_user_uuid
      AND p.status = 'active'
      AND (
        p.role = 'judge'
        OR (p.role = 'admin' AND public.has_admin_access(p_user_uuid))
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.has_admin_access(auth.uid());
$$;

-- All contest-management paths use this helper, including the RLS policy on
-- contests. A judge can operate only their own *unrated* contests. Rated
-- contests are operated by a confirmed allowlisted administrator, so an
-- organizer cannot create their own rating outcome.
CREATE OR REPLACE FUNCTION public.can_manage_contest(
  p_contest_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT p_user_id IS NOT NULL
    AND p_user_id = auth.uid()
    AND EXISTS (
    SELECT 1
    FROM public.contests AS c
    JOIN public.profiles AS p
      ON p.id = p_user_id
    WHERE c.id = p_contest_id
      AND p.status = 'active'
      AND (
        (p.role = 'judge' AND c.created_by = p_user_id AND c.contest_type = 'unrated')
        OR (p.role = 'admin' AND public.has_admin_access(p_user_id))
      )
  );
$$;

-- Do not auto-promote a future signup merely because its address appears in
-- the allowlist.  An authorized admin must explicitly assign the role after
-- the account is created and its email is confirmed.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, status)
  VALUES (
    NEW.id,
    lower(NEW.email),
    coalesce(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
    'user',
    'active'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Repairs a missing profile without reopening browser-controlled INSERTs. This
-- is only a recovery path for accounts created before the trigger existed; it
-- always derives the Auth email and assigns the least-privileged defaults.
CREATE OR REPLACE FUNCTION public.ensure_my_profile()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text;
  v_full_name text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT
    lower(u.email),
    nullif(btrim(u.raw_user_meta_data ->> 'full_name'), '')
  INTO v_email, v_full_name
  FROM auth.users AS u
  WHERE u.id = v_user_id;

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'An authenticated email is required to create a profile';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role, status, plan)
  VALUES (
    v_user_id,
    v_email,
    coalesce(v_full_name, split_part(v_email, '@', 1)),
    'user',
    'active',
    'free'
  )
  ON CONFLICT (id) DO NOTHING;
END;
$$;

-- Keep owner edits constrained even if the implementation is replaced by a
-- later migration.  Administrative SECURITY DEFINER functions operate on a
-- different target ID and remain able to perform their authorized updates.
CREATE OR REPLACE FUNCTION public.prevent_self_privilege_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF auth.uid() = OLD.id AND (
    NEW.role IS DISTINCT FROM OLD.role
    OR NEW.status IS DISTINCT FROM OLD.status
    OR NEW.email IS DISTINCT FROM OLD.email
  ) THEN
    RAISE EXCEPTION 'Profile privilege fields cannot be changed by the account owner';
  END IF;

  RETURN NEW;
END;
$$;

-- These helpers write across user boundaries and must never be exposed as
-- browser RPCs.  Their callers below (and the already-authorized contest
-- functions) execute as the function owner after they validate the caller.
CREATE OR REPLACE FUNCTION public.log_audit_action(
  p_action text,
  p_target_type text DEFAULT NULL,
  p_target_id uuid DEFAULT NULL,
  p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_profile record;
  v_log_id uuid;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT p.email, p.role
  INTO v_profile
  FROM public.profiles AS p
  WHERE p.id = v_actor_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  INSERT INTO public.audit_logs (
    actor_id,
    actor_email,
    actor_role,
    action,
    target_type,
    target_id,
    details
  ) VALUES (
    v_actor_id,
    v_profile.email,
    v_profile.role,
    p_action,
    p_target_type,
    p_target_id,
    coalesce(p_details, '{}'::jsonb)
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
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
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.app_notifications (
    user_id,
    type,
    title,
    message,
    action_label,
    action_link,
    metadata
  ) VALUES (
    p_user_id,
    p_type,
    p_title,
    p_message,
    p_action_label,
    p_action_link,
    coalesce(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Roster changes must be serialized. Without this transaction-scoped lock two
-- administrators could concurrently remove each other's last usable grant.
CREATE OR REPLACE FUNCTION public.lock_admin_roster()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('public.admin_roster')::bigint);
END;
$$;

CREATE OR REPLACE FUNCTION public.assert_usable_admin_remains(
  p_excluded_user_id uuid DEFAULT NULL,
  p_excluded_email text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  PERFORM public.lock_admin_roster();

  IF NOT EXISTS (
    SELECT 1
    FROM public.admin_emails AS ae
    JOIN auth.users AS u
      ON ae.email = lower(u.email)
    JOIN public.profiles AS p
      ON p.id = u.id
    WHERE p.role = 'admin'
      AND p.status = 'active'
      AND u.email_confirmed_at IS NOT NULL
      AND (p_excluded_user_id IS NULL OR p.id <> p_excluded_user_id)
      AND (p_excluded_email IS NULL OR ae.email <> lower(btrim(p_excluded_email)))
  ) THEN
    RAISE EXCEPTION 'This action would remove the final usable administrator';
  END IF;
END;
$$;

-- This bootstrap is intentionally callable only with the Supabase service-role
-- key. It atomically makes a confirmed Auth account the sole application admin
-- on a reused database, eliminating unknown legacy allowlist/role pairs.
CREATE OR REPLACE FUNCTION public.provision_exclusive_admin(p_target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_email text;
  v_full_name text;
  v_demoted_count integer := 0;
  v_removed_allowlist_count integer := 0;
BEGIN
  IF p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'A target Auth user is required';
  END IF;

  PERFORM public.lock_admin_roster();

  SELECT
    lower(u.email),
    nullif(btrim(u.raw_user_meta_data ->> 'full_name'), '')
  INTO v_email, v_full_name
  FROM auth.users AS u
  WHERE u.id = p_target_user_id
    AND u.email_confirmed_at IS NOT NULL;

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Target must be a confirmed Auth user with an email';
  END IF;

  UPDATE public.profiles
  SET role = 'user'
  WHERE role = 'admin'
    AND id <> p_target_user_id;
  GET DIAGNOSTICS v_demoted_count = ROW_COUNT;

  DELETE FROM public.admin_emails;
  GET DIAGNOSTICS v_removed_allowlist_count = ROW_COUNT;

  INSERT INTO public.profiles (id, email, full_name, role, status, plan)
  VALUES (
    p_target_user_id,
    v_email,
    coalesce(v_full_name, split_part(v_email, '@', 1)),
    'admin',
    'active',
    'free'
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      role = 'admin',
      status = 'active',
      suspended_reason = NULL,
      suspended_at = NULL;

  INSERT INTO public.admin_emails (email, added_by)
  VALUES (v_email, p_target_user_id);

  INSERT INTO public.audit_logs (
    actor_id,
    actor_email,
    actor_role,
    action,
    target_type,
    target_id,
    details
  ) VALUES (
    p_target_user_id,
    v_email,
    'admin',
    'admin.bootstrap_exclusive',
    'user',
    p_target_user_id,
    jsonb_build_object(
      'demoted_admin_profiles', v_demoted_count,
      'replaced_allowlist_entries', v_removed_allowlist_count
    )
  );

  RETURN jsonb_build_object(
    'email', v_email,
    'demoted_admin_profiles', v_demoted_count,
    'replaced_allowlist_entries', v_removed_allowlist_count
  );
END;
$$;

-- Browser-facing admin RPCs: each performs the full server-side admin check.
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
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT public.has_admin_access(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: confirmed allowlisted admin required';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.email,
    p.full_name,
    p.avatar_url,
    p.role,
    p.status,
    p.plan,
    p.country,
    p.school,
    p.created_at,
    p.suspended_reason,
    p.suspended_at
  FROM public.profiles AS p
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
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 100);
BEGIN
  IF NOT public.has_admin_access(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: confirmed allowlisted admin required';
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    a.actor_id,
    a.actor_email,
    a.actor_role,
    a.action,
    a.target_type,
    a.target_id,
    a.details,
    a.created_at
  FROM public.audit_logs AS a
  ORDER BY a.created_at DESC
  LIMIT v_limit;
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
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT public.has_admin_access(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: confirmed allowlisted admin required';
  END IF;

  RETURN QUERY
  SELECT ae.id, ae.email, ae.added_by, ae.created_at
  FROM public.admin_emails AS ae
  ORDER BY ae.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_add_admin_email(p_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_email text := lower(btrim(p_email));
  v_id uuid;
BEGIN
  PERFORM public.lock_admin_roster();

  IF NOT public.has_admin_access(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: confirmed allowlisted admin required';
  END IF;

  IF v_email IS NULL
    OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'A valid email address is required';
  END IF;

  INSERT INTO public.admin_emails (email, added_by)
  VALUES (v_email, auth.uid())
  ON CONFLICT (email) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Email is already allowlisted';
  END IF;

  PERFORM public.log_audit_action(
    'admin_email.add',
    'admin_email',
    v_id,
    jsonb_build_object('email', v_email)
  );

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_remove_admin_email(p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_email text := lower(btrim(p_email));
  v_current_email text;
BEGIN
  PERFORM public.lock_admin_roster();

  IF NOT public.has_admin_access(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: confirmed allowlisted admin required';
  END IF;

  IF v_email IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.admin_emails AS ae WHERE ae.email = v_email
  ) THEN
    RAISE EXCEPTION 'Allowlist email not found';
  END IF;

  SELECT lower(u.email)
  INTO v_current_email
  FROM auth.users AS u
  WHERE u.id = auth.uid();

  IF v_email = v_current_email THEN
    RAISE EXCEPTION 'Cannot remove the current administrator email';
  END IF;

  PERFORM public.assert_usable_admin_remains(NULL, v_email);

  DELETE FROM public.admin_emails AS ae
  WHERE ae.email = v_email;

  -- A removed allowlist entry must not leave behind a stale admin role that a
  -- later migration could accidentally treat as privileged again.
  UPDATE public.profiles AS p
  SET role = 'user'
  FROM auth.users AS u
  WHERE p.id = u.id
    AND p.role = 'admin'
    AND lower(u.email) = v_email;

  PERFORM public.log_audit_action(
    'admin_email.remove',
    'admin_email',
    NULL,
    jsonb_build_object('email', v_email)
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
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_old_role text;
BEGIN
  PERFORM public.lock_admin_roster();

  IF NOT public.has_admin_access(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: confirmed allowlisted admin required';
  END IF;

  IF p_new_role NOT IN ('user', 'judge', 'admin') THEN
    RAISE EXCEPTION 'Invalid role: must be user, judge, or admin';
  END IF;

  IF p_target_uuid = auth.uid() THEN
    RAISE EXCEPTION 'Cannot change your own role';
  END IF;

  SELECT p.role
  INTO v_old_role
  FROM public.profiles AS p
  WHERE p.id = p_target_uuid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target user not found';
  END IF;

  IF p_new_role <> 'admin' AND public.has_admin_access(p_target_uuid) THEN
    PERFORM public.assert_usable_admin_remains(p_target_uuid, NULL);
  END IF;

  IF p_new_role = 'admin' AND NOT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    JOIN auth.users AS u
      ON u.id = p.id
    JOIN public.admin_emails AS ae
      ON ae.email = lower(u.email)
    WHERE p.id = p_target_uuid
      AND u.email_confirmed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Target must have a confirmed allowlisted email before becoming admin';
  END IF;

  UPDATE public.profiles
  SET role = p_new_role
  WHERE id = p_target_uuid;

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
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_old_status text;
  v_reason text := nullif(btrim(p_reason), '');
BEGIN
  PERFORM public.lock_admin_roster();

  IF NOT public.has_admin_access(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: confirmed allowlisted admin required';
  END IF;

  IF p_new_status NOT IN ('active', 'suspended', 'banned') THEN
    RAISE EXCEPTION 'Invalid status: must be active, suspended, or banned';
  END IF;

  IF p_new_status <> 'active' AND v_reason IS NULL THEN
    RAISE EXCEPTION 'A reason is required when suspending or banning an account';
  END IF;

  IF p_target_uuid = auth.uid() THEN
    RAISE EXCEPTION 'Cannot change your own status';
  END IF;

  SELECT p.status
  INTO v_old_status
  FROM public.profiles AS p
  WHERE p.id = p_target_uuid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target user not found';
  END IF;

  IF p_new_status <> 'active' AND public.has_admin_access(p_target_uuid) THEN
    PERFORM public.assert_usable_admin_remains(p_target_uuid, NULL);
  END IF;

  UPDATE public.profiles
  SET
    status = p_new_status,
    suspended_reason = CASE WHEN p_new_status = 'active' THEN NULL ELSE v_reason END,
    suspended_at = CASE WHEN p_new_status = 'active' THEN NULL ELSE now() END
  WHERE id = p_target_uuid;

  PERFORM public.log_audit_action(
    'user.status_change',
    'user',
    p_target_uuid,
    jsonb_build_object('old_status', v_old_status, 'new_status', p_new_status, 'reason', v_reason)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_user(p_target_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  PERFORM public.lock_admin_roster();

  IF NOT public.has_admin_access(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: confirmed allowlisted admin required';
  END IF;

  IF p_target_uuid = auth.uid() THEN
    RAISE EXCEPTION 'Cannot delete your own account';
  END IF;

  PERFORM public.admin_update_user_status(
    p_target_uuid,
    'banned',
    'Account deleted by admin'
  );
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
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_count integer := 0;
  v_title text := nullif(btrim(p_title), '');
  v_message text := nullif(btrim(p_message), '');
  v_action_label text := nullif(btrim(p_action_label), '');
  v_action_link text := nullif(btrim(p_action_link), '');
BEGIN
  IF NOT public.has_admin_access(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: confirmed allowlisted admin required';
  END IF;

  IF v_title IS NULL OR v_message IS NULL THEN
    RAISE EXCEPTION 'Announcement title and message are required';
  END IF;

  IF char_length(v_title) > 160
    OR char_length(v_message) > 2000
    OR (v_action_label IS NOT NULL AND char_length(v_action_label) > 80)
    OR (v_action_link IS NOT NULL AND char_length(v_action_link) > 500) THEN
    RAISE EXCEPTION 'Announcement content exceeds the allowed length';
  END IF;

  IF (v_action_label IS NULL) <> (v_action_link IS NULL) THEN
    RAISE EXCEPTION 'Announcement action label and link must be supplied together';
  END IF;

  IF v_action_link IS NOT NULL
    AND (
      v_action_link !~ '^(https?://[^[:space:]]+|/[^[:space:]]*)$'
      OR left(v_action_link, 2) = '//'
      OR (left(v_action_link, 1) = '/' AND position(chr(92) IN v_action_link) > 0)
    ) THEN
    RAISE EXCEPTION 'Announcement action link must be an http(s) URL or site-relative path';
  END IF;

  -- A set-based write keeps a large, legitimate announcement from exceeding
  -- the request budget one recipient at a time.
  INSERT INTO public.app_notifications (
    user_id,
    type,
    title,
    message,
    action_label,
    action_link
  )
  SELECT
    p.id,
    'announcement',
    v_title,
    v_message,
    v_action_label,
    v_action_link
  FROM public.profiles AS p
  WHERE p.status = 'active';

  GET DIAGNOSTICS v_count = ROW_COUNT;

  PERFORM public.log_audit_action(
    'announcement.broadcast',
    'notification',
    NULL,
    jsonb_build_object('title', v_title, 'recipients', v_count)
  );

  RETURN v_count;
END;
$$;

-- Rated contests are an administrator-controlled workflow. Judges can still
-- create and operate unrated contests, but cannot turn a contest into a source
-- of ratings that they can influence.
CREATE OR REPLACE FUNCTION public.create_contest(
  p_title text,
  p_description text,
  p_subject text,
  p_difficulty text,
  p_contest_type text,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_max_participants integer,
  p_rules jsonb DEFAULT '[]'::jsonb,
  p_tags text[] DEFAULT ARRAY[]::text[],
  p_prize text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_judge_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only active judges or admins can create contests';
  END IF;
  IF p_contest_type = 'rated' AND NOT public.has_admin_access(auth.uid()) THEN
    RAISE EXCEPTION 'Only a confirmed allowlisted administrator can create a rated contest';
  END IF;
  IF char_length(trim(coalesce(p_title, ''))) < 3 THEN
    RAISE EXCEPTION 'Contest title must contain at least 3 characters';
  END IF;
  IF coalesce(p_subject, '') !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' THEN
    RAISE EXCEPTION 'Contest subject must be a slug';
  END IF;
  IF p_difficulty NOT IN ('easy', 'medium', 'hard', 'expert') THEN
    RAISE EXCEPTION 'Invalid contest difficulty';
  END IF;
  IF p_contest_type NOT IN ('rated', 'unrated') THEN
    RAISE EXCEPTION 'Invalid contest type';
  END IF;
  IF p_start_at <= now() OR p_end_at <= p_start_at THEN
    RAISE EXCEPTION 'A new contest must start in the future and end after it starts';
  END IF;
  IF p_max_participants IS NULL OR p_max_participants < 1 OR p_max_participants > 100000 THEN
    RAISE EXCEPTION 'Participant limit must be between 1 and 100000';
  END IF;
  IF jsonb_typeof(coalesce(p_rules, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Rules must be an array';
  END IF;

  INSERT INTO public.contests (
    slug, title, description, subject, difficulty, contest_type, start_at, end_at,
    max_participants, rules, tags, prize, created_by
  ) VALUES (
    public.contest_slug(p_title), trim(p_title), trim(coalesce(p_description, '')), p_subject,
    p_difficulty, p_contest_type, p_start_at, p_end_at, p_max_participants,
    coalesce(p_rules, '[]'::jsonb), coalesce(p_tags, ARRAY[]::text[]), nullif(trim(p_prize), ''), auth.uid()
  ) RETURNING id INTO v_id;

  PERFORM public.log_audit_action('contest.create', 'contest', v_id, jsonb_build_object('title', trim(p_title)));
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_contest(
  p_contest_id uuid,
  p_title text,
  p_description text,
  p_subject text,
  p_difficulty text,
  p_contest_type text,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_max_participants integer,
  p_rules jsonb DEFAULT '[]'::jsonb,
  p_tags text[] DEFAULT ARRAY[]::text[],
  p_prize text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_contest public.contests%ROWTYPE;
BEGIN
  IF NOT public.can_manage_contest(p_contest_id) THEN
    RAISE EXCEPTION 'Only the owning judge or an admin can edit this contest';
  END IF;
  IF p_contest_type = 'rated' AND NOT public.has_admin_access(auth.uid()) THEN
    RAISE EXCEPTION 'Only a confirmed allowlisted administrator can create a rated contest';
  END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contest not found'; END IF;
  IF v_contest.is_published OR v_contest.start_at <= now() THEN
    RAISE EXCEPTION 'Published or started contests cannot be edited';
  END IF;
  IF char_length(trim(coalesce(p_title, ''))) < 3
    OR coalesce(p_subject, '') !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    OR p_difficulty NOT IN ('easy', 'medium', 'hard', 'expert')
    OR p_contest_type NOT IN ('rated', 'unrated')
    OR p_start_at <= now() OR p_end_at <= p_start_at
    OR p_max_participants NOT BETWEEN 1 AND 100000
    OR jsonb_typeof(coalesce(p_rules, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Invalid contest data';
  END IF;

  UPDATE public.contests
  SET title = trim(p_title), description = trim(coalesce(p_description, '')), subject = p_subject,
      difficulty = p_difficulty, contest_type = p_contest_type, start_at = p_start_at,
      end_at = p_end_at, max_participants = p_max_participants,
      rules = coalesce(p_rules, '[]'::jsonb), tags = coalesce(p_tags, ARRAY[]::text[]),
      prize = nullif(trim(p_prize), '')
  WHERE id = p_contest_id;

  PERFORM public.log_audit_action('contest.update', 'contest', p_contest_id, '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.register_for_contest(p_contest_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_contest public.contests%ROWTYPE;
  v_registered boolean;
  v_count bigint;
BEGIN
  IF auth.uid() IS NULL OR NOT public.active_profile(auth.uid()) THEN
    RAISE EXCEPTION 'An active account is required to register';
  END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id FOR UPDATE;
  IF NOT FOUND OR NOT v_contest.is_published OR v_contest.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'Contest is not available';
  END IF;
  IF now() >= v_contest.end_at THEN
    RAISE EXCEPTION 'Registration is closed because this contest has finished';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.contest_questions WHERE contest_id = p_contest_id) THEN
    RAISE EXCEPTION 'Contest is not ready';
  END IF;
  IF v_contest.contest_type = 'rated'
    AND (v_contest.created_by = auth.uid() OR public.has_admin_access(auth.uid())) THEN
    RAISE EXCEPTION 'Contest managers cannot register for a rated contest';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.contest_registrations
    WHERE contest_id = p_contest_id AND user_id = auth.uid()
  ) INTO v_registered;
  IF NOT v_registered THEN
    SELECT count(*) INTO v_count FROM public.contest_registrations WHERE contest_id = p_contest_id;
    IF v_count >= v_contest.max_participants THEN
      RAISE EXCEPTION 'Contest capacity has been reached';
    END IF;
    INSERT INTO public.contest_registrations (contest_id, user_id)
    VALUES (p_contest_id, auth.uid());
    INSERT INTO public.user_activity (user_id, type, title, metadata)
    VALUES (auth.uid(), 'contest_joined', 'Registered for contest', jsonb_build_object('contest_id', p_contest_id));
  END IF;

  RETURN jsonb_build_object('contest_id', p_contest_id, 'registered', true, 'already_registered', v_registered);
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_contest_answer(p_question_id uuid, p_selected_option integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_question public.contest_questions%ROWTYPE;
  v_contest public.contests%ROWTYPE;
  v_correct boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.active_profile(auth.uid()) THEN
    RAISE EXCEPTION 'An active account is required to submit';
  END IF;
  SELECT q.* INTO v_question FROM public.contest_questions q WHERE q.id = p_question_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Question not found'; END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = v_question.contest_id;
  IF NOT v_contest.is_published OR v_contest.archived_at IS NOT NULL
    OR now() < v_contest.start_at OR now() >= v_contest.end_at THEN
    RAISE EXCEPTION 'Answers are not accepted for this contest at this time';
  END IF;
  IF v_contest.contest_type = 'rated'
    AND (v_contest.created_by = auth.uid() OR public.has_admin_access(auth.uid())) THEN
    RAISE EXCEPTION 'Contest managers cannot submit answers to a rated contest';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.contest_registrations r WHERE r.contest_id = v_contest.id AND r.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Register for this contest before submitting';
  END IF;
  IF p_selected_option IS NULL OR p_selected_option < 0 OR p_selected_option >= jsonb_array_length(v_question.options) THEN
    RAISE EXCEPTION 'Invalid answer option';
  END IF;
  v_correct := p_selected_option = v_question.correct_option;

  INSERT INTO public.contest_answers (contest_id, question_id, user_id, selected_option, is_correct, score)
  VALUES (v_contest.id, v_question.id, auth.uid(), p_selected_option, v_correct, CASE WHEN v_correct THEN v_question.points ELSE 0 END)
  ON CONFLICT (question_id, user_id) DO UPDATE
  SET selected_option = EXCLUDED.selected_option,
      is_correct = EXCLUDED.is_correct,
      score = EXCLUDED.score,
      submitted_at = now();

  UPDATE public.contest_registrations
  SET last_activity_at = now()
  WHERE contest_id = v_contest.id AND user_id = auth.uid();

  RETURN jsonb_build_object('saved', true, 'question_id', p_question_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_contest(p_contest_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_contest public.contests%ROWTYPE;
  v_result record;
  v_total_points integer;
  v_before integer;
  v_after integer;
  v_delta integer;
BEGIN
  IF NOT public.can_manage_contest(p_contest_id) THEN
    RAISE EXCEPTION 'Only the owning judge or an admin can finalize this contest';
  END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contest not found'; END IF;
  IF v_contest.contest_type = 'rated' AND NOT public.has_admin_access(auth.uid()) THEN
    RAISE EXCEPTION 'Only a confirmed allowlisted administrator can finalize a rated contest';
  END IF;
  IF NOT v_contest.is_published OR v_contest.archived_at IS NOT NULL OR v_contest.end_at > now() THEN
    RAISE EXCEPTION 'Only a finished, published contest can be finalized';
  END IF;
  IF v_contest.is_finalized OR EXISTS (SELECT 1 FROM public.contest_results WHERE contest_id = p_contest_id) THEN
    RAISE EXCEPTION 'Contest results have already been finalized';
  END IF;
  SELECT coalesce(sum(points), 0)::integer INTO v_total_points
  FROM public.contest_questions WHERE contest_id = p_contest_id;
  IF v_total_points < 1 THEN RAISE EXCEPTION 'Contest has no scorable questions'; END IF;

  FOR v_result IN
    WITH scores AS (
      SELECT r.user_id,
        coalesce(sum(a.score), 0)::integer AS score,
        count(a.question_id)::integer AS answered_count,
        max(r.last_activity_at) AS last_activity
      FROM public.contest_registrations r
      LEFT JOIN public.contest_answers a ON a.contest_id = r.contest_id AND a.user_id = r.user_id
      WHERE r.contest_id = p_contest_id
        AND (
          v_contest.contest_type <> 'rated'
          OR (
            r.user_id <> v_contest.created_by
            AND NOT public.has_admin_access(r.user_id)
          )
        )
      GROUP BY r.user_id
      HAVING count(a.question_id) > 0
    )
    SELECT
      row_number() OVER (ORDER BY score DESC, answered_count DESC, last_activity NULLS LAST, user_id)::integer AS rank,
      user_id, score, answered_count
    FROM scores
    ORDER BY score DESC, answered_count DESC, last_activity NULLS LAST, user_id
  LOOP
    v_before := NULL;
    v_after := NULL;
    v_delta := NULL;

    IF v_contest.contest_type = 'rated' THEN
      INSERT INTO public.user_subject_ratings (user_id, subject)
      VALUES (v_result.user_id, v_contest.subject)
      ON CONFLICT (user_id, subject) DO NOTHING;

      PERFORM 1
      FROM public.user_subject_ratings
      WHERE user_id = v_result.user_id AND subject = v_contest.subject
      FOR UPDATE;

      SELECT previous_result.rating_after INTO v_before
      FROM public.contest_results previous_result
      JOIN public.contests previous_contest ON previous_contest.id = previous_result.contest_id
      WHERE previous_result.user_id = v_result.user_id
        AND previous_contest.subject = v_contest.subject
        AND previous_contest.is_finalized
        AND previous_result.rating_after IS NOT NULL
      ORDER BY previous_result.finalized_at DESC, previous_result.contest_id DESC
      LIMIT 1;

      v_before := coalesce(v_before, 1000);
      v_delta := greatest(-25, least(25, round((v_result.score::numeric / v_total_points) * 50 - 25)::integer));
      v_after := greatest(0, v_before + v_delta);

      INSERT INTO public.user_subject_ratings (user_id, subject, current_rating, peak_rating, rated_contests)
      VALUES (v_result.user_id, v_contest.subject, v_after, greatest(v_before, v_after), 1)
      ON CONFLICT (user_id, subject) DO UPDATE
      SET current_rating = EXCLUDED.current_rating,
          peak_rating = greatest(public.user_subject_ratings.peak_rating, EXCLUDED.current_rating),
          rated_contests = public.user_subject_ratings.rated_contests + 1,
          updated_at = now();

      INSERT INTO public.app_notifications (user_id, type, title, message, metadata)
      VALUES (
        v_result.user_id,
        'rating-change',
        'Contest rating finalized',
        'Your rating was finalized from a completed contest.',
        jsonb_build_object('contest_id', p_contest_id, 'ratingBefore', v_before, 'ratingAfter', v_after, 'ratingDelta', v_delta, 'subject', v_contest.subject)
      );
    END IF;

    INSERT INTO public.contest_results (
      contest_id, user_id, rank, score, answered_count, rating_before, rating_after, rating_delta
    ) VALUES (
      p_contest_id, v_result.user_id, v_result.rank, v_result.score, v_result.answered_count,
      v_before, v_after, v_delta
    );
  END LOOP;

  UPDATE public.contests SET is_finalized = true, finalized_at = now() WHERE id = p_contest_id;
  PERFORM public.log_audit_action('contest.finalize', 'contest', p_contest_id, jsonb_build_object('rated', v_contest.contest_type = 'rated'));
END;
$$;

-- Function privileges are explicit.  PostgreSQL otherwise grants EXECUTE to
-- PUBLIC for new functions, which is unsafe for SECURITY DEFINER helpers.
REVOKE ALL ON FUNCTION public.has_admin_access(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_judge_or_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_audit_action(text, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_notification(uuid, text, text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.can_use_account() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.lock_admin_roster() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assert_usable_admin_remains(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.provision_exclusive_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ensure_my_profile() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_self_privilege_changes() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.can_access_admin() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.can_manage_contest(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_list_users() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_list_audit_logs(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_list_admin_emails() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_add_admin_email(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_remove_admin_email(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_update_user_role(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_update_user_status(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_delete_user(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_create_announcement(text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_contest(text, text, text, text, text, timestamptz, timestamptz, integer, jsonb, text[], text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_contest(uuid, text, text, text, text, text, timestamptz, timestamptz, integer, jsonb, text[], text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.register_for_contest(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_contest_answer(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_contest(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.can_access_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_contest(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_my_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_use_account() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_audit_logs(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_admin_emails() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_add_admin_email(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_remove_admin_email(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_user_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_user_status(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_announcement(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_contest(text, text, text, text, text, timestamptz, timestamptz, integer, jsonb, text[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_contest(uuid, text, text, text, text, text, timestamptz, timestamptz, integer, jsonb, text[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_for_contest(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_contest_answer(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_contest(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.provision_exclusive_admin(uuid) TO service_role;
