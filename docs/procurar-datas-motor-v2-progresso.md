# Motor v2 da tela `/procurar-datas` — Progresso Técnico

> **Data:** 12 de junho de 2026  
> **Status:** Diagnóstico isolado, sem produção  
> **Propósito:** Log técnico do progresso do motor v2. Não substitui leitura de código.

---

## 1. Objetivo do documento

Este documento registra o estado atual do motor v2 da tela `/procurar-datas`, incluindo:

- Helpers puros criados
- Cadeia diagnóstica implementada
- Validações manuais realizadas
- Pontos ainda sintéticos
- Próximos passos recomendados

**Não é** documentação de API, nem substitui a leitura direta do código-fonte.

---

## 2. Escopo atual do motor v2

O motor v2 atual é **apenas diagnóstico** e **não está em produção**.

- Rota: `POST /api/procurar-datas/v2/diagnostico`
- Modo: isolado, sem afetar produção
- Fonte de dados: sintética (não consulta agenda real)
- Objetivo: demonstrar a cadeia de cálculos futura de forma segura

**Não substitui** o Apps Script legado nem a rota `/api/procurar-datas/pesquisar`.

---

## 3. Arquivos principais

### Helpers puros (motor v2)

| Arquivo | Função principal | Responsabilidade |
|---------|------------------|------------------|
| `src/lib/procurar-datas/motor/entrada.ts` | `normalizarEntradaPesquisaV2()` | Normaliza payload da pesquisa para estrutura limpa |
| `src/lib/procurar-datas/motor/tempo.ts` | `parseMinutos()`, `formatarMinutos()` | Conversões de tempo (HH:MM ↔ minutos) |
| `src/lib/procurar-datas/motor/equipe.ts` | `normalizarEquipe()` | Normaliza strings de equipe (EQUIPE 1, EQUIPE 2) |
| `src/lib/procurar-datas/motor/distancia.ts` | `haversine()`, `haversineKm()` | Cálculo de distância geodésica (Haversine) |
| `src/lib/procurar-datas/motor/frete.ts` | `calcularFreteBase()` | Cálculo de frete baseado em distância e flags |
| `src/lib/procurar-datas/motor/datas.ts` | `diffDias()`, `adicionarDias()` | Operações puras de data |
| `src/lib/procurar-datas/motor/janela-datas.ts` | `gerarJanelaDatasPesquisaV2()` | Gera janela cronológica de datas com flags |
| `src/lib/procurar-datas/motor/disponibilidade.ts` | `filtrarDisponibilidadePorJanelaV2()` | Filtra/enriquece disponibilidade por equipe/data |
| `src/lib/procurar-datas/motor/classificacao-candidato.ts` | `classificarCandidatoOperacionalV2()` | Classifica cenário em normal/especial/premium/hora-marcada/indisponivel |
| `src/lib/procurar-datas/motor/candidato.ts` | `montarCandidatoPreliminarV2()` | Monta candidato preliminar v2 a partir de classificação |
| `src/lib/procurar-datas/motor/ordenacao-candidatos.ts` | `ordenarCandidatosDiagnosticosV2()` | Ordena candidatos preliminares por prioridade diagnóstica |
| `src/lib/procurar-datas/motor/adaptador-candidato-legado.ts` | `adaptarCandidatoV2ParaContratoLegadoDiagnostico()` | Adapta CandidatoPreliminarV2 para o formato do contrato legado (diagnóstico) |
| `src/lib/procurar-datas/motor/parse-disponibilidade-tempo-disponivel.ts` | `parsearDisponibilidadeTempoDisponivelV2()` | Parser puro de linhas brutas da planilha TEMPO DISPONIVEL → DisponibilidadeEquipeDataV2[] |

### Rota diagnóstica

| Arquivo | Rota | Responsabilidade |
|---------|------|------------------|
| `src/app/api/procurar-datas/v2/diagnostico/route.ts` | `POST /api/procurar-datas/v2/diagnostico` | Orquestra cadeia diagnóstica completa |

### Serviço de configuração

| Arquivo | Função principal | Responsabilidade |
|---------|------------------|------------------|
| `src/lib/procurar-datas/config-service.ts` | `carregarConfigProcurarDatas()` | Carrega config com fallback para planilha |

### Contratos

| Arquivo | Responsabilidade |
|---------|------------------|
| `src/lib/procurar-datas/contratos.ts` | Tipos de entrada/saída das rotas |

