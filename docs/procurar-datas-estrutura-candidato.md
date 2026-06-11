# Estrutura dos candidatos — `/procurar-datas`

## 1. Objetivo

Este documento registra a estrutura real dos objetos usados pelo Apps Script para futura migração do motor v2.  
Aqui estão catalogados os campos, tipos e origens dos objetos que circulam no fluxo de slots, candidatos, pontos e retorno ao frontend.

---

## 2. Escopo

- Este documento é **apenas documentação**.
- **Não altera código**.
- **Não altera produção**.
- **Não cria tipos TypeScript ainda**.
- **Não substitui testes**.
- Serve como referência para quando a equipe decidir migrar a lógica de seleção de slots.

---

## 3. Fontes auditadas

| Arquivo | Trechos principais | Funções / Linhas |
|---------|---------------------|-------------------|
| `appscript/CEP-CONFIG.gs` | `getSlots`, `coletarPontosDoDia` | Linhas ~1574–1594 (getSlots), ~1596–1756 (coletarPontosDoDia) |
| `appscript/CEP-APIBACK.gs` | Criação de candidato, enriquecimento | Linhas ~1070–1084 (cand = {...}), ~956–963 (nearestPoint), ~930–953 (percorre pontos) |
| `appscript/PublicAPI.gs` | Retorno ao frontend, pré-agendamento | Linhas ~863–870 (payload.candidates), ~367–391 (pré-agendamento) |
| `appscript/procurar_modal.html` | Exibição no modal | Linhas ~1189–1227 (render de candidatos) |

---

## 4. Visão geral dos objetos

No fluxo do Apps Script circulam quatro objetos principais:

1. **`slot`** — registro bruto de um dia/equipe disponível, vindo da planilha.
2. **`ponto`** — endereço de entrega já existente em um slot (âncora geográfica).
3. **`candidato`** — objeto enriquecido criado a partir do slot, usado para ranqueamento.
4. **`nearestPoint`** — subobjeto do candidato, representa a âncora mais próxima do novo destino.

Além desses, há objetos de **retorno ao frontend** (payload) e listas separadas por tipo.

---

## 5. Estrutura de `slot`

Objeto criado em `getSlots()` (`CEP-CONFIG.gs`, linhas ~1574–1594) e enriquecido em `coletarPontosDoDia()`.

| Campo | Tipo | Origem | Onde é usado | Obrigatório | Status |
|-------|------|--------|--------------|-------------|--------|
| `date` | `Date` | Planilha de agenda/disponibilidade | Ordenação, comparação, exibição, chave de agrupamento (`toDateString`) | ✅ Sim | ✅ Confirmado |
| `team` | `string` | Planilha + `normTeam()` | Exibição, decisão de origem (sábado), ranking | ✅ Sim | ✅ Confirmado |
| `availStr` | `string` | Planilha (coluna de disponibilidade) | Exibição, log | ✅ Sim | ✅ Confirmado |
| `pontos` | `Ponto[]` | `coletarPontosDoDia()` — linhas da planilha de agenda (`shAg`) | Cálculo de delta, nearestPoint, rota, ranking | ✅ Sim | ✅ Confirmado |
| `nearestPoint` | `NearestPoint` | Calculado em `CEP-APIBACK.gs` | Decisão de âncora, ranking por região | ❌ Opcional (slot vazio) | ✅ Confirmado |
| `delta` | `number` | Calculado em `CEP-APIBACK.gs` | Ranking, decisão de tipo (normal/especial/premium) | ✅ Sim | ✅ Confirmado |
| `loc` | `Coordenada` | Geocoding do endereço de origem | Cálculo de distância | ✅ Sim | ✅ Confirmado |

---

## 6. Estrutura de `candidato`

Objeto criado em `CEP-APIBACK.gs`, linhas ~1070–1084.

| Campo | Tipo | Origem | Onde é usado | Obrigatório | Status |
|-------|------|--------|--------------|-------------|--------|
| `date` | `Date` | Herdado do `slot.date` | Ranking, exibição, chave de agrupamento (`toDateString`) | ✅ Sim | ✅ Confirmado |
| `team` | `string` | Herdado do `slot.team` | Ranking, exibição, decisão de origem | ✅ Sim | ✅ Confirmado |
| `delta` | `number` | `bestKm` — menor distância de inserção na rota | Ranking, decisão de tipo, exibição | ✅ Sim | ✅ Confirmado |
| `availStr` | `string` | Herdado do `slot.availStr` | Exibição, log | ❌ Opcional | ✅ Confirmado |
| `pontos` | `Ponto[]` | Herdado do `slot.pontos` | Cálculo de nearestPoint, reintrodução | ✅ Sim | ✅ Confirmado |
| `nearestPoint` | `NearestPoint` | Calculado no slot | Ranking por região, log | ❌ Opcional | ✅ Confirmado |

> Nota: o candidato é essencialmente o slot com campos calculados (`delta`, `nearestPoint`). Não há campos adicionais como `rank`, `tipo` ou `frete` no objeto interno — esses são adicionados no payload de retorno.

---

