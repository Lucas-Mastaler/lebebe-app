# Plano: Métricas Digisac no Dashboard

## 1. Objetivo

Criar uma primeira versão de métricas de atendimento/Digisac na tela de dashboard do Le Bébé App, consultando o endpoint `/dashboard/by-period` do Digisac em tempo real, sem persistir no Supabase. A Taxa de vácuo ativo fica como etapa futura.

---

## 2. Escopo da primeira versão

- **Cards de métricas:**
  - Mensagens enviadas (`sentMessagesCount`)
  - Mensagens recebidas (`receivedMessagesCount`)
  - Relação envio x recebimento (fórmula própria)
  - Tempo médio de chamado (`ticketTime`)
  - Média do 1º tempo de espera (`waitingTime`)
  - Média do 1º tempo de espera após bot (`waitingTimeAfterBot`)
  - Tempo médio de espera (`waitingTimeAvg`)
- **Gráfico:** mensagens enviadas x recebidas por dia (usando `items[]`)
- **Filtro por conexão/número:** se o endpoint `/services` for validado
- **Tooltips** informativos em todos os cards novos
- **Cache curto** em memória (recomendação inicial, ver seção 12)

---

## 3. Fora de escopo da primeira versão

- **Taxa de vácuo ativo** — etapa futura (seção 14)
- Persistência no Supabase
- Alteração do dashboard existente (tabelas, tabs, gráficos atuais)
- Alteração de layout, cores, ou fluxo visual da tela atual
- Alteração de código funcional do app nesta etapa de auditoria

---

## 4. Métricas oficiais do Digisac usadas

| Métrica | Campo no Digisac | Descrição oficial |
|---|---|---|
| Mensagens enviadas | `totals.sentMessagesCount` | Quantidade total de mensagens enviadas pela plataforma conforme filtros |
| Mensagens recebidas | `totals.receivedMessagesCount` | Quantidade total de mensagens recebidas conforme filtros |
| Tempo médio de chamado | `totals.ticketTime` | Média do tempo de duração, desde a abertura até o fechamento de cada chamado |
| Média do 1º tempo de espera | `totals.waitingTime` | Período entre a primeira mensagem do cliente até a primeira resposta do atendente, sem contar respostas automáticas de bot |
| Média do 1º tempo de espera após bot | `totals.waitingTimeAfterBot` | Período entre a finalização do atendimento feito pelo bot e a primeira mensagem enviada pelo atendente |
| Tempo médio de espera | `totals.waitingTimeAvg` | Média do tempo médio do chamado, oriundo das transferências do mesmo |
| Gráfico diário | `items[]` | `items[].name`, `items[].sentMessagesCount`, `items[].receivedMessagesCount`, `items[].totalMessagesCount` |

---

## 5. Fórmulas próprias

### Relação envio x recebimento

**Fórmula:** `sentMessagesCount / receivedMessagesCount`

**Exibição:** decimal com 2 casas. Exemplo: `622 / 608 = 1,02`.

> **Confirmado como decisão de negócio:** NÃO exibir como percentual. Não exibir `102%`. Exibir como decimal: `1,02`, `1,75`, `1,88`.

**Divisão por zero:** se `receivedMessagesCount` for zero, não dividir. Exibir estado seguro como `—`.

---

## 6. Regra da Relação envio x recebimento

**Regra de cor (sobre o valor arredondado exibido com 2 casas):**

| Valor exibido | Cor |
|---|---|
| até `1,50` | verde |
| de `1,51` até `1,74` | laranja |
| `1,75` ou mais | vermelho |

> A cor deve considerar o valor arredondado exibido com 2 casas, para evitar divergência entre o número mostrado e a cor aplicada.

---

## 7. Regra futura da Taxa de vácuo ativo

> **Taxa de vácuo ativo** = percentual de chamados iniciados de forma ativa pela loja em que o cliente não respondeu dentro de 24 horas após a abertura do chamado.

**Regras:**

