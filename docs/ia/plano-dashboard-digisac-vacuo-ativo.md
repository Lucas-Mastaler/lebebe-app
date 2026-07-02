# Plano: Taxa de Vacuo Ativo no Dashboard

## 1. Definicao final da metrica

> **Taxa de vacuo ativo** = percentual de chamados iniciados de forma ativa pela loja em que o cliente nao respondeu dentro de 24 horas apos a abertura do chamado.

**Formula:**

```
taxaVacuoAtivo = (chamadosEmVacuo / chamadosAtivosElegiveis) * 100
```

---

## 2. Regra de negocio

- So chamados ativos (inicio pela loja) entram no denominador.
- Chamados receptivos nao entram no denominador.
- Chamados com menos de 24 horas desde a abertura ainda nao sao elegiveis e nao entram no denominador.
- Se o mesmo cliente/numero tiver 2 chamados ativos no periodo e nao responder, contam como 2 vacuos.
- A unidade da metrica e chamado, nao cliente unico.
- **Numerador:** chamados ativos elegiveis sem resposta do cliente dentro de 24h.
- **Denominador:** chamados ativos elegiveis (com 24h+ desde abertura).
- Divisao por zero: se denominador for 0, exibir estado seguro (ex: `—`).
- A metrica deve respeitar os filtros do dashboard: periodo, departamento/filial, consultora/usuario, conexao/numero (`serviceId`).

---

## 3. Arquivos auditados

| Arquivo | Papel no contexto do vacuo ativo |
|---|---|
| `src/lib/digisac/dashboard.ts` | Busca tickets via `/tickets` com paginacao, include de `contact`, `department`, `user`, `firstMessage`. Ja aplica `serviceId` no `contact.where`. Interface `Ticket` tem `createdAt` mas NAO tem `startedAt`. |
| `src/lib/digisac/sgi-sync.ts` | Tipos `DigisacTicket` com `startedAt`, `endedAt`, `firstMessage.isFromMe`, `contact.service.id`. Funcao `buscarMensagensTicketPaginado()` busca mensagens via `/messages?where[ticketId]=...`. Funcao `calcularInicioChamado()` classifica ativo/receptivo/indefinido. |
| `src/lib/digisac/chamadosFinalizados.ts` | Busca tickets finalizados via `/tickets` com `where[isOpen]=false` e `where[endedAt][$between]`. Nao busca mensagens. |
| `src/lib/digisac/clienteDigisac.ts` | `fetchDigisac()` e `fetchDigisacRaw()` com env vars, 30s timeout, tratamento 401/403/429. |
| `src/lib/digisac/estatisticas.ts` | Helper `buscarEstatisticasDigisac()` para `/dashboard/by-period`. Helper `listarServicosDigisac()` para `/services`. |
| `src/app/api/dashboard/pesquisar/route.ts` | API POST protegida, chama `pesquisarDashboard()`. Ja aceita `serviceId`. |
| `src/app/api/dashboard/estatisticas/route.ts` | API POST protegida, chama `buscarEstatisticasDigisac()`. Ja aceita `serviceId`. |
| `src/app/dashboard/PageClient.tsx` | Client component do dashboard. Ja envia `serviceId` para ambas as APIs. |
| `src/components/dashboard/FiltrosDashboard.tsx` | Filtros com seletor de conexao/numero. Ja envia `serviceId` no `onPesquisar`. |
| `src/types/index.ts` | Tipos do dashboard. |
| `docs/ia/plano-dashboard-digisac-metricas.md` | Plano original das metricas Digisac. |

---

## 4. O que foi confirmado no codigo

### 4.1. Como identificar chamado ativo

**Confirmado:** O projeto usa `firstMessage.isFromMe === true` para classificar chamado como ativo.

- `dashboard.ts` linha 344: `if (t.firstMessage.isFromMe === true) totalChamadosAtivosNoPeriodo++;`
- `sgi-sync.ts` linha 343: `inicio: fm.isFromMe ? 'ativo' : 'receptivo'`
- `sgi-sync.ts` funcao `calcularInicioChamado()` (linha 329): usa `firstMessage.isFromMe` como regra primaria, com fallback para busca de mensagens se `firstMessage` for incompleto.

**Conclusao:** A regra `firstMessage.isFromMe === true` e o padrao consolidado. Usar a mesma regra para vacuo ativo.

### 4.2. Como buscar tickets no periodo com filtros

**Confirmado:** `dashboard.ts` funcao `buscarTicketsPeriodo()` (linha 133) ja monta query de `/tickets` com:
- `where[createdAt][$between][0]` e `where[createdAt][$between][1]` para intervalo de datas
- `include[0][model]=contact` com `include[0][required]=true` e `include[0][where][visible]=true`
- `include[0][where][serviceId]` quando `serviceId` presente
- `include[1][model]=department`
- `include[2][model]=user`
- `include[3][model]=firstMessage`
- Filtros de `departmentId` e `userId` quando 1 selecionado
- Paginacao 200/pagina

**Limitacao confirmada:** A interface `Ticket` em `dashboard.ts` usa `createdAt` mas NAO tem `startedAt`. O tipo `DigisacTicket` em `sgi-sync.ts` tem `startedAt`. Para vacuo ativo, precisamos de `startedAt` (data de abertura do chamado), nao `createdAt`.

### 4.3. Como saber se o cliente respondeu dentro de 24h

**Confirmado:** A listagem de `/tickets` traz `firstMessage` (include), mas NAO traz mensagens individuais ou contadores de mensagens recebidas.