---

## 4. Cadeia diagnóstica atual

```
entrada (PesquisarDatasRequest)
  ↓
normalizarEntradaPesquisaV2()
  ↓
config (config-service)
  ↓
distância/frete diagnóstico (Haversine + calcularFreteBase)
  ↓
gerarJanelaDatasPesquisaV2()
  ↓
filtrarDisponibilidadePorJanelaV2() [sintético]
  ↓
classificarCandidatoOperacionalV2() [sintético]
  ↓
montarCandidatoPreliminarV2() [com frete vinculado]
  ↓
ordenarCandidatosDiagnosticosV2()
  ↓
diagnóstico JSON completo
```

---

## 5. Helpers criados

### 5.1 `entrada.ts` — `normalizarEntradaPesquisaV2()`

- **Responsabilidade:** Transforma `PesquisarDatasRequest` em `EntradaPesquisaV2` normalizada
- **O que não faz:** Não consulta planilha, Supabase, Apps Script, OSRM, Google Calendar
- **Testes:** 19 testes em `entrada.test.ts`

### 5.2 `tempo.ts` — `parseMinutos()`, `formatarMinutos()`

- **Responsabilidade:** Converte HH:MM ↔ minutos (porta fiel do Apps Script)
- **O que não faz:** Não depende de Utilities.formatDate ou Apps Script
- **Testes:** 31 testes em `tempo.test.ts`

### 5.3 `equipe.ts` — `normalizarEquipe()`

- **Responsabilidade:** Normaliza strings de equipe (EQUIPE 1, EQUIPE 2)
- **O que não faz:** Não consulta planilha ou Supabase
- **Testes:** 26 testes em `equipe.test.ts`

### 5.4 `distancia.ts` — `haversine()`, `haversineKm()`

- **Responsabilidade:** Cálculo de distância geodésica (Haversine)
- **O que não faz:** Não substitui OSRM do legado
- **Testes:** 14 testes em `distancia.test.ts`

### 5.5 `frete.ts` — `calcularFreteBase()`

- **Responsabilidade:** Cálculo de frete baseado em distância e flags (rural, sábado, condomínio)
- **O que não faz:** Não consulta planilha, não aplica ajuste +20% (isso é feito na rota)
- **Testes:** 51 testes em `frete.test.ts`

### 5.6 `datas.ts` — `diffDias()`, `adicionarDias()`

- **Responsabilidade:** Operações puras de data (diferença em dias, adicionar dias)
- **O que não faz:** Não depende de Utilities.formatDate ou Apps Script
- **Testes:** 13 testes em `datas.test.ts`

### 5.7 `janela-datas.ts` — `gerarJanelaDatasPesquisaV2()`

- **Responsabilidade:** Gera janela cronológica de datas com flags de sábado/domingo
- **O que não faz:** Não consulta agenda, disponibilidade, ranking, OSRM, Supabase, Apps Script
- **Testes:** 16 testes em `janela-datas.test.ts`

### 5.8 `disponibilidade.ts` — `filtrarDisponibilidadePorJanelaV2()`

- **Responsabilidade:** Filtra/enriquece disponibilidade por equipe/data dentro da janela
- **O que não faz:** Não consulta agenda real (usa dados sintéticos)
- **Testes:** 19 testes em `disponibilidade.test.ts`

### 5.9 `classificacao-candidato.ts` — `classificarCandidatoOperacionalV2()`

- **Responsabilidade:** Classifica cenário em normal/especial/premium/hora-marcada/indisponivel
- **O que não faz:** Não consulta agenda real, não gera candidatos finais
- **Testes:** 35 testes em `classificacao-candidato.test.ts`

### 5.10 `candidato.ts` — `montarCandidatoPreliminarV2()`

- **Responsabilidade:** Monta candidato preliminar v2 a partir de classificação
- **O que não faz:** Não gera candidatos finais, não aplica ranking, não calcula score
- **Testes:** 22 testes em `candidato.test.ts`

### 5.11 `ordenacao-candidatos.ts` — `ordenarCandidatosDiagnosticosV2()`

- **Responsabilidade:** Ordena candidatos preliminares por prioridade diagnóstica
- **O que não faz:** Não é ranking final de produção, não cria score numérico
- **Testes:** 26 testes em `ordenacao-candidatos.test.ts`

