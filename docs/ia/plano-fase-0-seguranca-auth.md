# Plano Fase 0 — Seguranca de autenticacao, autorizacao e permissoes

Data: 2026-06-26
Agente: Cascade
Tipo: planejamento tecnico (somente leitura e documentacao)
Nenhum codigo funcional, migration ou tabela foi alterado.

---

## 1. Resumo executivo

Este plano detalha as correcoes criticas de seguranca que devem ser aplicadas ANTES da construcao da tela administrativa de usuarios. Os riscos foram identificados na auditoria `docs/ia/auditoria-usuarios-login-roles.md` e validados no MCP Supabase e no codigo.

Problemas a resolver:
- API `/api/superadmin/reenviar-convite` sem validacao de sessao ou role
- API `/api/auditoria/registrar` sem validacao de identidade
- 6 tabelas sem RLS com grants completos (ALL) para anon e authenticated
- Nenhuma classificacao formal das 39 APIs por tipo de autenticacao
- Sem protecao contra lockout do ultimo superadmin

Premissas:
- Nenhuma alteracao de codigo, migration ou SQL sera aplicada neste documento
- Todo SQL proposto e apenas referencia para revisao futura
- Toda validacao de banco foi feita via MCP Supabase
- Toda validacao de codigo foi feita por leitura real dos arquivos

---

## 2. Relacao com a auditoria anterior

Este plano e continuacao direta de `docs/ia/auditoria-usuarios-login-roles.md` (2026-06-26).

A auditoria identificou:
- Secao 8: 6 tabelas sem RLS com grants ALL para anon e authenticated
- Secao 9: risco em recebimento Matic (hardcode, nao brecha de API)
- Secao 10: superadmin protegido por hardcode, sem fallback seguro
- Secao 12: riscos criticos classificados (items 1-14)
- Secao 13: propostas conceituais para fase 0
- Secao 14: proximos passos recomendados

---

## 3. O que foi validado no codigo

Arquivos lidos para este plano:

**APIs criticas:**
- `src/app/api/auditoria/registrar/route.ts` — sem validacao de sessao, aceita POST com payload arbitrario, grava via service role
- `src/app/api/superadmin/reenviar-convite/route.ts` — sem validacao de sessao ou role, aceita email no body, grava via service role

**Helpers de auth:**
- `src/lib/auth/helpers.ts` — `registrarAuditoria()` chama `/api/auditoria/registrar` via fetch sem cookie/sessao
- `src/lib/auth/matic-auth.ts` — `validateMaticUser()` valida sessao + whitelist de emails
- `src/lib/auth/sgi-auth.ts` — `validateComercialUser()` valida sessao Supabase
- `src/lib/auth/bearer-auth.ts` — `validarBearerToken()` valida token bearer

**Tabelas sem RLS — uso no codigo:**
- `sessoes_logout_automatico` — usada apenas em `src/app/api/cron/auto-logout/route.ts` via service role
- `geo_cache` — usada em `src/lib/procurar-datas/endereco-cache.ts` via service role
- `provider_costs` — referenciada em testes, acesso via service role
- `forex_config` — referenciada em testes, acesso via service role
- `geocoding_audit` — usada em `src/app/api/procurar-datas/validar-endereco/route.ts` via service role
- `search_execution_audit` — usada em `src/lib/procurar-datas/v2/auditoria-search.ts` via service role

**39 API routes mapeadas** em `src/app/api/` — classificacao completa na secao 8.

**Middleware:**
- `src/middleware.ts` — matcher cobre paginas mas nao `/api/*`

---

## 4. O que foi validado no Supabase/MCP

### Tabelas sem RLS — estrutura confirmada

| Tabela | Colunas | Linhas aprox. | RLS | Grants anon | Grants authenticated |
|--------|---------|---------------|-----|-------------|---------------------|
| `sessoes_logout_automatico` | 6 (id, usuario_id, email, ultimo_logout_automatico, created_at, updated_at) | 7 | OFF | ALL | ALL |
| `geo_cache` | 13 (id, chave_endereco, endereco_completo, logradouro, numero, bairro, cidade, uf, cep, lat, lng, provider, confidence, updated_at) | 815 | OFF | ALL | ALL |
| `provider_costs` | 6 (provider, custo_usd_por_request, descricao, ativo, created_at, updated_at) | ~1 | OFF | ALL | ALL |
| `forex_config` | 3 (id, cotacao_usd_brl, updated_at) | ~1 | OFF | ALL | ALL |
| `geocoding_audit` | 10 (id, chave_endereco, endereco_completo, cache_hit, provider, confidence, user_email, origin, created_at, duration_ms) | 33428 | OFF | ALL | ALL |
| `search_execution_audit` | 29 colunas (telemetria completa) | 1006 | OFF | ALL | ALL |

### Grants detalhados (confirmado via information_schema.table_privileges)

Todas as 6 tabelas tem grants: DELETE, INSERT, SELECT, UPDATE, TRUNCATE, REFERENCES, TRIGGER para roles `anon` e `authenticated`.

### Indices relevantes confirmados

- `sessoes_logout_automatico`: 4 indices (pkey, email unique, email, ultimo_logout_automatico DESC)
- `geo_cache`: 4 indices (pkey, chave_endereco unique, chave_endereco, chave_endereco+updated_at)
- `provider_costs`: 1 indice (pkey provider)
- `forex_config`: 1 indice (pkey id)
- `geocoding_audit`: 8 indices (pkey, chave_endereco, cache_hit, created_at, provider, created_at+provider, created_at+duration, duration parcial)
- `search_execution_audit`: 6 indices (pkey, created_at DESC, duration DESC, motor+created_at, origin+created_at, status+created_at)

### Tabelas com RLS (referencia)

- `usuarios_permitidos`: RLS ON, 4 policies, `relforcerowsecurity = false`
- `auditoria_acessos`: RLS ON, 1 policy (SELECT superadmin), `relforcerowsecurity = false`

