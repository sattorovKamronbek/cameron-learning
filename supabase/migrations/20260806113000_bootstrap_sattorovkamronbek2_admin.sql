-- Grant the requested platform owner full admin access now and on future sign-up.
INSERT INTO public.admin_emails (email)
VALUES ('sattorovkamronbek2@gmail.com')
ON CONFLICT (email) DO NOTHING;

UPDATE public.profiles
SET role = 'admin', status = 'active'
WHERE lower(email) = 'sattorovkamronbek2@gmail.com';
