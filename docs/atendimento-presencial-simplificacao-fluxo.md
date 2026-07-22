# Simplificação do fluxo de Atendimento Presencial — Auditoria e Plano

> **Fase:** implementação concluída.  
> **Data da auditoria:** 2026-07-22  
> **Responsável:** Cascade (SWE-1.6)

---

## 1. Entendimento do pedido

Simplificar a tela **Ficha de Atendimento Presencial** do Le Bébé App, sem ampliar escopo nem refatorar módulos vizinhos. Os três alvos principais declarados pelo usuário são:

1. **Remover a seleção manual de e-mail/consultora** no início do atendimento.
2. **Reduzir o fluxo de quatro etapas para três etapas** (atualmente a tela exibe "Etapa X de 4").
3. **Selecionar a filial/unidade de forma automática** quando o usuário tiver apenas uma unidade permitida, mantendo a escolha manual apenas quando houver múltiplas unidades.

O presente documento é a **auditoria e plano aprovado** para a implementação da simplificação do fluxo. As decisões pendentes foram definidas pelo usuário e o documento foi ajustado para refletir o fluxo final de 3 etapas.

---

## 2. Arquivos lidos e confirmados como envolvidos

### 2.1 Documentação de governança e continuidade

- `docs/ia/log_progress.md`
- `docs/ficha-atendimento-presencial-progresso.md`
- `docs/PLANO FUNCIONAL ATUALIZADO — FICHA DE ATENDIMENTO PRESENCIAL.md`
- `docs/ia/padrao-novas-telas-permissoes.md`
- `.devin/rules/gerais.md`
- `.devin/rules/resumo.md`
- `.devin/rules/continuidade-agente.md`
- `.devin/rules/supabase.md`
- `.devin/skills/supabase/SKILL.md`

### 2.2 Página e componentes do fluxo

- `src/app/atendimento-presencial/ficha/page.tsx`
- `src/app/atendimento-presencial/ficha/FichaPageClient.tsx`

### 2.3 Schema, tipos e helpers do fluxo

- `src/lib/atendimento-presencial/ficha-schema.ts`
- `src/lib/atendimento-presencial/rascunhos.ts`
- `src/lib/atendimento-presencial/rascunhos-shared.ts`
- `src/lib/atendimento-presencial/rascunho-display.ts`
- `src/lib/atendimento-presencial/autosave-fila.ts`
- `src/lib/atendimento-presencial/rascunho-cache.ts`

### 2.4 APIs do fluxo

- `src/app/api/atendimento-presencial/atendimentos/rascunhos/route.ts`
- `src/app/api/atendimento-presencial/atendimentos/[id]/rascunho/route.ts`
- `src/app/api/atendimento-presencial/atendimentos/[id]/concluir/route.ts`
- `src/app/api/atendimento-presencial/atendimentos/[id]/route.ts`
- `src/app/api/atendimento-presencial/atendimentos/route.ts`

### 2.5 Autenticação, permissões e sessão

- `src/lib/auth/api-auth.ts`
- `src/lib/auth/module-access.ts`
- `src/lib/auth/access-window.ts`
- `src/lib/auth/modulos-app.ts`
- `src/lib/supabase/server.ts`
- `src/lib/supabase/client.ts`
- `src/lib/supabase/service.ts`

### 2.6 Banco de dados (validado no MCP Supabase)

Tabelas consultadas no MCP Supabase (`list_tables` + `execute_sql`):

- `public.usuarios_permitidos`
- `public.app_unidades`
- `public.app_usuarios_unidades`
- `public.app_perfis_acesso`
- `public.app_usuarios_perfis`
- `public.app_permissoes_perfil`
- `public.app_permissoes_usuario`
- `public.app_modulos`
- `public.atendimento_presencial_atendimentos`
- `public.atendimento_presencial_clientes`
- Políticas RLS (`pg_policies`) das tabelas acima.

---

## 3. Diagnóstico confirmado

### 3.1 Etapas reais do fluxo atual

O contador de etapas está definido em `src/lib/atendimento-presencial/ficha-schema.ts`:

```ts
export const FICHA_ETAPAS = ['ficha', 'resultado', 'revisao'] as const
export const FICHA_TOTAL_ETAPAS = 3
```

A tela renderiza **3 passos**. A lógica em `FichaPageClient.tsx` foi ajustada para:

```ts
const etapaNumero = indexEtapa(etapaAtual) + 1
const etapaLabelAtual = etapaLabels[etapaAtual]
```

A seleção de unidade ocorre dentro da etapa 1 (`ficha`).

