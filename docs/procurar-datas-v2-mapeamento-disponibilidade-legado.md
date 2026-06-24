# Mapeamento de Disponibilidade Legado — `/procurar-datas`

> **Data:** 12 de junho de 2026  
> **Agente:** Cascade  
> **Status:** Documentação + helper puro criado  
> **Propósito:** Mapa técnico confiável da disponibilidade real do legado para orientar a próxima implementação do parser de disponibilidade real no v2.  
> **Não altera código de produção. Não substitui leitura real do código.**
>
> **Atualização 12/06/2026:** Helper puro `parsearDisponibilidadeTempoDisponivelV2` criado em `motor/parse-disponibilidade-tempo-disponivel.ts`. Formato real da planilha confirmado: `DATA = DD/MM/YYYY`, `EQUIPE = Equipe 1 / Equipe 2`, `TEMPO DISPONÍVEL = HH:MM`, `STATUS = disponível / agenda fechada / excedeu`. 41 testes unitários passando.

---

## 1. Objetivo

Este documento mapeia como o legado (Apps Script) lê, representa e usa disponibilidade real ao calcular datas de entrega viáveis.

Cobre exclusivamente:
- `getSlots()` — disponibilidade por equipe/data (planilha `TEMPO DISPONIVEL`)
- `coletarPontosDoDia()` — pontos de entrega do dia (planilha `AGENDA`)
- Como os dois se cruzam com `tempoNecessario`, `delta`, e classificação de candidatos

~~Não implementa nenhum parser, rota, helper, teste ou tipo TypeScript.~~ **Atualizado:** helper puro `parsearDisponibilidadeTempoDisponivelV2` criado em `motor/parse-disponibilidade-tempo-disponivel.ts`. Rota, integração na rota diagnóstica e leitura real da planilha permanecem fora do escopo desta fase.

---

## 2. Escopo

- **Apenas documentação Markdown**
- **Não altera código**
- **Não altera produção**
- **Não cria helpers, testes, rotas ou tipos TypeScript**
- **Não substitui leitura real do código** — cada função citada deve ser relida antes de qualquer implementação

---

## 3. Arquivos Apps Script analisados

| Arquivo | Linhas principais lidas | Funções cobertas |
|---------|------------------------|------------------|
| `appscript/CEP-CONFIG.gs` | 1574–1594, 1596–1762, 1856–1877, 513–537 | `getSlots()`, `coletarPontosDoDia()`, `parseMinutes()`, `normTeam()`, `carregarEquipesAtivas_()` |
| `appscript/CEP-APIBACK.gs` | 1–170, 330–402, 403–692, 900–1160 | `calcularValorInicialModal()`, `pesquisarRotaToTargetWithParams()` (trecho), abertura de `shAv`/`shAg`, loop de simulação |

---

## 4. Resumo executivo

O legado representa disponibilidade em **dois objetos independentes** que são cruzados no motor principal:

1. **`slot`** — lido de `shAv` (TEMPO DISPONIVEL) por `getSlots()`. Representa **capacidade disponível de tempo** de uma equipe em um dia. Não tem informação geográfica.

2. **`pontos`** — lido de `shAg` (AGENDA) por `coletarPontosDoDia()`. Representa **entregas já agendadas** para aquele `slot`. Tem endereços geocodificados.

O motor cruza os dois para calcular `delta` (km adicional ao inserir o novo destino na rota) e classificar o candidato (normal, especial, premium, hora-marcada).

**Disponibilidade, no legado, não é simplesmente "se a equipe tem horário livreˮ.** É: "dado o tempo disponível que sobra após os pontos do dia, esse serviço cabe? E o novo destino cabe geograficamente na rota existente?ˮ

---

## 5. Função `getSlots()`

### 5.1 Localização

- Arquivo: `appscript/CEP-CONFIG.gs`
- Linhas: **1574–1594**

### 5.2 Assinatura (confirmada)

```javascript
function getSlots(sh, minMin, lookDays, startDate, endDate)
```

### 5.3 Parâmetros (confirmados)

