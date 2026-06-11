# Fixtures de caracterizacao — `/procurar-datas`

> Criado em: junho/2026
> Baseado em: `PublicAPI.gs`, `CEP-APIBACK.gs`, `CEP-CONFIG.gs`, `types.ts`
> Todas as informacoes sao sinteticas ou anonimizadas.

---

## 1. Objetivo

Registra exemplos de payloads e objetos do motor legado para servir como **contrato de comportamento** em futura migracao do motor v2.

---

## 2. Escopo

- Apenas documentacao.
- Nao altera codigo, producao, testes ou tipos TypeScript.
- Nao substitui leitura real do codigo.

---

## 3. Regras de anonimizacao

- Nomes ficticios (ex: "Cliente Exemplo").
- Enderecos genericos (ex: `Rua Exemplo, 123, Curitiba - PR`).
- Coordenadas aproximadas, nao correspondem a enderecos reais.
- Valores monetarios representativos.

---

## 4. Payload de entrada da pesquisa

Objeto enviado pelo frontend para `POST /api/procurar-datas/pesquisar` e repassado ao Apps Script como `form`.

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

| Campo | Tipo | Obrigatorio | Status |
|-------|------|-------------|--------|
| `clientToken` | `string` | ❌ (gerado no AS se ausente) | ✅ Confirmado |
| `cep` | `string` | ✅ | ✅ Confirmado |
| `enderecoCompleto` | `string` | ✅ | ✅ Confirmado |
| `lat`, `lng` | `number \| null` | ❌ | ✅ Confirmado |
| `destLat`, `destLng` | `number \| null` | ❌ | ✅ Confirmado |
| `destDisplay` | `string` | ❌ | ✅ Confirmado |
| `destProvider` | `string` | ❌ | ✅ Confirmado |
| `dataInicial` | `string` | ❌ | ✅ Confirmado |
| `monthYear` | `string` | ❌ | ✅ Confirmado |
| `isRural` | `boolean` | ❌ | ✅ Confirmado |
| `isCondominio` | `boolean` | ❌ | ✅ Confirmado |
| `isEncomenda` | `boolean` | ❌ | ✅ Confirmado |
| `tipoBerco` | `string` | ❌ | ✅ Confirmado |
| `comoda`, `roupeiro`, `poltrona`, `painel` | `string` | ❌ | ✅ Confirmado |
| `tempoNecessario` | `string` | ✅ | ✅ Confirmado |

---

## 5. Payload de progresso

Retorno de `GetProgressUpdate` (lido do `PropertiesService`).

> **Nota sobre dois mecanismos de progresso:**
> 1. **Progresso assíncrono do app** (`PublicAPI.gs`): salva payload completo no estado `done` via `_procurarDatasSalvarProgressoRaw_`.
> 2. **Progresso parcial interno** (`CEP-APIBACK.gs`): salva principalmente `normais`, `extras`, `status` e `timestamp` via `saveProgress_`.
> Este documento descreve o mecanismo 1 (app), que é o que o frontend consome.

### 5.1 `waiting`

Quando ainda não existe progresso salvo em `PROGRESS_<clientToken>`:

```json
{
  "status": "waiting",
  "normais": [],
  "extras": []
}
```

### 5.2 `queued`

```json
{
  "status": "queued",
  "clientToken": "app-1751234567890-a1b2c3d4",
  "normais": [],
  "extras": [],
  "timestamp": 1751234567890
}
```

### 5.3 `running`

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

### 5.4 `done`

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

### 5.5 `error`

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

| Campo | Tipo | Obrigatorio | Status |
|-------|------|-------------|--------|
| `status` | `string` | ✅ | ✅ Confirmado |
| `clientToken` | `string` | ✅ | ✅ Confirmado |
| `normais`, `extras` | `array` | ✅ | ✅ Confirmado |
| `timestamp` | `number` | ✅ | ✅ Confirmado |
| `payload` | `object` | ❌ (so `done`) | ✅ Confirmado |
| `error` | `string` | ❌ (so `error`) | ✅ Confirmado |
| `startedAt`, `finishedAt` | `string (ISO)` | ❌ | ✅ Confirmado |
| `durationMs` | `number` | ❌ | ✅ Confirmado |

