-- Collaboration foundation: shared Chat Projects + shared one-off conversations.
--
-- Design (additive — every existing owner-only policy stays untouched):
--   • Membership tables record who else can access a space. Ownership stays on
--     the existing user_id columns; the owner never gets a membership row.
--   • chat_project_members  — members of a shared Chat Project (the team space).
--     Every conversation filed under that project inherits access.
--   • conversation_members  — members of a single shared conversation (one-off
--     chat shared by link), independent of any project.
--   • collab_invites        — pending invites. A token link mints a membership
--     row when opened (server-side, service role); from then on access flows
--     from membership, never from the token.
--   • nodes.created_by      — author attribution for shared trees.
--
-- RLS strategy: permissive policies OR together, so we ADD member policies
-- alongside the pre-migration owner policies (whose exact predicates live in
-- the base schema and aren't restated here). Membership checks go through
-- SECURITY DEFINER helpers so policies on projects/nodes can read the
-- membership tables without recursive RLS evaluation.
-- Token billing is untouched: /api/chat meters the authenticated *sender*.


-- ── Membership tables ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.chat_project_members (
  chat_project_id UUID        NOT NULL REFERENCES public.chat_projects(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES auth.users(id)           ON DELETE CASCADE,
  role            TEXT        NOT NULL DEFAULT 'editor' CHECK (role IN ('editor')),
  invited_by      UUID                 REFERENCES auth.users(id)           ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (chat_project_id, user_id)
);
CREATE INDEX IF NOT EXISTS chat_project_members_user_idx
  ON public.chat_project_members (user_id);

CREATE TABLE IF NOT EXISTS public.conversation_members (
  project_id  UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES auth.users(id)      ON DELETE CASCADE,
  role        TEXT        NOT NULL DEFAULT 'editor' CHECK (role IN ('editor')),
  invited_by  UUID                 REFERENCES auth.users(id)      ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);
CREATE INDEX IF NOT EXISTS conversation_members_user_idx
  ON public.conversation_members (user_id);

CREATE TABLE IF NOT EXISTS public.collab_invites (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  token           TEXT        NOT NULL UNIQUE,
  kind            TEXT        NOT NULL CHECK (kind IN ('chat_project', 'conversation')),
  chat_project_id UUID                 REFERENCES public.chat_projects(id) ON DELETE CASCADE,
  project_id      UUID                 REFERENCES public.projects(id)      ON DELETE CASCADE,
  -- When set, only an account with this email may accept (email invite).
  -- NULL = open link invite (anyone with the URL who signs in).
  email           TEXT,
  role            TEXT        NOT NULL DEFAULT 'editor' CHECK (role IN ('editor')),
  invited_by      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '14 days',
  CHECK (
    (kind = 'chat_project'  AND chat_project_id IS NOT NULL AND project_id IS NULL) OR
    (kind = 'conversation'  AND project_id      IS NOT NULL AND chat_project_id IS NULL)
  )
);
CREATE INDEX IF NOT EXISTS collab_invites_chat_project_idx
  ON public.collab_invites (chat_project_id) WHERE chat_project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS collab_invites_project_idx
  ON public.collab_invites (project_id) WHERE project_id IS NOT NULL;

ALTER TABLE public.chat_project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collab_invites       ENABLE ROW LEVEL SECURITY;


-- ── Author attribution on nodes ───────────────────────────────────────────────

ALTER TABLE public.nodes
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Backfill: everything written before collaboration was authored by the
-- conversation's owner.
UPDATE public.nodes n
SET created_by = p.user_id
FROM public.projects p
WHERE n.project_id = p.id AND n.created_by IS NULL;


-- ── Access helpers (SECURITY DEFINER → bypass RLS, no recursion) ─────────────
-- STABLE + empty search_path per the advisor-warnings conventions. These are
-- the single source of truth for "may this user touch this space".

CREATE OR REPLACE FUNCTION public.can_access_chat_project(cp_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_projects cp
    WHERE cp.id = cp_id AND cp.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.chat_project_members m
    WHERE m.chat_project_id = cp_id AND m.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_project(p_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = p_id AND p.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.conversation_members cm
    WHERE cm.project_id = p_id AND cm.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1
    FROM public.projects p
    JOIN public.chat_project_members m ON m.chat_project_id = p.chat_project_id
    WHERE p.id = p_id AND m.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_chat_project_owner(cp_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_projects cp
    WHERE cp.id = cp_id AND cp.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_project_owner(p_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = p_id AND p.user_id = auth.uid()
  );
$$;


-- ── Membership table policies ────────────────────────────────────────────────
-- INSERT is deliberately absent: membership rows are only minted server-side
-- (service role) when an invite is accepted, so a client can never add itself.

CREATE POLICY "collab_select_chat_project_members"
  ON public.chat_project_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_access_chat_project(chat_project_id));

-- A member may leave; the project owner may remove anyone.
CREATE POLICY "collab_delete_chat_project_members"
  ON public.chat_project_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_chat_project_owner(chat_project_id));

CREATE POLICY "collab_select_conversation_members"
  ON public.conversation_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_access_project(project_id));

CREATE POLICY "collab_delete_conversation_members"
  ON public.conversation_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_project_owner(project_id));


-- ── Invite policies ──────────────────────────────────────────────────────────
-- Any member of a space may invite others to it (Google-Docs-style). Accepting
-- runs server-side, so no by-token SELECT path exists for outsiders.

CREATE POLICY "collab_select_invites"
  ON public.collab_invites FOR SELECT TO authenticated
  USING (
    invited_by = auth.uid()
    OR (kind = 'chat_project' AND public.can_access_chat_project(chat_project_id))
    OR (kind = 'conversation' AND public.can_access_project(project_id))
  );

CREATE POLICY "collab_insert_invites"
  ON public.collab_invites FOR INSERT TO authenticated
  WITH CHECK (
    invited_by = auth.uid()
    AND (
      (kind = 'chat_project' AND public.can_access_chat_project(chat_project_id))
      OR (kind = 'conversation' AND public.can_access_project(project_id))
    )
  );

CREATE POLICY "collab_delete_invites"
  ON public.collab_invites FOR DELETE TO authenticated
  USING (
    invited_by = auth.uid()
    OR (kind = 'chat_project' AND public.is_chat_project_owner(chat_project_id))
    OR (kind = 'conversation' AND public.is_project_owner(project_id))
  );


-- ── Widen access: conversations (projects) ───────────────────────────────────
-- Additive member policies; the base-schema owner policies keep working as-is.
-- Members may read and rename/recolor a shared conversation, but only the
-- owner may DELETE it or INSERT new ones under their own user_id (existing
-- policies). New conversations a member starts inside a shared Chat Project
-- are inserted under the member's own user_id (they own that conversation),
-- and other members see it through the chat_project_members join above.

CREATE POLICY "collab_select_projects"
  ON public.projects FOR SELECT TO authenticated
  USING (public.can_access_project(id));

CREATE POLICY "collab_update_projects"
  ON public.projects FOR UPDATE TO authenticated
  USING (public.can_access_project(id))
  WITH CHECK (public.can_access_project(id));

-- The member UPDATE policy above can't stop a row from being re-owned
-- (WITH CHECK can't see OLD values), so take user_id/is_default off the
-- updatable column list instead. No client code updates either column.
-- Built dynamically because the hosted schema may lag the migrations folder
-- (e.g. the tree-summary columns) — grant whichever safe columns exist.
DO $grants$
DECLARE cols TEXT;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ')
  INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'projects'
    AND column_name IN (
      'name', 'color', 'chat_project_id',
      'source', 'source_conversation_id', 'source_org_id', 'source_leaf_id', 'source_synced_at',
      'summary', 'summary_open_loops', 'summary_node_count', 'summary_updated_at'
    );
  REVOKE UPDATE ON public.projects FROM authenticated;
  IF cols IS NOT NULL THEN
    EXECUTE format('GRANT UPDATE (%s) ON public.projects TO authenticated', cols);
  END IF;
END $grants$;


-- ── Widen access: chat_projects (shared team spaces) ─────────────────────────
-- Members can see the project. Editing its settings/memory and deleting it
-- stay owner-only (the API routes also enforce this server-side).

CREATE POLICY "collab_select_chat_projects"
  ON public.chat_projects FOR SELECT TO authenticated
  USING (public.can_access_chat_project(id));


-- ── Widen access: nodes (the message tree) ───────────────────────────────────
-- Members get full tree access in spaces they belong to. Inserts must be
-- authored honestly: created_by is the caller (or NULL from legacy paths).

CREATE POLICY "collab_select_nodes"
  ON public.nodes FOR SELECT TO authenticated
  USING (public.can_access_project(project_id));

CREATE POLICY "collab_insert_nodes"
  ON public.nodes FOR INSERT TO authenticated
  WITH CHECK (
    public.can_access_project(project_id)
    AND (created_by IS NULL OR created_by = auth.uid())
  );

CREATE POLICY "collab_update_nodes"
  ON public.nodes FOR UPDATE TO authenticated
  USING (public.can_access_project(project_id))
  WITH CHECK (public.can_access_project(project_id));

CREATE POLICY "collab_delete_nodes"
  ON public.nodes FOR DELETE TO authenticated
  USING (public.can_access_project(project_id));

-- Same column-clamp as projects: client updates touch only canvas metadata,
-- so project_id (re-parenting), role/content (rewriting history), and
-- created_by (attribution spoofing) come off the updatable list.
DO $grants$
DECLARE cols TEXT;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ')
  INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'nodes'
    AND column_name IN ('color', 'merge_sources', 'position_x', 'position_y');
  REVOKE UPDATE ON public.nodes FROM authenticated;
  IF cols IS NOT NULL THEN
    EXECUTE format('GRANT UPDATE (%s) ON public.nodes TO authenticated', cols);
  END IF;
END $grants$;


-- ── Realtime ─────────────────────────────────────────────────────────────────
-- Live tree sync: clients subscribe to postgres_changes on nodes filtered by
-- project_id. WALRUS enforces the SELECT policies above per subscriber, so a
-- member only ever receives events for trees they can already read.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public' AND tablename = 'nodes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.nodes;
  END IF;
END $$;
