-- Recuperação não destrutiva da Entrega 6. Exige autorização remota separada.
-- Suspende escrita incompatível; conserva DATEs, vínculos, snapshots e normalizadores.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE OR REPLACE FUNCTION public.atendimento_presencial_criancas_habilitado() RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog,public,pg_temp AS $$ SELECT false $$;
CREATE OR REPLACE FUNCTION public.atendimento_presencial_fluxo_v2_habilitado() RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog,public,pg_temp AS $$ SELECT false $$;
REVOKE ALL ON FUNCTION public.atendimento_presencial_criancas_habilitado(),public.atendimento_presencial_fluxo_v2_habilitado() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.atendimento_presencial_criancas_habilitado(),public.atendimento_presencial_fluxo_v2_habilitado() TO service_role;
COMMIT;
