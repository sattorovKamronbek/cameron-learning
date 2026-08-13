-- IELTS Listening Part 3: two order-independent answer pairs and one flow chart.

CREATE OR REPLACE FUNCTION public.refresh_ielts_shared_two_answer_pair_score(
  p_contest_id uuid,
  p_user_id uuid,
  p_exam_part_id uuid,
  p_first_position integer,
  p_second_position integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_first_key public.contest_questions%ROWTYPE;
  v_second_key public.contest_questions%ROWTYPE;
  v_answer_count integer;
  v_has_first_key boolean;
  v_has_second_key boolean;
  v_pair_correct boolean;
BEGIN
  SELECT * INTO v_first_key FROM public.contest_questions
  WHERE contest_id = p_contest_id AND exam_part_id = p_exam_part_id AND position = p_first_position;
  SELECT * INTO v_second_key FROM public.contest_questions
  WHERE contest_id = p_contest_id AND exam_part_id = p_exam_part_id AND position = p_second_position;
  IF v_first_key.id IS NULL
    OR v_second_key.id IS NULL
    OR v_first_key.correct_option IS NULL
    OR v_second_key.correct_option IS NULL
    OR v_first_key.correct_option = v_second_key.correct_option THEN
    RETURN;
  END IF;

  SELECT count(*),
    coalesce(bool_or(answer.selected_option = v_first_key.correct_option), false),
    coalesce(bool_or(answer.selected_option = v_second_key.correct_option), false)
  INTO v_answer_count, v_has_first_key, v_has_second_key
  FROM public.contest_answers answer
  WHERE answer.contest_id = p_contest_id
    AND answer.user_id = p_user_id
    AND answer.question_id IN (v_first_key.id, v_second_key.id);

  v_pair_correct := v_answer_count = 2 AND v_has_first_key AND v_has_second_key;
  UPDATE public.contest_answers answer
  SET is_correct = v_pair_correct,
      score = CASE
        WHEN v_pair_correct AND answer.question_id = v_first_key.id THEN v_first_key.points
        WHEN v_pair_correct AND answer.question_id = v_second_key.id THEN v_second_key.points
        ELSE 0
      END,
      submitted_at = now()
  WHERE answer.contest_id = p_contest_id
    AND answer.user_id = p_user_id
    AND answer.question_id IN (v_first_key.id, v_second_key.id);
END;
$function$;

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
BEGIN
  SELECT * INTO v_part
  FROM public.contest_exam_parts
  WHERE id = p_exam_part_id AND contest_id = p_contest_id;
  IF NOT FOUND OR v_part.section <> 'listening' THEN
    RETURN;
  END IF;
  IF v_part.position = 2 AND v_part.content = 'IELTS_LISTENING_PART_TWO_STRUCTURED' THEN
    PERFORM public.refresh_ielts_shared_two_answer_pair_score(p_contest_id, p_user_id, p_exam_part_id, 19, 20);
  ELSIF v_part.position = 3 AND v_part.content = 'IELTS_LISTENING_PART_THREE_STRUCTURED' THEN
    PERFORM public.refresh_ielts_shared_two_answer_pair_score(p_contest_id, p_user_id, p_exam_part_id, 21, 22);
    PERFORM public.refresh_ielts_shared_two_answer_pair_score(p_contest_id, p_user_id, p_exam_part_id, 23, 24);
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.prevent_duplicate_ielts_shared_selection()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_question public.contest_questions%ROWTYPE;
  v_part public.contest_exam_parts%ROWTYPE;
  v_group_positions integer[];
BEGIN
  IF NEW.selected_option IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT * INTO v_question FROM public.contest_questions WHERE id = NEW.question_id;
  SELECT * INTO v_part FROM public.contest_exam_parts WHERE id = v_question.exam_part_id;
  IF v_part.section <> 'listening' THEN
    RETURN NEW;
  END IF;

  IF v_part.position = 2 AND v_part.content = 'IELTS_LISTENING_PART_TWO_STRUCTURED' AND v_question.position IN (19, 20) THEN
    v_group_positions := ARRAY[19, 20];
  ELSIF v_part.position = 3 AND v_part.content = 'IELTS_LISTENING_PART_THREE_STRUCTURED' THEN
    IF v_question.position IN (21, 22) THEN
      v_group_positions := ARRAY[21, 22];
    ELSIF v_question.position IN (23, 24) THEN
      v_group_positions := ARRAY[23, 24];
    ELSIF v_question.position BETWEEN 25 AND 30 THEN
      v_group_positions := ARRAY[25, 26, 27, 28, 29, 30];
    END IF;
  END IF;
  IF v_group_positions IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.contest_answers answer
    JOIN public.contest_questions question ON question.id = answer.question_id
    WHERE answer.contest_id = NEW.contest_id
      AND answer.user_id = NEW.user_id
      AND answer.question_id <> NEW.question_id
      AND question.exam_part_id = v_question.exam_part_id
      AND question.position = ANY(v_group_positions)
      AND answer.selected_option = NEW.selected_option
  ) THEN
    RAISE EXCEPTION 'This option has already been selected in this shared question group';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS prevent_duplicate_ielts_shared_selection ON public.contest_answers;
CREATE TRIGGER prevent_duplicate_ielts_shared_selection
BEFORE INSERT OR UPDATE OF selected_option ON public.contest_answers
FOR EACH ROW EXECUTE FUNCTION public.prevent_duplicate_ielts_shared_selection();

