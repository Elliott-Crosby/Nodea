-- Cross-chat memory for Pro users.
-- Each row is a single fact about the user (preferences, role, ongoing
-- projects, etc.) that gets injected into the system prompt of future
-- chats. Auto-extracted from conversations or added manually in Settings.
--
-- Free users do not accumulate new memories, but existing rows survive a
-- plan downgrade so the user can still view and delete them.

CREATE TABLE public.user_memories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content    TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 300),
  source     TEXT NOT NULL DEFAULT 'auto' CHECK (source IN ('auto', 'manual')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_memories_user ON public.user_memories(user_id, created_at);

ALTER TABLE public.user_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_memories"
  ON public.user_memories FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_memories"
  ON public.user_memories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_memories"
  ON public.user_memories FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_delete_own_memories"
  ON public.user_memories FOR DELETE
  USING (auth.uid() = user_id);