### 5.13 `parse-disponibilidade-tempo-disponivel.ts` — `parsearDisponibilidadeTempoDisponivelV2()`

- **Responsabilidade:** Converte linhas brutas da planilha TEMPO DISPONIVEL para `DisponibilidadeEquipeDataV2[]`
- **Formato confirmado de entrada:** `DATA = DD/MM/YYYY`, `EQUIPE = Equipe 1/Equipe 2`, `TEMPO DISPONÍVEL = HH:MM`, `STATUS = disponível/agenda fechada/excedeu`
- **O que não faz:** Não lê planilha, não chama Apps Script, Supabase, OSRM, Google Calendar ou banco; não cria rota
- **Testes:** 41 testes em `parse-disponibilidade-tempo-disponivel.test.ts`

### 5.12 `adaptador-candidato-legado.ts` — `adaptarCandidatoV2ParaContratoLegadoDiagnostico()`

- **Responsabilidade:** Converte `CandidatoPreliminarV2` para o formato `CandidatoLegadoDiagnosticoV2` (compatível estruturalmente com `CandidatoFinal` do legado), com campo extra `diagnosticoV2` para rastreabilidade
- **Escopo:** Exclusivamente diagnóstico — não integrado em produção
- **O que não faz:** Não consulta Apps Script, OSRM, Supabase, Google Calendar, agenda, planilha; não calcula ranking; não recalcula frete; não muta input
- **Mapeamento implementado:** `dateISO`, `dateDM`, `weekday`, `tipo`, `isExtra`, `frete`, `rank`, `team`, `daysLeftTxt`, `encomenda`, `avisoHoraMarcada`, `diagnosticoV2`
- **Formato de `dateISO`:** por padrão continua `v2` (`YYYY-MM-DD`). Opcionalmente aceita `formatoDateISO: "legado-gmt3"` para emitir `YYYY-MM-DDT03:00:00.000Z`, padrão observado nas fixtures reais capturadas. A montagem é determinística por string, sem depender de timezone do runtime.
- **Diferenças documentadas:** `dateISO` pode usar YYYY-MM-DD (v2) ou ISO completo com T03:00:00.000Z (legado-gmt3); `encomenda` fixo em "Não" até v2 modelar encomenda; `isExtra` para `hora-marcada` inferido (não confirmado em fixture)
- **Testes:** 45 testes em `adaptador-candidato-legado.test.ts` — incluem cobertura baseada nas fixtures reais capturadas e formato legado-gmt3

---

## 6. Blocos do response da rota diagnóstica v2

### 6.1 `entradaNormalizada`

- **Finalidade:** Mostra entrada normalizada pelo motor v2
- **Status:** ✅ Funcional
- **Campos:** cep, temEnderecoCompleto, dataInicialISO, tempoNecessarioTexto, tempoNecessarioMin, temEnderecoMinimo, temCoordenadasOrigemInformada, isRural, isCondominio, avisos

### 6.2 `diagnosticoFrete`

- **Finalidade:** Diagnóstico de distância e frete usando Haversine
- **Status:** ✅ Funcional
- **Campos:** executado, tipoDistancia, distanciaKm, frete (valor, valorFormatado, faixaAplicada), avisos
- **Nota:** Não substitui OSRM do legado

### 6.3 `diagnosticoJanelaDatas`

- **Finalidade:** Gera janela cronológica de datas
- **Status:** ✅ Funcional
- **Campos:** executado, diasSolicitados, quantidadeGerada, primeiraDataISO, ultimaDataISO, avisos, amostra

### 6.4 `diagnosticoDisponibilidade`

- **Finalidade:** Filtra/enriquece disponibilidade por equipe/data (sintético)
- **Status:** ✅ Funcional
- **Campos:** executado, quantidadeDatas, quantidadeDatasComEquipe, quantidadeEquipesComRegistro, quantidadeEquipesAtivas, quantidadeEquipesSuficientes, quantidadeEquipesInativas, quantidadeEquipesInsuficientes, tempoNecessarioMin, resultado, avisos, amostra
- **Nota:** Dados sintéticos, não refletem agenda real

### 6.5 `diagnosticoClassificacao`

