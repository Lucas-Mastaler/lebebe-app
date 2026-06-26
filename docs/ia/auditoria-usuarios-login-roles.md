# Auditoria de autenticacao, usuarios, roles e permissoes

Data: 2026-06-26
Agente: Cascade
Tipo: auditoria investigativa (somente leitura)
Nenhum codigo funcional, migration ou tabela foi alterado.

---

## 1. Resumo executivo

Sistema usa Supabase Auth com Google OAuth como unico provider. Autorizacao em 3 camadas: middleware (sessao + whitelist + role), server-side (validacao por pagina/API), e RLS no banco. Tabela `usuarios_permitidos` com 11 usuarios, 2 roles (user/superadmin), 2 superadmins. Emails hardcoded protegem superadmins de lockout e whitelist de recebimento Matic. Auto-logout as 19h BRT via middleware + cron.

Riscos criticos encontrados:
- 6 tabelas sem RLS com grants completos para anon e authenticated (confirmado no MCP)
- API `/api/auditoria/registrar` sem validacao de identidade
- API `/api/superadmin/reenviar-convite` sem validar sessao
- Middleware nao cobre rotas `/api/*` (risco estrutural; cada API deve implementar sua propria validacao)

---

## 2. Escopo auditado

### Confirmado no codigo

- `src/middleware.ts` (152 linhas)
- `src/lib/auth/*` (6 arquivos: auto-logout.ts, bearer-auth.ts, helpers.ts, matic-auth.ts, matic-emails.ts, sgi-auth.ts)
- `src/lib/supabase/*` (server.ts, client.ts, service.ts)
- `src/app/auth/callback/route.ts`
- `src/app/(auth)/login/page.tsx`
- `src/app/superadmin/page.tsx` (476 linhas)
- `src/app/api/superadmin/adicionar-usuario/route.ts`
- `src/app/api/superadmin/reenviar-convite/route.ts`
- `src/app/api/configuracoes/procurar-datas/route.ts`
- `src/app/api/cron/auto-logout/route.ts`
- `src/app/api/auth/logout/route.ts`
- `src/app/api/auth/convite/[token]/confirm/route.ts`
- `src/app/api/auditoria/registrar/route.ts`
- `src/app/api/google/setup-token/route.ts`
- `src/components/Sidebar.tsx`, `Navigation.tsx`, `AuthenticatedLayout.tsx`, `LayoutWrapper.tsx`
- `src/app/procurar-datas/dev-v2/page.tsx`
- `src/app/recebimento/page.tsx`
- `src/types/supabase.ts`

### Confirmado no MCP Supabase

- Tabela `usuarios_permitidos`: 12 colunas, 11 rows, RLS habilitada
- Tabela `auditoria_acessos`: 7 colunas, 855 rows, RLS habilitada
- Tabela `sessoes_logout_automatico`: RLS desabilitada
- Funcoes SQL: `is_superadmin()` e `is_own_record(record_email)` confirmadas
- 4 RLS policies em `usuarios_permitidos` (SELECT/INSERT/UPDATE/DELETE)
- 1 RLS policy em `auditoria_acessos` (SELECT apenas)
- `relforcerowsecurity = false` em ambas (service role bypassa)
- 10 indices em `usuarios_permitidos`
- 11 usuarios: 2 superadmins (lucas@, robyson@), 9 users
- 6 tabelas sem RLS: grants completos (DELETE, INSERT, SELECT, UPDATE, TRUNCATE, REFERENCES, TRIGGER) para roles anon e authenticated confirmados via information_schema.table_privileges

### Nao validado

- Conteudo linha-a-linha das 21 migrations SQL (apenas grep)
- Comportamento real do cron em producao (apenas codigo lido)
- Se `/api/auditoria/registrar` e chamada externamente em producao

---

## 3. Como o login funciona hoje

Fluxo confirmado:

1. Usuario clica "Entrar com Google" em `/login`
2. `supabase.auth.signInWithOAuth('google')` com escopos: openid, email, profile, script.external_request, spreadsheets, drive, calendar, script.scriptapp
3. Google redireciona para `/auth/callback` que troca code por sessao via `exchangeCodeForSession`
4. Callback consulta `usuarios_permitidos` por email. Se nao existe: signOut + redirect `/login?error=not_allowed`. Se `ativo=false`: signOut + redirect `/login?error=blocked`
5. Salva `provider_refresh_token` em `google_oauth_setup` (tabela temporaria)
6. Registra auditoria (LOGIN_SUCESSO ou LOGIN_FALHA)
7. Redirect para `/dashboard`

