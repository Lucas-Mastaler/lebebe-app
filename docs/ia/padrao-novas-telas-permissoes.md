# Padrao obrigatorio: novas telas e modulos no sistema de permissoes

> **Documento de governanca.** Toda nova tela interna do Le Bebe App deve seguir este padrao antes de ser considerada pronta.

---

## 1. Objetivo

Garantir que toda nova tela interna nasca integrada ao sistema de permissoes por modulo, perfil e janela de horario. Nenhuma tela interna deve ser considerada pronta se nao estiver cadastrada como modulo, protegida por wrapper e visivel na gestao de perfis.

---

## 2. Quando aplicar

**Aplicar este padrao para:**

- Nova pagina interna
- Nova sub-rota interna
- Novo item de menu/sidebar
- Nova area administrativa
- Nova tela operacional
- Nova tela que consome dados internos

**Nao aplicar para:**

- Paginas publicas intencionais (ex: `/horarios-agendamentos`), desde que explicitamente classificadas como `publico = true` em `app_modulos`
- Callbacks OAuth, webhooks e cron jobs, que tem outro padrao de seguranca

---

## 3. Checklist obrigatorio para nova tela

### 3.0 Catalogo central

- [ ] Adicionar o modulo em `src/lib/auth/modulos-app.ts`.
- [ ] Definir no catalogo:
  - `moduleKey`
  - `nome`
  - `descricao`
  - `rotaBase`
  - `categoria`
  - `publico`
  - `somenteSuperadmin`
  - `ativo`
  - `ordem`
  - `access` (`profile`, `superadmin` ou `public`)
  - `menuLabel`/`menuHref` apenas quando o item visual do menu precisar divergir do cadastro de `app_modulos`.
- [ ] Adicionar o item no grupo correto em `NAVIGATION_GROUPS`, no mesmo arquivo.
- [ ] Nao editar lista manual no Sidebar; o Sidebar consome `NAVIGATION_GROUPS`.
- [ ] Rodar `npm run test -- src/lib/auth/modulos-app.test.ts`.

### 3.1 Cadastro do modulo

- [ ] Definir `moduleKey` estavel (snake_case, ex: `novo_modulo`)
- [ ] Cadastrar em `app_modulos` com:
  - `chave`: o moduleKey
  - `nome`: nome legivel
  - `rota_base`: rota principal (ex: `/novo-modulo`)
  - `categoria`: agrupamento logico (opcional)
  - `ordem`: ordem de exibicao (opcional)
  - `publico`: `false` para telas internas
  - `somente_superadmin`: `true` apenas se for area restrita
  - `ativo`: `true`
- [ ] Criar migration explicita e idempotente para inserir/atualizar o modulo em `app_modulos`
- [ ] Nao inserir permissoes em `app_permissoes_perfil` para perfis existentes, salvo decisao explicita de negocio
- [ ] Confirmar que o modulo aparece na tela Superadmin > Perfis para liberar/bloquear

### 3.2 Sidebar

- [ ] Adicionar item em `NAVIGATION_GROUPS` de `src/lib/auth/modulos-app.ts`
- [ ] Se `acessoTotal = true` (superadmin), o item aparece automaticamente
- [ ] Se usuario comum, o item so aparece se `chavesPermitidas` incluir o moduleKey
- [ ] Item publico intencional deve ter `access = 'public'`
- [ ] Item exclusivo de superadmin deve ter `access = 'superadmin'`
- [ ] Item liberavel por perfil deve ter `access = 'profile'`

### 3.3 Protecao da pagina

- [ ] Criar `page.tsx` como Server Component wrapper
- [ ] Se a pagina for Client Component, manter a logica em `PageClient.tsx` e usar `page.tsx` apenas como wrapper
- [ ] Proteger com `checkModuleAndWindowAccess(moduleKey)`
- [ ] Usar `redirect(access.redirectTo)` para redirecionar em caso de falha
- [ ] Falha de modulo redireciona para `/acesso-negado`
- [ ] Falha de horario redireciona para `/fora-do-horario`
- [ ] Nenhum fallback deve mandar para `/dashboard` -- destino neutro e sempre `/inicio`