**Confirmado:** `sgi-sync.ts` funcao `buscarMensagensTicketPaginado()` (linha 284) busca mensagens de um ticket via:
```
GET /messages?where[ticketId]={ticketId}&perPage=100&page={page}
```

**Confirmado:** As mensagens retornadas tem campos:
- `id: string`
- `ticketId?: string`
- `type?: string` (filtrar por `type === 'chat'`)
- `isFromMe?: boolean` (true = enviado pela loja, false = recebido do cliente)
- `visible?: boolean` (filtrar por `visible !== false`)
- `isComment?: boolean` (filtrar por `isComment !== true`)
- `timestamp?: number`

**Conclusao:** Para verificar se o cliente respondeu dentro de 24h, e necessario:
1. Buscar mensagens do ticket via `buscarMensagensTicketPaginado()`
2. Filtrar mensagens uteis: `type === 'chat' && visible !== false && isComment !== true`
3. Encontrar a primeira mensagem com `isFromMe === false` (resposta do cliente)
4. Comparar `timestamp` dessa mensagem com `startedAt` do ticket
5. Se `timestamp <= startedAt + 24h`, o cliente respondeu dentro do prazo (nao e vacuo)
6. Se nao houver mensagem do cliente, ou a primeira resposta for apos 24h, e vacuo

### 4.4. Pipeline de calculo possivel

**Confirmado:** E possivel filtrar candidatos antes de buscar mensagens:

1. Buscar tickets do periodo (ja feito por `buscarTicketsPeriodo()`)
2. Filtrar so ativos: `firstMessage.isFromMe === true`
3. Filtrar so elegiveis: `startedAt + 24h <= agora` (data atual)
4. Aplicar filtros de departamento/usuario/conexao (ja aplicados na query)
5. So entao buscar mensagens dos candidatos via `buscarMensagensTicketPaginado()`

Isso reduz drasticamente o numero de chamadas a `/messages` em relacao a buscar mensagens de todos os tickets.

---

## 5. O que permanece hipotese

### 5.1. Disponibilidade de `startedAt` na listagem de `/tickets`

**Hipotese:** O endpoint `/tickets` retorna `startedAt` quando o ticket e criado, mas o campo pode ser opcional ou ausente em alguns tickets.

**Nao confirmado:** Se todos os tickets retornados por `buscarTicketsPeriodo()` terao `startedAt` populado. A interface `Ticket` em `dashboard.ts` nao inclui `startedAt`, mas `DigisacTicket` em `sgi-sync.ts` sim.

**Mitigacao:** Usar `startedAt ?? createdAt` como fallback para data de abertura.

### 5.2. Limite de paginacao em `/messages`

**Hipotese:** `buscarMensagensTicketPaginado()` tem limite de 50 paginas (5000 mensagens). Para vacuo ativo, so precisamos da primeira resposta do cliente, mas a funcao atual busca todas as mensagens.

**Nao confirmado:** Se existe um parametro de ordenacao em `/messages` que permita buscar apenas as primeiras mensagens (ASC por timestamp) e parar ao encontrar a primeira resposta do cliente.

**Mitigacao:** Modificar a busca para ordenar por timestamp ASC e parar na primeira mensagem `isFromMe === false`, em vez de buscar todas as paginas.

### 5.3. Comportamento de `firstMessage` em tickets antigos

**Hipotese:** Tickets muito antigos podem ter `firstMessage` nulo ou incompleto, exigindo fallback para busca de mensagens.

**Nao confirmado:** Proporcao de tickets sem `firstMessage` no periodo do dashboard.

---

## 6. Endpoints/funcoes envolvidas

### Endpoints Digisac

| Endpoint | Uso no vacuo ativo |
|---|---|
| `GET /tickets?where[createdAt][$between]=...&include=contact,department,user,firstMessage` | Buscar tickets do periodo com filtros |
| `GET /messages?where[ticketId]=...&perPage=100&page=1` | Buscar mensagens de cada ticket candidato |

### Funcoes existentes reutilizaveis

| Funcao | Arquivo | Reutilizacao |
|---|---|---|
| `fetchDigisac()` | `clienteDigisac.ts` | Todas as chamadas HTTP |
| `montarRangeUtcSaoPaulo()` | `utilsDatas.ts` | Converter datas dd/mm/aaaa para UTC |
| `buscarMensagensTicketPaginado()` | `sgi-sync.ts` | Buscar mensagens por ticket |
| `calcularInicioChamado()` | `sgi-sync.ts` | Classificar ativo/receptivo (referencia, mas podemos usar `firstMessage.isFromMe` direto) |
| `processarEmLotes()` | `dashboard.ts` | Processar tickets em paralelo com concorrencia controlada |
| `requireAuthenticatedUser()` | `auth/api-auth.ts` | Proteger API interna |

### Funcoes a criar

| Funcao | Arquivo proposto | Responsabilidade |
|---|---|---|
| `calcularVacuoAtivo()` | `src/lib/digisac/vacuoAtivo.ts` (novo) | Orquestrar calculo: buscar tickets, filtrar candidatos, buscar mensagens, calcular taxa |
| `buscarPrimeiraRespostaCliente()` | `src/lib/digisac/vacuoAtivo.ts` (novo) | Buscar primeira mensagem `isFromMe === false` de um ticket, parando na primeira encontrada |

---

## 7. Estrategia de calculo

### Pipeline detalhado

