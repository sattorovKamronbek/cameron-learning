/*
  Programming problem bank and contest problem sets.

  A problem belongs to one library. Problems created for a contest retain that
  identity; the public Practice catalogue derives their availability from the
  associated contest's end_at. This makes post-contest publication automatic
  without copying statements or relying on a scheduled job.
*/

CREATE TABLE IF NOT EXISTS public.programming_problems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 3 AND 180),
  statement text NOT NULL CHECK (char_length(trim(statement)) BETWEEN 1 AND 50000),
  input_description text NOT NULL DEFAULT '',
  output_description text NOT NULL DEFAULT '',
  constraints text NOT NULL DEFAULT '',
  examples jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(examples) = 'array'),
  time_limit_ms integer NOT NULL DEFAULT 1000 CHECK (time_limit_ms BETWEEN 50 AND 60000),
  memory_limit_mb integer NOT NULL DEFAULT 256 CHECK (memory_limit_mb BETWEEN 16 AND 1024),
  difficulty text NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  editorial text,
  publication_scope text NOT NULL DEFAULT 'site' CHECK (publication_scope IN ('site', 'contest')),
  is_published boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.programming_problem_test_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id uuid NOT NULL REFERENCES public.programming_problems(id) ON DELETE CASCADE,
  input text NOT NULL,
  output text NOT NULL,
  is_sample boolean NOT NULL DEFAULT false,
  weight integer NOT NULL DEFAULT 1 CHECK (weight BETWEEN 1 AND 100),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.contest_programming_problems (
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  problem_id uuid NOT NULL REFERENCES public.programming_problems(id) ON DELETE RESTRICT,
  position integer NOT NULL CHECK (position BETWEEN 1 AND 52),
  points integer NOT NULL DEFAULT 100 CHECK (points BETWEEN 1 AND 10000),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (contest_id, problem_id),
  UNIQUE (contest_id, position)
);

CREATE INDEX IF NOT EXISTS programming_problems_public_idx
  ON public.programming_problems (is_published, publication_scope, created_at DESC);
CREATE INDEX IF NOT EXISTS programming_problem_test_cases_problem_idx
  ON public.programming_problem_test_cases (problem_id);
CREATE INDEX IF NOT EXISTS contest_programming_problems_position_idx
  ON public.contest_programming_problems (contest_id, position);

DROP TRIGGER IF EXISTS programming_problems_set_updated_at ON public.programming_problems;
CREATE TRIGGER programming_problems_set_updated_at
  BEFORE UPDATE ON public.programming_problems
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.programming_problems ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programming_problem_test_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contest_programming_problems ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.programming_problems, public.programming_problem_test_cases, public.contest_programming_problems FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.programming_problem_slug(p_title text)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_base text;
BEGIN
  v_base := trim(both '-' FROM regexp_replace(lower(trim(coalesce(p_title, ''))), '[^a-z0-9]+', '-', 'g'));
  IF v_base = '' THEN v_base := 'problem'; END IF;
  RETURN left(v_base, 48) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
END;
$$;

