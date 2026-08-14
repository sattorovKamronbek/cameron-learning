/*
  IELTS Reading has its own 1–40 question sequence.

  Listening already uses 1–40. Positions are unique per exam part, so the two
  sections can display the same number without colliding. This migration also
  upgrades existing 41–80 Reading drafts and their inline-answer markers.
*/

LOCK TABLE public.contests, public.contest_exam_parts, public.contest_questions, public.contest_answers IN SHARE ROW EXCLUSIVE MODE;

DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.contest_questions AS legacy_question
    JOIN public.contest_exam_parts AS part
      ON part.id = legacy_question.exam_part_id
    JOIN public.contests AS contest
      ON contest.id = part.contest_id
    JOIN public.contest_questions AS local_question
      ON local_question.exam_part_id = legacy_question.exam_part_id
      AND local_question.position = legacy_question.position - 40
      AND local_question.id <> legacy_question.id
    WHERE legacy_question.contest_id = contest.id
      AND contest.subject = 'ielts'
      AND part.section = 'reading'
      AND (
        (part.position = 5 AND legacy_question.position BETWEEN 41 AND 53)
        OR (part.position = 6 AND legacy_question.position BETWEEN 54 AND 66)
        OR (part.position = 7 AND legacy_question.position BETWEEN 67 AND 80)
      )
  ) THEN
    RAISE EXCEPTION 'Cannot normalize IELTS Reading numbering because a local Reading question already uses the target position';
  END IF;
END;
$migration$;

UPDATE public.contest_exam_parts AS part
SET content = replace(
      replace(
        replace(
          replace(
            replace(
              replace(part.content, '{{48}}', '{{8}}'),
            '{{49}}', '{{9}}'),
          '{{50}}', '{{10}}'),
        '{{51}}', '{{11}}'),
      '{{52}}', '{{12}}'),
    '{{53}}', '{{13}}'),
    instructions = replace(
      replace(part.instructions, 'Questions 41–53', 'Questions 1–13'),
      'Questions 41-53', 'Questions 1-13'
    )
FROM public.contests AS contest
WHERE contest.id = part.contest_id
  AND contest.subject = 'ielts'
  AND part.section = 'reading'
  AND part.position = 5;

UPDATE public.contest_exam_parts AS part
SET instructions = replace(
      replace(part.instructions, 'Questions 54–66', 'Questions 14–26'),
      'Questions 54-66', 'Questions 14-26'
    )
FROM public.contests AS contest
WHERE contest.id = part.contest_id
  AND contest.subject = 'ielts'
  AND part.section = 'reading'
  AND part.position = 6;

UPDATE public.contest_exam_parts AS part
SET instructions = replace(
      replace(part.instructions, 'Questions 67–80', 'Questions 27–40'),
      'Questions 67-80', 'Questions 27-40'
    )
FROM public.contests AS contest
WHERE contest.id = part.contest_id
  AND contest.subject = 'ielts'
  AND part.section = 'reading'
  AND part.position = 7;

UPDATE public.contest_questions AS question
SET prompt = replace(
      replace(
        replace(
          replace(
            replace(
              replace(question.prompt, '{{48}}', '{{8}}'),
            '{{49}}', '{{9}}'),
          '{{50}}', '{{10}}'),
        '{{51}}', '{{11}}'),
      '{{52}}', '{{12}}'),
    '{{53}}', '{{13}}')
FROM public.contest_exam_parts AS part
JOIN public.contests AS contest ON contest.id = part.contest_id
WHERE question.contest_id = contest.id
  AND question.exam_part_id = part.id
  AND contest.subject = 'ielts'
  AND part.section = 'reading'
  AND part.position = 5;

UPDATE public.contest_questions AS question
SET prompt = replace(
      replace(
        replace(
          replace(
            replace(
              replace(question.prompt, '{{61}}', '{{21}}'),
            '{{62}}', '{{22}}'),
          '{{63}}', '{{23}}'),
        '{{64}}', '{{24}}'),
      '{{65}}', '{{25}}'),
    '{{66}}', '{{26}}')
FROM public.contest_exam_parts AS part
JOIN public.contests AS contest ON contest.id = part.contest_id
WHERE question.contest_id = contest.id
  AND question.exam_part_id = part.id
  AND contest.subject = 'ielts'
  AND part.section = 'reading'
  AND part.position = 6;

UPDATE public.contest_questions AS question
SET prompt = replace(
      replace(
        replace(question.prompt, '{{72}}', '{{32}}'),
      '{{73}}', '{{33}}'),
    '{{74}}', '{{34}}')