```
1. Receber filtros: { dataInicio, dataFim, departmentIds?, userIds?, serviceId? }

2. Buscar tickets do periodo
   - Reutilizar logica de buscarTicketsPeriodo() de dashboard.ts
   - Adaptar para incluir startedAt no tipo de retorno
   - Aplicar mesmos filtros: createdAt between, contact.where.serviceId, departmentId, userId
   - Incluir: contact, department, user, firstMessage

3. Filtrar candidatos a vacuo
   - Filtrar so ativos: firstMessage.isFromMe === true
   - Filtrar so elegiveis: (startedAt ?? createdAt) + 24h <= agora
   - Aplicar filtros locais multi-selecao (departmentIds > 1, userIds > 1) se necessario

4. Para cada candidato, buscar primeira resposta do cliente
   - Chamar /messages?where[ticketId]=...&perPage=100&page=1
   - Ordenar por timestamp ASC (se suportado)
   - Filtrar: type === 'chat' && visible !== false && isComment !== true
   - Encontrar primeira mensagem com isFromMe === false
   - Se encontrada e timestamp <= startedAt + 24h: NAO e vacuo
   - Se nao encontrada ou timestamp > startedAt + 24h: E vacuo
   - Otimizacao: parar na primeira mensagem isFromMe === false (nao buscar todas as paginas)

5. Calcular taxa
   - chamadosAtivosElegiveis = candidatos.length
   - chamadosEmVacuo = candidatos sem resposta em 24h
   - chamadosRespondidosEm24h = chamadosAtivosElegiveis - chamadosEmVacuo
   - taxaVacuoAtivo = chamadosAtivosElegiveis > 0 ? (chamadosEmVacuo / chamadosAtivosElegiveis) * 100 : null

6. Montar retorno com itens detalhados (sem dados sensíveis)
```

### Otimizacao de mensagens

Em vez de usar `buscarMensagensTicketPaginado()` que busca todas as mensagens, criar uma funcao otimizada que:
- Busca apenas a primeira pagina de mensagens (100 mensagens)
- Ordena por timestamp ASC
- Para ao encontrar a primeira mensagem `isFromMe === false`
- Se nao encontrar na primeira pagina, busca proxima pagina
- Limite de 3-5 paginas (300-500 mensagens) — se nao encontrar resposta do cliente nesse volume, considerar vacuo

Isso reduz o numero de chamadas a `/messages` de O(n * paginas_totais) para O(n * 1-3) na maioria dos casos.

---

## 8. Riscos de performance

### Cenario: periodo de 1 dia

- **Tickets esperados:** 10-50
- **Tickets ativos elegiveis:** 5-25
- **Chamadas a /messages:** 5-25
- **Tempo estimado:** 5-15 segundos
- **Viavel em tempo real:** Sim

### Cenario: periodo de 7 dias

- **Tickets esperados:** 50-200
- **Tickets ativos elegiveis:** 25-100
- **Chamadas a /messages:** 25-100
- **Tempo estimado:** 15-60 segundos
- **Viavel em tempo real:** Sim, com concorrencia de 12 (processarEmLotes)
- **Risco:** Pode ser lento se muitas mensagens por ticket

### Cenario: periodo de 30 dias

- **Tickets esperados:** 200-800
- **Tickets ativos elegiveis:** 100-400
- **Chamadas a /messages:** 100-400
- **Tempo estimado:** 60-300 segundos
- **Viavel em tempo real:** Arriscado. Pode estourar timeout de 30s por chamada ou rate limit do Digisac.
- **Recomendacao:** Implementar com limite de tickets (ex: max 200 candidatos) e aviso de dados parciais se exceder.

### Cenario: periodo de 6 meses

- **Tickets esperados:** 1000-5000+
- **Tickets ativos elegiveis:** 500-2500+
- **Chamadas a /messages:** 500-2500+
- **Tempo estimado:** 300+ segundos
- **Viavel em tempo real:** Nao
- **Recomendacao:** Processamento incremental via job/cron ou cache persistente. Nao implementar nesta etapa.

### Recomendacao para primeira versao

- Implementar em tempo real com limite seguro de **max 200 candidatos**
- Se exceder 200, calcular sobre os 200 mais recentes e exibir aviso "dados parciais"
- Cache em memoria de 5-10 minutos por combinacao de filtros
- Concorrencia de 12 chamadas simultaneas a `/messages` (reusar `processarEmLotes`)
- Para periodos longos (30+ dias), avaliar futuramente processamento incremental

---

## 9. Proposta de API futura

### Rota: `src/app/api/dashboard/vacuo-ativo/route.ts`

- **Metodo:** POST
- **Auth:** `requireAuthenticatedUser({ requireAllowedUser: true, requireActive: true })`
- **Body recebido:**

```json
{
  "dataInicio": "dd/mm/aaaa",
  "dataFim": "dd/mm/aaaa",
  "departmentIds": ["uuid"],
  "userIds": ["uuid"],
  "serviceId": "uuid-da-conexao"
}
```

- **Retorno:**

```json
{
  "taxaVacuoAtivo": 37.5,
  "chamadosAtivosTotal": 120,
  "chamadosAtivosElegiveis": 80,
  "chamadosEmVacuo": 30,
  "chamadosRespondidosEm24h": 50,
  "dadosParciais": false,
  "itens": [
    {
      "ticketId": "uuid",
      "protocol": "2026062570864",
      "cliente": "Nome do cliente",
      "connectionName": "VENDAS",
      "departmentName": "BIGORRILHO",
      "userName": "CONSULTORA",
      "startedAt": "2026-06-25T14:13:20.351Z",
      "limiteRespostaAt": "2026-06-26T14:13:20.351Z",
      "respondeuEm24h": false,
      "primeiraRespostaClienteAt": null
    }
  ]
}
```

