# Critérios de ranking de candidatos — `/procurar-datas`

## 1. Objetivo

Este documento registra a regra atual do Apps Script para futura migração do motor v2.  
Aqui estão catalogados os critérios de ordenação, comparação e seleção de candidatos (slots) usados na geração do ranking de datas viáveis para entrega.

---

## 2. Escopo

- Este documento é **apenas documentação**.
- **Não altera código**.
- **Não altera produção**.
- **Não substitui testes**.
- Serve como referência para quando a equipe decidir migrar a lógica de seleção de slots.

---

## 3. Fontes auditadas

| Arquivo | Trechos principais | Funções / Linhas |
|---------|---------------------|-------------------|
| `appscript/CEP-CONFIG.gs` | Ordenação e desempate de candidatos por região | Linhas ~2380–2440 (comparador principal), ~2301 (diffDias) |
| `appscript/CEP-APIBACK.gs` | Ordenação de slots, fastPass, seleção por tipo | Linhas ~672 (slots.sort), ~786–791 (fastPass), ~836–863 (selecionarConjuntoApp3ComExtras_), ~1232–1238 (por tipo), ~1309–1362 (lista final) |
| `appscript/PublicAPI.gs` | Retorno dos resultados ao cliente | Uso de `rank` nos objetos retornados |

---

## 4. Visão geral do fluxo

Em alto nível, o Apps Script:

1. **Carrega slots** da planilha de agenda/disponibilidade.
2. **Filtra** slots inválidos (equipe inativa, quarta-feira + EQUIPE 2 + tempo > 150min, etc.).
3. **Enriquece** cada slot com pontos de entrega (âncoras geográficas) e calcula distâncias.
4. **Classifica** candidatos em tipos: normal, especial, premium, hora marcada.
5. **Ordena** por prioridade e desempata com regras específicas.
6. **Seleciona** o conjunto final de datas a exibir.
7. **Retorna** ao cliente com `rank`, data, equipe e delta.

---

## 5. Critérios principais de ordenação

### 5.1 Ordenação inicial de slots

```javascript
slots.sort((a,b) => a.date - b.date)
```

- Slots são ordenados cronologicamente antes de qualquer processamento.

### 5.2 Fast Pass (pré-seleção por proximidade)

```javascript
fastPassNormais.sort(function(a,b){ return a.delta - b.delta; })
fastPassExtras.sort(function(a,b){ return a.delta - b.delta; })
```

- Dentro de uma região, candidatos são ordenados por **menor delta** (distância em km).
- Pegam-se no máximo 2 de cada categoria.

### 5.3 Comparador principal (região)

Local: `CEP-CONFIG.gs`, linhas ~2380–2440.

**Prioridade 1 — Dia aberto vs fechado**
- Se um candidato tem `nearestPoint` e pontos (`pontos.length > 0`) e o outro não, o **aberto vence**.
- Representado por: `bAberto - aAberto`.

**Prioridade 2 — Data mais próxima**
- Se as datas forem diferentes: `a.date - b.date` (mais c primeiro).

**Prioridade 3 — Consolidação fraca**
- Se ambos têm mesma data, equipe diferente, e diferença de pontos >= 2: o com **mais pontos** vence.
- Representado por: `b.pontos.length - a.pontos.length`.

**Prioridade 4 — Equipe na região (mesmo dia, equipes diferentes)**
- Se ambos são abertos, mesma data, equipes diferentes: vence quem tem **âncora mais próxima** do destino.
- Usa `nearestPoint.distancia`.

**Prioridade 5 — Evitar vazio / Reintrodução**
- Candidatos ocultos por dominação podem ser reintroduzidos se evitam deixar a região vazia.
- Após reintrodução, reordena-se: `mantidos.sort(function(a, b) { return a.date - b.date; })`.

### 5.4 Seleção final por tipo (`selecionarConjuntoApp3ComExtras_`)

Local: `CEP-APIBACK.gs`, linhas ~836–863.

- **Normal**: até 3 dias únicos
- **Especial**: 1 dia único
- **Premium**: 1 dia único
- **Hora marcada**: 1 dia único

Função `pushUnicos` evita repetir a mesma data dentro do conjunto.

### 5.5 Ordenações finais

