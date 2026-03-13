# 🚀 Rastreamento de Performance - Geocoding

## 📊 Objetivo

Rastrear o **tempo de execução (duration)** de cada requisição de geocoding para:
- Calcular tempo médio por provider
- Comparar velocidade: cache vs API call
- Identificar endereços lentos
- Medir melhoria de performance ao longo do tempo
- Calcular tempo total economizado pelo cache

---

## 🔧 IMPLEMENTAÇÃO

### **PASSO 1: Executar SQL no Supabase** (2 min)

1. Acesse **[Supabase Dashboard](https://supabase.com/dashboard)** → seu projeto
2. Menu → **SQL Editor** → **New Query**
3. Abra o arquivo **`supabase-add-duration-tracking.sql`**
4. Copie TODO o conteúdo e cole no SQL Editor
5. Clique em **RUN** (ou F5)

**O que será criado:**
- ✅ Coluna `duration_ms` na tabela `geocoding_audit`
- ✅ 2 índices para performance de queries
- ✅ 5 novas views de análise

**Verificar se deu certo:**
```sql
-- Deve retornar a coluna duration_ms
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'geocoding_audit' 
  AND column_name = 'duration_ms';

-- Deve retornar as 5 novas views
SELECT table_name 
FROM information_schema.views 
WHERE table_schema = 'public' 
  AND table_name LIKE 'vw_performance%';
```

---

### **PASSO 2: Código Apps Script** (já implementado ✅)

O código **já foi atualizado automaticamente** em `CEP-APIBACK.gs`:

**Modificações aplicadas:**

1. **Cronômetro iniciado** no início da função:
```javascript
function ResolverEnderecoComCache_(form, origin) {
  var startTime = Date.now(); // ⏱️ Iniciar cronômetro
  // ...
}
```

2. **Duração calculada e registrada** em 3 pontos:

**Cache L1 hit:**
```javascript
var duration = Date.now() - startTime;
RegistrarGeocodingAudit_(hashKey, addrDisplay, true, 'l1', objL1.confidence || 1.0, origin, duration);
```

**Cache Supabase hit:**
```javascript
var duration = Date.now() - startTime;
RegistrarGeocodingAudit_(hashKey, addrDisplay, true, 'supabase', L2Obj.confidence, origin, duration);
```

**API call (cache miss):**
```javascript
var duration = Date.now() - startTime;
RegistrarGeocodingAudit_(hashKey, addrDisplay, false, geoOut.provider, geoOut.confidence, origin, duration);
```

3. **Função de auditoria atualizada:**
```javascript
function RegistrarGeocodingAudit_(hashKey, addrDisplay, cacheHit, provider, confidence, origin, durationMs) {
  // ...
  var payload = {
    // ... outros campos
    duration_ms: durationMs ? Math.round(durationMs) : null
  };
  // ...
}
```

---

## 📈 ANÁLISES DISPONÍVEIS

### **VIEW 1: `vw_performance_por_provider`**

Mostra performance média de cada provider, separando cache hits de API calls.

```sql
SELECT * FROM vw_performance_por_provider;
```

**Colunas importantes:**
- `provider`: locationiq, photon, l1, supabase
- `cache_hit`: true/false
- `avg_duration_ms`: tempo médio em milissegundos
- `median_duration_ms`: mediana (mais confiável que média)
- `p95_duration_ms`: 95% das requests ficam abaixo desse tempo
- `p99_duration_ms`: 99% das requests ficam abaixo desse tempo

**Exemplo de resultado:**
```
provider    | cache_hit | avg_duration_ms | median_duration_ms | total_requests
------------|-----------|-----------------|--------------------|--------------
l1          | true      | 45.20           | 42.00              | 5,243
supabase    | true      | 1,234.50        | 1,180.00           | 2,156
locationiq  | false     | 2,567.30        | 2,450.00           | 845
photon      | false     | 1,890.40        | 1,820.00           | 234
```

**Interpretação:**
- Cache L1 é ~50x mais rápido que API calls
- Supabase L2 é ~2x mais rápido que APIs externas
- LocationIQ é mais lento que Photon

---

### **VIEW 2: `vw_cache_speedup`**

Compara velocidade cache vs API e calcula o **ganho de performance**.

```sql
SELECT * FROM vw_cache_speedup;
```

**Colunas importantes:**
- `speedup_factor`: quantas vezes o cache é mais rápido
- `time_saved_ms`: tempo economizado por request (ms)
- `time_saved_sec`: tempo economizado por request (segundos)

**Exemplo de resultado:**
```
provider    | avg_cache_ms | avg_api_ms | speedup_factor | time_saved_sec
------------|--------------|------------|----------------|---------------
locationiq  | 640.50       | 2,567.30   | 4.01           | 1.93
photon      | 580.20       | 1,890.40   | 3.26           | 1.31
```

**Interpretação:**
- Cache do LocationIQ é **4x mais rápido** que API
- Economiza **1.93 segundos por request**

---

### **VIEW 3: `vw_performance_diaria`**

Evolução da performance ao longo dos dias.

```sql
SELECT * FROM vw_performance_diaria 
WHERE data >= CURRENT_DATE - 30
ORDER BY data DESC;
```

**Colunas importantes:**
- `data`: dia
- `avg_duration_ms`: tempo médio do dia
- `pct_fast_requests`: % de requests rápidas (< 500ms)
- `pct_slow_requests`: % de requests lentas (> 2000ms)

**Gráfico no Looker Studio:**
- Linha do tempo com `avg_duration_ms`
- Barras empilhadas com `pct_fast_requests` vs `pct_slow_requests`

---

### **VIEW 4: `vw_performance_30_dias`**

Resumo consolidado dos últimos 30 dias.

```sql
SELECT * FROM vw_performance_30_dias;
```

**Métricas importantes:**
- `total_requests`: total de buscas
- `cache_hit_rate_pct`: taxa de cache hit
- `avg_duration_ms`: tempo médio geral
- `avg_cache_duration_ms`: tempo médio do cache
- `avg_api_duration_ms`: tempo médio de API calls
- `time_saved_by_cache_sec`: **tempo total economizado** (segundos)

**Exemplo de resultado:**
```
total_requests: 12,345
cache_hit_rate_pct: 87.5%
avg_duration_ms: 542.30
avg_cache_duration_ms: 412.50
avg_api_duration_ms: 2,234.80
time_saved_by_cache_sec: 19,587.45  (5.44 horas!)
```

**Interpretação:**
- Com 87.5% de cache hit, economizamos **5.44 horas** de tempo de espera
- Sem cache, os usuários esperariam **2.2 segundos** por busca
- Com cache, esperam apenas **0.4 segundos**

---

### **VIEW 5: `vw_enderecos_lentos`**

Top 100 endereços com maior tempo médio.

```sql
SELECT * FROM vw_enderecos_lentos LIMIT 20;
```

**Útil para:**
- Identificar endereços problemáticos
- Investigar por que certos endereços demoram mais
- Otimizar providers para regiões específicas

---

## 📊 DASHBOARD LOOKER STUDIO

### **Scorecard 1: Tempo Médio Geral**

- **Fonte:** `vw_performance_30_dias`
- **Métrica:** `avg_duration_ms`
- **Formato:** Número com 1 casa decimal + " ms"
- **Cor:** Verde se < 500ms, Amarelo se < 1000ms, Vermelho se >= 1000ms

### **Scorecard 2: Tempo Economizado**

- **Fonte:** `vw_performance_30_dias`
- **Métrica:** `time_saved_by_cache_sec`
- **Formato:** Tempo (converter para horas/minutos)
- **Fórmula customizada:**
  ```
  CONCAT(
    FLOOR(time_saved_by_cache_sec / 3600), "h ",
    FLOOR(MOD(time_saved_by_cache_sec, 3600) / 60), "min"
  )
  ```

### **Scorecard 3: Speedup Factor**

- **Fonte:** `vw_cache_speedup`
- **Métrica:** `AVG(speedup_factor)`
- **Formato:** Número com 2 casas decimais + "x"

### **Gráfico 1: Performance por Provider**

- **Tipo:** Barras agrupadas
- **Fonte:** `vw_performance_por_provider`
- **Dimensão:** `provider`
- **Métricas:**
  - `avg_cache_duration_ms` (Barra azul)
  - `avg_api_duration_ms` (Barra vermelha)
- **Breakdown:** `cache_hit`

### **Gráfico 2: Evolução Temporal**

- **Tipo:** Linha do tempo
- **Fonte:** `vw_performance_diaria`
- **Dimensão de data:** `data`
- **Métricas:**
  - `avg_duration_ms` (Linha principal)
  - `median_duration_ms` (Linha secundária tracejada)
- **Período:** Últimos 30 dias

### **Gráfico 3: Distribuição de Velocidade**

- **Tipo:** Pizza (ou Donut)
- **Fonte:** `vw_performance_diaria` (agregado)
- **Métricas:**
  - % Fast (< 500ms)
  - % Medium (500-2000ms)
  - % Slow (> 2000ms)

### **Tabela 1: Top Endereços Lentos**

- **Fonte:** `vw_enderecos_lentos`
- **Colunas:**
  - `endereco_completo`
  - `provider`
  - `avg_duration_ms`
  - `total_buscas`
- **Limite:** 20 linhas
- **Ordenação:** `avg_duration_ms` DESC

---

## 🎯 MÉTRICAS-CHAVE PARA ACOMPANHAR

### **1. Tempo Médio por Tipo**
```sql
SELECT 
  CASE 
    WHEN cache_hit THEN 'Cache Hit'
    ELSE 'API Call'
  END as tipo,
  ROUND(AVG(duration_ms), 2) as tempo_medio_ms
FROM geocoding_audit
WHERE created_at >= NOW() - INTERVAL '30 days'
  AND duration_ms IS NOT NULL
GROUP BY cache_hit;
```

**Meta:** Cache < 500ms, API < 2500ms

---

### **2. Evolução Mensal**
```sql
SELECT 
  TO_CHAR(created_at, 'YYYY-MM') as mes,
  ROUND(AVG(duration_ms), 2) as avg_ms,
  COUNT(*) as total_requests
FROM geocoding_audit
WHERE duration_ms IS NOT NULL
GROUP BY TO_CHAR(created_at, 'YYYY-MM')
ORDER BY mes DESC;
```

**Análise:** Verificar se o tempo médio está **diminuindo** ao longo dos meses (indicador de melhoria)

---

### **3. Requests Muito Lentas (> 5 segundos)**
```sql
SELECT COUNT(*) as total_lentas,
       ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM geocoding_audit), 2) as percentual
FROM geocoding_audit
WHERE duration_ms > 5000;
```

**Meta:** < 1% das requests devem ser muito lentas

---

## 🔥 INSIGHTS E AÇÕES

### **Se tempo médio > 1 segundo:**
- ✅ Verificar se providers externos estão lentos
- ✅ Considerar adicionar mais camadas de cache
- ✅ Analisar se há timeouts ou retries

### **Se cache L1 > 200ms:**
- ⚠️ Possível problema: serialização/deserialização de objetos grandes
- ✅ Revisar estrutura de dados no cache

### **Se Supabase L2 > 1.5 segundos:**
- ⚠️ Possível problema: latência de rede ou índices faltando
- ✅ Verificar índices na tabela `geo_cache`
- ✅ Considerar region do Supabase mais próxima

### **Se LocationIQ > 3 segundos:**
- ⚠️ Possível problema: quota/throttling da API
- ✅ Verificar plano do LocationIQ
- ✅ Considerar usar Photon como fallback prioritário

---

## 📊 QUERY AVANÇADA: ROI de Performance

Comparar **custo** vs **tempo economizado**:

```sql
SELECT 
  -- Custo total
  SUM(CASE WHEN cache_hit = false THEN pc.custo_usd_por_request ELSE 0 END) * fc.cotacao_usd_brl as custo_total_brl,
  
  -- Tempo economizado (horas)
  SUM(CASE WHEN cache_hit = true THEN 
    (SELECT AVG(duration_ms) FROM geocoding_audit WHERE cache_hit = false) - duration_ms 
  ELSE 0 END) / 1000 / 3600 as tempo_economizado_horas,
  
  -- Valor monetário do tempo (assumindo R$50/hora)
  (SUM(CASE WHEN cache_hit = true THEN 
    (SELECT AVG(duration_ms) FROM geocoding_audit WHERE cache_hit = false) - duration_ms 
  ELSE 0 END) / 1000 / 3600) * 50 as valor_tempo_economizado_brl

FROM geocoding_audit ga
LEFT JOIN provider_costs pc ON ga.provider = pc.provider
CROSS JOIN forex_config fc
WHERE ga.created_at >= NOW() - INTERVAL '30 days'
  AND ga.duration_ms IS NOT NULL;
```

**Interpretação:**
- Se gastamos R$100 em APIs mas economizamos 10 horas (R$500 de tempo), o ROI é **5x**

---

## ✅ CHECKLIST FINAL

- [ ] SQL `supabase-add-duration-tracking.sql` executado no Supabase
- [ ] Coluna `duration_ms` existe na tabela `geocoding_audit`
- [ ] 5 views de performance criadas
- [ ] Código `CEP-APIBACK.gs` atualizado (já feito ✅)
- [ ] Teste: fazer uma busca e verificar se `duration_ms` aparece na tabela
- [ ] Looker Studio conectado às novas views
- [ ] Dashboard com scorecards e gráficos criado
- [ ] Alertas configurados para requests > 5 segundos

---

## 🚀 PRÓXIMOS PASSOS RECOMENDADOS

1. **Alertas Proativos:**
   - Configurar alerta se tempo médio > 1 segundo por 3 dias consecutivos
   - Notificar se % de requests lentas > 5%

2. **Análise de Correlação:**
   - Verificar se endereços rurais são mais lentos
   - Analisar se há horário de pico com maior latência

3. **A/B Testing:**
   - Testar diferentes providers para mesma região
   - Medir qual provider é mais rápido por UF

4. **Cache Warm-up:**
   - Pré-carregar endereços populares no cache
   - Reduzir API calls de endereços frequentes

**Dúvidas?** Consulte este guia ou a documentação do Supabase.
