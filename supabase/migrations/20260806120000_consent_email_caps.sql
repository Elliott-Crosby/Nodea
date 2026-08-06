-- Consent records, email preferences, admin cap overrides, and memory-import
-- tracking on the profile — plus an INSERT column clamp closing the early_bird
-- self-grant gap.
--
-- ⚠️ Deploy order: apply BEFORE the code deploy that selects these columns
-- (PostgREST returns HTTP 400 for a missing column) — house rule.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS terms_version         TEXT,
  ADD COLUMN IF NOT EXISTS marketing_opt_in      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS marketing_updated_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS custom_daily_tokens   INTEGER,
  ADD COLUMN IF NOT EXISTS custom_monthly_tokens INTEGER,
  ADD COLUMN IF NOT EXISTS memory_imported_at    TIMESTAMPTZ;

-- NULL = no override (plan default applies); an override must be a real cap.
ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_custom_daily_positive
    CHECK (custom_daily_tokens IS NULL OR custom_daily_tokens > 0),
  ADD CONSTRAINT user_profiles_custom_monthly_positive
    CHECK (custom_monthly_tokens IS NULL OR custom_monthly_tokens > 0);

-- Every write to the new columns goes through service-role API routes
-- (/api/consent, /api/admin/users, /api/memory-import): the server supplies
-- the consent clock, and only admins set caps. The survey migration's UPDATE
-- grant already excludes them (REVOKE UPDATE + column-scoped GRANT), so
-- nothing to do on the UPDATE side.
--
-- INSERT, however, was still table-wide: users_insert_own_default_profile
-- pins is_admin / plan / stripe_customer_id but not early_bird (added later)
-- nor these new columns — a browser-console INSERT could self-grant the $8
-- rate lock or a giant token cap on a fresh profile row. Clamp INSERT to
-- exactly the columns the client legitimately supplies (the survey save on
-- accounts with no profile row yet) and let column defaults fill the rest.
REVOKE INSERT ON public.user_profiles FROM authenticated, anon;
GRANT INSERT (user_id, use_cases, use_cases_other, use_cases_updated_at)
  ON public.user_profiles TO authenticated;
