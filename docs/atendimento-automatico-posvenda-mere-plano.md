# Plano Vivo — Atendimento Automatico Pos-Venda (Mere)

> **Documento de acompanhamento da feature.** Nao substitui `docs/ia/log_progress.md`.
> Complementa o log geral com o acompanhamento especifico desta feature.

---

## 1. Objetivo da feature

Implementar atendimento automatico de pos-venda via WhatsApp/Digisac (bot Mere) no Le Bebe App.
Foco inicial: confirmar data de entrega (opcao 1) e alterar data de entrega (opcao 2).

---

## 2. Escopo fechado da fase atual (Fase 1A)

- Receber webhook especifico do pos-venda (`/api/digisac/webhook/posvenda`)
- Validar secret
- Salvar mensagens recebidas no Supabase
- Criar/atualizar sessao de atendimento automatico
- Registrar eventos/logs
- Detectar mensagens do cliente
- Detectar mensagens humanas internas e pausar a automacao por 24h
- Detectar opcao 1 ou 2 do menu inicial apenas para registrar intenção
- Criar tela administrativa minima para visualizar sessoes
- Criar acoes administrativas: parar, bloquear 24h, bloquear permanente, desbloquear

**Nao responder automaticamente ao cliente nesta fase.**

---

## 3. Fora do escopo

- Resposta automatica ao cliente
- Helper de envio de mensagem Digisac
- DeepSeek / IA
- Worker EasyPanel/Redis (debounce)
- Vercel Cron
- Integracao com /procurar-datas
- Alteracao de agenda
- Alteracao do webhook atual `/api/digisac/webhook`
- Alteracao do motor /procurar-datas

---

## 4. Arquitetura resumida

```
Digisac → POST /api/digisac/webhook/posvenda (Vercel)
  → valida secret
  → filtra payload (event, serviceId, type, isComment, isBot)
  → detecta origem (cliente / bot / humano)
  → se humano: salva msg, pausa sessao 24h, registra evento
  → se cliente: verifica bloqueio, salva msg, cria/atualiza sessao, detecta opcao 1/2
  → se bot: salva msg para historico
  → retorna 200

Tela admin → /pos-venda/atendimento-automatico
  → lista sessoes
  → botoes: parar, bloquear 24h, bloquear cliente, desbloquear
```

---

## 5. Fases do projeto

| Fase | Conteudo | Status |
|---|---|---|
| Fase 0 | Auditoria tecnica e mapeamento | Concluida |
| Fase 1A | Webhook + Supabase + tela admin minima (sem resposta automatica) | Concluida |
| Fase 1B | Debounce real (worker EasyPanel/Redis) + resposta automatica + maquina de estados | Pendente |
| Fase 2 | IA DeepSeek para interpretacao de intenção | Pendente |
| Fase 3 | Integracao com /procurar-datas | Pendente |

---

## 6. Checklist da Fase 1A

- [x] Criar migration Supabase (4 tabelas + RLS)
- [x] Cadastrar modulo `pos_venda_atendimento_automatico` em `app_modulos`
- [x] Adicionar `pos_venda_atendimento_automatico` no tipo `ModuleKey` em `module-access.ts`
- [x] Criar webhook `/api/digisac/webhook/posvenda/route.ts`
- [x] Criar tela administrativa (`page.tsx` + `PageClient.tsx`)
- [x] Criar API `/api/pos-venda/atendimento-automatico/listar`
- [x] Criar API `/api/pos-venda/atendimento-automatico/[id]/parar`
- [x] Criar API `/api/pos-venda/atendimento-automatico/[id]/bloquear-24h`
- [x] Criar API `/api/pos-venda/atendimento-automatico/[id]/bloquear-cliente`
- [x] Criar API `/api/pos-venda/atendimento-automatico/[id]/desbloquear-cliente`
- [x] Adicionar item no Sidebar (grupo OPERACAO)
- [x] Rodar validacoes (lint, typecheck)
- [x] Atualizar `docs/ia/log_progress.md`

---

## 7. Arquivos previstos

### A criar

| Arquivo | Proposito |
|---|---|
| `src/app/api/digisac/webhook/posvenda/route.ts` | Webhook pos-venda |
| `src/app/pos-venda/atendimento-automatico/page.tsx` | Wrapper Server Component |
| `src/app/pos-venda/atendimento-automatico/PageClient.tsx` | Tela administrativa |
| `src/app/api/pos-venda/atendimento-automatico/listar/route.ts` | API listagem |
| `src/app/api/pos-venda/atendimento-automatico/[id]/parar/route.ts` | API parar |
| `src/app/api/pos-venda/atendimento-automatico/[id]/bloquear-24h/route.ts` | API bloquear 24h |
| `src/app/api/pos-venda/atendimento-automatico/[id]/bloquear-cliente/route.ts` | API bloquear cliente |
| `src/app/api/pos-venda/atendimento-automatico/[id]/desbloquear-cliente/route.ts` | API desbloquear |

### A alterar

| Arquivo | Alteracao |
|---|---|
| `src/components/Sidebar.tsx` | Adicionar item no menu |
| `src/lib/auth/module-access.ts` | Adicionar `pos_venda_atendimento_automatico` no tipo `ModuleKey` |
| `docs/ia/log_progress.md` | Registrar implementacao |

---

## 8. Tabelas previstas

### atendimento_automatico_sessoes

| Coluna | Tipo | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| digisac_ticket_id | text | NO | - |
| digisac_contact_id | text | YES | - |
| digisac_service_id | text | YES | - |
| digisac_department_id | text | YES | - |
| telefone | text | YES | - |
| cliente_nome | text | YES | - |
| status | text | NO | 'ativa' |
| estado | text | NO | 'inicio' |
| tipo_solicitacao | text | YES | - |
| documento_informado | text | YES | - |
| pedido_encontrado | boolean | YES | false |
| pedido_confirmado | boolean | YES | false |
| endereco_confirmado | boolean | YES | false |
| chamou_procurar_datas | boolean | YES | false |
| datas_candidatas | jsonb | YES | - |
| data_escolhida | text | YES | - |
| alterou_agenda | boolean | YES | false |
| motivo_falha | text | YES | - |
| pausa_ate | timestamptz | YES | - |
| bloqueio_permanente | boolean | YES | false |
| ultima_mensagem_cliente | text | YES | - |
| ultima_mensagem_bot | text | YES | - |
| ultima_mensagem_em | timestamptz | YES | - |
| resumo_contexto | text | YES | - |
| metadata | jsonb | YES | - |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

