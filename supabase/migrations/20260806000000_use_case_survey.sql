-- "What do you use Nodea for?" survey answers, stored on the profile.
--
-- use_cases holds option KEYS from src/lib/useCases.ts (plus 'other');
-- use_cases_other is the free text behind the Other box. NULL use_cases =
-- never answered (the in-app survey popup keys off that), so an answered
-- selection is always written as an array, never NULL.
--
-- ⚠️ Deploy order: apply this BEFORE the code deploy that selects these
-- columns (PostgREST returns HTTP 400 for a missing column). The client reads
-- them in an isolated, non-fatal query, so the worst failure mode here is
-- "survey never shows" — but apply-first remains the house rule.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS use_cases            TEXT[],
  ADD COLUMN IF NOT EXISTS use_cases_other      TEXT,
  ADD COLUMN IF NOT EXISTS use_cases_updated_at TIMESTAMPTZ;

-- Sanity bounds (mirrored client-side): a survey answer is a handful of keys
-- and a short note, not a data dump.
ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_use_cases_max
    CHECK (use_cases IS NULL OR array_length(use_cases, 1) <= 12),
  ADD CONSTRAINT user_profiles_use_cases_other_max
    CHECK (use_cases_other IS NULL OR char_length(use_cases_other) <= 280);

-- user_profiles had no UPDATE policy at all — writes were service-role only.
-- The survey is the first user-writable profile data, so updates open the
-- same way the collab migration opened nodes/projects: an own-row policy plus
-- a COLUMN-scoped grant, keeping plan / is_admin / early_bird /
-- stripe_customer_id service-role-only even with the policy in place.
DROP POLICY IF EXISTS "users_update_own_use_cases" ON public.user_profiles;
CREATE POLICY "users_update_own_use_cases"
  ON public.user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

REVOKE UPDATE ON public.user_profiles FROM authenticated, anon;
GRANT UPDATE (use_cases, use_cases_other, use_cases_updated_at)
  ON public.user_profiles TO authenticated;

-- No INSERT change needed: a fresh account saving the survey before any
-- profile row exists inserts through users_insert_own_default_profile —
-- specifying only user_id + the survey columns satisfies its WITH CHECK via
-- the column defaults (is_admin false, plan 'free', stripe_customer_id NULL).