**Seguranca:** Nao incluir `token`, `pushToken`, `user.data`, `service.token`, `contact.data.number` ou qualquer campo sensivel no retorno. `connectionName` e seguro (nome publico da conexao).

---

## 10. Proposta de UI futura

### Card no dashboard

- **Posicao:** Junto aos cards existentes de Estatisticas Digisac
- **Componente:** Adicionar card em `CardsEstatisticasDigisac.tsx` ou criar `CardVacuoAtivo.tsx`
- **Titulo:** "Taxa de vacuo ativo"
- **Valor:** Percentual com 1 casa decimal (ex: `37,5%`)
- **Cor:** 
  - Verde: ate 30%
  - Laranja: 31% a 50%
  - Vermelho: 51%+
  - (Cores sugeridas, sem meta rigida ate validar historico)
- **Estado seguro:** `—` quando denominador for 0
- **Tooltip:** "Percentual de chamados iniciados ativamente pela loja em que o cliente nao respondeu dentro de 24 horas apos a abertura do chamado."

### Detalhe auditavel (futuro)

- **Modal ou tabela expansivel:** Lista de tickets em vacuo com colunas: cliente, filial, consultora, conexao, data abertura, limite resposta, respondeu em 24h, primeira resposta
- **Nao expor:** telefone bruto, tokens, dados sensíveis
- **Filtro:** Ja respeita filtros do dashboard (periodo, filial, consultora, conexao)

---

## 11. Plano de implementacao por etapas

### Etapa 1: Helper de vacuo ativo

- **Novo arquivo:** `src/lib/digisac/vacuoAtivo.ts`
- **Funcoes:**
  - `buscarPrimeiraRespostaCliente(ticketId)` — busca otimizada da primeira mensagem `isFromMe === false`
  - `calcularVacuoAtivo(filtros)` — orquestra pipeline completo
- **Reutiliza:** `fetchDigisac()`, `montarRangeUtcSaoPaulo()`, `processarEmLotes()`
- **Limite:** max 200 candidatos, dadosParciais=true se exceder
- **Cache:** memoria de 5-10 min por hash de filtros

### Etapa 2: API interna protegida

- **Nova rota:** `src/app/api/dashboard/vacuo-ativo/route.ts`
- POST, auth via `requireAuthenticatedUser({ requireAllowedUser: true, requireActive: true })`
- Recebe: `{ dataInicio, dataFim, departmentIds?, userIds?, serviceId? }`
- Retorna: `{ taxaVacuoAtivo, chamadosAtivosTotal, chamadosAtivosElegiveis, chamadosEmVacuo, chamadosRespondidosEm24h, dadosParciais, itens }`

### Etapa 3: Card no dashboard

- Adicionar card em `CardsEstatisticasDigisac.tsx` ou criar novo componente
- Integrar em `PageClient.tsx` junto aos cards existentes
- Respeitar filtros do dashboard (serviceId, periodo, departamento, consultora)
- Estado de loading, erro e valor seguro (—)

### Etapa 4: Detalhe auditavel

- Modal ou tabela expansivel com lista de tickets em vacuo
- Sem dados sensíveis
- Filtros ja aplicados

### Etapa 5: Otimizacao/cache

- Se tempo real for lento para periodos > 7 dias:
  - Avaliar cache persistente (Supabase ou Redis)
  - Avaliar job/cron incremental
  - Avaliar pre-computacao diaria
- Nao implementar nesta etapa

---

## 12. Criterios de aceite futuros

1. So chamados ativos (`firstMessage.isFromMe === true`) entram no denominador.
2. Chamados receptivos ficam fora do denominador.
3. Chamados com menos de 24h desde abertura ficam fora do denominador.
4. Filtros do dashboard sao respeitados (periodo, departamento, consultora, conexao).
5. Mesma conexao selecionada afeta a metrica (`serviceId` na query de tickets).
6. Nao ha divisao por zero (exibir `—` se denominador for 0).
7. Dados de detalhe nao expõem campos sensíveis (token, pushToken, user.data, service.token, telefone bruto).
8. Limite de 200 candidatos com aviso de dados parciais se exceder.
9. Cache em memoria de 5-10 min para evitar chamadas repetidas.
10. Typecheck passa.
11. Lint dos arquivos alterados passa.
12. Taxa de vacuo ativo nao implementada nesta etapa de auditoria.

---

## 13. Pendencias

1. **`startedAt` vs `createdAt`:** Confirmar se endpoint `/tickets` retorna `startedAt` de forma confiavel para todos os tickets. Se nao, usar `createdAt` como fallback.
2. **Ordenacao de `/messages`:** Confirmar se endpoint `/messages` suporta ordenacao por timestamp ASC. Se sim, otimizar busca para parar na primeira resposta do cliente.
3. **Tickets sem `firstMessage`:** Confirmar proporcao de tickets sem `firstMessage` no periodo do dashboard. Se alta, pode ser necessario buscar mensagens para classificar ativo/receptivo.
4. **Rate limit do Digisac:** Confirmar limite de chamadas concorrentes a `/messages`. Concorrencia de 12 pode ser ajustada.
5. **Periodos longos:** Definir estrategia para periodos > 30 dias (job incremental, cache persistente, ou limite com aviso).
6. **Validacao com dados reais:** Testar calculo com dados reais do Digisac para validar acuracia da metrica.

---

## 14. Riscos conhecidos

