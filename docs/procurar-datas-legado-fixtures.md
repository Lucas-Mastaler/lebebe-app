# Fixtures de Caracterização do Legado — `/procurar-datas`

> **Data:** 12 de junho de 2026  
> **Status:** Documentação de contratos legado para comparação futura  
> **Propósito:** Documentar a estrutura conhecida do legado e as pendências de captura real

---

## 1. Objetivo

Este documento registra os **contratos observados no código/docs** do motor legado (Apps Script) da tela `/procurar-datas` e prepara a captura de fixtures reais para:

- Servir como referência de comparação futura entre legado e motor v2
- Documentar o formato exato de payloads e responses
- Identificar campos obrigatórios, opcionais e incertos
- Mapear diferenças conhecidas entre legado e v2 diagnóstico

**Não é** documentação de API para consumo, nem substitui leitura do código-fonte.

---

## 2. Escopo

- Apenas documentação Markdown
- Não altera código, produção, testes ou tipos TypeScript
- Não cria comparação automática ainda
- Não integra nada em produção

---

## 3. Endpoints

### 3.1 Endpoint legado (produção)

```
POST /api/procurar-datas/pesquisar
```

- **Status:** Em uso em produção
- **Fluxo:** Frontend → Next.js → Apps Script (`ApiIniciarPesquisaDatasApp`)
- **Polling:** GET `/api/procurar-datas/progresso`
- **Resposta final:** Via progresso (`status: "done"`)

### 3.2 Endpoint v2 diagnóstico (isolado)

```
POST /api/procurar-datas/v2/diagnostico
```

- **Status:** Apenas diagnóstico, não em produção
- **Fluxo:** Entrada → Config → Distância/Frete → Janela → Disponibilidade → Classificação → Candidato → Ordenação
- **Resposta:** JSON síncrono completo
- **Não substitui** o endpoint legado

---

## 4. Payload de entrada do legado

### 4.1 Campos confirmados

| Campo | Tipo | Obrigatório | Origem | Status |
|-------|------|-------------|--------|--------|
| `clientToken` | `string` | ❌ (gerado pelo AS se ausente) | Frontend ou AS | ✅ Confirmado |
| `cep` | `string` | ✅ | Digitado pelo usuário | ✅ Confirmado |
| `enderecoCompleto` | `string` | ✅ | Digitado ou geocodificado | ✅ Confirmado |
| `lat`, `lng` | `number \| null` | ❌ | Geocoding do CEP | ✅ Confirmado |
| `destLat`, `destLng` | `number \| null` | ❌ | Geocoding do destino | ✅ Confirmado |
| `destDisplay` | `string` | ❌ | Geocoding do destino | ✅ Confirmado |
| `destProvider` | `string` | ❌ | Provedor de geocoding | ✅ Confirmado |
| `dataInicial` | `string` | ❌ | Selecionado no frontend | ✅ Confirmado |
| `monthYear` | `string` | ❌ | Selecionado no frontend | ✅ Confirmado |
| `isRural` | `boolean` | ❌ | Checkbox do frontend | ✅ Confirmado |
| `isCondominio` | `boolean` | ❌ | Checkbox do frontend | ✅ Confirmado |
| `isEncomenda` | `boolean` | ❌ | Checkbox do frontend | ✅ Confirmado |
| `tipoBerco` | `string` | ❌ | Dropdown do frontend | ✅ Confirmado |
| `comoda`, `roupeiro`, `poltrona`, `painel` | `string` | ❌ | Dropdowns do frontend | ✅ Confirmado |
| `tempoNecessario` | `string` | ✅ | Calculado ou informado | ✅ Confirmado |

### 4.2 Exemplo JSON confirmado

```json
{
  "clientToken": "app-1751234567890-a1b2c3d4",
  "cep": "80000-000",
  "enderecoCompleto": "Rua Exemplo, 123, Centro, Curitiba - PR",
  "lat": -25.42,
  "lng": -49.27,
  "destLat": -25.43,
  "destLng": -49.28,
  "destDisplay": "Rua Destino, 456, Bairro Modelo, Curitiba - PR",
  "destProvider": "nominatim",
  "dataInicial": "2026-06-15",
  "monthYear": "2026-06",
  "isRural": false,
  "isCondominio": false,
  "isEncomenda": false,
  "tipoBerco": "NIDO",
  "comoda": "1",
  "roupeiro": "0",
  "poltrona": "0",
  "painel": "0",
  "tempoNecessario": "02:30"
}
```

