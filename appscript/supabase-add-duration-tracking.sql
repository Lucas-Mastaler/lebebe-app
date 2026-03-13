-- =========================================
-- ADICIONAR RASTREAMENTO DE TEMPO (DURATION)
-- Execute este SQL no Supabase SQL Editor
-- =========================================

-- 1. Adicionar coluna duration_ms na tabela geocoding_audit
ALTER TABLE public.geocoding_audit 
ADD COLUMN IF NOT EXISTS duration_ms INTEGER;

COMMENT ON COLUMN public.geocoding_audit.duration_ms IS 'Tempo de execução da requisição em milissegundos';

-- 2. Criar índice para queries de performance
CREATE INDEX IF NOT EXISTS idx_geocoding_audit_duration 
ON public.geocoding_audit(duration_ms) 
WHERE duration_ms IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_geocoding_audit_created_duration 
ON public.geocoding_audit(created_at, duration_ms);

-- =========================================
-- VIEWS DE ANÁLISE DE PERFORMANCE
-- =========================================

-- VIEW 1: Performance Média por Provider
CREATE OR REPLACE VIEW vw_performance_por_provider AS
SELECT 
    provider,
    cache_hit,
    COUNT(*) as total_requests,
    
    -- Tempo médio
    ROUND(AVG(duration_ms)::numeric, 2) as avg_duration_ms,
    
    -- Tempo mediano (mais confiável que média)
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_ms)::numeric, 2) as median_duration_ms,
    
    -- Percentis 95 e 99 (detecta outliers)
    ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms)::numeric, 2) as p95_duration_ms,
    ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms)::numeric, 2) as p99_duration_ms,
    
    -- Min e Max
    MIN(duration_ms) as min_duration_ms,
    MAX(duration_ms) as max_duration_ms,
    
    -- Conversão para segundos
    ROUND(AVG(duration_ms)::numeric / 1000, 2) as avg_duration_sec
    
FROM public.geocoding_audit
WHERE duration_ms IS NOT NULL
GROUP BY provider, cache_hit
ORDER BY cache_hit DESC, avg_duration_ms ASC;

COMMENT ON VIEW vw_performance_por_provider IS 
'Performance média de geocoding por provider e tipo (cache hit vs API call)';

-- VIEW 2: Evolução Diária de Performance
CREATE OR REPLACE VIEW vw_performance_diaria AS
SELECT 
    DATE(created_at) as data,
    provider,
    cache_hit,
    COUNT(*) as total_requests,
    
    ROUND(AVG(duration_ms)::numeric, 2) as avg_duration_ms,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_ms)::numeric, 2) as median_duration_ms,
    
    -- Percentual de requests rápidas (< 500ms)
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE duration_ms < 500) / COUNT(*)::numeric, 
        2
    ) as pct_fast_requests,
    
    -- Percentual de requests lentas (> 2000ms)
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE duration_ms > 2000) / COUNT(*)::numeric, 
        2
    ) as pct_slow_requests
    
FROM public.geocoding_audit
WHERE duration_ms IS NOT NULL
GROUP BY DATE(created_at), provider, cache_hit
ORDER BY data DESC, avg_duration_ms ASC;

COMMENT ON VIEW vw_performance_diaria IS 
'Evolução diária de performance de geocoding';

-- VIEW 3: Comparação Cache vs API (Speedup)
CREATE OR REPLACE VIEW vw_cache_speedup AS
WITH cache_stats AS (
    SELECT 
        provider,
        AVG(duration_ms) as avg_cache_ms
    FROM public.geocoding_audit
    WHERE cache_hit = true AND duration_ms IS NOT NULL
    GROUP BY provider
),
api_stats AS (
    SELECT 
        provider,
        AVG(duration_ms) as avg_api_ms
    FROM public.geocoding_audit
    WHERE cache_hit = false AND duration_ms IS NOT NULL
    GROUP BY provider
)
SELECT 
    COALESCE(c.provider, a.provider) as provider,
    
    ROUND(c.avg_cache_ms::numeric, 2) as avg_cache_ms,
    ROUND(a.avg_api_ms::numeric, 2) as avg_api_ms,
    
    -- Speedup (quantas vezes o cache é mais rápido)
    ROUND((a.avg_api_ms / NULLIF(c.avg_cache_ms, 0))::numeric, 2) as speedup_factor,
    
    -- Tempo economizado por request (ms)
    ROUND((a.avg_api_ms - c.avg_cache_ms)::numeric, 2) as time_saved_ms,
    
    -- Tempo economizado por request (segundos)
    ROUND((a.avg_api_ms - c.avg_cache_ms)::numeric / 1000, 2) as time_saved_sec
    
