/*
  Timed IELTS / CEFR sections

  The language exam is one scheduled contest, but its Listening, Reading and
  Writing windows are independently timed.  The server is authoritative: a
  browser cannot submit a Listening answer during Reading by changing its UI.
*/

CREATE TABLE IF NOT EXISTS public.contest_exam_section_timings (
  contest_id uuid PRIMARY KEY REFERENCES public.contests(id) ON DELETE CASCADE,
  listening_minutes integer NOT NULL CHECK (listening_minutes BETWEEN 1 AND 720),
  reading_minutes integer NOT NULL CHECK (reading_minutes BETWEEN 1 AND 720),
  writing_minutes integer NOT NULL CHECK (writing_minutes BETWEEN 1 AND 720),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS contest_exam_section_timings_set_updated_at ON public.contest_exam_section_timings;
CREATE TRIGGER contest_exam_section_timings_set_updated_at
  BEFORE UPDATE ON public.contest_exam_section_timings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.contest_exam_section_timings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.contest_exam_section_timings FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.current_exam_section(p_contest_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_contest public.contests%ROWTYPE;
  v_timing public.contest_exam_section_timings%ROWTYPE;
  v_listening_end timestamptz;
  v_reading_end timestamptz;
BEGIN
  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id;
  SELECT * INTO v_timing FROM public.contest_exam_section_timings WHERE contest_id = p_contest_id;
  IF NOT FOUND OR now() < v_contest.start_at OR now() >= v_contest.end_at THEN
    RETURN NULL;
  END IF;
  v_listening_end := v_contest.start_at + (v_timing.listening_minutes * interval '1 minute');
  v_reading_end := v_listening_end + (v_timing.reading_minutes * interval '1 minute');
  IF now() < v_listening_end THEN RETURN 'listening'; END IF;
  IF now() < v_reading_end THEN RETURN 'reading'; END IF;
  RETURN 'writing';
END;
$$;

CREATE OR REPLACE FUNCTION public.save_contest_exam_section_timings(
  p_contest_id uuid,
  p_listening_minutes integer,
  p_reading_minutes integer,
  p_writing_minutes integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_contest public.contests%ROWTYPE;
BEGIN
  IF NOT public.can_manage_contest(p_contest_id) THEN
    RAISE EXCEPTION 'Only the owning judge or an admin can manage exam timings';
  END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id FOR UPDATE;
  IF NOT FOUND OR v_contest.subject NOT IN ('ielts', 'cefr') THEN
    RAISE EXCEPTION 'Section timings are available only for IELTS and CEFR exams';
  END IF;
  IF v_contest.is_published OR v_contest.archived_at IS NOT NULL OR v_contest.start_at <= now() THEN
    RAISE EXCEPTION 'Exam timings cannot be changed after a contest is published or started';
  END IF;
  IF p_listening_minutes NOT BETWEEN 1 AND 720
    OR p_reading_minutes NOT BETWEEN 1 AND 720
    OR p_writing_minutes NOT BETWEEN 1 AND 720 THEN
    RAISE EXCEPTION 'Each section must be between 1 and 720 minutes';
  END IF;
  IF extract(epoch FROM (v_contest.end_at - v_contest.start_at))
    <> (p_listening_minutes + p_reading_minutes + p_writing_minutes) * 60 THEN
    RAISE EXCEPTION 'Listening, Reading and Writing times must exactly equal the contest duration';
  END IF;

  INSERT INTO public.contest_exam_section_timings (
    contest_id, listening_minutes, reading_minutes, writing_minutes
  ) VALUES (
    p_contest_id, p_listening_minutes, p_reading_minutes, p_writing_minutes
  ) ON CONFLICT (contest_id) DO UPDATE
  SET listening_minutes = EXCLUDED.listening_minutes,
      reading_minutes = EXCLUDED.reading_minutes,
      writing_minutes = EXCLUDED.writing_minutes,
      updated_at = now();
  PERFORM public.log_audit_action(
    'contest.exam_timing.save',
    'contest',
    p_contest_id,
    jsonb_build_object('listening', p_listening_minutes, 'reading', p_reading_minutes, 'writing', p_writing_minutes)
  );
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
    'section_timings', (
      SELECT jsonb_build_object(
        'listening_minutes', timing.listening_minutes,
        'reading_minutes', timing.reading_minutes,
        'writing_minutes', timing.writing_minutes
      ) FROM public.contest_exam_section_timings AS timing WHERE timing.contest_id = c.id
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
  SELECT * INTO v_contest FROM public.contests
  WHERE slug = p_slug AND is_published AND archived_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contest not found'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.contest_registrations AS registration
    WHERE registration.contest_id = v_contest.id AND registration.user_id = auth.uid()
  ) THEN RAISE EXCEPTION 'Register for this contest before entering'; END IF;
  IF now() < v_contest.start_at THEN RAISE EXCEPTION 'Contest has not started'; END IF;
  IF now() >= v_contest.end_at THEN RAISE EXCEPTION 'Contest has finished'; END IF;

  SELECT jsonb_build_object(
    'contest', jsonb_build_object(
      'id', c.id, 'slug', c.slug, 'title', c.title, 'subject', c.subject,
      'start_at', c.start_at, 'end_at', c.end_at, 'contest_type', c.contest_type,
      'completed_at', registration.completed_at
    ),
    'exam_timing', CASE WHEN c.subject IN ('ielts', 'cefr') THEN (
      SELECT jsonb_build_object(
        'listening_minutes', timing.listening_minutes,
        'reading_minutes', timing.reading_minutes,
        'writing_minutes', timing.writing_minutes,
        'active_section', public.current_exam_section(c.id),
        'section_starts_at', CASE public.current_exam_section(c.id)
          WHEN 'listening' THEN c.start_at
          WHEN 'reading' THEN c.start_at + (timing.listening_minutes * interval '1 minute')
          ELSE c.start_at + ((timing.listening_minutes + timing.reading_minutes) * interval '1 minute')
        END,
        'section_ends_at', CASE public.current_exam_section(c.id)
          WHEN 'listening' THEN c.start_at + (timing.listening_minutes * interval '1 minute')
          WHEN 'reading' THEN c.start_at + ((timing.listening_minutes + timing.reading_minutes) * interval '1 minute')
          ELSE c.end_at
        END
      ) FROM public.contest_exam_section_timings AS timing WHERE timing.contest_id = c.id
    ) ELSE NULL END,
    'parts', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', part.id, 'position', part.position, 'section', part.section,
        'title', part.title, 'instructions', part.instructions, 'content', part.content,
        'audio_url', part.audio_url, 'max_points', part.max_points
      ) ORDER BY part.position)
      FROM public.contest_exam_parts AS part
      WHERE part.contest_id = c.id
        AND (c.subject NOT IN ('ielts', 'cefr') OR part.section = public.current_exam_section(c.id))
    ), '[]'::jsonb),
    'questions', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', q.id, 'exam_part_id', q.exam_part_id, 'position', q.position,
        'prompt', q.prompt, 'options', q.options, 'points', q.points
      ) ORDER BY q.position)
      FROM public.contest_questions AS q
      WHERE q.contest_id = c.id
        AND (c.subject NOT IN ('ielts', 'cefr') OR EXISTS (
          SELECT 1 FROM public.contest_exam_parts AS part
          WHERE part.id = q.exam_part_id AND part.section = public.current_exam_section(c.id)
        ))
    ), '[]'::jsonb),
    'answers', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'question_id', answer.question_id, 'selected_option', answer.selected_option
      ) ORDER BY question.position)
      FROM public.contest_answers AS answer
      JOIN public.contest_questions AS question ON question.id = answer.question_id
      WHERE answer.contest_id = c.id AND answer.user_id = auth.uid()
        AND (c.subject NOT IN ('ielts', 'cefr') OR EXISTS (
          SELECT 1 FROM public.contest_exam_parts AS part
          WHERE part.id = question.exam_part_id AND part.section = public.current_exam_section(c.id)
        ))
    ), '[]'::jsonb),
    'writing_responses', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'part_id', submission.exam_part_id, 'content', submission.content,
        'submitted_at', submission.submitted_at, 'updated_at', submission.updated_at
      ) ORDER BY part.position)
      FROM public.contest_writing_submissions AS submission
      JOIN public.contest_exam_parts AS part ON part.id = submission.exam_part_id
      WHERE submission.contest_id = c.id AND submission.user_id = auth.uid()
        AND (c.subject NOT IN ('ielts', 'cefr') OR part.section = public.current_exam_section(c.id))
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
  v_section text;
  v_timing public.contest_exam_section_timings%ROWTYPE;
  v_section_start timestamptz;
  v_section_end timestamptz;
  v_correct boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.active_profile(auth.uid()) THEN RAISE EXCEPTION 'An active account is required to submit'; END IF;
  SELECT q.* INTO v_question FROM public.contest_questions AS q WHERE q.id = p_question_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Question not found'; END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = v_question.contest_id;
  IF NOT v_contest.is_published OR v_contest.archived_at IS NOT NULL OR now() < v_contest.start_at OR now() >= v_contest.end_at THEN
    RAISE EXCEPTION 'Answers are not accepted for this contest at this time';
  END IF;
  IF v_contest.subject IN ('ielts', 'cefr') THEN
    SELECT section INTO v_section FROM public.contest_exam_parts WHERE id = v_question.exam_part_id AND contest_id = v_contest.id;
    SELECT * INTO v_timing FROM public.contest_exam_section_timings WHERE contest_id = v_contest.id;
    IF v_section IS NULL OR v_section NOT IN ('listening', 'reading') OR NOT FOUND THEN RAISE EXCEPTION 'Question section timing is unavailable'; END IF;
    IF v_section = 'listening' THEN
      v_section_start := v_contest.start_at;
      v_section_end := v_section_start + (v_timing.listening_minutes * interval '1 minute');
    ELSE
      v_section_start := v_contest.start_at + (v_timing.listening_minutes * interval '1 minute');
      v_section_end := v_section_start + (v_timing.reading_minutes * interval '1 minute');
    END IF;
    IF now() < v_section_start OR now() >= v_section_end THEN RAISE EXCEPTION 'This exam section is closed'; END IF;
  END IF;
  IF v_contest.contest_type = 'rated' AND (v_contest.created_by = auth.uid() OR public.has_admin_access(auth.uid())) THEN RAISE EXCEPTION 'Contest managers cannot submit answers to a rated contest'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.contest_registrations AS registration WHERE registration.contest_id = v_contest.id AND registration.user_id = auth.uid()) THEN RAISE EXCEPTION 'Register for this contest before submitting'; END IF;
  IF v_contest.subject IN ('ielts', 'cefr') AND EXISTS (SELECT 1 FROM public.contest_registrations AS registration WHERE registration.contest_id = v_contest.id AND registration.user_id = auth.uid() AND registration.completed_at IS NOT NULL) THEN RAISE EXCEPTION 'This exam has already been submitted'; END IF;
  IF p_selected_option IS NULL OR p_selected_option < 0 OR p_selected_option >= jsonb_array_length(v_question.options) THEN RAISE EXCEPTION 'Invalid answer option'; END IF;
  v_correct := p_selected_option = v_question.correct_option;
  INSERT INTO public.contest_answers (contest_id, question_id, user_id, selected_option, is_correct, score)
  VALUES (v_contest.id, v_question.id, auth.uid(), p_selected_option, v_correct, CASE WHEN v_correct THEN v_question.points ELSE 0 END)
  ON CONFLICT (question_id, user_id) DO UPDATE SET selected_option = EXCLUDED.selected_option, is_correct = EXCLUDED.is_correct, score = EXCLUDED.score, submitted_at = now();
  UPDATE public.contest_registrations SET last_activity_at = now() WHERE contest_id = v_contest.id AND user_id = auth.uid();
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
  v_timing public.contest_exam_section_timings%ROWTYPE;
  v_writing_start timestamptz;
  v_submitted_at timestamptz;
