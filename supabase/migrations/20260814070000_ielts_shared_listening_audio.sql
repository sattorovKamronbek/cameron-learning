/*
  IELTS Listening is delivered as one continuous recording for Parts 1–4.
  Store that recording on Listening Part 1; Parts 2–4 use it automatically.
  This replaces the short-lived per-part trigger introduced in 140300.
*/

CREATE OR REPLACE FUNCTION public.validate_ielts_listening_part_audio_before_publish()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF NEW.subject = 'ielts'
    AND NEW.is_published
    AND NOT OLD.is_published
    AND NOT EXISTS (
      SELECT 1
      FROM public.contest_exam_parts AS part
      WHERE part.contest_id = NEW.id
        AND part.section = 'listening'
        AND part.position = 1
        AND nullif(trim(part.audio_url), '') IS NOT NULL
    ) THEN
    RAISE EXCEPTION 'IELTS Listening requires one shared audio file on Part 1';
  END IF;

  RETURN NEW;
END;
$function$;

/* Older deployments can still have the pre-continuous-audio publish RPC.
   Rewrite only its IELTS-specific guard, leaving the stricter CEFR per-part
   audio rule intact. Newer deployments already have the Part 1 rule, so this
   block is intentionally a no-op there. */
DO $migration$
DECLARE
  v_source text;
  v_rewritten text;
BEGIN
  SELECT pg_get_functiondef('public.publish_contest(uuid)'::regprocedure)
  INTO v_source;

  IF position('Every IELTS Listening part requires an audio file' IN v_source) > 0 THEN
    v_rewritten := replace(
      v_source,
      'IF v_part.section = ''listening'' AND nullif(trim(v_part.audio_url), '''') IS NULL THEN RAISE EXCEPTION ''Every IELTS Listening part requires an audio file''; END IF;',
      'IF v_part.section = ''listening'' AND v_part.position = 1 AND nullif(trim(v_part.audio_url), '''') IS NULL THEN RAISE EXCEPTION ''IELTS Listening requires one shared audio file on Part 1''; END IF;'
    );

    IF v_rewritten = v_source THEN
      RAISE EXCEPTION 'Could not replace the legacy IELTS Listening audio requirement';
    END IF;

    EXECUTE v_rewritten;
  END IF;
END;
$migration$;

REVOKE ALL ON FUNCTION public.validate_ielts_listening_part_audio_before_publish() FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