**Constraints:** `unique(digisac_ticket_id)`

### atendimento_automatico_mensagens

| Coluna | Tipo | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| sessao_id | uuid | NO (FK) | - |
| digisac_message_id | text | NO | - |
| digisac_ticket_id | text | YES | - |
| digisac_contact_id | text | YES | - |
| origem | text | NO | - |
| texto | text | YES | - |
| tipo_mensagem | text | YES | - |
| timestamp_digisac | timestamptz | YES | - |
| timestamp_recebimento | timestamptz | YES | now() |
| status | text | YES | 'pendente' |
| metadata | jsonb | YES | - |
| created_at | timestamptz | NO | now() |

**Constraints:** `unique(digisac_message_id)`

**Origens permitidas:** `cliente`, `bot`, `humano`, `sistema`

### atendimento_automatico_eventos

| Coluna | Tipo | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| sessao_id | uuid | NO (FK) | - |
| tipo | text | NO | - |
| descricao | text | YES | - |
| metadata | jsonb | YES | - |
| created_at | timestamptz | NO | now() |

### atendimento_automatico_bloqueios

| Coluna | Tipo | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| digisac_contact_id | text | YES | - |
| telefone | text | YES | - |
| tipo | text | NO | - |
| motivo | text | YES | - |
| bloqueado_por | text | YES | - |
| bloqueado_ate | timestamptz | YES | - |
| ativo | boolean | YES | true |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

**Tipos de bloqueio:** `temporario_24h`, `permanente`

### RLS

Padrao validado no projeto: funcao `is_superadmin()` que verifica `usuarios_permitidos` com `role = 'superadmin'` e `ativo = true`.

- SELECT, INSERT, UPDATE, DELETE: apenas superadmin
- Webhook usa service role (bypassa RLS)

---

## 9. Variaveis de ambiente previstas

| Variavel | Status | Proposito |
|---|---|---|
| `DIGISAC_POSVENDA_WEBHOOK_SECRET` | Nova — ver nota abaixo | Secret do webhook pos-venda (via query param `?secret=...`) |
| `DIGISAC_SERVICE_ID_POS_VENDA` | Ja existe | ServiceId da conexao pos-venda |
| `DIGISAC_WEBHOOK_SECRET` | Ja existe (vazio no .env.local) | Fallback se `DIGISAC_POSVENDA_WEBHOOK_SECRET` nao definido |

> **Nota sobre secret:** `DIGISAC_POSVENDA_WEBHOOK_SECRET` deve ser uma string aleatoria propria do webhook (ex: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`). **Nao usar o token pessoal do Digisac (`DIGISAC_TOKEN`) como secret** — sao propositos diferentes e o token pessoal da acesso a toda a API do Digisac. O painel do Digisac nao suporta header customizado, apenas URL, entao a secret deve ser usada via query param: `/api/digisac/webhook/posvenda?secret=VALOR_DA_SECRET`. Se a env estiver vazia, a rota aceita sem validacao (mesmo padrao do webhook atual), mas isso nao e recomendado para o webhook novo. Recomendado: preencher com valor aleatorio proprio e configurar a URL com `?secret=...` no painel.

---

## 10. Decisoes tomadas

- Webhook pos-venda em rota separada (`/api/digisac/webhook/posvenda`) — nao afeta webhook atual
- Modulo novo `pos_venda_atendimento_automatico` com `somente_superadmin = true` inicialmente
- RLS das novas tabelas: apenas superadmin (padrao `is_superadmin()`)
- Deteccao de opcao 1/2 por matching simples de texto normalizado (sem IA)
- Nao responder automaticamente ao cliente nesta fase
- Nao usar Vercel Cron para debounce
- Worker EasyPanel/Redis e hipotese para Fase 1B (nao implementar agora)
- **Autenticacao do webhook:** painel do Digisac nao suporta header customizado, apenas URL. Secret (se usado) deve ser via query param `?secret=...`. O webhook atual tem `DIGISAC_WEBHOOK_SECRET` vazio e nao valida secret na pratica. A rota nova ja suporta ambos (header `x-digisac-secret` e query param `secret`), mas se o painel nao suporta header, o query param e a unica via viavel.
- **Nao usar `DIGISAC_TOKEN` (token pessoal) como secret do webhook.** Sao propositos diferentes.

---

## 11. Pendencias

- Confirmar endpoint e payload do Digisac para envio de mensagens (POST /messages)
- Confirmar se `isFromBot` e consistentemente `false` para mensagens de humano interno
- Confirmar se `DIGISAC_BOT_USER_ID` e o user ID correto para a Mere
- Configurar `DIGISAC_SERVICE_ID_POS_VENDA` no .env (ja existe)
- Preencher `DIGISAC_POSVENDA_WEBHOOK_SECRET` com valor aleatorio proprio (gerar com `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) — nao usar token pessoal do Digisac
- Configurar webhook no painel Digisac com URL: `/api/digisac/webhook/posvenda?secret=VALOR_DA_SECRET`

---

## 12. Riscos conhecidos

- Ausencia de helper para envio de mensagens Digisac (gap confirmado)
- Deteccao de humano depende de consistencia do campo `isFromBot` no payload
- Multiplas instancias serverless podem criar sessoes duplicadas — mitigado com `unique(digisac_ticket_id)`
- Tabelas novas nao existem — migration necessaria
- ServiceId do pos-venda confirmado no codigo mas nao confirmado no painel Digisac

