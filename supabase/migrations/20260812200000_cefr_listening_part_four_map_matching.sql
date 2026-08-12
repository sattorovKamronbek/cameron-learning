-- CEFR Listening Part 4 uses a high-resolution map/photo plus the matching
-- model already used by Part 3.  Image URLs are only attachable to CEFR Part 4.

ALTER TABLE public.contest_exam_parts
  ADD COLUMN IF NOT EXISTS image_url text;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('contest-images', 'contest-images', true, 12582912, ARRAY['image/jpeg', 'image/png', 'image/webp']::text[])
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS contest_images_public_read ON storage.objects;
CREATE POLICY contest_images_public_read ON storage.objects FOR SELECT TO public USING (bucket_id = 'contest-images');
DROP POLICY IF EXISTS contest_images_judge_upload ON storage.objects;
CREATE POLICY contest_images_judge_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'contest-images' AND owner_id = auth.uid()::text AND public.can_upload_contest_audio());
DROP POLICY IF EXISTS contest_images_owner_update ON storage.objects;
CREATE POLICY contest_images_owner_update ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'contest-images' AND owner_id = auth.uid()::text AND public.can_upload_contest_audio()) WITH CHECK (bucket_id = 'contest-images' AND owner_id = auth.uid()::text AND public.can_upload_contest_audio());
DROP POLICY IF EXISTS contest_images_owner_delete ON storage.objects;
CREATE POLICY contest_images_owner_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'contest-images' AND owner_id = auth.uid()::text AND public.can_upload_contest_audio());

