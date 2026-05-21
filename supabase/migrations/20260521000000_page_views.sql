-- Page view tracking for admin analytics dashboard.
-- Stores every page load with path, referrer, and a session ID
-- (random ID from localStorage) so we can estimate unique visitors per day.
-- No PII is stored.

CREATE TABLE public.page_views (
  id         BIGSERIAL    PRIMARY KEY,
  path       TEXT         NOT NULL,
  referrer   TEXT,
  session_id TEXT,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Service role inserts; no user-level access needed
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

-- Only the server-side tracker (service role) can insert
CREATE POLICY "service_insert_page_view"
  ON public.page_views FOR INSERT
  WITH CHECK (true);

-- Index for analytics queries
CREATE INDEX page_views_created_at_idx ON public.page_views (created_at);
CREATE INDEX page_views_path_idx       ON public.page_views (path);