FROM public.contest_exam_parts AS part
JOIN public.contests AS contest ON contest.id = part.contest_id
WHERE question.contest_id = contest.id
  AND question.exam_part_id = part.id
  AND contest.subject = 'ielts'
  AND part.section = 'reading'
  AND part.position = 7;

UPDATE public.contest_questions AS question
SET position = question.position - 40
FROM public.contest_exam_parts AS part
JOIN public.contests AS contest ON contest.id = part.contest_id
WHERE question.contest_id = contest.id
  AND question.exam_part_id = part.id
  AND contest.subject = 'ielts'
  AND part.section = 'reading'
  AND (
    (part.position = 5 AND question.position BETWEEN 41 AND 53)
    OR (part.position = 6 AND question.position BETWEEN 54 AND 66)
    OR (part.position = 7 AND question.position BETWEEN 67 AND 80)
  );

CREATE OR REPLACE FUNCTION public.validate_ielts_reading_numbering_and_shared_text_before_publish()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_part public.contest_exam_parts%ROWTYPE;
  v_part_position integer;
  v_expected_from integer;
  v_expected_to integer;
  v_question_count integer;
  v_distinct_positions integer;
  v_in_range_count integer;
  v_marker_numbers integer[];
  v_marker_count integer;
  v_shared_text_question_count integer;
BEGIN
  IF NOT NEW.is_published OR OLD.is_published OR NEW.subject <> 'ielts' THEN
    RETURN NEW;
  END IF;

  FOR v_part_position, v_expected_from, v_expected_to IN
    SELECT part_position, from_position, to_position
    FROM (VALUES (5, 1, 13), (6, 14, 26), (7, 27, 40)) AS expected(part_position, from_position, to_position)
  LOOP
    SELECT * INTO v_part
    FROM public.contest_exam_parts
    WHERE contest_id = NEW.id
      AND section = 'reading'
      AND position = v_part_position;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'IELTS Reading Passage % is required', v_part_position - 4;
    END IF;

    SELECT
      count(*)::integer,
      count(DISTINCT question.position)::integer,
      count(*) FILTER (WHERE question.position BETWEEN v_expected_from AND v_expected_to)::integer
    INTO v_question_count, v_distinct_positions, v_in_range_count
    FROM public.contest_questions AS question
    WHERE question.exam_part_id = v_part.id;

    IF v_question_count <> v_expected_to - v_expected_from + 1
      OR v_distinct_positions <> v_expected_to - v_expected_from + 1
      OR v_in_range_count <> v_expected_to - v_expected_from + 1 THEN
      RAISE EXCEPTION 'IELTS Reading Passage % must contain exactly one question for every position from % through %', v_part.position - 4, v_expected_from, v_expected_to;
    END IF;
  END LOOP;

  SELECT * INTO v_part
  FROM public.contest_exam_parts
  WHERE contest_id = NEW.id
    AND section = 'reading'
    AND position = 5
    AND content ~ '\{\{[1-9][0-9]*\}\}'
  LIMIT 1;

  IF FOUND THEN
    SELECT array_agg(DISTINCT (marker.values)[1]::integer ORDER BY (marker.values)[1]::integer), count(*)::integer
    INTO v_marker_numbers, v_marker_count
    FROM regexp_matches(v_part.content, '\{\{([1-9][0-9]*)\}\}', 'g') AS marker(values);

    IF v_marker_count <> 6 OR v_marker_numbers IS DISTINCT FROM ARRAY[8, 9, 10, 11, 12, 13]::integer[] THEN
      RAISE EXCEPTION 'IELTS Reading Passage 1 shared text must contain each marker from {{8}} through {{13}} exactly once';
    END IF;

    SELECT count(*)::integer
    INTO v_shared_text_question_count
    FROM public.contest_questions AS question
    WHERE question.exam_part_id = v_part.id
      AND question.position BETWEEN 8 AND 13
      AND question.answer_type = 'text';

    IF v_shared_text_question_count <> 6 THEN
      RAISE EXCEPTION 'IELTS Reading Passage 1 shared text needs six typed answer keys for questions 8 through 13';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_ielts_listening_part_two_two_answer_score(
  p_contest_id uuid,
  p_user_id uuid,
  p_exam_part_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_part public.contest_exam_parts%ROWTYPE;
BEGIN
  SELECT * INTO v_part
  FROM public.contest_exam_parts
  WHERE id = p_exam_part_id AND contest_id = p_contest_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_part.section = 'listening' AND v_part.position = 2
    AND v_part.content = 'IELTS_LISTENING_PART_TWO_STRUCTURED' THEN
    PERFORM public.refresh_ielts_shared_two_answer_pair_score(p_contest_id, p_user_id, p_exam_part_id, 19, 20);
  ELSIF v_part.section = 'listening' AND v_part.position = 3
    AND v_part.content = 'IELTS_LISTENING_PART_THREE_STRUCTURED' THEN
    PERFORM public.refresh_ielts_shared_two_answer_pair_score(p_contest_id, p_user_id, p_exam_part_id, 21, 22);
    PERFORM public.refresh_ielts_shared_two_answer_pair_score(p_contest_id, p_user_id, p_exam_part_id, 23, 24);
  ELSIF v_part.section = 'reading' AND v_part.position = 6
    AND v_part.content LIKE 'IELTS_READING_PASSAGE_TWO_STRUCTURED%' THEN
    PERFORM public.refresh_ielts_shared_two_answer_pair_score(p_contest_id, p_user_id, p_exam_part_id, 25, 26);
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.prevent_duplicate_ielts_shared_selection()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_question public.contest_questions%ROWTYPE;
  v_part public.contest_exam_parts%ROWTYPE;
  v_group_positions integer[];
BEGIN
  IF NEW.selected_option IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT * INTO v_question FROM public.contest_questions WHERE id = NEW.question_id;
  SELECT * INTO v_part FROM public.contest_exam_parts WHERE id = v_question.exam_part_id;

  IF v_part.section = 'listening' AND v_part.position = 2
    AND v_part.content = 'IELTS_LISTENING_PART_TWO_STRUCTURED' AND v_question.position IN (19, 20) THEN
    v_group_positions := ARRAY[19, 20];
  ELSIF v_part.section = 'listening' AND v_part.position = 3
    AND v_part.content = 'IELTS_LISTENING_PART_THREE_STRUCTURED' THEN
    IF v_question.position IN (21, 22) THEN
      v_group_positions := ARRAY[21, 22];
    ELSIF v_question.position IN (23, 24) THEN
      v_group_positions := ARRAY[23, 24];
    ELSIF v_question.position BETWEEN 25 AND 30 THEN
      v_group_positions := ARRAY[25, 26, 27, 28, 29, 30];
    END IF;
  ELSIF v_part.section = 'reading' AND v_part.position = 6
    AND v_part.content LIKE 'IELTS_READING_PASSAGE_TWO_STRUCTURED%'
    AND v_question.position IN (25, 26) THEN
    v_group_positions := ARRAY[25, 26];
  END IF;
  IF v_group_positions IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.contest_answers AS answer
    JOIN public.contest_questions AS question ON question.id = answer.question_id
    WHERE answer.contest_id = NEW.contest_id
      AND answer.user_id = NEW.user_id
      AND answer.question_id <> NEW.question_id
      AND question.exam_part_id = v_question.exam_part_id
      AND question.position = ANY(v_group_positions)
      AND answer.selected_option = NEW.selected_option
  ) THEN
    RAISE EXCEPTION 'This option has already been selected in this shared question group';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_ielts_reading_passage_two_structured_before_publish()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_part public.contest_exam_parts%ROWTYPE;
  v_heading_count integer;
  v_gap_count integer;
  v_pair_25 public.contest_questions%ROWTYPE;
  v_pair_26 public.contest_questions%ROWTYPE;
  v_summary public.contest_questions%ROWTYPE;
  v_marker_numbers integer[];
  v_marker_count integer;