| Etapa | Nome na tela | Conteúdo | Onde persiste |
|---|---|---|---|
| **1** | Ficha de Atendimento | Seleção da unidade (se múltipla/pré-selecionada), nome da consultora (manual), cliente, crianças, departamentos, produtos, observações | `unidade_id`, `consultora_usuario_id`, `dados_rascunho` (jsonb) + `cliente_id` |
| **2** | Resultado | Resultado do atendimento, motivos, virada de cartão, outro motivo | `dados_rascunho` e colunas `resultado_atendimento`, `motivo_outro`, `virada_cartao_dia/mes` |
| **3** | Revisao | Resumo e número do lançamento | `numero_lancamento`, `status = 'concluido'` |

### 3.2 Campos por etapa (confirmados no código)

**Etapa 1 — Ficha de Atendimento**

- `unidadeId` (seletor de filial no topo; pré-selecionada se houver uma; bloqueada após criação do rascunho)
- `consultoraNome` (input manual, primeiro campo editável da ficha)
- Cliente, crianças, departamentos, produtos, observações

**Etapa 2 — Ficha**

- Busca/cadastro de cliente (`clienteSelecionada`, `novoCliente`)
- `consultoraNome` (input manual, validado: 2-30 caracteres, apenas letras/espaços/acentos)
- Crianças (`situacao`, `dataPrevistaNascimento`, `idadeUnidade`, `idadeValor`, `nome`, `nomeNaoInformado`, `sexo`)
- `departamentos` (array de chaves)
- `produtosInteresse` (array de textos)
- `observacoes` (textarea)

**Etapa 3 — Resultado**

- `resultadoAtendimento` (`sim`, `nao`, `negociacao`)
- `motivosResultado` (array)
- `motivoOutro` (se `outro` selecionado)
- `viradaCartaoDia/Mes` (se `virada_cartao` selecionado)

**Etapa 3 — Revisão**

- Resumo de todos os campos
- `numeroLancamento` (se `resultadoAtendimento === 'sim'`)
- Botão "Concluir atendimento"

### 3.3 Como o sistema obtém e salva cada informação

| Informação | Origem hoje | Persistência | Observações |
|---|---|---|---|
| **Usuário autenticado** | Sessão autenticada via Supabase Auth → `usuarios_permitidos.id` | `consultora_usuario_id` do rascunho; representa quem operou/registrou o atendimento | Sempre o ID do usuário autenticado; nenhuma seleção de e-mail/outro usuário |
| **Filial/unidade** | `app_usuarios_unidades` (para usuários comuns); `app_unidades` inteira para `superadmin` | `atendimento_presencial_atendimentos.unidade_id` | Coluna `unidade_id` FK para `app_unidades.id` |
| **Perfil** | `app_usuarios_perfis` → `app_perfis_acesso.chave` | Não persiste na ficha; usado em runtime para decidir permissões | `carregarPerfilAtendimento` em `rascunhos.ts` |
| **Unidades permitidas** | `app_usuarios_unidades` filtrado por `ativo = true` (ou todas para superadmin) | Não persiste; carregado a cada requisição | `listarUnidadesDoContexto` em `rascunhos.ts` |
| **Nome da consultora** | Input manual na etapa "Ficha" (`ficha.consultoraNome`) | `dados_rascunho.consultoraNome` no rascunho; coluna `atendimento_presencial_atendimentos.consultora_nome` ao concluir/editar | A coluna e o JSON possuem validação por regex 2-30 caracteres |
| **Etapa atual** | `ficha.etapaAtual` (`ficha`, `resultado`, `revisao`) | `dados_rascunho.etapaAtual` | Normalizado por `mapearEtapaRascunho` |
| **Rascunho** | Payload serializado no autosave | Coluna `dados_rascunho` (jsonb, máx 16 KB) em `atendimento_presencial_atendimentos` | Autosave via `PATCH /api/atendimento-presencial/atendimentos/{id}/rascunho` |

### 3.4 Determinação das filiais permitidas por tipo de usuário

A função `listarUnidadesDoContexto` em `src/lib/atendimento-presencial/rascunhos.ts` é a autoridade única. Confirmado no MCP Supabase:

