-- =========================================================
-- Fase 0 / Etapa 0.3 - Hardening: RLS + revoke grants
-- Tabelas acessadas exclusivamente via service role:
--   sessoes_logout_automatico, geo_cache, provider_costs, forex_config
-- =========================================================

-- 1. sessoes_logout_automatico
ALTER TABLE public.sessoes_logout_automatico ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.sessoes_logout_automatico FROM anon;
REVOKE ALL ON TABLE public.sessoes_logout_automatico FROM authenticated;

-- 2. geo_cache
ALTER TABLE public.geo_cache ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.geo_cache FROM anon;
REVOKE ALL ON TABLE public.geo_cache FROM authenticated;

-- 3. provider_costs
ALTER TABLE public.provider_costs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.provider_costs FROM anon;
REVOKE ALL ON TABLE public.provider_costs FROM authenticated;

-- 4. forex_config
ALTER TABLE public.forex_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.forex_config FROM anon;
REVOKE ALL ON TABLE public.forex_config FROM authenticated;