### 4.3 Campos pendentes de confirmação

| Campo | Status | Nota |
|-------|--------|------|
| `horaMarcada` | ⚠️ Pendente | Flag para hora marcada no request — confirmar se existe |
| `observacoes` | ⚠️ Pendente | Campo de observações — confirmar se é enviado |

---

## 5. Response do legado

### 5.1 Response de início (síncrono)

```json
{
  "ok": true,
  "clientToken": "app-1751234567890-a1b2c3d4",
  "status": "started"
}
```

Ou:

```json
{
  "ok": true,
  "clientToken": "app-1751234567890-a1b2c3d4",
  "status": "already_started"
}
```

Erro:

```json
{
  "ok": false,
  "error": "Nao foi possivel iniciar a pesquisa."
}
```

### 5.2 Progresso (polling) — Estados confirmados

#### `waiting`

```json
{
  "status": "waiting",
  "normais": [],
  "extras": []
}
```

#### `queued`

```json
{
  "status": "queued",
  "clientToken": "app-1751234567890-a1b2c3d4",
  "normais": [],
  "extras": [],
  "timestamp": 1751234567890
}
```

#### `running`

```json
{
  "status": "running",
  "clientToken": "app-1751234567890-a1b2c3d4",
  "normais": [],
  "extras": [],
  "timestamp": 1751234568000,
  "startedAt": "2026-06-11T10:00:00.000Z"
}
```

#### `done` — Payload compacto

```json
{
  "status": "done",
  "clientToken": "app-1751234567890-a1b2c3d4",
  "payload": {
    "ok": true,
    "cep": "80000-000",
    "tempo": "02:30",
    "label": "Bairro Modelo",
    "address": "Rua Destino, 456, Bairro Modelo, Curitiba - PR",
    "addressShort": "Rua Destino, 456",
    "startFromISO": "2026-06-11",
    "startFromDM": "11/06",
    "isRural": false,
    "isCondominio": false,
    "params": "",
    "candidates": [
      {
        "rank": 1,
        "dateISO": "2026-06-12T00:00:00.000Z",
        "dateDM": "12/06",
        "weekday": "Sexta",
        "daysLeftTxt": "1 d",
        "encomenda": "Nao",
        "frete": "R$ 150",
        "team": "EQUIPE 1",
        "tipo": "normal",
        "isExtra": false,
        "avisoHoraMarcada": ""
      }
    ],
    "searchTime": "45.2"
  },
  "normais": [ /* candidatos normais */ ],
  "extras": [ /* candidatos especiais/premium/hora-marcada */ ],
  "timestamp": 1751234600000,
  "startedAt": "2026-06-11T10:00:00.000Z",
  "finishedAt": "2026-06-11T10:01:40.000Z",
  "durationMs": 100000
}
```

#### `error`

```json
{
  "status": "error",
  "clientToken": "app-1751234567890-a1b2c3d4",
  "error": "Erro ao processar: Nao foi possivel geocodificar endereco",
  "timestamp": 1751234600000,
  "startedAt": "2026-06-11T10:00:00.000Z",
  "finishedAt": "2026-06-11T10:00:05.000Z",
  "durationMs": 5000
}
```

### 5.3 Campos do candidato final confirmados

| Campo | Tipo | Origem | Observações |
|-------|------|--------|-------------|
| `rank` | `number` | Contador sequencial no payload | Não é score de ranking interno |
| `dateISO` | `string` | Data do slot | Formato ISO completo |
| `dateDM` | `string` | Formatado | `dd/MM` |
| `weekday` | `string` | Formatado | Nome do dia da semana |
| `daysLeftTxt` | `string` | Calculado | `${diasAte} d` |
| `encomenda` | `string` | Calculado | "Sim" ou "Nao" |
| `frete` | `string` | Formatado | "R$ 150" — não é number |
| `team` | `string` | Slot normalizado | "EQUIPE 1" ou "EQUIPE 2" |
| `tipo` | `string` | Calculado | normal, especial, premium, hora-marcada |
| `isExtra` | `boolean` | Calculado | true para especial/premium/hora-marcada |
| `avisoHoraMarcada` | `string` | Condicional | Preenchido apenas para hora-marcada |

