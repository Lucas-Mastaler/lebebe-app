-- =============================================================================
-- Hardening: revoke de grants amplos nas 7 views derivadas de geo_cache
-- (appscript/supabase-views.sql) — achado de segurança D-010
-- =============================================================================
-- Contexto:
--   public.geo_cache tem RLS ON e zero policies (deny-all para quem não é
--   owner/bypassrls). As 7 views abaixo, criadas por
--   appscript/supabase-views.sql, rodam com o privilégio do dono (postgres) —
--   comportamento padrão de view no Postgres quando `security_invoker` não é
--   definido — e tinham grants completos (SELECT/INSERT/UPDATE/DELETE/
--   TRUNCATE/REFERENCES/TRIGGER) para anon e authenticated. Isso contornava o
--   RLS de geo_cache e expunha dados de geocoding (bairro, cidade, endereço,
--   coordenadas) para a chave pública anon, sem autenticação.
--
--   O linter de segurança do Supabase (get_advisors) marca as 7 views como
--   `security_definer_view` (nível ERROR). Validado via MCP em 2026-08-10:
--   uma consulta de teste como role `anon` retornou linhas de
--   `vw_cache_stats` mesmo com geo_cache bloqueada para leitura direta por
--   `anon` (permission denied), confirmando o bypass.
--
--   As 15 views equivalentes derivadas de geocoding_audit/
--   search_execution_audit (outros 3 arquivos SQL de appscript/) já foram
--   revogadas no mesmo padrão pela migration
--   20260626180000_hardening_revoke_audit_views_fase_0_4 (aplicada
--   manualmente no banco, fora do mecanismo oficial de migration). Este
--   conjunto de 7 views (originado de geo_cache) ficou fora daquela
--   correção e permanecia exposto.
--
--   Nenhum consumidor real destas 7 views foi encontrado no repositório
--   (src/**, docs/, appscript/, scripts) — a aplicação lê geo_cache
--   diretamente via service role, não através destas views. O guia de
--   Looker Studio existente (appscript/GUIA-PERFORMANCE-TRACKING.md)
--   documenta apenas as views do outro conjunto (já hardened), não estas.
--
-- Objetivo:
--   Revogar grants de anon/authenticated/PUBLIC nas 7 views, mantendo
--   apenas o acesso de postgres/service_role (já existente). Fecha o
--   bypass de RLS sem alterar a definição das views nem a tabela base.
--
-- Observações:
--   1. Esta migration não altera definição de view.
--   2. Esta migration não altera tabela base (geo_cache).
--   3. Esta migration não cria policies.
--   4. Esta migration não concede novos grants.
--   5. REVOKE sem grant existente não causa erro (idempotente na prática).
--
-- Rollback, se necessário:
--   Avaliar caso a caso. Não restaurar grants públicos automaticamente sem
--   decisão explícita de segurança.
-- =============================================================================

REVOKE ALL ON TABLE public.vw_bairros_atendidos FROM anon;
REVOKE ALL ON TABLE public.vw_bairros_atendidos FROM authenticated;
REVOKE ALL ON TABLE public.vw_bairros_atendidos FROM PUBLIC;

REVOKE ALL ON TABLE public.vw_performance_geocoding FROM anon;
REVOKE ALL ON TABLE public.vw_performance_geocoding FROM authenticated;
REVOKE ALL ON TABLE public.vw_performance_geocoding FROM PUBLIC;

REVOKE ALL ON TABLE public.vw_mapa_calor FROM anon;
REVOKE ALL ON TABLE public.vw_mapa_calor FROM authenticated;
REVOKE ALL ON TABLE public.vw_mapa_calor FROM PUBLIC;

REVOKE ALL ON TABLE public.vw_top_logradouros FROM anon;
REVOKE ALL ON TABLE public.vw_top_logradouros FROM authenticated;
REVOKE ALL ON TABLE public.vw_top_logradouros FROM PUBLIC;

REVOKE ALL ON TABLE public.vw_evolucao_temporal FROM anon;
REVOKE ALL ON TABLE public.vw_evolucao_temporal FROM authenticated;
REVOKE ALL ON TABLE public.vw_evolucao_temporal FROM PUBLIC;

REVOKE ALL ON TABLE public.vw_distribuicao_cep FROM anon;
REVOKE ALL ON TABLE public.vw_distribuicao_cep FROM authenticated;
REVOKE ALL ON TABLE public.vw_distribuicao_cep FROM PUBLIC;

REVOKE ALL ON TABLE public.vw_cache_stats FROM anon;
REVOKE ALL ON TABLE public.vw_cache_stats FROM authenticated;
REVOKE ALL ON TABLE public.vw_cache_stats FROM PUBLIC;
