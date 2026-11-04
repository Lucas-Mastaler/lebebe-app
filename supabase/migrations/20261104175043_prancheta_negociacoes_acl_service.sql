-- Supabase pode conceder ALL por ALTER DEFAULT PRIVILEGES do proprietário.
-- GRANT SELECT sozinho não remove esses privilégios herdados. Nenhum DML.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $acl$
DECLARE tabela text;
BEGIN
 FOREACH tabela IN ARRAY ARRAY[
 'atendimento_presencial_negociacoes',
 'atendimento_presencial_negociacao_retornos',
 'atendimento_presencial_vendas_digitais',
 'atendimento_presencial_negociacao_encerramentos',
 'atendimento_presencial_negociacao_eventos'] LOOP
  EXECUTE format('REVOKE ALL ON TABLE public.%I FROM service_role',tabela);
  EXECUTE format('GRANT SELECT ON TABLE public.%I TO service_role',tabela);
 END LOOP;
END $acl$;
COMMIT;
