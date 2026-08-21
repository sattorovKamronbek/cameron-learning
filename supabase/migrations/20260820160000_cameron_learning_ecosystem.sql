/*
  Cameron Learning 2.0 foundation

  This migration is deliberately additive. It does not alter contest scores,
  ratings, attempts, or existing identities. XP starts at rollout from trusted
  lifecycle events; historical records are intentionally not backfilled because
  the older catalogue and attempt data cannot be reconstructed unambiguously.
*/

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_learning_profile_public boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.learning_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 80),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 1000),
  icon text NOT NULL DEFAULT 'Sparkles' CHECK (char_length(icon) BETWEEN 1 AND 80),
  category text NOT NULL DEFAULT 'general' CHECK (char_length(category) BETWEEN 1 AND 80),
  parent_skill_id uuid REFERENCES public.learning_skills(id) ON DELETE RESTRICT,
  max_level integer NOT NULL DEFAULT 20 CHECK (max_level BETWEEN 1 AND 100),
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (parent_skill_id IS NULL OR parent_skill_id <> id)
);

CREATE TABLE IF NOT EXISTS public.learning_skill_prerequisites (
  skill_id uuid NOT NULL REFERENCES public.learning_skills(id) ON DELETE CASCADE,
  prerequisite_skill_id uuid NOT NULL REFERENCES public.learning_skills(id) ON DELETE RESTRICT,
  required_mastery smallint NOT NULL DEFAULT 60 CHECK (required_mastery BETWEEN 1 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (skill_id, prerequisite_skill_id),
  CHECK (skill_id <> prerequisite_skill_id)
);

CREATE TABLE IF NOT EXISTS public.learning_content_skill_mappings (
  content_type text NOT NULL CHECK (content_type IN ('course', 'lesson', 'quiz', 'contest', 'problem', 'exam', 'other')),
  content_id uuid NOT NULL,
  skill_id uuid NOT NULL REFERENCES public.learning_skills(id) ON DELETE CASCADE,
  weight numeric(6,3) NOT NULL DEFAULT 1 CHECK (weight > 0 AND weight <= 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (content_type, content_id, skill_id)
);

CREATE TABLE IF NOT EXISTS public.learning_xp_rules (
  source_type text PRIMARY KEY CHECK (source_type IN (
    'lesson', 'quiz', 'course', 'contest_participation', 'contest_completion',
    'problem_accepted', 'exam', 'mission', 'achievement', 'manual_admin', 'other'
  )),
  xp_amount integer NOT NULL CHECK (xp_amount BETWEEN 1 AND 10000),
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.learning_xp_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill_id uuid REFERENCES public.learning_skills(id) ON DELETE SET NULL,
  source_type text NOT NULL CHECK (source_type IN (
    'lesson', 'quiz', 'course', 'contest_participation', 'contest_completion',
    'problem_accepted', 'exam', 'mission', 'achievement', 'manual_admin', 'other'
  )),
  source_id uuid,
  idempotency_key text NOT NULL CHECK (char_length(idempotency_key) BETWEEN 8 AND 240),
  xp_amount integer NOT NULL CHECK (xp_amount > 0 AND xp_amount <= 10000),
  reason text NOT NULL DEFAULT '' CHECK (char_length(reason) <= 500),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.user_learning_skill_progress (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES public.learning_skills(id) ON DELETE CASCADE,
  xp integer NOT NULL DEFAULT 0 CHECK (xp >= 0),
  completed_units integer NOT NULL DEFAULT 0 CHECK (completed_units >= 0),
  last_activity_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, skill_id)
);

CREATE TABLE IF NOT EXISTS public.learning_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  xp_event_id uuid NOT NULL UNIQUE REFERENCES public.learning_xp_events(id) ON DELETE CASCADE,
  activity_type text NOT NULL CHECK (char_length(activity_type) BETWEEN 1 AND 80),
  activity_date date NOT NULL,
  effort integer NOT NULL DEFAULT 1 CHECK (effort BETWEEN 1 AND 10000),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.learning_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 100),
  description text NOT NULL CHECK (char_length(trim(description)) BETWEEN 2 AND 500),
  icon text NOT NULL DEFAULT 'Award' CHECK (char_length(icon) BETWEEN 1 AND 80),
  category text NOT NULL DEFAULT 'learning' CHECK (char_length(category) BETWEEN 1 AND 80),
  rarity text NOT NULL DEFAULT 'common' CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
  xp_reward integer NOT NULL DEFAULT 0 CHECK (xp_reward BETWEEN 0 AND 10000),
  criteria jsonb NOT NULL CHECK (jsonb_typeof(criteria) = 'object'),
  is_hidden boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_learning_achievements (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  achievement_id uuid NOT NULL REFERENCES public.learning_achievements(id) ON DELETE CASCADE,
  earned_at timestamptz NOT NULL DEFAULT now(),
  progress integer NOT NULL DEFAULT 0 CHECK (progress >= 0),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  PRIMARY KEY (user_id, achievement_id)
);

CREATE TABLE IF NOT EXISTS public.learning_missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 2 AND 160),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 500),
  mission_type text NOT NULL CHECK (mission_type IN ('daily', 'weekly')),
  criteria jsonb NOT NULL CHECK (jsonb_typeof(criteria) = 'object'),
  target_value integer NOT NULL CHECK (target_value > 0 AND target_value <= 1000000),
  xp_reward integer NOT NULL DEFAULT 0 CHECK (xp_reward BETWEEN 0 AND 10000),
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS public.user_learning_mission_progress (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mission_id uuid NOT NULL REFERENCES public.learning_missions(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  current_value integer NOT NULL DEFAULT 0 CHECK (current_value >= 0),
  completed_at timestamptz,
  reward_xp_event_id uuid UNIQUE REFERENCES public.learning_xp_events(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, mission_id, period_start),
  CHECK (period_end >= period_start)
);

CREATE INDEX IF NOT EXISTS learning_skills_parent_sort_idx
  ON public.learning_skills (parent_skill_id, sort_order, name);
CREATE INDEX IF NOT EXISTS learning_content_skill_mappings_skill_idx
  ON public.learning_content_skill_mappings (skill_id, content_type);
CREATE INDEX IF NOT EXISTS learning_xp_events_user_created_idx
  ON public.learning_xp_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS learning_xp_events_skill_created_idx
  ON public.learning_xp_events (skill_id, created_at DESC) WHERE skill_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS learning_activity_user_date_idx
  ON public.learning_activity (user_id, activity_date DESC);
CREATE INDEX IF NOT EXISTS user_learning_achievements_user_earned_idx
  ON public.user_learning_achievements (user_id, earned_at DESC);
CREATE INDEX IF NOT EXISTS user_learning_mission_progress_user_period_idx
  ON public.user_learning_mission_progress (user_id, period_start DESC);

DROP TRIGGER IF EXISTS learning_skills_set_updated_at ON public.learning_skills;
CREATE TRIGGER learning_skills_set_updated_at BEFORE UPDATE ON public.learning_skills
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS user_learning_skill_progress_set_updated_at ON public.user_learning_skill_progress;
CREATE TRIGGER user_learning_skill_progress_set_updated_at BEFORE UPDATE ON public.user_learning_skill_progress
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS learning_achievements_set_updated_at ON public.learning_achievements;
CREATE TRIGGER learning_achievements_set_updated_at BEFORE UPDATE ON public.learning_achievements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS learning_missions_set_updated_at ON public.learning_missions;
CREATE TRIGGER learning_missions_set_updated_at BEFORE UPDATE ON public.learning_missions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.learning_xp_required_for_level(p_level integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog
AS $$
  SELECT CASE
    WHEN p_level <= 1 THEN 0
    ELSE 100 + ((p_level - 2) * 75) + ((p_level - 2) * (p_level - 2) * 25)
  END;
$$;

CREATE OR REPLACE FUNCTION public.learning_total_xp_for_level(p_level integer)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_level integer;
  v_total integer := 0;
BEGIN
  IF p_level <= 1 THEN RETURN 0; END IF;
  FOR v_level IN 2..p_level LOOP
    v_total := v_total + public.learning_xp_required_for_level(v_level);
  END LOOP;
  RETURN v_total;
END;
$$;

CREATE OR REPLACE FUNCTION public.learning_level_progress(p_xp integer)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_xp integer := greatest(coalesce(p_xp, 0), 0);
  v_level integer := 1;
  v_next_total integer;
  v_current_total integer;
  v_required integer;
BEGIN
  LOOP
    v_next_total := public.learning_total_xp_for_level(v_level + 1);
    EXIT WHEN v_xp < v_next_total OR v_level >= 100;
    v_level := v_level + 1;
  END LOOP;
  v_current_total := public.learning_total_xp_for_level(v_level);
  v_required := CASE WHEN v_level >= 100 THEN 0 ELSE public.learning_xp_required_for_level(v_level + 1) END;
  RETURN jsonb_build_object(
    'level', v_level,
    'currentLevelXp', v_xp - v_current_total,
    'xpForNextLevel', v_required,
    'progressPercent', CASE WHEN v_required = 0 THEN 100 ELSE least(100, floor(((v_xp - v_current_total)::numeric / v_required) * 100))::integer END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.learning_skill_mastery(p_xp integer)
RETURNS smallint
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog
AS $$
  SELECT least(100, floor((greatest(coalesce(p_xp, 0), 0)::numeric / 5000) * 100))::smallint;
$$;

CREATE OR REPLACE FUNCTION public.learning_current_streak(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_day date := (now() AT TIME ZONE 'UTC')::date;
  v_streak integer := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.learning_activity WHERE user_id = p_user_id AND activity_date = v_day) THEN
    v_day := v_day - 1;
  END IF;
  WHILE EXISTS (SELECT 1 FROM public.learning_activity WHERE user_id = p_user_id AND activity_date = v_day) LOOP
    v_streak := v_streak + 1;
    v_day := v_day - 1;
  END LOOP;
  RETURN v_streak;
END;
$$;

CREATE OR REPLACE FUNCTION public.learning_longest_streak(p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  WITH dates AS (
    SELECT DISTINCT activity_date
    FROM public.learning_activity
    WHERE user_id = p_user_id
  ), grouped AS (
    SELECT activity_date - (row_number() OVER (ORDER BY activity_date))::integer AS group_key
    FROM dates
  )
  SELECT coalesce(max(group_size), 0)::integer
  FROM (SELECT count(*)::integer AS group_size FROM grouped GROUP BY group_key) streaks;
$$;

CREATE OR REPLACE FUNCTION public.learning_period_bounds(p_mission_type text)
RETURNS TABLE(period_start date, period_end date)
LANGUAGE sql
STABLE
SET search_path = pg_catalog
AS $$
  SELECT
    CASE WHEN p_mission_type = 'weekly' THEN date_trunc('week', now() AT TIME ZONE 'UTC')::date ELSE (now() AT TIME ZONE 'UTC')::date END,
    CASE WHEN p_mission_type = 'weekly' THEN (date_trunc('week', now() AT TIME ZONE 'UTC')::date + 6) ELSE (now() AT TIME ZONE 'UTC')::date END;
$$;

CREATE OR REPLACE FUNCTION public.record_learning_xp(
  p_user_id uuid,
  p_skill_id uuid,
  p_source_type text,
  p_source_id uuid,
  p_idempotency_key text,
  p_xp_amount integer,
  p_reason text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_event_id uuid;
BEGIN
  IF p_user_id IS NULL OR p_xp_amount IS NULL OR p_xp_amount < 1 OR p_xp_amount > 10000 THEN
    RAISE EXCEPTION 'Invalid XP event';
  END IF;
  IF p_source_type NOT IN ('lesson', 'quiz', 'course', 'contest_participation', 'contest_completion', 'problem_accepted', 'exam', 'mission', 'achievement', 'manual_admin', 'other') THEN
    RAISE EXCEPTION 'Invalid XP source';
  END IF;
  IF coalesce(jsonb_typeof(p_metadata), 'object') <> 'object' THEN
    RAISE EXCEPTION 'XP metadata must be an object';
  END IF;

  INSERT INTO public.learning_xp_events (user_id, skill_id, source_type, source_id, idempotency_key, xp_amount, reason, metadata)
  VALUES (p_user_id, p_skill_id, p_source_type, p_source_id, p_idempotency_key, p_xp_amount, coalesce(p_reason, ''), coalesce(p_metadata, '{}'::jsonb))
  ON CONFLICT (user_id, idempotency_key) DO NOTHING
  RETURNING id INTO v_event_id;

  IF v_event_id IS NULL THEN
    SELECT id INTO v_event_id
    FROM public.learning_xp_events
    WHERE user_id = p_user_id AND idempotency_key = p_idempotency_key;
  END IF;
  RETURN v_event_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.learning_achievement_metric(p_user_id uuid, p_criteria jsonb)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_type text := p_criteria ->> 'type';
  v_skill_id uuid;
BEGIN
  IF v_type = 'total_xp' THEN
    RETURN coalesce((SELECT sum(xp_amount)::integer FROM public.learning_xp_events WHERE user_id = p_user_id), 0);
  ELSIF v_type = 'source_count' THEN
    RETURN (SELECT count(*)::integer FROM public.learning_xp_events WHERE user_id = p_user_id AND source_type = p_criteria ->> 'sourceType');
  ELSIF v_type = 'current_streak' THEN
    RETURN public.learning_current_streak(p_user_id);
  ELSIF v_type = 'skill_xp' THEN
    BEGIN
      v_skill_id := (p_criteria ->> 'skillId')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RETURN 0;
    END;
    RETURN coalesce((SELECT sum(xp)::integer FROM public.user_learning_skill_progress WHERE user_id = p_user_id AND skill_id = v_skill_id), 0);
  END IF;
  RETURN 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.evaluate_learning_achievements(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_achievement record;
  v_metric integer;
  v_awarded boolean;
BEGIN
  FOR v_achievement IN SELECT * FROM public.learning_achievements WHERE is_active LOOP
    v_metric := public.learning_achievement_metric(p_user_id, v_achievement.criteria);
    IF v_metric >= coalesce((v_achievement.criteria ->> 'target')::integer, 1) THEN
      v_awarded := false;
      INSERT INTO public.user_learning_achievements (user_id, achievement_id, progress)
      VALUES (p_user_id, v_achievement.id, v_metric)
      ON CONFLICT (user_id, achievement_id) DO NOTHING
      RETURNING true INTO v_awarded;

      IF coalesce(v_awarded, false) AND v_achievement.xp_reward > 0 THEN
        PERFORM public.record_learning_xp(
          p_user_id, NULL, 'achievement', v_achievement.id,
          'achievement:' || v_achievement.id::text,
          v_achievement.xp_reward,
          'Achievement earned: ' || v_achievement.name,
          jsonb_build_object('achievementSlug', v_achievement.slug)
        );
      END IF;
      v_awarded := false;
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_learning_missions_for_xp(p_event public.learning_xp_events)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_mission record;
  v_period record;
  v_existing integer;
  v_new_value integer;
  v_progress public.user_learning_mission_progress;
  v_reward_event_id uuid;
BEGIN
  IF p_event.source_type = 'mission' THEN RETURN; END IF;

  FOR v_mission IN
    SELECT * FROM public.learning_missions
    WHERE is_active
      AND coalesce(criteria ->> 'type', '') = 'xp_earned'
      AND (starts_at IS NULL OR starts_at <= now())
      AND (ends_at IS NULL OR ends_at > now())
  LOOP
    SELECT * INTO v_period FROM public.learning_period_bounds(v_mission.mission_type);
    SELECT current_value INTO v_existing
    FROM public.user_learning_mission_progress
    WHERE user_id = p_event.user_id AND mission_id = v_mission.id AND period_start = v_period.period_start;
    v_new_value := least(v_mission.target_value, coalesce(v_existing, 0) + p_event.xp_amount);

    INSERT INTO public.user_learning_mission_progress (user_id, mission_id, period_start, period_end, current_value, completed_at)
    VALUES (
      p_event.user_id, v_mission.id, v_period.period_start, v_period.period_end, v_new_value,
      CASE WHEN v_new_value >= v_mission.target_value THEN now() ELSE NULL END
    )
    ON CONFLICT (user_id, mission_id, period_start) DO UPDATE
      SET current_value = EXCLUDED.current_value,
          period_end = EXCLUDED.period_end,
          completed_at = CASE
            WHEN public.user_learning_mission_progress.completed_at IS NULL AND EXCLUDED.current_value >= v_mission.target_value THEN now()
            ELSE public.user_learning_mission_progress.completed_at
          END,
          updated_at = now()
    RETURNING * INTO v_progress;

    IF v_progress.completed_at IS NOT NULL AND v_progress.reward_xp_event_id IS NULL AND v_mission.xp_reward > 0 THEN
      v_reward_event_id := public.record_learning_xp(
        p_event.user_id, NULL, 'mission', v_mission.id,
        'mission:' || v_mission.id::text || ':' || v_period.period_start::text,
        v_mission.xp_reward,
        'Mission completed: ' || v_mission.title,
        jsonb_build_object('missionSlug', v_mission.slug, 'periodStart', v_period.period_start)
      );
      UPDATE public.user_learning_mission_progress
      SET reward_xp_event_id = v_reward_event_id, updated_at = now()
      WHERE user_id = p_event.user_id
        AND mission_id = v_mission.id
        AND period_start = v_period.period_start
        AND reward_xp_event_id IS NULL;
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_learning_xp_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.skill_id IS NOT NULL THEN
    INSERT INTO public.user_learning_skill_progress (user_id, skill_id, xp, last_activity_at)
    VALUES (NEW.user_id, NEW.skill_id, NEW.xp_amount, NEW.created_at)
    ON CONFLICT (user_id, skill_id) DO UPDATE
      SET xp = public.user_learning_skill_progress.xp + EXCLUDED.xp,
          last_activity_at = greatest(public.user_learning_skill_progress.last_activity_at, EXCLUDED.last_activity_at),
          updated_at = now();
  END IF;

  INSERT INTO public.learning_activity (user_id, xp_event_id, activity_type, activity_date, effort, metadata)
  VALUES (
    NEW.user_id, NEW.id, NEW.source_type, (NEW.created_at AT TIME ZONE 'UTC')::date, NEW.xp_amount,
    jsonb_build_object('skillId', NEW.skill_id, 'sourceId', NEW.source_id)
  ) ON CONFLICT (xp_event_id) DO NOTHING;

  PERFORM public.update_learning_missions_for_xp(NEW);
  IF NEW.source_type <> 'achievement' THEN
    PERFORM public.evaluate_learning_achievements(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS learning_xp_events_process ON public.learning_xp_events;
CREATE TRIGGER learning_xp_events_process
  AFTER INSERT ON public.learning_xp_events
  FOR EACH ROW EXECUTE FUNCTION public.process_learning_xp_event();

CREATE OR REPLACE FUNCTION public.learning_default_skill_for_subject(p_subject text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT id
  FROM public.learning_skills
  WHERE slug = CASE lower(coalesce(p_subject, ''))
    WHEN 'programming' THEN 'programming'
    WHEN 'english' THEN 'english'
    WHEN 'ielts' THEN 'english'
    WHEN 'cefr' THEN 'english'
    WHEN 'mathematics' THEN 'mathematics'
    WHEN 'math' THEN 'mathematics'
    WHEN 'writing' THEN 'writing'
    WHEN 'speaking' THEN 'speaking'
    WHEN 'problem-solving' THEN 'problem-solving'
    ELSE 'problem-solving'
  END
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.award_learning_content_xp(
  p_user_id uuid,
  p_content_type text,
  p_content_id uuid,
  p_source_type text,
  p_subject text,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_rule integer;
  v_mapping record;
  v_count integer;
  v_amount integer;
  v_fallback uuid;
BEGIN
  SELECT xp_amount INTO v_rule FROM public.learning_xp_rules WHERE source_type = p_source_type AND is_active;
  IF v_rule IS NULL THEN RETURN; END IF;

  SELECT count(*) INTO v_count
  FROM public.learning_content_skill_mappings
  WHERE content_type = p_content_type AND content_id = p_content_id;

  IF v_count = 0 THEN
    v_fallback := public.learning_default_skill_for_subject(p_subject);
    IF v_fallback IS NULL THEN RETURN; END IF;
    PERFORM public.record_learning_xp(
      p_user_id, v_fallback, p_source_type, p_content_id,
      p_source_type || ':' || p_content_id::text || ':' || v_fallback::text,
      v_rule, p_reason, jsonb_build_object('contentType', p_content_type, 'fallbackSkill', true)
    );
    RETURN;
  END IF;

  v_amount := greatest(1, floor(v_rule::numeric / v_count)::integer);
  FOR v_mapping IN
    SELECT skill_id FROM public.learning_content_skill_mappings
    WHERE content_type = p_content_type AND content_id = p_content_id
    ORDER BY skill_id
  LOOP
    PERFORM public.record_learning_xp(
      p_user_id, v_mapping.skill_id, p_source_type, p_content_id,
      p_source_type || ':' || p_content_id::text || ':' || v_mapping.skill_id::text,
      v_amount, p_reason, jsonb_build_object('contentType', p_content_type, 'mappedSkill', true)
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.award_learning_xp_for_contest_result()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_subject text;
BEGIN
  SELECT subject INTO v_subject FROM public.contests WHERE id = NEW.contest_id;
  IF v_subject IS NULL THEN RETURN NEW; END IF;

  PERFORM public.award_learning_content_xp(
    NEW.user_id, 'contest', NEW.contest_id, 'contest_participation', v_subject,
    'Verified contest participation'
  );
  PERFORM public.award_learning_content_xp(
    NEW.user_id, 'contest', NEW.contest_id, 'contest_completion', v_subject,
    'Verified contest completion'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contest_results_award_learning_xp ON public.contest_results;
CREATE TRIGGER contest_results_award_learning_xp
  AFTER INSERT ON public.contest_results
  FOR EACH ROW EXECUTE FUNCTION public.award_learning_xp_for_contest_result();

CREATE OR REPLACE FUNCTION public.get_my_learning_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_total_xp integer;
  v_skills jsonb;
  v_activity jsonb;
  v_achievements jsonb;
  v_last_activity date;
BEGIN
  IF v_user_id IS NULL OR NOT public.active_profile(v_user_id) THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT coalesce(sum(xp_amount), 0)::integer INTO v_total_xp FROM public.learning_xp_events WHERE user_id = v_user_id;
  SELECT max(activity_date) INTO v_last_activity FROM public.learning_activity WHERE user_id = v_user_id;

  WITH RECURSIVE tree AS (
    SELECT id AS root_id, id FROM public.learning_skills WHERE parent_skill_id IS NULL AND is_active
    UNION ALL
    SELECT tree.root_id, child.id
    FROM tree JOIN public.learning_skills child ON child.parent_skill_id = tree.id
    WHERE child.is_active
  ), totals AS (
    SELECT tree.root_id, coalesce(sum(progress.xp), 0)::integer AS xp
    FROM tree
    LEFT JOIN public.user_learning_skill_progress progress ON progress.skill_id = tree.id AND progress.user_id = v_user_id
    GROUP BY tree.root_id
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', skill.id, 'slug', skill.slug, 'name', skill.name, 'icon', skill.icon,
    'xp', totals.xp, 'mastery', public.learning_skill_mastery(totals.xp),
    'level', (public.learning_level_progress(totals.xp) ->> 'level')::integer
  ) ORDER BY skill.sort_order, skill.name), '[]'::jsonb)
  INTO v_skills
  FROM public.learning_skills skill JOIN totals ON totals.root_id = skill.id
  WHERE skill.parent_skill_id IS NULL AND skill.is_active;

  SELECT coalesce(jsonb_agg(jsonb_build_object('date', activity_date, 'effort', effort) ORDER BY activity_date), '[]'::jsonb)
  INTO v_activity
  FROM (
    SELECT activity_date, least(sum(effort), 10000)::integer AS effort
    FROM public.learning_activity
    WHERE user_id = v_user_id AND activity_date >= ((now() AT TIME ZONE 'UTC')::date - 364)
    GROUP BY activity_date
  ) aggregated_activity;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', achievement.id, 'slug', achievement.slug, 'name', achievement.name,
    'description', achievement.description, 'icon', achievement.icon, 'rarity', achievement.rarity,
    'earnedAt', earned.earned_at
  ) ORDER BY earned.earned_at DESC), '[]'::jsonb)
  INTO v_achievements
  FROM (
    SELECT * FROM public.user_learning_achievements
    WHERE user_id = v_user_id ORDER BY earned_at DESC LIMIT 4
  ) earned JOIN public.learning_achievements achievement ON achievement.id = earned.achievement_id;

  RETURN jsonb_build_object(
    'totalXp', v_total_xp,
    'levelProgress', public.learning_level_progress(v_total_xp),
    'streak', jsonb_build_object(
      'current', public.learning_current_streak(v_user_id),
      'longest', public.learning_longest_streak(v_user_id),
      'lastActivityDate', v_last_activity
    ),
    'skills', v_skills,
    'activity', v_activity,
    'recentAchievements', v_achievements
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_learning_skill_tree()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL OR NOT public.active_profile(v_user_id) THEN RAISE EXCEPTION 'Authentication required'; END IF;
  RETURN (
    WITH RECURSIVE descendants AS (
      SELECT id AS root_id, id FROM public.learning_skills WHERE is_active
      UNION ALL
      SELECT descendants.root_id, child.id
      FROM descendants JOIN public.learning_skills child ON child.parent_skill_id = descendants.id
      WHERE child.is_active
    ), totals AS (
      SELECT descendants.root_id AS skill_id, coalesce(sum(progress.xp), 0)::integer AS xp
      FROM descendants
      LEFT JOIN public.user_learning_skill_progress progress ON progress.skill_id = descendants.id AND progress.user_id = v_user_id
      GROUP BY descendants.root_id
    )
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', skill.id, 'slug', skill.slug, 'name', skill.name, 'description', skill.description,
      'icon', skill.icon, 'parentSkillId', skill.parent_skill_id, 'sortOrder', skill.sort_order,
      'xp', totals.xp, 'mastery', public.learning_skill_mastery(totals.xp),
      'level', (public.learning_level_progress(totals.xp) ->> 'level')::integer,
      'locked', EXISTS (
        SELECT 1 FROM public.learning_skill_prerequisites prerequisite
        JOIN totals required_skill ON required_skill.skill_id = prerequisite.prerequisite_skill_id
        WHERE prerequisite.skill_id = skill.id
          AND public.learning_skill_mastery(required_skill.xp) < prerequisite.required_mastery
      ),
      'prerequisites', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'skillId', prerequisite.prerequisite_skill_id, 'name', prerequisite_skill.name,
          'requiredMastery', prerequisite.required_mastery,
          'currentMastery', public.learning_skill_mastery(required_skill.xp)
        ) ORDER BY prerequisite_skill.sort_order, prerequisite_skill.name)
        FROM public.learning_skill_prerequisites prerequisite
        JOIN public.learning_skills prerequisite_skill ON prerequisite_skill.id = prerequisite.prerequisite_skill_id
        JOIN totals required_skill ON required_skill.skill_id = prerequisite.prerequisite_skill_id
        WHERE prerequisite.skill_id = skill.id
      ), '[]'::jsonb)
    ) ORDER BY skill.sort_order, skill.name), '[]'::jsonb)
    FROM public.learning_skills skill
    JOIN totals ON totals.skill_id = skill.id
    WHERE skill.is_active
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_learning_missions()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL OR NOT public.active_profile(v_user_id) THEN RAISE EXCEPTION 'Authentication required'; END IF;
  RETURN (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', mission.id, 'slug', mission.slug, 'title', mission.title, 'description', mission.description,
      'missionType', mission.mission_type, 'targetValue', mission.target_value, 'xpReward', mission.xp_reward,
      'currentValue', coalesce(progress.current_value, 0), 'completedAt', progress.completed_at,
      'expiresAt', ((bounds.period_end + 1)::timestamp AT TIME ZONE 'UTC')
    ) ORDER BY mission.mission_type, mission.sort_key, mission.title), '[]'::jsonb)
    FROM (
      SELECT mission.*, CASE WHEN mission.mission_type = 'daily' THEN 0 ELSE 1 END AS sort_key
      FROM public.learning_missions mission
      WHERE mission.is_active AND (mission.starts_at IS NULL OR mission.starts_at <= now()) AND (mission.ends_at IS NULL OR mission.ends_at > now())
    ) mission
    CROSS JOIN LATERAL public.learning_period_bounds(mission.mission_type) bounds
    LEFT JOIN public.user_learning_mission_progress progress
      ON progress.user_id = v_user_id AND progress.mission_id = mission.id AND progress.period_start = bounds.period_start
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_learning_achievements()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL OR NOT public.active_profile(v_user_id) THEN RAISE EXCEPTION 'Authentication required'; END IF;
  RETURN (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', achievement.id, 'slug', achievement.slug, 'name', achievement.name,
      'description', achievement.description, 'icon', achievement.icon, 'category', achievement.category,
      'rarity', achievement.rarity, 'xpReward', achievement.xp_reward,
      'earnedAt', earned.earned_at,
      'progress', CASE WHEN earned.achievement_id IS NOT NULL THEN earned.progress ELSE public.learning_achievement_metric(v_user_id, achievement.criteria) END,
      'target', coalesce((achievement.criteria ->> 'target')::integer, 1),
      'isEarned', earned.achievement_id IS NOT NULL
    ) ORDER BY (earned.achievement_id IS NOT NULL) DESC, achievement.rarity DESC, achievement.name), '[]'::jsonb)
    FROM public.learning_achievements achievement
    LEFT JOIN public.user_learning_achievements earned ON earned.achievement_id = achievement.id AND earned.user_id = v_user_id
    WHERE achievement.is_active AND (NOT achievement.is_hidden OR earned.achievement_id IS NOT NULL)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_learning_leaderboard(
  p_scope text DEFAULT 'overall',
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(rank bigint, user_id uuid, display_name text, avatar_url text, level integer, xp integer, mastery smallint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_scope text := lower(coalesce(p_scope, 'overall'));
  v_skill_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.active_profile(auth.uid()) THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_limit < 1 OR p_limit > 100 OR p_offset < 0 THEN RAISE EXCEPTION 'Invalid pagination'; END IF;
  IF v_scope NOT IN ('overall', 'weekly', 'monthly') THEN
    SELECT id INTO v_skill_id FROM public.learning_skills WHERE slug = v_scope AND parent_skill_id IS NULL AND is_active;
    IF v_skill_id IS NULL THEN RAISE EXCEPTION 'Unknown leaderboard scope'; END IF;
  END IF;

  RETURN QUERY
  WITH RECURSIVE descendants AS (
    SELECT id FROM public.learning_skills WHERE id = v_skill_id
    UNION ALL
    SELECT child.id FROM descendants JOIN public.learning_skills child ON child.parent_skill_id = descendants.id
  ), scores AS (
    SELECT event.user_id, sum(event.xp_amount)::integer AS earned_xp
    FROM public.learning_xp_events event
    WHERE (v_scope NOT IN ('weekly', 'monthly') OR event.created_at >= CASE WHEN v_scope = 'weekly' THEN date_trunc('week', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' ELSE date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' END)
      AND (v_skill_id IS NULL OR event.skill_id IN (SELECT id FROM descendants))
    GROUP BY event.user_id
  ), ranked AS (
    SELECT rank() OVER (ORDER BY scores.earned_xp DESC, profile.created_at ASC) AS position,
      profile.id, coalesce(nullif(trim(profile.full_name), ''), 'Cameron learner') AS learner_name,
      profile.avatar_url, scores.earned_xp
    FROM scores JOIN public.profiles profile ON profile.id = scores.user_id
    WHERE profile.status = 'active' AND profile.is_learning_profile_public
  )
  SELECT ranked.position, ranked.id, ranked.learner_name, ranked.avatar_url,
    (public.learning_level_progress(CASE WHEN v_scope = 'overall' THEN ranked.earned_xp ELSE coalesce((SELECT sum(xp_amount)::integer FROM public.learning_xp_events WHERE user_id = ranked.id), 0) END) ->> 'level')::integer,
    ranked.earned_xp, public.learning_skill_mastery(ranked.earned_xp)
  FROM ranked ORDER BY ranked.position, ranked.id LIMIT p_limit OFFSET p_offset;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_learning_system()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT public.has_admin_access(auth.uid()) THEN RAISE EXCEPTION 'Access denied: admin role required'; END IF;
  RETURN jsonb_build_object(
    'skills', (SELECT coalesce(jsonb_agg(to_jsonb(skill) ORDER BY sort_order, name), '[]'::jsonb) FROM public.learning_skills skill),
    'achievements', (SELECT coalesce(jsonb_agg(to_jsonb(achievement) ORDER BY name), '[]'::jsonb) FROM public.learning_achievements achievement),
    'missions', (SELECT coalesce(jsonb_agg(to_jsonb(mission) ORDER BY mission_type, title), '[]'::jsonb) FROM public.learning_missions mission),
    'xpRules', (SELECT coalesce(jsonb_agg(to_jsonb(rule) ORDER BY source_type), '[]'::jsonb) FROM public.learning_xp_rules rule)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_learning_xp_rule(p_source_type text, p_xp_amount integer, p_is_active boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT public.has_admin_access(auth.uid()) THEN RAISE EXCEPTION 'Access denied: admin role required'; END IF;
  UPDATE public.learning_xp_rules SET xp_amount = p_xp_amount, is_active = p_is_active, updated_at = now()
  WHERE source_type = p_source_type;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown XP rule'; END IF;
  PERFORM public.log_audit_action('learning.xp_rule.update', 'learning_xp_rule', NULL, jsonb_build_object('sourceType', p_source_type, 'xpAmount', p_xp_amount, 'isActive', p_is_active));
END;
$$;

INSERT INTO public.learning_skills (slug, name, description, icon, category, sort_order)
VALUES
  ('programming', 'Programming', 'Build practical programming fluency through verified practice and contests.', 'Code2', 'technology', 10),
  ('english', 'English', 'Develop English comprehension and communication through verified learning activities.', 'Languages', 'language', 20),
  ('mathematics', 'Mathematics', 'Strengthen mathematical reasoning through verified learning activities.', 'Sigma', 'academic', 30),
  ('problem-solving', 'Problem Solving', 'Improve structured problem solving through verified contests and practice.', 'Brain', 'academic', 40),
  ('writing', 'Writing', 'Develop clear, effective written communication.', 'PenLine', 'language', 50),
  ('speaking', 'Speaking', 'Develop confident, effective spoken communication.', 'Mic2', 'language', 60)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.learning_skills (slug, name, description, icon, category, parent_skill_id, sort_order)
SELECT seed.slug, seed.name, seed.description, seed.icon, seed.category, parent.id, seed.sort_order
FROM (VALUES
  ('english-grammar', 'Grammar', 'Build accurate English grammar.', 'SpellCheck2', 'language', 'english', 10),
  ('english-vocabulary', 'Vocabulary', 'Build useful English vocabulary.', 'BookOpenText', 'language', 'english', 20),
  ('english-reading', 'Reading', 'Understand written English with confidence.', 'BookOpen', 'language', 'english', 30),
  ('english-listening', 'Listening', 'Understand spoken English with confidence.', 'Headphones', 'language', 'english', 40),
  ('english-writing', 'English Writing', 'Apply English skills to structured writing.', 'PenLine', 'language', 'english', 50),
  ('programming-fundamentals', 'Programming Fundamentals', 'Build reliable programming foundations.', 'Terminal', 'technology', 'programming', 10),
  ('programming-algorithms', 'Algorithms', 'Develop algorithmic thinking.', 'GitBranch', 'technology', 'programming', 20),
  ('programming-data-structures', 'Data Structures', 'Use core data structures effectively.', 'Boxes', 'technology', 'programming', 30),
  ('mathematics-algebra', 'Algebra', 'Build algebraic reasoning.', 'Variable', 'academic', 'mathematics', 10),
  ('mathematics-geometry', 'Geometry', 'Build geometric reasoning.', 'Triangle', 'academic', 'mathematics', 20)
) AS seed(slug, name, description, icon, category, parent_slug, sort_order)
JOIN public.learning_skills parent ON parent.slug = seed.parent_slug
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.learning_xp_rules (source_type, xp_amount)
VALUES
  ('lesson', 20), ('quiz', 10), ('course', 50), ('contest_participation', 25),
  ('contest_completion', 50), ('problem_accepted', 25), ('exam', 35),
  ('mission', 15), ('achievement', 25), ('manual_admin', 1), ('other', 1)
ON CONFLICT (source_type) DO NOTHING;

INSERT INTO public.learning_achievements (slug, name, description, icon, category, rarity, xp_reward, criteria)
VALUES
  ('first-steps', 'First Steps', 'Earn XP from your first verified learning activity.', 'Footprints', 'learning', 'common', 15, '{"type":"total_xp","target":1}'::jsonb),
  ('contestant', 'Contestant', 'Complete a verified contest.', 'Trophy', 'contests', 'common', 25, '{"type":"source_count","sourceType":"contest_completion","target":1}'::jsonb),
  ('week-warrior', 'Week Warrior', 'Maintain a 7-day learning streak.', 'Flame', 'streaks', 'rare', 40, '{"type":"current_streak","target":7}'::jsonb),
  ('xp-centurion', 'XP Centurion', 'Earn 100 XP through verified learning activity.', 'Zap', 'learning', 'common', 20, '{"type":"total_xp","target":100}'::jsonb)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.learning_missions (slug, title, description, mission_type, criteria, target_value, xp_reward)
VALUES
  ('daily-earn-100-xp', 'Earn 100 XP', 'Make meaningful verified progress today.', 'daily', '{"type":"xp_earned"}'::jsonb, 100, 15),
  ('weekly-earn-500-xp', 'Earn 500 XP', 'Build steady verified progress this week.', 'weekly', '{"type":"xp_earned"}'::jsonb, 500, 50)
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE public.learning_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_skill_prerequisites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_content_skill_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_xp_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_xp_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_learning_skill_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_learning_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_learning_mission_progress ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.learning_skills, public.learning_skill_prerequisites, public.learning_content_skill_mappings,
  public.learning_xp_rules, public.learning_xp_events, public.user_learning_skill_progress, public.learning_activity,
  public.learning_achievements, public.user_learning_achievements, public.learning_missions,
  public.user_learning_mission_progress FROM PUBLIC, anon, authenticated;

CREATE POLICY learning_skills_read ON public.learning_skills FOR SELECT TO authenticated
  USING (public.active_profile(auth.uid()) AND (is_active OR public.has_admin_access(auth.uid())));
CREATE POLICY learning_skill_prerequisites_read ON public.learning_skill_prerequisites FOR SELECT TO authenticated
  USING (public.active_profile(auth.uid()));
CREATE POLICY user_learning_skill_progress_read ON public.user_learning_skill_progress FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND public.active_profile(auth.uid()));
CREATE POLICY learning_xp_events_read ON public.learning_xp_events FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND public.active_profile(auth.uid()));
CREATE POLICY learning_activity_read ON public.learning_activity FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND public.active_profile(auth.uid()));
CREATE POLICY learning_achievements_read ON public.learning_achievements FOR SELECT TO authenticated
  USING (public.active_profile(auth.uid()) AND is_active AND NOT is_hidden);
CREATE POLICY user_learning_achievements_read ON public.user_learning_achievements FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND public.active_profile(auth.uid()));
CREATE POLICY learning_missions_read ON public.learning_missions FOR SELECT TO authenticated
  USING (public.active_profile(auth.uid()) AND is_active AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at > now()));