### 3.4 APIs

- [ ] Avaliar todas as APIs usadas pela tela
- [ ] Se APIs forem internas e sensiveis, proteger tambem no backend com:
  - `requireAuthenticatedUser` (autenticacao basica)
  - `requireModuleAccess(moduleKey)` (autorizacao por modulo)
- [ ] Nunca depender apenas de bloqueio visual na Sidebar
- [ ] Service role apenas server-side
- [ ] Bearer/internal token apenas para fluxos tecnicos

### 3.5 Documentacao e testes

- [ ] Atualizar `docs/ia/log_progress.md`
- [ ] Testar com superadmin (acessa em qualquer horario)
- [ ] Testar com perfil autorizado dentro da janela
- [ ] Testar com perfil autorizado fora da janela
- [ ] Testar com perfil nao autorizado
- [ ] Testar com usuario sem perfil
- [ ] Testar acesso por URL direta (nao apenas pelo menu)

---

## 4. Padrao de wrapper

Toda pagina interna deve seguir este padrao:

```ts
import { redirect } from 'next/navigation'
import { checkModuleAndWindowAccess } from '@/lib/auth/module-access'
import PageClient from './PageClient'

export default async function Page() {
  const access = await checkModuleAndWindowAccess('<module_key>')
  if (!access.ok) redirect(access.redirectTo)

  return <PageClient />
}
```

**Regras do wrapper:**

- `page.tsx` e sempre um Server Component
- `PageClient.tsx` contem a logica do Client Component
- `access.redirectTo` e dinamico: `/acesso-negado` para falha de modulo, `/fora-do-horario` para falha de horario
- Superadmin ignora janela de horario (delegado a `checkAccessWindowForUser`)

---

## 5. Padrao de Sidebar

**Catalogo:** `src/lib/auth/modulos-app.ts`
**Componente visual:** `src/components/Sidebar.tsx`

- Item interno precisa ter `moduleKey` definido em `APP_MODULES`
- O Sidebar consome `NAVIGATION_GROUPS`; nao manter lista paralela de rotas/modulos no componente
- Se `acessoTotal = true` (superadmin), todos os itens aparecem
- Se usuario comum, so aparecem itens cujo `moduleKey` esta em `chavesPermitidas`
- Item publico intencional usa `access = 'public'` e fica fora do bloqueio por perfil

**Exemplo:**

```ts
// APP_MODULES
{
  moduleKey: 'novo_modulo',
  nome: 'NOVO MODULO',
  descricao: 'Descricao curta',
  rotaBase: '/novo-modulo',
  categoria: 'interno',
  publico: false,
  somenteSuperadmin: false,
  ativo: true,
  ordem: 110,
  access: 'profile',
}

// NAVIGATION_GROUPS
navigationItem('novo_modulo', 'activity')
```

---

## 6. Padrao de Superadmin

O modulo deve aparecer na gestao de perfis (Superadmin > Perfis) para ser liberado/bloqueado por perfil.

- `PerfilEditor.tsx` lista automaticamente todos os modulos ativos de `app_modulos`
- Ao criar um novo modulo, ele aparece na matriz de permissoes
- O superadmin pode marcar `permitido = true/false` para cada perfil
- Exceoes individuais podem ser aplicadas via `app_permissoes_usuario`
- A ausencia de linha em `app_permissoes_perfil` significa bloqueado, pelo fallback `permitido = permissoesMap.get(moduloId) ?? false`
- E proibido sincronizar `app_modulos` automaticamente durante renderizacao, login, carregamento do Sidebar ou navegacao normal
- E proibido inserir permissoes automaticamente para perfis existentes sem decisao explicita

### 6.1 Migration de modulo

