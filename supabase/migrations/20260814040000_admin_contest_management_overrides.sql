/*
  Confirmed administrators may repair a contest after it has started, finished,
  or been archived. Regular contest managers retain the existing time/state
  locks, so participant-facing content is not mutable by ordinary judges.
*/

DO $migration$
DECLARE
  v_signature text;
  v_function_oid regprocedure;
  v_source text;
  v_rewritten text;
BEGIN
  FOREACH v_signature IN ARRAY ARRAY[
    'public.update_contest_v2(uuid,text,text,text,text,text,text,text,text,timestamptz,timestamptz,integer,jsonb,text[],text)',
    'public.save_contest_question(uuid,uuid,integer,text,jsonb,text,integer,jsonb,integer,integer,text,uuid)',
    'public.delete_contest_question(uuid,uuid)',
    'public.save_contest_exam_part(uuid,uuid,integer,text,text,text,text,text,integer)',
    'public.delete_contest_exam_part(uuid,uuid)',
    'public.save_cefr_gap_fill_answer_keys(uuid,uuid,jsonb)',
    'public.save_cefr_matching_config(uuid,uuid,jsonb,jsonb)',
    'public.save_cefr_map_image(uuid,uuid,text)',
    'public.save_exam_part_image(uuid,uuid,text)'
  ]
  LOOP
    v_function_oid := to_regprocedure(v_signature);
    IF v_function_oid IS NULL THEN
      RAISE EXCEPTION 'Required contest management function is missing: %', v_signature;
    END IF;

    SELECT pg_get_functiondef(v_function_oid) INTO v_source;
    v_rewritten := replace(
      v_source,
      'IF NOT FOUND OR v_contest.archived_at IS NOT NULL OR v_contest.start_at <= now() THEN',
      'IF NOT FOUND OR ((v_contest.archived_at IS NOT NULL OR v_contest.start_at <= now()) AND NOT public.has_admin_access(auth.uid())) THEN'
    );
    v_rewritten := replace(
      v_rewritten,
      'IF v_contest.archived_at IS NOT NULL OR v_contest.start_at <= now() THEN',
      'IF (v_contest.archived_at IS NOT NULL OR v_contest.start_at <= now()) AND NOT public.has_admin_access(auth.uid()) THEN'
    );

    IF v_signature LIKE 'public.update_contest_v2%' THEN
      v_rewritten := replace(
        v_rewritten,
        'OR p_start_at <= now() OR p_end_at <= p_start_at',
        'OR (p_start_at <= now() AND NOT public.has_admin_access(auth.uid())) OR p_end_at <= p_start_at'
      );
      v_rewritten := replace(
        v_rewritten,
        'OR p_start_at <= now()' || chr(10) || '    OR p_end_at <= p_start_at',
        'OR (p_start_at <= now() AND NOT public.has_admin_access(auth.uid()))' || chr(10) || '    OR p_end_at <= p_start_at'
      );
    END IF;

    IF v_rewritten = v_source THEN
      RAISE EXCEPTION 'Could not apply the administrator override to %', v_signature;
    END IF;
    EXECUTE v_rewritten;
  END LOOP;
END;
$migration$;

