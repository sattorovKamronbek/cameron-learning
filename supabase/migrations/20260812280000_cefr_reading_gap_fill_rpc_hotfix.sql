-- Explicit replacement for installations still running the Listening-only
-- answer-key RPC.  It deliberately does not depend on the previous function
-- body, so it fixes old schema-cache/function versions as well.
CREATE OR REPLACE FUNCTION public.save_cefr_gap_fill_answer_keys(
  p_contest_id uuid,
  p_exam_part_id uuid,
  p_answer_keys jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_contest public.contests%ROWTYPE;
  v_part public.contest_exam_parts%ROWTYPE;
  v_marker_numbers integer[];
  v_expected_numbers integer[];
  v_key jsonb;
  v_blank_number integer;
  v_answers jsonb;
  v_points integer;
  v_seen integer[] := ARRAY[]::integer[];
BEGIN
  IF NOT public.can_manage_contest(p_contest_id) THEN
    RAISE EXCEPTION 'Only the owning judge or an admin can manage answer keys';
  END IF;

  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id FOR UPDATE;
  IF NOT FOUND OR v_contest.subject <> 'cefr' THEN RAISE EXCEPTION 'CEFR contest not found'; END IF;
  IF v_contest.is_published OR v_contest.start_at <= now() THEN RAISE EXCEPTION 'Answer keys cannot be changed after publication or start'; END IF;

  SELECT * INTO v_part
  FROM public.contest_exam_parts
  WHERE id = p_exam_part_id AND contest_id = p_contest_id;

  IF NOT FOUND OR NOT (
    (v_part.section = 'listening' AND v_part.position IN (2, 6))
    OR (v_part.section = 'reading' AND v_part.position IN (1, 5))
  ) THEN
    RAISE EXCEPTION 'Gap-fill answer keys are available only for CEFR Listening Parts 2/6 and Reading Parts 1/5';
  END IF;

  v_expected_numbers := CASE
    WHEN v_part.section = 'reading' AND v_part.position = 1 THEN ARRAY[1,2,3,4,5,6]::integer[]
    WHEN v_part.section = 'reading' AND v_part.position = 5 THEN ARRAY[30,31,32,33]::integer[]
    WHEN v_part.position = 2 THEN ARRAY[9,10,11,12,13,14]::integer[]
    ELSE ARRAY[30,31,32,33,34,35]::integer[]
  END;

  IF coalesce(jsonb_typeof(p_answer_keys), '') <> 'array' OR jsonb_array_length(p_answer_keys) <> array_length(v_expected_numbers, 1) THEN
    RAISE EXCEPTION 'Enter one answer key for every required marker';
  END IF;

  SELECT array_agg(DISTINCT (marker.values)[1]::integer ORDER BY (marker.values)[1]::integer)
  INTO v_marker_numbers
  FROM regexp_matches(v_part.content, '\{\{([1-9][0-9]*)\}\}', 'g') marker(values);
  IF v_marker_numbers IS DISTINCT FROM v_expected_numbers THEN
    RAISE EXCEPTION 'CEFR % Part % must use exactly its required question markers', initcap(v_part.section), v_part.position;
  END IF;

  FOR v_key IN SELECT value FROM jsonb_array_elements(p_answer_keys) item(value) LOOP
    IF jsonb_typeof(v_key) <> 'object' OR coalesce(v_key->>'blank_number', '') !~ '^[1-9][0-9]*$' THEN
      RAISE EXCEPTION 'Every answer key needs a valid blank_number';
    END IF;
    v_blank_number := (v_key->>'blank_number')::integer;
    v_answers := v_key->'accepted_answers';
    v_points := coalesce((v_key->>'points')::integer, 1);

    IF v_blank_number <> ALL(v_expected_numbers) OR v_blank_number = ANY(v_seen) THEN
      RAISE EXCEPTION 'Answer keys must cover every required marker exactly once';
    END IF;
    IF coalesce(jsonb_typeof(v_answers), '') <> 'array'
      OR jsonb_array_length(v_answers) NOT BETWEEN 1 AND 8
      OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_answers) answer(value) WHERE jsonb_typeof(answer.value) <> 'string' OR char_length(trim(answer.value #>> '{}')) NOT BETWEEN 1 AND 120) THEN
      RAISE EXCEPTION 'Each blank needs one to eight non-empty accepted answers';
    END IF;
    IF v_points NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Blank points must be between 1 and 1000'; END IF;

    INSERT INTO public.contest_gap_fill_answer_keys (contest_id, exam_part_id, blank_number, accepted_answers, points)
    VALUES (p_contest_id, p_exam_part_id, v_blank_number, v_answers, v_points)
    ON CONFLICT (exam_part_id, blank_number) DO UPDATE
    SET accepted_answers = EXCLUDED.accepted_answers, points = EXCLUDED.points, updated_at = now();
    v_seen := array_append(v_seen, v_blank_number);
  END LOOP;

  DELETE FROM public.contest_gap_fill_answer_keys
  WHERE exam_part_id = p_exam_part_id AND blank_number <> ALL(v_expected_numbers);
  PERFORM public.log_audit_action('contest.gap_fill_keys.save', 'contest', p_contest_id, jsonb_build_object('part_id', p_exam_part_id, 'blank_count', array_length(v_expected_numbers, 1)));
END;
$function$;

REVOKE ALL ON FUNCTION public.save_cefr_gap_fill_answer_keys(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_cefr_gap_fill_answer_keys(uuid, uuid, jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
