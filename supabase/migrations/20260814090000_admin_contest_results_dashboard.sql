/*
  Private post-contest score board for organizers.

  Participant scores have always been stored on the server, but the public
  leaderboard intentionally opens only after finalization.  This RPC gives a
  contest owner or administrator a read-only, post-end view to grade Writing
  and verify results before publishing the final standings.
*/

CREATE OR REPLACE FUNCTION public.get_contest_admin_results(p_contest_id uuid)
RETURNS TABLE (
  rank integer,
  user_id uuid,
  display_name text,
  score integer,
  answered_count integer,
  total_questions integer,
  completed_at timestamptz,
  pending_writing_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_contest public.contests%ROWTYPE;
  v_total_questions integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.active_profile(auth.uid()) THEN
    RAISE EXCEPTION 'An active account is required to view contest results';
  END IF;
  IF NOT public.can_manage_contest(p_contest_id) THEN
    RAISE EXCEPTION 'Only the contest owner or an administrator can view these results';
  END IF;

  SELECT * INTO v_contest
  FROM public.contests
  WHERE id = p_contest_id;

  IF NOT FOUND OR NOT v_contest.is_published OR v_contest.archived_at IS NOT NULL OR v_contest.end_at > now() THEN
    RAISE EXCEPTION 'Contest results are available after the contest ends';
  END IF;

  SELECT
    coalesce((SELECT count(*) FROM public.contest_questions WHERE contest_id = p_contest_id), 0)::integer
    + coalesce((SELECT count(*) FROM public.contest_gap_fill_answer_keys WHERE contest_id = p_contest_id), 0)::integer
    + coalesce((SELECT count(*) FROM public.contest_matching_speakers WHERE contest_id = p_contest_id), 0)::integer
    + CASE WHEN v_contest.subject IN ('ielts', 'cefr') THEN
        coalesce((SELECT count(*) FROM public.contest_exam_parts WHERE contest_id = p_contest_id AND section = 'writing'), 0)::integer
      ELSE 0 END
  INTO v_total_questions;

  IF v_contest.is_finalized THEN
    RETURN QUERY
    SELECT
      result.rank,
      result.user_id,
      coalesce(nullif(trim(profile.full_name), ''), 'Participant'),
      result.score,
      result.answered_count,
      v_total_questions,
      registration.completed_at,
      0
    FROM public.contest_results AS result
    LEFT JOIN public.profiles AS profile ON profile.id = result.user_id
    LEFT JOIN public.contest_registrations AS registration
      ON registration.contest_id = result.contest_id
      AND registration.user_id = result.user_id
    WHERE result.contest_id = p_contest_id
    ORDER BY result.rank;
    RETURN;
  END IF;

  RETURN QUERY
  WITH participant_scores AS (
    SELECT
      registration.user_id,
      registration.completed_at AS participant_completed_at,
      registration.last_activity_at,
      (
        coalesce((
          SELECT sum(answer.score)
          FROM public.contest_answers AS answer
          WHERE answer.contest_id = registration.contest_id
            AND answer.user_id = registration.user_id
        ), 0)
        + coalesce((
          SELECT sum(response.score)
          FROM public.contest_gap_fill_responses AS response
          WHERE response.contest_id = registration.contest_id
            AND response.user_id = registration.user_id
        ), 0)
        + coalesce((
          SELECT sum(response.score)
          FROM public.contest_matching_responses AS response
          WHERE response.contest_id = registration.contest_id
            AND response.user_id = registration.user_id
        ), 0)
        + CASE WHEN v_contest.subject IN ('ielts', 'cefr') THEN coalesce((
          SELECT sum(submission.score)
          FROM public.contest_writing_submissions AS submission
          WHERE submission.contest_id = registration.contest_id
            AND submission.user_id = registration.user_id
            AND submission.submitted_at IS NOT NULL
        ), 0) ELSE 0 END
      )::integer AS participant_score,
      (
        (SELECT count(*) FROM public.contest_answers AS answer WHERE answer.contest_id = registration.contest_id AND answer.user_id = registration.user_id)
        + (SELECT count(*) FROM public.contest_gap_fill_responses AS response WHERE response.contest_id = registration.contest_id AND response.user_id = registration.user_id)
        + (SELECT count(*) FROM public.contest_matching_responses AS response WHERE response.contest_id = registration.contest_id AND response.user_id = registration.user_id)
        + CASE WHEN v_contest.subject IN ('ielts', 'cefr') THEN
            (SELECT count(*) FROM public.contest_writing_submissions AS submission WHERE submission.contest_id = registration.contest_id AND submission.user_id = registration.user_id AND submission.submitted_at IS NOT NULL)
          ELSE 0 END
      )::integer AS participant_answered_count,
      CASE WHEN v_contest.subject IN ('ielts', 'cefr') THEN (
        SELECT count(*)::integer
        FROM public.contest_writing_submissions AS submission
        WHERE submission.contest_id = registration.contest_id
          AND submission.user_id = registration.user_id
          AND submission.submitted_at IS NOT NULL
          AND submission.score IS NULL
      ) ELSE 0 END AS participant_pending_writing
    FROM public.contest_registrations AS registration
    WHERE registration.contest_id = p_contest_id
      AND (
        v_contest.contest_type <> 'rated'
        OR (registration.user_id <> v_contest.created_by AND NOT public.has_admin_access(registration.user_id))
      )
  ), ranked AS (
    SELECT
      row_number() OVER (ORDER BY participant_score DESC, participant_answered_count DESC, last_activity_at NULLS LAST, user_id)::integer AS result_rank,
      *
    FROM participant_scores
    WHERE participant_answered_count > 0
  )
  SELECT
    ranked.result_rank,
    ranked.user_id,
    coalesce(nullif(trim(profile.full_name), ''), 'Participant'),
    ranked.participant_score,
    ranked.participant_answered_count,
    v_total_questions,
    ranked.participant_completed_at,
    ranked.participant_pending_writing
  FROM ranked
  LEFT JOIN public.profiles AS profile ON profile.id = ranked.user_id
  ORDER BY ranked.result_rank;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_contest_admin_results(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_contest_admin_results(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
