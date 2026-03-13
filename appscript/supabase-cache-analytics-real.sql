-- =========================================
-- SISTEMA DE TRACKING REAL DE CACHE HITS
-- Economia verdadeira baseada em hits reais
-- =========================================

-- =====================
-- ETAPA 1: TABELAS BASE
-- =====================

-- 1.1) Tabela de custos por provider
CREATE TABLE IF NOT EXISTS public.provider_costs (
  provider VARCHAR(50) PRIMARY KEY,
  custo_usd_por_request NUMERIC(10, 6) NOT NULL DEFAULT 0.000,
  descricao TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 1.2) Tabela de cotação forex (single row)
CREATE TABLE IF NOT EXISTS public.forex_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  cotacao_usd_brl NUMERIC(10, 4) NOT NULL DEFAULT 5.00,
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- 1.3) Tabela de auditoria de geocoding requests (NOVA - O SEGREDO)
-- Esta tabela registra CADA busca de endereço
CREATE TABLE IF NOT EXISTS public.geocoding_audit (
  id BIGSERIAL PRIMARY KEY,
  
  -- Identificação do request
  chave_endereco VARCHAR(64) NOT NULL,  -- hash do endereço (mesmo que geo_cache)
  endereco_completo TEXT,
  
  -- Origem da resposta
  cache_hit BOOLEAN NOT NULL,  -- true = veio do cache, false = chamou API
  provider VARCHAR(50),         -- provider usado (se API) ou 'supabase'/'l1' se cache
  
  -- Metadados
  confidence NUMERIC(3, 2),
  user_email TEXT,              -- opcional: rastrear usuário
  origin VARCHAR(50),           -- MODAL, API, etc
  
  -- Timestamp
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Index para performance
  INDEX idx_geocoding_audit_date (created_at),
  INDEX idx_geocoding_audit_cache_hit (cache_hit),
  INDEX idx_geocoding_audit_provider (provider)
);

-- =====================
-- ETAPA 2: POPULAR CONFIGS
-- =====================

-- 2.1) Inserir custos por provider
INSERT INTO public.provider_costs (provider, custo_usd_por_request, descricao) VALUES
  ('locationiq', 0.002, 'LocationIQ - $2 por 1000 requests após free tier'),
  ('google', 0.005, 'Google Geocoding API - $5 por 1000 requests'),
  ('mapsco', 0.001, 'Maps.co - $1 por 1000 requests após free tier'),
  ('photon', 0.000, 'Photon OpenStreetMap - Grátis'),
  ('supabase', 0.000, 'Cache L2 Supabase - Sem custo'),
  ('l1', 0.000, 'Cache L1 Script - Sem custo'),
  ('map', 0.000, 'Seleção manual no mapa - Sem custo')
ON CONFLICT (provider) DO UPDATE 
  SET custo_usd_por_request = EXCLUDED.custo_usd_por_request,
      descricao = EXCLUDED.descricao,
      updated_at = NOW();

-- 2.2) Inserir cotação inicial
INSERT INTO public.forex_config (id, cotacao_usd_brl) VALUES (1, 5.00)
ON CONFLICT (id) DO UPDATE SET cotacao_usd_brl = 5.00;

-- =====================
-- ETAPA 3: VIEWS DE ANÁLISE
-- =====================

-- 3.1) VIEW: Economia REAL por dia
CREATE OR REPLACE VIEW vw_economia_real_diaria AS
SELECT 
  DATE(ga.created_at) as data,
  
  -- Contadores
  COUNT(*) as total_requests,
  COUNT(CASE WHEN ga.cache_hit = true THEN 1 END) as cache_hits,
  COUNT(CASE WHEN ga.cache_hit = false THEN 1 END) as api_calls,
  
  -- Taxa de hit
  ROUND(
    COUNT(CASE WHEN ga.cache_hit = true THEN 1 END)::numeric / 
    NULLIF(COUNT(*), 0)::numeric * 100, 
    2
  ) as cache_hit_rate_pct,
  
  -- Custo real gasto (somente API calls)
  ROUND(
    SUM(
      CASE WHEN ga.cache_hit = false 
      THEN COALESCE(pc.custo_usd_por_request, 0.002)
      ELSE 0 
      END
    ),
    4
  ) as custo_real_usd,
  
  -- Custo que TERIA gasto sem cache (todos os requests)
  ROUND(
    SUM(COALESCE(pc.custo_usd_por_request, 0.002)),
    4
  ) as custo_sem_cache_usd,
  
  -- ECONOMIA REAL (diferença)
  ROUND(
    SUM(
      CASE WHEN ga.cache_hit = true 
      THEN COALESCE(pc.custo_usd_por_request, 0.002)
      ELSE 0 
      END
    ),
    4
  ) as economia_real_usd,
  
  -- Converter para BRL
  ROUND(
    SUM(
      CASE WHEN ga.cache_hit = true 
      THEN COALESCE(pc.custo_usd_por_request, 0.002)
      ELSE 0 
      END
    ) * fx.cotacao_usd_brl,
    2
  ) as economia_real_brl

