-- CEFR Listening Part 5 is deliberately a fixed structure:
-- three extracts, two objective questions for each extract.
-- The question position is the stable extract mapping:
--   1-2 => Extract 1, 3-4 => Extract 2, 5-6 => Extract 3.

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

  SELECT part.*
    INTO v_part
  FROM public.contest_exam_parts part
  WHERE part.id = NEW.exam_part_id
    AND part.contest_id = NEW.contest_id;

  IF FOUND THEN
    SELECT contest.subject
      INTO v_subject
    FROM public.contests contest
    WHERE contest.id = NEW.contest_id;
  END IF;

  IF FOUND AND v_subject = 'cefr' AND v_part.section = 'listening' AND v_part.position = 5 THEN
    IF NEW.position NOT BETWEEN 1 AND 6 THEN
      RAISE EXCEPTION 'CEFR Listening Part 5 question numbers must be between 1 and 6';
    END IF;
    IF NEW.correct_option IS NULL THEN
      RAISE EXCEPTION 'Every CEFR Listening Part 5 question needs an answer key';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM public.contest_questions question
      WHERE question.contest_id = NEW.contest_id
        AND question.exam_part_id = NEW.exam_part_id
        AND question.position = NEW.position
        AND question.id <> NEW.id
    ) THEN
      RAISE EXCEPTION 'Each CEFR Listening Part 5 question number can be used only once';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contest_questions_validate_cefr_part_five ON public.contest_questions;
CREATE TRIGGER contest_questions_validate_cefr_part_five
  BEFORE INSERT OR UPDATE OF contest_id, exam_part_id, position, correct_option
  ON public.contest_questions
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_cefr_part_five_question();

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
    SELECT 1
    FROM public.contest_exam_parts part
    WHERE part.contest_id = NEW.id
      AND part.position = 5
      AND part.section <> 'listening'
  ) THEN
    RAISE EXCEPTION 'CEFR Part 5 must be a Listening part';
  END IF;

  FOR v_part IN
    SELECT *
    FROM public.contest_exam_parts
    WHERE contest_id = NEW.id
      AND section = 'listening'
      AND position = 5
  LOOP
    SELECT
      count(*)::integer,
      count(DISTINCT question.position)::integer,
      count(*) FILTER (WHERE question.correct_option IS NOT NULL)::integer
    INTO v_question_count, v_distinct_positions, v_key_count
    FROM public.contest_questions question
    WHERE question.contest_id = NEW.id
      AND question.exam_part_id = v_part.id
      AND question.position BETWEEN 1 AND 6;

    IF v_question_count <> 6 OR v_distinct_positions <> 6 OR v_key_count <> 6 THEN
      RAISE EXCEPTION 'CEFR Listening Part 5 needs exactly 3 extracts × 2 questions, numbered 1 through 6, with every answer key selected';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contests_validate_cefr_part_five_publish ON public.contests;
CREATE TRIGGER contests_validate_cefr_part_five_publish
  BEFORE UPDATE OF is_published
  ON public.contests
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_cefr_part_five_before_publish();

REVOKE ALL ON FUNCTION public.validate_cefr_part_five_question() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_cefr_part_five_before_publish() FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