### Funcoes SQL confirmadas

- `is_superadmin()`: SECURITY DEFINER, consulta `usuarios_permitidos` por email do JWT
- `is_own_record(record_email)`: SECURITY DEFINER, compara email do JWT com parametro

---

## 5. Tabelas sem RLS/grants seguros — analise detalhada

### 5.1 sessoes_logout_automatico

| Item | Detalhe |
|------|---------|
| **Tipo** | Operacional (controle de sessao) |
| **Colunas** | id (uuid), usuario_id (uuid), email (text), ultimo_logout_automatico (timestamptz), created_at, updated_at |
| **Linhas** | ~7 |
| **Uso real confirmado** | `src/app/api/cron/auto-logout/route.ts` — upsert e select via service role |
| **Quem acessa** | Apenas cron job (protegido por CRON_SECRET) |
| **Frontend direto** | Nao |
| **Escrita por usuario comum** | Nao |
| **Risco atual** | CRITICAL — qualquer usuario com anon key pode ler/escrever emails e timestamps de logout |
| **Proposta** | ENABLE RLS + revogar grants de anon/authenticated + policy SELECT/INSERT/UPDATE para service_role only (sem policy = apenas service role acessa) |
| **Impacto** | Nenhum — todo acesso ja e via service role |
| **Testes necessarios** | Executar cron auto-logout apos aplicar e confirmar que continua funcionando |
| **Pendencias** | Nenhuma |

### 5.2 geo_cache

| Item | Detalhe |
|------|---------|
| **Tipo** | Cache (geocodificacao) |
| **Colunas** | 13 colunas incluindo endereco, coordenadas, provider, confidence |
| **Linhas** | ~815 |
| **Uso real confirmado** | `src/lib/procurar-datas/endereco-cache.ts` — select, upsert via `createServiceClient()` |
| **Quem acessa** | Backend (rota validar-endereco) via service role |
| **Frontend direto** | Nao |
| **Escrita por usuario comum** | Nao |
| **Risco atual** | CRITICAL — qualquer usuario com anon key pode ler todos os enderecos geocodificados, coordenadas, e modificar cache |
| **Proposta** | ENABLE RLS + revogar grants de anon/authenticated. Sem policies = apenas service role acessa |
| **Impacto** | Nenhum — todo acesso ja e via service role |
| **Testes necessarios** | Executar pesquisa procurar-datas com cache hit e cache miss para confirmar que continua funcionando |
| **Pendencias** | Nenhuma |

### 5.3 provider_costs

| Item | Detalhe |
|------|---------|
| **Tipo** | Configuracao (custos de providers de geocodificacao) |
| **Colunas** | provider (varchar PK), custo_usd_por_request, descricao, ativo, created_at, updated_at |
| **Linhas** | ~1 |
| **Uso real confirmado** | Referenciado em testes. Acesso via service role quando existente |
| **Quem acessa** | Backend via service role |
| **Frontend direto** | Nao |
| **Escrita por usuario comum** | Nao |
| **Risco atual** | MEDIUM — dados de configuracao de custo expostos; poucos registros mas informacao sensivel |
| **Proposta** | ENABLE RLS + revogar grants de anon/authenticated |
| **Impacto** | Nenhum |
| **Testes necessarios** | Confirmar que nenhuma rota quebra apos aplicar |
| **Pendencias** | Confirmar se algum codigo de producao (nao teste) faz SELECT nesta tabela com client normal |

### 5.4 forex_config

| Item | Detalhe |
|------|---------|
| **Tipo** | Configuracao (cotacao USD/BRL) |
| **Colunas** | id (int, default 1), cotacao_usd_brl (numeric, default 5.0), updated_at |
| **Linhas** | ~1 |
| **Uso real confirmado** | Referenciado em testes. Acesso via service role |
| **Quem acessa** | Backend via service role |
| **Frontend direto** | Nao |
| **Escrita por usuario comum** | Nao |
| **Risco atual** | MEDIUM — cotacao exposta; modificacao poderia afetar calculos de custo |
| **Proposta** | ENABLE RLS + revogar grants de anon/authenticated |
| **Impacto** | Nenhum |
| **Testes necessarios** | Confirmar que nenhuma rota quebra |
| **Pendencias** | Confirmar se algum codigo de producao faz SELECT com client normal |

### 5.5 geocoding_audit

| Item | Detalhe |
|------|---------|
| **Tipo** | Auditoria (logs de geocodificacao) |
| **Colunas** | 10 colunas incluindo chave_endereco, provider, user_email, duration_ms |
| **Linhas** | ~33428 |
| **Uso real confirmado** | `src/app/api/procurar-datas/validar-endereco/route.ts` — insert via service role |
| **Quem acessa** | Backend via service role |
| **Frontend direto** | Nao |
| **Escrita por usuario comum** | Nao |
| **Risco atual** | CRITICAL — 33k registros com emails de usuarios e enderecos pesquisados expostos para leitura/escrita por qualquer anon |
| **Proposta** | ENABLE RLS + revogar grants de anon/authenticated + policy SELECT para is_superadmin() (mesmo padrao de auditoria_acessos) |
| **Impacto** | Nenhum no fluxo — inserts sao via service role |
| **Testes necessarios** | Executar pesquisa procurar-datas e confirmar que geocoding_audit continua recebendo inserts |
| **Pendencias** | Nenhuma |

### 5.6 search_execution_audit

