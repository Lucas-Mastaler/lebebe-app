# Contratos de payloads — `/procurar-datas`

> Criado em: junho/2026
> Baseado em: leitura real de rotas Next.js, Apps Script e `src/lib/procurar-datas/types.ts`
> Todas as informações são sintéticas ou anonimizadas.

---

## 1. Objetivo

Este documento consolida os **contratos de payloads** usados entre:

- frontend `/procurar-datas`;
- APIs Next.js;
- Apps Script legado;
- futuro motor v2.

Serve como referência para testes de caracterização, criação futura de tipos TypeScript reais e validação de paridade na migração v2.

---

## 2. Escopo

- **Apenas documentação Markdown**.
- **Não altera código**.
- **Não altera produção**.
- **Não cria testes**.
- **Não cria tipos TypeScript reais** (arquivos `.ts`).
- **Não substitui leitura real do código**.
- **Não altera o motor atual**.

---

## 3. Convenções

| Indicador | Significado |
|-----------|-------------|
| `confirmado` | Campo visto no código real |
| `parcial` | Campo visto, mas origem/uso incompleto |
| `inferido` | Campo deduzido a partir do fluxo |
| `não confirmado` | Precisa de validação futura |
| `?` | Campo opcional no contrato |

Tipos pseudo-TypeScript usados neste documento:

```
string          → texto
number          → número
boolean         → true | false
string (ISO)    → data em ISO 8601
string (money)  → valor monetário formatado (ex: "R$ 150")
null            → ausência explícita
unknown         → tipo não determinado
```

---

## 4. Mapa geral de contratos

| Contrato | Origem | Destino | Arquivo / Função | Status |
|----------|--------|---------|------------------|--------|
| `ProcurarDatasServicoForm` | Frontend | Next.js `POST /pesquisar` | `src/lib/procurar-datas/types.ts` | ✅ Confirmado |
| Início de pesquisa | Next.js | Apps Script | `ApiIniciarPesquisaDatasApp(form)` | ✅ Confirmado |
| Resposta de início | Next.js | Frontend | `pesquisar/route.ts` | ✅ Confirmado |
| Progresso request | Frontend | Next.js `GET /progresso` | `progresso/route.ts` | ✅ Confirmado |
| Progresso AS | Next.js | Apps Script | `GetProgressUpdate(clientToken)` | ✅ Confirmado |
| Resposta de progresso | Next.js | Frontend | `progresso/route.ts` | ✅ Confirmado |
| `PayloadCompacto` | Apps Script | Next.js (estado `done`) | `_procurarDatasCompactPayload_` | ✅ Confirmado |
| `CandidatoFinal` | Apps Script | Next.js → Frontend | `CEP-APIBACK.gs` formatação final | ✅ Confirmado |
| Pré-agendamento request | Frontend | Next.js `POST /pre-agendar` | `pre-agendar/route.ts` | ✅ Confirmado |
| Pré-agendamento AS | Next.js | Apps Script | `ApiPreAgendarDireto(cand, meta)` | ✅ Confirmado |
| Resposta pré-agendamento | Next.js | Frontend | `pre-agendar/route.ts` | ✅ Confirmado |
| Opções request | Frontend | Next.js `GET /opcoes` | `opcoes/route.ts` | ✅ Confirmado |
| Opções AS | Next.js | Apps Script | `GetFrontOptionLists()` + `GetTempoMap()` | ✅ Confirmado |
| Tempo request | Frontend | Next.js `POST /calcular-tempo` | `calcular-tempo/route.ts` | ✅ Confirmado |
| Tempo AS | Next.js | Apps Script | `GetTempoNecessario(form)` | ✅ Confirmado |
| Endereço request | Frontend | Next.js `POST /validar-endereco` | `validar-endereco/route.ts` | ✅ Confirmado |
| Endereço AS | Next.js | Apps Script | `LookupCompletoPorEndereco(form)` | ✅ Confirmado |
| Valor inicial request | Frontend | Next.js `POST /valor-inicial` | `valor-inicial/route.ts` | ✅ Confirmado |
| Valor inicial AS | Next.js | Apps Script | `calcularValorInicialModal(form)` | ✅ Confirmado |
| Config normalizada | Next.js | Superadmin | `GET /api/configuracoes/procurar-datas/config-normalizada` | ✅ Confirmado |
| `slot` (interno) | Apps Script | Apps Script | `getSlots()` | ✅ Confirmado |
| `ponto` (interno) | Apps Script | Apps Script | `coletarPontosDoDia()` | ✅ Confirmado |
| `nearestPoint` (interno) | Apps Script | Apps Script | `CEP-APIBACK.gs` | ✅ Confirmado |

