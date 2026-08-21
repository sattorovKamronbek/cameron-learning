-- IELTS and CEFR are content formats, not fixed 1–20/40-question blueprints.
-- Keep the existing tables, but remove the positional assumptions from the
-- server API so an administrator can build the material they actually have.

ALTER TABLE public.contest_exam_parts
  DROP CONSTRAINT IF EXISTS contest_exam_parts_position_check;
ALTER TABLE public.contest_exam_parts
  ADD CONSTRAINT contest_exam_parts_position_check CHECK (position BETWEEN 1 AND 1000000);

ALTER TABLE public.contest_gap_fill_answer_keys
  DROP CONSTRAINT IF EXISTS contest_gap_fill_answer_keys_blank_number_check;
ALTER TABLE public.contest_gap_fill_answer_keys
  ADD CONSTRAINT contest_gap_fill_answer_keys_blank_number_check CHECK (blank_number BETWEEN 1 AND 1000000);

ALTER TABLE public.contest_gap_fill_responses
  DROP CONSTRAINT IF EXISTS contest_gap_fill_responses_blank_number_check;
ALTER TABLE public.contest_gap_fill_responses
  ADD CONSTRAINT contest_gap_fill_responses_blank_number_check CHECK (blank_number BETWEEN 1 AND 1000000);

ALTER TABLE public.contest_matching_options
  DROP CONSTRAINT IF EXISTS contest_matching_options_option_position_check;
ALTER TABLE public.contest_matching_options
  ADD CONSTRAINT contest_matching_options_option_position_check CHECK (option_position BETWEEN 0 AND 999);

ALTER TABLE public.contest_matching_speakers
  DROP CONSTRAINT IF EXISTS contest_matching_speakers_speaker_number_check,
  DROP CONSTRAINT IF EXISTS contest_matching_speakers_correct_option_position_check;
ALTER TABLE public.contest_matching_speakers
  ADD CONSTRAINT contest_matching_speakers_speaker_number_check CHECK (speaker_number BETWEEN 1 AND 1000000),
  ADD CONSTRAINT contest_matching_speakers_correct_option_position_check CHECK (correct_option_position BETWEEN 0 AND 999);

ALTER TABLE public.contest_matching_responses
  DROP CONSTRAINT IF EXISTS contest_matching_responses_speaker_number_check,
  DROP CONSTRAINT IF EXISTS contest_matching_responses_option_position_check;
ALTER TABLE public.contest_matching_responses
  ADD CONSTRAINT contest_matching_responses_speaker_number_check CHECK (speaker_number BETWEEN 1 AND 1000000),
  ADD CONSTRAINT contest_matching_responses_option_position_check CHECK (option_position BETWEEN 0 AND 999);

ALTER TABLE public.contest_questions
  DROP CONSTRAINT IF EXISTS contest_questions_word_limit_check;
ALTER TABLE public.contest_questions
  ADD CONSTRAINT contest_questions_word_limit_check CHECK (word_limit BETWEEN 0 AND 1000);

ALTER TABLE public.contest_questions
  DROP CONSTRAINT IF EXISTS contest_questions_options_check;
ALTER TABLE public.contest_questions
  ADD CONSTRAINT contest_questions_options_check CHECK (
    jsonb_typeof(options) = 'array' AND (
      (answer_type = 'choice' AND jsonb_array_length(options) BETWEEN 2 AND 20)
      OR (answer_type = 'text' AND jsonb_array_length(options) = 0)
    )
  );

-- Retired format-specific validators must not reject otherwise valid flexible
-- content at INSERT time or when a draft is published.
DROP TRIGGER IF EXISTS contest_questions_validate_cefr_part_five ON public.contest_questions;
DROP TRIGGER IF EXISTS contest_questions_validate_cefr_reading ON public.contest_questions;
DROP TRIGGER IF EXISTS contests_validate_cefr_part_five_publish ON public.contests;
DROP TRIGGER IF EXISTS contests_validate_cefr_reading_publish ON public.contests;
DROP TRIGGER IF EXISTS contests_validate_ielts_listening_part_one_shared_gap_fill_publish ON public.contests;
DROP TRIGGER IF EXISTS validate_ielts_listening_part_two_structured_before_publish ON public.contests;
DROP TRIGGER IF EXISTS validate_ielts_listening_part_three_structured_before_publish ON public.contests;
DROP TRIGGER IF EXISTS contests_validate_ielts_listening_part_four_shared_gap_fill_publish ON public.contests;
DROP TRIGGER IF EXISTS contests_validate_ielts_reading_numbering_and_shared_text_publish ON public.contests;
DROP TRIGGER IF EXISTS validate_ielts_reading_passage_two_structured_before_publish ON public.contests;
DROP TRIGGER IF EXISTS validate_ielts_reading_passage_three_structured_before_publish ON public.contests;
DROP TRIGGER IF EXISTS contests_validate_ielts_listening_part_audio_publish ON public.contests;

