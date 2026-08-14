/*
  Personal Reading notes and highlights.

  These annotations are deliberately separate from answers: they are private
  to the signed-in participant, are never exposed to organizers, and do not
  affect scoring.  A single row holds one user's notes for one Reading part.
*/

CREATE TABLE IF NOT EXISTS public.contest_reading_annotations (
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  exam_part_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 4000),
  highlights jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (
      jsonb_typeof(highlights) = 'array'
      AND jsonb_array_length(highlights) <= 80
      AND octet_length(highlights::text) <= 30000
    ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (exam_part_id, user_id),
  CONSTRAINT contest_reading_annotations_part_contest_fkey
    FOREIGN KEY (exam_part_id, contest_id)
    REFERENCES public.contest_exam_parts (id, contest_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS contest_reading_annotations_contest_user_idx
  ON public.contest_reading_annotations (contest_id, user_id);

ALTER TABLE public.contest_reading_annotations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.contest_reading_annotations FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS contest_reading_annotations_set_updated_at ON public.contest_reading_annotations;
CREATE TRIGGER contest_reading_annotations_set_updated_at
  BEFORE UPDATE ON public.contest_reading_annotations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.save_reading_annotation(
  p_exam_part_id uuid,
  p_note text DEFAULT '',
  p_highlights jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_part public.contest_exam_parts%ROWTYPE;
  v_contest public.contests%ROWTYPE;
  v_note text := trim(coalesce(p_note, ''));
  v_highlights jsonb := coalesce(p_highlights, '[]'::jsonb);
  v_annotation jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.active_profile(auth.uid()) THEN
    RAISE EXCEPTION 'An active account is required to save Reading notes';
  END IF;

  SELECT * INTO v_part
  FROM public.contest_exam_parts
  WHERE id = p_exam_part_id;
  IF NOT FOUND OR v_part.section <> 'reading' THEN
    RAISE EXCEPTION 'Reading part not found';
  END IF;

  SELECT * INTO v_contest
  FROM public.contests
  WHERE id = v_part.contest_id;
  IF NOT FOUND OR v_contest.subject NOT IN ('ielts', 'cefr') THEN
    RAISE EXCEPTION 'Reading notes are available only for IELTS and CEFR exams';
  END IF;

  IF v_contest.is_published THEN
    IF v_contest.archived_at IS NOT NULL
      OR now() < v_contest.start_at
      OR now() >= v_contest.end_at
      OR NOT EXISTS (
        SELECT 1 FROM public.contest_registrations registration
        WHERE registration.contest_id = v_contest.id
          AND registration.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.contest_registrations registration
        WHERE registration.contest_id = v_contest.id
          AND registration.user_id = auth.uid()
          AND registration.completed_at IS NOT NULL
      ) THEN
      RAISE EXCEPTION 'Reading notes are not available for this contest';
    END IF;
    PERFORM public.assert_exam_section_open(v_contest.id, 'reading');
  ELSIF v_contest.archived_at IS NOT NULL OR NOT public.can_manage_contest(v_contest.id) THEN
    RAISE EXCEPTION 'This draft preview is not available';
  END IF;

  IF char_length(v_note) > 4000
    OR jsonb_typeof(v_highlights) <> 'array'
    OR jsonb_array_length(v_highlights) > 80
    OR octet_length(v_highlights::text) > 30000 THEN
    RAISE EXCEPTION 'Invalid Reading annotation data';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_highlights) AS highlight(value)
    WHERE jsonb_typeof(highlight.value) <> 'object'
      OR jsonb_typeof(highlight.value -> 'id') <> 'string'
      OR char_length(coalesce(highlight.value ->> 'id', '')) NOT BETWEEN 1 AND 100
      OR jsonb_typeof(highlight.value -> 'start') <> 'number'
      OR jsonb_typeof(highlight.value -> 'end') <> 'number'
      OR jsonb_typeof(highlight.value -> 'quote') <> 'string'
      OR char_length(trim(coalesce(highlight.value ->> 'quote', ''))) NOT BETWEEN 1 AND 800
      OR CASE
        WHEN coalesce(highlight.value ->> 'start', '') ~ '^[0-9]{1,5}$'
          AND coalesce(highlight.value ->> 'end', '') ~ '^[0-9]{1,5}$'
        THEN (highlight.value ->> 'start')::integer > 50000
          OR (highlight.value ->> 'end')::integer > 50000
          OR (highlight.value ->> 'end')::integer <= (highlight.value ->> 'start')::integer
        ELSE true
      END
  ) THEN
    RAISE EXCEPTION 'Reading highlight anchors are invalid';
  END IF;

  IF v_note = '' AND jsonb_array_length(v_highlights) = 0 THEN
    DELETE FROM public.contest_reading_annotations
    WHERE exam_part_id = v_part.id
      AND user_id = auth.uid();
    RETURN jsonb_build_object(
      'part_id', v_part.id,
      'note', '',
      'highlights', '[]'::jsonb,
      'updated_at', null
    );
  END IF;

  INSERT INTO public.contest_reading_annotations (
    contest_id, exam_part_id, user_id, note, highlights
  ) VALUES (
    v_contest.id, v_part.id, auth.uid(), v_note, v_highlights
  ) ON CONFLICT (exam_part_id, user_id) DO UPDATE
  SET contest_id = excluded.contest_id,
      note = excluded.note,
      highlights = excluded.highlights,
      updated_at = now()
  RETURNING jsonb_build_object(
    'part_id', exam_part_id,
    'note', note,
    'highlights', highlights,
    'updated_at', updated_at
  ) INTO v_annotation;

  IF v_contest.is_published THEN
    UPDATE public.contest_registrations
    SET last_activity_at = now()
    WHERE contest_id = v_contest.id AND user_id = auth.uid();
  END IF;

  RETURN v_annotation;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_reading_annotations(p_contest_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_contest public.contests%ROWTYPE;
  v_annotations jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.active_profile(auth.uid()) THEN
    RAISE EXCEPTION 'An active account is required to view Reading notes';
  END IF;

  SELECT * INTO v_contest
  FROM public.contests
  WHERE id = p_contest_id;
  IF NOT FOUND OR v_contest.subject NOT IN ('ielts', 'cefr') THEN
    RAISE EXCEPTION 'Reading notes are available only for IELTS and CEFR exams';
  END IF;

  IF v_contest.is_published THEN
    IF v_contest.archived_at IS NOT NULL
      OR now() < v_contest.start_at
      OR now() >= v_contest.end_at
      OR NOT EXISTS (
        SELECT 1 FROM public.contest_registrations registration
        WHERE registration.contest_id = v_contest.id
          AND registration.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.contest_registrations registration
        WHERE registration.contest_id = v_contest.id
          AND registration.user_id = auth.uid()
          AND registration.completed_at IS NOT NULL
      ) THEN
      RAISE EXCEPTION 'Reading notes are not available for this contest';
    END IF;
    PERFORM public.assert_exam_section_open(v_contest.id, 'reading');
  ELSIF v_contest.archived_at IS NOT NULL OR NOT public.can_manage_contest(v_contest.id) THEN
    RAISE EXCEPTION 'This draft preview is not available';
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'part_id', annotation.exam_part_id,
    'note', annotation.note,
    'highlights', annotation.highlights,
    'updated_at', annotation.updated_at
  ) ORDER BY part.position), '[]'::jsonb)
  INTO v_annotations
  FROM public.contest_reading_annotations annotation
  JOIN public.contest_exam_parts part
    ON part.id = annotation.exam_part_id
   AND part.contest_id = annotation.contest_id
  WHERE annotation.contest_id = v_contest.id
    AND annotation.user_id = auth.uid()
    AND part.section = 'reading';

  RETURN v_annotations;