| Tipo de usuário | Regra confirmada no código e no banco |
|---|---|
| **Usuário comum (perfil `consultora`)** | Apenas unidades vinculadas em `app_usuarios_unidades.usuario_id = usuário atual` e `app_unidades.ativo = true`. |
| **Usuário com múltiplas unidades** | Mesma query; o array `unidadesPermitidas` terá mais de um item e a UI exige seleção. |
| **Supervisora de loja / Gestão** | Mesma regra: a permissão de unidades vem de `app_usuarios_unidades`. O perfil (`supervisora_loja` ou `gestao`) só altera a capacidade de **selecionar outra consultora**, não as unidades. |
| **Superadmin** | `role = 'superadmin'` em `usuarios_permitidos` → a função retorna **todas** as unidades ativas de `app_unidades`. |
| **Usuário sem filial** | `unidadesPermitidas` vem vazio; o botão "Iniciar novo atendimento" fica desabilitado e a UI exibe: *"Usuário sem unidade vinculada. Ajuste a configuração na tela de usuários."* |

### 3.5 Seleção de consultora hoje

A regra está espalhada em `FichaPageClient.tsx` e na API `POST /rascunhos`:

- Para **todos os perfis autorizados** (`consultora`, `supervisora_loja`, `gestao`, `superadmin`, etc.), o `consultora_usuario_id` será sempre o ID do usuário autenticado no momento da criação do rascunho.
- Não haverá mais seleção de e-mail/consultora. O backend `POST /rascunhos` ignorará qualquer `consultoraUsuarioId` enviado no payload.
- O `nome` exibido no histórico/retomada pode continuar vindo do e-mail (`consultoraNome` do DTO), mas não é mais usado para seleção.

### 3.6 Rascunhos antigos versus novos

- **Rascunhos novos** passam por `validarFichaDadosRascunho`, que já aceita `consultoraNome` no `dados_rascunho` e normaliza com a regex 2-30 caracteres.
- **Rascunhos antigos** podem não conter `consultoraNome` no `dados_rascunho` (campo introduzido recentemente). Ao retomar, o input fica vazio e a validação de conclusão exigirá preenchimento manual. **Não há migração de dados proposta** — o usuário preencherá o campo em rascunhos antigos.
- A coluna `consultora_nome` em `atendimento_presencial_atendimentos` está `nullable` e é preenchida **apenas ao concluir/editar** via RPCs `atendimento_presencial_concluir` e `atendimento_presencial_editar_concluido`. Para rascunhos, ela permanece `null`.
- O banco possui hoje **34 rascunhos** e **13 concluídos** (dados do MCP Supabase, sem exposição de conteúdo sensível).

### 3.7 Permissões e RLS (confirmado no MCP Supabase)

- As tabelas `atendimento_presencial_atendimentos` e `atendimento_presencial_clientes` possuem **policies `no_direct_*`** que bloqueiam `INSERT`/`SELECT`/`UPDATE`/`DELETE` direto pelo role `authenticated`. Toda a leitura/escrita real acontece via `createServiceClient()` nas API routes.
- `usuarios_permitidos` permite `SELECT` para superadmin ou `is_own_record(email)`.
- `app_usuarios_unidades`, `app_unidades`, `app_perfis_acesso` etc. também possuem RLS ativado; as API routes usam service role.

---

## 4. Hipóteses / pontos ainda não confirmados

Todas as decisões de escopo foram confirmadas pelo usuário em 2026-07-22. Não há hipóteses pendentes para este trabalho.

---

## 5. Validação no MCP do Supabase

### 5.1 Tabelas validadas