BEGIN
  IF NOT NEW.is_published OR OLD.is_published OR NEW.subject <> 'ielts' THEN
    RETURN NEW;
  END IF;
  SELECT * INTO v_part
  FROM public.contest_exam_parts
  WHERE contest_id = NEW.id
    AND section = 'reading'
    AND position = 6;
  IF NOT FOUND OR v_part.content NOT LIKE 'IELTS_READING_PASSAGE_TWO_STRUCTURED%' THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_heading_count
  FROM public.contest_questions AS question
  WHERE question.contest_id = NEW.id
    AND question.exam_part_id = v_part.id
    AND question.position BETWEEN 14 AND 20
    AND question.answer_type = 'choice'
    AND jsonb_array_length(question.options) = 9
    AND question.correct_option IS NOT NULL;
  IF v_heading_count <> 7 THEN
    RAISE EXCEPTION 'IELTS Reading Passage 2 requires seven heading-matching questions (14 through 20) with nine headings';
  END IF;

  SELECT * INTO v_summary
  FROM public.contest_questions
  WHERE contest_id = NEW.id
    AND exam_part_id = v_part.id
    AND position = 21;
  SELECT count(*) INTO v_gap_count
  FROM public.contest_questions AS question
  WHERE question.contest_id = NEW.id
    AND question.exam_part_id = v_part.id
    AND question.position BETWEEN 21 AND 24
    AND question.answer_type = 'text'
    AND question.word_limit = 1;
  IF v_summary.id IS NULL OR v_gap_count <> 4 THEN
    RAISE EXCEPTION 'IELTS Reading Passage 2 requires one-word summary answer keys for questions 21 through 24';
  END IF;
  SELECT array_agg(DISTINCT (marker.values)[1]::integer ORDER BY (marker.values)[1]::integer), count(*)::integer
  INTO v_marker_numbers, v_marker_count
  FROM regexp_matches(v_summary.prompt, '\{\{([1-9][0-9]*)\}\}', 'g') AS marker(values);
  IF v_marker_count <> 4 OR v_marker_numbers IS DISTINCT FROM ARRAY[21, 22, 23, 24]::integer[] THEN
    RAISE EXCEPTION 'IELTS Reading Passage 2 summary must contain each marker from {{21}} through {{24}} exactly once';
  END IF;

  SELECT * INTO v_pair_25
  FROM public.contest_questions
  WHERE contest_id = NEW.id AND exam_part_id = v_part.id AND position = 25;
  SELECT * INTO v_pair_26
  FROM public.contest_questions
  WHERE contest_id = NEW.id AND exam_part_id = v_part.id AND position = 26;
  IF v_pair_25.id IS NULL OR v_pair_26.id IS NULL
    OR v_pair_25.answer_type <> 'choice' OR v_pair_26.answer_type <> 'choice'
    OR jsonb_array_length(v_pair_25.options) <> 5 OR jsonb_array_length(v_pair_26.options) <> 5
    OR v_pair_25.correct_option IS NULL OR v_pair_26.correct_option IS NULL
    OR v_pair_25.correct_option = v_pair_26.correct_option THEN
    RAISE EXCEPTION 'IELTS Reading Passage 2 requires two distinct A-E answer keys for questions 25 and 26';
  END IF;
  RETURN NEW;