---

## 13. Criterios de aceite

1. Webhook `/api/digisac/webhook/posvenda` recebe payload, valida secret, salva mensagem e sessao
2. Mensagens de cliente sao salvas com `origem = 'cliente'`
3. Mensagens de humano interno sao detectadas e pausam sessao por 24h
4. Opcao 1 registra `tipo_solicitacao = 'confirmar_entrega'`
5. Opcao 2 registra `tipo_solicitacao = 'alterar_entrega'`
6. Opcoes 3-9 sao salmas mas nao iniciam fluxo
7. Idempotencia por `digisac_message_id`
8. Tela administrativa lista sessoes com filtros
9. Botoes parar/bloquear/desbloquear funcionam
10. Sidebar mostra item apenas para superadmin
11. APIs internas protegidas com `requireAuthenticatedUser` + `requireModuleAccess`
12. Nenhuma resposta automatica enviada ao cliente

---

## 14. Registro de andamento por data

### 2026-07-07 — Cascade — Inicio Fase 1A

- Auditoria concluida (Fase 0)
- Documentos obrigatorios lidos
- Supabase validado via MCP: tabelas, colunas, RLS, `is_superadmin()`, `app_modulos`
- Plano vivo criado
- Iniciando implementacao: migration, webhook, tela admin, APIs, sidebar

### 2026-07-07 — Cascade — Fase 1A concluida

- Migration aplicada via MCP Supabase: 4 tabelas + RLS (is_superadmin) + modulo cadastrado
- Webhook `/api/digisac/webhook/posvenda` criado com processador em `src/lib/atendimento-automatico/webhook-processor.ts`
- Tela administrativa criada em `/pos-venda/atendimento-automatico` com filtros e 4 acoes
- 5 APIs internas criadas e protegidas com `requireModuleAccess`
- Sidebar atualizado com item no grupo OPERACAO
- `ModuleKey` atualizado em `module-access.ts`
- Typecheck: 0 erros
- Lint: 0 erros
- `docs/ia/log_progress.md` atualizado
- Migration versionada em `supabase/migrations/20260707201710_create_atendimento_automatico_posvenda_tables.sql` (idempotente, version matching Supabase)
- Triggers versionados em `supabase/migrations/20260707203049_add_updated_at_triggers_atendimento_automatico.sql` (idempotente com DROP IF EXISTS)
- Verificacao de seguranca: sem risco de drift, versions match, SQL idempotente
- Pendencias: configurar env vars, configurar webhook no Digisac, testes manuais

### 2026-07-07 — Cascade — Correcao de criacao de sessao indevida + telefone vazio

- Problema: mensagens ambíguas ("Sim está correto") sem sessão ativa criavam sessão ativa indevidamente
- Causa: `webhook-processor.ts` criava sessão incondicionalmente para qualquer mensagem de cliente sem sessão prévia, mesmo sem gatilho válido
- Correção: sessão só é criada se `detectarSolicitacao` retornar gatilho válido (1, 2, ou variações de confirmar/alterar entrega)
- Gatilhos iniciais válidos expandidos: adicionado `data da entrega`, `quando vai entregar`, `remarcar entrega`, `antecipar entrega`, `adiantar entrega`, `postergar entrega`
- Mensagens sem gatilho válido e sem sessão existente retornam `ignored` com reason `sem_gatilho_inicial` — não criam sessão
- Telefone vazio: adicionado `extrairTelefone` que busca `msg.contact.data.number` (padrão confirmado em `chamadosFinalizados.ts`)
- Telefone é preenchido na criação da sessão e atualizado se vazio na sessão existente
- Pendência: se o payload do Digisac não incluir `contact` embutido no evento `message.created`, telefone continuará vazio — buscar via API Digisac usando `contactId` fica para Fase 1B
- Sessões indevidas já criadas não foram apagadas — podem ser finalizadas manualmente pela tela
- Typecheck: 0 erros
- Lint: 0 erros

### 2026-07-08 — Cascade — Ajuste de matching parcial para frases naturais

- Problema: matching exato não capturava frases naturais como "quero alterar data de entrega" ou "preciso mudar a data da entrega"
- Correção: `detectarSolicitacao` agora usa `includes` para frases de 3+ palavras, mantendo matches exatos para "1" e "2"
- Blocklist de mensagens ambíguas (match exato): sim, nao, ok, esta correto, sim esta correto, isso, pode ser, obrigada, obrigado, bom dia, boa tarde, boa noite, teste
- Frases de confirmar (includes): confirmar data de entrega, confirmar data entrega, confirmar entrega, data da entrega, quando vai entregar, quando sera a entrega, qual a data da entrega, consultar data de entrega
- Frases de alterar (includes): alterar data de entrega, alterar data entrega, alterar entrega, mudar data da entrega, mudar a data da entrega, trocar data da entrega, trocar a data da entrega, remarcar entrega, antecipar entrega, adiantar entrega, postergar entrega, mudar minha entrega
- Cenários validados logicamente: "quero alterar data de entrega" → alterar_entrega; "preciso mudar a data da entrega" → alterar_entrega; "quando vai entregar?" → confirmar_entrega; "sim está correto" → não cria; "ok" → não cria; "teste" → não cria
- Typecheck: 0 erros
- Lint: 0 erros

### 2026-07-08 — Cascade — Allowlist + telefone via API + estado aguardando_documento + captura CPF

