-- A printed question number is only unique inside its own exam part.
-- For example, Listening 24 and Reading 24 must coexist in one CEFR exam.
-- This removes the stale contest-wide unique key that blocks Reading Parts 4/5.

ALTER TABLE public.contest_questions
  DROP CONSTRAINT IF EXISTS contest_questions_contest_id_position_key;

ALTER TABLE public.contest_questions
  DROP CONSTRAINT IF EXISTS contest_questions_contest_id_exam_part_id_position_key;

ALTER TABLE public.contest_questions
  ADD CONSTRAINT contest_questions_contest_id_exam_part_id_position_key
  UNIQUE (contest_id, exam_part_id, position);

CREATE INDEX IF NOT EXISTS contest_questions_contest_part_position_idx
  ON public.contest_questions (contest_id, exam_part_id, position);

NOTIFY pgrst, 'reload schema';
