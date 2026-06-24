# Mapeamento da Agenda Real (`shAg`) — Motor v2

> **Data:** 15 de junho de 2026
> **Agente:** Cascade
> **Status:** Planejamento — sem implementação
> **Propósito:** Mapear o contrato da planilha AGENDA (`shAg`) usada pelo legado para coletar pontos do dia antes de calcular `kmAdicionalNaRotaM`, orientando futura implementação de parser no v2.
> **Não altera código. Não altera produção.**

---

## 1. Papel da agenda real no legado

A agenda real (`shAg`) é a **segunda fonte de dados** do motor de busca (além de `shAv` = TEMPO DISPONIVEL). Enquanto `shAv` diz **"há tempo disponível"**, `shAg` diz **"onde a equipe já estará naquele dia"**.

Sem `shAg`, o motor não pode:
- Construir a rota existente do dia (`rotaOtimizada`)
- Calcular o custo de inserção do novo destino (`kmAdicionalNaRotaM` / `delta`)
- Determinar o ponto mais próximo (`nearestPoint`)
- Classificar candidatos como normal/especial/premium com base na distância real de inserção

**Disponibilidade real = "há tempo". Agenda real = "há pontos geográficos".** O cálculo de inserção precisa dos dois.

---

## 2. Dados que o legado lê da agenda

| Dado | Descrição | Uso |
|------|-----------|-----|
| Data do evento | Objeto `Date` da planilha | Filtrar pontos do slot (data × equipe) |
| Equipe | String da coluna 7 | Filtrar por `normTeam(disp[i][6]) === slot.team` |
| Título do evento | String da coluna 3 | Identificar cliente/serviço (`eventTitle`) |
| Endereço/Lugar | String da coluna 6 | Endereço principal do ponto de entrega |
| Observações | String da coluna 5 | Fallback de endereço via regex (`ENDEREÇO:`) |
| Coordenadas | Resultado do geocoding/cache | `loc` (lat, lng) usado em rotas e distâncias |
| CEP | Extraído do geocoding ou regex do endereço | Usado para filtro de distância e comparação com depósito |

---

## 3. Colunas/índices usados

A planilha AGENDA é lida com `shAg.getRange(2,1,rowsAg,7).getValues()` (CEP-APIBACK.gs:690):
- **Linha 2 em diante** (linha 1 é cabeçalho)
- **7 colunas** (índices 0 a 6 no array)

| Índice array | Coluna planilha | Nome legado | Uso confirmado |
|--------------|-----------------|-------------|----------------|
| `r[0]` / `disp[i][0]` | Coluna 1 | Data do evento | Filtro por `d.getTime() === slot.date.getTime()` |
| `r[1]` / `disp[i][1]` | Coluna 2 | — | Não usado em `coletarPontosDoDia` |
| `r[2]` / `disp[i][2]` | Coluna 3 | Título / Evento | `eventTitle` (ex: nome do cliente) |
| `r[3]` / `disp[i][3]` | Coluna 4 | — | Não usado em `coletarPontosDoDia` |
| `r[4]` / `disp[i][4]` | Coluna 5 | Observações | Regex de fallback para extrair endereço (`ENDEREÇO:`) |
| `r[5]` / `disp[i][5]` | Coluna 6 | Lugar / Endereço | Endereço principal; se vazio, busca em observações |
| `r[6]` / `disp[i][6]` | Coluna 7 | Equipe | `normTeam(disp[i][6])` → 'EQUIPE 1' / 'EQUIPE 2' |

**Nota:** As colunas 2 e 4 (índices 1 e 3) existem na leitura mas não são usadas por `coletarPontosDoDia`. Podem conter dados de horário, descrição ou outros campos do evento da agenda.

---

## 4. Como o legado identifica data

```javascript
// CEP-APIBACK.gs:690
var agVals = shAg.getRange(2,1,rowsAg,7).getValues();
var agDisp = shAg.getRange(2,1,rowsAg,7).getDisplayValues();
```

Na função `coletarPontosDoDia` (CEP-CONFIG.gs:1606):
```javascript
const d = r[0];
if (!(d instanceof Date) || d.getTime() !== slot.date.getTime()) return;
```

- `r[0]` é o objeto `Date` da planilha
- Comparação por `getTime()` para igualdade exata
- Se não for `Date` ou data diferente do slot → ignora a linha

**Risco:** Timezone da planilha vs servidor pode causar divergência de `getTime()` se as datas não estiverem normalizadas para meio-dia.

---

## 5. Como o legado identifica equipe