---

## 5. Contrato `ProcurarDatasServicoForm`

### 5.1 Pseudo-interface

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

### 5.2 Exemplo JSON

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

### 5.3 Tabela campo a campo

| Campo | Tipo | Obrigatório | Origem | Status | Observações |
|-------|------|-------------|--------|--------|-------------|
| `clientToken` | `string` | ❌ | Frontend ou gerado pelo AS | ✅ Confirmado | AS gera se ausente |
| `cep` | `string` | ✅ | Digitado pelo usuário | ✅ Confirmado | |
| `enderecoCompleto` | `string` | ✅ | Digitado ou geocodificado | ✅ Confirmado | |
| `lat`, `lng` | `number \| null` | ❌ | Geocoding do CEP | ✅ Confirmado | |
| `destLat`, `destLng` | `number \| null` | ❌ | Geocoding do destino | ✅ Confirmado | |
| `destDisplay` | `string` | ❌ | Geocoding do destino | ✅ Confirmado | |
| `destProvider` | `string` | ❌ | Provedor de geocoding | ✅ Confirmado | |
| `dataInicial` | `string` | ❌ | Selecionado no frontend | ✅ Confirmado | Formato YYYY-MM-DD |
| `monthYear` | `string` | ❌ | Selecionado no frontend | ✅ Confirmado | Formato YYYY-MM |
| `isRural` | `boolean` | ❌ | Checkbox do frontend | ✅ Confirmado | Default false |
| `isCondominio` | `boolean` | ❌ | Checkbox do frontend | ✅ Confirmado | Default false |
| `isEncomenda` | `boolean` | ❌ | Checkbox do frontend | ✅ Confirmado | Default false |
| `tipoBerco` | `string` | ❌ | Dropdown do frontend | ✅ Confirmado | |
| `comoda`, `roupeiro`, `poltrona`, `painel` | `string` | ❌ | Dropdowns do frontend | ✅ Confirmado | |
| `tempoNecessario` | `string` | ✅ | Calculado ou informado | ✅ Confirmado | Formato HH:MM |

---

## 6. Contrato de início da pesquisa

### 6.1 Frontend → Next.js

```
POST /api/procurar-datas/pesquisar
Body: ProcurarDatasServicoForm
```

### 6.2 Next.js → Apps Script

```javascript
ApiIniciarPesquisaDatasApp(form: ProcurarDatasServicoForm)
```

### 6.3 Resposta Next.js → Frontend

```json
{ "ok": true, "clientToken": "app-1751234567890-a1b2c3d4", "status": "started" }
```

ou

```json
{ "ok": true, "clientToken": "app-1751234567890-a1b2c3d4", "status": "already_started" }
```

Erro:

```json
{ "ok": false, "error": "Nao foi possivel iniciar a pesquisa." }
```

| Campo | Tipo | Obrigatório | Status |
|-------|------|-------------|--------|
| `ok` | `boolean` | ✅ | ✅ Confirmado |
| `clientToken` | `string` | ✅ | ✅ Confirmado |
| `status` | `"started" \| "already_started"` | ✅ | ✅ Confirmado |
| `error` | `string` | ❌ (só em erro) | ✅ Confirmado |

---

## 7. Contrato de progresso / polling

### 7.1 Frontend → Next.js

```
GET /api/procurar-datas/progresso?clientToken={clientToken}
```

### 7.2 Next.js → Apps Script

```javascript
GetProgressUpdate(clientToken: string)
```

### 7.3 Resposta Next.js → Frontend

