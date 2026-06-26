# Checkpoint Fase 0.5J - Rotas restantes auth

Data: 2026-06-26
Agente: Codex
Tipo: checkpoint/diagnostico somente leitura

Nenhum codigo funcional, rota, middleware, banco, migration, RLS, grant, policy, tela ou payload foi alterado nesta etapa.

---

## 1. Resumo executivo

A Fase 0.5J revisou o estado das rotas Grupo D apos as implementacoes das Fases 0.5G, 0.5H e 0.5I.

Resultado confirmado no codigo:
- As rotas internas privadas do Grupo D ja migradas em 0.5G, 0.5H e 0.5I usam validacao server-side.
- Nao restou rota privada interna Grupo D confirmada no codigo como `PRECISA_PROTEGER_REQUIRE_AUTH`.
- `GET /api/digisac/schedule` continua sem sessao, mas foi reclassificada como `PUBLICA_INTENCIONAL` porque sustenta a pagina publica `/horarios-agendamentos`, conforme decisao do usuario.
- `GET /api/autocomplete/users` e `GET /api/autocomplete/departments` continuam sem auth, mas nao tiveram consumidor confirmado no codigo. Foram classificadas como `REMOVER_OU_DESATIVAR`.
- Rotas de webhook, cron, Bearer token e token interno devem continuar fora de `requireAuthenticatedUser`.

Conclusao objetiva:
- O proximo risco relevante nao e migrar mais rotas privadas Grupo D, e sim endurecer a rota publica `GET /api/digisac/schedule` sem exigir login.
- As rotas autocomplete legadas devem ser removidas/desativadas ou protegidas antes de qualquer uso futuro.

---

## 2. Rotas ja protegidas

### 2.1 Protegidas na Fase 0.5G

| Rota | Metodo | Arquivo | Validacao atual | Classificacao |
|---|---:|---|---|---|
| `/api/nfe/importar` | POST | `src/app/api/nfe/importar/route.ts` | `validateMaticUser()` antes de Gmail/JWT | `JA_PROTEGIDA` |
| `/api/usuarios-info` | GET | `src/app/api/usuarios-info/route.ts` | `requireAuthenticatedUser({ requireAllowedUser: true, requireActive: true })` | `JA_PROTEGIDA` |
| `/api/usuarios-info` | POST | `src/app/api/usuarios-info/route.ts` | `requireAuthenticatedUser({ requireAllowedUser: true, requireActive: true })` | `JA_PROTEGIDA` |

### 2.2 Protegidas na Fase 0.5H

| Rota | Metodo | Arquivo | Validacao atual | Classificacao |
|---|---:|---|---|---|
| `/api/chamados-finalizados/pesquisar` | POST | `src/app/api/chamados-finalizados/pesquisar/route.ts` | `requireAuthenticatedUser({ requireAllowedUser: true, requireActive: true })` | `JA_PROTEGIDA` |
| `/api/chamados-finalizados/agendamentos` | GET | `src/app/api/chamados-finalizados/agendamentos/route.ts` | `requireAuthenticatedUser({ requireAllowedUser: true, requireActive: true })` | `JA_PROTEGIDA` |
| `/api/dashboard/pesquisar` | POST | `src/app/api/dashboard/pesquisar/route.ts` | `requireAuthenticatedUser({ requireAllowedUser: true, requireActive: true })` | `JA_PROTEGIDA` |

### 2.3 Protegidas na Fase 0.5I

| Rota | Metodo | Arquivo | Validacao atual | Classificacao |
|---|---:|---|---|---|
| `/api/agendamentos/pesquisar` | POST | `src/app/api/agendamentos/pesquisar/route.ts` | `requireAuthenticatedUser({ requireAllowedUser: true, requireActive: true })` | `JA_PROTEGIDA` |
| `/api/users` | GET | `src/app/api/users/route.ts` | `requireAuthenticatedUser({ requireAllowedUser: true, requireActive: true })` | `JA_PROTEGIDA` |
| `/api/departments` | GET | `src/app/api/departments/route.ts` | `requireAuthenticatedUser({ requireAllowedUser: true, requireActive: true })` | `JA_PROTEGIDA` |

### 2.4 Outras rotas ja protegidas fora do Grupo D

