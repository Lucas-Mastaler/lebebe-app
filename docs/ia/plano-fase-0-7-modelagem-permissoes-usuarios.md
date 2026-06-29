# Plano Fase 0.7 — Modelagem de Gestao de Permissoes por Tela, Horarios e Usuarios

Data: 2026-06-29
Agente: Cascade
Tipo: analise e documentacao (somente leitura — nenhum codigo funcional, migration, banco, RLS, grant, policy, middleware ou tela foi alterado)

---

## 1. Resumo executivo

O sistema Le Bebe App possui autenticacao via Supabase Auth (Google OAuth + convite por email), uma tabela central `usuarios_permitidos` com dois roles (`user`, `superadmin`), e um middleware que protege rotas de pagina por sessao e role.

O modelo atual e binario: ou o usuario e superadmin (acessa tudo, nao sai as 19h) ou e user comum (acessa tudo exceto `/superadmin` e `/configuracoes`, sai as 19h). Nao existe controle granular por modulo, por tela, por horario customizado ou por dia da semana.

Este documento propoe o modelo de dados, regras de autorizacao, contratos de API, impactos em middleware e helper, e estrategia de rollout para a futura tela de gestao de usuarios e permissoes.

Nada aqui deve ser implementado sem decisao explicita do usuario. Este documento e referencia tecnica para as proximas fases.

---

## 2. Estado atual confirmado no codigo

### 2.1 Tabela base

`usuarios_permitidos` (RLS ON, 11 rows, 12 colunas):

| Coluna | Tipo | Relevante para permissoes |
|---|---|---|
| `id` | uuid PK | Sim — FK para permissoes futuras |
| `email` | text UNIQUE NOT NULL | Sim — identificador |
| `role` | text CHECK IN ('user','superadmin') | Sim — role global |
| `ativo` | boolean NOT NULL default true | Sim — bloqueio global |
| `created_at` | timestamptz | Nao |
| `created_by` | uuid nullable | Nao |
| `updated_at` | timestamptz | Nao |
| `last_invite_sent_at` | timestamptz | Nao |
| `invite_status` | text | Nao |
| `invite_token` | text UNIQUE | Nao |
| `invite_token_expires_at` | timestamptz | Nao |
| `invite_token_used_at` | timestamptz | Nao |

### 2.2 Middleware atual (src/middleware.ts)

Matcher cobre: `/agendamentos/*`, `/dashboard/*`, `/procurar-datas/*`, `/configuracoes/*`, `/chamados-finalizados/*`, `/superadmin/*`, `/recebimento/*`, `/inteligencia-comercial/*`, `/pos-venda/*`, `/login`, `/recuperar-senha`, `/resetar-senha`, `/definir-senha`, `/convite/*`, `/`.

Regras:
- `/horarios-agendamentos` — 100% publico, retorna antes de qualquer verificacao.
- Sem sessao + rota protegida -> redirect `/login`.
- Sem registro em `usuarios_permitidos` -> signOut + redirect `/login`.
- `ativo = false` -> signOut + redirect `/login`.
- Role != superadmin + hora >= 19h BRT -> auto-logout.
- `/superadmin/*` -> requer role = superadmin.
- `/configuracoes/*` -> requer role = superadmin.
- Todas as outras rotas no matcher: autenticado + ativo e suficiente.

### 2.3 Sidebar atual (src/components/Sidebar.tsx)

- `navItems` (fixos, todos os users): DASHBOARD, AGENDAMENTOS, HORARIOS AGENDAMENTOS, PROCURAR DATAS, CHAMADOS FINALIZADOS, INTELIGENCIA COMERCIAL.
- `isMaticUser` (hardcoded: `posvenda@lebebe.com.br`, `lucas@lebebe.com.br`): mostra RECEBIMENTO.
- `isSuperadmin` (consultado via anon key client-side): mostra USUARIOS, AUDITORIA, CONFIG BUSCA.

### 2.4 Rotas existentes de superadmin

| Rota | Metodo | Funcao |
|---|---|---|
| `/api/superadmin/adicionar-usuario` | POST | Adiciona ou reativa usuario + convite |
| `/api/superadmin/reenviar-convite` | POST | Reenvia convite por email |
| `/api/superadmin/usuarios/[id]/status` | PATCH | Ativa/desativa usuario |
| `/api/superadmin/usuarios/[id]/role` | PATCH | Altera role do usuario |

Todas ja usam `requireAuthenticatedUser({ requiredRole: 'superadmin' })`.

### 2.5 Auto-logout e horario

- Auto-logout global as 19h BRT para todos os users nao-superadmin.
- Superadmin e isento do auto-logout.
- Nao existe configuracao por usuario.

---

