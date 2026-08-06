-- Explicit owner bootstrap requested by the platform owner.
-- Admin access remains protected by both the profile role and this allowlist.
INSERT INTO public.admin_emails (email)
VALUES ('sattorovkamronbek1@gmail.com')
ON CONFLICT (email) DO NOTHING;

UPDATE public.profiles
SET role = 'admin', status = 'active'
WHERE lower(email) = 'sattorovkamronbek1@gmail.com';

-- If the owner registers after this migration has run, provision the matching
-- allowlisted address as an admin at profile-creation time.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
    CASE WHEN EXISTS (SELECT 1 FROM public.admin_emails WHERE email = lower(NEW.email)) THEN 'admin' ELSE 'user' END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