CREATE OR REPLACE FUNCTION public.save_contest_exam_section_timings(
  p_contest_id uuid,
  p_listening_minutes integer,
  p_reading_minutes integer,
  p_writing_minutes integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_contest public.contests%ROWTYPE;
  v_admin boolean := public.has_admin_access(auth.uid());
BEGIN
  IF NOT public.can_manage_contest(p_contest_id) THEN
    RAISE EXCEPTION 'Only the owning judge or an admin can manage exam timings';
  END IF;

  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id FOR UPDATE;
  IF NOT FOUND OR v_contest.subject NOT IN ('ielts', 'cefr') THEN
    RAISE EXCEPTION 'Section timings are available only for IELTS and CEFR exams';
  END IF;
  IF (v_contest.archived_at IS NOT NULL OR v_contest.start_at <= now()) AND NOT v_admin THEN
    RAISE EXCEPTION 'Exam timings cannot be changed after a contest is published or started';
  END IF;
  IF p_listening_minutes NOT BETWEEN 1 AND 720
    OR p_reading_minutes NOT BETWEEN 1 AND 720
    OR p_writing_minutes NOT BETWEEN 1 AND 720 THEN
    RAISE EXCEPTION 'Each section must be between 1 and 720 minutes';
  END IF;
  IF v_contest.subject = 'ielts'
    AND (p_listening_minutes <> 30 OR p_reading_minutes <> 60 OR p_writing_minutes <> 60)
    AND NOT v_admin THEN
    RAISE EXCEPTION 'IELTS Academic timing is fixed at 30 minutes Listening, 60 minutes Reading, and 60 minutes Writing';
  END IF;
  IF extract(epoch FROM (v_contest.end_at - v_contest.start_at)) <> (p_listening_minutes + p_reading_minutes + p_writing_minutes) * 60
    AND NOT v_admin THEN
    RAISE EXCEPTION 'Section timings must exactly equal the contest duration';
  END IF;

  INSERT INTO public.contest_exam_section_timings (contest_id, listening_minutes, reading_minutes, writing_minutes)
  VALUES (p_contest_id, p_listening_minutes, p_reading_minutes, p_writing_minutes)
  ON CONFLICT (contest_id) DO UPDATE
  SET listening_minutes = EXCLUDED.listening_minutes,
      reading_minutes = EXCLUDED.reading_minutes,
      writing_minutes = EXCLUDED.writing_minutes,
      updated_at = now();
END;
$function$;

CREATE OR REPLACE FUNCTION public.reopen_contest_after_testing(
  p_contest_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_contest public.contests%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_admin_access(auth.uid()) THEN
    RAISE EXCEPTION 'Only a confirmed administrator can reopen a test contest';
  END IF;
  IF p_start_at IS NULL OR p_end_at IS NULL OR p_start_at <= now() OR p_end_at <= p_start_at THEN
    RAISE EXCEPTION 'Choose a valid future start and end time';
  END IF;

  SELECT * INTO v_contest
  FROM public.contests
  WHERE id = p_contest_id
  FOR UPDATE;

  IF NOT FOUND OR v_contest.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'Contest not found or archived';
  END IF;
  IF v_contest.contest_type <> 'unrated' THEN
    RAISE EXCEPTION 'Rated contests cannot be reopened after testing';
  END IF;
  IF v_contest.start_at > now() THEN
    RAISE EXCEPTION 'This contest already has a future schedule';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.contest_registrations registration
    WHERE registration.contest_id = p_contest_id AND registration.user_id <> auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.contest_results result
    WHERE result.contest_id = p_contest_id AND result.user_id <> auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.contest_answers answer
    WHERE answer.contest_id = p_contest_id AND answer.user_id <> auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.contest_gap_fill_responses response
    WHERE response.contest_id = p_contest_id AND response.user_id <> auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.contest_matching_responses response
    WHERE response.contest_id = p_contest_id AND response.user_id <> auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.contest_writing_submissions submission
    WHERE submission.contest_id = p_contest_id AND submission.user_id <> auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.contest_reading_annotations annotation
    WHERE annotation.contest_id = p_contest_id AND annotation.user_id <> auth.uid()
  ) THEN
    RAISE EXCEPTION 'This contest has participant data and cannot be reopened';
  END IF;

  DELETE FROM public.contest_results WHERE contest_id = p_contest_id;
  DELETE FROM public.contest_answers WHERE contest_id = p_contest_id;
  DELETE FROM public.contest_gap_fill_responses WHERE contest_id = p_contest_id;
  DELETE FROM public.contest_matching_responses WHERE contest_id = p_contest_id;
  DELETE FROM public.contest_writing_submissions WHERE contest_id = p_contest_id;
  DELETE FROM public.contest_reading_annotations WHERE contest_id = p_contest_id;
  DELETE FROM public.contest_registrations WHERE contest_id = p_contest_id;

  UPDATE public.contests
  SET start_at = p_start_at,
      end_at = p_end_at,
      is_finalized = false,
      finalized_at = NULL
  WHERE id = p_contest_id;

  PERFORM public.log_audit_action(
    'contest.reopen_after_testing',
    'contest',
    p_contest_id,
    jsonb_build_object(
      'previous_start_at', v_contest.start_at,
      'previous_end_at', v_contest.end_at,
      'next_start_at', p_start_at,
      'next_end_at', p_end_at
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.save_contest_exam_section_timings(uuid, integer, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reopen_contest_after_testing(uuid, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_contest_exam_section_timings(uuid, integer, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reopen_contest_after_testing(uuid, timestamptz, timestamptz) TO authenticated;

NOTIFY pgrst, 'reload schema';