| Item | Detalhe |
|------|---------|
| **Tipo** | Auditoria/telemetria (execucoes de pesquisa) |
| **Colunas** | 29 colunas incluindo user_email, cep, endereco, metricas de performance |
| **Linhas** | ~1006 |
| **Uso real confirmado** | `src/lib/procurar-datas/v2/auditoria-search.ts` — insert via `createServiceClient()` |
| **Quem acessa** | Backend via service role. Legado Apps Script tambem insere via REST (service role) |
| **Frontend direto** | Nao |
| **Escrita por usuario comum** | Nao |
| **Risco atual** | CRITICAL — emails e enderecos de pesquisa expostos; telemetria de performance exposta |
| **Proposta** | ENABLE RLS + revogar grants de anon/authenticated + policy SELECT para is_superadmin() |
| **Impacto** | Verificar se legado Apps Script usa anon key ou service role key para insert. Se usar anon key, a correcao quebraria o legado |
| **Testes necessarios** | (1) Confirmar key usada pelo legado Apps Script; (2) executar pesquisa v2 e confirmar insert; (3) executar pesquisa legado e confirmar insert |
| **Pendencias** | **Validar qual key o Apps Script usa para inserir em search_execution_audit** — risco de quebrar legado se usar anon key |

### Resumo da proposta por tabela

| Tabela | Acao | Risco de quebrar producao | Pendencia bloqueante |
|--------|------|--------------------------|---------------------|
| `sessoes_logout_automatico` | ENABLE RLS + REVOKE | Nenhum | Nao |
| `geo_cache` | ENABLE RLS + REVOKE | Nenhum | Nao |
| `provider_costs` | ENABLE RLS + REVOKE | Nenhum | Confirmar uso em producao |
| `forex_config` | ENABLE RLS + REVOKE | Nenhum | Confirmar uso em producao |
| `geocoding_audit` | ENABLE RLS + REVOKE + policy superadmin | Nenhum | Nao |
| `search_execution_audit` | ENABLE RLS + REVOKE + policy superadmin | **Possivel** se legado usa anon key | **Sim — validar key do legado** |

---

## 6. API `/api/auditoria/registrar`

### Diagnostico confirmado no codigo

**Arquivo:** `src/app/api/auditoria/registrar/route.ts` (54 linhas)

Comportamento atual:
- Aceita POST sem nenhuma validacao de sessao, cookie ou token
- Extrai `acao`, `email` e `metadata` do body JSON
- Grava em `auditoria_acessos` via `createServiceClient()` (service role)
- Captura IP e user-agent dos headers
- Nao valida tipo de `acao` (aceita qualquer string)
- Nao valida formato de `email` (aceita qualquer valor)
- Nao valida estrutura de `metadata` (aceita qualquer JSON)

**Quem chama esta API:**
- `src/lib/auth/helpers.ts` — funcao `registrarAuditoria()` usada em 15 arquivos
- Chamada tanto do client (browser) quanto do server (API routes)
- Chamada ANTES do login: `src/app/(auth)/login/page.tsx`, `src/app/(auth)/recuperar-senha/page.tsx`
- Chamada APOS login: `src/app/auth/callback/route.ts`, `src/app/api/auth/logout/route.ts`
- Chamada em superadmin: `src/app/api/superadmin/adicionar-usuario/route.ts`, `reenviar-convite/route.ts`
- Chamada em procurar-datas: `src/lib/procurar-datas/v2/auditoria-search.ts`, `config-db.ts`
- Chamada em definir-senha e resetar-senha (paginas publicas)

### Risco real

**MEDIUM-HIGH** (nao CRITICAL como inicialmente classificado na auditoria):
- A API nao expoe dados — apenas GRAVA
- O risco e de poluicao: qualquer pessoa com a URL pode inserir registros falsos na auditoria
- Pode mascarar atividade real com ruido
- Pode gravar emails falsos e acoes inexistentes
- NAO da acesso a leitura de dados (SELECT em auditoria_acessos requer is_superadmin via RLS)

### Por que nao pode exigir sessao sempre

A API e chamada em cenarios pre-login:
- Tentativa de login negada (`LOGIN_FALHA` em callback)
- Tentativa de recuperar senha
- Definir senha via convite (usuario ainda nao tem sessao)

Se exigir sessao, esses eventos deixam de ser auditados.

### Proposta minima de correcao

**Opcao recomendada: separar eventos publicos de privados**

1. Criar enum/whitelist de acoes publicas permitidas sem sessao:
   - `LOGIN_FALHA`, `LOGIN_SUCESSO`, `LOGOUT`, `SENHA_RECUPERACAO_SOLICITADA`, `SENHA_DEFINIDA`, `CONVITE_CONFIRMADO`

2. Para acoes publicas:
   - Validar que `acao` esta na whitelist
   - Validar formato basico de email (regex simples)
   - Limitar tamanho de `metadata` (ex: max 2KB)
   - Rate limit por IP (ex: max 10 por minuto)

3. Para todas as outras acoes:
   - Exigir sessao valida via `createClient()` + `getUser()`
   - Usar email da sessao (ignorar email do body)
   - Rejeitar se nao autenticado

4. Validacao de payload em ambos os casos:
   - `acao` obrigatoria, max 100 chars, apenas alfanumerico + underscore
   - `email` opcional, max 255 chars, formato basico validado
   - `metadata` opcional, max 2KB serializado

### Testes necessarios

- Chamar API sem sessao com acao publica → deve aceitar
- Chamar API sem sessao com acao privada → deve rejeitar 401
- Chamar API com sessao com qualquer acao → deve aceitar
- Chamar API com payload gigante → deve rejeitar 400
- Chamar API com acao invalida (caracteres especiais) → deve rejeitar 400
- Verificar que login/logout/recuperar-senha continuam gravando auditoria
- Verificar que superadmin/procurar-datas continuam gravando auditoria

---

## 7. API `/api/superadmin/reenviar-convite`

### Diagnostico confirmado no codigo

**Arquivo:** `src/app/api/superadmin/reenviar-convite/route.ts` (172 linhas)

Comportamento atual:
- Aceita POST com `{ email }` no body
- NAO valida sessao do chamador
- NAO valida role do chamador
- Usa `createServiceClient()` (service role) para tudo
- Consulta `usuarios_permitidos` pelo email
- Gera novo `invite_token` com `gerarTokenConvite()`
- Atualiza `invite_token`, `invite_status`, `invite_token_expires_at` via service role
- Envia email com link de convite via Resend
- Registra auditoria `INVITE_EMAIL_SENT` e `USUARIO_PERMITIDO_CRIADO`
- Tem rate limit basico (60s entre reenvios por email)