---

## 6. Slot de disponibilidade

```javascript
{
  date: new Date("2026-06-12T00:00:00.000-03:00"),
  team: "EQUIPE 1",
  availStr: "04:00",
  pontos: [ /* ver secao 7 */ ],
  nearestPoint: { /* ver secao 8 */ },
  delta: 3.42,
  loc: { lat: -25.42, lng: -49.27 }
}
```

| Campo | Tipo | Obrigatorio | Status |
|-------|------|-------------|--------|
| `date` | `Date` | ✅ | ✅ Confirmado |
| `team` | `string` | ✅ | ✅ Confirmado |
| `availStr` | `string` | ✅ | ✅ Confirmado (formato parseável por `parseMinutes`, ex: `"04:00"`)
| `pontos` | `Ponto[]` | ✅ | ✅ Confirmado |
| `nearestPoint` | `object \| null` | ❌ | ✅ Confirmado |
| `delta` | `number` | ✅ | ✅ Confirmado |
| `loc` | `Coordenada` | ✅ | ✅ Confirmado |

---

## 7. Ponto de agenda

**Importante:** vem da planilha `shAg`, **nunca do Google Calendar**.

```javascript
{
  addr: "Rua Cliente A, 100, Bairro Alpha, Curitiba - PR",
  loc: { lat: -25.41, lng: -49.26 },
  eventTitle: "Entrega - Cliente Exemplo A",
  cep: "80010-000",
  cepSource: "geocoding"
}
```

| Campo | Tipo | Origem | Status |
|-------|------|--------|--------|
| `addr` | `string` | Planilha `shAg` (disp[i][5]) | ✅ Confirmado |
| `loc` | `Coordenada` | Geocoding do endereco do evento | ✅ Confirmado |
| `eventTitle` | `string` | Planilha `shAg` (disp[i][2]) | ✅ Confirmado |
| `cep` | `string \| null` | `resolveCEPFromAddress_` | ✅ Confirmado |
| `cepSource` | `string` | `resolveCEPFromAddress_` | ✅ Confirmado (`geocoding`, `regex_fallback`, `regex_endereco_fallback`, `nenhuma`)

---

## 8. nearestPoint

```javascript
{
  addr: "Rua Cliente A, 100, Bairro Alpha, Curitiba - PR",
  cep: "80010-000",
  distancia: 2.15,
  eventTitle: "Entrega - Cliente Exemplo A",
  loc: { lat: -25.41, lng: -49.26 }
}
```

| Campo | Tipo | Status |
|-------|------|--------|
| `addr` | `string` | ✅ Confirmado |
| `cep` | `string \| null` | ✅ Confirmado |
| `distancia` | `number` (km) | ✅ Confirmado |
| `eventTitle` | `string \| null` | ✅ Confirmado |
| `loc` | `Coordenada` | ✅ Confirmado |

---

## 9. Candidato normal

### 9.1 Bruto (interno)

```javascript
{
  date: new Date("2026-06-12T00:00:00.000-03:00"),
  team: "EQUIPE 1",
  delta: 3.42,
  availStr: "04:00",
  pontos: [ /* Ponto[] */ ],
  nearestPoint: { /* NearestPoint */ }
}
```

### 9.2 Final (ao frontend)

```json
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
```

### 9.3 Campos que influenciam ranking

| Campo | Funcao | Status |
|-------|--------|--------|
| `date` | Ordenacao cronologica | ✅ |
| `delta` | Ordenacao por proximidade | ✅ |
| `team` | Decisao de origem, ranking por regiao | ✅ |
| `pontos.length` | Consolidacao fraca | ✅ |
| `nearestPoint.distancia` | Equipe na regiao | ✅ |
| `nearestPoint` (existencia) | Dia aberto vs fechado | ✅ |

---

## 10. Candidato especial

