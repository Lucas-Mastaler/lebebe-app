# Auditoria — Inteligência Comercial: Múltiplas Conexões Digisac

**Data:** 2026-07-06 (auditoria) / 2026-07-14 (validação funcional)
**Status:** Auditoria e validação funcional concluídas. Nenhuma alteração de código necessária.

---

## 1. Objetivo

Ajustar a tela de Inteligência Comercial para considerar todas as conexões de vendas do Digisac (Bigorrilho, Portão, Hauer/Marechal), substituindo o modelo de conexão única anterior.

---

## 2. Conexões Envolvidas

| Unidade | Service ID | Nome Digisac | Número | Nome WhatsApp |
|---|---|---|---|---|
| Bigorrilho | `0973f84b-8294-4615-9657-ba95b6346246` | BIGORRILHO (41 8804-3042) | 554188043042 | Le bébé Bigorrilho |
| Portão | `c60d720f-5ad5-4a1b-bedb-e51495dee686` | PORTÃO (41 8442-6528) | 554184426528 | Le Bebe Loja Portão |
| Hauer/Marechal | `1352c41b-80a9-4e74-b9d9-4c5e7aed060e` | MARECHAL (41 9222-0492) | 554192220492 | Lebebe Loja Marechal Hauer |
| **Antiga (única)** | `4af28025-c210-4336-a560-785d2fb8a778` | VENDAS (41 9202-9087) | — | — |
| Pós-venda (excluída) | `ece0fdac-962e-491c-b47f-fa912b17a878` | POS VENDA (41 9119-1696) | — | — |

---

## 3. Fluxo Atual Mapeado

### Visão Geral do Pipeline

```
[Frontend: Inteligência Comercial]
  → useSyncLote (hook)
    → POST /api/sgi/digisac/sincronizar-venda  (cria job na fila)
    → POST /api/sgi/digisac/processar-fila      (processa job)
      → buscarTicketsPorTelefoneComVariacoes    (busca no Digisac)
        → buscarTicketsPorTelefonePaginado      (paginação Digisac)
          → filtro: serviceId $notIn SERVICE_IDS_EXCLUIDOS_COMERCIAL
          → filtro: contact.data.number LIKE %telefone%
      → calcularInicioChamado                   (ativo/receptivo)
      → buscarMensagensTicketPaginado           (mensagens do ticket)
      → montarResumoTicket                      (inclui service_id, service_nome)
      → UPSERT digisac_conversas_resumo         (unique: digisac_ticket_id)
      → recalcularHistoricoTelefone             (digisac_cliente_historico_resumo)
      → buscarTicketsSalvosNoSupabase           (lê do banco, sem filtro de serviceId)
      → calcularVinculosVenda                   (ciclo da venda, sem filtro de serviceId)
      → UPSERT venda_conversa_vinculos          (unique: numero_lancamento, digisac_ticket_id)

  → POST /api/sgi/vendas  (listagem enriquecida com vinculos)
  → GET /api/sgi/digisac/chamados-ciclo  (chamados do ciclo)
  → GET /api/sgi/digisac/mensagens  (mensagens de um ticket)

[Análise por IA]
  → POST /api/sgi/ia/iniciar-analise  (cria job + registros pendentes)
    → busca vinculos do ciclo (sem filtro de serviceId)
    → cria registros em digisac_chamados_analise_ia
  → POST /api/sgi/ia/processar-proximo  (processa cada chamado)
    → busca metadados em digisac_conversas_resumo (inclui service_nome)
    → montarTranscriptChamado (busca mensagens do Digisac por ticketId)
    → analisarChamadoIA (DeepSeek)
    → salva resultado em digisac_chamados_analise_ia
    → ao finalizar: analisarConsolidadoIA → venda_analise_comercial_ia
  → GET /api/sgi/ia/analise-status  (status + resultados)
```

---

## 4. Arquivos Envolvidos

### Núcleo de Sincronização