**Quem chama:**
- `src/app/superadmin/page.tsx` — tela de superadmin (que ja valida role no frontend/middleware)

### Risco real

**CRITICAL:**
- Qualquer pessoa que conheca a URL pode forcar reenvio de convite para qualquer email cadastrado
- Gera tokens de convite validos que permitem criar conta
- Permite enumerar emails cadastrados (resposta diferente para email existente vs nao existente)
- O rate limit de 60s nao impede abuso — apenas limita velocidade
- A tela de superadmin valida role, mas a API nao — ataque direto via curl/fetch funciona

### Proposta minima de correcao

1. No inicio da funcao POST, adicionar validacao de sessao:
   - Criar client Supabase com `createClient()` (cookies do request)
   - Chamar `getUser()` para obter usuario autenticado
   - Se nao autenticado: retornar 401

2. Validar role do usuario:
   - Consultar `usuarios_permitidos` pelo email do usuario autenticado
   - Verificar `role = 'superadmin'` e `ativo = true`
   - Se nao superadmin: retornar 403

3. Manter todo o comportamento atual apos validacao

4. Registrar na auditoria o email do superadmin que reenviou (nao apenas o email do destinatario)

### SQL proposto (nao aplicar)

Nenhum SQL necessario — correcao e apenas no codigo da API.

### Testes necessarios

- Chamar API sem sessao → deve retornar 401
- Chamar API com sessao de usuario comum → deve retornar 403
- Chamar API com sessao de superadmin → deve funcionar normalmente
- Chamar API com sessao de superadmin inativo → deve retornar 403
- Verificar que tela de superadmin continua reenviando convites normalmente
- Verificar que auditoria registra qual superadmin reenviou

### Arquivos a alterar

- `src/app/api/superadmin/reenviar-convite/route.ts` — unico arquivo

### Referencia de padrao existente

A API `src/app/api/superadmin/adicionar-usuario/route.ts` ja implementa validacao de sessao + role. Usar como referencia:
- Importa `createClient` de `@/lib/supabase/server`
- Chama `getUser()` para sessao
- Consulta `usuarios_permitidos` para role

---

## 8. Classificacao das APIs

### Legenda de categorias

- **publica-intencional** — endpoint intencionalmente aberto (webhook, redirect)
- **callback-auth** — fluxo OAuth/auth do Supabase
- **convite-token** — validacao de token de convite, sem sessao
- **cron-token** — protegido por CRON_SECRET no header
- **usuario-autenticado** — requer sessao Supabase valida
- **superadmin** — requer sessao + role superadmin
- **recebimento-matic** — requer sessao + whitelist Matic (validateMaticUser)
- **comercial-sgi** — requer sessao Supabase (validateComercialUser)
- **servico-interno** — chamada server-to-server ou sem validacao formal
- **sem-validacao** — nenhuma validacao de identidade confirmada

### Tabela completa (39 rotas)

