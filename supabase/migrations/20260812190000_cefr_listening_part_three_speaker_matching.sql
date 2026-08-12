-- CEFR Listening Part 3: several speakers map to one shared A/B/C… answer
-- bank. Extra answer-bank entries are intentionally allowed.

CREATE TABLE IF NOT EXISTS public.contest_matching_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  exam_part_id uuid NOT NULL,
  option_position integer NOT NULL CHECK (option_position BETWEEN 0 AND 25),
  label text NOT NULL CHECK (char_length(trim(label)) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (exam_part_id, option_position),
  CONSTRAINT contest_matching_options_part_contest_fkey
    FOREIGN KEY (exam_part_id, contest_id)
    REFERENCES public.contest_exam_parts(id, contest_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.contest_matching_speakers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  exam_part_id uuid NOT NULL,
  speaker_number integer NOT NULL CHECK (speaker_number BETWEEN 1 AND 25),
  label text NOT NULL CHECK (char_length(trim(label)) BETWEEN 1 AND 200),
  correct_option_position integer CHECK (correct_option_position BETWEEN 0 AND 25),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (exam_part_id, speaker_number),
  CONSTRAINT contest_matching_speakers_part_contest_fkey
    FOREIGN KEY (exam_part_id, contest_id)
    REFERENCES public.contest_exam_parts(id, contest_id) ON DELETE CASCADE,
  CONSTRAINT contest_matching_speakers_correct_option_fkey
    FOREIGN KEY (exam_part_id, correct_option_position)
    REFERENCES public.contest_matching_options(exam_part_id, option_position)
    DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS public.contest_matching_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  exam_part_id uuid NOT NULL,
  speaker_number integer NOT NULL CHECK (speaker_number BETWEEN 1 AND 25),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  option_position integer NOT NULL CHECK (option_position BETWEEN 0 AND 25),
  is_correct boolean NOT NULL DEFAULT false,
  score integer NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 1000),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (exam_part_id, speaker_number, user_id),
  CONSTRAINT contest_matching_responses_speaker_fkey
    FOREIGN KEY (exam_part_id, speaker_number)
    REFERENCES public.contest_matching_speakers(exam_part_id, speaker_number) ON DELETE CASCADE,
  CONSTRAINT contest_matching_responses_option_fkey
    FOREIGN KEY (exam_part_id, option_position)
    REFERENCES public.contest_matching_options(exam_part_id, option_position) ON DELETE RESTRICT,
  CONSTRAINT contest_matching_responses_part_contest_fkey
    FOREIGN KEY (exam_part_id, contest_id)
    REFERENCES public.contest_exam_parts(id, contest_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS contest_matching_options_contest_idx ON public.contest_matching_options(contest_id, exam_part_id, option_position);
CREATE INDEX IF NOT EXISTS contest_matching_speakers_contest_idx ON public.contest_matching_speakers(contest_id, exam_part_id, speaker_number);
CREATE INDEX IF NOT EXISTS contest_matching_responses_contest_user_idx ON public.contest_matching_responses(contest_id, user_id, exam_part_id, speaker_number);

DROP TRIGGER IF EXISTS contest_matching_options_set_updated_at ON public.contest_matching_options;
CREATE TRIGGER contest_matching_options_set_updated_at BEFORE UPDATE ON public.contest_matching_options FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS contest_matching_speakers_set_updated_at ON public.contest_matching_speakers;
CREATE TRIGGER contest_matching_speakers_set_updated_at BEFORE UPDATE ON public.contest_matching_speakers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.contest_matching_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contest_matching_speakers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contest_matching_responses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.contest_matching_options, public.contest_matching_speakers, public.contest_matching_responses FROM PUBLIC, anon, authenticated;

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
AS $$
DECLARE
  v_contest public.contests%ROWTYPE;
  v_part public.contest_exam_parts%ROWTYPE;
  v_option jsonb;
  v_speaker jsonb;
  v_index integer;
  v_speaker_number integer;
  v_correct_option integer;
BEGIN
  IF NOT public.can_manage_contest(p_contest_id) THEN RAISE EXCEPTION 'Only the owning judge or an admin can manage speaker matching'; END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id FOR UPDATE;
  IF NOT FOUND OR v_contest.subject <> 'cefr' THEN RAISE EXCEPTION 'CEFR contest not found'; END IF;
  IF v_contest.is_published OR v_contest.start_at <= now() THEN RAISE EXCEPTION 'Speaker matching cannot be changed after publication or start'; END IF;
  SELECT * INTO v_part FROM public.contest_exam_parts WHERE id = p_exam_part_id AND contest_id = p_contest_id;
  IF NOT FOUND OR v_part.section <> 'listening' OR v_part.position <> 3 THEN RAISE EXCEPTION 'Speaker matching is available only for CEFR Listening Part 3'; END IF;
  IF coalesce(jsonb_typeof(p_options), '') <> 'array' OR jsonb_array_length(p_options) NOT BETWEEN 2 AND 12 THEN RAISE EXCEPTION 'Add between two and twelve answer-bank options'; END IF;
  IF coalesce(jsonb_typeof(p_speakers), '') <> 'array' OR jsonb_array_length(p_speakers) NOT BETWEEN 1 AND 10 THEN RAISE EXCEPTION 'Add between one and ten speakers'; END IF;

  DELETE FROM public.contest_matching_speakers WHERE exam_part_id = p_exam_part_id;
  DELETE FROM public.contest_matching_options WHERE exam_part_id = p_exam_part_id;

  FOR v_index IN 0..jsonb_array_length(p_options) - 1 LOOP
    v_option := p_options -> v_index;
    IF jsonb_typeof(v_option) <> 'object' OR char_length(trim(coalesce(v_option->>'label', ''))) NOT BETWEEN 1 AND 500 THEN
      RAISE EXCEPTION 'Every answer-bank option needs text';
    END IF;
    INSERT INTO public.contest_matching_options (contest_id, exam_part_id, option_position, label)
    VALUES (p_contest_id, p_exam_part_id, v_index, trim(v_option->>'label'));
  END LOOP;

  FOR v_index IN 0..jsonb_array_length(p_speakers) - 1 LOOP
    v_speaker := p_speakers -> v_index;
    v_speaker_number := v_index + 1;
    IF jsonb_typeof(v_speaker) <> 'object' OR char_length(trim(coalesce(v_speaker->>'label', ''))) NOT BETWEEN 1 AND 200 THEN
      RAISE EXCEPTION 'Every speaker needs a label';
    END IF;
    v_correct_option := CASE WHEN v_speaker->'correct_option' IS NULL OR v_speaker->'correct_option' = 'null'::jsonb THEN NULL ELSE (v_speaker->>'correct_option')::integer END;
    IF v_correct_option IS NOT NULL AND v_correct_option NOT BETWEEN 0 AND jsonb_array_length(p_options) - 1 THEN RAISE EXCEPTION 'A speaker answer key points outside the answer bank'; END IF;
    INSERT INTO public.contest_matching_speakers (contest_id, exam_part_id, speaker_number, label, correct_option_position)
    VALUES (p_contest_id, p_exam_part_id, v_speaker_number, trim(v_speaker->>'label'), v_correct_option);
  END LOOP;
  PERFORM public.log_audit_action('contest.matching_config.save', 'contest', p_contest_id, jsonb_build_object('part_id', p_exam_part_id, 'speaker_count', jsonb_array_length(p_speakers), 'option_count', jsonb_array_length(p_options)));
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
    'parts', coalesce((SELECT jsonb_agg(jsonb_build_object('id', part.id, 'position', part.position, 'section', part.section, 'title', part.title, 'instructions', part.instructions, 'content', part.content, 'audio_url', part.audio_url, 'max_points', part.max_points) ORDER BY part.position) FROM public.contest_exam_parts part WHERE part.contest_id = contest.id), '[]'::jsonb),
    'questions', coalesce((SELECT jsonb_agg(jsonb_build_object('id', question.id, 'exam_part_id', question.exam_part_id, 'position', question.position, 'prompt', question.prompt, 'options', question.options, 'correct_option', question.correct_option, 'points', question.points, 'explanation', question.explanation) ORDER BY question.position) FROM public.contest_questions question WHERE question.contest_id = contest.id), '[]'::jsonb),
    'gap_fill_answer_keys', coalesce((SELECT jsonb_agg(jsonb_build_object('part_id', key.exam_part_id, 'blank_number', key.blank_number, 'accepted_answers', key.accepted_answers, 'points', key.points) ORDER BY key.exam_part_id, key.blank_number) FROM public.contest_gap_fill_answer_keys key WHERE key.contest_id = contest.id), '[]'::jsonb),
    'matching_configs', coalesce((SELECT jsonb_agg(jsonb_build_object('part_id', part.id, 'options', coalesce((SELECT jsonb_agg(jsonb_build_object('position', option.option_position, 'label', option.label) ORDER BY option.option_position) FROM public.contest_matching_options option WHERE option.exam_part_id = part.id), '[]'::jsonb), 'speakers', coalesce((SELECT jsonb_agg(jsonb_build_object('speaker_number', speaker.speaker_number, 'label', speaker.label, 'correct_option', speaker.correct_option_position) ORDER BY speaker.speaker_number) FROM public.contest_matching_speakers speaker WHERE speaker.exam_part_id = part.id), '[]'::jsonb)) ORDER BY part.position) FROM public.contest_exam_parts part WHERE part.contest_id = contest.id AND contest.subject = 'cefr' AND part.section = 'listening' AND part.position = 3), '[]'::jsonb)
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
    'parts', coalesce((SELECT jsonb_agg(jsonb_build_object('id', part.id, 'position', part.position, 'section', part.section, 'title', part.title, 'instructions', part.instructions, 'content', part.content, 'audio_url', part.audio_url, 'max_points', part.max_points) ORDER BY part.position) FROM public.contest_exam_parts part WHERE part.contest_id = contest.id AND (contest.subject NOT IN ('ielts', 'cefr') OR part.section = public.current_exam_section(contest.id))), '[]'::jsonb),
    'questions', coalesce((SELECT jsonb_agg(jsonb_build_object('id', question.id, 'exam_part_id', question.exam_part_id, 'position', question.position, 'prompt', question.prompt, 'options', question.options, 'points', question.points) ORDER BY question.position) FROM public.contest_questions question WHERE question.contest_id = contest.id AND (contest.subject NOT IN ('ielts', 'cefr') OR EXISTS (SELECT 1 FROM public.contest_exam_parts part WHERE part.id = question.exam_part_id AND part.section = public.current_exam_section(contest.id)))), '[]'::jsonb),
    'answers', coalesce((SELECT jsonb_agg(jsonb_build_object('question_id', answer.question_id, 'selected_option', answer.selected_option) ORDER BY question.position) FROM public.contest_answers answer JOIN public.contest_questions question ON question.id = answer.question_id WHERE answer.contest_id = contest.id AND answer.user_id = auth.uid() AND (contest.subject NOT IN ('ielts', 'cefr') OR EXISTS (SELECT 1 FROM public.contest_exam_parts part WHERE part.id = question.exam_part_id AND part.section = public.current_exam_section(contest.id)))), '[]'::jsonb),
    'gap_fill_responses', coalesce((SELECT jsonb_agg(jsonb_build_object('part_id', response.exam_part_id, 'blank_number', response.blank_number, 'answer', response.answer) ORDER BY response.exam_part_id, response.blank_number) FROM public.contest_gap_fill_responses response JOIN public.contest_exam_parts part ON part.id = response.exam_part_id WHERE response.contest_id = contest.id AND response.user_id = auth.uid() AND part.section = public.current_exam_section(contest.id)), '[]'::jsonb),
    'matching_configs', coalesce((SELECT jsonb_agg(jsonb_build_object('part_id', part.id, 'options', coalesce((SELECT jsonb_agg(jsonb_build_object('position', option.option_position, 'label', option.label) ORDER BY option.option_position) FROM public.contest_matching_options option WHERE option.exam_part_id = part.id), '[]'::jsonb), 'speakers', coalesce((SELECT jsonb_agg(jsonb_build_object('speaker_number', speaker.speaker_number, 'label', speaker.label) ORDER BY speaker.speaker_number) FROM public.contest_matching_speakers speaker WHERE speaker.exam_part_id = part.id), '[]'::jsonb)) ORDER BY part.position) FROM public.contest_exam_parts part WHERE part.contest_id = contest.id AND part.section = public.current_exam_section(contest.id) AND contest.subject = 'cefr' AND part.position = 3), '[]'::jsonb),
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
  IF NOT FOUND OR v_part.section <> 'listening' OR v_part.position <> 3 THEN RAISE EXCEPTION 'CEFR Listening Part 3 not found'; END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = v_part.contest_id;
  IF v_contest.subject <> 'cefr' OR NOT v_contest.is_published OR v_contest.archived_at IS NOT NULL OR now() < v_contest.start_at OR now() >= v_contest.end_at THEN RAISE EXCEPTION 'Answers are not accepted for this contest at this time'; END IF;
  IF v_contest.contest_type = 'rated' AND (v_contest.created_by = auth.uid() OR public.has_admin_access(auth.uid())) THEN RAISE EXCEPTION 'Contest managers cannot submit a rated exam'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.contest_registrations registration WHERE registration.contest_id = v_contest.id AND registration.user_id = auth.uid()) THEN RAISE EXCEPTION 'Register for this exam before submitting'; END IF;
  IF EXISTS (SELECT 1 FROM public.contest_registrations registration WHERE registration.contest_id = v_contest.id AND registration.user_id = auth.uid() AND registration.completed_at IS NOT NULL) THEN RAISE EXCEPTION 'This exam has already been submitted'; END IF;
  SELECT * INTO v_timing FROM public.contest_exam_section_timings WHERE contest_id = v_contest.id;
  IF NOT FOUND OR now() >= v_contest.start_at + (v_timing.listening_minutes * interval '1 minute') THEN RAISE EXCEPTION 'The Listening section is closed'; END IF;
  SELECT * INTO v_speaker FROM public.contest_matching_speakers WHERE exam_part_id = p_exam_part_id AND speaker_number = p_speaker_number;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.contest_matching_options WHERE exam_part_id = p_exam_part_id AND option_position = p_option_position) THEN RAISE EXCEPTION 'Invalid speaker or answer-bank option'; END IF;
  v_correct := p_option_position = v_speaker.correct_option_position;
  INSERT INTO public.contest_matching_responses (contest_id, exam_part_id, speaker_number, user_id, option_position, is_correct, score)
  VALUES (v_contest.id, p_exam_part_id, p_speaker_number, auth.uid(), p_option_position, v_correct, CASE WHEN v_correct THEN 1 ELSE 0 END)
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
      ELSIF v_contest.subject = 'cefr' AND v_part.section = 'listening' AND v_part.position = 3 THEN
        IF NOT EXISTS (SELECT 1 FROM public.contest_matching_options WHERE exam_part_id = v_part.id) OR NOT EXISTS (SELECT 1 FROM public.contest_matching_speakers WHERE exam_part_id = v_part.id) THEN RAISE EXCEPTION 'Configure the CEFR Listening Part 3 speaker answer bank before publishing'; END IF;
        IF EXISTS (SELECT 1 FROM public.contest_matching_speakers WHERE exam_part_id = v_part.id AND correct_option_position IS NULL) THEN RAISE EXCEPTION 'Select every CEFR Listening Part 3 speaker answer key before publishing'; END IF;
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

