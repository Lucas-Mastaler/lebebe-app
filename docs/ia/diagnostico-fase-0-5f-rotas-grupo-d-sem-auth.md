# Diagnostico Fase 0.5F - Rotas Grupo D sem auth clara

Data: 2026-06-26
Agente: Codex
Tipo: diagnostico/plano somente leitura

Nenhum codigo funcional, rota, middleware, banco, migration, RLS, grant ou policy foi alterado nesta etapa.

---

## 1. Resumo executivo

Foram analisadas as 12 rotas Grupo D listadas em `docs/ia/plano-fase-0-5b-migracao-helper-auth-apis.md`.

Resultado confirmado no codigo:
- Todas as 12 rotas continuam sem validacao formal de sessao de usuario.
- 10 rotas sao chamadas por telas protegidas pelo middleware, mas isso nao protege chamada direta para `/api/*`.
- 1 rota (`GET /api/digisac/schedule`) e chamada por `/horarios-agendamentos`, pagina explicitamente publica no middleware.
- 1 rota (`POST /api/nfe/importar`) acessa Gmail por service account e grava em tabelas Supabase sem validar usuario antes.
- 1 arquivo (`src/app/api/usuarios-info/route.ts`) usa service role para leitura e escrita em `usuarios_info` sem sessao.

Conclusao objetiva:
- O maior risco imediato e `POST /api/nfe/importar` por executar integracao Gmail e persistencia sem auth server-side.
- O proximo lote deve proteger primeiro rotas privadas que expõem dados Digisac ou escrevem via service role.
- `GET /api/digisac/schedule` precisa de decisao de produto porque hoje sustenta uma pagina publica.
- `autocomplete/users` e `autocomplete/departments` nao tiveram chamada confirmada no codigo; parecem candidatos a remocao ou bloqueio.

---

## 2. Escopo

Incluido:
- Ler e classificar as rotas Grupo D.
- Confirmar validacao atual no codigo.
- Identificar uso de Supabase, service role, Digisac e Gmail.
- Identificar cliente provavel por busca de chamadas `fetch`.
- Propor decisao e prioridade.

Fora do escopo:
- Alterar codigo.
- Alterar rotas.
- Alterar middleware.
- Alterar banco, migrations, RLS, grants ou policies.
- Alterar regras de negocio de `/procurar-datas`.
- Mexer em Recebimento/Matic, OAuth/callbacks, webhooks, cron, Bearer token ou integracoes externas.

---

## 3. Criterios de classificacao

Decisoes usadas:
- `MIGRAR_REQUIRE_AUTHENTICATED_USER`: rota privada de usuario logado; pode exigir sessao e usuario ativo. Quando houver regra mais especifica, ela esta indicada em observacao.
- `MIGRAR_BEARER_TOKEN`: rota de integracao externa, cron ou chamada server-to-server sem sessao de usuario.
- `MANTER_PUBLICA`: rota publica intencional, com justificativa.
- `DESATIVAR_OU_REMOVER`: rota sem uso confirmado, diagnostica, duplicada ou legada.
- `DECISAO_PRODUTO`: regra de exposicao nao pode ser definida apenas pelo codigo.

Prioridades:
- P0: risco critico, corrigir antes de avancar.
- P1: risco alto, proxima etapa.
- P2: risco medio, pode entrar em lote.
- P3: baixo risco, limpeza ou documentacao.

---

## 4. Tabela de rotas Grupo D