| Parâmetro | Tipo | Origem | Descrição |
|-----------|------|--------|-----------|
| `sh` | Sheet | `ssSrc.getSheetByName(AVAIL_SHEET)` | Aba da planilha `TEMPO DISPONIVEL`. Nome lido de `getConfig('PLANILHA DE TEMPO DISPONIVEL', cfgSheet)` |
| `minMin` | number | `parseMinutes(form.tempoNecessario)` | Minutos mínimos de serviço exigidos |
| `lookDays` | number | `getConfig('DIAS DE PESQUISA NA AGENDA', cfgSheet)` | Janela de dias para olhar à frente |
| `startDate` | Date | `_resolveStartFromDate_(form)` | Data de início (opcional; default: hoje) |
| `endDate` | Date | — | Data de fim (opcional; default: hoje + lookDays) |

### 5.4 Retorno (confirmado)

Array de objetos:
```javascript
{
  date: Date,       // data real (objeto Date do Google Sheets)
  team: string,     // equipe normalizada: 'EQUIPE 1' ou 'EQUIPE 2'
  availStr: string  // tempo disponível como string (ex: "04:30")
}
```

### 5.5 Planilha `TEMPO DISPONIVEL` — estrutura de colunas

`getSlots()` lê **colunas 1 a 4** (`getRange(2,1,last-1,4)`):

| Coluna (0-indexed) | Índice no array | Como é lido | Uso confirmado |
|---------------------|-----------------|-------------|----------------|
| Coluna 1 | `r[0]` (via `getDisplayValues`) | String da data | **Ignorado** — a data real vem de `sh.getRange(i+2,1).getValue()` |
| Coluna 2 | `r[1]` | String da equipe | `normTeam(r[1])` → normaliza para 'EQUIPE 1', 'EQUIPE 2' ou null |
| Coluna 3 | `r[2]` | String desconhecida | **Lido mas não usado diretamente** — presente no array `disp` mas não referenciado em `getSlots()` |
| Coluna 4 | `r[3]` | String do tempo disponível | `parseMinutes(r[3])` → minutos disponíveis |

> **Nota crítica:** A data é lida duas vezes. `getDisplayValues()` (para string) e `getValue()` (para objeto Date). A comparação é feita com o objeto Date real.

### 5.6 Lógica de filtragem (confirmada)

Um slot é incluído no retorno somente se **todas** as condições forem verdadeiras:

```javascript
const ok = (
  d instanceof Date    // col 1 é uma Date válida
  && d >= start        // data >= início da janela
  && d < max           // data < fim da janela
  && team              // normTeam retornou não-null
  && avail >= minMin   // tempo disponível >= tempo necessário do serviço
);
```

### 5.7 Tratamento de sábados/domingos (confirmado)

- `getSlots()` **não trata sábados/domingos de forma especial**. Retorna qualquer dia que passe nas condições acima.
- Sábado recebe origem diferente no motor principal (`HOME_SAT_E1`/`HOME_SAT_E2` em vez do depósito), mas isso não está em `getSlots()`.
- Domingo: se houver dados na planilha para domingos com equipe válida e tempo suficiente, o slot seria retornado. Na prática, a planilha provavelmente não tem linhas de domingo.

### 5.8 Tratamento de equipes inativas (confirmado)

Equipes inativas **não são filtradas dentro de `getSlots()`**. O filtro ocorre logo depois, no chamador (`CEP-APIBACK.gs` linhas 590–617):

```javascript
var equipesAtivas = carregarEquipesAtivas_(cfgSheet); // lê EQUIPE 1 ATIVA? / EQUIPE 2 ATIVA?
slots = slots.filter(function(s) {
  var equipe = String(s.team || '').toUpperCase();
  return equipesAtivas[equipe] !== false;
});
```

`carregarEquipesAtivas_()` lê `EQUIPE 1 ATIVA?` e `EQUIPE 2 ATIVA?` da aba de config (`cfgSheet`) e interpreta SIM/NÃO/TRUE/FALSE.

### 5.9 Regras adicionais de filtro sobre slots (confirmadas)

Após `getSlots()` e o filtro de equipes ativas, ainda existem:

1. **Regra de produto:** Se `tipoBerco === 'FORMARE'` ou `roupeiro === '4 PTS (TUTTO)'`, remove todos os slots da EQUIPE 2.
2. **Regra da quarta-feira:** EQUIPE 2 em quartas-feiras só aceita serviços com `serviceMin <= 150min` (02:30).

### 5.10 Uso de cache (confirmado)