```javascript
// CEP-CONFIG.gs:1607
if (normTeam(disp[i][6]) !== slot.team) return;
```

- `disp[i][6]` é a string da coluna 7 (Equipe)
- `normTeam()` normaliza para 'EQUIPE 1' ou 'EQUIPE 2'
- Nomes fora do padrão são descartados silenciosamente (`null`)

**Comportamento:** Ambos os filtros (data + equipe) devem passar para que a linha seja processada.

---

## 6. Como o legado extrai endereço

Dois níveis de extração:

### 6.1 Fonte principal: coluna 6 (`disp[i][5]`)

```javascript
let addr = (disp[i][5] || '').trim();
```

Se a coluna 6 tiver conteúdo → usa diretamente como endereço.

### 6.2 Fonte secundária: coluna 5 (`disp[i][4]` — observações)

Se coluna 6 estiver vazia, aplica regex na coluna 5:

```javascript
const m = (disp[i][4] || '').match(/ENDEREÇO:[^0-9a-zA-Z]*([\s\S]+?)(?:\n\n|\n[A-Z0-9]+:|$)/i);
if (!m) {
  const m2 = (disp[i][4] || '').match(/ENDEREÇO:[^0-9]*(\d+.*?\d{5}-\d{3})/i);
  if (m2) addr = m2[1].trim();
  else return; // sem endereço → descarta ponto
} else {
  addr = m[1].trim();
}
```

**Regex 1:** `ENDEREÇO:` seguido de qualquer conteúdo até `\n\n`, `\nLETRA_MAIÚSCULA:` ou fim da string.
**Regex 2 (fallback):** `ENDEREÇO:` seguido de número + CEP no formato `#####-###`.

Se nenhum regex encontrar endereço → ponto é **descartado silenciosamente**.

---

## 7. Como o legado extrai CEP

O CEP vem de **duas fontes**, em ordem de prioridade:

### 7.1 Fonte principal: geocoding (cache/provider)

```javascript
var cepDoGeocoding = loc.cep ? String(loc.cep).replace(/\D/g, '') : null;
```

O cache Supabase (`ResolverEnderecoComCache_`) retorna `loc.cep` como string.

### 7.2 Fallback: regex do endereço original

```javascript
var cepMatch = addr.match(/\b(\d{5})-?(\d{3})\b/);
if (cepMatch) cepFallback = cepMatch[1] + cepMatch[2];
```

**CEP final:** `cepDoGeocoding || cepFallback`

**Fonte registrada:** `geocoding` ou `regex_fallback` ou `nenhuma`

---

## 8. Como o legado usa observações para completar endereço

Já detalhado na seção 6.2. Resumo:

- Observações (coluna 5) são **fallback** quando a coluna 6 (Lugar) está vazia
- Busca padrão `ENDEREÇO:` no texto das observações
- Limpa quebras de linha (`\n` → `, `), espaços duplicados, vírgulas múltiplas
- Remove prefixo `ENDEREÇO:` se presente no início
- Se ainda não encontrar endereço → ponto é descartado

---

## 9. Como o legado descarta pontos inválidos

Um ponto é descartado em qualquer um destes casos:

| Condição | Onde | Comportamento |
|----------|------|-------------|
| Data não bate com slot | `coletarPontosDoDia:1606` | `return` (ignora linha) |
| Equipe não bate com slot | `coletarPontosDoDia:1607` | `return` (ignora linha) |
| Sem endereço (col 6 vazia + regex falha) | `coletarPontosDoDia:1615` | `return` (ignora linha) |
| Geocoding falha | `coletarPontosDoDia:1756` | Loga erro, não adiciona a `pts[]` |
| Endereço incompleto (logradouro < 3 chars, cidade < 3 chars, UF ≠ 2 chars) | `coletarPontosDoDia:1697` | Não entra no batch de pré-carregamento |

**Importante:** Pontos sem coordenadas (`loc`) não entram na rota. Isso é crítico — se um ponto válido não for geocodificado, a rota do dia fica incompleta e o delta de inserção pode ser menor do que deveria.

---

## 10. Como o legado geocodifica ou recupera coordenadas

### 10.1 Pipeline de geocoding

```
Endereço textual → mockForm (logradouro, numero, bairro, cidade, uf)
  ↓
NormalizarEnderecoParaCache_(mockForm) → string normalizada
  ↓
_hashEnderecoSemNumero_(normStr) → hash SHA-1
  ↓
ConsultarCacheSupabaseBatch_([hash1, hash2, ...]) → { hash: record }
  ↓
ResolverEnderecoComCache_(mockForm, 'AGENDA', preloadedCache)
  ↓
loc = { lat, lng, cep, enderecoCompleto, provider, ... }
```