```json
{
  "ok": true,
  "progress": {
    "status": "done",
    "clientToken": "app-1751234567890-a1b2c3d4",
    "payload": { },
    "normais": [],
    "extras": [],
    "timestamp": 1751234600000,
    "startedAt": "2026-06-11T10:00:00.000Z",
    "finishedAt": "2026-06-11T10:01:40.000Z",
    "durationMs": 100000
  }
}
```

### 7.4 Estados possíveis

| Estado | Significado | Origem |
|--------|-------------|--------|
| `waiting` | Nenhum progresso salvo ainda | default de `GetProgressUpdate` |
| `queued` | Job criado, aguardando worker | `ApiIniciarPesquisaDatasApp` |
| `running` | Worker iniciou o processamento | `ApiExecutarPesquisaDatasWorker` |
| `done` | Pesquisa concluída | `ApiExecutarPesquisaDatasWorker` |
| `error` | Erro durante a pesquisa | `ApiExecutarPesquisaDatasWorker` |

### 7.5 Campos do progresso

| Campo | Tipo | Obrigatório | Status | Observações |
|-------|------|-------------|--------|-------------|
| `status` | `string` | ✅ | ✅ Confirmado | Estados acima |
| `clientToken` | `string` | ✅ (exceto `waiting`) | ✅ Confirmado | |
| `payload` | `PayloadCompacto` | ❌ (só em `done`) | ✅ Confirmado | |
| `normais` | `CandidatoFinal[]` | ✅ | ✅ Confirmado | Pode ser vazio |
| `extras` | `CandidatoFinal[]` | ✅ | ✅ Confirmado | Pode ser vazio |
| `timestamp` | `number` | ✅ | ✅ Confirmado | Epoch ms |
| `startedAt` | `string (ISO)` | ❌ | ✅ Confirmado | |
| `finishedAt` | `string (ISO)` | ❌ | ✅ Confirmado | |
| `durationMs` | `number` | ❌ | ✅ Confirmado | |
| `error` | `string` | ❌ (só em `error`) | ✅ Confirmado | |

### 7.6 Nota: dois mecanismos de progresso

> 1. **Progresso assíncrono do app** (`PublicAPI.gs`): salva payload completo via `_procurarDatasSalvarProgressoRaw_` — **este é o mecanismo consumido pelo frontend**.
> 2. **Progresso parcial interno** (`CEP-APIBACK.gs`): salva `normais`, `extras`, `status`, `timestamp` via `saveProgress_` — interno ao motor.

---

## 8. Contrato `PayloadCompacto`

### 8.1 Pseudo-interface

```typescript
interface PayloadCompacto {
  ok: boolean
  cep: string
  tempo: string
  label: string
  address: string
  addressShort: string
  startFromISO: string
  startFromDM: string
  isRural: boolean
  isCondominio: boolean
  params: string
  candidates: CandidatoFinal[]
  searchTime: string
}
```

### 8.2 Tabela campo a campo

| Campo | Tipo | Obrigatório | Status | Observações |
|-------|------|-------------|--------|-------------|
| `ok` | `boolean` | ✅ | ✅ Confirmado | |
| `cep` | `string` | ✅ | ✅ Confirmado | |
| `tempo` | `string` | ✅ | ✅ Confirmado | Tempo de serviço (HH:MM) |
| `label` | `string` | ✅ | ✅ Confirmado | Bairro/cidade simplificado |
| `address` | `string` | ✅ | ✅ Confirmado | Endereço completo |
| `addressShort` | `string` | ✅ | ✅ Confirmado | Endereço resumido |
| `startFromISO` | `string` | ✅ | ✅ Confirmado | Data inicial YYYY-MM-DD |
| `startFromDM` | `string` | ✅ | ✅ Confirmado | Data inicial dd/MM |
| `isRural` | `boolean` | ✅ | ✅ Confirmado | |
| `isCondominio` | `boolean` | ✅ | ✅ Confirmado | |
| `params` | `string` | ✅ | ✅ Confirmado | Pode ser vazio |
| `candidates` | `CandidatoFinal[]` | ✅ | ✅ Confirmado | |
| `searchTime` | `string` | ✅ | ✅ Confirmado | Segundos como string |

