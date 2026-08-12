/*
  IELTS / CEFR exam workflow

  Language exams have sections, source material and a delayed writing review.
  The tables below deliberately keep objective answers and manually assessed
  writing separate: a writing score never reaches the rating calculation until
  a judge has recorded it after the exam.
*/

CREATE TABLE IF NOT EXISTS public.contest_exam_parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  position integer NOT NULL CHECK (position BETWEEN 1 AND 50),
  section text NOT NULL CHECK (section IN ('listening', 'reading', 'writing')),
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 1 AND 200),
  instructions text NOT NULL DEFAULT '' CHECK (char_length(instructions) <= 10000),
  content text NOT NULL DEFAULT '' CHECK (char_length(content) <= 50000),
  audio_url text,
  max_points integer NOT NULL DEFAULT 0 CHECK (max_points BETWEEN 0 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contest_id, position),
  UNIQUE (id, contest_id)
);

ALTER TABLE public.contest_questions
  ADD COLUMN IF NOT EXISTS exam_part_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'contest_questions_exam_part_contest_fkey'
      AND conrelid = 'public.contest_questions'::regclass
  ) THEN
    ALTER TABLE public.contest_questions
      ADD CONSTRAINT contest_questions_exam_part_contest_fkey
      FOREIGN KEY (exam_part_id, contest_id)
      REFERENCES public.contest_exam_parts (id, contest_id)
      ON DELETE RESTRICT;
  END IF;
END;
$$;

ALTER TABLE public.contest_registrations
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

CREATE TABLE IF NOT EXISTS public.contest_writing_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  exam_part_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '' CHECK (char_length(content) <= 30000),
  submitted_at timestamptz,
  score integer CHECK (score BETWEEN 0 AND 1000),
  feedback text CHECK (char_length(feedback) <= 10000),
  graded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  graded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (exam_part_id, user_id),
  CONSTRAINT contest_writing_submissions_part_contest_fkey
    FOREIGN KEY (exam_part_id, contest_id)
    REFERENCES public.contest_exam_parts (id, contest_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS contest_exam_parts_contest_position_idx
  ON public.contest_exam_parts (contest_id, position);
CREATE INDEX IF NOT EXISTS contest_writing_submissions_contest_idx
  ON public.contest_writing_submissions (contest_id, submitted_at, graded_at);

DROP TRIGGER IF EXISTS contest_exam_parts_set_updated_at ON public.contest_exam_parts;
CREATE TRIGGER contest_exam_parts_set_updated_at
  BEFORE UPDATE ON public.contest_exam_parts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS contest_writing_submissions_set_updated_at ON public.contest_writing_submissions;
CREATE TRIGGER contest_writing_submissions_set_updated_at
  BEFORE UPDATE ON public.contest_writing_submissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.contest_exam_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contest_writing_submissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.contest_exam_parts, public.contest_writing_submissions FROM PUBLIC, anon, authenticated;

-- A public bucket lets the native audio control stream the file without
-- exposing any answer keys. Writing and part metadata still travel only via
-- protected RPCs while the contest is live.
CREATE OR REPLACE FUNCTION public.can_upload_contest_audio()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.is_judge_or_admin(auth.uid());
$$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contest-audio',
  'contest-audio',
  true,
  26214400,
  ARRAY['audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/webm']::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS contest_audio_public_read ON storage.objects;
CREATE POLICY contest_audio_public_read
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'contest-audio');

DROP POLICY IF EXISTS contest_audio_judge_upload ON storage.objects;
CREATE POLICY contest_audio_judge_upload
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'contest-audio'
    AND owner_id = auth.uid()
    AND public.can_upload_contest_audio()
  );

DROP POLICY IF EXISTS contest_audio_owner_update ON storage.objects;
CREATE POLICY contest_audio_owner_update
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'contest-audio'
    AND owner_id = auth.uid()
    AND public.can_upload_contest_audio()
  )
  WITH CHECK (
    bucket_id = 'contest-audio'
    AND owner_id = auth.uid()
    AND public.can_upload_contest_audio()
  );

DROP POLICY IF EXISTS contest_audio_owner_delete ON storage.objects;
CREATE POLICY contest_audio_owner_delete
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'contest-audio'
    AND owner_id = auth.uid()
    AND public.can_upload_contest_audio()
  );