| Rota | Arquivo | Categoria | Validacao atual | Risco | Recomendacao | Prioridade |
|------|---------|-----------|-----------------|-------|--------------|------------|
| POST /api/auditoria/registrar | auditoria/registrar/route.ts | sem-validacao | Nenhuma | MEDIUM-HIGH | Separar acoes publicas/privadas + validacao payload | P1 |
| POST /api/superadmin/reenviar-convite | superadmin/reenviar-convite/route.ts | sem-validacao | Nenhuma | CRITICAL | Exigir sessao + role superadmin | P0 |
| POST /api/superadmin/adicionar-usuario | superadmin/adicionar-usuario/route.ts | superadmin | sessao + role superadmin | OK | Nenhuma | — |
| POST /api/auth/logout | auth/logout/route.ts | usuario-autenticado | createClient + getUser | OK | Nenhuma | — |
| GET /api/auth/convite/[token] | auth/convite/[token]/route.ts | convite-token | Valida formato do token (64 chars) | LOW | Nenhuma — apenas redirect | — |
| POST /api/auth/convite/[token]/confirm | auth/convite/[token]/confirm/route.ts | convite-token | Valida token no banco | OK | Nenhuma | — |
| POST /api/auth/recuperar-senha | auth/recuperar-senha/route.ts | publica-intencional | Nenhuma (intencional) | LOW | Rate limit | P3 |
| POST /api/cron/auto-logout | cron/auto-logout/route.ts | cron-token | CRON_SECRET no header | OK | Nenhuma | — |
| GET /api/configuracoes/procurar-datas | configuracoes/procurar-datas/route.ts | superadmin | sessao + role superadmin | OK | Nenhuma | — |
| PUT /api/configuracoes/procurar-datas/[chave] | configuracoes/procurar-datas/[chave]/route.ts | superadmin | sessao + role superadmin | OK | Nenhuma | — |
| GET /api/configuracoes/procurar-datas/auditoria | configuracoes/procurar-datas/auditoria/route.ts | superadmin | sessao + role superadmin | OK | Nenhuma | — |
| GET /api/configuracoes/procurar-datas/config-normalizada | configuracoes/procurar-datas/config-normalizada/route.ts | superadmin | sessao + role superadmin | OK | Nenhuma | — |
| POST /api/configuracoes/procurar-datas/importar | configuracoes/procurar-datas/importar/route.ts | superadmin | sessao + role superadmin | OK | Nenhuma | — |
| GET /api/configuracoes/procurar-datas/snapshot | configuracoes/procurar-datas/snapshot/route.ts | superadmin | sessao + role superadmin | OK | Nenhuma | — |
| POST /api/procurar-datas/buscar-cep | procurar-datas/buscar-cep/route.ts | usuario-autenticado | validarAcessoProcurarDatas | OK | Nenhuma | — |
| POST /api/procurar-datas/calcular-tempo | procurar-datas/calcular-tempo/route.ts | usuario-autenticado | validarAcessoProcurarDatas | OK | Nenhuma | — |
| GET /api/procurar-datas/opcoes | procurar-datas/opcoes/route.ts | usuario-autenticado | validarAcessoProcurarDatas | OK | Nenhuma | — |
| POST /api/procurar-datas/pesquisar | procurar-datas/pesquisar/route.ts | usuario-autenticado | validarAcessoProcurarDatas | OK | Nenhuma | — |
| POST /api/procurar-datas/pre-agendar | procurar-datas/pre-agendar/route.ts | usuario-autenticado | validarAcessoProcurarDatas | OK | Nenhuma | — |
| GET /api/procurar-datas/progresso | procurar-datas/progresso/route.ts | usuario-autenticado | validarAcessoProcurarDatas | OK | Nenhuma | — |
| POST /api/procurar-datas/v2/pesquisar-compat-async | procurar-datas/v2/pesquisar-compat-async/route.ts | usuario-autenticado | validarAcessoProcurarDatas | OK | Nenhuma | — |
| POST /api/procurar-datas/v2/comparar | procurar-datas/v2/comparar/route.ts | usuario-autenticado | validarAcessoProcurarDatas | OK | Nenhuma | — |
| GET /api/procurar-datas/v2/diagnostico | procurar-datas/v2/diagnostico/route.ts | usuario-autenticado | validarAcessoProcurarDatas | OK | Nenhuma | — |
| GET /api/procurar-datas/v2/disponibilidade-diagnostico | procurar-datas/v2/disponibilidade-diagnostico/route.ts | usuario-autenticado | validarAcessoProcurarDatas | OK | Nenhuma | — |
| GET /api/procurar-datas/v2/progresso-compat | procurar-datas/v2/progresso-compat/route.ts | usuario-autenticado | validarAcessoProcurarDatas | OK | Nenhuma | — |
| POST /api/procurar-datas/validar-endereco | procurar-datas/validar-endereco/route.ts | usuario-autenticado | validarAcessoProcurarDatas | OK | Nenhuma | — |
| POST /api/matic/importar-nfe | matic/importar-nfe/route.ts | recebimento-matic | validateMaticUser | OK | Nenhuma | — |
| POST /api/matic/importar-via-appscript | matic/importar-via-appscript/route.ts | recebimento-matic | validateMaticUser | OK | Nenhuma | — |
| GET /api/matic/sku/[codigo] | matic/sku/[codigo]/route.ts | recebimento-matic | validateMaticUser | OK | Nenhuma | — |
| GET,POST /api/matic/sku | matic/sku/route.ts | recebimento-matic | validateMaticUser | OK | Nenhuma | — |
| POST /api/nfe/importar | nfe/importar/route.ts | sem-validacao | Nenhuma (usa createClient server sem getUser) | MEDIUM | Avaliar se precisa validacao | P2 |
| POST /api/agendamentos/pesquisar | agendamentos/pesquisar/route.ts | servico-interno | Nenhuma formal | MEDIUM | Avaliar se precisa sessao | P2 |
| POST /api/dashboard/pesquisar | dashboard/pesquisar/route.ts | servico-interno | Nenhuma formal | MEDIUM | Avaliar se precisa sessao | P2 |
| GET /api/digisac/schedule | digisac/schedule/route.ts | servico-interno | Rate limit apenas | MEDIUM | Avaliar se precisa sessao | P2 |
| POST /api/digisac/webhook | digisac/webhook/route.ts | publica-intencional | DIGISAC_WEBHOOK_SECRET | OK | Nenhuma | — |
| GET /api/departments | departments/route.ts | servico-interno | Nenhuma formal | LOW | Avaliar se precisa sessao | P3 |
| GET /api/autocomplete/users | autocomplete/users/route.ts | servico-interno | Nenhuma formal | LOW | Avaliar se precisa sessao | P3 |
| GET /api/autocomplete/departments | autocomplete/departments/route.ts | servico-interno | Nenhuma formal | LOW | Avaliar se precisa sessao | P3 |
| GET /api/usuarios-info | usuarios-info/route.ts | servico-interno | Nenhuma formal (service role) | MEDIUM | Avaliar se precisa sessao | P2 |

**APIs SGI (todas protegidas por validateComercialUser):**

| Rota | Categoria | Validacao | Risco |
|------|-----------|-----------|-------|
| GET,POST /api/sgi/vendas | comercial-sgi | validateComercialUser | OK |
| GET /api/sgi/vendas/[numero_lancamento] | comercial-sgi | validateComercialUser | OK |
| GET /api/sgi/filtros | comercial-sgi | validateComercialUser | OK |
| GET,POST /api/sgi/observacoes | comercial-sgi | validateComercialUser | OK |
| DELETE /api/sgi/observacoes/[id] | comercial-sgi | validateComercialUser | OK |
| GET /api/sgi/observacoes/cliente | comercial-sgi | validateComercialUser | OK |
| GET /api/sgi/agendamentos-futuros | comercial-sgi | validateComercialUser | OK |
| POST /api/sgi/classificar-vendas | comercial-sgi | validateComercialUser | OK |
| POST /api/sgi/digisac/chamados-ciclo | comercial-sgi | validateComercialUser | OK |
| POST /api/sgi/digisac/processar-fila | comercial-sgi | validateComercialUser | OK |
| POST /api/sgi/digisac/sincronizar-venda | comercial-sgi | validateComercialUser | OK |
| GET /api/sgi/digisac/sync-status | comercial-sgi | validateComercialUser | OK |
| GET /api/sgi/digisac/mensagens | comercial-sgi | validateComercialUser | OK |
| POST /api/sgi/ia/analise-status | comercial-sgi | validateComercialUser | OK |
| POST /api/sgi/ia/iniciar-analise | comercial-sgi | validateComercialUser | OK |
| POST /api/sgi/ia/processar-proximo | comercial-sgi | validateComercialUser | OK |