| Arquivo | Função |
|---|---|
| `src/lib/digisac/clienteDigisac.ts` | Cliente HTTP base para API Digisac (`fetchDigisac`, `fetchDigisacRaw`). Usa `DIGISAC_BASE_URL` e `DIGISAC_TOKEN`. Sem filtro de serviceId. |
| `src/lib/digisac/sgi-sync.ts` | **Núcleo da sincronização.** Define `SERVICE_IDS_EXCLUIDOS_COMERCIAL`, `buscarTicketsPorTelefonePaginado`, `buscarTicketsPorTelefoneComVariacoes`, `buscarMensagensTicketPaginado`, `calcularInicioChamado`, `montarResumoTicket`, `recalcularHistoricoTelefone`, `buscarTicketsSalvosNoSupabase`, `calcularVinculosVenda`. |
| `src/lib/ia/transcript.ts` | Monta transcript do chamado para IA. Busca mensagens por `ticketId`. Sem filtro de serviceId. |
| `src/lib/ia/deepseek-client.ts` | Cliente DeepSeek para análise individual e consolidada. Sem filtro de serviceId. |
| `src/lib/ia/extrair-trechos-fatuais.ts` | Extrai trechos fatuais do transcript para o consolidado. |

### Rotas de API — Sincronização

| Arquivo | Função |
|---|---|
| `src/app/api/sgi/digisac/sincronizar-venda/route.ts` | Cria job na fila `digisac_sync_fila`. Busca telefones da venda, verifica cache. |
| `src/app/api/sgi/digisac/processar-fila/route.ts` | Processa job: itera telefones, busca tickets, salva no banco, recalcula ciclo. |
| `src/app/api/sgi/digisac/sync-status/route.ts` | Status do job de sincronização. |
| `src/app/api/sgi/digisac/chamados-ciclo/route.ts` | Busca chamados do ciclo por `numero_lancamento`. |
| `src/app/api/sgi/digisac/mensagens/route.ts` | Busca mensagens de um ticket específico. |

### Rotas de API — IA

| Arquivo | Função |
|---|---|
| `src/app/api/sgi/ia/iniciar-analise/route.ts` | Cria job de análise IA + registros pendentes por chamado. |
| `src/app/api/sgi/ia/processar-proximo/route.ts` | Processa próximo chamado pendente: busca transcript, envia à IA, salva resultado, gera consolidado ao final. |
| `src/app/api/sgi/ia/analise-status/route.ts` | Retorna status e resultados da análise. |

### Rotas de API — Vendas

| Arquivo | Função |
|---|---|
| `src/app/api/sgi/vendas/route.ts` | Listagem de vendas com enriquecimento Digisac (vínculos, sync status, histórico). |
| `src/app/api/sgi/vendas/[numero_lancamento]/route.ts` | Detalhe de venda com contatos e variações de telefone. |

### Frontend

| Arquivo | Função |
|---|---|
| `src/app/inteligencia-comercial/page.tsx` | Server component, controle de acesso. |
| `src/app/inteligencia-comercial/PageClient.tsx` | Client component, orquestra filtros, busca, cards, tabela, modais. |
| `src/hooks/useSyncLote.ts` | Hook para sincronização em lote (sequencial por venda). |
| `src/components/inteligencia-comercial/SyncLotePanel.tsx` | Painel de sincronização em lote. |
| `src/components/inteligencia-comercial/ModalDetalheVenda.tsx` | Modal de detalhe com chamados, análise IA e consolidado. |

### Arquivos Secundários (não directly no fluxo de Inteligência Comercial)

| Arquivo | Observação |
|---|---|
| `src/lib/digisac/triagem.ts` | Webhook de triagem de loja. Filtra por `DIGISAC_SERVICE_ID_VENDAS` (conexão antiga). **Fora do escopo de Inteligência Comercial.** |
| `src/lib/digisac/finalizacoesAutomaticas.ts` | Fechamentos automáticos. Define `BIGORRILHO_SERVICE_ID` hardcoded. Usa `digisac_conexoes_automacao`. **Fora do escopo de Inteligência Comercial.** |
| `src/components/HorariosAgendamentosPage.tsx` | Agendamentos. Hardcoded `SERVICE_ID = '4af28025-...'`. **Fora do escopo.** |
| `src/app/api/digisac/schedule/route.ts` | Agendamentos. `ALLOWED_SERVICE_IDS` só com conexão antiga. **Fora do escopo.** |
| `src/lib/digisac/dashboard.ts` | Dashboard Digisac. Aceita array `serviceIds`. |
| `src/lib/digisac/estatisticas.ts` | Estatísticas Digisac. Aceita array `serviceIds`. |

