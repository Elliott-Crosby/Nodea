-- Hardening after a confirmed privilege escalation (2026-06-19).
--
-- INCIDENT
--   The original INSERT policy (20260518000000, "service_insert_profile") gated
--   only row ownership — WITH CHECK (auth.uid() = user_id) — and not column
--   VALUES. Any authenticated user could insert their own profile row from the
--   browser console with is_admin = true. Account fcino25254@minitts.net did
--   exactly that on 2026-06-19 01:49 UTC, after probing plan forgery on a
--   sibling burner (rgvfb60233@minitts.net) nine minutes earlier. Both are now
--   demoted, reset to 'free', and banned.
--
-- WHY THE EXISTING FIX DID NOT PREVENT IT
--   20260610120000 already replaced that policy with a column-pinned one, nine
--   days BEFORE the attack, and `supabase migration list` reports it as applied
--   to remote. It was not: its remediation UPDATE demotes every non-seed admin,
--   so had the SQL ever executed the attacker's flag would have been cleared
--   automatically. It never was. This is the signature of
--   `migration repair --status applied`, which stamps a version as applied
--   WITHOUT running its SQL — a security migration silently became a no-op
--   while the tooling reported success.
--
--   Consequence: production's only working defence today is the column-grant
--   clamp from 20260806120000 (REVOKE INSERT + GRANT INSERT (user_id,
--   use_cases, ...)), verified live. The RLS policy layer that was supposed to
--   be the primary defence is, on that evidence, still absent.
--
-- WHAT THIS MIGRATION DOES
--   Everything below is idempotent and safe to run whether or not 20260610120000
--   ever executed. It re-asserts the policy and grants, then adds a trigger as
--   the durable backstop: grants and policies are per-column and easy to widen
--   by accident, but the trigger blocks escalation no matter what a future
--   migration grants. Defence that does not depend on remembering this incident.


-- ── 1. Re-assert the hardened INSERT policy ──────────────────────────────────
-- Drops the legacy permissive policy if it is still present (it very likely is)
-- and recreates the column-pinned replacement.
DROP POLICY IF EXISTS "service_insert_profile"            ON public.user_profiles;
DROP POLICY IF EXISTS "users_insert_own_default_profile"  ON public.user_profiles;

CREATE POLICY "users_insert_own_default_profile"
  ON public.user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND is_admin = false
    AND plan = 'free'
    AND stripe_customer_id IS NULL
    AND early_bird = false
    AND custom_daily_tokens IS NULL
    AND custom_monthly_tokens IS NULL
    AND terms_accepted_at IS NULL
  );

-- ── 2. Re-assert the own-row UPDATE policy (survey columns only) ─────────────
DROP POLICY IF EXISTS "users_update_own_use_cases" ON public.user_profiles;
CREATE POLICY "users_update_own_use_cases"
  ON public.user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 3. Re-assert the column grant clamps ─────────────────────────────────────
-- Table-wide DML is service-role only; the client may touch exactly the survey
-- columns it legitimately writes (src/app/welcome/page.tsx, App.tsx saveUseCases).
REVOKE INSERT, UPDATE ON public.user_profiles FROM authenticated, anon;
GRANT INSERT (user_id, use_cases, use_cases_other, use_cases_updated_at)
  ON public.user_profiles TO authenticated;
GRANT UPDATE (use_cases, use_cases_other, use_cases_updated_at)
  ON public.user_profiles TO authenticated;