FROM public.geocoding_audit ga
LEFT JOIN public.provider_costs pc ON ga.provider = pc.provider
CROSS JOIN public.forex_config fx
GROUP BY DATE(ga.created_at), fx.cotacao_usd_brl
ORDER BY data DESC;

-- 3.2) VIEW: Economia por provider
CREATE OR REPLACE VIEW vw_economia_por_provider AS
SELECT 
  DATE(ga.created_at) as data,
  ga.provider,
  
  COUNT(*) as total_requests,
  COUNT(CASE WHEN ga.cache_hit = true THEN 1 END) as cache_hits,
  COUNT(CASE WHEN ga.cache_hit = false THEN 1 END) as api_calls,
  
  ROUND(
    COUNT(CASE WHEN ga.cache_hit = true THEN 1 END)::numeric / 
    NULLIF(COUNT(*), 0)::numeric * 100, 
    2
  ) as cache_hit_rate_pct,
  
  COALESCE(pc.custo_usd_por_request, 0.002) as custo_unitario_usd,
  
  -- Custo real gasto
  ROUND(
    COUNT(CASE WHEN ga.cache_hit = false THEN 1 END) * 
    COALESCE(pc.custo_usd_por_request, 0.002),
    4
  ) as custo_real_usd,
  
  -- Economia real
  ROUND(
    COUNT(CASE WHEN ga.cache_hit = true THEN 1 END) * 
    COALESCE(pc.custo_usd_por_request, 0.002),
    4
  ) as economia_real_usd,
  
  ROUND(
    COUNT(CASE WHEN ga.cache_hit = true THEN 1 END) * 
    COALESCE(pc.custo_usd_por_request, 0.002) * fx.cotacao_usd_brl,
    2
  ) as economia_real_brl

FROM public.geocoding_audit ga
LEFT JOIN public.provider_costs pc ON ga.provider = pc.provider
CROSS JOIN public.forex_config fx
GROUP BY DATE(ga.created_at), ga.provider, pc.custo_usd_por_request, fx.cotacao_usd_brl
ORDER BY data DESC, total_requests DESC;

-- 3.3) VIEW: Totalizador mensal (para scorecards)
CREATE OR REPLACE VIEW vw_economia_mensal AS
SELECT 
  DATE_TRUNC('month', ga.created_at) as mes,
  
  COUNT(*) as total_requests,
  COUNT(CASE WHEN ga.cache_hit = true THEN 1 END) as cache_hits,
  COUNT(CASE WHEN ga.cache_hit = false THEN 1 END) as api_calls,
  
  ROUND(
    COUNT(CASE WHEN ga.cache_hit = true THEN 1 END)::numeric / 
    NULLIF(COUNT(*), 0)::numeric * 100, 
    2
  ) as cache_hit_rate_pct,
  
  ROUND(
    SUM(
      CASE WHEN ga.cache_hit = false 
      THEN COALESCE(pc.custo_usd_por_request, 0.002)
      ELSE 0 
      END
    ),
    2
  ) as custo_real_usd,
  
  ROUND(
    SUM(
      CASE WHEN ga.cache_hit = true 
      THEN COALESCE(pc.custo_usd_por_request, 0.002)
      ELSE 0 
      END
    ),
    2
  ) as economia_real_usd,
  
  ROUND(
    SUM(
      CASE WHEN ga.cache_hit = true 
      THEN COALESCE(pc.custo_usd_por_request, 0.002)
      ELSE 0 
      END
    ) * fx.cotacao_usd_brl,
    2
  ) as economia_real_brl

FROM public.geocoding_audit ga
LEFT JOIN public.provider_costs pc ON ga.provider = pc.provider
CROSS JOIN public.forex_config fx
GROUP BY DATE_TRUNC('month', ga.created_at), fx.cotacao_usd_brl
ORDER BY mes DESC;