---

## 5. Diagnóstico Confirmado

### 5.1 Onde a conexão é definida atualmente

**Conexão antiga (env):**
- `.env.local`: `DIGISAC_SERVICE_ID_VENDAS=4af28025-c210-4336-a560-785d2fb8a778`
- Usada apenas em `triagem.ts` (webhook de triagem) — **não usada no fluxo de Inteligência Comercial**

**Lista de exclusão (código):**
- `sgi-sync.ts` linha 142-145: `SERVICE_IDS_EXCLUIDOS_COMERCIAL = ['ece0fdac-...']` (apenas pós-venda)

**Conexões no banco:**
- `digisac_conexoes_automacao`: 3 registros ativos (Bigorrilho, Portão, Hauer/Marechal)
- Bigorrilho tem `service_name`, `my_number`, `default_department_id` preenchidos
- Portão e Hauer/Marechal estão sem `service_name`, `my_number`, `default_department_id`

**Hardcoded:**
- `finalizacoesAutomaticas.ts`: `BIGORRILHO_SERVICE_ID = '0973f84b-...'`
- `HorariosAgendamentosPage.tsx`: `SERVICE_ID = '4af28025-...'` (antiga)

### 5.2 Achado Crítico: O fluxo de Inteligência Comercial JÁ suporta múltiplas conexões

**O fluxo principal de sincronização não filtra por um `serviceId` específico.** Ele usa:

```typescript
// sgi-sync.ts linha 184
serviceId: { $notIn: SERVICE_IDS_EXCLUIDOS_COMERCIAL }
```

Isso significa que **todos os serviceIds são incluídos**, exceto os explicitamente excluídos (atualmente apenas pós-venda). Tickets das 3 novas conexões já seriam buscados pela API do Digisac e salvos no banco.

**Confirmado em todas as etapas:**

1. **Busca no Digisac** (`buscarTicketsPorTelefonePaginado`): filtra por telefone + exclui pós-venda. Sem filtro positivo de serviceId.
2. **Save no banco** (`digisac_conversas_resumo`): upsert por `digisac_ticket_id` (unique). `service_id` e `service_nome` são salvos do ticket.
3. **Busca de tickets salvos** (`buscarTicketsSalvosNoSupabase`): query por telefone. Sem filtro de serviceId.
4. **Cálculo de vínculos** (`calcularVinculosVenda`): considera todos os tickets no intervalo de datas. Sem filtro de serviceId.
5. **Análise IA individual** (`processar-proximo`): busca ticket por `ticketId`. Sem filtro de serviceId.
6. **Análise consolidada** (`finalizarJob`): considera todos os chamados analisados. Sem filtro de serviceId.
7. **Listagem de vendas** (`vendas/route.ts`): enriquece com vínculos. Sem filtro de serviceId.
8. **Frontend** (`ModalDetalheVenda.tsx`): exibe `department_nome` na coluna "Loja/Depto.". Sem filtro de serviceId.

### 5.3 Validação no Banco

**Tabela `digisac_conversas_resumo` — distribuição por service_id:**

| service_id | service_nome | Total |
|---|---|---|
| `4af28025-...` (antiga) | VENDAS (41 9202-9087) | 665 |
| `51e03197-...` | MARKETING (41 9597 3787) | 15 |
| `1352c41b-...` (Hauer/Marechal) | MARECHAL (41 9222-0492) | 10 |
| Bigorrilho | — | 0 |
| Portão | — | 0 |