---

## 9. Contrato `CandidatoFinal`

### 9.1 Pseudo-interface

```typescript
interface CandidatoFinal {
  rank: number
  dateISO: string
  dateDM: string
  weekday: string
  daysLeftTxt: string
  encomenda: string
  frete: string
  team: string
  tipo: 'normal' | 'especial' | 'premium' | 'hora-marcada' | string
  isExtra: boolean
  avisoHoraMarcada: string
}
```

### 9.2 Tabela campo a campo

| Campo | Tipo | Obrigatório | Status | Uso | Observações |
|-------|------|-------------|--------|-----|-------------|
| `rank` | `number` | ✅ | ⚠️ Parcial | Exibição | Calculado como `rankCounter++` no payload final; não participado do ranking interno |
| `dateISO` | `string (ISO)` | ✅ | ✅ Confirmado | Exibição + pré-agendamento | |
| `dateDM` | `string` | ✅ | ✅ Confirmado | Exibição | Formato dd/MM |
| `weekday` | `string` | ✅ | ✅ Confirmado | Exibição | Nome do dia (ex: "Sexta") |
| `daysLeftTxt` | `string` | ✅ | ✅ Confirmado | Exibição | Ex: "1 d" |
| `encomenda` | `string` | ✅ | ✅ Confirmado | Exibição | `"Sim"` ou `"Não"` |
| `frete` | `string (money)` | ✅ | ✅ Confirmado | Exibição + pré-agendamento | Ex: "R$ 150" |
| `team` | `string` | ✅ | ✅ Confirmado | Exibição + pré-agendamento | Ex: "EQUIPE 1" |
| `tipo` | `string` | ✅ | ✅ Confirmado | Exibição + pré-agendamento | `normal`, `especial`, `premium`, `hora-marcada` |
| `isExtra` | `boolean` | ✅ | ✅ Confirmado | Exibição | `true` para especial/premium/hora-marcada |
| `avisoHoraMarcada` | `string` | ✅ | ✅ Confirmado | Exibição | Vazio para tipos não-hora-marcada |

### 9.3 Separação de usos

| Uso | Campos necessários |
|-----|-------------------|
| **Exibição no frontend** | `rank`, `dateDM`, `weekday`, `daysLeftTxt`, `encomenda`, `frete`, `team`, `tipo`, `isExtra`, `avisoHoraMarcada` |
| **Pré-agendamento** | `dateISO`, `team`, `frete`, `tipo` |
| **Ranking interno (AS)** | `dateISO` (ordenação), `tipo` (classificação) — `rank` é calculado no final |

---

## 10. Contrato de pré-agendamento

### 10.1 Frontend → Next.js

```
POST /api/procurar-datas/pre-agendar
Body: { cand: ProcurarDatasCandidate, meta: ProcurarDatasPreAgendamentoMeta }
```

### 10.2 Next.js → Apps Script

```javascript
ApiPreAgendarDireto(cand, meta)
```

### 10.3 Payload `cand`

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

### 10.4 Payload `meta`

```typescript
interface ProcurarDatasPreAgendamentoMeta {
  tempo?: string
  label?: string
  address?: string
  cep?: string
  params?: string
}
```

### 10.5 Resposta de sucesso

```json
{
  "ok": true,
  "titulo": "(02:30) BAIRRO MODELO (EQUIPE 1 - USUARIO) (FRETE: HORA MARCADA)",
  "eventLink": "https://calendar.google.com/..."
}
```

### 10.6 Resposta de erro

```json
{ "ok": false, "error": "PRE_CALENDAR_ID não definido no backend." }
```

> Para detalhes completos (construção do título, descrição, Google Calendar, auditoria, etc.), ver `docs/procurar-datas-pre-agendamento.md`.

---

## 11. Contrato de opções

### 11.1 Frontend → Next.js

```
GET /api/procurar-datas/opcoes
```

### 11.2 Next.js → Apps Script

```javascript
GetFrontOptionLists()  // lê planilha de CEP + config sheet + freight params
GetTempoMap()          // lê planilha 'TEMPO SERVIÇOS'
```

