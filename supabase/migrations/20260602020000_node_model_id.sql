-- Which AI model produced an assistant node, e.g. 'claude-sonnet-4-6'. Captured
-- from the chat API's X-Model-Id response header at generation time. Without
-- this, the model shown on a reply ("Claude · Sonnet 4.6") and its source logo
-- only live in memory and vanish on refresh — this column makes them persist.
--
-- NULL = unknown (the common case for assistant nodes imported from an outside
-- host, where the per-message model isn't exposed, and for replies generated
-- before this column existed). Nullable, no default → metadata-only change, no
-- table rewrite. RLS on public.nodes is column-agnostic, so no policy change is
-- needed (same as the merge_sources / provenance migrations).

ALTER TABLE public.nodes
  ADD COLUMN IF NOT EXISTS model_id TEXT DEFAULT NULL;