CREATE OR REPLACE FUNCTION public.save_cefr_map_image(p_contest_id uuid, p_exam_part_id uuid, p_image_url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_contest public.contests%ROWTYPE; v_part public.contest_exam_parts%ROWTYPE;
BEGIN
  IF NOT public.can_manage_contest(p_contest_id) THEN RAISE EXCEPTION 'Only the owning judge or an admin can manage a map image'; END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id FOR UPDATE;
  IF NOT FOUND OR v_contest.subject <> 'cefr' THEN RAISE EXCEPTION 'CEFR contest not found'; END IF;
  IF v_contest.is_published OR v_contest.start_at <= now() THEN RAISE EXCEPTION 'Map images cannot be changed after publication or start'; END IF;
  SELECT * INTO v_part FROM public.contest_exam_parts WHERE id = p_exam_part_id AND contest_id = p_contest_id;
  IF NOT FOUND OR v_part.section <> 'listening' OR v_part.position <> 4 THEN RAISE EXCEPTION 'Map images are available only for CEFR Listening Part 4'; END IF;
  IF nullif(trim(coalesce(p_image_url, '')), '') IS NULL THEN
    UPDATE public.contest_exam_parts SET image_url = NULL WHERE id = p_exam_part_id;
  ELSIF p_image_url ~ '^https?://' AND char_length(trim(p_image_url)) <= 5000 THEN
    UPDATE public.contest_exam_parts SET image_url = trim(p_image_url) WHERE id = p_exam_part_id;
  ELSE
    RAISE EXCEPTION 'Enter a valid image URL';
  END IF;
  PERFORM public.log_audit_action('contest.map_image.save', 'contest', p_contest_id, jsonb_build_object('part_id', p_exam_part_id));
END;
$$;

CREATE OR REPLACE FUNCTION public.save_cefr_matching_config(p_contest_id uuid, p_exam_part_id uuid, p_options jsonb, p_speakers jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_contest public.contests%ROWTYPE; v_part public.contest_exam_parts%ROWTYPE; v_option jsonb; v_speaker jsonb; v_index integer; v_correct_option integer;
BEGIN
  IF NOT public.can_manage_contest(p_contest_id) THEN RAISE EXCEPTION 'Only the owning judge or an admin can manage matching'; END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id FOR UPDATE;
  IF NOT FOUND OR v_contest.subject <> 'cefr' THEN RAISE EXCEPTION 'CEFR contest not found'; END IF;
  IF v_contest.is_published OR v_contest.start_at <= now() THEN RAISE EXCEPTION 'Matching cannot be changed after publication or start'; END IF;
  SELECT * INTO v_part FROM public.contest_exam_parts WHERE id = p_exam_part_id AND contest_id = p_contest_id;
  IF NOT FOUND OR v_part.section <> 'listening' OR v_part.position NOT IN (3, 4) THEN RAISE EXCEPTION 'Matching is available only for CEFR Listening Part 3 or Part 4'; END IF;
  IF coalesce(jsonb_typeof(p_options), '') <> 'array' OR jsonb_array_length(p_options) NOT BETWEEN 2 AND 12 THEN RAISE EXCEPTION 'Add between two and twelve answer-bank options'; END IF;
  IF coalesce(jsonb_typeof(p_speakers), '') <> 'array' OR jsonb_array_length(p_speakers) NOT BETWEEN 1 AND 10 THEN RAISE EXCEPTION 'Add between one and ten entries'; END IF;
  DELETE FROM public.contest_matching_speakers WHERE exam_part_id = p_exam_part_id;
  DELETE FROM public.contest_matching_options WHERE exam_part_id = p_exam_part_id;
  FOR v_index IN 0..jsonb_array_length(p_options) - 1 LOOP
    v_option := p_options -> v_index;
    IF jsonb_typeof(v_option) <> 'object' OR char_length(trim(coalesce(v_option->>'label', ''))) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Every answer-bank option needs text'; END IF;
    INSERT INTO public.contest_matching_options (contest_id, exam_part_id, option_position, label) VALUES (p_contest_id, p_exam_part_id, v_index, trim(v_option->>'label'));
  END LOOP;
  FOR v_index IN 0..jsonb_array_length(p_speakers) - 1 LOOP
    v_speaker := p_speakers -> v_index;
    IF jsonb_typeof(v_speaker) <> 'object' OR char_length(trim(coalesce(v_speaker->>'label', ''))) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Every entry needs a label'; END IF;
    v_correct_option := CASE WHEN v_speaker->'correct_option' IS NULL OR v_speaker->'correct_option' = 'null'::jsonb THEN NULL ELSE (v_speaker->>'correct_option')::integer END;
    IF v_correct_option IS NOT NULL AND v_correct_option NOT BETWEEN 0 AND jsonb_array_length(p_options) - 1 THEN RAISE EXCEPTION 'An answer key points outside the answer bank'; END IF;
    INSERT INTO public.contest_matching_speakers (contest_id, exam_part_id, speaker_number, label, correct_option_position) VALUES (p_contest_id, p_exam_part_id, v_index + 1, trim(v_speaker->>'label'), v_correct_option);
  END LOOP;
  PERFORM public.log_audit_action('contest.matching_config.save', 'contest', p_contest_id, jsonb_build_object('part_id', p_exam_part_id, 'entry_count', jsonb_array_length(p_speakers), 'option_count', jsonb_array_length(p_options)));
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
    'parts', coalesce((SELECT jsonb_agg(jsonb_build_object('id', part.id, 'position', part.position, 'section', part.section, 'title', part.title, 'instructions', part.instructions, 'content', part.content, 'audio_url', part.audio_url, 'image_url', part.image_url, 'max_points', part.max_points) ORDER BY part.position) FROM public.contest_exam_parts part WHERE part.contest_id = contest.id), '[]'::jsonb),
    'questions', coalesce((SELECT jsonb_agg(jsonb_build_object('id', question.id, 'exam_part_id', question.exam_part_id, 'position', question.position, 'prompt', question.prompt, 'options', question.options, 'correct_option', question.correct_option, 'points', question.points, 'explanation', question.explanation) ORDER BY question.position) FROM public.contest_questions question WHERE question.contest_id = contest.id), '[]'::jsonb),
    'gap_fill_answer_keys', coalesce((SELECT jsonb_agg(jsonb_build_object('part_id', key.exam_part_id, 'blank_number', key.blank_number, 'accepted_answers', key.accepted_answers, 'points', key.points) ORDER BY key.exam_part_id, key.blank_number) FROM public.contest_gap_fill_answer_keys key WHERE key.contest_id = contest.id), '[]'::jsonb),
    'matching_configs', coalesce((SELECT jsonb_agg(jsonb_build_object('part_id', part.id, 'options', coalesce((SELECT jsonb_agg(jsonb_build_object('position', option.option_position, 'label', option.label) ORDER BY option.option_position) FROM public.contest_matching_options option WHERE option.exam_part_id = part.id), '[]'::jsonb), 'speakers', coalesce((SELECT jsonb_agg(jsonb_build_object('speaker_number', speaker.speaker_number, 'label', speaker.label, 'correct_option', speaker.correct_option_position) ORDER BY speaker.speaker_number) FROM public.contest_matching_speakers speaker WHERE speaker.exam_part_id = part.id), '[]'::jsonb)) ORDER BY part.position) FROM public.contest_exam_parts part WHERE part.contest_id = contest.id AND contest.subject = 'cefr' AND part.section = 'listening' AND part.position IN (3, 4)), '[]'::jsonb)
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
    'questions', coalesce((SELECT jsonb_agg(jsonb_build_object('id', question.id, 'exam_part_id', question.exam_part_id, 'position', question.position, 'prompt', question.prompt, 'options', question.options, 'points', question.points) ORDER BY question.position) FROM public.contest_questions question WHERE question.contest_id = contest.id AND (contest.subject NOT IN ('ielts', 'cefr') OR EXISTS (SELECT 1 FROM public.contest_exam_parts part WHERE part.id = question.exam_part_id AND part.section = public.current_exam_section(contest.id)))), '[]'::jsonb),
    'answers', coalesce((SELECT jsonb_agg(jsonb_build_object('question_id', answer.question_id, 'selected_option', answer.selected_option) ORDER BY question.position) FROM public.contest_answers answer JOIN public.contest_questions question ON question.id = answer.question_id WHERE answer.contest_id = contest.id AND answer.user_id = auth.uid() AND (contest.subject NOT IN ('ielts', 'cefr') OR EXISTS (SELECT 1 FROM public.contest_exam_parts part WHERE part.id = question.exam_part_id AND part.section = public.current_exam_section(contest.id)))), '[]'::jsonb),
    'gap_fill_responses', coalesce((SELECT jsonb_agg(jsonb_build_object('part_id', response.exam_part_id, 'blank_number', response.blank_number, 'answer', response.answer) ORDER BY response.exam_part_id, response.blank_number) FROM public.contest_gap_fill_responses response JOIN public.contest_exam_parts part ON part.id = response.exam_part_id WHERE response.contest_id = contest.id AND response.user_id = auth.uid() AND part.section = public.current_exam_section(contest.id)), '[]'::jsonb),
    'matching_configs', coalesce((SELECT jsonb_agg(jsonb_build_object('part_id', part.id, 'options', coalesce((SELECT jsonb_agg(jsonb_build_object('position', option.option_position, 'label', option.label) ORDER BY option.option_position) FROM public.contest_matching_options option WHERE option.exam_part_id = part.id), '[]'::jsonb), 'speakers', coalesce((SELECT jsonb_agg(jsonb_build_object('speaker_number', speaker.speaker_number, 'label', speaker.label) ORDER BY speaker.speaker_number) FROM public.contest_matching_speakers speaker WHERE speaker.exam_part_id = part.id), '[]'::jsonb)) ORDER BY part.position) FROM public.contest_exam_parts part WHERE part.contest_id = contest.id AND part.section = public.current_exam_section(contest.id) AND contest.subject = 'cefr' AND part.position IN (3, 4)), '[]'::jsonb),
    'matching_responses', coalesce((SELECT jsonb_agg(jsonb_build_object('part_id', response.exam_part_id, 'speaker_number', response.speaker_number, 'option_position', response.option_position) ORDER BY response.exam_part_id, response.speaker_number) FROM public.contest_matching_responses response JOIN public.contest_exam_parts part ON part.id = response.exam_part_id WHERE response.contest_id = contest.id AND response.user_id = auth.uid() AND part.section = public.current_exam_section(contest.id)), '[]'::jsonb),
    'writing_responses', coalesce((SELECT jsonb_agg(jsonb_build_object('part_id', submission.exam_part_id, 'content', submission.content, 'submitted_at', submission.submitted_at, 'updated_at', submission.updated_at) ORDER BY part.position) FROM public.contest_writing_submissions submission JOIN public.contest_exam_parts part ON part.id = submission.exam_part_id WHERE submission.contest_id = contest.id AND submission.user_id = auth.uid() AND (contest.subject NOT IN ('ielts', 'cefr') OR part.section = public.current_exam_section(contest.id))), '[]'::jsonb)
  ) INTO v_payload FROM public.contests contest JOIN public.contest_registrations registration ON registration.contest_id = contest.id AND registration.user_id = auth.uid() WHERE contest.id = v_contest.id;
  RETURN v_payload;
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
  IF NOT FOUND OR v_part.section <> 'listening' OR v_part.position NOT IN (3, 4) THEN RAISE EXCEPTION 'CEFR Listening matching part not found'; END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = v_part.contest_id;
  IF v_contest.subject <> 'cefr' OR NOT v_contest.is_published OR v_contest.archived_at IS NOT NULL OR now() < v_contest.start_at OR now() >= v_contest.end_at THEN RAISE EXCEPTION 'Answers are not accepted for this contest at this time'; END IF;
  IF v_contest.contest_type = 'rated' AND (v_contest.created_by = auth.uid() OR public.has_admin_access(auth.uid())) THEN RAISE EXCEPTION 'Contest managers cannot submit a rated exam'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.contest_registrations registration WHERE registration.contest_id = v_contest.id AND registration.user_id = auth.uid()) THEN RAISE EXCEPTION 'Register for this exam before submitting'; END IF;
  IF EXISTS (SELECT 1 FROM public.contest_registrations registration WHERE registration.contest_id = v_contest.id AND registration.user_id = auth.uid() AND registration.completed_at IS NOT NULL) THEN RAISE EXCEPTION 'This exam has already been submitted'; END IF;
  SELECT * INTO v_timing FROM public.contest_exam_section_timings WHERE contest_id = v_contest.id;
  IF NOT FOUND OR now() >= v_contest.start_at + (v_timing.listening_minutes * interval '1 minute') THEN RAISE EXCEPTION 'The Listening section is closed'; END IF;
  SELECT * INTO v_speaker FROM public.contest_matching_speakers WHERE exam_part_id = p_exam_part_id AND speaker_number = p_speaker_number;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.contest_matching_options WHERE exam_part_id = p_exam_part_id AND option_position = p_option_position) THEN RAISE EXCEPTION 'Invalid item or map option'; END IF;
  v_correct := p_option_position = v_speaker.correct_option_position;
  INSERT INTO public.contest_matching_responses (contest_id, exam_part_id, speaker_number, user_id, option_position, is_correct, score) VALUES (v_contest.id, p_exam_part_id, p_speaker_number, auth.uid(), p_option_position, v_correct, CASE WHEN v_correct THEN 1 ELSE 0 END)
  ON CONFLICT (exam_part_id, speaker_number, user_id) DO UPDATE SET option_position = EXCLUDED.option_position, is_correct = EXCLUDED.is_correct, score = EXCLUDED.score, submitted_at = now();
  UPDATE public.contest_registrations SET last_activity_at = now() WHERE contest_id = v_contest.id AND user_id = auth.uid();
  RETURN jsonb_build_object('saved', true, 'part_id', p_exam_part_id, 'speaker_number', p_speaker_number);
