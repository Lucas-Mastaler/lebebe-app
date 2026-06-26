# Plano Fase 0.5B - Migracao Helper Auth APIs

## 1. Resumo executivo

Este documento mapeia todas as API Routes do projeto Le Bebe App, classifica quais sao candidatas a migrar para o helper central `requireAuthenticatedUser` (criado na Fase 0.5A em `src/lib/auth/api-auth.ts`), e define a ordem recomendada de migracao em lotes pequenos.

Nenhuma rota foi alterada neste plano. Nenhum codigo foi modificado. Este documento e puramente diagnostico/plano.

## 2. Escopo

- Mapear e classificar todas as API Routes em `src/app/api/`
- Mapear a tela Superadmin e seus componentes
- Identificar APIs sem validacao de sessao
- Sugerir ordem de migracao
- **Nao migrar rotas nesta etapa**

## 3. Helper existente

Arquivo: `src/lib/auth/api-auth.ts`

Funcao: `requireAuthenticatedUser(options?)`

Opcoes:
- `requireAllowedUser`: consulta `usuarios_permitidos` via service role
- `requireActive`: valida `ativo === true` (implica requireAllowedUser)
- `requiredRole`: valida role exata (implica requireAllowedUser)

Retorno:
- Sucesso: `{ ok: true, user, email, allowedUser }`
- Erro: `{ ok: false, response: NextResponse }` (401/403/500)

Migrada na 0.5A: `POST /api/superadmin/reenviar-convite`

## 4. Critérios de classificacao

**Grupo A - Baixo risco para migrar agora:**
- Rotas privadas que ja validam sessao manualmente
- Rotas que ja consultam `usuarios_permitidos`
- Migracao provavel e apenas troca de validacao duplicada pelo helper

**Grupo B - Migrar com cuidado:**
- Rotas que misturam sessao de usuario e service role
- Rotas com regras especificas de acesso
- Rotas que podem ser chamadas por frontend e por server-side
- Rotas que precisam de role/ativo mas hoje fazem isso parcialmente

**Grupo C - Nao migrar para `requireAuthenticatedUser`:**
- Rotas publicas intencionais
- Rotas de callback OAuth
- Rotas chamadas por Apps Script, Digisac, cron, webhooks ou integracoes com Bearer token
- Rotas que devem usar `validarBearerToken` ou outro mecanismo proprio

**Grupo D - Precisa de decisao antes:**
- Rotas sem validacao clara
- Rotas onde nao esta claro se sao publicas ou privadas
- Rotas que podem estar em uso legado
- Rotas que exigem decisao de produto/permissao

## 5. Grupo A - Baixo risco

### 5.1 `POST /api/superadmin/adicionar-usuario`
- **Arquivo:** `src/app/api/superadmin/adicionar-usuario/route.ts`
- **Validacao atual:** `createClient()` + `getUser()` + `usuarios_permitidos` (role via service role)
- **Cliente provavel:** Frontend (tela Superadmin)
- **Risco atual:** Baixo. Ja valida sessao e role.
- **Recomendacao:** Trocar validacao manual por `requireAuthenticatedUser({ requireAllowedUser: true, requireActive: true, requiredRole: 'superadmin' })`
- **Observacoes:** Nao valida `ativo` explicitamente hoje (apenas role). O helper adicionaria essa validacao.

### 5.2 `GET /api/configuracoes/procurar-datas`
- **Arquivo:** `src/app/api/configuracoes/procurar-datas/route.ts`
- **Validacao atual:** `createClient()` + `getUser()` + `usuarios_permitidos` (role === 'superadmin')
- **Cliente provavel:** Frontend (tela Configuracoes)
- **Risco atual:** Baixo. Ja valida sessao e role.
- **Recomendacao:** Trocar por `requireAuthenticatedUser({ requireAllowedUser: true, requireActive: true, requiredRole: 'superadmin' })`
- **Observacoes:** Nao valida `ativo` hoje. Rota de leitura.