- Só comparar contra chamados de início ativo.
- Chamados receptivos não entram no denominador.
- Chamados com menos de 24 horas desde a abertura ainda não são elegíveis e não devem entrar no denominador.
- Se o mesmo cliente/número tiver 2 chamados ativos em um período de 24h e não responder, contam como 2 vácuos.
- A unidade da métrica é chamado ativo, não cliente único.

**Denominador correto:** chamados ativos elegíveis (com 24h+ desde abertura).

**Numerador correto:** chamados ativos elegíveis sem resposta do cliente dentro de 24h.

> **Confirmado como decisão de negócio:** A Taxa de vácuo ativo NÃO será implementada na primeira versão. Fica como etapa futura.

---

## 8. Endpoints Digisac observados

### Endpoint de estatísticas agregadas

```
GET /api/v1/dashboard/by-period?startPeriod=2026-06-24T03:00:00.000Z&endPeriod=2026-07-02T02:59:59.999Z&grouping=&departmentId=all&departmentParticipation=last&userId=all&periodType=openDate&userParticipation=last&status=all&userStatus=all&serviceId=ece0fdac-962e-491c-b47f-fa912b17a878&withTotals=true
```

**Payload observado:**

```json
{
  "totals": {
    "sentMessagesCount": 622,
    "receivedMessagesCount": 608,
    "totalMessagesCount": 1230,
    "openedTicketsCount": 4,
    "closedTicketsCount": 136,
    "totalTicketsCount": 140,
    "waitingTime": 8166,
    "waitingTimeAfterBot": 5922,
    "waitingTimeAvg": 8486,
    "ticketTime": 34254,
    "contactsCount": 79
  },
  "items": [
    {
      "name": "24/06/2026",
      "sentMessagesCount": 64,
      "receivedMessagesCount": 43,
      "totalMessagesCount": 107,
      "openedTicketsCount": 0,
      "closedTicketsCount": 17,
      "totalTicketsCount": 17,
      "waitingTime": 4695,
      "waitingTimeAfterBot": 4105,
      "ticketTime": 17299,
      "waitingTimeAvg": 3210,
      "contactsCount": 16
    }
  ]
}
```

> **Confirmado no código:** O projeto não tem nenhuma chamada para `/dashboard/by-period` atualmente. O payload acima foi fornecido como referência observada externamente.

### Endpoint de serviços/conexões

```
GET /api/v1/services?query=...
```

> **Hipótese:** endpoint observado para listar serviços/conexões. **Não confirmado no código** — não existe chamada para `/services` no projeto. Formato do retorno desconhecido. Marcar como pendência explícita (seção 15).

---

## 9. Arquivos reais auditados

### Tela de dashboard

| Arquivo | Papel |
|---|---|
| `src/app/dashboard/page.tsx` | Server Component, protege com `checkModuleAndWindowAccess('dashboard')`, renderiza `PageClient` |
| `src/app/dashboard/PageClient.tsx` | Client Component com tabs Filiais/Consultoras, tabelas, 3 gráficos recharts, Top 50 clientes, legendas |
| `src/components/dashboard/FiltrosDashboard.tsx` | Filtros: dataInicio, dataFim, departmentIds (multi-select hardcoded), userIds (multi-select de `/api/users`) |

### API interna atual

| Arquivo | Papel |
|---|---|
| `src/app/api/dashboard/pesquisar/route.ts` | POST, auth via `requireAuthenticatedUser({ requireAllowedUser: true, requireActive: true })`, chama `pesquisarDashboard()` |

### Integração Digisac

