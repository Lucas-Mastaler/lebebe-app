# APIs Next.js — `/procurar-datas`

> Criado em: junho/2026
> Baseado em: rotas Next.js `src/app/api/procurar-datas/**`, `src/app/api/configuracoes/procurar-datas/**`, `src/lib/procurar-datas/*`
> Todas as informações são sintéticas ou anonimizadas.

---

## 1. Objetivo

Este documento mapeia as **rotas Next.js atuais** usadas pela tela `/procurar-datas` e pelas APIs de configuração relacionadas.

Ele descreve:

- quais rotas existem;
- quem chama cada rota;
- o que cada rota recebe e retorna;
- quais rotas ainda delegam para Apps Script;
- quais rotas são candidatas a futura versão v2.

---

## 2. Escopo

- **Apenas documentação**.
- **Não altera código**.
- **Não altera produção**.
- **Não cria testes**.
- **Não cria tipos TypeScript**.
- **Não troca o motor atual**.
- **Não envolve n8n como direção futura**.

---

## 3. Visão geral

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│  APIs Next.js    │────▶│  Apps Script    │
│  /procurar-datas│     │  /api/procurar...│     │  (motor legado) │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                        │                        │
         │                        │                        ▼
         │                        │               Google Calendar (pré-agenda)
         │                        ▼
         │               Supabase (config, cache)
         │
         ▼
  /api/configuracoes/procurar-datas
  (tela de configuração — superadmin)
```

- O frontend `/procurar-datas` chama APIs Next.js.
- As APIs Next.js **ainda delegam** a maior parte do trabalho para Apps Script.
- O motor principal de busca de datas ainda roda no Apps Script (`CEP-APIBACK.gs`).
- A futura migração (v2) deve manter o backend **dentro do Next.js**.
- **n8n/Execution API não é direção futura** para este motor.

---

## 4. Lista de rotas encontradas

### 4.1 Rotas do fluxo principal

| Rota | Método | Arquivo | Responsabilidade | Chama Apps Script? | Status |
|------|--------|---------|------------------|-------------------|--------|
| `/api/procurar-datas/pesquisar` | `POST` | `pesquisar/route.ts` | Inicia pesquisa assíncrona, retorna `clientToken` | ✅ `ApiIniciarPesquisaDatasApp` | **Atual** |
| `/api/procurar-datas/progresso` | `GET` | `progresso/route.ts` | Consulta progresso da pesquisa por `clientToken` | ✅ `GetProgressUpdate` | **Atual** |
| `/api/procurar-datas/pre-agendar` | `POST` | `pre-agendar/route.ts` | Cria pré-agendamento no Google Calendar | ✅ `ApiPreAgendarDireto` | **Atual** |
| `/api/procurar-datas/calcular-tempo` | `POST` | `calcular-tempo/route.ts` | Calcula tempo de serviço a partir dos itens | ✅ `GetTempoNecessario` | **Atual** |
| `/api/procurar-datas/opcoes` | `GET` | `opcoes/route.ts` | Retorna opções do frontend + tempo map | ✅ `GetFrontOptionLists` + `GetTempoMap` | **Atual** |
| `/api/procurar-datas/validar-endereco` | `POST` | `validar-endereco/route.ts` | Valida e completa endereço (geocoding) | ✅ `LookupCompletoPorEndereco` | **Atual** |
| `/api/procurar-datas/valor-inicial` | `POST` | `valor-inicial/route.ts` | Calcula valor inicial mínimo do frete | ✅ `calcularValorInicialModal` | **Atual** |

### 4.2 Rotas de configuração

| Rota | Método | Arquivo | Responsabilidade | Chama Apps Script? | Status |
|------|--------|---------|------------------|-------------------|--------|
| `/api/configuracoes/procurar-datas` | `GET` | `configuracoes/procurar-datas/route.ts` | Compara planilha vs Supabase (diff) | ❌ (lê planilha + Supabase) | **Config** |
| `/api/configuracoes/procurar-datas/config-normalizada` | `GET` | `configuracoes/procurar-datas/config-normalizada/route.ts` | Retorna config normalizada pronta para o motor | ❌ (lê Supabase + planilha fallback) | **Config / Diagnóstico** |
| `/api/configuracoes/procurar-datas/[chave]` | `PATCH` | `configuracoes/procurar-datas/[chave]/route.ts` | Edita valor de uma config no banco | ❌ (escreve no Supabase) | **Config** |
| `/api/configuracoes/procurar-datas/importar` | `POST` | `configuracoes/procurar-datas/importar/route.ts` | Importa planilha → Supabase | ❌ (lê planilha, escreve Supabase) | **Config** |
| `/api/configuracoes/procurar-datas/snapshot` | `GET` | `configuracoes/procurar-datas/snapshot/route.ts` | Lista snapshots de config | ❌ (lê Supabase) | **Config** |
| `/api/configuracoes/procurar-datas/auditoria` | `GET` | `configuracoes/procurar-datas/auditoria/route.ts` | Lista auditoria de mudanças de config | ❌ (lê Supabase) | **Config** |

> **Nota:** As rotas de configuração são restritas a **superadmin**. Elas não participam do fluxo de busca de datas do usuário final.

---

## 5. Fluxo principal de busca

### 5.1 Passo a passo

```
1. Usuário abre /procurar-datas
   └── Frontend chama GET /api/procurar-datas/opcoes
       └── Retorna listas de opções (tipos de berço, móveis, etc.)