### 11.3 Resposta Next.js → Frontend

```json
{
  "ok": true,
  "opcoes": {
    "tipoBerco": ["CONVENCIONAL", "NIDO"],
    "comoda": ["NÃO", "SIM"],
    "roupeiro": ["NÃO", "SIM"],
    "poltrona": ["NÃO", "SIM"],
    "painel": ["NÃO", "SIM"],
    "baseSemana": 130,
    "adicionalCondominio": 0
  },
  "tempoMap": {
    "NIDO|1|0|0|0": "02:30"
  }
}
```

### 11.4 Campos confirmados

| Campo | Tipo | Status | Observações |
|-------|------|--------|-------------|
| `opcoes.tipoBerco` | `string[]` | ✅ Confirmado | Células D2..H2 da planilha de CEP via DataValidation |
| `opcoes.comoda`, `roupeiro`, `poltrona`, `painel` | `string[]` | ✅ Confirmado | Mesma origem |
| `opcoes.baseSemana` | `number` | ✅ Confirmado | `loadFreightParams(cfgSheet)` |
| `opcoes.adicionalCondominio` | `number` | ✅ Confirmado | `loadFreightParams(cfgSheet)` |
| `tempoMap` | `Record<string, string>` | ✅ Confirmado | Chave: `tipoBerco|comoda|roupeiro|poltrona|painel` → `"HH:MM"` |

---

## 12. Contrato de cálculo de tempo

### 12.1 Frontend → Next.js

```
POST /api/procurar-datas/calcular-tempo
Body: ProcurarDatasServicoForm (subconjunto: tipoBerco, comoda, roupeiro, poltrona, painel, isCondominio)
```

### 12.2 Next.js → Apps Script

```javascript
GetTempoNecessario(form)
```

### 12.3 Resposta Next.js → Frontend

```json
{ "ok": true, "tempoNecessario": "02:30" }
```

| Campo | Tipo | Status | Observações |
|-------|------|--------|-------------|
| `ok` | `boolean` | ✅ Confirmado | |
| `tempoNecessario` | `string` | ✅ Confirmado | HH:MM; `""` se não encontrado |

---

## 13. Contrato de validação de endereço

### 13.1 Frontend → Next.js

```
POST /api/procurar-datas/validar-endereco
Body: ProcurarDatasEnderecoForm
```

### 13.2 Pseudo-interface de entrada

```typescript
interface ProcurarDatasEnderecoForm {
  logradouro?: string
  numero?: string
  bairro?: string
  cidade?: string
  uf?: string
  cep?: string
  enderecoCompleto?: string
  lat?: number | null
  lng?: number | null
  destLat?: number | null
  destLng?: number | null
  destDisplay?: string
  destProvider?: string
}
```

### 13.3 Next.js → Apps Script

```javascript
LookupCompletoPorEndereco(form: ProcurarDatasEnderecoForm)
```

### 13.4 Resposta Next.js → Frontend (parcial)

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

### 13.5 Campos ainda não confirmados

| Campo | Status | O que falta |
|-------|--------|-------------|
| Estrutura completa do retorno de `LookupCompletoPorEndereco` | ⚠️ Parcial | Campos exatos da resposta real do AS não totalmente mapeados |
| Cache geográfico | ❓ Não confirmado | Apps Script tem `geo_cache_addresses`; Next.js não confirma leitura direta |

---

## 14. Contrato de valor inicial

### 14.1 Frontend → Next.js

```
POST /api/procurar-datas/valor-inicial
Body: ProcurarDatasServicoForm
```

### 14.2 Next.js → Apps Script

```javascript
calcularValorInicialModal(form: ProcurarDatasServicoForm)
```

### 14.3 Resposta Next.js → Frontend

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

### 14.4 Campos confirmados

