# Pré-agendamento — `/procurar-datas`

> Criado em: junho/2026
> Baseado em: `PublicAPI.gs`, `CEP-APIBACK.gs`
> Todas as informações são sintéticas ou anonimizadas.

---

## 1. Objetivo

Este documento registra o **contrato de comportamento do pré-agendamento** após a escolha de um candidato de data pelo usuário.

Ele descreve:

- quais funções criam o evento no Google Calendar;
- quais campos são enviados (`cand`, `meta`);
- como o título e a descrição do evento são construídos;
- quais respostas de sucesso e erro são retornadas.

---

## 2. Escopo

- **Apenas documentação**.
- **Não altera código**.
- **Não altera produção**.
- **Não cria testes**.
- **Não cria tipos TypeScript**.
- **Não faz parte do motor de busca de datas**.
- Descreve apenas o passo posterior à escolha da data.

---

## 3. Onde o pré-agendamento entra no fluxo

```
1. Motor de busca retorna candidatos
2. Frontend/modal exibe opções
3. Usuário escolhe uma data
4. App envia cand + meta
5. Apps Script cria evento no Google Calendar
6. Retorna sucesso ou erro
```

> **Google Calendar não participa do motor de busca de datas.**
>
> Ele é usado **apenas** para criar o pré-agendamento após a escolha de uma data.

---

## 4. Funções envolvidas

### 4.1 `ApiPreAgendarDireto(cand, meta)`

| Atributo | Valor |
|----------|-------|
| **Arquivo** | `appscript/PublicAPI.gs` |
| **Responsabilidade** | Ponto de entrada da API/app. Valida entradas, cria evento no Calendar, retorna objeto serializável. |
| **Entrada** | `cand` (objeto candidato), `meta` (objeto de metadados) |
| **Saída** | `{ ok: true, titulo, eventLink }` ou `{ ok: false, error }` |
| **Faz I/O?** | ✅ Sim — lê `PRE_CALENDAR_ID`, cria evento via `CalendarApp`, grava auditoria |
| **Dependências externas** | `CalendarApp`, `PRE_CALENDAR_ID`, `Session.getActiveUser()`, `normalizeBairro_`, `logAuditRow` |

### 4.2 `DoPreAgendarDireto(cand, meta)`

| Atributo | Valor |
|----------|-------|
| **Arquivo** | `appscript/PublicAPI.gs` |
| **Responsabilidade** | Wrapper exposto ao frontend/modal via `google.script.run`. Delega para `preAgendarDireto`. |
| **Entrada** | `cand`, `meta` |
| **Saída** | Retorno de `preAgendarDireto` (void + alerta UI no modal legado) |
| **Faz I/O?** | ✅ Indiretamente, via `preAgendarDireto` |
| **Dependências externas** | `preAgendarDireto` |

### 4.3 `preAgendarDireto(cand, meta)`

| Atributo | Valor |
|----------|-------|
| **Arquivo** | `appscript/CEP-APIBACK.gs` |
| **Responsabilidade** | Implementação principal do pré-agendamento. Cria evento no Calendar e exibe alerta no modal legado. |
| **Entrada** | `cand`, `meta` |
| **Saída** | `undefined` (void). Exibe `SpreadsheetApp.getUi().alert()` no modal legado. |
| **Faz I/O?** | ✅ Sim — cria evento no Calendar, grava auditoria, mostra alerta |
| **Dependências externas** | `CalendarApp`, `PRE_CALENDAR_ID`, `Session.getActiveUser()`, `normalizeBairro_`, `logAuditRow` |

### 4.4 `generateAgendaModalHtmlFromRows_(payload)`

| Atributo | Valor |
|----------|-------|
| **Arquivo** | `appscript/CEP-APIBACK.gs` |
| **Responsabilidade** | Gera o HTML do modal de pré-agendamento. Não faz I/O diretamente. |
| **Entrada** | `payload` com `candidates`, `address`, `tempo`, etc. |
| **Saída** | String HTML (modal) |
| **Faz I/O?** | ❌ Não. Apenas monta HTML. |
| **Observação** | O JavaScript embutido no HTML monta o objeto `cand` e `meta` e chama `DoPreAgendarDireto(cand, meta)` via `google.script.run`. |

---

## 5. Payload `cand`

Objeto enviado representando o candidato escolhido.

### 5.1 Exemplo sintético

```json
{
  "dateISO": "2026-06-20T00:00:00.000Z",
  "team": "EQUIPE 1",
  "frete": "R$ 280",
  "tipo": "hora-marcada"
}
```

### 5.2 Tabela de campos

| Campo | Tipo | Exemplo | Origem | Obrigatório | Status |
|-------|------|---------|--------|-------------|--------|
| `dateISO` | `string` (ISO 8601) | `"2026-06-20T00:00:00.000Z"` | `c.dateISO` do candidato final | ✅ Sim | ✅ Confirmado |
| `team` | `string` | `"EQUIPE 1"` | `c.team` do candidato final | ✅ Sim | ✅ Confirmado |
| `frete` | `string` | `"R$ 280"` | `c.frete` do candidato final | ✅ Sim | ✅ Confirmado |
| `tipo` | `string` | `"hora-marcada"` | `c.tipo` do candidato final | ✅ Sim | ✅ Confirmado |
| `isExtra` | `boolean` | `true` | `c.isExtra` do candidato final | ❌ Pode ser inferido de `tipo` | ⚠️ Parcial |