CREATE OR REPLACE FUNCTION public.save_contest_exam_part(
  p_contest_id uuid,
  p_part_id uuid,
  p_position integer,
  p_section text,
  p_title text,
  p_instructions text DEFAULT '',
  p_content text DEFAULT '',
  p_audio_url text DEFAULT NULL,
  p_max_points integer DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_contest public.contests%ROWTYPE;
  v_part_id uuid;
BEGIN
  IF NOT public.can_manage_contest(p_contest_id) THEN RAISE EXCEPTION 'Only the owning judge or an admin can manage exam parts'; END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id FOR UPDATE;
  IF NOT FOUND OR v_contest.subject NOT IN ('ielts', 'cefr') THEN RAISE EXCEPTION 'Language exam not found'; END IF;
  IF v_contest.is_published OR v_contest.archived_at IS NOT NULL OR v_contest.start_at <= now() THEN RAISE EXCEPTION 'Exam parts cannot be changed after publication or start'; END IF;
  IF p_position NOT BETWEEN 1 AND 1000000 OR p_section NOT IN ('listening', 'reading', 'writing')
    OR char_length(trim(coalesce(p_title, ''))) NOT BETWEEN 1 AND 200
    OR char_length(coalesce(p_instructions, '')) > 10000 OR char_length(coalesce(p_content, '')) > 50000
    OR p_max_points NOT BETWEEN 0 AND 1000 THEN RAISE EXCEPTION 'Invalid exam part data'; END IF;
  IF p_section = 'writing' AND p_max_points < 1 THEN RAISE EXCEPTION 'A writing part needs a maximum score'; END IF;
  IF p_section <> 'writing' AND p_max_points <> 0 THEN RAISE EXCEPTION 'Listening and Reading scores belong to answer keys'; END IF;

  IF p_part_id IS NULL THEN
    INSERT INTO public.contest_exam_parts (contest_id, position, section, title, instructions, content, audio_url, max_points)
    VALUES (p_contest_id, p_position, p_section, trim(p_title), trim(coalesce(p_instructions, '')), trim(coalesce(p_content, '')), nullif(trim(p_audio_url), ''), p_max_points)
    RETURNING id INTO v_part_id;
  ELSE
    UPDATE public.contest_exam_parts SET position = p_position, section = p_section, title = trim(p_title),
      instructions = trim(coalesce(p_instructions, '')), content = trim(coalesce(p_content, '')),
      audio_url = nullif(trim(p_audio_url), ''), max_points = p_max_points
    WHERE id = p_part_id AND contest_id = p_contest_id RETURNING id INTO v_part_id;
    IF v_part_id IS NULL THEN RAISE EXCEPTION 'Exam part not found'; END IF;
  END IF;
  PERFORM public.log_audit_action('contest.exam_part.save', 'contest', p_contest_id, jsonb_build_object('part_id', v_part_id, 'section', p_section, 'position', p_position));
  RETURN v_part_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.save_contest_question(
  p_contest_id uuid, p_question_id uuid, p_position integer, p_prompt text,
  p_options jsonb, p_answer_type text, p_correct_option integer,
  p_accepted_answers jsonb, p_word_limit integer, p_points integer,
  p_explanation text, p_exam_part_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_contest public.contests%ROWTYPE;
  v_question_id uuid;
  v_answer_type text := lower(trim(coalesce(p_answer_type, 'choice')));
  v_section text;
BEGIN
  IF NOT public.can_manage_contest(p_contest_id) THEN RAISE EXCEPTION 'Only the owning judge or an admin can manage questions'; END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contest not found'; END IF;
  IF v_contest.archived_at IS NOT NULL OR v_contest.start_at <= now() THEN RAISE EXCEPTION 'Questions cannot be changed after publication or start'; END IF;
  IF p_position NOT BETWEEN 1 AND 1000000 OR p_points NOT BETWEEN 1 AND 1000
    OR v_answer_type NOT IN ('choice', 'text') OR coalesce(jsonb_typeof(p_options), '') <> 'array'
    OR char_length(trim(coalesce(p_prompt, ''))) = 0 THEN RAISE EXCEPTION 'Invalid question data'; END IF;

  IF v_contest.subject IN ('ielts', 'cefr') THEN
    SELECT section INTO v_section FROM public.contest_exam_parts WHERE id = p_exam_part_id AND contest_id = p_contest_id;
    IF v_section IS NULL OR v_section = 'writing' THEN RAISE EXCEPTION 'Questions must belong to a Listening or Reading part'; END IF;
  ELSIF p_exam_part_id IS NOT NULL THEN
    RAISE EXCEPTION 'Exam parts can be used only by language exams';
  END IF;

  IF v_answer_type = 'choice' THEN
    IF jsonb_array_length(p_options) NOT BETWEEN 2 AND 20 OR p_correct_option IS NULL
      OR p_correct_option NOT BETWEEN 0 AND jsonb_array_length(p_options) - 1
      OR coalesce(p_word_limit, 0) <> 0 OR coalesce(p_accepted_answers, '[]'::jsonb) <> '[]'::jsonb
      OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_options) option(value) WHERE jsonb_typeof(option.value) <> 'string' OR char_length(trim(option.value #>> '{}')) = 0) THEN
      RAISE EXCEPTION 'A choice question needs 2–20 non-empty options and one correct option';
    END IF;
  ELSE
    IF jsonb_array_length(p_options) <> 0 OR p_correct_option IS NOT NULL OR p_word_limit NOT BETWEEN 1 AND 1000
      OR coalesce(jsonb_typeof(p_accepted_answers), '') <> 'array' OR jsonb_array_length(p_accepted_answers) NOT BETWEEN 1 AND 100
      OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_accepted_answers) answer(value) WHERE jsonb_typeof(answer.value) <> 'string' OR char_length(trim(answer.value #>> '{}')) NOT BETWEEN 1 AND 160) THEN
      RAISE EXCEPTION 'A typed question needs answer keys and a word limit';
    END IF;
  END IF;

  IF p_question_id IS NULL THEN
    INSERT INTO public.contest_questions (contest_id, exam_part_id, position, prompt, options, answer_type, correct_option, accepted_answers, word_limit, points, explanation)
    VALUES (p_contest_id, p_exam_part_id, p_position, trim(p_prompt), p_options, v_answer_type, p_correct_option, coalesce(p_accepted_answers, '[]'::jsonb), coalesce(p_word_limit, 0), p_points, nullif(trim(p_explanation), ''))
    RETURNING id INTO v_question_id;
  ELSE
    UPDATE public.contest_questions SET exam_part_id = p_exam_part_id, position = p_position, prompt = trim(p_prompt), options = p_options,
      answer_type = v_answer_type, correct_option = p_correct_option, accepted_answers = coalesce(p_accepted_answers, '[]'::jsonb),
      word_limit = coalesce(p_word_limit, 0), points = p_points, explanation = nullif(trim(p_explanation), '')
    WHERE id = p_question_id AND contest_id = p_contest_id RETURNING id INTO v_question_id;
    IF v_question_id IS NULL THEN RAISE EXCEPTION 'Question not found'; END IF;
  END IF;
  PERFORM public.log_audit_action('contest.question.save', 'contest', p_contest_id, jsonb_build_object('question_id', v_question_id));
  RETURN v_question_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.save_cefr_gap_fill_answer_keys(p_contest_id uuid, p_exam_part_id uuid, p_answer_keys jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_contest public.contests%ROWTYPE;
  v_part public.contest_exam_parts%ROWTYPE;
  v_markers integer[];
  v_key jsonb;
  v_number integer;
  v_answers jsonb;
  v_points integer;
  v_seen integer[] := ARRAY[]::integer[];
BEGIN
  IF NOT public.can_manage_contest(p_contest_id) THEN RAISE EXCEPTION 'Only the owning judge or an admin can manage answer keys'; END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id FOR UPDATE;
  IF NOT FOUND OR v_contest.subject NOT IN ('ielts', 'cefr') OR v_contest.is_published OR v_contest.start_at <= now() THEN RAISE EXCEPTION 'This language draft cannot be changed'; END IF;
  SELECT * INTO v_part FROM public.contest_exam_parts WHERE id = p_exam_part_id AND contest_id = p_contest_id;
  IF NOT FOUND OR v_part.section NOT IN ('listening', 'reading') THEN RAISE EXCEPTION 'Gap filling belongs to a Listening or Reading part'; END IF;
  SELECT array_agg(DISTINCT (marker.values)[1]::integer ORDER BY (marker.values)[1]::integer) INTO v_markers
  FROM regexp_matches(v_part.content, '\{\{([1-9][0-9]*)\}\}', 'g') marker(values);
  IF coalesce(array_length(v_markers, 1), 0) = 0 OR coalesce(jsonb_typeof(p_answer_keys), '') <> 'array' OR jsonb_array_length(p_answer_keys) <> array_length(v_markers, 1) THEN
    RAISE EXCEPTION 'Add one answer key for every {{number}} marker';
  END IF;
  FOR v_key IN SELECT value FROM jsonb_array_elements(p_answer_keys) item(value) LOOP
    IF jsonb_typeof(v_key) <> 'object' OR coalesce(v_key->>'blank_number', '') !~ '^[1-9][0-9]*$' THEN RAISE EXCEPTION 'Every key needs a marker number'; END IF;
    v_number := (v_key->>'blank_number')::integer;
    v_answers := v_key->'accepted_answers';
    v_points := coalesce((v_key->>'points')::integer, 1);
    IF v_number <> ALL(v_markers) OR v_number = ANY(v_seen) OR v_points NOT BETWEEN 1 AND 1000
      OR coalesce(jsonb_typeof(v_answers), '') <> 'array' OR jsonb_array_length(v_answers) NOT BETWEEN 1 AND 20
      OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_answers) answer(value) WHERE jsonb_typeof(answer.value) <> 'string' OR char_length(trim(answer.value #>> '{}')) NOT BETWEEN 1 AND 120) THEN
      RAISE EXCEPTION 'Invalid gap-fill answer key';
    END IF;
    INSERT INTO public.contest_gap_fill_answer_keys (contest_id, exam_part_id, blank_number, accepted_answers, points)
    VALUES (p_contest_id, p_exam_part_id, v_number, v_answers, v_points)
    ON CONFLICT (exam_part_id, blank_number) DO UPDATE SET accepted_answers = EXCLUDED.accepted_answers, points = EXCLUDED.points, updated_at = now();
    v_seen := array_append(v_seen, v_number);
  END LOOP;
  DELETE FROM public.contest_gap_fill_answer_keys WHERE exam_part_id = p_exam_part_id AND NOT (blank_number = ANY(v_markers));
END;
$function$;

CREATE OR REPLACE FUNCTION public.save_exam_part_image(p_contest_id uuid, p_exam_part_id uuid, p_image_url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_contest public.contests%ROWTYPE;
  v_part public.contest_exam_parts%ROWTYPE;
  v_url text := nullif(trim(coalesce(p_image_url, '')), '');
BEGIN
  IF NOT public.can_manage_contest(p_contest_id) THEN RAISE EXCEPTION 'Only the owning judge or an admin can manage exam images'; END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id FOR UPDATE;
  SELECT * INTO v_part FROM public.contest_exam_parts WHERE id = p_exam_part_id AND contest_id = p_contest_id;
  IF NOT FOUND OR v_contest.subject NOT IN ('ielts','cefr') OR v_contest.is_published OR v_contest.start_at <= now() THEN RAISE EXCEPTION 'This language draft cannot be changed'; END IF;
  IF v_url IS NOT NULL AND (v_url !~ '^https?://' OR char_length(v_url) > 5000) THEN RAISE EXCEPTION 'Enter a valid image URL'; END IF;
  UPDATE public.contest_exam_parts SET image_url = v_url WHERE id = p_exam_part_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.save_cefr_matching_config(p_contest_id uuid, p_exam_part_id uuid, p_options jsonb, p_speakers jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_contest public.contests%ROWTYPE;
  v_part public.contest_exam_parts%ROWTYPE;
  v_item jsonb;
  v_index integer;
  v_number integer;
  v_correct integer;
  v_seen integer[] := ARRAY[]::integer[];
BEGIN
  IF NOT public.can_manage_contest(p_contest_id) THEN RAISE EXCEPTION 'Only the owning judge or an admin can manage matching'; END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id FOR UPDATE;
  IF NOT FOUND OR v_contest.subject NOT IN ('ielts', 'cefr') OR v_contest.is_published OR v_contest.start_at <= now() THEN RAISE EXCEPTION 'This language draft cannot be changed'; END IF;
  SELECT * INTO v_part FROM public.contest_exam_parts WHERE id = p_exam_part_id AND contest_id = p_contest_id;
  IF NOT FOUND OR v_part.section NOT IN ('listening', 'reading') THEN RAISE EXCEPTION 'Matching belongs to a Listening or Reading part'; END IF;
  IF coalesce(jsonb_typeof(p_options), '') <> 'array' OR jsonb_array_length(p_options) NOT BETWEEN 2 AND 100
    OR coalesce(jsonb_typeof(p_speakers), '') <> 'array' OR jsonb_array_length(p_speakers) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Matching needs answer options and entries'; END IF;
  DELETE FROM public.contest_matching_speakers WHERE exam_part_id = p_exam_part_id;
  DELETE FROM public.contest_matching_options WHERE exam_part_id = p_exam_part_id;
  FOR v_index IN 0..jsonb_array_length(p_options) - 1 LOOP
    v_item := p_options -> v_index;
    IF jsonb_typeof(v_item) <> 'object' OR coalesce(v_item->>'position', '') !~ '^[0-9]+$' OR (v_item->>'position')::integer <> v_index OR char_length(trim(coalesce(v_item->>'label', ''))) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Each matching option needs text'; END IF;
    INSERT INTO public.contest_matching_options (contest_id, exam_part_id, option_position, label) VALUES (p_contest_id, p_exam_part_id, v_index, trim(v_item->>'label'));
  END LOOP;
  FOR v_index IN 0..jsonb_array_length(p_speakers) - 1 LOOP
    v_item := p_speakers -> v_index;
    IF jsonb_typeof(v_item) <> 'object' OR coalesce(v_item->>'speaker_number', '') !~ '^[1-9][0-9]*$' THEN RAISE EXCEPTION 'Each matching entry needs a number'; END IF;
    v_number := (v_item->>'speaker_number')::integer;
    v_correct := coalesce((v_item->>'correct_option')::integer, -1);
    IF v_number = ANY(v_seen) OR v_number NOT BETWEEN 1 AND 1000000 OR v_correct NOT BETWEEN 0 AND jsonb_array_length(p_options) - 1
      OR (char_length(trim(coalesce(v_item->>'label', ''))) = 0 AND nullif(trim(coalesce(v_item->>'image_url', '')), '') IS NULL) THEN RAISE EXCEPTION 'Each matching entry needs unique number, content and answer key'; END IF;
    INSERT INTO public.contest_matching_speakers (contest_id, exam_part_id, speaker_number, label, image_url, correct_option_position)
    VALUES (p_contest_id, p_exam_part_id, v_number, trim(coalesce(v_item->>'label', '')), nullif(trim(coalesce(v_item->>'image_url', '')), ''), v_correct);
    v_seen := array_append(v_seen, v_number);
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.publish_contest(p_contest_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_contest public.contests%ROWTYPE;
  v_timing public.contest_exam_section_timings%ROWTYPE;
  v_part record;
BEGIN
  IF NOT public.can_manage_contest(p_contest_id) THEN RAISE EXCEPTION 'Only the owning judge or an admin can publish this contest'; END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id FOR UPDATE;
  IF NOT FOUND OR v_contest.is_published THEN RAISE EXCEPTION 'Contest is unavailable for publishing'; END IF;
  IF v_contest.start_at <= now() OR v_contest.end_at <= v_contest.start_at THEN RAISE EXCEPTION 'Contest schedule is no longer valid'; END IF;
  IF v_contest.subject IN ('ielts', 'cefr') THEN
    SELECT * INTO v_timing FROM public.contest_exam_section_timings WHERE contest_id = p_contest_id;
    IF NOT FOUND OR v_timing.listening_minutes < 1 OR v_timing.reading_minutes < 1 OR v_timing.writing_minutes < 1 THEN RAISE EXCEPTION 'Set all three section timers before publishing'; END IF;
    IF v_contest.contest_mode <> 'test' AND extract(epoch FROM (v_contest.end_at - v_contest.start_at)) <> (v_timing.listening_minutes + v_timing.reading_minutes + v_timing.writing_minutes) * 60 THEN RAISE EXCEPTION 'Section timers must equal the contest duration'; END IF;
    IF EXISTS (SELECT 1 FROM unnest(ARRAY['listening','reading','writing']::text[]) required(section) WHERE NOT EXISTS (SELECT 1 FROM public.contest_exam_parts part WHERE part.contest_id = p_contest_id AND part.section = required.section)) THEN RAISE EXCEPTION 'Add at least one Listening, Reading and Writing part'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.contest_exam_parts WHERE contest_id = p_contest_id AND section = 'listening' AND nullif(trim(audio_url), '') IS NOT NULL) THEN RAISE EXCEPTION 'Add one audio file to any Listening part. It can be shared by the other parts.'; END IF;
    IF EXISTS (SELECT 1 FROM public.contest_questions WHERE contest_id = p_contest_id AND exam_part_id IS NULL)
      OR EXISTS (SELECT 1 FROM public.contest_questions question JOIN public.contest_exam_parts part ON part.id = question.exam_part_id WHERE question.contest_id = p_contest_id AND part.section = 'writing') THEN RAISE EXCEPTION 'Every objective question must belong to a Listening or Reading part'; END IF;
    IF EXISTS (SELECT 1 FROM public.contest_questions WHERE contest_id = p_contest_id AND (answer_type = 'choice' AND correct_option IS NULL OR answer_type = 'text' AND (jsonb_array_length(accepted_answers) = 0 OR word_limit < 1))) THEN RAISE EXCEPTION 'Every question needs a complete answer key'; END IF;
    FOR v_part IN SELECT * FROM public.contest_exam_parts WHERE contest_id = p_contest_id LOOP
      IF v_part.section IN ('reading','writing') AND char_length(trim(v_part.content)) = 0 THEN RAISE EXCEPTION '% part % needs text', initcap(v_part.section), v_part.position; END IF;
      IF v_part.section = 'writing' AND v_part.max_points < 1 THEN RAISE EXCEPTION 'Writing part % needs a maximum score', v_part.position; END IF;
      IF v_part.section IN ('listening','reading') THEN
        IF EXISTS (SELECT 1 FROM regexp_matches(v_part.content, '\{\{([1-9][0-9]*)\}\}', 'g') marker(values) LEFT JOIN public.contest_gap_fill_answer_keys key ON key.exam_part_id = v_part.id AND key.blank_number = (marker.values)[1]::integer WHERE key.id IS NULL) THEN RAISE EXCEPTION 'Save every gap-fill key in % part %', initcap(v_part.section), v_part.position; END IF;
        IF EXISTS (SELECT 1 FROM public.contest_matching_speakers speaker WHERE speaker.exam_part_id = v_part.id AND (speaker.correct_option_position IS NULL OR NOT EXISTS (SELECT 1 FROM public.contest_matching_options option WHERE option.exam_part_id = v_part.id AND option.option_position = speaker.correct_option_position))) THEN RAISE EXCEPTION 'Complete matching keys in % part %', initcap(v_part.section), v_part.position; END IF;
        IF NOT EXISTS (SELECT 1 FROM public.contest_questions WHERE exam_part_id = v_part.id)
          AND NOT EXISTS (SELECT 1 FROM public.contest_gap_fill_answer_keys WHERE exam_part_id = v_part.id)
          AND NOT EXISTS (SELECT 1 FROM public.contest_matching_speakers WHERE exam_part_id = v_part.id) THEN RAISE EXCEPTION '% part % has no scorable activity', initcap(v_part.section), v_part.position; END IF;
      END IF;
    END LOOP;
  ELSIF NOT EXISTS (SELECT 1 FROM public.contest_questions WHERE contest_id = p_contest_id) THEN
    RAISE EXCEPTION 'Add at least one question before publishing';
  END IF;
  UPDATE public.contests SET is_published = true,
    start_at = CASE WHEN contest_mode = 'test' THEN now() - interval '1 minute' ELSE start_at END,
    end_at = CASE WHEN contest_mode = 'test' THEN now() + interval '10 years' ELSE end_at END
  WHERE id = p_contest_id;
  PERFORM public.log_audit_action('contest.publish', 'contest', p_contest_id, '{}'::jsonb);
END;
$function$;

-- The legacy RPC names remain for client compatibility; their behavior is now
-- shared by every IELTS and CEFR objective part.
CREATE OR REPLACE FUNCTION public.submit_contest_answer(p_question_id uuid, p_selected_option integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_question public.contest_questions%ROWTYPE;
  v_part public.contest_exam_parts%ROWTYPE;
  v_contest public.contests%ROWTYPE;
  v_correct boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.active_profile(auth.uid()) THEN RAISE EXCEPTION 'An active account is required to submit'; END IF;
  SELECT * INTO v_question FROM public.contest_questions WHERE id = p_question_id;
  IF NOT FOUND OR v_question.answer_type <> 'choice' THEN RAISE EXCEPTION 'Choice question not found'; END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = v_question.contest_id;
  IF NOT FOUND OR NOT v_contest.is_published OR v_contest.archived_at IS NOT NULL
    OR (v_contest.contest_mode <> 'test' AND (now() < v_contest.start_at OR now() >= v_contest.end_at)) THEN RAISE EXCEPTION 'Answers are not accepted at this time'; END IF;
  IF v_contest.contest_type = 'rated' AND (v_contest.created_by = auth.uid() OR public.has_admin_access(auth.uid())) THEN RAISE EXCEPTION 'Contest managers cannot submit a rated exam'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.contest_registrations WHERE contest_id = v_contest.id AND user_id = auth.uid() AND completed_at IS NULL) THEN RAISE EXCEPTION 'Register for this exam before submitting'; END IF;
  IF v_contest.subject IN ('ielts','cefr') THEN
    SELECT * INTO v_part FROM public.contest_exam_parts WHERE id = v_question.exam_part_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Question part not found'; END IF;
    PERFORM public.assert_exam_section_open(v_contest.id, v_part.section);
  END IF;
  IF p_selected_option NOT BETWEEN 0 AND jsonb_array_length(v_question.options) - 1 THEN RAISE EXCEPTION 'Invalid option'; END IF;
  v_correct := p_selected_option = v_question.correct_option;
  INSERT INTO public.contest_answers (contest_id, question_id, user_id, selected_option, selected_text, is_correct, score)
  VALUES (v_contest.id, v_question.id, auth.uid(), p_selected_option, NULL, v_correct, CASE WHEN v_correct THEN v_question.points ELSE 0 END)
  ON CONFLICT (question_id, user_id) DO UPDATE SET selected_option = EXCLUDED.selected_option, selected_text = NULL, is_correct = EXCLUDED.is_correct, score = EXCLUDED.score, submitted_at = now();
  UPDATE public.contest_registrations SET last_activity_at = now() WHERE contest_id = v_contest.id AND user_id = auth.uid();
  RETURN jsonb_build_object('saved', true, 'question_id', v_question.id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.submit_contest_text_answer(p_question_id uuid, p_selected_text text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_question public.contest_questions%ROWTYPE;
  v_part public.contest_exam_parts%ROWTYPE;
  v_contest public.contests%ROWTYPE;
  v_answer text := lower(regexp_replace(trim(coalesce(p_selected_text, '')), '\s+', ' ', 'g'));
  v_correct boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.active_profile(auth.uid()) THEN RAISE EXCEPTION 'An active account is required to submit'; END IF;
  SELECT * INTO v_question FROM public.contest_questions WHERE id = p_question_id;
  IF NOT FOUND OR v_question.answer_type <> 'text' THEN RAISE EXCEPTION 'Typed question not found'; END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = v_question.contest_id;
  IF NOT FOUND OR NOT v_contest.is_published OR v_contest.archived_at IS NOT NULL
    OR (v_contest.contest_mode <> 'test' AND (now() < v_contest.start_at OR now() >= v_contest.end_at)) THEN RAISE EXCEPTION 'Answers are not accepted at this time'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.contest_registrations WHERE contest_id = v_contest.id AND user_id = auth.uid() AND completed_at IS NULL) THEN RAISE EXCEPTION 'Register for this exam before submitting'; END IF;
  IF v_contest.subject IN ('ielts','cefr') THEN
    SELECT * INTO v_part FROM public.contest_exam_parts WHERE id = v_question.exam_part_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Question part not found'; END IF;
    PERFORM public.assert_exam_section_open(v_contest.id, v_part.section);
  END IF;
  IF v_answer = '' THEN
    DELETE FROM public.contest_answers WHERE question_id = v_question.id AND user_id = auth.uid();
    RETURN jsonb_build_object('saved', true, 'cleared', true, 'question_id', v_question.id);
  END IF;
  IF cardinality(regexp_split_to_array(v_answer, '\s+')) > v_question.word_limit THEN RAISE EXCEPTION 'Answer exceeds the word limit'; END IF;
  SELECT EXISTS (SELECT 1 FROM jsonb_array_elements_text(v_question.accepted_answers) accepted(answer) WHERE lower(regexp_replace(trim(accepted.answer), '\s+', ' ', 'g')) = v_answer) INTO v_correct;
  INSERT INTO public.contest_answers (contest_id, question_id, user_id, selected_option, selected_text, is_correct, score)
  VALUES (v_contest.id, v_question.id, auth.uid(), NULL, v_answer, v_correct, CASE WHEN v_correct THEN v_question.points ELSE 0 END)
  ON CONFLICT (question_id, user_id) DO UPDATE SET selected_option = NULL, selected_text = EXCLUDED.selected_text, is_correct = EXCLUDED.is_correct, score = EXCLUDED.score, submitted_at = now();
  UPDATE public.contest_registrations SET last_activity_at = now() WHERE contest_id = v_contest.id AND user_id = auth.uid();
  RETURN jsonb_build_object('saved', true, 'question_id', v_question.id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.save_cefr_gap_fill_response(p_exam_part_id uuid, p_blank_number integer, p_answer text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_part public.contest_exam_parts%ROWTYPE;
  v_contest public.contests%ROWTYPE;
  v_key public.contest_gap_fill_answer_keys%ROWTYPE;
  v_answer text := lower(regexp_replace(trim(coalesce(p_answer, '')), '\s+', ' ', 'g'));
  v_correct boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.active_profile(auth.uid()) THEN RAISE EXCEPTION 'An active account is required to submit'; END IF;
  SELECT * INTO v_part FROM public.contest_exam_parts WHERE id = p_exam_part_id;
  SELECT * INTO v_contest FROM public.contests WHERE id = v_part.contest_id;
  IF NOT FOUND OR v_contest.subject NOT IN ('ielts','cefr') OR NOT v_contest.is_published OR v_contest.archived_at IS NOT NULL
    OR (v_contest.contest_mode <> 'test' AND (now() < v_contest.start_at OR now() >= v_contest.end_at)) THEN RAISE EXCEPTION 'Gap filling is unavailable'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.contest_registrations WHERE contest_id = v_contest.id AND user_id = auth.uid() AND completed_at IS NULL) THEN RAISE EXCEPTION 'Register for this exam before submitting'; END IF;
  PERFORM public.assert_exam_section_open(v_contest.id, v_part.section);
  SELECT * INTO v_key FROM public.contest_gap_fill_answer_keys WHERE exam_part_id = p_exam_part_id AND blank_number = p_blank_number;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid gap-fill marker'; END IF;
  IF v_answer = '' THEN
    DELETE FROM public.contest_gap_fill_responses WHERE exam_part_id = p_exam_part_id AND blank_number = p_blank_number AND user_id = auth.uid();
    RETURN jsonb_build_object('saved', true, 'cleared', true);
  END IF;
  SELECT EXISTS (SELECT 1 FROM jsonb_array_elements_text(v_key.accepted_answers) accepted(answer) WHERE lower(regexp_replace(trim(accepted.answer), '\s+', ' ', 'g')) = v_answer) INTO v_correct;
  INSERT INTO public.contest_gap_fill_responses (contest_id, exam_part_id, blank_number, user_id, answer, is_correct, score)
  VALUES (v_contest.id, p_exam_part_id, p_blank_number, auth.uid(), v_answer, v_correct, CASE WHEN v_correct THEN v_key.points ELSE 0 END)
  ON CONFLICT (exam_part_id, blank_number, user_id) DO UPDATE SET answer = EXCLUDED.answer, is_correct = EXCLUDED.is_correct, score = EXCLUDED.score, submitted_at = now();
  UPDATE public.contest_registrations SET last_activity_at = now() WHERE contest_id = v_contest.id AND user_id = auth.uid();
  RETURN jsonb_build_object('saved', true, 'part_id', p_exam_part_id, 'blank_number', p_blank_number);
END;
$function$;

CREATE OR REPLACE FUNCTION public.save_cefr_matching_response(p_exam_part_id uuid, p_speaker_number integer, p_option_position integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_part public.contest_exam_parts%ROWTYPE;
  v_contest public.contests%ROWTYPE;
  v_speaker public.contest_matching_speakers%ROWTYPE;
  v_correct boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.active_profile(auth.uid()) THEN RAISE EXCEPTION 'An active account is required to submit'; END IF;
  SELECT * INTO v_part FROM public.contest_exam_parts WHERE id = p_exam_part_id;
  SELECT * INTO v_contest FROM public.contests WHERE id = v_part.contest_id;
  IF NOT FOUND OR v_contest.subject NOT IN ('ielts','cefr') OR NOT v_contest.is_published OR v_contest.archived_at IS NOT NULL
    OR (v_contest.contest_mode <> 'test' AND (now() < v_contest.start_at OR now() >= v_contest.end_at)) THEN RAISE EXCEPTION 'Matching is unavailable'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.contest_registrations WHERE contest_id = v_contest.id AND user_id = auth.uid() AND completed_at IS NULL) THEN RAISE EXCEPTION 'Register for this exam before submitting'; END IF;
  PERFORM public.assert_exam_section_open(v_contest.id, v_part.section);
  SELECT * INTO v_speaker FROM public.contest_matching_speakers WHERE exam_part_id = p_exam_part_id AND speaker_number = p_speaker_number;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.contest_matching_options WHERE exam_part_id = p_exam_part_id AND option_position = p_option_position) THEN RAISE EXCEPTION 'Invalid matching item or option'; END IF;
  v_correct := p_option_position = v_speaker.correct_option_position;
  INSERT INTO public.contest_matching_responses (contest_id, exam_part_id, speaker_number, user_id, option_position, is_correct, score)
  VALUES (v_contest.id, p_exam_part_id, p_speaker_number, auth.uid(), p_option_position, v_correct, CASE WHEN v_correct THEN 1 ELSE 0 END)
  ON CONFLICT (exam_part_id, speaker_number, user_id) DO UPDATE SET option_position = EXCLUDED.option_position, is_correct = EXCLUDED.is_correct, score = EXCLUDED.score, submitted_at = now();
  UPDATE public.contest_registrations SET last_activity_at = now() WHERE contest_id = v_contest.id AND user_id = auth.uid();
  RETURN jsonb_build_object('saved', true, 'part_id', p_exam_part_id, 'speaker_number', p_speaker_number);
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
  IF auth.uid() IS NULL OR NOT public.active_profile(auth.uid()) THEN RAISE EXCEPTION 'Sign in with an active account to enter a contest'; END IF;
  SELECT * INTO v_contest FROM public.contests WHERE slug = p_slug AND is_published AND archived_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contest not found'; END IF;
  SELECT * INTO v_registration FROM public.contest_registrations WHERE contest_id = v_contest.id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Register for this contest before entering'; END IF;
  IF v_contest.contest_mode = 'test' THEN
    IF v_contest.subject NOT IN ('ielts','cefr') OR v_registration.test_started_at IS NULL THEN RAISE EXCEPTION 'Start this language test before entering'; END IF;
    SELECT * INTO v_timing FROM public.contest_exam_section_timings WHERE contest_id = v_contest.id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Test timing is unavailable'; END IF;
    v_attempt_start := v_registration.test_started_at;
    v_listening_end := v_attempt_start + v_timing.listening_minutes * interval '1 minute';
    v_reading_start := coalesce(v_registration.listening_completed_at, v_listening_end);
    v_reading_end := v_reading_start + v_timing.reading_minutes * interval '1 minute';
    v_writing_start := coalesce(v_registration.reading_completed_at, v_reading_end);
    v_attempt_end := v_writing_start + v_timing.writing_minutes * interval '1 minute';
    IF now() >= v_attempt_end AND v_registration.completed_at IS NULL THEN
      UPDATE public.contest_writing_submissions submission
      SET submitted_at = coalesce(submission.submitted_at, v_attempt_end), updated_at = now()
      FROM public.contest_exam_parts part
      WHERE submission.contest_id = v_contest.id AND submission.user_id = auth.uid() AND submission.exam_part_id = part.id
        AND part.section = 'writing' AND submission.submitted_at IS NULL AND char_length(trim(submission.content)) > 0;
      UPDATE public.contest_registrations SET completed_at = v_attempt_end, last_activity_at = now()
      WHERE contest_id = v_contest.id AND user_id = auth.uid() AND completed_at IS NULL RETURNING * INTO v_registration;
    END IF;
  ELSE
    IF now() < v_contest.start_at THEN RAISE EXCEPTION 'Contest has not started'; END IF;
    IF now() >= v_contest.end_at THEN RAISE EXCEPTION 'Contest has finished'; END IF;
    v_attempt_start := v_contest.start_at;
    v_attempt_end := v_contest.end_at;
  END IF;

  SELECT jsonb_build_object(
    'contest', jsonb_build_object('id', contest.id, 'slug', contest.slug, 'title', contest.title, 'subject', contest.subject,
      'start_at', v_attempt_start, 'end_at', v_attempt_end, 'contest_type', contest.contest_type, 'contest_mode', contest.contest_mode,
      'completed_at', registration.completed_at, 'show_test_results', coalesce(registration.show_test_results, false)),
    'exam_timing', CASE WHEN contest.subject IN ('ielts','cefr') THEN (
      SELECT jsonb_build_object('listening_minutes', timing.listening_minutes, 'reading_minutes', timing.reading_minutes,
        'writing_minutes', timing.writing_minutes, 'active_section', section_state.active_section,
        'section_starts_at', section_state.section_starts_at, 'section_ends_at', section_state.section_ends_at)
      FROM public.contest_exam_section_timings timing
      CROSS JOIN LATERAL public.exam_section_window(contest.id, auth.uid()) section_state
      WHERE timing.contest_id = contest.id
    ) ELSE NULL END,
    'parts', coalesce((SELECT jsonb_agg(jsonb_build_object('id', part.id, 'position', part.position, 'section', part.section,
      'title', part.title, 'instructions', part.instructions, 'content', part.content, 'audio_url', part.audio_url,
      'image_url', part.image_url, 'max_points', part.max_points) ORDER BY part.position)
      FROM public.contest_exam_parts part WHERE part.contest_id = contest.id AND (contest.subject NOT IN ('ielts','cefr') OR part.section = public.current_exam_section(contest.id))), '[]'::jsonb),
    'questions', coalesce((SELECT jsonb_agg(jsonb_build_object('id', question.id, 'exam_part_id', question.exam_part_id,
      'position', question.position, 'prompt', question.prompt, 'options', question.options, 'answer_type', question.answer_type,
      'word_limit', question.word_limit, 'points', question.points) ORDER BY question.position)
      FROM public.contest_questions question LEFT JOIN public.contest_exam_parts part ON part.id = question.exam_part_id
      WHERE question.contest_id = contest.id AND (contest.subject NOT IN ('ielts','cefr') OR part.section = public.current_exam_section(contest.id))), '[]'::jsonb),
    'answers', coalesce((SELECT jsonb_agg(jsonb_build_object('question_id', answer.question_id, 'selected_option', answer.selected_option,
      'selected_text', answer.selected_text) ORDER BY question.position)
      FROM public.contest_answers answer JOIN public.contest_questions question ON question.id = answer.question_id
      LEFT JOIN public.contest_exam_parts part ON part.id = question.exam_part_id
      WHERE answer.contest_id = contest.id AND answer.user_id = auth.uid() AND (contest.subject NOT IN ('ielts','cefr') OR part.section = public.current_exam_section(contest.id))), '[]'::jsonb),
    'gap_fill_responses', coalesce((SELECT jsonb_agg(jsonb_build_object('part_id', response.exam_part_id, 'blank_number', response.blank_number,
      'answer', response.answer) ORDER BY response.exam_part_id, response.blank_number)
      FROM public.contest_gap_fill_responses response JOIN public.contest_exam_parts part ON part.id = response.exam_part_id
      WHERE response.contest_id = contest.id AND response.user_id = auth.uid() AND part.section = public.current_exam_section(contest.id)), '[]'::jsonb),
    'matching_configs', coalesce((SELECT jsonb_agg(jsonb_build_object('part_id', part.id,
      'options', coalesce((SELECT jsonb_agg(jsonb_build_object('position', option.option_position, 'label', option.label) ORDER BY option.option_position) FROM public.contest_matching_options option WHERE option.exam_part_id = part.id), '[]'::jsonb),
      'speakers', coalesce((SELECT jsonb_agg(jsonb_build_object('speaker_number', speaker.speaker_number, 'label', speaker.label) ORDER BY speaker.speaker_number) FROM public.contest_matching_speakers speaker WHERE speaker.exam_part_id = part.id), '[]'::jsonb)) ORDER BY part.position)
      FROM public.contest_exam_parts part WHERE part.contest_id = contest.id AND part.section = public.current_exam_section(contest.id)
        AND EXISTS (SELECT 1 FROM public.contest_matching_speakers speaker WHERE speaker.exam_part_id = part.id)), '[]'::jsonb),
    'matching_responses', coalesce((SELECT jsonb_agg(jsonb_build_object('part_id', response.exam_part_id, 'speaker_number', response.speaker_number,
      'option_position', response.option_position) ORDER BY response.exam_part_id, response.speaker_number)
      FROM public.contest_matching_responses response JOIN public.contest_exam_parts part ON part.id = response.exam_part_id
      WHERE response.contest_id = contest.id AND response.user_id = auth.uid() AND part.section = public.current_exam_section(contest.id)), '[]'::jsonb),
    'writing_responses', coalesce((SELECT jsonb_agg(jsonb_build_object('part_id', submission.exam_part_id, 'content', submission.content,
      'submitted_at', submission.submitted_at, 'updated_at', submission.updated_at) ORDER BY part.position)
      FROM public.contest_writing_submissions submission JOIN public.contest_exam_parts part ON part.id = submission.exam_part_id
      WHERE submission.contest_id = contest.id AND submission.user_id = auth.uid() AND part.section = public.current_exam_section(contest.id)), '[]'::jsonb)
  ) INTO v_payload
  FROM public.contests contest JOIN public.contest_registrations registration ON registration.contest_id = contest.id AND registration.user_id = auth.uid()
  WHERE contest.id = v_contest.id;
  RETURN v_payload;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_contest_editor(p_contest_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE v_payload jsonb;
BEGIN
  IF NOT public.can_manage_contest(p_contest_id) THEN RAISE EXCEPTION 'You cannot view this contest editor'; END IF;
  SELECT jsonb_build_object(
    'contest', jsonb_build_object('id', contest.id, 'slug', contest.slug, 'title', contest.title, 'description', contest.description,
      'subject', contest.subject, 'difficulty', contest.difficulty, 'contest_type', contest.contest_type, 'contest_mode', contest.contest_mode,
      'visibility', contest.visibility, 'start_at', contest.start_at, 'end_at', contest.end_at, 'max_participants', contest.max_participants,
      'rules', contest.rules, 'tags', contest.tags, 'prize', contest.prize, 'is_published', contest.is_published,
      'is_finalized', contest.is_finalized, 'archived_at', contest.archived_at),
    'section_timings', (SELECT jsonb_build_object('listening_minutes', timing.listening_minutes, 'reading_minutes', timing.reading_minutes, 'writing_minutes', timing.writing_minutes) FROM public.contest_exam_section_timings timing WHERE timing.contest_id = contest.id),
    'parts', coalesce((SELECT jsonb_agg(jsonb_build_object('id', part.id, 'position', part.position, 'section', part.section,
      'title', part.title, 'instructions', part.instructions, 'content', part.content, 'audio_url', part.audio_url, 'image_url', part.image_url, 'max_points', part.max_points) ORDER BY part.section, part.position) FROM public.contest_exam_parts part WHERE part.contest_id = contest.id), '[]'::jsonb),
    'questions', coalesce((SELECT jsonb_agg(jsonb_build_object('id', question.id, 'exam_part_id', question.exam_part_id,
      'position', question.position, 'prompt', question.prompt, 'options', question.options, 'answer_type', question.answer_type,
      'correct_option', question.correct_option, 'accepted_answers', question.accepted_answers, 'word_limit', question.word_limit,
      'points', question.points, 'explanation', question.explanation) ORDER BY question.exam_part_id, question.position) FROM public.contest_questions question WHERE question.contest_id = contest.id), '[]'::jsonb),
    'gap_fill_answer_keys', coalesce((SELECT jsonb_agg(jsonb_build_object('part_id', key.exam_part_id, 'blank_number', key.blank_number, 'accepted_answers', key.accepted_answers, 'points', key.points) ORDER BY key.exam_part_id, key.blank_number) FROM public.contest_gap_fill_answer_keys key WHERE key.contest_id = contest.id), '[]'::jsonb),
    'matching_configs', coalesce((SELECT jsonb_agg(jsonb_build_object('part_id', part.id,
      'options', coalesce((SELECT jsonb_agg(jsonb_build_object('position', option.option_position, 'label', option.label) ORDER BY option.option_position) FROM public.contest_matching_options option WHERE option.exam_part_id = part.id), '[]'::jsonb),
      'speakers', coalesce((SELECT jsonb_agg(jsonb_build_object('speaker_number', speaker.speaker_number, 'label', speaker.label, 'image_url', speaker.image_url, 'correct_option', speaker.correct_option_position) ORDER BY speaker.speaker_number) FROM public.contest_matching_speakers speaker WHERE speaker.exam_part_id = part.id), '[]'::jsonb)) ORDER BY part.section, part.position)
      FROM public.contest_exam_parts part WHERE part.contest_id = contest.id AND EXISTS (SELECT 1 FROM public.contest_matching_speakers speaker WHERE speaker.exam_part_id = part.id)), '[]'::jsonb)
  ) INTO v_payload FROM public.contests contest WHERE contest.id = p_contest_id;
  IF v_payload IS NULL THEN RAISE EXCEPTION 'Contest not found'; END IF;
  RETURN v_payload;
END;
$function$;

REVOKE ALL ON FUNCTION public.save_contest_exam_part(uuid, uuid, integer, text, text, text, text, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_contest_question(uuid, uuid, integer, text, jsonb, text, integer, jsonb, integer, integer, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_cefr_gap_fill_answer_keys(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_exam_part_image(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_cefr_matching_config(uuid, uuid, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_contest_answer(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_contest_text_answer(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_cefr_gap_fill_response(uuid, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_cefr_matching_response(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_contest_workspace(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_contest_editor(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_contest_exam_part(uuid, uuid, integer, text, text, text, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_contest_question(uuid, uuid, integer, text, jsonb, text, integer, jsonb, integer, integer, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_cefr_gap_fill_answer_keys(uuid, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_exam_part_image(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_cefr_matching_config(uuid, uuid, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_contest_answer(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_contest_text_answer(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_cefr_gap_fill_response(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_cefr_matching_response(uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_contest_workspace(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_contest_editor(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
