/*
  Individual IELTS / CEFR tests

  A test reuses the fully authored language-exam content of a contest, but its
  clock belongs to one registration.  The participant explicitly chooses at
  the beginning whether Listening/Reading results may be shown to them.  That
  choice is immutable; Writing never appears in the participant result.
*/

ALTER TABLE public.contests
  DROP CONSTRAINT IF EXISTS contests_contest_mode_check;

ALTER TABLE public.contests
  ADD CONSTRAINT contests_contest_mode_check
  CHECK (contest_mode IN ('contest', 'gym', 'test'));

ALTER TABLE public.contest_registrations
  ADD COLUMN IF NOT EXISTS test_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS show_test_results boolean;

CREATE INDEX IF NOT EXISTS contest_registrations_test_started_idx
  ON public.contest_registrations (contest_id, test_started_at)
  WHERE test_started_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_contest_v2(
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
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $function$
DECLARE
  v_id uuid;
  v_role text;
  v_hash text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_judge_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only active judges or administrators can create contests';
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role = 'judge' AND (p_contest_mode <> 'gym' OR p_contest_type <> 'unrated') THEN
    RAISE EXCEPTION 'Judges can create unrated Gym contests only';
  END IF;
  IF p_contest_mode NOT IN ('contest', 'gym', 'test')
    OR p_contest_type NOT IN ('rated', 'unrated')
    OR p_visibility NOT IN ('public', 'private') THEN
    RAISE EXCEPTION 'Invalid contest mode, type, or visibility';
  END IF;
  IF (p_contest_mode IN ('gym', 'test') AND p_contest_type <> 'unrated')
    OR (p_contest_mode = 'test' AND p_subject NOT IN ('ielts', 'cefr')) THEN
    RAISE EXCEPTION 'Tests must be unrated IELTS or CEFR exams';
  END IF;
  IF char_length(trim(coalesce(p_title, ''))) NOT BETWEEN 3 AND 160
    OR coalesce(p_subject, '') !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    OR p_difficulty NOT IN ('easy', 'medium', 'hard', 'expert')
    OR p_start_at <= now() OR p_end_at <= p_start_at
    OR p_max_participants NOT BETWEEN 1 AND 100000
    OR jsonb_typeof(coalesce(p_rules, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Invalid contest data';
  END IF;

  IF p_visibility = 'private' THEN
    IF char_length(trim(coalesce(p_private_access_code, ''))) NOT BETWEEN 10 AND 200 THEN
      RAISE EXCEPTION 'Private contest access code must be 10 to 200 characters';
    END IF;
    v_hash := encode(digest(trim(p_private_access_code), 'sha256'), 'hex');
  END IF;

  INSERT INTO public.contests (
    slug, title, description, subject, difficulty, contest_type, contest_mode,
    visibility, private_access_hash, start_at, end_at, max_participants, rules,
    tags, prize, created_by
  ) VALUES (
    public.contest_slug(p_title), trim(p_title), trim(coalesce(p_description, '')),
    p_subject, p_difficulty, p_contest_type, p_contest_mode, p_visibility, v_hash,
    p_start_at, p_end_at, p_max_participants, coalesce(p_rules, '[]'::jsonb),
    coalesce(p_tags, ARRAY[]::text[]), nullif(trim(p_prize), ''), auth.uid()
  ) RETURNING id INTO v_id;

  PERFORM public.log_audit_action(
    'contest.create', 'contest', v_id,
    jsonb_build_object('mode', p_contest_mode, 'visibility', p_visibility, 'type', p_contest_type)
  );
  RETURN v_id;
END;
$function$;

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
SET search_path = pg_catalog, public, extensions
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
  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id FOR UPDATE;
  IF NOT FOUND OR ((v_contest.is_published OR v_contest.start_at <= now()) AND NOT v_admin) THEN
    RAISE EXCEPTION 'Published or started contests cannot be edited';
  END IF;
  IF v_contest.contest_mode = 'test' AND EXISTS (
    SELECT 1 FROM public.contest_registrations
    WHERE contest_id = p_contest_id AND test_started_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'A test cannot be changed after a participant has started it';
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role = 'judge' AND (p_contest_mode <> 'gym' OR p_contest_type <> 'unrated') THEN
    RAISE EXCEPTION 'Judges can edit only their unrated Gym contests';
  END IF;
  IF p_contest_mode NOT IN ('contest', 'gym', 'test')
    OR p_contest_type NOT IN ('rated', 'unrated')
    OR p_visibility NOT IN ('public', 'private')
    OR (p_contest_mode IN ('gym', 'test') AND p_contest_type <> 'unrated')
    OR (p_contest_mode = 'test' AND p_subject NOT IN ('ielts', 'cefr'))
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
    IF v_hash IS NULL THEN RAISE EXCEPTION 'A private contest needs an access code'; END IF;
  ELSE
    v_hash := NULL;
  END IF;

  UPDATE public.contests
  SET title = trim(p_title), description = trim(coalesce(p_description, '')),
      subject = p_subject, difficulty = p_difficulty, contest_type = p_contest_type,
      contest_mode = p_contest_mode, visibility = p_visibility,
      private_access_hash = v_hash, start_at = p_start_at, end_at = p_end_at,
      max_participants = p_max_participants, rules = coalesce(p_rules, '[]'::jsonb),
      tags = coalesce(p_tags, ARRAY[]::text[]), prize = nullif(trim(p_prize), '')
  WHERE id = p_contest_id;
  PERFORM public.log_audit_action('contest.update', 'contest', p_contest_id, '{}'::jsonb);
END;
$function$;

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
  v_total_minutes integer := p_listening_minutes + p_reading_minutes + p_writing_minutes;
BEGIN
  IF NOT public.can_manage_contest(p_contest_id) THEN
    RAISE EXCEPTION 'Only the owning judge or an admin can manage exam timings';
  END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id FOR UPDATE;
  IF NOT FOUND OR v_contest.subject NOT IN ('ielts', 'cefr') THEN
    RAISE EXCEPTION 'Section timings are available only for IELTS and CEFR exams';
  END IF;
  IF v_contest.archived_at IS NOT NULL
    OR (v_contest.contest_mode <> 'test' AND (v_contest.is_published OR v_contest.start_at <= now()))
    OR (v_contest.contest_mode = 'test' AND EXISTS (
      SELECT 1 FROM public.contest_registrations
      WHERE contest_id = p_contest_id AND test_started_at IS NOT NULL
    )) THEN
    RAISE EXCEPTION 'Exam timings cannot be changed after an attempt has started';
  END IF;
  IF p_listening_minutes NOT BETWEEN 1 AND 720
    OR p_reading_minutes NOT BETWEEN 1 AND 720
    OR p_writing_minutes NOT BETWEEN 1 AND 720 THEN
    RAISE EXCEPTION 'Each section must be between 1 and 720 minutes';
  END IF;
  IF v_contest.contest_mode <> 'test'
    AND extract(epoch FROM (v_contest.end_at - v_contest.start_at)) <> v_total_minutes * 60 THEN
    RAISE EXCEPTION 'Listening, Reading and Writing times must exactly equal the contest duration';
  END IF;

  INSERT INTO public.contest_exam_section_timings (
    contest_id, listening_minutes, reading_minutes, writing_minutes
  ) VALUES (p_contest_id, p_listening_minutes, p_reading_minutes, p_writing_minutes)
  ON CONFLICT (contest_id) DO UPDATE SET
    listening_minutes = EXCLUDED.listening_minutes,
    reading_minutes = EXCLUDED.reading_minutes,
    writing_minutes = EXCLUDED.writing_minutes,
    updated_at = now();

  /* Keep the draft's nominal duration useful to the existing publish checks. */
  IF v_contest.contest_mode = 'test' THEN
    UPDATE public.contests SET end_at = start_at + (v_total_minutes * interval '1 minute')
    WHERE id = p_contest_id;
  END IF;
  PERFORM public.log_audit_action(
    'contest.exam_timing.save', 'contest', p_contest_id,
    jsonb_build_object('listening', p_listening_minutes, 'reading', p_reading_minutes, 'writing', p_writing_minutes)
  );
END;
$function$;

/* Preserve the established publication checks. For a Test only the nominal
   draft schedule is validated; publication then opens a long-lived catalogue
   template while each registration receives its own short exam window. */
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
      IF v_part.section IN ('reading', 'writing') AND char_length(trim(v_part.content)) < 1 THEN
        RAISE EXCEPTION 'Every IELTS Reading passage and Writing task requires text';
      END IF;
      IF v_part.section IN ('listening', 'reading') AND NOT EXISTS (SELECT 1 FROM public.contest_questions WHERE exam_part_id = v_part.id) THEN
        RAISE EXCEPTION 'Every IELTS Listening and Reading part needs questions';
      END IF;
    END LOOP;
    IF EXISTS (SELECT 1 FROM public.contest_questions WHERE contest_id = p_contest_id AND (answer_type = 'choice' AND correct_option IS NULL OR answer_type = 'text' AND (jsonb_array_length(accepted_answers) = 0 OR word_limit < 1))) THEN
      RAISE EXCEPTION 'Every IELTS question needs a complete answer key';
    END IF;
  ELSIF v_contest.subject = 'cefr' THEN
    SELECT * INTO v_timing FROM public.contest_exam_section_timings WHERE contest_id = p_contest_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Set Listening, Reading and Writing times before publishing'; END IF;
    IF extract(epoch FROM (v_contest.end_at - v_contest.start_at)) <> (v_timing.listening_minutes + v_timing.reading_minutes + v_timing.writing_minutes) * 60 THEN
      RAISE EXCEPTION 'Section timings must exactly equal the contest duration';
    END IF;
    IF EXISTS (SELECT 1 FROM unnest(ARRAY['listening', 'reading', 'writing']::text[]) required(section) WHERE NOT EXISTS (SELECT 1 FROM public.contest_exam_parts part WHERE part.contest_id = p_contest_id AND part.section = required.section)) THEN
      RAISE EXCEPTION 'IELTS and CEFR exams require Listening, Reading, and Writing parts';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.contest_questions WHERE contest_id = p_contest_id)
      AND NOT EXISTS (SELECT 1 FROM public.contest_gap_fill_answer_keys WHERE contest_id = p_contest_id)
      AND NOT EXISTS (SELECT 1 FROM public.contest_matching_speakers WHERE contest_id = p_contest_id) THEN
      RAISE EXCEPTION 'Add at least one scorable listening or reading activity before publishing';
    END IF;
    IF EXISTS (SELECT 1 FROM public.contest_questions WHERE contest_id = p_contest_id AND exam_part_id IS NULL) THEN
      RAISE EXCEPTION 'Every IELTS or CEFR question must be assigned to a part';
    END IF;
    IF EXISTS (SELECT 1 FROM public.contest_questions question JOIN public.contest_exam_parts part ON part.id = question.exam_part_id WHERE question.contest_id = p_contest_id AND part.section = 'listening' AND part.position = 1 AND question.correct_option IS NULL) THEN
      RAISE EXCEPTION 'Select every CEFR Listening Part 1 correct option before publishing';
    END IF;
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

  UPDATE public.contests
  SET is_published = true,
      start_at = CASE WHEN contest_mode = 'test' THEN now() - interval '1 minute' ELSE start_at END,
      end_at = CASE WHEN contest_mode = 'test' THEN now() + interval '10 years' ELSE end_at END
  WHERE id = p_contest_id;
  PERFORM public.log_audit_action('contest.publish', 'contest', p_contest_id, '{}'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.start_language_test(
  p_contest_id uuid,
  p_show_results boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_contest public.contests%ROWTYPE;
  v_registration public.contest_registrations%ROWTYPE;
  v_count bigint;
BEGIN
  IF auth.uid() IS NULL OR NOT public.active_profile(auth.uid()) THEN
    RAISE EXCEPTION 'An active account is required to start a test';
  END IF;
  SELECT * INTO v_contest
  FROM public.contests
  WHERE id = p_contest_id
  FOR UPDATE;
  IF NOT FOUND OR NOT v_contest.is_published OR v_contest.archived_at IS NOT NULL
    OR v_contest.contest_mode <> 'test' OR v_contest.subject NOT IN ('ielts', 'cefr') THEN
    RAISE EXCEPTION 'This individual IELTS / CEFR test is unavailable';
  END IF;
  IF v_contest.visibility = 'private' AND NOT EXISTS (
    SELECT 1 FROM public.contest_private_members
    WHERE contest_id = p_contest_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Redeem the private test access code first';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.contest_exam_section_timings WHERE contest_id = p_contest_id)
    OR NOT EXISTS (SELECT 1 FROM public.contest_exam_parts WHERE contest_id = p_contest_id AND section = 'listening')
    OR NOT EXISTS (SELECT 1 FROM public.contest_exam_parts WHERE contest_id = p_contest_id AND section = 'reading')
    OR NOT EXISTS (SELECT 1 FROM public.contest_exam_parts WHERE contest_id = p_contest_id AND section = 'writing') THEN
    RAISE EXCEPTION 'This test is not fully configured';
  END IF;

  SELECT * INTO v_registration
  FROM public.contest_registrations
  WHERE contest_id = p_contest_id AND user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    SELECT count(*) INTO v_count FROM public.contest_registrations WHERE contest_id = p_contest_id;
    IF v_count >= v_contest.max_participants THEN RAISE EXCEPTION 'Test capacity has been reached'; END IF;
    INSERT INTO public.contest_registrations (
      contest_id, user_id, test_started_at, show_test_results, last_activity_at
    ) VALUES (
      p_contest_id, auth.uid(), now(), p_show_results, now()
    ) RETURNING * INTO v_registration;
  ELSIF v_registration.test_started_at IS NULL THEN
    UPDATE public.contest_registrations
    SET test_started_at = now(), show_test_results = p_show_results, last_activity_at = now()
    WHERE contest_id = p_contest_id AND user_id = auth.uid()
    RETURNING * INTO v_registration;
  END IF;

  RETURN jsonb_build_object(
    'started_at', v_registration.test_started_at,
    'show_results', v_registration.show_test_results,
    'completed_at', v_registration.completed_at
  );
END;
$function$;

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
  v_attempt_start timestamptz;
  v_listening_end timestamptz;
  v_reading_start timestamptz;
  v_reading_end timestamptz;
  v_writing_start timestamptz;
  v_writing_end timestamptz;
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id;
  SELECT * INTO v_timing FROM public.contest_exam_section_timings WHERE contest_id = p_contest_id;
  SELECT * INTO v_registration FROM public.contest_registrations
  WHERE contest_id = p_contest_id AND user_id = p_user_id;

  IF NOT FOUND OR v_registration.completed_at IS NOT NULL THEN RETURN; END IF;
  IF v_contest.contest_mode = 'test' THEN
    IF v_registration.test_started_at IS NULL THEN RETURN; END IF;
    v_attempt_start := v_registration.test_started_at;
  ELSE
    IF now() < v_contest.start_at OR now() >= v_contest.end_at THEN RETURN; END IF;
    v_attempt_start := v_contest.start_at;
  END IF;

  v_listening_end := v_attempt_start + (v_timing.listening_minutes * interval '1 minute');
  IF v_registration.listening_completed_at IS NULL AND now() < v_listening_end THEN
    RETURN QUERY SELECT 'listening'::text, v_attempt_start, v_listening_end;
    RETURN;
  END IF;

  v_reading_start := coalesce(v_registration.listening_completed_at, v_listening_end);
  v_reading_end := v_reading_start + (v_timing.reading_minutes * interval '1 minute');
  IF v_registration.reading_completed_at IS NULL AND now() < v_reading_end THEN
    RETURN QUERY SELECT 'reading'::text, v_reading_start,
      CASE WHEN v_contest.contest_mode = 'test' THEN v_reading_end ELSE least(v_reading_end, v_contest.end_at) END;
    RETURN;
  END IF;

  v_writing_start := coalesce(v_registration.reading_completed_at, v_reading_end);
  v_writing_end := v_writing_start + (v_timing.writing_minutes * interval '1 minute');
  IF now() < v_writing_end AND (v_contest.contest_mode = 'test' OR now() < v_contest.end_at) THEN
    RETURN QUERY SELECT 'writing'::text, v_writing_start,
      CASE WHEN v_contest.contest_mode = 'test' THEN v_writing_end ELSE least(v_writing_end, v_contest.end_at) END;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_contest_workspace(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_contest public.contests%ROWTYPE;
  v_registration public.contest_registrations%ROWTYPE;
  v_timing public.contest_exam_section_timings%ROWTYPE;
  v_attempt_start timestamptz;
  v_listening_end timestamptz;
  v_reading_start timestamptz;
  v_reading_end timestamptz;
  v_writing_start timestamptz;
  v_attempt_end timestamptz;
  v_payload jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.active_profile(auth.uid()) THEN
    RAISE EXCEPTION 'Sign in with an active account to enter a contest';
  END IF;
  SELECT * INTO v_contest FROM public.contests
  WHERE slug = p_slug AND is_published AND archived_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contest not found'; END IF;
  SELECT * INTO v_registration FROM public.contest_registrations
  WHERE contest_id = v_contest.id AND user_id = auth.uid()
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Register for this contest before entering'; END IF;

  IF v_contest.contest_mode = 'test' THEN
    IF v_contest.subject NOT IN ('ielts', 'cefr') OR v_registration.test_started_at IS NULL THEN
      RAISE EXCEPTION 'Start this IELTS / CEFR test before entering';
    END IF;
    SELECT * INTO v_timing FROM public.contest_exam_section_timings WHERE contest_id = v_contest.id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Test timing is unavailable'; END IF;
    v_attempt_start := v_registration.test_started_at;
    v_listening_end := v_attempt_start + (v_timing.listening_minutes * interval '1 minute');
    v_reading_start := coalesce(v_registration.listening_completed_at, v_listening_end);
    v_reading_end := v_reading_start + (v_timing.reading_minutes * interval '1 minute');
    v_writing_start := coalesce(v_registration.reading_completed_at, v_reading_end);
    v_attempt_end := v_writing_start + (v_timing.writing_minutes * interval '1 minute');

    IF now() >= v_attempt_end AND v_registration.completed_at IS NULL THEN
      UPDATE public.contest_writing_submissions AS submission
      SET submitted_at = coalesce(submission.submitted_at, v_attempt_end), updated_at = now()
      FROM public.contest_exam_parts AS part
      WHERE submission.contest_id = v_contest.id
        AND submission.user_id = auth.uid()
        AND submission.exam_part_id = part.id
        AND part.section = 'writing'
        AND submission.submitted_at IS NULL
        AND char_length(trim(submission.content)) > 0;
      UPDATE public.contest_registrations
      SET completed_at = v_attempt_end, last_activity_at = now()
      WHERE contest_id = v_contest.id AND user_id = auth.uid() AND completed_at IS NULL
      RETURNING * INTO v_registration;
    END IF;
  ELSE
    IF now() < v_contest.start_at THEN RAISE EXCEPTION 'Contest has not started'; END IF;
    IF now() >= v_contest.end_at THEN RAISE EXCEPTION 'Contest has finished'; END IF;
    v_attempt_start := v_contest.start_at;
    v_attempt_end := v_contest.end_at;
  END IF;

  SELECT jsonb_build_object(
    'contest', jsonb_build_object(
      'id', contest.id, 'slug', contest.slug, 'title', contest.title,
      'subject', contest.subject, 'start_at', v_attempt_start,
      'end_at', v_attempt_end, 'contest_type', contest.contest_type,
      'contest_mode', contest.contest_mode, 'completed_at', registration.completed_at,
      'show_test_results', coalesce(registration.show_test_results, false)
    ),
    'exam_timing', CASE WHEN contest.subject IN ('ielts', 'cefr') THEN (
      SELECT jsonb_build_object(
        'listening_minutes', timing.listening_minutes,
        'reading_minutes', timing.reading_minutes,
        'writing_minutes', timing.writing_minutes,
        'active_section', section_window.active_section,
        'section_starts_at', section_window.section_starts_at,
        'section_ends_at', section_window.section_ends_at
      )
      FROM public.contest_exam_section_timings AS timing
      CROSS JOIN LATERAL public.exam_section_window(contest.id, auth.uid()) AS section_window
      WHERE timing.contest_id = contest.id
    ) ELSE NULL END,
    'parts', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', part.id, 'position', part.position, 'section', part.section,
        'title', part.title, 'instructions', part.instructions, 'content', part.content,
        'audio_url', part.audio_url, 'image_url', part.image_url, 'max_points', part.max_points
      ) ORDER BY part.position)
      FROM public.contest_exam_parts AS part
      WHERE part.contest_id = contest.id
        AND (contest.subject NOT IN ('ielts', 'cefr') OR part.section = public.current_exam_section(contest.id))
    ), '[]'::jsonb),
    'questions', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', question.id, 'exam_part_id', question.exam_part_id,
        'position', question.position, 'prompt', question.prompt, 'options', question.options,
        'answer_type', question.answer_type, 'word_limit', question.word_limit, 'points', question.points
      ) ORDER BY question.position)
      FROM public.contest_questions AS question
      WHERE question.contest_id = contest.id
        AND (contest.subject NOT IN ('ielts', 'cefr') OR EXISTS (
          SELECT 1 FROM public.contest_exam_parts AS part
          WHERE part.id = question.exam_part_id AND part.section = public.current_exam_section(contest.id)
        ))
    ), '[]'::jsonb),
    'answers', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'question_id', answer.question_id, 'selected_option', answer.selected_option,
        'selected_text', answer.selected_text
      ) ORDER BY question.position)
      FROM public.contest_answers AS answer
      JOIN public.contest_questions AS question ON question.id = answer.question_id
      WHERE answer.contest_id = contest.id AND answer.user_id = auth.uid()
        AND (contest.subject NOT IN ('ielts', 'cefr') OR EXISTS (
          SELECT 1 FROM public.contest_exam_parts AS part
          WHERE part.id = question.exam_part_id AND part.section = public.current_exam_section(contest.id)
        ))
    ), '[]'::jsonb),
    'gap_fill_responses', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'part_id', response.exam_part_id, 'blank_number', response.blank_number, 'answer', response.answer
      ) ORDER BY response.exam_part_id, response.blank_number)
      FROM public.contest_gap_fill_responses AS response
      JOIN public.contest_exam_parts AS part ON part.id = response.exam_part_id
      WHERE response.contest_id = contest.id AND response.user_id = auth.uid()
        AND part.section = public.current_exam_section(contest.id)
    ), '[]'::jsonb),
    'matching_configs', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'part_id', part.id,
        'options', coalesce((SELECT jsonb_agg(jsonb_build_object('position', option.option_position, 'label', option.label) ORDER BY option.option_position) FROM public.contest_matching_options AS option WHERE option.exam_part_id = part.id), '[]'::jsonb),
        'speakers', coalesce((SELECT jsonb_agg(jsonb_build_object('speaker_number', speaker.speaker_number, 'label', speaker.label) ORDER BY speaker.speaker_number) FROM public.contest_matching_speakers AS speaker WHERE speaker.exam_part_id = part.id), '[]'::jsonb)
      ) ORDER BY part.position)
      FROM public.contest_exam_parts AS part
      WHERE part.contest_id = contest.id AND part.section = public.current_exam_section(contest.id)
        AND contest.subject = 'cefr'
        AND ((part.section = 'listening' AND part.position IN (3, 4)) OR (part.section = 'reading' AND part.position IN (2, 3)))
    ), '[]'::jsonb),
    'matching_responses', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'part_id', response.exam_part_id, 'speaker_number', response.speaker_number,
        'option_position', response.option_position
      ) ORDER BY response.exam_part_id, response.speaker_number)
      FROM public.contest_matching_responses AS response
      JOIN public.contest_exam_parts AS part ON part.id = response.exam_part_id
      WHERE response.contest_id = contest.id AND response.user_id = auth.uid()
        AND part.section = public.current_exam_section(contest.id)
    ), '[]'::jsonb),
    'writing_responses', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'part_id', submission.exam_part_id, 'content', submission.content,
        'submitted_at', submission.submitted_at, 'updated_at', submission.updated_at
      ) ORDER BY part.position)
      FROM public.contest_writing_submissions AS submission
      JOIN public.contest_exam_parts AS part ON part.id = submission.exam_part_id
      WHERE submission.contest_id = contest.id AND submission.user_id = auth.uid()
        AND (contest.subject NOT IN ('ielts', 'cefr') OR part.section = public.current_exam_section(contest.id))
    ), '[]'::jsonb)
  ) INTO v_payload
  FROM public.contests AS contest
  JOIN public.contest_registrations AS registration
    ON registration.contest_id = contest.id AND registration.user_id = auth.uid()
  WHERE contest.id = v_contest.id;

  RETURN v_payload;
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
  v_attempt_start timestamptz;
  v_writing_start timestamptz;
  v_writing_end timestamptz;
  v_submitted_at timestamptz;
  v_existing_content text;
  v_content text := trim(coalesce(p_content, ''));
