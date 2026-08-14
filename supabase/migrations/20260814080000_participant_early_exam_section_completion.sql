/*
  Participants may finish Listening or Reading before the clock expires. The
  transition is stored per registration, so a refresh or a direct RPC call
  can never reopen a completed section. Writing completion continues to use
  the existing completed_at final-exam lock.
*/

ALTER TABLE public.contest_registrations
  ADD COLUMN IF NOT EXISTS reading_completed_at timestamptz;

CREATE OR REPLACE FUNCTION public.exam_section_window(
  p_contest_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS TABLE (
  active_section text,
  section_starts_at timestamptz,
  section_ends_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_contest public.contests%ROWTYPE;
  v_timing public.contest_exam_section_timings%ROWTYPE;
  v_registration public.contest_registrations%ROWTYPE;
  v_listening_end timestamptz;
  v_reading_start timestamptz;
  v_reading_end timestamptz;
  v_writing_start timestamptz;
  v_writing_end timestamptz;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id;
  SELECT * INTO v_timing FROM public.contest_exam_section_timings WHERE contest_id = p_contest_id;
  SELECT * INTO v_registration
  FROM public.contest_registrations
  WHERE contest_id = p_contest_id AND user_id = p_user_id;

  IF NOT FOUND
    OR v_registration.completed_at IS NOT NULL
    OR now() < v_contest.start_at
    OR now() >= v_contest.end_at THEN
    RETURN;
  END IF;

  v_listening_end := v_contest.start_at + (v_timing.listening_minutes * interval '1 minute');
  IF v_registration.listening_completed_at IS NULL AND now() < v_listening_end THEN
    RETURN QUERY SELECT 'listening'::text, v_contest.start_at, v_listening_end;
    RETURN;
  END IF;

  v_reading_start := coalesce(v_registration.listening_completed_at, v_listening_end);
  v_reading_end := v_reading_start + (v_timing.reading_minutes * interval '1 minute');
  IF v_registration.reading_completed_at IS NULL AND now() < v_reading_end THEN
    RETURN QUERY SELECT 'reading'::text, v_reading_start, least(v_reading_end, v_contest.end_at);
    RETURN;
  END IF;

  v_writing_start := coalesce(v_registration.reading_completed_at, v_reading_end);
  v_writing_end := v_writing_start + (v_timing.writing_minutes * interval '1 minute');
  IF now() < v_writing_end AND now() < v_contest.end_at THEN
    RETURN QUERY SELECT 'writing'::text, v_writing_start, least(v_writing_end, v_contest.end_at);
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_exam_section(
  p_contest_id uuid,
  p_section text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_contest public.contests%ROWTYPE;
  v_completed_at timestamptz;
  v_section text := lower(trim(coalesce(p_section, '')));
BEGIN
  IF v_section NOT IN ('listening', 'reading') THEN
    RAISE EXCEPTION 'Only Listening or Reading can be completed as a section';
  END IF;
  IF auth.uid() IS NULL OR NOT public.active_profile(auth.uid()) THEN
    RAISE EXCEPTION 'An active account is required to complete %', initcap(v_section);
  END IF;

  SELECT * INTO v_contest
  FROM public.contests
  WHERE id = p_contest_id;
  IF NOT FOUND
    OR v_contest.subject NOT IN ('ielts', 'cefr')
    OR NOT v_contest.is_published
    OR v_contest.archived_at IS NOT NULL
    OR now() < v_contest.start_at
    OR now() >= v_contest.end_at THEN
    RAISE EXCEPTION '% is not available for this exam at this time', initcap(v_section);
  END IF;
  IF v_contest.contest_type = 'rated'
    AND (v_contest.created_by = auth.uid() OR public.has_admin_access(auth.uid())) THEN
    RAISE EXCEPTION 'Contest managers cannot submit a rated exam';
  END IF;

  SELECT completed_at INTO v_completed_at
  FROM public.contest_registrations
  WHERE contest_id = p_contest_id AND user_id = auth.uid()
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Register for this exam before submitting';
  END IF;
  IF v_completed_at IS NOT NULL THEN
    RAISE EXCEPTION 'This exam has already been submitted';
  END IF;

  PERFORM public.assert_exam_section_open(p_contest_id, v_section);

  /* An early finish is only available after every activity in that section is
     saved. Otherwise the participant would be locked out of unanswered rows
     and unable to complete the final Writing submission later. */
  IF EXISTS (
    SELECT 1
    FROM public.contest_questions AS question
    JOIN public.contest_exam_parts AS part ON part.id = question.exam_part_id
    WHERE question.contest_id = p_contest_id
      AND part.section = v_section
      AND NOT EXISTS (
        SELECT 1
        FROM public.contest_answers AS answer
        WHERE answer.question_id = question.id
          AND answer.user_id = auth.uid()
      )
  ) THEN
    RAISE EXCEPTION 'Answer every % question before completing this section', v_section;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.contest_gap_fill_answer_keys AS answer_key
    JOIN public.contest_exam_parts AS part ON part.id = answer_key.exam_part_id
    WHERE answer_key.contest_id = p_contest_id
      AND part.section = v_section
      AND NOT EXISTS (
        SELECT 1
        FROM public.contest_gap_fill_responses AS response
        WHERE response.exam_part_id = answer_key.exam_part_id
          AND response.blank_number = answer_key.blank_number
          AND response.user_id = auth.uid()
      )
  ) THEN
    RAISE EXCEPTION 'Fill every % gap-fill answer before completing this section', v_section;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.contest_matching_speakers AS speaker
    JOIN public.contest_exam_parts AS part ON part.id = speaker.exam_part_id
    WHERE speaker.contest_id = p_contest_id
      AND part.section = v_section
      AND NOT EXISTS (
        SELECT 1
        FROM public.contest_matching_responses AS response
        WHERE response.exam_part_id = speaker.exam_part_id
          AND response.speaker_number = speaker.speaker_number
          AND response.user_id = auth.uid()
      )
  ) THEN
    RAISE EXCEPTION 'Complete every % matching item before completing this section', v_section;
  END IF;

  IF v_section = 'listening' THEN
    UPDATE public.contest_registrations
    SET listening_completed_at = now(),
        last_activity_at = now()
    WHERE contest_id = p_contest_id
      AND user_id = auth.uid()
      AND listening_completed_at IS NULL
    RETURNING listening_completed_at INTO v_completed_at;
  ELSE
    UPDATE public.contest_registrations
    SET reading_completed_at = now(),
        last_activity_at = now()
    WHERE contest_id = p_contest_id
      AND user_id = auth.uid()
      AND reading_completed_at IS NULL
    RETURNING reading_completed_at INTO v_completed_at;
  END IF;

  IF v_completed_at IS NULL THEN
    RAISE EXCEPTION '% has already been completed', initcap(v_section);
  END IF;

  RETURN jsonb_build_object(
    'section', v_section,
    'completed_at', v_completed_at
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_listening_section(p_contest_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  RETURN public.complete_exam_section(p_contest_id, 'listening');
END;
$function$;

REVOKE ALL ON FUNCTION public.exam_section_window(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_exam_section(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_listening_section(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_exam_section(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_listening_section(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