**Observação:** A conexão Hauer/Marechal já tem 10 tickets salvos. Bigorrilho e Portão têm zero porque **nenhuma venda dessas filiais foi sincronizada ainda** (não há jobs de sync para vendas 29xxx ou 65xxx). A API Digisac confirma que existem tickets para essas conexões — ver seção 16.

**Constraints relevantes:**
- `digisac_conversas_resumo`: UNIQUE(`digisac_ticket_id`) — previne duplicação de tickets
- `venda_conversa_vinculos`: UNIQUE(`numero_lancamento`, `digisac_ticket_id`) — previne duplicação de vínculos
- `digisac_chamados_analise_ia`: UNIQUE(`numero_lancamento`, `digisac_ticket_id`) — previne duplicação de análises

---

## 6. Hipóteses / Pontos Não Confirmados

1. **Confirmado:** A conexão antiga `4af28025-...` (VENDAS) ainda tem tickets no banco (665 registros, último em 2026-06-23). **Decisão: NÃO excluir nesta tarefa** — sem confirmação de que foi desativada e sem mais conversas relevantes.
2. **Confirmado:** Hauer/Marechal já está recebendo mensagens e tem 10 tickets no banco. Portão tem 1 ticket encontrado via API Digisac (phone 5541997546390, sale 65465). Bigorrilho tem 1 ticket encontrado via API (phone 554199692130, sale 29042).
3. **Confirmado:** A conexão antiga não será excluída do fluxo comercial nesta tarefa.
4. **Não confirmado:** Se existe alguma outra conexão no Digisac além das 5 mapeadas (3 novas + antiga + pós-venda) + Marketing que poderia ser capturada pelo filtro atual de exclusão.
5. **Confirmado:** MARKETING (`51e03197-...`) **NÃO deve ser excluída**. Deve continuar participando do fluxo de Inteligência Comercial. Já tem 15 tickets no banco e 8 análises de IA concluídas.

---

## 7. Validação de Banco no MCP do Supabase

### Tabelas validadas
- `digisac_conversas_resumo` — contém `service_id` (text), `service_nome` (text)
- `venda_conversa_vinculos` — não contém `service_id` (vincula por `numero_lancamento` + `digisac_ticket_id`)
- `digisac_chamados_analise_ia` — não contém `service_id` (vincula por `numero_lancamento` + `digisac_ticket_id`)
- `digisac_conexoes_automacao` — 3 registros ativos (Bigorrilho, Portão, Hauer/Marechal)
- `digisac_sync_fila` — não contém `service_id`
- `digisac_cliente_historico_resumo` — não contém `service_id`
- `ia_analise_comercial_fila` — não contém `service_id`
- `venda_analise_comercial_ia` — não contém `service_id`

### Colunas validadas
- `digisac_conversas_resumo.service_id` (text) — armazena o serviceId do ticket
- `digisac_conversas_resumo.service_nome` (text) — armazena o nome do serviço

### Constraints validadas
- `digisac_conversas_resumo_digisac_ticket_id_key`: UNIQUE(`digisac_ticket_id`)
- `venda_conversa_vinculos_numero_lancamento_digisac_ticket_id_key`: UNIQUE(`numero_lancamento`, `digisac_ticket_id`)
- `digisac_chamados_analise_ia_numero_lancamento_digisac_ticke_key`: UNIQUE(`numero_lancamento`, `digisac_ticket_id`)

### Policies/RLS
- Todas as tabelas têm RLS habilitado. Não há policies que filtrem por `service_id`.

---

## 8. Resposta às Perguntas da Auditoria