| Area | Padrao confirmado |
|---|---|
| Superadmin | Rotas lidas usam `requireAuthenticatedUser` com `requiredRole: 'superadmin'` quando administrativas. |
| Configuracoes procurar-datas | Rotas administrativas ja migradas usam `requireAuthenticatedUser` com `requiredRole: 'superadmin'`. |
| SGI interno | Rotas SGI usam `validateComercialUser()` ou mecanismo proprio conforme escopo. |
| Recebimento/Matic | Rotas Matic/Recebimento usam `validateMaticUser()` quando aplicavel. |
| Procurar-datas | Rotas usam `validarAcessoProcurarDatas()` ou Bearer token no legado; escopo proibido para alteracao nesta etapa. |

---

## 3. Decisao sobre `/horarios-agendamentos`

Decisao do usuario nesta etapa:
- `https://lebebe.cloud/horarios-agendamentos` pode continuar aberta/publica.
- A rota usada por essa pagina nao deve ser migrada para `requireAuthenticatedUser`.

Confirmado no codigo:
- `src/middleware.ts` libera explicitamente `/horarios-agendamentos`.
- `src/app/horarios-agendamentos/page.tsx` renderiza `HorariosAgendamentosPage`.
- `src/components/HorariosAgendamentosPage.tsx` chama `GET /api/digisac/schedule`.
- `src/app/api/digisac/schedule/route.ts` usa rate limit por IP e valida parametros obrigatorios, mas nao valida sessao.
- A chamada do componente usa um `serviceId` fixo no frontend e `perPage=200`.

Classificacao:
- `GET /api/digisac/schedule`: `PUBLICA_INTENCIONAL`.

Nao migrar agora para auth de sessao, porque isso quebraria a pagina publica.

Hardening recomendado para etapa futura:
- Permitir apenas o `serviceId` esperado.
- Validar formato ISO de `startUtc` e `endUtc`.
- Limitar janela maxima de datas.
- Limitar `perPage` server-side.
- Reduzir campos retornados ao minimo necessario para a pagina publica.
- Revisar cache/rate limit.
- Evitar logs com dados sensiveis ou parametros amplos.

---

## 4. Rotas publicas intencionais

| Rota | Metodo | Arquivo | Motivo | Classificacao |
|---|---:|---|---|---|
| `/api/digisac/schedule` | GET | `src/app/api/digisac/schedule/route.ts` | Sustenta `/horarios-agendamentos`, pagina publica por decisao do usuario. | `PUBLICA_INTENCIONAL` |
| `/api/auth/logout` | POST | `src/app/api/auth/logout/route.ts` | Deve funcionar mesmo sem sessao; registra auditoria quando ha usuario. | `PUBLICA_INTENCIONAL` |
| `/api/auth/convite/[token]` | GET | `src/app/api/auth/convite/[token]/route.ts` | Fluxo publico de convite por token no path. | `PUBLICA_INTENCIONAL` |
| `/api/auth/convite/[token]/confirm` | POST | `src/app/api/auth/convite/[token]/confirm/route.ts` | Confirmacao publica por token de convite. | `PUBLICA_INTENCIONAL` |
| `/api/auth/recuperar-senha` | POST | `src/app/api/auth/recuperar-senha/route.ts` | Fluxo publico de recuperacao de senha. | `PUBLICA_INTENCIONAL` |

---

## 5. Rotas webhook ou integracao

Estas rotas nao devem migrar para `requireAuthenticatedUser`, porque usam segredo, Bearer token, cron ou token interno.

| Rota | Metodo | Arquivo | Mecanismo confirmado | Classificacao |
|---|---:|---|---|---|
| `/api/digisac/webhook` | POST | `src/app/api/digisac/webhook/route.ts` | Header de webhook via `DIGISAC_WEBHOOK_SECRET` quando configurado. | `WEBHOOK_OU_INTEGRACAO` |
| `/api/cron/auto-logout` | GET | `src/app/api/cron/auto-logout/route.ts` | Bearer `CRON_SECRET`. | `WEBHOOK_OU_INTEGRACAO` |
| `/api/google/apps-script/executar` | POST | `src/app/api/google/apps-script/executar/route.ts` | `validarBearerToken`. | `WEBHOOK_OU_INTEGRACAO` |
| `/api/google/calendar/reagendar-cliente` | POST | `src/app/api/google/calendar/reagendar-cliente/route.ts` | `validarBearerToken`. | `WEBHOOK_OU_INTEGRACAO` |
| `/api/procurar-datas/auditoria-legado` | POST | `src/app/api/procurar-datas/auditoria-legado/route.ts` | `validarBearerToken`. | `WEBHOOK_OU_INTEGRACAO` |
| `/api/sgi/classificar-pendentes` | POST | `src/app/api/sgi/classificar-pendentes/route.ts` | `x-internal-token` com `SGI_CLASSIFICACAO_TOKEN`. | `WEBHOOK_OU_INTEGRACAO` |
| `/api/auditoria/registrar` | POST | `src/app/api/auditoria/registrar/route.ts` | Token interno ou sessao browser. | `JA_PROTEGIDA` |