END;
$function$;

-- IELTS Reading Passage 3 can render three structured blocks:
-- 27-31 True / False / Not Given, 32-34 shared summary completion, and
-- 35-37 an A-F answer bank plus 38-40 paragraph-letter answers A-H.

-- Earlier drafts used one nine-choice heading bank across questions 35-40.
-- It cannot be converted safely to the split A-F / A-H format because the
-- paragraph prompts and their A-H answer keys do not exist in that layout.
-- Keep those drafts intact; the participant renderer retains a narrow legacy
-- fallback and managers can reconfigure unpublished content explicitly.
/* The retired one-bank conversion is deliberately retained below as history.
-- The original Passage 3 draft builder used the Passage 2 i-ix heading
-- format by mistake.  Reduce only safe, unpublished draft banks here.  A
-- bank is converted when all six questions use the compatible legacy layout
-- and every answer key and saved draft response fits in the retained A-F
-- choices.  This keeps both answer keys and preview responses semantically
-- unchanged.  Incomplete or ambiguous drafts are deliberately left as-is;
-- the publish validator below tells the manager to configure the required six
-- choices instead of silently dropping an answer key or a saved response.
DO $migration$
DECLARE
  v_part record;
  v_option_indices integer[];
  v_candidate integer;
  v_options jsonb;
  v_legacy_roman_options constant jsonb := jsonb_build_array('i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix');
  v_a_to_f_options constant jsonb := jsonb_build_array('A', 'B', 'C', 'D', 'E', 'F');
BEGIN
  FOR v_part IN
    SELECT
      part.id AS part_id,
      contest.id AS contest_id,
      canonical_question.options AS canonical_options
    FROM public.contest_exam_parts AS part
    JOIN public.contests AS contest
      ON contest.id = part.contest_id
    JOIN public.contest_questions AS canonical_question
      ON canonical_question.exam_part_id = part.id
      AND canonical_question.position = 35
    JOIN public.contest_questions AS question
      ON question.exam_part_id = part.id
      AND question.position BETWEEN 35 AND 40
    WHERE contest.subject = 'ielts'
      AND NOT contest.is_published
      AND part.section = 'reading'
      AND part.position = 7
      AND part.content LIKE 'IELTS_READING_PASSAGE_THREE_STRUCTURED%'
      AND canonical_question.options <> v_legacy_roman_options
    GROUP BY part.id, contest.id, canonical_question.options
    HAVING count(*) = 6
      AND count(DISTINCT question.position) = 6
      AND count(*) FILTER (
        WHERE question.answer_type = 'choice'
          AND jsonb_array_length(question.options) = 9
          AND question.correct_option BETWEEN 0 AND 8
          AND (
            question.position = 35
            OR question.options = canonical_question.options
            OR question.options = v_legacy_roman_options
          )
      ) = 6
  LOOP
    -- A malformed legacy response cannot be remapped reliably.  Keep the
    -- entire draft bank intact for manual repair instead of writing a NULL or
    -- mismatched selected option during the conversion.
    IF EXISTS (
      SELECT 1
      FROM public.contest_answers AS answer
      JOIN public.contest_questions AS question
        ON question.id = answer.question_id
      WHERE answer.contest_id = v_part.contest_id
        AND question.exam_part_id = v_part.part_id
        AND question.position BETWEEN 35 AND 40
        AND (answer.selected_option IS NULL OR answer.selected_option NOT BETWEEN 0 AND 8)
    ) THEN
      RAISE NOTICE 'IELTS Reading Passage 3 part % remains on the legacy nine-choice bank because a draft response has no valid selected option; reconfigure questions 35 through 40 as A-F choices.', v_part.part_id;
      CONTINUE;
    END IF;

    -- Retain every answer-key option and every saved draft selection first,
    -- then use the earliest remaining legacy choices until the new A-F bank
    -- has exactly six entries.  Q35 held the real heading text in the legacy
    -- builder; Q36–40 held only i–ix labels, so indexes are the safe common
    -- representation to preserve.
    SELECT array_agg(candidate.option_index ORDER BY candidate.option_index)
    INTO v_option_indices
    FROM (
      SELECT question.correct_option::integer AS option_index
      FROM public.contest_questions AS question
      WHERE question.exam_part_id = v_part.part_id
        AND question.position BETWEEN 35 AND 40

      UNION

      SELECT answer.selected_option::integer AS option_index
      FROM public.contest_answers AS answer
      JOIN public.contest_questions AS question
        ON question.id = answer.question_id
      WHERE answer.contest_id = v_part.contest_id
        AND question.exam_part_id = v_part.part_id
        AND question.position BETWEEN 35 AND 40
        AND answer.selected_option IS NOT NULL
        AND answer.selected_option BETWEEN 0 AND 8
    ) AS candidate;

    IF cardinality(v_option_indices) > 6 THEN
      RAISE NOTICE 'IELTS Reading Passage 3 part % remains on the legacy nine-choice bank because its answer keys and saved draft responses need more than six choices; reconfigure questions 35 through 40 as A-F choices.', v_part.part_id;
      CONTINUE;
    END IF;

    FOR v_candidate IN 0..8 LOOP
      EXIT WHEN cardinality(v_option_indices) = 6;
      IF NOT v_candidate = ANY(v_option_indices) THEN
        v_option_indices := array_append(v_option_indices, v_candidate);
      END IF;
    END LOOP;

    IF cardinality(v_option_indices) <> 6 THEN
      RAISE EXCEPTION 'Unable to build a six-choice IELTS Reading Passage 3 bank for part %', v_part.part_id;
    END IF;

    SELECT jsonb_agg(v_part.canonical_options -> selected.original_index ORDER BY selected.ordinality)
    INTO v_options
    FROM unnest(v_option_indices) WITH ORDINALITY AS selected(original_index, ordinality);

    -- Remap any retained draft responses before changing the stored option
    -- indexes.  `is_correct` and `score` compare the original indexes, so
    -- their meaning remains the same after both values are remapped.
    UPDATE public.contest_answers AS answer
    SET selected_option = array_position(v_option_indices, answer.selected_option::integer) - 1,
        is_correct = answer.selected_option = question.correct_option,
        score = CASE WHEN answer.selected_option = question.correct_option THEN question.points ELSE 0 END
    FROM public.contest_questions AS question
    WHERE answer.question_id = question.id
      AND answer.contest_id = v_part.contest_id
      AND question.exam_part_id = v_part.part_id
      AND question.position BETWEEN 35 AND 40;

    UPDATE public.contest_questions AS question
    SET options = CASE WHEN question.position = 35 THEN v_options ELSE v_a_to_f_options END,
        correct_option = array_position(v_option_indices, question.correct_option::integer) - 1
    WHERE question.exam_part_id = v_part.part_id
      AND question.position BETWEEN 35 AND 40;

    RAISE NOTICE 'Converted IELTS Reading Passage 3 part % from a nine-choice heading bank to six A-F choices.', v_part.part_id;
  END LOOP;
END;
$migration$;
*/

