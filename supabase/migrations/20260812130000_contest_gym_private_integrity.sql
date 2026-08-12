/*
  Contest modes, private access and rating hardening.

  The browser calls only the RPCs at the bottom of this file.  Access codes
  are hashed, private membership is server-side, and role rules are enforced
  again inside every mutation (the UI is never an authorization boundary).
*/

ALTER TABLE public.contests
  ADD COLUMN IF NOT EXISTS contest_mode text NOT NULL DEFAULT 'contest',
  ADD COLUMN IF NOT EXISTS private_access_hash text;

ALTER TABLE public.contests
  DROP CONSTRAINT IF EXISTS contests_visibility_check;

ALTER TABLE public.contests
  ADD CONSTRAINT contests_visibility_check
  CHECK (visibility IN ('public', 'private'));

ALTER TABLE public.contests
  DROP CONSTRAINT IF EXISTS contests_contest_mode_check;

ALTER TABLE public.contests
  ADD CONSTRAINT contests_contest_mode_check
  CHECK (contest_mode IN ('contest', 'gym'));

CREATE UNIQUE INDEX IF NOT EXISTS contests_private_access_hash_key
  ON public.contests (private_access_hash)
  WHERE private_access_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.contest_private_members (
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (contest_id, user_id)
);

CREATE INDEX IF NOT EXISTS contest_private_members_user_idx
  ON public.contest_private_members (user_id, joined_at DESC);

ALTER TABLE public.contest_private_members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.contest_private_members FROM PUBLIC, anon, authenticated;

