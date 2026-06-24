# Plano de Comparação Operacional — Legado vs Motor v2

> **Data:** 15 de junho de 2026
> **Agente:** Cascade
> **Status:** Planejamento — sem implementação
> **Propósito:** Orientar a futura comparação operacional entre o legado (Apps Script) e o motor v2 (Next.js), definindo entradas, alinhamentos, algoritmo, critérios de aprovação e sequência segura.
> **Não altera código. Não altera produção. Não substitui leitura real do código.**

---

## 1. Estado atual

### 1.1 O que já está implementado e validado

| Componente | Arquivo | Status |
|-----------|---------|--------|
| Comparação estrutural legado × v2 | `comparacao-legado-v2.ts` | ✅ Produção diagnóstica |
| Rota de comparação estrutural | `v2/comparar/route.ts` | ✅ Funcional (fixtures) |
| Parser planilha TEMPO DISPONIVEL | `parse-disponibilidade-tempo-disponivel.ts` | ✅ 54 testes passando |
| Leitura real planilha (diagnóstico) | `disponibilidade-real-helper.ts` | ✅ Funcional (310 linhas) |
| Geração de candidatos (dados reais parseados) | `gerar-candidatos-disponibilidade-real.ts` | ✅ 40 testes — **não integrado à rota** |
| Adapter v2 → contrato legado | `adaptador-candidato-legado.ts` | ✅ Com `legado-gmt3` |
| Total testes passando | — | ✅ 497 |

### 1.2 O que ainda é sintético ou ausente no v2

| Lacuna | Impacto na comparação operacional |
|--------|-----------------------------------|
| `kmAdicionalNaRotaM` (delta de inserção) | Classificação errônea — não há pontos de agenda reais |
| OSRM real (distância por estradas) | Frete diverge do legado para todos os endereços |
| Pontos de entrega do dia (planilha AGENDA) | Delta impossível de calcular sem `coletarPontosDoDia()` |
| Coordenadas reais do depósito | Haversine parte de origem incorreta |
| Disponibilidade integrada na rota `/v2/diagnostico` | Candidatos ainda usam dados sintéticos na rota principal |

### 1.3 O que é "comparação estrutural" (já existente)

A comparação estrutural (`comparacao-legado-v2.ts` + `GET /v2/comparar`) verifica:
- Se os campos obrigatórios do contrato legado estão presentes na fixture
- Se as contagens de normais e extras batem com o que o frontend espera
- Se os tipos de candidatos presentes são reconhecidos
- Se `isExtra` está correto para cada tipo
- Se ranks são numéricos e únicos

**Não compara** valores de frete, datas, equipes, distâncias nem qualquer dado operacional.

### 1.4 O que é "comparação operacional" (objetivo futuro)

Comparar para os mesmos inputs (CEP/coords, `tempoNecessario`, `dataInicial`, flags) se:
- O v2 retorna candidatos do mesmo tipo que o legado
- As datas dos candidatos estão dentro de uma janela aceitável
- Os fretes são compatíveis (dentro de tolerância)
- A disponibilidade usada é real (não sintética)

---

## 2. Contrato legado observado (confirmado nas fixtures)

### 2.1 Payload de entrada (confirmado nas duas fixtures)

| Campo | Tipo | Exemplo fixture 1 | Exemplo fixture 2 |
|-------|------|-------------------|-------------------|
| `cep` | string | `"81020-220"` | `"83045-350"` |
| `lat` / `lng` | number | `-25.4902406` / `-49.293839` | `-25.5314` / `-49.1781` |
| `destLat` / `destLng` | number | idem lat/lng | idem lat/lng |
| `destDisplay` | string | endereço completo | endereço completo |
| `dataInicial` | string YYYY-MM-DD | `"2026-06-13"` | `"2026-06-13"` |
| `tempoNecessario` | string HH:MM | `"01:00"` | `"01:00"` |
| `isRural` | boolean | `false` | `false` |
| `isCondominio` | boolean | `false` | `false` |
| `tipoBerco` / `roupeiro` | string | `""` | `""` |

### 2.2 Estrutura do candidato legado (confirmado nas duas fixtures)

Todos os candidatos têm os seguintes campos:

