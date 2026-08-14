/*
  Keep the contest editor usable for confirmed administrators after a contest
  has been published or started.  This is intentionally an explicit function
  definition rather than a source-text rewrite: installations can have either
  the original published-state guard or a later variant of this RPC.
*/

CREATE OR REPLACE FUNCTION public.update_contest_v2(
  p_contest_id uuid,
  p_title text,
  p_description text,
  p_subject text,
  p_difficulty text,
  p_contest_type text,
  p_contest_mode text,
  p_visibility text,
  p_private_access_code text,
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
AS $function$
DECLARE
  v_contest public.contests%ROWTYPE;
  v_role text;
  v_hash text;
  v_admin boolean := public.has_admin_access(auth.uid());
BEGIN
  IF NOT public.can_manage_contest(p_contest_id) THEN
    RAISE EXCEPTION 'You cannot edit this contest';
  END IF;

  SELECT * INTO v_contest
  FROM public.contests
  WHERE id = p_contest_id
  FOR UPDATE;

  IF NOT FOUND
    OR ((v_contest.is_published OR v_contest.start_at <= now()) AND NOT v_admin) THEN
    RAISE EXCEPTION 'Published or started contests cannot be edited';
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role = 'judge' AND (p_contest_mode <> 'gym' OR p_contest_type <> 'unrated') THEN
    RAISE EXCEPTION 'Judges can edit only their unrated Gym contests';
  END IF;

  IF p_contest_mode NOT IN ('contest', 'gym')
    OR p_contest_type NOT IN ('rated', 'unrated')
    OR p_visibility NOT IN ('public', 'private')
    OR (p_contest_mode = 'gym' AND p_contest_type <> 'unrated')
    OR char_length(trim(coalesce(p_title, ''))) NOT BETWEEN 3 AND 160
    OR coalesce(p_subject, '') !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    OR p_difficulty NOT IN ('easy', 'medium', 'hard', 'expert')
    OR (p_start_at <= now() AND NOT v_admin)
    OR p_end_at <= p_start_at
    OR p_max_participants NOT BETWEEN 1 AND 100000
    OR jsonb_typeof(coalesce(p_rules, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Invalid contest data';
  END IF;

  IF p_visibility = 'private' THEN
    IF nullif(trim(coalesce(p_private_access_code, '')), '') IS NOT NULL THEN
      IF char_length(trim(p_private_access_code)) NOT BETWEEN 10 AND 200 THEN
        RAISE EXCEPTION 'Private contest access code must be 10 to 200 characters';
      END IF;
      v_hash := encode(digest(trim(p_private_access_code), 'sha256'), 'hex');
    ELSE
      v_hash := v_contest.private_access_hash;
    END IF;
    IF v_hash IS NULL THEN
      RAISE EXCEPTION 'A private contest needs an access code';
    END IF;
  ELSE
    v_hash := NULL;
  END IF;

  UPDATE public.contests
  SET title = trim(p_title),
      description = trim(coalesce(p_description, '')),
      subject = p_subject,
      difficulty = p_difficulty,
      contest_type = p_contest_type,
      contest_mode = p_contest_mode,
      visibility = p_visibility,
      private_access_hash = v_hash,
      start_at = p_start_at,
      end_at = p_end_at,
      max_participants = p_max_participants,
      rules = coalesce(p_rules, '[]'::jsonb),
      tags = coalesce(p_tags, ARRAY[]::text[]),
      prize = nullif(trim(p_prize), '')
  WHERE id = p_contest_id;

  PERFORM public.log_audit_action('contest.update', 'contest', p_contest_id, '{}'::jsonb);
END;
$function$;

REVOKE ALL ON FUNCTION public.update_contest_v2(
  uuid, text, text, text, text, text, text, text, text,
  timestamptz, timestamptz, integer, jsonb, text[], text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_contest_v2(
  uuid, text, text, text, text, text, text, text, text,
  timestamptz, timestamptz, integer, jsonb, text[], text
) TO authenticated;

NOTIFY pgrst, 'reload schema';