## 3. Objetivo da tela futura

Criar uma tela administrativa (sob `/superadmin` ou sub-rota nova) que permita ao superadmin:

1. Listar todos os usuarios.
2. Adicionar / convidar usuario.
3. Ativar / desativar usuario.
4. Alterar role (user / superadmin).
5. Configurar quais modulos/telas o usuario pode acessar.
6. Configurar janela de acesso por horario (inicio/fim) e dias da semana por usuario.
7. Ver historico de alteracoes de permissao (auditoria).

---

## 4. Inventario de telas/modulos

A seguir, todos os modulos identificados no codigo (matcher do middleware, Sidebar, pages confirmadas):

| ID modulo | Label sidebar | Rota | Tipo de acesso atual | Pode ser bloqueado por user? |
|---|---|---|---|---|
| `dashboard` | DASHBOARD | `/dashboard` | user + superadmin | Sim |
| `agendamentos` | AGENDAMENTOS | `/agendamentos` | user + superadmin | Sim |
| `horarios_agendamentos` | HORARIOS AGENDAMENTOS | `/horarios-agendamentos` | Publico intencional | Nao — publico |
| `procurar_datas` | PROCURAR DATAS | `/procurar-datas` | user + superadmin | Sim |
| `chamados_finalizados` | CHAMADOS FINALIZADOS | `/chamados-finalizados` | user + superadmin | Sim |
| `inteligencia_comercial` | INTELIGENCIA COMERCIAL | `/inteligencia-comercial` | user + superadmin | Sim |
| `pos_venda` | (nao na sidebar) | `/pos-venda` | user + superadmin | Sim |
| `recebimento` | RECEBIMENTO | `/recebimento` | Whitelist Matic | Sim — migrar de hardcode |
| `superadmin` | USUARIOS / AUDITORIA | `/superadmin` | Somente superadmin | Nao — role-based |
| `configuracoes` | CONFIG BUSCA | `/configuracoes` | Somente superadmin | Nao — role-based |

Observacoes:
- `/horarios-agendamentos` nunca deve entrar no modelo de permissoes — e uma pagina publica intencional.
- `/superadmin` e `/configuracoes` permanecem controlados por role (`superadmin`), nao por permissao granular.
- `/pos-venda` esta no matcher do middleware mas nao aparece na Sidebar atual — confirmar se e pagina real ou rota legada.

---

## 5. Regras de acesso propostas

### 5.1 Hierarquia de bloqueio

A avaliacao de acesso deve seguir esta ordem de prioridade (a primeira regra que bloquear vence):

1. **Usuario inativo** (`ativo = false`): nenhum acesso, independente de qualquer permissao.
2. **Fora da janela de horario** (se configurada): acesso negado. Auto-logout.
3. **Modulo bloqueado explicitamente** para aquele usuario: acesso negado.
4. **Superadmin**: acesso total a todos os modulos, sem restricao de horario.
5. **Modulo liberado** para o usuario (via permissao granular ou default do role): acesso permitido.

### 5.2 Default por role

| Role | Default se sem permissao granular |
|---|---|
| `superadmin` | Acesso a tudo, sem restricao de horario |
| `user` | Acesso apenas aos modulos em `MODULOS_DEFAULT_USER` (lista a definir) |

A lista de modulos default do role `user` sera definida em codigo (constante configuravel), nao no banco, para facilitar manutencao. O banco so armazena desvios em relacao ao default.

Proposta de `MODULOS_DEFAULT_USER`:
- `dashboard`
- `agendamentos`
- `chamados_finalizados`
- `inteligencia_comercial`
- `procurar_datas`
- `pos_venda`

Modulos **fora** do default (requerem permissao explicita):
- `recebimento` — hoje controlado por whitelist Matic
- `superadmin` — sempre role-based
- `configuracoes` — sempre role-based

### 5.3 Heranca de permissoes

- Superadmin herda acesso a todos os modulos sem precisar de registro em `app_permissoes_usuario`.
- User herda o default do role e pode ter overrides individuais (liberar ou bloquear modulo especifico).
- Nao existe conceito de grupo/perfil nesta proposta (pode ser adicionado em fase futura).

### 5.4 Horario de acesso

- Janela de acesso definida por: `hora_inicio` (TIME), `hora_fim` (TIME), `dias_semana` (array de 0-6, onde 0=domingo).
- Timezone: sempre em BRT (America/Sao_Paulo).
- Se nao configurada para o usuario: comportamento atual (auto-logout as 19h BRT para users, isencao para superadmins).
- Se configurada: substitui o comportamento global para aquele usuario.
- Superadmin nunca tem restricao de horario, independente de configuracao.

---

## 6. Paginas publicas intencionais

