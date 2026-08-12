-- CEFR Reading Part 5 has one shared short text for Questions 30–33.
-- The text is stored on Question 30; Questions 31–33 hold only their own
-- answer keys plus a non-displayed internal label. Questions 34–35 remain
-- four-option multiple choice.

-- Some existing CEFR installations did not apply the earlier IELTS migration.
-- Make the typed-answer foundation available here as well, before any function
-- below references these columns.
ALTER TABLE public.contest_questions
  ADD COLUMN IF NOT EXISTS answer_type text NOT NULL DEFAULT 'choice',
  ADD COLUMN IF NOT EXISTS accepted_answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS word_limit integer NOT NULL DEFAULT 0;

ALTER TABLE public.contest_questions
  ALTER COLUMN correct_option DROP NOT NULL,
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

CREATE OR REPLACE FUNCTION public.save_contest_question(
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
AS $function$
DECLARE
  v_question_id uuid;
  v_contest public.contests%ROWTYPE;
  v_section text;
  v_part_position integer;
  v_answer_type text := lower(trim(coalesce(p_answer_type, 'choice')));
  v_shared_mini_text_key boolean := false;
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

  v_shared_mini_text_key := v_contest.subject = 'cefr'
    AND v_section = 'reading'
    AND v_part_position = 5
    AND p_position BETWEEN 30 AND 33;

  IF char_length(trim(coalesce(p_prompt, ''))) = 0 THEN
    RAISE EXCEPTION 'Question text cannot be empty';
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
    IF NOT (v_contest.subject = 'ielts' OR v_shared_mini_text_key) THEN
      RAISE EXCEPTION 'Typed answers are available only for IELTS and CEFR Reading Part 5 questions 30 through 33';
    END IF;
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
    IF v_shared_mini_text_key AND (
      p_word_limit <> 1
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(p_accepted_answers) answer(value)
        WHERE cardinality(regexp_split_to_array(trim(answer.value), '\s+')) <> 1
      )
    ) THEN
      RAISE EXCEPTION 'CEFR Reading Part 5 questions 30 through 33 require one-word answers';
    END IF;
  END IF;

  IF p_question_id IS NULL THEN
    INSERT INTO public.contest_questions (
      contest_id, exam_part_id, position, prompt, options, answer_type,
      correct_option, accepted_answers, word_limit, points, explanation
    ) VALUES (
      p_contest_id, p_exam_part_id, p_position, trim(coalesce(p_prompt, '')), p_options, v_answer_type,
      p_correct_option, coalesce(p_accepted_answers, '[]'::jsonb), coalesce(p_word_limit, 0),
      p_points, nullif(trim(p_explanation), '')
    ) RETURNING id INTO v_question_id;
  ELSE
    UPDATE public.contest_questions
    SET exam_part_id = p_exam_part_id, position = p_position, prompt = trim(coalesce(p_prompt, '')),
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
$function$;