CREATE POLICY user_learning_mission_progress_read ON public.user_learning_mission_progress FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND public.active_profile(auth.uid()));

REVOKE ALL ON FUNCTION public.record_learning_xp(uuid, uuid, text, uuid, text, integer, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.award_learning_content_xp(uuid, text, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.evaluate_learning_achievements(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_learning_missions_for_xp(public.learning_xp_events) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_my_learning_dashboard() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_learning_skill_tree() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_learning_missions() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_learning_achievements() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_learning_leaderboard(text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_get_learning_system() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_update_learning_xp_rule(text, integer, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_learning_dashboard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_learning_skill_tree() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_learning_missions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_learning_achievements() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_learning_leaderboard(text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_learning_system() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_learning_xp_rule(text, integer, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_upsert_learning_skill(
  p_id uuid,
  p_slug text,
  p_name text,
  p_description text,
  p_icon text,
  p_category text,
  p_parent_skill_id uuid,
  p_sort_order integer,
  p_is_active boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.has_admin_access(auth.uid()) THEN RAISE EXCEPTION 'Access denied: admin role required'; END IF;
  IF coalesce(trim(p_slug), '') !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' THEN RAISE EXCEPTION 'Skill slug must use lowercase letters, numbers, and hyphens'; END IF;
  IF char_length(trim(coalesce(p_name, ''))) NOT BETWEEN 2 AND 80 THEN RAISE EXCEPTION 'Skill name must be between 2 and 80 characters'; END IF;
  IF p_parent_skill_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.learning_skills WHERE id = p_parent_skill_id) THEN RAISE EXCEPTION 'Parent skill does not exist'; END IF;
  IF p_id IS NOT NULL AND p_parent_skill_id = p_id THEN RAISE EXCEPTION 'A skill cannot be its own parent'; END IF;
  IF p_id IS NOT NULL AND p_parent_skill_id IS NOT NULL AND EXISTS (
    WITH RECURSIVE descendants AS (
      SELECT id FROM public.learning_skills WHERE parent_skill_id = p_id
      UNION ALL SELECT child.id FROM descendants JOIN public.learning_skills child ON child.parent_skill_id = descendants.id
    ) SELECT 1 FROM descendants WHERE id = p_parent_skill_id
  ) THEN RAISE EXCEPTION 'A skill cannot be moved below one of its descendants'; END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.learning_skills (slug, name, description, icon, category, parent_skill_id, sort_order, is_active)
    VALUES (trim(p_slug), trim(p_name), coalesce(trim(p_description), ''), coalesce(nullif(trim(p_icon), ''), 'Sparkles'), coalesce(nullif(trim(p_category), ''), 'general'), p_parent_skill_id, coalesce(p_sort_order, 0), coalesce(p_is_active, true))
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.learning_skills
    SET slug = trim(p_slug), name = trim(p_name), description = coalesce(trim(p_description), ''),
      icon = coalesce(nullif(trim(p_icon), ''), 'Sparkles'), category = coalesce(nullif(trim(p_category), ''), 'general'),
      parent_skill_id = p_parent_skill_id, sort_order = coalesce(p_sort_order, 0), is_active = coalesce(p_is_active, true)
    WHERE id = p_id RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'Skill not found'; END IF;
  END IF;
  PERFORM public.log_audit_action('learning.skill.upsert', 'learning_skill', v_id, jsonb_build_object('slug', p_slug, 'isActive', p_is_active));
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_upsert_learning_achievement(
  p_id uuid,
  p_slug text,
  p_name text,
  p_description text,
  p_icon text,
  p_category text,
  p_rarity text,
  p_xp_reward integer,
  p_criteria jsonb,
  p_is_hidden boolean,
  p_is_active boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.has_admin_access(auth.uid()) THEN RAISE EXCEPTION 'Access denied: admin role required'; END IF;
  IF coalesce(trim(p_slug), '') !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' THEN RAISE EXCEPTION 'Achievement slug must use lowercase letters, numbers, and hyphens'; END IF;
  IF coalesce(jsonb_typeof(p_criteria), '') <> 'object' OR coalesce(p_criteria ->> 'type', '') NOT IN ('total_xp', 'source_count', 'current_streak', 'skill_xp') OR coalesce((p_criteria ->> 'target')::integer, 0) < 1 THEN RAISE EXCEPTION 'Achievement criteria must contain a supported type and positive target'; END IF;
  IF p_rarity NOT IN ('common', 'rare', 'epic', 'legendary') THEN RAISE EXCEPTION 'Invalid achievement rarity'; END IF;
  IF p_id IS NULL THEN
    INSERT INTO public.learning_achievements (slug, name, description, icon, category, rarity, xp_reward, criteria, is_hidden, is_active)
    VALUES (trim(p_slug), trim(p_name), trim(p_description), coalesce(nullif(trim(p_icon), ''), 'Award'), coalesce(nullif(trim(p_category), ''), 'learning'), p_rarity, p_xp_reward, p_criteria, coalesce(p_is_hidden, false), coalesce(p_is_active, true))
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.learning_achievements SET slug = trim(p_slug), name = trim(p_name), description = trim(p_description), icon = coalesce(nullif(trim(p_icon), ''), 'Award'), category = coalesce(nullif(trim(p_category), ''), 'learning'), rarity = p_rarity, xp_reward = p_xp_reward, criteria = p_criteria, is_hidden = coalesce(p_is_hidden, false), is_active = coalesce(p_is_active, true) WHERE id = p_id RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'Achievement not found'; END IF;
  END IF;
  PERFORM public.log_audit_action('learning.achievement.upsert', 'learning_achievement', v_id, jsonb_build_object('slug', p_slug, 'isActive', p_is_active));
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_upsert_learning_mission(
  p_id uuid,
  p_slug text,
  p_title text,
  p_description text,
  p_mission_type text,
  p_criteria jsonb,
  p_target_value integer,
  p_xp_reward integer,
  p_is_active boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.has_admin_access(auth.uid()) THEN RAISE EXCEPTION 'Access denied: admin role required'; END IF;
  IF coalesce(trim(p_slug), '') !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' THEN RAISE EXCEPTION 'Mission slug must use lowercase letters, numbers, and hyphens'; END IF;
  IF p_mission_type NOT IN ('daily', 'weekly') OR coalesce(jsonb_typeof(p_criteria), '') <> 'object' OR p_criteria ->> 'type' <> 'xp_earned' THEN RAISE EXCEPTION 'Only daily or weekly XP-earned missions are supported'; END IF;
  IF p_target_value IS NULL OR p_target_value < 1 OR p_xp_reward IS NULL OR p_xp_reward < 0 THEN RAISE EXCEPTION 'Mission target and XP reward must be valid'; END IF;
  IF p_id IS NULL THEN
    INSERT INTO public.learning_missions (slug, title, description, mission_type, criteria, target_value, xp_reward, is_active)
    VALUES (trim(p_slug), trim(p_title), coalesce(trim(p_description), ''), p_mission_type, p_criteria, p_target_value, p_xp_reward, coalesce(p_is_active, true)) RETURNING id INTO v_id;
  ELSE
    UPDATE public.learning_missions SET slug = trim(p_slug), title = trim(p_title), description = coalesce(trim(p_description), ''), mission_type = p_mission_type, criteria = p_criteria, target_value = p_target_value, xp_reward = p_xp_reward, is_active = coalesce(p_is_active, true) WHERE id = p_id RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'Mission not found'; END IF;
  END IF;
  PERFORM public.log_audit_action('learning.mission.upsert', 'learning_mission', v_id, jsonb_build_object('slug', p_slug, 'isActive', p_is_active));
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_upsert_learning_skill(uuid, text, text, text, text, text, uuid, integer, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_upsert_learning_achievement(uuid, text, text, text, text, text, text, integer, jsonb, boolean, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_upsert_learning_mission(uuid, text, text, text, text, jsonb, integer, integer, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_upsert_learning_skill(uuid, text, text, text, text, text, uuid, integer, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upsert_learning_achievement(uuid, text, text, text, text, text, text, integer, jsonb, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upsert_learning_mission(uuid, text, text, text, text, jsonb, integer, integer, boolean) TO authenticated;