2. Usuário preenche endereço
   └── Frontend chama POST /api/procurar-datas/validar-endereco
       └── Retorna endereço completo + coordenadas

3. Usuário seleciona itens (berço, cômoda, etc.)
   └── Frontend chama POST /api/procurar-datas/calcular-tempo
       └── Retorna tempo necessário (ex: "02:30")

4. Usuário clica "Procurar datas"
   └── Frontend chama POST /api/procurar-datas/pesquisar
       └── Retorna { ok, clientToken, status: "started" }

5. Frontend inicia polling
   └── Chama GET /api/procurar-datas/progresso?clientToken=...
       └── Retorna { ok, progress: { status, normais, extras, ... } }

6. Quando status === "done"
   └── Frontend exibe candidatos
   └── Usuário escolhe uma data
   └── Frontend chama POST /api/procurar-datas/pre-agendar
       └── Retorna { ok, titulo, eventLink }
```

### 5.2 Payloads e respostas por rota

#### `POST /api/procurar-datas/pesquisar`

**Entrada:** `ProcurarDatasServicoForm` (JSON)

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
  "dataInicial": "2026-06-15",
  "monthYear": "2026-06",
  "isRural": false,
  "isCondominio": false,
  "tipoBerco": "NIDO",
  "comoda": "1",
  "roupeiro": "0",
  "poltrona": "0",
  "painel": "0",
  "tempoNecessario": "02:30"
}
```

**Saída:**

```json
{
  "ok": true,
  "clientToken": "app-1751234567890-a1b2c3d4",
  "status": "started"
}
```

**Erro:**

```json
{
  "ok": false,
  "error": "Nao foi possivel iniciar a pesquisa."
}
```

**Apps Script chamado:** `ApiIniciarPesquisaDatasApp(body)`

---

#### `GET /api/procurar-datas/progresso`

**Parâmetro de query:** `clientToken` (obrigatório)

**Saída:**

```json
{
  "ok": true,
  "progress": {
    "status": "done",
    "clientToken": "app-1751234567890-a1b2c3d4",
    "payload": {
      "ok": true,
      "cep": "80000-000",
      "tempo": "02:30",
      "candidates": [ /* ... */ ],
      "searchTime": "45.2"
    },
    "normais": [ /* ... */ ],
    "extras": [ /* ... */ ],
    "timestamp": 1751234600000,
    "startedAt": "2026-06-11T10:00:00.000Z",
    "finishedAt": "2026-06-11T10:01:40.000Z",
    "durationMs": 100000
  }
}
```

