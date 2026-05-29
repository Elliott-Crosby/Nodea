-- Chat Projects — a Pro-only organizational layer that groups related
-- conversations together. Each conversation (a row in the legacy `projects`
-- table) can optionally belong to one chat_project.
--
-- Naming note: the existing `projects` table in this schema actually stores
-- conversations (a historical naming choice). To avoid renaming half the
-- codebase, the new "Projects" feature lives in `chat_projects`, and the
-- nullable foreign key on the legacy table is `chat_project_id`.
--
-- A chat_project carries: a name, an optional description, an icon key
-- (string, validated against a curated set in the app), a color id
-- (one of the ROYGBIV node-palette colors), and a pinned flag so the
-- sidebar can surface up to 3 quick-access projects.

CREATE TABLE IF NOT EXISTS public.chat_projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  icon        TEXT NOT NULL DEFAULT 'sparkle',
  color       TEXT NOT NULL DEFAULT 'violet',
  pinned      BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_projects_user_id_idx
  ON public.chat_projects (user_id);

CREATE INDEX IF NOT EXISTS chat_projects_user_pinned_idx
  ON public.chat_projects (user_id, pinned)
  WHERE pinned = true;

-- Nullable FK on the legacy `projects` table (= conversations) so each
-- conversation can be tagged with a chat_project, or left unfiled (NULL).
-- ON DELETE SET NULL: deleting a chat_project unparents its conversations
-- by default; the app surfaces a separate "delete conversations too" path
-- that explicitly deletes those rows before the chat_project drops.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS chat_project_id UUID
  REFERENCES public.chat_projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS projects_chat_project_id_idx
  ON public.projects (chat_project_id)
  WHERE chat_project_id IS NOT NULL;

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.chat_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_projects_select_own"
  ON public.chat_projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "chat_projects_insert_own"
  ON public.chat_projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "chat_projects_update_own"
  ON public.chat_projects FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "chat_projects_delete_own"
  ON public.chat_projects FOR DELETE
  USING (auth.uid() = user_id);

-- Keep updated_at fresh on UPDATE without forcing every caller to set it.
CREATE OR REPLACE FUNCTION public.chat_projects_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS chat_projects_updated_at_trigger ON public.chat_projects;
CREATE TRIGGER chat_projects_updated_at_trigger
  BEFORE UPDATE ON public.chat_projects
  FOR EACH ROW
  EXECUTE FUNCTION public.chat_projects_set_updated_at();