| Rota | Metodo | Arquivo | Validacao atual | Supabase | Service role | Dados sensiveis | Altera dados | Cliente provavel | Decisao | Prioridade |
|---|---:|---|---|---|---|---|---|---|---|---|
| `/api/digisac/schedule` | GET | `src/app/api/digisac/schedule/route.ts` | Rate limit por IP apenas | Nao | Nao | Sim, agenda Digisac por `serviceId` e periodo | Nao | `/horarios-agendamentos` publica | `DECISAO_PRODUTO` | P1 |
| `/api/users` | GET | `src/app/api/users/route.ts` | Nenhuma | Nao | Nao | Sim, usuarios ativos Digisac | Nao | Dashboard, Agendamentos, Chamados Finalizados | `MIGRAR_REQUIRE_AUTHENTICATED_USER` | P1 |
| `/api/usuarios-info` | GET | `src/app/api/usuarios-info/route.ts` | Nenhuma | Sim | Sim | Sim, observacoes por `contact_id` | Nao | Chamados Finalizados | `MIGRAR_REQUIRE_AUTHENTICATED_USER` | P1 |
| `/api/usuarios-info` | POST | `src/app/api/usuarios-info/route.ts` | Nenhuma | Sim | Sim | Sim, observacao livre ate 100 chars | Sim, upsert em `usuarios_info` | Chamados Finalizados | `MIGRAR_REQUIRE_AUTHENTICATED_USER` | P1 |
| `/api/dashboard/pesquisar` | POST | `src/app/api/dashboard/pesquisar/route.ts` | Nenhuma | Nao | Nao | Sim, tickets, contatos e metricas Digisac | Nao | Dashboard | `MIGRAR_REQUIRE_AUTHENTICATED_USER` | P1 |
| `/api/agendamentos/pesquisar` | POST | `src/app/api/agendamentos/pesquisar/route.ts` | Nenhuma | Nao | Nao | Sim, agendamentos, contatos, tags e tickets Digisac | Nao | Agendamentos | `MIGRAR_REQUIRE_AUTHENTICATED_USER` | P1 |
| `/api/autocomplete/departments` | GET | `src/app/api/autocomplete/departments/route.ts` | Nenhuma | Nao | Nao | Baixo/medio, nomes e IDs de departamentos Digisac | Nao | Uso nao confirmado no codigo | `DESATIVAR_OU_REMOVER` | P3 |
| `/api/autocomplete/users` | GET | `src/app/api/autocomplete/users/route.ts` | Nenhuma | Nao | Nao | Medio, nomes e IDs de usuarios Digisac | Nao | Uso nao confirmado no codigo | `DESATIVAR_OU_REMOVER` | P3 |
| `/api/chamados-finalizados/pesquisar` | POST | `src/app/api/chamados-finalizados/pesquisar/route.ts` | Nenhuma | Nao | Nao | Sim, tickets, contatos, tags e status de conversa | Nao | Chamados Finalizados | `MIGRAR_REQUIRE_AUTHENTICATED_USER` | P1 |
| `/api/chamados-finalizados/agendamentos` | GET | `src/app/api/chamados-finalizados/agendamentos/route.ts` | Nenhuma | Nao | Nao | Sim, agendamentos por `contactId` | Nao | Modal em Chamados Finalizados | `MIGRAR_REQUIRE_AUTHENTICATED_USER` | P1 |
| `/api/departments` | GET | `src/app/api/departments/route.ts` | Nenhuma | Nao | Nao | Baixo/medio, nomes e IDs de departamentos Digisac | Nao | Agendamentos | `MIGRAR_REQUIRE_AUTHENTICATED_USER` | P2 |
| `/api/nfe/importar` | POST | `src/app/api/nfe/importar/route.ts` | Nenhuma; cria client Supabase sem `getUser()` | Sim | Nao | Sim, Gmail, XMLs de NFe, dados fiscais e itens | Sim, upsert/delete/insert em `nfe`, `nfe_itens`, `nfe_assistencias` | Recebimento e Pos-venda NFe | `DECISAO_PRODUTO` | P0 |

---

## 5. Rotas P0/P1

### P0 - `POST /api/nfe/importar`

Diagnostico confirmado:
- Valida apenas body (`inicio`, `fim`) e limite de 90 dias.
- Cria cliente Gmail com service account (`JWT`) antes de qualquer validacao de usuario.
- Le mensagens do Gmail, baixa anexos XML, parseia NFe e retorna dados processados.
- Depois cria `createClient()` do Supabase, mas nao chama `auth.getUser()`.
- Escreve em `nfe`, `nfe_itens` e `nfe_assistencias`.
- E chamado por `src/app/recebimento/page.tsx` e `src/app/pos-venda/importar-nfe/page.tsx`.
- As telas fazem checagem client-side com `isMaticEmail`, mas chamada direta para a API nao passa por essa checagem.

