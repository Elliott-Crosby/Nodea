-- Retire browser access without deleting anyone's data. Service-role access
-- remains available for verified, manually handled export/deletion requests.
-- Supabase Auth is intentionally retained: Nodea Tree uses the same Auth project.
BEGIN;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;

-- Include column grants (not removed by a table-level REVOKE).
DO $$
DECLARE col record;
BEGIN
  FOR col IN
    SELECT table_schema, table_name, column_name, privilege_type, grantee
    FROM information_schema.column_privileges
    WHERE table_schema = 'public' AND grantee IN ('PUBLIC', 'anon', 'authenticated')
  LOOP
    EXECUTE format('REVOKE %s (%I) ON TABLE %I.%I FROM %s',
      col.privilege_type, col.column_name, col.table_schema, col.table_name,
      CASE WHEN col.grantee = 'PUBLIC' THEN 'PUBLIC' ELSE quote_ident(col.grantee) END);
  END LOOP;
END $$;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

-- Existing storage policies cannot OR their way around a restrictive policy.
CREATE POLICY retired_web_app_attachments ON storage.objects
  AS RESTRICTIVE FOR ALL TO anon, authenticated
  USING (bucket_id <> 'chat-attachments')
  WITH CHECK (bucket_id <> 'chat-attachments');

CREATE TABLE public.shutdown_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL CHECK (char_length(btrim(message)) BETWEEN 1 AND 3000),
  email text CHECK (char_length(email) <= 254),
  client_hash text NOT NULL CHECK (client_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX shutdown_feedback_created_idx ON public.shutdown_feedback (created_at);
CREATE INDEX shutdown_feedback_client_idx ON public.shutdown_feedback (client_hash, created_at);
ALTER TABLE public.shutdown_feedback ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shutdown_feedback FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.shutdown_feedback TO service_role;

CREATE FUNCTION public.collect_shutdown_feedback(p_message text, p_email text, p_client_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- Serialize the count and insert, so parallel requests cannot bypass limits.
  PERFORM pg_catalog.pg_advisory_xact_lock(88201419::bigint);
  IF (SELECT count(*) FROM public.shutdown_feedback WHERE created_at > now() - interval '1 hour') >= 100
     OR (SELECT count(*) FROM public.shutdown_feedback
         WHERE client_hash = p_client_hash AND created_at > now() - interval '1 hour') >= 5 THEN
    RETURN jsonb_build_object('rate_limited', true);
  END IF;
  INSERT INTO public.shutdown_feedback (message, email, client_hash)
    VALUES (p_message, p_email, p_client_hash);
  RETURN jsonb_build_object('received', true);
END;
$$;
REVOKE ALL ON FUNCTION public.collect_shutdown_feedback(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.collect_shutdown_feedback(text, text, text) TO service_role;

-- Fail the transaction rather than silently leaving browser privileges behind.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN (VALUES ('anon'), ('authenticated')) AS roles(name)
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
      AND (has_table_privilege(roles.name, c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
        OR has_any_column_privilege(roles.name, c.oid, 'SELECT,INSERT,UPDATE,REFERENCES'))
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN (VALUES ('anon'), ('authenticated')) AS roles(name)
    WHERE n.nspname = 'public' AND has_function_privilege(roles.name, p.oid, 'EXECUTE')
  ) THEN
    RAISE EXCEPTION 'Retirement failed: browser database privileges remain';
  END IF;
END $$;

COMMIT;