Logout: `POST /api/auth/logout` faz signOut + auditoria LOGOUT.

Convite: superadmin adiciona email via API -> insere em `usuarios_permitidos` com `invite_token` -> envia email com link `/convite/{token}` -> confirmacao gera link OTP Supabase -> usuario define senha em `/definir-senha`.

Nao existe login por senha direto no frontend. Apenas Google OAuth.

---

## 4. Como a autorizacao funciona hoje

### Camada 1 - Middleware (src/middleware.ts)

Rotas publicas: `/login`, `/recuperar-senha`, `/resetar-senha`, `/definir-senha`, `/convite`.
Rota publica especial: `/horarios-agendamentos` (100% publica).

Matcher (rotas onde middleware roda): `/agendamentos/*`, `/dashboard/*`, `/procurar-datas/*`, `/configuracoes/*`, `/chamados-finalizados/*`, `/superadmin/*`, `/recebimento/*`, `/inteligencia-comercial/*`, `/pos-venda/*`, `/`.

Para rotas protegidas: (1) getUser verifica sessao, (2) consulta `usuarios_permitidos` por email, (3) nao existe ou erro: signOut + redirect login, (4) ativo=false: signOut + redirect login, (5) auto-logout 19h BRT se role != superadmin, (6) `/superadmin/*` requer role=superadmin, (7) `/configuracoes/*` requer role=superadmin.

Rotas `/api/*` nao estao no matcher do middleware. Ver secao 12 (riscos) para detalhes.

### Camada 2 - Server-side (paginas e APIs)

Cada API faz sua propria validacao individualmente. Nao ha centralizacao. Tres padroes encontrados:
- `validateComercialUser()`: valida sessao + consulta `usuarios_permitidos.ativo` (usado por APIs SGI e procurar-datas)
- `validateMaticUser()`: valida sessao + verifica email contra `MATIC_ALLOWED_EMAILS` hardcoded (usado por APIs de recebimento)
- Validacao inline superadmin: getUser + consulta `usuarios_permitidos.role = 'superadmin'` (usado por APIs de configuracoes)

### Camada 3 - RLS no banco

`usuarios_permitidos`: RLS ON. SELECT: `is_superadmin() OR is_own_record(email)`. INSERT/UPDATE/DELETE: `is_superadmin()`.
`auditoria_acessos`: RLS ON. SELECT: `is_superadmin()`. Sem policy INSERT (auditoria so grava via service role).
`sessoes_logout_automatico`: RLS OFF.
`relforcerowsecurity = false` em todas: service role bypassa RLS.

---

## 5. Mapa de telas protegidas

| Tela | Regra atual | Camada | Risco |
|---|---|---|---|
| `/login` | Publica. Logado redireciona para /dashboard | Middleware | Baixo |
| `/dashboard` | Autenticado + ativo em usuarios_permitidos | Middleware | Baixo |
| `/agendamentos` | Autenticado + ativo | Middleware | Baixo |
| `/horarios-agendamentos` | 100% publica (intencional) | Nenhuma | Medio |
| `/procurar-datas` | Autenticado + ativo | Middleware | Baixo |
| `/procurar-datas/dev-v2` | Autenticado + ativo + superadmin (server-side) | Middleware + Server | Baixo |
| `/chamados-finalizados` | Autenticado + ativo | Middleware | Baixo |
| `/inteligencia-comercial` | Autenticado + ativo | Middleware | Baixo |
| `/pos-venda` | Autenticado + ativo | Middleware | Baixo |
| `/recebimento` | Autenticado + ativo (middleware) + isMaticEmail client-side (UI) | Middleware + Client | Medio |
| `/recebimento/[id]` | Mesmo que /recebimento | Middleware + Client | Medio |
| `/recebimento/produtos` | Mesmo que /recebimento | Middleware + Client | Medio |
| `/superadmin` | Autenticado + ativo + superadmin | Middleware | Medio |
| `/configuracoes/procurar-datas` | Autenticado + ativo + superadmin | Middleware | Baixo |

---

## 6. Mapa de APIs protegidas