| Arquivo | Papel |
|---|---|
| `src/lib/digisac/clienteDigisac.ts` | `fetchDigisac()` e `fetchDigisacRaw()`: env vars `DIGISAC_BASE_URL` (já inclui `/api/v1`) + `DIGISAC_TOKEN` (Bearer), 30s timeout, tratamento 401/403/429 |
| `src/lib/digisac/dashboard.ts` | `pesquisarDashboard()`: busca tickets via `/tickets` (paginação 200/página), agrupa por filial/consultora, cache em memória TTL 6h |
| `src/lib/digisac/utilsDatas.ts` | `montarRangeUtcSaoPaulo()`: converte dd/mm/aaaa para range UTC ISO (timezone SP -03:00) |
| `src/lib/digisac/departamentosFixos.ts` | 8 departamentos hardcoded |
| `src/lib/digisac/sgi-sync.ts` | Tipos `DigisacTicket` com `startedAt`, `endedAt`, `metrics.ticketTime`, `metrics.messagingTime`, `firstMessage.isFromMe`, `contact.service.id`; funções `buscarTicketsPorTelefoneComVariacoes()`, `calcularInicioChamado()`, `buscarMensagensTicketPaginado()` |
| `src/lib/digisac/triagem.ts` | Usa env var `DIGISAC_SERVICE_ID_VENDAS`; registra `digisac_service_id` no Supabase |
| `src/lib/digisac/limiteConcorrencia.ts` | Helper de limite de concorrência |
| `src/lib/digisac/chamadosFinalizados.ts` | Busca tickets finalizados, schedules por contato, cache 10min |
| `src/lib/digisac/agendamentos.ts` | Busca agendamentos formatados, cache 10min |

### Auth e infra

| Arquivo | Papel |
|---|---|
| `src/lib/auth/api-auth.ts` | `requireAuthenticatedUser()` — helper central de auth para API Routes |
| `src/lib/auth/module-access.ts` | `checkModuleAndWindowAccess()` — protege Server Components |
| `src/lib/ratelimit.ts` | Rate limit via Upstash Redis (60 req/min) |
| `src/lib/fetch-with-retry.ts` | Retry helper genérico (exponential backoff) |

### Tipos

| Arquivo | Papel |
|---|---|
| `src/types/index.ts` | `DashboardResponse`, `DashboardLinha`, `DashboardLinhaConsultora`, `DashboardClienteDetalhe` |

### Docs

| Arquivo | Papel |
|---|---|
| `digisac_docs.md` | Lista de departamentos e IDs |
| `docs/ia/log_progress.md` | Continuidade entre agentes |

---

## 10. APIs internas propostas

### Nova rota: `src/app/api/dashboard/estatisticas/route.ts`

- **Método:** POST
- **Auth:** `requireAuthenticatedUser({ requireAllowedUser: true, requireActive: true })`
- **Body recebido:** `{ dataInicio: string, dataFim: string, serviceId?: string }`
- **Retorno:** `{ totals: {...}, items: [...] }` (repasse do Digisac)
- **Cache:** recomendação inicial de cache em memória de 5 a 10 minutos por combinação de filtros (ver seção 12)

### Nova rota (opcional): `src/app/api/dashboard/servicos/route.ts`

- **Método:** GET
- **Auth:** `requireAuthenticatedUser({ requireAllowedUser: true, requireActive: true })`
- **Retorno:** lista de serviços/conexões do Digisac
- **Dependência:** validar formato do endpoint `/services` do Digisac antes de implementar

---

## 11. Componentes/tela envolvidos

### Componentes existentes (não alterar)

- `src/app/dashboard/page.tsx` — mantido como está
- `src/app/dashboard/PageClient.tsx` — receberá nova seção de cards + gráfico, sem alterar tabs/tabelas existentes
- `src/components/dashboard/FiltrosDashboard.tsx` — receberá novo filtro de conexão (se validado)

### Componentes novos propostos

- `src/components/dashboard/CardsEstatisticas.tsx` — 7 cards com tooltips
- `src/components/dashboard/GraficoMensagensDia.tsx` — gráfico de enviadas x recebidas por dia
- `src/lib/digisac/estatisticas.ts` — helper para `/dashboard/by-period` e `/services`

### Onde encaixar

- Seção de cards + gráfico acima ou abaixo da área de tabs existente
- Manter tabs Filiais/Consultoras intactas
- Não alterar layout, cores, ou fluxo visual atual

---

## 12. Riscos conhecidos

### Performance