CREATE OR REPLACE FUNCTION public.can_manage_programming_problem(
  p_problem_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT p_user_id IS NOT NULL
    AND p_user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.programming_problems AS problem
      JOIN public.profiles AS profile ON profile.id = p_user_id
      WHERE problem.id = p_problem_id
        AND profile.status = 'active'
        AND (
          (profile.role = 'judge' AND problem.created_by = p_user_id)
          OR (profile.role = 'admin' AND public.has_admin_access(p_user_id))
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.programming_problem_is_practice_available(p_problem_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.programming_problems AS problem
    WHERE problem.id = p_problem_id
      AND problem.is_published
      AND (
        problem.publication_scope = 'site'
        OR EXISTS (
          SELECT 1
          FROM public.contest_programming_problems AS link
          JOIN public.contests AS contest ON contest.id = link.contest_id
          WHERE link.problem_id = problem.id
            AND contest.is_published
            AND contest.archived_at IS NULL
            AND now() >= contest.end_at
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.save_programming_problem(
  p_title text,
  p_statement text,
  p_input_description text,
  p_output_description text,
  p_constraints text,
  p_examples jsonb,
  p_time_limit_ms integer,
  p_memory_limit_mb integer,
  p_difficulty text,
  p_tags text[],
  p_editorial text,
  p_publication_scope text,
  p_test_cases jsonb,
  p_problem_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_problem_id uuid;
  v_test record;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_judge_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only active judges or admins can manage programming problems';
  END IF;
  IF char_length(trim(coalesce(p_title, ''))) < 3
    OR char_length(trim(coalesce(p_statement, ''))) < 1
    OR p_time_limit_ms NOT BETWEEN 50 AND 60000
    OR p_memory_limit_mb NOT BETWEEN 16 AND 1024
    OR p_difficulty NOT IN ('easy', 'medium', 'hard')
    OR p_publication_scope NOT IN ('site', 'contest')
    OR jsonb_typeof(coalesce(p_examples, 'null'::jsonb)) <> 'array'
    OR jsonb_typeof(coalesce(p_test_cases, 'null'::jsonb)) <> 'array'
    OR jsonb_array_length(CASE WHEN jsonb_typeof(p_test_cases) = 'array' THEN p_test_cases ELSE '[]'::jsonb END) < 1 THEN
    RAISE EXCEPTION 'Invalid programming problem data';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_examples) AS example(value)
    WHERE coalesce(jsonb_typeof(example.value -> 'input'), '') <> 'string'
       OR coalesce(jsonb_typeof(example.value -> 'output'), '') <> 'string'
       OR (example.value ? 'explanation' AND example.value -> 'explanation' <> 'null'::jsonb AND jsonb_typeof(example.value -> 'explanation') <> 'string')
  ) THEN
    RAISE EXCEPTION 'Problem examples must contain text input and output';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_test_cases) AS test_case(value)
    WHERE coalesce(jsonb_typeof(test_case.value -> 'input'), '') <> 'string'
       OR coalesce(jsonb_typeof(test_case.value -> 'output'), '') <> 'string'
       OR coalesce(
         CASE WHEN coalesce(test_case.value ->> 'weight', '') ~ '^[0-9]+$'
           THEN (test_case.value ->> 'weight')::integer
           ELSE 0
         END,
         0
       ) NOT BETWEEN 1 AND 100
  ) THEN
    RAISE EXCEPTION 'Every judge test requires input, output and a valid weight';
  END IF;

  IF p_problem_id IS NULL THEN
    INSERT INTO public.programming_problems (
      slug, title, statement, input_description, output_description, constraints,
      examples, time_limit_ms, memory_limit_mb, difficulty, tags, editorial,
      publication_scope, created_by
    ) VALUES (
      public.programming_problem_slug(p_title), trim(p_title), trim(p_statement),
      trim(coalesce(p_input_description, '')), trim(coalesce(p_output_description, '')),
      trim(coalesce(p_constraints, '')), p_examples, p_time_limit_ms, p_memory_limit_mb,
      p_difficulty, coalesce(p_tags, ARRAY[]::text[]), nullif(trim(p_editorial), ''),
      p_publication_scope, auth.uid()
    ) RETURNING id INTO v_problem_id;
  ELSE
    IF NOT public.can_manage_programming_problem(p_problem_id) THEN
      RAISE EXCEPTION 'Only the owner judge or an administrator can edit this problem';
    END IF;
    UPDATE public.programming_problems
    SET title = trim(p_title), statement = trim(p_statement),
        input_description = trim(coalesce(p_input_description, '')),
        output_description = trim(coalesce(p_output_description, '')),
        constraints = trim(coalesce(p_constraints, '')), examples = p_examples,
        time_limit_ms = p_time_limit_ms, memory_limit_mb = p_memory_limit_mb,
        difficulty = p_difficulty, tags = coalesce(p_tags, ARRAY[]::text[]),
        editorial = nullif(trim(p_editorial), ''), publication_scope = p_publication_scope
    WHERE id = p_problem_id
    RETURNING id INTO v_problem_id;
    IF v_problem_id IS NULL THEN RAISE EXCEPTION 'Programming problem not found'; END IF;
    DELETE FROM public.programming_problem_test_cases WHERE problem_id = v_problem_id;
  END IF;

  FOR v_test IN
    SELECT * FROM jsonb_to_recordset(p_test_cases)
      AS test_case(input text, output text, is_sample boolean, weight integer)
  LOOP
    INSERT INTO public.programming_problem_test_cases (problem_id, input, output, is_sample, weight)
    VALUES (v_problem_id, v_test.input, v_test.output, coalesce(v_test.is_sample, false), v_test.weight);
  END LOOP;

  PERFORM public.log_audit_action(
    CASE WHEN p_problem_id IS NULL THEN 'programming_problem.create' ELSE 'programming_problem.update' END,
    'programming_problem', v_problem_id,
    jsonb_build_object('publication_scope', p_publication_scope)
  );
  RETURN v_problem_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_programming_problem(p_problem_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT public.can_manage_programming_problem(p_problem_id) THEN
    RAISE EXCEPTION 'Only the owner judge or an administrator can delete this problem';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.contest_programming_problems AS link
    JOIN public.contests AS contest ON contest.id = link.contest_id
    WHERE link.problem_id = p_problem_id AND contest.is_published
  ) THEN
    RAISE EXCEPTION 'A problem used by a published contest cannot be deleted';
  END IF;
  -- Draft contest links do not make a problem immutable. Remove those links
  -- explicitly before deleting the problem; published links were rejected
  -- above and therefore stay historically intact.
  DELETE FROM public.contest_programming_problems WHERE problem_id = p_problem_id;
  DELETE FROM public.programming_problems WHERE id = p_problem_id;
  PERFORM public.log_audit_action('programming_problem.delete', 'programming_problem', p_problem_id, '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.attach_programming_problem(
  p_contest_id uuid,
  p_problem_id uuid,
  p_position integer,
  p_points integer DEFAULT 100
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_contest public.contests%ROWTYPE;
BEGIN
  IF NOT public.can_manage_contest(p_contest_id) OR NOT public.can_manage_programming_problem(p_problem_id) THEN
    RAISE EXCEPTION 'You cannot manage this contest or programming problem';
  END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id FOR UPDATE;
  IF NOT FOUND OR v_contest.subject <> 'programming' THEN RAISE EXCEPTION 'Programming contest not found'; END IF;
  IF v_contest.is_published OR v_contest.archived_at IS NOT NULL OR v_contest.start_at <= now() THEN
    RAISE EXCEPTION 'Problems cannot be changed after a contest is published or started';
  END IF;
  IF p_position NOT BETWEEN 1 AND 52 OR p_points NOT BETWEEN 1 AND 10000 THEN
    RAISE EXCEPTION 'Invalid problem position or points';
  END IF;
  INSERT INTO public.contest_programming_problems (contest_id, problem_id, position, points)
  VALUES (p_contest_id, p_problem_id, p_position, p_points)
  ON CONFLICT (contest_id, problem_id) DO UPDATE
  SET position = EXCLUDED.position, points = EXCLUDED.points;
  PERFORM public.log_audit_action('contest.programming_problem.attach', 'contest', p_contest_id, jsonb_build_object('problem_id', p_problem_id));
END;
$$;

CREATE OR REPLACE FUNCTION public.detach_programming_problem(p_contest_id uuid, p_problem_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_contest public.contests%ROWTYPE;
BEGIN
  IF NOT public.can_manage_contest(p_contest_id) THEN RAISE EXCEPTION 'You cannot manage this contest'; END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id FOR UPDATE;
  IF NOT FOUND OR v_contest.is_published OR v_contest.start_at <= now() THEN
    RAISE EXCEPTION 'Problems cannot be changed after a contest is published or started';
  END IF;
  DELETE FROM public.contest_programming_problems WHERE contest_id = p_contest_id AND problem_id = p_problem_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Problem is not attached to this contest'; END IF;
  PERFORM public.log_audit_action('contest.programming_problem.detach', 'contest', p_contest_id, jsonb_build_object('problem_id', p_problem_id));
END;
$$;

CREATE OR REPLACE FUNCTION public.get_managed_programming_problems()
RETURNS TABLE (
  id uuid, slug text, title text, statement text, input_description text,
  output_description text, constraints text, examples jsonb, time_limit_ms integer,
  memory_limit_mb integer, difficulty text, tags text[], editorial text,
  publication_scope text, is_published boolean, created_at timestamptz,
  practice_available_at timestamptz, linked_contest_count bigint,
  contest_title text, contest_end_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_judge_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only active judges or admins can manage programming problems';
  END IF;
  RETURN QUERY
  SELECT
    problem.id, problem.slug, problem.title, problem.statement, problem.input_description,
    problem.output_description, problem.constraints, problem.examples, problem.time_limit_ms,
    problem.memory_limit_mb, problem.difficulty, problem.tags, problem.editorial,
    problem.publication_scope, problem.is_published, problem.created_at,
    CASE WHEN problem.publication_scope = 'site' THEN problem.created_at ELSE (
      SELECT min(contest.end_at)
      FROM public.contest_programming_problems AS link
      JOIN public.contests AS contest ON contest.id = link.contest_id
      WHERE link.problem_id = problem.id
        AND contest.is_published AND contest.archived_at IS NULL AND now() >= contest.end_at
    ) END AS practice_available_at,
    (SELECT count(*) FROM public.contest_programming_problems AS link WHERE link.problem_id = problem.id),
    (
      SELECT contest.title FROM public.contest_programming_problems AS link
      JOIN public.contests AS contest ON contest.id = link.contest_id
      WHERE link.problem_id = problem.id
      ORDER BY contest.start_at DESC LIMIT 1
    ),
    (
      SELECT contest.end_at FROM public.contest_programming_problems AS link
      JOIN public.contests AS contest ON contest.id = link.contest_id
      WHERE link.problem_id = problem.id
      ORDER BY contest.start_at DESC LIMIT 1
    )
  FROM public.programming_problems AS problem
  WHERE public.can_manage_programming_problem(problem.id)
  ORDER BY problem.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_programming_problem_editor(p_problem_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_payload jsonb;
BEGIN
  IF NOT public.can_manage_programming_problem(p_problem_id) THEN
    RAISE EXCEPTION 'You cannot view this programming problem editor';
  END IF;
  SELECT jsonb_build_object(
    'id', problem.id, 'slug', problem.slug, 'title', problem.title,
    'statement', problem.statement, 'input_description', problem.input_description,
    'output_description', problem.output_description, 'constraints', problem.constraints,
    'examples', problem.examples, 'time_limit_ms', problem.time_limit_ms,
    'memory_limit_mb', problem.memory_limit_mb, 'difficulty', problem.difficulty,
    'tags', problem.tags, 'editorial', problem.editorial,
    'publication_scope', problem.publication_scope, 'is_published', problem.is_published,
    'created_at', problem.created_at,
    'test_cases', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', test_case.id, 'input', test_case.input, 'output', test_case.output,
        'is_sample', test_case.is_sample, 'weight', test_case.weight
      ) ORDER BY test_case.created_at, test_case.id)
      FROM public.programming_problem_test_cases AS test_case
      WHERE test_case.problem_id = problem.id
    ), '[]'::jsonb)
  ) INTO v_payload
  FROM public.programming_problems AS problem
  WHERE problem.id = p_problem_id;
  IF v_payload IS NULL THEN RAISE EXCEPTION 'Programming problem not found'; END IF;
  RETURN v_payload;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_programming_contest_editor(p_contest_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_payload jsonb;
BEGIN
  IF NOT public.can_manage_contest(p_contest_id) THEN RAISE EXCEPTION 'You cannot view this contest editor'; END IF;
  SELECT jsonb_build_object(
    'id', contest.id, 'title', contest.title, 'start_at', contest.start_at,
    'end_at', contest.end_at, 'is_published', contest.is_published,
    'problems', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', problem.id, 'slug', problem.slug, 'title', problem.title,
        'difficulty', problem.difficulty, 'tags', problem.tags,
        'time_limit_ms', problem.time_limit_ms, 'memory_limit_mb', problem.memory_limit_mb,
        'position', link.position, 'points', link.points
      ) ORDER BY link.position)
      FROM public.contest_programming_problems AS link
      JOIN public.programming_problems AS problem ON problem.id = link.problem_id
      WHERE link.contest_id = contest.id
    ), '[]'::jsonb)
  ) INTO v_payload
  FROM public.contests AS contest
  WHERE contest.id = p_contest_id AND contest.subject = 'programming';
  IF v_payload IS NULL THEN RAISE EXCEPTION 'Programming contest not found'; END IF;
  RETURN v_payload;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_programming_problems()