### 5.3 `PATCH /api/configuracoes/procurar-datas/[chave]`
- **Arquivo:** `src/app/api/configuracoes/procurar-datas/[chave]/route.ts`
- **Validacao atual:** `createClient()` + `getUser()` + `usuarios_permitidos` (role === 'superadmin')
- **Cliente provavel:** Frontend (tela Configuracoes)
- **Risco atual:** Baixo. Ja valida sessao e role.
- **Recomendacao:** Trocar por `requireAuthenticatedUser({ requireAllowedUser: true, requireActive: true, requiredRole: 'superadmin' })`
- **Observacoes:** Rota de escrita. Cuidado com validacao de whitelist de chaves.

### 5.4 `GET /api/configuracoes/procurar-datas/auditoria`
- **Arquivo:** `src/app/api/configuracoes/procurar-datas/auditoria/route.ts`
- **Validacao atual:** `createClient()` + `getUser()` + `usuarios_permitidos` (role === 'superadmin')
- **Cliente provavel:** Frontend (tela Configuracoes)
- **Risco atual:** Baixo. Ja valida sessao e role.
- **Recomendacao:** Trocar por `requireAuthenticatedUser({ requireAllowedUser: true, requireActive: true, requiredRole: 'superadmin' })`

### 5.5 `GET /api/configuracoes/procurar-datas/snapshot`
- **Arquivo:** `src/app/api/configuracoes/procurar-datas/snapshot/route.ts`
- **Validacao atual:** `createClient()` + `getUser()` + `usuarios_permitidos` (role === 'superadmin')
- **Cliente provavel:** Frontend (tela Configuracoes)
- **Risco atual:** Baixo. Ja valida sessao e role.
- **Recomendacao:** Trocar por `requireAuthenticatedUser({ requireAllowedUser: true, requireActive: true, requiredRole: 'superadmin' })`

### 5.6 `GET /api/configuracoes/procurar-datas/config-normalizada`
- **Arquivo:** `src/app/api/configuracoes/procurar-datas/config-normalizada/route.ts`
- **Validacao atual:** `createClient()` + `getUser()` + `usuarios_permitidos` (role === 'superadmin')
- **Cliente provavel:** Frontend (tela Configuracoes)
- **Risco atual:** Baixo. Ja valida sessao e role.
- **Recomendacao:** Trocar por `requireAuthenticatedUser({ requireAllowedUser: true, requireActive: true, requiredRole: 'superadmin' })`

### 5.7 `POST /api/configuracoes/procurar-datas/importar`
- **Arquivo:** `src/app/api/configuracoes/procurar-datas/importar/route.ts`
- **Validacao atual:** `createClient()` + `getUser()` + `usuarios_permitidos` (role === 'superadmin')
- **Cliente provavel:** Frontend (tela Configuracoes)
- **Risco atual:** Baixo. Ja valida sessao e role.
- **Recomendacao:** Trocar por `requireAuthenticatedUser({ requireAllowedUser: true, requireActive: true, requiredRole: 'superadmin' })`

### 5.8 `GET /api/google/setup-token`
- **Arquivo:** `src/app/api/google/setup-token/route.ts`
- **Validacao atual:** `createClient()` + `getUser()` + `usuarios_permitidos` (role === 'superadmin')
- **Cliente provavel:** Frontend (Superadmin)
- **Risco atual:** Baixo. Ja valida sessao e role.
- **Recomendacao:** Trocar por `requireAuthenticatedUser({ requireAllowedUser: true, requireActive: true, requiredRole: 'superadmin' })`
- **Observacoes:** Rota temporaria. Deve ser removida apos setup do Google OAuth.

## 6. Grupo B - Migrar com cuidado

### 6.1 `POST /api/auditoria/registrar`
- **Arquivo:** `src/app/api/auditoria/registrar/route.ts`
- **Validacao atual:** 3 caminhos: (1) `x-internal-token` server-side, (2) sessao browser via `createClient()`, (3) 401
- **Cliente provavel:** Frontend (browser) e server-side (rotas internas)
- **Risco atual:** Medio. Aceita token interno OU sessao browser.
- **Recomendacao:** Nao migrar diretamente. O helper `requireAuthenticatedUser` cobre apenas o caminho 2 (sessao browser). O caminho 1 (token interno) precisa continuar funcionando. Possivel solucao: usar helper apenas no caminho 2, mantendo caminho 1 separado.
- **Observacoes:** Rota central para auditoria do sistema. Quebrar essa rota afeta todo o app.