**APIs Recebimento (todas protegidas por validateMaticUser):**

| Rota | Categoria | Validacao | Risco |
|------|-----------|-----------|-------|
| GET /api/recebimento | recebimento-matic | validateMaticUser | OK |
| GET /api/recebimento/[id] | recebimento-matic | validateMaticUser | OK |
| POST /api/recebimento/[id]/cancelar | recebimento-matic | validateMaticUser | OK |
| POST /api/recebimento/[id]/check-inactivity | recebimento-matic | validateMaticUser | OK |
| POST /api/recebimento/[id]/finalizar | recebimento-matic | validateMaticUser | OK |
| PATCH /api/recebimento/[id]/item/[itemId] | recebimento-matic | validateMaticUser | OK |
| PATCH /api/recebimento/[id]/item/[itemId]/volume/[volumeNumero] | recebimento-matic | validateMaticUser | OK |
| PATCH /api/recebimento/[id]/os/[osNumero] | recebimento-matic | validateMaticUser | OK |
| POST /api/recebimento/[id]/recalcular | recebimento-matic | validateMaticUser | OK |
| POST /api/recebimento/[id]/timer | recebimento-matic | validateMaticUser | OK |
| POST /api/recebimento/importar-xml | recebimento-matic | validateMaticUser | OK |
| GET /api/recebimento/problemas-pendentes | recebimento-matic | validateMaticUser | OK |
| POST /api/recebimento/problemas-pendentes/resolver | recebimento-matic | validateMaticUser | OK |

**APIs Google:**

| Rota | Categoria | Validacao | Risco |
|------|-----------|-----------|-------|
| POST /api/google/apps-script/executar | usuario-autenticado | createClient + getUser | OK |
| POST /api/google/calendar/reagendar-cliente | usuario-autenticado | createClient + getUser | OK |
| GET /api/google/setup-token | superadmin | sessao + role superadmin | OK |

### Conclusao sobre estrategia de protecao

**Situacao atual:** 3 padroes de validacao existentes funcionam bem:
- `validarAcessoProcurarDatas` — para procurar-datas (14 rotas)
- `validateMaticUser` — para recebimento/matic (17 rotas)
- `validateComercialUser` — para SGI (16 rotas)

**Problema:** 8-10 APIs sem validacao formal (digisac/schedule, departments, autocomplete, dashboard, agendamentos, nfe/importar, usuarios-info).

**Recomendacao:**
1. **NAO colocar `/api/*` no matcher do middleware** — cada grupo de APIs tem necessidades diferentes
2. **Criar helper central `requireAuthenticatedUser()`** que faz `createClient()` + `getUser()` e retorna 401 se nao autenticado
3. **Aplicar esse helper nas APIs sem validacao** (P2/P3) uma por vez, testando
4. **Manter helpers especificos** (validateMaticUser, validateComercialUser, validarAcessoProcurarDatas) como estao
5. **Considerar wrapper por categoria** apenas se o numero de APIs sem validacao crescer significativamente

---

## 9. Superadmin e risco de lockout

### Situacao atual confirmada no codigo

- 2 superadmins: `lucas@lebebe.com.br`, `robyson@lebebe.com.br`
- Emails hardcoded em `src/lib/auth/matic-emails.ts` (whitelist Matic) e usados em `src/app/superadmin/page.tsx`
- Tela de superadmin impede desativar o proprio email (check no frontend)
- NAO existe protecao server-side contra remover/rebaixar o ultimo superadmin
- NAO existe trigger, constraint ou RPC que impeca isso
- Se alguem fizer UPDATE direto no banco (service role ou acesso Supabase dashboard), pode ficar sem superadmin

### Cenarios de risco

1. Superadmin A rebaixa Superadmin B para 'user' → se A tambem for rebaixado depois, lockout total
2. Acesso direto ao banco (dashboard Supabase) faz UPDATE em ambos os superadmins → lockout total
3. Bug no codigo seta role errado → lockout potencial
4. Alguem com service role key deleta ambos os registros → lockout total

### Opcoes de protecao

**Opcao A — Trigger SQL (recomendada):**
- Criar trigger BEFORE UPDATE/DELETE em `usuarios_permitidos`
- Se a operacao reduziria o numero de superadmins ativos para 0, rejeitar com RAISE EXCEPTION
- Funciona independente de quem faz a alteracao (API, dashboard, SQL direto)
- Nao depende de frontend
- Rollback simples: DROP TRIGGER

**Opcao B — Funcao RPC:**
- Criar funcao `alterar_role_usuario(target_email, new_role)` que valida antes de alterar
- Requer que toda alteracao de role passe pela funcao
- Nao protege contra UPDATE direto

**Opcao C — Constraint CHECK:**
- Nao e possivel com CHECK constraint simples (precisa contar registros)

**Opcao D — Logica de API apenas:**
- Adicionar validacao na API `adicionar-usuario` e futura API de alterar role
- NAO protege contra acesso direto ao banco
- Risco de falha silenciosa

### Recomendacao

**Opcao A (trigger)** como protecao primaria + **Opcao D (API)** como protecao redundante no codigo.

### SQL proposto para o trigger (NAO APLICAR — apenas referencia)