CREATE OR REPLACE FUNCTION public.validate_ielts_reading_passage_three_structured_before_publish()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_part public.contest_exam_parts%ROWTYPE;
  v_tfng_count integer;
  v_summary public.contest_questions%ROWTYPE;
  v_summary_count integer;
  v_a_to_f_count integer;
  v_paragraph_count integer;
  v_marker_numbers integer[];
  v_marker_count integer;
BEGIN
  IF NOT NEW.is_published OR OLD.is_published OR NEW.subject <> 'ielts' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_part
  FROM public.contest_exam_parts
  WHERE contest_id = NEW.id
    AND section = 'reading'
    AND position = 7;

  IF NOT FOUND
    OR v_part.content NOT LIKE 'IELTS_READING_PASSAGE_THREE_STRUCTURED%' THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_tfng_count
  FROM public.contest_questions AS question
  WHERE question.contest_id = NEW.id
    AND question.exam_part_id = v_part.id
    AND question.position BETWEEN 27 AND 31
    AND question.answer_type = 'choice'
    AND question.options = jsonb_build_array('True', 'False', 'Not Given')
    AND question.correct_option IS NOT NULL;
  IF v_tfng_count <> 5 THEN
    RAISE EXCEPTION 'IELTS Reading Passage 3 requires True, False, Not Given questions 27 through 31';
  END IF;

  SELECT * INTO v_summary
  FROM public.contest_questions
  WHERE contest_id = NEW.id
    AND exam_part_id = v_part.id
    AND position = 32;

  SELECT count(*) INTO v_summary_count
  FROM public.contest_questions AS question
  WHERE question.contest_id = NEW.id
    AND question.exam_part_id = v_part.id
    AND question.position BETWEEN 32 AND 34
    AND question.answer_type = 'text'
    AND question.word_limit = 2;
  IF v_summary.id IS NULL OR v_summary_count <> 3 THEN
    RAISE EXCEPTION 'IELTS Reading Passage 3 requires two-word summary answer keys for questions 32 through 34';
  END IF;

  SELECT
    array_agg(DISTINCT (marker.values)[1]::integer ORDER BY (marker.values)[1]::integer),
    count(*)::integer
  INTO v_marker_numbers, v_marker_count
  FROM regexp_matches(v_summary.prompt, '\{\{([1-9][0-9]*)\}\}', 'g') AS marker(values);
  IF v_marker_count <> 3
    OR v_marker_numbers IS DISTINCT FROM ARRAY[32, 33, 34]::integer[] THEN
    RAISE EXCEPTION 'IELTS Reading Passage 3 summary must contain each marker from {{32}} through {{34}} exactly once';
  END IF;

  SELECT count(*) INTO v_a_to_f_count
  FROM public.contest_questions AS question
  WHERE question.contest_id = NEW.id
    AND question.exam_part_id = v_part.id
    AND question.position BETWEEN 35 AND 37
    AND question.answer_type = 'choice'
    AND jsonb_array_length(question.options) = 6
    AND question.correct_option IS NOT NULL;
  IF v_a_to_f_count <> 3 THEN
    RAISE EXCEPTION 'IELTS Reading Passage 3 requires questions 35 through 37 with exactly six A-F choices each';
  END IF;

  SELECT count(*) INTO v_paragraph_count
  FROM public.contest_questions AS question
  WHERE question.contest_id = NEW.id
    AND question.exam_part_id = v_part.id
    AND question.position BETWEEN 38 AND 40
    AND question.answer_type = 'choice'
    AND question.options = jsonb_build_array('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H')
    AND question.correct_option IS NOT NULL
    AND char_length(trim(question.prompt)) > 0;
  IF v_paragraph_count <> 3 THEN
    RAISE EXCEPTION 'IELTS Reading Passage 3 requires questions 38 through 40 with a statement and paragraph letters A-H';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS validate_ielts_reading_passage_three_structured_before_publish ON public.contests;
