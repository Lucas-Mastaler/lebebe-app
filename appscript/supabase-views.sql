-- =========================================
-- VIEWS PARA LOOKER STUDIO
-- Execute estas queries no SQL Editor do Supabase
-- =========================================

-- 1️⃣ VIEW: Análise de Bairros Atendidos
CREATE OR REPLACE VIEW vw_bairros_atendidos AS
SELECT 
  bairro,
  cidade,
  uf,
  COUNT(*) as total_buscas,
  COUNT(DISTINCT DATE(created_at)) as dias_ativos,
  AVG(confidence) as confianca_media,
  MIN(created_at) as primeira_busca,
  MAX(created_at) as ultima_busca
FROM geo_cache_addresses
WHERE bairro IS NOT NULL AND bairro != ''
GROUP BY bairro, cidade, uf
ORDER BY total_buscas DESC;

-- 2️⃣ VIEW: Análise de Performance Geocoding
CREATE OR REPLACE VIEW vw_performance_geocoding AS
SELECT 
  DATE(created_at) as data,
  provider,
  COUNT(*) as total_requests,
  AVG(confidence) as confianca_media,
  COUNT(CASE WHEN confidence >= 0.8 THEN 1 END) as alta_confianca,
  COUNT(CASE WHEN confidence < 0.8 THEN 1 END) as baixa_confianca,
  ROUND(COUNT(CASE WHEN confidence >= 0.8 THEN 1 END)::numeric / COUNT(*)::numeric * 100, 2) as taxa_sucesso_pct
FROM geo_cache_addresses
WHERE created_at >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY DATE(created_at), provider
ORDER BY data DESC, provider;

-- 3️⃣ VIEW: Mapa de Calor (Coordenadas)
CREATE OR REPLACE VIEW vw_mapa_calor AS
SELECT 
  lat,
  lng,
  endereco_completo,
  bairro,
  cidade,
  cep,
  COUNT(*) as frequencia,
  MAX(created_at) as ultima_busca
FROM geo_cache_addresses
WHERE lat IS NOT NULL AND lng IS NOT NULL
GROUP BY lat, lng, endereco_completo, bairro, cidade, cep
ORDER BY frequencia DESC;

-- 4️⃣ VIEW: Top Logradouros (Ruas mais buscadas)
CREATE OR REPLACE VIEW vw_top_logradouros AS
SELECT 
  logradouro,
  bairro,
  cidade,
  COUNT(*) as total_buscas,
  COUNT(DISTINCT cep) as ceps_unicos,
  AVG(confidence) as confianca_media
FROM geo_cache_addresses
WHERE logradouro IS NOT NULL AND logradouro != ''
GROUP BY logradouro, bairro, cidade
ORDER BY total_buscas DESC
LIMIT 100;

-- 5️⃣ VIEW: Evolução Temporal (últimos 90 dias)
CREATE OR REPLACE VIEW vw_evolucao_temporal AS
SELECT 
  DATE(created_at) as data,
  COUNT(*) as total_buscas,
  COUNT(DISTINCT bairro) as bairros_unicos,
  COUNT(DISTINCT cidade) as cidades_unicas,
  AVG(confidence) as confianca_media,
  COUNT(CASE WHEN provider = 'locationiq' THEN 1 END) as locationiq,
  COUNT(CASE WHEN provider = 'photon' THEN 1 END) as photon,
  COUNT(CASE WHEN provider = 'mapsco' THEN 1 END) as mapsco
FROM geo_cache_addresses
WHERE created_at >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY DATE(created_at)
ORDER BY data DESC;

-- 6️⃣ VIEW: Distribuição por CEP (Top 50)
CREATE OR REPLACE VIEW vw_distribuicao_cep AS
SELECT 
  cep,
  bairro,
  cidade,
  COUNT(*) as total_buscas,
  AVG(lat) as lat_media,
  AVG(lng) as lng_media
FROM geo_cache_addresses
WHERE cep IS NOT NULL AND cep != ''
GROUP BY cep, bairro, cidade
ORDER BY total_buscas DESC
LIMIT 50;

-- 7️⃣ VIEW: Análise de Cache (simulação - precisa de tabela de audit)
-- Esta view mostra estimativa de economia com cache
CREATE OR REPLACE VIEW vw_cache_stats AS
SELECT 
  DATE(created_at) as data,
  COUNT(*) as total_enderecos_cacheados,
  COUNT(DISTINCT bairro) as bairros_unicos,
  -- Estimativa: cada hit de cache economiza ~0.002 USD (LocationIQ)
  -- Converter para BRL com taxa fixa (ajuste conforme necessário)
  ROUND(COUNT(*) * 0.002 * 5.00, 2) as economia_estimada_brl
