-- Decision layer · Tier A — decision tags on nodes.
--
-- In a branching canvas a decision is already structural: a node with several
-- children is a decision point, each child is an option, the kept path is the
-- choice. This migration names that: a per-node `decision_status` plus an
-- optional one-line `decision_note` (the "why"), and lightweight authorship
-- (`decided_by` / `decided_at`) so shared trees show who settled what.
--
-- Additive and behaviour-preserving:
--   • Every column is nullable; null = untagged. Existing rows are untouched.
--   • Builds on the collaboration migration (20260612000000): tags are written
--     by members through the same column-clamped GRANT UPDATE path as `color`,
--     and sync live because `nodes` is already in the supabase_realtime
--     publication. No new RLS policies are needed — the collab SELECT/UPDATE
--     policies (via can_access_project) already scope who can read/write a node.
--
-- Tiers B (first-class `decisions` records) and C (`decision_events` audit log)
-- arrive in a later migration; this is the substrate they build on.


-- ── Columns ──────────────────────────────────────────────────────────────────

ALTER TABLE public.nodes
  ADD COLUMN IF NOT EXISTS decision_status TEXT
    CHECK (decision_status IS NULL OR decision_status IN
      ('undecided', 'considering', 'decided', 'rejected', 'dead', 'later')),
  ADD COLUMN IF NOT EXISTS decision_note TEXT,
  ADD COLUMN IF NOT EXISTS decided_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS decided_at    TIMESTAMPTZ;


-- ── Ledger index ───────────────────────────────────────────────────────────
-- The project Decisions view (Tier 3) queries tagged nodes per conversation;
-- a partial index keeps that scan to just the tagged rows.
CREATE INDEX IF NOT EXISTS nodes_decision_status_idx
  ON public.nodes (project_id, decision_status)
  WHERE decision_status IS NOT NULL;


-- ── Grant: let members tag without rewriting history ─────────────────────────
-- The collab migration REVOKEd blanket UPDATE on nodes and re-granted only the
-- canvas-metadata columns. Extend that allow-list with the decision columns so
-- a member can tag/annotate a node, while role/content/parent_id/created_by
-- stay off-limits. Additive — the prior grant (color, merge_sources,
-- position_x, position_y) is left intact.
GRANT UPDATE (decision_status, decision_note, decided_by, decided_at)
  ON public.nodes TO authenticated;