Criar migration idempotente com `INSERT INTO public.app_modulos (...) VALUES (...) ON CONFLICT (chave) DO UPDATE ...`.

Nao incluir `INSERT INTO public.app_permissoes_perfil` para o novo modulo. O superadmin libera depois pela tela de Perfis.

### 6.2 Validacao automatizada

Rodar:

```bash
npm run test -- src/lib/auth/modulos-app.test.ts
```

Esse teste valida:

- `moduleKey` unico no catalogo e no menu
- rotas de menu sem duplicidade indevida
- todo item do menu presente no catalogo central
- classificacao coerente entre `access`, `publico` e `somenteSuperadmin`
- `USUARIOS` usando `superadmin_usuarios`
- todo modulo do catalogo aparecendo em migrations de `app_modulos`
- modulos marcados para liberacao manual sem concessao automatica em `app_permissoes_perfil`
- fallback bloqueado por padrao no endpoint de permissoes do editor de Perfis

---

## 7. Padrao de API

Esconder tela/menu nao basta. Se a tela usa APIs internas, avaliar protecao no backend:

| Cenario | Protecao recomendada |
|---|---|
| API usada por tela interna | `requireAuthenticatedUser` + `requireModuleAccess(moduleKey)` |
| API sensivel de superadmin | `requireAuthenticatedUser` + `requiredRole: 'superadmin'` |
| Webhook / cron | Token/Bearer especifico, nao session-based |
| Service role | Apenas server-side, nunca exposto ao cliente |

**Nunca depender so de bloqueio visual.** Um usuario pode acessar a API diretamente por URL mesmo sem ver o item no menu.

---

## 8. Padrao para `/procurar-datas`

Qualquer alteracao em `/procurar-datas` deve respeitar as regras permanentes da migracao:

- Se for apenas controle de acesso/tela, classificar como **Frente 0 / Controle**
- Nao alterar motor, OSRM, Haversine, ranking, candidatos, Apps Script ou regra de negocio sem escopo explicito
- Nao alterar APIs `/api/procurar-datas/*` sem autorizacao

**Leitura obrigatoria antes de qualquer alteracao:**

- `docs/procurar-datas-escopo-equivalencia-legado-v2.md`
- `docs/procurar-datas-motor-v2-progresso.md`
- `docs/ia/log_progress.md`

---

## 9. Testes minimos

Matriz de testes para toda nova tela:

| Cenario | Resultado esperado |
|---|---|
| Superadmin acessa | Pagina carrega em qualquer horario |
| Perfil autorizado dentro da janela | Pagina carrega |
| Perfil autorizado fora da janela | Redireciona para `/fora-do-horario` |
| Perfil nao autorizado | Redireciona para `/acesso-negado` |
| Usuario sem perfil | Redireciona para `/acesso-negado` |
| Usuario sem perfil em `/inicio` | `/inicio` carrega normalmente |
| Acesso por URL direta (sem menu) | Bloqueio funciona |
| Item no menu | Aparece apenas para perfis autorizados |
| APIs relevantes | Protegidas no backend |

---

## 10. Pendencias conhecidas

### `app_janelas_acesso_usuario`

A tabela `app_janelas_acesso_usuario` existe no banco mas **a semantica ainda nao esta definida**. Nao usar essa tabela ate decidir se ela:

- **complementa** a janela do perfil (permite horarios adicionais)
- **restringe** a janela do perfil (limita horarios)
- **substitui** a janela do perfil (ignora perfil e usa apenas janela individual)

Até que essa decisao seja tomada, o sistema usa apenas `app_janelas_acesso_perfil`.

---

## 11. Regra para agentes de IA

Qualquer agente de IA (Cascade, Copilot, etc) ao criar uma nova tela neste projeto deve:

