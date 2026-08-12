-- pgcrypto is installed in Supabase's `extensions` schema. Private-contest
-- RPCs intentionally use a restricted search_path, so include that trusted
-- schema explicitly for digest(text, text).

ALTER FUNCTION public.create_contest_v2(
  text, text, text, text, text, text, text, text,
  timestamptz, timestamptz, integer, jsonb, text[], text
) SET search_path = pg_catalog, public, extensions;

ALTER FUNCTION public.update_contest_v2(
  uuid, text, text, text, text, text, text, text, text,
  timestamptz, timestamptz, integer, jsonb, text[], text
) SET search_path = pg_catalog, public, extensions;

ALTER FUNCTION public.redeem_private_contest_access(text)
  SET search_path = pg_catalog, public, extensions;

NOTIFY pgrst, 'reload schema';