Observacao:
- Em `POST /api/digisac/webhook`, a seguranca depende de `DIGISAC_WEBHOOK_SECRET` estar configurado no ambiente. Se a env estiver ausente, o codigo nao consegue validar o segredo. Confirmacao do ambiente de producao nao foi feita nesta etapa.

---

## 6. Rotas ainda pendentes de protecao

Resultado desta revisao:
- Nenhuma rota privada interna Grupo D restante foi confirmada no codigo como `PRECISA_PROTEGER_REQUIRE_AUTH`.

Rotas que continuam sem sessao mas nao entram nessa categoria:
- `GET /api/digisac/schedule`: publica intencional por decisao do usuario.
- `GET /api/autocomplete/users`: sem consumidor confirmado; candidata a remocao/desativacao.
- `GET /api/autocomplete/departments`: sem consumidor confirmado; candidata a remocao/desativacao.
- Rotas publicas de auth/convite/recuperacao.
- Rotas webhook/cron/Bearer/token interno.

---

## 7. Rotas para decisao de produto

| Rota | Metodo | Decisao pendente | Recomendacao |
|---|---:|---|---|
| `/api/digisac/schedule` | GET | Definir contrato publico exato da agenda: service permitido, janela maxima, campos retornados, cache e rate limit. | Manter publica, mas endurecer parametros e resposta. |
| `/api/autocomplete/users` | GET | Confirmar se existe consumidor externo nao encontrado no codigo. | Remover/desativar se nao houver consumidor; se mantida, proteger antes de uso. |
| `/api/autocomplete/departments` | GET | Confirmar se existe consumidor externo nao encontrado no codigo. | Remover/desativar se nao houver consumidor; se mantida, proteger antes de uso. |
| `/api/google/setup-token` | GET | Confirmar se setup Google OAuth ja foi concluido. | Remover apos setup; rota ja esta protegida como superadmin. |

---

## 8. Rotas candidatas a remocao ou desativacao

| Rota | Metodo | Arquivo | Evidencia | Classificacao |
|---|---:|---|---|---|
| `/api/autocomplete/users` | GET | `src/app/api/autocomplete/users/route.ts` | Nenhuma chamada confirmada no codigo por busca textual. | `REMOVER_OU_DESATIVAR` |
| `/api/autocomplete/departments` | GET | `src/app/api/autocomplete/departments/route.ts` | Nenhuma chamada confirmada no codigo por busca textual. | `REMOVER_OU_DESATIVAR` |
| `/api/google/setup-token` | GET | `src/app/api/google/setup-token/route.ts` | Rota temporaria de setup; ja protegida como superadmin. | `PRECISA_DECISAO_PRODUTO` |

---

## 9. Riscos conhecidos

- `GET /api/digisac/schedule` continua publica e consulta dados Digisac. Isso e intencional, mas precisa de hardening de parametros e resposta.
- O `serviceId` de horarios e fixo no frontend, mas a API ainda aceita `serviceId` por query string sem allowlist confirmada.
- `perPage` e janela de datas da rota publica ainda devem ser limitados server-side em etapa futura.
- `GET /api/autocomplete/users` e `GET /api/autocomplete/departments` seguem sem auth, embora sem consumidor confirmado no codigo.
- `POST /api/digisac/webhook` depende de `DIGISAC_WEBHOOK_SECRET` configurado no ambiente; isso nao foi confirmado nesta etapa.
- O worktree ja continha alteracoes de codigo da Fase 0.5I antes deste checkpoint.
- Nao foram executados testes manuais de chamadas HTTP nesta etapa.

---

## 10. Proximo passo recomendado

Executar uma Fase 0.5K focada em hardening da rota publica de horarios, sem exigir login:

1. `GET /api/digisac/schedule`
   - Allowlist do `serviceId` publico esperado.
   - Validacao forte de datas.
   - Limite de janela de busca.
   - Limite server-side de `perPage`.
   - Reducao dos campos retornados.
   - Revisao de rate limit/cache/logs.

2. Decidir destino das rotas autocomplete legadas:
   - Remover/desativar se nao houver consumidor externo.
   - Ou proteger com `requireAuthenticatedUser` antes de reuso.

3. Confirmar configuracao de producao para `DIGISAC_WEBHOOK_SECRET`.