Nao entram no modelo de permissoes. Devem ser excluidas de qualquer logica de autorizacao:

| Rota | Motivo |
|---|---|
| `/horarios-agendamentos` | Pagina publica de consulta de horarios para clientes |
| `/login` | Auth |
| `/recuperar-senha` | Auth |
| `/resetar-senha` | Auth |
| `/definir-senha` | Auth |
| `/convite/*` | Fluxo de convite por token |

O middleware ja trata todas essas como publicas. Nenhuma mudanca necessaria neste ponto.

---

## 7. Rotas internas autenticadas (APIs privadas)

Todas as APIs sob `/api/superadmin/*`, `/api/configuracoes/*`, `/api/agendamentos/*`, `/api/dashboard/*`, `/api/chamados-finalizados/*`, `/api/inteligencia-comercial/*`, `/api/usuarios-info`, `/api/users`, `/api/departments` ja usam `requireAuthenticatedUser` com `requireAllowedUser: true` e `requireActive: true`.

No modelo futuro, essas APIs nao precisam validar permissao por modulo individualmente — o middleware ja garante que o usuario tem acesso a rota antes de a requisicao chegar. A validacao de permissao granular por modulo e feita no middleware, nao em cada API.

Excecao: APIs superadmin (`requiredRole: 'superadmin'`) continuam com validacao de role na API tambem.

---

## 8. Webhooks, cron e Bearer token (fora do modelo de sessao)

Estas rotas nao participam do modelo de permissoes por usuario/sessao:

| Rota | Mecanismo | Acao necessaria |
|---|---|---|
| `GET /api/cron/auto-logout` | Bearer `CRON_SECRET` | Nenhuma — continua igual |
| `POST /api/google/apps-script/executar` | Bearer `APPS_SCRIPT_API_TOKEN` | Nenhuma |
| `POST /api/google/calendar/reagendar-cliente` | Bearer `APPS_SCRIPT_API_TOKEN` | Nenhuma |
| `POST /api/procurar-datas/auditoria-legado` | Bearer token interno | Nenhuma |
| `POST /api/sgi/classificar-pendentes` | `x-internal-token` | Nenhuma |
| `POST /api/digisac/webhook` | `DIGISAC_WEBHOOK_SECRET` | Nenhuma |
| `GET /api/digisac/schedule` | Publica intencional | Nenhuma |
| `POST /api/auth/logout` | Sem sessao obrigatoria | Nenhuma |
| `POST /api/auth/convite/[token]/confirm` | Token de convite | Nenhuma |
| `POST /api/auth/recuperar-senha` | Sem sessao | Nenhuma |

O `requireAuthenticatedUser` ja exclui esses fluxos por design — eles nao chamam esse helper.

---

## 9. Opcao A — Modelo simples (colunas em usuarios_permitidos)

### Estrutura proposta

Adicionar colunas diretamente na tabela `usuarios_permitidos`:

```sql
-- REFERENCIA APENAS — NAO APLICAR
ALTER TABLE public.usuarios_permitidos
  ADD COLUMN permissoes_telas  jsonb    DEFAULT NULL,
  ADD COLUMN horario_inicio    time     DEFAULT NULL,
  ADD COLUMN horario_fim       time     DEFAULT NULL,
  ADD COLUMN dias_semana       smallint[] DEFAULT NULL;
```

`permissoes_telas` seria um objeto JSON com overrides por modulo:

```json
{
  "recebimento": true,
  "procurar_datas": false,
  "inteligencia_comercial": true
}
```

Ausencia de chave = usa default do role.

### Vantagens

- Uma unica tabela, sem JOINs.
- Migration simples (ALTER TABLE).
- `requireAuthenticatedUser` ja retorna o registro completo — basta incluir as novas colunas no SELECT.
- Baixo risco de regressao.
- Facil de implementar em primeira fase.

### Desvantagens

- `permissoes_telas` e JSONB livre: sem constraint de chaves validas. Pode guardar chaves invalidas silenciosamente.
- Sem historico de alteracoes nativo (quem mudou, quando, o que era antes).
- Colunas de horario sao globais — nao e possivel ter horarios diferentes por modulo ou por dia da semana de forma expressiva.
- Escalar para grupos/perfis seria dificil — cada override fica no registro do usuario.
- Dificil de listar "todos os usuarios com acesso a recebimento" (requer filtragem JSONB).
- A tela de administracao teria dificuldade de renderizar overrides JSONB de forma generica.

### Riscos

- Chave de modulo com typo no JSON (`recebiment` em vez de `recebimento`) resulta em permissao silenciosamente ignorada.
- Se a lista de modulos mudar, os JSONs existentes ficam stale (nenhuma migração necessaria, mas leitura inconsistente).
- Sem auditoria de quem alterou permissoes e quando.

