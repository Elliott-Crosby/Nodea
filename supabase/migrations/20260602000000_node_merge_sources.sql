-- Overlay "merge" model for the tree canvas: in addition to its single
-- parent_id (the branch it grew from), a node may converge one or more *other*
-- nodes' branches. We record those extra source node ids here so generation
-- from this node can join their full transcripts into the model context, and
-- so the canvas can draw a light-blue merge edge from each source.
--
-- This never changes parent_id, so the tree layout, branch navigation, and
-- delete flow are untouched — a merge is purely additive context + a visual
-- overlay. NULL (the common case) means "no merges"; a populated value is a
-- JSON array of source node UUID strings, e.g. ["<uuid>", "<uuid>"].
--
-- NULL default keeps this a metadata-only change (no table rewrite) and lets
-- "has any merge" be a cheap `merge_sources IS NOT NULL` check. The existing
-- row-level security on public.nodes is column-agnostic, so no policy change
-- is required.

ALTER TABLE public.nodes
  ADD COLUMN IF NOT EXISTS merge_sources JSONB DEFAULT NULL;
