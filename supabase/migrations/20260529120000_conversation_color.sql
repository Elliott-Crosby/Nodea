-- Per-conversation color. Lets a user tint an individual chat in the sidebar
-- independently of any project it belongs to. NULL = no color (default chat
-- bubble tint). Values are one of the ROYGBIV palette color ids (see
-- src/app/app/projectConstants.tsx) — validated in the app, not the DB.
--
-- Reminder: the legacy `projects` table actually stores conversations.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS color TEXT;