```sql
-- REFERENCIA APENAS — NAO APLICAR SEM REVISAO
CREATE OR REPLACE FUNCTION prevent_superadmin_lockout()
RETURNS TRIGGER AS $$
DECLARE
  remaining_superadmins INTEGER;
BEGIN
  -- Para DELETE: verificar se o registro sendo removido e superadmin ativo
  IF TG_OP = 'DELETE' THEN
    IF OLD.role = 'superadmin' AND OLD.ativo = true THEN
      SELECT COUNT(*) INTO remaining_superadmins
      FROM usuarios_permitidos
      WHERE role = 'superadmin' AND ativo = true AND id != OLD.id;
      IF remaining_superadmins < 1 THEN
        RAISE EXCEPTION 'Nao e possivel remover o ultimo superadmin ativo';
      END IF;
    END IF;
    RETURN OLD;
  END IF;

  -- Para UPDATE: verificar se o registro esta perdendo status de superadmin ativo
  IF TG_OP = 'UPDATE' THEN
    IF (OLD.role = 'superadmin' AND OLD.ativo = true)
       AND (NEW.role != 'superadmin' OR NEW.ativo = false) THEN
      SELECT COUNT(*) INTO remaining_superadmins
      FROM usuarios_permitidos
      WHERE role = 'superadmin' AND ativo = true AND id != OLD.id;
      IF remaining_superadmins < 1 THEN
        RAISE EXCEPTION 'Nao e possivel rebaixar ou desativar o ultimo superadmin ativo';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_superadmin_lockout
  BEFORE UPDATE OR DELETE ON usuarios_permitidos
  FOR EACH ROW
  EXECUTE FUNCTION prevent_superadmin_lockout();
```

### Sobre remover hardcodes

Os hardcodes atuais servem como fallback de emergencia:
- `SUPERADMIN_EMAILS` em `superadmin/page.tsx` — protege contra lockout no frontend
- `MATIC_USERS` em `matic-emails.ts` — whitelist de recebimento

**Recomendacao:** NAO remover os hardcodes agora. Remover apenas depois que:
1. Trigger de lockout estiver implementado e testado
2. Tela administrativa de usuarios estiver funcional
3. Whitelist de Matic estiver migrada para tabela no banco

### Testes necessarios

- Tentar rebaixar ultimo superadmin via SQL direto → trigger deve rejeitar
- Tentar desativar ultimo superadmin via SQL direto → trigger deve rejeitar
- Tentar deletar ultimo superadmin via SQL direto → trigger deve rejeitar
- Rebaixar um de dois superadmins → deve permitir
- Desativar um de dois superadmins → deve permitir

---

## 10. Plano tecnico por etapas

### Etapa 0.1 — Proteger API reenviar-convite

| Item | Detalhe |
|------|---------|
| **Objetivo** | Exigir sessao + role superadmin na API reenviar-convite |
| **Arquivos** | `src/app/api/superadmin/reenviar-convite/route.ts` |
| **SQL** | Nenhum |
| **Risco** | Baixo — tela ja valida superadmin; API passa a validar tambem |
| **Rollback** | Reverter alteracao no arquivo (git revert) |
| **Validacoes** | (1) curl sem sessao → 401; (2) curl com user comum → 403; (3) tela superadmin → funciona |
| **Comando de teste** | Teste manual na tela de superadmin + curl direto |
| **Criterio de aceite** | API rejeita chamadas sem sessao valida de superadmin |

### Etapa 0.2 — Proteger API auditoria/registrar

| Item | Detalhe |
|------|---------|
| **Objetivo** | Separar acoes publicas/privadas + validar payload |
| **Arquivos** | `src/app/api/auditoria/registrar/route.ts`, `src/types/supabase.ts` (enum de acoes) |
| **SQL** | Nenhum |
| **Risco** | Medio — precisa testar todos os cenarios de chamada (pre-login, pos-login, superadmin) |
| **Rollback** | Reverter alteracao nos 2 arquivos |
| **Validacoes** | (1) login com sucesso grava auditoria; (2) login negado grava auditoria; (3) logout grava; (4) superadmin acoes gravam; (5) curl com acao invalida → 400; (6) curl com acao privada sem sessao → 401 |
| **Comando de teste** | Teste manual de login/logout + curl direto |
| **Criterio de aceite** | Acoes publicas funcionam sem sessao; acoes privadas exigem sessao; payload invalido rejeitado |

### Etapa 0.3 — RLS e REVOKE nas 4 tabelas seguras

| Item | Detalhe |
|------|---------|
| **Objetivo** | Habilitar RLS e revogar grants de anon/authenticated em `sessoes_logout_automatico`, `geo_cache`, `provider_costs`, `forex_config` |
| **Arquivos** | Nenhum (apenas migration SQL) |
| **SQL proposto** | ENABLE RLS + REVOKE ALL ON ... FROM anon, authenticated (para cada tabela) |
| **Risco** | Baixo — todo acesso confirmado e via service role |
| **Rollback** | DISABLE RLS + GRANT ALL (reverter migration) |
| **Validacoes** | (1) cron auto-logout continua funcionando; (2) pesquisa procurar-datas com cache hit; (3) pesquisa com cache miss + geocodificacao |
| **Comando de teste** | Teste manual de procurar-datas + verificar cron |
| **Criterio de aceite** | Nenhuma funcionalidade quebrada; tabelas inacessiveis por anon/authenticated |

### Etapa 0.4 — RLS e REVOKE nas 2 tabelas de auditoria

| Item | Detalhe |
|------|---------|
| **Objetivo** | Habilitar RLS em `geocoding_audit` e `search_execution_audit` + policy SELECT superadmin |
| **Arquivos** | Nenhum (apenas migration SQL) |
| **SQL proposto** | ENABLE RLS + REVOKE ALL + CREATE POLICY SELECT para is_superadmin() |
| **Risco** | **MEDIO** — precisa confirmar que legado Apps Script NAO usa anon key para insert em search_execution_audit |
| **Rollback** | DROP POLICY + DISABLE RLS + GRANT ALL |
| **Validacoes** | (1) pesquisa v2 grava telemetria; (2) pesquisa legado grava telemetria; (3) geocodificacao grava auditoria; (4) superadmin pode ler auditorias |
| **Comando de teste** | Pesquisa v2 + pesquisa legado + verificar inserts |
| **Criterio de aceite** | Inserts via service role funcionam; anon/authenticated nao conseguem ler/escrever |
| **Pendencia bloqueante** | Validar key usada pelo legado Apps Script |

### Etapa 0.5 — Helper central requireAuthenticatedUser