| Campo | Tipo | Exemplo | Obrigatoriedade |
|-------|------|---------|-----------------|
| `dateISO` | string | `"2026-06-23T03:00:00.000Z"` | Obrigatório |
| `dateDM` | string DD/MM | `"23/06"` | Obrigatório |
| `weekday` | string pt-BR | `"Terça"` | Obrigatório |
| `tipo` | string | `"normal"` / `"especial"` / `"premium"` | Obrigatório |
| `isExtra` | boolean | `false` (normal) / `true` (especial/premium) | Obrigatório |
| `rank` | number inteiro | `1`, `2`, `3` | Obrigatório |
| `team` | string | `"EQUIPE 1"` | Obrigatório |
| `frete` | string | `"R$ 110"` | Obrigatório |
| `avisoHoraMarcada` | string | `""` | Obrigatório (vazio ou texto) |
| `daysLeftTxt` | string | `"11 d"` | Obrigatório |
| `encomenda` | string | `"Não"` | Obrigatório |

### 2.3 Estrutura da resposta legado (confirmado)

```
progress.payload.candidates     → todos os candidatos juntos (normais + extras)
progress.normais                → somente candidatos com isExtra: false
progress.extras                 → somente candidatos com isExtra: true
```

- `dateISO` sempre tem sufixo `T03:00:00.000Z` (GMT-3)
- Ranks são **globais** entre normais e extras (1, 2, 3… sem reiniciar por tipo)
- Fixture 1: 3 normais, 0 extras — `candidates` = `normais`
- Fixture 2: 3 normais + 2 extras — 5 candidatos total, mix de tipos

### 2.4 Contrato observado por tipo

| Tipo | isExtra | Frete observado | Observações |
|------|---------|-----------------|-------------|
| `normal` | `false` | R$ 110–R$ 180 | Distância adicional dentro do limite base |
| `especial` | `true` | R$ 220 | Distância adicional até limite especial |
| `premium` | `true` | R$ 320 | Distância adicional até limite premium |
| `hora-marcada` | `true` | — | Não capturado em fixture real ainda |

---

## 3. Contrato v2 atual (diagnóstico)

### 3.1 O que o v2 produz hoje via adapter

Com `adaptarCandidatoV2ParaContratoLegadoDiagnostico({ ..., formatoDateISO: 'legado-gmt3' })`:

| Campo | Como é gerado | Status |
|-------|--------------|--------|
| `dateISO` | String montada determinística `YYYY-MM-DDT03:00:00.000Z` | ✅ Compatível com legado |
| `dateDM` | Derivado de `dateISO` no adapter | ✅ Compatível |
| `weekday` | Calculado por dia da semana em português | ✅ Compatível |
| `tipo` | Vem de `CandidatoPreliminarV2.tipo` | ✅ Compatível |
| `isExtra` | Derivado do tipo: `normal` → `false`, demais → `true` | ✅ Compatível |
| `rank` | Passado explicitamente (índice + 1) | ✅ Compatível |
| `team` | Normalizado para `"EQUIPE 1"` / `"EQUIPE 2"` | ✅ Compatível |
| `frete` | Calculado por `calcularFrete` com Haversine | ⚠️ Diverge do OSRM |
| `avisoHoraMarcada` | Gerado pelo adapter para `hora-marcada` | ✅ Compatível |
| `daysLeftTxt` | Calculado relativo à data de referência | ✅ Compatível |
| `encomenda` | Hardcoded `"Não"` no adapter (diagnóstico) | ⚠️ Não confirmado para isEncomenda: true |

### 3.2 O que `gerar-candidatos-disponibilidade-real.ts` produz

Com disponibilidade real já parseada (`DisponibilidadeEquipeDataV2[]`):

- Filtra por janela de datas usando `filtrarDisponibilidadePorJanelaV2`
- Classifica cada data × equipe usando `classificarCandidatoOperacionalV2`
- Monta cada candidato usando `montarCandidatoPreliminarV2`
- Ordena usando `ordenarCandidatosDiagnosticosV2`

**Limitação crítica:** `kmAdicionalNaRotaM` precisa ser passado externamente. Sem esse valor, todos os candidatos classificam como `indisponivel`. O delta real só é calculável com `coletarPontosDoDia()` + OSRM.

---

## 4. Lacunas de equivalência

### 4.1 Tabela completa de lacunas