**Apps Script chamado:** `GetProgressUpdate(clientToken)`

---

#### `POST /api/procurar-datas/pre-agendar`

**Entrada:**

```json
{
  "cand": {
    "dateISO": "2026-06-20T00:00:00.000Z",
    "team": "EQUIPE 1",
    "frete": "R$ 280",
    "tipo": "hora-marcada"
  },
  "meta": {
    "tempo": "02:30",
    "label": "Bairro Modelo",
    "address": "Rua Exemplo, 123, Bairro Modelo, Curitiba - PR",
    "cep": "80000-000",
    "params": "TEMPO NECESSÁRIO: 02:30"
  }
}
```

**Saída:**

```json
{
  "ok": true,
  "titulo": "(02:30) BAIRRO MODELO (EQUIPE 1 - USUARIO) (FRETE: HORA MARCADA)",
  "eventLink": "https://calendar.google.com/calendar/u/0/r/eventedit/..."
}
```

**Apps Script chamado:** `ApiPreAgendarDireto(cand, meta)`

> Para detalhes completos do pré-agendamento, ver `docs/procurar-datas-pre-agendamento.md`.

---

#### `POST /api/procurar-datas/calcular-tempo`

**Entrada:** `ProcurarDatasServicoForm` (mesmo tipo da pesquisa)

**Saída:**

```json
{
  "ok": true,
  "tempoNecessario": "02:30"
}
```

**Apps Script chamado:** `GetTempoNecessario(body)`

---

#### `GET /api/procurar-datas/opcoes`

**Saída:**

```json
{
  "ok": true,
  "opcoes": {
    "tiposBerco": ["NIDO", "NIDO FUTURO", "SIMPLE", ...],
    "comodas": ["0", "1", "2"],
    "roupeiros": ["0", "1", "2"],
    ...
  },
  "tempoMap": {
    "NIDO": { "base": 120, ... },
    ...
  }
}
```

**Apps Script chamado:** `GetFrontOptionLists()` + `GetTempoMap()`

---

#### `POST /api/procurar-datas/validar-endereco`

**Entrada:** `ProcurarDatasEnderecoForm`

```json
{
  "logradouro": "Rua Exemplo",
  "numero": "123",
  "bairro": "Centro",
  "cidade": "Curitiba",
  "uf": "PR",
  "cep": "80000-000"
}
```

**Saída:**

```json
{
  "ok": true,
  "resultado": {
    "enderecoCompleto": "Rua Exemplo, 123, Centro, Curitiba - PR",
    "lat": -25.42,
    "lng": -49.27,
    "cep": "80000-000"
  }
}
```

**Apps Script chamado:** `LookupCompletoPorEndereco(body)`

---

#### `POST /api/procurar-datas/valor-inicial`

**Entrada:** `ProcurarDatasServicoForm`

**Saída:**

```json
{
  "ok": true,
  "resultado": {
    "ok": true,
    "valor": 150,
    "valorFormatado": "R$ 150,00",
    "distanciaKm": 12.5,
    "fallbackUsado": false,
    "msg": ""
  }
}
```

**Apps Script chamado:** `calcularValorInicialModal(body)`

---

## 6. Fluxo de polling/progresso

### 6.1 Estados possíveis

| Estado | Significado | Origem |
|--------|-------------|--------|
| `waiting` | Nenhum progresso salvo ainda para este `clientToken` | `GetProgressUpdate` retorna default |
| `queued` | Job criado, aguardando worker do Apps Script | `ApiIniciarPesquisaDatasApp` |
| `running` | Worker iniciou o processamento | `ApiExecutarPesquisaDatasWorker` |
| `done` | Pesquisa concluída, payload disponível | `ApiExecutarPesquisaDatasWorker` |
| `error` | Erro durante a pesquisa | `ApiExecutarPesquisaDatasWorker` |

