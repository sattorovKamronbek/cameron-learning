/*
# Create profiles table for user accounts and subscription plans

## Purpose
Stores each user's profile information and their current subscription plan.
The profile row is created automatically when a user signs up, and updated
when they change their plan on the pricing page.

## New Tables
- `profiles`
  - `id` (uuid, primary key) — references auth.users(id), cascading delete
  - `email` (text, not null) — copied from auth.users for convenience
  - `full_name` (text, nullable) — display name the user can edit
  - `avatar_url` (text, nullable) — profile picture URL
  - `plan` (text, not null, default 'free') — one of 'free', 'pro', 'max'
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now()) — auto-updated on row change

## Security
- Row Level Security ENABLED on profiles.
- Four separate policies (SELECT, INSERT, UPDATE, DELETE), each scoped TO authenticated:
  - SELECT: user can read only their own profile (auth.uid() = id)
  - INSERT: user can insert only their own profile (auth.uid() = id)
  - UPDATE: user can update only their own profile (auth.uid() = id)
  - DELETE: user can delete only their own profile (auth.uid() = id)

## Important Notes
1. The `id` column is the same UUID as in auth.users, so auth.uid() = id is the ownership check.
2. A trigger creates the profile row automatically when a new auth user is created (see below).
3. The `updated_at` column auto-updates via a custom trigger function on every row change.
*/

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  avatar_url text,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'max')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "delete_own_profile" ON profiles;
CREATE POLICY "delete_own_profile"
  ON profiles FOR DELETE
  TO authenticated
  USING (auth.uid() = id);

-- Custom function to update updated_at on row change
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_set_updated_at ON profiles;
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Auto-create a profile row when a new auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();