```json
{
  "rank": 6,
  "dateISO": "2026-06-15T00:00:00.000Z",
  "dateDM": "15/06",
  "weekday": "Segunda",
  "daysLeftTxt": "4 d",
  "encomenda": "Nao",
  "frete": "R$ 350",
  "team": "EQUIPE 1",
  "tipo": "especial",
  "isExtra": true,
  "avisoHoraMarcada": ""
}
```

> Diferenca: `tipo: "especial"`, `isExtra: true`, frete acrescido de `VALOR_ADICIONAL_ESPECIAL`.

---

## 11. Candidato premium

```json
{
  "rank": 7,
  "dateISO": "2026-06-18T00:00:00.000Z",
  "dateDM": "18/06",
  "weekday": "Quinta",
  "daysLeftTxt": "7 d",
  "encomenda": "Nao",
  "frete": "R$ 550",
  "team": "EQUIPE 2",
  "tipo": "premium",
  "isExtra": true,
  "avisoHoraMarcada": ""
}
```

> Diferenca: `tipo: "premium"`, `isExtra: true`, frete acrescido de `VALOR_ADICIONAL_PREMIUM`.

---

## 12. Candidato hora marcada

```json
{
  "rank": 8,
  "dateISO": "2026-06-20T00:00:00.000Z",
  "dateDM": "20/06",
  "weekday": "Sabado",
  "daysLeftTxt": "9 d",
  "encomenda": "Nao",
  "frete": "R$ 280",
  "team": "EQUIPE 1",
  "tipo": "hora-marcada",
  "isExtra": true,
  "avisoHoraMarcada": "limite de horario de entrega ate as 16h"
}
```

> Diferenca: `tipo: "hora-marcada"`, `isExtra: true`, `avisoHoraMarcada` preenchido, frete acrescido de `HORA_MARCADA_VALOR_ADICIONAL`.

---

## 13. Resposta final ao frontend

### 13.1 Payload compacto (`_procurarDatasCompactPayload_`)

```json
{
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
  "candidates": [ /* CandidatoFinal[] */ ],
  "searchTime": "45.2"
}
```

### 13.2 Resumo legado (`ApiPesquisarDatasApp`)

```json
{
  "ok": true,
  "endereco": "Rua Destino, 456, Bairro Modelo, Curitiba - PR",
  "enderecoSimplificado": "Rua Destino, 456",
  "coordenadas": { "lat": -25.43, "lng": -49.28 },
  "tempoServico": "02:30",
  "isRural": false,
  "isCondominio": false,
  "totalCandidatos": 8,
  "tempoProcessamento": 45.2,
  "candidatos": [
    { "diaSemana": "Sexta", "data": "12/06", "rank": 1, "equipe": "EQUIPE 1" },
    { "diaSemana": "Segunda", "data": "15/06", "rank": 2, "equipe": "EQUIPE 1" }
  ]
}
```

> O frontend moderno consome via polling de progresso (`payload` + `normais` + `extras`). O formato acima e do fluxo legado `ApiPesquisarDatasApp`.

---

## 14. Casos de borda importantes

### 14.1 Slot sem pontos (slot vazio)

```javascript
{
  date: new Date("2026-06-13T00:00:00.000-03:00"),
  team: "EQUIPE 1",
  availStr: "04:00",
  pontos: [],
  nearestPoint: null,
  delta: Infinity,
  loc: { lat: -25.42, lng: -49.27 }
}
```

> Impacto: slot vazio pode ser incluido como "fechado" ou excluido, conforme regra de negocio.

### 14.2 Ponto sem CEP

```javascript
{
  addr: "Rua Sem CEP, S/N, Bairro X, Curitiba - PR",
  loc: { lat: -25.40, lng: -49.25 },
  eventTitle: "Entrega - Cliente B",
  cep: null,
  cepSource: null
}
```

> Impacto: `cep` null no `nearestPoint`; log de auditoria registra `'?'`.

### 14.3 Geocoding falhando

- Endereco nao resolvido: `loc` pode ser `null` ou coordenada aproximada.
- Ponto sem `loc` valido e ignorado em `coletarPontosDoDia()`.

### 14.4 OSRM falhando e usando haversine