- **Risco:** chamar Digisac direto toda vez que o dashboard carregar pode ser lento.
- **Recomendação inicial:** cache em memória de 5 a 10 minutos por combinação de filtros (período + conexão).
- **Não definir implementação final de cache sem validar o padrão mais seguro no código.** O projeto já usa cache em memória em `dashboard.ts` (TTL 6h) e `agendamentos.ts` (TTL 10min), mas é necessário confirmar qual padrão é mais adequado para este caso.

### Endpoint `/services`

- **Risco:** formato do retorno desconhecido. Não tratar o filtro de conexão como 100% garantido até validar o retorno real do endpoint.
- **Pendência explícita:** confirmar formato do `/services` antes de implementar o filtro de conexão.

### Endpoint `/dashboard/by-period`

- **Hipótese:** o endpoint aceita `serviceId` como parâmetro. Não confirmado no código.
- **Hipótese:** quando `serviceId` não é enviado, retorna dados de todos os serviços. Não confirmado.
- **Hipótese:** o campo `grouping` aceita valores além de vazio. Não confirmado.

### Vácuo ativo

- **Risco:** pode ser pesado se muitos tickets — sugerir cálculo incremental ou batch na etapa futura.

---

## 13. Plano de implementação por etapas

### Etapa 1: Helper Digisac para `/dashboard/by-period`

- Novo arquivo: `src/lib/digisac/estatisticas.ts`
- Função: `buscarEstatisticasDigisac({ startPeriod, endPeriod, serviceId? })`
- Reutiliza `fetchDigisac()` existente
- Endpoint: `/dashboard/by-period?startPeriod=...&endPeriod=...&serviceId=...&withTotals=true`
- Usar `montarRangeUtcSaoPaulo()` para converter datas

### Etapa 2: Helper para listar serviços/conexões

- Adição em `estatisticas.ts` ou arquivo separado
- Função: `listarServicosDigisac()`
- Endpoint: `/services`
- **Pendência:** validar formato do retorno antes de implementar

### Etapa 3: API interna protegida

- Nova rota: `src/app/api/dashboard/estatisticas/route.ts`
- POST, auth via `requireAuthenticatedUser({ requireAllowedUser: true, requireActive: true })`
- Recebe: `{ dataInicio, dataFim, serviceId? }`
- Retorna: `{ totals, items }` do Digisac
- Cache em memória curto (5-10 min) por hash de parâmetros — validar padrão antes

### Etapa 4: Filtro de conexão/número (se validado)

- Adicionar select de conexão em `FiltrosDashboard.tsx`
- Carregar opções de `/api/dashboard/servicos` (ou endpoint separado)
- **Só implementar se o endpoint `/services` for validado**

### Etapa 5: Cards de métricas

- Novo componente: `src/components/dashboard/CardsEstatisticas.tsx`
- 7 cards:
  1. Mensagens enviadas — tooltip: "Quantidade total de mensagens enviadas pela plataforma conforme o período e filtros selecionados."
  2. Mensagens recebidas — tooltip: "Quantidade total de mensagens recebidas conforme o período e filtros selecionados."
  3. Relação envio x recebimento — tooltip: "Índice calculado dividindo mensagens enviadas por mensagens recebidas. Valores mais altos indicam maior volume de mensagens enviadas em relação às recebidas."
  4. Tempo médio de chamado — tooltip: "Média do tempo de duração dos chamados, desde a abertura até o fechamento, conforme os filtros selecionados."
  5. Média do 1º tempo de espera — tooltip: "Tempo entre a primeira mensagem do cliente e a primeira resposta humana do atendente, sem contar respostas automáticas de bot."
  6. Média do 1º tempo de espera após bot — tooltip: "Tempo entre a finalização do atendimento pelo bot e a primeira mensagem humana enviada pelo atendente."
  7. Tempo médio de espera — tooltip: "Média do tempo de espera dos chamados considerando transferências, conforme os filtros selecionados."
- Relação envio x recebimento: exibição decimal com 2 casas, regra de cor conforme seção 6