### 10.2 Estrutura do objeto `loc` retornado

Confirmado em `coletarPontosDoDia` (linhas 1727–1753):

```javascript
loc = {
  lat: number,
  lng: number,
  cep: string,           // opcional
  enderecoCompleto: string, // display final
  provider: string,      // ex: 'cache', 'geocode', 'nominatim'
  // ... outros campos internos do cache
}
```

### 10.3 Cache Supabase

O legado usa uma tabela no Supabase como cache de geocoding de endereços. A função `ConsultarCacheSupabaseBatch_` faz batch de até 50 hashes por query. Se o cache não tiver o endereço, `ResolverEnderecoComCache_` chama providers externos (nominatim, maps.co, etc.).

**Para o v2:** O geocoding/cache pode ser reutilizado se o Supabase já tiver os endereços da agenda indexados. Alternativa: usar as coordenadas já presentes na planilha se existirem (não confirmado se a agenda tem colunas de lat/lng).

---

## 11. Estrutura final de `pontos[]`

Cada ponto na array retornada por `coletarPontosDoDia` tem:

```javascript
{
  addr: string,        // endereço completo normalizado (display)
  loc: { lat, lng },   // coordenadas do geocoding
  eventTitle: string,  // título do evento (cliente/serviço)
  cep: string,         // CEP normalizado (8 dígitos, sem hífen)
  cepSource: string    // 'geocoding' | 'regex_fallback' | 'nenhuma'
}
```

**Exemplo de uso no motor:**
```javascript
slot.pontos.forEach(function(p) {
  var distReta = haversineKm(p.loc, locNovo);
  // ...
});
```

---

## 12. Como `pontos[]` entra em `rotaOtimizada`

```javascript
// CEP-APIBACK.gs:900
var baseRoute = rotaOtimizada(originLoc, slot.pontos);
```

A função `rotaOtimizada(origin, pontos)` (CEP-CONFIG.gs:1767) faz:

1. **Nearest-neighbor:** Ordena pontos pela menor distância Haversine do ponto atual
2. **2-opt swap:** Otimiza a rota trocando segmentos se reduzir distância OSRM total (max 12 iterações)
3. **Retorna:** `{ km: distânciaTotalOSRM, order: ['DEPÓSITO', addr1, addr2, ...] }`

**Importante:** A otimização usa Haversine para o nearest-neighbor inicial, mas a distância total da rota é calculada com OSRM (`getDrivingKm`). A otimização 2-opt também usa OSRM para comparar custos de troca.

---

## 13. Como `pontos[]` entra no cálculo de delta de inserção

Após `rotaOtimizada`, o motor calcula o melhor ponto de inserção do novo destino:

```javascript
// CEP-APIBACK.gs:1021-1068
var ordered = baseRoute.order.slice(1).map(function(a) {
  return slot.pontos.find(function(p) { return p.addr === a; });
});

for (var i = 0; i <= ordered.length; i++) {
  var prev = i === 0 ? originLoc : ordered[i-1].loc;
  var next = i < ordered.length ? ordered[i].loc : null;

  // Batch OSRM: prev→novo, novo→next, prev→next
  insertionRoutes.push({ from: prev, to: locNovo });
  if (next) {
    insertionRoutes.push({ from: locNovo, to: next });
    insertionRoutes.push({ from: prev, to: next });
  }
}

var insertionDistances = getDrivingKmBatch(insertionRoutes);
// ... calcula incKm = prevNovoKm + novoNextKm - prevNextKm
// bestKm = menor incKm entre todas as posições
```

**Sem `pontos[]`:** `ordered.length = 0`, loop executa 1 iteração (`i=0`), `prev = originLoc`, `next = null`:
- `incKm = OSRM(originLoc, locNovo)`
- `bestKm = distância direta origem → destino`

Isso significa que **slots vazios** (sem pontos) usam distância origem→destino como delta, o que pode classificar o candidato de forma diferente de slots com pontos (onde o delta é o custo marginal de inserção).

---

## 14. Diferenças entre agenda de semana e sábado

### 14.1 Origem da rota

| Dia | Origem | Config legado | Config v2 |
|-----|--------|---------------|-----------|
| Seg–Sex | Depósito | `DEPOSIT_ADDRESS` | `ENDERECO DEPOSITO` |
| Sábado | Casa da equipe | `HOME_SAT_E1` / `HOME_SAT_E2` | `ENDERECO CASA EQP 1/2` |