1. **Consultar este documento** antes de implementar
2. **Seguir o checklist completo** da secao 3
3. **Atualizar `docs/ia/log_progress.md`** ao finalizar
4. **Testar** com pelo menos superadmin, perfil autorizado e perfil nao autorizado
5. **Nao considerar a tela pronta** enquanto nao estiver cadastrada em `app_modulos`, protegida por wrapper e visivel na gestao de perfis

---

## Referencias

- Helper de acesso: `src/lib/auth/module-access.ts` -- `checkModuleAndWindowAccess(moduleKey)`
- Helper de janela: `src/lib/auth/access-window.ts` -- `checkAccessWindowForUser({ usuarioId, role })`
- API de permissoes: `src/app/api/me/permissoes/route.ts`
- Hook de permissoes: `src/lib/hooks/usePermissoes.ts`
- Catalogo central: `src/lib/auth/modulos-app.ts`
- Teste de consistencia do catalogo/menu/migrations: `src/lib/auth/modulos-app.test.ts`
- Sidebar: `src/components/Sidebar.tsx`
- Gestao de perfis: `src/app/superadmin/_components/PerfilEditor.tsx`
- Paginas de exemplo: `src/app/dashboard/page.tsx`, `src/app/procurar-datas/page.tsx`, `src/app/recebimento/page.tsx`
- Log de progresso: `docs/ia/log_progress.md`
## Atualizacao 2026-07-15 - modulo granular de Usuarios

- Para liberar apenas a area de Usuarios, usar `app_modulos.chave = 'superadmin_usuarios'`.
- Nao alterar `app_modulos.chave = 'superadmin'` para `somente_superadmin = false`.
- O menu lateral deve usar `moduleKey` quando a tela for liberavel por perfil.
- Acoes sensiveis de Perfis, Auditoria e alteracao de role continuam superadmin-only salvo decisao explicita em contrario.

## Atualizacao 2026-07-15 - sincronizacao menu x app_modulos

- A fonte central em codigo para modulos e navegacao e `src/lib/auth/modulos-app.ts`.
- `src/components/Sidebar.tsx` nao deve manter lista propria de labels/rotas/moduleKey; deve consumir `NAVIGATION_GROUPS`.
- Para adicionar `TESTE NOVO MODULO`:
  1. adicionar `teste_novo_modulo` em `APP_MODULES`;
  2. adicionar `navigationItem('teste_novo_modulo', '<icone>')` no grupo correto de `NAVIGATION_GROUPS`;
  3. criar a pagina/rota;
  4. criar migration idempotente para `app_modulos`;
  5. aplicar a migration no ambiente adequado;
  6. liberar manualmente na tela Superadmin > Perfis.
- Nao editar `PerfilEditor.tsx` para nova tela; ele le `app_modulos`.
- Nao inserir linhas em `app_permissoes_perfil` para nova tela sem decisao explicita.
- Rodar `npm run test -- src/lib/auth/modulos-app.test.ts` antes de considerar o menu/permissoes sincronizados.

## Atualizacao 2026-07-15 - filtro real do editor de Perfis

- Um item do menu so e liberavel por perfil se, alem de estar em `NAVIGATION_GROUPS`, o modulo correspondente estiver em `APP_MODULES` com `access = 'profile'`, `ativo = true`, `publico = false` e `somenteSuperadmin = false`.
- O endpoint `GET /api/superadmin/perfis/[id]/permissoes` usa exatamente esse filtro em `app_modulos`; portanto qualquer divergencia nesses campos impede a tela de aparecer na matriz.
- `AUDITORIA ACESSOS` continua apontando para `moduleKey = superadmin` e `access = 'superadmin'`, ficando fora da matriz comum.
- Para itens do menu que devem ser liberaveis, a pagina precisa usar `checkModuleAndWindowAccess(moduleKey)` e as APIs da tela precisam usar `requireModuleAccess(moduleKey)`.
- A validacao `src/lib/auth/modulos-app.test.ts` deve falhar quando um item `access = 'profile'` do menu nao puder aparecer na matriz de Perfis.