### 5.4 Estruturas internas confirmadas

#### Slot legado

```typescript
interface SlotLegado {
  date: Date
  team: string
  availStr: string
  pontos: PontoAgendaLegado[]
  nearestPoint: NearestPointLegado | null
  delta: number
  loc: Coordenada
}
```

#### Ponto de agenda legado

```typescript
interface PontoAgendaLegado {
  loc: Coordenada
  addr: string
  eventTitle: string
  cep: string | null
  cepSource?: string
}
```

#### NearestPoint legado

```typescript
interface NearestPointLegado {
  addr: string
  cep: string | null
  distancia: number
  eventTitle?: string | null
  loc: Coordenada
}
```

### 5.5 Response completo real

> **Existem 2 fixtures reais/controladas capturadas do legado.**
>
> Arquivos:
> - `docs/fixtures/procurar-datas/legado/caso-normal-simples-2026-06-12.json`
> - `docs/fixtures/procurar-datas/legado/caso-premium-ou-especial-2026-06-12.json`
>
> Resumo `caso-normal-simples`: `statusFinal: "done"`, 3 candidatos normais, 0 extras, payload final presente, `durationMs: 182172`, `searchTime: "179.3"`.
>
> Resumo `caso-premium-ou-especial`: `statusFinal: "done"`, 3 candidatos normais, 2 extras, 5 candidatos no payload final, tipos `premium`, `normal` e `especial`, `durationMs: 188747`, `searchTime: "187.0"`.

### 5.6 Entrada inválida sem tempo necessário

Foi testado payload direto com `tempoNecessario` vazio ou ausente via DevTools. Antes da correção, o backend aceitava a busca, iniciava o job, acionava worker/Apps Script e retornava candidatos normalmente, apesar de o frontend bloquear esse caso. Esse comportamento foi classificado como bug, não como contrato desejado do legado.

Após correção em `POST /api/procurar-datas/pesquisar` (validação backend com `isTempoNecessarioValido`), o mesmo payload passou a retornar HTTP 400 com:

```json
{
  "ok": false,
  "error": "Tempo necessario ausente ou invalido."
}
```

**Validação manual confirmada:**
- STATUS: 400
- OK HTTP: false
- BODY: `{ ok: false, error: "Tempo necessario ausente ou invalido." }`

Isso confirma que agora:
- `tempoNecessario` vazio é recusado imediatamente
- Não inicia job
- Não chama Apps Script
- Não aciona worker
- Não retorna candidatos indevidos

**Conclusão:** Este caso não deve ser usado como fixture de comportamento legado desejado. Ele fica registrado como falha histórica corrigida. O motor v2 deve continuar rejeitando entrada sem tempo válido.

---

## 6. Estrutura de candidato v2 preliminar atual

### 6.1 Campos do `CandidatoPreliminarV2`

```typescript
interface CandidatoPreliminarV2 {
  id: string
  elegivel: boolean
  tipo: 'normal' | 'especial' | 'premium' | 'hora-marcada' | 'indisponivel'
  dataISO: string
  indice: number
  diaSemana: number
  ehSabado: boolean
  ehDomingo: boolean
  equipe: string
  operacional: {
    ativa: boolean
    disponivelMin: number
    suficienteParaServico: boolean
    tempoNecessarioMin: number | null
  }
  distancia: {
    distanciaKm: number | null
    kmAdicionalNaRotaM: number | null
  }
  frete: {
    valorFrete: number | null
    tipoFrete: string | null
  }
  motivos: string[]
  avisos: string[]
  diagnostico: {
    origem: 'v2-preliminar'
    classificacaoTipo: TipoClassificacaoCandidatoV2
    classificacaoElegivel: boolean
  }
}
```

### 6.2 Campos que precisam de mapeamento para compatibilidade