CREATE OR REPLACE FUNCTION public.save_contest_exam_part(
  p_contest_id uuid,
  p_part_id uuid,
  p_position integer,
  p_section text,
  p_title text,
  p_instructions text DEFAULT '',
  p_content text DEFAULT '',
  p_audio_url text DEFAULT NULL,
  p_max_points integer DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_contest public.contests%ROWTYPE;
  v_part_id uuid;
BEGIN
  IF NOT public.can_manage_contest(p_contest_id) THEN
    RAISE EXCEPTION 'Only the owning judge or an admin can manage exam parts';
  END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contest not found'; END IF;
  IF v_contest.subject NOT IN ('ielts', 'cefr') THEN
    RAISE EXCEPTION 'Exam parts are available only for IELTS and CEFR contests';
  END IF;
  IF v_contest.is_published OR v_contest.archived_at IS NOT NULL OR v_contest.start_at <= now() THEN
    RAISE EXCEPTION 'Exam parts cannot be changed after a contest is published or started';
  END IF;
  IF p_position NOT BETWEEN 1 AND 50
    OR p_section NOT IN ('listening', 'reading', 'writing')
    OR char_length(trim(coalesce(p_title, ''))) < 1
    OR char_length(coalesce(p_instructions, '')) > 10000
    OR char_length(coalesce(p_content, '')) > 50000
    OR p_max_points NOT BETWEEN 0 AND 1000 THEN
    RAISE EXCEPTION 'Invalid exam part data';
  END IF;
  IF p_section = 'writing' AND p_max_points < 1 THEN
    RAISE EXCEPTION 'A writing part must have a maximum score';
  END IF;
  IF p_section <> 'writing' AND p_max_points <> 0 THEN
    RAISE EXCEPTION 'Listening and reading points belong to their questions';
  END IF;

  IF p_part_id IS NULL THEN
    INSERT INTO public.contest_exam_parts (
      contest_id, position, section, title, instructions, content, audio_url, max_points
    ) VALUES (
      p_contest_id, p_position, p_section, trim(p_title), trim(coalesce(p_instructions, '')),
      trim(coalesce(p_content, '')), nullif(trim(p_audio_url), ''), p_max_points
    ) RETURNING id INTO v_part_id;
  ELSE
    UPDATE public.contest_exam_parts
    SET position = p_position,
        section = p_section,
        title = trim(p_title),
        instructions = trim(coalesce(p_instructions, '')),
        content = trim(coalesce(p_content, '')),
        audio_url = nullif(trim(p_audio_url), ''),
        max_points = p_max_points
    WHERE id = p_part_id AND contest_id = p_contest_id
    RETURNING id INTO v_part_id;
    IF v_part_id IS NULL THEN RAISE EXCEPTION 'Exam part not found'; END IF;
  END IF;

  PERFORM public.log_audit_action(
    CASE WHEN p_part_id IS NULL THEN 'contest.exam_part.create' ELSE 'contest.exam_part.update' END,
    'contest', p_contest_id,
    jsonb_build_object('part_id', v_part_id, 'section', p_section)
  );
  RETURN v_part_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_contest_exam_part(
  p_contest_id uuid,
  p_part_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_contest public.contests%ROWTYPE;
BEGIN
  IF NOT public.can_manage_contest(p_contest_id) THEN
    RAISE EXCEPTION 'Only the owning judge or an admin can manage exam parts';
  END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id FOR UPDATE;
  IF NOT FOUND OR v_contest.is_published OR v_contest.start_at <= now() THEN
    RAISE EXCEPTION 'This exam part can no longer be removed';
  END IF;
  IF EXISTS (SELECT 1 FROM public.contest_questions WHERE exam_part_id = p_part_id) THEN
    RAISE EXCEPTION 'Delete this part’s questions before removing the part';
  END IF;
  DELETE FROM public.contest_exam_parts WHERE id = p_part_id AND contest_id = p_contest_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Exam part not found'; END IF;
  PERFORM public.log_audit_action('contest.exam_part.delete', 'contest', p_contest_id, jsonb_build_object('part_id', p_part_id));
END;
$$;

DROP FUNCTION IF EXISTS public.save_contest_question(uuid, uuid, integer, text, jsonb, integer, integer, text);

CREATE FUNCTION public.save_contest_question(
  p_contest_id uuid,
  p_question_id uuid,
  p_position integer,
  p_prompt text,
  p_options jsonb,
  p_correct_option integer,
  p_points integer DEFAULT 1,
  p_explanation text DEFAULT NULL,
  p_exam_part_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_question_id uuid;
  v_contest public.contests%ROWTYPE;
  v_section text;
BEGIN
  IF NOT public.can_manage_contest(p_contest_id) THEN
    RAISE EXCEPTION 'Only the owning judge or an admin can manage questions';
  END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contest not found'; END IF;
  IF v_contest.is_published OR v_contest.start_at <= now() THEN
    RAISE EXCEPTION 'Questions cannot be changed after publication or start';
  END IF;
  IF p_position IS NULL OR p_position < 1
    OR char_length(trim(coalesce(p_prompt, ''))) = 0
    OR coalesce(jsonb_typeof(p_options), '') <> 'array'
    OR p_points NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION 'Invalid question data';
  END IF;
  IF jsonb_array_length(p_options) NOT BETWEEN 2 AND 8
    OR p_correct_option IS NULL OR p_correct_option < 0 OR p_correct_option >= jsonb_array_length(p_options) THEN
    RAISE EXCEPTION 'Invalid question data';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_options) option_value(value)
    WHERE jsonb_typeof(option_value.value) <> 'string'
      OR char_length(trim(option_value.value #>> '{}')) = 0
  ) THEN
    RAISE EXCEPTION 'Question options cannot be empty';
  END IF;

  IF v_contest.subject IN ('ielts', 'cefr') THEN
    IF p_exam_part_id IS NULL THEN
      RAISE EXCEPTION 'Every IELTS or CEFR question must belong to a listening or reading part';
    END IF;
    SELECT section INTO v_section
    FROM public.contest_exam_parts
    WHERE id = p_exam_part_id AND contest_id = p_contest_id;
    IF v_section IS NULL OR v_section = 'writing' THEN
      RAISE EXCEPTION 'Questions may belong only to listening or reading parts';
    END IF;
  ELSIF p_exam_part_id IS NOT NULL THEN
    RAISE EXCEPTION 'Exam parts can be used only by IELTS and CEFR contests';
  END IF;

  IF p_question_id IS NULL THEN
    INSERT INTO public.contest_questions (
      contest_id, exam_part_id, position, prompt, options, correct_option, points, explanation
    ) VALUES (
      p_contest_id, p_exam_part_id, p_position, trim(p_prompt), p_options,
      p_correct_option, p_points, nullif(trim(p_explanation), '')
    ) RETURNING id INTO v_question_id;
  ELSE
    UPDATE public.contest_questions
    SET exam_part_id = p_exam_part_id,
        position = p_position,
        prompt = trim(p_prompt),
        options = p_options,
        correct_option = p_correct_option,
        points = p_points,
        explanation = nullif(trim(p_explanation), '')
    WHERE id = p_question_id AND contest_id = p_contest_id
    RETURNING id INTO v_question_id;
    IF v_question_id IS NULL THEN RAISE EXCEPTION 'Question not found'; END IF;
  END IF;

  PERFORM public.log_audit_action('contest.question.save', 'contest', p_contest_id, jsonb_build_object('question_id', v_question_id));
  RETURN v_question_id;
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
  IF NOT public.can_manage_contest(p_contest_id) THEN
    RAISE EXCEPTION 'Only the owning judge or an admin can view this editor';
  END IF;
  SELECT jsonb_build_object(
    'contest', jsonb_build_object(
      'id', c.id, 'slug', c.slug, 'title', c.title, 'description', c.description,
      'subject', c.subject, 'difficulty', c.difficulty, 'contest_type', c.contest_type,
      'start_at', c.start_at, 'end_at', c.end_at, 'max_participants', c.max_participants,
      'rules', c.rules, 'tags', c.tags, 'prize', c.prize, 'is_published', c.is_published,
      'is_finalized', c.is_finalized, 'archived_at', c.archived_at
    ),
    'parts', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', part.id, 'position', part.position, 'section', part.section,
        'title', part.title, 'instructions', part.instructions, 'content', part.content,
        'audio_url', part.audio_url, 'max_points', part.max_points
      ) ORDER BY part.position)
      FROM public.contest_exam_parts AS part
      WHERE part.contest_id = c.id
    ), '[]'::jsonb),
    'questions', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', q.id, 'exam_part_id', q.exam_part_id, 'position', q.position,
        'prompt', q.prompt, 'options', q.options, 'correct_option', q.correct_option,
        'points', q.points, 'explanation', q.explanation
      ) ORDER BY q.position)
      FROM public.contest_questions AS q WHERE q.contest_id = c.id
    ), '[]'::jsonb)
  ) INTO v_payload
  FROM public.contests AS c
  WHERE c.id = p_contest_id;
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
DECLARE
  v_contest public.contests%ROWTYPE;
  v_payload jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.active_profile(auth.uid()) THEN
    RAISE EXCEPTION 'Sign in with an active account to enter a contest';
  END IF;
  SELECT * INTO v_contest
  FROM public.contests
  WHERE slug = p_slug AND is_published AND archived_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contest not found'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.contest_registrations AS registration
    WHERE registration.contest_id = v_contest.id AND registration.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Register for this contest before entering';
  END IF;
  IF now() < v_contest.start_at THEN RAISE EXCEPTION 'Contest has not started'; END IF;
  IF now() >= v_contest.end_at THEN RAISE EXCEPTION 'Contest has finished'; END IF;

  SELECT jsonb_build_object(
    'contest', jsonb_build_object(
      'id', c.id, 'slug', c.slug, 'title', c.title, 'subject', c.subject,
      'start_at', c.start_at, 'end_at', c.end_at, 'contest_type', c.contest_type,
      'completed_at', registration.completed_at
    ),
    'parts', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', part.id, 'position', part.position, 'section', part.section,
        'title', part.title, 'instructions', part.instructions, 'content', part.content,
        'audio_url', part.audio_url, 'max_points', part.max_points
      ) ORDER BY part.position)
      FROM public.contest_exam_parts AS part
      WHERE part.contest_id = c.id
    ), '[]'::jsonb),
    'questions', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', q.id, 'exam_part_id', q.exam_part_id, 'position', q.position,
        'prompt', q.prompt, 'options', q.options, 'points', q.points
      ) ORDER BY q.position)
      FROM public.contest_questions AS q WHERE q.contest_id = c.id
    ), '[]'::jsonb),
    'answers', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'question_id', answer.question_id, 'selected_option', answer.selected_option
      ) ORDER BY question.position)
      FROM public.contest_answers AS answer
      JOIN public.contest_questions AS question ON question.id = answer.question_id
      WHERE answer.contest_id = c.id AND answer.user_id = auth.uid()
    ), '[]'::jsonb),
    'writing_responses', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'part_id', submission.exam_part_id, 'content', submission.content,
        'submitted_at', submission.submitted_at, 'updated_at', submission.updated_at
      ) ORDER BY part.position)
      FROM public.contest_writing_submissions AS submission
      JOIN public.contest_exam_parts AS part ON part.id = submission.exam_part_id
      WHERE submission.contest_id = c.id AND submission.user_id = auth.uid()
    ), '[]'::jsonb)
  ) INTO v_payload
  FROM public.contests AS c
  JOIN public.contest_registrations AS registration
    ON registration.contest_id = c.id AND registration.user_id = auth.uid()
  WHERE c.id = v_contest.id;

  RETURN v_payload;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_contest_answer(p_question_id uuid, p_selected_option integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_question public.contest_questions%ROWTYPE;
  v_contest public.contests%ROWTYPE;
  v_correct boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.active_profile(auth.uid()) THEN
    RAISE EXCEPTION 'An active account is required to submit';
  END IF;
  SELECT q.* INTO v_question FROM public.contest_questions AS q WHERE q.id = p_question_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Question not found'; END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = v_question.contest_id;
  IF NOT v_contest.is_published OR v_contest.archived_at IS NOT NULL
    OR now() < v_contest.start_at OR now() >= v_contest.end_at THEN
    RAISE EXCEPTION 'Answers are not accepted for this contest at this time';
  END IF;
  IF v_contest.contest_type = 'rated'
    AND (v_contest.created_by = auth.uid() OR public.has_admin_access(auth.uid())) THEN
    RAISE EXCEPTION 'Contest managers cannot submit answers to a rated contest';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.contest_registrations AS registration
    WHERE registration.contest_id = v_contest.id AND registration.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Register for this contest before submitting';
  END IF;
  IF v_contest.subject IN ('ielts', 'cefr') AND EXISTS (
    SELECT 1 FROM public.contest_registrations AS registration
    WHERE registration.contest_id = v_contest.id
      AND registration.user_id = auth.uid()
      AND registration.completed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'This exam has already been submitted';
  END IF;
  IF p_selected_option IS NULL OR p_selected_option < 0 OR p_selected_option >= jsonb_array_length(v_question.options) THEN
    RAISE EXCEPTION 'Invalid answer option';
  END IF;
  v_correct := p_selected_option = v_question.correct_option;

  INSERT INTO public.contest_answers (contest_id, question_id, user_id, selected_option, is_correct, score)
  VALUES (v_contest.id, v_question.id, auth.uid(), p_selected_option, v_correct, CASE WHEN v_correct THEN v_question.points ELSE 0 END)
  ON CONFLICT (question_id, user_id) DO UPDATE
  SET selected_option = EXCLUDED.selected_option,
      is_correct = EXCLUDED.is_correct,
      score = EXCLUDED.score,
      submitted_at = now();

  UPDATE public.contest_registrations
  SET last_activity_at = now()
  WHERE contest_id = v_contest.id AND user_id = auth.uid();
  RETURN jsonb_build_object('saved', true, 'question_id', p_question_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.save_exam_writing_response(
  p_exam_part_id uuid,
  p_content text,
  p_submit boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_part public.contest_exam_parts%ROWTYPE;
  v_contest public.contests%ROWTYPE;
  v_submitted_at timestamptz;
BEGIN
  IF auth.uid() IS NULL OR NOT public.active_profile(auth.uid()) THEN
    RAISE EXCEPTION 'An active account is required to submit writing';
  END IF;
  SELECT * INTO v_part FROM public.contest_exam_parts WHERE id = p_exam_part_id;
  IF NOT FOUND OR v_part.section <> 'writing' THEN RAISE EXCEPTION 'Writing part not found'; END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = v_part.contest_id;
  IF NOT v_contest.is_published OR v_contest.archived_at IS NOT NULL
    OR now() < v_contest.start_at OR now() >= v_contest.end_at THEN
    RAISE EXCEPTION 'Writing is not accepted for this exam at this time';
  END IF;
  IF v_contest.contest_type = 'rated'
    AND (v_contest.created_by = auth.uid() OR public.has_admin_access(auth.uid())) THEN
    RAISE EXCEPTION 'Contest managers cannot submit writing to a rated exam';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.contest_registrations AS registration
    WHERE registration.contest_id = v_contest.id AND registration.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Register for this exam before submitting writing';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.contest_registrations AS registration
    WHERE registration.contest_id = v_contest.id
      AND registration.user_id = auth.uid()
      AND registration.completed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'This exam has already been submitted';
  END IF;
  IF char_length(trim(coalesce(p_content, ''))) < 1 THEN
    RAISE EXCEPTION 'Writing response cannot be empty';
  END IF;

  SELECT submitted_at INTO v_submitted_at
  FROM public.contest_writing_submissions
  WHERE exam_part_id = p_exam_part_id AND user_id = auth.uid()
  FOR UPDATE;
  IF v_submitted_at IS NOT NULL THEN
    RAISE EXCEPTION 'This writing response has already been submitted';
  END IF;

  INSERT INTO public.contest_writing_submissions (
    contest_id, exam_part_id, user_id, content, submitted_at
  ) VALUES (
    v_contest.id, p_exam_part_id, auth.uid(), trim(p_content), CASE WHEN p_submit THEN now() ELSE NULL END
  ) ON CONFLICT (exam_part_id, user_id) DO UPDATE
  SET content = EXCLUDED.content,
      submitted_at = CASE WHEN p_submit THEN now() ELSE NULL END,
      updated_at = now()
  RETURNING submitted_at INTO v_submitted_at;

  UPDATE public.contest_registrations
  SET last_activity_at = now()
  WHERE contest_id = v_contest.id AND user_id = auth.uid();
  RETURN jsonb_build_object('saved', true, 'submitted_at', v_submitted_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_exam_submission(p_contest_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_contest public.contests%ROWTYPE;
  v_question_count integer;
  v_answer_count integer;
  v_writing_count integer;
  v_writing_submitted_count integer;
  v_completed_at timestamptz;
BEGIN
  IF auth.uid() IS NULL OR NOT public.active_profile(auth.uid()) THEN
    RAISE EXCEPTION 'An active account is required to submit an exam';
  END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id;
  IF NOT FOUND OR v_contest.subject NOT IN ('ielts', 'cefr') THEN
    RAISE EXCEPTION 'English exam not found';
  END IF;
  IF NOT v_contest.is_published OR v_contest.archived_at IS NOT NULL
    OR now() < v_contest.start_at OR now() >= v_contest.end_at THEN
    RAISE EXCEPTION 'This exam cannot be submitted at this time';
  END IF;
  IF v_contest.contest_type = 'rated'
    AND (v_contest.created_by = auth.uid() OR public.has_admin_access(auth.uid())) THEN
    RAISE EXCEPTION 'Contest managers cannot submit a rated exam';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.contest_registrations AS registration
    WHERE registration.contest_id = p_contest_id AND registration.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Register for this exam before submitting';
  END IF;
  SELECT completed_at INTO v_completed_at
  FROM public.contest_registrations
  WHERE contest_id = p_contest_id AND user_id = auth.uid()
  FOR UPDATE;
  IF v_completed_at IS NOT NULL THEN
    RETURN jsonb_build_object('completed_at', v_completed_at, 'already_completed', true);
  END IF;

  SELECT count(*)::integer INTO v_question_count
  FROM public.contest_questions WHERE contest_id = p_contest_id;
  SELECT count(*)::integer INTO v_answer_count
  FROM public.contest_answers WHERE contest_id = p_contest_id AND user_id = auth.uid();
  IF v_answer_count <> v_question_count THEN
    RAISE EXCEPTION 'Answer every listening and reading question before submitting the exam';
  END IF;
  SELECT count(*)::integer INTO v_writing_count
  FROM public.contest_exam_parts
  WHERE contest_id = p_contest_id AND section = 'writing';
  SELECT count(*)::integer INTO v_writing_submitted_count
  FROM public.contest_writing_submissions AS submission
  JOIN public.contest_exam_parts AS part ON part.id = submission.exam_part_id
  WHERE submission.contest_id = p_contest_id
    AND submission.user_id = auth.uid()
    AND part.section = 'writing'
    AND submission.submitted_at IS NOT NULL;
  IF v_writing_submitted_count <> v_writing_count THEN
    RAISE EXCEPTION 'Submit every writing response before completing the exam';
  END IF;

  UPDATE public.contest_registrations
  SET completed_at = now(), last_activity_at = now()
  WHERE contest_id = p_contest_id AND user_id = auth.uid()
  RETURNING completed_at INTO v_completed_at;
  RETURN jsonb_build_object('completed_at', v_completed_at, 'already_completed', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_contest_writing_submissions(p_contest_id uuid)
RETURNS TABLE (
  id uuid,
  part_id uuid,
  part_position integer,
  part_title text,
  max_points integer,
  user_id uuid,
  display_name text,
  content text,
  submitted_at timestamptz,
  score integer,
  feedback text,
  graded_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_contest public.contests%ROWTYPE;
BEGIN
  IF NOT public.can_manage_contest(p_contest_id) THEN
    RAISE EXCEPTION 'Only the owning judge or an admin can review writing';
  END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id;
  IF NOT FOUND OR v_contest.subject NOT IN ('ielts', 'cefr') THEN
    RAISE EXCEPTION 'English exam not found';
  END IF;
  IF v_contest.end_at > now() THEN
    RAISE EXCEPTION 'Writing is available for review after the exam ends';
  END IF;
  RETURN QUERY
  SELECT
    submission.id,
    part.id,
    part.position,
    part.title,
    part.max_points,
    submission.user_id,
    coalesce(nullif(trim(profile.full_name), ''), 'Participant'),
    submission.content,
    submission.submitted_at,
    submission.score,
    submission.feedback,
    submission.graded_at
  FROM public.contest_writing_submissions AS submission
  JOIN public.contest_exam_parts AS part ON part.id = submission.exam_part_id
  JOIN public.profiles AS profile ON profile.id = submission.user_id
  WHERE submission.contest_id = p_contest_id
    AND submission.submitted_at IS NOT NULL
  ORDER BY part.position, submission.submitted_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.grade_contest_writing_submission(
  p_submission_id uuid,
  p_score integer,
  p_feedback text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_submission public.contest_writing_submissions%ROWTYPE;
  v_part public.contest_exam_parts%ROWTYPE;
  v_contest public.contests%ROWTYPE;
BEGIN
  SELECT * INTO v_submission FROM public.contest_writing_submissions WHERE id = p_submission_id FOR UPDATE;
  IF NOT FOUND OR v_submission.submitted_at IS NULL THEN RAISE EXCEPTION 'Writing submission not found'; END IF;
  SELECT * INTO v_part FROM public.contest_exam_parts WHERE id = v_submission.exam_part_id;
  SELECT * INTO v_contest FROM public.contests WHERE id = v_submission.contest_id;
  IF NOT public.can_manage_contest(v_contest.id) THEN
    RAISE EXCEPTION 'Only the owning judge or an admin can grade writing';
  END IF;
  IF v_contest.end_at > now() THEN RAISE EXCEPTION 'Writing can be graded after the exam ends'; END IF;
  IF v_contest.is_finalized THEN RAISE EXCEPTION 'Finalized results cannot be changed'; END IF;
  IF p_score NOT BETWEEN 0 AND v_part.max_points THEN
    RAISE EXCEPTION 'Writing score must be between 0 and %', v_part.max_points;
  END IF;
  IF char_length(coalesce(p_feedback, '')) > 10000 THEN RAISE EXCEPTION 'Feedback is too long'; END IF;

  UPDATE public.contest_writing_submissions
  SET score = p_score,
      feedback = nullif(trim(p_feedback), ''),
      graded_by = auth.uid(),
      graded_at = now()
  WHERE id = p_submission_id;
  PERFORM public.log_audit_action(
    'contest.writing.grade',
    'contest_writing_submission',
    p_submission_id,
    jsonb_build_object('contest_id', v_contest.id, 'score', p_score)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.publish_contest(p_contest_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_contest public.contests%ROWTYPE;
  v_part record;
BEGIN
  IF NOT public.can_manage_contest(p_contest_id) THEN RAISE EXCEPTION 'Only the owning judge or an admin can publish this contest'; END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contest not found'; END IF;
  IF v_contest.is_published THEN RAISE EXCEPTION 'Contest is already published'; END IF;
  IF v_contest.start_at <= now() OR v_contest.end_at <= v_contest.start_at THEN RAISE EXCEPTION 'Contest schedule is no longer valid'; END IF;

  IF v_contest.subject = 'programming' THEN
    IF NOT EXISTS (SELECT 1 FROM public.contest_programming_problems WHERE contest_id = p_contest_id) THEN
      RAISE EXCEPTION 'Add at least one programming problem before publishing';
    END IF;
  ELSIF v_contest.subject IN ('ielts', 'cefr') THEN
    IF NOT EXISTS (SELECT 1 FROM public.contest_exam_parts WHERE contest_id = p_contest_id) THEN
      RAISE EXCEPTION 'Add at least one IELTS or CEFR exam part before publishing';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM unnest(ARRAY['listening', 'reading', 'writing']::text[]) AS required(section)
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.contest_exam_parts AS part
        WHERE part.contest_id = p_contest_id AND part.section = required.section
      )
    ) THEN
      RAISE EXCEPTION 'IELTS and CEFR exams require Listening, Reading, and Writing parts';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.contest_questions WHERE contest_id = p_contest_id) THEN
      RAISE EXCEPTION 'Add listening or reading questions before publishing';
    END IF;
    IF EXISTS (SELECT 1 FROM public.contest_questions WHERE contest_id = p_contest_id AND exam_part_id IS NULL) THEN
      RAISE EXCEPTION 'Every IELTS or CEFR question must be assigned to a part';
    END IF;
    FOR v_part IN
      SELECT * FROM public.contest_exam_parts WHERE contest_id = p_contest_id
    LOOP
      IF v_part.section = 'listening' AND nullif(trim(v_part.audio_url), '') IS NULL THEN
        RAISE EXCEPTION 'Every listening part must include an audio file';
      END IF;
      IF v_part.section IN ('reading', 'writing') AND char_length(trim(v_part.content)) < 1 THEN
        RAISE EXCEPTION 'Every reading passage and writing topic must contain text';
      END IF;
      IF v_part.section IN ('listening', 'reading') AND NOT EXISTS (
        SELECT 1 FROM public.contest_questions WHERE exam_part_id = v_part.id
      ) THEN
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

CREATE OR REPLACE FUNCTION public.finalize_contest(p_contest_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_contest public.contests%ROWTYPE;
  v_result record;
  v_total_points integer;
  v_before integer;
  v_after integer;
  v_delta integer;
BEGIN
  IF NOT public.can_manage_contest(p_contest_id) THEN
    RAISE EXCEPTION 'Only the owning judge or an admin can finalize this contest';
  END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contest not found'; END IF;
  IF v_contest.contest_type = 'rated' AND NOT public.has_admin_access(auth.uid()) THEN
    RAISE EXCEPTION 'Only a confirmed allowlisted administrator can finalize a rated contest';
  END IF;
  IF NOT v_contest.is_published OR v_contest.archived_at IS NOT NULL OR v_contest.end_at > now() THEN
    RAISE EXCEPTION 'Only a finished, published contest can be finalized';
  END IF;
  IF v_contest.is_finalized OR EXISTS (SELECT 1 FROM public.contest_results WHERE contest_id = p_contest_id) THEN
    RAISE EXCEPTION 'Contest results have already been finalized';
  END IF;
  IF v_contest.subject IN ('ielts', 'cefr') AND EXISTS (
    SELECT 1
    FROM public.contest_writing_submissions
    WHERE contest_id = p_contest_id
      AND submitted_at IS NOT NULL
      AND score IS NULL
  ) THEN
    RAISE EXCEPTION 'Grade every submitted writing response before finalizing this exam';
  END IF;

  SELECT coalesce(sum(points), 0)::integer INTO v_total_points
  FROM public.contest_questions WHERE contest_id = p_contest_id;
  IF v_contest.subject IN ('ielts', 'cefr') THEN
    SELECT v_total_points + coalesce(sum(max_points), 0)::integer INTO v_total_points
    FROM public.contest_exam_parts
    WHERE contest_id = p_contest_id AND section = 'writing';
  END IF;
  IF v_total_points < 1 THEN RAISE EXCEPTION 'Contest has no scorable work'; END IF;

  FOR v_result IN
    WITH mc_scores AS (
      SELECT
        registration.user_id,
        coalesce(sum(answer.score), 0)::integer AS score,
        count(answer.question_id)::integer AS answered_count,
        max(registration.last_activity_at) AS last_activity
      FROM public.contest_registrations AS registration
      LEFT JOIN public.contest_answers AS answer
        ON answer.contest_id = registration.contest_id
        AND answer.user_id = registration.user_id
      WHERE registration.contest_id = p_contest_id
        AND (
          v_contest.subject NOT IN ('ielts', 'cefr')
          OR registration.completed_at IS NOT NULL
        )
      GROUP BY registration.user_id
    ), writing_scores AS (
      SELECT
        submission.user_id,
        coalesce(sum(submission.score), 0)::integer AS score,
        count(*)::integer AS answered_count,
        max(submission.updated_at) AS last_activity
      FROM public.contest_writing_submissions AS submission
      WHERE submission.contest_id = p_contest_id
        AND submission.submitted_at IS NOT NULL
        AND submission.score IS NOT NULL
      GROUP BY submission.user_id
    ), scores AS (
      SELECT
        mc.user_id,
        mc.score + coalesce(writing.score, 0) AS score,
        mc.answered_count + coalesce(writing.answered_count, 0) AS answered_count,
        greatest(mc.last_activity, writing.last_activity) AS last_activity
      FROM mc_scores AS mc
      LEFT JOIN writing_scores AS writing ON writing.user_id = mc.user_id
      WHERE mc.answered_count + coalesce(writing.answered_count, 0) > 0
        AND (
          v_contest.contest_type <> 'rated'
          OR (
            mc.user_id <> v_contest.created_by
            AND NOT public.has_admin_access(mc.user_id)
          )
        )
    )
    SELECT
      row_number() OVER (ORDER BY score DESC, answered_count DESC, last_activity NULLS LAST, user_id)::integer AS rank,
      user_id, score, answered_count
    FROM scores
    ORDER BY score DESC, answered_count DESC, last_activity NULLS LAST, user_id
  LOOP
    v_before := NULL;
    v_after := NULL;
    v_delta := NULL;

    IF v_contest.contest_type = 'rated' THEN
      INSERT INTO public.user_subject_ratings (user_id, subject)
      VALUES (v_result.user_id, v_contest.subject)
      ON CONFLICT (user_id, subject) DO NOTHING;

      PERFORM 1
      FROM public.user_subject_ratings
      WHERE user_id = v_result.user_id AND subject = v_contest.subject
      FOR UPDATE;

      SELECT previous_result.rating_after INTO v_before
      FROM public.contest_results AS previous_result
      JOIN public.contests AS previous_contest ON previous_contest.id = previous_result.contest_id
      WHERE previous_result.user_id = v_result.user_id
        AND previous_contest.subject = v_contest.subject
        AND previous_contest.is_finalized
        AND previous_result.rating_after IS NOT NULL
      ORDER BY previous_result.finalized_at DESC, previous_result.contest_id DESC
      LIMIT 1;

      v_before := coalesce(v_before, 1000);
      v_delta := greatest(-25, least(25, round((v_result.score::numeric / v_total_points) * 50 - 25)::integer));
      v_after := greatest(0, v_before + v_delta);

      INSERT INTO public.user_subject_ratings (user_id, subject, current_rating, peak_rating, rated_contests)
      VALUES (v_result.user_id, v_contest.subject, v_after, greatest(v_before, v_after), 1)
      ON CONFLICT (user_id, subject) DO UPDATE
      SET current_rating = EXCLUDED.current_rating,
          peak_rating = greatest(public.user_subject_ratings.peak_rating, EXCLUDED.current_rating),
          rated_contests = public.user_subject_ratings.rated_contests + 1,
          updated_at = now();

      INSERT INTO public.app_notifications (user_id, type, title, message, metadata)
      VALUES (
        v_result.user_id,
        'rating-change',
        'Contest rating finalized',
        'Your rating was finalized from a completed contest.',
        jsonb_build_object('contest_id', p_contest_id, 'ratingBefore', v_before, 'ratingAfter', v_after, 'ratingDelta', v_delta, 'subject', v_contest.subject)
      );
    END IF;

    INSERT INTO public.contest_results (
      contest_id, user_id, rank, score, answered_count, rating_before, rating_after, rating_delta
    ) VALUES (
      p_contest_id, v_result.user_id, v_result.rank, v_result.score, v_result.answered_count,
      v_before, v_after, v_delta
    );
  END LOOP;

  UPDATE public.contests SET is_finalized = true, finalized_at = now() WHERE id = p_contest_id;
  PERFORM public.log_audit_action('contest.finalize', 'contest', p_contest_id, jsonb_build_object('rated', v_contest.contest_type = 'rated'));
END;
$$;

CREATE OR REPLACE FUNCTION public.get_contest_leaderboard(p_slug text)
RETURNS TABLE (
  rank integer,
  user_id uuid,
  display_name text,
  score integer,
  answered_count integer,
  total_questions integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_contest public.contests%ROWTYPE;
BEGIN
  SELECT * INTO v_contest FROM public.contests
  WHERE slug = p_slug AND is_published AND archived_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contest not found'; END IF;
  IF NOT v_contest.is_finalized THEN
    RAISE EXCEPTION 'Leaderboard is available after the judge or admin finalizes the results';
  END IF;
  RETURN QUERY
  SELECT
    result.rank,
    result.user_id,
    coalesce(nullif(trim(profile.full_name), ''), 'Participant'),
    result.score,
    result.answered_count,
    (
      SELECT count(*)::integer FROM public.contest_questions WHERE contest_id = v_contest.id
    ) + CASE WHEN v_contest.subject IN ('ielts', 'cefr') THEN (
      SELECT count(*)::integer FROM public.contest_exam_parts
      WHERE contest_id = v_contest.id AND section = 'writing'
    ) ELSE 0 END
  FROM public.contest_results AS result
  JOIN public.profiles AS profile ON profile.id = result.user_id AND profile.status = 'active'
  WHERE result.contest_id = v_contest.id
  ORDER BY result.rank;
END;
$$;

REVOKE ALL ON FUNCTION public.save_contest_exam_part(uuid, uuid, integer, text, text, text, text, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.can_upload_contest_audio() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_contest_exam_part(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_contest_question(uuid, uuid, integer, text, jsonb, integer, integer, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_exam_writing_response(uuid, text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_exam_submission(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_contest_writing_submissions(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.grade_contest_writing_submission(uuid, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_contest_editor(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_contest_workspace(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_contest_answer(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.publish_contest(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_contest(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_contest_leaderboard(text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.save_contest_exam_part(uuid, uuid, integer, text, text, text, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_upload_contest_audio() TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_contest_exam_part(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_contest_question(uuid, uuid, integer, text, jsonb, integer, integer, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_exam_writing_response(uuid, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_exam_submission(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_contest_writing_submissions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.grade_contest_writing_submission(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_contest_editor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_contest_workspace(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_contest_answer(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_contest(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_contest(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_contest_leaderboard(text) TO anon, authenticated;
