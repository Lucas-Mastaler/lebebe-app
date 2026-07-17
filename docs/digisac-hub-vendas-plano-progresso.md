# Plano Técnico e Progresso — Hub/Vendas → Lojas → Recuperação Automática de Leads

**Data:** 2026-07-17 (auditoria) | 2026-07-17 (revisão técnica)
**Status:** Plano técnico revisado. Pendente de aprovação do usuário antes da Fase 1.
**Documento de origem:** `docs/digisac-hub-vendas-recuperacao-leads.md` (mapa de regras fechado pelo usuário)

---

## Índice

1. Webhook atual do Digisac
2. Normalização de telefone
3. Envio de mensagens
4. Contatos
5. Cron
6. Fila, locks e idempotência
7. Fluxo antigo de distribuição (triagem)
8. Conexões cadastradas
9. Tabelas do Supabase — validação completa
10. Componentes reutilizáveis
11. Variáveis de ambiente
12. Arquitetura proposta
13. Riscos e pontos de atenção
14. Plano de implementação (fases)
15. Confirmação de não-alteração
16. **Revisão da arquitetura de webhook** (nova)
17. **Obtenção de contactId e ticketId** (nova)
18. **Modelo de dados revisado** (nova)
19. **Fonte de verdade dos estados** (nova)
20. **Locks e reserva atômica** (nova)
21. **Infraestrutura do processador periódico** (nova)
22. **Frequência do processador** (nova)
23. **Configurações e env vars revisadas** (nova)
24. **Bloqueios por fase** (nova)
25. **Decisões pendentes do usuário** (nova)

---

## 1. Webhook atual do Digisac

### 1.1 Rota principal: `/api/digisac/webhook`

**Arquivo:** `src/app/api/digisac/webhook/route.ts` (25 linhas)