- **Performance:** Periodos longos (30+ dias) podem estourar timeout ou rate limit. Mitigacao: limite de 200 candidatos + cache.
- **Tickets sem `firstMessage`:** Podem exigir busca de mensagens adicional para classificacao ativo/receptivo.
- **Mensagens paginadas:** Se um ticket tiver muitas mensagens da loja antes da primeira resposta do cliente, pode ser necessario buscar varias paginas de `/messages`.
- **Digisac rate limit:** Muitas chamadas concorrentes a `/messages` podem acionar rate limit (429). Mitigacao: concorrencia controlada + retry com backoff.
- **Dados parciais:** Se limite de 200 candidatos for atingido, metrica pode nao refletir o total real. Avisar na UI.

---

## 15. Implementacao realizada (2026-07-01)

### Status: implementado (primeira versao controlada)

### Validacao do endpoint `/messages` com `ticketId IN`

**Nao foi possivel testar diretamente** o endpoint `/messages` com `ticketId IN` neste ambiente. A implementacao foi feita de forma **defensiva**:

1. **Prioridade 1 - busca em lote:** Tenta `where[ticketId][$in][0]=...&where[ticketId][$in][1]=...&where[isFromMe]=false&where[visible]=true&where[type][$ne]=reaction&order[0][0]=timestamp&order[0][1]=ASC&perPage=500`
2. **Fallback individual:** Se a busca em lote falhar (erro 400 ou resposta invalida), busca individual por ticket com `where[ticketId]=...&where[isFromMe]=false&where[visible]=true&where[type][$ne]=reaction&order timestamp ASC&perPage=10`
3. **Complemento:** Se a busca em lote funcionar mas nao trouxer mensagens para todos os tickets, complementa com fallback individual apenas para os tickets faltantes

Logs indicam qual estrategia foi usada (`usouLote=true/false`).

### Arquivos criados

| Arquivo | Responsabilidade |
|---|---|
| `src/lib/digisac/vacuoAtivo.ts` | Helper principal: buscar tickets, filtrar ativos/elegiveis, buscar mensagens do cliente (lote + fallback), calcular taxa, cache 5min |
| `src/app/api/dashboard/vacuo-ativo/route.ts` | API interna POST protegida com `requireAuthenticatedUser` |
| `src/components/dashboard/CardVacuoAtivo.tsx` | Card com tooltip, estados de loading/erro/sem elegiveis/limite excedido/sucesso |

### Arquivos alterados

| Arquivo | Alteracao |
|---|---|
| `src/types/index.ts` | Adicionado tipo `VacuoAtivoResponse` |
| `src/app/dashboard/PageClient.tsx` | Adicionado import, estado, useEffect e renderizacao do card |
| `docs/ia/plano-dashboard-digisac-vacuo-ativo.md` | Esta secao |
| `docs/ia/log_progress.md` | Entrada de log |

### Estrategia implementada

1. Buscar tickets do periodo (reutilizando logica de `dashboard.ts` com `startedAt` adicional)
2. Filtrar so ativos: `firstMessage.isFromMe === true`
3. Filtrar so elegiveis: `(startedAt ?? createdAt) + 24h <= agora`
4. Se elegiveis > 200: retornar `limiteExcedido=true` sem calcular taxa
5. Se elegiveis = 0: retornar `calculado=false` com taxa null
6. Buscar mensagens do cliente (`isFromMe=false`) em lote primeiro, fallback individual se necessario
7. Para cada ticket, verificar se primeira resposta do cliente esta dentro de 24h apos abertura
8. Calcular taxa: `(chamadosEmVacuo / chamadosAtivosElegiveis) * 100`
9. Cache em memoria de 5 min por combinacao de filtros

### Limite de seguranca

- Max 200 chamados ativos elegiveis
- Se exceder, retorna `limiteExcedido=true` com mensagem "Periodo possui muitos chamados ativos elegiveis para calculo em tempo real. Reduza o periodo."
- Nao calcula taxa parcial
- Nao mostra taxa parcial no dashboard

### Fora do escopo desta implementacao

- Modal detalhado / tabela de chamados em vacuo
- Historico de 6 meses
- Supabase / persistencia
- Cron / job
- Resgate automatico
- IA / classificacao semantica
- Alerta automatico

### Validacoes executadas

- `npx tsc --noEmit --pretty false` -> exit 0 (sem erros)
- `npx eslint` nos 5 arquivos alterados -> exit 0 (sem erros)

### Pendencias pos-implementacao

1. Validar com dados reais do Digisac se busca em lote `ticketId IN` funciona
2. Validar se `startedAt` e retornado de forma confiavel
3. Validar tempo de resposta para periodo de 7 dias
4. Validar comportamento do card em diferentes cenarios (sem elegiveis, limite excedido, erro)
5. Avaliar futuramente modal/tabela de detalhe auditavel

---

## 16. Correcao: filtros de mensagens removidos da URL (2026-07-01)

### Problema confirmado

No teste real (periodo 05/05/2026, Bigorrilho, todas as conexoes):
- 23 tickets encontrados, 10 ativos, 10 elegiveis
- Busca em lote retornou mensagens para 0 tickets
- Fallback individual para 10 tickets tambem nao encontrou mensagens
- Resultado errado: 10 vacuos de 10 elegiveis (100% artificial)

### Causa raiz

Os filtros `where[isFromMe]=false`, `where[visible]=true` e `where[type][$ne]=reaction` na URL do Digisac nao funcionam como esperado. A API retorna 0 mensagens quando esses filtros sao aplicados via query string.

### Correcao aplicada

