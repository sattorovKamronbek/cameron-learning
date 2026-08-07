/*
  Real contest system

  The browser never receives a correct answer, a fabricated standing, or a
  client-generated score.  Contest creation, publication, participation,
  scoring and ratings are all enforced by SECURITY DEFINER functions below.
*/

CREATE TABLE IF NOT EXISTS public.contests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 3 AND 160),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 5000),
  subject text NOT NULL CHECK (subject ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  difficulty text NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard', 'expert')),
  contest_type text NOT NULL DEFAULT 'unrated' CHECK (contest_type IN ('rated', 'unrated')),
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public')),
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL CHECK (end_at > start_at),
  max_participants integer NOT NULL CHECK (max_participants BETWEEN 1 AND 100000),
  rules jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(rules) = 'array'),
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  prize text,
  is_published boolean NOT NULL DEFAULT false,
  is_finalized boolean NOT NULL DEFAULT false,
  finalized_at timestamptz,
  archived_at timestamptz,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

CREATE TABLE IF NOT EXISTS public.contest_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  position integer NOT NULL CHECK (position > 0),
  prompt text NOT NULL CHECK (char_length(trim(prompt)) BETWEEN 1 AND 10000),
  options jsonb NOT NULL CHECK (jsonb_typeof(options) = 'array' AND jsonb_array_length(options) BETWEEN 2 AND 8),
  correct_option smallint NOT NULL CHECK (correct_option >= 0),
  explanation text,
  points integer NOT NULL DEFAULT 1 CHECK (points BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contest_id, position),
  CHECK (correct_option < jsonb_array_length(options))
);