### 6.2 Ciclo de vida do `clientToken`

```
1. Frontend gera ou reutiliza clientToken
2. POST /pesquisar → Apps Script cria job em PropertiesService
3. Worker do Apps Script processa em background (trigger .after(1000))
4. Frontend faz polling GET /progresso a cada N segundos
5. Quando status === "done", frontend exibe resultados
6. PropertiesService limpa o job após conclusão
```

### 6.3 TTL e expiração

- TTL do job no Apps Script: **5 minutos** (`PROCURAR_DATAS_JOB_TTL_MS = 5 * 60 * 1000`).
- Se o job expirar antes de iniciar, é removido e o usuário deve tentar novamente.
- Timeout da chamada Next.js → Apps Script: **30s** (`pesquisar`), **20s** (`progresso`).

---

## 7. Fluxo de opções/config

### 7.1 APIs da tela `/procurar-datas` (usuário final)

| Rota | Uso |
|------|-----|
| `GET /api/procurar-datas/opcoes` | Carrega dropdowns do formulário |
| `POST /api/procurar-datas/calcular-tempo` | Calcula tempo ao mudar itens |
| `POST /api/procurar-datas/validar-endereco` | Completa/geocodifica endereço |
| `POST /api/procurar-datas/valor-inicial` | Mostra valor estimado no modal |

### 7.2 APIs da tela `/configuracoes/procurar-datas` (superadmin)

| Rota | Uso |
|------|-----|
| `GET /api/configuracoes/procurar-datas` | Compara planilha vs banco (diff) |
| `GET /api/configuracoes/procurar-datas/config-normalizada` | Retorna config pronta para consumo do motor |
| `PATCH /api/configuracoes/procurar-datas/[chave]` | Edita valor no banco |
| `POST /api/configuracoes/procurar-datas/importar` | Importa planilha → banco |
| `GET /api/configuracoes/procurar-datas/snapshot` | Lista snapshots |
| `GET /api/configuracoes/procurar-datas/auditoria` | Lista auditoria de mudanças |

> **Separação clara:** as rotas de configuração são independentes do fluxo de busca. O motor atual não usa a config normalizada do Next.js — ainda lê direto da planilha no Apps Script.

---

## 8. Fluxo de pré-agendamento

A fronteira Next.js do pré-agendamento é simples:

```
Frontend → POST /api/procurar-datas/pre-agendar
           └── Delega para Apps Script: ApiPreAgendarDireto(cand, meta)
           └── Retorna: { ok, titulo, eventLink }
```

Para detalhes completos do pré-agendamento (construção do título, descrição, Google Calendar, etc.), ver:

> `docs/procurar-datas-pre-agendamento.md`

---

## 9. Payloads principais

### 9.1 Payload de pesquisa

Tipo: `ProcurarDatasServicoForm` (`src/lib/procurar-datas/types.ts:28`)

```typescript
interface ProcurarDatasServicoForm {
  clientToken?: string
  cep?: string
  enderecoCompleto?: string
  lat?: number | null
  lng?: number | null
  destLat?: number | null
  destLng?: number | null
  destDisplay?: string
  destProvider?: string
  dataInicial?: string
  monthYear?: string
  isRural?: boolean
  isCondominio?: boolean
  isEncomenda?: boolean
  tipoBerco?: string
  comoda?: string
  roupeiro?: string
  poltrona?: string
  painel?: string
  tempoNecessario?: string
}
```

### 9.2 Payload de progresso

Tipo: retorno de `GetProgressUpdate` (lido do `PropertiesService`)

```typescript
interface ProgressPayload {
  status: 'waiting' | 'queued' | 'running' | 'done' | 'error'
  clientToken?: string
  normais: ProcurarDatasCandidate[]
  extras: ProcurarDatasCandidate[]
  payload?: PayloadCompacto
  error?: string
  timestamp?: number
  startedAt?: string
  finishedAt?: string
  durationMs?: number
}
```

### 9.3 Payload de candidato

