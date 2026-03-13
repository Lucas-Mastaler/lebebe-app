# 🎯 Implementação: Economia REAL de Cache com Looker Studio

## 📋 Visão Geral

Este sistema registra **cada busca de geocoding** e rastreia se veio do cache ou chamou API externa, permitindo calcular **economia verdadeira** em R$ (BRL).

### O que muda?
- ❌ **Antes:** Estimativa genérica baseada em endereços cacheados
- ✅ **Agora:** Rastreamento real de cache hits vs API calls com custo por provider

---

## 🚀 PASSO A PASSO DE IMPLEMENTAÇÃO

### **ETAPA 1: Executar SQL no Supabase** (5 minutos)

1. Acesse seu projeto no **[Supabase Dashboard](https://supabase.com/dashboard)**
2. Menu lateral → **SQL Editor**
3. Clique em **New Query**
4. Abra o arquivo `supabase-cache-analytics-real.sql` neste projeto
5. Copie e cole **TODO o conteúdo** no SQL Editor
6. Clique em **RUN** (ou pressione F5)
7. ✅ Confirme que foram criados:
   - **3 tabelas:**
     - `public.provider_costs` (custos por provider)
     - `public.forex_config` (cotação USD→BRL)
     - `public.geocoding_audit` ⭐ (tabela de rastreamento)
   - **5 views:**
     - `vw_economia_real_diaria`
     - `vw_economia_por_provider`
     - `vw_economia_mensal`
     - `vw_economia_ultimos_30_dias`
     - `vw_top_enderecos_cacheados`

**Verificar se deu certo:**
```sql
-- Deve retornar as 3 tabelas
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('provider_costs', 'forex_config', 'geocoding_audit');

-- Deve retornar os custos configurados
SELECT * FROM public.provider_costs ORDER BY provider;
```

---

### **ETAPA 2: Integrar Apps Script** (10 minutos)

#### 2.1) Adicionar função de auditoria

No arquivo **`CEP-APIBACK.gs`**, adicione no **final do arquivo** (antes da última linha):

```javascript
// Cole a função RegistrarGeocodingAudit_ do arquivo CACHE-AUDIT-INTEGRATION.gs
```

Copie da linha 12 até linha 57 do arquivo `CACHE-AUDIT-INTEGRATION.gs`.

#### 2.2) Substituir função ResolverEnderecoComCache_

**ATENÇÃO:** Você precisa substituir a função `ResolverEnderecoComCache_` existente pela versão modificada que inclui auditoria.

**Localização atual:** `CEP-APIBACK.gs`, linha ~2513

**Como fazer:**
1. Localize a função `function ResolverEnderecoComCache_(form, origin) {`
2. Delete a função inteira (até o fechamento do último `}`)
3. Cole a nova versão do arquivo `CACHE-AUDIT-INTEGRATION.gs` (linhas 64-210)

**As modificações incluem 3 chamadas novas:**
- Linha após `HIT_L1`: `RegistrarGeocodingAudit_(hashKey, addrDisplay, true, 'l1', ...)`
- Linha após `HIT_SUPABASE`: `RegistrarGeocodingAudit_(hashKey, addrDisplay, true, 'supabase', ...)`
- Linha após `geoOut` (API call): `RegistrarGeocodingAudit_(hashKey, addrDisplay, false, geoOut.provider, ...)`

#### 2.3) Adicionar funções auxiliares (se necessário)

Se as funções `getSupabaseUrl_()` e `getSupabaseKey_()` ainda não existirem, adicione no final:

```javascript
// Cole as linhas 212-234 do arquivo CACHE-AUDIT-INTEGRATION.gs
```

#### 2.4) Testar integração

1. No Apps Script, vá em **Executar** → selecione alguma função de teste
2. Faça uma busca manual no modal
3. Verifique os logs: `Visualizar` → `Execuções`
4. Procure por: `[AUDIT] ✅ Registrado: cache_hit=...`

**Verificar no Supabase:**
```sql
SELECT * FROM public.geocoding_audit ORDER BY created_at DESC LIMIT 10;
```

Se retornar linhas, **está funcionando!** ✅

---

### **ETAPA 3: Conectar Looker Studio** (15 minutos)

#### 3.1) Criar conexão PostgreSQL

1. Acesse **[Looker Studio](https://lookerstudio.google.com/)**
2. Clique em **Create** → **Data Source**
3. Busque e selecione **"PostgreSQL"**
4. Preencha os dados de conexão:

```
Host: [SEU-PROJETO].supabase.co
Port: 5432
Database: postgres
Username: postgres
Password: [SUA-SENHA-SUPABASE]
```

**Onde encontrar:**
- Supabase Dashboard → **Settings** → **Database**
- Copie o "Connection string" (formato: `postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres`)

5. ✅ Marque **"Enable SSL"**
6. Clique em **AUTHENTICATE**

#### 3.2) Adicionar Views como Fontes de Dados

**Método 1 - Custom Query (recomendado):**

Para cada view, crie uma fonte de dados separada:

1. Após conectar, clique em **"CUSTOM QUERY"**
2. Cole a query:
   ```sql
   SELECT * FROM vw_economia_ultimos_30_dias
   ```
3. Clique em **ADD**
4. Renomeie para **"Economia 30 Dias"**

**Repita para cada view:**
- `vw_economia_real_diaria` → "Economia Diária"
- `vw_economia_por_provider` → "Economia por Provider"
- `vw_economia_mensal` → "Economia Mensal"
- `vw_top_enderecos_cacheados` → "Top Endereços"

**Método 2 - Tabela direta:**

Alguns conectores permitem selecionar views diretamente na lista de tabelas.

---

### **ETAPA 4: Criar Dashboard** (20 minutos)

#### 4.1) Criar relatório

1. Looker Studio → **Create** → **Report**
2. Selecione a fonte **"Economia 30 Dias"**

#### 4.2) Página 1 - Overview (Scorecards)

Adicione 5 **Scorecards** com estas métricas:

| Métrica | Fonte | Campo | Formato |
|---------|-------|-------|---------|
| **Total de Requests** | Economia 30 Dias | `total_requests` | Número |
| **Cache Hit Rate** | Economia 30 Dias | `cache_hit_rate_pct` | Porcentagem |
| **Economia Real (R$)** | Economia 30 Dias | `economia_real_brl` | Moeda (BRL) |
| **Custo Real Gasto** | Economia 30 Dias | `custo_real_usd` | Moeda (USD) |
| **API Calls Evitadas** | Economia 30 Dias | `cache_hits` | Número |

**Dica:** Configure cores:
- Verde para `economia_real_brl`
- Vermelho para `custo_real_usd`

#### 4.3) Página 1 - Gráfico de linha (Evolução Diária)

1. Adicione **Time series chart**
2. Fonte: **"Economia Diária"**
3. Configuração:
   - **Dimensão de data:** `data`
   - **Métrica 1:** `economia_real_brl` (linha verde)
   - **Métrica 2:** `cache_hit_rate_pct` (linha azul, eixo direito)
   - **Período:** últimos 30 dias

#### 4.4) Página 1 - Tabela por Provider

1. Adicione **Table**
2. Fonte: **"Economia por Provider"**
3. Colunas:
   - `provider` (Dimensão)
   - `total_requests`
   - `cache_hits`
   - `cache_hit_rate_pct`
   - `economia_real_brl`
4. Ordenar por: `economia_real_brl` DESC
5. Filtro: `data >= CURRENT_DATE - 30`

#### 4.5) Página 2 - Análise Mensal

1. Adicione **Bar chart**
2. Fonte: **"Economia Mensal"**
3. Configuração:
   - **Dimensão:** `mes` (formato MM/YYYY)
   - **Métrica:** `economia_real_brl`
   - **Cor:** Gradiente verde

#### 4.6) Página 2 - Top Endereços Reutilizados

1. Adicione **Table**
2. Fonte: **"Top Endereços"**
3. Colunas:
   - `endereco_completo`
   - `total_buscas`
   - `cache_hits`
   - `economia_usd`
4. Limite: 20 linhas

#### 4.7) Adicionar Filtros Interativos

1. **Date range control:**
   - Menu → **Add a control** → **Date range**
   - Conecte ao campo `data`
   - Permite filtrar qualquer período

2. **Provider filter:**
   - Menu → **Add a control** → **Drop-down list**
   - Dimensão: `provider`
   - Permite filtrar por provider específico

---

### **ETAPA 5: Configurar Atualização Automática** ✅

#### Frequência de atualização

1. No relatório, clique em **Resource** → **Manage added data sources**
2. Para cada fonte, clique em **EDIT**
3. Em **Data Freshness**, selecione:
   - **15 minutes** (para dados em tempo real)
   - **1 hour** (para economizar quota)
4. Salve

#### Refresh manual

- Botão **"Refresh data"** no canto superior direito
- Atualiza todas as fontes do relatório

---

## 📊 EXEMPLO DE DASHBOARD COMPLETO

```
┌─────────────────────────────────────────────────────────┐
│  ECONOMIA DE CACHE - GEOCODING                          │
│  Período: [Últimos 30 dias ▼]                           │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐   │
│  │  12,345 │  │  87.5%  │  │ R$123.45│  │ $12.34  │   │
│  │ Requests│  │Cache Hit│  │ Economia│  │  Custo  │   │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘   │
│                                                           │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Evolução Diária (R$)          [Linha do tempo] │   │
│  └─────────────────────────────────────────────────┘   │
│                                                           │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Provider    | Requests | Hits | Rate | Economia │   │
│  ├─────────────────────────────────────────────────┤   │
│  │ locationiq  |   8,500  | 7,200| 84.7%|  R$72.00│   │
│  │ photon      |   2,800  | 2,400| 85.7%|  R$ 0.00│   │
│  │ supabase    |   1,045  | 1,045|100.0%|  R$ 0.00│   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## 🔧 MANUTENÇÃO E AJUSTES

### Atualizar custo de um provider

```sql
UPDATE public.provider_costs 
SET custo_usd_por_request = 0.0025,
    updated_at = NOW()
WHERE provider = 'locationiq';
```

### Atualizar cotação BRL

```sql
UPDATE public.forex_config 
SET cotacao_usd_brl = 5.20,
    updated_at = NOW()
WHERE id = 1;
```

### Adicionar novo provider

```sql
INSERT INTO public.provider_costs (provider, custo_usd_por_request, descricao)
VALUES ('openstreetmap', 0.000, 'OpenStreetMap - Grátis');
```

### Limpar dados antigos (opcional)

```sql
-- Deletar audits com mais de 180 dias
DELETE FROM public.geocoding_audit 
WHERE created_at < NOW() - INTERVAL '180 days';
```

---

## 📈 MÉTRICAS IMPORTANTES

### Cache Hit Rate (%)
- **Bom:** > 80%
- **Médio:** 60-80%
- **Ruim:** < 60%

### Economia Mensal Esperada
- Com 10k requests/mês e 80% cache hit:
  - LocationIQ: 8k hits × $0.002 = **$16.00 (~R$80.00)**
  - Google: 8k hits × $0.005 = **$40.00 (~R$200.00)**

### ROI do Cache
```
ROI = (Economia Real / Custo Supabase) × 100
```

Se Supabase custa R$10/mês e economia é R$80/mês:
```
ROI = (80 / 10) × 100 = 800%
```

---

## ❓ TROUBLESHOOTING

### "Tabela geocoding_audit não encontrada"
- Execute novamente o SQL no Supabase
- Verifique se está no schema `public`

### "Permission denied for table geocoding_audit"
- Execute os comandos GRANT no final do SQL:
```sql
GRANT SELECT ON public.geocoding_audit TO anon, authenticated;
GRANT INSERT ON public.geocoding_audit TO anon, authenticated;
```

### "Apps Script não está registrando audits"
- Verifique logs: `[AUDIT]` deve aparecer
- Confirme se `SUPABASE_URL` e `SUPABASE_KEY` estão configurados
- Teste chamando `RegistrarGeocodingAudit_()` manualmente

### "Looker Studio não conecta ao Supabase"
- Verifique se SSL está habilitado
- Teste conexão com `psql` ou DBeaver primeiro
- Confirme senha do postgres no Supabase Settings

---

## ✅ CHECKLIST FINAL

- [ ] SQL executado no Supabase (3 tabelas + 5 views criadas)
- [ ] Função `RegistrarGeocodingAudit_` adicionada ao Apps Script
- [ ] Função `ResolverEnderecoComCache_` substituída pela versão nova
- [ ] Teste manual: busca gera linha em `geocoding_audit`
- [ ] Looker Studio conectado ao PostgreSQL do Supabase
- [ ] 5 fontes de dados criadas (views)
- [ ] Dashboard com scorecards, gráficos e tabelas
- [ ] Filtros de data e provider adicionados
- [ ] Atualização automática configurada (15min ou 1h)

**Pronto!** Agora você tem rastreamento real de economia de cache em tempo real. 🎉

---

## 📞 PRÓXIMOS PASSOS RECOMENDADOS

1. **Alertas:** Configure alerta no Looker Studio se cache hit rate < 70%
2. **Exportação:** Crie relatório mensal PDF automático
3. **API Webhook:** Integre com Slack/Discord para notificar economia diária
4. **Machine Learning:** Analise padrões de endereços mais buscados para otimizar cache

**Dúvidas?** Releia este documento ou consulte a documentação do Supabase/Looker Studio.