> **Nota:** `ApiPreAgendarDireto` valida `cand.dateISO` e `cand.team` obrigatórios. `preAgendarDireto` usa `cand.dateISO` para criar a data do evento.

---

## 6. Payload `meta`

Objeto enviado com metadados da pesquisa original.

### 6.1 Exemplo sintético

```json
{
  "tempo": "02:30",
  "label": "Bairro Modelo",
  "address": "Rua Exemplo, 123, Bairro Modelo, Curitiba - PR",
  "cep": "80000-000",
  "params": "TEMPO NECESSÁRIO: 02:30"
}
```

### 6.2 Tabela de campos

| Campo | Tipo | Exemplo | Origem | Obrigatório | Status |
|-------|------|---------|--------|-------------|--------|
| `tempo` | `string` | `"02:30"` | `payload.tempo` | ✅ Sim | ✅ Confirmado |
| `label` | `string` | `"Bairro Modelo"` | `payload.label` | ❌ Usado como fallback para endereço | ✅ Confirmado |
| `address` | `string` | `"Rua Exemplo, 123..."` | `payload.address` | ❌ Pode ser derivado de `label` | ✅ Confirmado |
| `cep` | `string` | `"80000-000"` | `payload.cep` | ❌ Opcional | ✅ Confirmado |
| `params` | `string` | `"TEMPO NECESSÁRIO: 02:30"` | `payload.params` | ❌ Opcional | ✅ Confirmado |

> **Nota:** No modal legado (`generateAgendaModalHtmlFromRows_`), o `meta` é montado a partir do `payload` original da pesquisa:
> ```js
> const meta = { tempo: PAY.tempo, label: PAY.label, address: PAY.address, cep: PAY.cep, params: PAY.params };
> ```

---

## 7. Exemplo de chamada completa

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

---

## 8. Construção do título do evento

### 8.1 Algoritmo confirmado

```
1. Obtém email do usuário ativo
2. Extrai prefixo antes de @lebebe.com.br → solicitante
3. Normaliza bairro a partir de meta.address || meta.label
4. Monta título base:
   "({tempo}) {BAIRRO} ({EQUIPE} - {SOLICITANTE})"
5. Converte para MAIÚSCULAS
6. Adiciona sufixo conforme tipo de frete:
   - especial      → " (FRETE: ESPECIAL)"
   - premium       → " (FRETE: PREMIUM)"
   - hora-marcada  → " (FRETE: HORA MARCADA)"
```

### 8.2 Exemplo sintético

```text
(02:30) BAIRRO MODELO (EQUIPE 1 - USUARIO) (FRETE: HORA MARCADA)
```

### 8.3 Normalização do bairro

Função `normalizeBairro_(endereco)`:

- Remove prefixos de CEP/numéricos no início;
- Separa por vírgula;
- Descarta: CEP, país, número solto, UF, estado por extenso, regiões administrativas;
- Descarta nomes de ruas (rua, avenida, travessa, etc.);
- Para Curitiba: retorna o bairro;
- Para outras cidades: retorna a cidade;
- Fallback: `"SEM BAIRRO"`.

---

## 9. Construção da descrição do evento

### 9.1 Campos incluídos

| Campo | Origem | Status |
|-------|--------|--------|
| `params` | `meta.params` | ✅ Confirmado |
| Equipe | `cand.team` (uppercase) | ✅ Confirmado |
| Frete | `cand.frete` | ✅ Confirmado |
| Endereço | `meta.address` ou `meta.cep` | ✅ Confirmado |

### 9.2 Exemplo sintético

```text
TEMPO NECESSÁRIO: 02:30
EQUIPE: EQUIPE 1
FRETE: R$ 280
ENDEREÇO: Rua Exemplo, 123, Bairro Modelo, Curitiba - PR
```

---

## 10. Google Calendar

### 10.1 Comportamento confirmado

- Usa `PRE_CALENDAR_ID` (constante global definida em `CEP-CONFIG.gs`);
- Obtém calendário via `CalendarApp.getCalendarById(PRE_CALENDAR_ID)`;
- Cria evento de dia inteiro com `createAllDayEvent(titulo, d, { description })`;
- Gera link editável do evento via `Utilities.base64EncodeWebSafe`;
- Retorna `eventLink` no fluxo API.

### 10.2 Regras de validação

