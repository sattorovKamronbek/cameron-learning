-- IELTS Listening Part 4 renders questions 31-40 inside one shared note-completion text.

CREATE OR REPLACE FUNCTION public.validate_ielts_listening_part_four_shared_gap_fill_before_publish()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_part public.contest_exam_parts%ROWTYPE;
  v_marker_numbers integer[];
  v_marker_count integer;
  v_question_count integer;
  v_distinct_positions integer;
  v_text_question_count integer;
BEGIN
  IF NOT NEW.is_published OR OLD.is_published OR NEW.subject <> 'ielts' THEN
    RETURN NEW;
  END IF;

  FOR v_part IN
    SELECT *
    FROM public.contest_exam_parts
    WHERE contest_id = NEW.id
      AND section = 'listening'
      AND position = 4
      AND content ~ '\{\{[1-9][0-9]*\}\}'
  LOOP
    SELECT array_agg(DISTINCT (marker.values)[1]::integer ORDER BY (marker.values)[1]::integer), count(*)::integer
    INTO v_marker_numbers, v_marker_count
    FROM regexp_matches(v_part.content, '\{\{([1-9][0-9]*)\}\}', 'g') AS marker(values);

    IF v_marker_count <> 10 OR v_marker_numbers IS DISTINCT FROM ARRAY[31, 32, 33, 34, 35, 36, 37, 38, 39, 40]::integer[] THEN
      RAISE EXCEPTION 'IELTS Listening Part 4 shared gap filling must contain each marker from {{31}} through {{40}} exactly once';
    END IF;

    SELECT
      count(*)::integer,
      count(DISTINCT question.position)::integer,
      count(*) FILTER (WHERE question.answer_type = 'text')::integer
    INTO v_question_count, v_distinct_positions, v_text_question_count
    FROM public.contest_questions question
    WHERE question.exam_part_id = v_part.id
      AND question.position BETWEEN 31 AND 40;

    IF v_question_count <> 10 OR v_distinct_positions <> 10 OR v_text_question_count <> 10 THEN
      RAISE EXCEPTION 'IELTS Listening Part 4 shared gap filling needs ten typed answer keys for questions 31 through 40';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS contests_validate_ielts_listening_part_four_shared_gap_fill_publish ON public.contests;
CREATE TRIGGER contests_validate_ielts_listening_part_four_shared_gap_fill_publish
  BEFORE UPDATE OF is_published
  ON public.contests
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_ielts_listening_part_four_shared_gap_fill_before_publish();

REVOKE ALL ON FUNCTION public.validate_ielts_listening_part_four_shared_gap_fill_before_publish() FROM PUBLIC, anon, authenticated;
