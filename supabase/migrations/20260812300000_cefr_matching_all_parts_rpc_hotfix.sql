-- Hotfix for databases still serving the old Listening-only matching RPC.
-- Matching is supported by exactly these CEFR formats:
--   Listening Part 3 (speaker), Listening Part 4 (map)
--   Reading Part 2 (statement → situation), Reading Part 3 (headings)

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
    WHEN v_part.section = 'listening' AND v_part.position = 3 THEN ARRAY[15,16,17,18]::integer[]
    WHEN v_part.section = 'listening' AND v_part.position = 4 THEN ARRAY[19,20,21,22,23]::integer[]
    WHEN v_part.section = 'reading' AND v_part.position = 2 THEN ARRAY[7,8,9,10,11,12,13,14]::integer[]
    ELSE ARRAY[15,16,17,18,19,20]::integer[]
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
      RAISE EXCEPTION 'Every answer-bank option needs its position and text';
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
      RAISE EXCEPTION 'Each entry needs its required number and text; Reading Part 2 statements may use an image instead';
    END IF;

    v_correct_option := CASE
      WHEN v_speaker->'correct_option' IS NULL OR v_speaker->'correct_option' = 'null'::jsonb THEN NULL
      ELSE (v_speaker->>'correct_option')::integer
    END;
    IF v_correct_option IS NULL OR v_correct_option NOT BETWEEN 0 AND jsonb_array_length(p_options) - 1 THEN
      RAISE EXCEPTION 'Select a valid answer key for every entry';
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

CREATE OR REPLACE FUNCTION public.save_cefr_matching_response(
  p_exam_part_id uuid,
  p_speaker_number integer,
  p_option_position integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_part public.contest_exam_parts%ROWTYPE;
  v_contest public.contests%ROWTYPE;
  v_timing public.contest_exam_section_timings%ROWTYPE;
  v_speaker public.contest_matching_speakers%ROWTYPE;
  v_correct boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.active_profile(auth.uid()) THEN RAISE EXCEPTION 'An active account is required to submit'; END IF;
  SELECT * INTO v_part FROM public.contest_exam_parts WHERE id = p_exam_part_id;
  IF NOT FOUND OR NOT (
    (v_part.section = 'listening' AND v_part.position IN (3, 4))
    OR (v_part.section = 'reading' AND v_part.position IN (2, 3))
  ) THEN RAISE EXCEPTION 'CEFR matching part not found'; END IF;

  SELECT * INTO v_contest FROM public.contests WHERE id = v_part.contest_id;
  IF v_contest.subject <> 'cefr' OR NOT v_contest.is_published OR v_contest.archived_at IS NOT NULL OR now() < v_contest.start_at OR now() >= v_contest.end_at THEN RAISE EXCEPTION 'Answers are not accepted for this contest at this time'; END IF;
  IF v_contest.contest_type = 'rated' AND (v_contest.created_by = auth.uid() OR public.has_admin_access(auth.uid())) THEN RAISE EXCEPTION 'Contest managers cannot submit a rated exam'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.contest_registrations registration WHERE registration.contest_id = v_contest.id AND registration.user_id = auth.uid()) THEN RAISE EXCEPTION 'Register for this exam before submitting'; END IF;
  IF EXISTS (SELECT 1 FROM public.contest_registrations registration WHERE registration.contest_id = v_contest.id AND registration.user_id = auth.uid() AND registration.completed_at IS NOT NULL) THEN RAISE EXCEPTION 'This exam has already been submitted'; END IF;

  SELECT * INTO v_timing FROM public.contest_exam_section_timings WHERE contest_id = v_contest.id;
  IF NOT FOUND OR (
    v_part.section = 'listening'
    AND (now() < v_contest.start_at OR now() >= v_contest.start_at + (v_timing.listening_minutes * interval '1 minute'))
  ) OR (
    v_part.section = 'reading'
    AND (now() < v_contest.start_at + (v_timing.listening_minutes * interval '1 minute') OR now() >= v_contest.start_at + ((v_timing.listening_minutes + v_timing.reading_minutes) * interval '1 minute'))
  ) THEN RAISE EXCEPTION 'This exam section is closed'; END IF;

  SELECT * INTO v_speaker FROM public.contest_matching_speakers WHERE exam_part_id = p_exam_part_id AND speaker_number = p_speaker_number;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.contest_matching_options WHERE exam_part_id = p_exam_part_id AND option_position = p_option_position) THEN RAISE EXCEPTION 'Invalid matching item or option'; END IF;
  v_correct := p_option_position = v_speaker.correct_option_position;

  INSERT INTO public.contest_matching_responses (contest_id, exam_part_id, speaker_number, user_id, option_position, is_correct, score)
  VALUES (v_contest.id, p_exam_part_id, p_speaker_number, auth.uid(), p_option_position, v_correct, CASE WHEN v_correct THEN 1 ELSE 0 END)
  ON CONFLICT (exam_part_id, speaker_number, user_id) DO UPDATE
  SET option_position = EXCLUDED.option_position, is_correct = EXCLUDED.is_correct, score = EXCLUDED.score, submitted_at = now();

  UPDATE public.contest_registrations SET last_activity_at = now() WHERE contest_id = v_contest.id AND user_id = auth.uid();
  RETURN jsonb_build_object('saved', true, 'part_id', p_exam_part_id, 'speaker_number', p_speaker_number);
END;
$function$;

REVOKE ALL ON FUNCTION public.save_cefr_matching_config(uuid, uuid, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_cefr_matching_response(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_cefr_matching_config(uuid, uuid, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_cefr_matching_response(uuid, integer, integer) TO authenticated;

NOTIFY pgrst, 'reload schema';