| API | Validacao | Service role? | Valida role/email? | Risco |
|---|---|---|---|---|
| `POST /api/superadmin/adicionar-usuario` | getUser + role=superadmin | Sim | Sim | Baixo |
| `POST /api/superadmin/reenviar-convite` | **Nao valida sessao** | Sim | **Nao** | **Critico** |
| `GET /api/configuracoes/procurar-datas` | getUser + role=superadmin | Nao | Sim | Baixo |
| `PATCH /api/configuracoes/procurar-datas/[chave]` | getUser + role=superadmin | Sim | Sim | Baixo |
| `POST /api/configuracoes/procurar-datas/importar` | getUser + role=superadmin | Sim | Sim | Baixo |
| `GET /api/configuracoes/.../auditoria` | getUser + role=superadmin | Nao | Sim | Baixo |
| `GET /api/configuracoes/.../config-normalizada` | getUser + role=superadmin | Nao | Sim | Baixo |
| `GET /api/configuracoes/.../snapshot` | getUser + role=superadmin | Nao | Sim | Baixo |
| `GET /api/google/setup-token` | getUser + role=superadmin | Nao | Sim | Baixo |
| `POST /api/auth/logout` | getUser (para auditoria) | Nao | Nao | Baixo |
| `POST /api/auth/convite/[token]/confirm` | Valida token (nao sessao) | Sim | Nao | Baixo |
| `POST /api/auditoria/registrar` | **Nao valida nada** | Sim | **Nao** | **Critico** |
| `GET /api/cron/auto-logout` | Bearer CRON_SECRET | Sim | N/A | Baixo |
| `POST /api/google/apps-script/executar` | Bearer APPS_SCRIPT_API_TOKEN | Nao | Nao | Baixo |
| `POST /api/google/calendar/reagendar-cliente` | Bearer APPS_SCRIPT_API_TOKEN | Nao | Nao | Baixo |
| `GET+POST /api/recebimento` | validateMaticUser (server-side) | Nao | Sim (whitelist) | Baixo |
| `GET /api/recebimento/[id]` | validateMaticUser | Nao | Sim (whitelist) | Baixo |
| `POST /api/recebimento/[id]/finalizar` | validateMaticUser | Nao | Sim (whitelist) | Baixo |
| `POST /api/recebimento/[id]/cancelar` | validateMaticUser | Nao | Sim (whitelist) | Baixo |
| `PATCH /api/recebimento/[id]/timer` | validateMaticUser | Nao | Sim (whitelist) | Baixo |
| `POST /api/recebimento/[id]/recalcular` | validateMaticUser | Nao | Sim (whitelist) | Baixo |
| `PATCH /api/recebimento/[id]/item/[itemId]` | validateMaticUser | Sim | Sim (whitelist) | Baixo |
| `POST /api/recebimento/[id]/item/.../volume/...` | validateMaticUser | Nao | Sim (whitelist) | Baixo |
| `POST /api/recebimento/[id]/os/[osNumero]` | validateMaticUser | Nao | Sim (whitelist) | Baixo |
| `POST /api/recebimento/[id]/check-inactivity` | validateMaticUser | Nao | Sim (whitelist) | Baixo |
| `POST /api/recebimento/importar-xml` | validateMaticUser | Nao | Sim (whitelist) | Baixo |
| `GET /api/recebimento/problemas-pendentes` | validateMaticUser | Nao | Sim (whitelist) | Baixo |
| `POST /api/recebimento/problemas-pendentes/resolver` | validateMaticUser | Nao | Sim (whitelist) | Baixo |
| APIs SGI (`/api/sgi/*`) | validateComercialUser | Varia | Sim (whitelist banco) | Baixo |
| APIs procurar-datas v2 | validarAcessoProcurarDatas | Nao | Sim (whitelist banco) | Baixo |
| APIs matic (`/api/matic/*`) | validateMaticUser | Nao | Sim (whitelist) | Baixo |
| `POST /api/nfe/importar` | Nao verificado em detalhe | - | - | Nao confirmado |

---

## 7. Hardcodes encontrados