FROM cache_stats c
FULL OUTER JOIN api_stats a ON c.provider = a.provider
ORDER BY speedup_factor DESC NULLS LAST;

COMMENT ON VIEW vw_cache_speedup IS 
'Comparação de velocidade entre cache e API - mostra ganho de performance';

-- VIEW 4: Top Endereços Mais Lentos
CREATE OR REPLACE VIEW vw_enderecos_lentos AS
SELECT 
    endereco_completo,
    provider,
    cache_hit,
    COUNT(*) as total_buscas,
    ROUND(AVG(duration_ms)::numeric, 2) as avg_duration_ms,
    MAX(duration_ms) as max_duration_ms,
    MAX(created_at) as ultima_busca
FROM public.geocoding_audit
WHERE duration_ms IS NOT NULL
GROUP BY endereco_completo, provider, cache_hit
HAVING COUNT(*) >= 2  -- Apenas endereços buscados 2+ vezes
ORDER BY avg_duration_ms DESC
LIMIT 100;

COMMENT ON VIEW vw_enderecos_lentos IS 
'Top 100 endereços com maior tempo médio de geocoding';

-- VIEW 5: Resumo Performance Últimos 30 Dias
CREATE OR REPLACE VIEW vw_performance_30_dias AS
SELECT 
    -- Totais
    COUNT(*) as total_requests,
    COUNT(*) FILTER (WHERE cache_hit = true) as cache_hits,
    COUNT(*) FILTER (WHERE cache_hit = false) as api_calls,
    
    -- Cache hit rate
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE cache_hit = true) / COUNT(*)::numeric, 
        2
    ) as cache_hit_rate_pct,
    
    -- Performance geral
    ROUND(AVG(duration_ms)::numeric, 2) as avg_duration_ms,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_ms)::numeric, 2) as median_duration_ms,
    
    -- Performance cache
    ROUND(AVG(duration_ms) FILTER (WHERE cache_hit = true)::numeric, 2) as avg_cache_duration_ms,
    
    -- Performance API
    ROUND(AVG(duration_ms) FILTER (WHERE cache_hit = false)::numeric, 2) as avg_api_duration_ms,
    
    -- Tempo total economizado (segundos)
    ROUND(
        SUM(duration_ms) FILTER (WHERE cache_hit = false)::numeric / 1000, 
        2
    ) as total_api_time_sec,
    
    -- Estimativa de tempo SE TUDO fosse API call
    ROUND(
        (AVG(duration_ms) FILTER (WHERE cache_hit = false) * COUNT(*))::numeric / 1000,
        2
    ) as estimated_time_without_cache_sec,
    
    -- Tempo REAL gasto
    ROUND(SUM(duration_ms)::numeric / 1000, 2) as actual_total_time_sec,
    
    -- Tempo economizado pelo cache (segundos)
    ROUND(
        ((AVG(duration_ms) FILTER (WHERE cache_hit = false) * COUNT(*)) - SUM(duration_ms))::numeric / 1000,
        2
    ) as time_saved_by_cache_sec

FROM public.geocoding_audit
WHERE created_at >= NOW() - INTERVAL '30 days'
  AND duration_ms IS NOT NULL;

COMMENT ON VIEW vw_performance_30_dias IS 
'Resumo de performance dos últimos 30 dias incluindo tempo economizado pelo cache';

-- =========================================
-- GRANT PERMISSIONS
-- =========================================

GRANT SELECT ON vw_performance_por_provider TO anon, authenticated;
GRANT SELECT ON vw_performance_diaria TO anon, authenticated;
GRANT SELECT ON vw_cache_speedup TO anon, authenticated;
GRANT SELECT ON vw_enderecos_lentos TO anon, authenticated;
GRANT SELECT ON vw_performance_30_dias TO anon, authenticated;

-- =========================================
-- QUERIES DE TESTE
-- =========================================

-- Verificar se a coluna foi adicionada
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'geocoding_audit' 
  AND column_name = 'duration_ms';

-- Testar as views
SELECT * FROM vw_performance_por_provider;
SELECT * FROM vw_cache_speedup;
SELECT * FROM vw_performance_30_dias;