| Dimensão | Legado | v2 atual | Lacuna | Bloqueante para comparação? |
|----------|--------|----------|--------|-----------------------------|
| Disponibilidade | Planilha real `shAv` + filtros de equipe ativa | Planilha real (helper) — **não integrado à rota** | Integração pendente | Sim |
| `kmAdicionalNaRotaM` | Delta OSRM da inserção do destino na rota do dia | Precisa ser passado externamente — sem agenda real | Agenda (`shAg`) ausente | Sim — bloqueia classificação normal/especial/premium |
| Distância total (frete) | OSRM real | Haversine | Pode divergir ±10-30% dependendo do endereço | Não para estrutura; sim para valores de frete |
| Coordenadas do depósito | Geocodificadas em runtime pelo Apps Script | `LAT DEPOSITO` / `LNG DEPOSITO` no Supabase com `valor = NULL` | Não confirmadas | Sim para frete e delta |
| Filtros de equipe | `carregarEquipesAtivas_()` + regra produto + regra quarta-feira | Apenas `ativa` do parser | Filtros de produto e quarta-feira ausentes no v2 | Parcialmente |
| `hora-marcada` | `slotAvailMin >= serviceMin + HORA_MARCADA_HORAS_A_MAIS * 60` | `horaMarcada` flag no input da classificação | Flag não derivado da disponibilidade real ainda | Sim |
| Número de candidatos | Determinado pela agenda real | Depende de `kmAdicionalNaRotaM` disponível | Sem agenda, não comparável | Sim |
| `daysLeftTxt` | Calculado relativo à data de início da busca | Calculado relativo a `dataReferenciaISO` | Pode diferir se datas de referência divergirem | Não bloqueante |
| `encomenda` | Campo real do legado | Hardcoded `"Não"` | Não impacta lógica de datas | Baixo |

---

## 5. Dados necessários para comparação operacional

### 5.1 Entradas que precisam ser alinhadas (campo a campo)

#### `dataInicialISO` / janela de pesquisa

- **Legado:** `_resolveStartFromDate_(form)` — usa `form.dataInicial` (YYYY-MM-DD) como início da janela
- **v2:** `gerarJanelaDatasPesquisaV2({ dataInicialISO, diasJanela })` — usa mesma lógica
- **Alinhamento:** passar o mesmo `dataInicial` do request legado como `dataInicialISO` no v2
- **Risco:** O legado usa `DIAS DE PESQUISA NA AGENDA` da config (não confirmado o valor real); o v2 usa `diasJanela` do input ou default. Confirmar o valor antes da comparação.

#### `tempoNecessarioMin`

- **Legado:** `parseMinutes(form.tempoNecessario)` — ex: `"01:00"` → `60`
- **v2:** `parseMinutos(tempoNecessario)` — mesma lógica confirmada
- **Alinhamento:** direto — os parsers são equivalentes

#### CEP / endereço / coordenadas

- **Legado:** recebe `lat`, `lng`, `cep`, `enderecoCompleto` do frontend; geocodifica o depósito em runtime
- **v2:** deve receber os mesmos campos; depósito precisa ter coordenadas válidas
- **Risco:** `LAT DEPOSITO` / `LNG DEPOSITO` no Supabase estão com `valor = NULL`; precisam ser preenchidas e validadas antes de qualquer cálculo

#### Frete

- **Legado:** `calcularFrete(distKm_OSRM, isSabado, isRural, isCondo)` → valor string `"R$ 110"`
- **v2:** `calcularFrete(distKm_Haversine, isSabado, isRural, isCondo)` → valor numérico antes de formatar
- **Alinhamento:** usar mesma função de cálculo; diferença está na distância de entrada (OSRM vs Haversine)
- **Tolerância proposta:** frete pode divergir enquanto OSRM não estiver integrado; documentar divergência por fixture

#### Disponibilidade

- **Legado:** `getSlots(shAv, serviceMin, LOOK_DAYS)` filtra `avail >= serviceMin` + equipes ativas
- **v2:** `parsearDisponibilidadeTempoDisponivelV2` + `filtrarDisponibilidadePorJanelaV2` com `tempoNecessarioMin`
- **Alinhamento:** usar mesma data de início, mesmo `tempoNecessarioMin`, mesma janela
- **Risco:** `LOOK_DAYS` do legado pode diferir do `diasJanela` do v2; confirmar antes da comparação

#### `kmAdicionalNaRotaM` (delta de inserção)

