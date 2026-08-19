-- Price-specific rate lock for the last-chance campaign (Aug 18-25, 2026).
--
-- The boolean early_bird column can only express one locked rate (the $8
-- founding price). The last-chance campaign sells a second locked rate
-- ($12/mo, price_1U60AwGYiQNJnyUE09V3WfYS), so the lock becomes the actual
-- Stripe price id the user is entitled to re-subscribe at. early_bird stays
-- as-is: it is checked by existing code paths and remains the fallback lock
-- for the founding cohort.
--
-- Written by the Stripe webhook (service role) at checkout.session.completed
-- whenever the checkout used a promotional price; never cleared, including on
-- cancellation — an expired card must not cost anyone their locked-in rate.
-- Read by /api/stripe/checkout, which prefers it over every offer window.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS locked_price_id TEXT;

-- Backfill: founding-cohort lockers keep their $8 price under the new scheme
-- too. Same guard as the early_bird backfill — only rows that actually paid.
UPDATE public.user_profiles
   SET locked_price_id = 'price_1TZEDBGYiQNJnyUE802XsWgT'
 WHERE early_bird = true
   AND stripe_customer_id IS NOT NULL
   AND locked_price_id IS NULL;

-- ── Privilege-escalation hardening (see 20260813120000) ──────────────────────
-- locked_price_id is a money column: a user who could write it would grant
-- themselves a discounted rate forever. It joins every layer of the defence.

-- 1. INSERT policy: a client-created row may only ever be a pristine default.
DROP POLICY IF EXISTS "users_insert_own_default_profile" ON public.user_profiles;
CREATE POLICY "users_insert_own_default_profile"
  ON public.user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND is_admin = false
    AND plan = 'free'
    AND stripe_customer_id IS NULL
    AND early_bird = false
    AND locked_price_id IS NULL
    AND custom_daily_tokens IS NULL
    AND custom_monthly_tokens IS NULL
    AND terms_accepted_at IS NULL
  );

-- 2. Column grants: already clamped to the survey columns by 20260813120000
-- (REVOKE + per-column GRANT), so authenticated cannot touch the new column.
-- Nothing to re-assert, but stated here so the next reader doesn't go looking.

-- 3. Trigger backstop: add locked_price_id to both guards. Full function body
-- restated (CREATE OR REPLACE) — it must stay the durable, complete list.
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
    OR NEW.locked_price_id       IS NOT NULL
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
  OR NEW.locked_price_id       IS DISTINCT FROM OLD.locked_price_id
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
