-- Provenance for conversations imported from an outside chat host (today: the
-- "Nodea Tree for Claude" browser extension, via "Open in Nodea"). These columns
-- let a Nodea conversation remember exactly where it came from so we can later
-- re-check the original for changes ("Update Conversation") and diff against it.
--
-- All columns are nullable with no default, so this is a metadata-only change
-- (no table rewrite). NULL `source` is the common case — a native Nodea
-- conversation with no external origin. Existing row-level security on
-- public.projects / public.nodes is column-agnostic, so no policy change is
-- required (same as the merge_sources migration).

-- ── projects = a conversation (legacy table name) ────────────────────────────
ALTER TABLE public.projects
  -- Origin tag, e.g. 'claude'. NULL = native Nodea conversation.
  ADD COLUMN IF NOT EXISTS source                 TEXT        DEFAULT NULL,
  -- The source host's id for this conversation (Claude conversation UUID).
  ADD COLUMN IF NOT EXISTS source_conversation_id  TEXT        DEFAULT NULL,
  -- The source host's org/account id, needed to re-fetch the tree on update
  -- (Claude scopes conversations under /organizations/{org}/...).
  ADD COLUMN IF NOT EXISTS source_org_id           TEXT        DEFAULT NULL,
  -- The source's "current leaf" message id at the moment of the last sync —
  -- where the live conversation pointed, so an update can land in the same spot.
  ADD COLUMN IF NOT EXISTS source_leaf_id          TEXT        DEFAULT NULL,
  -- When we last imported / synced from the source.
  ADD COLUMN IF NOT EXISTS source_synced_at        TIMESTAMPTZ DEFAULT NULL;

-- ── nodes = the messages of a conversation ───────────────────────────────────
ALTER TABLE public.nodes
  -- The source host's id for the message this node was imported from. The key
  -- "Update Conversation" diffs on: a source message whose id is absent here is
  -- new and gets appended; everything already present is left untouched.
  ADD COLUMN IF NOT EXISTS source_message_id TEXT DEFAULT NULL;

-- "Have I already imported this source conversation?" — the dedupe / update
-- lookup. Partial so it only indexes imported rows (cheap; most rows are NULL).
CREATE INDEX IF NOT EXISTS projects_source_conversation_idx
  ON public.projects (user_id, source, source_conversation_id)
  WHERE source_conversation_id IS NOT NULL;

-- "Which source messages are already in this conversation?" — the per-update
-- diff lookup.
CREATE INDEX IF NOT EXISTS nodes_source_message_idx
  ON public.nodes (project_id, source_message_id)
  WHERE source_message_id IS NOT NULL;
