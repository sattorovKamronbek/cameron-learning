-- Uzbekistan Multilevel CEFR Reading: five parts, Questions 1 through 35.
-- 1–8 open gap-fill; 9–16 headings; 17–24 T/F/NG;
-- 25–32 multiple matching; 33–35 multiple choice.

-- Listening and Reading each use their own printed question sequence. The
-- old contest-wide key prevented Reading Question 1 from coexisting with
-- Listening Question 1, so uniqueness must be scoped to an exam part.
ALTER TABLE public.contest_questions
  DROP CONSTRAINT IF EXISTS contest_questions_contest_id_position_key;
ALTER TABLE public.contest_questions
  DROP CONSTRAINT IF EXISTS contest_questions_contest_id_exam_part_id_position_key;
ALTER TABLE public.contest_questions
  ADD CONSTRAINT contest_questions_contest_id_exam_part_id_position_key
  UNIQUE (contest_id, exam_part_id, position);

CREATE OR REPLACE FUNCTION public.save_cefr_gap_fill_answer_keys(p_contest_id uuid, p_exam_part_id uuid, p_answer_keys jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_contest public.contests%ROWTYPE; v_part public.contest_exam_parts%ROWTYPE; v_marker_numbers integer[]; v_expected_numbers integer[]; v_key jsonb; v_blank_number integer; v_answers jsonb; v_points integer; v_seen integer[] := ARRAY[]::integer[];
BEGIN
  IF NOT public.can_manage_contest(p_contest_id) THEN RAISE EXCEPTION 'Only the owning judge or an admin can manage answer keys'; END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id FOR UPDATE;
  IF NOT FOUND OR v_contest.subject <> 'cefr' THEN RAISE EXCEPTION 'CEFR contest not found'; END IF;
  IF v_contest.is_published OR v_contest.start_at <= now() THEN RAISE EXCEPTION 'Answer keys cannot be changed after publication or start'; END IF;
  SELECT * INTO v_part FROM public.contest_exam_parts WHERE id = p_exam_part_id AND contest_id = p_contest_id;
  IF NOT FOUND OR NOT ((v_part.section = 'listening' AND v_part.position IN (2, 6)) OR (v_part.section = 'reading' AND v_part.position IN (1, 5))) THEN RAISE EXCEPTION 'Gap-fill answer keys are available only for CEFR Listening Parts 2/6 and Reading Parts 1/5'; END IF;
  IF coalesce(jsonb_typeof(p_answer_keys), '') <> 'array' THEN RAISE EXCEPTION 'Answer keys must be an array'; END IF;
  v_expected_numbers := CASE WHEN v_part.section = 'reading' AND v_part.position = 1 THEN ARRAY[1,2,3,4,5,6]::integer[] WHEN v_part.section = 'reading' THEN ARRAY[30,31,32,33]::integer[] WHEN v_part.position = 2 THEN ARRAY[9,10,11,12,13,14]::integer[] ELSE ARRAY[30,31,32,33,34,35]::integer[] END;
  SELECT array_agg(DISTINCT (marker.values)[1]::integer ORDER BY (marker.values)[1]::integer) INTO v_marker_numbers FROM regexp_matches(v_part.content, '\{\{([1-9][0-9]*)\}\}', 'g') marker(values);
  IF v_marker_numbers IS DISTINCT FROM v_expected_numbers THEN RAISE EXCEPTION 'CEFR % Part % must use exactly its required question markers', initcap(v_part.section), v_part.position; END IF;
  IF jsonb_array_length(p_answer_keys) <> array_length(v_expected_numbers, 1) THEN RAISE EXCEPTION 'Enter one answer key for every required marker'; END IF;
  FOR v_key IN SELECT value FROM jsonb_array_elements(p_answer_keys) item(value) LOOP
    IF jsonb_typeof(v_key) <> 'object' OR coalesce(v_key->>'blank_number', '') !~ '^[1-9][0-9]*$' THEN RAISE EXCEPTION 'Every answer key needs a valid blank_number'; END IF;
    v_blank_number := (v_key->>'blank_number')::integer; v_answers := v_key->'accepted_answers'; v_points := coalesce((v_key->>'points')::integer, 1);
    IF v_blank_number <> ALL(v_expected_numbers) OR v_blank_number = ANY(v_seen) THEN RAISE EXCEPTION 'Answer keys must cover every required marker exactly once'; END IF;
    IF coalesce(jsonb_typeof(v_answers), '') <> 'array' OR jsonb_array_length(v_answers) NOT BETWEEN 1 AND 8 OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_answers) item(value) WHERE jsonb_typeof(item.value) <> 'string' OR char_length(trim(item.value #>> '{}')) NOT BETWEEN 1 AND 120) THEN RAISE EXCEPTION 'Each blank needs one to eight non-empty accepted answers'; END IF;
    IF v_points NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Blank points must be between 1 and 1000'; END IF;
    INSERT INTO public.contest_gap_fill_answer_keys (contest_id, exam_part_id, blank_number, accepted_answers, points) VALUES (p_contest_id, p_exam_part_id, v_blank_number, v_answers, v_points) ON CONFLICT (exam_part_id, blank_number) DO UPDATE SET accepted_answers = EXCLUDED.accepted_answers, points = EXCLUDED.points, updated_at = now();
    v_seen := array_append(v_seen, v_blank_number);
  END LOOP;
  DELETE FROM public.contest_gap_fill_answer_keys WHERE exam_part_id = p_exam_part_id AND blank_number <> ALL(v_expected_numbers);
  PERFORM public.log_audit_action('contest.gap_fill_keys.save', 'contest', p_contest_id, jsonb_build_object('part_id', p_exam_part_id, 'blank_count', array_length(v_expected_numbers, 1)));
END;
$$;

CREATE OR REPLACE FUNCTION public.save_cefr_gap_fill_response(p_exam_part_id uuid, p_blank_number integer, p_answer text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_part public.contest_exam_parts%ROWTYPE; v_contest public.contests%ROWTYPE; v_timing public.contest_exam_section_timings%ROWTYPE; v_key public.contest_gap_fill_answer_keys%ROWTYPE; v_correct boolean; v_answer text := trim(coalesce(p_answer, ''));
BEGIN
  IF auth.uid() IS NULL OR NOT public.active_profile(auth.uid()) THEN RAISE EXCEPTION 'An active account is required to submit'; END IF;
  SELECT * INTO v_part FROM public.contest_exam_parts WHERE id = p_exam_part_id;
  IF NOT FOUND OR NOT ((v_part.section = 'listening' AND v_part.position IN (2, 6)) OR (v_part.section = 'reading' AND v_part.position IN (1, 5))) THEN RAISE EXCEPTION 'CEFR gap-fill part not found'; END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = v_part.contest_id;
  IF v_contest.subject <> 'cefr' OR NOT v_contest.is_published OR v_contest.archived_at IS NOT NULL OR now() < v_contest.start_at OR now() >= v_contest.end_at THEN RAISE EXCEPTION 'Answers are not accepted for this contest at this time'; END IF;
  IF v_contest.contest_type = 'rated' AND (v_contest.created_by = auth.uid() OR public.has_admin_access(auth.uid())) THEN RAISE EXCEPTION 'Contest managers cannot submit a rated exam'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.contest_registrations registration WHERE registration.contest_id = v_contest.id AND registration.user_id = auth.uid()) THEN RAISE EXCEPTION 'Register for this exam before submitting'; END IF;
  IF EXISTS (SELECT 1 FROM public.contest_registrations registration WHERE registration.contest_id = v_contest.id AND registration.user_id = auth.uid() AND registration.completed_at IS NOT NULL) THEN RAISE EXCEPTION 'This exam has already been submitted'; END IF;
  SELECT * INTO v_timing FROM public.contest_exam_section_timings WHERE contest_id = v_contest.id;
  IF NOT FOUND OR (v_part.section = 'listening' AND (now() < v_contest.start_at OR now() >= v_contest.start_at + (v_timing.listening_minutes * interval '1 minute'))) OR (v_part.section = 'reading' AND (now() < v_contest.start_at + (v_timing.listening_minutes * interval '1 minute') OR now() >= v_contest.start_at + ((v_timing.listening_minutes + v_timing.reading_minutes) * interval '1 minute'))) THEN RAISE EXCEPTION 'This exam section is closed'; END IF;
  SELECT * INTO v_key FROM public.contest_gap_fill_answer_keys WHERE exam_part_id = p_exam_part_id AND blank_number = p_blank_number;
  IF NOT FOUND THEN RAISE EXCEPTION 'This blank is not configured'; END IF;
  IF v_answer = '' THEN DELETE FROM public.contest_gap_fill_responses WHERE exam_part_id = p_exam_part_id AND blank_number = p_blank_number AND user_id = auth.uid(); RETURN jsonb_build_object('saved', true, 'cleared', true); END IF;
  IF char_length(v_answer) > 120 THEN RAISE EXCEPTION 'An answer may contain at most 120 characters'; END IF;
  SELECT EXISTS (SELECT 1 FROM jsonb_array_elements_text(v_key.accepted_answers) answer WHERE public.normalize_gap_fill_answer(answer) = public.normalize_gap_fill_answer(v_answer)) INTO v_correct;
  INSERT INTO public.contest_gap_fill_responses (contest_id, exam_part_id, blank_number, user_id, answer, is_correct, score) VALUES (v_contest.id, p_exam_part_id, p_blank_number, auth.uid(), v_answer, v_correct, CASE WHEN v_correct THEN v_key.points ELSE 0 END) ON CONFLICT (exam_part_id, blank_number, user_id) DO UPDATE SET answer = EXCLUDED.answer, is_correct = EXCLUDED.is_correct, score = EXCLUDED.score, submitted_at = now();
  UPDATE public.contest_registrations SET last_activity_at = now() WHERE contest_id = v_contest.id AND user_id = auth.uid();
  RETURN jsonb_build_object('saved', true, 'part_id', p_exam_part_id, 'blank_number', p_blank_number);
END;
$$;

CREATE OR REPLACE FUNCTION public.save_cefr_matching_config(p_contest_id uuid, p_exam_part_id uuid, p_options jsonb, p_speakers jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_contest public.contests%ROWTYPE; v_part public.contest_exam_parts%ROWTYPE; v_option jsonb; v_speaker jsonb; v_index integer; v_speaker_number integer; v_correct_option integer; v_expected_numbers integer[];
BEGIN
  IF NOT public.can_manage_contest(p_contest_id) THEN RAISE EXCEPTION 'Only the owning judge or an admin can manage matching'; END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id FOR UPDATE;
  IF NOT FOUND OR v_contest.subject <> 'cefr' THEN RAISE EXCEPTION 'CEFR contest not found'; END IF;
  IF v_contest.is_published OR v_contest.start_at <= now() THEN RAISE EXCEPTION 'Matching cannot be changed after publication or start'; END IF;
  SELECT * INTO v_part FROM public.contest_exam_parts WHERE id = p_exam_part_id AND contest_id = p_contest_id;
  IF NOT FOUND OR NOT ((v_part.section = 'listening' AND v_part.position IN (3, 4)) OR (v_part.section = 'reading' AND v_part.position IN (2, 3))) THEN RAISE EXCEPTION 'Matching is available only for CEFR Listening Parts 3/4 and Reading Parts 2/3'; END IF;
  v_expected_numbers := CASE WHEN v_part.section = 'reading' AND v_part.position = 2 THEN ARRAY[7,8,9,10,11,12,13,14]::integer[] WHEN v_part.section = 'reading' THEN ARRAY[15,16,17,18,19,20]::integer[] WHEN v_part.position = 3 THEN ARRAY[15,16,17,18]::integer[] ELSE ARRAY[19,20,21,22,23]::integer[] END;
  IF coalesce(jsonb_typeof(p_options), '') <> 'array' OR jsonb_array_length(p_options) NOT BETWEEN 2 AND 12 THEN RAISE EXCEPTION 'Add between two and twelve answer-bank options'; END IF;
  IF v_part.section = 'reading' AND v_part.position = 3 AND jsonb_array_length(p_options) <> 8 THEN RAISE EXCEPTION 'CEFR Reading Part 3 requires six headings plus exactly two extra options'; END IF;
  IF coalesce(jsonb_typeof(p_speakers), '') <> 'array' OR jsonb_array_length(p_speakers) <> array_length(v_expected_numbers, 1) THEN RAISE EXCEPTION 'Use every required numbered item for this CEFR part'; END IF;
  DELETE FROM public.contest_matching_speakers WHERE exam_part_id = p_exam_part_id;
  DELETE FROM public.contest_matching_options WHERE exam_part_id = p_exam_part_id;
  FOR v_index IN 0..jsonb_array_length(p_options) - 1 LOOP
    v_option := p_options -> v_index;
    IF jsonb_typeof(v_option) <> 'object' OR coalesce(v_option->>'position', '') !~ '^[0-9]+$' OR (v_option->>'position')::integer <> v_index OR char_length(trim(coalesce(v_option->>'label', ''))) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Every answer-bank option needs its position and text'; END IF;
    INSERT INTO public.contest_matching_options (contest_id, exam_part_id, option_position, label) VALUES (p_contest_id, p_exam_part_id, v_index, trim(v_option->>'label'));
  END LOOP;
  FOR v_index IN 0..jsonb_array_length(p_speakers) - 1 LOOP
    v_speaker := p_speakers -> v_index;
    v_speaker_number := coalesce((v_speaker->>'speaker_number')::integer, -1);
    IF jsonb_typeof(v_speaker) <> 'object' OR v_speaker_number <> v_expected_numbers[v_index + 1] OR char_length(trim(coalesce(v_speaker->>'label', ''))) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Each entry needs its required number and a label'; END IF;
    v_correct_option := CASE WHEN v_speaker->'correct_option' IS NULL OR v_speaker->'correct_option' = 'null'::jsonb THEN NULL ELSE (v_speaker->>'correct_option')::integer END;
    IF v_correct_option IS NULL OR v_correct_option NOT BETWEEN 0 AND jsonb_array_length(p_options) - 1 THEN RAISE EXCEPTION 'Select a valid answer key for every entry'; END IF;
    INSERT INTO public.contest_matching_speakers (contest_id, exam_part_id, speaker_number, label, correct_option_position) VALUES (p_contest_id, p_exam_part_id, v_speaker_number, trim(v_speaker->>'label'), v_correct_option);
  END LOOP;
  PERFORM public.log_audit_action('contest.matching_config.save', 'contest', p_contest_id, jsonb_build_object('part_id', p_exam_part_id, 'entry_count', array_length(v_expected_numbers, 1), 'option_count', jsonb_array_length(p_options)));
END;
$$;

CREATE OR REPLACE FUNCTION public.save_cefr_matching_response(p_exam_part_id uuid, p_speaker_number integer, p_option_position integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_part public.contest_exam_parts%ROWTYPE; v_contest public.contests%ROWTYPE; v_timing public.contest_exam_section_timings%ROWTYPE; v_speaker public.contest_matching_speakers%ROWTYPE; v_correct boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.active_profile(auth.uid()) THEN RAISE EXCEPTION 'An active account is required to submit'; END IF;
  SELECT * INTO v_part FROM public.contest_exam_parts WHERE id = p_exam_part_id;
  IF NOT FOUND OR NOT ((v_part.section = 'listening' AND v_part.position IN (3, 4)) OR (v_part.section = 'reading' AND v_part.position IN (2, 3))) THEN RAISE EXCEPTION 'CEFR matching part not found'; END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = v_part.contest_id;
  IF v_contest.subject <> 'cefr' OR NOT v_contest.is_published OR v_contest.archived_at IS NOT NULL OR now() < v_contest.start_at OR now() >= v_contest.end_at THEN RAISE EXCEPTION 'Answers are not accepted for this contest at this time'; END IF;
  IF v_contest.contest_type = 'rated' AND (v_contest.created_by = auth.uid() OR public.has_admin_access(auth.uid())) THEN RAISE EXCEPTION 'Contest managers cannot submit a rated exam'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.contest_registrations registration WHERE registration.contest_id = v_contest.id AND registration.user_id = auth.uid()) THEN RAISE EXCEPTION 'Register for this exam before submitting'; END IF;
  IF EXISTS (SELECT 1 FROM public.contest_registrations registration WHERE registration.contest_id = v_contest.id AND registration.user_id = auth.uid() AND registration.completed_at IS NOT NULL) THEN RAISE EXCEPTION 'This exam has already been submitted'; END IF;
  SELECT * INTO v_timing FROM public.contest_exam_section_timings WHERE contest_id = v_contest.id;
  IF NOT FOUND OR (v_part.section = 'listening' AND (now() < v_contest.start_at OR now() >= v_contest.start_at + (v_timing.listening_minutes * interval '1 minute'))) OR (v_part.section = 'reading' AND (now() < v_contest.start_at + (v_timing.listening_minutes * interval '1 minute') OR now() >= v_contest.start_at + ((v_timing.listening_minutes + v_timing.reading_minutes) * interval '1 minute'))) THEN RAISE EXCEPTION 'This exam section is closed'; END IF;
  SELECT * INTO v_speaker FROM public.contest_matching_speakers WHERE exam_part_id = p_exam_part_id AND speaker_number = p_speaker_number;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.contest_matching_options WHERE exam_part_id = p_exam_part_id AND option_position = p_option_position) THEN RAISE EXCEPTION 'Invalid matching item or option'; END IF;
  v_correct := p_option_position = v_speaker.correct_option_position;
  INSERT INTO public.contest_matching_responses (contest_id, exam_part_id, speaker_number, user_id, option_position, is_correct, score) VALUES (v_contest.id, p_exam_part_id, p_speaker_number, auth.uid(), p_option_position, v_correct, CASE WHEN v_correct THEN 1 ELSE 0 END)
  ON CONFLICT (exam_part_id, speaker_number, user_id) DO UPDATE SET option_position = EXCLUDED.option_position, is_correct = EXCLUDED.is_correct, score = EXCLUDED.score, submitted_at = now();
  UPDATE public.contest_registrations SET last_activity_at = now() WHERE contest_id = v_contest.id AND user_id = auth.uid();
  RETURN jsonb_build_object('saved', true, 'part_id', p_exam_part_id, 'speaker_number', p_speaker_number);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_contest_editor(p_contest_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_payload jsonb;
BEGIN
  IF NOT public.can_manage_contest(p_contest_id) THEN RAISE EXCEPTION 'You cannot view this contest editor'; END IF;
  SELECT jsonb_build_object(
    'contest', jsonb_build_object('id', contest.id, 'slug', contest.slug, 'title', contest.title, 'description', contest.description, 'subject', contest.subject, 'difficulty', contest.difficulty, 'contest_type', contest.contest_type, 'contest_mode', contest.contest_mode, 'visibility', contest.visibility, 'start_at', contest.start_at, 'end_at', contest.end_at, 'max_participants', contest.max_participants, 'rules', contest.rules, 'tags', contest.tags, 'prize', contest.prize, 'is_published', contest.is_published, 'is_finalized', contest.is_finalized, 'archived_at', contest.archived_at),
    'section_timings', (SELECT jsonb_build_object('listening_minutes', timing.listening_minutes, 'reading_minutes', timing.reading_minutes, 'writing_minutes', timing.writing_minutes) FROM public.contest_exam_section_timings timing WHERE timing.contest_id = contest.id),
    'parts', coalesce((SELECT jsonb_agg(jsonb_build_object('id', part.id, 'position', part.position, 'section', part.section, 'title', part.title, 'instructions', part.instructions, 'content', part.content, 'audio_url', part.audio_url, 'image_url', part.image_url, 'max_points', part.max_points) ORDER BY part.section, part.position) FROM public.contest_exam_parts part WHERE part.contest_id = contest.id), '[]'::jsonb),
    'questions', coalesce((SELECT jsonb_agg(jsonb_build_object('id', question.id, 'exam_part_id', question.exam_part_id, 'position', question.position, 'prompt', question.prompt, 'options', question.options, 'answer_type', question.answer_type, 'correct_option', question.correct_option, 'accepted_answers', question.accepted_answers, 'word_limit', question.word_limit, 'points', question.points, 'explanation', question.explanation) ORDER BY question.exam_part_id, question.position) FROM public.contest_questions question WHERE question.contest_id = contest.id), '[]'::jsonb),
    'gap_fill_answer_keys', coalesce((SELECT jsonb_agg(jsonb_build_object('part_id', key.exam_part_id, 'blank_number', key.blank_number, 'accepted_answers', key.accepted_answers, 'points', key.points) ORDER BY key.exam_part_id, key.blank_number) FROM public.contest_gap_fill_answer_keys key WHERE key.contest_id = contest.id), '[]'::jsonb),
    'matching_configs', coalesce((SELECT jsonb_agg(jsonb_build_object('part_id', part.id, 'options', coalesce((SELECT jsonb_agg(jsonb_build_object('position', option.option_position, 'label', option.label) ORDER BY option.option_position) FROM public.contest_matching_options option WHERE option.exam_part_id = part.id), '[]'::jsonb), 'speakers', coalesce((SELECT jsonb_agg(jsonb_build_object('speaker_number', speaker.speaker_number, 'label', speaker.label, 'correct_option', speaker.correct_option_position) ORDER BY speaker.speaker_number) FROM public.contest_matching_speakers speaker WHERE speaker.exam_part_id = part.id), '[]'::jsonb)) ORDER BY part.section, part.position) FROM public.contest_exam_parts part WHERE part.contest_id = contest.id AND contest.subject = 'cefr' AND ((part.section = 'listening' AND part.position IN (3, 4)) OR (part.section = 'reading' AND part.position IN (2, 4)))), '[]'::jsonb)
  ) INTO v_payload FROM public.contests contest WHERE contest.id = p_contest_id;
  IF v_payload IS NULL THEN RAISE EXCEPTION 'Contest not found'; END IF;
  RETURN v_payload;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_contest_workspace(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_contest public.contests%ROWTYPE; v_payload jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.active_profile(auth.uid()) THEN RAISE EXCEPTION 'Sign in with an active account to enter a contest'; END IF;
  SELECT * INTO v_contest FROM public.contests WHERE slug = p_slug AND is_published AND archived_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contest not found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.contest_registrations registration WHERE registration.contest_id = v_contest.id AND registration.user_id = auth.uid()) THEN RAISE EXCEPTION 'Register for this contest before entering'; END IF;
  IF now() < v_contest.start_at THEN RAISE EXCEPTION 'Contest has not started'; END IF;
  IF now() >= v_contest.end_at THEN RAISE EXCEPTION 'Contest has finished'; END IF;
  SELECT jsonb_build_object(
    'contest', jsonb_build_object('id', contest.id, 'slug', contest.slug, 'title', contest.title, 'subject', contest.subject, 'start_at', contest.start_at, 'end_at', contest.end_at, 'contest_type', contest.contest_type, 'completed_at', registration.completed_at),
    'exam_timing', CASE WHEN contest.subject IN ('ielts', 'cefr') THEN (SELECT jsonb_build_object('listening_minutes', timing.listening_minutes, 'reading_minutes', timing.reading_minutes, 'writing_minutes', timing.writing_minutes, 'active_section', public.current_exam_section(contest.id), 'section_starts_at', CASE public.current_exam_section(contest.id) WHEN 'listening' THEN contest.start_at WHEN 'reading' THEN contest.start_at + (timing.listening_minutes * interval '1 minute') ELSE contest.start_at + ((timing.listening_minutes + timing.reading_minutes) * interval '1 minute') END, 'section_ends_at', CASE public.current_exam_section(contest.id) WHEN 'listening' THEN contest.start_at + (timing.listening_minutes * interval '1 minute') WHEN 'reading' THEN contest.start_at + ((timing.listening_minutes + timing.reading_minutes) * interval '1 minute') ELSE contest.end_at END) FROM public.contest_exam_section_timings timing WHERE timing.contest_id = contest.id) ELSE NULL END,
    'parts', coalesce((SELECT jsonb_agg(jsonb_build_object('id', part.id, 'position', part.position, 'section', part.section, 'title', part.title, 'instructions', part.instructions, 'content', part.content, 'audio_url', part.audio_url, 'image_url', part.image_url, 'max_points', part.max_points) ORDER BY part.position) FROM public.contest_exam_parts part WHERE part.contest_id = contest.id AND (contest.subject NOT IN ('ielts', 'cefr') OR part.section = public.current_exam_section(contest.id))), '[]'::jsonb),
    'questions', coalesce((SELECT jsonb_agg(jsonb_build_object('id', question.id, 'exam_part_id', question.exam_part_id, 'position', question.position, 'prompt', question.prompt, 'options', question.options, 'answer_type', question.answer_type, 'word_limit', question.word_limit, 'points', question.points) ORDER BY question.position) FROM public.contest_questions question WHERE question.contest_id = contest.id AND (contest.subject NOT IN ('ielts', 'cefr') OR EXISTS (SELECT 1 FROM public.contest_exam_parts part WHERE part.id = question.exam_part_id AND part.section = public.current_exam_section(contest.id)))), '[]'::jsonb),
    'answers', coalesce((SELECT jsonb_agg(jsonb_build_object('question_id', answer.question_id, 'selected_option', answer.selected_option, 'selected_text', answer.selected_text) ORDER BY question.position) FROM public.contest_answers answer JOIN public.contest_questions question ON question.id = answer.question_id WHERE answer.contest_id = contest.id AND answer.user_id = auth.uid() AND (contest.subject NOT IN ('ielts', 'cefr') OR EXISTS (SELECT 1 FROM public.contest_exam_parts part WHERE part.id = question.exam_part_id AND part.section = public.current_exam_section(contest.id)))), '[]'::jsonb),
    'gap_fill_responses', coalesce((SELECT jsonb_agg(jsonb_build_object('part_id', response.exam_part_id, 'blank_number', response.blank_number, 'answer', response.answer) ORDER BY response.exam_part_id, response.blank_number) FROM public.contest_gap_fill_responses response JOIN public.contest_exam_parts part ON part.id = response.exam_part_id WHERE response.contest_id = contest.id AND response.user_id = auth.uid() AND part.section = public.current_exam_section(contest.id)), '[]'::jsonb),
    'matching_configs', coalesce((SELECT jsonb_agg(jsonb_build_object('part_id', part.id, 'options', coalesce((SELECT jsonb_agg(jsonb_build_object('position', option.option_position, 'label', option.label) ORDER BY option.option_position) FROM public.contest_matching_options option WHERE option.exam_part_id = part.id), '[]'::jsonb), 'speakers', coalesce((SELECT jsonb_agg(jsonb_build_object('speaker_number', speaker.speaker_number, 'label', speaker.label) ORDER BY speaker.speaker_number) FROM public.contest_matching_speakers speaker WHERE speaker.exam_part_id = part.id), '[]'::jsonb)) ORDER BY part.position) FROM public.contest_exam_parts part WHERE part.contest_id = contest.id AND part.section = public.current_exam_section(contest.id) AND contest.subject = 'cefr' AND ((part.section = 'listening' AND part.position IN (3, 4)) OR (part.section = 'reading' AND part.position IN (2, 4)))), '[]'::jsonb),
    'matching_responses', coalesce((SELECT jsonb_agg(jsonb_build_object('part_id', response.exam_part_id, 'speaker_number', response.speaker_number, 'option_position', response.option_position) ORDER BY response.exam_part_id, response.speaker_number) FROM public.contest_matching_responses response JOIN public.contest_exam_parts part ON part.id = response.exam_part_id WHERE response.contest_id = contest.id AND response.user_id = auth.uid() AND part.section = public.current_exam_section(contest.id)), '[]'::jsonb),
    'writing_responses', coalesce((SELECT jsonb_agg(jsonb_build_object('part_id', submission.exam_part_id, 'content', submission.content, 'submitted_at', submission.submitted_at, 'updated_at', submission.updated_at) ORDER BY part.position) FROM public.contest_writing_submissions submission JOIN public.contest_exam_parts part ON part.id = submission.exam_part_id WHERE submission.contest_id = contest.id AND submission.user_id = auth.uid() AND (contest.subject NOT IN ('ielts', 'cefr') OR part.section = public.current_exam_section(contest.id))), '[]'::jsonb)
  ) INTO v_payload FROM public.contests contest JOIN public.contest_registrations registration ON registration.contest_id = contest.id AND registration.user_id = auth.uid() WHERE contest.id = v_contest.id;
  RETURN v_payload;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_cefr_reading_question()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE v_part public.contest_exam_parts%ROWTYPE; v_subject text;
BEGIN
  IF NEW.exam_part_id IS NULL THEN RETURN NEW; END IF;
  SELECT part.* INTO v_part FROM public.contest_exam_parts part WHERE part.id = NEW.exam_part_id AND part.contest_id = NEW.contest_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  SELECT subject INTO v_subject FROM public.contests WHERE id = NEW.contest_id;
  IF v_subject <> 'cefr' OR v_part.section <> 'reading' THEN RETURN NEW; END IF;
  IF v_part.position = 3 THEN
    IF NEW.position NOT BETWEEN 17 AND 24 THEN RAISE EXCEPTION 'CEFR Reading Part 3 question numbers must be between 17 and 24'; END IF;
    IF NEW.correct_option IS NULL OR NEW.options <> jsonb_build_array('True', 'False', 'Not Given') THEN RAISE EXCEPTION 'CEFR Reading Part 3 must use True, False, Not Given and an answer key'; END IF;
  ELSIF v_part.position = 5 THEN
    IF NEW.position NOT BETWEEN 33 AND 35 THEN RAISE EXCEPTION 'CEFR Reading Part 5 question numbers must be between 33 and 35'; END IF;
    IF NEW.correct_option IS NULL THEN RAISE EXCEPTION 'Every CEFR Reading Part 5 question needs an answer key'; END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contest_questions_validate_cefr_reading ON public.contest_questions;
CREATE TRIGGER contest_questions_validate_cefr_reading BEFORE INSERT OR UPDATE OF contest_id, exam_part_id, position, options, correct_option ON public.contest_questions FOR EACH ROW EXECUTE FUNCTION public.validate_cefr_reading_question();

CREATE OR REPLACE FUNCTION public.validate_cefr_reading_before_publish()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE v_part public.contest_exam_parts%ROWTYPE; v_count integer; v_distinct integer; v_key_count integer; v_expected integer[];
BEGIN
  IF NOT NEW.is_published OR OLD.is_published OR NEW.subject <> 'cefr' THEN RETURN NEW; END IF;
  IF (SELECT count(*) FROM public.contest_exam_parts WHERE contest_id = NEW.id AND section = 'reading') <> 5
    OR EXISTS (SELECT 1 FROM public.contest_exam_parts WHERE contest_id = NEW.id AND section = 'reading' AND position NOT BETWEEN 1 AND 5) THEN
    RAISE EXCEPTION 'CEFR Reading requires exactly five parts, numbered 1 through 5';
  END IF;
  FOR v_part IN SELECT * FROM public.contest_exam_parts WHERE contest_id = NEW.id AND section = 'reading' LOOP
    v_expected := CASE v_part.position WHEN 1 THEN ARRAY[1,2,3,4,5,6,7,8]::integer[] WHEN 2 THEN ARRAY[9,10,11,12,13,14,15,16]::integer[] WHEN 3 THEN ARRAY[17,18,19,20,21,22,23,24]::integer[] WHEN 4 THEN ARRAY[25,26,27,28,29,30,31,32]::integer[] ELSE ARRAY[33,34,35]::integer[] END;
    IF v_part.position = 1 THEN
      IF (SELECT array_agg(DISTINCT (marker.values)[1]::integer ORDER BY (marker.values)[1]::integer) FROM regexp_matches(v_part.content, '\{\{([1-9][0-9]*)\}\}', 'g') marker(values)) IS DISTINCT FROM v_expected
        OR (SELECT count(*) FROM public.contest_gap_fill_answer_keys key WHERE key.exam_part_id = v_part.id AND key.blank_number = ANY(v_expected)) <> 8 THEN
        RAISE EXCEPTION 'CEFR Reading Part 1 needs exactly {{1}} through {{8}} and every answer key';
      END IF;
    ELSIF v_part.position IN (2, 4) THEN
      SELECT count(*)::integer, count(*) FILTER (WHERE correct_option_position IS NOT NULL)::integer INTO v_count, v_key_count FROM public.contest_matching_speakers WHERE exam_part_id = v_part.id AND speaker_number = ANY(v_expected);
      IF v_count <> array_length(v_expected, 1) OR v_key_count <> array_length(v_expected, 1) OR NOT EXISTS (SELECT 1 FROM public.contest_matching_options WHERE exam_part_id = v_part.id) THEN RAISE EXCEPTION 'CEFR Reading Part % needs its complete matching answer bank and keys', v_part.position; END IF;
    ELSE
      SELECT count(*)::integer, count(DISTINCT position)::integer, count(*) FILTER (WHERE correct_option IS NOT NULL)::integer INTO v_count, v_distinct, v_key_count FROM public.contest_questions WHERE contest_id = NEW.id AND exam_part_id = v_part.id AND position = ANY(v_expected);
      IF v_count <> array_length(v_expected, 1) OR v_distinct <> array_length(v_expected, 1) OR v_key_count <> array_length(v_expected, 1) THEN RAISE EXCEPTION 'CEFR Reading Part % needs every required question and answer key', v_part.position; END IF;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contests_validate_cefr_reading_publish ON public.contests;
CREATE TRIGGER contests_validate_cefr_reading_publish BEFORE UPDATE OF is_published ON public.contests FOR EACH ROW EXECUTE FUNCTION public.validate_cefr_reading_before_publish();

REVOKE ALL ON FUNCTION public.save_cefr_matching_config(uuid, uuid, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_cefr_matching_response(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_cefr_gap_fill_answer_keys(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_cefr_gap_fill_response(uuid, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_contest_editor(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_contest_workspace(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_cefr_reading_question() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_cefr_reading_before_publish() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_cefr_matching_config(uuid, uuid, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_cefr_matching_response(uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_cefr_gap_fill_answer_keys(uuid, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_cefr_gap_fill_response(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_contest_editor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_contest_workspace(text) TO authenticated;

NOTIFY pgrst, 'reload schema';