| Tabela | Colunas validadas | Relações / FKs confirmadas | RLS / policies |
|---|---|---|---|
| `public.usuarios_permitidos` | `id`, `email`, `role`, `ativo`, `created_at`, `updated_at` | PK `id`; FKs de várias tabelas apontam para ela | `usuarios_permitidos_select` (superadmin ou próprio), `insert/update/delete` restritos a superadmin |
| `public.app_unidades` | `id`, `chave`, `nome`, `ativo`, `ordem`, `created_at`, `updated_at` | PK `id`; FK de `app_usuarios_unidades.unidade_id` e `atendimento_presencial_atendimentos.unidade_id` | RLS ativo (policies não retornadas no filtro, mas tabela está `rls_enabled`) |
| `public.app_usuarios_unidades` | `id`, `usuario_id`, `unidade_id`, `atribuido_por`, `created_at`, `updated_at` | FK para `usuarios_permitidos` e `app_unidades` | RLS ativo |
| `public.app_perfis_acesso` | `id`, `chave`, `nome`, `ativo`, `sistema`, `ordem`, `created_at`, `updated_at` | PK `id`; FK de `app_usuarios_perfis.perfil_id` e `app_permissoes_perfil.perfil_id` | RLS ativo |
| `public.app_usuarios_perfis` | `id`, `usuario_id`, `perfil_id`, `atribuido_por`, `created_at`, `updated_at` | FK para `usuarios_permitidos` e `app_perfis_acesso` | RLS ativo |
| `public.app_permissoes_perfil` | `id`, `perfil_id`, `modulo_id`, `permitido`, `created_at`, `updated_at` | FK para `app_perfis_acesso` e `app_modulos` | RLS ativo |
| `public.app_permissoes_usuario` | `id`, `usuario_id`, `modulo_id`, `permitido`, `concedido_por`, `motivo`, `created_at`, `updated_at` | FK para `usuarios_permitidos` e `app_modulos` | RLS ativo |
| `public.app_modulos` | `id`, `chave`, `nome`, `descricao`, `rota_base`, `categoria`, `publico`, `somente_superadmin`, `ativo`, `ordem`, `created_at`, `updated_at` | PK `id`; FK de `app_permissoes_perfil` e `app_permissoes_usuario` | RLS ativo |
| `public.atendimento_presencial_atendimentos` | `id`, `cliente_id`, `consultora_usuario_id`, `unidade_id`, `status`, `draft_client_id`, `dados_rascunho`, `iniciado_em`, `ultima_atividade_em`, `expira_em`, `version`, `criado_por`, `atualizado_por`, `created_at`, `updated_at`, `resultado_atendimento`, `motivo_outro`, `observacoes`, `numero_lancamento`, `concluido_em`, `virada_cartao_dia`, `virada_cartao_mes`, `consultora_nome` | FK para `atendimento_presencial_clientes`, `usuarios_permitidos`, `app_unidades` | `no_direct_select/insert/update/delete` para `authenticated` |
| `public.atendimento_presencial_clientes` | `id`, `nome`, `telefone_*`, `parentesco`, `parentesco_outro`, `status`, `version`, `criado_por`, `atualizado_por`, `created_at`, `updated_at` | PK `id`; FK de `atendimento_presencial_atendimentos.cliente_id` | `no_direct_select/insert/update` para `authenticated` |

### 5.2 Valores de exemplo (não sensíveis)

- **Unidades ativas (5):** BIGORRILHO, FEIRA, MARECHAL, PORTAO, POS VENDA.
- **Perfis ativos (4):** `consultora`, `gestao`, `pos_venda`, `supervisora_loja`.
- **Contagem de atendimentos:** 47 total, 34 rascunhos, 13 concluídos.

### 5.3 Constraints importantes confirmadas

- `atendimento_presencial_atendimentos.unidade_id` **NOT NULL** (não há default).
- `atendimento_presencial_atendimentos.consultora_usuario_id` **NOT NULL** (não há default).
- `atendimento_presencial_atendimentos.consultora_nome` possui `CHECK` de 2-30 caracteres com regex de letras/acentos/espaços.
- `atendimento_presencial_atendimentos.dados_rascunho` possui `CHECK` de tamanho máximo 16.384 bytes (`pg_column_size <= 16384`).

---

## 6. Plano de alteração mínimo

### 6.1 Princípio

Não criar migrations, não remover colunas, não alterar RLS, não refatorar componentes vizinhos e não alterar a listagem de rascunhos além do estritamente necessário. A mudança deve ser concentrada em:

1. `src/app/atendimento-presencial/ficha/FichaPageClient.tsx`
2. `src/app/api/atendimento-presencial/atendimentos/rascunhos/route.ts`
3. `src/lib/atendimento-presencial/ficha-schema.ts` (constantes de etapa)

### 6.2 Decisões finais e mudanças

#### A. Seleção de e-mail/consultora — REMOVIDA

- Nenhum perfil (`consultora`, `supervisora_loja`, `gestao`, `superadmin`, `pos_venda`) pode selecionar outro usuário como `consultora_usuario_id`.
- O backend `POST /rascunhos` **ignorará** qualquer `consultoraUsuarioId` enviado pelo cliente e usará obrigatoriamente o `contexto.usuarioId` (usuário autenticado).
- `validarConsultoraNaUnidade` e `perfilPodeSelecionarConsultora` não serão usados na criação de novos rascunhos. Rascunhos antigos preservam seu `consultora_usuario_id` original.
- O frontend não renderizará mais lista de consultoras por e-mail.

#### B. Seleção de filial — dentro da etapa 1

- A filial será o primeiro elemento da etapa "Ficha de Atendimento".
- **Usuário com uma unidade:** unidade pré-selecionada automaticamente; rascunho criado automaticamente; não pode trocar de unidade.
- **Usuário com várias unidades:** seletor de unidade exibido no topo da etapa 1; ao selecionar, o rascunho é criado; após criação, a unidade fica bloqueada.
- **Usuário sem unidade:** campos bloqueados e mensagem clara.
- A troca de unidade após existir rascunho com dados salvos será bloqueada; para recomeçar com outra unidade, usar "Novo atendimento".