Tipo: `ProcurarDatasCandidate` (`src/lib/procurar-datas/types.ts:45`)

```typescript
interface ProcurarDatasCandidate {
  dateISO: string
  team: string
  frete?: string
  tipo?: 'normal' | 'especial' | 'premium' | 'hora-marcada' | string
  isExtra?: boolean
  avisoHoraMarcada?: string
}
```

### 9.4 Payload de erro padrão

```typescript
interface ProcurarDatasApiResult<T = unknown> {
  ok: boolean
  data?: T
  error?: string
}
```

Erro com timeout (status 504):

```json
{
  "ok": false,
  "error": "A busca demorou mais que o esperado. Tente novamente em alguns instantes..."
}
```

---

## 10. Dependências atuais

### 10.1 Dependências diretas da rota Next.js

| Rota | Apps Script | Supabase | Config Normalizada Next.js | Outro |
|------|-------------|----------|----------------------------|-------|
| `/pesquisar` | ✅ | ❌ | ❌ | ❌ |
| `/progresso` | ✅ | ❌ | ❌ | ❌ |
| `/pre-agendar` | ✅ | ❌ | ❌ | ❌ |
| `/calcular-tempo` | ✅ | ❌ | ❌ | ❌ |
| `/opcoes` | ✅ | ❌ | ❌ | ❌ |
| `/validar-endereco` | ✅ | ❌ | ❌ | ❌ |
| `/valor-inicial` | ✅ | ❌ | ❌ | ❌ |
| `/configuracoes/**` | ❌ | ✅ | ✅ (somente rota `config-normalizada`) | ❌ |

### 10.2 Dependências indiretas (via Apps Script)

As rotas que chamam Apps Script dependem **indiretamente** dos seguintes serviços, que são acessados pelo código do Apps Script e não diretamente pelo Next.js:

| Rota | Planilha de agenda | Planilha de disponibilidade | Config do AS/planilha | OSRM | Geocoding | Cache geográfico | Google Calendar | Worker/progresso |
|------|--------------------|----------------------------|----------------------|------|-----------|------------------|-----------------|-----------------|
| `/pesquisar` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| `/progresso` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (PropertiesService) |
| `/pre-agendar` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| `/calcular-tempo` | ❌ | ✅ (planilha de tempo) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/opcoes` | ❌ | ✅ (`TEMPO SERVIÇOS`) | ✅ (config sheet + freight params) | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/validar-endereco` | ❌ | ❌ | ❌ | ❌ | ✅ | ⚠️ possível (não confirmado no Next.js) | ❌ | ❌ |
| `/valor-inicial` | ❌ | ❌ | ✅ | ✅ | ✅ | ⚠️ possível (não confirmado no Next.js) | ❌ | ❌ |

> **Nota:** A tabela de dependências diretas (10.1) mostra apenas o que a rota Next.js chama **diretamente**. A tabela de dependências indiretas (10.2) mostra o que o Apps Script usa **por baixo**. Não confundir as duas.

### 10.3 Observações importantes

- **Google Calendar** não é fonte da agenda/disponibilidade. Ele é usado **apenas** para criar o pré-agendamento após a escolha de uma data.
- **Planilhas** ainda são a fonte principal de agenda/disponibilidade no fluxo legado (Apps Script).
- **Supabase** é usado apenas nas rotas de configuração (superadmin), não no fluxo de busca do usuário.
- **Config normalizada** (`config-service.ts`) existe no Next.js mas **não é consumida** pelo motor atual — está preparada para futura migração v2.
- As rotas `/validar-endereco` e `/valor-inicial` chamam o Apps Script; qualquer cache geográfico ou config usada por elas é acessado pelo Apps Script, não pelo Next.js.

---

## 11. Pontos sensíveis

