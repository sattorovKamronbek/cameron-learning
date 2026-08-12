-- CEFR Listening Part 1 plays each question in the audio. The stored prompt is
-- an internal audit marker; participants see exactly three answer choices.

CREATE OR REPLACE FUNCTION public.save_contest_question(
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
DECLARE
  v_question_id uuid;
  v_contest public.contests%ROWTYPE;
  v_section text;
  v_part_position integer;
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
    OR p_points NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION 'Invalid question data';
  END IF;
  IF jsonb_array_length(p_options) NOT BETWEEN 2 AND 8
    OR p_correct_option IS NULL OR p_correct_option < 0 OR p_correct_option >= jsonb_array_length(p_options) THEN
    RAISE EXCEPTION 'Invalid question data';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_options) option_value(value)
    WHERE jsonb_typeof(option_value.value) <> 'string'
      OR char_length(trim(option_value.value #>> '{}')) = 0
  ) THEN
    RAISE EXCEPTION 'Question options cannot be empty';
  END IF;

  IF v_contest.subject IN ('ielts', 'cefr') THEN
    IF p_exam_part_id IS NULL THEN
      RAISE EXCEPTION 'Every IELTS or CEFR question must belong to a listening or reading part';
    END IF;

    SELECT section, position INTO v_section, v_part_position
    FROM public.contest_exam_parts
    WHERE id = p_exam_part_id AND contest_id = p_contest_id;

    IF v_section IS NULL OR v_section = 'writing' THEN
      RAISE EXCEPTION 'Questions may belong only to listening or reading parts';
    END IF;
    IF v_contest.subject = 'cefr' AND v_section = 'listening' AND v_part_position = 1
      AND jsonb_array_length(p_options) <> 3 THEN
      RAISE EXCEPTION 'CEFR Listening Part 1 requires exactly three answer options';
    END IF;
  ELSIF p_exam_part_id IS NOT NULL THEN
    RAISE EXCEPTION 'Exam parts can be used only by IELTS and CEFR contests';
  END IF;

  IF p_question_id IS NULL THEN
    INSERT INTO public.contest_questions (
      contest_id, exam_part_id, position, prompt, options, correct_option, points, explanation
    ) VALUES (
      p_contest_id, p_exam_part_id, p_position, trim(p_prompt), p_options,
      p_correct_option, p_points, nullif(trim(p_explanation), '')
    ) RETURNING id INTO v_question_id;
  ELSE
    UPDATE public.contest_questions
    SET exam_part_id = p_exam_part_id,
        position = p_position,
        prompt = trim(p_prompt),
        options = p_options,
        correct_option = p_correct_option,
        points = p_points,
        explanation = nullif(trim(p_explanation), '')
    WHERE id = p_question_id AND contest_id = p_contest_id
    RETURNING id INTO v_question_id;

    IF v_question_id IS NULL THEN RAISE EXCEPTION 'Question not found'; END IF;
  END IF;

  PERFORM public.log_audit_action('contest.question.save', 'contest', p_contest_id, jsonb_build_object('question_id', v_question_id));
  RETURN v_question_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_contest_question(uuid, uuid, integer, text, jsonb, integer, integer, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_contest_question(uuid, uuid, integer, text, jsonb, integer, integer, text, uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