```javascript
listaApp.sort(byDate)  // byDate = (a,b) => a.date - b.date
lista.sort(function(a,b){ return a.date - b.date; })
```

- Após seleção, todas as listas são reordenadas cronologicamente antes de retornar ao cliente.

---

## 6. Tipos de candidatos

| Tipo | Origem confirmada no código | Observação |
|------|----------------------------|------------|
| **Normal** | `porDiaBestNormal`, `fastPassNormais` | Candidato padrão, sem adicionais |
| **Especial** | `porDiaBestEspecial` | Candidato com valor adicional especial |
| **Premium** | `porDiaBestPremium` | Candidato com valor adicional premium |
| **Hora marcada** | `porDiaHoraMarcada` | Candidato com horário específico |

> Nota: A distinção entre os tipos parece vir de parâmetros do formulário (`form.tipo`) e/ou de regras de negócio da planilha de config. Não confirmado se há enumeração explícita no Apps Script.

---

## 7. Dependências da lógica

- ✅ **agenda/disponibilidade** — slots vêm da planilha
- ✅ **OSRM** — cálculo de distância de rota (`getDrivingKm`)
- ✅ **geocoding** — resolução de endereços para coordenadas
- ✅ **config** — parâmetros de janela (`JANELA_DIAS`), limite de dias
- ✅ **frete** — indiretamente, via tipo de candidato
- ✅ **distância** — haversine (filtro rápido) e OSRM (distância real)
- ✅ **datas** — `diffDias`, comparação de datas
- ✅ **equipe** — `normTeam`, validação de equipe ativa
- ✅ **tempo** — `serviceMin`, regra de quarta-feira
- ✅ **logs/auditoria** — `dlog`, `alog_` dentro da lógica de decisão
- ✅ **seleção de slots** — motor principal, não separável

---

## 8. Pontos sensíveis

| Risco | Descrição |
|-------|-----------|
| **Divergência silenciosa** | Bug sutil na ordenação pode mudar datas exibidas sem erro visível |
| **Alteração de ordem das datas** | Cliente pode ver datas completamente diferentes |
| **Mudança de desempate** | Critérios de consolidação fraca e equipe/região são sensíveis |
| **OSRM vs Haversine** | Filtro rápido usa haversine; decisão final usa OSRM. Divergência pode ocorrer |
| **Timezone** | `formatDatePt` usa GMT-3. Node.js pode comportar-se diferente |
| **Mudança em equipe** | Regra de equipe inativa ou quarta-feira + EQUIPE 2 afeta filtragem |
| **Janela de dias** | `JANELA_DIAS` controla quão distantes candidatos competem entre si |
| **Candidatos ocultos/reintroduzidos** | Lógica de dominação e fallback é complexa e acoplada |

---

## 9. O que pode virar helper puro depois

Oportunidades identificadas (sem implementar agora):

1. **Comparador simples por data** — `(a, b) => a.date.getTime() - b.date.getTime()`
2. **Comparador simples por delta** — `(a, b) => a.delta - b.delta`
3. **Deduplicação pura por data** — função que recebe array e remove datas repetidas
4. **Função pura de classificação por tipo** — dado um objeto, retorna 'normal' | 'especial' | 'premium' | 'hora-marcada'
5. **Cálculo puro de janela** — `diffDias` já portado em `motor/datas.ts`

---

## 10. O que não deve ser portado ainda

- ❌ Lógica completa de `selecionarConjuntoApp3ComExtras_` — depende de agenda/config
- ❌ Comparador principal de região — depende de `nearestPoint`, `pontos`, `dlog`, `alog_`
- ❌ Regra de reintrodução de candidatos — depende de estado mutável e logs
- ❌ Fast pass completo — depende de cálculo de delta (OSRM/Haversine)
- ❌ Filtro de equipe inativa — depende de planilha de disponibilidade
- ❌ Regra de quarta-feira + EQUIPE 2 — depende de agenda e tempo de serviço

---

## 11. Próxima etapa recomendada

**Mapear estrutura de dados dos candidatos (payload)** — Documentar em um novo arquivo (`docs/procurar-datas-estrutura-candidato.md`) a forma exata dos objetos `slot`, `candidato`, `nearestPoint`, `ponto` usados no Apps Script.

Isso criará a base de tipos (`interface Candidato`, `interface Slot`, etc.) para quando os comparadores forem portados.