### 6.2 SGI routes (13 rotas) - `validateComercialUser`
- **Arquivos:**
  - `src/app/api/sgi/vendas/route.ts` (POST)
  - `src/app/api/sgi/vendas/[numero_lancamento]/route.ts` (GET)
  - `src/app/api/sgi/observacoes/route.ts` (GET, POST)
  - `src/app/api/sgi/observacoes/[id]/route.ts` (PUT, DELETE)
  - `src/app/api/sgi/observacoes/cliente/route.ts` (GET)
  - `src/app/api/sgi/ia/processar-proximo/route.ts` (POST)
  - `src/app/api/sgi/ia/iniciar-analise/route.ts` (POST)
  - `src/app/api/sgi/ia/analise-status/route.ts` (GET)
  - `src/app/api/sgi/filtros/route.ts` (GET)
  - `src/app/api/sgi/digisac/sync-status/route.ts` (GET)
  - `src/app/api/sgi/digisac/processar-fila/route.ts` (POST)
  - `src/app/api/sgi/digisac/sincronizar-venda/route.ts` (POST)
  - `src/app/api/sgi/digisac/mensagens/route.ts` (GET)
  - `src/app/api/sgi/digisac/chamados-ciclo/route.ts` (GET)
  - `src/app/api/sgi/classificar-vendas/route.ts` (POST)
  - `src/app/api/sgi/classificacao-referencia/importar/route.ts` (POST)
  - `src/app/api/sgi/agendamentos-futuros/route.ts` (GET)
- **Validacao atual:** `validateComercialUser()` (helper em `src/lib/auth/sgi-auth.ts`)
- **Cliente provavel:** Frontend (Inteligencia Comercial)
- **Risco atual:** Baixo. Ja tem helper proprio.
- **Recomendacao:** Migrar gradualmente APENAS se houver decisao de unificar helpers. O helper `validateComercialUser` ja funciona bem. Migracao para `requireAuthenticatedUser` exigiria ajustar o padrao de retorno (hoje retorna `{ authorized, userId, email }` vs `{ ok, user, email, allowedUser }`).
- **Observacoes:** Migracao de 17 rotas. Volume alto. Prioridade baixa enquanto `validateComercialUser` funciona.

## 7. Grupo C - Nao migrar para helper

### 7.1 `POST /api/auth/logout`
- **Arquivo:** `src/app/api/auth/logout/route.ts`
- **Validacao atual:** `getUser()` opcional (registra auditoria se logado, faz signOut sempre)
- **Motivo:** Rota publica intencional. Deve funcionar mesmo sem sessao.

### 7.2 `GET /api/auth/convite/[token]`
- **Arquivo:** `src/app/api/auth/convite/[token]/route.ts`
- **Validacao atual:** Nenhuma (redirect simples)
- **Motivo:** Rota publica de redirect de convite.

### 7.3 `POST /api/auth/convite/[token]/confirm`
- **Arquivo:** `src/app/api/auth/convite/[token]/confirm/route.ts`
- **Validacao atual:** Token no path (nao sessao)
- **Motivo:** Rota publica de confirmacao de convite. Autenticacao por token, nao por sessao.

### 7.4 `POST /api/auth/recuperar-senha`
- **Arquivo:** `src/app/api/auth/recuperar-senha/route.ts`
- **Validacao atual:** Nenhuma (publica)
- **Motivo:** Rota publica de recuperacao de senha.

### 7.5 `POST /api/google/apps-script/executar`
- **Arquivo:** `src/app/api/google/apps-script/executar/route.ts`
- **Validacao atual:** `validarBearerToken(request, "API APPS SCRIPT")`
- **Motivo:** Chamada por Apps Script. Usa Bearer token.

### 7.6 `POST /api/google/calendar/reagendar-cliente`
- **Arquivo:** `src/app/api/google/calendar/reagendar-cliente/route.ts`
- **Validacao atual:** `validarBearerToken(request, "API REAGENDAMENTO")`
- **Motivo:** Chamada por Apps Script. Usa Bearer token.

