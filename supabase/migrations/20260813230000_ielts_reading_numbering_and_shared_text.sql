-- IELTS Reading uses the global question numbering 41 through 80.
-- Passage 1 can render questions 48-53 in one shared inline-completion text.

CREATE OR REPLACE FUNCTION public.validate_ielts_reading_numbering_and_shared_text_before_publish()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_part public.contest_exam_parts%ROWTYPE;
  v_part_position integer;
  v_expected_from integer;
  v_expected_to integer;
  v_question_count integer;
  v_distinct_positions integer;
  v_in_range_count integer;
  v_marker_numbers integer[];
  v_marker_count integer;
  v_shared_text_question_count integer;
BEGIN
  IF NOT NEW.is_published OR OLD.is_published OR NEW.subject <> 'ielts' THEN
    RETURN NEW;
  END IF;

  FOR v_part_position, v_expected_from, v_expected_to IN
    SELECT part_position, from_position, to_position
    FROM (VALUES (5, 41, 53), (6, 54, 66), (7, 67, 80)) AS expected(part_position, from_position, to_position)
  LOOP
    SELECT * INTO v_part
    FROM public.contest_exam_parts
    WHERE contest_id = NEW.id
      AND section = 'reading'
      AND position = v_part_position;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'IELTS Reading Passage % is required', v_part_position - 4;
    END IF;

    SELECT
      count(*)::integer,
      count(DISTINCT question.position)::integer,
      count(*) FILTER (WHERE question.position BETWEEN v_expected_from AND v_expected_to)::integer
    INTO v_question_count, v_distinct_positions, v_in_range_count
    FROM public.contest_questions AS question
    WHERE question.exam_part_id = v_part.id;

    IF v_question_count <> v_expected_to - v_expected_from + 1
      OR v_distinct_positions <> v_expected_to - v_expected_from + 1
      OR v_in_range_count <> v_expected_to - v_expected_from + 1 THEN
      RAISE EXCEPTION 'IELTS Reading Passage % must contain exactly one question for every position from % through %', v_part.position - 4, v_expected_from, v_expected_to;
    END IF;
  END LOOP;

  SELECT * INTO v_part
  FROM public.contest_exam_parts
  WHERE contest_id = NEW.id
    AND section = 'reading'
    AND position = 5
    AND content ~ '\{\{[1-9][0-9]*\}\}'
  LIMIT 1;

  IF FOUND THEN
    SELECT array_agg(DISTINCT (marker.values)[1]::integer ORDER BY (marker.values)[1]::integer), count(*)::integer
    INTO v_marker_numbers, v_marker_count
    FROM regexp_matches(v_part.content, '\{\{([1-9][0-9]*)\}\}', 'g') AS marker(values);

    IF v_marker_count <> 6 OR v_marker_numbers IS DISTINCT FROM ARRAY[48, 49, 50, 51, 52, 53]::integer[] THEN
      RAISE EXCEPTION 'IELTS Reading Passage 1 shared text must contain each marker from {{48}} through {{53}} exactly once';
    END IF;

    SELECT count(*)::integer
    INTO v_shared_text_question_count
    FROM public.contest_questions AS question
    WHERE question.exam_part_id = v_part.id
      AND question.position BETWEEN 48 AND 53
      AND question.answer_type = 'text';

    IF v_shared_text_question_count <> 6 THEN
      RAISE EXCEPTION 'IELTS Reading Passage 1 shared text needs six typed answer keys for questions 48 through 53';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS contests_validate_ielts_reading_numbering_and_shared_text_publish ON public.contests;
CREATE TRIGGER contests_validate_ielts_reading_numbering_and_shared_text_publish
  BEFORE UPDATE OF is_published
  ON public.contests
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_ielts_reading_numbering_and_shared_text_before_publish();

REVOKE ALL ON FUNCTION public.validate_ielts_reading_numbering_and_shared_text_before_publish() FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
