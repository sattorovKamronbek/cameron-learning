-- Let the contest owner keep refining a contest until its scheduled start,
-- including after it has been published.  The old policy treated publication
-- as an irreversible content lock, which prevented correcting questions and
-- changing the schedule for future contests.
--
-- These are management-only RPCs. Archived and already-started contests stay
-- immutable, so no participant can face changing content during an attempt.

DO $migration$
DECLARE
  v_signature text;
  v_function_oid regprocedure;
  v_source text;
  v_rewritten text;
BEGIN
  FOREACH v_signature IN ARRAY ARRAY[
    'public.update_contest_v2(uuid,text,text,text,text,text,text,text,text,timestamptz,timestamptz,integer,jsonb,text[],text)',
    'public.save_contest_question(uuid,uuid,integer,text,jsonb,text,integer,jsonb,integer,integer,text,uuid)',
    'public.delete_contest_question(uuid,uuid)',
    'public.save_contest_exam_part(uuid,uuid,integer,text,text,text,text,text,integer)',
    'public.delete_contest_exam_part(uuid,uuid)',
    'public.save_contest_exam_section_timings(uuid,integer,integer,integer)',
    'public.save_cefr_gap_fill_answer_keys(uuid,uuid,jsonb)',
    'public.save_cefr_matching_config(uuid,uuid,jsonb,jsonb)',
    'public.save_cefr_map_image(uuid,uuid,text)',
    'public.save_exam_part_image(uuid,uuid,text)'
  ]
  LOOP
    -- Some deployments do not use every CEFR/IELTS optional feature.  Looking
    -- up a missing function with a regprocedure cast aborts the whole
    -- migration, so resolve it safely and leave absent optional RPCs alone.
    v_function_oid := to_regprocedure(v_signature);
    IF v_function_oid IS NULL THEN
      RAISE NOTICE 'Skipping absent optional function: %', v_signature;
      CONTINUE;
    END IF;

    SELECT pg_get_functiondef(v_function_oid) INTO v_source;
    v_rewritten := replace(
      v_source,
      'v_contest.is_published OR v_contest.archived_at IS NOT NULL OR v_contest.start_at <= now()',
      'v_contest.archived_at IS NOT NULL OR v_contest.start_at <= now()'
    );
    v_rewritten := replace(
      v_rewritten,
      'v_contest.is_published OR v_contest.start_at <= now()',
      'v_contest.archived_at IS NOT NULL OR v_contest.start_at <= now()'
    );

    IF v_rewritten = v_source THEN
      -- This can happen when an older deployment does not have the original
      -- publication lock, or when this migration is deliberately re-run.
      RAISE NOTICE 'No future-contest publication lock found in %', v_signature;
      CONTINUE;
    END IF;

    EXECUTE v_rewritten;
  END LOOP;
END;
$migration$;

NOTIFY pgrst, 'reload schema';