### 7.7 `POST /api/procurar-datas/auditoria-legado`
- **Arquivo:** `src/app/api/procurar-datas/auditoria-legado/route.ts`
- **Validacao atual:** `validarBearerToken(request, "AUDITORIA LEGADO")`
- **Motivo:** Chamada por Apps Script. Usa Bearer token.

### 7.8 `POST /api/sgi/classificar-pendentes`
- **Arquivo:** `src/app/api/sgi/classificar-pendentes/route.ts`
- **Validacao atual:** `x-internal-token` header (SGI_CLASSIFICACAO_TOKEN)
- **Motivo:** Chamada por VPS/integracao interna. Usa token proprio.

### 7.9 `GET /api/cron/auto-logout`
- **Arquivo:** `src/app/api/cron/auto-logout/route.ts`
- **Validacao atual:** `Bearer ${process.env.CRON_SECRET}`
- **Motivo:** Chamada por cron. Usa CRON_SECRET.

### 7.10 `POST /api/digisac/webhook`
- **Arquivo:** `src/app/api/digisac/webhook/route.ts`
- **Validacao atual:** `DIGISAC_WEBHOOK_SECRET` header
- **Motivo:** Webhook Digisac. Usa secret proprio.

### 7.11 Procurar-datas routes (26 rotas) - `validarAcessoProcurarDatas`
- **Arquivos:** Todas as rotas em `src/app/api/procurar-datas/` (exceto auditoria-legado)
- **Validacao atual:** `validarAcessoProcurarDatas()` (usa `validateComercialUser`)
- **Motivo:** Escopo proibido. Nao mexer em `/procurar-datas`.

### 7.12 Recebimento routes (13 rotas) - `validateMaticUser`
- **Arquivos:** Todas as rotas em `src/app/api/recebimento/`
- **Validacao atual:** `validateMaticUser()` (whitelist hardcoded)
- **Motivo:** Escopo proibido. Nao mexer em Recebimento/Matic.

### 7.13 Matic routes (4 rotas) - `validateMaticUser`
- **Arquivos:** Todas as rotas em `src/app/api/matic/`
- **Validacao atual:** `validateMaticUser()`
- **Motivo:** Escopo proibido. Nao mexer em Recebimento/Matic.

## 8. Grupo D - Decisao necessaria

### 8.1 `GET /api/digisac/schedule`
- **Arquivo:** `src/app/api/digisac/schedule/route.ts`
- **Validacao atual:** Rate limit apenas. Sem validacao de sessao.
- **Cliente provavel:** Frontend (Dashboard/Agendamentos)
- **Risco atual:** Alto. Sem auth.
- **Decisao necessaria:** Esta rota deve exigir sessao? E chamada pelo frontend autenticado?

### 8.2 `GET /api/users`
- **Arquivo:** `src/app/api/users/route.ts`
- **Validacao atual:** Nenhuma. Proxy direto para Digisac.
- **Cliente provavel:** Frontend (autocomplete)
- **Risco atual:** Alto. Sem auth.
- **Decisao necessaria:** Deve exigir sessao?

### 8.3 `GET /api/usuarios-info`
- **Arquivo:** `src/app/api/usuarios-info/route.ts`
- **Validacao atual:** Nenhuma. Usa service client diretamente.
- **Cliente provavel:** Frontend
- **Risco atual:** Alto. Sem auth e usa service role.
- **Decisao necessaria:** Deve exigir sessao? Por que usa service client?

### 8.4 `POST /api/usuarios-info`
- **Arquivo:** `src/app/api/usuarios-info/route.ts`
- **Validacao atual:** Nenhuma. Usa service client diretamente.
- **Cliente provavel:** Frontend
- **Risco atual:** Alto. Sem auth e usa service role.
- **Decisao necessaria:** Deve exigir sessao?

### 8.5 `POST /api/dashboard/pesquisar`
- **Arquivo:** `src/app/api/dashboard/pesquisar/route.ts`
- **Validacao atual:** Nenhuma.
- **Cliente provavel:** Frontend (Dashboard)
- **Risco atual:** Alto. Sem auth.
- **Decisao necessaria:** Deve exigir sessao?

