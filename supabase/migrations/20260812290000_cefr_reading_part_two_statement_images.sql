-- CEFR Reading Part 2 uses statements numbered 7 through 14.  A statement
-- can be shown by an illustration as well as, or instead of, its text.
-- Situations remain text-only entries in the shared answer bank.

ALTER TABLE public.contest_matching_speakers
  ADD COLUMN IF NOT EXISTS image_url text;

DO $migration$
DECLARE
  v_constraint record;
BEGIN
  -- The initial generic matching table required all labels to be non-empty.
  -- Relax that table rule so a Reading Part 2 statement may be image-only.
  FOR v_constraint IN
    SELECT conname AS constraint_name
    FROM pg_constraint
    WHERE conrelid = 'public.contest_matching_speakers'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%label%'
  LOOP
    EXECUTE format('ALTER TABLE public.contest_matching_speakers DROP CONSTRAINT %I', v_constraint.constraint_name);
  END LOOP;
END;
$migration$;

ALTER TABLE public.contest_matching_speakers
  DROP CONSTRAINT IF EXISTS contest_matching_speakers_content_check;

ALTER TABLE public.contest_matching_speakers
  ADD CONSTRAINT contest_matching_speakers_content_check
  CHECK (
    char_length(trim(label)) <= 200
    AND (char_length(trim(label)) > 0 OR image_url IS NOT NULL)
    AND (image_url IS NULL OR char_length(trim(image_url)) BETWEEN 1 AND 2000)
  );