CREATE OR REPLACE FUNCTION public.complete_exam_submission(p_contest_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_contest public.contests%ROWTYPE; v_question_count integer; v_answer_count integer; v_gap_fill_count integer; v_gap_fill_response_count integer; v_matching_count integer; v_matching_response_count integer; v_writing_count integer; v_writing_submitted_count integer; v_completed_at timestamptz;
BEGIN
  IF auth.uid() IS NULL OR NOT public.active_profile(auth.uid()) THEN RAISE EXCEPTION 'An active account is required to submit an exam'; END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id;
  IF NOT FOUND OR v_contest.subject NOT IN ('ielts', 'cefr') THEN RAISE EXCEPTION 'English exam not found'; END IF;
  IF NOT v_contest.is_published OR v_contest.archived_at IS NOT NULL OR now() < v_contest.start_at OR now() >= v_contest.end_at THEN RAISE EXCEPTION 'This exam cannot be submitted at this time'; END IF;
  IF v_contest.contest_type = 'rated' AND (v_contest.created_by = auth.uid() OR public.has_admin_access(auth.uid())) THEN RAISE EXCEPTION 'Contest managers cannot submit a rated exam'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.contest_registrations registration WHERE registration.contest_id = p_contest_id AND registration.user_id = auth.uid()) THEN RAISE EXCEPTION 'Register for this exam before submitting'; END IF;
  SELECT completed_at INTO v_completed_at FROM public.contest_registrations WHERE contest_id = p_contest_id AND user_id = auth.uid() FOR UPDATE;
  IF v_completed_at IS NOT NULL THEN RETURN jsonb_build_object('completed_at', v_completed_at, 'already_completed', true); END IF;
  SELECT count(*)::integer INTO v_question_count FROM public.contest_questions WHERE contest_id = p_contest_id;
  SELECT count(*)::integer INTO v_answer_count FROM public.contest_answers WHERE contest_id = p_contest_id AND user_id = auth.uid();
  IF v_answer_count <> v_question_count THEN RAISE EXCEPTION 'Answer every listening and reading question before submitting the exam'; END IF;
  SELECT count(*)::integer INTO v_gap_fill_count FROM public.contest_gap_fill_answer_keys WHERE contest_id = p_contest_id;
  SELECT count(*)::integer INTO v_gap_fill_response_count FROM public.contest_gap_fill_responses WHERE contest_id = p_contest_id AND user_id = auth.uid();
  IF v_gap_fill_response_count <> v_gap_fill_count THEN RAISE EXCEPTION 'Fill every CEFR Part 2 blank before submitting the exam'; END IF;
  SELECT count(*)::integer INTO v_matching_count FROM public.contest_matching_speakers WHERE contest_id = p_contest_id;
  SELECT count(*)::integer INTO v_matching_response_count FROM public.contest_matching_responses WHERE contest_id = p_contest_id AND user_id = auth.uid();
  IF v_matching_response_count <> v_matching_count THEN RAISE EXCEPTION 'Match every CEFR Part 3 speaker before submitting the exam'; END IF;
  SELECT count(*)::integer INTO v_writing_count FROM public.contest_exam_parts WHERE contest_id = p_contest_id AND section = 'writing';
  SELECT count(*)::integer INTO v_writing_submitted_count FROM public.contest_writing_submissions submission JOIN public.contest_exam_parts part ON part.id = submission.exam_part_id WHERE submission.contest_id = p_contest_id AND submission.user_id = auth.uid() AND part.section = 'writing' AND submission.submitted_at IS NOT NULL;
  IF v_writing_submitted_count <> v_writing_count THEN RAISE EXCEPTION 'Submit every writing response before completing the exam'; END IF;
  UPDATE public.contest_registrations SET completed_at = now(), last_activity_at = now() WHERE contest_id = p_contest_id AND user_id = auth.uid() RETURNING completed_at INTO v_completed_at;
  RETURN jsonb_build_object('completed_at', v_completed_at, 'already_completed', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_contest_v2(p_contest_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_contest public.contests%ROWTYPE; v_result record; v_total_points integer; v_field_average numeric; v_field_size integer; v_before integer; v_after integer; v_delta integer; v_expected numeric; v_actual numeric; v_quality numeric; v_k numeric; v_rated_contests integer;
BEGIN
  IF NOT public.can_manage_contest(p_contest_id) THEN RAISE EXCEPTION 'You cannot finalize this contest'; END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id FOR UPDATE;
  IF NOT FOUND OR NOT v_contest.is_published OR v_contest.archived_at IS NOT NULL OR v_contest.end_at > now() THEN RAISE EXCEPTION 'Only a finished published contest can be finalized'; END IF;
  IF v_contest.is_finalized OR EXISTS (SELECT 1 FROM public.contest_results WHERE contest_id = p_contest_id) THEN RAISE EXCEPTION 'Contest results have already been finalized'; END IF;
  IF v_contest.contest_type = 'rated' AND NOT public.has_admin_access(auth.uid()) THEN RAISE EXCEPTION 'Only a confirmed administrator can finalize a rated contest'; END IF;
  IF v_contest.contest_mode = 'gym' AND v_contest.contest_type <> 'unrated' THEN RAISE EXCEPTION 'Gym contests cannot be rated'; END IF;
  SELECT coalesce((SELECT sum(points) FROM public.contest_questions WHERE contest_id = p_contest_id), 0)::integer + coalesce((SELECT sum(points) FROM public.contest_gap_fill_answer_keys WHERE contest_id = p_contest_id), 0)::integer + coalesce((SELECT count(*) FROM public.contest_matching_speakers WHERE contest_id = p_contest_id), 0)::integer INTO v_total_points;
  IF v_total_points < 1 THEN RAISE EXCEPTION 'Contest has no scorable questions'; END IF;
  CREATE TEMP TABLE contest_rating_work (rank integer, user_id uuid, score integer, answered_count integer, rating integer, rated_contests integer) ON COMMIT DROP;
  INSERT INTO contest_rating_work (rank, user_id, score, answered_count, rating, rated_contests)
  WITH scores AS (
    SELECT registration.user_id,
      (coalesce((SELECT sum(answer.score) FROM public.contest_answers answer WHERE answer.contest_id = registration.contest_id AND answer.user_id = registration.user_id), 0) + coalesce((SELECT sum(response.score) FROM public.contest_gap_fill_responses response WHERE response.contest_id = registration.contest_id AND response.user_id = registration.user_id), 0) + coalesce((SELECT sum(response.score) FROM public.contest_matching_responses response WHERE response.contest_id = registration.contest_id AND response.user_id = registration.user_id), 0))::integer AS score,
      ((SELECT count(*) FROM public.contest_answers answer WHERE answer.contest_id = registration.contest_id AND answer.user_id = registration.user_id) + (SELECT count(*) FROM public.contest_gap_fill_responses response WHERE response.contest_id = registration.contest_id AND response.user_id = registration.user_id) + (SELECT count(*) FROM public.contest_matching_responses response WHERE response.contest_id = registration.contest_id AND response.user_id = registration.user_id))::integer AS answered_count,
      registration.last_activity_at AS last_activity
    FROM public.contest_registrations registration
    WHERE registration.contest_id = p_contest_id AND (v_contest.contest_type <> 'rated' OR (registration.user_id <> v_contest.created_by AND NOT public.has_admin_access(registration.user_id)))
  ), ranked AS (
    SELECT row_number() OVER (ORDER BY score DESC, answered_count DESC, last_activity NULLS LAST, user_id)::integer AS rank, user_id, score, answered_count FROM scores WHERE answered_count > 0
  )
  SELECT ranked.rank, ranked.user_id, ranked.score, ranked.answered_count, coalesce(rating.current_rating, 1000), coalesce(rating.rated_contests, 0) FROM ranked LEFT JOIN public.user_subject_ratings rating ON rating.user_id = ranked.user_id AND rating.subject = v_contest.subject;
  SELECT count(*), coalesce(avg(rating), 1000) INTO v_field_size, v_field_average FROM contest_rating_work;
  FOR v_result IN SELECT * FROM contest_rating_work ORDER BY rank LOOP
    v_before := NULL; v_after := NULL; v_delta := NULL;
    IF v_contest.contest_type = 'rated' THEN
      v_before := v_result.rating; v_rated_contests := v_result.rated_contests;
      v_expected := 1 / (1 + power(10::numeric, (v_field_average - v_before) / 400.0));
      v_actual := CASE WHEN v_field_size <= 1 THEN 0.5 ELSE 1 - ((v_result.rank - 1)::numeric / (v_field_size - 1)::numeric) END;
      v_quality := least(1::numeric, greatest(0::numeric, v_result.score::numeric / v_total_points::numeric));
      v_k := (CASE WHEN v_rated_contests < 5 THEN 48 ELSE 28 END) * least(1.8::numeric, greatest(0.7::numeric, sqrt(v_field_size::numeric / 10.0)));
      v_delta := greatest(-80, least(80, round(v_k * (((v_actual * 0.78) + (v_quality * 0.22)) - ((v_expected * 0.85) + 0.075)))::integer));
      v_after := greatest(0, v_before + v_delta);
      INSERT INTO public.user_subject_ratings (user_id, subject, current_rating, peak_rating, rated_contests) VALUES (v_result.user_id, v_contest.subject, v_after, greatest(v_before, v_after), 1)
      ON CONFLICT (user_id, subject) DO UPDATE SET current_rating = EXCLUDED.current_rating, peak_rating = greatest(public.user_subject_ratings.peak_rating, EXCLUDED.current_rating), rated_contests = public.user_subject_ratings.rated_contests + 1, updated_at = now();
      INSERT INTO public.app_notifications (user_id, type, title, message, metadata) VALUES (v_result.user_id, 'rating-change', 'Contest rating finalized', 'Your contest rating was calculated from the finalized standings.', jsonb_build_object('contest_id', p_contest_id, 'ratingBefore', v_before, 'ratingAfter', v_after, 'ratingDelta', v_delta, 'subject', v_contest.subject));
    END IF;
    INSERT INTO public.contest_results (contest_id, user_id, rank, score, answered_count, rating_before, rating_after, rating_delta) VALUES (p_contest_id, v_result.user_id, v_result.rank, v_result.score, v_result.answered_count, v_before, v_after, v_delta);
  END LOOP;
  UPDATE public.contests SET is_finalized = true, finalized_at = now() WHERE id = p_contest_id;
  PERFORM public.log_audit_action('contest.finalize', 'contest', p_contest_id, jsonb_build_object('rated', v_contest.contest_type = 'rated', 'algorithm', 'pairwise-elo-score-v3'));
END;
$$;

CREATE OR REPLACE FUNCTION public.get_contest_leaderboard(p_slug text)
RETURNS TABLE (rank integer, user_id uuid, display_name text, score integer, answered_count integer, total_questions integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_contest public.contests%ROWTYPE;
BEGIN
  SELECT * INTO v_contest FROM public.contests WHERE slug = p_slug AND is_published AND archived_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contest not found'; END IF;
  IF NOT v_contest.is_finalized THEN RAISE EXCEPTION 'Leaderboard is available after the judge or admin finalizes the results'; END IF;
  RETURN QUERY SELECT result.rank, result.user_id, coalesce(nullif(trim(profile.full_name), ''), 'Participant'), result.score, result.answered_count,
    ((SELECT count(*) FROM public.contest_questions WHERE contest_id = v_contest.id) + (SELECT count(*) FROM public.contest_gap_fill_answer_keys WHERE contest_id = v_contest.id) + (SELECT count(*) FROM public.contest_matching_speakers WHERE contest_id = v_contest.id) + CASE WHEN v_contest.subject IN ('ielts', 'cefr') THEN (SELECT count(*) FROM public.contest_exam_parts WHERE contest_id = v_contest.id AND section = 'writing') ELSE 0 END)::integer
  FROM public.contest_results result JOIN public.profiles profile ON profile.id = result.user_id AND profile.status = 'active' WHERE result.contest_id = v_contest.id ORDER BY result.rank;
END;
$$;

REVOKE ALL ON FUNCTION public.save_cefr_matching_config(uuid, uuid, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_cefr_matching_response(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_contest_editor(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_contest_workspace(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.publish_contest(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_exam_submission(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_contest_v2(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_contest_leaderboard(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_cefr_matching_config(uuid, uuid, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_cefr_matching_response(uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_contest_editor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_contest_workspace(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_contest(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_exam_submission(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_contest_v2(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_contest_leaderboard(text) TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