### 8.6 `POST /api/agendamentos/pesquisar`
- **Arquivo:** `src/app/api/agendamentos/pesquisar/route.ts`
- **Validacao atual:** Nenhuma.
- **Cliente provavel:** Frontend (Agendamentos)
- **Risco atual:** Alto. Sem auth.
- **Decisao necessaria:** Deve exigir sessao?

### 8.7 `GET /api/autocomplete/departments`
- **Arquivo:** `src/app/api/autocomplete/departments/route.ts`
- **Validacao atual:** Nenhuma.
- **Cliente provavel:** Frontend
- **Risco atual:** Medio. Sem auth.
- **Decisao necessaria:** Deve exigir sessao?

### 8.8 `GET /api/autocomplete/users`
- **Arquivo:** `src/app/api/autocomplete/users/route.ts`
- **Validacao atual:** Nenhuma.
- **Cliente provavel:** Frontend
- **Risco atual:** Medio. Sem auth.
- **Decisao necessaria:** Deve exigir sessao?

### 8.9 `POST /api/chamados-finalizados/pesquisar`
- **Arquivo:** `src/app/api/chamados-finalizados/pesquisar/route.ts`
- **Validacao atual:** Nenhuma.
- **Cliente provavel:** Frontend (Chamados Finalizados)
- **Risco atual:** Alto. Sem auth.
- **Decisao necessaria:** Deve exigir sessao?

### 8.10 `GET /api/chamados-finalizados/agendamentos`
- **Arquivo:** `src/app/api/chamados-finalizados/agendamentos/route.ts`
- **Validacao atual:** Nenhuma.
- **Cliente provavel:** Frontend
- **Risco atual:** Alto. Sem auth.
- **Decisao necessaria:** Deve exigir sessao?

### 8.11 `GET /api/departments`
- **Arquivo:** `src/app/api/departments/route.ts`
- **Validacao atual:** Nenhuma.
- **Cliente provavel:** Frontend
- **Risco atual:** Medio. Sem auth.
- **Decisao necessaria:** Deve exigir sessao?

### 8.12 `POST /api/nfe/importar`
- **Arquivo:** `src/app/api/nfe/importar/route.ts`
- **Validacao atual:** Nenhuma. Usa Gmail service account (Google JWT).
- **Cliente provavel:** Frontend (Pos-venda)
- **Risco atual:** Alto. Sem auth.
- **Decisao necessaria:** Deve exigir sessao? E chamada pelo frontend autenticado?

## 9. Ordem recomendada de migracao

### Lote 1 (proxima etapa) - maximo 3 rotas Grupo A:
1. `POST /api/superadmin/adicionar-usuario` - mais proxima do padrao ja migrado
2. `GET /api/google/setup-token` - rota temporaria, simples
3. `GET /api/configuracoes/procurar-datas` - rota de leitura, sem escrita

### Lote 2:
4. `PATCH /api/configuracoes/procurar-datas/[chave]` - rota de escrita
5. `GET /api/configuracoes/procurar-datas/auditoria`
6. `GET /api/configuracoes/procurar-datas/snapshot`

### Lote 3:
7. `GET /api/configuracoes/procurar-datas/config-normalizada`
8. `POST /api/configuracoes/procurar-datas/importar`

### Lote 4 (apos decisao de produto):
- Rotas Grupo D sem auth: decidir quais devem exigir sessao e migrar
- Priorizar: `/api/dashboard/pesquisar`, `/api/agendamentos/pesquisar`, `/api/chamados-finalizados/pesquisar`

### Nao migrar (Grupo C):
- Rotas com Bearer token, webhooks, cron, callbacks publicos
- Rotas de `/procurar-datas`, `/recebimento`, `/matic` (escopo proibido)

## 10. Riscos conhecidos

- **Helper ainda nao aplicado em todas as APIs.** APIs Grupo D continuam sem auth ate decisao de produto.
- **`requireAuthenticatedUser` consulta `usuarios_permitidos` via service role.** Correto para evitar RLS, mas mantem dependencia de service role key.
- **Migracao de SGI routes (Grupo B) tem volume alto (17 rotas).** Baixa prioridade enquanto `validateComercialUser` funciona.
- **`/api/auditoria/registrar` tem 3 caminhos de auth.** Migracao parcial (apenas caminho browser) exige cuidado para nao quebrar caminho server-side.
- **Tela Superadmin faz operacoes diretas no Supabase client** (block/unblock/role-change) sem passar por API Routes. Isso significa que a validacao depende apenas de RLS/middleware, nao de server-side checks.

