-- Questions 19 and 20 are one IELTS two-answer set. The two correct options
-- may be selected in either question slot, so score the pair as a whole.

CREATE OR REPLACE FUNCTION public.refresh_ielts_listening_part_two_two_answer_score(
  p_contest_id uuid,
  p_user_id uuid,
  p_exam_part_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_part public.contest_exam_parts%ROWTYPE;
  v_key_19 public.contest_questions%ROWTYPE;
  v_key_20 public.contest_questions%ROWTYPE;
  v_answer_count integer;
  v_has_key_19 boolean;
  v_has_key_20 boolean;
  v_pair_correct boolean;
BEGIN
  SELECT * INTO v_part
  FROM public.contest_exam_parts
  WHERE id = p_exam_part_id
    AND contest_id = p_contest_id;
  IF NOT FOUND
    OR v_part.section <> 'listening'
    OR v_part.position <> 2
    OR v_part.content <> 'IELTS_LISTENING_PART_TWO_STRUCTURED' THEN
    RETURN;
  END IF;

  SELECT * INTO v_key_19
  FROM public.contest_questions
  WHERE contest_id = p_contest_id
    AND exam_part_id = p_exam_part_id
    AND position = 19;
  SELECT * INTO v_key_20
  FROM public.contest_questions
  WHERE contest_id = p_contest_id
    AND exam_part_id = p_exam_part_id
    AND position = 20;
  IF v_key_19.id IS NULL
    OR v_key_20.id IS NULL
    OR v_key_19.correct_option IS NULL
    OR v_key_20.correct_option IS NULL
    OR v_key_19.correct_option = v_key_20.correct_option THEN
    RETURN;
  END IF;

  SELECT count(*),
    coalesce(bool_or(answer.selected_option = v_key_19.correct_option), false),
    coalesce(bool_or(answer.selected_option = v_key_20.correct_option), false)
  INTO v_answer_count, v_has_key_19, v_has_key_20
  FROM public.contest_answers answer
  WHERE answer.contest_id = p_contest_id
    AND answer.user_id = p_user_id
    AND answer.question_id IN (v_key_19.id, v_key_20.id);

  v_pair_correct := v_answer_count = 2 AND v_has_key_19 AND v_has_key_20;
  UPDATE public.contest_answers answer
  SET is_correct = v_pair_correct,
      score = CASE
        WHEN v_pair_correct AND answer.question_id = v_key_19.id THEN v_key_19.points
        WHEN v_pair_correct AND answer.question_id = v_key_20.id THEN v_key_20.points
        ELSE 0
      END,
      submitted_at = now()
  WHERE answer.contest_id = p_contest_id
    AND answer.user_id = p_user_id
    AND answer.question_id IN (v_key_19.id, v_key_20.id);
END;
$function$;

-- Bring existing preview/attempt answers into line with the order-independent rule.
DO $block$
DECLARE
  v_pair record;
BEGIN
  FOR v_pair IN
    SELECT DISTINCT answer.contest_id, answer.user_id, question.exam_part_id
    FROM public.contest_answers answer
    JOIN public.contest_questions question ON question.id = answer.question_id
    JOIN public.contest_exam_parts part ON part.id = question.exam_part_id
    JOIN public.contests contest ON contest.id = answer.contest_id
    WHERE contest.subject = 'ielts'
      AND part.section = 'listening'
      AND part.position = 2
      AND part.content = 'IELTS_LISTENING_PART_TWO_STRUCTURED'
      AND question.position IN (19, 20)
  LOOP
    PERFORM public.refresh_ielts_listening_part_two_two_answer_score(
      v_pair.contest_id,
      v_pair.user_id,
      v_pair.exam_part_id
    );
  END LOOP;
END;
$block$;

CREATE OR REPLACE FUNCTION public.submit_contest_answer(p_question_id uuid, p_selected_option integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_question public.contest_questions%ROWTYPE;
  v_contest public.contests%ROWTYPE;
  v_section text;
  v_correct boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.active_profile(auth.uid()) THEN RAISE EXCEPTION 'An active account is required to submit'; END IF;
  SELECT * INTO v_question FROM public.contest_questions WHERE id = p_question_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Question not found'; END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = v_question.contest_id;
  IF NOT v_contest.is_published OR v_contest.archived_at IS NOT NULL OR now() < v_contest.start_at OR now() >= v_contest.end_at THEN RAISE EXCEPTION 'Answers are not accepted for this contest at this time'; END IF;
  IF v_contest.contest_type = 'rated' AND (v_contest.created_by = auth.uid() OR public.has_admin_access(auth.uid())) THEN RAISE EXCEPTION 'Contest managers cannot submit answers to a rated contest'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.contest_registrations registration WHERE registration.contest_id = v_contest.id AND registration.user_id = auth.uid()) THEN RAISE EXCEPTION 'Register for this contest before submitting'; END IF;
  IF EXISTS (SELECT 1 FROM public.contest_registrations registration WHERE registration.contest_id = v_contest.id AND registration.user_id = auth.uid() AND registration.completed_at IS NOT NULL) THEN RAISE EXCEPTION 'This contest attempt has already ended'; END IF;
  IF v_contest.subject IN ('ielts', 'cefr') THEN
    SELECT section INTO v_section FROM public.contest_exam_parts WHERE id = v_question.exam_part_id AND contest_id = v_contest.id;
    IF v_section NOT IN ('listening', 'reading') THEN RAISE EXCEPTION 'Question section timing is unavailable'; END IF;
    PERFORM public.assert_exam_section_open(v_contest.id, v_section);
  END IF;
  IF p_selected_option IS NULL OR p_selected_option < 0 OR p_selected_option >= jsonb_array_length(v_question.options) THEN RAISE EXCEPTION 'Invalid answer option'; END IF;
  v_correct := p_selected_option = v_question.correct_option;
  INSERT INTO public.contest_answers (contest_id, question_id, user_id, selected_option, is_correct, score)
  VALUES (v_contest.id, v_question.id, auth.uid(), p_selected_option, v_correct, CASE WHEN v_correct THEN v_question.points ELSE 0 END)
  ON CONFLICT (question_id, user_id) DO UPDATE SET selected_option = EXCLUDED.selected_option, selected_text = NULL, is_correct = EXCLUDED.is_correct, score = EXCLUDED.score, submitted_at = now();
  IF v_contest.subject = 'ielts' THEN
    PERFORM public.refresh_ielts_listening_part_two_two_answer_score(v_contest.id, auth.uid(), v_question.exam_part_id);
  END IF;
  UPDATE public.contest_registrations SET last_activity_at = now() WHERE contest_id = v_contest.id AND user_id = auth.uid();
  RETURN jsonb_build_object('saved', true, 'question_id', p_question_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.save_contest_preview_answer(
  p_question_id uuid,
  p_selected_option integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_question public.contest_questions%ROWTYPE;
  v_contest public.contests%ROWTYPE;
  v_correct boolean;
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
  IF p_selected_option IS NULL OR p_selected_option < 0
    OR p_selected_option >= jsonb_array_length(v_question.options) THEN
    RAISE EXCEPTION 'Invalid answer option';
  END IF;

  v_correct := coalesce(p_selected_option = v_question.correct_option, false);
  INSERT INTO public.contest_answers (
    contest_id, question_id, user_id, selected_option, selected_text, is_correct, score
  ) VALUES (
    v_contest.id, v_question.id, auth.uid(), p_selected_option, null,
    v_correct, CASE WHEN v_correct THEN v_question.points ELSE 0 END
  ) ON CONFLICT (question_id, user_id) DO UPDATE
  SET selected_option = excluded.selected_option,
      selected_text = null,
      is_correct = excluded.is_correct,
      score = excluded.score,
      submitted_at = now();
  IF v_contest.subject = 'ielts' THEN
    PERFORM public.refresh_ielts_listening_part_two_two_answer_score(v_contest.id, auth.uid(), v_question.exam_part_id);
  END IF;
  RETURN jsonb_build_object('saved', true, 'question_id', p_question_id);
END;
$function$;

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
  IF NOT EXISTS (SELECT 1 FROM public.contest_registrations registration WHERE registration.contest_id = v_contest.id AND registration.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Register for this contest before submitting';
  END IF;
  IF EXISTS (SELECT 1 FROM public.contest_registrations registration WHERE registration.contest_id = v_contest.id AND registration.user_id = auth.uid() AND registration.completed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'This contest attempt has already ended';
  END IF;
  IF v_contest.subject IN ('ielts', 'cefr') THEN
    SELECT section INTO v_section FROM public.contest_exam_parts WHERE id = v_question.exam_part_id AND contest_id = v_contest.id;
    IF v_section NOT IN ('listening', 'reading') THEN
      RAISE EXCEPTION 'Question section timing is unavailable';
    END IF;
    PERFORM public.assert_exam_section_open(v_contest.id, v_section);
  END IF;

  DELETE FROM public.contest_answers
  WHERE question_id = v_question.id AND user_id = auth.uid();
  IF v_contest.subject = 'ielts' THEN
    PERFORM public.refresh_ielts_listening_part_two_two_answer_score(v_contest.id, auth.uid(), v_question.exam_part_id);
  END IF;
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
  IF v_contest.subject = 'ielts' THEN
    PERFORM public.refresh_ielts_listening_part_two_two_answer_score(v_contest.id, auth.uid(), v_question.exam_part_id);
  END IF;
  RETURN jsonb_build_object('saved', true, 'cleared', true, 'question_id', p_question_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.refresh_ielts_listening_part_two_two_answer_score(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