-- ── 4. Trigger backstop ──────────────────────────────────────────────────────
-- The durable layer. PostgREST issues SET LOCAL ROLE per request, so current_user
-- is the caller's actual role: 'authenticated' / 'anon' for browser traffic,
-- 'service_role' for the service key, 'postgres' for migrations. We block only
-- the first two, so every legitimate server path (Stripe webhook, /api/consent,
-- /api/admin/users, /api/memory-import) is unaffected — as are migrations.
--
-- Reading current_user rather than parsing request.jwt.claims is deliberate:
-- there is no malformed-input path that could make this fail open.
CREATE OR REPLACE FUNCTION public.user_profiles_guard_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  -- Not browser traffic → nothing to police.
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- A client-created row may only ever be a pristine default row.
    IF NEW.is_admin              IS DISTINCT FROM false
    OR NEW.plan                  IS DISTINCT FROM 'free'
    OR NEW.stripe_customer_id    IS NOT NULL
    OR NEW.early_bird            IS DISTINCT FROM false
    OR NEW.custom_daily_tokens   IS NOT NULL
    OR NEW.custom_monthly_tokens IS NOT NULL
    OR NEW.terms_accepted_at     IS NOT NULL
    OR NEW.terms_version         IS NOT NULL
    OR NEW.marketing_opt_in      IS DISTINCT FROM false
    OR NEW.marketing_updated_at  IS NOT NULL
    OR NEW.memory_imported_at    IS NOT NULL
    THEN
      RAISE EXCEPTION
        'user_profiles: privileged columns are service-role only (attempted INSERT by %)', current_user
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: privileged columns must be byte-identical to what was there.
  IF NEW.user_id               IS DISTINCT FROM OLD.user_id
  OR NEW.is_admin              IS DISTINCT FROM OLD.is_admin
  OR NEW.plan                  IS DISTINCT FROM OLD.plan
  OR NEW.stripe_customer_id    IS DISTINCT FROM OLD.stripe_customer_id
  OR NEW.early_bird            IS DISTINCT FROM OLD.early_bird
  OR NEW.custom_daily_tokens   IS DISTINCT FROM OLD.custom_daily_tokens
  OR NEW.custom_monthly_tokens IS DISTINCT FROM OLD.custom_monthly_tokens
  OR NEW.terms_accepted_at     IS DISTINCT FROM OLD.terms_accepted_at
  OR NEW.terms_version         IS DISTINCT FROM OLD.terms_version
  OR NEW.marketing_opt_in      IS DISTINCT FROM OLD.marketing_opt_in
  OR NEW.marketing_updated_at  IS DISTINCT FROM OLD.marketing_updated_at
  OR NEW.memory_imported_at    IS DISTINCT FROM OLD.memory_imported_at
  THEN
    RAISE EXCEPTION
      'user_profiles: privileged columns are service-role only (attempted UPDATE by %)', current_user
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_profiles_guard_privileged_columns ON public.user_profiles;
CREATE TRIGGER user_profiles_guard_privileged_columns
  BEFORE INSERT OR UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.user_profiles_guard_privileged_columns();

-- ── 5. Constrain plan to the tiers that actually exist ───────────────────────
-- The attacker's row carried plan = 'basic', a tier that appears nowhere in the
-- codebase — the column is bare TEXT with no constraint, so any string stuck.
-- src/app/api/stripe/webhook/route.ts writes only 'pro' and 'free'.
-- NOT VALID: enforce on new writes without re-validating historical rows.
ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_plan_valid;
ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_plan_valid
    CHECK (plan IN ('free', 'pro')) NOT VALID;

-- ── 6. Remediation ───────────────────────────────────────────────────────────
-- Re-run of what 20260610120000 was supposed to do. Already applied by hand
-- during incident response, so these are expected to affect zero rows — they
-- exist so the migration is self-contained and correct on any replica or
-- restored backup where the manual step never happened.
--
-- Deliberately NOT touching plan='pro' rows with a NULL stripe_customer_id:
-- the two that remain (ecrosby25@vt.edu, bonnielcrosby@gmail.com) are owner
-- comps, not forgeries. src/lib/plan.ts already refuses to unlock Pro without a
-- stripe_customer_id, so a forged 'pro' grants nothing regardless.
UPDATE public.user_profiles
SET is_admin = false
WHERE is_admin = true
  AND user_id <> '64b415d7-4b59-4ff1-aa35-5f88de1599de';

-- Token-cap overrides are admin-granted (/api/admin/users set_caps). Anything
-- carried by a non-admin, non-comped free account is self-granted.
UPDATE public.user_profiles
SET custom_daily_tokens = NULL, custom_monthly_tokens = NULL
WHERE (custom_daily_tokens IS NOT NULL OR custom_monthly_tokens IS NOT NULL)
  AND is_admin = false
  AND plan = 'free'
  AND stripe_customer_id IS NULL;