- **Finalidade:** Classifica cenários operacionais (sintético)
- **Status:** ✅ Funcional
- **Campos:** executado, quantidadeCenariosClassificados, quantidadeElegiveis, quantidadeIndisponiveis, quantidadeNormal, quantidadeEspecial, quantidadePremium, quantidadeHoraMarcada, quantidadeComMotivos, quantidadeComAvisos, avisos, amostra
- **Nota:** Usa kmAdicionalNaRotaM sintético, não reflete cenário real

### 6.6 `diagnosticoCandidatos`

- **Finalidade:** Monta candidatos preliminares v2 a partir de classificações
- **Status:** ✅ Funcional
- **Campos:** executado, freteVinculado, quantidadeCandidatosMontados, quantidadeElegiveis, quantidadeIndisponiveis, quantidadeNormal, quantidadeEspecial, quantidadePremium, quantidadeHoraMarcada, quantidadeComMotivos, quantidadeComAvisos, avisos, amostra
- **Nota:** Frete vinculado do diagnóstico, não recalculado

### 6.7 `diagnosticoOrdenacao`

- **Finalidade:** Ordena candidatos preliminares por prioridade diagnóstica
- **Status:** ✅ Funcional
- **Campos:** executado, resumo (total, elegiveis, indisponiveis, primeiroElegivelId), avisos, amostra (com posicao)
- **Nota:** Não é ranking final de produção

---

## 7. O que já foi validado manualmente

### 7.1 Janela de datas

```ts
diagnosticoJanelaDatas: {
  executado: true,
  diasSolicitados: 100,
  quantidadeGerada: 100,
  primeiraDataISO: "2026-06-13",
  ultimaDataISO: "2026-09-20",
  amostra: [5 datas]
}
```

### 7.2 Disponibilidade

```ts
diagnosticoDisponibilidade: {
  executado: true,
  quantidadeDatas: 100,
  quantidadeDatasComEquipe: 4,
  quantidadeEquipesComRegistro: 8,
  quantidadeEquipesAtivas: 7,
  quantidadeEquipesSuficientes: 6,
  quantidadeEquipesInativas: 1,
  quantidadeEquipesInsuficientes: 1,
  tempoNecessarioMin: 40,
  resultado: { ok: true }
}
```

### 7.3 Classificação operacional

```ts
diagnosticoClassificacao: {
  executado: true,
  quantidadeCenariosClassificados: 12,
  quantidadeElegiveis: 8,
  quantidadeIndisponiveis: 4,
  quantidadeNormal: 6,
  quantidadeEspecial: 0,
  quantidadePremium: 1,
  quantidadeHoraMarcada: 1,
  avisos: ["Config não permite cenário especial distinto do normal."]
}
```

### 7.4 Candidatos preliminares com frete

```ts
diagnosticoCandidatos: {
  executado: true,
  freteVinculado: true,
  quantidadeCandidatosMontados: 12,
  quantidadeElegiveis: 8,
  quantidadeIndisponiveis: 4,
  quantidadeNormal: 6,
  quantidadeEspecial: 0,
  quantidadePremium: 1,
  quantidadeHoraMarcada: 1,
  quantidadeComMotivos: 5,
  quantidadeComAvisos: 0
}
```

**Frete validado:**
- `valorFrete: 110`
- `tipoFrete: "fixo"`

**Batimento:**
```ts
cenariosClassificados: 12
candidatosMontados: 12
classificacaoElegiveis: 8
candidatosElegiveis: 8
classificacaoIndisponiveis: 4
candidatosIndisponiveis: 4
freteVinculado: true
```

### 7.5 Ordenação diagnóstica

```ts
diagnosticoOrdenacao: {
  executado: true,
  resumo: {
    total: 12,
    elegiveis: 8,
    indisponiveis: 4,
    primeiroElegivelId: "v2-2026-06-13-equipe-1-sintetico-hora-marcada-10"
  }
}
```

**Batimento:**
```ts
candidatosMontados: 12
ordenacaoTotal: 12
candidatosElegiveis: 8
ordenacaoElegiveis: 8
candidatosIndisponiveis: 4
ordenacaoIndisponiveis: 4
```

**Amostra ordenada:**
- `hora-marcada` aparece antes de `premium`
- `premium` aparece antes de `normal`
- Indisponíveis aparecem depois dos elegíveis

---

## 8. O que ainda é sintético

