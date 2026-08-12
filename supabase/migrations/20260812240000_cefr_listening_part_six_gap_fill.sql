-- CEFR Listening has six parts. Part 6 uses the same gap-fill flow as
-- Part 2, but occupies the final global question range: 30 through 35.

CREATE OR REPLACE FUNCTION public.save_cefr_gap_fill_answer_keys(
  p_contest_id uuid,
  p_exam_part_id uuid,
  p_answer_keys jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_contest public.contests%ROWTYPE;
  v_part public.contest_exam_parts%ROWTYPE;
  v_marker_numbers integer[];
  v_expected_numbers integer[];
  v_key jsonb;
  v_blank_number integer;
  v_answers jsonb;
  v_points integer;
  v_seen integer[] := ARRAY[]::integer[];
BEGIN
  IF NOT public.can_manage_contest(p_contest_id) THEN RAISE EXCEPTION 'Only the owning judge or an admin can manage answer keys'; END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id FOR UPDATE;
  IF NOT FOUND OR v_contest.subject <> 'cefr' THEN RAISE EXCEPTION 'CEFR contest not found'; END IF;
  IF v_contest.is_published OR v_contest.start_at <= now() THEN RAISE EXCEPTION 'Answer keys cannot be changed after publication or start'; END IF;
  SELECT * INTO v_part FROM public.contest_exam_parts WHERE id = p_exam_part_id AND contest_id = p_contest_id;
  IF NOT FOUND OR NOT ((v_part.section = 'listening' AND v_part.position IN (2, 6)) OR (v_part.section = 'reading' AND v_part.position = 1)) THEN RAISE EXCEPTION 'Gap-fill answer keys are available only for CEFR Listening Parts 2/6 and Reading Part 1'; END IF;
  IF coalesce(jsonb_typeof(p_answer_keys), '') <> 'array' THEN RAISE EXCEPTION 'Answer keys must be an array'; END IF;

  v_expected_numbers := CASE
    WHEN v_part.section = 'reading' THEN ARRAY[1, 2, 3, 4, 5, 6, 7, 8]::integer[]
    WHEN v_part.position = 2 THEN ARRAY[9, 10, 11, 12, 13, 14]::integer[]
    ELSE ARRAY[30, 31, 32, 33, 34, 35]::integer[]
  END;
  SELECT array_agg(DISTINCT (marker.values)[1]::integer ORDER BY (marker.values)[1]::integer)
    INTO v_marker_numbers
  FROM regexp_matches(v_part.content, '\{\{([1-9][0-9]*)\}\}', 'g') AS marker(values);
  IF v_marker_numbers IS DISTINCT FROM v_expected_numbers THEN
    RAISE EXCEPTION 'CEFR Listening Part % must use exactly its required question markers', v_part.position;
  END IF;
  IF jsonb_array_length(p_answer_keys) <> array_length(v_expected_numbers, 1) THEN
    RAISE EXCEPTION 'Enter one answer key for every required Part % marker', v_part.position;
  END IF;

  FOR v_key IN SELECT value FROM jsonb_array_elements(p_answer_keys) AS item(value) LOOP
    IF jsonb_typeof(v_key) <> 'object' OR coalesce(v_key->>'blank_number', '') !~ '^[1-9][0-9]*$' THEN RAISE EXCEPTION 'Every answer key needs a valid blank_number'; END IF;
    v_blank_number := (v_key->>'blank_number')::integer;
    v_answers := v_key->'accepted_answers';
    v_points := coalesce((v_key->>'points')::integer, 1);
    IF v_blank_number <> ALL(v_expected_numbers) OR v_blank_number = ANY(v_seen) THEN RAISE EXCEPTION 'Part % answer keys must cover every marker exactly once', v_part.position; END IF;
    IF coalesce(jsonb_typeof(v_answers), '') <> 'array' OR jsonb_array_length(v_answers) NOT BETWEEN 1 AND 8
      OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_answers) AS item(value) WHERE jsonb_typeof(item.value) <> 'string' OR char_length(trim(item.value #>> '{}')) NOT BETWEEN 1 AND 120) THEN
      RAISE EXCEPTION 'Each blank needs one to eight non-empty accepted answers';
    END IF;
    IF v_points NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Blank points must be between 1 and 1000'; END IF;
    INSERT INTO public.contest_gap_fill_answer_keys (contest_id, exam_part_id, blank_number, accepted_answers, points)
    VALUES (p_contest_id, p_exam_part_id, v_blank_number, v_answers, v_points)
    ON CONFLICT (exam_part_id, blank_number) DO UPDATE SET accepted_answers = EXCLUDED.accepted_answers, points = EXCLUDED.points, updated_at = now();
    v_seen := array_append(v_seen, v_blank_number);
  END LOOP;
  DELETE FROM public.contest_gap_fill_answer_keys WHERE exam_part_id = p_exam_part_id AND blank_number <> ALL(v_expected_numbers);
  PERFORM public.log_audit_action('contest.gap_fill_keys.save', 'contest', p_contest_id, jsonb_build_object('part_id', p_exam_part_id, 'blank_count', array_length(v_expected_numbers, 1)));
END;
$$;

CREATE OR REPLACE FUNCTION public.save_cefr_gap_fill_response(
  p_exam_part_id uuid,
  p_blank_number integer,
  p_answer text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_part public.contest_exam_parts%ROWTYPE;
  v_contest public.contests%ROWTYPE;
  v_timing public.contest_exam_section_timings%ROWTYPE;
  v_key public.contest_gap_fill_answer_keys%ROWTYPE;
  v_correct boolean;
  v_answer text := trim(coalesce(p_answer, ''));
BEGIN
  IF auth.uid() IS NULL OR NOT public.active_profile(auth.uid()) THEN RAISE EXCEPTION 'An active account is required to submit'; END IF;
  SELECT * INTO v_part FROM public.contest_exam_parts WHERE id = p_exam_part_id;
  IF NOT FOUND OR NOT ((v_part.section = 'listening' AND v_part.position IN (2, 6)) OR (v_part.section = 'reading' AND v_part.position = 1)) THEN RAISE EXCEPTION 'CEFR gap-fill part not found'; END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = v_part.contest_id;
  IF v_contest.subject <> 'cefr' OR NOT v_contest.is_published OR v_contest.archived_at IS NOT NULL OR now() < v_contest.start_at OR now() >= v_contest.end_at THEN RAISE EXCEPTION 'Answers are not accepted for this contest at this time'; END IF;
  IF v_contest.contest_type = 'rated' AND (v_contest.created_by = auth.uid() OR public.has_admin_access(auth.uid())) THEN RAISE EXCEPTION 'Contest managers cannot submit a rated exam'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.contest_registrations registration WHERE registration.contest_id = v_contest.id AND registration.user_id = auth.uid()) THEN RAISE EXCEPTION 'Register for this exam before submitting'; END IF;
  IF EXISTS (SELECT 1 FROM public.contest_registrations registration WHERE registration.contest_id = v_contest.id AND registration.user_id = auth.uid() AND registration.completed_at IS NOT NULL) THEN RAISE EXCEPTION 'This exam has already been submitted'; END IF;
  SELECT * INTO v_timing FROM public.contest_exam_section_timings WHERE contest_id = v_contest.id;
  IF NOT FOUND OR (v_part.section = 'listening' AND (now() < v_contest.start_at OR now() >= v_contest.start_at + (v_timing.listening_minutes * interval '1 minute'))) OR (v_part.section = 'reading' AND (now() < v_contest.start_at + (v_timing.listening_minutes * interval '1 minute') OR now() >= v_contest.start_at + ((v_timing.listening_minutes + v_timing.reading_minutes) * interval '1 minute'))) THEN RAISE EXCEPTION 'This exam section is closed'; END IF;
  SELECT * INTO v_key FROM public.contest_gap_fill_answer_keys WHERE exam_part_id = p_exam_part_id AND blank_number = p_blank_number;
  IF NOT FOUND THEN RAISE EXCEPTION 'This blank is not configured'; END IF;
  IF v_answer = '' THEN
    DELETE FROM public.contest_gap_fill_responses WHERE exam_part_id = p_exam_part_id AND blank_number = p_blank_number AND user_id = auth.uid();
    RETURN jsonb_build_object('saved', true, 'cleared', true);
  END IF;
  IF char_length(v_answer) > 120 THEN RAISE EXCEPTION 'An answer may contain at most 120 characters'; END IF;
  SELECT EXISTS (SELECT 1 FROM jsonb_array_elements_text(v_key.accepted_answers) answer WHERE public.normalize_gap_fill_answer(answer) = public.normalize_gap_fill_answer(v_answer)) INTO v_correct;
  INSERT INTO public.contest_gap_fill_responses (contest_id, exam_part_id, blank_number, user_id, answer, is_correct, score)
  VALUES (v_contest.id, p_exam_part_id, p_blank_number, auth.uid(), v_answer, v_correct, CASE WHEN v_correct THEN v_key.points ELSE 0 END)
  ON CONFLICT (exam_part_id, blank_number, user_id) DO UPDATE SET answer = EXCLUDED.answer, is_correct = EXCLUDED.is_correct, score = EXCLUDED.score, submitted_at = now();
  UPDATE public.contest_registrations SET last_activity_at = now() WHERE contest_id = v_contest.id AND user_id = auth.uid();
  RETURN jsonb_build_object('saved', true, 'part_id', p_exam_part_id, 'blank_number', p_blank_number);
END;
$$;

CREATE OR REPLACE FUNCTION public.publish_contest(p_contest_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_contest public.contests%ROWTYPE; v_part record; v_timing public.contest_exam_section_timings%ROWTYPE;
BEGIN
  IF NOT public.can_manage_contest(p_contest_id) THEN RAISE EXCEPTION 'Only the owning judge or an admin can publish this contest'; END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contest not found'; END IF;
  IF v_contest.is_published THEN RAISE EXCEPTION 'Contest is already published'; END IF;
  IF v_contest.start_at <= now() OR v_contest.end_at <= v_contest.start_at THEN RAISE EXCEPTION 'Contest schedule is no longer valid'; END IF;
  IF v_contest.subject = 'programming' THEN
    IF NOT EXISTS (SELECT 1 FROM public.contest_programming_problems WHERE contest_id = p_contest_id) THEN RAISE EXCEPTION 'Add at least one programming problem before publishing'; END IF;
  ELSIF v_contest.subject = 'ielts' THEN
    SELECT * INTO v_timing FROM public.contest_exam_section_timings WHERE contest_id = p_contest_id;
    IF NOT FOUND OR v_timing.listening_minutes <> 30 OR v_timing.reading_minutes <> 60 OR v_timing.writing_minutes <> 60 THEN RAISE EXCEPTION 'IELTS Academic requires 30 min Listening, 60 min Reading, and 60 min Writing'; END IF;
    IF extract(epoch FROM (v_contest.end_at - v_contest.start_at)) <> 150 * 60 THEN RAISE EXCEPTION 'IELTS Academic contest duration must be exactly 150 minutes'; END IF;
    IF (SELECT count(*) FROM public.contest_exam_parts WHERE contest_id = p_contest_id AND section = 'listening') <> 4
      OR (SELECT count(*) FROM public.contest_exam_parts WHERE contest_id = p_contest_id AND section = 'reading') <> 3
      OR (SELECT count(*) FROM public.contest_exam_parts WHERE contest_id = p_contest_id AND section = 'writing') <> 2
      OR EXISTS (SELECT 1 FROM public.contest_exam_parts WHERE contest_id = p_contest_id AND ((position BETWEEN 1 AND 4 AND section <> 'listening') OR (position BETWEEN 5 AND 7 AND section <> 'reading') OR (position BETWEEN 8 AND 9 AND section <> 'writing') OR position NOT BETWEEN 1 AND 9)) THEN
      RAISE EXCEPTION 'IELTS Academic requires Listening Parts 1–4, Reading Passages 1–3, and Writing Tasks 1–2';
    END IF;
    IF (SELECT count(*) FROM public.contest_questions question JOIN public.contest_exam_parts part ON part.id = question.exam_part_id WHERE question.contest_id = p_contest_id AND part.section = 'listening') <> 40
      OR (SELECT count(*) FROM public.contest_questions question JOIN public.contest_exam_parts part ON part.id = question.exam_part_id WHERE question.contest_id = p_contest_id AND part.section = 'reading') <> 40 THEN
      RAISE EXCEPTION 'IELTS Academic requires 40 Listening and 40 Reading questions';
    END IF;
    IF EXISTS (SELECT 1 FROM public.contest_exam_parts part LEFT JOIN public.contest_questions question ON question.exam_part_id = part.id WHERE part.contest_id = p_contest_id AND part.section = 'listening' GROUP BY part.id HAVING count(question.id) <> 10) THEN RAISE EXCEPTION 'Each IELTS Listening part requires exactly 10 questions'; END IF;
    FOR v_part IN SELECT * FROM public.contest_exam_parts WHERE contest_id = p_contest_id LOOP
      IF v_part.section = 'listening' AND nullif(trim(v_part.audio_url), '') IS NULL THEN RAISE EXCEPTION 'Every IELTS Listening part requires an audio file'; END IF;
      IF v_part.section IN ('reading', 'writing') AND char_length(trim(v_part.content)) < 1 THEN RAISE EXCEPTION 'Every IELTS Reading passage and Writing task requires text'; END IF;
      IF v_part.section IN ('listening', 'reading') AND NOT EXISTS (SELECT 1 FROM public.contest_questions WHERE exam_part_id = v_part.id) THEN RAISE EXCEPTION 'Every IELTS Listening and Reading part needs questions'; END IF;
    END LOOP;
    IF EXISTS (SELECT 1 FROM public.contest_questions WHERE contest_id = p_contest_id AND (answer_type = 'choice' AND correct_option IS NULL OR answer_type = 'text' AND (jsonb_array_length(accepted_answers) = 0 OR word_limit < 1))) THEN RAISE EXCEPTION 'Every IELTS question needs a complete answer key'; END IF;
  ELSIF v_contest.subject = 'cefr' THEN
    SELECT * INTO v_timing FROM public.contest_exam_section_timings WHERE contest_id = p_contest_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Set Listening, Reading and Writing times before publishing'; END IF;
    IF extract(epoch FROM (v_contest.end_at - v_contest.start_at)) <> (v_timing.listening_minutes + v_timing.reading_minutes + v_timing.writing_minutes) * 60 THEN RAISE EXCEPTION 'Section timings must exactly equal the contest duration'; END IF;
    IF EXISTS (SELECT 1 FROM unnest(ARRAY['listening', 'reading', 'writing']::text[]) required(section) WHERE NOT EXISTS (SELECT 1 FROM public.contest_exam_parts part WHERE part.contest_id = p_contest_id AND part.section = required.section)) THEN RAISE EXCEPTION 'IELTS and CEFR exams require Listening, Reading, and Writing parts'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.contest_questions WHERE contest_id = p_contest_id) AND NOT EXISTS (SELECT 1 FROM public.contest_gap_fill_answer_keys WHERE contest_id = p_contest_id) AND NOT EXISTS (SELECT 1 FROM public.contest_matching_speakers WHERE contest_id = p_contest_id) THEN RAISE EXCEPTION 'Add at least one scorable listening or reading activity before publishing'; END IF;
    IF EXISTS (SELECT 1 FROM public.contest_questions WHERE contest_id = p_contest_id AND exam_part_id IS NULL) THEN RAISE EXCEPTION 'Every IELTS or CEFR question must be assigned to a part'; END IF;
    IF EXISTS (SELECT 1 FROM public.contest_questions question JOIN public.contest_exam_parts part ON part.id = question.exam_part_id WHERE question.contest_id = p_contest_id AND part.section = 'listening' AND part.position = 1 AND question.correct_option IS NULL) THEN RAISE EXCEPTION 'Select every CEFR Listening Part 1 correct option before publishing'; END IF;
    FOR v_part IN SELECT * FROM public.contest_exam_parts WHERE contest_id = p_contest_id LOOP
      IF v_part.section = 'listening' AND nullif(trim(v_part.audio_url), '') IS NULL THEN RAISE EXCEPTION 'Every listening part must include an audio file'; END IF;
      IF v_part.section IN ('reading', 'writing') AND char_length(trim(v_part.content)) < 1 THEN RAISE EXCEPTION 'Every reading passage and writing topic must contain text'; END IF;
      IF (v_part.section = 'listening' AND v_part.position IN (2, 6)) OR (v_part.section = 'reading' AND v_part.position IN (1, 5)) THEN
        IF NOT EXISTS (SELECT 1 FROM regexp_matches(v_part.content, '\{\{([1-9][0-9]*)\}\}', 'g')) THEN RAISE EXCEPTION 'CEFR % Part % needs gap-fill markers in its text', initcap(v_part.section), v_part.position; END IF;
        IF EXISTS (SELECT 1 FROM regexp_matches(v_part.content, '\{\{([1-9][0-9]*)\}\}', 'g') marker(values) LEFT JOIN public.contest_gap_fill_answer_keys key ON key.exam_part_id = v_part.id AND key.blank_number = (marker.values)[1]::integer WHERE key.id IS NULL) THEN RAISE EXCEPTION 'Save every CEFR % Part % answer key before publishing', initcap(v_part.section), v_part.position; END IF;
      ELSIF (v_part.section = 'listening' AND v_part.position IN (3, 4)) OR (v_part.section = 'reading' AND v_part.position IN (2, 3)) THEN
        IF v_part.section = 'listening' AND v_part.position = 4 AND nullif(trim(v_part.image_url), '') IS NULL THEN RAISE EXCEPTION 'CEFR Listening Part 4 needs a high-resolution map or photo'; END IF;
        IF NOT EXISTS (SELECT 1 FROM public.contest_matching_options WHERE exam_part_id = v_part.id) OR NOT EXISTS (SELECT 1 FROM public.contest_matching_speakers WHERE exam_part_id = v_part.id) THEN RAISE EXCEPTION 'Configure the CEFR matching answer bank before publishing'; END IF;
        IF EXISTS (SELECT 1 FROM public.contest_matching_speakers WHERE exam_part_id = v_part.id AND correct_option_position IS NULL) THEN RAISE EXCEPTION 'Select every CEFR matching answer key before publishing'; END IF;
      ELSIF v_part.section IN ('listening', 'reading') AND NOT EXISTS (SELECT 1 FROM public.contest_questions WHERE exam_part_id = v_part.id) THEN
        RAISE EXCEPTION 'Every listening and reading part must have at least one question';
      END IF;
    END LOOP;
  ELSIF NOT EXISTS (SELECT 1 FROM public.contest_questions WHERE contest_id = p_contest_id) THEN
    RAISE EXCEPTION 'Add at least one complete question before publishing';
  END IF;
  UPDATE public.contests SET is_published = true WHERE id = p_contest_id;
  PERFORM public.log_audit_action('contest.publish', 'contest', p_contest_id, '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.save_cefr_gap_fill_answer_keys(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_cefr_gap_fill_response(uuid, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.publish_contest(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_cefr_gap_fill_answer_keys(uuid, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_cefr_gap_fill_response(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_contest(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