- Removidos `where[isFromMe]`, `where[visible]` e `where[type][$ne]` das URLs de `/messages` em `buscarMensagensClienteLote()` e `buscarPrimeiraMensagemClienteDoTicket()`
- Filtragem de `isFromMe === false`, `visible === true`, `isComment !== true`, `type !== 'reaction'` passa a ser feita 100% no TypeScript via `ehMensagemRespostaCliente()`
- Logs seguros adicionados: quantidade de mensagens brutas, quantidade apos filtro, exemplo seguro de 1 mensagem (sem id, sem texto)

### Arquivo alterado

- `src/lib/digisac/vacuoAtivo.ts` — remocao dos filtros URL + logs seguros

### Validacoes

- `npx tsc --noEmit --pretty false` -> exit 0
- `npx eslint src/lib/digisac/vacuoAtivo.ts --quiet` -> exit 0

### Constatacao importante

**`isFromMe`, `visible` e `type` devem ser filtrados localmente no TypeScript, nao via query string do Digisac.** O endpoint `/messages` nao processa esses filtros corretamente quando passados como `where[isFromMe]=false` etc.

---

## 17. Correcao: busca por contactId em vez de ticketId (2026-07-01)

### Problema confirmado

Apos remover os filtros da URL (secao 16), a busca por `where[ticketId]` retornou 122 mensagens brutas, mas todas eram registros `type: "ticket"` sem `timestamp`. Nenhuma mensagem real de conversa foi retornada.

### Causa raiz

O endpoint `/messages` com `where[ticketId]=...` ou `where[ticketId][$in]=...` retorna registros administrativos `type: "ticket"`, nao as mensagens reais de chat.

### Estrategia oficial adotada

A tela real do Digisac busca mensagens por `contactId` com `includeTicketTransfer=true`. Esta passa a ser a estrategia oficial do vacuo ativo:

1. Buscar mensagens por `where[contactId]=ticket.contactId` com `includeTicketTransfer=true`
2. Ordenar por `timestamp ASC`, `perPage=50`
3. Filtrar no TypeScript:
   - `mensagem.ticketId === ticket.id`
   - `mensagem.contactId === ticket.contactId`
   - `mensagem.isFromMe === false`
   - `mensagem.visible === true`
   - `mensagem.isComment !== true`
   - `mensagem.type !== "reaction"`
   - `mensagem.type !== "ticket"`
   - `mensagem.timestamp > ticket.startedAt`
   - `mensagem.timestamp <= ticket.startedAt + 24h`
4. Parar na primeira mensagem valida encontrada

### Funcoes removidas

- `buscarMensagensClienteLote()` — removida
- `buscarPrimeiraMensagemClienteDoTicket()` — removida

### Funcao criada

- `buscarMensagensContatoNaJanela(ticket, aberturaMs, limiteMs)` — busca por contactId, filtra localmente

### Arquivo alterado

- `src/lib/digisac/vacuoAtivo.ts`

### Validacoes

- `npx tsc --noEmit --pretty false` -> exit 0
- `npx eslint src/lib/digisac/vacuoAtivo.ts --quiet` -> exit 0

---

## 18. Correcao: reutilizacao do helper sgi-sync + conversao de timestamp (2026-07-01)

### Problema confirmado

Apos tentar busca por `contactId` (secao 17), as mensagens retornadas tinham `type: "chat"` mas `comTimestamp=0` — o campo `timestamp` nao era encontrado como numero. A busca por `ticketId` anterior retornava `type: "ticket"` sem timestamp.

### Descoberta: Inteligencia Comercial ja resolve isso

A Inteligencia Comercial usa `buscarMensagensTicketPaginado` de `src/lib/digisac/sgi-sync.ts` (linha 284), que:
1. Usa `where[ticketId]=...` — mesmo endpoint que retornava `type: "ticket"` antes, MAS filtra `type === 'chat'` e `visible !== false` e `isComment !== true`
2. Acessa `resp.data` (formato correto da resposta)
3. Retorna `DigisacMensagem[]` com campo `timestamp` em **segundos** (nao milissegundos)

Em `src/lib/ia/transcript.ts` (linha 14), o timestamp e convertido com `new Date(timestamp * 1000)` — confirmando que vem em segundos.

### Causa raiz do bug

Dois problemas combinados:
1. **Timestamp em segundos vs milissegundos:** O codigo anterior comparava `m.timestamp` (segundos, ex: 1714900000) com `aberturaMs` (milissegundos, ex: 1714900000000) — sempre falso
2. **Parse incorreto da resposta:** O codigo tentava `res` como array, depois `res.rows`, depois `res.data` — mas `buscarMensagensTicketPaginado` acessa `resp.data` diretamente

### Correcao aplicada

- Removida funcao `buscarMensagensContatoNaJanela` (busca por contactId)
- Criada funcao `buscarRespostaClienteTicket` que reutiliza `buscarMensagensTicketPaginado` de `sgi-sync.ts`
- Conversao correta: `tsMs = m.timestamp * 1000` antes de comparar com `aberturaMs` e `limiteMs`
- Filtro de cliente: `isFromMe === false` + `typeof timestamp === 'number'` + `tsMs > aberturaMs` + `tsMs <= limiteMs`
- `buscarMensagensTicketPaginado` ja filtra `type === 'chat'`, `visible !== false`, `isComment !== true` — registros `type: "ticket"` sao excluidos

### Funcao reutilizada

`buscarMensagensTicketPaginado(ticketId, perPage=100)` de `src/lib/digisac/sgi-sync.ts`:
- Exportada e ja usada pela Inteligencia Comercial
- Filtra `type === 'chat' && visible !== false && isComment !== true`
- Pagina automaticamente ate 50 paginas
- Retorna `{ mensagens: DigisacMensagem[], incompleto: boolean }`