#### C. Fluxo de 3 etapas

- `FICHA_TOTAL_ETAPAS = 3` em `ficha-schema.ts`.
- `etapaNumero = indexEtapa(etapaAtual) + 1` (`ficha`=1, `resultado`=2, `revisao`=3) quando houver rascunho ativo.
- Sem tela/pré-etapa separada. A seleção de unidade e o botão "Novo atendimento" fazem parte da etapa 1.
- Barra de progresso, labels, navegação (avançar/voltar) e revisão refletem 3 etapas.

#### D. Nome da consultora — MANUAL

- O campo `consultoraNome` inicia vazio em novos atendimentos.
- Não será pré-preenchido com e-mail, domínio, nome do usuário logado ou perfil.
- A normalização `trim` + redução de espaços múltiplos será aplicada na digitação, autosave, avanço e conclusão.
- A validação de 2-30 caracteres, letras/acentos/espaços permanece.

### 6.3 Fluxo resultante (aprovado)

| Passo | Nome | Ações |
|---|---|---|
| **Etapa 1** | Ficha de Atendimento | Seleção da unidade (pré-selecionada ou escolhida); nome da consultora (manual); cliente; crianças; departamentos; produtos; observações. O `consultora_usuario_id` é sempre o usuário autenticado. |
| **Etapa 2** | Resultado | Fechamento, motivos, virada de cartão, outro. |
| **Etapa 3** | Revisão | Resumo e número do lançamento; concluir. |

---

## 7. Checklist de implementação

- [x] Confirmar decisões com o usuário.
- [x] Corrigir data e decisões no `docs/atendimento-presencial-simplificacao-fluxo.md`.
- [x] Ajustar `FICHA_TOTAL_ETAPAS` para `3` em `ficha-schema.ts`.
- [x] Remover seleção de `consultoraUsuarioId` por e-mail do `FichaPageClient.tsx`.
- [x] Mover seleção de unidade para o topo da etapa 1 no `FichaPageClient.tsx`.
- [x] Criar rascunho automaticamente: unidade única no carregamento; unidade selecionada manualmente quando houver várias.
- [x] Bloquear troca de unidade após criação do rascunho.
- [x] Ajustar `etapaNumero`/`etapaLabelAtual` para 3 etapas.
- [x] Atualizar barra de progresso, labels, avançar/voltar e botão "Novo atendimento".
- [x] Normalizar `consultoraNome` (trim + collapse spaces) em todos os pontos.
- [x] Ajustar POST `/rascunhos` para ignorar `consultoraUsuarioId` e usar usuário autenticado.
- [x] Preservar `consultora_usuario_id` e `unidade_id` de rascunhos antigos na retomada.
- [x] Atualizar testes unitários afetados.
- [x] Rodar `npx tsc --noEmit`.
- [x] Rodar `npx vitest run` nas áreas afetadas.
- [ ] Validar manualmente: uma unidade, várias unidades, sem unidade, superadmin, supervisora, gestão, rascunho novo, rascunho antigo, clique duplo, autosave, botão "Novo atendimento".

---

## 8. Decisões aprovadas

1. **Seleção de outra consultora por supervisão/gestão/superadmin:** **NÃO** permitida. `consultora_usuario_id` será sempre o usuário autenticado. Rascunhos antigos preservam o `consultora_usuario_id` original.
2. **Local da seleção de unidade:** dentro da **etapa 1 (Ficha de Atendimento)**, no topo, acima do nome da consultora. Não haverá tela/pré-etapa separada.
3. **Preenchimento automático do `consultoraNome`:** **NÃO**. O campo inicia vazio e permanece manual.
4. **Momento de criação do rascunho:**
   - **Unidade única:** criado automaticamente ao carregar a página, desde que não existam rascunhos em andamento.
   - **Várias unidades:** criado quando o usuário seleciona uma unidade no seletor da etapa 1.
   - **Guarda contra corrida:** flag `iniciando`/`autoIniciado` e `draftClientId` idempotente evitam múltiplas criações.
5. **Troca de unidade após criação:** bloqueada. Para recomeçar com outra unidade, usar "Novo atendimento".
6. **Rascunhos antigos:** abertos normalmente; `unidade_id` e `consultora_usuario_id` originais preservados; `consultoraNome` ausente exige preenchimento antes da conclusão.

---

## 9. Andamento