END;
$$;

CREATE OR REPLACE FUNCTION public.publish_contest(p_contest_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_contest public.contests%ROWTYPE; v_part record; v_timing public.contest_exam_section_timings%ROWTYPE;
BEGIN
  IF NOT public.can_manage_contest(p_contest_id) THEN RAISE EXCEPTION 'Only the owning judge or an admin can publish this contest'; END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contest not found'; END IF;
  IF v_contest.is_published THEN RAISE EXCEPTION 'Contest is already published'; END IF;
  IF v_contest.start_at <= now() OR v_contest.end_at <= v_contest.start_at THEN RAISE EXCEPTION 'Contest schedule is no longer valid'; END IF;
  IF v_contest.subject = 'programming' THEN
    IF NOT EXISTS (SELECT 1 FROM public.contest_programming_problems WHERE contest_id = p_contest_id) THEN RAISE EXCEPTION 'Add at least one programming problem before publishing'; END IF;
  ELSIF v_contest.subject IN ('ielts', 'cefr') THEN
    SELECT * INTO v_timing FROM public.contest_exam_section_timings WHERE contest_id = p_contest_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Set Listening, Reading and Writing times before publishing'; END IF;
    IF extract(epoch FROM (v_contest.end_at - v_contest.start_at)) <> (v_timing.listening_minutes + v_timing.reading_minutes + v_timing.writing_minutes) * 60 THEN RAISE EXCEPTION 'Section timings must exactly equal the contest duration'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.contest_exam_parts WHERE contest_id = p_contest_id) THEN RAISE EXCEPTION 'Add at least one IELTS or CEFR exam part before publishing'; END IF;
    IF EXISTS (SELECT 1 FROM unnest(ARRAY['listening', 'reading', 'writing']::text[]) required(section) WHERE NOT EXISTS (SELECT 1 FROM public.contest_exam_parts part WHERE part.contest_id = p_contest_id AND part.section = required.section)) THEN RAISE EXCEPTION 'IELTS and CEFR exams require Listening, Reading, and Writing parts'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.contest_questions WHERE contest_id = p_contest_id) AND NOT EXISTS (SELECT 1 FROM public.contest_gap_fill_answer_keys WHERE contest_id = p_contest_id) AND NOT EXISTS (SELECT 1 FROM public.contest_matching_speakers WHERE contest_id = p_contest_id) THEN RAISE EXCEPTION 'Add at least one scorable listening or reading activity before publishing'; END IF;
    IF EXISTS (SELECT 1 FROM public.contest_questions WHERE contest_id = p_contest_id AND exam_part_id IS NULL) THEN RAISE EXCEPTION 'Every IELTS or CEFR question must be assigned to a part'; END IF;
    IF EXISTS (SELECT 1 FROM public.contest_questions question JOIN public.contest_exam_parts part ON part.id = question.exam_part_id WHERE question.contest_id = p_contest_id AND part.section = 'listening' AND part.position = 1 AND v_contest.subject = 'cefr' AND question.correct_option IS NULL) THEN RAISE EXCEPTION 'Select every CEFR Listening Part 1 correct option before publishing'; END IF;
    FOR v_part IN SELECT * FROM public.contest_exam_parts WHERE contest_id = p_contest_id LOOP
      IF v_part.section = 'listening' AND nullif(trim(v_part.audio_url), '') IS NULL THEN RAISE EXCEPTION 'Every listening part must include an audio file'; END IF;
      IF v_part.section IN ('reading', 'writing') AND char_length(trim(v_part.content)) < 1 THEN RAISE EXCEPTION 'Every reading passage and writing topic must contain text'; END IF;
      IF v_contest.subject = 'cefr' AND v_part.section = 'listening' AND v_part.position = 2 THEN
        IF NOT EXISTS (SELECT 1 FROM regexp_matches(v_part.content, '\{\{([1-9][0-9]*)\}\}', 'g')) THEN RAISE EXCEPTION 'CEFR Listening Part 2 needs {{1}}, {{2}} style blanks in its text'; END IF;
        IF EXISTS (SELECT 1 FROM regexp_matches(v_part.content, '\{\{([1-9][0-9]*)\}\}', 'g') marker(values) LEFT JOIN public.contest_gap_fill_answer_keys key ON key.exam_part_id = v_part.id AND key.blank_number = (marker.values)[1]::integer WHERE key.id IS NULL) THEN RAISE EXCEPTION 'Save every CEFR Listening Part 2 answer key before publishing'; END IF;
      ELSIF v_contest.subject = 'cefr' AND v_part.section = 'listening' AND v_part.position IN (3, 4) THEN
        IF v_part.position = 4 AND nullif(trim(v_part.image_url), '') IS NULL THEN RAISE EXCEPTION 'CEFR Listening Part 4 needs a high-resolution map or photo'; END IF;
        IF NOT EXISTS (SELECT 1 FROM public.contest_matching_options WHERE exam_part_id = v_part.id) OR NOT EXISTS (SELECT 1 FROM public.contest_matching_speakers WHERE exam_part_id = v_part.id) THEN RAISE EXCEPTION 'Configure the CEFR Listening matching answer bank before publishing'; END IF;
        IF EXISTS (SELECT 1 FROM public.contest_matching_speakers WHERE exam_part_id = v_part.id AND correct_option_position IS NULL) THEN RAISE EXCEPTION 'Select every CEFR Listening matching answer key before publishing'; END IF;
      ELSIF v_part.section IN ('listening', 'reading') AND NOT EXISTS (SELECT 1 FROM public.contest_questions WHERE exam_part_id = v_part.id) THEN
        RAISE EXCEPTION 'Every listening and reading part must have at least one question';
      END IF;
    END LOOP;
  ELSIF NOT EXISTS (SELECT 1 FROM public.contest_questions WHERE contest_id = p_contest_id) THEN
    RAISE EXCEPTION 'Add at least one complete question before publishing';
  END IF;
  UPDATE public.contests SET is_published = true WHERE id = p_contest_id;
  PERFORM public.log_audit_action('contest.publish', 'contest', p_contest_id, '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.save_cefr_map_image(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_cefr_matching_config(uuid, uuid, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_cefr_matching_response(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_contest_editor(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_contest_workspace(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.publish_contest(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_cefr_map_image(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_cefr_matching_config(uuid, uuid, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_cefr_matching_response(uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_contest_editor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_contest_workspace(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_contest(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