Risco:
- Alto/critico: qualquer chamada direta pode acionar leitura Gmail por periodo e tentar persistir dados fiscais.

Decisao recomendada:
- Definir se o endpoint e exclusivo de Matic/Recebimento ou se usuarios ativos comuns tambem podem usar.
- Se exclusivo Matic, usar `validateMaticUser()` ou helper equivalente, nao apenas `requireAuthenticatedUser` simples.
- Se for usuario logado comum, usar `requireAuthenticatedUser({ requireAllowedUser: true, requireActive: true })`, sabendo que isso amplia acesso em relacao a UI atual.

### P1 - Rotas privadas Digisac

Rotas:
- `GET /api/users`
- `GET /api/usuarios-info`
- `POST /api/usuarios-info`
- `POST /api/dashboard/pesquisar`
- `POST /api/agendamentos/pesquisar`
- `POST /api/chamados-finalizados/pesquisar`
- `GET /api/chamados-finalizados/agendamentos`

Diagnostico comum:
- Chamadas por telas protegidas pelo middleware.
- Sem auth server-side na API.
- Exposicao direta de dados Digisac, observacoes internas ou metricas.

Decisao recomendada:
- Migrar em lote curto para `requireAuthenticatedUser({ requireAllowedUser: true, requireActive: true })`.
- Nao exigir `superadmin`, porque as telas atuais (`/dashboard`, `/agendamentos`, `/chamados-finalizados`) sao protegidas para usuario autenticado ativo, nao apenas superadmin.

### P1 - `GET /api/digisac/schedule`

Diagnostico confirmado:
- Tem apenas rate limit por IP.
- E usado por `src/components/HorariosAgendamentosPage.tsx`.
- A pagina `/horarios-agendamentos` e explicitamente publica no middleware.
- A API aceita `serviceId`, periodo, pagina e `perPage` por query string.

Risco:
- Alto: endpoint publico consulta agenda Digisac para `serviceId` e periodo informados.

Decisao recomendada:
- Decisao de produto antes de alterar.
- Se `/horarios-agendamentos` deve continuar publico, manter rota publica mas endurecer parametros: permitir apenas o `serviceId` esperado, limitar janela de datas, limitar `perPage`, manter rate limit e evitar exposicao de campos desnecessarios.
- Se a tela nao precisa ser publica, migrar pagina e API para sessao autenticada.

---

## 6. Rotas que podem usar `requireAuthenticatedUser`

Rotas recomendadas para migracao direta:
- `GET /api/users`
- `GET /api/usuarios-info`
- `POST /api/usuarios-info`
- `POST /api/dashboard/pesquisar`
- `POST /api/agendamentos/pesquisar`
- `POST /api/chamados-finalizados/pesquisar`
- `GET /api/chamados-finalizados/agendamentos`
- `GET /api/departments`

Configuracao sugerida:

```ts
const auth = await requireAuthenticatedUser({
  requireAllowedUser: true,
  requireActive: true,
})

if (!auth.ok) return auth.response
```

Justificativa:
- As telas consumidoras ja exigem usuario autenticado e ativo via middleware.
- Nao ha regra de superadmin confirmada nessas telas.
- A migracao server-side fecha chamada direta sem mudar a regra de produto aparente.

Observacao para `POST /api/usuarios-info`:
- Mesmo usando o helper, manter validacoes atuais de `contactId`, `observacao` string e limite de 100 caracteres.
- Considerar auditoria futura para escrita de observacao, mas nao misturar isso com a primeira correcao.

---

## 7. Rotas que devem usar Bearer token

Nenhuma rota Grupo D analisada tem chamada externa/cron/Apps Script confirmada no codigo.

Resultado:
- `MIGRAR_BEARER_TOKEN`: 0 rotas confirmadas.

Nao confirmado no codigo:
- Nenhum consumidor externo para as 12 rotas Grupo D foi encontrado nesta etapa.

---

## 8. Rotas publicas intencionais

Nenhuma rota Grupo D deve ser marcada como `MANTER_PUBLICA` sem decisao adicional.