- **Legado:** calculado pelo loop de simulação com `coletarPontosDoDia()` + OSRM → `bestKm` em km
- **v2:** precisa ser passado externamente; sem agenda real, usar `0` como placeholder e documentar como "sem agenda"
- **Risco:** com `kmAdicionalNaRotaM: 0`, todos os candidatos elegíveis classificarão como `normal` — isso é **sintaticamente incorreto** para casos premium/especial

#### OSRM / distância

- **Legado:** `getDrivingKm(origem, destino)` → km por estradas
- **v2 atual:** `haversineKm(origem, destino)` → km em linha reta
- **Alinhamento futuro:** criar `calcularDistanciaOsrm()` com fallback Haversine, conforme planejado em `procurar-datas-v2-proximas-etapas-operacionais.md` (Etapa 3)
- **Para comparação inicial:** usar Haversine e documentar divergência esperada

---

## 6. Algoritmo proposto de comparação operacional

### 6.1 Pré-condições obrigatórias

Antes de iniciar qualquer comparação operacional:

1. `gerar-candidatos-disponibilidade-real.ts` integrado na rota `/v2/diagnostico` (não ainda — próxima etapa)
2. `buscarDisponibilidadeRealDiagnostica()` chamado com o mesmo `dataInicialISO` da pesquisa
3. Coordenadas do depósito confirmadas e preenchidas no Supabase
4. `kmAdicionalNaRotaM` definido de forma explícita (placeholder `0` ou OSRM real)
5. Os mesmos inputs (CEP/coords, `tempoNecessario`, `dataInicial`, flags) passados para legado e v2

### 6.2 Fluxo de comparação por fixture

```
Para cada fixture capturada:

1. Extrair do request da fixture:
   - cep, lat, lng, dataInicial, tempoNecessario, isRural, isCondominio

2. Extrair do response da fixture (legado):
   - candidates[]    → lista completa com ranks globais
   - normais[]       → isExtra: false
   - extras[]        → isExtra: true

3. Executar v2 com mesmos inputs:
   - buscarDisponibilidadeRealDiagnostica(dataInicial, ...)
   - gerarCandidatosComDisponibilidadeRealV2({ janela, disponibilidades, tempoNecessarioMin, distanciaKm, kmAdicionalNaRotaM, configOperacional })
   - adaptarCandidatoV2ParaContratoLegadoDiagnostico({ ..., formatoDateISO: 'legado-gmt3' }) para cada candidato elegível

4. Comparar resultados:
   - Contagem de normais: legado vs v2
   - Contagem de extras: legado vs v2
   - Tipos presentes: legado vs v2
   - Datas: verificar se datas do v2 estão na mesma janela das datas do legado
   - isExtra: comparar por tipo
   - frete: comparar por tipo (dentro de tolerância)
   - rank: comparar posição relativa
   - team: comparar equipe
   - dateISO: verificar formato legado-gmt3
   - dateDM: verificar consistência com dateISO
   - weekday: verificar consistência com dateISO

5. Registrar divergências:
   - Tipo: [estrutural | valor | ordem | ausente]
   - Campo: qual campo diverge
   - Esperado (legado) vs Obtido (v2)
   - Causa provável
   - Bloqueante: sim/não
```

### 6.3 Métricas de divergência propostas

| Métrica | Como medir | Tolerância |
|---------|-----------|------------|
| `deltaContagemNormais` | `|qtd_normais_legado - qtd_normais_v2|` | 0 na fase de paridade; ≤1 em fase inicial |
| `deltaContagemExtras` | `|qtd_extras_legado - qtd_extras_v2|` | 0 na fase de paridade |
| `tiposMissing` | Tipos no legado ausentes no v2 | 0 bloqueante |
| `tiposSpurious` | Tipos no v2 ausentes no legado | Documentar — não necessariamente bloqueante |
| `deltaFrete` | `|valor_legado_R - valor_v2_R|` por candidato de mesmo tipo | ≤ R$ 10 aceitável; > R$ 30 bloqueante |
| `deltaDataDias` | Diferença em dias entre data legado e data v2 para mesmo rank | ≤ 7 dias aceitável; > 14 dias preocupante |
| `isExtraCorreto` | `isExtra do v2 === isExtra do legado` para cada tipo | 100% obrigatório |
| `dateISOFormato` | Matches regex `^\d{4}-\d{2}-\d{2}T03:00:00\.000Z$` | 100% obrigatório |
| `weekdayConsistente` | `weekday` bate com dia da semana de `dateISO` | 100% obrigatório |
| `dateDMConsistente` | `dateDM` bate com DD/MM de `dateISO` | 100% obrigatório |