`getSlots()` não tem cache próprio. O motor calcula um hash da agenda (`slotsHash`) e o armazena em `PropertiesService` para invalidação futura.

### 5.11 Timezone (parcialmente confirmado)

- `sh.getRange(i+2,1).getValue()` retorna a data no timezone da planilha (`SOURCE_SPREADSHEET_ID`).
- `const hoje = new Date(); hoje.setHours(0,0,0,0);` usa o timezone do servidor Apps Script (America/Sao_Paulo pelo configurado, ou UTC por default — **não confirmado qual**).
- **Risco real:** Se o timezone da planilha e o do servidor divergirem, datas próximas à meia-noite podem ser incluídas ou excluídas incorretamente.

### 5.12 `normTeam()` — confirmado

```javascript
function normTeam(s){
  s=String(s).toUpperCase();
  if(/EQUIPE\s*0?1|EQP\s*0?1/.test(s)) return 'EQUIPE 1';
  if(/EQUIPE\s*0?2|EQP\s*0?2/.test(s)) return 'EQUIPE 2';
  return null;
}
```

Aceita: "EQUIPE 1", "EQUIPE 01", "EQUIPE1", "EQP 1", "EQP 01", "EQP1" (e variações com espaços). Qualquer outra string → `null` → slot descartado.

### 5.13 `parseMinutes()` — confirmado

```javascript
function parseMinutes(t){
  if(!t) return 0;
  if(t instanceof Date) return t.getHours()*60+t.getMinutes();
  if(typeof t==='number') return Math.round(t*24*60);
  const p=String(t).split(':'), h=+p[0]||0, m=+p[1]||0;
  return h*60+m;
}
```

Três formatos aceitos:
- **String `"HH:MM"`** → parse direto (caso mais comum)
- **Objeto Date** → usa `getHours()` e `getMinutes()` — Google Sheets pode retornar células de tempo como Date com hora do dia
- **Number** → trata como fração de dia (0.25 = 6h = 360min) — formato alternativo do Sheets

---

## 6. Função `coletarPontosDoDia()`

### 6.1 Localização

- Arquivo: `appscript/CEP-CONFIG.gs`
- Linhas: **1596–1762**

### 6.2 Assinatura (confirmada)

```javascript
function coletarPontosDoDia(slot, vals, disp)
```

### 6.3 Parâmetros (confirmados)

| Parâmetro | Tipo | Origem | Descrição |
|-----------|------|--------|-----------|
| `slot` | Object | `getSlots()` | `{ date, team, availStr }` — contexto de data e equipe |
| `vals` | Array[][] | `shAg.getRange(2,1,rowsAg,7).getValues()` | Valores brutos de 7 colunas da AGENDA |
| `disp` | Array[][] | `shAg.getRange(2,1,rowsAg,7).getDisplayValues()` | Valores de display de 7 colunas da AGENDA |

### 6.4 Retorno (confirmado)

Array de objetos:
```javascript
{
  addr: string,       // endereço exibível (geocodificado ou display do geocoding)
  loc: { lat, lng },  // coordenadas geocodificadas
  eventTitle: string, // título do evento (col 3 da agenda)
  cep: string|null,   // CEP (do geocoding) ou null
  cepSource: string   // 'geocoding' | 'regex_fallback' | 'nenhuma'
}
```

### 6.5 Planilha `AGENDA` — estrutura de colunas (confirmada)

`coletarPontosDoDia()` recebe `vals` e `disp` com **7 colunas** (`getRange(2,1,rowsAg,7)`):

| Coluna (1-based) | Índice no array | Usado em | O que contém | Status |
|------------------|-----------------|----------|--------------|--------|
| Coluna 1 | `r[0]` / `vals[i][0]` | Filtro de data | Data do agendamento (Date) | ✅ Confirmado |
| Coluna 2 | `r[1]` / `vals[i][1]` | — | **Lido mas não usado nesta função** | ⚠️ Não confirmado o conteúdo |
| Coluna 3 | `disp[i][2]` | `eventTitle` | Título do evento/agendamento | ✅ Confirmado |
| Coluna 4 | `r[3]` / `vals[i][3]` | — | **Lido mas não usado nesta função** | ⚠️ Não confirmado o conteúdo |
| Coluna 5 | `disp[i][4]` | Endereço via regex `ENDEREÇO:` | Campo de observações (texto livre) | ✅ Confirmado |
| Coluna 6 | `disp[i][5]` | Endereço direto (fonte "LUGAR") | Campo de endereço direto | ✅ Confirmado |
| Coluna 7 | `disp[i][6]` | Filtro de equipe | Equipe do agendamento | ✅ Confirmado |