CREATE TABLE IF NOT EXISTS public.contest_registrations (
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  registered_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz,
  PRIMARY KEY (contest_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.contest_answers (
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.contest_questions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  selected_option smallint NOT NULL CHECK (selected_option >= 0),
  is_correct boolean NOT NULL,
  score integer NOT NULL DEFAULT 0 CHECK (score >= 0),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (question_id, user_id)
);

-- Keep the redundant contest_id on answers consistent with the question. This
-- protects result calculations even if a future privileged writer is added.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'contest_questions_id_contest_id_key'
      AND conrelid = 'public.contest_questions'::regclass
  ) THEN
    ALTER TABLE public.contest_questions
      ADD CONSTRAINT contest_questions_id_contest_id_key UNIQUE (id, contest_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'contest_answers_question_contest_fkey'
      AND conrelid = 'public.contest_answers'::regclass
  ) THEN
    ALTER TABLE public.contest_answers
      ADD CONSTRAINT contest_answers_question_contest_fkey
      FOREIGN KEY (question_id, contest_id)
      REFERENCES public.contest_questions (id, contest_id)
      ON DELETE CASCADE;
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.user_subject_ratings (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject text NOT NULL,
  current_rating integer NOT NULL DEFAULT 1000 CHECK (current_rating >= 0),
  peak_rating integer NOT NULL DEFAULT 1000 CHECK (peak_rating >= 0),
  rated_contests integer NOT NULL DEFAULT 0 CHECK (rated_contests >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, subject)
);

CREATE TABLE IF NOT EXISTS public.contest_results (
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rank integer NOT NULL CHECK (rank > 0),
  score integer NOT NULL DEFAULT 0 CHECK (score >= 0),
  answered_count integer NOT NULL DEFAULT 0 CHECK (answered_count >= 0),
  rating_before integer,
  rating_after integer,
  rating_delta integer,
  finalized_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (contest_id, user_id)
);

CREATE INDEX IF NOT EXISTS contests_public_schedule_idx
  ON public.contests (is_published, archived_at, start_at, end_at);
CREATE INDEX IF NOT EXISTS contest_questions_contest_position_idx
  ON public.contest_questions (contest_id, position);
CREATE INDEX IF NOT EXISTS contest_answers_contest_user_idx
  ON public.contest_answers (contest_id, user_id);
CREATE INDEX IF NOT EXISTS contest_results_user_finalized_idx
  ON public.contest_results (user_id, finalized_at DESC);
CREATE INDEX IF NOT EXISTS user_subject_ratings_subject_rating_idx
  ON public.user_subject_ratings (subject, current_rating DESC);

DROP TRIGGER IF EXISTS contests_set_updated_at ON public.contests;
CREATE TRIGGER contests_set_updated_at
  BEFORE UPDATE ON public.contests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS contest_questions_set_updated_at ON public.contest_questions;
CREATE TRIGGER contest_questions_set_updated_at
  BEFORE UPDATE ON public.contest_questions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS contest_answers_set_updated_at ON public.contest_answers;
CREATE TRIGGER contest_answers_set_updated_at
  BEFORE UPDATE ON public.contest_answers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.active_profile(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_user_id AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_contest(p_contest_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.contests c
    JOIN public.profiles p ON p.id = p_user_id
    WHERE c.id = p_contest_id
      AND p.status = 'active'
      AND (p.role = 'admin' OR (p.role = 'judge' AND c.created_by = p_user_id))
  );
$$;

CREATE OR REPLACE FUNCTION public.contest_status(p_start_at timestamptz, p_end_at timestamptz)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN now() < p_start_at THEN 'upcoming'
    WHEN now() >= p_end_at THEN 'finished'
    ELSE 'live'
  END;
$$;

CREATE OR REPLACE FUNCTION public.contest_slug(p_title text)
RETURNS text
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_base text;
BEGIN
  v_base := trim(both '-' FROM regexp_replace(lower(trim(p_title)), '[^a-z0-9]+', '-', 'g'));
  IF v_base = '' THEN v_base := 'contest'; END IF;
  RETURN left(v_base, 48) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
END;
$$;

ALTER TABLE public.contests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contest_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contest_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contest_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subject_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contest_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_can_read_published_contests ON public.contests;
CREATE POLICY public_can_read_published_contests ON public.contests
  FOR SELECT TO anon, authenticated
  USING (is_published AND archived_at IS NULL AND visibility = 'public');

DROP POLICY IF EXISTS managers_can_read_own_contests ON public.contests;
CREATE POLICY managers_can_read_own_contests ON public.contests
  FOR SELECT TO authenticated
  USING (public.can_manage_contest(id));

DROP POLICY IF EXISTS users_can_read_own_registrations ON public.contest_registrations;
CREATE POLICY users_can_read_own_registrations ON public.contest_registrations
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.create_contest(
  p_title text,
  p_description text,
  p_subject text,
  p_difficulty text,
  p_contest_type text,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_max_participants integer,
  p_rules jsonb DEFAULT '[]'::jsonb,
  p_tags text[] DEFAULT ARRAY[]::text[],
  p_prize text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_judge_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only active judges or admins can create contests';
  END IF;
  IF char_length(trim(coalesce(p_title, ''))) < 3 THEN
    RAISE EXCEPTION 'Contest title must contain at least 3 characters';
  END IF;
  IF coalesce(p_subject, '') !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' THEN
    RAISE EXCEPTION 'Contest subject must be a slug';
  END IF;
  IF p_difficulty NOT IN ('easy', 'medium', 'hard', 'expert') THEN
    RAISE EXCEPTION 'Invalid contest difficulty';
  END IF;
  IF p_contest_type NOT IN ('rated', 'unrated') THEN
    RAISE EXCEPTION 'Invalid contest type';
  END IF;
  IF p_start_at <= now() OR p_end_at <= p_start_at THEN
    RAISE EXCEPTION 'A new contest must start in the future and end after it starts';
  END IF;
  IF p_max_participants IS NULL OR p_max_participants < 1 OR p_max_participants > 100000 THEN
    RAISE EXCEPTION 'Participant limit must be between 1 and 100000';
  END IF;
  IF jsonb_typeof(coalesce(p_rules, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Rules must be an array';
  END IF;

  INSERT INTO public.contests (
    slug, title, description, subject, difficulty, contest_type, start_at, end_at,
    max_participants, rules, tags, prize, created_by
  ) VALUES (
    public.contest_slug(p_title), trim(p_title), trim(coalesce(p_description, '')), p_subject,
    p_difficulty, p_contest_type, p_start_at, p_end_at, p_max_participants,
    coalesce(p_rules, '[]'::jsonb), coalesce(p_tags, ARRAY[]::text[]), nullif(trim(p_prize), ''), auth.uid()
  ) RETURNING id INTO v_id;

  PERFORM public.log_audit_action('contest.create', 'contest', v_id, jsonb_build_object('title', trim(p_title)));
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_contest(
  p_contest_id uuid,
  p_title text,
  p_description text,
  p_subject text,
  p_difficulty text,
  p_contest_type text,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_max_participants integer,
  p_rules jsonb DEFAULT '[]'::jsonb,
  p_tags text[] DEFAULT ARRAY[]::text[],
  p_prize text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contest public.contests%ROWTYPE;
BEGIN
  IF NOT public.can_manage_contest(p_contest_id) THEN
    RAISE EXCEPTION 'Only the owning judge or an admin can edit this contest';
  END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contest not found'; END IF;
  IF v_contest.is_published OR v_contest.start_at <= now() THEN
    RAISE EXCEPTION 'Published or started contests cannot be edited';
  END IF;
  IF char_length(trim(coalesce(p_title, ''))) < 3
    OR coalesce(p_subject, '') !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    OR p_difficulty NOT IN ('easy', 'medium', 'hard', 'expert')
    OR p_contest_type NOT IN ('rated', 'unrated')
    OR p_start_at <= now() OR p_end_at <= p_start_at
    OR p_max_participants NOT BETWEEN 1 AND 100000
    OR jsonb_typeof(coalesce(p_rules, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Invalid contest data';
  END IF;

  UPDATE public.contests
  SET title = trim(p_title), description = trim(coalesce(p_description, '')), subject = p_subject,
      difficulty = p_difficulty, contest_type = p_contest_type, start_at = p_start_at,
      end_at = p_end_at, max_participants = p_max_participants,
      rules = coalesce(p_rules, '[]'::jsonb), tags = coalesce(p_tags, ARRAY[]::text[]),
      prize = nullif(trim(p_prize), '')
  WHERE id = p_contest_id;

  PERFORM public.log_audit_action('contest.update', 'contest', p_contest_id, '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.save_contest_question(
  p_contest_id uuid,
  p_question_id uuid,
  p_position integer,
  p_prompt text,
  p_options jsonb,
  p_correct_option integer,
  p_points integer DEFAULT 1,
  p_explanation text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_question_id uuid;
  v_contest public.contests%ROWTYPE;
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
    SELECT 1
    FROM jsonb_array_elements(p_options) option_value(value)
    WHERE jsonb_typeof(option_value.value) <> 'string'
      OR char_length(trim(option_value.value #>> '{}')) = 0
  ) THEN
    RAISE EXCEPTION 'Question options cannot be empty';
  END IF;

  IF p_question_id IS NULL THEN
    INSERT INTO public.contest_questions (contest_id, position, prompt, options, correct_option, points, explanation)
    VALUES (p_contest_id, p_position, trim(p_prompt), p_options, p_correct_option, p_points, nullif(trim(p_explanation), ''))
    RETURNING id INTO v_question_id;
  ELSE
    UPDATE public.contest_questions
    SET position = p_position, prompt = trim(p_prompt), options = p_options,
        correct_option = p_correct_option, points = p_points, explanation = nullif(trim(p_explanation), '')
    WHERE id = p_question_id AND contest_id = p_contest_id
    RETURNING id INTO v_question_id;
    IF v_question_id IS NULL THEN RAISE EXCEPTION 'Question not found'; END IF;
  END IF;

  PERFORM public.log_audit_action('contest.question.save', 'contest', p_contest_id, jsonb_build_object('question_id', v_question_id));
  RETURN v_question_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_contest_question(p_contest_id uuid, p_question_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_contest public.contests%ROWTYPE;
BEGIN
  IF NOT public.can_manage_contest(p_contest_id) THEN
    RAISE EXCEPTION 'Only the owning judge or an admin can manage questions';
  END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id FOR UPDATE;
  IF NOT FOUND OR v_contest.is_published OR v_contest.start_at <= now() THEN
    RAISE EXCEPTION 'This question can no longer be removed';
  END IF;
  DELETE FROM public.contest_questions WHERE id = p_question_id AND contest_id = p_contest_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Question not found'; END IF;
  PERFORM public.log_audit_action('contest.question.delete', 'contest', p_contest_id, jsonb_build_object('question_id', p_question_id));
END;
$$;

CREATE OR REPLACE FUNCTION public.publish_contest(p_contest_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_contest public.contests%ROWTYPE;
BEGIN
  IF NOT public.can_manage_contest(p_contest_id) THEN
    RAISE EXCEPTION 'Only the owning judge or an admin can publish this contest';
  END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contest not found'; END IF;
  IF v_contest.is_published THEN RAISE EXCEPTION 'Contest is already published'; END IF;
  IF v_contest.start_at <= now() OR v_contest.end_at <= v_contest.start_at THEN
    RAISE EXCEPTION 'Contest schedule is no longer valid';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.contest_questions WHERE contest_id = p_contest_id) THEN
    RAISE EXCEPTION 'Add at least one complete question before publishing';
  END IF;
  UPDATE public.contests SET is_published = true WHERE id = p_contest_id;
  PERFORM public.log_audit_action('contest.publish', 'contest', p_contest_id, '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_contest(p_contest_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_contest public.contests%ROWTYPE;
BEGIN
  IF NOT public.can_manage_contest(p_contest_id) THEN
    RAISE EXCEPTION 'Only the owning judge or an admin can archive this contest';
  END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contest not found'; END IF;
  IF v_contest.is_published AND v_contest.start_at <= now() AND NOT v_contest.is_finalized THEN
    RAISE EXCEPTION 'Finalize a started contest before archiving it';
  END IF;
  UPDATE public.contests SET archived_at = now(), is_published = false WHERE id = p_contest_id;
  PERFORM public.log_audit_action('contest.archive', 'contest', p_contest_id, '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_contests()
RETURNS TABLE (
  id uuid,
  slug text,
  title text,
  description text,
  subject text,
  difficulty text,
  contest_type text,
  start_at timestamptz,
  end_at timestamptz,
  max_participants integer,
  rules jsonb,
  tags text[],
  prize text,
  organizer text,
  participant_count bigint,
  question_count bigint,
  status text,
  is_finalized boolean,
  is_registered boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id, c.slug, c.title, c.description, c.subject, c.difficulty, c.contest_type,
    c.start_at, c.end_at, c.max_participants, c.rules, c.tags, c.prize,
    coalesce(nullif(trim(p.full_name), ''), 'Contest organizer') AS organizer,
    (SELECT count(*) FROM public.contest_registrations r WHERE r.contest_id = c.id) AS participant_count,
    (SELECT count(*) FROM public.contest_questions q WHERE q.contest_id = c.id) AS question_count,
    public.contest_status(c.start_at, c.end_at) AS status,
    c.is_finalized,
    EXISTS (SELECT 1 FROM public.contest_registrations r WHERE r.contest_id = c.id AND r.user_id = auth.uid()) AS is_registered
  FROM public.contests c
  JOIN public.profiles p ON p.id = c.created_by
  WHERE c.is_published AND c.archived_at IS NULL AND c.visibility = 'public'
    AND EXISTS (SELECT 1 FROM public.contest_questions q WHERE q.contest_id = c.id)
  ORDER BY c.start_at ASC;
$$;

CREATE OR REPLACE FUNCTION public.get_public_contest(p_slug text)
RETURNS TABLE (
  id uuid,
  slug text,
  title text,
  description text,
  subject text,
  difficulty text,
  contest_type text,
  start_at timestamptz,
  end_at timestamptz,
  max_participants integer,
  rules jsonb,
  tags text[],
  prize text,
  organizer text,
  participant_count bigint,
  question_count bigint,
  status text,
  is_finalized boolean,
  is_registered boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.get_public_contests() WHERE slug = p_slug LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.register_for_contest(p_contest_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contest public.contests%ROWTYPE;
  v_registered boolean;
  v_count bigint;
BEGIN
  IF auth.uid() IS NULL OR NOT public.active_profile(auth.uid()) THEN
    RAISE EXCEPTION 'An active account is required to register';
  END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id FOR UPDATE;
  IF NOT FOUND OR NOT v_contest.is_published OR v_contest.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'Contest is not available';
  END IF;
  IF now() >= v_contest.end_at THEN
    RAISE EXCEPTION 'Registration is closed because this contest has finished';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.contest_questions WHERE contest_id = p_contest_id) THEN
    RAISE EXCEPTION 'Contest is not ready';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.contest_registrations
    WHERE contest_id = p_contest_id AND user_id = auth.uid()
  ) INTO v_registered;
  IF NOT v_registered THEN
    SELECT count(*) INTO v_count FROM public.contest_registrations WHERE contest_id = p_contest_id;
    IF v_count >= v_contest.max_participants THEN
      RAISE EXCEPTION 'Contest capacity has been reached';
    END IF;
    INSERT INTO public.contest_registrations (contest_id, user_id)
    VALUES (p_contest_id, auth.uid());
    INSERT INTO public.user_activity (user_id, type, title, metadata)
    VALUES (auth.uid(), 'contest_joined', 'Registered for contest', jsonb_build_object('contest_id', p_contest_id));
  END IF;

  RETURN jsonb_build_object('contest_id', p_contest_id, 'registered', true, 'already_registered', v_registered);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_contest_workspace(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  IF NOT EXISTS (SELECT 1 FROM public.contest_registrations r WHERE r.contest_id = v_contest.id AND r.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Register for this contest before entering';
  END IF;
  IF now() < v_contest.start_at THEN
    RAISE EXCEPTION 'Contest has not started';
  END IF;
  IF now() >= v_contest.end_at THEN
    RAISE EXCEPTION 'Contest has finished';
  END IF;

  SELECT jsonb_build_object(
    'contest', jsonb_build_object(
      'id', c.id, 'slug', c.slug, 'title', c.title, 'subject', c.subject,
      'start_at', c.start_at, 'end_at', c.end_at, 'contest_type', c.contest_type
    ),
    'questions', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', q.id, 'position', q.position, 'prompt', q.prompt,
        'options', q.options, 'points', q.points
      ) ORDER BY q.position)
      FROM public.contest_questions q WHERE q.contest_id = c.id
    ), '[]'::jsonb),
    'answers', coalesce((
      SELECT jsonb_agg(jsonb_build_object('question_id', a.question_id, 'selected_option', a.selected_option) ORDER BY q.position)
      FROM public.contest_answers a
      JOIN public.contest_questions q ON q.id = a.question_id
      WHERE a.contest_id = c.id AND a.user_id = auth.uid()
    ), '[]'::jsonb)
  ) INTO v_payload
  FROM public.contests c WHERE c.id = v_contest.id;

  RETURN v_payload;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_contest_answer(p_question_id uuid, p_selected_option integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_question public.contest_questions%ROWTYPE;
  v_contest public.contests%ROWTYPE;
  v_correct boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.active_profile(auth.uid()) THEN
    RAISE EXCEPTION 'An active account is required to submit';
  END IF;
  SELECT q.* INTO v_question FROM public.contest_questions q WHERE q.id = p_question_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Question not found'; END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = v_question.contest_id;
  IF NOT v_contest.is_published OR v_contest.archived_at IS NOT NULL
    OR now() < v_contest.start_at OR now() >= v_contest.end_at THEN
    RAISE EXCEPTION 'Answers are not accepted for this contest at this time';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.contest_registrations r WHERE r.contest_id = v_contest.id AND r.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Register for this contest before submitting';
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

  -- Do not reveal correctness until result finalization; this response contains
  -- only confirmation that the answer was stored.
  RETURN jsonb_build_object('saved', true, 'question_id', p_question_id);
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
SET search_path = public
AS $$
DECLARE v_contest public.contests%ROWTYPE;
BEGIN
  SELECT * INTO v_contest FROM public.contests WHERE slug = p_slug AND is_published AND archived_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contest not found'; END IF;
  IF NOT v_contest.is_finalized THEN
    RAISE EXCEPTION 'Leaderboard is available after the judge or admin finalizes the results';
  END IF;

  RETURN QUERY
  SELECT
    r.rank,
    r.user_id,
    coalesce(nullif(trim(p.full_name), ''), 'Participant'),
    r.score,
    r.answered_count,
    (SELECT count(*)::integer FROM public.contest_questions q WHERE q.contest_id = v_contest.id)
  FROM public.contest_results r
  JOIN public.profiles p ON p.id = r.user_id AND p.status = 'active'
  WHERE r.contest_id = v_contest.id
  ORDER BY r.rank;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_contest(p_contest_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  IF NOT v_contest.is_published OR v_contest.archived_at IS NOT NULL OR v_contest.end_at > now() THEN
    RAISE EXCEPTION 'Only a finished, published contest can be finalized';
  END IF;
  IF v_contest.is_finalized OR EXISTS (SELECT 1 FROM public.contest_results WHERE contest_id = p_contest_id) THEN
    RAISE EXCEPTION 'Contest results have already been finalized';
  END IF;
  SELECT coalesce(sum(points), 0)::integer INTO v_total_points
  FROM public.contest_questions WHERE contest_id = p_contest_id;
  IF v_total_points < 1 THEN RAISE EXCEPTION 'Contest has no scorable questions'; END IF;

  FOR v_result IN
    WITH scores AS (
      SELECT r.user_id,
        coalesce(sum(a.score), 0)::integer AS score,
        count(a.question_id)::integer AS answered_count,
        max(r.last_activity_at) AS last_activity
      FROM public.contest_registrations r
      LEFT JOIN public.contest_answers a ON a.contest_id = r.contest_id AND a.user_id = r.user_id
      WHERE r.contest_id = p_contest_id
      GROUP BY r.user_id
      HAVING count(a.question_id) > 0
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
      SELECT current_rating INTO v_before
      FROM public.user_subject_ratings
      WHERE user_id = v_result.user_id AND subject = v_contest.subject
      FOR UPDATE;
      v_before := coalesce(v_before, 1000);
      -- Ratings are deterministic and based on real, persisted score only.
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

CREATE OR REPLACE FUNCTION public.get_managed_contests()
RETURNS TABLE (
  id uuid,
  slug text,
  title text,
  description text,
  subject text,
  difficulty text,
  contest_type text,
  start_at timestamptz,
  end_at timestamptz,
  max_participants integer,
  rules jsonb,
  tags text[],
  prize text,
  is_published boolean,
  is_finalized boolean,
  archived_at timestamptz,
  participant_count bigint,
  question_count bigint,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_judge_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only active judges or admins can manage contests';
  END IF;
  RETURN QUERY
  SELECT c.id, c.slug, c.title, c.description, c.subject, c.difficulty, c.contest_type,
    c.start_at, c.end_at, c.max_participants, c.rules, c.tags, c.prize,
    c.is_published, c.is_finalized, c.archived_at,
    (SELECT count(*) FROM public.contest_registrations r WHERE r.contest_id = c.id),
    (SELECT count(*) FROM public.contest_questions q WHERE q.contest_id = c.id),
    public.contest_status(c.start_at, c.end_at)
  FROM public.contests c
  WHERE public.can_manage_contest(c.id)
  ORDER BY c.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_contest_editor(p_contest_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    'questions', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', q.id, 'position', q.position, 'prompt', q.prompt, 'options', q.options,
        'correct_option', q.correct_option, 'points', q.points, 'explanation', q.explanation
      ) ORDER BY q.position)
      FROM public.contest_questions q WHERE q.contest_id = c.id
    ), '[]'::jsonb)
  ) INTO v_payload
  FROM public.contests c WHERE c.id = p_contest_id;
  IF v_payload IS NULL THEN RAISE EXCEPTION 'Contest not found'; END IF;
  RETURN v_payload;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_rating_leaderboard(p_subject text DEFAULT NULL)
RETURNS TABLE (
  rank integer,
  user_id uuid,
  display_name text,
  subject text,
  country text,
  school text,
  rating integer,
  contest_count integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH aggregates AS (
    SELECT usr.user_id,
      CASE WHEN p_subject IS NULL OR p_subject = '' THEN NULL ELSE max(usr.subject) END AS subject,
      round(avg(usr.current_rating))::integer AS rating,
      sum(usr.rated_contests)::integer AS contest_count
    FROM public.user_subject_ratings usr
    WHERE p_subject IS NULL OR p_subject = '' OR usr.subject = p_subject
    GROUP BY usr.user_id
  ), ranked AS (
    SELECT a.*, row_number() OVER (ORDER BY a.rating DESC, a.contest_count DESC, a.user_id)::integer AS rank
    FROM aggregates a
  )
  SELECT r.rank, r.user_id,
    coalesce(nullif(trim(p.full_name), ''), 'Competitor'),
    r.subject, NULL::text, NULL::text, r.rating, r.contest_count
  FROM ranked r
  JOIN public.profiles p ON p.id = r.user_id AND p.status = 'active'
  ORDER BY r.rank;
$$;

CREATE OR REPLACE FUNCTION public.get_my_contest_stats()
RETURNS TABLE (
  contests_entered integer,
  accepted_submissions integer,
  problems_solved integer,
  current_rating integer,
  peak_rating integer,
  global_rank integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL OR NOT public.active_profile(v_user_id) THEN
    RAISE EXCEPTION 'An active account is required';
  END IF;
  RETURN QUERY
  WITH ratings AS (
    SELECT round(avg(current_rating))::integer AS current_rating, max(peak_rating)::integer AS peak_rating
    FROM public.user_subject_ratings WHERE user_id = v_user_id
  ), global AS (
    SELECT user_id, row_number() OVER (ORDER BY rating DESC, contest_count DESC, user_id)::integer AS rank
    FROM (
      SELECT usr.user_id, round(avg(usr.current_rating))::integer AS rating, sum(usr.rated_contests)::integer AS contest_count
      FROM public.user_subject_ratings usr
      JOIN public.profiles p ON p.id = usr.user_id AND p.status = 'active'
      GROUP BY usr.user_id
    ) totals
  )
  SELECT
    (SELECT count(*)::integer FROM public.contest_results r WHERE r.user_id = v_user_id),
    (
      SELECT count(*)::integer
      FROM public.contest_answers a
      JOIN public.contest_results r ON r.contest_id = a.contest_id AND r.user_id = a.user_id
      WHERE a.user_id = v_user_id AND a.is_correct
    ),
    (
      SELECT count(*)::integer
      FROM public.contest_answers a
      JOIN public.contest_results r ON r.contest_id = a.contest_id AND r.user_id = a.user_id
      WHERE a.user_id = v_user_id AND a.score > 0
    ),
    ratings.current_rating,
    ratings.peak_rating,
    global.rank
  FROM ratings
  LEFT JOIN global ON global.user_id = v_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_rating_history()
RETURNS TABLE (
  id uuid,
  contest_id uuid,
  contest_name text,
  subject text,
  completed_at timestamptz,
  rank integer,
  old_rating integer,
  new_rating integer,
  delta integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.active_profile(auth.uid()) THEN
    RAISE EXCEPTION 'An active account is required';
  END IF;
  RETURN QUERY
  SELECT r.contest_id, r.contest_id, c.title, c.subject, r.finalized_at,
    r.rank, r.rating_before, r.rating_after, r.rating_delta
  FROM public.contest_results r
  JOIN public.contests c ON c.id = r.contest_id
  WHERE r.user_id = auth.uid() AND r.rating_after IS NOT NULL
  ORDER BY r.finalized_at DESC;
END;
$$;

-- Explicitly make SECURITY DEFINER functions private. PostgreSQL otherwise
-- grants EXECUTE to PUBLIC, which would bypass the intended Supabase roles.
REVOKE ALL ON FUNCTION public.active_profile(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_contest(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.contest_status(timestamptz, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.contest_slug(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_contests() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_contest(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.register_for_contest(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_contest_workspace(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_contest_answer(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_contest_leaderboard(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_contest(text, text, text, text, text, timestamptz, timestamptz, integer, jsonb, text[], text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_contest(uuid, text, text, text, text, text, timestamptz, timestamptz, integer, jsonb, text[], text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_contest_question(uuid, uuid, integer, text, jsonb, integer, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_contest_question(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.publish_contest(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.archive_contest(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_contest(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_managed_contests() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_contest_editor(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_rating_leaderboard(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_contest_stats() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_rating_history() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.can_manage_contest(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_contests() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_contest(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_for_contest(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_contest_workspace(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_contest_answer(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_contest_leaderboard(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_contest(text, text, text, text, text, timestamptz, timestamptz, integer, jsonb, text[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_contest(uuid, text, text, text, text, text, timestamptz, timestamptz, integer, jsonb, text[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_contest_question(uuid, uuid, integer, text, jsonb, integer, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_contest_question(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_contest(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_contest(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_contest(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_managed_contests() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_contest_editor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_rating_leaderboard(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_contest_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_rating_history() TO authenticated;