---

## 7. Critérios de aprovação por fase

### 7.1 Fase 1 — Comparação estrutural com disponibilidade real integrada

Pré-requisito: `gerar-candidatos-disponibilidade-real.ts` integrado à rota diagnóstica.

| Critério | Obrigatório? | Justificativa |
|----------|:---:|---------------|
| v2 retorna ao menos 1 candidato elegível quando legado retorna candidatos | Sim | Prova que a disponibilidade real funciona de ponta a ponta |
| `dateISO` no formato `legado-gmt3` (`YYYY-MM-DDT03:00:00.000Z`) | Sim | Compatibilidade de contrato |
| `isExtra` correto por tipo (`normal: false`, demais: `true`) | Sim | Regra central do contrato legado |
| `dateDM` e `weekday` consistentes com `dateISO` | Sim | Integridade do candidato |
| `team` normalizado como `EQUIPE 1` ou `EQUIPE 2` | Sim | Contrato de equipe |
| Nenhuma chamada a Apps Script, planilha de produção, OSRM real | Sim | Isolamento diagnóstico |
| Frete v2 dentro de R$ 30 do frete legado para tipo `normal` | Não (registrar) | OSRM pendente |
| Contagem de normais v2 ≥ 1 quando legado tem 3 normais | Não (registrar) | Agenda `shAg` pendente |

### 7.2 Fase 2 — Comparação operacional com agenda real

Pré-requisito: `coletarPontosDoDia()` equivalente no v2 + OSRM real integrado.

| Critério | Obrigatório? |
|----------|:---:|
| v2 retorna ≥ N normais quando legado retorna N normais (mesma janela) | Sim |
| Tipos `normal`, `especial`, `premium` presentes no v2 quando presentes no legado | Sim |
| `frete` dentro de R$ 10 para tipo `normal` com OSRM real | Sim |
| Datas dos normais do v2 dentro de 7 dias das datas do legado | Sim |
| Ranks relativos compatíveis (melhor tipo = menor rank) | Sim |
| `hora-marcada` classificado corretamente quando slot tem tempo suficiente | Sim |
| Zero candidatos `indisponivel` com causa "kmAdicionalNaRotaM ausente" | Sim |

### 7.3 Critérios que BLOQUEAM integração futura ao frontend

| Situação bloqueante | Impacto |
|--------------------|---------|
| v2 retorna candidatos com `dateISO` em formato errado | Frontend quebra — campo obrigatório para exibição de data |
| v2 retorna `isExtra` incorreto | Frontend separa candidatos em `normais` e `extras` por este campo |
| v2 retorna tipo desconhecido (fora de `normal`/`especial`/`premium`/`hora-marcada`) | Frontend pode não renderizar candidato |
| v2 usa disponibilidade sintética em qualquer modo não-debug | Datas incorretas chegam ao usuário |
| v2 usa `kmAdicionalNaRotaM: 0` sem sinalizador diagnóstico | Todos candidatos normais — incorreto para endereços distantes |
| Frete diverge > R$ 30 sem explicação documentada | Expectativa errada do usuário no modal |

---

## 8. Campos ainda diagnósticos — não equivalentes hoje

| Campo | Por que não equivalente | Quando pode ser equivalente |
|-------|------------------------|----------------------------|
| `frete` | Haversine ≠ OSRM | Quando OSRM real integrado e coordenadas depósito validadas |
| `tipo` (quando especial/premium) | `kmAdicionalNaRotaM` precisa de agenda real | Quando `coletarPontosDoDia()` equivalente implementado |
| `rank` (ordem global) | Ordenação v2 é por tipo, não por data+delta | Quando ranking real implementado com delta real |
| Contagem de candidatos | Depende de agenda real para delta | Quando agenda integrada |
| `hora-marcada` | Flag `horaMarcada` não derivado da disponibilidade real ainda | Quando lógica `slotAvailMin >= serviceMin + HORA_MARCADA_HORAS_A_MAIS * 60` portada |
| `daysLeftTxt` | Pequena divergência possível por data de referência diferente | Já quase equivalente — confirmar data base |
| `encomenda` | Hardcoded `"Não"` no adapter | Quando campo `isEncomenda` integrado ao adapter |