```javascript
// CEP-APIBACK.gs:889-896
var originAddr = slot.date.getDay() === 6
  ? (slot.team === 'EQUIPE 1' ? HOME_SAT_E1 : HOME_SAT_E2)
  : DEPOSIT_ADDRESS;
```

### 14.2 Limite de distância

```javascript
// CEP-APIBACK.gs:903-905
var limiteKmBase = slot.pontos.length
  ? (MAX_EXTRA_METERS / 1000)
  : (slot.date.getDay() === 6 ? (MAX_SATURDAY_METERS / 1000) : (MAX_WEEKDAY_METERS / 1000));
```

- **Com pontos:** limite base = `MAX_EXTRA_METERS` (mesmo para semana e sábado)
- **Sem pontos (slot vazio):** limite base depende do dia — sábado usa `MAX_SATURDAY_METERS`, semana usa `MAX_WEEKDAY_METERS`

### 14.3 Implicação para o parser

O parser de agenda no v2 não precisa diferenciar semana/sábado na leitura de dados — a diferenciação acontece no **uso** dos pontos (origem da rota e limite base). O parser deve simplesmente retornar os pontos; quem consome decide a origem.

---

## 15. Campos que o v2 precisará representar

### 15.1 Interface proposta para ponto da agenda

```typescript
interface PontoAgendaV2 {
  /** Data do evento (YYYY-MM-DD) */
  dataISO: string

  /** Equipe normalizada: 'EQUIPE 1' | 'EQUIPE 2' */
  equipe: string

  /** Título do evento (cliente/serviço) */
  tituloEvento: string

  /** Endereço completo (display) */
  endereco: string

  /** Coordenadas geocodificadas */
  coordenadas: { lat: number; lng: number }

  /** CEP normalizado (8 dígitos) ou null */
  cep: string | null

  /** Fonte do CEP: 'geocoding' | 'regex_fallback' | 'nenhuma' */
  fonteCep: string

  /** Fonte do endereço: 'LUGAR' (col 6) | 'OBSERVACOES' (col 5 fallback) */
  fonteEndereco: string

  /** Se o ponto foi descartado, motivo */
  descartado?: boolean
  motivoDescarte?: string
}
```

### 15.2 Função proposta para o parser

```typescript
function parsearPontosAgendaDoDiaV2(
  linhasAgenda: LinhaAgendaBrutaV2[],
  dataAlvo: string,       // YYYY-MM-DD
  equipeAlvo: string,      // 'EQUIPE 1' | 'EQUIPE 2'
  cacheGeocoding?: Map<string, CoordenadasV2>
): PontoAgendaV2[]
```

**Requisitos:**
- Não chama APIs externas no teste unitário (recebe cache opcional)
- Retorna pontos válidos + log de descartes
- Não muta dados de entrada
- Data comparada por string YYYY-MM-DD (não por objeto Date)

---

## 16. Riscos se o parser da agenda for incompleto

| Risco | Causa | Impacto |
|-------|-------|---------|
| **Delta subestimado** | Pontos faltando na rota | `kmAdicionalNaRotaM` menor que real → candidato classificado como `normal` quando deveria ser `especial`/`premium` |
| **Delta superestimado** | Pontos inválidos incluídos | `kmAdicionalNaRotaM` maior que real → candidato `indisponivel` ou `premium` quando deveria ser `normal` |
| **Origem errada no sábado** | Parser não diferencia dia da semana | Rota parte do depósito em vez da casa da equipe → distâncias completamente diferentes |
| **Pontos sem coordenadas silenciosos** | Geocoding falha e ponto é omitido | Rota fica incompleta, delta incorreto |
| **TimeZone de data** | Agenda lida como Date object | Filtro de data pode falhar se timezone da planilha ≠ servidor |
| **Regex de endereço incompleto** | Observações com formato diferente | Endereços extraídos incorretamente → geocoding errado |
| **Equipes não normalizadas** | Parser não aplica `normTeam()` | Pontos de equipes alternativas são perdidos ou duplicados |
| **Cache de geocoding não reutilizado** | Parser recria geocoding para endereços já conhecidos | Latência excessiva e custo de API desnecessário |

---

## 17. Fixtures adicionais que precisam ser capturadas