BEGIN
  IF auth.uid() IS NULL OR NOT public.active_profile(auth.uid()) THEN
    RAISE EXCEPTION 'An active account is required to submit writing';
  END IF;
  SELECT * INTO v_part FROM public.contest_exam_parts
  WHERE id = p_exam_part_id;
  IF NOT FOUND OR v_part.section <> 'writing' THEN RAISE EXCEPTION 'Writing part not found'; END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = v_part.contest_id;
  IF NOT v_contest.is_published OR v_contest.archived_at IS NOT NULL
    OR (v_contest.contest_mode <> 'test' AND (now() < v_contest.start_at OR now() >= v_contest.end_at)) THEN
    RAISE EXCEPTION 'Writing is not accepted for this exam at this time';
  END IF;
  IF v_contest.contest_type = 'rated'
    AND (v_contest.created_by = auth.uid() OR public.has_admin_access(auth.uid())) THEN
    RAISE EXCEPTION 'Contest managers cannot submit writing to a rated exam';
  END IF;
  SELECT * INTO v_registration FROM public.contest_registrations
  WHERE contest_id = v_contest.id AND user_id = auth.uid()
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Register for this exam before submitting writing'; END IF;
  IF v_registration.completed_at IS NOT NULL THEN RAISE EXCEPTION 'This exam has already been submitted'; END IF;
  IF v_contest.contest_mode = 'test' AND v_registration.test_started_at IS NULL THEN
    RAISE EXCEPTION 'Start this test before submitting writing';
  END IF;
  SELECT * INTO v_timing FROM public.contest_exam_section_timings WHERE contest_id = v_contest.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Writing timing is unavailable'; END IF;

  v_attempt_start := CASE WHEN v_contest.contest_mode = 'test' THEN v_registration.test_started_at ELSE v_contest.start_at END;
  v_writing_start := coalesce(
    v_registration.reading_completed_at,
    coalesce(v_registration.listening_completed_at, v_attempt_start + (v_timing.listening_minutes * interval '1 minute'))
      + (v_timing.reading_minutes * interval '1 minute')
  );
  v_writing_end := v_writing_start + (v_timing.writing_minutes * interval '1 minute');
  IF v_contest.contest_mode <> 'test' THEN v_writing_end := least(v_writing_end, v_contest.end_at); END IF;
  IF now() < v_writing_start THEN RAISE EXCEPTION 'Writing has not started yet'; END IF;

  SELECT content, submitted_at INTO v_existing_content, v_submitted_at
  FROM public.contest_writing_submissions
  WHERE exam_part_id = p_exam_part_id AND user_id = auth.uid()
  FOR UPDATE;
  IF v_submitted_at IS NOT NULL THEN
    RETURN jsonb_build_object('saved', true, 'submitted_at', v_submitted_at, 'already_submitted', true);
  END IF;

  IF now() >= v_writing_end THEN
    IF NOT p_submit OR char_length(trim(coalesce(v_existing_content, ''))) < 1 THEN
      RAISE EXCEPTION 'Writing time has ended';
    END IF;
    UPDATE public.contest_writing_submissions
    SET submitted_at = v_writing_end, updated_at = now()
    WHERE exam_part_id = p_exam_part_id AND user_id = auth.uid()
    RETURNING submitted_at INTO v_submitted_at;
    UPDATE public.contest_registrations SET last_activity_at = now()
    WHERE contest_id = v_contest.id AND user_id = auth.uid();
    RETURN jsonb_build_object('saved', true, 'submitted_at', v_submitted_at, 'auto_submitted', true);
  END IF;

  IF char_length(v_content) < 1 THEN RAISE EXCEPTION 'Writing response cannot be empty'; END IF;
  INSERT INTO public.contest_writing_submissions (contest_id, exam_part_id, user_id, content, submitted_at)
  VALUES (v_contest.id, p_exam_part_id, auth.uid(), v_content, CASE WHEN p_submit THEN now() ELSE NULL END)
  ON CONFLICT (exam_part_id, user_id) DO UPDATE SET
    content = EXCLUDED.content,
    submitted_at = CASE WHEN p_submit THEN now() ELSE NULL END,
    updated_at = now()
  RETURNING submitted_at INTO v_submitted_at;
  UPDATE public.contest_registrations SET last_activity_at = now()
  WHERE contest_id = v_contest.id AND user_id = auth.uid();
  RETURN jsonb_build_object('saved', true, 'submitted_at', v_submitted_at);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_language_test_result(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_contest public.contests%ROWTYPE;
  v_registration public.contest_registrations%ROWTYPE;
  v_timing public.contest_exam_section_timings%ROWTYPE;
  v_listening_end timestamptz;
  v_reading_start timestamptz;
  v_reading_end timestamptz;
  v_writing_start timestamptz;
  v_attempt_end timestamptz;
  v_listening_score integer;
  v_listening_points integer;
  v_listening_answered integer;
  v_listening_count integer;
  v_reading_score integer;
  v_reading_points integer;
  v_reading_answered integer;
  v_reading_count integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.active_profile(auth.uid()) THEN
    RAISE EXCEPTION 'An active account is required to view a test result';
  END IF;
  SELECT * INTO v_contest FROM public.contests
  WHERE slug = p_slug AND contest_mode = 'test' AND is_published AND archived_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Test not found'; END IF;
  SELECT * INTO v_registration FROM public.contest_registrations
  WHERE contest_id = v_contest.id AND user_id = auth.uid()
  FOR UPDATE;
  IF NOT FOUND OR v_registration.test_started_at IS NULL THEN RAISE EXCEPTION 'Start this test first'; END IF;
  IF NOT v_registration.show_test_results THEN RAISE EXCEPTION 'You chose to send this test result only to the administrator'; END IF;
  SELECT * INTO v_timing FROM public.contest_exam_section_timings WHERE contest_id = v_contest.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Test timing is unavailable'; END IF;

  v_listening_end := v_registration.test_started_at + (v_timing.listening_minutes * interval '1 minute');
  v_reading_start := coalesce(v_registration.listening_completed_at, v_listening_end);
  v_reading_end := v_reading_start + (v_timing.reading_minutes * interval '1 minute');
  v_writing_start := coalesce(v_registration.reading_completed_at, v_reading_end);
  v_attempt_end := v_writing_start + (v_timing.writing_minutes * interval '1 minute');
  IF now() < v_attempt_end AND v_registration.completed_at IS NULL THEN
    RAISE EXCEPTION 'This test is still in progress';
  END IF;

  UPDATE public.contest_writing_submissions AS submission
  SET submitted_at = coalesce(submission.submitted_at, v_attempt_end), updated_at = now()
  FROM public.contest_exam_parts AS part
  WHERE submission.contest_id = v_contest.id AND submission.user_id = auth.uid()
    AND submission.exam_part_id = part.id AND part.section = 'writing'
    AND submission.submitted_at IS NULL AND char_length(trim(submission.content)) > 0;
  UPDATE public.contest_registrations
  SET completed_at = coalesce(completed_at, v_attempt_end), last_activity_at = now()
  WHERE contest_id = v_contest.id AND user_id = auth.uid();

  WITH objective_activity AS (
    SELECT part.section, question.points, coalesce(answer.score, 0) AS score,
      answer.question_id IS NOT NULL AS answered
    FROM public.contest_exam_parts AS part
    JOIN public.contest_questions AS question ON question.exam_part_id = part.id
    LEFT JOIN public.contest_answers AS answer
      ON answer.question_id = question.id AND answer.user_id = auth.uid()
    WHERE part.contest_id = v_contest.id AND part.section IN ('listening', 'reading')
    UNION ALL
    SELECT part.section, answer_key.points, coalesce(response.score, 0) AS score,
      response.id IS NOT NULL AS answered
    FROM public.contest_exam_parts AS part
    JOIN public.contest_gap_fill_answer_keys AS answer_key ON answer_key.exam_part_id = part.id
    LEFT JOIN public.contest_gap_fill_responses AS response
      ON response.exam_part_id = answer_key.exam_part_id
      AND response.blank_number = answer_key.blank_number
      AND response.user_id = auth.uid()
    WHERE part.contest_id = v_contest.id AND part.section IN ('listening', 'reading')
    UNION ALL
    SELECT part.section, 1 AS points, coalesce(response.score, 0) AS score,
      response.id IS NOT NULL AS answered
    FROM public.contest_exam_parts AS part
    JOIN public.contest_matching_speakers AS speaker ON speaker.exam_part_id = part.id
    LEFT JOIN public.contest_matching_responses AS response
      ON response.exam_part_id = speaker.exam_part_id
      AND response.speaker_number = speaker.speaker_number
      AND response.user_id = auth.uid()
    WHERE part.contest_id = v_contest.id AND part.section IN ('listening', 'reading')
  )
  SELECT
    coalesce(sum(score) FILTER (WHERE section = 'listening'), 0)::integer,
    coalesce(sum(points) FILTER (WHERE section = 'listening'), 0)::integer,
    count(*) FILTER (WHERE section = 'listening' AND answered)::integer,
    count(*) FILTER (WHERE section = 'listening')::integer,
    coalesce(sum(score) FILTER (WHERE section = 'reading'), 0)::integer,
    coalesce(sum(points) FILTER (WHERE section = 'reading'), 0)::integer,
    count(*) FILTER (WHERE section = 'reading' AND answered)::integer,
    count(*) FILTER (WHERE section = 'reading')::integer
  INTO v_listening_score, v_listening_points, v_listening_answered, v_listening_count,
    v_reading_score, v_reading_points, v_reading_answered, v_reading_count
  FROM objective_activity;

  RETURN jsonb_build_object(
    'total_score', v_listening_score + v_reading_score,
    'total_points', v_listening_points + v_reading_points,
    'answered_count', v_listening_answered + v_reading_answered,
    'total_questions', v_listening_count + v_reading_count,
    'listening_score', v_listening_score,
    'listening_points', v_listening_points,
    'listening_answered_count', v_listening_answered,
    'listening_question_count', v_listening_count,
    'reading_score', v_reading_score,
    'reading_points', v_reading_points,
    'reading_answered_count', v_reading_answered,
    'reading_question_count', v_reading_count
  );
END;
$function$;

/* Administrator-only review paths for an ongoing test catalogue. Only an
   individual whose own timer has ended is returned. */
CREATE OR REPLACE FUNCTION public.get_language_test_writing_submissions(p_contest_id uuid)
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
BEGIN
  IF NOT public.can_manage_contest(p_contest_id) THEN
    RAISE EXCEPTION 'Only the test owner or an administrator can review writing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.contests
    WHERE id = p_contest_id AND contest_mode = 'test' AND subject IN ('ielts', 'cefr')
  ) THEN RAISE EXCEPTION 'Language test not found'; END IF;
  RETURN QUERY
  SELECT submission.id, part.id, part.position, part.title, part.max_points,
    submission.user_id, coalesce(nullif(trim(profile.full_name), ''), 'Participant'),
    submission.content, submission.submitted_at, submission.score, submission.feedback,
    submission.graded_at
  FROM public.contest_writing_submissions AS submission
  JOIN public.contest_exam_parts AS part ON part.id = submission.exam_part_id
  JOIN public.contest_registrations AS registration
    ON registration.contest_id = submission.contest_id AND registration.user_id = submission.user_id
  JOIN public.profiles AS profile ON profile.id = submission.user_id
  WHERE submission.contest_id = p_contest_id
    AND registration.completed_at IS NOT NULL
    AND submission.submitted_at IS NOT NULL
  ORDER BY submission.submitted_at DESC, part.position;
