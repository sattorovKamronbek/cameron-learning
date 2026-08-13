/*
  IELTS Listening uses one continuous recording for Parts 1–4.

  The full audio is stored on Listening Part 1. Parts 2–4 retain their own
  questions and instructions but do not require a separate recording.
*/

CREATE OR REPLACE FUNCTION public.publish_contest(p_contest_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_contest public.contests%ROWTYPE;
  v_part record;
  v_timing public.contest_exam_section_timings%ROWTYPE;
BEGIN
  IF NOT public.can_manage_contest(p_contest_id) THEN
    RAISE EXCEPTION 'Only the owning judge or an admin can publish this contest';
  END IF;

  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contest not found'; END IF;
  IF v_contest.is_published THEN RAISE EXCEPTION 'Contest is already published'; END IF;
  IF v_contest.start_at <= now() OR v_contest.end_at <= v_contest.start_at THEN
    RAISE EXCEPTION 'Contest schedule is no longer valid';
  END IF;

  IF v_contest.subject = 'programming' THEN
    IF NOT EXISTS (SELECT 1 FROM public.contest_programming_problems WHERE contest_id = p_contest_id) THEN
      RAISE EXCEPTION 'Add at least one programming problem before publishing';
    END IF;
  ELSIF v_contest.subject = 'ielts' THEN
    SELECT * INTO v_timing FROM public.contest_exam_section_timings WHERE contest_id = p_contest_id;
    IF NOT FOUND OR v_timing.listening_minutes <> 30 OR v_timing.reading_minutes <> 60 OR v_timing.writing_minutes <> 60 THEN
      RAISE EXCEPTION 'IELTS Academic requires 30 min Listening, 60 min Reading, and 60 min Writing';
    END IF;
    IF extract(epoch FROM (v_contest.end_at - v_contest.start_at)) <> 150 * 60 THEN
      RAISE EXCEPTION 'IELTS Academic contest duration must be exactly 150 minutes';
    END IF;
    IF (SELECT count(*) FROM public.contest_exam_parts WHERE contest_id = p_contest_id AND section = 'listening') <> 4
      OR (SELECT count(*) FROM public.contest_exam_parts WHERE contest_id = p_contest_id AND section = 'reading') <> 3
      OR (SELECT count(*) FROM public.contest_exam_parts WHERE contest_id = p_contest_id AND section = 'writing') <> 2
      OR EXISTS (
        SELECT 1 FROM public.contest_exam_parts
        WHERE contest_id = p_contest_id
          AND ((position BETWEEN 1 AND 4 AND section <> 'listening')
            OR (position BETWEEN 5 AND 7 AND section <> 'reading')
            OR (position BETWEEN 8 AND 9 AND section <> 'writing')
            OR position NOT BETWEEN 1 AND 9)
      ) THEN
      RAISE EXCEPTION 'IELTS Academic requires Listening Parts 1–4, Reading Passages 1–3, and Writing Tasks 1–2';
    END IF;
    IF (SELECT count(*) FROM public.contest_questions question JOIN public.contest_exam_parts part ON part.id = question.exam_part_id WHERE question.contest_id = p_contest_id AND part.section = 'listening') <> 40
      OR (SELECT count(*) FROM public.contest_questions question JOIN public.contest_exam_parts part ON part.id = question.exam_part_id WHERE question.contest_id = p_contest_id AND part.section = 'reading') <> 40 THEN
      RAISE EXCEPTION 'IELTS Academic requires 40 Listening and 40 Reading questions';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.contest_exam_parts part
      LEFT JOIN public.contest_questions question ON question.exam_part_id = part.id
      WHERE part.contest_id = p_contest_id AND part.section = 'listening'
      GROUP BY part.id HAVING count(question.id) <> 10
    ) THEN
      RAISE EXCEPTION 'Each IELTS Listening part requires exactly 10 questions';
    END IF;
    FOR v_part IN SELECT * FROM public.contest_exam_parts WHERE contest_id = p_contest_id LOOP
      IF v_part.section = 'listening' AND v_part.position = 1 AND nullif(trim(v_part.audio_url), '') IS NULL THEN
        RAISE EXCEPTION 'IELTS Listening requires one full audio recording on Part 1';
      END IF;
      IF v_part.section IN ('reading', 'writing') AND char_length(trim(v_part.content)) < 1 THEN RAISE EXCEPTION 'Every IELTS Reading passage and Writing task requires text'; END IF;
      IF v_part.section IN ('listening', 'reading') AND NOT EXISTS (SELECT 1 FROM public.contest_questions WHERE exam_part_id = v_part.id) THEN RAISE EXCEPTION 'Every IELTS Listening and Reading part needs questions'; END IF;
    END LOOP;
    IF EXISTS (SELECT 1 FROM public.contest_questions WHERE contest_id = p_contest_id AND (answer_type = 'choice' AND correct_option IS NULL OR answer_type = 'text' AND (jsonb_array_length(accepted_answers) = 0 OR word_limit < 1))) THEN RAISE EXCEPTION 'Every IELTS question needs a complete answer key'; END IF;
  ELSIF v_contest.subject = 'cefr' THEN
    SELECT * INTO v_timing FROM public.contest_exam_section_timings WHERE contest_id = p_contest_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Set Listening, Reading and Writing times before publishing'; END IF;
    IF extract(epoch FROM (v_contest.end_at - v_contest.start_at)) <> (v_timing.listening_minutes + v_timing.reading_minutes + v_timing.writing_minutes) * 60 THEN RAISE EXCEPTION 'Section timings must exactly equal the contest duration'; END IF;
    IF EXISTS (SELECT 1 FROM unnest(ARRAY['listening', 'reading', 'writing']::text[]) required(section) WHERE NOT EXISTS (SELECT 1 FROM public.contest_exam_parts part WHERE part.contest_id = p_contest_id AND part.section = required.section)) THEN RAISE EXCEPTION 'IELTS and CEFR exams require Listening, Reading, and Writing parts'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.contest_questions WHERE contest_id = p_contest_id)
      AND NOT EXISTS (SELECT 1 FROM public.contest_gap_fill_answer_keys WHERE contest_id = p_contest_id)
      AND NOT EXISTS (SELECT 1 FROM public.contest_matching_speakers WHERE contest_id = p_contest_id) THEN
      RAISE EXCEPTION 'Add at least one scorable listening or reading activity before publishing';
    END IF;
    IF EXISTS (SELECT 1 FROM public.contest_questions WHERE contest_id = p_contest_id AND exam_part_id IS NULL) THEN RAISE EXCEPTION 'Every IELTS or CEFR question must be assigned to a part'; END IF;
    IF EXISTS (SELECT 1 FROM public.contest_questions question JOIN public.contest_exam_parts part ON part.id = question.exam_part_id WHERE question.contest_id = p_contest_id AND part.section = 'listening' AND part.position = 1 AND question.correct_option IS NULL) THEN RAISE EXCEPTION 'Select every CEFR Listening Part 1 correct option before publishing'; END IF;

    FOR v_part IN SELECT * FROM public.contest_exam_parts WHERE contest_id = p_contest_id LOOP
      IF v_part.section = 'listening' AND nullif(trim(v_part.audio_url), '') IS NULL THEN RAISE EXCEPTION 'Every listening part must include an audio file'; END IF;
      IF v_part.section IN ('reading', 'writing') AND char_length(trim(v_part.content)) < 1 THEN RAISE EXCEPTION 'Every reading passage and writing topic must contain text'; END IF;
      IF (v_part.section = 'listening' AND v_part.position IN (2, 6)) OR (v_part.section = 'reading' AND v_part.position = 1) THEN
        IF NOT EXISTS (SELECT 1 FROM regexp_matches(v_part.content, '\{\{([1-9][0-9]*)\}\}', 'g')) THEN RAISE EXCEPTION 'CEFR % Part % needs gap-fill markers in its text', initcap(v_part.section), v_part.position; END IF;
        IF EXISTS (SELECT 1 FROM regexp_matches(v_part.content, '\{\{([1-9][0-9]*)\}\}', 'g') marker(values) LEFT JOIN public.contest_gap_fill_answer_keys key ON key.exam_part_id = v_part.id AND key.blank_number = (marker.values)[1]::integer WHERE key.id IS NULL) THEN RAISE EXCEPTION 'Save every CEFR % Part % answer key before publishing', initcap(v_part.section), v_part.position; END IF;
      ELSIF (v_part.section = 'listening' AND v_part.position IN (3, 4)) OR (v_part.section = 'reading' AND v_part.position IN (2, 3)) THEN
        IF v_part.section = 'listening' AND v_part.position = 4 AND nullif(trim(v_part.image_url), '') IS NULL THEN RAISE EXCEPTION 'CEFR Listening Part 4 needs a high-resolution map or photo'; END IF;
        IF NOT EXISTS (SELECT 1 FROM public.contest_matching_options WHERE exam_part_id = v_part.id) OR NOT EXISTS (SELECT 1 FROM public.contest_matching_speakers WHERE exam_part_id = v_part.id) THEN RAISE EXCEPTION 'Configure the CEFR matching answer bank before publishing'; END IF;
        IF EXISTS (SELECT 1 FROM public.contest_matching_speakers WHERE exam_part_id = v_part.id AND correct_option_position IS NULL) THEN RAISE EXCEPTION 'Select every CEFR matching answer key before publishing'; END IF;
      ELSIF v_part.section IN ('listening', 'reading')
        AND NOT EXISTS (SELECT 1 FROM public.contest_questions WHERE exam_part_id = v_part.id)
        AND NOT EXISTS (SELECT 1 FROM public.contest_gap_fill_answer_keys WHERE exam_part_id = v_part.id)
        AND NOT EXISTS (SELECT 1 FROM public.contest_matching_speakers WHERE exam_part_id = v_part.id) THEN
        RAISE EXCEPTION '% Part % has no scorable activity. Add a question, gap-fill answer key, or matching answer bank before publishing', initcap(v_part.section), v_part.position;
      END IF;
    END LOOP;
  ELSIF NOT EXISTS (SELECT 1 FROM public.contest_questions WHERE contest_id = p_contest_id) THEN
    RAISE EXCEPTION 'Add at least one complete question before publishing';
  END IF;

  UPDATE public.contests SET is_published = true WHERE id = p_contest_id;
  PERFORM public.log_audit_action('contest.publish', 'contest', p_contest_id, '{}'::jsonb);
END;
$function$;

REVOKE ALL ON FUNCTION public.publish_contest(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_contest(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
