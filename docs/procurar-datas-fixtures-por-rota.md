# Fixtures por rota — `/procurar-datas`

> Criado em: junho/2026
> Baseado em: leitura real de rotas Next.js `src/app/api/procurar-datas/**`
> Todas as informações são sintéticas ou anonimizadas.

---

## 1. Objetivo

Este documento registra exemplos de request/response para cada rota Next.js de `/api/procurar-datas/**`, usando dados sintéticos ou anonimizados.

Serve como base futura para:

- testes de caracterização (comparar Apps Script vs motor v2);
- validação dos contratos documentados em `docs/procurar-datas-contratos-payloads.md`;
- referência rápida de comportamento esperado por rota.

---

## 2. Escopo

- **Apenas documentação Markdown**.
- **Não altera código**.
- **Não altera produção**.
- **Não cria testes**.
- **Não cria tipos TypeScript reais**.
- **Não cria arquivos JSON versionados ainda**.
- **Não substitui leitura real do código**.

---

## 3. Regras de anonimização

| Regra | Aplicação |
|-------|-----------|
| Nome de cliente | Fictício ("Cliente Exemplo") |
| Endereço completo | Genérico ("Rua Exemplo, 123, Bairro Modelo, Curitiba - PR") |
| Número de casa/apartamento | Omitido ou genérico |
| Telefone / CPF / CNPJ / e-mail | Nunca incluídos |
| Token real | `app-token-sintetico-001` (fake) |
| Coordenadas | Aproximadas, não correspondem a endereços reais |
| Link de calendário | URL fictícia (`https://calendar.google.com/calendar/eventedit/...`) |
| IDs reais | Substituídos por placeholders |
| Observações internas | Anonimizadas ou omitidas |

---

## 4. Convenções

| Convenção | Significado |
|-----------|-------------|
| `request` | Payload enviado pelo frontend para a rota Next.js |
| `response sucesso` | Retorno esperado em caso de sucesso |
| `response erro` | Retorno esperado em caso de falha |
| `status HTTP` | Código HTTP retornado (confirmado no código) |
| `sintético` | Dados gerados para exemplo, não vêm de produção |
| `parcial` | Campo visto no código, mas uso/contexto incompleto |
| `não confirmado` | Precisa de validação futura |

---

## 5. Rota `POST /api/procurar-datas/pesquisar`

### Objetivo

Inicia uma pesquisa assíncrona de datas disponíveis. Retorna `clientToken` para polling de progresso.

### Request