CREATE OR REPLACE FUNCTION public.validate_ielts_listening_part_three_structured_before_publish()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_part public.contest_exam_parts%ROWTYPE;
  v_pair_21 public.contest_questions%ROWTYPE;
  v_pair_22 public.contest_questions%ROWTYPE;
  v_pair_23 public.contest_questions%ROWTYPE;
  v_pair_24 public.contest_questions%ROWTYPE;
  v_flow public.contest_questions%ROWTYPE;
  v_flow_count integer;
BEGIN
  IF NOT (NEW.is_published AND NOT OLD.is_published AND NEW.subject = 'ielts') THEN
    RETURN NEW;
  END IF;
  SELECT * INTO v_part FROM public.contest_exam_parts
  WHERE contest_id = NEW.id AND section = 'listening' AND position = 3;
  IF NOT FOUND OR v_part.content <> 'IELTS_LISTENING_PART_THREE_STRUCTURED' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_pair_21 FROM public.contest_questions WHERE contest_id = NEW.id AND exam_part_id = v_part.id AND position = 21;
  SELECT * INTO v_pair_22 FROM public.contest_questions WHERE contest_id = NEW.id AND exam_part_id = v_part.id AND position = 22;
  SELECT * INTO v_pair_23 FROM public.contest_questions WHERE contest_id = NEW.id AND exam_part_id = v_part.id AND position = 23;
  SELECT * INTO v_pair_24 FROM public.contest_questions WHERE contest_id = NEW.id AND exam_part_id = v_part.id AND position = 24;
  IF v_pair_21.id IS NULL OR v_pair_22.id IS NULL OR v_pair_23.id IS NULL OR v_pair_24.id IS NULL
    OR v_pair_21.answer_type <> 'choice' OR v_pair_22.answer_type <> 'choice' OR v_pair_23.answer_type <> 'choice' OR v_pair_24.answer_type <> 'choice'
    OR jsonb_array_length(v_pair_21.options) <> 5 OR jsonb_array_length(v_pair_22.options) <> 5 OR jsonb_array_length(v_pair_23.options) <> 5 OR jsonb_array_length(v_pair_24.options) <> 5
    OR v_pair_21.correct_option IS NULL OR v_pair_22.correct_option IS NULL OR v_pair_23.correct_option IS NULL OR v_pair_24.correct_option IS NULL
    OR v_pair_21.correct_option = v_pair_22.correct_option OR v_pair_23.correct_option = v_pair_24.correct_option THEN
    RAISE EXCEPTION 'IELTS Listening Part 3 requires two configured A-E two-answer pairs (21-22 and 23-24)';
  END IF;

  SELECT * INTO v_flow FROM public.contest_questions WHERE contest_id = NEW.id AND exam_part_id = v_part.id AND position = 25;
  SELECT count(*) INTO v_flow_count
  FROM public.contest_questions question
  WHERE question.contest_id = NEW.id
    AND question.exam_part_id = v_part.id
    AND question.position BETWEEN 25 AND 30
    AND question.answer_type = 'choice'
    AND jsonb_array_length(question.options) = 8
    AND question.correct_option IS NOT NULL;
  IF v_flow.id IS NULL
    OR v_flow_count <> 6
    OR cardinality(regexp_split_to_array(v_flow.prompt, E'\n---\n')) < 8
    OR (char_length(v_flow.prompt) - char_length(replace(v_flow.prompt, '{{25}}', ''))) / char_length('{{25}}') <> 1
    OR (char_length(v_flow.prompt) - char_length(replace(v_flow.prompt, '{{26}}', ''))) / char_length('{{26}}') <> 1
    OR (char_length(v_flow.prompt) - char_length(replace(v_flow.prompt, '{{27}}', ''))) / char_length('{{27}}') <> 1
    OR (char_length(v_flow.prompt) - char_length(replace(v_flow.prompt, '{{28}}', ''))) / char_length('{{28}}') <> 1
    OR (char_length(v_flow.prompt) - char_length(replace(v_flow.prompt, '{{29}}', ''))) / char_length('{{29}}') <> 1
    OR (char_length(v_flow.prompt) - char_length(replace(v_flow.prompt, '{{30}}', ''))) / char_length('{{30}}') <> 1 THEN
    RAISE EXCEPTION 'IELTS Listening Part 3 requires a configured 25-30 flow chart with eight A-H options';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS validate_ielts_listening_part_three_structured_before_publish ON public.contests;
CREATE TRIGGER validate_ielts_listening_part_three_structured_before_publish
BEFORE UPDATE OF is_published ON public.contests
FOR EACH ROW EXECUTE FUNCTION public.validate_ielts_listening_part_three_structured_before_publish();

-- Recalculate both old and newly-configured answer pairs after deployment.
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
      AND ((part.position = 2 AND part.content = 'IELTS_LISTENING_PART_TWO_STRUCTURED' AND question.position IN (19, 20))
        OR (part.position = 3 AND part.content = 'IELTS_LISTENING_PART_THREE_STRUCTURED' AND question.position IN (21, 22, 23, 24)))
  LOOP
    PERFORM public.refresh_ielts_listening_part_two_two_answer_score(v_pair.contest_id, v_pair.user_id, v_pair.exam_part_id);
  END LOOP;
END;
$block$;

REVOKE ALL ON FUNCTION public.refresh_ielts_shared_two_answer_pair_score(uuid, uuid, uuid, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_duplicate_ielts_shared_selection() FROM PUBLIC, anon, authenticated;
