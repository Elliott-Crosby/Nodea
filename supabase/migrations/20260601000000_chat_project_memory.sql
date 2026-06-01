-- Project memory — a free-form context box on each chat_project.
--
-- Unlike the short `description` (a human-facing blurb shown in the project
-- header), `memory` is persistent context the user writes *for the assistant*:
-- it's injected into the system prompt for every conversation filed under the
-- project, the same way cross-chat `user_memories` are. Editable inline on the
-- project page.
--
-- Defaults to '' so existing rows and inserts that omit it are well-defined.
-- Length is capped in the app (MAX_PROJECT_MEMORY_LENGTH) and re-validated in
-- the PATCH route.

ALTER TABLE public.chat_projects
  ADD COLUMN IF NOT EXISTS memory TEXT NOT NULL DEFAULT '';
