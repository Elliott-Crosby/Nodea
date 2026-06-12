-- Remove the tree-summary ("where this stands" / open loops) re-entry feature.
-- The feature was ripped out of the app; these columns on the `projects` table
-- (which stores conversations/trees) are now orphaned. Drop them.
--
-- IF EXISTS makes this safe to run against any environment, migrated or not.
ALTER TABLE public.projects
  DROP COLUMN IF EXISTS summary,
  DROP COLUMN IF EXISTS summary_open_loops,
  DROP COLUMN IF EXISTS summary_node_count,
  DROP COLUMN IF EXISTS summary_updated_at;
