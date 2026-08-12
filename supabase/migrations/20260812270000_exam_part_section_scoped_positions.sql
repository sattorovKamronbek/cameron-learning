-- CEFR Listening and Reading both have a Part 1, Part 2, etc.  A contest-wide
-- position key made those independent section numbers collide before the part
-- could be created.  Keep positions unique within their own section instead.
ALTER TABLE public.contest_exam_parts
  DROP CONSTRAINT IF EXISTS contest_exam_parts_contest_id_position_key;

ALTER TABLE public.contest_exam_parts
  DROP CONSTRAINT IF EXISTS contest_exam_parts_contest_id_section_position_key;

ALTER TABLE public.contest_exam_parts
  ADD CONSTRAINT contest_exam_parts_contest_id_section_position_key
  UNIQUE (contest_id, section, position);

CREATE INDEX IF NOT EXISTS contest_exam_parts_contest_section_position_idx
  ON public.contest_exam_parts (contest_id, section, position);

NOTIFY pgrst, 'reload schema';