| Arquivo | Tipo | Valor | Finalidade | Risco se migrar |
|---|---|---|---|---|
| `src/lib/auth/matic-emails.ts` | Lista fixa de emails | `posvenda@...`, `lucas@...` | Whitelist recebimento Matic | Alto - precisa fallback |
| `src/app/superadmin/page.tsx` L141,183 | Emails hardcoded | `lucas@...`, `robyson@...` | Impede bloquear/rebaixar superadmins iniciais | Critico - protecao de lockout |
| `src/components/Sidebar.tsx` L96 | Lista fixa de emails | `posvenda@...`, `lucas@...` | Mostra link Recebimento na sidebar | Medio - duplica matic-emails.ts |
| `src/app/api/nfe/importar/route.ts` L92 | Email hardcoded | `lucas@...` | Default para Gmail impersonation | Baixo - fallback |
| `src/middleware.ts` L83,112,119 | Role hardcoded | `'superadmin'` | Isencao auto-logout e protecao de rotas | Baixo - role esta no banco |
| `src/lib/auth/auto-logout.ts` L37 | Role hardcoded | `'superadmin'` | Isencao de auto-logout | Baixo - funcao pura |

---

## 8. Supabase e RLS

### Tabela `usuarios_permitidos` (RLS ON)

Colunas: id (uuid PK), email (text UNIQUE NOT NULL), role (text NOT NULL default 'user'), ativo (boolean NOT NULL default true), created_at (timestamptz), created_by (uuid nullable), updated_at (timestamptz), last_invite_sent_at (timestamptz), invite_status (text), invite_token (text UNIQUE), invite_token_expires_at (timestamptz), invite_token_used_at (timestamptz).

Indices: PK, email unique, email, ativo, role, invite_status, last_invite_sent_at, invite_token unique, invite_token (partial WHERE NOT NULL), invite_token_used_at.

Policies:
- SELECT: `is_superadmin() OR is_own_record(email)` — superadmin ve todos, user ve so o proprio
- INSERT: `is_superadmin()` — so superadmin cria
- UPDATE: USING e WITH CHECK ambos `is_superadmin()` — so superadmin edita
- DELETE: `is_superadmin()` — so superadmin deleta

### Tabela `auditoria_acessos` (RLS ON)

Colunas: id (uuid PK), acao (text NOT NULL), email (text), ip (text), user_agent (text), metadata (jsonb), created_at (timestamptz).

Policies:
- SELECT: `is_superadmin()` — so superadmin le
- INSERT: sem policy — inserts so funcionam via service role

### Tabela `sessoes_logout_automatico` (RLS OFF)

RLS desabilitada. Grants confirmados no MCP: roles anon e authenticated possuem ALL privileges (DELETE, INSERT, SELECT, UPDATE, TRUNCATE, REFERENCES, TRIGGER).

### Funcoes SQL

`is_superadmin()`: SECURITY DEFINER. Extrai email do JWT, consulta `usuarios_permitidos` onde email match + role='superadmin' + ativo=true.

`is_own_record(record_email)`: compara email do JWT com `record_email`. Retorna true se match case-insensitive.

### 6 tabelas sem RLS (confirmado MCP + grants)

| Tabela | RLS | Grants anon | Grants authenticated |
|---|---|---|---|
| `sessoes_logout_automatico` | OFF | ALL | ALL |
| `geo_cache` | OFF | ALL | ALL |
| `provider_costs` | OFF | ALL | ALL |
| `forex_config` | OFF | ALL | ALL |
| `geocoding_audit` | OFF | ALL | ALL |
| `search_execution_audit` | OFF | ALL | ALL |

Risco confirmado: RLS desabilitada E grants completos para anon e authenticated. Qualquer usuario com a anon key pode ler, escrever, deletar e truncar essas tabelas.

### Lacunas

- `relforcerowsecurity = false` em `usuarios_permitidos` e `auditoria_acessos` — service role bypassa RLS
- `auditoria_acessos` sem policy INSERT — so funciona via service role (correto mas fragil)
- Nao existe tabela de perfil de usuario com permissoes granulares por modulo
- Nao existe tabela de roles separada (role e string livre em `usuarios_permitidos`)
- Valores de role nao tem constraint CHECK no banco (so TypeScript limita a 'user' | 'superadmin')

---

## 9. Recebimento Matic

### Regra atual

Acesso controlado por `MATIC_ALLOWED_EMAILS` em `src/lib/auth/matic-emails.ts`: apenas `posvenda@lebebe.com.br` e `lucas@lebebe.com.br`.

### Pontos protegidos

- **Frontend (client-side)**: `src/app/recebimento/page.tsx` faz `isMaticEmail(user.email)` em useEffect. Se false, redireciona para /dashboard. Protecao client-side.
- **Sidebar**: `src/components/Sidebar.tsx` duplica a lista hardcoded (L96) para mostrar/ocultar link Recebimento.
- **APIs (server-side)**: todas as 13+ rotas de recebimento usam `validateMaticUser()` que verifica sessao Supabase + email contra `MATIC_ALLOWED_EMAILS`. Protecao server-side confirmada no codigo.