### Etapa 6: Gráfico de mensagens enviadas x recebidas por dia

- Novo componente: `src/components/dashboard/GraficoMensagensDia.tsx`
- Usa `items[]` do payload (name, sentMessagesCount, receivedMessagesCount)
- Recharts (já usado no projeto)

### Etapa 7: Integração na tela

- Adicionar seção de cards + gráfico em `PageClient.tsx`
- Manter tabs Filiais/Consultoras intactas
- Não alterar layout/fluxo existente

---

## 14. Etapa futura: Taxa de vácuo ativo

### Definição final

> **Taxa de vácuo ativo** = percentual de chamados iniciados de forma ativa pela loja em que o cliente não respondeu dentro de 24 horas após a abertura do chamado.

### Regras

- Só comparar contra chamados de início ativo.
- Chamados receptivos não entram no denominador.
- Chamados com menos de 24 horas desde a abertura ainda não são elegíveis e não devem entrar no denominador.
- Se o mesmo cliente/número tiver 2 chamados ativos em um período de 24h e não responder, contam como 2 vácuos.
- A unidade da métrica é chamado ativo, não cliente único.
- **Denominador correto:** chamados ativos elegíveis (com 24h+ desde abertura).
- **Numerador correto:** chamados ativos elegíveis sem resposta do cliente dentro de 24h.

### Tooltip sugerido

"Percentual de chamados iniciados ativamente pela loja em que o cliente não respondeu dentro de 24 horas após a abertura do chamado."

### Viabilidade auditada no código

- `sgi-sync.ts` já busca tickets com `firstMessage.isFromMe` (ativo/receptivo) e `startedAt`
- `buscarMensagensTicketPaginado()` permite verificar se cliente respondeu
- Endpoint `/tickets` traz `startedAt` e `firstMessage`
- `calcularInicioChamado()` em `sgi-sync.ts` já classifica ativo/receptivo/indefinido

### Pontos não confirmados

- Se a listagem de chamados traz tipo de início ativo/receptivo de forma agregada ou se precisa buscar `firstMessage` por ticket
- Se existe endpoint mais eficiente para filtrar chamados ativos em massa
- Se o endpoint `/dashboard/by-period` traz dados suficientes para calcular vácuo (provavelmente não — precisa de tickets individuais)

### Plano futuro

- Mapear endpoint de chamados ativos no período
- Verificar se listagem traz: tipo de início, horário de abertura, contato, conexão, departamento
- Se não trouxer mensagens, usar endpoint de mensagens por ticket
- Propor cálculo incremental (job/cron) se ficar pesado
- Não implementar nesta etapa

---

## 15. Pendências e perguntas abertas

1. **Endpoint `/services`:** formato do retorno desconhecido. Confirmar antes de implementar filtro de conexão.
2. **Endpoint `/dashboard/by-period` sem `serviceId`:** confirmar se retorna dados de todos os serviços.
3. **Campo `grouping`:** confirmar valores aceitos além de vazio.
4. **Cache:** validar padrão mais seguro no código antes de definir implementação final. Sugestão inicial: cache em memória de 5 a 10 minutos por combinação de filtros.
5. **Filtro de conexão:** não tratar como 100% garantido até validar endpoint `/services`.
6. **Vácuo ativo:** confirmar endpoint para listar chamados ativos em massa e se traz `firstMessage` ou se precisa buscar mensagens por ticket.

---

## 16. Próximo passo recomendado

1. Validar formato do endpoint `/services` do Digisac (chamada real ou documentação oficial).
2. Validar comportamento do `/dashboard/by-period` sem `serviceId`.
3. Definir padrão de cache a usar.
4. Implementar Etapa 1 (helper `estatisticas.ts`).
5. Implementar Etapa 3 (API interna protegida).
6. Implementar Etapa 5 e 6 (cards + gráfico).
7. Implementar Etapa 4 (filtro de conexão) se `/services` validado.
8. Integrar na tela (Etapa 7).
9. Taxa de vácuo ativo como etapa separada futura.