| Campo v2 | Campo legado | Status |
|----------|--------------|--------|
| `id` | `rank` + `dateISO` + `team` | ⚠️ Pendente mapeamento |
| `dataISO` | `dateISO` | ✅ Equivalente |
| `equipe` | `team` | ✅ Equivalente (normalizado) |
| `tipo` | `tipo` | ✅ Equivalente |
| `frete.valorFrete` | `frete` (string) | ⚠️ Diferente: v2 é number, legado é string formatada |
| `elegivel` | — | ⚠️ Não existe no legado — inferido de `tipo !== 'indisponivel'` |
| `motivos`, `avisos` | — | ⚠️ Não existe no legado — pode ser convertido de metadata |

---

### 6.3 Formato de `dateISO` no adapter diagnostico

O adapter diagnostico `adaptarCandidatoV2ParaContratoLegadoDiagnostico()` preserva por padrao o formato v2 (`YYYY-MM-DD`) para nao quebrar chamadas existentes.

Quando chamado com `formatoDateISO: "legado-gmt3"`, o adapter emite `YYYY-MM-DDT03:00:00.000Z`, que e o padrao observado nas fixtures reais/controladas capturadas:

- `2026-06-23T03:00:00.000Z`
- `2026-06-30T03:00:00.000Z`

Esse sufixo e contrato observado nas fixtures atuais, nao regra universal confirmada por fixture de hora marcada. A montagem e deterministica por string, sem depender de timezone do runtime.

---

## 7. Diferenças conhecidas entre legado e v2 atual

| Aspecto | Legado (Apps Script) | v2 Diagnóstico | Impacto |
|---------|----------------------|----------------|---------|
| **Distância** | OSRM real com fallback Haversine | Apenas Haversine | v2 subestima distância em ~15-30% |
| **Disponibilidade** | Planilha real (`shAg`) | Dados sintéticos | v2 não reflete agenda real |
| **Candidatos** | Calculados com OSRM real | Calculados com Haversine | v2 pode classificar diferente |
| **Frete** | Calculado com OSRM + ajustes | Calculado com Haversine + mesmos ajustes | v2 pode ter valor diferente |
| **Resposta** | Assíncrona via polling | Síncrona imediata | v2 não simula delay real |
| **Formato candidato** | `CandidatoFinal` (legado) | `CandidatoPreliminarV2` | Estruturas diferentes |
| **Campo `frete`** | String formatada "R$ 150" | Objeto `{ valorFrete, tipoFrete }` | Incompatível direto |
| **Campo `rank`** | Contador sequencial | Não existe (usar posição na lista) | Semântica diferente |
| **Campo `id`** | Não existe | Gerado deterministicamente | Não mapeável 1:1 |
| **Frontend** | Consome polling | Não consumido | v2 isolado |

---

## 8. Fixtures mínimas necessárias

### 8.1 Caso normal simples

- Endereço completo válido
- Tempo necessário válido (ex: "02:30")
- Distância dentro do limite normal
- Múltiplos candidatos elegíveis
- Esperado: candidatos `normal` retornados

### 8.2 Caso premium/especial

- Distância adicional maior que normal
- Esperado: candidatos `especial` ou `premium` classificados

### 8.3 Caso hora marcada

- Flag `horaMarcada` ou config específica
- Esperado: candidatos `hora-marcada` com `avisoHoraMarcada`

### 8.4 Caso sem disponibilidade

- Data futura sem slots disponíveis
- Esperado: `normais: []`, `extras: []` ou mensagem específica

### 8.5 Caso entrada inválida

- Sem data inicial
- Sem tempo necessário
- Sem coordenadas
- Esperado: erro formatado

### 8.6 Caso sábado

- Data em sábado
- Esperado: limite específico de sábado aplicado

### 8.7 Caso domingo

- Data em domingo
- Esperado: legado bloqueia ou ignora

### 8.8 Caso rural/condomínio

- `isRural: true` ou `isCondominio: true`
- Esperado: impacto no frete/classificação

---

## 9. Como capturar fixtures reais (próxima etapa)

### 9.1 Procedimento seguro

1. Abrir tela `/procurar-datas` no ambiente de desenvolvimento
2. Abrir DevTools → Network
3. Executar busca real com endereço válido
4. Capturar:
   - Request para `POST /api/procurar-datas/pesquisar`
   - Response imediato
   - Polling para `GET /api/procurar-datas/progresso`
   - Response final (`status: "done"`)