CREATE OR REPLACE FUNCTION public.save_cefr_matching_config(
  p_contest_id uuid,
  p_exam_part_id uuid,
  p_options jsonb,
  p_speakers jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_contest public.contests%ROWTYPE;
  v_part public.contest_exam_parts%ROWTYPE;
  v_option jsonb;
  v_speaker jsonb;
  v_index integer;
  v_speaker_number integer;
  v_correct_option integer;
  v_expected_numbers integer[];
  v_label text;
  v_image_url text;
BEGIN
  IF NOT public.can_manage_contest(p_contest_id) THEN
    RAISE EXCEPTION 'Only the owning judge or an admin can manage matching';
  END IF;

  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id FOR UPDATE;
  IF NOT FOUND OR v_contest.subject <> 'cefr' THEN RAISE EXCEPTION 'CEFR contest not found'; END IF;
  IF v_contest.is_published OR v_contest.start_at <= now() THEN RAISE EXCEPTION 'Matching cannot be changed after publication or start'; END IF;

  SELECT * INTO v_part
  FROM public.contest_exam_parts
  WHERE id = p_exam_part_id AND contest_id = p_contest_id;
  IF NOT FOUND OR NOT (
    (v_part.section = 'listening' AND v_part.position IN (3, 4))
    OR (v_part.section = 'reading' AND v_part.position IN (2, 3))
  ) THEN
    RAISE EXCEPTION 'Matching is available only for CEFR Listening Parts 3/4 and Reading Parts 2/3';
  END IF;

  v_expected_numbers := CASE
    WHEN v_part.section = 'reading' AND v_part.position = 2 THEN ARRAY[7,8,9,10,11,12,13,14]::integer[]
    WHEN v_part.section = 'reading' THEN ARRAY[15,16,17,18,19,20]::integer[]
    WHEN v_part.position = 3 THEN ARRAY[15,16,17,18]::integer[]
    ELSE ARRAY[19,20,21,22,23]::integer[]
  END;

  IF coalesce(jsonb_typeof(p_options), '') <> 'array' OR jsonb_array_length(p_options) NOT BETWEEN 2 AND 12 THEN
    RAISE EXCEPTION 'Add between two and twelve answer-bank options';
  END IF;
  IF v_part.section = 'reading' AND v_part.position = 3 AND jsonb_array_length(p_options) <> 8 THEN
    RAISE EXCEPTION 'CEFR Reading Part 3 requires six headings plus exactly two extra options';
  END IF;
  IF coalesce(jsonb_typeof(p_speakers), '') <> 'array' OR jsonb_array_length(p_speakers) <> array_length(v_expected_numbers, 1) THEN
    RAISE EXCEPTION 'Use every required numbered item for this CEFR part';
  END IF;

  DELETE FROM public.contest_matching_speakers WHERE exam_part_id = p_exam_part_id;
  DELETE FROM public.contest_matching_options WHERE exam_part_id = p_exam_part_id;

  FOR v_index IN 0..jsonb_array_length(p_options) - 1 LOOP
    v_option := p_options -> v_index;
    IF jsonb_typeof(v_option) <> 'object'
      OR coalesce(v_option->>'position', '') !~ '^[0-9]+$'
      OR (v_option->>'position')::integer <> v_index
      OR char_length(trim(coalesce(v_option->>'label', ''))) NOT BETWEEN 1 AND 500 THEN
      RAISE EXCEPTION 'Every Situation / answer-bank option needs its position and text';
    END IF;
    INSERT INTO public.contest_matching_options (contest_id, exam_part_id, option_position, label)
    VALUES (p_contest_id, p_exam_part_id, v_index, trim(v_option->>'label'));
  END LOOP;

  FOR v_index IN 0..jsonb_array_length(p_speakers) - 1 LOOP
    v_speaker := p_speakers -> v_index;
    v_speaker_number := coalesce((v_speaker->>'speaker_number')::integer, -1);
    v_label := trim(coalesce(v_speaker->>'label', ''));
    v_image_url := nullif(trim(coalesce(v_speaker->>'image_url', '')), '');
    IF jsonb_typeof(v_speaker) <> 'object'
      OR v_speaker_number <> v_expected_numbers[v_index + 1]
      OR char_length(v_label) > 200
      OR (v_image_url IS NOT NULL AND char_length(v_image_url) > 2000)
      OR (v_label = '' AND NOT (v_part.section = 'reading' AND v_part.position = 2 AND v_image_url IS NOT NULL)) THEN
      RAISE EXCEPTION 'Every entry needs its required number and text; CEFR Reading Part 2 statements may use an image instead';
    END IF;
    v_correct_option := CASE
      WHEN v_speaker->'correct_option' IS NULL OR v_speaker->'correct_option' = 'null'::jsonb THEN NULL
      ELSE (v_speaker->>'correct_option')::integer
    END;
    IF v_correct_option IS NULL OR v_correct_option NOT BETWEEN 0 AND jsonb_array_length(p_options) - 1 THEN
      RAISE EXCEPTION 'Select a valid Situation answer key for every entry';
    END IF;
    INSERT INTO public.contest_matching_speakers (contest_id, exam_part_id, speaker_number, label, image_url, correct_option_position)
    VALUES (p_contest_id, p_exam_part_id, v_speaker_number, v_label, v_image_url, v_correct_option);
  END LOOP;

  PERFORM public.log_audit_action(
    'contest.matching_config.save',
    'contest',
    p_contest_id,
    jsonb_build_object('part_id', p_exam_part_id, 'entry_count', array_length(v_expected_numbers, 1), 'option_count', jsonb_array_length(p_options))
  );
END;
$function$;

-- Include the statement images for both the admin editor and the participant.
DO $migration$
DECLARE
  v_sql text;
BEGIN
  SELECT pg_get_functiondef('public.get_contest_editor(uuid)'::regprocedure) INTO v_sql;
  v_sql := replace(
    v_sql,
    'jsonb_build_object(''speaker_number'', speaker.speaker_number, ''label'', speaker.label, ''correct_option'', speaker.correct_option_position)',
    'jsonb_build_object(''speaker_number'', speaker.speaker_number, ''label'', speaker.label, ''image_url'', speaker.image_url, ''correct_option'', speaker.correct_option_position)'
  );
  EXECUTE v_sql;

  SELECT pg_get_functiondef('public.get_contest_workspace(text)'::regprocedure) INTO v_sql;
  v_sql := replace(
    v_sql,
    'jsonb_build_object(''speaker_number'', speaker.speaker_number, ''label'', speaker.label)',
    'jsonb_build_object(''speaker_number'', speaker.speaker_number, ''label'', speaker.label, ''image_url'', speaker.image_url)'
  );
  EXECUTE v_sql;
END;
$migration$;

REVOKE ALL ON FUNCTION public.save_cefr_matching_config(uuid, uuid, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_cefr_matching_config(uuid, uuid, jsonb, jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
