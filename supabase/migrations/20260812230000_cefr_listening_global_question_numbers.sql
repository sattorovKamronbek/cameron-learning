/*
  CEFR Listening global question-number hotfix

  This deliberately replaces the functions used by the already-installed
  Part 5 trigger. It is safe to run even if the broader IELTS migration has
  not been applied yet.
*/

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

  SELECT part.* INTO v_part
  FROM public.contest_exam_parts part
  WHERE part.id = NEW.exam_part_id AND part.contest_id = NEW.contest_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT contest.subject INTO v_subject
  FROM public.contests contest
  WHERE contest.id = NEW.contest_id;

  IF v_subject = 'cefr' AND v_part.section = 'listening' AND v_part.position = 1
    AND NEW.position NOT BETWEEN 1 AND 8 THEN
    RAISE EXCEPTION 'CEFR Listening Part 1 question numbers must be between 1 and 8';
  END IF;

  IF v_subject = 'cefr' AND v_part.section = 'listening' AND v_part.position = 5 THEN
    IF NEW.position NOT BETWEEN 24 AND 29 THEN
      RAISE EXCEPTION 'CEFR Listening Part 5 question numbers must be between 24 and 29';
    END IF;
    IF NEW.correct_option IS NULL THEN
      RAISE EXCEPTION 'Every CEFR Listening Part 5 question needs an answer key';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

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

  FOR v_part IN
    SELECT * FROM public.contest_exam_parts
    WHERE contest_id = NEW.id AND section = 'listening' AND position = 5
  LOOP
    SELECT
      count(*)::integer,
      count(DISTINCT question.position)::integer,
      count(*) FILTER (WHERE question.correct_option IS NOT NULL)::integer
    INTO v_question_count, v_distinct_positions, v_key_count
    FROM public.contest_questions question
    WHERE question.contest_id = NEW.id
      AND question.exam_part_id = v_part.id
      AND question.position BETWEEN 24 AND 29;

    IF v_question_count <> 6 OR v_distinct_positions <> 6 OR v_key_count <> 6 THEN
      RAISE EXCEPTION 'CEFR Listening Part 5 needs exactly 3 extracts × 2 questions, numbered 24 through 29, with every answer key selected';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Rebind both triggers explicitly. This makes the hotfix effective even on a
-- project that already has the old 1–6 trigger installed.
DROP TRIGGER IF EXISTS contest_questions_validate_cefr_part_five ON public.contest_questions;
CREATE TRIGGER contest_questions_validate_cefr_part_five
  BEFORE INSERT OR UPDATE OF contest_id, exam_part_id, position, correct_option
  ON public.contest_questions
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_cefr_part_five_question();

DROP TRIGGER IF EXISTS contests_validate_cefr_part_five_publish ON public.contests;
CREATE TRIGGER contests_validate_cefr_part_five_publish
  BEFORE UPDATE OF is_published
  ON public.contests
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_cefr_part_five_before_publish();

REVOKE ALL ON FUNCTION public.validate_cefr_part_five_question() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_cefr_part_five_before_publish() FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