5. Remover dados sensíveis:
   - Nomes reais de clientes
   - Endereços completos reais
   - Coordenadas precisas
   - CEPs reais
6. Salvar em formato JSON anonimizado
7. Documentar neste arquivo

### 9.2 Formato de captura

```json
{
  "fixtureId": "legado-caso-normal-01",
  "descricao": "Caso normal simples — endereço urbano, tempo padrão",
  "dataCaptura": "2026-06-12",
  "request": { /* payload anonimizado */ },
  "responseInicio": { /* resposta síncrona */ },
  "responseDone": { /* payload completo anonimizado */ }
}
```

### 9.3 Onde NÃO capturar

- ❌ Preferir ambiente de desenvolvimento/homologação. Se for inevitável usar produção, capturar apenas com dados próprios/de teste, nunca com dados reais de clientes, e anonimizar antes de salvar
- ❌ Não capturar sem anonimização
- ❌ Não salvar em repositório público sem revisão

---

## 10. Checklist antes da rota de comparação

Antes de criar `/api/procurar-datas/v2/comparar`, verificar:

- [x] Response legado real capturado (pelo menos 1 caso)
- [ ] Campos obrigatórios identificados
- [ ] Casos mínimos documentados (seção 8)
- [ ] Diferenças conhecidas listadas (seção 7)
- [ ] Dados sensíveis removidos das fixtures
- [ ] Contrato v2 preliminar comparável (seção 6)
- [ ] Testes de caracterização planejados
- [ ] Estratégia de anonimização definida

---

## 11. Uso atual em /api/procurar-datas/v2/comparar

A rota diagnostica `GET /api/procurar-datas/v2/comparar` usa estas fixtures em dois niveis:

1. Comparacao estrutural do legado:
   - Lê as fixtures `caso-normal-simples-2026-06-12` e `caso-premium-ou-especial-2026-06-12`.
   - Valida estrutura de `responseInicio`, `responseDone`, `payload.candidates`, `normais`, `extras`, campos minimos e consistencia de `isExtra`.
   - Nao chama Apps Script, OSRM, Supabase, banco, planilha ou frontend.

2. Demonstracao sintetica do adapter v2:
   - Campo de resposta: `diagnosticoAdapterV2`.
   - Mostra como candidatos v2 sinteticos ficam no contrato legado diagnostico.
   - Demonstra `normal`, `premium`, `especial` e `hora-marcada`.
   - Nao usa as fixtures como se fossem candidatos v2 reais.
   - Nao compara equivalencia operacional real entre legado e v2.

Limites:

- v2 ainda nao usa disponibilidade real neste bloco.
- v2 ainda nao usa OSRM real neste bloco.
- Hora marcada ainda nao foi confirmada por fixture real.
- Esta rota continua diagnostica e nao substitui o fluxo legado.

---

## 12. Próxima etapa recomendada

**Capturar fixture real do legado em ambiente seguro:**

1. Preparar ambiente de desenvolvimento
2. Executar busca com dados de teste
3. Capturar request/response no DevTools
4. Anonimizar dados
5. Salvar neste documento ou arquivo JSON separado

Só após ter fixtures reais do legado, avançar para:
- Criar rota de comparação `/api/procurar-datas/v2/comparar`
- Implementar mapeamento de campos v2 → legado
- Criar testes de caracterização automatizados

---

## 13. Referências

- `docs/procurar-datas-motor-v2-progresso.md` — Progresso do motor v2
- `docs/procurar-datas-fixtures.md` — Fixtures de caracterização geral
- `docs/procurar-datas-contratos-payloads.md` — Contratos de payloads
- `docs/procurar-datas-codemap.md` — Mapeamento de código legado
- `docs/procurar-datas-estrutura-candidato.md` — Estrutura de candidato legado
- `src/app/api/procurar-datas/v2/diagnostico/route.ts` — Rota v2 diagnóstica
- `src/lib/procurar-datas/contratos.ts` — Tipos TypeScript de contratos

---

> **Nota final:** Este documento é um registro técnico. Campos marcados como "PENDENTE CAPTURA REAL" precisam ser validados com dados reais antes de serem usados como base para testes ou comparações automatizadas.