-- 3.4) VIEW: Últimos 30 dias (agregado para scorecards)
CREATE OR REPLACE VIEW vw_economia_ultimos_30_dias AS
SELECT 
  COUNT(*) as total_requests,
  COUNT(CASE WHEN ga.cache_hit = true THEN 1 END) as cache_hits,
  COUNT(CASE WHEN ga.cache_hit = false THEN 1 END) as api_calls,
  
  ROUND(
    COUNT(CASE WHEN ga.cache_hit = true THEN 1 END)::numeric / 
    NULLIF(COUNT(*), 0)::numeric * 100, 
    2
  ) as cache_hit_rate_pct,
  
  ROUND(
    SUM(
      CASE WHEN ga.cache_hit = false 
      THEN COALESCE(pc.custo_usd_por_request, 0.002)
      ELSE 0 
      END
    ),
    2
  ) as custo_real_usd,
  
  ROUND(
    SUM(
      CASE WHEN ga.cache_hit = true 
      THEN COALESCE(pc.custo_usd_por_request, 0.002)
      ELSE 0 
      END
    ),
    2
  ) as economia_real_usd,
  
  ROUND(
    SUM(
      CASE WHEN ga.cache_hit = true 
      THEN COALESCE(pc.custo_usd_por_request, 0.002)
      ELSE 0 
      END
    ) * fx.cotacao_usd_brl,
    2
  ) as economia_real_brl

FROM public.geocoding_audit ga
LEFT JOIN public.provider_costs pc ON ga.provider = pc.provider
CROSS JOIN public.forex_config fx
WHERE ga.created_at >= NOW() - INTERVAL '30 days';

-- 3.5) VIEW: Análise de endereços mais reutilizados (TOP cache hits)
CREATE OR REPLACE VIEW vw_top_enderecos_cacheados AS
SELECT 
  ga.chave_endereco,
  MAX(ga.endereco_completo) as endereco_completo,
  COUNT(*) as total_buscas,
  COUNT(CASE WHEN ga.cache_hit = true THEN 1 END) as cache_hits,
  MAX(ga.created_at) as ultima_busca,
  
  -- Economia deste endereço
  ROUND(
    COUNT(CASE WHEN ga.cache_hit = true THEN 1 END) * 
    AVG(COALESCE(pc.custo_usd_por_request, 0.002)),
    4
  ) as economia_usd

FROM public.geocoding_audit ga
LEFT JOIN public.provider_costs pc ON ga.provider = pc.provider
GROUP BY ga.chave_endereco
HAVING COUNT(*) > 1  -- Somente endereços buscados mais de 1x
ORDER BY cache_hits DESC, total_buscas DESC
LIMIT 100;

-- =====================
-- ETAPA 4: PERMISSIONS
-- =====================

-- Permitir leitura para anon/authenticated (se necessário para Looker Studio)
-- GRANT SELECT ON public.geocoding_audit TO anon, authenticated;
-- GRANT SELECT ON public.provider_costs TO anon, authenticated;
-- GRANT SELECT ON public.forex_config TO anon, authenticated;
-- GRANT SELECT ON vw_economia_real_diaria TO anon, authenticated;
-- GRANT SELECT ON vw_economia_por_provider TO anon, authenticated;
-- GRANT SELECT ON vw_economia_mensal TO anon, authenticated;
-- GRANT SELECT ON vw_economia_ultimos_30_dias TO anon, authenticated;
-- GRANT SELECT ON vw_top_enderecos_cacheados TO anon, authenticated;

-- =====================
-- COMANDOS ÚTEIS
-- =====================

-- Ver economia dos últimos 7 dias:
-- SELECT * FROM vw_economia_real_diaria WHERE data >= CURRENT_DATE - 7;

-- Ver economia total dos últimos 30 dias:
-- SELECT * FROM vw_economia_ultimos_30_dias;

-- Atualizar custo de um provider:
-- UPDATE public.provider_costs SET custo_usd_por_request = 0.0025 WHERE provider = 'locationiq';

-- Atualizar cotação BRL:
-- UPDATE public.forex_config SET cotacao_usd_brl = 5.20 WHERE id = 1;

-- Ver top providers por economia:
-- SELECT provider, SUM(economia_real_brl) as economia_total_brl
-- FROM vw_economia_por_provider 
-- WHERE data >= CURRENT_DATE - 30
-- GROUP BY provider 
-- ORDER BY economia_total_brl DESC;
