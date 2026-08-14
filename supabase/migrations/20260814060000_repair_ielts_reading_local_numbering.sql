/*
  Repair any IELTS Reading rows which were created with the retired 41–80
  numbering.  Reading and Listening deliberately both display 1–40: question
  positions are unique within an exam part, not across the two sections.

  This migration changes only the display position and inline marker names.
  It deliberately keeps every contest_questions.id, correct_option,
  accepted_answers, and contest_answers row unchanged, so existing answer
  keys and participant responses continue to point to the same question.
*/

LOCK TABLE public.contests, public.contest_exam_parts, public.contest_questions, public.contest_answers
  IN SHARE ROW EXCLUSIVE MODE;

DO $migration$
BEGIN
  /* A mixed old/new passage has two rows that would map to the same local
     position.  There is no safe automatic way to decide which answer key is
     intended, so fail atomically rather than lose or alter an answer. */
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
    RAISE EXCEPTION 'Cannot repair IELTS Reading numbering: a passage has both a legacy question and the same local question number';
  END IF;
END;
$migration$;

/* Passage 1: 41–53 becomes 1–13 and its shared-completion markers 48–53
   become 8–13. */
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

/* Passage 2: 54–66 becomes 14–26. */
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

/* Passage 3: 67–80 becomes 27–40. */
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

DO $migration$
BEGIN
  /* Do not commit a partial conversion.  This is also a guard against a
     future schema change accidentally narrowing the UPDATE above. */
  IF EXISTS (
    SELECT 1
    FROM public.contest_questions AS question
    JOIN public.contest_exam_parts AS part ON part.id = question.exam_part_id
    JOIN public.contests AS contest ON contest.id = part.contest_id
    WHERE question.contest_id = contest.id
      AND contest.subject = 'ielts'
      AND part.section = 'reading'
      AND (
        (part.position = 5 AND question.position BETWEEN 41 AND 53)
        OR (part.position = 6 AND question.position BETWEEN 54 AND 66)
        OR (part.position = 7 AND question.position BETWEEN 67 AND 80)
      )
  ) THEN
    RAISE EXCEPTION 'IELTS Reading repair left a legacy question position; no changes were committed';
  END IF;
END;
$migration$;

NOTIFY pgrst, 'reload schema';
