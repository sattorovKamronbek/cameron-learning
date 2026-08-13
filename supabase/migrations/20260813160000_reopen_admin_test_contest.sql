/*
  A creator may need to test an unrated contest before its public date.  This
  recovery path discards only that creator's test data and moves the contest
  back to a future schedule.  Rated contests and contests with any other
  participant are deliberately excluded: their published results or ratings
  must never be silently rolled back.
*/

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
  IF v_contest.created_by <> auth.uid() THEN
    RAISE EXCEPTION 'Only the contest creator can reopen this test contest';
  END IF;
  IF v_contest.contest_type <> 'unrated' THEN
    RAISE EXCEPTION 'Rated contests cannot be reopened after testing';
  END IF;
  IF v_contest.start_at > now() THEN
    RAISE EXCEPTION 'This contest already has a future schedule';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.contest_registrations registration
    WHERE registration.contest_id = p_contest_id
      AND registration.user_id <> auth.uid()
  ) OR EXISTS (
    SELECT 1
    FROM public.contest_results result
    WHERE result.contest_id = p_contest_id
      AND result.user_id <> auth.uid()
  ) OR EXISTS (
    SELECT 1
    FROM public.contest_answers answer
    WHERE answer.contest_id = p_contest_id
      AND answer.user_id <> auth.uid()
  ) OR EXISTS (
    SELECT 1
    FROM public.contest_gap_fill_responses response
    WHERE response.contest_id = p_contest_id
      AND response.user_id <> auth.uid()
  ) OR EXISTS (
    SELECT 1
    FROM public.contest_matching_responses response
    WHERE response.contest_id = p_contest_id
      AND response.user_id <> auth.uid()
  ) OR EXISTS (
    SELECT 1
    FROM public.contest_writing_submissions submission
    WHERE submission.contest_id = p_contest_id
      AND submission.user_id <> auth.uid()
  ) THEN
    RAISE EXCEPTION 'This contest has participant data and cannot be reopened';
  END IF;

  DELETE FROM public.contest_results WHERE contest_id = p_contest_id;
  DELETE FROM public.contest_answers WHERE contest_id = p_contest_id;
  DELETE FROM public.contest_gap_fill_responses WHERE contest_id = p_contest_id;
  DELETE FROM public.contest_matching_responses WHERE contest_id = p_contest_id;
  DELETE FROM public.contest_writing_submissions WHERE contest_id = p_contest_id;
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

REVOKE ALL ON FUNCTION public.reopen_contest_after_testing(uuid, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reopen_contest_after_testing(uuid, timestamptz, timestamptz) TO authenticated;

NOTIFY pgrst, 'reload schema';