CREATE TRIGGER validate_ielts_reading_passage_three_structured_before_publish
  BEFORE UPDATE OF is_published
  ON public.contests
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_ielts_reading_passage_three_structured_before_publish();

-- Nine options remain available for the Passage 2 i-ix headings.  Passage 3
-- has A-F choices for questions 35 through 37 and fixed A-H paragraph
-- letters for questions 38 through 40.
CREATE OR REPLACE FUNCTION public.save_contest_question(
  p_contest_id uuid,
  p_question_id uuid,
  p_position integer,
  p_prompt text,
  p_options jsonb,
  p_answer_type text,
  p_correct_option integer,
  p_accepted_answers jsonb,
  p_word_limit integer,
  p_points integer,
  p_explanation text,
  p_exam_part_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_question_id uuid;
  v_contest public.contests%ROWTYPE;
  v_section text;
  v_part_position integer;
  v_part_content text;
  v_answer_type text := lower(trim(coalesce(p_answer_type, 'choice')));
  v_shared_mini_text_key boolean := false;
  v_max_choice_options integer := 8;
  v_required_choice_options integer := NULL;
  v_required_choice_values jsonb := NULL;
BEGIN
  IF NOT public.can_manage_contest(p_contest_id) THEN
    RAISE EXCEPTION 'Only the owning judge or an admin can manage questions';
  END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contest not found'; END IF;
  IF v_contest.archived_at IS NOT NULL OR v_contest.start_at <= now() THEN
    RAISE EXCEPTION 'Questions cannot be changed after publication or start';
  END IF;
  IF p_position IS NULL OR p_position < 1
    OR coalesce(jsonb_typeof(p_options), '') <> 'array'
    OR p_points NOT BETWEEN 1 AND 1000
    OR v_answer_type NOT IN ('choice', 'text') THEN
    RAISE EXCEPTION 'Invalid question data';
  END IF;

  IF v_contest.subject IN ('ielts', 'cefr') THEN
    IF p_exam_part_id IS NULL THEN RAISE EXCEPTION 'Every IELTS or CEFR question must belong to a listening or reading part'; END IF;
    SELECT section, position, content INTO v_section, v_part_position, v_part_content
    FROM public.contest_exam_parts
    WHERE id = p_exam_part_id AND contest_id = p_contest_id;
    IF v_section IS NULL OR v_section = 'writing' THEN RAISE EXCEPTION 'Questions may belong only to listening or reading parts'; END IF;
  ELSIF p_exam_part_id IS NOT NULL THEN
    RAISE EXCEPTION 'Exam parts can be used only by IELTS and CEFR contests';
  END IF;

  v_shared_mini_text_key := v_contest.subject = 'cefr'
    AND v_section = 'reading'
    AND v_part_position = 5
    AND p_position BETWEEN 30 AND 33;

  IF v_contest.subject = 'ielts'
    AND v_section = 'reading'
    AND v_part_position = 6
    AND v_part_content LIKE 'IELTS_READING_PASSAGE_TWO_STRUCTURED%'
    AND p_position BETWEEN 14 AND 20 THEN
    v_max_choice_options := 9;
  END IF;

  IF v_contest.subject = 'ielts'
    AND v_section = 'reading'
    AND v_part_position = 7
    AND v_part_content LIKE 'IELTS_READING_PASSAGE_THREE_STRUCTURED%' THEN
    IF p_position BETWEEN 35 AND 37 THEN
      v_max_choice_options := 6;
      v_required_choice_options := 6;
    ELSIF p_position BETWEEN 38 AND 40 THEN
      v_max_choice_options := 8;
      v_required_choice_options := 8;
      v_required_choice_values := jsonb_build_array('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H');
    END IF;
  END IF;

  IF v_contest.subject = 'ielts' AND v_section = 'listening' AND (
    (v_part_position = 1 AND p_position NOT BETWEEN 1 AND 10)
    OR (v_part_position = 2 AND p_position NOT BETWEEN 11 AND 20)
    OR (v_part_position = 3 AND p_position NOT BETWEEN 21 AND 30)
    OR (v_part_position = 4 AND p_position NOT BETWEEN 31 AND 40)
    OR v_part_position NOT IN (1, 2, 3, 4)
  ) THEN
    RAISE EXCEPTION 'IELTS Listening questions must use positions 1 through 40 within the Listening section';
  END IF;

  IF v_contest.subject = 'ielts' AND v_section = 'reading' AND (
    (v_part_position = 5 AND p_position NOT BETWEEN 1 AND 13)
    OR (v_part_position = 6 AND p_position NOT BETWEEN 14 AND 26)
    OR (v_part_position = 7 AND p_position NOT BETWEEN 27 AND 40)
    OR v_part_position NOT IN (5, 6, 7)
  ) THEN
    RAISE EXCEPTION 'IELTS Reading questions must use positions 1 through 40 within the Reading section';
  END IF;

  IF char_length(trim(coalesce(p_prompt, ''))) = 0 THEN
    RAISE EXCEPTION 'Question text cannot be empty';
  END IF;

  IF v_required_choice_options IS NOT NULL AND v_answer_type <> 'choice' THEN
    RAISE EXCEPTION 'IELTS Reading Passage 3 questions 35 through 40 require choice answers';
  END IF;

  IF v_answer_type = 'choice' THEN
    IF jsonb_array_length(p_options) NOT BETWEEN 2 AND v_max_choice_options
      OR (v_required_choice_options IS NOT NULL AND jsonb_array_length(p_options) <> v_required_choice_options)
      OR (v_required_choice_values IS NOT NULL AND p_options <> v_required_choice_values)
      OR (p_correct_option IS NOT NULL AND (p_correct_option < 0 OR p_correct_option >= jsonb_array_length(p_options)))
      OR coalesce(p_word_limit, 0) <> 0
      OR coalesce(p_accepted_answers, '[]'::jsonb) <> '[]'::jsonb THEN
      RAISE EXCEPTION 'Invalid choice question data';
    END IF;
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_options) AS option_value(value)
      WHERE jsonb_typeof(option_value.value) <> 'string'
        OR char_length(trim(option_value.value #>> '{}')) = 0
    ) THEN
      RAISE EXCEPTION 'Question options cannot be empty';
    END IF;
    IF NOT (v_contest.subject = 'cefr' AND v_section = 'listening' AND v_part_position = 1)
      AND p_correct_option IS NULL THEN
      RAISE EXCEPTION 'Select a correct option before saving this question';
    END IF;
    IF v_contest.subject = 'cefr' AND v_section = 'listening' AND v_part_position = 1
      AND jsonb_array_length(p_options) <> 3 THEN
      RAISE EXCEPTION 'CEFR Listening Part 1 requires exactly three answer options';
    END IF;
  ELSE
    IF NOT (v_contest.subject = 'ielts' OR v_shared_mini_text_key) THEN
      RAISE EXCEPTION 'Typed answers are available only for IELTS and CEFR Reading Part 5 questions 30 through 33';
    END IF;
    IF jsonb_array_length(p_options) <> 0 OR p_correct_option IS NOT NULL
      OR p_word_limit NOT BETWEEN 1 AND 20
      OR coalesce(jsonb_typeof(p_accepted_answers), '') <> 'array'
      OR jsonb_array_length(p_accepted_answers) NOT BETWEEN 1 AND 20 THEN
      RAISE EXCEPTION 'Invalid typed-answer question data';
    END IF;
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_accepted_answers) AS answer_value(value)
      WHERE jsonb_typeof(answer_value.value) <> 'string'
        OR char_length(trim(answer_value.value #>> '{}')) = 0
        OR char_length(trim(answer_value.value #>> '{}')) > 160
    ) THEN
      RAISE EXCEPTION 'Typed answer keys cannot be empty';
    END IF;
    IF v_shared_mini_text_key AND (
      p_word_limit <> 1
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(p_accepted_answers) AS answer(value)
        WHERE cardinality(regexp_split_to_array(trim(answer.value), '\s+')) <> 1
      )
    ) THEN
      RAISE EXCEPTION 'CEFR Reading Part 5 questions 30 through 33 require one-word answers';
    END IF;
  END IF;

  IF p_question_id IS NULL THEN
    INSERT INTO public.contest_questions (
      contest_id, exam_part_id, position, prompt, options, answer_type,
      correct_option, accepted_answers, word_limit, points, explanation
    ) VALUES (
      p_contest_id, p_exam_part_id, p_position, trim(coalesce(p_prompt, '')), p_options, v_answer_type,
      p_correct_option, coalesce(p_accepted_answers, '[]'::jsonb), coalesce(p_word_limit, 0),
      p_points, nullif(trim(p_explanation), '')
    ) RETURNING id INTO v_question_id;
  ELSE
    UPDATE public.contest_questions
    SET exam_part_id = p_exam_part_id, position = p_position, prompt = trim(coalesce(p_prompt, '')),
        options = p_options, answer_type = v_answer_type, correct_option = p_correct_option,
        accepted_answers = coalesce(p_accepted_answers, '[]'::jsonb), word_limit = coalesce(p_word_limit, 0),
        points = p_points, explanation = nullif(trim(p_explanation), '')
    WHERE id = p_question_id AND contest_id = p_contest_id
    RETURNING id INTO v_question_id;
    IF v_question_id IS NULL THEN RAISE EXCEPTION 'Question not found'; END IF;
  END IF;
  PERFORM public.log_audit_action('contest.question.save', 'contest', p_contest_id, jsonb_build_object('question_id', v_question_id, 'answer_type', v_answer_type));
  RETURN v_question_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.validate_ielts_reading_numbering_and_shared_text_before_publish() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_ielts_listening_part_two_two_answer_score(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_duplicate_ielts_shared_selection() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_ielts_reading_passage_two_structured_before_publish() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_ielts_reading_passage_three_structured_before_publish() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_contest_question(uuid, uuid, integer, text, jsonb, text, integer, jsonb, integer, integer, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_contest_question(uuid, uuid, integer, text, jsonb, text, integer, jsonb, integer, integer, text, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