| Risco | Descrição | Mitigação atual |
|-------|-----------|-----------------|
| **Trocar payload sem perceber** | Alterar `ProcurarDatasServicoForm` pode quebrar o contrato com Apps Script | Tipos TypeScript existem, mas Apps Script não os valida |
| **Divergência entre polling e Apps Script** | Next.js e Apps Script podem ter visões diferentes do progresso | PropertiesService é a fonte única da verdade |
| **Timeout** | Apps Script pode demorar mais que o timeout da API (30s) | Resposta 504 com mensagem amigável; job continua rodando em background |
| **Erro do worker** | Worker do Apps Script pode falhar silenciosamente | Progresso salva status `error` com mensagem |
| **Erro de Apps Script** | Chamada ao Apps Script pode falhar por rede/autenticação | Retry implícito no `executarAppsScript` |
| **Divergência de status** | Frontend pode receber status inesperado | Todos os 5 estados documentados |
| **Duplicidade por `clientToken`** | Reenviar pesquisa com mesmo token | Apps Script mantém job existente se ainda válido |
| **Mudança de formato de candidato** | Alterar campos do candidato quebra frontend e pré-agendamento | Tipos centralizados em `types.ts` |
| **Misturar fluxo legado com v2** | Substituir motor sem testes de paridade | Não fazer — documentar primeiro, testar depois |

---

## 12. Candidatas a v2

| Responsabilidade | Rota candidata | Por quê |
|------------------|----------------|---------|
| Executar motor v2 isolado | `POST /api/procurar-datas/v2/diagnostico` | Motor TypeScript já tem helpers puros (`datas.ts`, `frete.ts`, etc.) |
| Comparar AS vs v2 | `POST /api/procurar-datas/v2/comparar` | Rota nova para executar ambos e comparar saídas sem afetar produção |
| Executar helpers isolados | `POST /api/procurar-datas/v2/testar-helper` | Testar `diffDias`, `calcularFrete`, etc. sem Apps Script |
| Ler config normalizada | `GET /api/configuracoes/procurar-datas/config-normalizada` | **Já existe** — pronta para ser consumida pelo motor v2 |
| Ler agenda/disponibilidade | `GET /api/procurar-datas/v2/agenda` | Futura — substituir planilha por fonte de dados no Next.js |

> **A rota atual `POST /api/procurar-datas/pesquisar` NÃO deve ser alterada agora.**
>
> Qualquer experimento com motor v2 deve acontecer em rotas separadas (`/v2/**`) ou via diagnóstico, sem substituir o fluxo de produção.
>
> **Nenhuma dessas rotas v2 deve substituir produção sem testes de caracterização.**

---

## 12.1. Rota diagnóstica v2 — implementada

### `POST /api/procurar-datas/v2/diagnostico`

**Status:** ✅ Implementada e validada (200 OK)

**Propósito:**
- Validar estrutura de entrada usando contrato existente (`PesquisarDatasRequest`)
- Testar carregamento de config normalizada via `config-service.ts`
- Demonstrar uso de helpers puros já migrados (tempo, equipe)
- Confirmar que a arquitetura Next.js está pronta para o motor v2

**O que faz:**
- Recebe payload usando contrato existente da pesquisa atual
- Diagnostica entrada (flags simples: temCep, temLatLng, tempoMinutos, etc.)
- **Normaliza entrada via `normalizarEntradaPesquisaV2()`** (entradaNormalizada)
- Carrega config normalizada com fallback para planilha
- Testa helpers puros: `parseMinutos()`, `formatarMinutos()`, `normalizarEquipe()`
- **Diagnostica distância/frete via Haversine + `calcularFrete()`** (diagnosticoFrete)
- **Diagnostica janela bruta de datas via `gerarJanelaDatasPesquisaV2()`** (diagnosticoJanelaDatas)
- Retorna metadados seguros de config (origem, usandoFallbackPlanilha, faltantesNoSupabase)

**O que NÃO faz:**
- ❌ Não busca candidatos reais
- ❌ Não chama Apps Script
- ❌ Não chama OSRM
- ❌ Não chama Google Calendar
- ❌ Não altera produção
- ❌ Não é usada pela tela atual
- ❌ Não substitui `/api/procurar-datas/pesquisar`
- ❌ Não agenda nada
- ❌ Não grava dados
- ❌ Não consulta agenda

