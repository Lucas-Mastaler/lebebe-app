-- Remove the temporary OAuth-token capture surface from the Data API.
-- Existing records are intentionally retained for controlled credential rotation.

ALTER TABLE public.google_oauth_setup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_oauth_setup FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir insert durante setup" ON public.google_oauth_setup;
DROP POLICY IF EXISTS "Permitir leitura" ON public.google_oauth_setup;

REVOKE ALL PRIVILEGES ON TABLE public.google_oauth_setup
  FROM anon, authenticated, service_role, PUBLIC;