- **Disponibilidade por equipe/data:** Dados sintéticos, não refletem agenda real
- **Cenários de classificação:** Usam kmAdicionalNaRotaM sintético, não reflete cenário real
- **Candidatos preliminares:** Derivados de cenários sintéticos
- **Ordenação diagnóstica:** Baseada em candidatos sintéticos
- **Distância Haversine:** Apenas diagnóstico, não substitui OSRM do legado

---

## 9. O que ainda não existe / não foi feito

- ❌ Não há uso no frontend
- ❌ Não há uso na rota `/api/procurar-datas/pesquisar`
- ❌ Não há substituição do Apps Script
- ❌ Não há consulta real de agenda
- ✅ Parser puro de linhas da planilha TEMPO DISPONIVEL criado (helper isolado, sem I/O)
- ❌ Não há leitura real da planilha Google Sheets no Next.js
- ❌ Não há Supabase no motor v2
- ❌ Não há Google Calendar
- ❌ Não há OSRM real no v2
- ❌ Não há pré-agendamento
- ❌ Não há comparação legado vs v2
- ❌ Não há ranking final de produção
- ✅ Adapter diagnóstico `CandidatoPreliminarV2` → `CandidatoLegadoDiagnosticoV2` criado (helper puro, não em produção)

---

## 10. Regras de segurança mantidas

- ✅ Produção não alterada
- ✅ Frontend não alterado
- ✅ Rota legado preservada
- ✅ Helpers puros (sem I/O)
- ✅ Testes unitários (352 testes)
- ✅ Integração apenas diagnóstica
- ✅ Sem chamadas externas nos helpers
- ✅ Typecheck sem erros

**Nota adicional — validação de entrada:**
- A rota legado `POST /api/procurar-datas/pesquisar` foi reforçada com validação backend de `tempoNecessario` (função `isTempoNecessarioValido`)
- Caso de entrada inválida sem tempo foi identificado como bug e corrigido — agora retorna HTTP 400 com erro específico
- O motor v2 deve continuar rejeitando entrada sem tempo válido como comportamento esperado
- Esse caso não deve ser reproduzido no v2 como comportamento aceito do legado

---

## 11. Próximos passos recomendados

1. **Criar fixtures de caracterização do legado** ✅ CONCLUÍDO
   - `docs/fixtures/procurar-datas/legado/caso-normal-simples-2026-06-12.json`
   - `docs/fixtures/procurar-datas/legado/caso-premium-ou-especial-2026-06-12.json`

2. **Criar rota de comparação legado vs v2 em modo diagnóstico** ✅ CONCLUÍDO
   - `src/lib/procurar-datas/motor/comparacao-legado-v2.ts` — helper puro
   - `src/app/api/procurar-datas/v2/comparar/route.ts` — rota GET diagnóstica
   - Compara estrutura das fixtures reais/controladas — não chama Apps Script
   - 26 testes unitários passando

3. **Iniciar leitura real de disponibilidade em modo diagnóstico**
   - Substituir dados sintéticos por leitura real
   - Ainda sem produção
   - Validar consistência

4. **Aproximar candidato v2 do contrato esperado pelo frontend** ✅ CONCLUÍDO (diagnóstico)
   - `src/lib/procurar-datas/motor/adaptador-candidato-legado.ts` — adapter puro diagnóstico
   - Mapeia todos os campos de `CandidatoFinal` legado a partir de `CandidatoPreliminarV2`
   - 40 testes unitários passando, incluindo verificações baseadas em fixtures reais

5. **Só depois discutir integração gradual no frontend**
   - Feature flags
   - Rollback seguro
   - Monitoramento

---

## 12. Como validar manualmente hoje