| Validação | Erro lançado | Onde |
|-----------|--------------|------|
| `PRE_CALENDAR_ID` ausente | `"PRE_CALENDAR_ID não definido..."` | `ApiPreAgendarDireto` / `preAgendarDireto` |
| `cand.dateISO` ausente | `"Data do candidato ausente."` | `ApiPreAgendarDireto` |
| `cand.team` ausente | `"Equipe do candidato ausente."` | `ApiPreAgendarDireto` |
| Calendário não encontrado | `"Calendário não encontrado..."` | `ApiPreAgendarDireto` / `preAgendarDireto` |

> **Google Calendar não é fonte da agenda/disponibilidade.**
>
> Ele é usado **apenas** para criar o pré-agendamento após a escolha de uma data.

---

## 11. Resposta de sucesso

### 11.1 Fluxo app/API (`ApiPreAgendarDireto`)

```json
{
  "ok": true,
  "titulo": "(02:30) BAIRRO MODELO (EQUIPE 1 - USUARIO) (FRETE: HORA MARCADA)",
  "eventLink": "https://calendar.google.com/calendar/u/0/r/eventedit/..."
}
```

### 11.2 Fluxo modal legado (`preAgendarDireto`)

- Não retorna objeto serializável;
- Exibe `SpreadsheetApp.getUi().alert("Pré-agendado: {titulo}")`;
- O JavaScript do modal fecha a janela após sucesso (`google.script.host.close()`).

---

## 12. Resposta de erro

### 12.1 Fluxo app/API (`ApiPreAgendarDireto`)

```json
{
  "ok": false,
  "error": "PRE_CALENDAR_ID não definido no backend."
}
```

```json
{
  "ok": false,
  "error": "Data do candidato ausente."
}
```

```json
{
  "ok": false,
  "error": "Calendário não encontrado. Verifique PRE_CALENDAR_ID."
}
```

```json
{
  "ok": false,
  "error": "Erro desconhecido"
}
```

### 12.2 Fluxo modal legado (`preAgendarDireto`)

- Lança exceção (não capturada internamente);
- O JavaScript do modal exibe `alert()` com a mensagem de erro via `withFailureHandler`.

---

## 13. Auditoria/log

### 13.1 `logAuditRow`

Tanto `ApiPreAgendarDireto` quanto `preAgendarDireto` chamam `logAuditRow` após criar o evento.

Registram em alto nível:

- usuário (email do solicitante);
- CEP;
- parâmetros da pesquisa;
- tempo necessário;
- data formatada (`dd/MM`);
- link do evento no Calendar;
- título do evento.

> Exemplo anonimizado: registro de que o usuário `usuario@dominio.com` pré-agendou uma entrega para `20/06` no calendário `PRE_CALENDAR_ID`.

---

## 14. Diferenças entre fluxos

### 14.1 Fluxo app/API

- **Função de entrada:** `ApiPreAgendarDireto(cand, meta)`
- **Resposta:** objeto JSON `{ ok, titulo?, eventLink?, error? }`
- **Usado por:** frontend moderno, Next.js APIs
- **Comportamento:** retorna serializável, sem alerta UI

### 14.2 Fluxo modal legado (Apps Script puro)

- **Função de entrada:** `DoPreAgendarDireto(cand, meta)` → `preAgendarDireto(cand, meta)`
- **Resposta:** void + `SpreadsheetApp.getUi().alert(...)`
- **Usado por:** modal HTML gerado por `generateAgendaModalHtmlFromRows_`
- **Comportamento:** exibe alerta nativo do Google Sheets, fecha modal

> **Não misturar os dois.** Eles compartilham a mesma lógica de criação do evento, mas diferem na forma de retorno e interação com o usuário.

---

## 15. Dados sensíveis

Todos os exemplos deste documento são **sintéticos/anonimizados**:

- Nenhum endereço real;
- Nenhum email real;
- Nenhum nome real de cliente;
- Nenhum ID real de evento;
- Nenhum link real de calendário;
- `PRE_CALENDAR_ID` não exposto.

---

## 16. Pontos ainda não confirmados

| Ponto | Status | O que falta |
|-------|--------|-------------|
| `isExtra` no `cand` | ⚠️ Parcial | Enviado no modal legado (`generateAgendaModalHtmlFromRows_`), mas não usado na criação do evento |
| `logAuditRow` formato exato | ❓ Não confirmado | Assinatura e colunas exatas não mapeadas |
| Campos opcionais de `meta` | ⚠️ Parcial | `label` vs `address` como fonte do endereço — ambos são tratados como fallback um do outro |
| `eventLink` validação | ⚠️ Parcial | Link gerado por `base64EncodeWebSafe` + concatenação; funciona na prática mas não documentado oficialmente pelo Google |

---

## 17. Próxima etapa recomendada

**Documentar Execution API / n8n separadamente** — criar `docs/procurar-datas-execution-api.md` mapeando:

- entrada (`apiProcurarDatasPorEndereco`);
- validações de endereço estruturado vs completo;
- normalização de booleanos;
- validação de `dataInicial` (D+2 a D+90);
- payload normalizado;
- flags de limitação (`limitResultsNormal`, `excludeEspecial`, etc.);
- resposta serializável com metadados (`executionId`, `executionTime`).

Sem implementar código. Apenas documentar.