---

## 9. Riscos antes de ligar ao frontend

| Risco | Probabilidade | Impacto | Mitigação |
|-------|:---:|:---:|-----------|
| Disponibilidade real difere entre leitura legado e v2 (timing, cache, janela) | Média | Alto | Capturar as duas leituras no mesmo segundo, com mesma janela e mesmo `tempoNecessarioMin` |
| `LAT DEPOSITO`/`LNG DEPOSITO` com `valor = NULL` lidos acidentalmente por algum helper | Baixa | Alto | Validar que nenhuma rota lê essas linhas antes de preencher; não preencher sem confirmação das coordenadas reais |
| `kmAdicionalNaRotaM: 0` subir para produção classificando tudo como `normal` | Média | Crítico | Exigir sinalizador `modoDiagnostico: true` obrigatório; nunca aceitar `0` sem flag explícita |
| OSRM inacessível a partir do Next.js | Desconhecida | Alto | Testar acessibilidade antes de qualquer integração; manter fallback Haversine documentado |
| Legado e v2 com janelas de data diferentes por configuração (`LOOK_DAYS`) | Média | Médio | Confirmar valor de `LOOK_DAYS` no Supabase antes da comparação |
| Planilha `shAv` muda formato sem aviso | Baixa | Alto | Manter testes de contrato no parser; não assumir colunas fixas |
| `normTeam()` rejeita equipes com nomes inesperados na planilha real | Baixa/Média | Médio | Monitorar `erros[]` do parser em cada leitura diagnóstica |
| Integração prematura expõe candidatos com dados sintéticos ao usuário | — | Crítico | Nunca integrar ao frontend antes da Fase 2 completa |

---

## 10. Sequência segura de implementação

```
Passo 1 — [Backend isolado] Integrar gerar-candidatos-disponibilidade-real.ts na rota /v2/diagnostico
  → Aceitar flag opcional usarDisponibilidadeRealDiagnostica: true
  → Quando flag presente: chamar buscarDisponibilidadeRealDiagnostica() e gerarCandidatosComDisponibilidadeRealV2()
  → Bloco de resultado separado no JSON: diagnosticoDisponibilidadeReal
  → Não substituir bloco diagnóstico existente
  → Confirmar que nenhuma rota de produção é afetada
  → Escrever/atualizar testes para o novo bloco
  → Validar: npx tsc --noEmit, npx vitest run

Passo 2 — [Documentação] Capturar fixture de disponibilidade real
  → Chamar GET /api/procurar-datas/v2/diagnostico?usarDisponibilidadeRealDiagnostica=true
  → Registrar amostra de disponibilidades em docs/fixtures/procurar-datas/disponibilidade-real-YYYY-MM-DD.json
  → Sem dados de clientes ou sensíveis

Passo 3 — [Backend isolado] Confirmar coordenadas do depósito
  → Consultar Supabase procurar_datas_config: LAT DEPOSITO e LNG DEPOSITO
  → Se NULL: definir coordenadas reais e preencher (com aprovação explícita)
  → Validar contra endereço documentado (R. Dr. Francisco Soares, 860, Curitiba-PR, 81030-450)
  → Nunca usar NULL em cálculo de distância

Passo 4 — [Backend isolado] Primeiro candidato elegível com disponibilidade real
  → Verificar se gerarCandidatosComDisponibilidadeRealV2 retorna ao menos 1 candidato elegível com dados reais
  → Registrar resultado em log_progress.md
  → Não comparar com legado ainda — apenas confirmar fluxo puro

Passo 5 — [Backend isolado] Comparação estrutural legado × v2 com disponibilidade real
  → Para uma das duas fixtures capturadas, passar os mesmos inputs para o v2 com disponibilidade real
  → Adaptar candidatos v2 com formatoDateISO: 'legado-gmt3'
  → Rodar compararFixtureLegadoComContratoV2 no resultado v2
  → Documentar divergências no novo bloco diagnóstico da rota /v2/comparar
  → NÃO alterar os blocos existentes da rota

Passo 6 — [Documentação] Mapear agenda real (shAg)
  → Apenas documentação, sem código
  → Ler coletarPontosDoDia() no CEP-CONFIG.gs
  → Documentar estrutura de colunas, geocoding e lógica de delta
  → Registrar em docs/procurar-datas-v2-mapeamento-agenda-shag.md

Passo 7 — [Backend isolado] OSRM real ou delta documentado
  → Confirmar URL e acessibilidade do OSRM a partir do Next.js
  → Criar helper calcularDistanciaOsrm() com fallback Haversine e flag tipoDistancia
  → Comparar resultados para os inputs das duas fixtures capturadas
  → Documentar diferença OSRM × Haversine para cada caso

Passo 8 — [Backend isolado] Agenda real mínima (coletarPontosDoDia equivalente)
  → Apenas quando Passo 6 e 7 estiverem concluídos
  → Criar helper puro que calcula delta sem I/O
  → Integrar leitura real de shAg apenas em rota diagnóstica
  → Calcular kmAdicionalNaRotaM real para pelo menos 1 caso

Passo 9 — [Comparação operacional] Comparar legado × v2 completo
  → Com disponibilidade real + distância real + delta (mesmo que aproximado)
  → Para as 2 fixtures existentes + 2 novos casos (sábado, sem disponibilidade)
  → Registrar métricas de divergência: contagem, tipos, datas, fretes
  → Documentar quais divergências são aceitáveis e quais bloqueiam integração

Passo 10 — [Shadow mode] Integração silenciosa
  → Somente após Passo 9 aprovado com critérios da Fase 2 atendidos
  → Frontend continua no legado
  → v2 roda em paralelo, logado, não exibido
  → Aprovação explícita do responsável pelo produto

Passo 11 — [A/B + substituição gradual]
  → Somente após Passo 10 validado
  → Detalhes em procurar-datas-v2-proximas-etapas-operacionais.md
```