**Exemplo de request:**

```json
{
  "cep": "80000-000",
  "enderecoCompleto": "Endereco sintetico",
  "lat": -25,
  "lng": -49,
  "destLat": -25,
  "destLng": -49,
  "tempoNecessario": "00:40",
  "dataInicial": "2026-06-13",
  "isRural": false,
  "isCondominio": false
}
```

**Exemplo de response (resumido):**

```json
{
  "ok": true,
  "versao": "v2-diagnostico",
  "motor": "nextjs",
  "modo": "diagnostico",
  "producaoAfetada": false,
  "duracaoMs": 245,
  "entrada": {
    "temCep": true,
    "temEnderecoCompleto": true,
    "temLatLng": true,
    "temDestLatLng": true,
    "tempoNecessario": "00:40",
    "tempoMinutos": 40,
    "dataInicial": "2026-06-13",
    "isRural": false,
    "isCondominio": false
  },
  "entradaNormalizada": {
    "cep": "80000-000",
    "temEnderecoCompleto": true,
    "dataInicialISO": "2026-06-13",
    "tempoNecessarioTexto": "00:40",
    "tempoNecessarioMin": 40,
    "temEnderecoMinimo": true,
    "temCoordenadasDestino": true,
    "temCoordenadasOrigemInformada": true,
    "isRural": false,
    "isCondominio": false,
    "avisos": []
  },
  "diagnosticoFrete": {
    "executado": true,
    "tipoDistancia": "haversine_diagnostico",
    "distanciaKm": 0.0,
    "frete": {
      "valor": 480,
      "valorFormatado": "R$ 480",
      "faixaAplicada": "fixo"
    },
    "avisos": [
      "Distância calculada por Haversine apenas para diagnóstico. Não substitui OSRM do motor legado."
    ]
  },
  "diagnosticoJanelaDatas": {
    "executado": true,
    "diasSolicitados": 90,
    "quantidadeGerada": 90,
    "primeiraDataISO": "2026-06-13",
    "ultimaDataISO": "2026-09-10",
    "amostra": [
      {
        "dataISO": "2026-06-13",
        "indice": 0,
        "diaSemana": 6,
        "ehSabado": true,
        "ehDomingo": false
      },
      {
        "dataISO": "2026-06-14",
        "indice": 1,
        "diaSemana": 0,
        "ehSabado": false,
        "ehDomingo": true
      }
    ],
    "avisos": [
      "Janela bruta de datas. Não consulta agenda, disponibilidade ou ranking."
    ]
  },
  "config": {
    "origem": "supabase",
    "usandoFallbackPlanilha": false,
    "faltantesNoSupabase": [],
    "resumo": {
      "diasPesquisaAgenda": 90,
      "equipe1Ativa": true,
      "equipe2Ativa": true,
      "kmMaximoNaSemanaM": 16000,
      "kmMaximoNoSabadoM": 20000,
      "valorSemanaAte10km": 400,
      "valorSabadoAte10km": 500
    }
  },
  "helpers": {
    "tempoTeste": {
      "input": "00:40",
      "minutos": 40,
      "formatado": "00:40"
    },
    "equipeTeste": {
      "exemplos": [
        { "input": "EQUIPE 1", "normalizado": "EQUIPE 1" },
        { "input": "EQP 2", "normalizado": "EQUIPE 2" },
        { "input": "equipe 01", "normalizado": "EQUIPE 1" },
        { "input": "eqp inválida", "normalizado": null }
      ]
    }
  },
  "avisos": [
    "Rota diagnóstica. Não busca candidatos e não substitui o motor legado.",
    "Normalizador de entrada v2 integrado: normalizarEntradaPesquisaV2().",
    "Diagnóstico de distância/frete usa Haversine e não substitui OSRM/ranking do motor legado.",
    "Janela de datas v2 gerada apenas para diagnóstico. Não consulta agenda nem disponibilidade.",
    "Helpers puros testados: tempo (parse/format), equipe (normalização), distância (haversine), frete, janela de datas.",
    "Config carregada via config-service com fallback para planilha."
  ]
}
```