- [x] Leitura das regras do projeto e documentação de continuidade.
- [x] Mapeamento do fluxo real de 4 etapas.
- [x] Confirmação das tabelas, colunas, FKs e RLS no MCP Supabase.
- [x] Identificação de arquivos envolvidos.
- [x] Documentação da auditoria inicial (este arquivo).
- [x] Aprovação do usuário sobre as decisões pendentes.
- [x] Implementação das mudanças (após aprovação).
- [ ] Validação manual final.

---

## 10. Validações já realizadas

- Leitura real do código de `FichaPageClient.tsx`, `ficha-schema.ts`, `rascunhos.ts`, `rascunhos-shared.ts` e das rotas de rascunho/conclusão/listagem.
- Confirmação de que `FICHA_TOTAL_ETAPAS = 4` e `FICHA_ETAPAS = ['ficha', 'resultado', 'revisao']`.
- Confirmação de que `consultoraUsuarioId` é selecionável para `supervisora_loja`, `gestao` e `superadmin` e automático para `consultora`.
- Confirmação de que `consultoraNome` é manual, validado e persistido no `dados_rascunho` e na coluna `consultora_nome`.
- MCP Supabase `list_tables` para validar tabelas e colunas.
- MCP Supabase `execute_sql` em `pg_policies` para confirmar RLS das tabelas envolvidas.
- MCP Supabase `execute_sql` para listar unidades e perfis ativos e contagem de rascunhos/concluídos (sem dados sensíveis).

---

## 11. Riscos conhecidos

| Risco | Impacto | Mitigação proposta |
|---|---|---|
| **Criação automática de rascunho pode gerar rascunhos vazios** se o usuário recarregar a página sem preencher. | Baixo a médio | Criar automaticamente apenas quando não houver rascunhos em andamento; usar `draftClientId` idempotente e guarda `iniciando`/`autoIniciado` para evitar duplicatas. |
| **Rascunhos antigos sem `consultoraNome` no `dados_rascunho` podem falhar na conclusão** se o usuário não preencher. | Baixo a médio | O campo já é obrigatório; rascunhos antigos exigirão preenchimento. Não migrar dados antigos. |
| **Ajustar `etapaNumero` pode afetar a barra de progresso e navegação** (`avancar`/`voltar`). | Baixo | Testar manualmente todos os passos após a mudança. |
| **Troca de unidade após criação do rascunho** pode gerar inconsistência se permitida. | Baixo | Bloquear seletor de unidade quando `ativo` existir; para nova unidade, usar "Novo atendimento". |
| **Condição de corrida entre criação e autosave** pode criar rascunho duplicado ou perder dados. | Baixo | Só inicializar autosave após `ativo` estar definido; usar flag de criação em andamento. |
| **Usuários sem unidade permanecem bloqueados**; a mensagem deve ser clara. | Baixo | Manter mensagem visível e logs sem dados sensíveis. |

---

## 12. O que NÃO será alterado

- Nenhuma coluna será removida do banco.
- Nenhuma migration será criada (não há necessidade de alterar schema).
- Nenhuma política RLS será alterada.
- A estrutura de permissões (`app_modulos`, `app_permissoes_perfil`, `app_usuarios_unidades`) permanece intacta.
- O módulo de "Registros de Atendimentos" (`RegistrosPageClient.tsx`) teve apenas a normalização do `consultoraNome` aplicada no input e no payload de edição, sem mudança de layout.
- A listagem de rascunhos permanece como está, sem mudança de layout ou regras de filtro.
- As regras de validação do `consultoraNome` (regex, tamanho, normalização) permanecem as mesmas.
- O fluxo de criação de cliente e o `TelefoneClienteRapido` não serão alterados.

---

## 13. Próximos passos recomendados

1. **Aguardar aprovação desta auditoria** e das decisões pendentes (§8).
2. Após aprovação, implementar as mudanças no menor conjunto de arquivos identificado (§6.1).
3. Rodar testes e typecheck.
4. Validar manualmente os cenários listados no checklist (§7).
5. Atualizar `docs/ia/log_progress.md` com a conclusão.
6. Se houver alterações visuais, atualizar este documento com prints/descrição.

---

## 14. Registro de continuidade