### 6.6 Filtragem de linhas da agenda (confirmada)

Um item da agenda é processado somente se:
1. `r[0]` é Date **E** `d.getTime() === slot.date.getTime()` — mesma data do slot
2. `normTeam(disp[i][6]) === slot.team` — mesma equipe do slot

### 6.7 Resolução de endereço (confirmada — dois passos)

**Passo 1 — parsing do endereço:**
- Usa coluna 6 (`disp[i][5]`) como primeira fonte ("LUGAR")
- Se vazia, usa coluna 5 (`disp[i][4]`) com regex `ENDEREÇO:[^0-9a-zA-Z]*([\s\S]+?)` ("OBSERVAÇÕES")
- Faz parsing inteligente com listas de bairros/cidades de Curitiba e RMC
- Monta `mockForm = { logradouro, numero, bairro, cidade, uf }`

**Passo 2 — geocoding em batch:**
- Pré-carrega cache do Supabase em lote (`ConsultarCacheSupabaseBatch_()`)
- Chama `ResolverEnderecoComCache_(mockForm, 'AGENDA', preloadedCache)` para cada endereço

**Se geocoding falhar:** o ponto é descartado (linha `dlog('[PTS][ERRO]...')`) — sem fallback de coordenadas.

### 6.8 CEP do ponto (confirmado)

- **Fonte principal:** CEP retornado pelo geocoding (`loc.cep`)
- **Fallback:** regex no endereço textual (`\b(\d{5})-?(\d{3})\b`)
- `cepSource` distingue a origem: `'geocoding'` ou `'regex_fallback'`

### 6.9 O que `coletarPontosDoDia()` NÃO faz (confirmado)

- Não calcula distâncias — distância entre pontos e novo destino é calculada depois no loop principal
- Não usa OSRM diretamente
- Não filtra pontos por distância
- Não conhece o novo destino do cliente
- Não calcula `delta` ou `km adicional na rota`

---

## 7. Como o legado representa disponibilidade

A disponibilidade real no legado tem **três camadas**, que são processadas sequencialmente:

### Camada 1 — Disponibilidade de tempo (`getSlots()`)

```
planilha TEMPO DISPONIVEL
  ↓
getSlots(shAv, serviceMin, LOOK_DAYS)
  → filtra: data na janela + equipe válida + tempo disponível >= tempo necessário
  → retorna: [{ date, team, availStr }]
```

`availStr` é a representação textual do tempo disponível (ex: "04:30"). Não é usado diretamente no candidato final — é armazenado no slot para referência de hora-marcada.

### Camada 2 — Filtros de negócio sobre equipes

```
slots → filtro de equipes ativas
      → filtro de produto (FORMARE, TUTTO)
      → filtro de quarta-feira EQUIPE 2
```

Esses filtros aplicam regras de negócio sobre quais equipes podem trabalhar em determinadas condições.

### Camada 3 — Disponibilidade geográfica (`coletarPontosDoDia()`)

```
slots → coletarPontosDoDia(slot, agVals, agDisp)
  → para cada slot: busca pontos de entrega do dia na AGENDA
  → geocodifica endereços dos pontos
  → retorna lista de pontos com coordenadas
```

Com os pontos geocodificados, o motor calcula `delta` (km adicional ao inserir o novo destino) e determina se o slot é viável geograficamente para o novo cliente.

---

## 8. Como o legado representa pontos/agenda do dia

Cada ponto é um **agendamento existente** para aquela equipe naquele dia. Representa um cliente que **já tem entrega confirmada** e serve como âncora geográfica.

Estrutura do ponto (após `coletarPontosDoDia()`):
```javascript
{
  addr: string,       // endereço normalizado/geocodificado
  loc: { lat, lng },  // coordenadas geocodificadas (obrigatório — ponto sem loc é descartado)
  eventTitle: string, // título do evento na agenda
  cep: string|null,   // CEP do ponto
  cepSource: string   // origem do CEP
}
```