## 7. Estrutura de `nearestPoint`

Subobjeto calculado dentro do `slot`/`candidato` em `CEP-APIBACK.gs`, linhas ~956–963 e ~1077–1083.

| Campo | Tipo | Origem | Onde é usado | Obrigatório | Status |
|-------|------|--------|--------------|-------------|--------|
| `addr` | `string` | Endereço do ponto de entrega (`p.addr`) | Exibição, log, decisão de âncora | ✅ Sim | ✅ Confirmado |
| `cep` | `string \| null` | Resolvido por `resolveCEPFromAddress_` | Log, auditoria | ❌ Pode ser `null` | ✅ Confirmado |
| `distancia` | `number` | `nearKm` — distância OSRM até o novo destino (km) | Ranking por região, log | ✅ Sim | ✅ Confirmado |
| `loc` | `Coordenada` | Herdado do ponto (`p.loc`) | — | ✅ Sim | ✅ Confirmado |

---

## 8. Estrutura de `ponto`

Objeto criado em `coletarPontosDoDia()` (`CEP-CONFIG.gs`, linhas ~1596–1756).

| Campo | Tipo | Origem | Onde é usado | Obrigatório | Status |
|-------|------|--------|--------------|-------------|--------|
| `loc` | `Coordenada` | Geocoding do endereço do evento | Cálculo de distância (Haversine, OSRM) | ✅ Sim | ✅ Confirmado |
| `addr` | `string` | Endereço bruto do evento (coluna da planilha) | nearestPoint.addr, log, rota | ✅ Sim | ✅ Confirmado |
| `eventTitle` | `string` | Coluna 3 da planilha de agenda (`disp[i][2]`) | Log, nearestPoint | ✅ Sim | ✅ Confirmado |
| `cepSource` | `string` | Resultado de `resolveCEPFromAddress_` | Log (`alog_('ANCORA-CEP')`) | ❌ Opcional | ✅ Confirmado |

---

## 9. Listas e grupos

Durante o fluxo, os candidatos são agrupados em estruturas separadas por tipo:

| Nome da variável | Tipo | Origem | Onde é usado |
|------------------|------|--------|--------------|
| `porDiaBestNormal` | `Record<string, Candidato>` | `CEP-APIBACK.gs` — melhor candidato normal por dia | Seleção final |
| `porDiaBestEspecial` | `Record<string, Candidato>` | `CEP-APIBACK.gs` — melhor candidato especial por dia | Seleção final |
| `porDiaBestPremium` | `Record<string, Candidato>` | `CEP-APIBACK.gs` — melhor candidato premium por dia | Seleção final |
| `porDiaHoraMarcada` | `Record<string, Candidato>` | `CEP-APIBACK.gs` — candidato hora marcada por dia | Seleção final |
| `fastPassNormais` | `Candidato[]` | `CEP-APIBACK.gs` — pré-seleção por proximidade | Ordenação por delta |
| `fastPassExtras` | `Candidato[]` | `CEP-APIBACK.gs` — pré-seleção por proximidade | Ordenação por delta |
| `listaNormalApp` | `Candidato[]` | `selecionarConjuntoApp3ComExtras_` | Concatenação final |
| `listaEspecialApp` | `Candidato[]` | `selecionarConjuntoApp3ComExtras_` | Concatenação final |
| `listaPremiumApp` | `Candidato[]` | `selecionarConjuntoApp3ComExtras_` | Concatenação final |
| `listaHoraMarcadaApp` | `Candidato[]` | `selecionarConjuntoApp3ComExtras_` | Concatenação final |
| `listaApp` / `lista` | `Candidato[]` | Concatenação das listas acima | Retorno ao frontend |

> Nota: as chaves dos `Record` (`porDiaBest*`) são `slot.date.toDateString()`.

---

## 10. Campos usados no ranking

Campos que participam diretamente da ordenação/comparação:

| Campo | Função no ranking | Local no código |
|-------|-------------------|-----------------|
| `date` | Ordenação cronológica (`a.date - b.date`) | Múltiplos `.sort()` |
| `delta` | Ordenação por proximidade (`a.delta - b.delta`) | Fast pass, decisão de tipo |
| `team` | Decisão de origem (sábado), ranking por região | `CEP-APIBACK.gs`, `CEP-CONFIG.gs` |
| `pontos.length` | Consolidação fraca (diff >= 2 pontos) | `CEP-CONFIG.gs` comparador |
| `nearestPoint.distancia` | Equipe na região (mesmo dia, equipes diferentes) | `CEP-CONFIG.gs` comparador |
| `nearestPoint` (existência) | Dia aberto vs fechado | `CEP-CONFIG.gs` comparador |

---

## 11. Campos usados apenas para exibição

Campos que parecem ser usados para montar retorno ao frontend, mas não para ranking:

| Campo | Onde aparece no retorno | Status |
|-------|------------------------|--------|
| `rank` | `PublicAPI.gs` — adicionado no payload como `c.rank \|\| 0` | ✅ Confirmado (não usado no ranking interno) |
| `weekday` | `PublicAPI.gs` — dia da semana formatado | ✅ Confirmado |
| `dateDM` | `PublicAPI.gs` — data em `dd/MM` | ✅ Confirmado |
| `tipo` | `PublicAPI.gs` — tipo do candidato (`normal`, `especial`, etc.) | ✅ Confirmado (adicionado no payload) |
| `frete` | `PublicAPI.gs` — valor do frete formatado | ✅ Confirmado |
| `address` | `PublicAPI.gs` — endereço do destino | ✅ Confirmado |
| `addressShort` | `PublicAPI.gs` — endereço resumido | ✅ Confirmado |
| `label` | `PublicAPI.gs` — label do endereço | ✅ Confirmado |
| `startFromISO` | `PublicAPI.gs` — data de início | ✅ Confirmado |

---

## 12. Campos com origem externa

| Campo | Origem externa | Como entra no fluxo |
|-------|----------------|---------------------|
| `slot.date`, `slot.team`, `slot.availStr` | Planilha de agenda/disponibilidade | `getSlots()` lê da planilha |
| `ponto.addr`, `ponto.eventTitle` | Planilha de agenda (`shAg`) | `coletarPontosDoDia()` lê linhas da planilha (`vals`, `disp`) |
| `ponto.loc` | Geocoding (Nominatim, Google, etc.) | Geocode do endereço do evento |
| `slot.loc` (origem) | Geocoding | `geocodeAddressFree(DEPOSIT_ADDRESS)` ou casa da equipe |
| `delta` | OSRM / Haversine | `getDrivingKm()` ou `haversineKm()` |
| `nearestPoint.distancia` | OSRM | `getDrivingKmBatch()` |
| `config` (limites) | Planilha de config | `loadFreightParams()`, `getConfig()` |
| `form.*` | Frontend/modal | Parâmetros da busca (CEP, tempo, tipo de berço, etc.) |

---

## 13. Pontos sensíveis

| Risco | Descrição |
|-------|-----------|
| **Campo opcional tratado como obrigatório** | `nearestPoint` é opcional (slot vazio), mas o ranking assume que existem pontos para comparar |
| **Campo inferido sem validação** | `cep` em `nearestPoint` pode ser `null` se o geocoding falhar |
| **Diferença de nome** | `team` no Apps Script vs `equipe` no frontend — normalização ocorre no retorno |
| **Data como `Date` vs string** | Internamente é `Date`; no payload vai como string (`dateDM`, `dateISO`) |
| **Distância em km** | `delta` e `nearestPoint.distancia` estão em **km** (não metros) — cuidado com OSRM que pode retornar metros |
| **Equipe normalizada** | `normTeam()` normaliza para 'EQUIPE 1' ou 'EQUIPE 2'; texto bruto da planilha pode variar |
| **Tipo de candidato vindo de regra externa** | O tipo (normal/especial/premium) é determinado por limites de km vindos da config, não de um campo do slot |

---

## 14. O que pode virar tipo TypeScript depois

Possíveis interfaces futuras (sem criar agora):

1. **`SlotLegado`** — representa o slot bruto da planilha
2. **`CandidatoLegado`** — representa o candidato enriquecido (slot + delta + nearestPoint)
3. **`PontoAgendaLegado`** — representa um ponto de entrega (linha da planilha de agenda `shAg`)
4. **`NearestPointLegado`** — representa a âncora mais próxima do novo destino
5. **`PayloadCandidatoLegado`** — representa o objeto retornado ao frontend (com `rank`, `weekday`, `tipo`, `frete`)
6. **`Coordenada`** — já existe em `motor/distancia.ts` (`{ lat: number, lng: number }`)

---

## 15. O que ainda não está claro

- ❓ O campo `rank` no payload é sempre `0` ou existe lógica de cálculo? No código (`PublicAPI.gs`, linha 867) é `c.rank || 0`, sugerindo que não é calculado no motor.
- ❓ O campo `label` no payload é a string de endereço formatada ou um identificador? Vem de `meta.label` ou `payload.label`.
- ❓ A estrutura exata do objeto `ponto` pode ter mais campos além dos listados (como `id`, `eventId`, `calendarId`) — confirmado apenas o que é usado no código auditado.
- ❓ O campo `availStr` tem formato padronizado? No código é tratado como string opaca.
- ✅ **Corrigido nesta revisão**: A origem de `ponto` é a planilha de agenda (`shAg`), não o Google Calendar. `eventTitle` vem de `disp[i][2]` (coluna 3 da planilha), não de evento do Calendar. Google Calendar (`CalendarApp`) só é usado no pré-agendamento (`preAgendarDireto`), nunca no motor de busca de datas.

---

## 16. Próxima etapa recomendada

**Criar fixtures de caracterização com payloads pequenos** — Documentar em um novo arquivo (`docs/procurar-datas-fixtures.md`) exemplos reais de payloads de entrada e saída do Apps Script, para servir como "contrato de comportamento" na futura migração.

Isso preservará exemplos concretos de:
- Payload de busca (formulário)
- Payload de resposta (candidatos)
- Estado intermediário (slots, pontos)

Sem implementar código, apenas documentar.