| Campo | Tipo | Status | Observações |
|-------|------|--------|-------------|
| `ok` | `boolean` | ✅ Confirmado | |
| `valor` | `number \| null` | ✅ Confirmado | Valor numérico |
| `valorFormatado` | `string` | ✅ Confirmado | |
| `valorFmt` | `string` | ✅ Confirmado | Alias de `valorFormatado` |
| `distanciaKm` | `number \| null` | ✅ Confirmado | Distância calculada via OSRM ou haversine |
| `fallbackUsado` | `boolean` | ✅ Confirmado | `true` se haversine foi usado |
| `msg` | `string` | ✅ Confirmado | Pode ser vazio |

---

## 15. Contrato de config normalizada

### 15.1 Rota

```
GET /api/configuracoes/procurar-datas/config-normalizada
```

Acesso restrito a **superadmin**. Não participa do fluxo de busca do usuário final.

### 15.2 Pseudo-interface de resposta

```typescript
interface ConfigServiceResult {
  ok: true
  origem: 'supabase' | 'planilha_fallback' | 'misto' | 'erro'
  faltantesNoSupabase: string[]
  usandoFallbackPlanilha: boolean
  lido_em: string
  config: ConfigNormalizada
}
```

### 15.3 Campos de `ConfigNormalizada` (confirmados em `config-service.ts`)

| Categoria | Campos | Tipo |
|-----------|--------|------|
| Geral | `planilhaDaAgenda`, `planilhaDeTempoDisponivel`, `planilhaDoCep`, `supabaseTable`, `osrmBaseUrl` | `string` |
| Geral | `diasPesquisaAgenda` | `number` |
| Rota (metros) | `kmAdicionalMaxNaRotaM`, `kmMaximoNaSemanaM`, `kmMaximoNoSabadoM`, `kmAdicionalMaxNaRotaEspecialM`, `kmAdicionalMaxNaRotaPremiumM` | `number` |
| Rota (km) | `kmMaxEntrePontosKm` | `number` |
| Candidatos/Preços | `valorAdicionalRotaEspecial`, `valorAdicionalRotaPremium`, `horaMarcadaHorasAMais`, `horaMarcadaValorAdicional` | `number` |
| Equipes | `equipe1Ativa`, `equipe2Ativa` | `boolean` |
| Equipes | `enderecoDeposito`, `enderecoCasaEqp1`, `enderecoCasaEqp2` | `string` |
| Frete (km) | `kmMaxViagem`, `kmMaxValorFixo`, `kmMaxLongaCidade`, `kmMaxNaoViagem` | `number` |
| Frete (valores) | `valorSemanaAte10km`, `valorSabadoAte10km`, `valorDiaApos25kmSemana`, `valorDiaApos25kmSabado`, `precoCondominioAdicional` | `number` |
| Frete (mult.) | `fatorMultiplicadorKmViagem`, `multiplicadorKmNaoViagem` | `number` |
| Frete (tempo) | `tempoMaximoViagemSabadoMin` | `number` (minutos inteiros) |

> Ver também: `src/lib/procurar-datas/config-service.ts`, `docs/procurar-datas-codemap.md`, tela `/configuracoes/procurar-datas`.

---

## 16. Contratos internos legados (alto nível)

Objetos internos do Apps Script que não chegam diretamente ao frontend, mas participam do processamento.

> **Aviso:** Estes contratos internos são apenas aproximações documentais baseadas no Apps Script. Antes de virar TypeScript real, devem ser validados contra fixtures de caracterização por rota e contra exemplos reais de candidatos.

### 16.1 `SlotLegado`

Objeto criado em `getSlots()` (`CEP-CONFIG.gs`, linhas ~1574–1594) e enriquecido em `coletarPontosDoDia()`.

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

| Campo | Tipo | Origem | Observações |
|-------|------|--------|-------------|
| `date` | `Date` | Planilha de agenda/disponibilidade | Chave de agrupamento (`toDateString`) |
| `team` | `string` | Planilha + `normTeam()` | Normalizado para 'EQUIPE 1' ou 'EQUIPE 2' |
| `availStr` | `string` | Planilha (coluna de disponibilidade) | Parseável por `parseMinutes` (ex: `"04:00"`) |
| `pontos` | `PontoAgendaLegado[]` | `coletarPontosDoDia()` — planilha `shAg` | Linhas da planilha de agenda |
| `nearestPoint` | `NearestPointLegado \| null` | Calculado em `CEP-APIBACK.gs` | Opcional (slot vazio) |
| `delta` | `number` | Calculado em `CEP-APIBACK.gs` | Menor distância de inserção na rota (km) |
| `loc` | `Coordenada` | Geocoding do endereço de origem | Usado para cálculo de distância |