O ponto mais próximo do novo destino (por OSRM) vira o `nearestPoint` do candidato:
```javascript
nearestPoint: {
  addr: string,        // endereço da âncora
  cep: string|null,    // CEP da âncora
  distancia: number,   // km OSRM da âncora ao novo destino
  eventTitle: string,  // título do evento
  loc: { lat, lng }    // coordenadas da âncora
}
```

**Slots sem pontos** (agenda vazia para aquele dia/equipe) são mantidos mas processados separadamente. Eles são viáveis apenas para rotas onde a distância do depósito ao destino cabe dentro do limite de sábado/semana.

---

## 9. Relação entre disponibilidade, pontos, distância e tempo necessário

```
form.tempoNecessario ("02:30")
  ↓ parseMinutes()
serviceMin = 150 min

getSlots(shAv, serviceMin, LOOK_DAYS)
  → slots onde availStr (tempo disponível) >= 150 min
  → cada slot: { date, team, availStr }

para cada slot:
  slot.pontos = coletarPontosDoDia(slot, agVals, agDisp)
    → pontos com loc (coordenadas geocodificadas)

loop de simulação:
  para cada ponto do slot:
    delta = bestKm (menor km adicional ao inserir destino novo na rota)
  
  se delta <= limiteKmBase → candidato NORMAL
  se delta <= limiteKmEspecial (+5km) → candidato ESPECIAL
  se delta <= limiteKmPremium (+10km) → candidato PREMIUM
  
  hora-marcada (independente):
    slotAvailMin = parseMinutes(slot.availStr)
    tempoComAdicional = serviceMin + HORA_MARCADA_HORAS_A_MAIS * 60
    se slotAvailMin >= tempoComAdicional E delta <= limiteKmBase → candidato HORA MARCADA
```

### Onde entra `tempoNecessario`:
1. **Filtro em `getSlots()`:** `avail >= minMin` — exclui slots sem tempo suficiente
2. **Hora-marcada:** comparação `slotAvailMin >= serviceMin + horasAdicionais`

### Onde entra `kmAdicionalNaRota` (`delta`):
1. Calculado no loop principal como km de melhor inserção (algoritmo de inserção mais barata)
2. Comparado com `limiteKmBase`, `limiteKmEspecial`, `limiteKmPremium`
3. O `delta` (= `bestKm`) é o **km adicional que a rota existente aumentaria** ao incluir o novo destino

### Onde entra equipe:
1. Filtro em `getSlots()` via `normTeam()`
2. Filtro de equipes ativas (`carregarEquipesAtivas_()`)
3. Filtro de produto e quarta-feira

### Onde entra data:
1. Janela em `getSlots()` (`d >= start && d < max`)
2. Comparação exata de `getTime()` em `coletarPontosDoDia()`

### O que `availStr` representa exatamente:
- É o **tempo disponível que sobra na agenda** para aquela equipe naquele dia
- Não é o tempo total de trabalho da equipe
- Não é o tempo de deslocamento
- É preenchido manualmente ou automaticamente na planilha `TEMPO DISPONIVEL`

---

## 10. Mapeamento proposto para `DisponibilidadeEquipeDataV2`

```typescript
type DisponibilidadeEquipeDataV2 = {
  dataISO: string                        // ← slot.date → format YYYY-MM-DD (UTC)
  equipe: string                         // ← slot.team (já normalizado por normTeam)
  disponivelMin: number                  // ← parseMinutes(slot.availStr)
  ativa?: boolean                        // ← carregarEquipesAtivas_()[slot.team]
  motivoIndisponibilidade?: string | null  // ← derivado dos filtros de negócio
}
```

### Campo a campo:

| Campo `DisponibilidadeEquipeDataV2` | Fonte no legado | Como derivar | Status |
|-------------------------------------|-----------------|--------------|--------|
| `dataISO` | `slot.date` (Date) | `Utilities.formatDate(slot.date, 'GMT-3', 'yyyy-MM-dd')` | ✅ Mapeamento claro |
| `equipe` | `slot.team` | Já normalizado por `normTeam()`: `'EQUIPE 1'` ou `'EQUIPE 2'` | ✅ Mapeamento claro |
| `disponivelMin` | `slot.availStr` | `parseMinutes(slot.availStr)` — já existe helper em `tempo.ts` | ✅ Mapeamento claro |
| `ativa` | `carregarEquipesAtivas_()` | Config `EQUIPE 1 ATIVA?` / `EQUIPE 2 ATIVA?` do Supabase | ✅ Fonte confirmada |
| `motivoIndisponibilidade` | Filtros pós-`getSlots()` | `'equipe inativa'`, `'produto bloqueado'`, `'regra quarta-feira'` — ver abaixo | ⚠️ Parcialmente confirmado |

