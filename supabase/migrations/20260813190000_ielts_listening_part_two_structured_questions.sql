-- IELTS Listening Part 2 can render questions 13-20 as three shared blocks.
-- Questions 11-12 remain ordinary items so the part still contains ten questions.

CREATE OR REPLACE FUNCTION public.clear_contest_answer(p_question_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_question public.contest_questions%ROWTYPE;
  v_contest public.contests%ROWTYPE;
  v_section text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.active_profile(auth.uid()) THEN
    RAISE EXCEPTION 'An active account is required to submit';
  END IF;

  SELECT * INTO v_question FROM public.contest_questions WHERE id = p_question_id;
  IF NOT FOUND OR v_question.answer_type <> 'choice' THEN
    RAISE EXCEPTION 'Choice question not found';
  END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = v_question.contest_id;
  IF NOT v_contest.is_published OR v_contest.archived_at IS NOT NULL OR now() < v_contest.start_at OR now() >= v_contest.end_at THEN
    RAISE EXCEPTION 'Answers are not accepted for this contest at this time';
  END IF;
  IF v_contest.contest_type = 'rated' AND (v_contest.created_by = auth.uid() OR public.has_admin_access(auth.uid())) THEN
    RAISE EXCEPTION 'Contest managers cannot submit answers to a rated contest';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.contest_registrations registration
    WHERE registration.contest_id = v_contest.id AND registration.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Register for this contest before submitting';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.contest_registrations registration
    WHERE registration.contest_id = v_contest.id AND registration.user_id = auth.uid() AND registration.completed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'This contest attempt has already ended';
  END IF;
  IF v_contest.subject IN ('ielts', 'cefr') THEN
    SELECT section INTO v_section
    FROM public.contest_exam_parts
    WHERE id = v_question.exam_part_id AND contest_id = v_contest.id;
    IF v_section NOT IN ('listening', 'reading') THEN
      RAISE EXCEPTION 'Question section timing is unavailable';
    END IF;
    PERFORM public.assert_exam_section_open(v_contest.id, v_section);
  END IF;

  DELETE FROM public.contest_answers
  WHERE question_id = v_question.id AND user_id = auth.uid();
  UPDATE public.contest_registrations
  SET last_activity_at = now()
  WHERE contest_id = v_contest.id AND user_id = auth.uid();
  RETURN jsonb_build_object('saved', true, 'cleared', true, 'question_id', p_question_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.clear_contest_preview_answer(p_question_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_question public.contest_questions%ROWTYPE;
  v_contest public.contests%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.active_profile(auth.uid()) THEN
    RAISE EXCEPTION 'An active account is required to save a preview answer';
  END IF;
  SELECT * INTO v_question FROM public.contest_questions WHERE id = p_question_id;
  IF NOT FOUND OR v_question.answer_type <> 'choice' THEN
    RAISE EXCEPTION 'Choice question not found';
  END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = v_question.contest_id;
  IF NOT FOUND OR v_contest.is_published OR v_contest.archived_at IS NOT NULL
    OR NOT public.can_manage_contest(v_contest.id) THEN
    RAISE EXCEPTION 'This draft preview is not available';
  END IF;

  DELETE FROM public.contest_answers
  WHERE question_id = v_question.id AND user_id = auth.uid();
  RETURN jsonb_build_object('saved', true, 'cleared', true, 'question_id', p_question_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_ielts_listening_part_two_structured_before_publish()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_part public.contest_exam_parts%ROWTYPE;
  v_summary public.contest_questions%ROWTYPE;
  v_summary_key public.contest_questions%ROWTYPE;
  v_two_answer public.contest_questions%ROWTYPE;
  v_two_answer_key public.contest_questions%ROWTYPE;
  v_activity_count integer;
BEGIN
  IF NOT (NEW.is_published AND NOT OLD.is_published AND NEW.subject = 'ielts') THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_part
  FROM public.contest_exam_parts
  WHERE contest_id = NEW.id
    AND section = 'listening'
    AND position = 2;
  IF NOT FOUND OR v_part.content <> 'IELTS_LISTENING_PART_TWO_STRUCTURED' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_summary FROM public.contest_questions
  WHERE contest_id = NEW.id AND exam_part_id = v_part.id AND position = 13;
  SELECT * INTO v_summary_key FROM public.contest_questions
  WHERE contest_id = NEW.id AND exam_part_id = v_part.id AND position = 14;
  IF v_summary.id IS NULL
    OR v_summary_key.id IS NULL
    OR v_summary.answer_type <> 'text'
    OR v_summary_key.answer_type <> 'text'
    OR v_summary.word_limit <> 1
    OR v_summary_key.word_limit <> 1
    OR (char_length(v_summary.prompt) - char_length(replace(v_summary.prompt, '{{13}}', ''))) / char_length('{{13}}') <> 1
    OR (char_length(v_summary.prompt) - char_length(replace(v_summary.prompt, '{{14}}', ''))) / char_length('{{14}}') <> 1
    OR jsonb_array_length(v_summary.accepted_answers) < 1
    OR jsonb_array_length(v_summary_key.accepted_answers) < 1 THEN
    RAISE EXCEPTION 'IELTS Listening Part 2 requires a configured 13-14 shared summary';
  END IF;

  SELECT count(*) INTO v_activity_count
  FROM public.contest_questions question
  WHERE question.contest_id = NEW.id
    AND question.exam_part_id = v_part.id
    AND question.position BETWEEN 15 AND 18
    AND question.answer_type = 'choice'
    AND jsonb_array_length(question.options) = 3
    AND question.correct_option IS NOT NULL;
  IF v_activity_count <> 4 THEN
    RAISE EXCEPTION 'IELTS Listening Part 2 requires four configured A/B/C activity questions (15-18)';
  END IF;

  SELECT * INTO v_two_answer FROM public.contest_questions
  WHERE contest_id = NEW.id AND exam_part_id = v_part.id AND position = 19;
  SELECT * INTO v_two_answer_key FROM public.contest_questions
  WHERE contest_id = NEW.id AND exam_part_id = v_part.id AND position = 20;
  IF v_two_answer.id IS NULL
    OR v_two_answer_key.id IS NULL
    OR v_two_answer.answer_type <> 'choice'
    OR v_two_answer_key.answer_type <> 'choice'
    OR jsonb_array_length(v_two_answer.options) <> 5
    OR jsonb_array_length(v_two_answer_key.options) <> 5
    OR v_two_answer.correct_option IS NULL
    OR v_two_answer_key.correct_option IS NULL
    OR v_two_answer.correct_option = v_two_answer_key.correct_option THEN
    RAISE EXCEPTION 'IELTS Listening Part 2 requires two different correct answers for questions 19-20';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS validate_ielts_listening_part_two_structured_before_publish ON public.contests;
CREATE TRIGGER validate_ielts_listening_part_two_structured_before_publish
BEFORE UPDATE OF is_published ON public.contests
FOR EACH ROW EXECUTE FUNCTION public.validate_ielts_listening_part_two_structured_before_publish();

REVOKE ALL ON FUNCTION public.clear_contest_answer(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.clear_contest_preview_answer(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clear_contest_answer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_contest_preview_answer(uuid) TO authenticated;