---

## 10. Opcao B — Modelo normalizado (tabelas separadas)

### Estrutura proposta

Quatro tabelas novas:

#### 10.1 app_modulos

Catalogo de todos os modulos controlaveis do sistema.

```sql
-- REFERENCIA APENAS — NAO APLICAR
CREATE TABLE public.app_modulos (
  id          text PRIMARY KEY,        -- ex: 'recebimento', 'dashboard'
  label       text NOT NULL,           -- ex: 'RECEBIMENTO'
  rota_base   text NOT NULL,           -- ex: '/recebimento'
  descricao   text,
  ativo       boolean NOT NULL DEFAULT true,
  ordem       smallint NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

Exemplos de registros:
- `('dashboard', 'DASHBOARD', '/dashboard', ...)`
- `('agendamentos', 'AGENDAMENTOS', '/agendamentos', ...)`
- `('recebimento', 'RECEBIMENTO', '/recebimento', ...)`
- `('procurar_datas', 'PROCURAR DATAS', '/procurar-datas', ...)`
- `('chamados_finalizados', 'CHAMADOS FINALIZADOS', '/chamados-finalizados', ...)`
- `('inteligencia_comercial', 'INTELIGENCIA COMERCIAL', '/inteligencia-comercial', ...)`
- `('pos_venda', 'POS VENDA', '/pos-venda', ...)`

Nota: `superadmin` e `configuracoes` NAO entram nessa tabela — sao controlados por role diretamente.

#### 10.2 app_permissoes_usuario

Overrides de acesso por usuario e modulo.

```sql
-- REFERENCIA APENAS — NAO APLICAR
CREATE TABLE public.app_permissoes_usuario (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id    uuid NOT NULL REFERENCES public.usuarios_permitidos(id) ON DELETE CASCADE,
  modulo_id     text NOT NULL REFERENCES public.app_modulos(id),
  permitido     boolean NOT NULL,        -- true = libera, false = bloqueia
  criado_por    uuid REFERENCES public.usuarios_permitidos(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE (usuario_id, modulo_id)
);
```

Semantica: se nao existe linha para (usuario, modulo) -> usa default do role. Se existe linha -> usa o valor de `permitido`.

#### 10.3 app_janelas_acesso_usuario

Configuracao de janela de horario por usuario.

```sql
-- REFERENCIA APENAS — NAO APLICAR
CREATE TABLE public.app_janelas_acesso_usuario (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id    uuid NOT NULL REFERENCES public.usuarios_permitidos(id) ON DELETE CASCADE,
  hora_inicio   time NOT NULL,              -- ex: '08:00'
  hora_fim      time NOT NULL,              -- ex: '19:00'
  dias_semana   smallint[] NOT NULL,        -- ex: {1,2,3,4,5} = seg a sex
  ativo         boolean NOT NULL DEFAULT true,
  criado_por    uuid REFERENCES public.usuarios_permitidos(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);
```

Nota: Pode haver no maximo uma janela ativa por usuario. Superadmins ignoram esta tabela.

#### 10.4 app_auditoria_permissoes

Log append-only de todas as alteracoes de permissao.

```sql
-- REFERENCIA APENAS — NAO APLICAR
CREATE TABLE public.app_auditoria_permissoes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_alvo_id uuid NOT NULL REFERENCES public.usuarios_permitidos(id),
  usuario_alvo_email text NOT NULL,
  acao            text NOT NULL,         -- ex: 'PERMISSAO_LIBERADA', 'PERMISSAO_BLOQUEADA', 'JANELA_DEFINIDA', 'JANELA_REMOVIDA', 'ROLE_ALTERADA', 'USUARIO_ATIVADO', 'USUARIO_DESATIVADO'
  modulo_id       text,                  -- NULL para acoes que nao envolvem modulo
  valor_anterior  jsonb,                 -- estado antes da alteracao
  valor_novo      jsonb,                 -- estado depois da alteracao
  executado_por   uuid NOT NULL REFERENCES public.usuarios_permitidos(id),
  executado_email text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
```

### Vantagens

- Integridade referencial: modulos invalidos nao podem ser inseridos.
- Historico completo de alteracoes em `app_auditoria_permissoes`.
- Facil consulta: "listar todos os usuarios com acesso a recebimento" -> simples SELECT.
- Evolucao natural: adicionar grupos/perfis, heranca, permissoes por API — sem quebrar estrutura.
- Separacao clara de responsabilidades.
- A tabela `app_modulos` serve como fonte de verdade para o frontend renderizar as opcoes de permissao.

### Desvantagens

- Mais complexidade: 3 JOINs para montar o perfil completo de um usuario.
- Migration com 4 tabelas novas, indices, RLS, grants — mais superficie de mudanca.
- `requireAuthenticatedUser` precisaria de nova consulta (ou nova funcao helper).
- Seed inicial de `app_modulos` necessario.

### Riscos

- ON DELETE CASCADE em `app_permissoes_usuario`: se um usuario for deletado, as permissoes somem junto. Considerado correto, mas deve ser documentado.
- Se o middleware precisar consultar essas tabelas em cada request, pode aumentar latencia. Estrategia: cache em cookie assinado ou consulta lazy (apenas quando necessario verificar modulo especifico).

---

## 11. Comparacao e recomendacao

| Criterio | Opcao A (simples) | Opcao B (normalizada) |
|---|---|---|
| Complexidade de implementacao | Baixa | Media |
| Integridade dos dados | Fraca (JSONB livre) | Forte (FK + CHECK) |
| Auditoria de alteracoes | Nao nativa | Nativa (`app_auditoria_permissoes`) |
| Consultas analiticas | Dificeis (JSONB) | Faceis (JOIN) |
| Extensibilidade futura | Limitada | Alta |
| Latencia no middleware | Minima (coluna ja carregada) | Leve impacto (JOIN extra) |
| Risco de regressao | Baixo | Medio |
| Tempo de rollout | 1 sprint | 2-3 sprints |

### Recomendacao: Opcao B (normalizada), com rollout gradual

Motivos:
1. O sistema ja tem auditoria em `auditoria_acessos`. Faz sentido manter o mesmo padrao para permissoes.
2. A lista de modulos vai crescer — ter `app_modulos` como catalogo evita inconsistencias futuras.
3. A whitelist Matic (hoje hardcoded) pode ser migrada diretamente para `app_permissoes_usuario` sem nova estrutura.
4. A latencia extra de 1 JOIN no middleware e desprezivel para o volume atual (11 usuarios).
5. A tela de administracao fica muito mais simples de construir com tabelas relacionais do que com JSONB.

Caveat: se a necessidade imediata for apenas liberar `recebimento` para mais usuarios sem esperar o modelo completo, a Opcao A pode ser usada como transitoria para `recebimento`, com migracao posterior para B. Esta decisao cabe ao usuario.

---

## 12. Modelo de dados recomendado

### Tabelas novas (Opcao B)

```
public.app_modulos
  - id (text PK): slug do modulo
  - label (text): nome de exibicao
  - rota_base (text): prefixo de rota no Next.js
  - descricao (text nullable)
  - ativo (boolean default true)
  - ordem (smallint default 0)
  - created_at (timestamptz)

public.app_permissoes_usuario
  - id (uuid PK)
  - usuario_id (uuid FK -> usuarios_permitidos.id ON DELETE CASCADE)
  - modulo_id (text FK -> app_modulos.id)
  - permitido (boolean)
  - criado_por (uuid FK nullable -> usuarios_permitidos.id)
  - created_at (timestamptz)
  - updated_at (timestamptz)
  - UNIQUE (usuario_id, modulo_id)

public.app_janelas_acesso_usuario
  - id (uuid PK)
  - usuario_id (uuid FK -> usuarios_permitidos.id ON DELETE CASCADE)
  - hora_inicio (time)
  - hora_fim (time)
  - dias_semana (smallint[])
  - ativo (boolean default true)
  - criado_por (uuid FK nullable -> usuarios_permitidos.id)
  - created_at (timestamptz)
  - updated_at (timestamptz)

public.app_auditoria_permissoes
  - id (uuid PK)
  - usuario_alvo_id (uuid FK -> usuarios_permitidos.id)
  - usuario_alvo_email (text)
  - acao (text)
  - modulo_id (text nullable)
  - valor_anterior (jsonb nullable)
  - valor_novo (jsonb nullable)
  - executado_por (uuid FK -> usuarios_permitidos.id)
  - executado_email (text)
  - created_at (timestamptz)
```

### Tabela existente — alteracoes minimas recomendadas

`usuarios_permitidos` nao precisa de novas colunas no modelo B. As permissoes ficam em tabelas separadas.

Unica melhoria opcional (ja discutida): adicionar `CHECK (role IN ('user','superadmin'))` se ainda nao existe (confirmado no MCP que ja existe via CHECK constraint).

### RLS sugerida (nao implementar agora)

- `app_modulos`: SELECT para `authenticated`; INSERT/UPDATE/DELETE somente `is_superadmin()`.
- `app_permissoes_usuario`: SELECT para `is_superadmin() OR (select auth.uid()) = usuario_id`; INSERT/UPDATE/DELETE somente `is_superadmin()`.
- `app_janelas_acesso_usuario`: SELECT para `is_superadmin() OR (select auth.uid()) = usuario_id`; INSERT/UPDATE/DELETE somente `is_superadmin()`.
- `app_auditoria_permissoes`: SELECT somente `is_superadmin()`; INSERT somente via service role.

---

## 13. APIs futuras necessarias

### 13.1 Listagem de modulos

```
GET /api/superadmin/modulos
Retorna: lista de app_modulos ativos
Auth: requireAuthenticatedUser({ requiredRole: 'superadmin' })
```

### 13.2 Permissoes de um usuario

```
GET /api/superadmin/usuarios/[id]/permissoes
Retorna: { modulos: [{ modulo_id, label, rota_base, permitido_efetivo, override }], janela: {...} | null }
Auth: requireAuthenticatedUser({ requiredRole: 'superadmin' })
```

`permitido_efetivo` = resultado final (default do role + override, se houver).

### 13.3 Salvar permissao por modulo

```
PATCH /api/superadmin/usuarios/[id]/permissoes/[moduloId]
Body: { permitido: boolean }
Auth: requireAuthenticatedUser({ requiredRole: 'superadmin' })
Regra: nao permite bloquear superadmin de nenhum modulo (role superadmin -> acesso total, override ignorado)
```

### 13.4 Remover override de permissao

```
DELETE /api/superadmin/usuarios/[id]/permissoes/[moduloId]
Auth: requireAuthenticatedUser({ requiredRole: 'superadmin' })
Efeito: remove linha de app_permissoes_usuario -> volta ao default do role
```

### 13.5 Salvar janela de acesso

```
PUT /api/superadmin/usuarios/[id]/janela
Body: { hora_inicio: "08:00", hora_fim: "19:00", dias_semana: [1,2,3,4,5] } | null
Auth: requireAuthenticatedUser({ requiredRole: 'superadmin' })
Regra: nao permite configurar janela para superadmin
```

### 13.6 Historico de permissoes de um usuario

```
GET /api/superadmin/usuarios/[id]/auditoria-permissoes
Auth: requireAuthenticatedUser({ requiredRole: 'superadmin' })
```

### 13.7 Permissoes do usuario atual (para frontend)

```
GET /api/me/permissoes
Auth: requireAuthenticatedUser({ requireAllowedUser: true, requireActive: true })
Retorna: { role, modulos_permitidos: string[], janela: {...} | null }
Uso: Sidebar e middleware consultam para renderizar menu e validar acesso
Cache: pode usar cache de sessao (revalidar a cada X minutos ou ao fazer login)
```

Nota: Esta rota nao deve retornar dados de outros usuarios, apenas do usuario autenticado. Nao expoe dados sensiveis.

---

## 14. Impacto em requireAuthenticatedUser

Arquivo: `src/lib/auth/api-auth.ts`

### Mudancas necessarias (futuras — nao implementar agora)

1. Adicionar opcao `requiredModulo?: string` ao tipo `RequireAuthenticatedUserOptions`.
2. Se `requiredModulo` for informado, consultar `app_permissoes_usuario` para verificar acesso efetivo.
3. O retorno de sucesso pode incluir `permissoes: string[]` (lista de modulos permitidos) para evitar multiplas consultas.

Exemplo de interface futura (apenas referencia):

```typescript
// REFERENCIA — NAO IMPLEMENTAR
export type RequireAuthenticatedUserOptions = {
  requireAllowedUser?: boolean
  requireActive?: boolean
  requiredRole?: RequiredRole
  requiredModulo?: string   // novo: 'recebimento', 'dashboard', etc.
}
```

### O que NAO muda

- O fluxo existente de `requireAuthenticatedUser` sem `requiredModulo` continua funcionando exatamente igual.
- APIs que nao precisam de controle por modulo nao sao afetadas.

---

## 15. Impacto em middleware

Arquivo: `src/middleware.ts`

### Mudancas necessarias (futuras — nao implementar agora)

1. Ao verificar acesso a uma rota no matcher, consultar o modulo correspondente em `app_permissoes_usuario` se o usuario nao for superadmin.
2. Ao verificar horario de acesso, consultar `app_janelas_acesso_usuario` em vez de usar o horario global fixo (19h BRT).
3. O middleware ja consulta `usuarios_permitidos` em cada request — adicionar um JOIN ou uma segunda consulta para permissoes e janela.

### Estrategia para nao aumentar latencia excessiva

Opcao 1: Consulta unica com JOIN no middleware (mais elegante):
```sql
-- REFERENCIA — NAO IMPLEMENTAR
SELECT up.ativo, up.role,
       apu.permitido AS modulo_override,
       ajau.hora_inicio, ajau.hora_fim, ajau.dias_semana
FROM usuarios_permitidos up
LEFT JOIN app_permissoes_usuario apu
  ON apu.usuario_id = up.id AND apu.modulo_id = $modulo_atual
LEFT JOIN app_janelas_acesso_usuario ajau
  ON ajau.usuario_id = up.id AND ajau.ativo = true
WHERE up.email = $email
```

Opcao 2: Consulta separada lazy (apenas quando a rota pertencer a um modulo controlado):
- O middleware monta um mapa `rota_base -> modulo_id` a partir de uma constante em codigo (copia de `app_modulos`).
- So faz a consulta extra se o modulo_id correspondente existir.

Opcao 2 e preferida inicialmente para evitar regressao no middleware.

### Mapa rota -> modulo (constante em codigo)

```typescript
// REFERENCIA — NAO IMPLEMENTAR
const ROTA_MODULO_MAP: Record<string, string> = {
  '/dashboard': 'dashboard',
  '/agendamentos': 'agendamentos',
  '/procurar-datas': 'procurar_datas',
  '/chamados-finalizados': 'chamados_finalizados',
  '/inteligencia-comercial': 'inteligencia_comercial',
  '/pos-venda': 'pos_venda',
  '/recebimento': 'recebimento',
}
// /superadmin e /configuracoes continuam controlados por role, nao por modulo
```

### O que NAO muda no middleware

- Logica de sessao (getUser).
- Rotas publicas (`/horarios-agendamentos`, auth routes).
- Verificacao de `ativo`.
- Verificacao de role para `/superadmin` e `/configuracoes`.
- Matcher de rotas.

---

## 16. Impacto em sidebar/menu/frontend

Arquivo principal: `src/components/Sidebar.tsx`

### Situacao atual

- `navItems` e uma constante hardcoded que mostra os mesmos items para todos os users.
- `isMaticUser` e calculado client-side com lista hardcoded de emails.
- `isSuperadmin` e consultado client-side via anon key.

### Mudancas necessarias (futuras — nao implementar agora)

1. Substituir `navItems` fixo por lista dinamica baseada em `GET /api/me/permissoes`.
2. Substituir `isMaticUser` hardcoded por `modulos_permitidos.includes('recebimento')`.
3. `isSuperadmin` continua consultado, mas pode vir do mesmo endpoint `GET /api/me/permissoes`.

### Cuidados

- A sidebar e client-side. A autorizacao real continua no middleware e nas APIs — a sidebar so controla visibilidade.
- A transicao deve ser atomica: se a sidebar passa a consultar `GET /api/me/permissoes`, o backend deve estar pronto para retornar antes.
- Manter `isSuperadmin` separado para evitar que a sidebar precise de logica complexa.

---

## 17. Auditoria de alteracoes

### O que deve ser auditado

Todo evento em `app_auditoria_permissoes`:
- Liberacao de modulo para usuario
- Bloqueio de modulo para usuario
- Remocao de override (volta ao default)
- Definicao de janela de acesso
- Remocao de janela de acesso

Eventos que ja existem em `auditoria_acessos` e continuam la:
- `USUARIO_BLOQUEADO`, `USUARIO_DESBLOQUEADO`, `ROLE_ALTERADA`, `USUARIO_PERMITIDO_CRIADO`

### Como auditar

As APIs futuras de permissao (secao 13) devem inserir em `app_auditoria_permissoes` apos cada alteracao, via service role (mesmo padrao do `registrarAuditoria` atual).

### Como expor na tela

A tab de "Auditoria" na tela Superadmin pode ser expandida para mostrar eventos de `app_auditoria_permissoes` junto com `auditoria_acessos`, ou em sub-tab separada.

---

## 18. Estrategia de rollout por fases

### Fase 1 — Migration e seed (pre-requisito)

- Criar migration com as 4 tabelas novas.
- Inserir seed de `app_modulos` com os 7 modulos identificados.
- Configurar RLS e grants para as novas tabelas.
- Nenhuma mudanca de comportamento para o usuario final.
- Rollback: DROP TABLE das 4 tabelas.

### Fase 2 — API de permissoes (backend)

- Implementar as 6 APIs listadas na secao 13.
- Implementar `GET /api/me/permissoes`.
- Nenhuma mudanca no middleware ou sidebar ainda.
- Validar com `npx tsc --noEmit`.

### Fase 3 — Tela de gestao (frontend)

- Expandir `/superadmin` ou criar `/superadmin/usuarios/[id]` com:
  - Lista de modulos com toggles de permissao.
  - Configuracao de janela de horario.
  - Historico de alteracoes.
- Tela usa as APIs da Fase 2.

### Fase 4 — Middleware e Sidebar (integracao)

- Atualizar middleware para consultar permissoes granulares.
- Atualizar Sidebar para usar `GET /api/me/permissoes`.
- Migrar whitelist Matic (`posvenda@`, `lucas@`) para `app_permissoes_usuario` com `modulo_id = 'recebimento'`.
- Manter hardcodes Matic como fallback durante transicao.
- Remover hardcodes somente apos validacao completa em producao.

### Fase 5 — Horario customizado por usuario

- Atualizar middleware para consultar `app_janelas_acesso_usuario`.
- Substituir logica global de 19h pelo valor da janela do usuario (se configurada).
- Manter comportamento atual como fallback para usuarios sem janela configurada.

---

## 19. Riscos conhecidos

| Risco | Nivel | Mitigacao |
|---|---|---|
| Latencia no middleware com JOINs adicionais | Medio | Usar consulta lazy (secao 15, Opcao 2) ou cache em cookie assinado |
| Sidebar client-side nao e barreira de seguranca | Baixo | A sidebar so controla visibilidade; middleware e APIs sao a barreira real |
| ON DELETE CASCADE em app_permissoes_usuario | Medio | Documentar comportamento; avaliar soft-delete se necessario |
| Migracao da whitelist Matic exige teste completo | Alto | Manter hardcode como fallback; migrar em etapa separada com teste manual do fluxo de recebimento |
| Seed de app_modulos pode divergir do codigo | Medio | Manter constante `ROTA_MODULO_MAP` em codigo sincronizada com o banco |
| Race condition na sidebar (carrega antes de /api/me/permissoes retornar) | Baixo | Loading state ja existe na sidebar atual |
| Superadmin com janela configurada por engano | Baixo | Middleware deve ignorar janela para superadmins por design |

---

## 20. Criterios de aceite para comecar frontend

Antes de iniciar a tela de gestao (Fase 3), os seguintes itens devem estar prontos e validados:

1. [ ] Migration das 4 tabelas novas aplicada em producao sem erro.
2. [ ] RLS configurada corretamente nas 4 tabelas (superadmin pode ler/escrever; user ve apenas o proprio registro).
3. [ ] Seed de `app_modulos` aplicado com os 7 modulos.
4. [ ] `GET /api/superadmin/modulos` retornando lista correta.
5. [ ] `GET /api/superadmin/usuarios/[id]/permissoes` retornando estado correto para usuario com e sem override.
6. [ ] `PATCH /api/superadmin/usuarios/[id]/permissoes/[moduloId]` bloqueando e liberando modulo corretamente.
7. [ ] `GET /api/me/permissoes` retornando lista correta para o usuario autenticado.
8. [ ] `npx tsc --noEmit` sem erros apos implementacao das APIs.
9. [ ] Nenhuma regressao nas rotas existentes (status, role, adicionar-usuario, reenviar-convite).
10. [ ] Anti-lockout de superadmin preservado (trigger existente + protecao API).

---

## 21. Proximo passo recomendado

**Proximo passo imediato: Fase 1 (migration e seed).**

Acoes:
1. Criar migration nova em `supabase/migrations/` com as 4 tabelas da secao 12.
2. Criar seed SQL de `app_modulos` com os 7 modulos (dashboard, agendamentos, procurar_datas, chamados_finalizados, inteligencia_comercial, pos_venda, recebimento).
3. Configurar RLS e grants.
4. Aplicar pelo MCP Supabase apos aprovacao.
5. Validar via MCP que as tabelas existem e a RLS esta correta.
6. Atualizar este documento com o resultado.

Apenas apos Fase 1 aprovada: partir para Fase 2 (APIs).

---

## Apendice — Arquivos lidos para este documento

- `docs/ia/log_progress.md`
- `docs/ia/auditoria-usuarios-login-roles.md`
- `docs/ia/plano-fase-0-seguranca-auth.md` (secoes 9 e 10)
- `docs/ia/plano-fase-0-5b-migracao-helper-auth-apis.md`
- `docs/ia/checkpoint-fase-0-5j-rotas-restantes-auth.md`
- `src/lib/auth/api-auth.ts`
- `src/middleware.ts`
- `src/app/superadmin/page.tsx`
- `src/app/api/superadmin/adicionar-usuario/route.ts`
- `src/app/api/superadmin/reenviar-convite/route.ts`
- `src/app/api/superadmin/usuarios/[id]/status/route.ts`
- `src/app/api/superadmin/usuarios/[id]/role/route.ts`
- `src/types/supabase.ts`
- `src/components/Sidebar.tsx`
- `src/components/Navigation.tsx`
- `src/components/AuthenticatedLayout.tsx`
- `src/components/LayoutWrapper.tsx`
- Listagem de `src/app/` (estrutura de paginas)
