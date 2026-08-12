-- Supabase's safe-update guard rejects a DELETE without a predicate, even
-- inside a SECURITY DEFINER function. Replace the bootstrap function with the
-- same atomic behavior and an explicit predicate over the non-null email key.

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

  DELETE FROM public.admin_emails
  WHERE email IS NOT NULL;
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

REVOKE ALL ON FUNCTION public.provision_exclusive_admin(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provision_exclusive_admin(uuid) TO service_role;