RETURNS TABLE (
  id uuid, slug text, title text, statement text, input_description text,
  output_description text, constraints text, examples jsonb, time_limit_ms integer,
  memory_limit_mb integer, difficulty text, tags text[], editorial text,
  publication_scope text, is_published boolean, created_at timestamptz,
  practice_available_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    problem.id, problem.slug, problem.title, problem.statement, problem.input_description,
    problem.output_description, problem.constraints, problem.examples, problem.time_limit_ms,
    problem.memory_limit_mb, problem.difficulty, problem.tags, problem.editorial,
    problem.publication_scope, problem.is_published, problem.created_at,
    CASE WHEN problem.publication_scope = 'site' THEN problem.created_at ELSE (
      SELECT min(contest.end_at)
      FROM public.contest_programming_problems AS link
      JOIN public.contests AS contest ON contest.id = link.contest_id
      WHERE link.problem_id = problem.id
        AND contest.is_published AND contest.archived_at IS NULL AND now() >= contest.end_at
    ) END
  FROM public.programming_problems AS problem
  WHERE public.programming_problem_is_practice_available(problem.id)
  ORDER BY CASE problem.difficulty WHEN 'easy' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, problem.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_programming_problem(
  p_slug text,
  p_contest_slug text DEFAULT NULL
)
RETURNS TABLE (
  id uuid, slug text, title text, statement text, input_description text,
  output_description text, constraints text, examples jsonb, time_limit_ms integer,
  memory_limit_mb integer, difficulty text, tags text[], editorial text,
  publication_scope text, is_published boolean, created_at timestamptz,
  practice_available_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT *
  FROM public.get_public_programming_problems()
  WHERE slug = p_slug
  UNION ALL
  SELECT
    problem.id, problem.slug, problem.title, problem.statement, problem.input_description,
    problem.output_description, problem.constraints, problem.examples, problem.time_limit_ms,
    problem.memory_limit_mb, problem.difficulty, problem.tags, problem.editorial,
    problem.publication_scope, problem.is_published, problem.created_at, NULL::timestamptz
  FROM public.programming_problems AS problem
  JOIN public.contest_programming_problems AS link ON link.problem_id = problem.id
  JOIN public.contests AS contest ON contest.id = link.contest_id
  WHERE problem.slug = p_slug
    AND p_contest_slug IS NOT NULL
    AND contest.slug = p_contest_slug
    AND contest.subject = 'programming'
    AND contest.is_published AND contest.archived_at IS NULL
    AND now() >= contest.start_at AND now() < contest.end_at
    AND auth.uid() IS NOT NULL AND public.active_profile(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.contest_registrations AS registration
      WHERE registration.contest_id = contest.id AND registration.user_id = auth.uid()
    )
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_programming_contest_overview(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_payload jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', contest.id, 'slug', contest.slug, 'title', contest.title,
    'start_at', contest.start_at, 'end_at', contest.end_at,
    'status', public.contest_status(contest.start_at, contest.end_at),
    'problems', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', problem.id, 'slug', problem.slug, 'title', problem.title,
        'difficulty', problem.difficulty, 'tags', problem.tags,
        'time_limit_ms', problem.time_limit_ms, 'memory_limit_mb', problem.memory_limit_mb,
        'position', link.position, 'points', link.points
      ) ORDER BY link.position)
      FROM public.contest_programming_problems AS link
      JOIN public.programming_problems AS problem ON problem.id = link.problem_id
      WHERE link.contest_id = contest.id
    ), '[]'::jsonb)
  ) INTO v_payload
  FROM public.contests AS contest
  WHERE contest.slug = p_slug
    AND contest.subject = 'programming'
    AND contest.is_published AND contest.archived_at IS NULL;
  RETURN v_payload;
