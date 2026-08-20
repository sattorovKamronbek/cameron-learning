/*
  Writing drafts are saved continuously by the client. At the section deadline
  the previously saved draft becomes a submission; no IELTS word minimum is a
  submission gate. This also lets an organizer recover drafts safely after a
  browser closes at the exact deadline.

  Contest-integrity exits are recorded separately from normal completions so a
  confirmed administrator can restore an incorrectly excluded participant with
  the one active override code for that contest.
*/

ALTER TABLE public.contests
  ADD COLUMN IF NOT EXISTS integrity_override_code_hash text;

ALTER TABLE public.contest_registrations
  ADD COLUMN IF NOT EXISTS integrity_excluded_at timestamptz,
  ADD COLUMN IF NOT EXISTS integrity_exclusion_reason text;

CREATE OR REPLACE FUNCTION public.auto_submit_expired_writing_drafts(p_contest_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_contest public.contests%ROWTYPE;
  v_updated integer := 0;
BEGIN
  SELECT * INTO v_contest
  FROM public.contests
  WHERE id = p_contest_id;

  IF NOT FOUND OR v_contest.subject NOT IN ('ielts', 'cefr') OR now() < v_contest.end_at THEN
    RETURN 0;
  END IF;

  UPDATE public.contest_writing_submissions AS submission
  SET submitted_at = coalesce(submission.submitted_at, v_contest.end_at),
      updated_at = now()
  FROM public.contest_exam_parts AS part
  WHERE submission.contest_id = p_contest_id
    AND submission.exam_part_id = part.id
    AND part.section = 'writing'
    AND submission.submitted_at IS NULL
    AND char_length(trim(submission.content)) > 0;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$function$;

CREATE OR REPLACE FUNCTION public.save_exam_writing_response(
  p_exam_part_id uuid,
  p_content text,
  p_submit boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_part public.contest_exam_parts%ROWTYPE;
  v_contest public.contests%ROWTYPE;
  v_registration public.contest_registrations%ROWTYPE;
  v_timing public.contest_exam_section_timings%ROWTYPE;
  v_writing_start timestamptz;
  v_writing_end timestamptz;
  v_submitted_at timestamptz;
  v_existing_content text;
  v_content text := trim(coalesce(p_content, ''));
BEGIN
  IF auth.uid() IS NULL OR NOT public.active_profile(auth.uid()) THEN
    RAISE EXCEPTION 'An active account is required to submit writing';
  END IF;

  SELECT * INTO v_part
  FROM public.contest_exam_parts
  WHERE id = p_exam_part_id;
  IF NOT FOUND OR v_part.section <> 'writing' THEN
    RAISE EXCEPTION 'Writing part not found';
  END IF;

  SELECT * INTO v_contest
  FROM public.contests
  WHERE id = v_part.contest_id;
  IF NOT v_contest.is_published OR v_contest.archived_at IS NOT NULL OR now() < v_contest.start_at THEN
    RAISE EXCEPTION 'Writing is not accepted for this exam at this time';
  END IF;
  IF v_contest.contest_type = 'rated'
    AND (v_contest.created_by = auth.uid() OR public.has_admin_access(auth.uid())) THEN
    RAISE EXCEPTION 'Contest managers cannot submit writing to a rated exam';
  END IF;

  SELECT * INTO v_registration
  FROM public.contest_registrations
  WHERE contest_id = v_contest.id AND user_id = auth.uid()
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Register for this exam before submitting writing';
  END IF;
  IF v_registration.completed_at IS NOT NULL THEN
    RAISE EXCEPTION 'This exam has already been submitted';
  END IF;

  SELECT * INTO v_timing
  FROM public.contest_exam_section_timings
  WHERE contest_id = v_contest.id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Writing timing is unavailable';
  END IF;

  v_writing_start := coalesce(
    v_registration.reading_completed_at,
    v_contest.start_at + ((v_timing.listening_minutes + v_timing.reading_minutes) * interval '1 minute')
  );
  v_writing_end := least(v_contest.end_at, v_writing_start + (v_timing.writing_minutes * interval '1 minute'));
  IF now() < v_writing_start THEN
    RAISE EXCEPTION 'Writing has not started yet';
  END IF;

  SELECT content, submitted_at
  INTO v_existing_content, v_submitted_at
  FROM public.contest_writing_submissions
  WHERE exam_part_id = p_exam_part_id AND user_id = auth.uid()
  FOR UPDATE;

  IF v_submitted_at IS NOT NULL THEN
    RETURN jsonb_build_object('saved', true, 'submitted_at', v_submitted_at, 'already_submitted', true);
  END IF;

  /* Once the timer expires the RPC may only submit the last server-side
     draft. It can never replace that draft with a post-deadline payload. */
  IF now() >= v_writing_end THEN
    IF NOT p_submit OR char_length(trim(coalesce(v_existing_content, ''))) < 1 THEN
      RAISE EXCEPTION 'Writing time has ended';
    END IF;
    UPDATE public.contest_writing_submissions
    SET submitted_at = v_writing_end,
        updated_at = now()
    WHERE exam_part_id = p_exam_part_id AND user_id = auth.uid()
    RETURNING submitted_at INTO v_submitted_at;
    UPDATE public.contest_registrations
    SET last_activity_at = now()
    WHERE contest_id = v_contest.id AND user_id = auth.uid();
    RETURN jsonb_build_object('saved', true, 'submitted_at', v_submitted_at, 'auto_submitted', true);
  END IF;

  IF char_length(v_content) < 1 THEN
    RAISE EXCEPTION 'Writing response cannot be empty';
  END IF;

  INSERT INTO public.contest_writing_submissions (contest_id, exam_part_id, user_id, content, submitted_at)
  VALUES (v_contest.id, p_exam_part_id, auth.uid(), v_content, CASE WHEN p_submit THEN now() ELSE NULL END)
  ON CONFLICT (exam_part_id, user_id) DO UPDATE
  SET content = EXCLUDED.content,
      submitted_at = CASE WHEN p_submit THEN now() ELSE NULL END,
      updated_at = now()
  RETURNING submitted_at INTO v_submitted_at;

  UPDATE public.contest_registrations
  SET last_activity_at = now()
  WHERE contest_id = v_contest.id AND user_id = auth.uid();
  RETURN jsonb_build_object('saved', true, 'submitted_at', v_submitted_at);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_contest_writing_submissions(p_contest_id uuid)
RETURNS TABLE (
  id uuid,
  part_id uuid,
  part_position integer,
  part_title text,
  max_points integer,
  user_id uuid,
  display_name text,
  content text,
  submitted_at timestamptz,
  score integer,
  feedback text,
  graded_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_contest public.contests%ROWTYPE;
BEGIN
  IF NOT public.can_manage_contest(p_contest_id) THEN
    RAISE EXCEPTION 'Only the contest owner or an administrator can review writing';
  END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id;
  IF NOT FOUND OR v_contest.subject NOT IN ('ielts', 'cefr') THEN
    RAISE EXCEPTION 'English exam not found';
  END IF;
  IF v_contest.end_at > now() THEN
    RAISE EXCEPTION 'Writing is available for review after the exam ends';
  END IF;

  PERFORM public.auto_submit_expired_writing_drafts(p_contest_id);

  RETURN QUERY
  SELECT
    submission.id,
    part.id,
    part.position,
    part.title,
    part.max_points,
    submission.user_id,
    coalesce(nullif(trim(profile.full_name), ''), 'Participant'),
    submission.content,
    submission.submitted_at,
    submission.score,
    submission.feedback,
    submission.graded_at
  FROM public.contest_writing_submissions AS submission
  JOIN public.contest_exam_parts AS part ON part.id = submission.exam_part_id
  JOIN public.profiles AS profile ON profile.id = submission.user_id
  WHERE submission.contest_id = p_contest_id
    AND submission.submitted_at IS NOT NULL
  ORDER BY part.position, submission.submitted_at;
END;
$function$;

CREATE OR REPLACE FUNCTION public.exclude_contest_attempt(p_contest_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_contest public.contests%ROWTYPE;
  v_completed_at timestamptz;
BEGIN
  IF auth.uid() IS NULL OR NOT public.active_profile(auth.uid()) THEN
    RAISE EXCEPTION 'An active account is required to end a contest attempt';
  END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id;
  IF NOT FOUND OR NOT v_contest.is_published OR v_contest.archived_at IS NOT NULL
    OR now() < v_contest.start_at OR now() >= v_contest.end_at THEN
    RAISE EXCEPTION 'This contest attempt cannot be ended at this time';
  END IF;

  UPDATE public.contest_registrations
  SET completed_at = coalesce(completed_at, now()),
      integrity_excluded_at = coalesce(integrity_excluded_at, now()),
      integrity_exclusion_reason = coalesce(integrity_exclusion_reason, 'left-contest-page'),
      last_activity_at = now()
  WHERE contest_id = p_contest_id AND user_id = auth.uid()
  RETURNING completed_at INTO v_completed_at;
  IF v_completed_at IS NULL THEN
    RAISE EXCEPTION 'Register for this contest before ending the attempt';
  END IF;
  RETURN jsonb_build_object('completed_at', v_completed_at, 'integrity_excluded', true);
END;
$function$;

/* A participant can still deliberately end an attempt from the Esc dialog.
   That is a normal completion, not an integrity exclusion. */
CREATE OR REPLACE FUNCTION public.end_contest_attempt(p_contest_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_contest public.contests%ROWTYPE;
  v_completed_at timestamptz;
BEGIN
  IF auth.uid() IS NULL OR NOT public.active_profile(auth.uid()) THEN
    RAISE EXCEPTION 'An active account is required to end a contest attempt';
  END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id;
  IF NOT FOUND OR NOT v_contest.is_published OR v_contest.archived_at IS NOT NULL
    OR now() < v_contest.start_at OR now() >= v_contest.end_at THEN
    RAISE EXCEPTION 'This contest attempt cannot be ended at this time';
  END IF;
  UPDATE public.contest_registrations
  SET completed_at = coalesce(completed_at, now()), last_activity_at = now()
  WHERE contest_id = p_contest_id AND user_id = auth.uid()
  RETURNING completed_at INTO v_completed_at;
  IF v_completed_at IS NULL THEN
    RAISE EXCEPTION 'Register for this contest before ending the attempt';
  END IF;
  RETURN jsonb_build_object('completed_at', v_completed_at);
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_contest_integrity_override_code(
  p_contest_id uuid,
  p_code text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $function$
DECLARE
  v_code text := trim(coalesce(p_code, ''));
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_admin_access(auth.uid()) THEN
    RAISE EXCEPTION 'Only a confirmed administrator can set an integrity override code';
  END IF;
  IF char_length(v_code) NOT BETWEEN 16 AND 100 THEN
    RAISE EXCEPTION 'Integrity override code must be 16 to 100 characters';
  END IF;
  UPDATE public.contests
  SET integrity_override_code_hash = encode(digest(v_code, 'sha256'), 'hex')
  WHERE id = p_contest_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contest not found'; END IF;
  PERFORM public.log_audit_action('contest.integrity_override_code.set', 'contest', p_contest_id, '{}'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.list_contest_integrity_exclusions(p_contest_id uuid)
RETURNS TABLE (
  user_id uuid,
  display_name text,
  excluded_at timestamptz,
  exclusion_reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_admin_access(auth.uid()) THEN
    RAISE EXCEPTION 'Only a confirmed administrator can view excluded attempts';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.contests WHERE id = p_contest_id) THEN
    RAISE EXCEPTION 'Contest not found';
  END IF;
  RETURN QUERY
  SELECT registration.user_id,
    coalesce(nullif(trim(profile.full_name), ''), 'Participant'),
    registration.integrity_excluded_at,
    coalesce(registration.integrity_exclusion_reason, 'left-contest-page')
  FROM public.contest_registrations AS registration
  JOIN public.profiles AS profile ON profile.id = registration.user_id
  WHERE registration.contest_id = p_contest_id
    AND registration.integrity_excluded_at IS NOT NULL
  ORDER BY registration.integrity_excluded_at DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.restore_contest_attempt_with_override(
  p_contest_id uuid,
  p_user_id uuid,
  p_code text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $function$
DECLARE
  v_contest public.contests%ROWTYPE;
  v_hash text := encode(digest(trim(coalesce(p_code, '')), 'sha256'), 'hex');
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_admin_access(auth.uid()) THEN
    RAISE EXCEPTION 'Only a confirmed administrator can restore an excluded attempt';
  END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id FOR UPDATE;
  IF NOT FOUND OR v_contest.integrity_override_code_hash IS NULL
    OR v_contest.integrity_override_code_hash <> v_hash THEN
    RAISE EXCEPTION 'Invalid integrity override code';
  END IF;
  IF NOT v_contest.is_published OR v_contest.archived_at IS NOT NULL
    OR now() < v_contest.start_at OR now() >= v_contest.end_at THEN
    RAISE EXCEPTION 'An attempt can be restored only while the contest is live';
  END IF;
  UPDATE public.contest_registrations
  SET completed_at = NULL,
      integrity_excluded_at = NULL,
      integrity_exclusion_reason = NULL,
      last_activity_at = now()
  WHERE contest_id = p_contest_id
    AND user_id = p_user_id
    AND integrity_excluded_at IS NOT NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'No excluded attempt was found for this participant'; END IF;
  PERFORM public.log_audit_action('contest.integrity_exclusion.restored', 'contest', p_contest_id, jsonb_build_object('participant_id', p_user_id));
END;
$function$;

DO $migration$
DECLARE
  v_source text;
BEGIN
  SELECT pg_get_functiondef('public.finalize_contest_v2(uuid)'::regprocedure) INTO v_source;
  IF v_source IS NULL THEN RAISE EXCEPTION 'finalize_contest_v2 is missing'; END IF;
  IF position('IF v_contest.subject IN (''ielts'', ''cefr'') AND EXISTS (SELECT 1 FROM public.contest_writing_submissions WHERE contest_id = p_contest_id AND submitted_at IS NOT NULL AND score IS NULL) THEN' IN v_source) = 0 THEN
    RAISE EXCEPTION 'Could not add expired Writing submission handling to finalize_contest_v2';
  END IF;
  v_source := replace(
    v_source,
    'IF v_contest.subject IN (''ielts'', ''cefr'') AND EXISTS (SELECT 1 FROM public.contest_writing_submissions WHERE contest_id = p_contest_id AND submitted_at IS NOT NULL AND score IS NULL) THEN',
    'PERFORM public.auto_submit_expired_writing_drafts(p_contest_id);' || chr(10) || '  IF v_contest.subject IN (''ielts'', ''cefr'') AND EXISTS (SELECT 1 FROM public.contest_writing_submissions WHERE contest_id = p_contest_id AND submitted_at IS NOT NULL AND score IS NULL) THEN'
  );
  EXECUTE v_source;
END;
$migration$;

REVOKE ALL ON FUNCTION public.auto_submit_expired_writing_drafts(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_exam_writing_response(uuid, text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_contest_writing_submissions(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.end_contest_attempt(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.exclude_contest_attempt(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_contest_integrity_override_code(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.list_contest_integrity_exclusions(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.restore_contest_attempt_with_override(uuid, uuid, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.save_exam_writing_response(uuid, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_contest_writing_submissions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.end_contest_attempt(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.exclude_contest_attempt(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_contest_integrity_override_code(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_contest_integrity_exclusions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_contest_attempt_with_override(uuid, uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