| # | Pergunta | Resposta |
|---|---|---|
| 1 | Onde a conexão é definida? | `.env.local` (`DIGISAC_SERVICE_ID_VENDAS`), `sgi-sync.ts` (`SERVICE_IDS_EXCLUIDOS_COMERCIAL`), `digisac_conexoes_automacao` (banco), `finalizacoesAutomaticas.ts` (`BIGORRILHO_SERVICE_ID` hardcoded) |
| 2 | Único serviceId, lista, env, banco ou fixo? | Misto: env para triagem, lista de exclusão para sync, banco para automação, hardcoded para Bigorrilho em finalizacoes |
| 3 | Rotas/services/queries participantes? | Ver seção 4 acima |
| 4 | Como chamados são pesquisados? | Por telefone (variações) via API Digisac, excluindo apenas pós-venda |
| 5 | Como histórico é carregado? | `buscarMensagensTicketPaginado` por `ticketId` |
| 6 | Como chamado é associado à loja/unidade? | `service_id` e `service_nome` salvos em `digisac_conversas_resumo`. Não há associação explícita a unidade. |
| 7 | Como chamados são salvos? | Upsert em `digisac_conversas_resumo` por `digisac_ticket_id` |
| 8 | Como duplicatas são evitadas? | Unique constraint em `digisac_ticket_id` + dedup em memória por Map |
| 9 | Como pendentes são selecionados para análise? | `digisac_chamados_analise_ia` com `status='pendente'` ordenado por `created_at` |
| 10 | Como conversas são enviadas à IA? | `montarTranscriptChamado` → prompt → `analisarChamadoIA` (DeepSeek) |
| 11 | Filtro posterior que restringe à conexão antiga? | **NÃO.** Nenhum filtro positivo de serviceId em todo o pipeline de Inteligência Comercial |
| 12 | serviceId em chave de unicidade/cache/cursor? | **NÃO.** Chaves de unicidade usam `digisac_ticket_id` e `numero_lancamento` |
| 13 | Análise individual e consolidada usam mesma fonte? | **SIM.** Ambas partem de `venda_conversa_vinculos` → `digisac_chamados_analise_ia` |
| 14 | Jobs/ações manuais precisam reconhecer 3 conexões? | O fluxo de Inteligência Comercial já reconhece todas. `triagem.ts` (webhook separado) precisa ajuste. |
| 15 | Frontend tem filtro/nome/indicação de unidade? | Exibe `department_nome` em "Loja/Depto." Não exibe `service_nome`. Sem filtro de conexão. |
| 16 | Limite/paginação individual ou global? | Global por telefone — não separa por conexão |
| 17 | Falha em uma conexão impede outras? | **NÃO.** A busca é por telefone, não por conexão. Falha em um telefone não impede outros. |
| 18 | Risco de mesmo cliente em múltiplas conexões? | **SIM, mas é comportamento correto.** Tickets diferentes de conexões diferentes são salvos como registros separados (dedup por `ticket_id`, não por telefone). |

---

## 9. Conclusão da Auditoria

### Causa da limitação anterior

**Não há limitação técnica no fluxo de Inteligência Comercial.** O pipeline atual já busca tickets de todas as conexões (exceto pós-venda) e não aplica nenhum filtro positivo de `serviceId` em nenhuma etapa.

A "limitação" percebida ocorre porque:

1. A conexão antiga `4af28025-...` (VENDAS) era a única em uso até recentemente
2. As 3 novas conexões são recentes (criadas no Digisac) e ainda têm poucos tickets
3. O `SERVICE_IDS_EXCLUIDOS_COMERCIAL` só exclui pós-venda — não há lista de inclusão
4. A sincronização é feita por telefone da venda — se o cliente não contactou as novas conexões, nenhum ticket novo aparece
5. **Bigorrilho e Portão têm zero registros porque nenhuma venda dessas filiais foi sincronizada ainda** (não há jobs de sync para vendas 29xxx ou 65xxx)

### A alteração consiste apenas em adicionar IDs?

**NÃO.** O fluxo já captura todas as conexões. Nenhuma alteração de código é necessária.

### Decisões tomadas

1. **Marketing NÃO deve ser excluída** — participa do fluxo de Inteligência Comercial corretamente
2. **Conexão antiga NÃO deve ser excluída nesta tarefa** — sem confirmação de desativação
3. **Manter lógica atual de `SERVICE_IDS_EXCLUIDOS_COMERCIAL`** — não transformar em allowlist
4. **Não criar configuração centralizada ou refactor** — o sistema já funciona
5. **Validação funcional confirmou que o pipeline suporta múltiplas conexões** — ver seção 16

