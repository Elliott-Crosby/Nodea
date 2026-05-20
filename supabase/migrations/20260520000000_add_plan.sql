-- Add plan and stripe_customer_id to user_profiles.
-- plan defaults to 'free'; existing admins are promoted to 'pro'.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

UPDATE public.user_profiles SET plan = 'pro' WHERE is_admin = true;