CREATE OR REPLACE FUNCTION public.submit_contest_text_answer(p_question_id uuid, p_selected_text text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_question public.contest_questions%ROWTYPE;
  v_contest public.contests%ROWTYPE;
  v_section text;
  v_part_position integer;
  v_timing public.contest_exam_section_timings%ROWTYPE;
  v_section_start timestamptz;
  v_section_end timestamptz;
  v_answer text := regexp_replace(trim(coalesce(p_selected_text, '')), '\s+', ' ', 'g');
  v_correct boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.active_profile(auth.uid()) THEN RAISE EXCEPTION 'An active account is required to submit'; END IF;
  SELECT * INTO v_question FROM public.contest_questions WHERE id = p_question_id;
  IF NOT FOUND OR v_question.answer_type <> 'text' THEN RAISE EXCEPTION 'Typed-answer question not found'; END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = v_question.contest_id;
  SELECT section, position INTO v_section, v_part_position
  FROM public.contest_exam_parts
  WHERE id = v_question.exam_part_id AND contest_id = v_contest.id;
  IF NOT (
    v_contest.subject = 'ielts'
    OR (v_contest.subject = 'cefr' AND v_section = 'reading' AND v_part_position = 5 AND v_question.position BETWEEN 30 AND 33)
  ) OR NOT v_contest.is_published OR v_contest.archived_at IS NOT NULL OR now() < v_contest.start_at OR now() >= v_contest.end_at THEN
    RAISE EXCEPTION 'Answers are not accepted for this contest at this time';
  END IF;
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
$function$;

CREATE OR REPLACE FUNCTION public.validate_cefr_reading_question()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_part public.contest_exam_parts%ROWTYPE;
  v_subject text;
  v_markers integer[];
BEGIN
  IF NEW.exam_part_id IS NULL THEN RETURN NEW; END IF;
  SELECT part.* INTO v_part FROM public.contest_exam_parts part WHERE part.id = NEW.exam_part_id AND part.contest_id = NEW.contest_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  SELECT subject INTO v_subject FROM public.contests WHERE id = NEW.contest_id;
  IF v_subject <> 'cefr' OR v_part.section <> 'reading' THEN RETURN NEW; END IF;

  IF v_part.position = 4 THEN
    IF NEW.position NOT BETWEEN 21 AND 29 OR NEW.correct_option IS NULL THEN RAISE EXCEPTION 'CEFR Reading Part 4 needs answer-keyed questions 21 through 29'; END IF;
    IF NEW.position BETWEEN 21 AND 24 AND jsonb_array_length(NEW.options) <> 4 THEN RAISE EXCEPTION 'CEFR Reading Part 4 questions 21 through 24 require four A/B/C/D options'; END IF;
    IF NEW.position BETWEEN 25 AND 29 AND NEW.options <> jsonb_build_array('True', 'False', 'Not Given') THEN RAISE EXCEPTION 'CEFR Reading Part 4 questions 25 through 29 require True, False, Not Given'; END IF;
  ELSIF v_part.position = 5 THEN
    IF NEW.position BETWEEN 30 AND 33 THEN
      IF NEW.answer_type <> 'text' OR NEW.options <> '[]'::jsonb OR NEW.correct_option IS NOT NULL
        OR NEW.word_limit <> 1 OR jsonb_array_length(NEW.accepted_answers) NOT BETWEEN 1 AND 8
        OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(NEW.accepted_answers) answer(value) WHERE cardinality(regexp_split_to_array(trim(answer.value), '\s+')) <> 1) THEN
        RAISE EXCEPTION 'CEFR Reading Part 5 questions 30 through 33 require one-word typed answer keys';
      END IF;
      IF NEW.position = 30 THEN
        SELECT array_agg((marker.values)[1]::integer ORDER BY (marker.values)[1]::integer)
        INTO v_markers
        FROM regexp_matches(NEW.prompt, '\{\{([1-9][0-9]*)\}\}', 'g') marker(values);
        IF v_markers IS DISTINCT FROM ARRAY[30,31,32,33]::integer[] THEN
          RAISE EXCEPTION 'CEFR Reading Part 5 Question 30 must contain one shared mini text with {{30}}, {{31}}, {{32}}, and {{33}} exactly once';
        END IF;
      ELSIF NEW.prompt <> format('Shared mini-text answer key {{%s}}', NEW.position) THEN
        RAISE EXCEPTION 'CEFR Reading Part 5 Questions 31 through 33 must store only their shared-mini-text answer key label';
      END IF;
    ELSIF NEW.position BETWEEN 34 AND 35 THEN
      IF NEW.answer_type <> 'choice' OR NEW.correct_option IS NULL OR jsonb_array_length(NEW.options) <> 4 THEN
        RAISE EXCEPTION 'CEFR Reading Part 5 questions 34 and 35 require four A/B/C/D options and an answer key';
      END IF;
    ELSE
      RAISE EXCEPTION 'CEFR Reading Part 5 question numbers must be between 30 and 35';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_cefr_reading_before_publish()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_part public.contest_exam_parts%ROWTYPE;
  v_count integer;
  v_keys integer;
  v_markers integer[];
