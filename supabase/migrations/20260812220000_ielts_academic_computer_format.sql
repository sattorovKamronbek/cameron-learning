/*
  IELTS Academic computer format

  An IELTS answer is not always A/B/C.  This migration keeps the existing
  choice workflow for ordinary and CEFR contests, and adds securely-scored
  typed answers for IELTS completion and short-answer items.  It also makes
  the publish-time IELTS blueprint authoritative.
*/

ALTER TABLE public.contest_questions
  ADD COLUMN IF NOT EXISTS answer_type text NOT NULL DEFAULT 'choice',
  ADD COLUMN IF NOT EXISTS accepted_answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS word_limit integer NOT NULL DEFAULT 0;

ALTER TABLE public.contest_questions
  DROP CONSTRAINT IF EXISTS contest_questions_answer_type_check,
  DROP CONSTRAINT IF EXISTS contest_questions_word_limit_check,
  DROP CONSTRAINT IF EXISTS contest_questions_options_check;

ALTER TABLE public.contest_questions
  ADD CONSTRAINT contest_questions_answer_type_check CHECK (answer_type IN ('choice', 'text')),
  ADD CONSTRAINT contest_questions_word_limit_check CHECK (word_limit BETWEEN 0 AND 20),
  ADD CONSTRAINT contest_questions_options_check CHECK (
    jsonb_typeof(options) = 'array'
    AND (
      (answer_type = 'choice' AND jsonb_array_length(options) BETWEEN 2 AND 8)
      OR (answer_type = 'text' AND jsonb_array_length(options) = 0)
    )
  );

ALTER TABLE public.contest_answers
  ALTER COLUMN selected_option DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS selected_text text;

ALTER TABLE public.contest_answers
  DROP CONSTRAINT IF EXISTS contest_answers_selected_option_check;

ALTER TABLE public.contest_answers
  ADD CONSTRAINT contest_answers_selected_option_check
  CHECK (selected_option IS NULL OR selected_option >= 0);

DROP FUNCTION IF EXISTS public.save_contest_question(uuid, uuid, integer, text, jsonb, integer, integer, text, uuid);