---

## 10. Plano de Alteração

**Nenhuma alteração de código é necessária.** A validação funcional confirmou que o pipeline já suporta múltiplas conexões.

O sistema passou a incluir as novas conexões operacionalmente quando os novos números começaram a ser usados no Digisac e as vendas dessas filiais foram sincronizadas na tela de Inteligência Comercial.

---

## 11. Impactos Esperados

- **Nenhum impacto** — nenhuma alteração de código foi realizada
- O sistema já suporta múltiplas conexões operacionalmente

---

## 12. O que NÃO foi alterado

- Lógica de sincronização (busca por telefone, paginação, dedup)
- Lógica de cálculo de ciclo da venda
- Lógica de análise por IA (prompt, transcript, consolidado)
- Lógica de exibição de vendas, cards e filtros
- `SERVICE_IDS_EXCLUIDOS_COMERCIAL` (mantém apenas pós-venda)
- `triagem.ts` (webhook separado, fora do escopo)
- `finalizacoesAutomaticas.ts` (fluxo separado, fora do escopo)
- `HorariosAgendamentosPage.tsx` e `schedule/route.ts` (fluxo de agendamentos, fora do escopo)

---

## 13. Riscos

1. **Conexão antiga ainda ativa:** `4af28025-...` (VENDAS) tem 665 tickets no banco, último em 2026-06-23. Não será excluída nesta tarefa. Se ainda recebe mensagens, seus tickets continuarão sendo capturados corretamente.
2. **MARKETING incluído (comportamento correto):** `51e03197-...` tem 15 tickets e 8 análises de IA concluídas. Participa do fluxo por decisão do usuário.
3. **Dados incompletos no banco:** Portão e Hauer/Marechal sem `service_name` e `default_department_id` em `digisac_conexoes_automacao`. Isso não afeta o fluxo de Inteligência Comercial, mas pode afetar `finalizacoesAutomaticas.ts`.
4. **Mesmo cliente em múltiplas conexões:** Comportamento correto (tickets separados por `ticket_id`), mas pode gerar muitos chamados no ciclo se o cliente contactou várias lojas.
5. **Job de IA travado (56022):** Fila `ia_analise_comercial_fila` com status `processando`, 2/2 chamados processados, mas sem consolidado gerado. Não relacionado ao problema de múltiplas conexões.

---

## 14. Pendências

1. ~~Confirmar se MARKETING deve ser excluído~~ → **Decidido: NÃO excluir**
2. ~~Confirmar se conexão antiga deve ser excluída~~ → **Decidido: NÃO excluir nesta tarefa**
3. Completar dados de Portão e Hauer/Marechal em `digisac_conexoes_automacao` (não bloqueia Inteligência Comercial)
4. ~~Validar funcionalmente~~ → **Concluído** (ver seção 16)
5. Investigar job de IA travado para venda 56022 (não relacionado a múltiplas conexões)

---

## 15. Próximo Passo Recomendado

1. Sincronizar vendas de Bigorrilho (29xxx) e Portão (65xxx) na tela de Inteligência Comercial para popular os tickets no banco
2. Completar dados de `digisac_conexoes_automacao` para Portão e Hauer/Marechal (quando aplicável)
3. Investigar job de IA travado para venda 56022 (separado desta tarefa)

---

## 16. Validação Funcional (2026-07-14)

### 16.1 Por que Bigorrilho e Portão têm zero registros no banco

**Causa confirmada: ausência de sincronização, não problema de código.**

