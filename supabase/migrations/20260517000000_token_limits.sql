-- Token usage tracking for per-user rate limiting.
-- Limits live in src/lib/token-limits.ts (currently free 25k/450k, pro 50k/1M).
-- Daily counter resets midnight UTC; monthly resets the 1st of the month UTC.

CREATE TABLE public.user_token_usage (
  user_id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_tokens     INTEGER NOT NULL DEFAULT 0,
  monthly_tokens   INTEGER NOT NULL DEFAULT 0,
  total_tokens     BIGINT  NOT NULL DEFAULT 0,
  daily_reset_at   TIMESTAMPTZ NOT NULL,
  monthly_reset_at TIMESTAMPTZ NOT NULL
);

-- Enable real-time so the settings modal can subscribe and update live
ALTER publication supabase_realtime ADD TABLE public.user_token_usage;

ALTER TABLE public.user_token_usage ENABLE ROW LEVEL SECURITY;

-- Read own row
CREATE POLICY "users_select_own_usage"
  ON public.user_token_usage FOR SELECT
  USING (auth.uid() = user_id);

-- Server-side route handler creates the row on first message
CREATE POLICY "users_insert_own_usage"
  ON public.user_token_usage FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Server-side route handler increments counters after each response
CREATE POLICY "users_update_own_usage"
  ON public.user_token_usage FOR UPDATE
  USING (auth.uid() = user_id);