### `motivoIndisponibilidade` — cenários confirmados:

| Cenário | Origem | Valor sugerido |
|---------|--------|----------------|
| Equipe marcada como inativa na config | `carregarEquipesAtivas_()` → `false` | `'equipe inativa'` |
| EQUIPE 2 bloqueada por produto (FORMARE/TUTTO) | Filtro de produto | `'produto não compatível com equipe 2'` |
| EQUIPE 2 bloqueada por regra de quarta-feira | `s.date.getDay() === 3 && s.team === 'EQUIPE 2' && serviceMin > 150` | `'quarta-feira: serviço excede 02:30'` |
| Slot não atende tempo necessário | Filtrado em `getSlots()` — não retorna | **Não aparece como slot — não mapeável via slot.availStr** |

### O que não dá para mapear com segurança hoje:

1. **`motivoIndisponibilidade` para regra de produto:** depende de `tipoBerco` e `roupeiro` do formulário, não é uma propriedade estática da disponibilidade
2. **Slots com tempo insuficiente:** `getSlots()` os exclui antes de retornar — para ter esses dados precisaria ler a planilha SEM o filtro de `minMin`
3. **Data como string ISO no timezone correto:** `slot.date` é um objeto Date no timezone da planilha — conversão para YYYY-MM-DD precisa ser feita no timezone correto (GMT-3)

---

## 11. O que ainda não está confirmado

| Item | Status | O que falta |
|------|--------|-------------|
| Nome real da aba `TEMPO DISPONIVEL` | ⚠️ Inferido | É configurável via `getConfig('PLANILHA DE TEMPO DISPONIVEL')`. O nome real está na planilha de config (não acessada) |
| Nome real da aba `AGENDA` | ⚠️ Inferido | Idem — `getConfig('PLANILHA DA AGENDA')` |
| Conteúdo das colunas 2 e 4 de `shAg` | ❌ Não confirmado | Lidas em `vals` mas não usadas em `coletarPontosDoDia()`. Podem ser: responsável, tipo de serviço, status do agendamento |
| Conteúdo da coluna 3 de `shAv` | ❌ Não confirmado | Lida em `disp` mas não usada em `getSlots()`. Pode ser: nome da equipe completo, turno, observação |
| Formato exato de `availStr` | ⚠️ Parcialmente confirmado | Confirmado que é string parseable por `parseMinutes()`. Pode ser "04:30" (string HH:MM), fração de dia (number), ou Date object. Os três casos são tratados. |
| Timezone da planilha de origem | ❌ Não confirmado | Pode ser America/Sao_Paulo ou GMT-3. Impacta conversão de `slot.date` para YYYY-MM-DD |
| Existência de linhas de domingo na `shAv` | ❌ Não confirmado | Se houver, seriam retornadas por `getSlots()`. Em produção, provavelmente não existem |
| Quais linhas da agenda têm endereço no col 6 vs col 5 | ⚠️ Parcialmente confirmado | O código tenta col 6 primeiro. Se vazia, usa col 5 com regex. Mas a proporção real não foi vista |
| `ResolverEnderecoComCache_()` — taxa de falha | ❌ Não confirmado | Se o geocoding falhar para um ponto, o ponto é descartado. Não sabemos a taxa de falha real |
| Regras de EQUIPE 2 em outros dias da semana | ❌ Não confirmado | Apenas quarta-feira está documentada no código. Outros dias não têm regra explícita |

---

## 12. Riscos conhecidos

