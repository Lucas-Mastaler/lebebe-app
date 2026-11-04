-- Recuperação NÃO DESTRUTIVA D-060. Somente executar remotamente com autorização.
-- Suspende as novas mutações; conserva consultas, dados, auditoria e proteções.
-- Publicação anterior não deve finalizar retornos vinculados sem o novo wrapper.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $$
DECLARE rotina record;
BEGIN
 FOR rotina IN SELECT p.oid::regprocedure assinatura FROM pg_proc p
 JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN (
 'atendimento_presencial_negociacao_materializar',
 'atendimento_presencial_negociacao_criar_retorno',
 'atendimento_presencial_negociacao_vincular',
 'atendimento_presencial_negociacao_corrigir_vinculo',
 'atendimento_presencial_negociacao_digital',
 'atendimento_presencial_negociacao_encerrar',
 'atendimento_presencial_negociacao_concluir_retorno') LOOP
  EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM service_role',rotina.assinatura);
 END LOOP;
END $$;
COMMIT;
-- Reativação: após diagnóstico, reaplicar SOMENTE os GRANT EXECUTE explícitos
-- dessas sete funções da migration validada. Nunca excluir tabelas/encerramentos.