FROM geo_cache_addresses
GROUP BY DATE(created_at)
ORDER BY data DESC;

-- 8️⃣ VIEW: Volume por Hora do Dia (últimos 30 dias)
CREATE OR REPLACE VIEW vw_volume_por_hora AS
SELECT
  DATE(created_at) as data,
  EXTRACT(HOUR FROM created_at) as hora,
  COUNT(*) as total_buscas,
  COUNT(DISTINCT bairro) as bairros_unicos,
  AVG(confidence) as confianca_media
FROM geo_cache_addresses
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at), EXTRACT(HOUR FROM created_at)
ORDER BY data DESC, hora ASC;

-- 9️⃣ VIEW: Volume por Dia da Semana (últimos 90 dias)
-- 0=domingo, 1=segunda, ..., 6=sábado
CREATE OR REPLACE VIEW vw_volume_por_dia_semana AS
SELECT
  EXTRACT(DOW FROM created_at) as dia_semana,
  COUNT(*) as total_buscas,
  COUNT(DISTINCT bairro) as bairros_unicos,
  AVG(confidence) as confianca_media
FROM geo_cache_addresses
WHERE created_at >= NOW() - INTERVAL '90 days'
GROUP BY EXTRACT(DOW FROM created_at)
ORDER BY dia_semana;

-- 🔟 VIEW: Distribuição por Faixas de Confiança (últimos 90 dias)
CREATE OR REPLACE VIEW vw_confidence_buckets AS
SELECT
  DATE(created_at) as data,
  CASE
    WHEN confidence >= 0.90 THEN '0.90-1.00'
    WHEN confidence >= 0.80 THEN '0.80-0.89'
    WHEN confidence >= 0.70 THEN '0.70-0.79'
    WHEN confidence >= 0.60 THEN '0.60-0.69'
    ELSE '<0.60'
  END as faixa_confianca,
  COUNT(*) as total
FROM geo_cache_addresses
WHERE created_at >= NOW() - INTERVAL '90 days'
GROUP BY DATE(created_at), faixa_confianca
ORDER BY data DESC, faixa_confianca;

-- 1️⃣1️⃣ VIEW: Share de Providers (últimos 30 dias)
CREATE OR REPLACE VIEW vw_provider_share AS
SELECT
  DATE(created_at) as data,
  provider,
  COUNT(*) as total,
  ROUND(COUNT(*)::numeric / SUM(COUNT(*)) OVER (PARTITION BY DATE(created_at)) * 100, 2) as share_pct,
  AVG(confidence) as confianca_media
FROM geo_cache_addresses
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at), provider
ORDER BY data DESC, total DESC;

-- 1️⃣2️⃣ VIEW: Últimas Buscas (para tabela no dashboard)
-- Obs: remova/mascare campos se houver preocupação com LGPD.
CREATE OR REPLACE VIEW vw_ultimas_buscas AS
SELECT
  created_at,
  cidade,
  uf,
  bairro,
  logradouro,
  numero,
  cep,
  provider,
  confidence,
  lat,
  lng
FROM geo_cache_addresses
ORDER BY created_at DESC
LIMIT 500;

-- 1️⃣3️⃣ VIEW: Atividade Recente (7 e 30 dias)
CREATE OR REPLACE VIEW vw_atividade_recente AS
SELECT
  DATE(created_at) as data,
  COUNT(*) as total_buscas,
  COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as total_ultimos_7_dias,
  COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as total_ultimos_30_dias
FROM geo_cache_addresses
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY data DESC;

-- =========================================
-- GRANT PERMISSIONS (se necessário)
-- =========================================
-- Execute isto se o Looker Studio não conseguir ler as views:
-- GRANT SELECT ON vw_bairros_atendidos TO anon, authenticated;
-- GRANT SELECT ON vw_performance_geocoding TO anon, authenticated;
-- GRANT SELECT ON vw_mapa_calor TO anon, authenticated;
-- GRANT SELECT ON vw_top_logradouros TO anon, authenticated;
-- GRANT SELECT ON vw_evolucao_temporal TO anon, authenticated;
-- GRANT SELECT ON vw_distribuicao_cep TO anon, authenticated;
-- GRANT SELECT ON vw_cache_stats TO anon, authenticated;
-- GRANT SELECT ON vw_volume_por_hora TO anon, authenticated;
-- GRANT SELECT ON vw_volume_por_dia_semana TO anon, authenticated;
-- GRANT SELECT ON vw_confidence_buckets TO anon, authenticated;
-- GRANT SELECT ON vw_provider_share TO anon, authenticated;
-- GRANT SELECT ON vw_ultimas_buscas TO anon, authenticated;
-- GRANT SELECT ON vw_atividade_recente TO anon, authenticated;