| Risco | Tipo | Impacto | Mitigação recomendada |
|-------|------|---------|----------------------|
| **Timezone da planilha vs servidor** | Alto | Datas próximas à meia-noite podem ser incluídas ou excluídas erroneamente | Confirmar timezone da planilha; usar GMT-3 fixo na conversão para ISO |
| **`availStr` como Date object** | Médio | Se a célula da planilha tiver formato de hora, o Sheets retorna Date — `parseMinutes()` trata isso, mas a string YYYY-MM-DD não pode ser derivada de um Date de hora | Validar o tipo retornado com fixture real |
| **`normTeam()` retorna null para nomes inesperados** | Médio | Equipes com nomes como "EQP1" (sem espaço) seriam descartadas — verificar padrões reais na planilha | Capturar fixture real com log de `normTeam()` |
| **Ponto sem CEP descartado silenciosamente** | Baixo/Médio | Se geocoding não retornar CEP, o `nearestPoint.cep` fica null e a comparação de região pode falhar | Já tratado no código legado — só documentar comportamento |
| **Endereços inconsistentes na agenda** | Alto | Entradas sem endereço (col 5 vazia + col 6 vazia) são descartadas; entradas com endereço não parseable também | Testar com fixture de entrada real |
| **Nome das abas configurável** | Médio | Se os nomes de `TEMPO DISPONIVEL` e `AGENDA` mudarem na planilha, o código quebra — e o v2 precisaria replicar esse mecanismo de config | Ler esses nomes do Supabase `procurar_datas_config` quando implementar |
| **Coluna 3 de `shAv` desconhecida** | Baixo | Pode conter dados relevantes não documentados | Ler fixture real para confirmar |
| **Colunas 2 e 4 de `shAg` desconhecidas** | Baixo | Podem conter dados relevantes (tipo de serviço, status do agendamento) | Ler fixture real para confirmar |
| **Regra de produto depende do formulário** | Alto | `motivoIndisponibilidade` para EQUIPE 2 não é estático — depende do que o usuário selecionou | Separar filtros estáticos (equipe ativa) dos dinâmicos (produto) no v2 |
| **`carregarEquipesAtivas_()` lê de planilha** | Médio | No v2 Next.js, esse valor vem do Supabase `procurar_datas_config` — confirmar paridade | Comparar valores entre planilha e Supabase antes de usar |
| **Latência do geocoding em `coletarPontosDoDia()`** | Alto | Batch Supabase reduz latência, mas falhas de geocoding causam pontos ausentes | Para o v2, implementar cache separado; não contar com timing do Apps Script |

---

## 13. Regras que não devem ser alteradas sem validação

1. **`normTeam()` regex:** qualquer variação no regex muda quais equipes são aceitas — pode causar slots perdidos ou duplicados
2. **`parseMinutes()` tratamento de Date:** planilhas podem retornar tempo como Date — qualquer parser que não trate esse caso quebraria silenciosamente
3. **Comparação de data por `getTime()`:** `coletarPontosDoDia()` usa `d.getTime() === slot.date.getTime()`. Qualquer timezone inconsistente causaria zero pontos por day
4. **`getSlots()` filtro `avail >= minMin`:** alterar para `>` ou `<=` mudaria quais slots são incluídos — em casos de slot exatamente no limite, o comportamento mudaria
5. **Prioridade de endereço (col 6 antes de col 5):** se invertida, endereços de "OBSERVAÇÕES" seriam usados mesmo quando "LUGAR" existe

---

## 14. Próxima microetapa recomendada

### Recomendação

Criar helper puro `parseDisponibilidadeSlotLegadoV2(rawRows)` que converte linhas brutas da planilha `TEMPO DISPONIVEL` (formato array de arrays, como retornado por `getValues()`) para `DisponibilidadeEquipeDataV2[]`.

Esse helper deve:
- Aceitar `rawRows: unknown[][]` (simulando `sh.getRange(...).getValues()`)
- Aplicar `normTeam()` (portada de `equipe.ts`)
- Aplicar `parseMinutes()` (portada de `tempo.ts`)
- Retornar `DisponibilidadeEquipeDataV2[]`
- Ser testado com fixture sintética baseada na estrutura real mapeada neste documento
- **Não** acessar planilha, Supabase, Apps Script, OSRM ou qualquer I/O

### Parâmetros confirmados para o helper:
- Coluna 0 do array: data (Date ou string — timezone a confirmar)
- Coluna 1 do array: equipe (string — normTeam)
- Coluna 3 do array: tempo disponível (string, Date ou number — parseMinutes)