- **Arquivos lidos para esta auditoria:**
  - `docs/ia/log_progress.md`
  - `docs/ficha-atendimento-presencial-progresso.md`
  - `docs/PLANO FUNCIONAL ATUALIZADO — FICHA DE ATENDIMENTO PRESENCIAL.md`
  - `docs/ia/padrao-novas-telas-permissoes.md`
  - `.devin/rules/gerais.md`, `.devin/rules/resumo.md`, `.devin/rules/continuidade-agente.md`, `.devin/rules/supabase.md`
  - `src/app/atendimento-presencial/ficha/page.tsx`
  - `src/app/atendimento-presencial/ficha/FichaPageClient.tsx`
  - `src/lib/atendimento-presencial/ficha-schema.ts`
  - `src/lib/atendimento-presencial/rascunhos.ts`
  - `src/lib/atendimento-presencial/rascunhos-shared.ts`
  - `src/lib/atendimento-presencial/autosave-fila.ts`
  - `src/lib/atendimento-presencial/rascunho-display.ts`
  - `src/app/api/atendimento-presencial/atendimentos/rascunhos/route.ts`
  - `src/app/api/atendimento-presencial/atendimentos/[id]/rascunho/route.ts`
  - `src/app/api/atendimento-presencial/atendimentos/[id]/concluir/route.ts`
  - `src/app/api/atendimento-presencial/atendimentos/[id]/route.ts`
  - `src/app/api/atendimento-presencial/atendimentos/route.ts`
  - `src/lib/auth/api-auth.ts`
  - `src/lib/auth/module-access.ts`
  - `src/lib/auth/access-window.ts`
  - `src/lib/auth/modulos-app.ts`

- **Arquivo criado:**
  - `docs/atendimento-presencial-simplificacao-fluxo.md`

- **Validações MCP Supabase:**
  - `mcp1_list_tables` (schemas `public`, verbose=true)
  - `mcp1_execute_sql` em `pg_policies` para 10 tabelas
  - `mcp1_execute_sql` para amostras de `app_unidades`, `app_perfis_acesso` e contagem de `atendimento_presencial_atendimentos`

- **Pendências:**
  - Decisões pendentes do usuário (§8).
  - Implementação aprovada.
  - Testes manuais e automatizados.

---

## 15. Ajustes finos aplicados em 2026-07-22

Após implementação inicial, o usuário aprovou os refinamentos abaixo para eliminar o último atrito do fluxo.

### 15.1 Remoção do botão intermediário

- Não há mais botão "Iniciar novo atendimento" na etapa 1.
- O formulário da etapa "Ficha de Atendimento" é renderizado imediatamente, mesmo antes da existência de `ativo`.

### 15.2 Criação automática do rascunho

- Condição: `unidadeId` válido **e** `consultoraNome` normalizado e válido.
- Unidade única: pré-selecionada; usuário digita o nome; rascunho criado automaticamente.
- Múltiplas unidades: usuário seleciona a unidade e digita o nome; rascunho criado automaticamente.
- A criação não ocorre somente pela seleção da unidade.

### 15.3 Ordem real dos campos na etapa 1

1. Unidade
2. Nome da consultora
3. Cliente
4. Crianças
5. Departamentos
6. Produtos de interesse
7. Observações

### 15.4 Preservação de estado durante a criação

- `iniciarRascunho` envia o `ficha` e `clienteSelecionada` atuais, normalizando `consultoraNome`.
- `aplicarRascunhoCriado` não sobrescreve os estados locais; compara o payload enviado ao retorno do servidor e dispara `flushNow` com o estado mais recente se houver diferenças.
- Após a criação, o primeiro autosave envia o estado atual, garantindo que dados digitados durante o POST não sejam perdidos.

### 15.5 Tratamento de erro e nova tentativa

- `erroCriacao` armazena erros específicos de criação.
- O link **"Tentar novamente"** aparece apenas quando a criação falha.
- A tentativa ocorre automaticamente quando o usuário altera a unidade ou o nome (limpando o erro e re-satisfazendo a condição `podeCriarRascunho`).

### 15.6 Validação no backend

- `POST /api/atendimento-presencial/atendimentos/rascunhos` valida `consultoraNome` via `validarNomeConsultora`, após `validarDadosRascunho`.
- Retorna `400` com mensagem clara quando inválido.
- Não afeta listagem, retomada de rascunhos antigos, `PATCH` de rascunhos existentes nem edição de concluídos.

### 15.7 Seletor de unidade

- Antes de `ativo`: interativo; desabilitado apenas durante `iniciando`.
- Após `ativo`: bloqueado, conforme regra anterior.
- Indicador discreto `Criando rascunho...` exibido enquanto o POST está em andamento.

### 15.8 Checklist dos ajustes finos