-- A promoted private Gym becomes an administrator-owned rated contest.  A
-- judge therefore cannot alter its schedule, problems, results, or rating.
CREATE OR REPLACE FUNCTION public.can_manage_contest(
  p_contest_id uuid,
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
      FROM public.contests AS contest
      JOIN public.profiles AS profile ON profile.id = p_user_id
      WHERE contest.id = p_contest_id
        AND profile.status = 'active'
        AND (
          (profile.role = 'admin' AND public.has_admin_access(p_user_id))
          OR (
            profile.role = 'judge'
            AND contest.created_by = p_user_id
            AND contest.contest_mode = 'gym'
            AND contest.contest_type = 'unrated'
          )
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.create_contest_v2(
  p_title text,
  p_description text,
  p_subject text,
  p_difficulty text,
  p_contest_type text,
  p_contest_mode text,
  p_visibility text,
  p_private_access_code text,
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
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id uuid;
  v_role text;
  v_hash text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_judge_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only active judges or administrators can create contests';
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role = 'judge' AND (p_contest_mode <> 'gym' OR p_contest_type <> 'unrated') THEN
    RAISE EXCEPTION 'Judges can create unrated Gym contests only';
  END IF;
  IF p_contest_mode NOT IN ('contest', 'gym') OR p_contest_type NOT IN ('rated', 'unrated')
    OR p_visibility NOT IN ('public', 'private') THEN
    RAISE EXCEPTION 'Invalid contest mode, type, or visibility';
  END IF;
  IF p_contest_mode = 'gym' AND p_contest_type <> 'unrated' THEN
    RAISE EXCEPTION 'Gym contests are always unrated';
  END IF;
  IF char_length(trim(coalesce(p_title, ''))) NOT BETWEEN 3 AND 160
    OR coalesce(p_subject, '') !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    OR p_difficulty NOT IN ('easy', 'medium', 'hard', 'expert')
    OR p_start_at <= now() OR p_end_at <= p_start_at
    OR p_max_participants NOT BETWEEN 1 AND 100000
    OR jsonb_typeof(coalesce(p_rules, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Invalid contest data';
  END IF;

  IF p_visibility = 'private' THEN
    IF char_length(trim(coalesce(p_private_access_code, ''))) NOT BETWEEN 10 AND 200 THEN
      RAISE EXCEPTION 'Private contest access code must be 10 to 200 characters';
    END IF;
    v_hash := encode(digest(trim(p_private_access_code), 'sha256'), 'hex');
  END IF;

  INSERT INTO public.contests (
    slug, title, description, subject, difficulty, contest_type, contest_mode,
    visibility, private_access_hash, start_at, end_at, max_participants, rules,
    tags, prize, created_by
  ) VALUES (
    public.contest_slug(p_title), trim(p_title), trim(coalesce(p_description, '')),
    p_subject, p_difficulty, p_contest_type, p_contest_mode, p_visibility, v_hash,
    p_start_at, p_end_at, p_max_participants, coalesce(p_rules, '[]'::jsonb),
    coalesce(p_tags, ARRAY[]::text[]), nullif(trim(p_prize), ''), auth.uid()
  ) RETURNING id INTO v_id;

  PERFORM public.log_audit_action(
    'contest.create', 'contest', v_id,
    jsonb_build_object('mode', p_contest_mode, 'visibility', p_visibility, 'type', p_contest_type)
  );
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_contest_v2(
  p_contest_id uuid,
  p_title text,
  p_description text,
  p_subject text,
  p_difficulty text,
  p_contest_type text,
  p_contest_mode text,
  p_visibility text,
  p_private_access_code text,
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
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_contest public.contests%ROWTYPE;
  v_role text;
  v_hash text;
BEGIN
  IF NOT public.can_manage_contest(p_contest_id) THEN
    RAISE EXCEPTION 'You cannot edit this contest';
  END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id FOR UPDATE;
  IF NOT FOUND OR v_contest.is_published OR v_contest.start_at <= now() THEN
    RAISE EXCEPTION 'Published or started contests cannot be edited';
  END IF;
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role = 'judge' AND (p_contest_mode <> 'gym' OR p_contest_type <> 'unrated') THEN
    RAISE EXCEPTION 'Judges can edit only their unrated Gym contests';
  END IF;
  IF p_contest_mode NOT IN ('contest', 'gym') OR p_contest_type NOT IN ('rated', 'unrated')
    OR p_visibility NOT IN ('public', 'private') OR (p_contest_mode = 'gym' AND p_contest_type <> 'unrated')
    OR char_length(trim(coalesce(p_title, ''))) NOT BETWEEN 3 AND 160
    OR coalesce(p_subject, '') !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    OR p_difficulty NOT IN ('easy', 'medium', 'hard', 'expert')
    OR p_start_at <= now() OR p_end_at <= p_start_at
    OR p_max_participants NOT BETWEEN 1 AND 100000
    OR jsonb_typeof(coalesce(p_rules, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Invalid contest data';
  END IF;

  IF p_visibility = 'private' THEN
    IF nullif(trim(coalesce(p_private_access_code, '')), '') IS NOT NULL THEN
      IF char_length(trim(p_private_access_code)) NOT BETWEEN 10 AND 200 THEN
        RAISE EXCEPTION 'Private contest access code must be 10 to 200 characters';
      END IF;
      v_hash := encode(digest(trim(p_private_access_code), 'sha256'), 'hex');
    ELSE
      v_hash := v_contest.private_access_hash;
    END IF;
    IF v_hash IS NULL THEN RAISE EXCEPTION 'A private contest needs an access code'; END IF;
  ELSE
    v_hash := NULL;
  END IF;

  UPDATE public.contests
  SET title = trim(p_title), description = trim(coalesce(p_description, '')),
      subject = p_subject, difficulty = p_difficulty, contest_type = p_contest_type,
      contest_mode = p_contest_mode, visibility = p_visibility,
      private_access_hash = v_hash, start_at = p_start_at, end_at = p_end_at,
      max_participants = p_max_participants, rules = coalesce(p_rules, '[]'::jsonb),
      tags = coalesce(p_tags, ARRAY[]::text[]), prize = nullif(trim(p_prize), '')
  WHERE id = p_contest_id;
  PERFORM public.log_audit_action('contest.update', 'contest', p_contest_id, '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_contest(p_contest_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_contest public.contests%ROWTYPE;
BEGIN
  IF NOT public.can_manage_contest(p_contest_id) THEN RAISE EXCEPTION 'You cannot delete this contest'; END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contest not found'; END IF;
  IF v_contest.is_published OR v_contest.start_at <= now()
    OR EXISTS (SELECT 1 FROM public.contest_registrations WHERE contest_id = p_contest_id)
    OR EXISTS (SELECT 1 FROM public.contest_results WHERE contest_id = p_contest_id) THEN
    RAISE EXCEPTION 'Only an untouched future draft can be deleted';
  END IF;
  DELETE FROM public.contests WHERE id = p_contest_id;
  PERFORM public.log_audit_action('contest.delete', 'contest', p_contest_id, '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.promote_private_gym_to_rated(p_contest_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_contest public.contests%ROWTYPE;
BEGIN
  IF NOT public.has_admin_access(auth.uid()) THEN
    RAISE EXCEPTION 'Only a confirmed administrator can promote a private Gym';
  END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id FOR UPDATE;
  IF NOT FOUND OR v_contest.visibility <> 'private' OR v_contest.contest_mode <> 'gym'
    OR v_contest.is_published OR v_contest.start_at <= now() THEN
    RAISE EXCEPTION 'Only an unpublished future private Gym can be promoted';
  END IF;
  UPDATE public.contests SET contest_mode = 'contest', contest_type = 'rated' WHERE id = p_contest_id;
  PERFORM public.log_audit_action('contest.promote_private_gym', 'contest', p_contest_id, '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_private_contest_access(p_access_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_contest public.contests%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.active_profile(auth.uid()) THEN
    RAISE EXCEPTION 'An active account is required';
  END IF;
  IF char_length(trim(coalesce(p_access_code, ''))) NOT BETWEEN 10 AND 200 THEN
    RAISE EXCEPTION 'Invalid private contest access code';
  END IF;
  SELECT * INTO v_contest FROM public.contests
  WHERE visibility = 'private'
    AND private_access_hash = encode(digest(trim(p_access_code), 'sha256'), 'hex')
    AND is_published AND archived_at IS NULL
  LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Private contest was not found'; END IF;
  INSERT INTO public.contest_private_members (contest_id, user_id)
  VALUES (v_contest.id, auth.uid()) ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('contest_id', v_contest.id, 'slug', v_contest.slug);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_discoverable_contests()
RETURNS TABLE (
  id uuid, slug text, title text, description text, subject text, difficulty text,
  contest_type text, contest_mode text, visibility text, start_at timestamptz,
  end_at timestamptz, max_participants integer, rules jsonb, tags text[], prize text,
  organizer text, participant_count bigint, question_count bigint, status text,
  is_finalized boolean, is_registered boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    contest.id, contest.slug, contest.title, contest.description, contest.subject,
    contest.difficulty, contest.contest_type, contest.contest_mode, contest.visibility,
    contest.start_at, contest.end_at, contest.max_participants, contest.rules, contest.tags,
    contest.prize, coalesce(nullif(trim(profile.full_name), ''), 'Contest organizer'),
    (SELECT count(*) FROM public.contest_registrations r WHERE r.contest_id = contest.id),
    CASE WHEN contest.subject = 'programming'
      THEN (SELECT count(*) FROM public.contest_programming_problems link WHERE link.contest_id = contest.id)
      ELSE (SELECT count(*) FROM public.contest_questions question WHERE question.contest_id = contest.id)
    END,
    public.contest_status(contest.start_at, contest.end_at), contest.is_finalized,
    EXISTS (SELECT 1 FROM public.contest_registrations r WHERE r.contest_id = contest.id AND r.user_id = auth.uid())
  FROM public.contests contest
  JOIN public.profiles profile ON profile.id = contest.created_by
  WHERE contest.is_published AND contest.archived_at IS NULL
    AND (
      contest.visibility = 'public'
      OR EXISTS (SELECT 1 FROM public.contest_private_members member WHERE member.contest_id = contest.id AND member.user_id = auth.uid())
    )
    AND (
      (contest.subject = 'programming' AND EXISTS (SELECT 1 FROM public.contest_programming_problems link WHERE link.contest_id = contest.id))
      OR (contest.subject <> 'programming' AND EXISTS (SELECT 1 FROM public.contest_questions question WHERE question.contest_id = contest.id))
    )
  ORDER BY contest.start_at ASC;
$$;

CREATE OR REPLACE FUNCTION public.get_discoverable_contest(p_slug text)
RETURNS TABLE (
  id uuid, slug text, title text, description text, subject text, difficulty text,
  contest_type text, contest_mode text, visibility text, start_at timestamptz,
  end_at timestamptz, max_participants integer, rules jsonb, tags text[], prize text,
  organizer text, participant_count bigint, question_count bigint, status text,
  is_finalized boolean, is_registered boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT * FROM public.get_discoverable_contests() WHERE slug = p_slug LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_managed_contests_v2()
RETURNS TABLE (
  id uuid, slug text, title text, description text, subject text, difficulty text,
  contest_type text, contest_mode text, visibility text, start_at timestamptz,
  end_at timestamptz, max_participants integer, rules jsonb, tags text[], prize text,
  is_published boolean, is_finalized boolean, archived_at timestamptz,
  participant_count bigint, question_count bigint, status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_judge_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only active judges or administrators can manage contests';
  END IF;
  RETURN QUERY
  SELECT contest.id, contest.slug, contest.title, contest.description, contest.subject,
    contest.difficulty, contest.contest_type, contest.contest_mode, contest.visibility,
    contest.start_at, contest.end_at, contest.max_participants, contest.rules, contest.tags,
    contest.prize, contest.is_published, contest.is_finalized, contest.archived_at,
    (SELECT count(*) FROM public.contest_registrations r WHERE r.contest_id = contest.id),
    CASE WHEN contest.subject = 'programming'
      THEN (SELECT count(*) FROM public.contest_programming_problems link WHERE link.contest_id = contest.id)
      ELSE (SELECT count(*) FROM public.contest_questions question WHERE question.contest_id = contest.id)
    END,
    public.contest_status(contest.start_at, contest.end_at)
  FROM public.contests contest
  WHERE public.can_manage_contest(contest.id)
  ORDER BY contest.created_at DESC;
END;
$$;

-- Keep editor payloads complete.  Omitting either field here would make an
-- edit silently turn a private Gym into the public/default mode in the UI.
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
    'contest', jsonb_build_object(
      'id', contest.id, 'slug', contest.slug, 'title', contest.title, 'description', contest.description,
      'subject', contest.subject, 'difficulty', contest.difficulty, 'contest_type', contest.contest_type,
      'contest_mode', contest.contest_mode, 'visibility', contest.visibility,
      'start_at', contest.start_at, 'end_at', contest.end_at, 'max_participants', contest.max_participants,
      'rules', contest.rules, 'tags', contest.tags, 'prize', contest.prize, 'is_published', contest.is_published,
      'is_finalized', contest.is_finalized, 'archived_at', contest.archived_at
    ),
    'section_timings', (
      SELECT jsonb_build_object('listening_minutes', timing.listening_minutes, 'reading_minutes', timing.reading_minutes, 'writing_minutes', timing.writing_minutes)
      FROM public.contest_exam_section_timings timing WHERE timing.contest_id = contest.id
    ),
    'parts', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', part.id, 'position', part.position, 'section', part.section, 'title', part.title, 'instructions', part.instructions, 'content', part.content, 'audio_url', part.audio_url, 'max_points', part.max_points) ORDER BY part.position)
      FROM public.contest_exam_parts part WHERE part.contest_id = contest.id
    ), '[]'::jsonb),
    'questions', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', question.id, 'exam_part_id', question.exam_part_id, 'position', question.position, 'prompt', question.prompt, 'options', question.options, 'correct_option', question.correct_option, 'points', question.points, 'explanation', question.explanation) ORDER BY question.position)
      FROM public.contest_questions question WHERE question.contest_id = contest.id
    ), '[]'::jsonb)
  ) INTO v_payload
  FROM public.contests contest WHERE contest.id = p_contest_id;
  IF v_payload IS NULL THEN RAISE EXCEPTION 'Contest not found'; END IF;
  RETURN v_payload;
END;
$$;

-- A guessed private slug must not leak even a programming problem title.
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
      FROM public.contest_programming_problems link
      JOIN public.programming_problems problem ON problem.id = link.problem_id
      WHERE link.contest_id = contest.id
    ), '[]'::jsonb)
  ) INTO v_payload
  FROM public.contests contest
  WHERE contest.slug = p_slug AND contest.subject = 'programming'
    AND contest.is_published AND contest.archived_at IS NULL
    AND (contest.visibility = 'public' OR EXISTS (
      SELECT 1 FROM public.contest_private_members member
      WHERE member.contest_id = contest.id AND member.user_id = auth.uid()
    ));
  RETURN v_payload;
END;
$$;

CREATE OR REPLACE FUNCTION public.register_for_contest_v2(p_contest_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_contest public.contests%ROWTYPE; v_registered boolean; v_count bigint;
BEGIN
  IF auth.uid() IS NULL OR NOT public.active_profile(auth.uid()) THEN RAISE EXCEPTION 'An active account is required to register'; END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id FOR UPDATE;
  IF NOT FOUND OR NOT v_contest.is_published OR v_contest.archived_at IS NOT NULL OR now() >= v_contest.end_at THEN
    RAISE EXCEPTION 'Contest registration is unavailable';
  END IF;
  IF v_contest.visibility = 'private' AND NOT EXISTS (
    SELECT 1 FROM public.contest_private_members member WHERE member.contest_id = p_contest_id AND member.user_id = auth.uid()
  ) THEN RAISE EXCEPTION 'Redeem the private contest access code first'; END IF;
  IF v_contest.subject = 'programming' THEN
    IF NOT EXISTS (SELECT 1 FROM public.contest_programming_problems WHERE contest_id = p_contest_id) THEN RAISE EXCEPTION 'Contest is not ready'; END IF;
  ELSIF NOT EXISTS (SELECT 1 FROM public.contest_questions WHERE contest_id = p_contest_id) THEN
    RAISE EXCEPTION 'Contest is not ready';
  END IF;
  IF v_contest.contest_type = 'rated' AND (v_contest.created_by = auth.uid() OR public.has_admin_access(auth.uid())) THEN
    RAISE EXCEPTION 'Contest managers cannot register for a rated contest';
  END IF;
  SELECT EXISTS (SELECT 1 FROM public.contest_registrations WHERE contest_id = p_contest_id AND user_id = auth.uid()) INTO v_registered;
  IF NOT v_registered THEN
    SELECT count(*) INTO v_count FROM public.contest_registrations WHERE contest_id = p_contest_id;
    IF v_count >= v_contest.max_participants THEN RAISE EXCEPTION 'Contest capacity has been reached'; END IF;
    INSERT INTO public.contest_registrations (contest_id, user_id) VALUES (p_contest_id, auth.uid());
  END IF;
  RETURN jsonb_build_object('contest_id', p_contest_id, 'registered', true, 'already_registered', v_registered);
END;
$$;

-- Pairwise Elo with score-quality adjustment.  It is deterministic, bounded,
-- gives provisional accounts a larger K-factor, and snapshots every change in
-- contest_results.  Ratings are never calculated in the browser.
CREATE OR REPLACE FUNCTION public.finalize_contest_v2(p_contest_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_contest public.contests%ROWTYPE;
  v_result record;
  v_total_points integer;
  v_field_average numeric;
  v_field_size integer;
  v_before integer;
  v_after integer;
  v_delta integer;
  v_expected numeric;
  v_actual numeric;
  v_quality numeric;
  v_k numeric;
  v_rated_contests integer;
BEGIN
  IF NOT public.can_manage_contest(p_contest_id) THEN RAISE EXCEPTION 'You cannot finalize this contest'; END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id FOR UPDATE;
  IF NOT FOUND OR NOT v_contest.is_published OR v_contest.archived_at IS NOT NULL OR v_contest.end_at > now() THEN
    RAISE EXCEPTION 'Only a finished published contest can be finalized';
  END IF;
  IF v_contest.is_finalized OR EXISTS (SELECT 1 FROM public.contest_results WHERE contest_id = p_contest_id) THEN
    RAISE EXCEPTION 'Contest results have already been finalized';
  END IF;
  IF v_contest.contest_type = 'rated' AND NOT public.has_admin_access(auth.uid()) THEN
    RAISE EXCEPTION 'Only a confirmed administrator can finalize a rated contest';
  END IF;
  IF v_contest.contest_mode = 'gym' AND v_contest.contest_type <> 'unrated' THEN
    RAISE EXCEPTION 'Gym contests cannot be rated';
  END IF;

  SELECT coalesce(sum(points), 0)::integer INTO v_total_points FROM public.contest_questions WHERE contest_id = p_contest_id;
  IF v_total_points < 1 THEN RAISE EXCEPTION 'Contest has no scorable questions'; END IF;

  CREATE TEMP TABLE contest_rating_work (
    rank integer, user_id uuid, score integer, answered_count integer, rating integer, rated_contests integer
  ) ON COMMIT DROP;
  INSERT INTO contest_rating_work (rank, user_id, score, answered_count, rating, rated_contests)
  WITH scores AS (
    SELECT registration.user_id, coalesce(sum(answer.score), 0)::integer AS score,
      count(answer.question_id)::integer AS answered_count, max(registration.last_activity_at) AS last_activity
    FROM public.contest_registrations registration
    LEFT JOIN public.contest_answers answer ON answer.contest_id = registration.contest_id AND answer.user_id = registration.user_id
    WHERE registration.contest_id = p_contest_id
      AND (v_contest.contest_type <> 'rated' OR (registration.user_id <> v_contest.created_by AND NOT public.has_admin_access(registration.user_id)))
    GROUP BY registration.user_id
    HAVING count(answer.question_id) > 0
  ), ranked AS (
    SELECT row_number() OVER (ORDER BY score DESC, answered_count DESC, last_activity NULLS LAST, user_id)::integer AS rank,
      user_id, score, answered_count
    FROM scores
  )
  SELECT ranked.rank, ranked.user_id, ranked.score, ranked.answered_count,
    coalesce(rating.current_rating, 1000), coalesce(rating.rated_contests, 0)
  FROM ranked
  LEFT JOIN public.user_subject_ratings rating ON rating.user_id = ranked.user_id AND rating.subject = v_contest.subject;

  SELECT count(*), coalesce(avg(rating), 1000) INTO v_field_size, v_field_average FROM contest_rating_work;
  FOR v_result IN SELECT * FROM contest_rating_work ORDER BY rank LOOP
    v_before := NULL; v_after := NULL; v_delta := NULL;
    IF v_contest.contest_type = 'rated' THEN
      v_before := v_result.rating;
      v_rated_contests := v_result.rated_contests;
      v_expected := 1 / (1 + power(10::numeric, (v_field_average - v_before) / 400.0));
      v_actual := CASE WHEN v_field_size <= 1 THEN 0.5 ELSE 1 - ((v_result.rank - 1)::numeric / (v_field_size - 1)::numeric) END;
      v_quality := least(1::numeric, greatest(0::numeric, v_result.score::numeric / v_total_points::numeric));
      v_k := (CASE WHEN v_rated_contests < 5 THEN 48 ELSE 28 END) * least(1.8::numeric, greatest(0.7::numeric, sqrt(v_field_size::numeric / 10.0)));
      v_delta := greatest(-80, least(80, round(v_k * (((v_actual * 0.78) + (v_quality * 0.22)) - ((v_expected * 0.85) + 0.075)))::integer));
      v_after := greatest(0, v_before + v_delta);
      INSERT INTO public.user_subject_ratings (user_id, subject, current_rating, peak_rating, rated_contests)
      VALUES (v_result.user_id, v_contest.subject, v_after, greatest(v_before, v_after), 1)
      ON CONFLICT (user_id, subject) DO UPDATE SET
        current_rating = EXCLUDED.current_rating,
        peak_rating = greatest(public.user_subject_ratings.peak_rating, EXCLUDED.current_rating),
        rated_contests = public.user_subject_ratings.rated_contests + 1,
        updated_at = now();
      INSERT INTO public.app_notifications (user_id, type, title, message, metadata)
      VALUES (v_result.user_id, 'rating-change', 'Contest rating finalized', 'Your contest rating was calculated from the finalized standings.', jsonb_build_object('contest_id', p_contest_id, 'ratingBefore', v_before, 'ratingAfter', v_after, 'ratingDelta', v_delta, 'subject', v_contest.subject));
    END IF;
    INSERT INTO public.contest_results (contest_id, user_id, rank, score, answered_count, rating_before, rating_after, rating_delta)
    VALUES (p_contest_id, v_result.user_id, v_result.rank, v_result.score, v_result.answered_count, v_before, v_after, v_delta);
  END LOOP;
  UPDATE public.contests SET is_finalized = true, finalized_at = now() WHERE id = p_contest_id;
  PERFORM public.log_audit_action('contest.finalize', 'contest', p_contest_id, jsonb_build_object('rated', v_contest.contest_type = 'rated', 'algorithm', 'pairwise-elo-score-v1'));
END;
$$;

REVOKE ALL ON FUNCTION public.can_manage_contest(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_contest_v2(text, text, text, text, text, text, text, text, timestamptz, timestamptz, integer, jsonb, text[], text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_contest_v2(uuid, text, text, text, text, text, text, text, text, timestamptz, timestamptz, integer, jsonb, text[], text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_contest(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.promote_private_gym_to_rated(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.redeem_private_contest_access(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_discoverable_contests() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_discoverable_contest(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_managed_contests_v2() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_contest_editor(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_programming_contest_overview(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.register_for_contest_v2(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_contest_v2(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.can_manage_contest(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_contest_v2(text, text, text, text, text, text, text, text, timestamptz, timestamptz, integer, jsonb, text[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_contest_v2(uuid, text, text, text, text, text, text, text, text, timestamptz, timestamptz, integer, jsonb, text[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_contest(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.promote_private_gym_to_rated(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_private_contest_access(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_discoverable_contests() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_discoverable_contest(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_managed_contests_v2() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_contest_editor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_programming_contest_overview(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_for_contest_v2(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_contest_v2(uuid) TO authenticated;
