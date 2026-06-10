-- SECURITY FIX: the INSERT policy ("service_insert_profile") only checked row
-- ownership, so any authenticated user could insert their own profile row with
-- is_admin = true and/or plan = 'pro' from the browser console — privilege
-- escalation + paywall bypass. Service-role writes bypass RLS entirely, so the
-- legitimate server-side paths (admin seed, Stripe webhook) never needed it.
DROP POLICY IF EXISTS "service_insert_profile" ON public.user_profiles;

-- If self-provisioning is ever needed client-side, it may only create a
-- default row: never admin, never pro, never with a Stripe customer id.
CREATE POLICY "users_insert_own_default_profile"
  ON public.user_profiles FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND is_admin = false
    AND plan = 'free'
    AND stripe_customer_id IS NULL
  );

-- Remediation: demote any admin that isn't the seeded permanent admin
-- (nothing legitimate ever set is_admin outside that seed).
UPDATE public.user_profiles
SET is_admin = false
WHERE is_admin = true
  AND user_id <> '64b415d7-4b59-4ff1-aa35-5f88de1599de';

-- Remediation: every legitimate 'pro' comes from the Stripe webhook (which
-- records stripe_customer_id) or the seeded admin. Pro rows with no customer
-- id are self-granted — reset them.
UPDATE public.user_profiles
SET plan = 'free'
WHERE plan = 'pro'
  AND stripe_customer_id IS NULL
  AND user_id <> '64b415d7-4b59-4ff1-aa35-5f88de1599de';
