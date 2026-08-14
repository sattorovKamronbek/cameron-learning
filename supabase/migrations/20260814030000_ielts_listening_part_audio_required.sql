/*
  IELTS Listening now uses one audio file per part, rather than one recording
  shared from Part 1. Keep this check in a trigger so future publish function
  changes cannot accidentally weaken the requirement.
*/

CREATE OR REPLACE FUNCTION public.validate_ielts_listening_part_audio_before_publish()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.subject = 'ielts'
    AND NEW.is_published
    AND NOT OLD.is_published
    AND EXISTS (
      SELECT 1
      FROM public.contest_exam_parts AS part
      WHERE part.contest_id = NEW.id
        AND part.section = 'listening'
        AND nullif(trim(part.audio_url), '') IS NULL
    ) THEN
    RAISE EXCEPTION 'Every IELTS Listening part requires its own audio file';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contests_validate_ielts_listening_part_audio_publish ON public.contests;
CREATE TRIGGER contests_validate_ielts_listening_part_audio_publish
BEFORE UPDATE OF is_published ON public.contests
FOR EACH ROW
EXECUTE FUNCTION public.validate_ielts_listening_part_audio_before_publish();

REVOKE ALL ON FUNCTION public.validate_ielts_listening_part_audio_before_publish() FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