### O que a fixture sintética deve cobrir:
- Linha com equipe "EQUIPE 1" e tempo "04:30" (string HH:MM)
- Linha com equipe "EQUIPE 2" e tempo como number (fração de dia)
- Linha com equipe "EQUIPE 2" e tempo como Date object
- Linha com equipe nula ou inválida (deve ser descartada)
- Linha com tempo zero ou vazio (deve resultar em disponivelMin = 0)
- Linha com data fora da janela (deve ser descartada se o helper filtrar)

### ✅ Concluído

Helper puro criado: `src/lib/procurar-datas/motor/parse-disponibilidade-tempo-disponivel.ts`

Formato real confirmado pelo usuário:
- `DATA` = `DD/MM/YYYY` (string) — não inverter mês/dia com `new Date()`
- `EQUIPE` = `Equipe 1`, `Equipe 2`, `EQUIPE 1`, etc. — normalizado via `normalizarEquipe()`
- `TEMPO DISPONÍVEL` = `HH:MM` (string) — convertido via `parseMinutos()`
- `STATUS` = `disponível` | `agenda fechada` | `excedeu` — normalizado sem acento

41 testes unitários passando. Typecheck sem erros.

### Próxima etapa recomendada

✅ Rota diagnóstica criada: `GET /api/procurar-datas/v2/disponibilidade-diagnostico`
- Lê planilha real via Google Sheets API v4 (somente leitura)
- Resolve nome de aba pelo `gid/sheetId = 65861376` (não depende mais de string fixa do nome)
- Converte linhas brutas via `converterTabelaTempoDisponivel()` → `LinhaTempoDisponivelV2[]`
- Chama `parsearDisponibilidadeTempoDisponivelV2()` e retorna resumo + amostra
- Não afeta produção, não escreve, não chama Apps Script
- 14 testes unitários passando

Próximo passo: chamar a rota em ambiente real para capturar fixture real de `shAv` e confirmar dados.

---

## 15. Checklist antes de implementar disponibilidade real no v2

- [x] **Confirmar o formato real de `DATA`** — confirmado: `DD/MM/YYYY`, `DD/MM` e `DD/MM (dia-da-semana)` (string)
- [x] **Confirmar o formato real de `TEMPO DISPONÍVEL`** — confirmado: `HH:MM` (string)
- [x] **Confirmar os status possíveis** — confirmados: `disponível`, `agenda fechada`, `excedeu`
- [x] **Confirmar estrutura das colunas reais** — confirmadas: `DATA | EQUIPE | TEMPO UTILIZADO | TEMPO DISPONÍVEL | TEMPO EXCEDIDO | STATUS`
- [x] **Criar helper puro de parse** — criado: `motor/parse-disponibilidade-tempo-disponivel.ts` (54 testes)
- [x] **Criar rota diagnóstica de leitura real** — criada: `GET /api/procurar-datas/v2/disponibilidade-diagnostico` (17 testes)
- [x] **Resolver nome de aba pelo gid/sheetId** — implementado: busca metadados da planilha, encontra aba com `sheetId === 65861376`, monta range A1 escapado
- [x] **Parser aceita datas sem ano com inferência via `dataInicialISO`** — implementado: `DD/MM` e `DD/MM (texto)` com virada automática de ano; rota aceita `?dataInicialISO=YYYY-MM-DD`
- [x] **Integrar disponibilidade real em `/v2/diagnostico` como bloco opcional** — implementado: rota aceita `usarDisponibilidadeRealDiagnostica: true` no body; reutiliza `dataInicialISO` da entrada; retorna bloco `diagnosticoDisponibilidadeReal` no response; não afeta comportamento padrão nem disponibilidade sintética
- [ ] Chamar a rota em produção e capturar fixture real de `shAv` (sem dados de clientes)
- [ ] Confirmar nome real da aba `AGENDA` na planilha
- [ ] Confirmar timezone da planilha `SOURCE_SPREADSHEET_ID`
- [ ] Confirmar o conteúdo real da coluna 3 de `shAv`
- [ ] Confirmar o conteúdo real das colunas 2 e 4 de `shAg`
- [ ] Confirmar se existem linhas de domingo em `shAv`
- [ ] Confirmar como `carregarEquipesAtivas_()` se comporta quando a config não existe (default `true`)
- [ ] Decidir se o helper do v2 lerá o Supabase `procurar_datas_config` para nomes das abas ou se usará constantes fixas
- [ ] Confirmar paridade entre `EQUIPE 1 ATIVA?` na planilha e no Supabase `procurar_datas_config`