| Item | Detalhe |
|------|---------|
| **Objetivo** | Criar helper reutilizavel para exigir sessao autenticada |
| **Arquivos** | `src/lib/auth/require-auth.ts` (novo), aplicar em APIs P2 uma por vez |
| **SQL** | Nenhum |
| **Risco** | Baixo por API — aplicar uma por vez |
| **Rollback** | Reverter arquivo + remover import |
| **Validacoes** | Para cada API: (1) sem sessao → 401; (2) com sessao → funciona |
| **Comando de teste** | curl + teste manual por API |
| **Criterio de aceite** | Todas as APIs P2 exigem sessao |

### Etapa 0.6 — Trigger de lockout de superadmin

| Item | Detalhe |
|------|---------|
| **Objetivo** | Impedir remocao/rebaixamento/desativacao do ultimo superadmin |
| **Arquivos** | Nenhum (apenas migration SQL) |
| **SQL proposto** | CREATE FUNCTION + CREATE TRIGGER (ver secao 9) |
| **Risco** | Baixo — trigger so atua quando ultimo superadmin seria afetado |
| **Rollback** | DROP TRIGGER + DROP FUNCTION |
| **Validacoes** | (1) rebaixar um de dois → permite; (2) rebaixar ultimo → bloqueia; (3) deletar ultimo → bloqueia |
| **Comando de teste** | SQL direto no banco de teste |
| **Criterio de aceite** | Impossivel ficar sem superadmin via qualquer caminho |

### Ordem de execucao recomendada

```
Etapa 0.1 → Etapa 0.2 → Etapa 0.3 → Etapa 0.4 → Etapa 0.5 → Etapa 0.6
   P0           P1           P1           P2           P2           P2
```

---

## 11. O que NAO deve ser feito agora

1. **NAO criar tela de usuarios** — depende da Fase 0 estar concluida
2. **NAO migrar recebimento Matic para tabela** — funcional e estavel com hardcode; migrar depois da tela de usuarios
3. **NAO colocar `/api/*` inteiro no middleware** — cada API tem necessidades diferentes; classificar primeiro (feito acima)
4. **NAO aplicar SQL sem revisao** — todo SQL proposto neste documento e apenas referencia
5. **NAO remover hardcodes de superadmin** — sao fallback de emergencia; remover somente apos trigger de lockout + tela administrativa
6. **NAO alterar APIs de recebimento ou SGI** — todas ja tem validacao adequada
7. **NAO alterar middleware** — funciona corretamente para paginas; APIs devem ter validacao propria
8. **NAO alterar RLS de tabelas que ja tem RLS** — `usuarios_permitidos` e `auditoria_acessos` ja estao protegidas
9. **NAO alterar `relforcerowsecurity`** — service role precisa bypassar RLS para funcionar

---

## 12. Checklist de validacao

### Antes de cada etapa

- [ ] Ler este plano e a auditoria `docs/ia/auditoria-usuarios-login-roles.md`
- [ ] Confirmar que nenhum outro deploy esta em andamento
- [ ] Fazer backup mental do estado atual (ou branch)

### Apos Etapa 0.1 (reenviar-convite)

- [ ] curl POST /api/superadmin/reenviar-convite sem cookie → 401
- [ ] curl POST com cookie de user comum → 403
- [ ] Tela superadmin reenviar convite → funciona
- [ ] Auditoria registra email do superadmin que reenviou

### Apos Etapa 0.2 (auditoria/registrar)

- [ ] Login com Google → LOGIN_SUCESSO gravado
- [ ] Login negado (email nao permitido) → LOGIN_FALHA gravado
- [ ] Logout → LOGOUT gravado
- [ ] Recuperar senha → gravado
- [ ] curl com acao invalida → 400
- [ ] curl com acao privada sem sessao → 401
- [ ] curl com payload > 2KB → 400

### Apos Etapa 0.3 (RLS tabelas seguras)

- [ ] Cron auto-logout as 19h → funciona
- [ ] Pesquisa procurar-datas com cache → funciona
- [ ] Pesquisa procurar-datas sem cache (geocodificacao) → funciona
- [ ] Tela de configuracoes procurar-datas → funciona
- [ ] Tentar SELECT nas 4 tabelas com anon key (curl/Supabase client) → negado

### Apos Etapa 0.4 (RLS tabelas auditoria)

- [ ] Pesquisa v2 → insert em search_execution_audit funciona
- [ ] Pesquisa legado → insert funciona (se legado usa service role)
- [ ] Geocodificacao → insert em geocoding_audit funciona
- [ ] SELECT com anon key → negado
- [ ] SELECT como superadmin → funciona

### Apos Etapa 0.5 (helper central)

- [ ] Cada API P2 sem sessao → 401
- [ ] Cada API P2 com sessao → funciona
- [ ] Nenhuma funcionalidade quebrada

### Apos Etapa 0.6 (trigger lockout)

- [ ] UPDATE role de superadmin com 2+ superadmins → permite
- [ ] UPDATE role do ultimo superadmin → bloqueia com erro
- [ ] DELETE do ultimo superadmin → bloqueia com erro
- [ ] UPDATE ativo=false do ultimo superadmin → bloqueia com erro

---

## 13. Proximo passo recomendado

**Executar Etapa 0.1** — proteger API `/api/superadmin/reenviar-convite` com validacao de sessao + role.

Esta e a correcao mais critica (CRITICAL) e a mais simples de implementar (alteracao em 1 arquivo, padrao ja existe em `adicionar-usuario`).

Prompt sugerido para proxima tarefa:
```
Implementar protecao de sessao + role superadmin na API /api/superadmin/reenviar-convite/route.ts
seguindo o padrao ja existente em /api/superadmin/adicionar-usuario/route.ts.
Nao alterar nenhum outro arquivo. Testar com curl e via tela de superadmin.
```

Apos Etapa 0.1, seguir com Etapa 0.2 e assim por diante conforme este plano.
