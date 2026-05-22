-- Analytics v2: time-on-page and user event tracking

-- Track how long each page view lasted
ALTER TABLE public.page_views ADD COLUMN IF NOT EXISTS duration_ms INTEGER;

-- Custom event tracking table (no PII stored)
CREATE TABLE IF NOT EXISTS public.events (
  id          BIGSERIAL    PRIMARY KEY,
  session_id  TEXT,
  event_name  TEXT         NOT NULL,
  properties  JSONB,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_insert_event"
  ON public.events FOR INSERT
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS events_created_at_idx  ON public.events (created_at);
CREATE INDEX IF NOT EXISTS events_event_name_idx  ON public.events (event_name);
