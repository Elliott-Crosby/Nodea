-- Persist the early-bird rate lock on the profile.
--
-- "Rate locked forever" was previously implied by the live offer status, which
-- only holds while the offer is open. Once a subscription is deleted the plan
-- flips to 'free' and the profile forgets the user was ever an early bird — so
-- an INVOLUNTARY churn (expired card, failed dunning) would silently cost them
-- the $8 rate on re-subscribe. This column makes the entitlement durable and
-- independent of the offer window.
--
-- Set at checkout.session.completed for any checkout that used the early-bird
-- price; never cleared, including on cancellation.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS early_bird BOOLEAN NOT NULL DEFAULT false;

-- Backfill: everyone who BOUGHT Pro did so during the early-bird window (the
-- standard price did not exist before this migration). Restricted to rows with
-- a stripe_customer_id — admin grants, comped accounts and legacy self-inserted
-- 'pro' rows never paid, so they must not receive a permanent $8 rate lock they
-- could redeem later. Mirrors the canonical Pro gate in src/lib/plan.ts.
UPDATE public.user_profiles
   SET early_bird = true
 WHERE plan = 'pro'
   AND stripe_customer_id IS NOT NULL;