> **Nota:** Não existe campo `disponivel` booleano no objeto real. A disponibilidade é inferida por `availStr` e `parseMinutes`.

### 16.2 `PontoAgendaLegado`

Objeto criado em `coletarPontosDoDia()` (`CEP-CONFIG.gs`, linhas ~1596–1756). Representa um ponto de entrega da planilha de agenda.

```typescript
interface PontoAgendaLegado {
  loc: Coordenada
  addr: string
  eventTitle: string
  cep: string | null
  cepSource?: string
}
```

| Campo | Tipo | Origem | Observações |
|-------|------|--------|-------------|
| `loc` | `Coordenada` | Geocoding do endereço do evento | Usado para cálculo de distância (Haversine, OSRM) |
| `addr` | `string` | Planilha `shAg` (disp[i][5]) ou extraído de disp[i][4] | Endereço bruto do evento |
| `eventTitle` | `string` | Planilha `shAg` (disp[i][2]) | Coluna 3 da planilha |
| `cep` | `string \| null` | `resolveCEPFromAddress_` | Pode ser `null` se geocoding falhar |
| `cepSource` | `string` | `resolveCEPFromAddress_` | `geocoding`, `regex_fallback`, `regex_endereco_fallback`, `nenhuma` |

> **Nota:** O ponto vem da **planilha de agenda (`shAg`)**, não do Google Calendar. Google Calendar (`CalendarApp`) só é usado no pré-agendamento.

### 16.3 `NearestPointLegado`

Subobjeto calculado dentro do `slot`/`candidato` em `CEP-APIBACK.gs` (linhas ~956–963 e ~1077–1083). Representa a âncora mais próxima do novo destino.

```typescript
interface NearestPointLegado {
  addr: string
  cep: string | null
  distancia: number
  eventTitle?: string | null
  loc: Coordenada
}
```

| Campo | Tipo | Origem | Observações |
|-------|------|--------|-------------|
| `addr` | `string` | Endereço do ponto de entrega (`p.addr`) | Usado para decisão de âncora |
| `cep` | `string \| null` | `resolveCEPFromAddress_` | Log, auditoria |
| `distancia` | `number` | `nearKm` — distância OSRM até o novo destino (km) | Ranking por região |
| `eventTitle` | `string \| null` | Herdado do ponto (`p.eventTitle`) | Log |
| `loc` | `Coordenada` | Herdado do ponto (`p.loc`) | — |

> **Nota:** `distancia` vem de OSRM (`getDrivingKmBatch()`), não de haversine.

### 16.4 `CandidatoLegado`

Objeto criado em `CEP-APIBACK.gs` (linhas ~1070–1084). É essencialmente o slot com campos calculados (`delta`, `nearestPoint`).

```typescript
interface CandidatoLegado {
  date: Date
  team: string
  delta: number
  availStr: string
  pontos: PontoAgendaLegado[]
  nearestPoint: NearestPointLegado | null
}
```

| Campo | Tipo | Origem | Observações |
|-------|------|--------|-------------|
| `date` | `Date` | Herdado do `slot.date` | Ranking, exibição |
| `team` | `string` | Herdado do `slot.team` | Ranking, exibição |
| `delta` | `number` | `bestKm` — menor distância de inserção na rota | Ranking, decisão de tipo |
| `availStr` | `string` | Herdado do `slot.availStr` | Exibição, log |
| `pontos` | `PontoAgendaLegado[]` | Herdado do `slot.pontos` | Cálculo de nearestPoint, reintrodução |
| `nearestPoint` | `NearestPointLegado \| null` | Calculado no slot | Ranking por região, log |

> **Nota:** Não há campos como `rank`, `tipo`, `frete`, `freteNum`, `distKm` ou `encomendaFlag` no objeto interno. Esses campos são adicionados no payload de retorno ao frontend (`PublicAPI.gs`).