BEGIN
  IF NOT NEW.is_published OR OLD.is_published OR NEW.subject <> 'cefr' THEN RETURN NEW; END IF;
  IF (SELECT count(*) FROM public.contest_exam_parts WHERE contest_id = NEW.id AND section = 'reading') <> 5
    OR EXISTS (SELECT 1 FROM public.contest_exam_parts WHERE contest_id = NEW.id AND section = 'reading' AND position NOT BETWEEN 1 AND 5) THEN
    RAISE EXCEPTION 'CEFR Reading requires exactly five parts, numbered 1 through 5';
  END IF;
  FOR v_part IN SELECT * FROM public.contest_exam_parts WHERE contest_id = NEW.id AND section = 'reading' LOOP
    IF v_part.position = 1 THEN
      IF (SELECT array_agg(DISTINCT (m.values)[1]::integer ORDER BY (m.values)[1]::integer) FROM regexp_matches(v_part.content, '\{\{([1-9][0-9]*)\}\}', 'g') m(values)) IS DISTINCT FROM ARRAY[1,2,3,4,5,6]::integer[]
        OR (SELECT count(*) FROM public.contest_gap_fill_answer_keys WHERE exam_part_id = v_part.id) <> 6 THEN
        RAISE EXCEPTION 'CEFR Reading Part 1 needs {{1}} through {{6}} and six answer keys';
      END IF;
    ELSIF v_part.position = 2 THEN
      SELECT count(*), count(*) FILTER (WHERE correct_option_position IS NOT NULL) INTO v_count, v_keys FROM public.contest_matching_speakers WHERE exam_part_id = v_part.id;
      IF v_count <> 8 OR v_keys <> 8 THEN RAISE EXCEPTION 'CEFR Reading Part 2 needs Statements 7 through 14 and a Situation key for each'; END IF;
    ELSIF v_part.position = 3 THEN
      SELECT count(*), count(*) FILTER (WHERE correct_option_position IS NOT NULL) INTO v_count, v_keys FROM public.contest_matching_speakers WHERE exam_part_id = v_part.id;
      IF v_count <> 6 OR v_keys <> 6 OR (SELECT count(*) FROM public.contest_matching_options WHERE exam_part_id = v_part.id) <> 8 THEN RAISE EXCEPTION 'CEFR Reading Part 3 needs headings for 15 through 20 plus exactly two extra options'; END IF;
    ELSIF v_part.position = 4 THEN
      SELECT count(*), count(*) FILTER (WHERE correct_option IS NOT NULL) INTO v_count, v_keys FROM public.contest_questions WHERE exam_part_id = v_part.id AND position BETWEEN 21 AND 29;
      IF v_count <> 9 OR v_keys <> 9 THEN RAISE EXCEPTION 'CEFR Reading Part 4 needs questions 21 through 29 and every answer key'; END IF;
    ELSE
      SELECT array_agg((marker.values)[1]::integer ORDER BY (marker.values)[1]::integer)
      INTO v_markers
      FROM regexp_matches(coalesce((SELECT prompt FROM public.contest_questions WHERE exam_part_id = v_part.id AND position = 30), ''), '\{\{([1-9][0-9]*)\}\}', 'g') marker(values);
      SELECT count(*) INTO v_count FROM public.contest_questions
      WHERE exam_part_id = v_part.id AND position BETWEEN 30 AND 33
        AND answer_type = 'text' AND options = '[]'::jsonb AND correct_option IS NULL AND word_limit = 1
        AND jsonb_array_length(accepted_answers) BETWEEN 1 AND 8;
      SELECT count(*) INTO v_keys FROM public.contest_questions
      WHERE exam_part_id = v_part.id AND position IN (34, 35)
        AND answer_type = 'choice' AND correct_option IS NOT NULL AND jsonb_array_length(options) = 4;
      IF v_markers IS DISTINCT FROM ARRAY[30,31,32,33]::integer[]
        OR v_count <> 4
        OR v_keys <> 2
        OR EXISTS (
          SELECT 1 FROM public.contest_questions question
          WHERE question.exam_part_id = v_part.id AND question.position BETWEEN 31 AND 33
            AND question.prompt <> format('Shared mini-text answer key {{%s}}', question.position)
        )
        OR EXISTS (
          SELECT 1
          FROM public.contest_questions question
          CROSS JOIN LATERAL jsonb_array_elements_text(question.accepted_answers) answer(value)
          WHERE question.exam_part_id = v_part.id AND question.position BETWEEN 30 AND 33
            AND cardinality(regexp_split_to_array(trim(answer.value), '\s+')) <> 1
        ) THEN
        RAISE EXCEPTION 'CEFR Reading Part 5 needs one shared mini text with {{30}} through {{33}}, four one-word answer keys, and A/B/C/D questions 34 and 35';
      END IF;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS contest_questions_validate_cefr_reading ON public.contest_questions;
CREATE TRIGGER contest_questions_validate_cefr_reading
BEFORE INSERT OR UPDATE OF contest_id, exam_part_id, position, prompt, options, answer_type, correct_option, accepted_answers, word_limit
ON public.contest_questions
FOR EACH ROW EXECUTE FUNCTION public.validate_cefr_reading_question();

-- Earlier CEFR migrations treated Reading Part 5 as a passage-level gap-fill
-- part.  Its shared mini text now lives on Question 30, so publish through the
-- regular question path instead.
DO $migration$
DECLARE v_sql text;
BEGIN
  SELECT pg_get_functiondef('public.publish_contest(uuid)'::regprocedure) INTO v_sql;
  v_sql := replace(v_sql, '(v_part.section = ''reading'' AND v_part.position IN (1, 5))', '(v_part.section = ''reading'' AND v_part.position = 1)');
  EXECUTE v_sql;
END;
$migration$;

REVOKE ALL ON FUNCTION public.save_contest_question(uuid, uuid, integer, text, jsonb, text, integer, jsonb, integer, integer, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_contest_text_answer(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_contest_question(uuid, uuid, integer, text, jsonb, text, integer, jsonb, integer, integer, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_contest_text_answer(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