```json
{
  "clientToken": "app-token-sintetico-001",
  "cep": "80000-000",
  "enderecoCompleto": "Rua Destino, 456, Bairro Modelo, Curitiba - PR",
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

### Response sucesso — novo job

```json
{
  "ok": true,
  "clientToken": "app-token-sintetico-001",
  "status": "started"
}
```

**Status HTTP:** `200`

### Response sucesso — job já existente

```json
{
  "ok": true,
  "clientToken": "app-token-sintetico-001",
  "status": "already_started"
}
```

**Status HTTP:** `200`

> **Nota:** `"already_started"` confirmado em `PublicAPI.gs` (job existente e ainda válido).

### Response erro — timeout

```json
{
  "ok": false,
  "error": "A busca demorou mais que o esperado. Tente novamente em alguns instantes. Se for a primeira busca do dia ou de uma regiao nova, o sistema pode levar mais tempo para aquecer os dados."
}
```

**Status HTTP:** `504`

### Response erro — geral

```json
{
  "ok": false,
  "error": "Nao foi possivel iniciar a pesquisa."
}
```

**Status HTTP:** `500`

### Response erro — não autorizado

```json
{
  "ok": false,
  "error": "Nao autorizado"
}
```

**Status HTTP:** `401`

### Apps Script chamado

`ApiIniciarPesquisaDatasApp(form)` — timeout: **30s**.

### Pontos sensíveis

- No fluxo atual documentado, o `clientToken` é enviado pelo frontend e usado para consultar `/progresso`. Caso exista fallback de geração no Apps Script, isso ainda deve ser validado antes de virar contrato TypeScript.
- Se o Apps Script demorar mais que 30s, a rota Next.js retorna 504. Dependendo do ponto em que o Apps Script já iniciou o job assíncrono, a pesquisa pode continuar em background e ser consultada depois por `/progresso`.
- Reenviar com mesmo `clientToken` reutiliza o job existente se ainda válido.

---

## 6. Rota `GET /api/procurar-datas/progresso`

### Objetivo

Consulta o progresso de uma pesquisa em andamento por `clientToken`.

### Query param

```
?clientToken=app-token-sintetico-001
```

### Response — `waiting`

```json
{
  "ok": true,
  "progress": {
    "status": "waiting",
    "normais": [],
    "extras": []
  }
}
```

**Status HTTP:** `200`

### Response — `queued`

```json
{
  "ok": true,
  "progress": {
    "status": "queued",
    "clientToken": "app-token-sintetico-001",
    "normais": [],
    "extras": [],
    "timestamp": 1700000000000
  }
}
```

**Status HTTP:** `200`

### Response — `running`

```json
{
  "ok": true,
  "progress": {
    "status": "running",
    "clientToken": "app-token-sintetico-001",
    "normais": [],
    "extras": [],
    "timestamp": 1700000001000,
    "startedAt": "2026-06-11T10:00:00.000Z"
  }
}
```

**Status HTTP:** `200`

### Response — `done`

```json
{
  "ok": true,
  "progress": {
    "status": "done",
    "clientToken": "app-token-sintetico-001",
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
          "encomenda": "Não",
          "frete": "R$ 150",
          "team": "EQUIPE 1",
          "tipo": "normal",
          "isExtra": false,
          "avisoHoraMarcada": ""
        }
      ],
      "searchTime": "45.2"
    },
    "normais": [],
    "extras": [],
    "timestamp": 1700000010000,
    "startedAt": "2026-06-11T10:00:00.000Z",
    "finishedAt": "2026-06-11T10:01:40.000Z",
    "durationMs": 100000
  }
}
```

**Status HTTP:** `200`

### Response — `error`

```json
{
  "ok": true,
  "progress": {
    "status": "error",
    "clientToken": "app-token-sintetico-001",
    "error": "Erro ao processar: Nao foi possivel geocodificar endereco",
    "normais": [],
    "extras": [],
    "timestamp": 1700000010000,
    "startedAt": "2026-06-11T10:00:00.000Z",
    "finishedAt": "2026-06-11T10:00:05.000Z",
    "durationMs": 5000
  }
}
```

**Status HTTP:** `200`

> **Nota:** O campo `ok` do envelope Next.js é `true` mesmo em `status: "error"` — o erro está dentro do `progress`.

### Response erro — token ausente

```json
{
  "ok": false,
  "error": "clientToken obrigatorio"
}
```

**Status HTTP:** `400`

### Response erro — timeout

```json
{
  "ok": false,
  "error": "A busca demorou mais que o esperado..."
}
```

**Status HTTP:** `504`

### Apps Script chamado

`GetProgressUpdate(clientToken)` — timeout: **20s**.

### Dois mecanismos de progresso

1. **Progresso assíncrono do app** (`PublicAPI.gs`): salva payload completo no estado `done` — **este é o que o frontend consome**.
2. **Progresso parcial interno** (`CEP-APIBACK.gs`): salva `normais`, `extras`, `status`, `timestamp` — interno ao motor.

---

## 7. Rota `POST /api/procurar-datas/pre-agendar`

### Objetivo

Cria um pré-agendamento no Google Calendar após a escolha de uma data.

### Request

```json
{
  "cand": {
    "dateISO": "2026-06-12T00:00:00.000Z",
    "team": "EQUIPE 1",
    "frete": "R$ 150",
    "tipo": "normal",
    "isExtra": false
  },
  "meta": {
    "tempo": "02:30",
    "label": "Bairro Modelo",
    "address": "Rua Destino, 456, Bairro Modelo, Curitiba - PR",
    "cep": "80000-000",
    "params": ""
  }
}
```

### Response sucesso

```json
{
  "ok": true,
  "titulo": "(02:30) BAIRRO MODELO (EQUIPE 1 - USUARIO) (FRETE: R$ 150)",
  "eventLink": "https://calendar.google.com/calendar/eventedit/..."
}
```

**Status HTTP:** `200`

### Response erro — campos obrigatórios ausentes

```json
{
  "ok": false,
  "error": "cand e meta sao obrigatorios"
}
```

**Status HTTP:** `400`

### Response erro — config ausente

```json
{
  "ok": false,
  "error": "PRE_CALENDAR_ID não definido no backend."
}
```

**Status HTTP:** `500` (delegado do AS)

### Apps Script chamado

`ApiPreAgendarDireto(cand, meta)` — timeout: **60s**.

### Relação com Google Calendar

- Usa `CalendarApp.getCalendarById(PRE_CALENDAR_ID)`.
- Cria evento de dia inteiro com título e descrição construídos.
- Gera `eventLink` para abertura do Calendar.

> Para detalhes completos, ver `docs/procurar-datas-pre-agendamento.md`.

---

## 8. Rota `POST /api/procurar-datas/calcular-tempo`

### Objetivo

Calcula o tempo de serviço necessário a partir dos itens selecionados.

### Request mínimo

```json
{
  "tipoBerco": "NIDO",
  "comoda": "1",
  "roupeiro": "0",
  "poltrona": "0",
  "painel": "0",
  "isCondominio": false
}
```

### Response sucesso

```json
{
  "ok": true,
  "tempoNecessario": "02:30"
}
```

**Status HTTP:** `200`

### Response — não encontrado

```json
{
  "ok": true,
  "tempoNecessario": ""
}
```

**Status HTTP:** `200`

> **Nota:** Retorna string vazia quando a combinação não existe no mapa.

### Response erro — não autorizado

```json
{
  "ok": false,
  "error": "Nao autorizado"
}
```

**Status HTTP:** `401`

### Apps Script chamado

`GetTempoNecessario(form)`

### Pontos sensíveis

- O frontend pode enviar o `ProcurarDatasServicoForm` completo; o Apps Script extrai apenas os campos relevantes.
- String vazia `""` é resposta válida para combinação inexistente.

---

## 9. Rota `GET /api/procurar-datas/opcoes`

### Objetivo

Retorna as opções do frontend (dropdowns) e o mapa de tempos de serviço.

### Response sucesso

```json
{
  "ok": true,
  "opcoes": {
    "tipoBerco": ["CONVENCIONAL", "NIDO", "NIDO FUTURO", "SIMPLE"],
    "comoda": ["NÃO", "SIM"],
    "roupeiro": ["NÃO", "SIM"],
    "poltrona": ["NÃO", "SIM"],
    "painel": ["NÃO", "SIM"],
    "baseSemana": 130,
    "adicionalCondominio": 0
  },
  "tempoMap": {
    "NIDO|1|0|0|0": "02:30",
    "CONVENCIONAL|0|0|0|0": "01:00",
    "...": "..."
  }
}
```

**Status HTTP:** `200`

### Response erro — não autorizado

```json
{
  "ok": false,
  "error": "Nao autorizado"
}
```

**Status HTTP:** `401`

### Dependências indiretas confirmadas

| Função Apps Script | Fonte de dados |
|-------------------|----------------|
| `GetFrontOptionLists()` | Planilha de CEP (`PLANILHA DO CEP`) + config sheet (`cep_config`) + `loadFreightParams()` |
| `GetTempoMap()` | Planilha `TEMPO SERVIÇOS` + `CacheService` |

### Pontos sensíveis

- `GetFrontOptionLists` lê validação de dados das células D2..H2 da planilha de CEP.
- `GetTempoMap` usa cache shardado no `CacheService` com invalidação por `DATA_VERSION`.
- Se a planilha `TEMPO SERVIÇOS` não existir, `tempoMap` retorna `{}`.

---

## 10. Rota `POST /api/procurar-datas/validar-endereco`

### Objetivo

Valida e completa um endereço, retornando coordenadas e endereço formatado.

### Request — endereço estruturado

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

### Request — endereço completo (com coordenadas)

```json
{
  "enderecoCompleto": "Rua Exemplo, 123, Centro, Curitiba - PR",
  "lat": -25.42,
  "lng": -49.27,
  "cep": "80000-000"
}
```

### Response sucesso

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

**Status HTTP:** `200`

### Response erro — não autorizado

```json
{
  "ok": false,
  "error": "Nao autorizado"
}
```

**Status HTTP:** `401`

### Apps Script chamado

`LookupCompletoPorEndereco(form)`

### Campos ainda parciais

| Campo | Status | O que falta |
|-------|--------|-------------|
| Campos completos do retorno de `LookupCompletoPorEndereco` | ⚠️ Parcial | Resposta real do AS não totalmente mapeada |
| Cache geográfico no Supabase | ❓ Não confirmado | Apps Script tem `geo_cache_addresses`, Next.js não confirma leitura direta |

---

## 11. Rota `POST /api/procurar-datas/valor-inicial`

### Objetivo

Calcula o valor inicial estimado do frete (usado no modal).

### Request

```json
{
  "cep": "80000-000",
  "enderecoCompleto": "Rua Destino, 456, Bairro Modelo, Curitiba - PR",
  "lat": -25.42,
  "lng": -49.27,
  "destLat": -25.43,
  "destLng": -49.28,
  "isRural": false,
  "isCondominio": false,
  "tipoBerco": "NIDO"
}
```

### Response sucesso

```json
{
  "ok": true,
  "resultado": {
    "ok": true,
    "valor": 150,
    "valorFormatado": "R$ 150,00",
    "valorFmt": "R$ 150,00",
    "distanciaKm": 12.5,
    "fallbackUsado": false,
    "msg": ""
  }
}
```

**Status HTTP:** `200`

### Response sucesso — com fallback (haversine)

```json
{
  "ok": true,
  "resultado": {
    "ok": true,
    "valor": 145,
    "valorFormatado": "R$ 145,00",
    "valorFmt": "R$ 145,00",
    "distanciaKm": 10.2,
    "fallbackUsado": true,
    "msg": "OSRM indisponivel, usando distancia aproximada."
  }
}
```

**Status HTTP:** `200`

### Response erro — não autorizado

```json
{
  "ok": false,
  "error": "Nao autorizado"
}
```

**Status HTTP:** `401`

### Apps Script chamado

`calcularValorInicialModal(form)` — timeout: **60s**.

### Campos confirmados

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `valor` | `number \| null` | Valor numérico |
| `valorFormatado` | `string` | Valor formatado |
| `valorFmt` | `string` | Alias de `valorFormatado` |
| `distanciaKm` | `number \| null` | Distância calculada (OSRM ou haversine) |
| `fallbackUsado` | `boolean` | `true` se haversine foi usado como fallback |
| `msg` | `string` | Mensagem adicional (pode ser vazia) |

### Pontos sensíveis

- Rota existe no Next.js, mas **não confirmado** se ainda é chamada pelo frontend atual.
- `fallbackUsado: true` indica que OSRM falhou e haversine foi usado.
- `msg` pode conter aviso quando fallback é usado.

> **Observação:** os exemplos desta seção são sintéticos e baseados nos campos documentados. Antes de transformar em teste automatizado, validar contra uma resposta real capturada em ambiente seguro.

---

## 12. Erros e status HTTP

| Rota | Status | Cenário | Confirmado |
|------|--------|---------|------------|
| Todas | `401` | Não autorizado (`validarAcessoProcurarDatas`) | ✅ Sim |
| Todas | `500` | Erro interno / Apps Script falhou | ✅ Sim |
| Todas | `504` | Timeout (Apps Script demorou) | ✅ Sim |
| `/pesquisar` | `200` + `ok: true` | Sucesso | ✅ Sim |
| `/progresso` | `400` | `clientToken` ausente | ✅ Sim |
| `/progresso` | `200` + `ok: true` | Sucesso (mesmo com `status: "error"`) | ✅ Sim |
| `/pre-agendar` | `400` | `cand` ou `meta` ausentes | ✅ Sim |
| `/pre-agendar` | `200` + `ok: true` | Sucesso | ✅ Sim |
| `/calcular-tempo` | `200` + `ok: true` | Sucesso (inclusive com `""`) | ✅ Sim |
| `/opcoes` | `200` + `ok: true` | Sucesso | ✅ Sim |
| `/validar-endereco` | `200` + `ok: true` | Sucesso | ✅ Sim |
| `/valor-inicial` | `200` + `ok: true` | Sucesso | ✅ Sim |
| `/pesquisar` | `400` | Payload inválido (não confirmado) | ⚠️ Parcial |
| `/calcular-tempo` | `400` | Payload inválido (não confirmado) | ⚠️ Parcial |

> **Nota:** As rotas não fazem validação de schema explícita no Next.js. Payloads inválidos podem causar erro 500 no `chamarAppsScriptProcurarDatas` ou serem repassados ao Apps Script.

---

## 13. Campos reaproveitados entre rotas

| Campo / Objeto | Rotas que usam | Referência |
|----------------|----------------|------------|
| `clientToken` | `/pesquisar`, `/progresso` | `contratos-payloads.md` §5, §7 |
| `cep` | Todas exceto `/opcoes` | `contratos-payloads.md` §5 |
| `enderecoCompleto` | `/pesquisar`, `/validar-endereco`, `/valor-inicial` | `contratos-payloads.md` §5 |
| `tempoNecessario` | `/pesquisar`, `/calcular-tempo` | `contratos-payloads.md` §5, §12 |
| `cand` | `/pre-agendar` | `contratos-payloads.md` §10 |
| `meta` | `/pre-agendar` | `contratos-payloads.md` §10 |
| `CandidatoFinal` | `/pesquisar` (payload), `/pre-agendar` (entrada) | `contratos-payloads.md` §9 |
| `PayloadCompacto` | `/pesquisar` (em `done`) | `contratos-payloads.md` §8 |
| `ProcurarDatasServicoForm` | `/pesquisar`, `/calcular-tempo`, `/valor-inicial` | `contratos-payloads.md` §5 |

---

## 14. Pontos sensíveis para testes futuros

| Ponto | Descrição | Mitigação atual |
|-------|-----------|-----------------|
| **Dados sensíveis** | Endereços, nomes, coordenadas aparecem em payloads | Anonimização em fixtures |
| **Payloads grandes** | `candidates` pode ter 30+ itens | Documentado como exemplo reduzido |
| **Timeout** | `/pesquisar` (30s), `/progresso` (20s), `/pre-agendar` e `/valor-inicial` (60s) | 504 com mensagem amigável |
| **Estado assíncrono** | Pesquisa roda em background no Apps Script | Polling de progresso com `clientToken` |
| **Retorno parcial** | `normais` e `extras` podem ser vazios | Frontend deve tratar vazio |
| **Status inesperado** | Frontend pode receber `waiting`, `queued`, `running`, `done`, `error` | Documentados os 5 estados |
| **Campos opcionais** | `clientToken`, `lat`, `lng`, etc. | Confirmado no contrato |
| **Divergência AS vs Next.js** | Next.js delega tudo ao AS, sem lógica própria | Documentado em `next-apis.md` |
| **Dados reais de agenda** | Planilhas contêm endereços reais de clientes | Nunca incluídos em fixtures |
| **Rate limit / cota** | Apps Script tem limites diários | Não documentado neste escopo |

---

## 15. O que ainda não está confirmado

| Ponto | Status | Impacto |
|-------|--------|---------|
| Intervalo real de polling no frontend | ❓ Não confirmado | Afeta UX e carga no AS |
| Retry automático no frontend em caso de erro | ❓ Não confirmado | Afeta robustez |
| `valor-inicial` ainda é chamado pelo frontend | ⚠️ Parcial | Rota existe, uso não confirmado |
| Payload completo de `LookupCompletoPorEndereco` | ⚠️ Parcial | Resposta real do AS não totalmente mapeada |
| Status HTTP `400` para payload inválido (exceto `/progresso` e `/pre-agendar`) | ⚠️ Parcial | Rotas não fazem validação de schema explícita |
| Comportamento quando `done` retorna sem candidatos (`normais` e `extras` vazios) | ❓ Não confirmado | Frontend deve tratar? |
| Retry implícito no `chamarAppsScriptProcurarDatas` | ❓ Não confirmado | Pode haver retry na camada inferior |
| Comportamento de `/progresso` quando `clientToken` expirou no AS | ❓ Não confirmado | TTL de 5 minutos do job |

---

## 16. Como estas fixtures serão usadas no futuro

1. **Testes de caracterização**: executar motor v2 com mesma entrada e comparar saída com estas fixtures.
2. **Criação de tipos TypeScript reais**: validar contratos contra exemplos concretos.
3. **Comparação Apps Script vs motor v2**: garantir paridade antes de migrar produção.
4. **Validação de regressão**: antes de cada deploy, rodar fixtures e confirmar que saídas não mudaram inesperadamente.
5. **Documentação viva**: manter atualizado conforme o sistema evolui.

---

## 17. Próxima etapa recomendada

**Revisar estas fixtures por rota** — validar contra exemplos reais capturados em desenvolvimento ou produção, confirmando:

- status HTTP exatos;
- campos opcionais realmente presentes/ausentes;
- formatos de erro reais;
- comportamento de borda (token ausente, payload vazio, timeout).

Somente após esta validação:

- criar tipos TypeScript reais de contrato;
- criar testes de caracterização automatizados;
- criar rota v2 de diagnóstico (`POST /api/procurar-datas/v2/diagnostico`).

> **Não recomendar n8n.**

---

> **Nota final:** Todas as fixtures foram baseadas em leitura real do código das rotas Next.js. Status HTTP confirmados vêm de `respostaErroProcurarDatas`, `validarAcessoProcurarDatas` e tratamento de erro em cada `route.ts`.
