-- Fix: GET /api/projects creates 'My First Project' when the user's list is
-- empty via check-then-insert. Concurrent first loads (two tabs after signup,
-- a retry, React Strict Mode's double effect) both saw an empty list and both
-- inserted, leaving duplicate default rows. Add a per-user arbiter column so
-- at most one auto-created default can ever exist.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;

-- Cleanup first: drop EMPTY duplicate auto-created shells (no nodes), keeping
-- the earliest. Rows that contain any nodes are never deleted.
DELETE FROM public.projects p
WHERE p.name = 'My First Project'
  AND NOT EXISTS (SELECT 1 FROM public.nodes n WHERE n.project_id = p.id)
  AND p.id <> (
    SELECT q.id FROM public.projects q
    WHERE q.user_id = p.user_id AND q.name = 'My First Project'
    ORDER BY q.created_at ASC, q.id ASC
    LIMIT 1
  );

-- Mark the earliest surviving auto-created project as the default arbiter row.
UPDATE public.projects p
SET is_default = true
WHERE p.name = 'My First Project'
  AND p.id = (
    SELECT q.id FROM public.projects q
    WHERE q.user_id = p.user_id AND q.name = 'My First Project'
    ORDER BY q.created_at ASC, q.id ASC
    LIMIT 1
  );

-- The arbiter: at most one default project per user. The race loser's insert
-- now fails with a unique violation (23505) and the route re-selects instead
-- of creating a duplicate.
CREATE UNIQUE INDEX IF NOT EXISTS projects_one_default_per_user
  ON public.projects (user_id)
  WHERE is_default;
