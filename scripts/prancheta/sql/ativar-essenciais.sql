-- NÃO EXECUTADO. Somente na janela futura aprovada, após migration e homologação.
-- Conferir: backup, ausência de atendimentos em uso/abas antigas, build aprovado,
-- mesmo candidato de código validado, flag NEXT_PUBLIC_PRANCHETA_ESSENCIAIS_V1=1
-- e NEXT_PUBLIC_PRANCHETA_PRODUTOS_V2=1 no deployment correspondente.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='5s';
DO $$ BEGIN
 IF to_regprocedure('public.atendimento_presencial_ler_essenciais(uuid,uuid,uuid)') IS NULL
 OR to_regprocedure('public.atendimento_presencial_historico_essenciais(uuid,uuid,integer,uuid)') IS NULL THEN
  RAISE EXCEPTION 'essenciais_migration_pendente';
 END IF;
END $$;
UPDATE public.atendimento_presencial_essenciais_config SET ativo=true WHERE id=true RETURNING ativo;
COMMIT;