### Arquivo alterado

- `src/lib/digisac/vacuoAtivo.ts`

### Validacoes

- `npx tsc --noEmit --pretty false` -> exit 0
- `npx eslint src/lib/digisac/vacuoAtivo.ts --quiet` -> exit 0

### Constatacao importante

**O timestamp do Digisac vem em segundos (epoch Unix), nao milissegundos.** Sempre multiplicar por 1000 antes de comparar com `Date.now()` ou `new Date().getTime()`.

---

## 19. Auditoria completa: fluxo "Historico do atendimento" da Inteligencia Comercial (2026-07-01)

### Componente que renderiza "Historico do atendimento"

`src/components/inteligencia-comercial/ModalDetalheVenda.tsx` linha 1928-2004.

### API/frontend que alimenta o historico

Linha 1949: `fetch(/api/sgi/digisac/mensagens?ticketId=${c.digisac_ticket_id})`

### API route

`src/app/api/sgi/digisac/mensagens/route.ts`:
- Chama `buscarMensagensTicketPaginado(ticketId)` de `src/lib/digisac/sgi-sync.ts`
- Retorna `{ mensagens: { id, text, isFromMe, timestamp }[], total, incompleto }`

### Helper real usado

`buscarMensagensTicketPaginado(ticketId, perPage=100)` em `src/lib/digisac/sgi-sync.ts` linha 284:
- Endpoint: `/messages?where[ticketId]=...&perPage=100&page=N`
- Acessa `resp.data` (formato correto da resposta Digisac)
- Filtra: `type === 'chat' && visible !== false && isComment !== true`
- Pagina automaticamente ate 50 paginas
- Retorna `{ mensagens: DigisacMensagem[], incompleto: boolean }`

### Estrutura real da mensagem (DigisacMensagem)

```typescript
interface DigisacMensagem {
  id: string
  ticketId?: string
  type?: string         // 'chat', 'reaction', 'ticket', etc
  text?: string
  isFromMe?: boolean    // true = loja/atendente, false = cliente
  visible?: boolean
  isComment?: boolean
  timestamp?: number    // SEGUNDOS (epoch Unix), nao milissegundos
}
```

### Campo real de data

`timestamp` — vem em **segundos** (epoch Unix). Confirmado por:
- `formatarTimestampMensagem` no ModalDetalheVenda (linha 1652): `new Date(ts * 1000)`
- `formatarTimestamp` em `src/lib/ia/transcript.ts` (linha 14): `new Date(timestamp * 1000)`

### Campo real de direcao cliente/loja

`isFromMe`:
- `true` = mensagem da loja/atendente
- `false` = mensagem do cliente

### Campo real de identificacao do chamado

`ticketId` — na tela chamado de `digisac_ticket_id` dentro de `IaChamadoAnalise`.

### Decisao de reaproveitamento

**O vacuoAtivo.ts ja usa o mesmo fluxo.** A correcao da secao 18 ja alinhou com a Inteligencia Comercial:
- Import de `buscarMensagensTicketPaginado` de `sgi-sync.ts` (linha 3)
- Chamada `buscarMensagensTicketPaginado(ticket.id)` (linha 149)
- Conversao `m.timestamp * 1000` (linha 161)
- Filtro `m.isFromMe === false` (linha 158)
- `buscarMensagensTicketPaginado` ja filtra `type === 'chat'` — exclui `type: "ticket"`

### Correcao aplicada

Nenhuma correcao adicional necessaria. O codigo atual ja esta alinhado com o fluxo confirmado da Inteligencia Comercial.

### Pendencia

- Validar manualmente (05/05/2026, Bigorrilho) para confirmar que o codigo ja corrigido funciona corretamente com dados reais

---

## 20. Causa real: timestamp vem como string, nao number (2026-07-01)

### Teste real

Data: 06/05/2026, Bigorrilho, todas as consultoras/conexoes.
Resultado: 100% (9 vacuos de 9 elegiveis).
Logs: `totalMensagens > 0` mas `comTimestamp=0` para todos os tickets.

### Comparacao dos dois fluxos

**Fluxo 1 — Inteligencia Comercial (funcional):**
- API route `mensagens/route.ts:27`: `timestamp: m.timestamp ?? null` — passa valor bruto
- Frontend `ModalDetalheVenda.tsx:1652`: `new Date(ts * 1000)` — JavaScript **coerce string para number** na multiplicacao: `"1714900000" * 1000` = `1714900000000` → **funciona com string**
- Frontend `formatarTimestampMensagem` tambem tem fallback para milissegundos

**Fluxo 2 — vacuoAtivo.ts (bugado):**
- `vacuoAtivo.ts:155`: `typeof m.timestamp === 'number'` — **falha se timestamp for string**
- TypeScript interface diz `timestamp?: number` mas **TypeScript nao valida tipos em runtime de JSON**

### Causa real

O Digisac retorna `timestamp` como **string** (ex: `"1714900000"`), nao number. A interface TypeScript `DigisacMensagem` declara `timestamp?: number` mas isso nao e validado em runtime.

O frontend da Inteligencia Comercial funciona porque `new Date(ts * 1000)` faz coercao implicita de string para number. O vacuoAtivo.ts falhava porque `typeof "1714900000" === 'number'` e falso.

### Correcao aplicada

Criada funcao `extrairTimestampMs(m: DigisacMensagem): number | null` em `vacuoAtivo.ts:6-29`:
1. Tenta `Number(m.timestamp)` — funciona para string ("1714900000") e number (1714900000)
2. Tenta como segundos: `new Date(n * 1000)` — se ano entre 2000-2100, usa
3. Tenta como milissegundos: `new Date(n)` — fallback
4. Fallback para `createdAt` (ISO string) se timestamp nao existir