### Riscos

- **Alto**: whitelist hardcoded — adicionar usuario exige deploy.
- **Medio**: duplicacao da lista em Sidebar.tsx (L96) vs matic-emails.ts — pode divergir.
- **Medio**: protecao da tela e client-side (manipulavel em tese), porem APIs protegem server-side via `validateMaticUser()`.
- **Nao confirmado**: nao foi testado em producao se um usuario autenticado nao-Matic consegue chamar as APIs diretamente. O codigo de `validateMaticUser()` indica que seria bloqueado server-side, mas isso nao foi validado com teste real.

### Riscos para futura migracao

- Manter `MATIC_ALLOWED_EMAILS` como fallback ate nova tabela validada
- Nao alterar APIs de recebimento sem testar fluxo completo (timer, volumes, finalizacao, Google Sheets)
- Sidebar precisa trocar de hardcoded para consulta banco atomicamente
- Validar que `validateMaticUser` continua bloqueando usuarios nao autorizados

---

## 10. Superadmin

### Fonte atual

Role `superadmin` definida na coluna `role` da tabela `usuarios_permitidos`. Dois superadmins: `lucas@lebebe.com.br` e `robyson@lebebe.com.br`.

### Onde e usada

| O que depende de superadmin | Onde |
|---|---|
| Isencao auto-logout | middleware.ts L83, auto-logout.ts L37 |
| Acesso /superadmin | middleware.ts L111-115 |
| Acesso /configuracoes | middleware.ts L118-122 |
| Acesso dev-v2 | dev-v2/page.tsx L29 |
| Gestao usuarios | superadmin/page.tsx |
| APIs configuracoes | 6 rotas em api/configuracoes/* |
| API adicionar-usuario | api/superadmin/adicionar-usuario |
| API setup-token | api/google/setup-token |
| RLS usuarios_permitidos | 4 policies |
| RLS auditoria_acessos | 1 policy |

### Protecao de lockout

Emails `lucas@` e `robyson@` hardcoded em `superadmin/page.tsx` (L141, L183, L333, L355):
- Nao podem ser bloqueados (alert "Nao e permitido bloquear os superadmins iniciais")
- Nao podem ter role rebaixada
- Select de role desabilitado no frontend para esses emails

Protecao de lockout e apenas frontend. A RLS no banco nao impede um superadmin de rebaixar outro via SQL ou outro client.

### Riscos

- Nao existe protecao contra remover ultimo superadmin no banco — so no frontend
- Qualquer superadmin pode criar outro superadmin (correto, mas sem controle)
- `relforcerowsecurity = false` — service role bypassa tudo

---

## 11. Restricao por horario / auto-logout

### Implementado

Auto-logout as 19h BRT para usuarios nao-superadmin. Funciona em duas camadas:

**Camada 1 - Middleware** (src/middleware.ts L82-108):
- Para cada request de usuario nao-superadmin, chama `deveDesconectarPorHorario(role, cookieLogoutDate)`
- Se hora >= 19:00 BRT e cookie `auto_logout_date` != hoje: signOut + redirect `/login?auto_logout=true` + seta cookie `auto_logout_date` (12h TTL)

**Camada 2 - Cron** (src/app/api/cron/auto-logout/route.ts):
- Rota GET protegida por Bearer CRON_SECRET
- Busca todos usuarios ativos nao-superadmin
- Para cada um: ban temporario 1s (invalida sessoes) + unban imediato
- Registra em `sessoes_logout_automatico` e `auditoria_acessos`

**Funcao pura** (src/lib/auth/auto-logout.ts):
- `deveDesconectarPorHorario(role, cookieLogoutDate)` — retorna boolean
- `getDataHojeBRT()` — retorna data YYYY-MM-DD em BRT

### Riscos

- Baixo: se cron falhar, middleware ainda forca logout no proximo request
- Baixo: cookie auto_logout_date pode ser manipulado (mas cron invalida sessao server-side)
- Superadmin isento — intencional

---

## 12. Riscos encontrados

### Critico

1. **API `/api/auditoria/registrar` sem autenticacao**: qualquer pessoa pode inserir registros falsos de auditoria via POST direto. Usa service role para insert.
2. **API `/api/superadmin/reenviar-convite` sem validar sessao**: nao verifica quem esta chamando. Qualquer request com email valido pode reenviar convite.
3. **6 tabelas sem RLS com grants completos**: `sessoes_logout_automatico`, `geo_cache`, `provider_costs`, `forex_config`, `geocoding_audit`, `search_execution_audit`. Grants confirmados no MCP: roles anon e authenticated possuem ALL privileges (DELETE, INSERT, SELECT, UPDATE, TRUNCATE). Qualquer usuario com a anon key pode ler, escrever, deletar e truncar essas tabelas.

### Alto

4. **Whitelist Matic hardcoded**: adicionar usuario exige deploy. Duplicada em 2 arquivos (matic-emails.ts e Sidebar.tsx).
5. **Protecao de lockout superadmin so no frontend**: banco nao impede rebaixar/bloquear ultimo superadmin.
6. **`relforcerowsecurity = false`**: service role bypassa todas as policies RLS.

### Medio

7. **Middleware nao cobre rotas `/api/*`**: risco estrutural. Cada API deve implementar sua propria validacao. Nem todas as APIs devem passar pelo middleware (ex: APIs por token externo, callbacks, cron, convite). Antes de qualquer mudanca, classificar cada API por tipo de autenticacao (sessao, bearer, token, publica).
8. **Role sem constraint CHECK no banco**: pode gravar qualquer string em `role`. So TypeScript limita a 'user' | 'superadmin'.
9. **`/horarios-agendamentos` 100% publica**: intencional, mas sem rate limiting.

### Baixo

10. **Duplicacao de logica de validacao nas APIs**: cada API reimplementa auth. Sem middleware de API centralizado.
11. **Tabela `google_oauth_setup` temporaria**: ainda existe com 42 rows. Deveria ter sido removida.
12. **Escopos OAuth amplos**: login pede drive, spreadsheets, calendar, script — excesso para usuarios que so precisam do sistema.
13. **Recebimento Matic UI client-side**: tela protege com `isMaticEmail` client-side, manipulavel em tese, porem APIs protegem server-side via `validateMaticUser()` (nao testado em producao, apenas confirmado no codigo).

---

## 13. Proposta preliminar (conceitual, sem codigo)

### Modelo conceitual de usuarios

Manter tabela `usuarios_permitidos` como base. Futuro:
- Constraint CHECK em `role` para validar valores
- Coluna `modulos_permitidos` (text[] ou JSONB) para permissoes granulares por modulo
- Ou tabela separada `usuario_permissoes` (usuario_id, modulo, ativo)

### Modelo conceitual de permissoes

Niveis sugeridos: superadmin, admin, user, viewer (futuro).
Modulos: dashboard, agendamentos, procurar-datas, chamados-finalizados, inteligencia-comercial, recebimento, pos-venda, configuracoes, superadmin.

### Modelo conceitual de horarios

Manter auto-logout 19h como default. Futuro: permitir configurar por usuario ou role.

### Estrategia de migracao gradual

1. **Fase 0**: corrigir riscos criticos sem mudar estrutura (validar sessao em APIs abertas, habilitar RLS com policies adequadas)
2. **Fase 1**: adicionar constraint CHECK em role + campo modulos_permitidos
3. **Fase 2**: criar tela administrativa que leia/escreva modulos_permitidos
4. **Fase 3**: migrar whitelist Matic de hardcoded para banco, com fallback
5. **Fase 4**: centralizar validacao de API

### Fallback seguro para superadmin

- Manter hardcode de protecao de lockout ate ter mecanismo no banco (ex: trigger BEFORE UPDATE/DELETE que impede deletar/rebaixar ultimo superadmin ativo)

---

## 14. Proximo passo recomendado

Fase 0 apenas: correcoes criticas + plano tecnico. Sem tela de usuarios. Sem alterar codigo funcional nesta etapa. Sem criar migration nesta etapa.

1. **Classificar cada API por tipo de autenticacao** (sessao, bearer, token, callback, publica) antes de qualquer mudanca no middleware
2. **Planejar policies RLS** para as 6 tabelas sem RLS (nao aplicar ainda; primeiro definir quais roles precisam de quais permissoes em cada tabela)
3. **Planejar correcao** das 2 APIs criticas sem validacao (auditoria/registrar e superadmin/reenviar-convite)
4. **Documentar decisao** sobre constraint CHECK em role e modulos_permitidos
5. **Nao alterar codigo funcional, migrations ou banco ate decisao explicita do usuario**