- Decisão: bot atual do Digisac permanece ativo até pedir CPF; Le Bébé App assume após CPF em fase futura
- Telefone vazio: confirmado via MCP Supabase que o payload `message.created` do Digisac **não inclui `contact` embutido** — metadata das mensagens só tem `{serviceId, departmentId, solicitacao}`
- Solução telefone: adicionado `buscarTelefonePorContactId` que usa `fetchDigisac('/contacts/{contactId}')` para buscar `data.number` (padrão confirmado em `chamadosFinalizados.ts` e `agendamentos.ts`)
- Allowlist de teste: nova env `ATENDIMENTO_POSVENDA_ALLOWED_PHONES` (lista separada por vírgula, ex: `554192350811`)
- Regra da allowlist: se env preenchida, somente números nela podem criar/atualizar sessão; se env vazia, fluxo automático desativado por segurança; se telefone não identificado e allowlist ativa, não ativa fluxo
- Estado após opção 1/2: mudou de `inicio` para `aguardando_documento` (reflete handoff — bot Digisac pede CPF)
- Captura de CPF/CNPJ: quando `estado = aguardando_documento` e cliente envia 11 dígitos (CPF) ou 14 dígitos (CNPJ), salva em `documento_informado`, muda estado para `documento_recebido`, registra evento `documento_recebido`
- Mensagens que não são CPF/CNPJ durante `aguardando_documento`: salvas na sessão, estado mantido
- Tela: adicionada coluna "Documento" exibindo `documento_informado` mascarado (3 primeiros dígitos + `***`)
- Coluna `documento_informado` já existia na tabela (confirmado via MCP) — não precisou migration
- Variável de ambiente nova: `ATENDIMENTO_POSVENDA_ALLOWED_PHONES=554192350811` adicionada ao `.env.local`
- Typecheck: 0 erros
- Lint: 0 erros

### 2026-07-08 — Cascade — Correcao da ordem de processamento do webhook

- Problema observado em producao: tickets de outros numeros apareciam na tela apesar da allowlist (`b40be95b-535`, `8544a825-31a`)
- Causa encontrada: a logica anterior permitia que (1) bot criasse sessao ativa quando nao existia, (2) humano criasse sessao pausada mesmo sem sessao autorizada, (3) allowlist era aplicada apenas no branch cliente depois de bot/humano ja processarem, (4) telefone era resolvido via API mesmo para mensagens sem gatilho
- Comparacao com pre-filtro do fluxo antigo n8n: o n8n classificava origem primeiro e so processava mensagens de cliente (`deveResponder = !isFromMe && !isFromBot`)
- Correcao da ordem de processamento:
  1. Filtro tecnico barato (event, type, isComment, ticketId, contactId, texto) — sem chamar API
  2. Classificacao de origem (cliente/bot/humano)
  3. Busca de sessao existente por ticketId
  4. Bot: so salva mensagem se sessao autorizada existir; nao cria sessao
  5. Humano: so pausa se sessao autorizada existir; nao cria sessao pausada
  6. Cliente com sessao existente: resolve telefone se necessario, aplica allowlist, processa por estado
  7. Cliente sem sessao: verifica gatilho antes de resolver telefone; se gatilho valido, resolve telefone, aplica allowlist, cria sessao
- contactId agora usa fallback `fromId` se `contactId` ausente
- Filtro de `sem_contact_id` adicionado
- State machine expandida:
  - `aguardando_documento` + CPF/CNPJ → `documento_recebido`
  - `documento_recebido` + `alterar_entrega` + `1` → `acao_alteracao_recebida` (metadata: `acao_alteracao=adiantar`)
  - `documento_recebido` + `alterar_entrega` + `2` → `acao_alteracao_recebida` (metadata: `acao_alteracao=postergar`)
  - `documento_recebido` + `alterar_entrega` + `3` → salva mensagem (voltar_menu)
  - Opcao 1/2 apos CPF nao e mais interpretada como nova solicitacao
- Mascaramento de CPF/CNPJ na coluna "Ult. Msg Cliente": se mensagem for 11 ou 14 digitos, exibe `[documento informado]`
- Tickets incorretos ja criados (`b40be95b-535`, `8544a825-31a`) podem ser finalizados manualmente pela tela
- Typecheck: 0 erros
- Lint: 0 erros

### 2026-07-08 — Cascade — Teste real validado + mascaramento na API listar

- Teste real da maquina de estados validado com numero autorizado 554192350811:
  1. Cliente enviou `2` → status=ativa, estado=aguardando_documento, tipo_solicitacao=alterar_entrega ✓
  2. Cliente enviou CPF puro (11 digitos) → status=ativa, estado=documento_recebido ✓
  3. Cliente enviou `2` (postergar) → status=ativa, estado=acao_alteracao_recebida ✓
- Maquina de estados confirmada funcionando corretamente
- Pendencia corrigida: CPF completo aparecia em "Ult. Msg Cliente" na tela
- Causa: a funcao `mascararMensagem` ja existia no PageClient mas a API listar retornava dado cru
- Correcao: adicionada funcao `mascararDocumentoMensagem` na API listar (`src/app/api/pos-venda/atendimento-automatico/listar/route.ts`) que aplica o mesmo mascaramento antes de retornar
- Defesa em profundidade: mascaramento aplicado tanto na API quanto na tela
- Regras de mascaramento: 11 digitos = CPF, 14 digitos = CNPJ, exibe `[documento informado]`; mensagens comuns (`1`, `2`, `quero alterar data de entrega`) nao sao mascaradas
- Typecheck: 0 erros
- Lint: 0 erros

### 2026-07-08 — Cascade — Consulta Google Sheets de controle de agenda por CPF/CNPJ

- Nova Fase 1B: apos captura de CPF/CNPJ, consultar planilha `N8N- CONTROLE AGENDA` (spreadsheet ID `1H8mFLzEL8XcFh0UX_hOJF-ublRZcdbhwLc7ooNEeJ5U`, gid `1227722067`)
- Service account identificada para acesso a planilha: `gmail-nfe-lebebeapp@lebebe-app.iam.gserviceaccount.com` (usando credenciais existentes `GMAIL_SERVICE_EMAIL` + `GMAIL_PRIVATE_KEY` com escopo `spreadsheets.readonly`)
- Helper criado: `src/lib/google/sheets-service-account.ts` com funcao `buscarAgendamentosPorDocumento`
- Leitura via Google Sheets API v4 com autenticacao JWT de service account (sem impersonation, sem domain-wide delegation)
- Range lido: `'N8N- CONTROLE AGENDA'!A:AZ` (escapado automaticamente); busca na coluna `CPF` normalizada (remove nao-digitos)
- Retorna todas as linhas encontradas; ignora linhas vazias e cabecalhos duplicados; nao escreve na planilha
- Estados novos:
  - `pedido_localizado`: encontrou 1 ou mais agendamentos
  - `pedido_nao_localizado`: nao encontrou
  - `erro_busca_agenda`: falha de API/acesso
