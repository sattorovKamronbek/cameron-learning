-- IELTS Reading Passage 2: headings, one shared summary completion, and a two-letter pair.

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
  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_part.section = 'listening' AND v_part.position = 2
    AND v_part.content = 'IELTS_LISTENING_PART_TWO_STRUCTURED' THEN
    PERFORM public.refresh_ielts_shared_two_answer_pair_score(p_contest_id, p_user_id, p_exam_part_id, 19, 20);
  ELSIF v_part.section = 'listening' AND v_part.position = 3
    AND v_part.content = 'IELTS_LISTENING_PART_THREE_STRUCTURED' THEN
    PERFORM public.refresh_ielts_shared_two_answer_pair_score(p_contest_id, p_user_id, p_exam_part_id, 21, 22);
    PERFORM public.refresh_ielts_shared_two_answer_pair_score(p_contest_id, p_user_id, p_exam_part_id, 23, 24);
  ELSIF v_part.section = 'reading' AND v_part.position = 6
    AND v_part.content LIKE 'IELTS_READING_PASSAGE_TWO_STRUCTURED%' THEN
    PERFORM public.refresh_ielts_shared_two_answer_pair_score(p_contest_id, p_user_id, p_exam_part_id, 65, 66);
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

  IF v_part.section = 'listening' AND v_part.position = 2
    AND v_part.content = 'IELTS_LISTENING_PART_TWO_STRUCTURED' AND v_question.position IN (19, 20) THEN
    v_group_positions := ARRAY[19, 20];
  ELSIF v_part.section = 'listening' AND v_part.position = 3
    AND v_part.content = 'IELTS_LISTENING_PART_THREE_STRUCTURED' THEN
    IF v_question.position IN (21, 22) THEN
      v_group_positions := ARRAY[21, 22];
    ELSIF v_question.position IN (23, 24) THEN
      v_group_positions := ARRAY[23, 24];
    ELSIF v_question.position BETWEEN 25 AND 30 THEN
      v_group_positions := ARRAY[25, 26, 27, 28, 29, 30];
    END IF;
  ELSIF v_part.section = 'reading' AND v_part.position = 6
    AND v_part.content LIKE 'IELTS_READING_PASSAGE_TWO_STRUCTURED%'
    AND v_question.position IN (65, 66) THEN
    v_group_positions := ARRAY[65, 66];
  END IF;
  IF v_group_positions IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.contest_answers AS answer
    JOIN public.contest_questions AS question ON question.id = answer.question_id
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

CREATE OR REPLACE FUNCTION public.validate_ielts_reading_passage_two_structured_before_publish()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_part public.contest_exam_parts%ROWTYPE;
  v_heading_count integer;
  v_gap_count integer;
  v_pair_65 public.contest_questions%ROWTYPE;
  v_pair_66 public.contest_questions%ROWTYPE;
  v_summary public.contest_questions%ROWTYPE;
  v_marker_numbers integer[];
  v_marker_count integer;
BEGIN
  IF NOT NEW.is_published OR OLD.is_published OR NEW.subject <> 'ielts' THEN
    RETURN NEW;
  END IF;
  SELECT * INTO v_part
  FROM public.contest_exam_parts
  WHERE contest_id = NEW.id
    AND section = 'reading'
    AND position = 6;
  IF NOT FOUND OR v_part.content NOT LIKE 'IELTS_READING_PASSAGE_TWO_STRUCTURED%' THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_heading_count
  FROM public.contest_questions AS question
  WHERE question.contest_id = NEW.id
    AND question.exam_part_id = v_part.id
    AND question.position BETWEEN 54 AND 60
    AND question.answer_type = 'choice'
    AND jsonb_array_length(question.options) = 9
    AND question.correct_option IS NOT NULL;
  IF v_heading_count <> 7 THEN
    RAISE EXCEPTION 'IELTS Reading Passage 2 requires seven heading-matching questions (54 through 60) with nine headings';
  END IF;

  SELECT * INTO v_summary
  FROM public.contest_questions
  WHERE contest_id = NEW.id
    AND exam_part_id = v_part.id
    AND position = 61;
  SELECT count(*) INTO v_gap_count
  FROM public.contest_questions AS question
  WHERE question.contest_id = NEW.id
    AND question.exam_part_id = v_part.id
    AND question.position BETWEEN 61 AND 64
    AND question.answer_type = 'text'
    AND question.word_limit = 1;
  IF v_summary.id IS NULL OR v_gap_count <> 4 THEN
    RAISE EXCEPTION 'IELTS Reading Passage 2 requires one-word summary answer keys for questions 61 through 64';
  END IF;
  SELECT array_agg(DISTINCT (marker.values)[1]::integer ORDER BY (marker.values)[1]::integer), count(*)::integer
  INTO v_marker_numbers, v_marker_count
  FROM regexp_matches(v_summary.prompt, '\{\{([1-9][0-9]*)\}\}', 'g') AS marker(values);
  IF v_marker_count <> 4 OR v_marker_numbers IS DISTINCT FROM ARRAY[61, 62, 63, 64]::integer[] THEN
    RAISE EXCEPTION 'IELTS Reading Passage 2 summary must contain each marker from {{61}} through {{64}} exactly once';
  END IF;

  SELECT * INTO v_pair_65
  FROM public.contest_questions
  WHERE contest_id = NEW.id AND exam_part_id = v_part.id AND position = 65;
  SELECT * INTO v_pair_66
  FROM public.contest_questions
  WHERE contest_id = NEW.id AND exam_part_id = v_part.id AND position = 66;
  IF v_pair_65.id IS NULL OR v_pair_66.id IS NULL
    OR v_pair_65.answer_type <> 'choice' OR v_pair_66.answer_type <> 'choice'
    OR jsonb_array_length(v_pair_65.options) <> 5 OR jsonb_array_length(v_pair_66.options) <> 5
    OR v_pair_65.correct_option IS NULL OR v_pair_66.correct_option IS NULL
    OR v_pair_65.correct_option = v_pair_66.correct_option THEN
    RAISE EXCEPTION 'IELTS Reading Passage 2 requires two distinct A-E answer keys for questions 65 and 66';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS validate_ielts_reading_passage_two_structured_before_publish ON public.contests;
CREATE TRIGGER validate_ielts_reading_passage_two_structured_before_publish
  BEFORE UPDATE OF is_published
  ON public.contests
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_ielts_reading_passage_two_structured_before_publish();

REVOKE ALL ON FUNCTION public.refresh_ielts_listening_part_two_two_answer_score(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_duplicate_ielts_shared_selection() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_ielts_reading_passage_two_structured_before_publish() FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
