-- =============================================================================
-- Etapa 0.4 - Hardening: geocoding_audit e search_execution_audit
-- =============================================================================
-- Contexto:
--   Essas duas tabelas tinham RLS OFF e grants amplos para anon/authenticated.
--   O Apps Script legado escrevia nelas via Supabase REST com SUPABASE_ANON_KEY.
--   Agora o Apps Script usa a rota segura POST /api/procurar-datas/auditoria-legado
--   que grava via service role. Nao ha mais escrita direta via anon key.
--
-- O que esta migration faz:
--   1. Habilita RLS nas duas tabelas
--   2. Revoga todos os privilegios de anon, authenticated e PUBLIC
--   3. Nao cria policies (service_role bypassa RLS)
--   4. Nao altera grants de service_role
--   5. Nao altera views dependentes (pendencia para etapa futura)
--
-- Views dependentes (15 total, nao alteradas aqui):
--   geocoding_audit: vw_cache_speedup, vw_economia_mensal, vw_economia_por_provider,
--     vw_economia_real_diaria, vw_economia_ultimos_30_dias, vw_enderecos_lentos,
--     vw_performance_30_dias, vw_performance_diaria, vw_performance_por_provider,
--     vw_top_enderecos_cacheados
--   search_execution_audit: vw_search_capacidade_resultado, vw_search_execucoes_lentas,
--     vw_search_performance_30_dias, vw_search_performance_diaria,
--     vw_search_performance_origem
--
-- Rollback (se necessario):
--   ALTER TABLE public.geocoding_audit DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE public.search_execution_audit DISABLE ROW LEVEL SECURITY;
--   GRANT ALL ON TABLE public.geocoding_audit TO anon, authenticated;
--   GRANT ALL ON TABLE public.search_execution_audit TO anon, authenticated;
-- =============================================================================

-- geocoding_audit
ALTER TABLE public.geocoding_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.geocoding_audit FROM anon;
REVOKE ALL ON TABLE public.geocoding_audit FROM authenticated;
REVOKE ALL ON TABLE public.geocoding_audit FROM PUBLIC;

-- search_execution_audit
ALTER TABLE public.search_execution_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.search_execution_audit FROM anon;
REVOKE ALL ON TABLE public.search_execution_audit FROM authenticated;
REVOKE ALL ON TABLE public.search_execution_audit FROM PUBLIC;