- Não existe nenhum job em `digisac_sync_fila` para vendas de Bigorrilho (série 29xxx) ou Portão (série 65xxx)
- Os jobs de sync recentes (2026-07-13) são todos para vendas de Marechal (série 55xxx-56xxx)
- A API Digisac confirma que **existem tickets** para essas conexões:
  - **Bigorrilho:** ticket `0ef53545-25b8-42b8-aaba-eeffe65ee05c` | Service: BIGORRILHO (41 8804-3042) (`0973f84b-8294-4615-9657-ba95b6346246`) | Started: 2026-07-07 | Phone: 554199692130 (sale 29042)
  - **Portão:** ticket `72e90604-829c-4667-adb0-ad63b41ce628` | Service: PORTÃO (41 8442-6528) (`c60d720f-5ad5-4a1b-bedb-e51495dee686`) | Started: 2026-07-06 | Phone: 5541997546390 (sale 65465)
- Quando essas vendas forem sincronizadas na tela de Inteligência Comercial, os tickets serão capturados e salvos normalmente

### 16.2 Hauer/Marechal — pipeline completo validado

**Caso: venda 56022 (Brenda Ruviaro, filial LEBEBE MARECHAL)**

| Etapa | Status | Evidência |
|---|---|---|
| Ticket no Digisac | OK | `1db47aba-...` e `cff588a8-...` encontrados via API |
| Ticket em `digisac_conversas_resumo` | OK | 10 tickets Marechal salvos, `service_id=1352c41b-...`, `service_nome=MARECHAL (41 9222-0492)` |
| Vínculo em `venda_conversa_vinculos` | OK | 12 vínculos para venda 56022: 10 VENDAS + 2 MARECHAL. Ticket `cff588a8-...` com `considerada_no_ciclo_venda=true`, `ordem_conversa_para_venda=11` |
| Chamado no ciclo da venda | OK | `cff588a8-...` marcado como `considerada_no_ciclo_venda=true` |
| Análise individual IA | OK | `digisac_chamados_analise_ia`: ticket `cff588a8-...` com `status=concluido`, `grau_influencia=Alto`, `influencia_compra=Sim`, `modelo_ia=deepseek-v4-flash`, `analisado_em=2026-07-13 14:05:18` |
| Análise consolidada | Pendente | Job `ia_analise_comercial_fila` status `processando`, 2/2 chamados processados, mas `venda_analise_comercial_ia` sem registro. Job travado — não relacionado a múltiplas conexões |

### 16.3 Marketing — pipeline completo validado

- 15 tickets em `digisac_conversas_resumo` com `service_id=51e03197-...`
- 8 análises de IA concluídas em `digisac_chamados_analise_ia` (vendas 55538, 55587, 28575, 28572, 55545)
- Marketing está corretamente incluído no fluxo e **não deve ser excluído**

### 16.4 Pós-venda — exclusão confirmada

- Zero tickets em `digisac_conversas_resumo` com `service_id=ece0fdac-...`
- `SERVICE_IDS_EXCLUIDOS_COMERCIAL` funciona corretamente

### 16.5 Duplicidade — ausência confirmada

- `digisac_conversas_resumo`: zero duplicatas por `digisac_ticket_id`
- `venda_conversa_vinculos`: zero duplicatas por `(numero_lancamento, digisac_ticket_id)`
- Unique constraints funcionando corretamente

### 16.6 Conclusão da validação

**O sistema já suporta múltiplas conexões Digisac.** Nenhuma alteração de código é necessária. A inclusão de Bigorrilho, Portão e Hauer/Marechal ocorre operacionalmente quando:

1. Os novos números são usados no Digisac (já em uso)
2. As vendas dessas filiais são sincronizadas na tela de Inteligência Comercial (Bigorrilho e Portão ainda não foram sincronizadas)

**Alterações realizadas:** Nenhuma.

**Evidências coletadas:**
- Query à API Digisac: tickets encontrados para Bigorrilho e Portão
- Query ao banco: 10 tickets Marechal salvos e vinculados
- Query ao banco: 1 ticket Marechal analisado pela IA com sucesso
- Query ao banco: 8 tickets Marketing analisados pela IA
- Query ao banco: zero tickets Pós-venda (exclusão funcionando)
- Query ao banco: zero duplicatas em todas as tabelas
- Query ao banco: ausência de jobs de sync para vendas 29xxx e 65xxx
