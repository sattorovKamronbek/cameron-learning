-- The browser reads the signed-in user's profile immediately after Auth
-- succeeds. RLS restricts the rows; this grant enables the table operation
-- itself for the authenticated PostgREST role.
GRANT SELECT ON TABLE public.profiles TO authenticated;