END;
$function$;

CREATE OR REPLACE FUNCTION public.grade_language_test_writing_submission(
  p_submission_id uuid,
  p_score integer,
  p_feedback text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_submission public.contest_writing_submissions%ROWTYPE;
  v_part public.contest_exam_parts%ROWTYPE;
BEGIN
  SELECT * INTO v_submission FROM public.contest_writing_submissions WHERE id = p_submission_id FOR UPDATE;
  IF NOT FOUND OR v_submission.submitted_at IS NULL THEN RAISE EXCEPTION 'Writing submission not found'; END IF;
  SELECT * INTO v_part FROM public.contest_exam_parts WHERE id = v_submission.exam_part_id;
  IF NOT public.can_manage_contest(v_submission.contest_id) THEN
    RAISE EXCEPTION 'Only the test owner or an administrator can grade writing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.contests AS contest
    JOIN public.contest_registrations AS registration
      ON registration.contest_id = contest.id AND registration.user_id = v_submission.user_id
    WHERE contest.id = v_submission.contest_id
      AND contest.contest_mode = 'test'
      AND registration.completed_at IS NOT NULL
  ) THEN RAISE EXCEPTION 'Writing can be graded after that participant completes the test'; END IF;
  IF p_score NOT BETWEEN 0 AND v_part.max_points THEN
    RAISE EXCEPTION 'Writing score must be between 0 and %', v_part.max_points;
  END IF;
  IF char_length(coalesce(p_feedback, '')) > 10000 THEN RAISE EXCEPTION 'Feedback is too long'; END IF;
  UPDATE public.contest_writing_submissions
  SET score = p_score, feedback = nullif(trim(p_feedback), ''), graded_by = auth.uid(), graded_at = now()
  WHERE id = p_submission_id;
  PERFORM public.log_audit_action(
    'test.writing.grade', 'contest_writing_submission', p_submission_id,
    jsonb_build_object('contest_id', v_submission.contest_id, 'score', p_score)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_language_test_admin_results(p_contest_id uuid)
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
  v_total_questions integer;
BEGIN
  IF NOT public.can_manage_contest(p_contest_id) THEN
    RAISE EXCEPTION 'Only the test owner or an administrator can view results';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.contests WHERE id = p_contest_id AND contest_mode = 'test') THEN
    RAISE EXCEPTION 'Language test not found';
  END IF;
  SELECT
    (SELECT count(*) FROM public.contest_questions WHERE contest_id = p_contest_id)
    + (SELECT count(*) FROM public.contest_gap_fill_answer_keys WHERE contest_id = p_contest_id)
    + (SELECT count(*) FROM public.contest_matching_speakers WHERE contest_id = p_contest_id)
  INTO v_total_questions;
  RETURN QUERY
  WITH scores AS (
    SELECT registration.user_id,
      registration.completed_at AS participant_completed_at,
      coalesce((SELECT sum(answer.score) FROM public.contest_answers AS answer WHERE answer.contest_id = p_contest_id AND answer.user_id = registration.user_id), 0)
        + coalesce((SELECT sum(response.score) FROM public.contest_gap_fill_responses AS response WHERE response.contest_id = p_contest_id AND response.user_id = registration.user_id), 0)
        + coalesce((SELECT sum(response.score) FROM public.contest_matching_responses AS response WHERE response.contest_id = p_contest_id AND response.user_id = registration.user_id), 0) AS participant_score,
      (SELECT count(*) FROM public.contest_answers AS answer WHERE answer.contest_id = p_contest_id AND answer.user_id = registration.user_id)
        + (SELECT count(*) FROM public.contest_gap_fill_responses AS response WHERE response.contest_id = p_contest_id AND response.user_id = registration.user_id)
        + (SELECT count(*) FROM public.contest_matching_responses AS response WHERE response.contest_id = p_contest_id AND response.user_id = registration.user_id) AS participant_answered_count,
      (SELECT count(*) FROM public.contest_writing_submissions AS submission WHERE submission.contest_id = p_contest_id AND submission.user_id = registration.user_id AND submission.submitted_at IS NOT NULL AND submission.score IS NULL) AS pending_writing
    FROM public.contest_registrations AS registration
    WHERE registration.contest_id = p_contest_id AND registration.completed_at IS NOT NULL
  ), ranked AS (
    SELECT row_number() OVER (ORDER BY participant_score DESC, participant_answered_count DESC, user_id)::integer AS result_rank, *
    FROM scores
  )
  SELECT ranked.result_rank, ranked.user_id,
    coalesce(nullif(trim(profile.full_name), ''), 'Participant'),
    ranked.participant_score::integer, ranked.participant_answered_count::integer,
    v_total_questions, ranked.participant_completed_at, ranked.pending_writing::integer
  FROM ranked
  JOIN public.profiles AS profile ON profile.id = ranked.user_id
  ORDER BY ranked.result_rank;
END;
$function$;

REVOKE ALL ON FUNCTION public.start_language_test(uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_language_test_result(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_language_test_writing_submissions(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.grade_language_test_writing_submission(uuid, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_language_test_admin_results(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_language_test(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_language_test_result(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_language_test_writing_submissions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.grade_language_test_writing_submission(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_language_test_admin_results(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