CREATE FUNCTION public.save_contest_question(
  p_contest_id uuid,
  p_question_id uuid,
  p_position integer,
  p_prompt text,
  p_options jsonb,
  p_answer_type text,
  p_correct_option integer,
  p_accepted_answers jsonb,
  p_word_limit integer,
  p_points integer,
  p_explanation text,
  p_exam_part_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_question_id uuid;
  v_contest public.contests%ROWTYPE;
  v_section text;
  v_part_position integer;
  v_answer_type text := lower(trim(coalesce(p_answer_type, 'choice')));
BEGIN
  IF NOT public.can_manage_contest(p_contest_id) THEN
    RAISE EXCEPTION 'Only the owning judge or an admin can manage questions';
  END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contest not found'; END IF;
  IF v_contest.is_published OR v_contest.start_at <= now() THEN
    RAISE EXCEPTION 'Questions cannot be changed after publication or start';
  END IF;
  IF p_position IS NULL OR p_position < 1
    OR char_length(trim(coalesce(p_prompt, ''))) = 0
    OR coalesce(jsonb_typeof(p_options), '') <> 'array'
    OR p_points NOT BETWEEN 1 AND 1000
    OR v_answer_type NOT IN ('choice', 'text') THEN
    RAISE EXCEPTION 'Invalid question data';
  END IF;

  IF v_contest.subject IN ('ielts', 'cefr') THEN
    IF p_exam_part_id IS NULL THEN RAISE EXCEPTION 'Every IELTS or CEFR question must belong to a listening or reading part'; END IF;
    SELECT section, position INTO v_section, v_part_position
    FROM public.contest_exam_parts
    WHERE id = p_exam_part_id AND contest_id = p_contest_id;
    IF v_section IS NULL OR v_section = 'writing' THEN RAISE EXCEPTION 'Questions may belong only to listening or reading parts'; END IF;
  ELSIF p_exam_part_id IS NOT NULL THEN
    RAISE EXCEPTION 'Exam parts can be used only by IELTS and CEFR contests';
  END IF;

  IF v_answer_type = 'choice' THEN
    IF jsonb_array_length(p_options) NOT BETWEEN 2 AND 8
      OR (p_correct_option IS NOT NULL AND (p_correct_option < 0 OR p_correct_option >= jsonb_array_length(p_options)))
      OR coalesce(p_word_limit, 0) <> 0
      OR coalesce(p_accepted_answers, '[]'::jsonb) <> '[]'::jsonb THEN
      RAISE EXCEPTION 'Invalid choice question data';
    END IF;
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_options) option_value(value)
      WHERE jsonb_typeof(option_value.value) <> 'string'
        OR char_length(trim(option_value.value #>> '{}')) = 0
    ) THEN RAISE EXCEPTION 'Question options cannot be empty'; END IF;
    IF NOT (v_contest.subject = 'cefr' AND v_section = 'listening' AND v_part_position = 1)
      AND p_correct_option IS NULL THEN
      RAISE EXCEPTION 'Select a correct option before saving this question';
    END IF;
    IF v_contest.subject = 'cefr' AND v_section = 'listening' AND v_part_position = 1
      AND jsonb_array_length(p_options) <> 3 THEN
      RAISE EXCEPTION 'CEFR Listening Part 1 requires exactly three answer options';
    END IF;
  ELSE
    IF v_contest.subject <> 'ielts' THEN RAISE EXCEPTION 'Typed answers are available only for IELTS questions'; END IF;
    IF jsonb_array_length(p_options) <> 0 OR p_correct_option IS NOT NULL
      OR p_word_limit NOT BETWEEN 1 AND 20
      OR coalesce(jsonb_typeof(p_accepted_answers), '') <> 'array'
      OR jsonb_array_length(p_accepted_answers) NOT BETWEEN 1 AND 20 THEN
      RAISE EXCEPTION 'Invalid typed-answer question data';
    END IF;
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_accepted_answers) answer_value(value)
      WHERE jsonb_typeof(answer_value.value) <> 'string'
        OR char_length(trim(answer_value.value #>> '{}')) = 0
        OR char_length(trim(answer_value.value #>> '{}')) > 160
    ) THEN RAISE EXCEPTION 'Typed answer keys cannot be empty'; END IF;
  END IF;

  IF p_question_id IS NULL THEN
    INSERT INTO public.contest_questions (
      contest_id, exam_part_id, position, prompt, options, answer_type,
      correct_option, accepted_answers, word_limit, points, explanation
    ) VALUES (
      p_contest_id, p_exam_part_id, p_position, trim(p_prompt), p_options, v_answer_type,
      p_correct_option, coalesce(p_accepted_answers, '[]'::jsonb), coalesce(p_word_limit, 0),
      p_points, nullif(trim(p_explanation), '')
    ) RETURNING id INTO v_question_id;
  ELSE
    UPDATE public.contest_questions
    SET exam_part_id = p_exam_part_id, position = p_position, prompt = trim(p_prompt),
        options = p_options, answer_type = v_answer_type, correct_option = p_correct_option,
        accepted_answers = coalesce(p_accepted_answers, '[]'::jsonb), word_limit = coalesce(p_word_limit, 0),
        points = p_points, explanation = nullif(trim(p_explanation), '')
    WHERE id = p_question_id AND contest_id = p_contest_id
    RETURNING id INTO v_question_id;
    IF v_question_id IS NULL THEN RAISE EXCEPTION 'Question not found'; END IF;
  END IF;
  PERFORM public.log_audit_action('contest.question.save', 'contest', p_contest_id, jsonb_build_object('question_id', v_question_id, 'answer_type', v_answer_type));
  RETURN v_question_id;
END;
$$;

-- Keep the legacy RPC signature available for existing choice-only clients.
-- PostgREST selects this overload when no typed-answer parameters are sent.
CREATE FUNCTION public.save_contest_question(
  p_contest_id uuid,
  p_question_id uuid,
  p_position integer,
  p_prompt text,
  p_options jsonb,
  p_correct_option integer,
  p_points integer DEFAULT 1,
  p_explanation text DEFAULT NULL,
  p_exam_part_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  RETURN public.save_contest_question(
    p_contest_id,
    p_question_id,
    p_position,
    p_prompt,
    p_options,
    'choice',
    p_correct_option,
    '[]'::jsonb,
    0,
    p_points,
    p_explanation,
    p_exam_part_id
  );
END;
$$;

-- CEFR Listening uses one contest-wide sequence. Part 1 is 1–8 and
-- Part 5's three extracts occupy 24–29; these values must not restart at 1.
CREATE OR REPLACE FUNCTION public.validate_cefr_part_five_question()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_part public.contest_exam_parts%ROWTYPE;
  v_subject text;
BEGIN
  IF NEW.exam_part_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT part.* INTO v_part
  FROM public.contest_exam_parts part
  WHERE part.id = NEW.exam_part_id AND part.contest_id = NEW.contest_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT contest.subject INTO v_subject
  FROM public.contests contest
  WHERE contest.id = NEW.contest_id;

  IF v_subject = 'cefr' AND v_part.section = 'listening' AND v_part.position = 1
    AND NEW.position NOT BETWEEN 1 AND 8 THEN
    RAISE EXCEPTION 'CEFR Listening Part 1 question numbers must be between 1 and 8';
  END IF;

  IF v_subject = 'cefr' AND v_part.section = 'listening' AND v_part.position = 5 THEN
    IF NEW.position NOT BETWEEN 24 AND 29 THEN
      RAISE EXCEPTION 'CEFR Listening Part 5 question numbers must be between 24 and 29';
    END IF;
    IF NEW.correct_option IS NULL THEN
      RAISE EXCEPTION 'Every CEFR Listening Part 5 question needs an answer key';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_cefr_part_five_before_publish()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_part public.contest_exam_parts%ROWTYPE;
  v_question_count integer;
  v_distinct_positions integer;
  v_key_count integer;
BEGIN
  IF NOT NEW.is_published OR OLD.is_published OR NEW.subject <> 'cefr' THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.contest_questions question
    JOIN public.contest_exam_parts part ON part.id = question.exam_part_id
    WHERE question.contest_id = NEW.id
      AND part.section = 'listening'
      AND ((part.position = 1 AND question.position NOT BETWEEN 1 AND 8)
        OR (part.position = 5 AND question.position NOT BETWEEN 24 AND 29))
  ) THEN
    RAISE EXCEPTION 'CEFR Listening question numbers must follow the global 1–29 sequence';
  END IF;

  FOR v_part IN
    SELECT * FROM public.contest_exam_parts
    WHERE contest_id = NEW.id AND section = 'listening' AND position = 5
  LOOP
    SELECT
      count(*)::integer,
      count(DISTINCT question.position)::integer,
      count(*) FILTER (WHERE question.correct_option IS NOT NULL)::integer
    INTO v_question_count, v_distinct_positions, v_key_count
    FROM public.contest_questions question
    WHERE question.contest_id = NEW.id
      AND question.exam_part_id = v_part.id
      AND question.position BETWEEN 24 AND 29;

    IF v_question_count <> 6 OR v_distinct_positions <> 6 OR v_key_count <> 6 THEN
      RAISE EXCEPTION 'CEFR Listening Part 5 needs exactly 3 extracts × 2 questions, numbered 24 through 29, with every answer key selected';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

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
  v_expected_numbers := CASE WHEN v_part.section = 'reading' THEN ARRAY[1, 2, 3, 4, 5, 6, 7, 8]::integer[] WHEN v_part.position = 2 THEN ARRAY[9, 10, 11, 12, 13, 14]::integer[] ELSE ARRAY[30, 31, 32, 33, 34, 35]::integer[] END;

  SELECT array_agg(DISTINCT (marker.values)[1]::integer ORDER BY (marker.values)[1]::integer)
  INTO v_marker_numbers
  FROM regexp_matches(v_part.content, '\{\{([1-9][0-9]*)\}\}', 'g') AS marker(values);
  IF v_marker_numbers IS DISTINCT FROM v_expected_numbers THEN
    RAISE EXCEPTION 'CEFR Listening Part % must use its required question markers', v_part.position;
  END IF;
  IF jsonb_array_length(p_answer_keys) <> array_length(v_expected_numbers, 1) THEN RAISE EXCEPTION 'Enter one answer key for every required Part % marker', v_part.position; END IF;

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

CREATE OR REPLACE FUNCTION public.save_cefr_matching_config(
  p_contest_id uuid,
  p_exam_part_id uuid,
  p_options jsonb,
  p_speakers jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_contest public.contests%ROWTYPE;
  v_part public.contest_exam_parts%ROWTYPE;
  v_option jsonb;
  v_speaker jsonb;
  v_index integer;
  v_speaker_number integer;
  v_correct_option integer;
  v_expected_numbers integer[];
BEGIN
  IF NOT public.can_manage_contest(p_contest_id) THEN RAISE EXCEPTION 'Only the owning judge or an admin can manage matching'; END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id FOR UPDATE;
  IF NOT FOUND OR v_contest.subject <> 'cefr' THEN RAISE EXCEPTION 'CEFR contest not found'; END IF;
  IF v_contest.is_published OR v_contest.start_at <= now() THEN RAISE EXCEPTION 'Matching cannot be changed after publication or start'; END IF;
  SELECT * INTO v_part FROM public.contest_exam_parts WHERE id = p_exam_part_id AND contest_id = p_contest_id;
  IF NOT FOUND OR NOT ((v_part.section = 'listening' AND v_part.position IN (3, 4)) OR (v_part.section = 'reading' AND v_part.position IN (2, 4))) THEN RAISE EXCEPTION 'Matching is available only for CEFR Listening Parts 3/4 and Reading Parts 2/4'; END IF;
  IF coalesce(jsonb_typeof(p_options), '') <> 'array' OR jsonb_array_length(p_options) NOT BETWEEN 2 AND 12 THEN RAISE EXCEPTION 'Add between two and twelve answer-bank options'; END IF;
  v_expected_numbers := CASE WHEN v_part.section = 'reading' AND v_part.position = 2 THEN ARRAY[9, 10, 11, 12, 13, 14, 15, 16]::integer[] WHEN v_part.section = 'reading' THEN ARRAY[25, 26, 27, 28, 29, 30, 31, 32]::integer[] WHEN v_part.position = 3 THEN ARRAY[15, 16, 17, 18]::integer[] ELSE ARRAY[19, 20, 21, 22, 23]::integer[] END;
  IF coalesce(jsonb_typeof(p_speakers), '') <> 'array' OR jsonb_array_length(p_speakers) <> array_length(v_expected_numbers, 1) THEN RAISE EXCEPTION 'Use exactly the required number of numbered items for this CEFR part'; END IF;

  DELETE FROM public.contest_matching_speakers WHERE exam_part_id = p_exam_part_id;
  DELETE FROM public.contest_matching_options WHERE exam_part_id = p_exam_part_id;
  FOR v_index IN 0..jsonb_array_length(p_options) - 1 LOOP
    v_option := p_options -> v_index;
    IF jsonb_typeof(v_option) <> 'object' OR char_length(trim(coalesce(v_option->>'label', ''))) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Every answer-bank option needs text'; END IF;
    INSERT INTO public.contest_matching_options (contest_id, exam_part_id, option_position, label) VALUES (p_contest_id, p_exam_part_id, v_index, trim(v_option->>'label'));
  END LOOP;
  FOR v_index IN 0..jsonb_array_length(p_speakers) - 1 LOOP
    v_speaker := p_speakers -> v_index;
    v_speaker_number := coalesce((v_speaker->>'speaker_number')::integer, -1);
    IF v_speaker_number <> v_expected_numbers[v_index + 1] OR jsonb_typeof(v_speaker) <> 'object' OR char_length(trim(coalesce(v_speaker->>'label', ''))) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Each entry must use the required CEFR question number and have a label'; END IF;
    v_correct_option := CASE WHEN v_speaker->'correct_option' IS NULL OR v_speaker->'correct_option' = 'null'::jsonb THEN NULL ELSE (v_speaker->>'correct_option')::integer END;
    IF v_correct_option IS NOT NULL AND v_correct_option NOT BETWEEN 0 AND jsonb_array_length(p_options) - 1 THEN RAISE EXCEPTION 'An answer key points outside the answer bank'; END IF;
    INSERT INTO public.contest_matching_speakers (contest_id, exam_part_id, speaker_number, label, correct_option_position) VALUES (p_contest_id, p_exam_part_id, v_speaker_number, trim(v_speaker->>'label'), v_correct_option);
  END LOOP;
  PERFORM public.log_audit_action('contest.matching_config.save', 'contest', p_contest_id, jsonb_build_object('part_id', p_exam_part_id, 'entry_count', jsonb_array_length(p_speakers), 'option_count', jsonb_array_length(p_options)));
END;
$$;

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
AS $$
DECLARE v_contest public.contests%ROWTYPE;
BEGIN
  IF NOT public.can_manage_contest(p_contest_id) THEN RAISE EXCEPTION 'Only the owning judge or an admin can manage exam timings'; END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id FOR UPDATE;
  IF NOT FOUND OR v_contest.subject NOT IN ('ielts', 'cefr') THEN RAISE EXCEPTION 'Section timings are available only for IELTS and CEFR exams'; END IF;
  IF v_contest.is_published OR v_contest.archived_at IS NOT NULL OR v_contest.start_at <= now() THEN RAISE EXCEPTION 'Exam timings cannot be changed after a contest is published or started'; END IF;
  IF p_listening_minutes NOT BETWEEN 1 AND 720 OR p_reading_minutes NOT BETWEEN 1 AND 720 OR p_writing_minutes NOT BETWEEN 1 AND 720 THEN RAISE EXCEPTION 'Each section must be between 1 and 720 minutes'; END IF;
  IF v_contest.subject = 'ielts' AND (p_listening_minutes <> 30 OR p_reading_minutes <> 60 OR p_writing_minutes <> 60) THEN
    RAISE EXCEPTION 'IELTS Academic timing is fixed at 30 minutes Listening, 60 minutes Reading, and 60 minutes Writing';
  END IF;
  IF extract(epoch FROM (v_contest.end_at - v_contest.start_at)) <> (p_listening_minutes + p_reading_minutes + p_writing_minutes) * 60 THEN RAISE EXCEPTION 'Section timings must exactly equal the contest duration'; END IF;
  INSERT INTO public.contest_exam_section_timings (contest_id, listening_minutes, reading_minutes, writing_minutes)
  VALUES (p_contest_id, p_listening_minutes, p_reading_minutes, p_writing_minutes)
  ON CONFLICT (contest_id) DO UPDATE SET listening_minutes = EXCLUDED.listening_minutes, reading_minutes = EXCLUDED.reading_minutes, writing_minutes = EXCLUDED.writing_minutes, updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.get_contest_editor(p_contest_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_payload jsonb;
BEGIN
  IF NOT public.can_manage_contest(p_contest_id) THEN RAISE EXCEPTION 'You cannot view this contest editor'; END IF;
  SELECT jsonb_build_object(
    'contest', jsonb_build_object('id', contest.id, 'slug', contest.slug, 'title', contest.title, 'description', contest.description, 'subject', contest.subject, 'difficulty', contest.difficulty, 'contest_type', contest.contest_type, 'contest_mode', contest.contest_mode, 'visibility', contest.visibility, 'start_at', contest.start_at, 'end_at', contest.end_at, 'max_participants', contest.max_participants, 'rules', contest.rules, 'tags', contest.tags, 'prize', contest.prize, 'is_published', contest.is_published, 'is_finalized', contest.is_finalized, 'archived_at', contest.archived_at),
    'section_timings', (SELECT jsonb_build_object('listening_minutes', timing.listening_minutes, 'reading_minutes', timing.reading_minutes, 'writing_minutes', timing.writing_minutes) FROM public.contest_exam_section_timings timing WHERE timing.contest_id = contest.id),
    'parts', coalesce((SELECT jsonb_agg(jsonb_build_object('id', part.id, 'position', part.position, 'section', part.section, 'title', part.title, 'instructions', part.instructions, 'content', part.content, 'audio_url', part.audio_url, 'image_url', part.image_url, 'max_points', part.max_points) ORDER BY part.position) FROM public.contest_exam_parts part WHERE part.contest_id = contest.id), '[]'::jsonb),
    'questions', coalesce((SELECT jsonb_agg(jsonb_build_object('id', question.id, 'exam_part_id', question.exam_part_id, 'position', question.position, 'prompt', question.prompt, 'options', question.options, 'answer_type', question.answer_type, 'correct_option', question.correct_option, 'accepted_answers', question.accepted_answers, 'word_limit', question.word_limit, 'points', question.points, 'explanation', question.explanation) ORDER BY question.position) FROM public.contest_questions question WHERE question.contest_id = contest.id), '[]'::jsonb),
    'gap_fill_answer_keys', coalesce((SELECT jsonb_agg(jsonb_build_object('part_id', key.exam_part_id, 'blank_number', key.blank_number, 'accepted_answers', key.accepted_answers, 'points', key.points) ORDER BY key.exam_part_id, key.blank_number) FROM public.contest_gap_fill_answer_keys key WHERE key.contest_id = contest.id), '[]'::jsonb),
    'matching_configs', coalesce((SELECT jsonb_agg(jsonb_build_object('part_id', part.id, 'options', coalesce((SELECT jsonb_agg(jsonb_build_object('position', option.option_position, 'label', option.label) ORDER BY option.option_position) FROM public.contest_matching_options option WHERE option.exam_part_id = part.id), '[]'::jsonb), 'speakers', coalesce((SELECT jsonb_agg(jsonb_build_object('speaker_number', speaker.speaker_number, 'label', speaker.label, 'correct_option', speaker.correct_option_position) ORDER BY speaker.speaker_number) FROM public.contest_matching_speakers speaker WHERE speaker.exam_part_id = part.id), '[]'::jsonb)) ORDER BY part.section, part.position) FROM public.contest_exam_parts part WHERE part.contest_id = contest.id AND contest.subject = 'cefr' AND ((part.section = 'listening' AND part.position IN (3, 4)) OR (part.section = 'reading' AND part.position IN (2, 4)))), '[]'::jsonb)
  ) INTO v_payload FROM public.contests contest WHERE contest.id = p_contest_id;
  IF v_payload IS NULL THEN RAISE EXCEPTION 'Contest not found'; END IF;
  RETURN v_payload;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_contest_workspace(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_contest public.contests%ROWTYPE; v_payload jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.active_profile(auth.uid()) THEN RAISE EXCEPTION 'Sign in with an active account to enter a contest'; END IF;
  SELECT * INTO v_contest FROM public.contests WHERE slug = p_slug AND is_published AND archived_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contest not found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.contest_registrations registration WHERE registration.contest_id = v_contest.id AND registration.user_id = auth.uid()) THEN RAISE EXCEPTION 'Register for this contest before entering'; END IF;
  IF now() < v_contest.start_at THEN RAISE EXCEPTION 'Contest has not started'; END IF;
  IF now() >= v_contest.end_at THEN RAISE EXCEPTION 'Contest has finished'; END IF;
  SELECT jsonb_build_object(
    'contest', jsonb_build_object('id', contest.id, 'slug', contest.slug, 'title', contest.title, 'subject', contest.subject, 'start_at', contest.start_at, 'end_at', contest.end_at, 'contest_type', contest.contest_type, 'completed_at', registration.completed_at),
    'exam_timing', CASE WHEN contest.subject IN ('ielts', 'cefr') THEN (SELECT jsonb_build_object('listening_minutes', timing.listening_minutes, 'reading_minutes', timing.reading_minutes, 'writing_minutes', timing.writing_minutes, 'active_section', public.current_exam_section(contest.id), 'section_starts_at', CASE public.current_exam_section(contest.id) WHEN 'listening' THEN contest.start_at WHEN 'reading' THEN contest.start_at + (timing.listening_minutes * interval '1 minute') ELSE contest.start_at + ((timing.listening_minutes + timing.reading_minutes) * interval '1 minute') END, 'section_ends_at', CASE public.current_exam_section(contest.id) WHEN 'listening' THEN contest.start_at + (timing.listening_minutes * interval '1 minute') WHEN 'reading' THEN contest.start_at + ((timing.listening_minutes + timing.reading_minutes) * interval '1 minute') ELSE contest.end_at END) FROM public.contest_exam_section_timings timing WHERE timing.contest_id = contest.id) ELSE NULL END,
    'parts', coalesce((SELECT jsonb_agg(jsonb_build_object('id', part.id, 'position', part.position, 'section', part.section, 'title', part.title, 'instructions', part.instructions, 'content', part.content, 'audio_url', part.audio_url, 'image_url', part.image_url, 'max_points', part.max_points) ORDER BY part.position) FROM public.contest_exam_parts part WHERE part.contest_id = contest.id AND (contest.subject NOT IN ('ielts', 'cefr') OR part.section = public.current_exam_section(contest.id))), '[]'::jsonb),
    'questions', coalesce((SELECT jsonb_agg(jsonb_build_object('id', question.id, 'exam_part_id', question.exam_part_id, 'position', question.position, 'prompt', question.prompt, 'options', question.options, 'answer_type', question.answer_type, 'word_limit', question.word_limit, 'points', question.points) ORDER BY question.position) FROM public.contest_questions question WHERE question.contest_id = contest.id AND (contest.subject NOT IN ('ielts', 'cefr') OR EXISTS (SELECT 1 FROM public.contest_exam_parts part WHERE part.id = question.exam_part_id AND part.section = public.current_exam_section(contest.id)))), '[]'::jsonb),
    'answers', coalesce((SELECT jsonb_agg(jsonb_build_object('question_id', answer.question_id, 'selected_option', answer.selected_option, 'selected_text', answer.selected_text) ORDER BY question.position) FROM public.contest_answers answer JOIN public.contest_questions question ON question.id = answer.question_id WHERE answer.contest_id = contest.id AND answer.user_id = auth.uid() AND (contest.subject NOT IN ('ielts', 'cefr') OR EXISTS (SELECT 1 FROM public.contest_exam_parts part WHERE part.id = question.exam_part_id AND part.section = public.current_exam_section(contest.id)))), '[]'::jsonb),
    'gap_fill_responses', coalesce((SELECT jsonb_agg(jsonb_build_object('part_id', response.exam_part_id, 'blank_number', response.blank_number, 'answer', response.answer) ORDER BY response.exam_part_id, response.blank_number) FROM public.contest_gap_fill_responses response JOIN public.contest_exam_parts part ON part.id = response.exam_part_id WHERE response.contest_id = contest.id AND response.user_id = auth.uid() AND part.section = public.current_exam_section(contest.id)), '[]'::jsonb),
    'matching_configs', coalesce((SELECT jsonb_agg(jsonb_build_object('part_id', part.id, 'options', coalesce((SELECT jsonb_agg(jsonb_build_object('position', option.option_position, 'label', option.label) ORDER BY option.option_position) FROM public.contest_matching_options option WHERE option.exam_part_id = part.id), '[]'::jsonb), 'speakers', coalesce((SELECT jsonb_agg(jsonb_build_object('speaker_number', speaker.speaker_number, 'label', speaker.label) ORDER BY speaker.speaker_number) FROM public.contest_matching_speakers speaker WHERE speaker.exam_part_id = part.id), '[]'::jsonb)) ORDER BY part.position) FROM public.contest_exam_parts part WHERE part.contest_id = contest.id AND part.section = public.current_exam_section(contest.id) AND contest.subject = 'cefr' AND ((part.section = 'listening' AND part.position IN (3, 4)) OR (part.section = 'reading' AND part.position IN (2, 4)))), '[]'::jsonb),
    'matching_responses', coalesce((SELECT jsonb_agg(jsonb_build_object('part_id', response.exam_part_id, 'speaker_number', response.speaker_number, 'option_position', response.option_position) ORDER BY response.exam_part_id, response.speaker_number) FROM public.contest_matching_responses response JOIN public.contest_exam_parts part ON part.id = response.exam_part_id WHERE response.contest_id = contest.id AND response.user_id = auth.uid() AND part.section = public.current_exam_section(contest.id)), '[]'::jsonb),
    'writing_responses', coalesce((SELECT jsonb_agg(jsonb_build_object('part_id', submission.exam_part_id, 'content', submission.content, 'submitted_at', submission.submitted_at, 'updated_at', submission.updated_at) ORDER BY part.position) FROM public.contest_writing_submissions submission JOIN public.contest_exam_parts part ON part.id = submission.exam_part_id WHERE submission.contest_id = contest.id AND submission.user_id = auth.uid() AND (contest.subject NOT IN ('ielts', 'cefr') OR part.section = public.current_exam_section(contest.id))), '[]'::jsonb)
  ) INTO v_payload FROM public.contests contest JOIN public.contest_registrations registration ON registration.contest_id = contest.id AND registration.user_id = auth.uid() WHERE contest.id = v_contest.id;
  RETURN v_payload;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_contest_answer(p_question_id uuid, p_selected_option integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_question public.contest_questions%ROWTYPE; v_contest public.contests%ROWTYPE; v_section text; v_timing public.contest_exam_section_timings%ROWTYPE; v_section_start timestamptz; v_section_end timestamptz; v_correct boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.active_profile(auth.uid()) THEN RAISE EXCEPTION 'An active account is required to submit'; END IF;
  SELECT * INTO v_question FROM public.contest_questions WHERE id = p_question_id;
  IF NOT FOUND OR v_question.answer_type <> 'choice' THEN RAISE EXCEPTION 'Choice question not found'; END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = v_question.contest_id;
  IF NOT v_contest.is_published OR v_contest.archived_at IS NOT NULL OR now() < v_contest.start_at OR now() >= v_contest.end_at THEN RAISE EXCEPTION 'Answers are not accepted for this contest at this time'; END IF;
  IF v_contest.subject IN ('ielts', 'cefr') THEN
    SELECT section INTO v_section FROM public.contest_exam_parts WHERE id = v_question.exam_part_id AND contest_id = v_contest.id;
    SELECT * INTO v_timing FROM public.contest_exam_section_timings WHERE contest_id = v_contest.id;
    IF v_section IS NULL OR v_section NOT IN ('listening', 'reading') OR NOT FOUND THEN RAISE EXCEPTION 'Question section timing is unavailable'; END IF;
    v_section_start := CASE WHEN v_section = 'listening' THEN v_contest.start_at ELSE v_contest.start_at + (v_timing.listening_minutes * interval '1 minute') END;
    v_section_end := CASE WHEN v_section = 'listening' THEN v_section_start + (v_timing.listening_minutes * interval '1 minute') ELSE v_section_start + (v_timing.reading_minutes * interval '1 minute') END;
    IF now() < v_section_start OR now() >= v_section_end THEN RAISE EXCEPTION 'This exam section is closed'; END IF;
  END IF;
  IF v_contest.contest_type = 'rated' AND (v_contest.created_by = auth.uid() OR public.has_admin_access(auth.uid())) THEN RAISE EXCEPTION 'Contest managers cannot submit answers to a rated contest'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.contest_registrations registration WHERE registration.contest_id = v_contest.id AND registration.user_id = auth.uid()) THEN RAISE EXCEPTION 'Register for this contest before submitting'; END IF;
  IF v_contest.subject IN ('ielts', 'cefr') AND EXISTS (SELECT 1 FROM public.contest_registrations registration WHERE registration.contest_id = v_contest.id AND registration.user_id = auth.uid() AND registration.completed_at IS NOT NULL) THEN RAISE EXCEPTION 'This exam has already been submitted'; END IF;
  IF p_selected_option IS NULL OR p_selected_option < 0 OR p_selected_option >= jsonb_array_length(v_question.options) THEN RAISE EXCEPTION 'Invalid answer option'; END IF;
  v_correct := p_selected_option = v_question.correct_option;
  INSERT INTO public.contest_answers (contest_id, question_id, user_id, selected_option, selected_text, is_correct, score)
  VALUES (v_contest.id, v_question.id, auth.uid(), p_selected_option, NULL, v_correct, CASE WHEN v_correct THEN v_question.points ELSE 0 END)
  ON CONFLICT (question_id, user_id) DO UPDATE SET selected_option = EXCLUDED.selected_option, selected_text = NULL, is_correct = EXCLUDED.is_correct, score = EXCLUDED.score, submitted_at = now();
  UPDATE public.contest_registrations SET last_activity_at = now() WHERE contest_id = v_contest.id AND user_id = auth.uid();
  RETURN jsonb_build_object('saved', true, 'question_id', p_question_id);
END;
$$;

CREATE FUNCTION public.submit_contest_text_answer(p_question_id uuid, p_selected_text text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_question public.contest_questions%ROWTYPE; v_contest public.contests%ROWTYPE; v_section text; v_timing public.contest_exam_section_timings%ROWTYPE; v_section_start timestamptz; v_section_end timestamptz; v_answer text := regexp_replace(trim(coalesce(p_selected_text, '')), '\s+', ' ', 'g'); v_correct boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.active_profile(auth.uid()) THEN RAISE EXCEPTION 'An active account is required to submit'; END IF;
  SELECT * INTO v_question FROM public.contest_questions WHERE id = p_question_id;
  IF NOT FOUND OR v_question.answer_type <> 'text' THEN RAISE EXCEPTION 'Typed-answer question not found'; END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = v_question.contest_id;
  IF v_contest.subject <> 'ielts' OR NOT v_contest.is_published OR v_contest.archived_at IS NOT NULL OR now() < v_contest.start_at OR now() >= v_contest.end_at THEN RAISE EXCEPTION 'Answers are not accepted for this contest at this time'; END IF;
  SELECT section INTO v_section FROM public.contest_exam_parts WHERE id = v_question.exam_part_id AND contest_id = v_contest.id;
  SELECT * INTO v_timing FROM public.contest_exam_section_timings WHERE contest_id = v_contest.id;
  IF v_section IS NULL OR v_section NOT IN ('listening', 'reading') OR NOT FOUND THEN RAISE EXCEPTION 'Question section timing is unavailable'; END IF;
  v_section_start := CASE WHEN v_section = 'listening' THEN v_contest.start_at ELSE v_contest.start_at + (v_timing.listening_minutes * interval '1 minute') END;
  v_section_end := CASE WHEN v_section = 'listening' THEN v_section_start + (v_timing.listening_minutes * interval '1 minute') ELSE v_section_start + (v_timing.reading_minutes * interval '1 minute') END;
  IF now() < v_section_start OR now() >= v_section_end THEN RAISE EXCEPTION 'This exam section is closed'; END IF;
  IF v_contest.contest_type = 'rated' AND (v_contest.created_by = auth.uid() OR public.has_admin_access(auth.uid())) THEN RAISE EXCEPTION 'Contest managers cannot submit answers to a rated contest'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.contest_registrations registration WHERE registration.contest_id = v_contest.id AND registration.user_id = auth.uid()) THEN RAISE EXCEPTION 'Register for this contest before submitting'; END IF;
  IF EXISTS (SELECT 1 FROM public.contest_registrations registration WHERE registration.contest_id = v_contest.id AND registration.user_id = auth.uid() AND registration.completed_at IS NOT NULL) THEN RAISE EXCEPTION 'This exam has already been submitted'; END IF;
  IF v_answer = '' THEN
    DELETE FROM public.contest_answers WHERE question_id = v_question.id AND user_id = auth.uid();
    RETURN jsonb_build_object('saved', true, 'cleared', true, 'question_id', p_question_id);
  END IF;
  IF cardinality(regexp_split_to_array(v_answer, '\s+')) > v_question.word_limit THEN RAISE EXCEPTION 'This answer exceeds the word limit'; END IF;
  SELECT EXISTS (SELECT 1 FROM jsonb_array_elements_text(v_question.accepted_answers) accepted(answer) WHERE lower(regexp_replace(trim(accepted.answer), '\s+', ' ', 'g')) = lower(v_answer)) INTO v_correct;
  INSERT INTO public.contest_answers (contest_id, question_id, user_id, selected_option, selected_text, is_correct, score)
  VALUES (v_contest.id, v_question.id, auth.uid(), NULL, v_answer, v_correct, CASE WHEN v_correct THEN v_question.points ELSE 0 END)
  ON CONFLICT (question_id, user_id) DO UPDATE SET selected_option = NULL, selected_text = EXCLUDED.selected_text, is_correct = EXCLUDED.is_correct, score = EXCLUDED.score, submitted_at = now();
  UPDATE public.contest_registrations SET last_activity_at = now() WHERE contest_id = v_contest.id AND user_id = auth.uid();
  RETURN jsonb_build_object('saved', true, 'question_id', p_question_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.save_exam_writing_response(p_exam_part_id uuid, p_content text, p_submit boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_part public.contest_exam_parts%ROWTYPE; v_contest public.contests%ROWTYPE; v_timing public.contest_exam_section_timings%ROWTYPE; v_writing_start timestamptz; v_submitted_at timestamptz; v_words integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.active_profile(auth.uid()) THEN RAISE EXCEPTION 'An active account is required to submit writing'; END IF;
  SELECT * INTO v_part FROM public.contest_exam_parts WHERE id = p_exam_part_id;
  IF NOT FOUND OR v_part.section <> 'writing' THEN RAISE EXCEPTION 'Writing part not found'; END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = v_part.contest_id;
  IF NOT v_contest.is_published OR v_contest.archived_at IS NOT NULL OR now() < v_contest.start_at OR now() >= v_contest.end_at THEN RAISE EXCEPTION 'Writing is not accepted for this exam at this time'; END IF;
  SELECT * INTO v_timing FROM public.contest_exam_section_timings WHERE contest_id = v_contest.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Writing timing is unavailable'; END IF;
  v_writing_start := v_contest.start_at + ((v_timing.listening_minutes + v_timing.reading_minutes) * interval '1 minute');
  IF now() < v_writing_start THEN RAISE EXCEPTION 'Writing has not started yet'; END IF;
  IF v_contest.contest_type = 'rated' AND (v_contest.created_by = auth.uid() OR public.has_admin_access(auth.uid())) THEN RAISE EXCEPTION 'Contest managers cannot submit writing to a rated exam'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.contest_registrations registration WHERE registration.contest_id = v_contest.id AND registration.user_id = auth.uid()) THEN RAISE EXCEPTION 'Register for this exam before submitting writing'; END IF;
  IF EXISTS (SELECT 1 FROM public.contest_registrations registration WHERE registration.contest_id = v_contest.id AND registration.user_id = auth.uid() AND registration.completed_at IS NOT NULL) THEN RAISE EXCEPTION 'This exam has already been submitted'; END IF;
  IF char_length(trim(coalesce(p_content, ''))) < 1 THEN RAISE EXCEPTION 'Writing response cannot be empty'; END IF;
  v_words := cardinality(regexp_split_to_array(trim(p_content), '\s+'));
  IF p_submit AND v_contest.subject = 'ielts' AND ((v_part.position = 8 AND v_words < 150) OR (v_part.position = 9 AND v_words < 250)) THEN RAISE EXCEPTION 'IELTS Writing Task % requires at least % words', CASE WHEN v_part.position = 8 THEN 1 ELSE 2 END, CASE WHEN v_part.position = 8 THEN 150 ELSE 250 END; END IF;
  SELECT submitted_at INTO v_submitted_at FROM public.contest_writing_submissions WHERE exam_part_id = p_exam_part_id AND user_id = auth.uid() FOR UPDATE;
  IF v_submitted_at IS NOT NULL THEN RAISE EXCEPTION 'This writing response has already been submitted'; END IF;
  INSERT INTO public.contest_writing_submissions (contest_id, exam_part_id, user_id, content, submitted_at)
  VALUES (v_contest.id, p_exam_part_id, auth.uid(), trim(p_content), CASE WHEN p_submit THEN now() ELSE NULL END)
  ON CONFLICT (exam_part_id, user_id) DO UPDATE SET content = EXCLUDED.content, submitted_at = CASE WHEN p_submit THEN now() ELSE NULL END, updated_at = now()
  RETURNING submitted_at INTO v_submitted_at;
  UPDATE public.contest_registrations SET last_activity_at = now() WHERE contest_id = v_contest.id AND user_id = auth.uid();
  RETURN jsonb_build_object('saved', true, 'submitted_at', v_submitted_at);
END;
$$;

CREATE FUNCTION public.save_exam_part_image(p_contest_id uuid, p_exam_part_id uuid, p_image_url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_contest public.contests%ROWTYPE; v_part public.contest_exam_parts%ROWTYPE;
BEGIN
  IF NOT public.can_manage_contest(p_contest_id) THEN RAISE EXCEPTION 'Only the owning judge or an admin can manage exam images'; END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id FOR UPDATE;
  IF NOT FOUND OR v_contest.is_published OR v_contest.archived_at IS NOT NULL OR v_contest.start_at <= now() THEN RAISE EXCEPTION 'Exam images cannot be changed after publication or start'; END IF;
  SELECT * INTO v_part FROM public.contest_exam_parts WHERE id = p_exam_part_id AND contest_id = p_contest_id;
  IF NOT FOUND OR v_contest.subject <> 'ielts' OR v_part.section <> 'writing' OR v_part.position <> 8 THEN RAISE EXCEPTION 'Only IELTS Writing Task 1 can include a visual'; END IF;
  IF char_length(coalesce(p_image_url, '')) > 2000 THEN RAISE EXCEPTION 'Image URL is too long'; END IF;
  UPDATE public.contest_exam_parts SET image_url = nullif(trim(p_image_url), '') WHERE id = p_exam_part_id;
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
    IF EXISTS (SELECT 1 FROM public.contest_exam_parts part LEFT JOIN public.contest_questions question ON question.exam_part_id = part.id WHERE part.contest_id = p_contest_id AND part.section = 'listening' GROUP BY part.id HAVING count(question.id) <> 10) THEN
      RAISE EXCEPTION 'Each IELTS Listening part requires exactly 10 questions';
    END IF;
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
      IF v_part.section = 'listening' AND v_part.position IN (2, 6) THEN
        IF NOT EXISTS (SELECT 1 FROM regexp_matches(v_part.content, '\{\{([1-9][0-9]*)\}\}', 'g')) THEN RAISE EXCEPTION 'CEFR Listening Part % needs gap-fill markers in its text', v_part.position; END IF;
        IF EXISTS (SELECT 1 FROM regexp_matches(v_part.content, '\{\{([1-9][0-9]*)\}\}', 'g') marker(values) LEFT JOIN public.contest_gap_fill_answer_keys key ON key.exam_part_id = v_part.id AND key.blank_number = (marker.values)[1]::integer WHERE key.id IS NULL) THEN RAISE EXCEPTION 'Save every CEFR Listening Part % answer key before publishing', v_part.position; END IF;
      ELSIF v_part.section = 'listening' AND v_part.position IN (3, 4) THEN
        IF v_part.position = 4 AND nullif(trim(v_part.image_url), '') IS NULL THEN RAISE EXCEPTION 'CEFR Listening Part 4 needs a high-resolution map or photo'; END IF;
        IF NOT EXISTS (SELECT 1 FROM public.contest_matching_options WHERE exam_part_id = v_part.id) OR NOT EXISTS (SELECT 1 FROM public.contest_matching_speakers WHERE exam_part_id = v_part.id) THEN RAISE EXCEPTION 'Configure the CEFR Listening matching answer bank before publishing'; END IF;
        IF EXISTS (SELECT 1 FROM public.contest_matching_speakers WHERE exam_part_id = v_part.id AND correct_option_position IS NULL) THEN RAISE EXCEPTION 'Select every CEFR Listening matching answer key before publishing'; END IF;
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

CREATE OR REPLACE FUNCTION public.finalize_contest_v2(p_contest_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_contest public.contests%ROWTYPE; v_result record; v_total_points integer; v_field_average numeric; v_field_size integer; v_before integer; v_after integer; v_delta integer; v_expected numeric; v_actual numeric; v_quality numeric; v_k numeric; v_rated_contests integer;
BEGIN
  IF NOT public.can_manage_contest(p_contest_id) THEN RAISE EXCEPTION 'You cannot finalize this contest'; END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id FOR UPDATE;
  IF NOT FOUND OR NOT v_contest.is_published OR v_contest.archived_at IS NOT NULL OR v_contest.end_at > now() THEN RAISE EXCEPTION 'Only a finished published contest can be finalized'; END IF;
  IF v_contest.is_finalized OR EXISTS (SELECT 1 FROM public.contest_results WHERE contest_id = p_contest_id) THEN RAISE EXCEPTION 'Contest results have already been finalized'; END IF;
  IF v_contest.contest_type = 'rated' AND NOT public.has_admin_access(auth.uid()) THEN RAISE EXCEPTION 'Only a confirmed administrator can finalize a rated contest'; END IF;
  IF v_contest.contest_mode = 'gym' AND v_contest.contest_type <> 'unrated' THEN RAISE EXCEPTION 'Gym contests cannot be rated'; END IF;
  IF v_contest.subject IN ('ielts', 'cefr') AND EXISTS (SELECT 1 FROM public.contest_writing_submissions WHERE contest_id = p_contest_id AND submitted_at IS NOT NULL AND score IS NULL) THEN RAISE EXCEPTION 'Grade every submitted Writing response before finalizing'; END IF;
  SELECT coalesce((SELECT sum(points) FROM public.contest_questions WHERE contest_id = p_contest_id), 0)::integer + coalesce((SELECT sum(points) FROM public.contest_gap_fill_answer_keys WHERE contest_id = p_contest_id), 0)::integer + coalesce((SELECT count(*) FROM public.contest_matching_speakers WHERE contest_id = p_contest_id), 0)::integer + CASE WHEN v_contest.subject IN ('ielts', 'cefr') THEN coalesce((SELECT sum(max_points) FROM public.contest_exam_parts WHERE contest_id = p_contest_id AND section = 'writing'), 0)::integer ELSE 0 END INTO v_total_points;
  IF v_total_points < 1 THEN RAISE EXCEPTION 'Contest has no scorable questions'; END IF;
  CREATE TEMP TABLE contest_rating_work (rank integer, user_id uuid, score integer, answered_count integer, rating integer, rated_contests integer) ON COMMIT DROP;
  INSERT INTO contest_rating_work (rank, user_id, score, answered_count, rating, rated_contests)
  WITH scores AS (
    SELECT registration.user_id,
      (coalesce((SELECT sum(answer.score) FROM public.contest_answers answer WHERE answer.contest_id = registration.contest_id AND answer.user_id = registration.user_id), 0) + coalesce((SELECT sum(response.score) FROM public.contest_gap_fill_responses response WHERE response.contest_id = registration.contest_id AND response.user_id = registration.user_id), 0) + coalesce((SELECT sum(response.score) FROM public.contest_matching_responses response WHERE response.contest_id = registration.contest_id AND response.user_id = registration.user_id), 0) + CASE WHEN v_contest.subject IN ('ielts', 'cefr') THEN coalesce((SELECT sum(submission.score) FROM public.contest_writing_submissions submission WHERE submission.contest_id = registration.contest_id AND submission.user_id = registration.user_id AND submission.submitted_at IS NOT NULL), 0) ELSE 0 END)::integer AS score,
      ((SELECT count(*) FROM public.contest_answers answer WHERE answer.contest_id = registration.contest_id AND answer.user_id = registration.user_id) + (SELECT count(*) FROM public.contest_gap_fill_responses response WHERE response.contest_id = registration.contest_id AND response.user_id = registration.user_id) + (SELECT count(*) FROM public.contest_matching_responses response WHERE response.contest_id = registration.contest_id AND response.user_id = registration.user_id) + CASE WHEN v_contest.subject IN ('ielts', 'cefr') THEN (SELECT count(*) FROM public.contest_writing_submissions submission WHERE submission.contest_id = registration.contest_id AND submission.user_id = registration.user_id AND submission.submitted_at IS NOT NULL) ELSE 0 END)::integer AS answered_count,
      registration.last_activity_at AS last_activity
    FROM public.contest_registrations registration
    WHERE registration.contest_id = p_contest_id AND (v_contest.contest_type <> 'rated' OR (registration.user_id <> v_contest.created_by AND NOT public.has_admin_access(registration.user_id)))
  ), ranked AS (
    SELECT row_number() OVER (ORDER BY score DESC, answered_count DESC, last_activity NULLS LAST, user_id)::integer AS rank, user_id, score, answered_count FROM scores WHERE answered_count > 0
  )
  SELECT ranked.rank, ranked.user_id, ranked.score, ranked.answered_count, coalesce(rating.current_rating, 1000), coalesce(rating.rated_contests, 0) FROM ranked LEFT JOIN public.user_subject_ratings rating ON rating.user_id = ranked.user_id AND rating.subject = v_contest.subject;
  SELECT count(*), coalesce(avg(rating), 1000) INTO v_field_size, v_field_average FROM contest_rating_work;
  FOR v_result IN SELECT * FROM contest_rating_work ORDER BY rank LOOP
    v_before := NULL; v_after := NULL; v_delta := NULL;
    IF v_contest.contest_type = 'rated' THEN
      v_before := v_result.rating; v_rated_contests := v_result.rated_contests;
      v_expected := 1 / (1 + power(10::numeric, (v_field_average - v_before) / 400.0));
      v_actual := CASE WHEN v_field_size <= 1 THEN 0.5 ELSE 1 - ((v_result.rank - 1)::numeric / (v_field_size - 1)::numeric) END;
      v_quality := least(1::numeric, greatest(0::numeric, v_result.score::numeric / v_total_points::numeric));
      v_k := (CASE WHEN v_rated_contests < 5 THEN 48 ELSE 28 END) * least(1.8::numeric, greatest(0.7::numeric, sqrt(v_field_size::numeric / 10.0)));
      v_delta := greatest(-80, least(80, round(v_k * (((v_actual * 0.78) + (v_quality * 0.22)) - ((v_expected * 0.85) + 0.075)))::integer));
      v_after := greatest(0, v_before + v_delta);
      INSERT INTO public.user_subject_ratings (user_id, subject, current_rating, peak_rating, rated_contests) VALUES (v_result.user_id, v_contest.subject, v_after, greatest(v_before, v_after), 1)
      ON CONFLICT (user_id, subject) DO UPDATE SET current_rating = EXCLUDED.current_rating, peak_rating = greatest(public.user_subject_ratings.peak_rating, EXCLUDED.current_rating), rated_contests = public.user_subject_ratings.rated_contests + 1, updated_at = now();
      INSERT INTO public.app_notifications (user_id, type, title, message, metadata) VALUES (v_result.user_id, 'rating-change', 'Contest rating finalized', 'Your contest rating was calculated from the finalized standings.', jsonb_build_object('contest_id', p_contest_id, 'ratingBefore', v_before, 'ratingAfter', v_after, 'ratingDelta', v_delta, 'subject', v_contest.subject));
    END IF;
    INSERT INTO public.contest_results (contest_id, user_id, rank, score, answered_count, rating_before, rating_after, rating_delta) VALUES (p_contest_id, v_result.user_id, v_result.rank, v_result.score, v_result.answered_count, v_before, v_after, v_delta);
  END LOOP;
  UPDATE public.contests SET is_finalized = true, finalized_at = now() WHERE id = p_contest_id;
  PERFORM public.log_audit_action('contest.finalize', 'contest', p_contest_id, jsonb_build_object('rated', v_contest.contest_type = 'rated', 'algorithm', 'pairwise-elo-score-v3'));
END;
$$;

REVOKE ALL ON FUNCTION public.save_contest_question(uuid, uuid, integer, text, jsonb, text, integer, jsonb, integer, integer, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_contest_question(uuid, uuid, integer, text, jsonb, integer, integer, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_contest_text_answer(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_exam_part_image(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_contest_editor(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_contest_workspace(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.publish_contest(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_contest_v2(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_contest_question(uuid, uuid, integer, text, jsonb, text, integer, jsonb, integer, integer, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_contest_question(uuid, uuid, integer, text, jsonb, integer, integer, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_contest_text_answer(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_exam_part_image(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_contest_editor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_contest_workspace(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_contest(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_contest_v2(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