- Metadata salvo:
  - `metadata.agendamentos_encontrados`: array estruturado com campos (filial_venda, nome_cliente, pedido_venda, data_agenda_google, status_estoque, quanto_tempo_entrega, produtos_pendentes, endereco_cliente, produtos_lancamento, equipe_agenda, pendente_pagamento, cpf_mascarado, tempo_servico, evento_id, calendar_id)
  - `metadata.total_agendamentos_encontrados`
  - `metadata.busca_agenda_status`
  - `metadata.busca_agenda_em`
  - `metadata.busca_agenda_erro` (somente em caso de erro, sem secrets/payload)
- Acoes `1`/`2` (adiantar/postergar) continuam funcionando a partir de `pedido_localizado`, `pedido_nao_localizado` ou `documento_recebido` (compatibilidade com sessoes ja existentes)
- Tela atualizada com coluna "Pedido" mostrando resumo (total + primeiro pedido + cliente + data); tooltip com detalhes de todos os agendamentos; CPF sempre mascarado
- Variaveis de ambiente novas: `GOOGLE_AGENDA_CONTROLE_SPREADSHEET_ID`, `GOOGLE_AGENDA_CONTROLE_SHEET_NAME`, `GOOGLE_AGENDA_CONTROLE_SHEET_GID` adicionadas ao `.env.local` e `.env.example`
- Runtime `nodejs` adicionado a `src/app/api/digisac/webhook/posvenda/route.ts` para permitir uso do `googleapis`
- Nao responde cliente automaticamente
- Nao chama IA, `/procurar-datas`, motor, agenda, worker, debounce
- Typecheck: 0 erros
- Lint: 0 erros

### 2026-07-08 — Cascade — Agrupamento de entregas por data e endereco

- Regra de negocio antiga n8n confirmada: agrupar pedidos/agendamentos por `Data na agenda GOOGLE + ENDERECO DO CLIENTE normalizado`
- Helper atualizado: `src/lib/google/sheets-service-account.ts` ganha funcao `agruparAgendamentosPorEntrega` e tipos `GrupoAgendamento`/`EventoGrupo`
- Normalizacao de chave: `trim`, `lowercase`, remove acentos, trata pontuacao simples (`,`, `.`, `;`, `:`, `!`, `?`, `-`, `/`) como espacos, reduz espacos multiplos
- Nao usa geocoding, nao chama API externa
- Para cada grupo sao salvos: `indice`, `nome_cliente`, `cpf_mascarado`, `data_entrega`, `endereco_completo`, `endereco_curto`, `pedidos_venda` (sem duplicar), `produtos` (concatenados de `produtos_lancamento` separados por `;`, sem duplicar), `tempo_para_entrega`, `tempo_servico`, `equipe_agenda`, `pendente_pagamento`, `status_estoque`, `produtos_pendentes`, `eventos` (array com `evento_id`, `calendar_id`, `pedido_venda`, etc.), `itens_originais`
- Estados ajustados:
  - `pedido_localizado`: 1 grupo encontrado; `grupo_agendamento_selecionado = 1`
  - `aguardando_escolha_grupo`: 2 ou mais grupos encontrados; `grupo_agendamento_selecionado = null`
  - `pedido_nao_localizado`: 0 registros; `total_grupos_agendamento = 0`
- Webhook `src/lib/atendimento-automatico/webhook-processor.ts` atualizado para decidir estado pela contagem de grupos, nao apenas pela contagem de registros
- Acoes `1`/`2` (adiantar/postergar) permanecem permitidas apenas para `documento_recebido`, `pedido_localizado` e `pedido_nao_localizado`; **nao** permitidas em `aguardando_escolha_grupo`, evitando seguir automaticamente sem escolha de grupo
- Metadata expandida: `grupos_agendamento`, `total_grupos_agendamento`, `grupo_agendamento_selecionado` (além de `agendamentos_encontrados`, `total_agendamentos_encontrados`, `busca_agenda_status`)
- Tela `PageClient.tsx` ajustada para exibir `N entregas` vs `M registros`, evitando confusao entre registros e grupos
  - 1 grupo: `1 entrega • X pedido(s) • Pedidos: A, B • Cliente • Data`
  - 2+ grupos: `N entregas encontradas • escolha necessária`
- Testes unitarios criados: `src/lib/google/sheets-service-account.test.ts` (7 casos cobrindo mesma data/endereco, enderecos diferentes, datas diferentes, 1 registro, vazio, duplicados, normalizacao de endereco)
- Typecheck: 0 erros
- Lint: 0 erros
- Testes: 7 passaram

### 2026-07-08 — Cascade — Escolha de grupo, confirmacao de pedido e resposta sugerida/automatica

- Estados novos: `aguardando_confirmacao_pedido`, `aguardando_escolha_grupo`, `aguardando_escolha_acao`, `pedido_confirmado`, `pedido_confirmado_acao_recebida`
- Fluxo ajustado apos recebimento do CPF:
  - 0 registros → `pedido_nao_localizado` + resposta sugerida pedindo CPF novamente
  - 1 grupo → `aguardando_confirmacao_pedido` + resposta sugerida confirmando entrega unica
  - 2+ grupos → `aguardando_escolha_grupo` + resposta sugerida listando opcoes
- Escolha de grupo:
  - Cliente envia numero valido entre 1 e total de grupos → `grupo_agendamento_selecionado = numero`, estado → `aguardando_confirmacao_pedido`
  - Cliente envia numero invalido → mantem `aguardando_escolha_grupo` + resposta sugerida pedindo opcao valida