Adicionado log diagnostico one-shot em `buscarRespostaClienteTicket`:
- `[VACUO_ATIVO][COMPARE][VACUO]` com `Object.keys` e tipos JS da primeira mensagem
- Log seguro: sem valores de texto, sem payload bruto

### Arquivo alterado

- `src/lib/digisac/vacuoAtivo.ts`

### Validacoes

- `npx tsc --noEmit --pretty false` -> exit 0
- `npx eslint src/lib/digisac/vacuoAtivo.ts --quiet` -> exit 0

---

## 21. Visibilidade dos chamados avaliados — chamadosAvaliados (2026-07-02)

### Objetivo

Trazer os protocolos dos chamados avaliados pela Taxa de vacuo ativo para validacao manual.

### Mudanca no contrato de retorno da API

Adicionado campo opcional `chamadosAvaliados` em `VacuoAtivoResponse` (`src/types/index.ts`):

```ts
interface ChamadoAvaliadoVacuo {
  protocol: string | null;
  ticketId: string;           // abreviado, max 8 chars
  statusVacuo: 'vacuo' | 'respondido_em_24h';
  temRespostaClienteEm24h: boolean;
  totalMensagens: number;
  mensagensClienteEm24h: number;
}

interface VacuoAtivoResponse {
  // ... campos existentes ...
  chamadosAvaliados?: ChamadoAvaliadoVacuo[];
}
```

### Origem do protocolo

Campo `protocol` do ticket Digisac, ja existente em `TicketVacuo` (`vacuoAtivo.ts:46`). Convertido para `String()` no retorno.

### Log seguro adicionado

`[VACUO_ATIVO][AVALIADOS]` — log final com lista sanitizada:
- `protocol` (string ou null)
- `ticket` (8 chars abreviado)
- `statusVacuo` ("vacuo" ou "respondido_em_24h")
- `temRespostaClienteEm24h` (boolean)
- `totalMensagens` (number)
- `mensagensClienteEm24h` (number)

Nao loga: texto de mensagem, CPF, telefone, ID completo, payload bruto.

### Alteracao na funcao buscarRespostaClienteTicket

Antes: fazia early return na primeira mensagem do cliente em 24h (contava apenas 1).
Agora: percorre todas as mensagens, conta todas do cliente em 24h, mas ainda retorna a primeira timestamp para o calculo de vacuo/respondido.

### Alteracao visual no card

`CardVacuoAtivo.tsx`: adicionado botao expansivel "Ver chamados avaliados" que mostra lista simples com protocolo, status e mensagens do cliente em 24h.

### Arquivos alterados

- `src/types/index.ts` — adicionada interface `ChamadoAvaliadoVacuo` e campo `chamadosAvaliados?` em `VacuoAtivoResponse`
- `src/lib/digisac/vacuoAtivo.ts` — `buscarRespostaClienteTicket` conta todas as mensagens do cliente; `calcularVacuoAtivoDashboard` constroi `chamadosAvaliados` e loga `[VACUO_ATIVO][AVALIADOS]`
- `src/components/dashboard/CardVacuoAtivo.tsx` — botao expansivel com lista de chamados avaliados

### Validacoes

- `npx tsc --noEmit --pretty false` -> exit 0
- `npx eslint src/lib/digisac/vacuoAtivo.ts src/components/dashboard/CardVacuoAtivo.tsx src/types/index.ts --quiet` -> exit 0

---

## 22. Link clicavel para historico do ticket no Digisac (2026-07-02)

### Objetivo

Transformar o protocolo dos chamados avaliados em link clicavel para o historico no Digisac.

### Formato da URL

`https://lebebe.digisac.me/ticket-history/{ticketId}`

O `ticketId` usado na URL e o ID completo (UUID), nao o abreviado de 8 chars.

### Implementacao

- Adicionada constante `DIGISAC_WEB_BASE_URL = 'https://lebebe.digisac.me'` em `vacuoAtivo.ts:6`
- Adicionado helper `montarUrlHistoricoTicket(ticketId: string): string` em `vacuoAtivo.ts:8`
- Adicionado campo `ticketHistoryUrl: string | null` em `ChamadoAvaliadoVacuo` (`src/types/index.ts`)
- `chamadosAvaliados` agora inclui `ticketHistoryUrl: montarUrlHistoricoTicket(t.id)` com o ID completo
- `ticketId` abreviado (8 chars) mantido para key/display
- `CardVacuoAtivo.tsx`: protocolo renderizado como `<a target="_blank" rel="noopener noreferrer">` quando `ticketHistoryUrl` existe; texto normal caso contrario

### Arquivos alterados

- `src/types/index.ts` — adicionado `ticketHistoryUrl: string | null` em `ChamadoAvaliadoVacuo`
- `src/lib/digisac/vacuoAtivo.ts` — constante `DIGISAC_WEB_BASE_URL`, helper `montarUrlHistoricoTicket`, campo `ticketHistoryUrl` no push de `chamadosAvaliados`
- `src/components/dashboard/CardVacuoAtivo.tsx` — protocolo como link `<a>` com `target="_blank"` e `rel="noopener noreferrer"`

### Validacoes

- `npx tsc --noEmit --pretty false` -> exit 0
- `npx eslint src/lib/digisac/vacuoAtivo.ts src/components/dashboard/CardVacuoAtivo.tsx src/types/index.ts --quiet` -> exit 0