- Recebe POST do Digisac
- Valida `DIGISAC_WEBHOOK_SECRET` via header `x-digisac-secret` ou query param `secret`
- Se secret não configurado, aceita sem validação (sem env var = sem proteção)
- Chama `processarTriagemLojaDigisac(rawPayload)` de `src/lib/digisac/triagem.ts`
- Sempre retorna HTTP 200 (mesmo em erro) — padrão correto para webhooks Digisac
- Não tem `export const runtime` explícito — **o runtime padrão do Next.js 16 para Route Handlers é `'nodejs'`** (confirmado na documentação oficial: https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config). Edge só é usado quando configurado explicitamente via `export const runtime = 'edge'`. O Edge Runtime está sendo deprecated no Next.js 16 (PR #93369). A ausência de `export const runtime` significa runtime Node.js, não Edge.

### 1.2 Rota pós-venda: `/api/digisac/webhook/posvenda`

**Arquivo:** `src/app/api/digisac/webhook/posvenda/route.ts` (30 linhas)

- Recebe POST do Digisac
- Valida `DIGISAC_POSVENDA_WEBHOOK_SECRET` com fallback para `DIGISAC_WEBHOOK_SECRET`
- Chama `processarWebhookPosVenda(rawPayload)` de `src/lib/atendimento-automatico/webhook-processor.ts`
- `export const runtime = 'nodejs'` explícito
- Sempre retorna HTTP 200

### 1.3 Avaliação para o novo fluxo

- **Não reutilizar** a rota `/api/digisac/webhook` — ela processa apenas triagem (identificar loja por texto e transferir contato)
- **Não reutilizar** a rota `/api/digisac/webhook/posvenda` — ela processa atendimento automático pós-venda
- **Criar nova rota** `/api/digisac/webhook/hub-vendas` para o fluxo de captura de leads do hub
- O novo webhook deve ser leve, filtrar eventos irrelevantes antes de consultar banco, normalizar telefone e responder rápido — conforme seção 20 do mapa

---

## 2. Normalização de telefone

### 2.1 Funções existentes (validadas no código)

**Arquivo:** `src/lib/digisac/sgi-sync.ts`

```typescript
// Linha 697-699
export function normalizarTelefone(tel: string): string {
  return tel.replace(/\D/g, '').replace(/^55/, '')
}

// Linha 701-705
export function normalizarTelefoneDDI(tel: string): string {
  const digits = tel.replace(/\D/g, '')
  if (digits.startsWith('55') && digits.length >= 12) return digits
  return `55${digits}`
}
```

### 2.2 Variações de telefone

**Arquivo:** `src/lib/digisac/sgi-sync.ts`, linhas 111-148

`gerarVariacoesTelefone(telefoneInput)` gera 4 variações para celulares com 9º dígito:
- Sem 9º dígito + DDI (prioridade 1)
- Com 9º dígito + DDI (prioridade 2)
- Sem 9º dígito sem DDI (prioridade 3)
- Com 9º dígito sem DDI (prioridade 4)

Exemplo: `5541984148660` → `[554184148660, 5541984148660, 4184148660, 41984148660]`

### 2.3 Normalização no webhook pós-venda

**Arquivo:** `src/lib/atendimento-automatico/webhook-processor.ts`

Importa `normalizarTelefone` de `@/lib/atendimento-presencial/telefone.ts` (não do `sgi-sync.ts`). A função de `telefone.ts` foi validada como existente e usada em testes.

### 2.4 Recomendação para o novo fluxo

- **Reutilizar** `normalizarTelefone` e `normalizarTelefoneDDI` de `src/lib/digisac/sgi-sync.ts`
- **Reutilizar** `gerarVariacoesTelefone` para busca de conversões nas conexões de loja
- Chave principal do lead = `telefone_normalizado_ddi` (conforme seção 5 do mapa: "telefone normalizado")
- Não depender de `contactId` como chave principal (contactId muda entre conexões)

---

## 3. Envio de mensagens

### 3.1 Função existente

**Arquivo:** `src/lib/digisac/enviar-mensagem.ts` (49 linhas)

```typescript
export async function enviarMensagemDigisac(params: {
  contactId: string;
  ticketId: string;
  texto: string;
}): Promise<ResultadoEnvioMensagem>
```

- POST `/messages` com `text`, `type: 'chat'`, `contactId`, `ticketId`, `fromMe: true`
- Retorna `{ ok: true, digisac_message_id?: string }` ou `{ ok: false, erro: string }`
- Extrai `digisac_message_id` do corpo da resposta (campo `id` ou `data.id`)
- Trata erros de parse JSON silenciosamente

### 3.2 Cliente HTTP base

**Arquivo:** `src/lib/digisac/clienteDigisac.ts` (103 linhas)

- `fetchDigisac(endpoint, options)` — retorna JSON parseado, timeout 30s
- `fetchDigisacRaw(endpoint, options)` — retorna `Response` bruto, timeout 30s
- Usa `DIGISAC_BASE_URL` e `DIGISAC_TOKEN` env vars
- Trata 401/403 (autenticação), 429 (rate limit) com mensagens específicas
- Log sem expor token

### 3.3 Recomendação para o novo fluxo

- **Reutilizar** `enviarMensagemDigisac` para envio de abordagens automáticas
- **Reutilizar** `fetchDigisac`/`fetchDigisacRaw` para todas as chamadas à API Digisac
- Necessário obter `contactId` e `ticketId` do contato na conexão de loja antes de enviar
- Pode ser necessário criar/abrir ticket na conexão de destino antes de enviar mensagem

---

## 4. Contatos

### 4.1 Busca de contato por ID

**Arquivo:** `src/lib/digisac/contatos.ts` (86 linhas)

- `buscarContatoCompleto(contactId)` — busca por ID com cache em memória (TTL 10 min)
- Fallback: listagem filtrada por ID se busca direta falhar
- `buscarContatosPorIds(contactIds)` — busca em lote com limite de concorrência (5 simultâneas)

### 4.2 Recomendação para o novo fluxo

- Para identificar conversão: buscar tickets por telefone nas conexões de loja usando `buscarTicketsPorTelefoneComVariacoes` de `sgi-sync.ts`
- Para envio: necessário obter `contactId` e `ticketId` na conexão de destino
- O novo fluxo **não deve** salvar todos os contatos — apenas o necessário para operação e auditoria (seção 21 do mapa)

---

## 5. Cron

### 5.1 Cron jobs atuais

**Arquivo:** `vercel.json`

| Path | Schedule | Descrição |
|---|---|---|
| `/api/cron/auto-logout` | `0 22 * * *` | Logout automático 19h BRT |
| `/api/cron/digisac-finalizacoes-automaticas` | `0 20 * * *` | Fechamento automático 17h BRT |
| `/api/cron/atendimento-presencial-limpar-rascunhos` | `0 9 * * *` | Limpeza de rascunhos 06h BRT |

### 5.2 Cron de finalizacoes automáticas

**Arquivo:** `src/app/api/cron/digisac-finalizacoes-automaticas/route.ts` (324 linhas)

- Valida `CRON_SECRET` via header `Authorization: Bearer <CRON_SECRET>`
- Cria registro de execução em `digisac_finalizacoes_execucoes` imediatamente
- Para cada conexão habilitada: chama endpoint de diagnóstico interno
- Registra pendentes em `digisac_fechamentos_automaticos`
- Executa fechamento central via `executarFinalizacoesAutomaticas`
- Atualiza registro de execução com totais e status

### 5.3 Limitação Vercel Hobby

- Vercel Hobby permite no mínimo 1x/dia por cron job
- O mapa exige dois processos distintos (seção 17):
  - **Cron da manhã** (09:00-10:00): prepara fila, reconcilia, seleciona elegíveis
  - **Processador curto**: executa itens quando horário programado vencer
- O cron da manhã pode ser `0 12 * * 1-6` (09:00 BRT, seg-sáb)
- O processador curto precisa rodar a cada ~5-10 minutos — **não suportado no Vercel Hobby**
- **Solução necessária**: cron externo (EasyPanel, GitHub Actions, ou similar) chamando endpoint a cada 5-10 min, OU processar todos os pendentes no cron da manhã com cálculo de horário dentro da execução

### 5.4 Recomendação para o novo fluxo

- **Criar** `/api/cron/hub-vendas-preparar-fila` — cron da manhã (seg-sáb 09:00 BRT)
- **Criar** `/api/cron/hub-vendas-processar-fila` — processador curto (a cada 5-10 min, seg-sáb 09:00-18:00 BRT)
- Ambos validam `CRON_SECRET`
- Necessário decidir infra do processador curto (Vercel Hobby não suporta frequência necessária)

---

## 6. Fila, locks e idempotência

### 6.1 Padrão existente — fila de sincronização

**Tabela:** `digisac_sync_fila` (430 linhas)

- Campos: `id`, `documento_saida_id` (FK), `numero_lancamento`, `status`, `tipo`, `erro`, `resultado_json`, `telefones_processados_json`, `solicitado_em`, `iniciado_em`, `finalizado_em`
- Indexes: status, numero_lancamento, solicitado_em, created_at
- FK: `documento_saida_id` → `sgi_documentos_saida`
- Sem lock otimista explícito (não há campo `locked_at` ou `locked_by`)

### 6.2 Padrão existente — idempotência na triagem

**Tabela:** `digisac_triagem_loja`

- Unique constraint em `digisac_message_id` — impede reprocessamento do mesmo webhook
- Antes de transferir, consulta se `digisac_message_id` já existe

### 6.3 Padrão existente — idempotência no atendimento automático

**Tabela:** `atendimento_automatico_mensagens`

- Unique index em `digisac_message_id` — impede duplicação de mensagens
- Unique index em `digisac_ticket_id` em `atendimento_automatico_sessoes` — uma sessão por ticket

### 6.4 Padrão existente — fechamentos automáticos

**Tabela:** `digisac_fechamentos_automaticos`

- Unique constraint em `digisac_ticket_id`
- Status: `pendente` | `finalizado` | `erro` | `ignorado`
- Antes de inserir, verifica se ticket já existe (erro 23505 = já existe)

### 6.5 Avaliação para o novo fluxo

- **Não há** mecanismo de lock otimista no projeto atual
- **Não há** padrão de reserva de item antes do envio
- O novo fluxo exige (seção 24 do mapa):
  - Trava contra duplicidade
  - Reserva do item antes do envio
  - Validação final antes do envio
- **Recomendação**: criar campo `reservado_em` e `reservado_por` na tabela de fila, com update condicional (`WHERE reservado_em IS NULL`) para reservar item atomicamente
- Idempotência: unique constraint em `(telefone_normalizado_ddi, ciclo_id)` para impedir mais de 1 tentativa por ciclo

---

## 7. Fluxo antigo de distribuição automática (triagem)

### 7.1 Como funciona

**Arquivo:** `src/lib/digisac/triagem.ts` (184 linhas)

1. Webhook recebe `message.created` na conexão Hub/Vendas (`DIGISAC_SERVICE_ID_VENDAS`)
2. Filtra: ignora mensagens nossas, bot, comentário, tipo não-chat, texto vazio, ticket fechado
3. Verifica se departamento atual é o departamento inicial de vendas (`DIGISAC_DEPARTAMENTO_INICIAL_VENDAS`)
4. Normaliza texto e detecta loja por palavras-chave:
   - `1`/`bigorrilho`/`bigo`/`loja bigorrilho` → Bigorrilho
   - `2`/`hauer`/`loja hauer` → Hauer
   - `3`/`portao`/`loja portao` → Portão
5. Consulta idempotência em `digisac_triagem_loja` por `digisac_message_id`
6. Transfere contato para departamento da loja via `transferirContatoParaDepartamento`
7. Registra resultado na tabela

### 7.2 Transferência

**Arquivo:** `src/lib/digisac/transferencia.ts` (36 linhas)

- POST `/contacts/{contactId}/ticket/transfer`
- Body: `{ departmentId, userId: null, comments: '', byUserId: DIGISAC_BOT_USER_ID }`
- Usa `DIGISAC_BOT_USER_ID` env var

### 7.3 Estado atual

- **3 registros** na tabela `digisac_triagem_loja` (último em 2026-05-31)
- Usa connection ID antigo `4af28025-c210-4336-a560-785d2fb8a778` (VENDAS — não cadastrada em `digisac_conexoes_automacao`)
- Departamentos configurados via env vars: `DIGISAC_DEPARTAMENTO_BIGORRILHO`, `DIGISAC_DEPARTAMENTO_HAUER`, `DIGISAC_DEPARTAMENTO_PORTAO`
- Departamentos fixos também em `src/lib/digisac/departamentosFixos.ts`:
  - Bigorrilho: `4de92f03-ff0a-49c3-b167-07603ae01569`
  - Hauer: `4136bb72-5bc2-43bb-bf5a-bfc820a80bd1`
  - Portão: `37f6f05c-bab3-49fe-bac1-d57038daa5e0`

### 7.4 Reutilização para o novo fluxo

- **A lógica de detecção de loja por texto é reutilizável** — mesmo padrão de palavras-chave
- **A transferência NÃO é o mecanismo correto para recuperação** — o novo fluxo envia mensagem de abordagem, não transfere o contato
- **A saudação do hub** (seção 3 do mapa) menciona `wa.me` links para as lojas — o cliente chama a loja diretamente, não responde com texto
- **Conclusão**: o fluxo antigo de triagem é **paralelo e independente** do novo fluxo de recuperação. O novo fluxo captura a entrada no hub, monitora conversão nas lojas e recupera quem não chamou

---

## 8. Conexões cadastradas

### 8.1 Tabela `digisac_conexoes_automacao` (validada via MCP Supabase)

| service_id | service_name | my_number | default_department_id | ativo |
|---|---|---|---|---|
| `0973f84b-8294-4615-9657-ba95b6346246` | BIGORRILHO (41 8804-3042) | 554188043042 | `4de92f03...` (Bigorrilho) | true |
| `1352c41b-80a9-4e74-b9d9-4c5e7aed060e` | MARECHAL (41 9222-0492) | 554192220492 | `4136bb72...` (Hauer) | true |
| `c60d720f-5ad5-4a1b-bedb-e51495dee686` | PORTÃO (41 8442-6528) | 554184426528 | `37f6f05c...` (Portão) | true |

### 8.2 Conexão Hub/Vendas (NÃO cadastrada)

- Service ID: `4af28025-c210-4336-a560-785d2fb8a778` (VENDAS — 41 9202-9087)
- Usada apenas na triagem via env var `DIGISAC_SERVICE_ID_VENDAS`
- Usada no schedule via `ALLOWED_SERVICE_IDS` em `src/app/api/digisac/schedule/route.ts`
- **Necessário cadastrar** em `digisac_conexoes_automacao` para o novo fluxo, com flag `ativo` e campo identificando como hub

### 8.3 Conexão Pós-venda (excluída da análise comercial)

- Service ID: `ece0fdac-962e-491c-b47f-fa912b17a878` (POS VENDA — 41 9119-1696)
- Listada em `SERVICE_IDS_EXCLUIDOS_COMERCIAL` em `sgi-sync.ts`
- **Não relevante** para o fluxo hub/vendas

---

## 9. Tabelas do Supabase — validação completa

### 9.1 Tabelas existentes relacionadas ao Digisac (14 tabelas, RLS habilitado em todas)

| Tabela | Linhas | Unique constraints | Purpose |
|---|---|---|---|
| `digisac_triagem_loja` | 3 | `digisac_message_id` | Triagem antiga (roteamento por texto) |
| `digisac_conversas_resumo` | 720 | `digisac_ticket_id` | Resumo de conversas sincronizadas |
| `digisac_cliente_historico_resumo` | 290 | `telefone_normalizado_ddi` | Histórico agregado por telefone |
| `digisac_sync_fila` | 430 | — | Fila de sincronização inteligência comercial |
| `digisac_conexoes_automacao` | 3 | `service_id` | Conexões habilitadas para automação |
| `digisac_fechamentos_automaticos` | 376 | `digisac_ticket_id` | Fechamentos automáticos pendentes/finalizados |
| `digisac_finalizacoes_execucoes` | 12 | — | Log de execuções do cron de fechamento |
| `atendimento_automatico_sessoes` | 96 | `digisac_ticket_id` | Sessões de atendimento automático pós-venda |
| `atendimento_automatico_mensagens` | 981 | `digisac_message_id` | Mensagens de atendimento automático |
| `atendimento_automatico_eventos` | 655 | — | Eventos de atendimento automático |
| `atendimento_automatico_bloqueios` | 2 | — | Bloqueios de atendimento automático |
| `venda_conversa_vinculos` | 773 | `(numero_lancamento, digisac_ticket_id)` | Vínculos venda ↔ conversa |
| `inteligencia_comercial_clientes` | 7 | — | Clientes da inteligência comercial |
| `inteligencia_comercial_observacoes` | 11 | — | Observações comerciais |

### 9.2 Tabelas que NÃO existem (necessárias para o novo fluxo)

- `hub_vendas_leads` — captura de entrada no hub, ciclo, status, loja principal, conversão
- `hub_vendas_recuperacao_fila` — fila de recuperação com horário programado, conexão, reserva
- `hub_vendas_envios` — log de envios de abordagem, resultado, versão da mensagem
- `hub_vendas_contadores_diarios` — contador de envios por conexão por dia (limite 15/dia)
- `hub_vendas_pausas` — pausa geral e por conexão

### 9.3 Indexes existentes relevantes

- `digisac_conversas_resumo`: index em `telefone_normalizado_ddi` — reutilizável para buscar conversão
- `digisac_cliente_historico_resumo`: unique em `telefone_normalizado_ddi` — reutilizável para histórico
- `venda_conversa_vinculos`: index em `telefone_normalizado_ddi` e `digisac_ticket_id`

---

## 10. Componentes reutilizáveis

### 10.1 Diretamente reutilizáveis (sem alteração)

| Componente | Arquivo | Uso no novo fluxo |
|---|---|---|
| `fetchDigisac` | `src/lib/digisac/clienteDigisac.ts` | Todas as chamadas à API Digisac |
| `fetchDigisacRaw` | `src/lib/digisac/clienteDigisac.ts` | Chamadas que precisam de Response bruto |
| `enviarMensagemDigisac` | `src/lib/digisac/enviar-mensagem.ts` | Envio de abordagem automática |
| `normalizarTelefone` | `src/lib/digisac/sgi-sync.ts` | Normalização de telefone (sem DDI) |
| `normalizarTelefoneDDI` | `src/lib/digisac/sgi-sync.ts` | Normalização de telefone (com DDI) |
| `gerarVariacoesTelefone` | `src/lib/digisac/sgi-sync.ts` | Busca de conversão por variações de telefone |
| `buscarTicketsPorTelefoneComVariacoes` | `src/lib/digisac/sgi-sync.ts` | Buscar tickets nas conexões de loja |
| `montarUrlHistoricoTicket` | `src/lib/digisac/urls.ts` | Link para histórico no Digisac |
| `montarRangeUtcSaoPaulo` | `src/lib/digisac/utilsDatas.ts` | Conversão de datas BRT → UTC |
| `executarComLimite` | `src/lib/digisac/limiteConcorrencia.ts` | Controle de concorrência |
| `DEPARTAMENTOS_FIXOS` | `src/lib/digisac/departamentosFixos.ts` | IDs de departamentos das lojas |
| `formatarDataPtBr` | `src/lib/digisac/formatadores.ts` | Formatação de datas na UI |
| `formatarHoraPtBr` | `src/lib/digisac/formatadores.ts` | Formatação de horas na UI |

### 10.2 Reutilizáveis com adaptação

| Componente | Arquivo | Adaptação necessária |
|---|---|---|
| `buscarConexoesHabilitadas` | `src/lib/digisac/finalizacoesAutomaticas.ts` | Filtrar apenas conexões de loja (não hub) |
| `processarTriagemLojaDigisac` | `src/lib/digisac/triagem.ts` | Não reutilizar diretamente — lógica de detecção de loja pode ser extraída |
| `normalizarTextoDigisac` | `src/lib/digisac/triagem.ts` | Reutilizável para normalizar texto de mensagens |
| `detectarLojaPorResposta` | `src/lib/digisac/triagem.ts` | Reutilizável para detectar loja por texto |

### 10.3 Não reutilizáveis

| Componente | Motivo |
|---|---|
| `transferirContatoParaDepartamento` | Novo fluxo envia mensagem, não transfere contato |
| `processarWebhookPosVenda` | Lógica específica de pós-venda |
| `fecharRegistroAutomaticoDigisac` | Lógica específica de fechamento de ticket |
| `buscarContatoCompleto` | Novo fluxo não busca contato por ID — busca por telefone |

---

## 11. Variáveis de ambiente necessárias

### 11.1 Já existentes (validadas no código)

| Env var | Uso |
|---|---|
| `DIGISAC_BASE_URL` | URL base da API Digisac |
| `DIGISAC_TOKEN` | Token de autenticação |
| `DIGISAC_WEBHOOK_SECRET` | Secret do webhook principal |
| `DIGISAC_POSVENDA_WEBHOOK_SECRET` | Secret do webhook pós-venda |
| `DIGISAC_SERVICE_ID_VENDAS` | Service ID da conexão Hub/Vendas |
| `DIGISAC_DEPARTAMENTO_INICIAL_VENDAS` | Departamento inicial de vendas |
| `DIGISAC_DEPARTAMENTO_BIGORRILHO` | Departamento Bigorrilho |
| `DIGISAC_DEPARTAMENTO_HAUER` | Departamento Hauer |
| `DIGISAC_DEPARTAMENTO_PORTAO` | Departamento Portão |
| `DIGISAC_BOT_USER_ID` | ID do usuário bot para transferência |
| `CRON_SECRET` | Secret de autorização dos cron jobs |
| `APP_URL` | URL base da aplicação |

### 11.2 Novas env vars necessárias

| Env var | Purpose |
|---|---|
| `DIGISAC_HUB_VENDAS_WEBHOOK_SECRET` | Secret do novo webhook hub/vendas |
| `HUB_VENDAS_CICLO_DIAS` | Duração do ciclo em dias (default 14) |
| `HUB_VENDAS_JANELA_CONVERSAO_HORAS` | Janela de conversão em horas (default 24) |
| `HUB_VENDAS_ELEGIBILIDADE_HORAS` | Prazo máximo de elegibilidade (default 48) |
| `HUB_VENDAS_LIMITE_DIARIO_POR_CONEXAO` | Limite de envios por conexão/dia (default 15) |
| `HUB_VENDAS_INTERVALO_MIN_SEG` | Intervalo mínimo entre envios (default 180) |
| `HUB_VENDAS_INTERVALO_MAX_SEG` | Intervalo máximo entre envios (default 300) |
| `HUB_VENDAS_HORARIO_INICIO` | Início horário permitido (default 09) |
| `HUB_VENDAS_HORARIO_FIM` | Fim horário permitido (default 18) |

---

## 12. Arquitetura proposta

### 12.1 Visão geral

```
ENTRADA (webhook)
Digisac Hub/Vendas → POST /api/digisac/webhook/hub-vendas
  → valida secret
  → filtra evento (message.created, isFromMe=true, type=chat)
  → identifica conexão hub
  → normaliza telefone
  → verifica se é saudação enviada por nós
  → se sim: registra lead em hub_vendas_leads (novo ciclo se >14 dias)
  → se não: verifica se é resposta em conexão de loja → marca conversão
  → responde 200 rápido

CONVERSÃO (webhook + reconciliação)
Cliente chama loja → webhook identifica → marca convertido_organicamente
Cron da manhã → reconcilia pendentes → confirma conversão

RECUPERAÇÃO (cron + processador)
Cron da manhã → seleciona elegíveis → respeita limite → rodízio → agenda horário
Processador curto → a cada 5-10 min → executa itens no horário → envia mensagem

PÓS-RECUPERAÇÃO (webhook)
Cliente responde → webhook identifica resposta → marca recuperacao_respondida
Cliente não responde → ciclo encerra automaticamente após 48h
```

### 12.2 Endpoints necessários

| Endpoint | Método | Descrição |
|---|---|---|
| `/api/digisac/webhook/hub-vendas` | POST | Webhook de captura e conversão |
| `/api/cron/hub-vendas-preparar-fila` | GET | Cron da manhã (preparar + reconciliar) |
| `/api/cron/hub-vendas-processar-fila` | GET | Processador curto (executar envios) |
| `/api/hub-vendas/leads` | GET | Listagem de leads (tela) |
| `/api/hub-vendas/metricas` | GET | Métricas para painel |
| `/api/hub-vendas/pausas` | POST/GET | Pausar/despausar automação |
| `/api/hub-vendas/fila-manual` | GET | Lista de contato manual |

### 12.3 Tela

- Nova tela interna seguindo `docs/ia/padrao-novas-telas-permissoes.md`
- Módulo: `hub_vendas_recuperacao`
- Sidebar item com `moduleKey`
- Protegido por `checkModuleAndWindowAccess`
- Redirects: `/acesso-negado`, `/fora-do-horario`, fallback `/inicio`

---

## 13. Riscos e pontos de atenção

### 13.1 Infra

- **Vercel Hobby cron**: mínimo 1x/dia — processador curto precisa de cron externo
- **Supabase egress**: salvar pouco, consultar pouco, usar índices (seção 30 do mapa)
- **Timeout 30s**: `fetchDigisac` tem timeout de 30s — processador curto não pode fazer muitas chamadas sequenciais

### 13.2 Segurança

- Webhook sem secret = sem proteção (padrão atual se env var não configurada)
- Novo webhook deve ter secret obrigatório
- `CRON_SECRET` já validado no cron existente — reutilizar padrão
- Não expor `service_role` em rotas públicas

### 13.3 Concorrência

- `limiteConcorrencia.ts` tem bug potencial: variável `i` declarada com `const` na linha 20 mas nunca usada — código funcional via `queue.shift()` mas código morto presente
- Sem lock otimista no projeto — necessário criar mecanismo de reserva

### 13.4 Normalização

- `normalizarTelefone` remove `55` do início incondicionalmente — pode quebrar números que começam com 55 sem ser DDI (não confirmado como problema real)
- `gerarVariacoesTelefone` prioriza sem 9º dígito — padrão histórico do Digisac, correto

### 13.5 Idempotência

- Padrão existente: unique constraint + consulta antes de inserir
- Novo fluxo precisa de unique constraint em `(telefone_normalizado_ddi, ciclo_id)` para impedir mais de 1 tentativa por ciclo

---

## 14. Plano de implementação (fases)

### Fase 0 — Auditoria (concluída)

- [x] Ler webhook atual
- [x] Validar normalização de telefone
- [x] Mapear fluxo antigo de distribuição
- [x] Validar tabelas no MCP Supabase
- [x] Identificar componentes reutilizáveis
- [x] Mapear cron jobs
- [x] Auditar fila, locks e idempotência
- [x] Criar este documento

### Fase 1 — Banco de dados

- [ ] Migration: criar `hub_vendas_leads`, `hub_vendas_recuperacao_fila`, `hub_vendas_envios`, `hub_vendas_contadores_diarios`, `hub_vendas_pausas`
- [ ] RLS em todas as tabelas
- [ ] Indexes em `telefone_normalizado_ddi`, `status`, `ciclo_id`, `conexao_id`, `data_entrada`
- [ ] Unique constraints: `(telefone_normalizado_ddi, ciclo_id)` em leads, `(lead_id)` em envios
- [ ] Cadastrar conexão Hub/Vendas em `digisac_conexoes_automacao`
- [ ] Cadastrar módulo `hub_vendas_recuperacao` em `app_modulos`

### Fase 2 — Webhook

- [ ] Criar `/api/digisac/webhook/hub-vendas`
- [ ] Filtrar eventos relevantes antes de consultar banco
- [ ] Identificar saudação enviada (isFromMe=true, texto contém links wa.me das lojas)
- [ ] Registrar lead com novo ciclo se >14 dias
- [ ] Detectar conversão (mensagem do cliente em conexão de loja)
- [ ] Marcar conversão e loja principal

### Fase 3 — Cron preparação

- [ ] Criar `/api/cron/hub-vendas-preparar-fila`
- [ ] Reconciliar pendentes (buscar tickets por telefone nas conexões de loja)
- [ ] Selecionar elegíveis (sem conversão, <48h, sem abordagem no ciclo)
- [ ] Respeitar limite diário (15/conexão)
- [ ] Rodízio (Portão → Bigorrilho → Hauer)
- [ ] Calcular horário de envio (intervalo aleatório 180-300s por conexão)
- [ ] Jogar excedentes em fila manual

### Fase 4 — Processador de envios

- [ ] Criar `/api/cron/hub-vendas-processar-fila`
- [ ] Validar horário permitido (seg-sáb 09:00-18:00 BRT)
- [ ] Reservar item atomicamente (lock)
- [ ] Validação final (seção 26 do mapa)
- [ ] Enviar mensagem via `enviarMensagemDigisac`
- [ ] Registrar resultado em `hub_vendas_envios`
- [ ] Atualizar contador diário
- [ ] Pausa automática por erros consecutivos

### Fase 5 — Tela

- [ ] Criar página `/hub-vendas/recuperacao`
- [ ] Painel com métricas (seção 28 do mapa)
- [ ] Listas (seção 29 do mapa)
- [ ] Controles de pausa (geral e por conexão)
- [ ] Lista de contato manual
- [ ] Cadastro de versões de mensagem
- [ ] Proteção com `checkModuleAndWindowAccess`

### Fase 6 — Mensagens

- [ ] Criar 5+ versões de mensagem de abordagem
- [ ] Aprovação manual antes de usar
- [ ] Registrar versão usada em cada envio
- [ ] Medir desempenho por versão

---

## 15. Confirmação de não-alteração

Esta auditoria **não alterou**:
- Nenhum arquivo de código (`.ts`, `.tsx`)
- Nenhuma migration SQL
- `vercel.json`
- Nenhum webhook
- Nenhum cron
- Nenhuma configuração operacional
- Nenhuma env var
- Nenhuma tabela, policy, constraint ou index no Supabase

Esta auditoria **apenas leu** código e validou estrutura no MCP Supabase.

---

## 16. Revisão da arquitetura de webhook

### 16.1 Como o Digisac configura webhooks (confirmado na documentação oficial)

**Fonte:** https://digisac.gitbook.io/manual-digisac-2-0/menu-do-usuario/conta/token-e-webhook

O Digisac permite criar webhooks em: Menu do Usuário > Conta > API > Webhook > Criar Webhook.

Cada webhook tem:
- **Nome:** identificação
- **URL:** endereço que receberá os eventos
- **Tipo:** define o escopo
  - **Geral:** permite selecionar quais eventos da plataforma serão enviados (todas as conexões)
  - **Conexão:** envia apenas eventos relacionados à conexão selecionada
- **Eventos:** selecionados após escolher o tipo

**Pontos confirmados:**
1. O Digisac permite mais de um webhook recebendo os mesmos tipos de evento
2. O webhook pode ser configurado globalmente (Geral) ou por conexão (Conexão)
3. Os webhooks atuais podem receber todas as conexões (Geral) ou apenas conexões específicas (Conexão) — **não confirmado qual tipo está configurado para os webhooks atuais**
4. É possível adicionar uma nova URL sem interromper os webhooks existentes — cada webhook é independente
5. O mesmo evento pode ser enviado para mais de uma URL se múltiplos webhooks estiverem configurados para o mesmo evento/conexão
6. Isso pode gerar duplicidade de processamento — o novo fluxo precisa ter idempotência via `serviceId` + filtro no código
7. O payload informa `serviceId` no campo `data.serviceId` — confirmado no código de triagem (`triagem.ts` linha 69) e no webhook pós-venda
8. A configuração de webhooks é externa ao repositório — **não há arquivo de configuração no código**

### 16.2 PENDENTE DE VALIDAÇÃO

Os seguintes pontos dependem de configuração externa ao repositório e precisam ser verificados manualmente:

- **Qual é o tipo dos webhooks atuais** (Geral ou Conexão)? Verificar em: Digisac > Menu do Usuário > Conta > API > Webhook
- **Quais eventos cada webhook atual está configurado** para receber? (`message.created`? outros?)
- **Quantos webhooks estão ativos** atualmente?
- **As URLs cadastradas apontam para quais rotas** do app?
- **É possível criar um webhook do tipo Conexão para Hub/Vendas** e outro para as três lojas, ou um único webhook Geral capturando todas as conexões?

**Teste de validação necessário:**
1. Abrir a tela de webhooks no Digisac
2. Capturar a configuração atual (tipo, eventos, URLs)
3. Enviar uma mensagem de teste para a conexão Hub/Vendas
4. Observar qual webhook recebe o evento e qual payload chega
5. Confirmar que o campo `data.serviceId` identifica a conexão corretamente

### 16.3 Análise das opções

#### Opção A — Webhook separado

Criar uma rota dedicada `/api/digisac/webhook/hub-vendas` e configurar webhooks no Digisac para enviarem eventos das quatro conexões (Hub/Vendas + 3 lojas) para essa URL.

**Viabilidade:** Alta — o Digisac suporta múltiplos webhooks independentes.
**Isolamento:** Alto — o novo fluxo não afeta triagem nem pós-venda.
**Duplicidade:** Se o mesmo evento for enviado para dois webhooks, o código precisa filtrar por `serviceId` e usar idempotência. O custo é uma consulta leve ao banco para verificar se o lead já foi processado.
**Configuração necessária:** Criar 1 webhook Geral (todas as conexões) ou 4 webhooks do tipo Conexão (Hub/Vendas + Portão + Bigorrilho + Hauer).
**Risco para webhooks atuais:** Nenhum — webhooks são independentes.

#### Opção B — Distribuição no webhook atual

O webhook existente `/api/digisac/webhook` recebe o evento e chama internamente triagem antiga e/ou fluxo Hub/Vendas conforme `serviceId`.

**Viabilidade:** Média — exige modificar rota ativa em produção.
**Impacto em rota ativa:** A rota atual processa apenas triagem. Adicionar lógica do novo fluxo aumenta o tempo de resposta.
**Acoplamento:** Falha no novo fluxo pode afetar a triagem.
**Tempo de resposta:** Aumenta — o webhook precisa identificar qual fluxo processar antes de responder.
**Risco de falha compartilhada:** Alto — se o código novo lançar exceção não tratada, pode quebrar a triagem.
**Preservação do comportamento atual:** Requer cuidado extra para não alterar o fluxo de triagem.

#### Opção C — Outra arquitetura

Não identificada no código ou configuração atual.

### 16.4 Recomendação

**Opção A (webhook separado)** é a recomendada.

**Justificativa:**
- Isolamento total do fluxo novo dos fluxos existentes
- Sem risco para triagem ou pós-venda
- O Digisac suporta múltiplos webhooks nativamente
- O `serviceId` no payload permite identificar a conexão e direcionar o processamento
- Idempotência via unique constraint em `digisac_message_id` (padrão já usado no projeto)

**Configuração recomendada no Digisac:**
- Criar 1 webhook do tipo **Geral** com evento `message.created` apontando para `/api/digisac/webhook/hub-vendas`
- OU criar 4 webhooks do tipo **Conexão** (um por conexão) com evento `message.created`
- A escolha entre Geral e Conexão depende de quantas conexões existem no Digisac — se houver conexões irrelevantes (ex: pós-venda), usar Conexão para evitar receber eventos desnecessários

**PENDENTE DE VALIDAÇÃO:** Confirmar a configuração atual dos webhooks no Digisac antes de implementar.

---

## 17. Obtenção de contactId e ticketId

### 17.1 Função atual de envio

`enviarMensagemDigisac` exige `contactId` + `ticketId` + `texto`. No novo fluxo, o cliente pode nunca ter conversado com a conexão de recuperação.

### 17.2 Descoberta: API Digisac suporta envio por número

**Fonte:** Documentação Conexa Help Center (https://ajuda.conexa.app/pt/articles/11688458) e Postman Digisac Collection

A API do Digisac `/messages` (POST) suporta um payload alternativo:

```json
{
  "text": "Mensagem de abordagem",
  "number": "5541984148660",
  "serviceId": "ID_DA_CONEXAO",
  "origin": "bot",
  "dontOpenTicket": false
}
```

- `number`: telefone com DDI
- `serviceId`: ID da conexão remetente
- `dontOpenTicket`: se `false` (ou omitido), o Digisac cria/abre o ticket automaticamente
- `origin`: `"bot"` para mensagens automatizadas

**Isso significa que o novo fluxo pode enviar mensagens sem precisar localizar ou criar `contactId` e `ticketId` previamente.** O Digisac cuida disso internamente.

### 17.3 PENDENTE DE VALIDAÇÃO

Esta descoberta é baseada em documentação de terceiros (Conexa) e na coleção Postman do Digisac. **Não está confirmado no código do projeto nem na documentação oficial do Digisac.**

**Teste manual necessário na API do Digisac:**
1. Fazer POST para `/messages` com `number` + `serviceId` + `text` (sem `contactId` nem `ticketId`)
2. Confirmar se a mensagem é enviada pela conexão correta
3. Confirmar se o ticket é criado/aberto automaticamente
4. Capturar o `contactId` e `ticketId` retornados na resposta
5. Confirmar se o departamento padrão da conexão é aplicado ao ticket

### 17.4 Fluxo proposto para envio de recuperação

**Se a validação confirmar o envio por número:**

1. Processador seleciona item da fila com `telefone_normalizado_ddi` + `conexao_destino_id`
2. Chama `POST /messages` com `{ number, serviceId, text, origin: 'bot' }`
3. Captura `contactId` e `ticketId` da resposta
4. Persiste ambos na tabela de envios para auditoria
5. Não precisa criar contato nem ticket manualmente

**Se a validação NÃO confirmar o envio por número:**

1. Buscar contato por telefone na conexão de destino: `GET /contacts?where[data.number][$like]=%telefone%&where[serviceId]=conexaoId`
2. Se contato não existir: criar via `POST /contacts` com `{ name, number, serviceId }` — **endpoint não confirmado no código**
3. Buscar ticket aberto: `GET /tickets?where[contactId]=contactId&where[isOpen]=true`
4. Se ticket não existir: criar via `POST /tickets` ou usar `POST /schedule` com `openTicket: true` — **endpoint não confirmado no código**
5. Enviar mensagem via `enviarMensagemDigisac` com `contactId` + `ticketId`

### 17.5 Respostas às perguntas da revisão

1. **Como localizar o contato pelo telefone dentro de uma conexão específica?** O projeto usa `GET /tickets?query=...` com filtro `data.number.$like` em `sgi-sync.ts`. Para contatos (sem ticket), seria `GET /contacts?where[data.number][$like]=...` — **não confirmado no código**.
2. **O mesmo telefone possui contactId diferente por conexão?** **PENDENTE DE VALIDAÇÃO** — provavelmente sim, pois o Digisac organiza contatos por conexão.
3. **O contato existe automaticamente em todas as conexões?** **PENDENTE DE VALIDAÇÃO** — provavelmente não.
4. **Como obter ou criar um contato na conexão de recuperação?** **PENDENTE DE VALIDAÇÃO** — endpoint `POST /contacts` não usado no projeto.
5. **Como localizar um ticket aberto na conexão?** `GET /tickets?where[contactId]=...&where[isOpen]=true` — padrão usado em `finalizacoesAutomaticas.ts`.
6. **Como criar ou abrir um ticket quando ainda não existe?** **PENDENTE DE VALIDAÇÃO** — não há endpoint de criação de ticket no código.
7. **É possível enviar a primeira mensagem sem ticket existente?** **PENDENTE DE VALIDAÇÃO** — a descoberta do payload com `number` + `serviceId` sugere que sim.
8. **Qual endpoint já usado no projeto ajuda nesse processo?** `POST /messages` (envio), `GET /tickets?query=...` (busca por telefone), `GET /contacts/{id}` (busca por ID).
9. **Qual endpoint ainda precisa ser confirmado?** `POST /messages` com `number` + `serviceId` (sem `contactId`), `POST /contacts` (criação), `POST /tickets` (criação).
10. **Como garantir que o envio saia pela conexão correta?** O campo `serviceId` no payload do `/messages` define a conexão remetente.
11. **Qual departamento deve ser associado ao novo ticket?** O departamento padrão da conexão (`default_department_id` em `digisac_conexoes_automacao`).
12. **A conexão responsável precisa de usuário ou departamento definidos?** **PENDENTE DE VALIDAÇÃO** — o departamento padrão existe na tabela, mas o usuário não é necessário se `origin: 'bot'`.
13. **O contactId pode ser reaproveitado entre conexões?** **PENDENTE DE VALIDAÇÃO** — provavelmente não.
14. **Quais campos devem ser persistidos após localizar ou criar o contato/ticket?** `contactId`, `ticketId`, `conexao_destino_id`, `digisac_message_id` (retornado do envio).

### 17.6 Impacto no plano

- **Se o envio por número for validado:** a Fase 4 é significativamente mais simples — não precisa criar contato nem ticket, apenas enviar e registrar o resultado.
- **Se não for validado:** a Fase 4 exige endpoints adicionais (`POST /contacts`, `POST /tickets`) que não existem no código — **bloqueador técnico da Fase 4**.

---

## 18. Modelo de dados revisado

### 18.1 Análise crítica das 5 tabelas propostas originalmente

| Tabela original | Responsabilidade | Precisa existir separadamente? |
|---|---|---|
| `hub_vendas_leads` | Captura de entrada, ciclo, status, conversão | Sim — é o registro central do lead |
| `hub_vendas_recuperacao_fila` | Fila com horário programado, conexão, reserva | Sim — tem lifecycle diferente do lead |
| `hub_vendas_envios` | Log de envios, resultado, versão da mensagem | **Não** — merge com `hub_vendas_recuperacao_fila` |
| `hub_vendas_contadores_diarios` | Contador de envios por conexão/dia | **Não** — ver seção 18.3 |
| `hub_vendas_pausas` | Pausa geral e por conexão | **Não** — ver seção 18.4 |

### 18.2 Alternativa mínima (recomendada): 3 tabelas

#### Tabela 1: `hub_vendas_leads`

**Responsabilidade:** registro central do lead por ciclo.
**Fonte de verdade:** status do ciclo, conversão, loja principal.

| Campo | Tipo | Not null | Descrição |
|---|---|---|---|
| `id` | uuid PK | sim | |
| `telefone_normalizado_ddi` | text | sim | Chave principal (DDI + DDD + número) |
| `telefone_normalizado` | text | sim | Sem DDI (para busca) |
| `ciclo_numero` | integer | sim | Número sequencial do ciclo (1, 2, 3...) |
| `data_entrada_hub` | timestamptz | sim | Quando a saudação foi enviada no hub |
| `digisac_message_id_saudacao` | text | não | ID da mensagem de saudação no hub |
| `digisac_contact_id_hub` | text | não | ContactId na conexão hub |
| `digisac_ticket_id_hub` | text | não | TicketId na conexão hub |
| `status` | text | sim | Ver seção 19 |
| `loja_principal` | text | não | `portao` / `bigorrilho` / `hauer` |
| `lojas_chamadas` | text[] | não | Array de lojas chamadas |
| `chamou_mais_de_uma_loja` | boolean | não | default false |
| `data_conversao` | timestamptz | não | Quando chamou a primeira loja |
| `data_primeira_resposta_loja` | timestamptz | não | Primeira mensagem do cliente em loja |
| `conexao_recuperacao_id` | text | não | ServiceId da conexão que fez a abordagem |
| `data_recuperacao_enviada` | timestamptz | não | Quando a abordagem foi enviada |
| `data_recuperacao_respondida` | timestamptz | não | Quando o cliente respondeu à abordagem |
| `versao_mensagem_usada` | integer | não | Qual versão da mensagem foi enviada |
| `digisac_message_id_recuperacao` | text | não | ID da mensagem de abordagem |
| `digisac_contact_id_recuperacao` | text | não | ContactId na conexão de recuperação |
| `digisac_ticket_id_recuperacao` | text | não | TicketId na conexão de recuperação |
| `erro` | text | não | Erro relevante, se houver |
| `motivo_fila_manual` | text | não | Motivo de bloqueio/manual |
| `pausado` | boolean | não | default false |
| `created_at` | timestamptz | sim | default now() |
| `updated_at` | timestamptz | sim | default now() |

**Constraints:**
- Unique: `(telefone_normalizado_ddi, ciclo_numero)` — impede duplicidade de ciclo
- Check: `status` em valores válidos (ver seção 19)

**Indexes:**
- `idx_hvl_telefone_ddi` em `telefone_normalizado_ddi`
- `idx_hvl_status` em `status`
- `idx_hvl_data_entrada` em `data_entrada_hub`
- `idx_hvl_ciclo` em `(telefone_normalizado_ddi, ciclo_numero)`

**Retenção:** 90 dias após encerramento do ciclo. Crescimento estimado: ~50-100 leads/mês.

#### Tabela 2: `hub_vendas_recuperacao_fila`

**Responsabilidade:** fila de envios programados com reserva atômica + log de envio.
**Fonte de verdade:** status da fila, horário programado, reserva, resultado do envio.

| Campo | Tipo | Not null | Descrição |
|---|---|---|---|
| `id` | uuid PK | sim | |
| `lead_id` | uuid FK → `hub_vendas_leads` | sim | |
| `conexao_destino_id` | text | sim | ServiceId da conexão de recuperação |
| `conexao_destino_nome` | text | não | Nome da conexão (denormalização para UI) |
| `status` | text | sim | `agendado` / `reservado` / `enviado` / `erro` / `cancelado` |
| `programado_para` | timestamptz | sim | Horário programado de envio |
| `reservado_em` | timestamptz | não | Quando foi reservado pelo processador |
| `reservado_por` | text | não | ID da execução que reservou |
| `enviado_em` | timestamptz | não | Quando foi efetivamente enviado |
| `resultado` | text | não | `ok` / `erro` |
| `erro` | text | não | Mensagem de erro |
| `versao_mensagem` | integer | não | Versão da mensagem usada |
| `digisac_message_id` | text | não | ID da mensagem no Digisac |
| `digisac_contact_id` | text | não | ContactId retornado pelo Digisac |
| `digisac_ticket_id` | text | não | TicketId retornado pelo Digisac |
| `created_at` | timestamptz | sim | default now() |
| `updated_at` | timestamptz | sim | default now() |

**Constraints:**
- Unique: `lead_id` — **apenas 1 item de fila por lead** (impede mais de 1 tentativa por ciclo)
- FK: `lead_id` → `hub_vendas_leads(id)`

**Indexes:**
- `idx_hvf_status_programado` em `(status, programado_para)` — processador busca `WHERE status = 'agendado' AND programado_para <= now()`
- `idx_hvf_reservado_em` em `reservado_em` — recuperar reservas expiradas
- `idx_hvf_conexao_data` em `(conexao_destino_id, enviado_em)` — contagem diária por conexão

**Retenção:** 90 dias após `enviado_em`. Crescimento estimado: ~30-60 itens/mês.

**Nota:** Os campos `versao_mensagem`, `digisac_message_id`, `digisac_contact_id`, `digisac_ticket_id` foram movidos da tabela `hub_vendas_envios` original para cá, eliminando a necessidade de uma tabela separada de envios. O registro de fila já é o registro de envio.

#### Tabela 3: `hub_vendas_config`

**Responsabilidade:** configurações operacionais e estado de pausas.
**Fonte de verdade:** pausas, limites, versões de mensagem.

| Campo | Tipo | Not null | Descrição |
|---|---|---|---|
| `id` | uuid PK | sim | |
| `chave` | text unique | sim | Ex: `pausa_geral`, `pausa_conexao_portao`, `versoes_mensagens` |
| `valor` | jsonb | sim | Estrutura flexível por chave |
| `criado_por` | text | não | Email do usuário que alterou |
| `created_at` | timestamptz | sim | default now() |
| `updated_at` | timestamptz | sim | default now() |

**Chaves esperadas:**
- `pausa_geral`: `{ ativo: false, motivo: null, pausado_por: null, pausado_em: null }`
- `pausa_conexao_{serviceId}`: `{ ativo: false, motivo: null, erros_consecutivos: 0, pausado_em: null }`
- `versoes_mensagens`: `{ versoes: [{ id: 1, texto: "...", ativa: true }], proxima_versao: 2 }`

**Retenção:** permanente (configuração). Crescimento: insignificante.

### 18.3 Contador diário — recomendação: NÃO criar tabela separada

| Critério | Contagem por consulta | Contador persistido |
|---|---|---|
| Risco de concorrência | Nenhum — read-only | Alto — precisa incrementar atomicamente |
| Consistência | Sempre correta | Pode divergir se update falhar |
| Complexidade | Baixa — `SELECT count(*) WHERE conexao_id = X AND date(enviado_em) = today` | Alta — tabela extra, update atômico, recuperação |
| Custo | 1 query indexada por execução do processador | Tabela extra + update por envio |
| Auditoria | Fonte de verdade = `hub_vendas_recuperacao_fila` | Duplica informação |

**Recomendação:** **Contagem por consulta.** Contar envios do dia em `hub_vendas_recuperacao_fila` com índice `idx_hvf_conexao_data` em `(conexao_destino_id, enviado_em)`.

Query: `SELECT count(*) FROM hub_vendas_recuperacao_fila WHERE conexao_destino_id = $1 AND status = 'enviado' AND enviado_em::date = current_date`

Elimina a tabela `hub_vendas_contadores_diarios`.

### 18.4 Pausas — recomendação: tabela de configuração única

| Opção | Prós | Contras |
|---|---|---|
| Campos em `digisac_conexoes_automacao` | Reutiliza tabela existente | Mistura configuração de automação geral com Hub/Vendas; pode quebrar outros fluxos |
| Tabela genérica de configurações | Flexível, simples | Estrutura jsonb menos tipada |
| Tabela específica do Hub/Vendas | Tipada para o domínio | Tabela extra para poucos campos |
| Separar estado atual de histórico | Auditoria completa | Mais tabelas, mais complexidade |

**Recomendação:** **Tabela `hub_vendas_config` (jsonb key-value).** Não altera `digisac_conexoes_automacao`.

Para histórico de alterações de pausa, usar `auditoria_acessos` (tabela existente) com `acao = 'hub_vendas_pausa_alterada'` e `metadata` com detalhes.

### 18.5 Alternativa separada (não recomendada)

Manter 5 tabelas como proposto originalmente. Benefício: separação máxima de responsabilidades. Custo: mais tabelas, mais complexidade, mais manutenção, mais egress.

### 18.6 Estimativa de crescimento

| Tabela | Estimativa/mês | Volume em 12 meses | Tamanho por linha |
|---|---|---|---|
| `hub_vendas_leads` | 50-100 | 600-1200 | ~500 bytes |
| `hub_vendas_recuperacao_fila` | 30-60 | 360-720 | ~400 bytes |
| `hub_vendas_config` | ~0 (config) | ~10 linhas | ~1KB |

**Total estimado em 12 meses:** < 1MB — insignificante para o plano gratuito do Supabase (500MB).

### 18.7 RLS

Todas as tabelas com RLS habilitado. Acesso apenas para usuários autenticados com módulo `hub_vendas_recuperacao`. Service role para webhooks e crons.

---

## 19. Fonte de verdade dos estados

### 19.1 Estados do ciclo do lead

**Fonte de verdade:** `hub_vendas_leads.status`

```
aguardando_conversao
  ├─→ convertido_organicamente (cliente chamou loja dentro de 24h)
  ├─→ recuperacao_pendente (24h passou, não chamou)
  │     └─→ recuperacao_agendada (cron preparou fila)
  │           └─→ recuperacao_processando (processador reservou)
  │                 ├─→ recuperacao_enviada (mensagem enviada)
  │                 │     ├─→ recuperacao_respondida (cliente respondeu)
  │                 │     └─→ (terminal após 48h sem resposta)
  │                 └─→ erro_recuperacao (falha no envio)
  ├─→ aguardando_limite_diario (excedeu limite, próximo dia)
  │     └─→ recuperacao_pendente ou fila_manual (após 48h)
  ├─→ fila_manual (após 48h sem conversão e sem envio)
  └─→ pausado (automação pausada)
        └─→ (retorna ao estado anterior quando despausado)
```

### 19.2 Estados da fila

**Fonte de verdade:** `hub_vendas_recuperacao_fila.status`

```
agendado
  ├─→ reservado (processador reservou atomicamente)
  │     ├─→ enviado (envio confirmado)
  │     └─→ erro (falha no envio)
  └─→ cancelado (lead converteu antes do envio, ou pausa)
```

### 19.3 Regras de transição

| Transição | Evento | Condições | Reversível? |
|---|---|---|---|
| → `aguardando_conversao` | Saudação enviada no hub | `isFromMe=true` + conexão hub + texto contém wa.me | Não |
| → `convertido_organicamente` | Mensagem do cliente em loja | `!isFromMe` + conexão loja + dentro de 24h | Não |
| → `recuperacao_pendente` | Passou 24h sem conversão | Cron da manhã | Não |
| → `recuperacao_agendada` | Cron preparou fila | Sem conversão + <48h + sem abordagem no ciclo | Não |
| → `recuperacao_processando` | Processador reservou item | `programado_para <= now()` + horário permitido | Sim (timeout) |
| → `recuperacao_enviada` | Envio confirmado | API Digisac retornou ok | Não |
| → `recuperacao_respondida` | Cliente respondeu à abordagem | `!isFromMe` + conexão de recuperação | Não |
| → `erro_recuperacao` | Falha no envio | API Digisac retornou erro | Sim (retry manual) |
| → `fila_manual` | Passou 48h sem envio | Cron da manhã | Não |
| → `pausado` | Pausa ativada | Manual ou erros consecutivos | Sim |

### 19.4 Tratamento de eventos problemáticos

**Evento atrasado:** Webhook de conversão chega depois do cron já ter agendado recuperação. O webhook marca `convertido_organicamente` e o cron cancela o item da fila na próxima reconciliação.

**Webhook duplicado:** Idempotência via unique constraint em `digisac_message_id` (padrão existente no projeto). Se a mesma mensagem chegar duas vezes, a segunda é ignorada.

**Reconciliação que contradiz webhook:** Se a reconciliação do cron encontrar conversão que o webhook não capturou, marca `convertido_organicamente` e cancela a fila. A reconciliação é fonte de verdade secundária — prevalece sobre a ausência de webhook.

### 19.5 Garantias do fluxo

- **Duas abordagens no mesmo ciclo:** impedida por unique constraint `(telefone_normalizado_ddi, ciclo_numero)` em `hub_vendas_leads` + unique `lead_id` em `hub_vendas_recuperacao_fila`
- **Duas conexões assumirem o mesmo lead:** impedida por unique `lead_id` na fila + reserva atômica
- **Envio depois da conversão:** validação final antes do envio verifica se `status != 'convertido_organicamente'`
- **Perda do lead em caso de falha:** item da fila com `status = 'erro'` permanece na tabela para retry manual
- **Permanência automática depois de 48h:** cron da manhã move para `fila_manual`

---

## 20. Locks e reserva atômica

### 20.1 Mecanismo proposto

O processador periódico precisa reservar um item da fila atomicamente para impedir que duas execuções enviem o mesmo lead.

### 20.2 Operação de reserva

```sql
UPDATE hub_vendas_recuperacao_fila
SET status = 'reservado',
    reservado_em = now(),
    reservado_por = $1,
    updated_at = now()
WHERE id = (
  SELECT id FROM hub_vendas_recuperacao_fila
  WHERE status = 'agendado'
    AND programado_para <= now()
    AND reservado_em IS NULL
  ORDER BY programado_para ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED
)
RETURNING *;
```

- `FOR UPDATE SKIP LOCKED`: se outra execução já está selecionando, esta pula o item bloqueado
- `WHERE status = 'agendado' AND reservado_em IS NULL`: apenas itens não reservados
- `LIMIT 1`: um item por execução

### 20.3 Liberação após erro

```sql
UPDATE hub_vendas_recuperacao_fila
SET status = 'erro', erro = $1, updated_at = now()
WHERE id = $2;
```

O item fica com `status = 'erro'` — não volta para `agendado` automaticamente. Retry é manual.

### 20.4 Recuperação de reserva expirada

```sql
UPDATE hub_vendas_recuperacao_fila
SET status = 'agendado', reservado_em = NULL, reservado_por = NULL, updated_at = now()
WHERE status = 'reservado'
  AND reservado_em < now() - interval '10 minutes';
```

- **Tempo de expiração da reserva:** 10 minutos — suficiente para 1 envio + registro + validação
- Executada pelo cron da manhã ou pelo processador no início de cada execução

### 20.5 Impedir dois envios

A combinação de:
1. `FOR UPDATE SKIP LOCKED` na seleção
2. `UPDATE ... SET status = 'reservado'` atômico
3. Unique constraint em `lead_id` (apenas 1 item de fila por lead)
4. Validação final antes do envio (verifica `status = 'reservado' AND reservado_por = $1`)

### 20.6 RPC opcional

Para reforçar a segurança, pode-se criar uma RPC `reservar_item_fila(execucao_id text)` que encapsula a operação acima. **Não necessário na Fase 1** — o SQL direto com `FOR UPDATE SKIP LOCKED` é suficiente.

---

## 21. Infraestrutura do processador periódico

### 21.1 Opções avaliadas

#### Opção 1 — VPS / EasyPanel

**Frequência possível:** a cada 1 minuto (cron do Linux)
**Custo:** já existe no contexto do projeto (EasyPanel mencionado em outros planos)
**Risco:** baixo — cron do Linux é estável
**Manutenção:** baixa — uma linha no crontab
**Impacto na Vercel:** nenhum — chamada HTTP autenticada para a rota
**Impacto no Supabase:** nenhum — a rota faz as queries
**Autenticação:** `Authorization: Bearer $CRON_SECRET`
**Comportamento em caso de falha:** cron tenta novamente no próximo intervalo; item reservado expira em 10 min

#### Opção 2 — GitHub Actions

**Frequência possível:** mínimo 5 minutos (na prática 10-15 min com atrasos)
**Custo:** gratuito até 2000 min/mês
**Risco:** médio — atrasos de até 15 min; não é tempo real
**Manutenção:** média — workflow YAML, secrets no GitHub
**Impacto na Vercel:** nenhum
**Impacto no Supabase:** nenhum
**Autenticação:** secret no GitHub Actions → header Authorization
**Comportamento em caso de falha:** retry automático do GitHub Actions; item reservado expira

#### Opção 3 — Serviço externo de cron

**Frequência possível:** 1-5 minutos (plano gratuito: geralmente 5 min)
**Custo:** gratuito (cron-job.org, EasyCron) ou ~$5/mês
**Risco:** baixo-médio — depende do serviço
**Manutenção:** baixa
**Impacto na Vercel/Supabase:** nenhum
**Autenticação:** header configurado no serviço
**Comportamento em caso de falha:** retry no próximo intervalo

#### Opção 4 — Supabase pg_cron

**Disponibilidade:** `pg_cron` está disponível como extensão (versão 1.6.4) mas **não está instalado** (`installed_version: null`). Pode ser habilitado.
**Frequência possível:** 1 minuto
**Custo:** nenhum adicional
**Risco:** médio — executa dentro do Postgres; se a chamada HTTP para a rota demorar, pode consumir conexões do pool
**Manutenção:** média — precisa instalar extensão, configurar job, gerenciar `pg_net` para HTTP
**Impacto na Vercel:** nenhum
**Impacto no Supabase:** consome conexão do pool durante a chamada HTTP; precisa de `pg_net` (também não instalado)
**Autenticação:** incluir `CRON_SECRET` no header da chamada HTTP via `pg_net`
**Comportamento em caso de falha:** pg_cron registra erro e tenta no próximo schedule
**Limitação:** **não confirmado se pg_cron e pg_net podem ser instalados no plano gratuito do Supabase**

#### Opção 5 — Outra infraestrutura já usada no projeto

**Não identificada.** O projeto usa Vercel para o app e Supabase para banco. Não há VPS, worker ou processo persistente confirmado no repositório. O EasyPanel é mencionado em documentação mas **não confirmado como infraestrutura ativa**.

### 21.2 Recomendação

**Recomendação principal:** Opção 1 (VPS / EasyPanel) — se já existir VPS ativa no projeto.

**Fallback:** Opção 3 (serviço externo de cron) — se não houver VPS, usar cron-job.org (gratuito, 5 min de frequência).

**Não recomendado:** Opção 4 (pg_cron) — adiciona complexidade ao banco e consome conexões do pool. Opção 2 (GitHub Actions) — atrasos de até 15 min podem comprometer o intervalo entre envios.

**PENDENTE DE VALIDAÇÃO:** Confirmar se o projeto possui VPS/EasyPanel ativa antes de decidir.

---

## 22. Frequência do processador

### 22.1 Cálculo

O intervalo entre envios é de 180-300 segundos por conexão. O processador não recalcula o intervalo — apenas executa itens cujo `programado_para <= now()`.

**Cenário máximo:** 3 conexões × 15 envios/dia = 45 envios/dia. Distribuídos em 9 horas (09:00-18:00) = 32400 segundos. 45 envios em 32400 segundos = 1 envio a cada ~720 segundos em média. Mas o intervalo é por conexão, não global.

**Por conexão:** 15 envios em 32400 segundos = 1 envio a cada ~2160 segundos (36 min) em média. Mas o intervalo é aleatório entre 180-300s, então o próximo envio pode ser programado para apenas 3-5 minutos após o anterior.

### 22.2 Frequências avaliadas

| Frequência | Atraso máximo | Chamadas/dia (9h) | Adequação |
|---|---|---|---|
| 1 minuto | 59s | 540 | Excelente — mas pode ser excessivo |
| 2 minutos | 119s | 270 | Excelente |
| 3 minutos | 179s | 180 | Muito boa — alinhado com o intervalo mínimo de 180s |
| 5 minutos | 299s | 108 | Boa — alinhado com o intervalo máximo de 300s |

### 22.3 Recomendação

**Frequência: a cada 2 minutos.**

**Justificativa:**
- Atraso máximo de 119s — bem dentro do intervalo mínimo de 180s entre envios
- 270 chamadas/dia — cada chamada é leve (1 query de reserva + validação + 1 envio se houver item)
- Se não houver item vencido, a rota responde em <100ms (1 query count)
- Preserva o intervalo individual por conexão — o processador não recalcula, apenas executa
- Pode processar mais de um item vencido por execução se houver múltiplas conexões com itens prontos

### 22.4 Processamento por execução

Cada execução do processador:
1. Recupera reservas expiradas (10 min)
2. Para cada conexão ativa e despausada:
   a. Verifica se há item vencido (`status = 'agendado' AND programado_para <= now()`)
   b. Verifica limite diário (count no dia)
   c. Verifica horário permitido (09:00-18:00 BRT, seg-sáb)
   d. Reserva atomicamente
   e. Validação final (seção 26 do mapa)
   f. Envia mensagem
   g. Registra resultado
3. Se não houver item vencido, responde 200 vazio

---

## 23. Configurações e env vars revisadas

### 23.1 Análise: env vars vs constantes vs tabela de configuração

| Configuração | Onde deve ficar | Por quê |
|---|---|---|
| `DIGISAC_HUB_VENDAS_WEBHOOK_SECRET` | **Env var** | Segredo — não deve estar no código nem no banco |
| Ciclo de 14 dias | **Constante de domínio** | Regra de negócio fixa, não precisa ser ajustável pela tela |
| Janela de conversão de 24h | **Constante de domínio** | Regra de negócio fixa |
| Elegibilidade de 48h | **Constante de domínio** | Regra de negócio fixa |
| Limite de 15 envios/dia | **`hub_vendas_config`** | Pode precisar ajuste pela tela sem deploy |
| Intervalo 180-300s | **`hub_vendas_config`** | Pode precisar ajuste pela tela sem deploy |
| Horário 09-18h | **`hub_vendas_config`** | Pode precisar ajuste sazonal sem deploy |
| Versões de mensagem | **`hub_vendas_config`** | Aprovação manual, ajuste frequente |

### 23.2 Env vars necessárias (revisadas)

| Env var | Purpose |
|---|---|
| `DIGISAC_HUB_VENDAS_WEBHOOK_SECRET` | Secret do novo webhook (obrigatório) |

Apenas **1 nova env var**. As demais regras ficam como constantes de domínio ou em `hub_vendas_config`.

### 23.3 Constantes de domínio (no código)

```typescript
const CICLO_DIAS = 14;
const JANELA_CONVERSAO_HORAS = 24;
const ELEGIBILIDADE_HORAS = 48;
```

### 23.4 Configurações ajustáveis pela tela (em `hub_vendas_config`)

- `limite_diario_por_conexao`: default 15
- `intervalo_min_seg`: default 180
- `intervalo_max_seg`: default 300
- `horario_inicio`: default 9
- `horario_fim`: default 18
- `versoes_mensagens`: array de versões aprovadas

---

## 24. Bloqueios por fase

### Fase 1 — Banco

**Pode iniciar somente após:**
- Modelo de dados aprovado (3 tabelas vs 5 tabelas)
- Fonte de verdade dos estados definida (seção 19)
- Estratégia de contador definida (contagem por consulta)
- Estratégia de pausas definida (tabela de configuração)
- Conexão Hub/Vendas cadastrada em `digisac_conexoes_automacao` (decisão do usuário)

### Fase 2 — Webhook

**Pode iniciar somente após:**
- Arquitetura de webhook confirmada (Opção A aprovada)
- Configuração atual dos webhooks no Digisac validada (PENDENTE DE VALIDAÇÃO)
- Payload real validado com teste manual
- Conexões confirmadas (serviceIds)
- ID de mensagem confirmado no payload

### Fase 3 — Cron preparação

**Pode iniciar somente após:**
- Fase 1 concluída
- Fase 2 concluída ou em paralelo (compartilha tabelas)
- Versões de mensagem aprovadas (pelo menos 1 para testar)

### Fase 4 — Processador de envios

**Pode iniciar somente após:**
- Operação para localizar/criar contato e ticket confirmada (envio por `number` + `serviceId` validado — PENDENTE DE VALIDAÇÃO)
- Conexão remetente confirmada
- Infraestrutura do processador aprovada (VPS vs serviço externo)
- Versões de mensagem aprovadas
- Fase 3 concluída (fila preparada)

### Fase 5 — Tela

**Pode iniciar somente após:**
- Fase 1 concluída (tabelas existem)
- Fase 2 e 3 parcialmente funcionais (dados para exibir)
- Módulo `hub_vendas_recuperacao` cadastrado em `app_modulos`

### Fase 6 — Mensagens

**Pode iniciar a qualquer momento** (independente de implementação técnica)
- Criar 5+ versões de mensagem
- Aprovação manual do usuário
- Registrar em `hub_vendas_config` quando Fase 1 estiver pronta

---

## 25. Decisões pendentes do usuário

1. **Modelo de dados:** aprovar 3 tabelas (recomendado) ou 5 tabelas (original)?
2. **Arquitetura de webhook:** aprovar Opção A (webhook separado)?
3. **Configuração do Digisac:** validar a configuração atual de webhooks (tipo, eventos, URLs) — **PENDENTE DE VALIDAÇÃO MANUAL**
4. **Envio por número:** validar se `POST /messages` com `number` + `serviceId` funciona sem `contactId`/`ticketId` — **PENDENTE DE VALIDAÇÃO MANUAL**
5. **Infraestrutura do processador:** confirmar se o projeto possui VPS/EasyPanel ativa, ou aprovar serviço externo de cron
6. **Cadastro da conexão Hub/Vendas:** cadastrar `4af28025-c210-4336-a560-785d2fb8a778` em `digisac_conexoes_automacao`
7. **Versões de mensagem:** criar e aprovar 5+ versões de mensagem de abordagem
8. **Frequência do processador:** aprovar 2 minutos (recomendado) ou outra frequência?
9. **Regras como constantes vs config:** aprovar que ciclo/janela/elegibilidade ficam como constantes de domínio e limite/intervalo/horário ficam em `hub_vendas_config`?

---

# Parte III — Consolidação Final e Plano de Implementação

> **Esta Parte III substitui e consolida todas as seções anteriores (16-25) com base nas confirmações do usuário em 2026-07-17.**
> Itens anteriormente marcados como "PENDENTE DE VALIDAÇÃO" e agora confirmados são marcados como **CONFIRMADO**.
> Itens ainda não confirmados continuam marcados como **PENDENTE**.

---

## 26. Entendimento final do fluxo

O número Vendas funciona como Hub de entrada. O cliente chama a conexão Vendas, recebe uma saudação com links wa.me para as três lojas (Portão, Bigorrilho, Hauer/Marechal), e deve clicar e iniciar conversa com uma delas.

O sistema mede:
- quantos leads entram pelo Hub
- quantos chamam cada loja
- qual loja foi chamada primeiro
- se o cliente chamou mais de uma loja
- recupera automaticamente quem não chamou nenhuma loja dentro de 24h
- envia no máximo 1 abordagem automática por ciclo (14 dias)
- respeita limite de 15 envios/dia por conexão
- opera seg-sáb 09h-18h America/Sao_Paulo
- usa rodízio Portão → Bigorrilho → Hauer
- intervalo aleatório 180-300s entre envios por conexão
- pausas geral, por conexão e automática por erros consecutivos

---

## 27. Descobertas técnicas confirmadas

### 27.1 Webhook — CONFIRMADO

- **URL:** `https://lebebe.cloud/api/digisac/webhook`
- **Tipo:** por conexão
- **Conexões selecionadas:** Vendas, Bigorrilho, Portão, Marechal/Hauer
- **Evento:** Mensagens → Ao criar (`message.created`)
- **Não é necessário:** criar nova rota, criar quatro webhooks, ou receber o mesmo evento em mais de uma rota
- **Rota existente** `src/app/api/digisac/webhook/route.ts` deve ser reutilizada com distribuição interna

### 27.2 Payload — CONFIRMADO

```json
{
  "event": "message.created",
  "data": {
    "id": "71995070-5cf1-4aae-ad68-c00825f4fb80",
    "isFromMe": false,
    "sent": true,
    "type": "chat",
    "timestamp": "2026-03-10T13:36:50.897Z",
    "visible": true,
    "contactId": "ae239215-16e8-4b85-bdbf-8da490b51c7a",
    "serviceId": "ece0fdac-962e-491c-b47f-fa912b17a878",
    "ticketId": "5268e3a0-3512-408f-89ed-50ba589045b9",
    "ticketDepartmentId": "aa030182-fbee-4a8e-ae0b-9869b2d1956e",
    "text": "1",
    "isComment": false,
    "isFromBot": false
  }
}
```

- `data.id` = idempotência
- `serviceId` = identifica conexão
- `isFromMe = true` = mensagem enviada pela empresa
- `isFromMe = false` = mensagem do cliente
- **Telefone NÃO vem no webhook** — deve ser obtido via `contactId` somente em eventos relevantes
- Payload recebido é o corpo Digisac direto (não envelope n8n)

### 27.3 Conexões — CONFIRMADO

| Conexão | serviceId | my_number |
|---|---|---|
| Hub/Vendas | `4af28025-c210-4336-a560-785d2fb8a778` | **não confirmado** |
| Bigorrilho | `0973f84b-8294-4615-9657-ba95b6346246` | `554188043042` |
| Marechal/Hauer | `1352c41b-80a9-4e74-b9d9-4c5e7aed060e` | `554192220492` |
| Portão | `c60d720f-5ad5-4a1b-bedb-e51495dee686` | `554184426528` |

- Hauer e Marechal = mesma conexão
- Conexão Vendas **não está cadastrada** em `digisac_conexoes_automacao` (validado no MCP)
- As 3 lojas estão cadastradas com `default_department_id` apontando para os departamentos antigos (triagem)
- **Necessário cadastrar Vendas** ou reconhecê-la formalmente no novo fluxo

### 27.4 Departamentos de resgate — CONFIRMADO pelo usuário

| Loja | Department ID (resgate) | Department ID antigo (triagem) |
|---|---|---|
| Marechal/Hauer | `8c90dba0-a855-49ae-bed4-f133f8509df9` | `4136bb72-5bc2-43bb-bf5a-bfc820a80bd1` |
| Portão | `7b524eab-a7c4-48d2-b249-3a5027e43728` | `37f6f05c-bab3-49fe-bac1-d57038daa5e0` |
| Bigorrilho | `d89b13ba-560b-4e39-9a23-26d62caa9e15` | `4de92f03-ff0a-49c3-b167-07603ae01569` |

**Os department IDs de resgate são DIFERENTES dos department IDs de triagem.** Isso é intencional — o fluxo de resgate direciona para departamentos específicos de recuperação, não para os departamentos de triagem antigos.

**Validado no código:** `departamentosFixos.ts` contém apenas os IDs antigos. Os novos IDs de resgate não existem em nenhum arquivo do projeto.

### 27.5 Criação de contato — CONFIRMADO

**Endpoint:** `POST /api/v1/contacts`

```json
{
  "internalName": "TESTE",
  "alternativeName": "",
  "name": "",
  "number": "5541996428707",
  "person": null,
  "personId": null,
  "email": "",
  "origin": "web",
  "serviceId": "ID_DA_CONEXAO",
  "defaultDepartment": null,
  "defaultDepartmentId": null,
  "defaultUser": null,
  "defaultUserId": null,
  "contactLists": [],
  "tagIds": [],
  "tags": [],
  "unsubscribed": false
}
```

**Retorno confirma:** `id` (contactId), `serviceId`, `data.number`, `currentTicketId`, `defaultDepartmentId`, `defaultUserId`.

### 27.6 Abertura de chamado — CONFIRMADO

**Endpoint:** `POST /api/v1/contacts/{contactId}/ticket/transfer`

```json
{
  "departmentId": "ID_DO_DEPARTAMENTO_RESGATE",
  "userId": null,
  "comments": "CHAMADA AUTOMATICA - RESGATE",
  "byUserId": "ID_DO_USUARIO_AUTOMATIZADOR"
}
```

- `userId = null` — não atribuir a consultora
- `comments` = sempre `"CHAMADA AUTOMATICA - RESGATE"`
- `byUserId` = usuário técnico — usar env var `DIGISAC_BOT_USER_ID` (já existe no projeto)
- **Não espalhar `byUserId` pelo código** — centralizar em `constantes.ts`

### 27.7 Envio de mensagem — CONFIRMADO

**Endpoint:** `POST /api/v1/messages`

```json
{
  "text": "TEXTO_DA_ABORDAGEM",
  "type": "chat",
  "contactId": "ID_DO_CONTATO",
  "editMessage": null,
  "isComment": false,
  "subject": "Sem Assunto"
}
```

**Retorno confirma:** `id` (messageId), `isFromMe`, `sent`, `contactId`, `serviceId`, `ticketId`, `ticketUserId`, `ticketDepartmentId`, objeto `ticket`, `firstMessageId`, `lastMessageId`, `protocol`, `startedAt`.

**Descoberta crítica:** o envio funciona apenas com `contactId` (sem `ticketId` no payload) **depois** do `ticket/transfer`. A função existente `enviarMensagemDigisac` exige `contactId` + `ticketId` — **não deve ser alterada** (usada por outros módulos). Criar nova função específica para o resgate.

### 27.8 Normalização de telefone — VALIDADO

Duas implementações existentes:

| Função | Arquivo | Comportamento |
|---|---|---|
| `normalizarTelefone` | `src/lib/digisac/sgi-sync.ts:697` | Remove não-dígitos, remove `55` do início |
| `normalizarTelefoneDDI` | `src/lib/digisac/sgi-sync.ts:701` | Remove não-dígitos, mantém/adiciona `55` no início |
| `gerarVariacoesTelefone` | `src/lib/digisac/sgi-sync.ts:111` | Gera 4 variações com/sem 9º dígito, com/sem DDI |
| `normalizarTelefone` | `src/lib/atendimento-presencial/telefone.ts:14` | Validação completa, retorna objeto com `telefoneNormalizado`, `telefoneNormalizadoDDI`, `valido`, `motivoInvalido` |

**Decisão:** reutilizar `normalizarTelefoneDDI` de `sgi-sync.ts` como chave persistida (formato `55XXXXXXXXXXX`). Reutilizar `gerarVariacoesTelefone` para busca de conversão. Reutilizar `mascararTelefoneParaLog` de `telefone.ts` para logs.

**Formato persistido:** `telefone_normalizado_ddi` = apenas dígitos com DDI 55 (ex: `5541984148660`).

### 27.9 Infraestrutura — CONFIRMADO

- **Ambos os crons rodam na VPS Hostinger** (não Vercel)
- **Cron de preparação:** VPS, a cada 10 minutos, seg-sáb 09:00-17:59, chama rota HTTP protegida
- **Cron de processamento:** VPS, a cada 2 minutos, seg-sáb 09:00-17:59, chama rota HTTP protegida
- **VPS confirmada:** Ubuntu 24.04.3 LTS, timezone `America/Sao_Paulo`, NTP sincronizado, cron ativo, curl instalado, Docker/EasyPanel ativos, 76 GB disponíveis
- **Padrão da VPS:** projetos em `/opt/devweb/workspace/`, scripts em `scripts/`, logs em `logs/`, cron no host
- **Secret:** arquivo `/opt/devweb/workspace/hub_vendas/config/hub_vendas.env` com permissão 600, nunca no crontab
- **Proteção contra sobreposição:** `flock` nos scripts da VPS (proteção adicional — idempotência real fica no app)
- **Validação de horário:** dupla — crontab (`9-17`) + validação interna nas rotas (timezone America/Sao_Paulo, seg-sáb, >= 09:00, < 18:00)
- **Sem Vercel cron:** `vercel.json` não precisa ser alterado para Hub/Vendas
- **Fallback da VPS:** se VPS ficar indisponível, itens reservados expiram em 10 min e são reprocessados no próximo ciclo. Sem perda de dados — fila é persistida no Supabase

---

## 28. Regras de negócio fechadas

| Regra | Valor | Status |
|---|---|---|
| Chave principal | telefone normalizado com DDI | Fechada |
| Ciclo | 14 dias | Fechada |
| Janela de conversão | 24h após entrada no hub | Fechada |
| Elegibilidade automática | até 48h após entrada | Fechada |
| Após 48h | fila manual | Fechada |
| Tentativas por ciclo | 1 | Fechada |
| Limite diário | 15 por conexão | Fechada |
| Horário | seg-sáb 09h-18h America/Sao_Paulo | Fechada |
| Intervalo | 180-300s aleatório por conexão | Fechada |
| Rodízio | Portão → Bigorrilho → Hauer | Fechada |
| Hauer/Marechal | mesma conexão | Fechada |
| Chamado aberto | cancela recuperação | Fechada |
| Saudação | identifica entrada no hub | Fechada |
| comments do transfer | "CHAMADA AUTOMATICA - RESGATE" | Fechada |
| userId no transfer | null | Fechada |
| byUserId | env var centralizada | Fechada |
| Versões de mensagem | mínimo 5, aprovação manual | Fechada |
| Pausa geral | obrigatória | Fechada |
| Pausa por conexão | obrigatória | Fechada |
| Pausa automática | por erros consecutivos | Fechada |

---

## 29. Arquitetura final do webhook

### 29.1 Decisão — CONFIRMADO

**Reutilizar a rota existente** `src/app/api/digisac/webhook/route.ts` com distribuição interna.

**Justificativa:**
- O Digisac envia todos os eventos das 4 conexões para a mesma URL
- A rota atual já valida `DIGISAC_WEBHOOK_SECRET`
- A distribuição interna permite preservar a triagem antiga e adicionar o novo fluxo

### 29.2 Distribuição interna

```typescript
// Pseudocódigo do webhook route.ts modificado
const rawPayload = await request.json();
const serviceId = rawPayload?.data?.serviceId;

// 1. Fluxo antigo de triagem (preservar integralmente)
if (serviceId === process.env.DIGISAC_SERVICE_ID_VENDAS && !rawPayload?.data?.isFromMe) {
  await processarTriagemLojaDigisac(rawPayload); // fluxo existente
}

// 2. Novo fluxo Hub/Vendas (sempre que serviceId for uma das 4 conexões)
await processarWebhookHubVendas(rawPayload); // novo fluxo
```

**Regras de preservação:**
- O fluxo de triagem só executa para `serviceId === DIGISAC_SERVICE_ID_VENDAS` e `isFromMe === false`
- O novo fluxo executa para qualquer um dos 4 serviceIds relevantes
- Ambos podem executar no mesmo evento (ex: mensagem do cliente no hub → triagem tenta detectar loja por texto, hub-vendas registra entrada)
- A triagem não deve ser alterada — apenas o webhook route.ts adiciona a chamada ao novo fluxo
- Se o novo fluxo falhar, a triagem não é afetada (try/catch isolado)

### 29.3 Segurança do webhook

- `DIGISAC_WEBHOOK_SECRET` validado via header `x-digisac-secret` ou query param `secret` (padrão existente)
- Allowlist dos 4 serviceIds — rejeitar eventos de conexões não monitoradas
- Validação de schema: `event`, `data.id`, `data.serviceId` obrigatórios
- Idempotência via `data.id` (unique constraint)
- Rate limit: **avaliar** — o webhook já é chamado apenas pelo Digisac
- Retorno sempre HTTP 200 (padrão existente)
- Service role apenas server-side

---

## 30. Fluxo de entrada e conversão

### 30.1 Identificação da saudação — CONFIRMADO

A entrada do lead é registrada quando a saudação é enviada na conexão Vendas.

**Critérios de identificação robusta:**
1. `event = "message.created"`
2. `serviceId = SERVICE_ID_VENDAS` (`4af28025...`)
3. `isFromMe = true` (mensagem enviada pela empresa)
4. `type = "chat"`
5. `isComment = false`
6. `isFromBot = false` (ou true se a saudação for enviada por bot — **confirmar**)
7. Texto normalizado contém elementos estáveis:
   - "central de atendimento" (normalizado: `centraldeatendimento`)
   - "le bebe" ou "le🌟bébé" (normalizado: `lebebe`)
   - Pelo menos 2 dos 3 links wa.me (`wa.me/554184426528`, `wa.me/554188043042`, `wa.me/554192220492`)
   - Ou pelo menos 2 dos 3 números das lojas

**Normalização do texto para matching:**
```typescript
function normalizarTextoSaudacao(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^\w\s]/g, '') // remove pontuação (inclui 🌟)
    .replace(/\s+/g, ' ')
    .trim();
}
```

**Função de detecção:**
```typescript
function ehSaudacaoHub(texto: string): boolean {
  const norm = normalizarTextoSaudacao(texto);
  const temCentral = norm.includes('centraldeatendimento');
  const temLeBebe = norm.includes('lebebe');
  const linksEncontrados = [
    '554184426528', // Portão
    '554188043042', // Bigorrilho
    '554192220492', // Hauer
  ].filter(num => norm.includes(num)).length;
  return temCentral && temLeBebe && linksEncontrados >= 2;
}
```

**Vantagens:** pequenas alterações de espaço, quebra de linha ou pontuação não impedem o reconhecimento. A presença de pelo menos 2 links wa.me é um sinal estável forte.

### 30.2 Registro de entrada

Quando a saudação é identificada:
1. Obter telefone do contato via `GET /contacts/{contactId}` (API Digisac)
2. Normalizar telefone com `normalizarTelefoneDDI`
3. Verificar se já existe lead ativo para este telefone (ciclo < 14 dias)
4. Se não existe: criar novo lead com `status = 'aguardando_conversao'`, `ciclo_numero = 1`
5. Se existe e > 14 dias: criar novo ciclo (`ciclo_numero + 1`)
6. Se existe e < 14 dias: ignorar (idempotência — mesma saudação ou reenvio)
7. Persistir: `telefone_normalizado_ddi`, `data_entrada_hub` (usar `data.timestamp` do payload, não `now()`), `digisac_message_id_saudacao`, `digisac_contact_id_hub`, `digisac_ticket_id_hub`

### 30.3 Identificação de conversão

Quando uma mensagem do cliente (`isFromMe = false`) chega em uma conexão de loja:

1. `serviceId` deve ser uma das 3 lojas (Bigorrilho, Portão, Marechal/Hauer)
2. `isFromMe = false`, `type = "chat"`, `isComment = false`, `isFromBot = false`
3. Obter telefone do contato via `GET /contacts/{contactId}`
4. Normalizar telefone
5. Buscar lead ativo (`status = 'aguardando_conversao'`) por `telefone_normalizado_ddi`
6. Se não existe: ignorar (cliente não veio do hub ou ciclo já encerrado)
7. Se existe: verificar se `data.timestamp` da mensagem está dentro de 24h após `data_entrada_hub`
8. Se dentro de 24h: marcar conversão
   - `status = 'convertido_organicamente'`
   - `loja_principal` = loja identificada pelo `serviceId`
   - `data_conversao` = `data.timestamp` do payload
   - Se já tem `loja_principal`: adicionar loja em `lojas_chamadas`, setar `chamou_mais_de_uma_loja = true`
   - **Loja principal = primeira loja chamada** (não sobrescrever se já existe)
9. Se fora de 24h: ignorar (janela expirada)

### 30.4 Mapeamento serviceId → loja

Centralizado em `constantes.ts`:

```typescript
const CONEXOES_LOJAS: Record<string, { nome: string; slug: string }> = {
  '0973f84b-8294-4615-9657-ba95b6346246': { nome: 'Bigorrilho', slug: 'bigorrilho' },
  'c60d720f-5ad5-4a1b-bedb-e51495dee686': { nome: 'Portão', slug: 'portao' },
  '1352c41b-80a9-4e74-b9d9-4c5e7aed060e': { nome: 'Marechal/Hauer', slug: 'hauer' },
};
```

### 30.5 Evento atrasado

O timestamp real da mensagem (`data.timestamp`) deve ser usado para todas as validações de janela, não o momento em que o webhook foi recebido. Isso garante que eventos atrasados pelo Digisac sejam tratados corretamente.

---

## 31. Fluxo de contato, ticket e envio

### 31.1 Visão geral

```
Processador reserva item da fila
  → buscar contato por telefone + serviceId na conexão de destino
  → se não existe: criar contato
  → verificar chamado aberto na conexão de destino
  → se chamado aberto: cancelar recuperação
  → se não: abrir chamado via ticket/transfer
  → enviar mensagem via POST /messages
  → registrar resultado
```

### 31.2 Busca de contato por telefone

**Endpoint:** `GET /contacts?where[data.number][$like]=%telefone%&where[serviceId]=conexaoId`

- Usar `gerarVariacoesTelefone` para tentar múltiplas variações
- Filtrar por `serviceId` da conexão de destino
- Se encontrar: reutilizar `contactId`
- Se não encontrar: criar novo contato

### 31.3 Criação de contato

**Endpoint:** `POST /api/v1/contacts`

```json
{
  "internalName": "Lead Hub Vendas",
  "alternativeName": "",
  "name": "",
  "number": "5541984148660",
  "origin": "web",
  "serviceId": "ID_DA_CONEXAO_DESTINO",
  "defaultDepartmentId": null,
  "defaultUserId": null,
  "contactLists": [],
  "tagIds": [],
  "tags": [],
  "unsubscribed": false
}
```

- `internalName`: `"Lead Hub Vendas"` — padrão neutro quando não há nome real
- Se o lead já tem nome do hub (obtido na entrada): usar o nome real
- `number`: telefone normalizado com DDI
- `serviceId`: conexão de destino (não a conexão hub)
- Tratar resposta de duplicidade de forma idempotente (se já existe, buscar e reutilizar)

### 31.4 Abertura de chamado

**Endpoint:** `POST /api/v1/contacts/{contactId}/ticket/transfer`

```json
{
  "departmentId": "DEPARTAMENTO_RESGATE_DA_LOJA",
  "userId": null,
  "comments": "CHAMADA AUTOMATICA - RESGATE",
  "byUserId": "DIGISAC_BOT_USER_ID"
}
```

- `departmentId`: departamento de resgate (não o de triagem) — ver seção 27.4
- `byUserId`: lido de env var `DIGISAC_BOT_USER_ID` via `constantes.ts`

### 31.5 Envio da mensagem

**Endpoint:** `POST /api/v1/messages`

```json
{
  "text": "TEXTO_DA_ABORDAGEM",
  "type": "chat",
  "contactId": "ID_DO_CONTATO",
  "editMessage": null,
  "isComment": false,
  "subject": "Sem Assunto"
}
```

- **Não enviar `ticketId`** — o Digisac abre/associa o ticket automaticamente após o `ticket/transfer`
- **Nova função** `enviarMensagemResgateHubVendas` em `src/lib/digisac/hub-vendas/envio.ts`
- **Não alterar** `enviarMensagemDigisac` de `src/lib/digisac/enviar-mensagem.ts` (usada por outros módulos)

### 31.6 Registro pós-envio

Após envio confirmado, persistir na fila:
- `digisac_message_id` = `id` da resposta
- `digisac_contact_id` = `contactId` da resposta
- `digisac_ticket_id` = `ticketId` da resposta
- `versao_mensagem` = versão usada
- `texto_enviado` = texto efetivamente enviado
- `enviado_em` = timestamp do envio
- `resultado` = `"ok"`

E no lead:
- `conexao_recuperacao_id` = serviceId da conexão de destino
- `data_recuperacao_enviada` = timestamp
- `versao_mensagem_usada` = versão
- `digisac_message_id_recuperacao` = messageId
- `digisac_contact_id_recuperacao` = contactId
- `digisac_ticket_id_recuperacao` = ticketId

---

## 32. Regra de chamado aberto

### 32.1 Regra fechada

Se já existir chamado aberto do cliente na conexão escolhida para recuperação:
- **não enviar abordagem**
- **não reutilizar o chamado**
- **não abrir novo chamado**
- **não transferir**
- **não enviar mensagem de resgate**
- **cancelar a recuperação pendente ou agendada**
- **registrar motivo:** `chamado_aberto_na_conexao`

### 32.2 Justificativa

O cliente já está falando com a loja. Os chamados são encerrados normalmente em até ~30 horas. Não existe necessidade de nova abordagem.

### 32.3 Onde validar

A validação deve ocorrer em **3 momentos**:

1. **Reconciliação** (cron da manhã): verificar chamados abertos nas 3 lojas para todos os leads `aguardando_conversao` e `encaminhado_recuperacao`
2. **Preparação da fila** (cron da manhã): antes de agendar, verificar chamado aberto na conexão de destino
3. **Imediatamente antes do envio** (processador): validação final

### 32.4 Como verificar chamado aberto

**Endpoint:** `GET /tickets?where[contactId]=contactId&where[isOpen]=true` ou usar `buscarTicketsPorTelefoneComVariacoes` de `sgi-sync.ts` filtrando por `isOpen = true` e `serviceId` da conexão de destino.

**Abordagem recomendada:** usar `buscarTicketsPorTelefoneComVariacoes` com o telefone do lead, filtrar resultados por:
- `serviceId` da conexão de destino
- `isOpen = true`

Se encontrar qualquer ticket aberto na conexão de destino: cancelar.

### 32.5 Chamado aberto em qualquer loja

Se houver chamado aberto em **qualquer uma das 3 lojas monitoradas** (não apenas a de destino), o cliente já deve ser considerado convertido ou em atendimento. Avaliar:
- Se o chamado aberto é na loja principal já identificada: marcar `convertido_organicamente` se ainda não estiver
- Se o chamado aberto é em loja diferente da principal: adicionar como interação adicional
- Retirar o lead da recuperação automática em qualquer caso

---

## 33. Modelo de dados final proposto

### 33.1 Decisão — 3 tabelas

Confirmado o modelo de 3 tabelas proposto na revisão anterior, com ajustes conforme confirmações do usuário.

### 33.2 Tabela `hub_vendas_leads`

**Responsabilidade:** ciclo do lead, telefone, entrada no hub, conversão, loja principal, múltiplas lojas, encerramento comercial.

| Campo | Tipo | Not null | Default | Descrição |
|---|---|---|---|---|
| `id` | uuid PK | sim | `gen_random_uuid()` | |
| `telefone_normalizado_ddi` | text | sim | | Chave principal (DDI + DDD + número) |
| `telefone_normalizado` | text | sim | | Sem DDI (para busca) |
| `ciclo_numero` | integer | sim | | Número sequencial do ciclo |
| `data_entrada_hub` | timestamptz | sim | | Timestamp da saudação (do payload) |
| `digisac_message_id_saudacao` | text | não | | ID da mensagem de saudação |
| `digisac_contact_id_hub` | text | não | | ContactId na conexão hub |
| `digisac_ticket_id_hub` | text | não | | TicketId na conexão hub |
| `nome_contato_hub` | text | não | | Nome do contato no hub (se disponível) |
| `status` | text | sim | | Ver seção 34 |
| `loja_principal` | text | não | | `portao` / `bigorrilho` / `hauer` |
| `lojas_chamadas` | text[] | não | | Array de lojas chamadas |
| `chamou_mais_de_uma_loja` | boolean | não | `false` | |
| `data_conversao` | timestamptz | não | | Primeira mensagem em loja |
| `data_primeira_resposta_loja` | timestamptz | não | | |
| `conexao_recuperacao_id` | text | não | | ServiceId da conexão de resgate |
| `data_recuperacao_enviada` | timestamptz | não | | |
| `data_recuperacao_respondida` | timestamptz | não | | |
| `versao_mensagem_usada` | integer | não | | |
| `digisac_message_id_recuperacao` | text | não | | |
| `digisac_contact_id_recuperacao` | text | não | | |
| `digisac_ticket_id_recuperacao` | text | não | | |
| `erro` | text | não | | |
| `motivo_fila_manual` | text | não | | |
| `pausado` | boolean | não | `false` | |
| `created_at` | timestamptz | sim | `now()` | |
| `updated_at` | timestamptz | sim | `now()` | |

**Constraints:**
- Unique: `(telefone_normalizado_ddi, ciclo_numero)` — impede duplicidade de ciclo
- Check: `status` em valores válidos

**Indexes:**
- `idx_hvl_telefone_ddi` em `telefone_normalizado_ddi`
- `idx_hvl_status` em `status`
- `idx_hvl_data_entrada` em `data_entrada_hub`

### 33.3 Tabela `hub_vendas_recuperacao_fila`

**Responsabilidade:** fila de envios programados com reserva atômica + log de envio.

| Campo | Tipo | Not null | Default | Descrição |
|---|---|---|---|---|
| `id` | uuid PK | sim | `gen_random_uuid()` | |
| `lead_id` | uuid FK → `hub_vendas_leads` | sim | | |
| `conexao_destino_id` | text | sim | | ServiceId da conexão de resgate |
| `conexao_destino_nome` | text | não | | Nome (denormalização para UI) |
| `status` | text | sim | | `agendado` / `reservado` / `enviado` / `erro` / `cancelado` / `expirado` |
| `programado_para` | timestamptz | sim | | Horário programado |
| `reservado_em` | timestamptz | não | | |
| `reservado_por` | text | não | | ID da execução |
| `enviado_em` | timestamptz | não | | |
| `resultado` | text | não | | `ok` / `erro` |
| `erro` | text | não | | |
| `motivo_cancelamento` | text | não | | `chamado_aberto_na_conexao` / `convertido` / `pausa` / `expirado` |
| `versao_mensagem` | integer | não | | |
| `texto_enviado` | text | não | | Texto efetivamente enviado |
| `digisac_message_id` | text | não | | |
| `digisac_contact_id` | text | não | | |
| `digisac_ticket_id` | text | não | | |
| `created_at` | timestamptz | sim | `now()` | |
| `updated_at` | timestamptz | sim | `now()` | |

**Constraints:**
- Unique: `lead_id` — apenas 1 item de fila por lead
- FK: `lead_id` → `hub_vendas_leads(id)`

**Indexes:**
- `idx_hvf_status_programado` em `(status, programado_para)`
- `idx_hvf_reservado_em` em `reservado_em`
- `idx_hvf_conexao_data` em `(conexao_destino_id, enviado_em)`

### 33.4 Tabela `hub_vendas_config`

**Responsabilidade:** pausas, versões de mensagem, parâmetros ajustáveis.

**Avaliação JSONB vs campos tipados:** JSONB é adequado para versões de mensagem (array flexível) e pausas (estrutura variável). Para parâmetros simples (limite, intervalo, horário), JSONB funciona mas campos tipados seriam mais seguros. **Decisão:** usar JSONB com validação no código. Se a tabela crescer em complexidade, migrar para campos tipados.

| Campo | Tipo | Not null | Default | Descrição |
|---|---|---|---|---|
| `id` | uuid PK | sim | `gen_random_uuid()` | |
| `chave` | text unique | sim | | |
| `valor` | jsonb | sim | | |
| `criado_por` | text | não | | Email do usuário |
| `created_at` | timestamptz | sim | `now()` | |
| `updated_at` | timestamptz | sim | `now()` | |

**Chaves esperadas:**
- `pausa_geral`: `{ ativo: false, motivo: null, pausado_por: null, pausado_em: null }`
- `pausa_conexao_{serviceId}`: `{ ativo: false, motivo: null, erros_consecutivos: 0, pausada_em: null, pausada_automaticamente: false }`
- `rodizio_ultima_conexao`: `{ serviceId: null, ordem: 0 }`
- `versoes_mensagens`: `{ versoes: [{ id: 1, texto: "...", ativa: true }], proxima_versao: 2 }`
- `parametros`: `{ limite_diario: 15, intervalo_min_seg: 180, intervalo_max_seg: 300, horario_inicio: 9, horario_fim: 18 }`

### 33.5 RLS

Todas as tabelas com RLS habilitado. Policies:
- `SELECT`: usuários autenticados com módulo `hub_vendas_recuperacao`
- `INSERT/UPDATE`: service role (webhooks e crons) + usuários autenticados com módulo
- `DELETE`: apenas service role

---

## 34. Estados e transições

### 34.1 Estado comercial do lead

**Fonte de verdade:** `hub_vendas_leads.status`

```
aguardando_conversao
  ├─→ convertido_organicamente (cliente chamou loja dentro de 24h)
  ├─→ encaminhado_recuperacao (24h passou, não chamou, cron preparou)
  │     └─→ recuperado (mensagem enviada e cliente respondeu)
  │     └─→ recuperacao_enviada (mensagem enviada, aguardando resposta)
  │     └─→ erro_recuperacao (falha no envio)
  ├─→ fila_manual (após 48h sem conversão e sem envio)
  └─→ encerrado (ciclo encerrado manualmente ou por tempo)
```

### 34.2 Estado operacional da fila

**Fonte de verdade:** `hub_vendas_recuperacao_fila.status`

```
agendado
  ├─→ reservado (processador reservou)
  │     ├─→ enviado (envio confirmado)
  │     └─→ erro (falha no envio)
  ├─→ cancelado (conversão detectada, chamado aberto, ou pausa)
  └─→ expirado (reserva expirada após 10 min sem envio)
```

### 34.3 Regras de transição

| De | Para | Evento | Condições |
|---|---|---|---|
| → `aguardando_conversao` | | Saudação enviada no hub | `isFromMe=true` + saudação detectada |
| `aguardando_conversao` | `convertido_organicamente` | Mensagem do cliente em loja | Dentro de 24h |
| `aguardando_conversao` | `encaminhado_recuperacao` | Cron da manhã | 24h passou, sem conversão, sem chamado aberto |
| `encaminhado_recuperacao` | `recuperado` | Cliente respondeu | `isFromMe=false` na conexão de resgate |
| `encaminhado_recuperacao` | `recuperacao_enviada` | Processador enviou | Envio confirmado |
| `recuperacao_enviada` | `recuperado` | Cliente respondeu | `isFromMe=false` na conexão de resgate |
| qualquer | `fila_manual` | Cron da manhã | > 48h após entrada |
| qualquer | `encerrado` | Manual ou tempo | Ciclo encerrado |

### 34.4 Reconciliação

- Cron da manhã reconcilia: busca tickets por telefone nas 3 lojas para leads `aguardando_conversao`
- Se encontrar conversão que o webhook não capturou: marca `convertido_organicamente`
- Se encontrar chamado aberto: cancela fila, marca motivo
- Reconciliação prevalece sobre ausência de webhook

### 34.5 Não duplicar status

- **Lead:** estado comercial (ciclo de vida do lead)
- **Fila:** estado operacional (lifecycle do envio)
- Não duplicar o mesmo status em ambas as tabelas

---

## 35. Locks e idempotência

### 35.1 Reserva atômica

```sql
UPDATE hub_vendas_recuperacao_fila
SET status = 'reservado',
    reservado_em = now(),
    reservado_por = $1,
    updated_at = now()
WHERE id = (
  SELECT id FROM hub_vendas_recuperacao_fila
  WHERE status = 'agendado'
    AND programado_para <= now()
  ORDER BY programado_para ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED
)
RETURNING *;
```

### 35.2 Expiração de reserva

**10 minutos** — reavaliado: adequado porque:
- 1 envio via API Digisac: < 5s
- Busca de contato: < 5s
- Criação de contato: < 5s
- ticket/transfer: < 5s
- Validações: < 2s
- Total máximo esperado: ~30s
- 10 minutos dá margem para 3 retries internos + latência de rede

```sql
UPDATE hub_vendas_recuperacao_fila
SET status = 'expirado', updated_at = now()
WHERE status = 'reservado'
  AND reservado_em < now() - interval '10 minutes';
```

### 35.3 Idempotência

| Mecanismo | Onde | Como |
|---|---|---|
| Unique `(telefone_normalizado_ddi, ciclo_numero)` | `hub_vendas_leads` | Impede 2 ciclos iguais |
| Unique `lead_id` | `hub_vendas_recuperacao_fila` | Impede 2 filas para o mesmo lead |
| `data.id` do webhook | Código | Verificar se mensagem já foi processada antes de agir |
| `FOR UPDATE SKIP LOCKED` | Fila | Impede 2 execuções no mesmo item |

### 35.4 Casos de borda

- **Envio realizado mas resposta perdida:** item fica `reservado`, expira em 10 min, processo detecta via reconciliação que a mensagem foi enviada (busca por `digisac_message_id`), marca como `enviado`
- **Webhook duplicado:** `data.id` único — segunda ocorrência é ignorada
- **Cron duplicado:** `FOR UPDATE SKIP LOCKED` — segunda execução não encontra itens disponíveis

---

## 36. Cron e infraestrutura — VPS Hostinger

### 36.1 Ambiente VPS — CONFIRMADO

- **Sistema:** Ubuntu 24.04.3 LTS
- **Timezone:** `America/Sao_Paulo` (NTP sincronizado)
- **Usuário:** `root` disponível
- **cron.service:** instalado, habilitado e ativo
- **crontab:** disponível em `/usr/bin/crontab`
- **curl:** instalado
- **Docker e EasyPanel:** ativos
- **Espaço:** ~76 GB disponíveis
- **Padrão de organização:** projetos em `/opt/devweb/workspace/`, scripts em `scripts/`, logs em `logs/`, cron executado diretamente no host

**Não utilizar:** novo container Docker, processo persistente, n8n, GitHub Actions, Supabase pg_cron, Edge Function.

### 36.2 Arquitetura aprovada

A VPS deve **apenas chamar rotas HTTP protegidas** do Le Bébé App. Toda a lógica de negócio, acesso ao Supabase, Digisac, locks, filas e validações permanece no aplicativo.

### 36.3 Estrutura operacional na VPS

```text
/opt/devweb/workspace/hub_vendas/
├── scripts/
│   ├── preparar_fila.sh
│   └── processar_fila.sh
├── config/
│   └── hub_vendas.env
└── logs/
    ├── preparar_fila.log
    └── processar_fila.log
```

- **Secret:** arquivo `hub_vendas.env` com permissão `600` — nunca no crontab
- **Scripts:** permissão restrita, leem o secret do arquivo `.env`

### 36.4 Cron de preparação — VPS

**Rota:** `https://lebebe.cloud/api/cron/hub-vendas-preparar-fila`
**Schedule:** `*/10 9-17 * * 1-6` (a cada 10 min, seg-sáb, 09:00-17:59)
**Auth:** `Authorization: Bearer $CRON_SECRET`

**Responsabilidades:**
1. Reconciliar leads
2. Localizar quem completou 24 horas
3. Verificar limite de 48 horas
4. Verificar conversões
5. Verificar chamado aberto em qualquer loja
6. Aplicar rodízio (ler `rodizio_ultima_conexao` em `hub_vendas_config`)
7. Verificar limite diário (count por consulta na fila)
8. Criar itens da fila com `status = 'agendado'`
9. Calcular `programado_para` = agora + intervalo aleatório 180-300s
10. Escolher versão da mensagem (rotação variada)
11. Mover expirados para fila manual

**Atraso máximo esperado** após completar 24 horas: menos de 10 minutos.

### 36.5 Cron de processamento — VPS

**Rota:** `https://lebebe.cloud/api/cron/hub-vendas-processar-fila`
**Schedule:** `*/2 9-17 * * 1-6` (a cada 2 min, seg-sáb, 09:00-17:59)
**Auth:** `Authorization: Bearer $CRON_SECRET`

**Responsabilidades por execução:**
1. Validar horário permitido (09:00-18:00 BRT, seg-sáb) — rejeitar se fora
2. Recuperar reservas expiradas (10 min)
3. Verificar pausa geral — se pausada, retornar 200 vazio
4. Para cada conexão ativa e despausada:
   a. Contar envios do dia (count na fila)
   b. Se >= limite: pular conexão
   c. Buscar item vencido (`status = 'agendado' AND programado_para <= now()`)
   d. Se não há item: pular conexão
   e. Reservar atomicamente (`FOR UPDATE SKIP LOCKED`)
   f. Validação final (15 checks — ver seção 37.6)
   g. Buscar/criar contato
   h. Verificar chamado aberto novamente
   i. Abrir chamado via `ticket/transfer`
   j. Enviar mensagem via `POST /messages`
   k. Registrar resultado
   l. Atualizar contador de erros consecutivos (pausa automática se >= 3)
5. Retornar 200 com resumo

### 36.6 Validação de horário — dupla proteção

O `crontab` não é a única proteção. As duas rotas devem validar internamente:
- Timezone `America/Sao_Paulo`
- Segunda a sábado (não domingo)
- Horário atual >= 09:00
- Horário atual < 18:00 (estritamente menor — nenhum envio pode começar às 18:00 ou depois)

### 36.7 Proteção contra sobreposição — flock

Os scripts da VPS devem usar `flock`:

```bash
flock -n /var/lock/hub-vendas-preparar.lock \
  /opt/devweb/workspace/hub_vendas/scripts/preparar_fila.sh
```

```bash
flock -n /var/lock/hub-vendas-processar.lock \
  /opt/devweb/workspace/hub_vendas/scripts/processar_fila.sh
```

O `flock` é apenas proteção adicional no host. O código do aplicativo continua responsável por idempotência e reserva atômica.

### 36.8 Chamada HTTP — curl

Os scripts devem usar `curl` com:
- `--fail` — falhar em HTTP >= 400
- `--silent` — sem progress
- `--show-error` — mostrar erros
- `--connect-timeout 10` — timeout de conexão
- `--max-time 90` — timeout total
- `--retry 2` — retry para falhas transitórias
- `--retry-delay 5` — delay entre retries
- `--retry-connrefused` — retry em connection refused
- `-H "Authorization: Bearer ${CRON_SECRET}"` — header de auth
- Nenhum secret na linha do crontab
- Nenhuma impressão do secret em log

Exemplo conceitual:
```bash
curl \
  --fail \
  --silent \
  --show-error \
  --connect-timeout 10 \
  --max-time 90 \
  --retry 2 \
  --retry-delay 5 \
  --retry-connrefused \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "${APP_URL}/api/cron/hub-vendas-processar-fila"
```

### 36.9 Logs da VPS

**Local:** `/opt/devweb/workspace/hub_vendas/logs/`

**Registrar apenas:**
- Data e hora
- Nome da rotina
- HTTP status
- Duração
- Sucesso ou erro técnico
- Identificador da execução, quando retornado

**Não registrar:**
- Secrets, tokens
- Telefone completo
- Nome do cliente
- Texto da mensagem
- Payload integral

### 36.10 Logrotate

Propor configuração de `logrotate` para impedir crescimento indefinido dos logs:

```text
/opt/devweb/workspace/hub_vendas/logs/*.log {
  daily
  rotate 30
  compress
  delaycompress
  missingok
  notifempty
  create 0640 root root
}
```

### 36.11 Fallback da VPS

Se a VPS ficar indisponível:
- Itens reservados expiram em 10 min → voltam para `agendado` (via recuperação de expirados)
- Quando VPS voltar, processa itens acumulados
- **Sem perda de dados** — fila é persistida no Supabase
- Webhook continua funcionando (Vercel) — registra entradas e conversões normalmente

### 36.12 Crontab na VPS

```bash
# crontab -e na VPS
# Preparação — a cada 10 minutos, seg-sáb 09:00-17:59
*/10 9-17 * * 1-6 flock -n /var/lock/hub-vendas-preparar.lock /opt/devweb/workspace/hub_vendas/scripts/preparar_fila.sh

# Processamento — a cada 2 minutos, seg-sáb 09:00-17:59
*/2 9-17 * * 1-6 flock -n /var/lock/hub-vendas-processar.lock /opt/devweb/workspace/hub_vendas/scripts/processar_fila.sh
```

**Nota:** `9-17` (não `9-18`) porque o último envio deve ser processado antes das 18:00. Com execução a cada 2 min, a última execução às 17:58 processa itens até 18:00.

### 36.13 Checklist operacional pós-implementação

A infraestrutura já está validada. Restará apenas, depois que as rotas existirem:
1. Criar diretórios
2. Criar arquivo de ambiente (`hub_vendas.env` com `APP_URL` e `CRON_SECRET`)
3. Cadastrar `APP_URL`
4. Cadastrar o mesmo `CRON_SECRET` configurado no app
5. Criar scripts (`preparar_fila.sh` e `processar_fila.sh`)
6. Testar manualmente
7. Cadastrar linhas no crontab
8. Validar logs
9. Validar HTTP status
10. Acompanhar a primeira execução real

---

## 37. Limites, pausas e proteções

### 37.1 Limite diário

- 15 envios/dia por conexão
- Contagem por consulta: `SELECT count(*) FROM hub_vendas_recuperacao_fila WHERE conexao_destino_id = $1 AND status = 'enviado' AND enviado_em::date = current_date`
- Índice `idx_hvf_conexao_data` em `(conexao_destino_id, enviado_em)` para performance
- Sem tabela de contador

### 37.2 Pausa geral

- Armazenada em `hub_vendas_config` chave `pausa_geral`
- Se `ativo = true`: processador retorna 200 vazio sem processar
- Pode ser ativada/desativada pela tela
- Histórico de alterações em `auditoria_acessos` com `acao = 'hub_vendas_pausa_alterada'`

### 37.3 Pausa por conexão

- Armazenada em `hub_vendas_config` chave `pausa_conexao_{serviceId}`
- Se `ativo = true`: processador pula a conexão
- Pode ser ativada/desativada pela tela

### 37.4 Pausa automática por erros

- Após **3 erros consecutivos** em uma conexão: pausar automaticamente
- Contador em `pausa_conexao_{serviceId}.erros_consecutivos`
- Zerar contador após 1 envio bem-sucedido
- `pausada_automaticamente = true` para distinguir de pausa manual
- Quem pode reativar: qualquer usuário com acesso ao módulo (tela)
- Motivo e horário da pausa registrados
- Alerta visível na tela

### 37.5 Trava de duplicidade

- Unique `(telefone_normalizado_ddi, ciclo_numero)` em leads
- Unique `lead_id` na fila
- `FOR UPDATE SKIP LOCKED` na reserva

### 37.6 Validação final antes do envio (15 checks)

1. Item está reservado por esta execução
2. Automação geral está ativa
3. Conexão está ativa
4. Conexão não está pausada
5. Dentro do horário permitido (09:00-18:00 BRT)
6. Não é domingo
7. Lead ainda dentro das 48 horas
8. Não houve conversão
9. Não surgiu chamado aberto em nenhuma loja
10. Ainda não houve abordagem neste ciclo
11. Limite de 15 não foi atingido
12. Telefone é válido
13. Conexão Digisac está disponível
14. Contato pode ser localizado ou criado
15. Somente então: abrir chamado + enviar mensagem

---

## 38. Estrutura de arquivos proposta

### 38.1 Novos arquivos

```
src/lib/digisac/hub-vendas/
  tipos.ts              — tipos TypeScript do domínio (Lead, FilaItem, Config, etc.)
  constantes.ts         — serviceIds, departmentIds de resgate, comentário padrão, constantes de domínio
  normalizacao.ts       — normalizarTextoSaudacao, ehSaudacaoHub, reexporta normalizarTelefoneDDI
  processar-webhook.ts  — distribui evento: entrada, conversão, resposta
  registrar-entrada.ts  — identifica saudação, busca telefone, cria lead
  registrar-conversao.ts — identifica mensagem em loja, marca conversão
  reconciliar.ts        — busca tickets por telefone, confirma conversão, verifica chamado aberto
  preparar-fila.ts      — cron da manhã: seleciona elegíveis, rodízio, agenda horários
  processar-fila.ts     — processador: reserva, valida, envia, registra
  contato.ts            — buscar/criar contato por telefone + serviceId
  ticket.ts             — ticket/transfer para departamento de resgate
  envio.ts              — enviarMensagemResgateHubVendas (nova função, não altera existente)
  pausas.ts             — ler/escrever pausas em hub_vendas_config, pausa automática
  metricas.ts           — queries de métricas para a tela
```

### 38.2 Arquivos a alterar

| Arquivo | Alteração | Impacto |
|---|---|---|
| `src/app/api/digisac/webhook/route.ts` | Adicionar chamada a `processarWebhookHubVendas` após triagem existente, em try/catch isolado | Mínimo — triagem preservada |
| `src/lib/auth/modulos-app.ts` | Adicionar módulo `hub_vendas_recuperacao` em `APP_MODULES` e `NAVIGATION_GROUPS` | Adição de item |
| `vercel.json` | **Não alterar** — crons do Hub/Vendas rodam na VPS, não na Vercel | Sem impacto |

### 38.3 Novas rotas

| Rota | Método | Auth | Descrição |
|---|---|---|---|
| `/api/cron/hub-vendas-preparar-fila` | GET | `CRON_SECRET` | Cron da manhã |
| `/api/cron/hub-vendas-processar-fila` | GET | `CRON_SECRET` | Processador periódico |
| `/api/hub-vendas/leads` | GET | `requireModuleAccess('hub_vendas_recuperacao')` | Listagem de leads |
| `/api/hub-vendas/metricas` | GET | `requireModuleAccess('hub_vendas_recuperacao')` | Métricas para painel |
| `/api/hub-vendas/pausas` | GET/POST | `requireModuleAccess('hub_vendas_recuperacao')` | Pausar/despausar |
| `/api/hub-vendas/versoes-mensagens` | GET/POST | `requireModuleAccess('hub_vendas_recuperacao')` | Cadastrar versões |

### 38.4 Arquivos NÃO alterar

| Arquivo | Motivo |
|---|---|
| `src/lib/digisac/enviar-mensagem.ts` | Usada por outros módulos — criar nova função em `hub-vendas/envio.ts` |
| `src/lib/digisac/triagem.ts` | Triagem antiga preservada integralmente |
| `src/lib/digisac/transferencia.ts` | Transferência da triagem preservada |
| `src/lib/digisac/clienteDigisac.ts` | Reutilizado sem alteração |
| `src/lib/digisac/sgi-sync.ts` | Reutilizado sem alteração (normalizarTelefoneDDI, gerarVariacoesTelefone, buscarTicketsPorTelefoneComVariacoes) |
| `src/lib/digisac/departamentosFixos.ts` | Departamentos antigos preservados — resgate usa IDs diferentes em `constantes.ts` |

---

## 39. Migration proposta

### 39.1 Arquivo

`supabase/migrations/YYYYMMDDHHMMSS_hub_vendas_leads_fila_config.sql`

### 39.2 Estrutura

```sql
-- ============================================================
-- HUB VENDAS: LEADS, FILA DE RECUPERACAO E CONFIG
-- ============================================================

-- Tabela 1: hub_vendas_leads
CREATE TABLE IF NOT EXISTS public.hub_vendas_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telefone_normalizado_ddi text NOT NULL,
  telefone_normalizado text NOT NULL,
  ciclo_numero integer NOT NULL,
  data_entrada_hub timestamptz NOT NULL,
  digisac_message_id_saudacao text,
  digisac_contact_id_hub text,
  digisac_ticket_id_hub text,
  nome_contato_hub text,
  status text NOT NULL CHECK (status IN (
    'aguardando_conversao',
    'convertido_organicamente',
    'encaminhado_recuperacao',
    'recuperacao_enviada',
    'recuperado',
    'erro_recuperacao',
    'fila_manual',
    'encerrado'
  )),
  loja_principal text,
  lojas_chamadas text[],
  chamou_mais_de_uma_loja boolean DEFAULT false,
  data_conversao timestamptz,
  data_primeira_resposta_loja timestamptz,
  conexao_recuperacao_id text,
  data_recuperacao_enviada timestamptz,
  data_recuperacao_respondida timestamptz,
  versao_mensagem_usada integer,
  digisac_message_id_recuperacao text,
  digisac_contact_id_recuperacao text,
  digisac_ticket_id_recuperacao text,
  erro text,
  motivo_fila_manual text,
  pausado boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hub_vendas_leads_telefone_ciclo_unique UNIQUE (telefone_normalizado_ddi, ciclo_numero)
);

CREATE INDEX IF NOT EXISTS idx_hvl_telefone_ddi ON public.hub_vendas_leads (telefone_normalizado_ddi);
CREATE INDEX IF NOT EXISTS idx_hvl_status ON public.hub_vendas_leads (status);
CREATE INDEX IF NOT EXISTS idx_hvl_data_entrada ON public.hub_vendas_leads (data_entrada_hub);

-- Tabela 2: hub_vendas_recuperacao_fila
CREATE TABLE IF NOT EXISTS public.hub_vendas_recuperacao_fila (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.hub_vendas_leads(id),
  conexao_destino_id text NOT NULL,
  conexao_destino_nome text,
  status text NOT NULL CHECK (status IN (
    'agendado', 'reservado', 'enviado', 'erro', 'cancelado', 'expirado'
  )),
  programado_para timestamptz NOT NULL,
  reservado_em timestamptz,
  reservado_por text,
  enviado_em timestamptz,
  resultado text,
  erro text,
  motivo_cancelamento text,
  versao_mensagem integer,
  texto_enviado text,
  digisac_message_id text,
  digisac_contact_id text,
  digisac_ticket_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hub_vendas_fila_lead_unique UNIQUE (lead_id)
);

CREATE INDEX IF NOT EXISTS idx_hvf_status_programado ON public.hub_vendas_recuperacao_fila (status, programado_para);
CREATE INDEX IF NOT EXISTS idx_hvf_reservado_em ON public.hub_vendas_recuperacao_fila (reservado_em);
CREATE INDEX IF NOT EXISTS idx_hvf_conexao_data ON public.hub_vendas_recuperacao_fila (conexao_destino_id, enviado_em);

-- Tabela 3: hub_vendas_config
CREATE TABLE IF NOT EXISTS public.hub_vendas_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL UNIQUE,
  valor jsonb NOT NULL,
  criado_por text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Config iniciais
INSERT INTO public.hub_vendas_config (chave, valor) VALUES
  ('pausa_geral', '{"ativo": false, "motivo": null, "pausado_por": null, "pausado_em": null}'::jsonb),
  ('rodizio_ultima_conexao', '{"serviceId": null, "ordem": 0}'::jsonb),
  ('versoes_mensagens', '{"versoes": [], "proxima_versao": 1}'::jsonb),
  ('parametros', '{"limite_diario": 15, "intervalo_min_seg": 180, "intervalo_max_seg": 300, "horario_inicio": 9, "horario_fim": 18}'::jsonb)
ON CONFLICT (chave) DO NOTHING;

-- RLS
ALTER TABLE public.hub_vendas_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_vendas_recuperacao_fila ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_vendas_config ENABLE ROW LEVEL SECURITY;

-- Policies (service role bypass, authenticated com módulo)
CREATE POLICY hub_vendas_leads_select ON public.hub_vendas_leads FOR SELECT TO authenticated USING (true);
CREATE POLICY hub_vendas_leads_insert_srv ON public.hub_vendas_leads FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY hub_vendas_leads_update_srv ON public.hub_vendas_leads FOR UPDATE TO service_role USING (true) WITH CHECK (true);
CREATE POLICY hub_vendas_leads_update_auth ON public.hub_vendas_leads FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY hub_vendas_fila_select ON public.hub_vendas_recuperacao_fila FOR SELECT TO authenticated USING (true);
CREATE POLICY hub_vendas_fila_insert_srv ON public.hub_vendas_recuperacao_fila FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY hub_vendas_fila_update_srv ON public.hub_vendas_recuperacao_fila FOR UPDATE TO service_role USING (true) WITH CHECK (true);
CREATE POLICY hub_vendas_fila_update_auth ON public.hub_vendas_recuperacao_fila FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY hub_vendas_config_select ON public.hub_vendas_config FOR SELECT TO authenticated USING (true);
CREATE POLICY hub_vendas_config_insert_srv ON public.hub_vendas_config FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY hub_vendas_config_update_srv ON public.hub_vendas_config FOR UPDATE TO service_role USING (true) WITH CHECK (true);
CREATE POLICY hub_vendas_config_update_auth ON public.hub_vendas_config FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Pausas por conexao (inseridas via código quando necessário)
-- Cadastro do módulo em app_modulos
INSERT INTO public.app_modulos (chave, nome, descricao, rota_base, categoria, publico, somente_superadmin, ativo, ordem)
VALUES ('hub_vendas_recuperacao', 'HUB VENDAS RECUPERACAO', 'Recuperacao automatica de leads do Hub/Vendas', '/hub-vendas/recuperacao', 'interno', false, false, true, 120)
ON CONFLICT (chave) DO UPDATE SET nome = EXCLUDED.nome, descricao = EXCLUDED.descricao, rota_base = EXCLUDED.rota_base, updated_at = now();

-- Cadastrar conexao Hub/Vendas em digisac_conexoes_automacao
INSERT INTO public.digisac_conexoes_automacao (service_id, service_name, my_number, default_department_id, ativo)
VALUES ('4af28025-c210-4336-a560-785d2fb8a778', 'VENDAS (Hub)', null, null, true)
ON CONFLICT (service_id) DO UPDATE SET service_name = EXCLUDED.service_name, ativo = true, updated_at = now();
```

**Não executar migration nesta tarefa.** Esta é a proposta para aprovação.

---

## 40. Tela proposta

### 40.1 Rota

`/hub-vendas/recuperacao`

### 40.2 Estrutura

- `page.tsx` — Server Component wrapper com `checkModuleAndWindowAccess('hub_vendas_recuperacao')`
- `PageClient.tsx` — Client Component com painel, listas e controles

### 40.3 Métricas mínimas (painel)

- Total de entradas no Hub
- Convertidos organicamente
- Portão / Bigorrilho / Hauer (conversões por loja)
- Múltiplas lojas
- Não convertidos
- Recuperações agendadas
- Recuperações enviadas
- Recuperações respondidas
- Erros
- Excedentes por limite diário
- Fila manual
- Automação pausada ou ativa

### 40.4 Listas mínimas

- Leads aguardando conversão
- Leads convertidos
- Leads que chamaram mais de uma loja
- Leads programados para recuperação
- Leads enviados
- Leads com erro
- Cancelados por chamado aberto
- Excedentes por limite diário
- Fila manual

### 40.5 Controles

- Pausar/despausar automação geral
- Pausar/despausar por conexão
- Cadastrar/ativar/desativar versões de mensagem
- Visualizar estado do processador (última execução, itens processados)

### 40.6 Permissões

- `moduleKey`: `hub_vendas_recuperacao`
- `access`: `profile`
- Cadastrado em `APP_MODULES` e `NAVIGATION_GROUPS`
- Migration idempotente em `app_modulos`
- APIs protegidas com `requireModuleAccess('hub_vendas_recuperacao')`
- Seguir `docs/ia/padrao-novas-telas-permissoes.md` integralmente

---

## 41. Testes propostos

### 41.1 Webhook

| Cenário | Resultado esperado |
|---|---|
| Saudação válida | Lead registrado com `aguardando_conversao` |
| Saudação com espaços/quebras diferentes | Lead registrado (matching robusto) |
| Mensagem semelhante mas não é saudação | Ignorado |
| Mensagem do cliente em loja dentro de 24h | Conversão registrada |
| Evento duplicado (`data.id` igual) | Ignorado (idempotência) |
| Evento de conexão não monitorada | Ignorado |
| Comentário (`isComment = true`) | Ignorado |
| Bot (`isFromBot = true`) | Ignorado |
| Mensagem invisível (`visible = false`) | Ignorado |
| Evento atrasado (timestamp antigo) | Validado por timestamp real, não hora do webhook |
| Telefone não localizado via contactId | Log de erro, não registrar lead |

### 41.2 Conversão

| Cenário | Resultado esperado |
|---|---|
| Uma loja | `loja_principal` definida, `convertido_organicamente` |
| Duas lojas | `chamou_mais_de_uma_loja = true`, `lojas_chamadas` com 2 entries |
| Loja fora da janela de 24h | Ignorado |
| Mensagem anterior ao Hub | Ignorado |
| Contato duplicado (mesmo telefone, contactId diferente) | Dedup por `telefone_normalizado_ddi` |
| Nono dígito (variações de telefone) | Encontrado via `gerarVariacoesTelefone` |

### 41.3 Fila

| Cenário | Resultado esperado |
|---|---|
| Rodízio Portão → Bigorrilho → Hauer | Ordem respeitada |
| Conexão pausada | Pulada no rodízio |
| Limite diário atingido | Conexão pulada, lead fica `aguardando_limite_diario` |
| Expiração 48h | Lead movido para `fila_manual` |
| Horário proibido (fora 09-18h) | Processador não envia |
| Domingo | Processador não envia |
| Intervalo 180-300s | `programado_para` calculado corretamente |
| Concorrência (2 execuções simultâneas) | `SKIP LOCKED` impede duplicidade |

### 41.4 Envio

| Cenário | Resultado esperado |
|---|---|
| Contato existente | Reutilizado |
| Contato novo | Criado via `POST /contacts` |
| Chamado aberto na conexão | Recuperação cancelada, motivo `chamado_aberto_na_conexao` |
| Ticket criado via transfer | `ticket/transfer` chamado antes do envio |
| Falha no transfer | Erro registrado, não enviar |
| Falha no envio | Erro registrado, contador de erros incrementado |
| Resposta perdida (envio ok mas timeout) | Reconciliação detecta via `digisac_message_id` |
| Retry após erro | Manual via tela |
| Duplicidade (2 envios mesmo lead) | Impedido por unique `lead_id` |
| 3 erros consecutivos | Pausa automática da conexão |

### 41.5 Segurança

| Cenário | Resultado esperado |
|---|---|
| Secret inválido no webhook | 401 |
| serviceId não permitido | Ignorado |
| Payload inválido (sem `data.id`) | Ignorado |
| Cron sem `CRON_SECRET` | 401 |
| Usuário sem módulo acessando tela | Redirect `/acesso-negado` |
| Usuário sem módulo chamando API | 403 |

---

## 42. Impacto no Supabase e Vercel

### 42.1 Supabase

| Recurso | Impacto |
|---|---|
| Tabelas novas | 3 (`hub_vendas_leads`, `hub_vendas_recuperacao_fila`, `hub_vendas_config`) |
| Tabelas alteradas | 1 (`app_modulos` — novo módulo) + 1 (`digisac_conexoes_automacao` — cadastra Vendas) |
| RLS | 3 tabelas novas com RLS |
| Realtime | Não usado |
| Edge Function | Não usado |
| Storage | Não usado |
| Egress | Mínimo — consultas indexadas, sem payload completo |

### 42.2 Projeção de crescimento

| Métrica | Estimativa |
|---|---|
| Leads/dia | 2-5 (baseado em volume atual do hub) |
| Eventos webhook relevantes/dia | 10-20 (maioria é filtrada antes do banco) |
| Consultas webhook/dia | 5-10 (apenas eventos relevantes consultam banco) |
| Gravações webhook/dia | 2-5 (apenas entradas e conversões) |
| Envios de recuperação/dia | 1-3 (apenas não convertidos) |
| Crescimento mensal | ~60-150 leads, ~30-90 envios |
| Tamanho em 12 meses | < 1MB |

### 42.3 Vercel

| Recurso | Impacto |
|---|---|
| Cron jobs | **0** — ambos os crons rodam na VPS, `vercel.json` não é alterado |
| Rotas novas | 6 (2 cron + 4 API) |
| Página nova | 1 (`/hub-vendas/recuperacao`) |
| Build | Sem impacto significativo |
| Bandwidth | Mínimo — chamadas HTTP vindas da VPS, não do navegador |

---

## 43. Riscos restantes

| Risco | Severidade | Mitigação |
|---|---|---|
| `isFromBot` da saudação: se for `true`, o filtro atual ignora | Médio | Confirmar se a saudação é enviada por bot ou por humano. Se bot, ajustar filtro para permitir `isFromBot = true` quando `isFromMe = true` na conexão Vendas |
| `my_number` da conexão Vendas não confirmado | Baixo | Não impacta o fluxo — `serviceId` é usado como identificador |
| Fallback da VPS não automatizado | Baixo | Itens expiram em 10 min, webhook continua registrando entradas/conversões, VPS processa acumulado quando volta |
| Departamento de resgate não existe no Digisac | Alto | **PENDENTE** — validar se os 3 department IDs de resgate existem no Digisac |
| `POST /contacts` retorna erro de duplicidade inesperado | Médio | Tratar erro 409/400 de duplicidade buscando contato existente |
| `ticket/transfer` falha silenciosamente | Médio | Verificar `response.ok` e logar body da resposta |
| Webhook recebe eventos de conexões não monitoradas (ex: pós-venda) | Baixo | Allowlist de 4 serviceIds no código |

---

## 44. Decisões ainda pendentes do usuário

| # | Decisão | Status |
|---|---|---|
| 1 | Aprovar modelo de 3 tabelas | **PENDENTE** |
| 2 | Aprovar estrutura de arquivos em `src/lib/digisac/hub-vendas/` | **PENDENTE** |
| 3 | Confirmar se saudação é enviada por bot (`isFromBot = true`) ou por humano | **PENDENTE** |
| 4 | Validar se os 3 department IDs de resgate existem no Digisac | **PENDENTE** |
| 5 | Criar e aprovar 5+ versões de mensagem de abordagem | **PENDENTE** |
| 6 | Aprovar pausa automática após 3 erros consecutivos | **PENDENTE** |

**Resolvidos nesta consolidação:**
- ~~Arquitetura de webhook~~ → CONFIRMADO: reutilizar rota existente
- ~~Configuração do Digisac~~ → CONFIRMADO: 1 webhook, 4 conexões, message.created
- ~~Envio por number+serviceId~~ → RESOLVIDO: usar contactId após ticket/transfer
- ~~Infraestrutura VPS~~ → CONFIRMADO: VPS Hostinger, Ubuntu 24.04.3, cron no host, flock, env 600
- ~~Frequência do processador~~ → CONFIRMADO: a cada 2 minutos na VPS
- ~~Frequência da preparação~~ → CONFIRMADO: a cada 10 minutos na VPS (não mais 1x/dia na Vercel)
- ~~Margem de último envio~~ → CONFIRMADO: 17:58 processa até 18:00, crontab `9-17`
- ~~Departamentos~~ → CONFIRMADO: IDs de resgate diferentes dos de triagem
- ~~Endpoints de contato/ticket/envio~~ → CONFIRMADO

---

## 45. Fases de implementação

### Fase 1 — Banco de dados

- [ ] Criar migration com 3 tabelas + RLS + indexes + constraints
- [ ] Cadastrar módulo `hub_vendas_recuperacao` em `app_modulos`
- [ ] Cadastrar conexão Vendas em `digisac_conexoes_automacao`
- [ ] Inserir config iniciais em `hub_vendas_config`
- [ ] Rodar `get_advisors` para validar RLS

### Fase 2 — Webhook + entrada + conversão

- [ ] Criar `src/lib/digisac/hub-vendas/` com tipos, constantes, normalização
- [ ] Criar `processar-webhook.ts`, `registrar-entrada.ts`, `registrar-conversao.ts`
- [ ] Alterar `src/app/api/digisac/webhook/route.ts` (adicionar distribuição)
- [ ] Testar identificação de saudação
- [ ] Testar identificação de conversão
- [ ] Preservar triagem antiga

### Fase 3 — Cron preparação + reconciliação

- [ ] Criar `reconciliar.ts` e `preparar-fila.ts`
- [ ] Criar rota `/api/cron/hub-vendas-preparar-fila`
- [ ] Implementar validação interna de horário (timezone, seg-sáb, 09:00-18:00)
- [ ] Implementar rodízio, limite, intervalo
- [ ] Testar reconciliação com tickets existentes
- [ ] **Sem alteração em `vercel.json`** — cron roda na VPS

### Fase 4 — Processador + envio

- [ ] Criar `contato.ts`, `ticket.ts`, `envio.ts`, `processar-fila.ts`, `pausas.ts`
- [ ] Criar rota `/api/cron/hub-vendas-processar-fila`
- [ ] Implementar validação interna de horário (timezone, seg-sáb, 09:00-18:00)
- [ ] Implementar 15 checks de validação final
- [ ] Implementar pausa automática por erros
- [ ] Testar envio end-to-end
- [ ] **Pós-implementação:** criar scripts na VPS, configurar crontab, flock, env, logs (ver seção 36.13)

### Fase 5 — Tela

- [ ] Adicionar módulo em `modulos-app.ts`
- [ ] Criar `page.tsx` + `PageClient.tsx` em `/hub-vendas/recuperacao`
- [ ] Criar APIs: leads, metricas, pausas, versoes-mensagens
- [ ] Implementar painel com métricas
- [ ] Implementar listas
- [ ] Implementar controles de pausa
- [ ] Testar permissões (superadmin, perfil autorizado, não autorizado)
- [ ] Rodar `npm run test -- src/lib/auth/modulos-app.test.ts`

### Fase 6 — Mensagens

- [ ] Criar 5+ versões de mensagem
- [ ] Aprovação manual do usuário
- [ ] Cadastrar em `hub_vendas_config`
- [ ] Implementar rotação variada na seleção

---

## 46. Critérios de aceite

- [ ] Webhook identifica saudação corretamente (matching robusto)
- [ ] Webhook identifica conversão em loja dentro de 24h
- [ ] Triagem antiga funciona inalterada
- [ ] Cron da manhã prepara fila com rodízio e limite
- [ ] Reconciliação detecta conversões perdidas
- [ ] Regra de chamado aberto cancela recuperação
- [ ] Processador envia mensagem na conexão correta
- [ ] Contato é criado se não existe
- [ ] Ticket é aberto via `ticket/transfer` com comments "CHAMADA AUTOMATICA - RESGATE"
- [ ] Intervalo entre envios é 180-300s aleatório por conexão
- [ ] Limite de 15/dia por conexão é respeitado
- [ ] Horário 09-18h seg-sáb é respeitado
- [ ] Pausa geral interrompe todos os envios
- [ ] Pausa por conexão interrompe apenas a conexão
- [ ] Pausa automática após 3 erros consecutivos
- [ ] Tela mostra métricas e listas
- [ ] Tela permite pausar/despausar
- [ ] Tela protegida por `checkModuleAndWindowAccess`
- [ ] APIs protegidas por `requireModuleAccess`
- [ ] RLS habilitado em todas as tabelas
- [ ] `npm run test -- src/lib/auth/modulos-app.test.ts` passa
- [ ] `get_advisors` não reporta vulnerabilidades críticas

---

## 47. Documentos alterados

| Documento | Alteração |
|---|---|
| `docs/digisac-hub-vendas-plano-progresso.md` | Parte III adicionada (seções 26-47) com consolidação final |
| `docs/ia/log_progress.md` | Entrada de consolidação final adicionada |

**Nenhum código foi implementado.** Nenhum arquivo `.ts`, `.tsx`, `.sql` foi criado ou alterado. Apenas documentação técnica foi atualizada.

---

## 48. Próximo passo recomendado

1. **Usuário aprova as 6 decisões pendentes** (seção 44)
2. **Usuário valida** se os 3 department IDs de resgate existem no Digisac
3. **Usuário confirma** se a saudação é enviada por bot ou humano
4. **Usuário cria e aprova** 5+ versões de mensagem
5. **Após aprovação**, iniciar Fase 1 (migration + cadastros)
6. **Após Fase 1**, iniciar Fase 2 (webhook + entrada + conversão)
7. **Após Fase 2**, Fase 3 e 4 podem ocorrer em paralelo
8. **Fase 5** (tela) após Fase 1 concluída
9. **Fase 6** (mensagens) pode ocorrer a qualquer momento
10. **Pós-implementação:** checklist operacional da VPS (seção 36.13) — criar scripts, crontab, env, logs

**Pare aqui. Aguarde aprovação explícita do usuário antes de iniciar qualquer implementação.**
