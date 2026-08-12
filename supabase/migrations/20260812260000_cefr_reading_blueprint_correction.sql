-- Correct the first Reading blueprint on databases where the previous
-- migration was already recorded.  The same replacements are harmless on a
-- fresh database, where 20260812250000 already contains the corrected code.
DO $migration$
DECLARE v_sql text;
BEGIN
  SELECT pg_get_functiondef('public.save_cefr_gap_fill_answer_keys(uuid,uuid,jsonb)'::regprocedure) INTO v_sql;
  v_sql := replace(v_sql, '(v_part.section = ''reading'' AND v_part.position = 1)', '(v_part.section = ''reading'' AND v_part.position IN (1, 5))');
  v_sql := replace(v_sql, 'CASE WHEN v_part.section = ''reading'' THEN ARRAY[1,2,3,4,5,6,7,8]::integer[] WHEN v_part.position = 2 THEN ARRAY[9,10,11,12,13,14]::integer[] ELSE ARRAY[30,31,32,33,34,35]::integer[] END', 'CASE WHEN v_part.section = ''reading'' AND v_part.position = 1 THEN ARRAY[1,2,3,4,5,6]::integer[] WHEN v_part.section = ''reading'' THEN ARRAY[30,31,32,33]::integer[] WHEN v_part.position = 2 THEN ARRAY[9,10,11,12,13,14]::integer[] ELSE ARRAY[30,31,32,33,34,35]::integer[] END');
  EXECUTE v_sql;

  SELECT pg_get_functiondef('public.save_cefr_gap_fill_response(uuid,integer,text)'::regprocedure) INTO v_sql;
  v_sql := replace(v_sql, '(v_part.section = ''reading'' AND v_part.position = 1)', '(v_part.section = ''reading'' AND v_part.position IN (1, 5))');
  EXECUTE v_sql;

  SELECT pg_get_functiondef('public.save_cefr_matching_config(uuid,uuid,jsonb,jsonb)'::regprocedure) INTO v_sql;
  v_sql := replace(v_sql, '(v_part.section = ''reading'' AND v_part.position IN (2, 4))', '(v_part.section = ''reading'' AND v_part.position IN (2, 3))');
  v_sql := replace(v_sql, 'CASE WHEN v_part.section = ''reading'' AND v_part.position = 2 THEN ARRAY[9,10,11,12,13,14,15,16]::integer[] WHEN v_part.section = ''reading'' THEN ARRAY[25,26,27,28,29,30,31,32]::integer[] WHEN v_part.position = 3 THEN ARRAY[15,16,17,18]::integer[] ELSE ARRAY[19,20,21,22,23]::integer[] END', 'CASE WHEN v_part.section = ''reading'' AND v_part.position = 2 THEN ARRAY[7,8,9,10,11,12,13,14]::integer[] WHEN v_part.section = ''reading'' THEN ARRAY[15,16,17,18,19,20]::integer[] WHEN v_part.position = 3 THEN ARRAY[15,16,17,18]::integer[] ELSE ARRAY[19,20,21,22,23]::integer[] END');
  v_sql := replace(v_sql, 'IF coalesce(jsonb_typeof(p_options), '''') <> ''array'' OR jsonb_array_length(p_options) NOT BETWEEN 2 AND 12 THEN RAISE EXCEPTION ''Add between two and twelve answer-bank options''; END IF;', 'IF coalesce(jsonb_typeof(p_options), '''') <> ''array'' OR jsonb_array_length(p_options) NOT BETWEEN 2 AND 12 THEN RAISE EXCEPTION ''Add between two and twelve answer-bank options''; END IF; IF v_part.section = ''reading'' AND v_part.position = 3 AND jsonb_array_length(p_options) <> 8 THEN RAISE EXCEPTION ''CEFR Reading Part 3 requires six headings plus exactly two extra options''; END IF;');
  EXECUTE v_sql;

  SELECT pg_get_functiondef('public.save_cefr_matching_response(uuid,integer,integer)'::regprocedure) INTO v_sql;
  v_sql := replace(v_sql, '(v_part.section = ''reading'' AND v_part.position IN (2, 4))', '(v_part.section = ''reading'' AND v_part.position IN (2, 3))');
  EXECUTE v_sql;

  SELECT pg_get_functiondef('public.get_contest_editor(uuid)'::regprocedure) INTO v_sql;
  v_sql := replace(v_sql, '(part.section = ''reading'' AND part.position IN (2, 4))', '(part.section = ''reading'' AND part.position IN (2, 3))');
  EXECUTE v_sql;

  SELECT pg_get_functiondef('public.get_contest_workspace(text)'::regprocedure) INTO v_sql;
  v_sql := replace(v_sql, '(part.section = ''reading'' AND part.position IN (2, 4))', '(part.section = ''reading'' AND part.position IN (2, 3))');
  EXECUTE v_sql;
END;
$migration$;