- Confirmacao de pedido:
  - Respostas positivas (`sim`, `esta correto`, `e esse`, `pode ser`, etc.) → `pedido_confirmado = true`
  - `tipo_solicitacao = confirmar_entrega` → `pedido_confirmado` + resposta final com data
  - `tipo_solicitacao = alterar_entrega` + acao ja escolhida → `pedido_confirmado_acao_recebida`
  - `tipo_solicitacao = alterar_entrega` + sem acao → `aguardando_escolha_acao` + pergunta 1/2
  - Respostas negativas (`nao`, `errado`, `outro`, etc.) → `pedido_confirmado = false` + resposta pedindo esclarecimento
- Acao de alteracao:
  - Estado `aguardando_escolha_acao`: `1` = adiantar, `2` = postergar → `acao_alteracao_recebida`
  - Bloco legado `documento_recebido/pedido_localizado/pedido_nao_localizado` preservado, agora tambem gera resposta sugerida
- Resposta sugerida sempre salva em metadata: `resposta_sugerida`, `resposta_sugerida_tipo`, `resposta_sugerida_em`
- Envio automatico protegido por `ATENDIMENTO_POSVENDA_AUTO_REPLY_ENABLED` (default `false`)
  - Somente envia se variavel === `"true"`, telefone autorizado, contactId e ticketId presentes
  - Idempotencia por `metadata.ultima_resposta_automatica_chave` composta por `sessaoId:estado:tipoResposta:messageId`
  - Registra `resposta_automatica_enviada`, `resposta_automatica_enviada_em`, `resposta_automatica_digisac_message_id` ou `resposta_automatica_erro`
- Helper de envio criado: `src/lib/digisac/enviar-mensagem.ts` (POST `/messages` com `text`, `type: 'chat'`, `contactId`, `ticketId`, `fromMe: true`)
- Helpers de resposta criados: `src/lib/atendimento-automatico/respostas.ts` + testes em `src/lib/atendimento-automatico/respostas.test.ts`
- Tela atualizada com colunas `Situação` (registros, entregas, grupo selecionado, confirmacao) e `Resposta Sugerida` (texto, tipo, badge auto/sugerida)
- Variavel de ambiente adicionada: `ATENDIMENTO_POSVENDA_AUTO_REPLY_ENABLED=false` em `.env.local` e `.env.example`
- Nao chama IA, nao chama `/procurar-datas`, nao altera motor, agenda ou Google Calendar
- Nao responde automaticamente se env estiver desabilitada
- Typecheck: 0 erros
- Lint: 0 erros
- Testes: 15 passaram (7 agrupamento + 8 respostas)

### 2026-07-08 — Cascade — Correcao para aceitar 1/2 como acao em aguardando_confirmacao_pedido com 1 grupo

- Problema observado em teste real: cliente em `aguardando_confirmacao_pedido` com `alterar_entrega` e 1 grupo enviou `2`, mas sistema manteve estado e resposta sugerida de confirmacao
- Regra adicionada: em `aguardando_confirmacao_pedido` + `alterar_entrega` + `total_grupos_agendamento = 1` + `grupo_agendamento_selecionado = 1`, mensagens `1` e `2` sao interpretadas como acoes de alteracao:
  - `1` → `metadata.acao_alteracao = "adiantar"`, `metadata.pedido_confirmado = true`, estado → `pedido_confirmado_acao_recebida`
  - `2` → `metadata.acao_alteracao = "postergar"`, `metadata.pedido_confirmado = true`, estado → `pedido_confirmado_acao_recebida`
- Prioridade de interpretacao mantida:
  1. `aguardando_escolha_grupo`: numeros continuam sendo escolha de grupo
  2. `aguardando_confirmacao_pedido` + `alterar_entrega` + 1 grupo: `1`/`2` sao acoes
  3. `aguardando_confirmacao_pedido`: confirmacoes textuais (`sim`, `esta correto`, etc.)
  4. Outros casos: comportamento atual
- Nao chama `/procurar-datas`, nao altera agenda, nao chama IA
- Testes atualizados: adicionados testes para `respostaPedidoConfirmadoAlterarAcaoJaEscolhida`, `respostaPedidoConfirmadoAlterarEscolherAcao`, `respostaPedidoNegado`
- Typecheck: 0 erros
- Lint: 0 erros
- Testes: 11 passaram (respostas)

### 2026-07-08 — Cascade — Correcao de pausa indevida por eco de auto-reply

- Problema observado em teste real: resposta automatica enviada pela Mere voltou como webhook `message.created` com `isFromMe=true`, `isFromBot=false`, foi classificada como `humano` e pausou a sessao por 24h
- Causa: `detectarOrigem` classifica `isFromMe=true && isFromBot=false` como `humano`; mensagens enviadas via API pelo Le Bebe App nao tem marcador proprio no Digisac para diferenciar de agente humano real
- Solucao: antes de tratar como humano, verificar se `messageId` do webhook bate com:
  - `metadata.resposta_automatica_digisac_message_id` (ultimo id enviado)
  - `metadata.respostas_automaticas_enviadas_ids` (lista acumulada de todos os ids enviados)
  - Se bater: ignorar para pausa, salvar no historico como `bot` com flag `auto_reply_eco: true`, retornar `auto_reply_propria`
- Humano real continua pausando: somente ignora se `messageId` constar na lista/campo da sessao
- Acumulacao de ids: `construirMetadataComResposta` agora adiciona o id retornado pelo Digisac em `metadata.respostas_automaticas_enviadas_ids` (array), garantindo que mais de uma mensagem automatica seja reconhecida
- Fluxo apos confirmacao: nao afetado; cliente responde `sim`, estado avanca normalmente por `aguardando_confirmacao_pedido`
- Nao altera logica de pausa humana real, nao chama `/procurar-datas`, nao altera agenda, nao chama IA
- Typecheck: 0 erros
- Lint: 0 erros
- Testes: 18 passaram (11 respostas + 7 agrupamento)

