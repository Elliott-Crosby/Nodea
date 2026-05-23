-- Store attachment metadata on each node so the tree diagram can show
-- a small icon + short filename for every node the user attached files to.
-- We only store {name, type} per attachment (not the file payload), so the
-- column stays small and the file itself remains a session-only concept.

ALTER TABLE public.nodes
  ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;
