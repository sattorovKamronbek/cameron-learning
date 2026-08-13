-- Passage 2 heading matching has nine Roman-numeral headings (i-ix).

-- The generic data constraint must also permit the ninth heading before the
-- question-save RPC can insert it. The RPC below keeps nine choices limited
-- to IELTS Reading Passage 2 heading matching.
ALTER TABLE public.contest_questions
  DROP CONSTRAINT IF EXISTS contest_questions_options_check;

ALTER TABLE public.contest_questions
  ADD CONSTRAINT contest_questions_options_check CHECK (
    jsonb_typeof(options) = 'array'
    AND (
      (answer_type = 'choice' AND jsonb_array_length(options) BETWEEN 2 AND 9)
      OR (answer_type = 'text' AND jsonb_array_length(options) = 0)
    )
  );

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
  v_part_content text;
  v_answer_type text := lower(trim(coalesce(p_answer_type, 'choice')));
  v_shared_mini_text_key boolean := false;
  v_max_choice_options integer := 8;
BEGIN
  IF NOT public.can_manage_contest(p_contest_id) THEN
    RAISE EXCEPTION 'Only the owning judge or an admin can manage questions';
  END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contest not found'; END IF;
  IF v_contest.archived_at IS NOT NULL OR v_contest.start_at <= now() THEN
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
    SELECT section, position, content INTO v_section, v_part_position, v_part_content
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
  IF v_contest.subject = 'ielts'
    AND v_section = 'reading'
    AND v_part_position = 6
    AND v_part_content LIKE 'IELTS_READING_PASSAGE_TWO_STRUCTURED%'
    AND p_position BETWEEN 54 AND 60 THEN
    v_max_choice_options := 9;
  END IF;

  IF char_length(trim(coalesce(p_prompt, ''))) = 0 THEN
    RAISE EXCEPTION 'Question text cannot be empty';
  END IF;

  IF v_answer_type = 'choice' THEN
    IF jsonb_array_length(p_options) NOT BETWEEN 2 AND v_max_choice_options
      OR (p_correct_option IS NOT NULL AND (p_correct_option < 0 OR p_correct_option >= jsonb_array_length(p_options)))
      OR coalesce(p_word_limit, 0) <> 0
      OR coalesce(p_accepted_answers, '[]'::jsonb) <> '[]'::jsonb THEN
      RAISE EXCEPTION 'Invalid choice question data';
    END IF;
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_options) AS option_value(value)
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
      SELECT 1 FROM jsonb_array_elements(p_accepted_answers) AS answer_value(value)
      WHERE jsonb_typeof(answer_value.value) <> 'string'
        OR char_length(trim(answer_value.value #>> '{}')) = 0
        OR char_length(trim(answer_value.value #>> '{}')) > 160
    ) THEN RAISE EXCEPTION 'Typed answer keys cannot be empty'; END IF;
    IF v_shared_mini_text_key AND (
      p_word_limit <> 1
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(p_accepted_answers) AS answer(value)
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

REVOKE ALL ON FUNCTION public.save_contest_question(uuid, uuid, integer, text, jsonb, text, integer, jsonb, integer, integer, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_contest_question(uuid, uuid, integer, text, jsonb, text, integer, jsonb, integer, integer, text, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