### 2026-07-08 — Cascade — Fluxo pos-acao: confirmacao de endereco e data desejada

- Regra antiga trazida do legado: apos escolher adiantar/postergar, confirmar endereco antes de perguntar data
- Regras de bloqueio implementadas antes de perguntar endereco:
  - Adiantar: produto pendente → transferido_humano; pendencia pagamento → transferido_humano; prazo <= 7 dias → transferido_humano
  - Postergar: prazo <= 2 dias → transferido_humano; acima de 2 dias → segue para confirmacao de endereco
- Novos estados adicionados: `aguardando_confirmacao_endereco`, `aguardando_data_desejada`, `transferido_humano`
- Mensagem substituida: a resposta ruim `A proxima etapa sera avaliar as datas disponiveis` foi substituida por mensagem de confirmacao de endereco
- Mensagem pos-endereco confirmado: `Perfeito! A partir de qual data gostaria de receber?`
- Cliente diz que endereco mudou: estado `transferido_humano`, motivo `alteracao_endereco`
- Estado `aguardando_data_desejada`: salva `metadata.data_desejada_texto`; nao chama `/procurar-datas` ainda
- Bloqueios registram `metadata.precisa_humano_por_regra = true` e `metadata.motivo_bloqueio_acao`
- Ambos os pontos de entrada de acao (aguardando_escolha_acao e bloco legado documento_recebido) atualizados
- Nao chama `/procurar-datas`, nao altera agenda, nao chama IA
- Typecheck: 0 erros
- Lint: 0 erros (0 warnings)
- Testes: 19 passaram (respostas.test.ts)

### 2026-07-08 — Cascade — Parser de data natural, correcao de status e estado data_desejada_recebida

- Novo helper puro `interpretarDataDesejada(texto, hoje)` em `interpretar-data.ts`
- Formatos aceitos: `13/07`, `13/07/2026`, `13-07-2026`, `dia 13`, `dia 13/07`, `amanha`, `depois de amanha`, `segunda`, `terca`, `quarta`, `quinta`, `sexta`, `sabado`, `domingo`, `[dia] que vem`
- Regra dia da semana: proxima ocorrencia futura; "que vem" forca sempre para semana seguinte
- Teste real validado: `segunda que vem` com hoje=08/07/2026 retorna `2026-07-13`
- Novo helper `validarDataDesejadaParaAcao(params)`: valida D+2, D+90, anterior/posterior conforme acao
- Bloco `aguardando_data_desejada` reescrito:
  - data nao interpretada: manter estado, resposta pedindo nova data
  - data invalida por regra (antes D+2, fora da janela de acao): manter estado, resposta especifica
  - data fora de D+90: encaminhar para humano, `status = transferido_humano`
  - data valida: avancar para `data_desejada_recebida`, salvar `data_desejada_iso`, `data_desejada_br`, `data_desejada_texto_original`, `data_desejada_interpretada_em`, `data_desejada_valida_para_acao`
- Correcao de status: todos os 4 pontos de bloqueio por regra agora gravam `status = 'transferido_humano'`
  - bloqueio de acao em `aguardando_escolha_acao`
  - bloqueio de acao em bloco legado `documento_recebido`
  - alteracao de endereco em `aguardando_confirmacao_endereco`
  - data D+90 em `aguardando_data_desejada`
- Tela: `STATUS_COLORS` incluiu `transferido_humano` (roxo), filtro de status incluiu opcao, `resumoSituacao` exibe acao, end. confirmado/pendente, data desejada, motivo de bloqueio
- Nao chama `/procurar-datas`, nao altera agenda, nao chama IA
- Typecheck: 0 erros
- Lint: 0 erros, 0 warnings
- Testes: 42 passaram (23 interpretar-data + 19 respostas)

### 2026-07-09 - Codex - Diagnostico e correcao do erro motor_v2_retornou_erro

- Causa real confirmada no MCP Supabase para a sessao `fa6edeca-67e1-4cf4-b4eb-71d6c34a29f5`: o motor v2 retornou `ok=false` por `tempoNecessario ausente ou invalido.`
- Payload da Mere estava usando `TEMPO DO SERVICO` do primeiro registro do grupo como `00:00`; outro item/evento da mesma entrega tinha `00:40`.
- `QUANTO TEMPO PRA ENTREGA?` estava como `8` e nao foi usado como tempo de servico.
- Correcao: helper da Mere agora resolve o primeiro tempo de servico valido dentro do grupo (`grupo.tempo_servico`, eventos e itens originais), normalizando `00:40`, `40 min` e `40` para `HH:MM`.
- Se nenhum `TEMPO DO SERVICO` valido existir, a consulta nao chama o motor e transfere com motivo `tempo_servico_indisponivel`.
- Agrupamento da planilha tambem passa a trocar `00:00` por outro tempo valido do mesmo grupo nas proximas sessoes.
- Logs/metadata de erro da consulta agora incluem codigo, mensagem, stack resumido quando houver excecao, resumo seguro do payload, campos presentes/ausentes, retorno bruto resumido, helper usado e motor usado.
- Nao alterado: motor `/procurar-datas`, OSRM/Haversine, Google Calendar, agenda, escrita em planilha, regra de negocio de ranking/classificacao.
- Validacoes: lint dos arquivos alterados passou; `consulta-datas-mere.test.ts` + `sheets-service-account.test.ts` passaram (11 testes); `entrada.test.ts` + `tempo.test.ts` passaram (58 testes); `npx tsc --noEmit --pretty` passou.
- Pendencia: deploy/rebuild e repetir fluxo real `2 -> CPF -> sim -> postergar -> sim endereco -> 30-07`.

### 2026-07-09 - Codex - Confirmacao final e dry-run de reagendamento Google Calendar

