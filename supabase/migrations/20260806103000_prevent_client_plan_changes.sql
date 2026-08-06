-- Subscription state is billing-owned. Browser clients may update profile details,
-- but cannot grant themselves a paid plan. A trusted payment webhook/service role
-- performs plan changes after a successful provider event.
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (full_name, avatar_url, bio, country, school, preferences) ON public.profiles TO authenticated;
