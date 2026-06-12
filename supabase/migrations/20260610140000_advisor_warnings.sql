-- Resolves the Supabase Database Linter (Security Advisor) warnings.
-- Every fix below is behaviour-preserving for the running app:
--   • The /demo experience never touches the database (fully client-seeded),
--     so nothing here can affect it.
--   • All logged-in app access (projects, nodes, chat_projects, memories,
--     profiles, token usage) runs as the `authenticated` role via supabase-js.
--   • page_views / events are written AND read only through the service-role
--     client, which bypasses RLS entirely.
--
-- Warnings addressed:
--   0011 function_search_path_mutable          (chat_projects_set_updated_at)
--   0024 rls_policy_always_true                (page_views, events INSERT)
--   0012 auth_allow_anonymous_sign_ins         (all user-owned table policies)
--   0026 pg_graphql_anon_table_exposed         (all public tables)
--   0027 pg_graphql_authenticated_table_exposed(all public tables)
--
-- NOT fixable in SQL (Auth/gotrue config — toggle in the Dashboard):
--   auth_leaked_password_protection → Dashboard ▸ Authentication ▸ Sign In /
--     Providers ▸ Password ▸ enable "Leaked password protection".


-- ── 0011: Function Search Path Mutable ───────────────────────────────────────
-- Pin an empty search_path so the trigger can't be hijacked by a malicious
-- object in a user-controlled schema. now() lives in pg_catalog (always on the
-- path), so the body is unaffected.
CREATE OR REPLACE FUNCTION public.chat_projects_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


-- ── 0024: RLS Policy Always True ─────────────────────────────────────────────
-- These INSERT policies used WITH CHECK (true), which let ANY anon/authenticated
-- caller insert analytics rows from the browser. Inserts only ever come from the
-- service-role client (src/app/api/track*, which bypass RLS), so the policies are
-- pure attack surface. Dropping them leaves RLS enabled with no policy → anon and
-- authenticated get zero access; the service role keeps full access.
DROP POLICY IF EXISTS "service_insert_page_view" ON public.page_views;
DROP POLICY IF EXISTS "service_insert_event"     ON public.events;


-- ── 0012: Anonymous Access Policies ──────────────────────────────────────────
-- Every user-owned policy was created without an explicit TO clause, so it
-- defaulted to `TO public` — which includes the anon role. The qual
-- (auth.uid() = user_id) already yields no rows for anon, but the linter flags
-- the role grant itself. Scope each policy to `authenticated` so anon is never
-- in scope. ALTER POLICY changes only the role list; USING / WITH CHECK are
-- preserved untouched, so we don't need to know each policy's exact predicate
-- (important for projects/nodes, whose policies live in the pre-migration base
-- schema and aren't restated here).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'projects', 'nodes', 'chat_projects', 'user_memories',
        'user_profiles', 'user_token_usage'
      )
  LOOP
    EXECUTE format(
      'ALTER POLICY %I ON public.%I TO authenticated',
      r.policyname, r.tablename
    );
  END LOOP;
END $$;


-- ── 0026 / 0027: Tables exposed in the GraphQL schema ────────────────────────
-- The app is REST-only (supabase-js / PostgREST); it makes no GraphQL calls.
-- pg_graphql derives its schema from the same table SELECT grants PostgREST
-- needs, so the exposure can't be revoked per-role without breaking the REST
-- API. Removing the unused pg_graphql extension takes every public table out of
-- the GraphQL schema at once, clearing all 0026/0027 warnings, with no effect on
-- REST, Auth, Realtime, or Storage. Reversible: CREATE EXTENSION pg_graphql;
--
-- Guarded so a privilege error (the extension may be owned by supabase_admin on
-- some projects) is logged and skipped rather than aborting the whole migration.
DO $$
BEGIN
  DROP EXTENSION IF EXISTS pg_graphql CASCADE;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'pg_graphql not owned by current role; skipped. Drop it from the Dashboard SQL editor to clear lints 0026/0027.';
END $$;