END;
$function$;

-- Preview annotations are personal rehearsal data, just like preview answers.
CREATE OR REPLACE FUNCTION public.clear_contest_preview_responses(p_contest_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_contest public.contests%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.active_profile(auth.uid()) THEN
    RAISE EXCEPTION 'An active account is required to clear a preview';
  END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id FOR UPDATE;
  IF NOT FOUND OR v_contest.is_published OR v_contest.archived_at IS NOT NULL
    OR NOT public.can_manage_contest(v_contest.id) THEN
    RAISE EXCEPTION 'This draft preview is not available';
  END IF;

  DELETE FROM public.contest_answers
  WHERE contest_id = v_contest.id AND user_id = auth.uid();
  DELETE FROM public.contest_gap_fill_responses
  WHERE contest_id = v_contest.id AND user_id = auth.uid();
  DELETE FROM public.contest_matching_responses
  WHERE contest_id = v_contest.id AND user_id = auth.uid();
  DELETE FROM public.contest_writing_submissions
  WHERE contest_id = v_contest.id AND user_id = auth.uid();
  DELETE FROM public.contest_reading_annotations
  WHERE contest_id = v_contest.id AND user_id = auth.uid();

  PERFORM public.log_audit_action(
    'contest.preview.clear',
    'contest',
    v_contest.id,
    jsonb_build_object('user_id', auth.uid())
  );
END;
$function$;

-- A draft owner's private rehearsal notes must never carry into the live run.
CREATE OR REPLACE FUNCTION public.clear_unregistered_reading_annotations_on_publish()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF old.is_published IS FALSE AND new.is_published IS TRUE THEN
    DELETE FROM public.contest_reading_annotations annotation
    WHERE annotation.contest_id = new.id
      AND NOT EXISTS (
        SELECT 1 FROM public.contest_registrations registration
        WHERE registration.contest_id = annotation.contest_id
          AND registration.user_id = annotation.user_id
      );
  END IF;
  RETURN new;
END;
$function$;

DROP TRIGGER IF EXISTS contests_clear_unregistered_reading_annotations_on_publish ON public.contests;
CREATE TRIGGER contests_clear_unregistered_reading_annotations_on_publish
  AFTER UPDATE OF is_published ON public.contests
  FOR EACH ROW EXECUTE FUNCTION public.clear_unregistered_reading_annotations_on_publish();

CREATE OR REPLACE FUNCTION public.reopen_contest_after_testing(
  p_contest_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_contest public.contests%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_admin_access(auth.uid()) THEN
    RAISE EXCEPTION 'Only a confirmed administrator can reopen a test contest';
  END IF;
  IF p_start_at IS NULL OR p_end_at IS NULL OR p_start_at <= now() OR p_end_at <= p_start_at THEN
    RAISE EXCEPTION 'Choose a valid future start and end time';
  END IF;

  SELECT * INTO v_contest
  FROM public.contests
  WHERE id = p_contest_id
  FOR UPDATE;

  IF NOT FOUND OR v_contest.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'Contest not found or archived';
  END IF;
  IF v_contest.created_by <> auth.uid() THEN
    RAISE EXCEPTION 'Only the contest creator can reopen this test contest';
  END IF;
  IF v_contest.contest_type <> 'unrated' THEN
    RAISE EXCEPTION 'Rated contests cannot be reopened after testing';
  END IF;
  IF v_contest.start_at > now() THEN
    RAISE EXCEPTION 'This contest already has a future schedule';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.contest_registrations registration
    WHERE registration.contest_id = p_contest_id
      AND registration.user_id <> auth.uid()
  ) OR EXISTS (
    SELECT 1
    FROM public.contest_results result
    WHERE result.contest_id = p_contest_id
      AND result.user_id <> auth.uid()
  ) OR EXISTS (
    SELECT 1
    FROM public.contest_answers answer
    WHERE answer.contest_id = p_contest_id
      AND answer.user_id <> auth.uid()
  ) OR EXISTS (
    SELECT 1
    FROM public.contest_gap_fill_responses response
    WHERE response.contest_id = p_contest_id
      AND response.user_id <> auth.uid()
  ) OR EXISTS (
    SELECT 1
    FROM public.contest_matching_responses response
    WHERE response.contest_id = p_contest_id
      AND response.user_id <> auth.uid()
  ) OR EXISTS (
    SELECT 1
    FROM public.contest_writing_submissions submission
    WHERE submission.contest_id = p_contest_id
      AND submission.user_id <> auth.uid()
  ) OR EXISTS (
    SELECT 1
    FROM public.contest_reading_annotations annotation
    WHERE annotation.contest_id = p_contest_id
      AND annotation.user_id <> auth.uid()
  ) THEN
    RAISE EXCEPTION 'This contest has participant data and cannot be reopened';
  END IF;

  DELETE FROM public.contest_results WHERE contest_id = p_contest_id;
  DELETE FROM public.contest_answers WHERE contest_id = p_contest_id;
  DELETE FROM public.contest_gap_fill_responses WHERE contest_id = p_contest_id;
  DELETE FROM public.contest_matching_responses WHERE contest_id = p_contest_id;
  DELETE FROM public.contest_writing_submissions WHERE contest_id = p_contest_id;
  DELETE FROM public.contest_reading_annotations WHERE contest_id = p_contest_id;
  DELETE FROM public.contest_registrations WHERE contest_id = p_contest_id;

  UPDATE public.contests
  SET start_at = p_start_at,
      end_at = p_end_at,
      is_finalized = false,
      finalized_at = NULL
  WHERE id = p_contest_id;

  PERFORM public.log_audit_action(
    'contest.reopen_after_testing',
    'contest',
    p_contest_id,
    jsonb_build_object(
      'previous_start_at', v_contest.start_at,
      'previous_end_at', v_contest.end_at,
      'next_start_at', p_start_at,
      'next_end_at', p_end_at
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.save_reading_annotation(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_reading_annotations(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_reading_annotation(uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_reading_annotations(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