| Fixture | Por que é necessária | O que valida |
|---------|---------------------|------------|
| `caso-sabado` | Origem alternativa (`HOME_SAT_E1/E2`) e limite `MAX_SATURDAY_METERS` | Parser retorna pontos; rota usa origem correta; limite base diferente |
| `caso-sem-pontos` | Slot com disponibilidade mas sem eventos na agenda | `bestKm = OSRM(origem, destino)`; limite base = `MAX_WEEKDAY_METERS` |
| `caso-pontos-sem-coordenadas` | Eventos na agenda sem endereço geocodificável | Parser descarta com aviso; rota ignora pontos inválidos |
| `caso-endereco-em-observacoes` | Coluna 6 vazia, endereço só em coluna 5 | Regex extrai endereço corretamente |
| `caso-multiplos-pontos-mesmo-dia` | 3+ entregas no mesmo dia/equipe | Rota otimizada com 2-opt; delta de inserção no meio da rota |
| `caso-hora-marcada` | Slot com tempo adicional (`HORA_MARCADA_HORAS_A_MAIS`) | Classificação `hora-marcada` além de normal/especial/premium |

---

## 18. Sequência segura de implementação futura

### Fase 1: Documentar e validar estrutura (esta tarefa)
- ✅ Mapear colunas da AGENDA
- ✅ Documentar `coletarPontosDoDia`
- ✅ Propor interface `PontoAgendaV2`

### Fase 2: Criar parser puro (sem I/O externo)
- Implementar `parsearPontosAgendaDoDiaV2` com testes unitários
- Recebe linhas brutas como array de arrays (simulando `getValues()`)
- Comparação de data por string YYYY-MM-DD
- Normalização de equipe equivalente a `normTeam()`
- Extração de endereço: col 6 → col 5 regex fallback
- Sem geocoding real — recebe coordenadas via cache/mock

### Fase 3: Rota diagnóstica de agenda
- Nova flag na rota `POST /v2/diagnostico`: `usarAgendaRealDiagnostica: true`
- Ler planilha AGENDA via Google Sheets API (somente leitura)
- Passar linhas para o parser
- Retornar resumo: pontos por dia/equipe, endereços extraídos, CEPs, avisos
- **Não usar** pontos para calcular delta ainda

### Fase 4: Integrar pontos ao cálculo de delta
- Criar helper puro de delta de inserção (recebe `originLoc`, `pontos[]`, `novoDestino`)
- Implementar `rotaOtimizada` equivalente no v2 (nearest-neighbor + 2-opt)
- Integrar OSRM batch para cálculo de distâncias
- Comparar `kmAdicionalNaRotaM` v2 vs legado para fixtures conhecidas

### Fase 5: Comparação operacional completa
- Para cada fixture: contagem de pontos, endereços, CEPs, delta, tipo de candidato
- Critérios de aprovação da seção 19

---

## 19. Critérios de aprovação futuros para o parser

### Bloqueantes (nenhum pode falhar)

| Critério | Verificação |
|----------|-------------|
| Número de pontos bate com legado | Para data/equipe conhecida, `pontos.length` v2 = legado |
| Endereços extraídos batem | `p.addr` v2 ≈ legado (normalização pode diferir levemente) |
| CEP extraído bate | `p.cep` v2 = legado (ou null se legado também não conseguiu) |
| Coordenadas presentes para pontos válidos | Todo ponto retornado tem `lat` e `lng` |
| Pontos inválidos geram aviso | Descartes são explicitamente listados no resumo |
| Sábado usa origem correta | Teste com `data.getDay() === 6` → `HOME_SAT_E1/E2` |
| Parser não muta dados de entrada | Teste de imutabilidade |
| Parser não chama APIs externas no teste | Mock de geocoding/cache |
| Rota diagnóstica expõe resumo | JSON retorna contagem, amostra, avisos — não lista completa |

### Não-bloqueantes

| Critério | Tolerância |
|----------|-----------|
| Normalização de endereço | Leve diferença de formatação aceitável |
| Performance do parser | ≤ 100ms para 500 linhas |
| Cache de geocoding | Reutiliza 80%+ dos endereços já conhecidos |

---

## 20. Documentação relacionada

- `docs/procurar-datas-v2-plano-distancia-osrm.md` — Análise de distância/OSRM/delta
- `docs/procurar-datas-v2-plano-comparacao-operacional.md` — Plano de comparação operacional
- `docs/procurar-datas-v2-mapeamento-disponibilidade-legado.md` — Mapeamento de disponibilidade (`shAv`)
- `docs/procurar-datas-motor-v2-progresso.md` — Estado completo do motor v2
- `appscript/CEP-CONFIG.gs` — `coletarPontosDoDia()`, `rotaOtimizada()`, `getDrivingKm()`, `getDrivingKmBatch()`
- `appscript/CEP-APIBACK.gs` — Loop de simulação, abertura de `shAg`, cálculo de delta, classificação