BEGIN
  IF auth.uid() IS NULL OR NOT public.active_profile(auth.uid()) THEN RAISE EXCEPTION 'An active account is required to submit writing'; END IF;
  SELECT * INTO v_part FROM public.contest_exam_parts WHERE id = p_exam_part_id;
  IF NOT FOUND OR v_part.section <> 'writing' THEN RAISE EXCEPTION 'Writing part not found'; END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = v_part.contest_id;
  IF NOT v_contest.is_published OR v_contest.archived_at IS NOT NULL OR now() < v_contest.start_at OR now() >= v_contest.end_at THEN RAISE EXCEPTION 'Writing is not accepted for this exam at this time'; END IF;
  SELECT * INTO v_timing FROM public.contest_exam_section_timings WHERE contest_id = v_contest.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Writing timing is unavailable'; END IF;
  v_writing_start := v_contest.start_at + ((v_timing.listening_minutes + v_timing.reading_minutes) * interval '1 minute');
  IF now() < v_writing_start THEN RAISE EXCEPTION 'Writing has not started yet'; END IF;
  IF v_contest.contest_type = 'rated' AND (v_contest.created_by = auth.uid() OR public.has_admin_access(auth.uid())) THEN RAISE EXCEPTION 'Contest managers cannot submit writing to a rated exam'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.contest_registrations AS registration WHERE registration.contest_id = v_contest.id AND registration.user_id = auth.uid()) THEN RAISE EXCEPTION 'Register for this exam before submitting writing'; END IF;
  IF EXISTS (SELECT 1 FROM public.contest_registrations AS registration WHERE registration.contest_id = v_contest.id AND registration.user_id = auth.uid() AND registration.completed_at IS NOT NULL) THEN RAISE EXCEPTION 'This exam has already been submitted'; END IF;
  IF char_length(trim(coalesce(p_content, ''))) < 1 THEN RAISE EXCEPTION 'Writing response cannot be empty'; END IF;
  SELECT submitted_at INTO v_submitted_at FROM public.contest_writing_submissions WHERE exam_part_id = p_exam_part_id AND user_id = auth.uid() FOR UPDATE;
  IF v_submitted_at IS NOT NULL THEN RAISE EXCEPTION 'This writing response has already been submitted'; END IF;
  INSERT INTO public.contest_writing_submissions (contest_id, exam_part_id, user_id, content, submitted_at)
  VALUES (v_contest.id, p_exam_part_id, auth.uid(), trim(p_content), CASE WHEN p_submit THEN now() ELSE NULL END)
  ON CONFLICT (exam_part_id, user_id) DO UPDATE SET content = EXCLUDED.content, submitted_at = CASE WHEN p_submit THEN now() ELSE NULL END, updated_at = now()
  RETURNING submitted_at INTO v_submitted_at;
  UPDATE public.contest_registrations SET last_activity_at = now() WHERE contest_id = v_contest.id AND user_id = auth.uid();
  RETURN jsonb_build_object('saved', true, 'submitted_at', v_submitted_at);
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
  v_timing public.contest_exam_section_timings%ROWTYPE;
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
    IF EXISTS (SELECT 1 FROM unnest(ARRAY['listening', 'reading', 'writing']::text[]) AS required(section) WHERE NOT EXISTS (SELECT 1 FROM public.contest_exam_parts AS part WHERE part.contest_id = p_contest_id AND part.section = required.section)) THEN RAISE EXCEPTION 'IELTS and CEFR exams require Listening, Reading, and Writing parts'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.contest_questions WHERE contest_id = p_contest_id) THEN RAISE EXCEPTION 'Add listening or reading questions before publishing'; END IF;
    IF EXISTS (SELECT 1 FROM public.contest_questions WHERE contest_id = p_contest_id AND exam_part_id IS NULL) THEN RAISE EXCEPTION 'Every IELTS or CEFR question must be assigned to a part'; END IF;
    FOR v_part IN SELECT * FROM public.contest_exam_parts WHERE contest_id = p_contest_id LOOP
      IF v_part.section = 'listening' AND nullif(trim(v_part.audio_url), '') IS NULL THEN RAISE EXCEPTION 'Every listening part must include an audio file'; END IF;
      IF v_part.section IN ('reading', 'writing') AND char_length(trim(v_part.content)) < 1 THEN RAISE EXCEPTION 'Every reading passage and writing topic must contain text'; END IF;
      IF v_part.section IN ('listening', 'reading') AND NOT EXISTS (SELECT 1 FROM public.contest_questions WHERE exam_part_id = v_part.id) THEN RAISE EXCEPTION 'Every listening and reading part must have at least one question'; END IF;
    END LOOP;
  ELSIF NOT EXISTS (SELECT 1 FROM public.contest_questions WHERE contest_id = p_contest_id) THEN
    RAISE EXCEPTION 'Add at least one complete question before publishing';
  END IF;
  UPDATE public.contests SET is_published = true WHERE id = p_contest_id;
  PERFORM public.log_audit_action('contest.publish', 'contest', p_contest_id, '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.current_exam_section(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_contest_exam_section_timings(uuid, integer, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_contest_editor(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_contest_workspace(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_contest_answer(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_exam_writing_response(uuid, text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.publish_contest(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.save_contest_exam_section_timings(uuid, integer, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_contest_editor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_contest_workspace(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_contest_answer(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_exam_writing_response(uuid, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_contest(uuid) TO authenticated;