END;
$$;

-- Existing contest RPCs retain their API contracts but now understand both
-- academic multiple-choice contests and programming problem sets.
CREATE OR REPLACE FUNCTION public.publish_contest(p_contest_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_contest public.contests%ROWTYPE;
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
  ELSIF NOT EXISTS (SELECT 1 FROM public.contest_questions WHERE contest_id = p_contest_id) THEN
    RAISE EXCEPTION 'Add at least one complete question before publishing';
  END IF;
  UPDATE public.contests SET is_published = true WHERE id = p_contest_id;
  PERFORM public.log_audit_action('contest.publish', 'contest', p_contest_id, '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_contests()
RETURNS TABLE (
  id uuid, slug text, title text, description text, subject text, difficulty text,
  contest_type text, start_at timestamptz, end_at timestamptz, max_participants integer,
  rules jsonb, tags text[], prize text, organizer text, participant_count bigint,
  question_count bigint, status text, is_finalized boolean, is_registered boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    contest.id, contest.slug, contest.title, contest.description, contest.subject,
    contest.difficulty, contest.contest_type, contest.start_at, contest.end_at,
    contest.max_participants, contest.rules, contest.tags, contest.prize,
    coalesce(nullif(trim(profile.full_name), ''), 'Contest organizer'),
    (SELECT count(*) FROM public.contest_registrations AS registration WHERE registration.contest_id = contest.id),
    CASE WHEN contest.subject = 'programming'
      THEN (SELECT count(*) FROM public.contest_programming_problems AS link WHERE link.contest_id = contest.id)
      ELSE (SELECT count(*) FROM public.contest_questions AS question WHERE question.contest_id = contest.id)
    END,
    public.contest_status(contest.start_at, contest.end_at), contest.is_finalized,
    EXISTS (SELECT 1 FROM public.contest_registrations AS registration WHERE registration.contest_id = contest.id AND registration.user_id = auth.uid())
  FROM public.contests AS contest
  JOIN public.profiles AS profile ON profile.id = contest.created_by
  WHERE contest.is_published AND contest.archived_at IS NULL AND contest.visibility = 'public'
    AND (
      (contest.subject = 'programming' AND EXISTS (SELECT 1 FROM public.contest_programming_problems AS link WHERE link.contest_id = contest.id))
      OR (contest.subject <> 'programming' AND EXISTS (SELECT 1 FROM public.contest_questions AS question WHERE question.contest_id = contest.id))
    )
  ORDER BY contest.start_at ASC;
$$;

CREATE OR REPLACE FUNCTION public.get_public_contest(p_slug text)
RETURNS TABLE (
  id uuid, slug text, title text, description text, subject text, difficulty text,
  contest_type text, start_at timestamptz, end_at timestamptz, max_participants integer,
  rules jsonb, tags text[], prize text, organizer text, participant_count bigint,
  question_count bigint, status text, is_finalized boolean, is_registered boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT * FROM public.get_public_contests() WHERE slug = p_slug LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.register_for_contest(p_contest_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_contest public.contests%ROWTYPE; v_registered boolean; v_count bigint;
BEGIN
  IF auth.uid() IS NULL OR NOT public.active_profile(auth.uid()) THEN RAISE EXCEPTION 'An active account is required to register'; END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id FOR UPDATE;
  IF NOT FOUND OR NOT v_contest.is_published OR v_contest.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Contest is not available'; END IF;
  IF now() >= v_contest.end_at THEN RAISE EXCEPTION 'Registration is closed because this contest has finished'; END IF;
  IF v_contest.subject = 'programming' THEN
    IF NOT EXISTS (SELECT 1 FROM public.contest_programming_problems WHERE contest_id = p_contest_id) THEN RAISE EXCEPTION 'Contest is not ready'; END IF;
  ELSIF NOT EXISTS (SELECT 1 FROM public.contest_questions WHERE contest_id = p_contest_id) THEN RAISE EXCEPTION 'Contest is not ready'; END IF;
  IF v_contest.contest_type = 'rated' AND (v_contest.created_by = auth.uid() OR public.has_admin_access(auth.uid())) THEN RAISE EXCEPTION 'Contest managers cannot register for a rated contest'; END IF;
  SELECT EXISTS (SELECT 1 FROM public.contest_registrations WHERE contest_id = p_contest_id AND user_id = auth.uid()) INTO v_registered;
  IF NOT v_registered THEN
    SELECT count(*) INTO v_count FROM public.contest_registrations WHERE contest_id = p_contest_id;
    IF v_count >= v_contest.max_participants THEN RAISE EXCEPTION 'Contest capacity has been reached'; END IF;
    INSERT INTO public.contest_registrations (contest_id, user_id) VALUES (p_contest_id, auth.uid());
    INSERT INTO public.user_activity (user_id, type, title, metadata) VALUES (auth.uid(), 'contest_joined', 'Registered for contest', jsonb_build_object('contest_id', p_contest_id));
  END IF;
  RETURN jsonb_build_object('contest_id', p_contest_id, 'registered', true, 'already_registered', v_registered);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_managed_contests()
RETURNS TABLE (
  id uuid, slug text, title text, description text, subject text, difficulty text,
  contest_type text, start_at timestamptz, end_at timestamptz, max_participants integer,
  rules jsonb, tags text[], prize text, is_published boolean, is_finalized boolean,
  archived_at timestamptz, participant_count bigint, question_count bigint, status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_judge_or_admin(auth.uid()) THEN RAISE EXCEPTION 'Only active judges or admins can manage contests'; END IF;
  RETURN QUERY
  SELECT contest.id, contest.slug, contest.title, contest.description, contest.subject,
    contest.difficulty, contest.contest_type, contest.start_at, contest.end_at,
    contest.max_participants, contest.rules, contest.tags, contest.prize,
    contest.is_published, contest.is_finalized, contest.archived_at,
    (SELECT count(*) FROM public.contest_registrations AS registration WHERE registration.contest_id = contest.id),
    CASE WHEN contest.subject = 'programming'
      THEN (SELECT count(*) FROM public.contest_programming_problems AS link WHERE link.contest_id = contest.id)
      ELSE (SELECT count(*) FROM public.contest_questions AS question WHERE question.contest_id = contest.id)
    END,
    public.contest_status(contest.start_at, contest.end_at)
  FROM public.contests AS contest
  WHERE public.can_manage_contest(contest.id)
  ORDER BY contest.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.programming_problem_slug(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_programming_problem(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.programming_problem_is_practice_available(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_programming_problem(text, text, text, text, text, jsonb, integer, integer, text, text[], text, text, jsonb, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_programming_problem(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.attach_programming_problem(uuid, uuid, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.detach_programming_problem(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_managed_programming_problems() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_programming_problem_editor(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_programming_contest_editor(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_programming_problems() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_programming_problem(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_programming_contest_overview(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_public_programming_problems() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_programming_problem(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_programming_contest_overview(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_programming_problem(text, text, text, text, text, jsonb, integer, integer, text, text[], text, text, jsonb, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_programming_problem(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.attach_programming_problem(uuid, uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.detach_programming_problem(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_managed_programming_problems() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_programming_problem_editor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_programming_contest_editor(uuid) TO authenticated;