---

## 11. Fixtures adicionais necessárias

As duas fixtures existentes cobrem apenas:
- `caso-normal-simples` — 3 normais, 0 extras, endereço urbano simples
- `caso-premium-ou-especial` — 3 normais + 2 extras, endereço São José dos Pinhais

Para comparação operacional completa, são necessárias:

| Caso | Por que necessário | Status |
|------|--------------------|--------|
| `caso-sabado` | Sábado usa `HOME_SAT_E1/E2` como origem; frete diferente | ❌ Não capturado |
| `caso-sem-disponibilidade` | v2 não deve retornar candidatos; legado retorna vazio | ❌ Não capturado |
| `caso-hora-marcada` | Campo `avisoHoraMarcada` preenchido; lógica especial | ❌ Não capturado |
| `caso-rural-condominio` | Flags `isRural: true` / `isCondominio: true` alteram frete | ❌ Não capturado |
| `caso-encomenda` | `isEncomenda: true` — verificar campo `encomenda` no candidato | ❌ Não capturado |

---

## 12. Próximas etapas recomendadas

**Imediata (Passo 1 acima):** Integrar `gerar-candidatos-disponibilidade-real.ts` na rota `POST /api/procurar-datas/v2/diagnostico` via flag opcional `usarDisponibilidadeRealDiagnostica`. Isso fecha o loop entre parser de planilha real e geração de candidatos, sem afetar produção ou comportamento padrão da rota.

**Antes de Passo 5:** Confirmar coordenadas do depósito no Supabase. Sem esse dado, `distanciaKm` calculado com Haversine parte de origem incorreta.

**Antes de Passo 9:** Capturar fixture de `caso-sabado` e `caso-sem-disponibilidade`. São os casos que mais provavelmente revelarão divergências estruturais entre legado e v2.

---

## 13. Documentação relacionada

- `docs/procurar-datas-motor-v2-progresso.md` — Estado completo do motor v2
- `docs/procurar-datas-v2-proximas-etapas-operacionais.md` — Roadmap geral
- `docs/procurar-datas-v2-mapeamento-disponibilidade-legado.md` — Mapeamento de `getSlots()` e `coletarPontosDoDia()`
- `docs/procurar-datas-legado-fixtures.md` — Documentação de fixtures do legado
- `docs/fixtures/procurar-datas/legado/caso-normal-simples-2026-06-12.json` — Fixture 1
- `docs/fixtures/procurar-datas/legado/caso-premium-ou-especial-2026-06-12.json` — Fixture 2