- `getDrivingKm` faz fallback para `haversine()` quando OSRM retorna erro ou timeout.
- Distancia haversine e geodesica (reta), geralmente menor que a viaria.

### 14.5 Equipe inativa

- Config `EQUIPE 1 ATIVA?` ou `EQUIPE 2 ATIVA?` = `false`.
- `getSlots()` monta slots por data/equipe/disponibilidade. O filtro de equipe inativa ocorre depois, no fluxo principal de `pesquisarRotaToTargetWithParams`, usando `carregarEquipesAtivas_(cfgSheet)`.

### 14.6 Disponibilidade insuficiente

- `serviceMin` (tempo necessario) > tempo disponivel no slot.
- Slot e descartado antes do calculo de delta.

### 14.7 Quarta-feira + EQUIPE 2 + tempo > 150min

- Regra confirmada no codigo: quarta-feira + EQUIPE 2 + servico > 150min = slot invalido.
- Impede agendamentos muito longos na quarta para EQUIPE 2.

### 14.8 Candidatos ocultos e reintroduzidos

- Durante `filtrarPorRegiaoOperacional_`, candidatos podem ser ocultos por dominação de regiao.
- Regra de reintrodução evita deixar a regiao totalmente vazia.

### 14.9 Normal vs especial/premium/hora marcada

- **normal**: `bestKm <= limiteKmBase`.
- **especial**: `bestKm <= limiteKmEspecial && MAX_EXTRA_DYNAMIC > 0`.
- **premium**: `bestKm <= limiteKmPremium && MAX_EXTRA_PREMIUM > 0`.
- **hora marcada**: `HORA_MARCADA_HORAS_A_MAIS > 0`, `bestKm <= limiteKmBase` e `slotAvailMin >= serviceMin + horas extras`.
- `limiteKmEspecial = limiteKmBase + 5` (km).
- `limiteKmPremium = limiteKmBase + 10` (km).
- Limites base vem de `MAX_WEEKDAY_METERS`, `MAX_SATURDAY_METERS`, `MAX_EXTRA_METERS`.

---

## 15. Campos ainda nao confirmados

| Campo/Formato | Status | O que falta |
|---------------|--------|-------------|
| `rank` | ⚠️ Parcial | Calculado como `rankCounter++` no payload final; nao e usado no ranking interno |
| `label` | ⚠️ Parcial | `_labelFromDisplayText(address)`; confiavel mas depende de parsing de string |
| Formato exato de `availStr` na planilha | ⚠️ Parcial | Parseável por `parseMinutes` (ex: `"04:00"`); formato bruto da planilha nao totalmente mapeado |
| `encomenda` logica exata | ⚠️ Parcial | `(tipoBerco==='NIDO'?diasAte>90:diasAte>60)` confirmada, mas pode haver excecoes |
| `daysLeftTxt` formato | ✅ Confirmado | `` `${diasAte} d` `` |
| `searchTime` valor real | ✅ Confirmado | Origem: `searchElapsedSeconds` (`((Date.now() - searchStartTime) / 1000).toFixed(1)`); tipo `string` |
| Trigger de tempo — intervalo | ✅ Confirmado | `_procurarDatasEnsureWorkerTrigger_` cria trigger `.after(1000)` para `ApiExecutarPesquisaDatasWorker` |

---

## 16. Como usar estas fixtures no futuro

1. **Testes de caracterizacao**: validar que motor v2 produz os mesmos candidatos para a mesma entrada.
2. **Tipos TypeScript**: criar interfaces `SlotLegado`, `CandidatoLegado`, `PontoAgendaLegado` com base nestes exemplos.
3. **Comparacao lado a lado**: executar motor legado e motor v2 com o mesmo payload e comparar saidas.
4. **Validacao de paridade**: antes de trocar producao, garantir que ambos os motores retornam conjuntos equivalentes de candidatos.

---

## 17. Proxima etapa recomendada

**Mapear payload de progresso com mais detalhe** — documentar o formato exato e completo de cada estado (`queued`, `running`, `done`, `error`) incluindo todos os campos opcionais e seus tipos, para servir de contrato na futura API de polling.

Sem implementar codigo. Apenas documentar.