- Fluxo alterado apos `datas_encontradas`: a escolha de uma data nao encerra mais em `data_opcao_selecionada`.
- Novo estado: `aguardando_confirmacao_reagendamento`.
- Metadata salva ao selecionar a opcao:
  - `data_original_br`
  - `data_original_iso`
  - `data_nova_br`
  - `data_nova_iso`
  - `data_opcao_selecionada_indice`
  - `confirmacao_reagendamento_pendente=true`
  - `resposta_sugerida_tipo="confirmar_reagendamento_final"`
- Confirmacao positiva usa `interpretarConfirmacao` existente e chama helper de reagendamento.
- Confirmacao negativa nao altera agenda e volta para `datas_encontradas` quando `datas_disponiveis` ainda existe; sem opcoes, transfere para humano.
- Resposta ambigua mantem `aguardando_confirmacao_reagendamento` e pede "sim" ou "nao".
- Escrita em Google Calendar protegida por `ATENDIMENTO_POSVENDA_CALENDAR_WRITE_ENABLED`.
  - Qualquer valor diferente de `true` executa dry-run.
  - Dry-run grava `calendar_write_status="dry_run"` e nao afirma ao cliente que a agenda foi alterada.
- Calendario de duplicacao usa `GOOGLE_CALENDAR_REAGENDAMENTO_REM_CLIENTE_ID` ou fallback `c_5d423c9be1ad48fe2ec6f15e571fe0879b703d3c60d27245d024413c09e73bd8@group.calendar.google.com`.
- Helper deduplica por `calendar_id + evento_id`, exige evento original all-day, duplica primeiro no calendario de "8.2- REAGENDAMENTO (REM. CLIENTE)" com prefixo `[REAG. AUTOMATICO]`, e so depois atualiza o original para a nova data.
- Se a duplicacao falhar, o original nao e movido. Se mover falhar depois de duplicar, registra falha parcial critica e transfere para humano, sem apagar duplicata automaticamente.
- Parser de escolha de data aceita numero da opcao e tambem datas como `dia 03`, `03`, `03/08`, `03/08/2026` e `3 de agosto`; quando a data for ambigua, pede escolha numerica.
- Painel administrativo exibe resumo de confirmacao pendente, data original/nova, status de Calendar, quantidade de eventos e erros.
- Nao alterado: motor `/procurar-datas`, OSRM, ranking/classificacao, consulta de datas, regras de frete, pre-agendamento Apps Script.
- Validacoes: MCP Supabase confirmou `atendimento_automatico_sessoes.metadata` jsonb e colunas usadas; testes focados de respostas, parser e Calendar passaram; TypeScript e ESLint passaram.
- Pendencias: validar em ambiente real com `ATENDIMENTO_POSVENDA_CALENDAR_WRITE_ENABLED=false` primeiro; depois, se o dry-run estiver correto, habilitar `true` em janela controlada e testar com evento all-day de baixo risco.

### 2026-07-09 - Codex - Pedido negado e retentativa por novo CPF/CNPJ

- Problema real observado: cliente negou a entrega localizada em `aguardando_confirmacao_pedido`, recebeu pedido de novo CPF/CNPJ, mas ao enviar outro documento o fluxo ainda estava em `aguardando_confirmacao_pedido` e tratou o CPF como confirmacao ambigua.
- Causa confirmada no codigo: o branch de negacao gravava `metadata.pedido_confirmado=false`, mas nao alterava `estado`; a proxima mensagem seguia no fallback de confirmacao de pedido.
- Novo estado: `aguardando_novo_documento_ou_esclarecimento`.
- Quando o cliente nega a entrega localizada:
  - salva `metadata.pedido_confirmado=false`;
  - salva `metadata.pedido_negado_em`;
  - salva `metadata.motivo_pedido_negado="cliente_informou_entrega_incorreta"`;
  - muda `estado` para `aguardando_novo_documento_ou_esclarecimento`;
  - mantem `status="ativa"`;
  - responde solicitando conferencia do CPF/CNPJ ou breve explicacao.
- Quando o cliente envia CPF/CNPJ valido nesse novo estado:
  - normaliza documento;
  - substitui `documento_informado`;
  - salva `documento_anterior_mascarado`, `documento_retentativa_mascarado`, `retentativa_documento_em` e incrementa `tentativas_documento`;
  - reusa a consulta atual da planilha (`buscarAgendamentosPorDocumento`);
  - se encontrar 1 grupo, volta para `aguardando_confirmacao_pedido`;
  - se encontrar multiplos grupos, vai para `aguardando_escolha_grupo`;
  - se nao encontrar, transfere para humano com motivo `novo_documento_nao_localizado`.
- Quando o cliente envia texto sem CPF/CNPJ nesse novo estado:
  - primeira tentativa: mantem estado e responde pedindo CPF/CNPJ;
  - segunda tentativa: transfere para humano com motivo `sem_documento_para_relocalizar_pedido`.
- Preparacao futura para IA: este estado e o ponto correto para uma futura camada de classificacao quando a mensagem nao trouxer CPF/CNPJ. A IA devera classificar se o cliente informou outro dado util, pediu humano, esta confuso, nao tem CPF ou quer cancelar; transferencia deve ocorrer apenas quando a intencao exigir humano ou quando a confianca for insuficiente. IA nao foi implementada nesta tarefa.
- Tela administrativa: resumo de situacao passa a exibir `pedido negado` e o novo documento mascarado quando houver retentativa.
- Nao alterado: `/procurar-datas`, motor v2, Google Calendar, agenda, escrita em planilha, allowlist, eco de auto-reply, confirmacao positiva, escolha de acao, confirmacao de endereco, parser de data, consulta de datas e confirmacao final de reagendamento.
- Validacoes: MCP Supabase confirmou colunas/tipos das tabelas de atendimento automatico; testes focados do processador e respostas passaram; TypeScript e ESLint passaram.
- Observacao: `.devin` existe, mas a leitura direta retornou acesso negado nesta sessao; conteudo nao confirmado no codigo.