- [x] Remover botão intermediário de início.
- [x] Criar rascunho automaticamente após filial + nome válidos.
- [x] Reordenar campos: Filial → Consultora → Cliente → Crianças → Departamentos → Produtos → Observações.
- [x] Preservar dados digitados durante o POST.
- [x] Enviar estado mais recente no primeiro autosave após criação.
- [x] Tratar erro com "Tentar novamente".
- [x] Evitar loop infinito após falha (refs `tentativaUnidade`/`tentativaNome`).
- [x] Validar `consultoraNome` no `POST` de criação.
- [x] Ajustar "Novo atendimento" para não criar rascunho vazio.
- [x] `npx tsc --noEmit` passou.
- [x] `npx eslint` passou.
- [x] `npx vitest run src/lib/atendimento-presencial src/app/api/atendimento-presencial` passou (158 testes).
- [x] `npx next build` passou.
- [ ] Validação manual no navegador.

## 16. Rascunhos na tela de Registros

A partir de 2026-07-22, a lista de rascunhos ativos foi removida da ficha e migrada para uma aba na tela de **Registros de Atendimentos**.

### 16.1 Mudanças no fluxo

- A ficha exibe o botão **"Ver rascunhos"**, que descarrega o autosave atual e navega para `/atendimento-presencial/registros?tab=rascunhos`.
- O carregamento do contexto (perfil + unidades permitidas) passou do client para o server (`src/app/atendimento-presencial/ficha/page.tsx`).
- A ficha carrega um rascunho diretamente via URL `?rascunho=<id>` com tela de loading e mensagem de erro.
- A tela de registros aceita usuários com `atendimento_presencial_registros` e/ou `atendimento_presencial_ficha`:
  - A aba **"Atendimentos finalizados"** é exibida apenas com `atendimento_presencial_registros`.
  - A aba **"Rascunhos"** é exibida apenas com `atendimento_presencial_ficha`.
  - A tab é controlada por `?tab=`; valores inválidos ou sem permissão redirecionam para a primeira aba permitida.
- Cada card de rascunho exibe cliente, consultora, unidade, última atualização, expiração e um botão **"Continuar atendimento"** que navega para `/atendimento-presencial/ficha?rascunho=<id>`.

### 16.2 Arquivos envolvidos

- `src/app/atendimento-presencial/ficha/page.tsx`
- `src/app/atendimento-presencial/ficha/FichaPageClient.tsx`
- `src/app/atendimento-presencial/registros/page.tsx`
- `src/app/atendimento-presencial/registros/RegistrosPageClient.tsx`
- `src/lib/atendimento-presencial/rascunhos.ts`
- `src/lib/atendimento-presencial/rascunho-display.ts`
- `src/components/ui/tabs.tsx`

### 16.3 Validações pendentes

- `npx next build` completo com as novas alterações.
- Testes manuais: acesso com permissões variadas, tab por URL, `?rascunho=<id>` válido e inválido, e navegação ficha ↔ registros.


---

## 17. Hotfix de conclusao em 2026-07-22

### 17.1 Causa confirmada

O fluxo simplificado passou a gravar `consultora_usuario_id` como o usuario autenticado que registrou o atendimento. O nome da consultora que realizou o atendimento e informado manualmente em `consultoraNome` e persistido na coluna `consultora_nome` ao concluir.

A RPC remota `public.atendimento_presencial_concluir` ainda validava `consultora_usuario_id` como uma pessoa com perfil ativo `consultora`, o que gerava `consultora_perfil_invalido` em atendimentos registrados por `superadmin`, `supervisora_loja` ou usuarios autorizados por modulo/unidade.

### 17.2 Regra final aplicada na RPC

- `consultora_usuario_id` continua representando o usuario autenticado que registrou o atendimento.
- `consultora_nome` continua representando o nome manual da consultora responsavel pelo atendimento.
- A conclusao valida o executor por usuario ativo, acesso ao modulo `atendimento_presencial_ficha` e unidade do atendimento.
- `superadmin` continua com acesso total e nao precisa de vinculo em `app_usuarios_unidades`.
- A RPC preserva assinatura, retorno, `SECURITY DEFINER`, `search_path`, owner e grants restritos a `service_role`.
- As validacoes de status, versao, expiracao, unidade ativa, usuario registrador ativo, cliente ativo, payload, nome da consultora e numero de lancamento foram preservadas.

### 17.3 Validacoes

- MCP Supabase confirmou a definicao remota da RPC antes e depois da alteracao.
- Teste em transacao com `rollback` concluiu o atendimento de diagnostico sem persistir dados, retornando nova versao dentro da transacao.
- Advisors de seguranca do Supabase nao apontaram a RPC `atendimento_presencial_concluir` como executavel por `anon` ou `authenticated`.
- Validacao manual do fluxo foi realizada pelo usuario durante o evento.
