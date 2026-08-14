-- Some existing environments were created before the IELTS Writing Task 1
-- image RPC was introduced.  Recreate it explicitly so PostgREST can expose
-- the function to the management UI after its schema cache is reloaded.
CREATE OR REPLACE FUNCTION public.save_exam_part_image(
  p_contest_id uuid,
  p_exam_part_id uuid,
  p_image_url text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_contest public.contests%ROWTYPE;
  v_part public.contest_exam_parts%ROWTYPE;
  v_image_url text := nullif(trim(coalesce(p_image_url, '')), '');
BEGIN
  IF NOT public.can_manage_contest(p_contest_id) THEN
    RAISE EXCEPTION 'Only the owning judge or an admin can manage exam images';
  END IF;

  SELECT * INTO v_contest
  FROM public.contests
  WHERE id = p_contest_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contest not found';
  END IF;
  IF v_contest.archived_at IS NOT NULL OR v_contest.start_at <= now() THEN
    RAISE EXCEPTION 'Exam images cannot be changed after the contest starts';
  END IF;

  SELECT * INTO v_part
  FROM public.contest_exam_parts
  WHERE id = p_exam_part_id
    AND contest_id = p_contest_id;
  IF NOT FOUND
    OR v_contest.subject <> 'ielts'
    OR v_part.section <> 'writing'
    OR v_part.position <> 8 THEN
    RAISE EXCEPTION 'Only IELTS Writing Task 1 can include a visual';
  END IF;

  IF v_image_url IS NOT NULL AND char_length(v_image_url) > 2000 THEN
    RAISE EXCEPTION 'Image URL is too long';
  END IF;

  UPDATE public.contest_exam_parts
  SET image_url = v_image_url
  WHERE id = v_part.id;
END;
$function$;

REVOKE ALL ON FUNCTION public.save_exam_part_image(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_exam_part_image(uuid, uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