**Validação:**
- ✅ Teste manual em ambiente dev retornou 200 OK
- ✅ Config carregada de Supabase (origem: "supabase", usandoFallbackPlanilha: false)
- ✅ Normalizador de entrada v2 integrado e funcionando
- ✅ Diagnóstico de distância/frete (Haversine + calcularFrete) funcionando
- ✅ Diagnóstico de janela de datas (gerarJanelaDatasPesquisaV2) funcionando
- ✅ Helpers de tempo/equipe/distância/frete/janela funcionando corretamente
- ✅ Typecheck passou com 0 erros
- ✅ Testes do motor passaram: 170 testes

**Arquivo:** `src/app/api/procurar-datas/v2/diagnostico/route.ts`

---

## 13. O que não deve ser alterado agora

- Frontend (`src/app/procurar-datas/page.tsx`);
- APIs atuais (`/api/procurar-datas/**`);
- Apps Script (`PublicAPI.gs`, `CEP-APIBACK.gs`, `CEP-CONFIG.gs`);
- Supabase (tabelas de produção);
- Motor TypeScript já criado (`src/lib/procurar-datas/motor/*.ts`);
- Pré-agendamento atual;
- Ranking e critérios de seleção;
- Agenda/disponibilidade (planilhas);
- OSRM/geocoding.

---

## 14. Perguntas em aberto

| Pergunta | Status | Impacto |
|----------|--------|---------|
| Qual o intervalo de polling no frontend? | ❓ Não confirmado | Pode afetar UX e carga no Apps Script |
| Há retry automático no frontend em caso de erro? | ❓ Não confirmado | Pode afetar robustez |
| `valor-inicial` ainda é chamado pelo frontend? | ⚠️ Parcial | Rota existe, uso no modal não confirmado nesta leitura |
| `validar-endereco` lê do cache Supabase? | ❓ Não confirmado | Apps Script tem `geo_cache_addresses`, Next.js não confirma |
| Timeout do `executarAppsScript` (não o wrapper) | ❓ Não confirmado | Pode haver timeout mais baixo na camada inferior |
| `clientToken` é sempre gerado pelo frontend? | ⚠️ Parcial | Frontend pode enviar, Apps Script gera se ausente |
| Payload exato de `LookupCompletoPorEndereco` | ⚠️ Parcial | Tipos existem, mas resposta real do AS não totalmente mapeada |

---

## 15. Próxima etapa recomendada

**Criar `docs/procurar-datas-contratos-payloads.md`** — consolidar em um documento Markdown os contratos de payload das rotas Next.js, Apps Script e frontend, sem implementar tipos TypeScript ainda.

O documento deve conter:

- entrada de cada rota Next.js (exemplo JSON + campos confirmados);
- saída de cada rota Next.js (exemplo JSON + campos confirmados);
- payload enviado ao Apps Script (exemplo JSON + campos confirmados);
- payload retornado pelo Apps Script (exemplo JSON + campos confirmados);
- mapa de quem chama quem (frontend → Next.js → Apps Script);
- campos obrigatórios vs opcionais por contrato.

Formato sugerido: quase-TypeScript (pseudo-tipos em Markdown), sem criar arquivo `.ts`.

Isso preparará a base para:

- testes de caracterização;
- criação de rota diagnóstica v2;
- validação de paridade na migração;
- futura criação de tipos TypeScript reais.

---

> **Nota final:** Todas as rotas documentadas aqui foram confirmadas por leitura real do código. Nenhuma rota foi inventada. Se uma rota não está listada, é porque não foi encontrada no diretório `src/app/api/procurar-datas/**`.
