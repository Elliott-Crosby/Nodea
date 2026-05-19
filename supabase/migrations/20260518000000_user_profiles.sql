-- User profiles table — stores per-user metadata including admin status.
-- Admins (is_admin = true) bypass all token limits and get access to
-- privileged features and data.

CREATE TABLE public.user_profiles (
  user_id  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile (so the client can know if they're admin)
CREATE POLICY "users_select_own_profile"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = user_id);

-- Only service-role (server-side) can insert/update profiles
CREATE POLICY "service_insert_profile"
  ON public.user_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Seed Elliott's account as permanent admin
INSERT INTO public.user_profiles (user_id, is_admin)
VALUES ('64b415d7-4b59-4ff1-aa35-5f88de1599de', true)
ON CONFLICT (user_id) DO UPDATE SET is_admin = true;