CREATE OR REPLACE FUNCTION public.validate_cefr_reading_question()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $function$
DECLARE v_part public.contest_exam_parts%ROWTYPE; v_subject text;
BEGIN
  IF NEW.exam_part_id IS NULL THEN RETURN NEW; END IF;
  SELECT part.* INTO v_part FROM public.contest_exam_parts part WHERE part.id = NEW.exam_part_id AND part.contest_id = NEW.contest_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  SELECT subject INTO v_subject FROM public.contests WHERE id = NEW.contest_id;
  IF v_subject <> 'cefr' OR v_part.section <> 'reading' THEN RETURN NEW; END IF;
  IF v_part.position = 4 THEN
    IF NEW.position NOT BETWEEN 21 AND 29 OR NEW.correct_option IS NULL THEN RAISE EXCEPTION 'CEFR Reading Part 4 needs answer-keyed questions 21 through 29'; END IF;
    IF NEW.position BETWEEN 21 AND 24 AND jsonb_array_length(NEW.options) <> 4 THEN RAISE EXCEPTION 'CEFR Reading Part 4 questions 21 through 24 require four A/B/C/D options'; END IF;
    IF NEW.position BETWEEN 25 AND 29 AND NEW.options <> jsonb_build_array('True', 'False', 'Not Given') THEN RAISE EXCEPTION 'CEFR Reading Part 4 questions 25 through 29 require True, False, Not Given'; END IF;
  ELSIF v_part.position = 5 AND (NEW.position NOT BETWEEN 34 AND 35 OR NEW.correct_option IS NULL OR jsonb_array_length(NEW.options) <> 4) THEN
    RAISE EXCEPTION 'CEFR Reading Part 5 questions must be 34 and 35 with four A/B/C/D options and an answer key';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_cefr_reading_before_publish()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $function$
DECLARE v_part public.contest_exam_parts%ROWTYPE; v_expected integer[]; v_count integer; v_keys integer;
BEGIN
  IF NOT NEW.is_published OR OLD.is_published OR NEW.subject <> 'cefr' THEN RETURN NEW; END IF;
  IF (SELECT count(*) FROM public.contest_exam_parts WHERE contest_id = NEW.id AND section = 'reading') <> 5 OR EXISTS (SELECT 1 FROM public.contest_exam_parts WHERE contest_id = NEW.id AND section = 'reading' AND position NOT BETWEEN 1 AND 5) THEN RAISE EXCEPTION 'CEFR Reading requires exactly five parts, numbered 1 through 5'; END IF;
  FOR v_part IN SELECT * FROM public.contest_exam_parts WHERE contest_id = NEW.id AND section = 'reading' LOOP
    IF v_part.position = 1 THEN
      IF (SELECT array_agg(DISTINCT (m.values)[1]::integer ORDER BY (m.values)[1]::integer) FROM regexp_matches(v_part.content, '\{\{([1-9][0-9]*)\}\}', 'g') m(values)) IS DISTINCT FROM ARRAY[1,2,3,4,5,6]::integer[] OR (SELECT count(*) FROM public.contest_gap_fill_answer_keys WHERE exam_part_id = v_part.id) <> 6 THEN RAISE EXCEPTION 'CEFR Reading Part 1 needs {{1}} through {{6}} and six answer keys'; END IF;
    ELSIF v_part.position = 2 THEN
      SELECT count(*), count(*) FILTER (WHERE correct_option_position IS NOT NULL) INTO v_count, v_keys FROM public.contest_matching_speakers WHERE exam_part_id = v_part.id;
      IF v_count <> 8 OR v_keys <> 8 THEN RAISE EXCEPTION 'CEFR Reading Part 2 needs Statements 7 through 14 and a Situation key for each'; END IF;
    ELSIF v_part.position = 3 THEN
      SELECT count(*), count(*) FILTER (WHERE correct_option_position IS NOT NULL) INTO v_count, v_keys FROM public.contest_matching_speakers WHERE exam_part_id = v_part.id;
      IF v_count <> 6 OR v_keys <> 6 OR (SELECT count(*) FROM public.contest_matching_options WHERE exam_part_id = v_part.id) <> 8 THEN RAISE EXCEPTION 'CEFR Reading Part 3 needs headings for 15 through 20 plus exactly two extra options'; END IF;
    ELSIF v_part.position = 4 THEN
      SELECT count(*), count(*) FILTER (WHERE correct_option IS NOT NULL) INTO v_count, v_keys FROM public.contest_questions WHERE exam_part_id = v_part.id AND position BETWEEN 21 AND 29;
      IF v_count <> 9 OR v_keys <> 9 THEN RAISE EXCEPTION 'CEFR Reading Part 4 needs questions 21 through 29 and every answer key'; END IF;
    ELSE
      SELECT count(*), count(*) FILTER (WHERE correct_option IS NOT NULL) INTO v_count, v_keys FROM public.contest_questions WHERE exam_part_id = v_part.id AND position IN (34, 35);
      IF (SELECT array_agg(DISTINCT (m.values)[1]::integer ORDER BY (m.values)[1]::integer) FROM regexp_matches(v_part.content, '\{\{([1-9][0-9]*)\}\}', 'g') m(values)) IS DISTINCT FROM ARRAY[30,31,32,33]::integer[] OR (SELECT count(*) FROM public.contest_gap_fill_answer_keys WHERE exam_part_id = v_part.id) <> 4 OR v_count <> 2 OR v_keys <> 2 THEN RAISE EXCEPTION 'CEFR Reading Part 5 needs {{30}} through {{33}} plus A/B/C/D questions 34 and 35'; END IF;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$function$;

-- The CEFR publication gate was introduced before Reading Part 5 contained
-- both answer modes.  Rebind its special-part predicates for already-applied
-- installations as well.
DO $migration$
DECLARE v_sql text;
BEGIN
  SELECT pg_get_functiondef('public.publish_contest(uuid)'::regprocedure) INTO v_sql;
  v_sql := replace(v_sql, '(v_part.section = ''reading'' AND v_part.position = 1)', '(v_part.section = ''reading'' AND v_part.position IN (1, 5))');
  v_sql := replace(v_sql, '(v_part.section = ''reading'' AND v_part.position IN (2, 4))', '(v_part.section = ''reading'' AND v_part.position IN (2, 3))');
  EXECUTE v_sql;
END;
$migration$;

NOTIFY pgrst, 'reload schema';
