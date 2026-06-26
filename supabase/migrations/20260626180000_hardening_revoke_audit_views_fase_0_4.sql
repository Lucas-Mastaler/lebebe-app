-- =============================================================================
-- Etapa 0.4 - Hardening: revokes das views dependentes de auditoria
-- =============================================================================
-- Contexto:
--   As tabelas public.geocoding_audit e public.search_execution_audit foram
--   protegidas na migration da Etapa 0.4 com RLS ON e revokes para anon,
--   authenticated e PUBLIC.
--
--   Depois da aplicação, foram identificadas 15 views dependentes ainda com
--   grants amplos para anon/authenticated. Os revokes dessas views foram
--   aplicados manualmente no Supabase e confirmados por validação.
--
-- Objetivo:
--   Registrar no histórico de migrations os revokes das 15 views dependentes,
--   mantendo o repositório alinhado com o estado atual do banco.
--
-- Observações:
--   1. Esta migration não altera definição de view.
--   2. Esta migration não altera tabela base.
--   3. Esta migration não cria policies.
--   4. Esta migration não concede novos grants.
--   5. Esta migration é idempotente do ponto de vista prático: REVOKE sem grant
--      existente não causa erro.
--
-- Rollback, se necessario:
--   Avaliar caso a caso. Não restaurar grants públicos automaticamente sem
--   decisão explícita de segurança.
-- =============================================================================

REVOKE ALL ON TABLE public.vw_cache_speedup FROM anon;
REVOKE ALL ON TABLE public.vw_cache_speedup FROM authenticated;
REVOKE ALL ON TABLE public.vw_cache_speedup FROM PUBLIC;

REVOKE ALL ON TABLE public.vw_economia_mensal FROM anon;
REVOKE ALL ON TABLE public.vw_economia_mensal FROM authenticated;
REVOKE ALL ON TABLE public.vw_economia_mensal FROM PUBLIC;

REVOKE ALL ON TABLE public.vw_economia_por_provider FROM anon;
REVOKE ALL ON TABLE public.vw_economia_por_provider FROM authenticated;
REVOKE ALL ON TABLE public.vw_economia_por_provider FROM PUBLIC;

REVOKE ALL ON TABLE public.vw_economia_real_diaria FROM anon;
REVOKE ALL ON TABLE public.vw_economia_real_diaria FROM authenticated;
REVOKE ALL ON TABLE public.vw_economia_real_diaria FROM PUBLIC;

REVOKE ALL ON TABLE public.vw_economia_ultimos_30_dias FROM anon;
REVOKE ALL ON TABLE public.vw_economia_ultimos_30_dias FROM authenticated;
REVOKE ALL ON TABLE public.vw_economia_ultimos_30_dias FROM PUBLIC;

REVOKE ALL ON TABLE public.vw_enderecos_lentos FROM anon;
REVOKE ALL ON TABLE public.vw_enderecos_lentos FROM authenticated;
REVOKE ALL ON TABLE public.vw_enderecos_lentos FROM PUBLIC;

REVOKE ALL ON TABLE public.vw_performance_30_dias FROM anon;
REVOKE ALL ON TABLE public.vw_performance_30_dias FROM authenticated;
REVOKE ALL ON TABLE public.vw_performance_30_dias FROM PUBLIC;

REVOKE ALL ON TABLE public.vw_performance_diaria FROM anon;
REVOKE ALL ON TABLE public.vw_performance_diaria FROM authenticated;
REVOKE ALL ON TABLE public.vw_performance_diaria FROM PUBLIC;

REVOKE ALL ON TABLE public.vw_performance_por_provider FROM anon;
REVOKE ALL ON TABLE public.vw_performance_por_provider FROM authenticated;
REVOKE ALL ON TABLE public.vw_performance_por_provider FROM PUBLIC;

REVOKE ALL ON TABLE public.vw_search_capacidade_resultado FROM anon;
REVOKE ALL ON TABLE public.vw_search_capacidade_resultado FROM authenticated;
REVOKE ALL ON TABLE public.vw_search_capacidade_resultado FROM PUBLIC;

REVOKE ALL ON TABLE public.vw_search_execucoes_lentas FROM anon;
REVOKE ALL ON TABLE public.vw_search_execucoes_lentas FROM authenticated;
REVOKE ALL ON TABLE public.vw_search_execucoes_lentas FROM PUBLIC;

REVOKE ALL ON TABLE public.vw_search_performance_30_dias FROM anon;
REVOKE ALL ON TABLE public.vw_search_performance_30_dias FROM authenticated;
REVOKE ALL ON TABLE public.vw_search_performance_30_dias FROM PUBLIC;

REVOKE ALL ON TABLE public.vw_search_performance_diaria FROM anon;
REVOKE ALL ON TABLE public.vw_search_performance_diaria FROM authenticated;
REVOKE ALL ON TABLE public.vw_search_performance_diaria FROM PUBLIC;

REVOKE ALL ON TABLE public.vw_search_performance_origem FROM anon;
REVOKE ALL ON TABLE public.vw_search_performance_origem FROM authenticated;
REVOKE ALL ON TABLE public.vw_search_performance_origem FROM PUBLIC;

REVOKE ALL ON TABLE public.vw_top_enderecos_cacheados FROM anon;
REVOKE ALL ON TABLE public.vw_top_enderecos_cacheados FROM authenticated;
REVOKE ALL ON TABLE public.vw_top_enderecos_cacheados FROM PUBLIC;