> Para estrutura detalhada dos objetos internos, ver:
> - `docs/procurar-datas-estrutura-candidato.md`
> - `docs/procurar-datas-fixtures.md`

---

## 17. Campos sensíveis para futura tipagem

Campos que precisam de atenção especial antes de virarem tipos TypeScript reais:

| Campo | Risco | Recomendação |
|-------|-------|--------------|
| `dateISO` | Às vezes é string ISO completa, às vezes só YYYY-MM-DD | Definir se é `Date` ou `string` no contrato final |
| `frete` | String formatada ("R$ 150") — não é `number` | Manter como `string (money)`, criar campo `freteNum` separado se necessário |
| `rank` | Calculado como `rankCounter++`, não é score do ranking interno | Não confundir com ordenação real |
| `label` | Produzido por parsing de endereço — pode variar | Confirmar como é gerado antes de tipar |
| `availStr` | Parseável por `parseMinutes` (formato "HH:MM") | Sempre tratar como string, nunca como `Date` |
| `tipo` | Atualmente string livre com valores conhecidos | Candidato a `enum` no motor v2 |
| `clientToken` | Opcional no request, sempre presente na resposta | Não assumir presença sem checar estado |
| `searchTime` | String com segundos (ex: "45.2"), não número | Parsear com `parseFloat` antes de usar como número |
| `delta` / `distKm` | Usado internamente em metros ou km dependendo do contexto | Confirmar unidade antes de tipar |
| Respostas de erro | Formato inconsistente entre rotas (`error` vs `err` vs `message`) | Padronizar no motor v2 |

---

## 18. Pontos ainda não confirmados

| Ponto | Status | Impacto |
|-------|--------|---------|
| Intervalo de polling no frontend | ❓ Não confirmado | Pode afetar UX e carga no Apps Script |
| Retry automático no frontend em caso de erro | ❓ Não confirmado | Pode afetar robustez |
| `valor-inicial` ainda é chamado pelo frontend | ⚠️ Parcial | Rota existe, uso no modal não confirmado nesta leitura |
| Cache geográfico no Supabase (`geo_cache_addresses`) | ❓ Não confirmado | Next.js não lê diretamente — só AS |
| Timeout real do `executarAppsScript` (camada interna) | ❓ Não confirmado | Pode ser mais baixo que o wrapper |
| `clientToken` sempre gerado pelo frontend | ⚠️ Parcial | Frontend pode enviar, AS gera se ausente |
| Payload exato de `LookupCompletoPorEndereco` | ⚠️ Parcial | Resposta real do AS não totalmente mapeada |
| Campos exatos de `CandidatoBruto` antes da formatação | ⚠️ Parcial | Não confirmado em profundidade na leitura atual |
| Campos de `slot` e `ponto` em detalhe | ⚠️ Parcial | Confirmados em alto nível; profundidade pendente |
| Comportamento quando `normais` e `extras` estão ambos vazios em `done` | ❓ Não confirmado | Frontend trata? AS evita? |

---

## 19. Próxima etapa recomendada

**Criar fixtures de caracterização por rota** — para cada rota Next.js, registrar um exemplo real de request e response capturado em produção ou em ambiente de desenvolvimento.

Formato sugerido: arquivo Markdown separado `docs/procurar-datas-fixtures-por-rota.md` ou arquivos JSON versionados em `docs/fixtures/`.

Isso permitirá:

- validar este documento de contratos contra dados reais;
- criar testes de regressão sem afetar produção;
- comparar saída do motor v2 com saída real do Apps Script;
- confirmar campos parciais e não confirmados listados na seção 18.

> Criar os tipos TypeScript reais somente depois que as fixtures estiverem validadas.
> Criar a rota `POST /api/procurar-datas/v2/diagnostico` somente depois dos tipos validados.
> **Não recomendar n8n**.

---

> **Nota final:** Todas as informações neste documento foram baseadas em leitura real do código. Campos marcados como `não confirmado` ou `parcial` precisam de validação antes de serem usados como tipos TypeScript ou como base para testes automatizados.