Caso especial:
- `GET /api/digisac/schedule` serve uma pagina publica (`/horarios-agendamentos`), mas a API aceita parametros amplos. Por isso foi classificada como `DECISAO_PRODUTO`, nao como publica segura.

---

## 9. Rotas para decisao do usuario

### `GET /api/digisac/schedule`

Pergunta de produto:
- `/horarios-agendamentos` deve continuar 100% publica?

Opcoes:
- Sim: manter publica, mas endurecer parametros e resposta.
- Nao: proteger pagina e API com sessao.

### `POST /api/nfe/importar`

Pergunta de produto/permissao:
- Quem deve poder importar NFe: apenas Matic/Recebimento, usuarios ativos comuns, ou superadmin?

Opcoes:
- Apenas Matic/Recebimento: usar `validateMaticUser()`.
- Usuario ativo comum: usar `requireAuthenticatedUser({ requireAllowedUser: true, requireActive: true })`.
- Superadmin: usar `requiredRole: 'superadmin'`, mas isso nao bate com a UI atual de Recebimento/Pos-venda.

### Autocomplete legado

Rotas:
- `GET /api/autocomplete/departments`
- `GET /api/autocomplete/users`

Uso no codigo:
- Nenhuma chamada confirmada por `rg`.

Decisao recomendada:
- Remover/desativar se nao houver consumidor externo.
- Se houver consumidor externo nao versionado, proteger com auth antes de manter.

---

## 10. Ordem recomendada de implementacao

### Lote 1 - P0/P1 mais critico

1. `POST /api/nfe/importar`
   - Primeiro decidir escopo: Matic vs usuario ativo vs superadmin.
   - Recomendacao tecnica inicial: se preservar UI atual, usar `validateMaticUser()`.

2. `GET /api/usuarios-info`
3. `POST /api/usuarios-info`
   - Proteger leitura/escrita via service role com `requireAuthenticatedUser({ requireAllowedUser: true, requireActive: true })`.

### Lote 2 - Digisac privado operacional

4. `POST /api/chamados-finalizados/pesquisar`
5. `GET /api/chamados-finalizados/agendamentos`
6. `POST /api/dashboard/pesquisar`

### Lote 3 - Agendamentos e filtros

7. `POST /api/agendamentos/pesquisar`
8. `GET /api/users`
9. `GET /api/departments`

### Lote 4 - Decisao publica/limpeza

10. `GET /api/digisac/schedule`
    - Depende da decisao sobre `/horarios-agendamentos`.
11. `GET /api/autocomplete/users`
12. `GET /api/autocomplete/departments`
    - Remover/desativar se uso externo nao for confirmado.

---

## 11. Riscos conhecidos

- Middleware nao cobre `/api/*`; proteger apenas telas nao basta.
- Varias rotas Grupo D expõem dados Digisac por chamada direta.
- `POST /api/nfe/importar` pode ler Gmail e processar XMLs sem auth server-side.
- `POST /api/usuarios-info` escreve via service role sem identificar usuario.
- `GET /api/digisac/schedule` atende fluxo publico, mas com parametros amplos.
- Nao foi feita consulta MCP Supabase nesta etapa porque nao houve alteracao de banco e o escopo era diagnostico de codigo. Estruturas de tabelas citadas foram inferidas do codigo, exceto onde ja constavam nos documentos lidos; qualquer implementacao que dependa de schema deve validar no MCP antes.
- O worktree ja continha alteracoes de codigo da Fase 0.5E; esta etapa nao as alterou.

---

## 12. Proximo passo recomendado

Executar uma etapa 0.5G de implementacao em lote curto, com no maximo 3 rotas:

1. Decidir permissao de `POST /api/nfe/importar`.
2. Proteger `GET /api/usuarios-info`.
3. Proteger `POST /api/usuarios-info`.

Criterios para 0.5G:
- Validar schema/tabela no MCP Supabase se tocar `usuarios_info`, `nfe`, `nfe_itens` ou `nfe_assistencias`.
- Nao alterar payloads de sucesso.
- Manter regras de negocio.
- Rodar `npx tsc --noEmit`.
- Testar chamadas sem sessao, com usuario ativo permitido e com usuario bloqueado.
