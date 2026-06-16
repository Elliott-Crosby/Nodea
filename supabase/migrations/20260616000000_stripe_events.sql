-- Idempotency ledger for Stripe webhooks.
--
-- The webhook (src/app/api/stripe/webhook/route.ts) inserts event.id here
-- BEFORE applying any side effect. A duplicate-key violation (23505) means the
-- event was already processed — Stripe may redeliver the same event — so the
-- handler acks and stops. The webhook degrades gracefully if this table is
-- absent, so it is safe to deploy the code before this migration is pushed.
--
-- Service-role only: the webhook uses the service client (which bypasses RLS).
-- RLS is enabled with NO policies, so authenticated/anon clients can't read it.

CREATE TABLE IF NOT EXISTS public.stripe_events (
  id          TEXT        PRIMARY KEY,
  type        TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;
