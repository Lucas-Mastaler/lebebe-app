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
- [ ] Incluir o modulo na matriz de permissoes dos perfis em `app_permissoes_perfil` (quando aplicavel)
- [ ] Confirmar que o modulo aparece na tela Superadmin > Perfis para liberar/bloquear

### 3.2 Sidebar

- [ ] Adicionar item em `navItems` em `src/components/Sidebar.tsx` com `moduleKey`
- [ ] Se `acessoTotal = true` (superadmin), o item aparece automaticamente
- [ ] Se usuario comum, o item so aparece se `chavesPermitidas` incluir o moduleKey
- [ ] Item publico intencional (sem `moduleKey`) deve ser documentado como excecional

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

**Arquivo:** `src/components/Sidebar.tsx`

- Item interno precisa ter `moduleKey` definido em `navItems`
- Se `acessoTotal = true` (superadmin), todos os itens aparecem
- Se usuario comum, so aparecem itens cujo `moduleKey` esta em `chavesPermitidas`
- Item publico intencional (sem `moduleKey`) deve ser documentado como excecional e nao tratado como modulo interno comum

**Exemplo:**

```ts
const navItems: NavItem[] = [
  { label: 'DASHBOARD',  href: '/dashboard',  icon: BarChart3, moduleKey: 'dashboard' },
  { label: 'NOVO MODULO', href: '/novo-modulo', icon: SomeIcon, moduleKey: 'novo_modulo' },
  // Item publico (sem moduleKey):
  { label: 'HORARIOS AGENDAMENTOS', href: '/horarios-agendamentos', icon: Clock },
]
```

---

## 6. Padrao de Superadmin

O modulo deve aparecer na gestao de perfis (Superadmin > Perfis) para ser liberado/bloqueado por perfil.

- `PerfilEditor.tsx` lista automaticamente todos os modulos ativos de `app_modulos`
- Ao criar um novo modulo, ele aparece na matriz de permissoes
- O superadmin pode marcar `permitido = true/false` para cada perfil
- Exceoes individuais podem ser aplicadas via `app_permissoes_usuario`

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
- Sidebar: `src/components/Sidebar.tsx`
- Gestao de perfis: `src/app/superadmin/_components/PerfilEditor.tsx`
- Paginas de exemplo: `src/app/dashboard/page.tsx`, `src/app/procurar-datas/page.tsx`, `src/app/recebimento/page.tsx`
- Log de progresso: `docs/ia/log_progress.md`