```js
fetch('/api/procurar-datas/v2/diagnostico', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    cep: '01310-100',
    enderecoCompleto: 'Av. Paulista, 1000, São Paulo, SP',
    lat: -23.5631,
    lng: -46.6544,
    destLat: -23.5505,
    destLng: -46.6333,
    tempoNecessario: '01:00',
    dataInicial: '2026-06-13',
    isRural: false,
    isCondominio: false,
  }),
})
  .then((r) => r.json())
  .then((json) => {
    console.log('FRETE:', json.diagnosticoFrete)
    console.log('JANELA:', json.diagnosticoJanelaDatas)
    console.log('DISPONIBILIDADE:', json.diagnosticoDisponibilidade)
    console.log('CLASSIFICAÇÃO:', json.diagnosticoClassificacao)
    console.log('CANDIDATOS:', json.diagnosticoCandidatos)
    console.log('ORDENAÇÃO:', json.diagnosticoOrdenacao)

    console.log('BATIMENTO:', {
      cenariosClassificados: json.diagnosticoClassificacao?.quantidadeCenariosClassificados,
      candidatosMontados: json.diagnosticoCandidatos?.quantidadeCandidatosMontados,
      classificacaoElegiveis: json.diagnosticoClassificacao?.quantidadeElegiveis,
      candidatosElegiveis: json.diagnosticoCandidatos?.quantidadeElegiveis,
      classificacaoIndisponiveis: json.diagnosticoClassificacao?.quantidadeIndisponiveis,
      candidatosIndisponiveis: json.diagnosticoCandidatos?.quantidadeIndisponiveis,
      freteVinculado: json.diagnosticoCandidatos?.freteVinculado,
      ordenacaoTotal: json.diagnosticoOrdenacao?.resumo?.total,
      ordenacaoElegiveis: json.diagnosticoOrdenacao?.resumo?.elegiveis,
      ordenacaoIndisponiveis: json.diagnosticoOrdenacao?.resumo?.indisponiveis,
      primeiroElegivelId: json.diagnosticoOrdenacao?.resumo?.primeiroElegivelId,
    })

    console.table(json.diagnosticoOrdenacao?.amostra?.map((c) => ({
      posicao: c.posicao,
      id: c.id,
      dataISO: c.dataISO,
      equipe: c.equipe,
      tipo: c.tipo,
      elegivel: c.elegivel,
      indice: c.indice,
      valorFrete: c.frete?.valorFrete,
      tipoFrete: c.frete?.tipoFrete,
      motivos: c.motivos?.join(' | '),
    })))
  })
```

---

## 13. Estado atual dos testes

- **Total de testes:** 402
- **Status:** Todos passando
- **Typecheck:** 0 erros
- **Arquivos de teste:**
  - `entrada.test.ts` (19 testes)
  - `tempo.test.ts` (31 testes)
  - `equipe.test.ts` (26 testes)
  - `distancia.test.ts` (14 testes)
  - `frete.test.ts` (51 testes)
  - `datas.test.ts` (13 testes)
  - `janela-datas.test.ts` (16 testes)
  - `disponibilidade.test.ts` (19 testes)
  - `classificacao-candidato.test.ts` (35 testes)
  - `candidato.test.ts` (22 testes)
  - `ordenacao-candidatos.test.ts` (26 testes)
  - `comparacao-legado-v2.test.ts` (26 testes)
  - `adaptador-candidato-legado.test.ts` (45 testes)
  - `v2/comparar/route.test.ts` (4 testes)
  - `parse-disponibilidade-tempo-disponivel.test.ts` (41 testes)

---

## 14. Rota /api/procurar-datas/v2/comparar

A rota diagnostica `GET /api/procurar-datas/v2/comparar` agora tem dois niveis:

1. Comparacao estrutural das fixtures reais/controladas do legado:
   - `caso-normal-simples-2026-06-12`
   - `caso-premium-ou-especial-2026-06-12`
   - Continua baseada em arquivos locais de fixtures.
   - Nao chama Apps Script, OSRM, Supabase, banco, planilha ou frontend.

2. Demonstracao sintetica do adapter v2 para contrato legado:
   - Campo de resposta: `diagnosticoAdapterV2`
   - Modo: `sintetico`
   - Usa candidatos `CandidatoPreliminarV2` sinteticos para demonstrar `normal`, `premium`, `especial` e `hora-marcada`.
   - Usa `dataReferenciaISO: "2026-06-12"` fixa para determinismo.
   - Usa ranks controlados `1`, `2`, `3`, `4`.
   - Nao compara datas reais nem equivalencia operacional final.

Limites mantidos:

- v2 ainda nao usa disponibilidade real neste bloco.
- v2 ainda nao usa OSRM real neste bloco.
- Hora marcada ainda nao foi verificada por fixture real.
- O adapter e diagnostico/estrutural e nao substitui o contrato de producao.

---

## 15. Documentação relacionada

- `docs/procurar-datas-fixtures.md` — Fixtures de teste
- `docs/procurar-datas-contratos-payloads.md` — Contratos de payload
- `docs/procurar-datas-codemap.md` — Mapeamento de código legado
- `docs/procurar-datas-estrutura-candidato.md` — Estrutura de candidato legado
