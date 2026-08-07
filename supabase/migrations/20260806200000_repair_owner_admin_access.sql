-- Repair owner access for existing accounts and keep future registrations in sync.
-- Email comparisons are normalized so Gmail casing cannot prevent admin access.

INSERT INTO public.admin_emails (email)
VALUES ('sattorovkamronbek2@gmail.com')
ON CONFLICT (email) DO NOTHING;

UPDATE public.profiles
SET role = 'admin', status = 'active'
WHERE lower(email) = 'sattorovkamronbek2@gmail.com';

CREATE OR REPLACE FUNCTION public.can_access_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.status = 'active'
      AND EXISTS (
        SELECT 1
        FROM public.admin_emails ae
        WHERE lower(ae.email) = lower(p.email)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(NEW.email);
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, status)
  VALUES (
    NEW.id,
    v_email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(v_email, '@', 1)),
    CASE
      WHEN EXISTS (SELECT 1 FROM public.admin_emails WHERE lower(email) = v_email) THEN 'admin'
      ELSE 'user'
    END,
    'active'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- A user may edit their profile but may never grant themselves a privileged role,
-- change their profile email, or reactivate a suspended account.
CREATE OR REPLACE FUNCTION public.prevent_self_privilege_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() = OLD.id AND (
    NEW.role IS DISTINCT FROM OLD.role
    OR NEW.status IS DISTINCT FROM OLD.status
    OR NEW.email IS DISTINCT FROM OLD.email
  ) THEN
    RAISE EXCEPTION 'Profile privilege fields cannot be changed by the account owner';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_prevent_self_privilege_changes ON public.profiles;
CREATE TRIGGER profiles_prevent_self_privilege_changes
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_self_privilege_changes();

GRANT EXECUTE ON FUNCTION public.can_access_admin() TO authenticated;