## 11. Critérios de aceite para a proxima etapa

- Cada rota migrada deve:
  - Continuar retornando os mesmos status codes (401/403/500)
  - Continuar retornando o mesmo formato de resposta
  - Nao alterar payload de entrada/saida
  - Nao alterar regra de negocio
  - Passar `npx tsc --noEmit`
- Cada lote deve ter no maximo 3 rotas
- apos cada lote, rodar `npx tsc --noEmit` e atualizar `docs/ia/log_progress.md`

## 12. Proximo passo recomendado

1. **Commit da 0.5B** (este plano + log atualizado)
2. **Executar Lote 1** (migrar `adicionar-usuario`, `setup-token`, `configuracoes/procurar-datas` GET)
3. **Decisao de produto:** quais rotas Grupo D devem exigir sessao?

---

## 13. Mapeamento da tela Superadmin

### 13.1 Arquivo da pagina
- `src/app/superadmin/page.tsx` (476 linhas, client component)

### 13.2 Estrutura
- Tabs: "Usuarios" e "Auditoria"
- Usa `createClient()` (browser client) diretamente para operacoes no Supabase
- Usa `registrarAuditoria()` para registro de auditoria

### 13.3 APIs usadas pela tela
- `POST /api/superadmin/adicionar-usuario` - adicionar usuario (com envio de convite)
- `POST /api/superadmin/reenviar-convite` - reenviar convite (ja migrado para helper)
- **Operacoes diretas no Supabase client (sem API Route):**
  - Listar usuarios: `supabase.from('usuarios_permitidos').select('*')`
  - Bloquear usuario: `supabase.from('usuarios_permitidos').update({ ativo: false })`
  - Desbloquear usuario: `supabase.from('usuarios_permitidos').update({ ativo: true })`
  - Alterar role: `supabase.from('usuarios_permitidos').update({ role: novaRole })`
  - Listar auditoria: `supabase.from('auditoria_acessos').select('*')`

### 13.4 Tabelas envolvidas
- `usuarios_permitidos` (CRUD completo: select, update ativo, update role)
- `auditoria_acessos` (select apenas)

### 13.5 Validacoes server-side
- `POST /api/superadmin/adicionar-usuario`: valida sessao + role superadmin (manual)
- `POST /api/superadmin/reenviar-convite`: valida via `requireAuthenticatedUser` (migrado)
- **Block/unblock/role-change: SEM validacao server-side.** Operacoes feitas diretamente pelo browser client via Supabase. Dependem de RLS para seguranca.

### 13.6 Usa `requireAuthenticatedUser`?
- Nao. A pagina usa `createClient()` (browser) diretamente. Apenas as rotas `/api/superadmin/*` usam validacao server-side.

### 13.7 O que pode ser reaproveitado para futura tela de gestao de acessos
- **Estrutura de Tabs** (Usuarios / Auditoria)
- **Tabela de listagem de usuarios** com colunas email, role, status, data
- **Dialog de adicionar usuario**
- **Filtros de auditoria** (email, acao)
- **Logica de hardcode protection** (lucas@lebebe.com.br, robyson@lebebe.com.br nao podem ser bloqueados/rebaixados)

### 13.8 O que precisa ser criado para permissoes por tela e horario
- **API Routes para block/unblock/role-change** (hoje sao client-side direto)
- **Nova tabela ou colunas em `usuarios_permitidos`** para permissoes por tela (ex: `permissoes JSONB` ou tabela separada `usuario_permissoes_telas`)
- **Nova tabela ou colunas para horario permitido** (ex: `horario_inicio TIME`, `horario_fim TIME`, ou `horarios_permitidos JSONB`)
- **Middleware ou helper para validar permissoes por tela** (alem de role/ativo)
- **Middleware ou helper para validar horario de acesso** (alem de auto-logout atual)
- **UI para configurar permissoes por tela e horario** na tela Superadmin
- **Migracao das operacoes client-side para API Routes** com validacao server-side via `requireAuthenticatedUser`
