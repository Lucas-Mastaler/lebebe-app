# Plano de acesso a Usuarios e unidades

Data: 2026-07-15
Agente/ferramenta: Codex
Tipo: auditoria tecnica e plano futuro. Nenhuma implementacao funcional realizada.

---

## 1. Estado atual confirmado

A tela `https://lebebe.cloud/superadmin?tab=usuarios` corresponde a rota local `src/app/superadmin/page.tsx`.

Hoje `/superadmin` e uma pagina client-side unica, com tres abas:

- `usuarios`
- `perfis`
- `auditoria`

O parametro `tab` e lido com `useSearchParams()`. Se o valor for `usuarios`, `perfis` ou `auditoria`, o estado `activeTab` e atualizado. Se nao houver parametro ou se ele for invalido, o estado inicial permanece `usuarios`.

A pagina renderiza:

- Aba Usuarios: tabela e modal no proprio `src/app/superadmin/page.tsx`.
- Aba Perfis: componente separado `src/app/superadmin/_components/PerfilEditor.tsx`.
- Aba Auditoria: tabela no proprio `src/app/superadmin/page.tsx`, com leitura direta de `auditoria_acessos` via client Supabase.

Nao existe hoje separacao de autorizacao por aba. A barreira atual e a rota inteira `/superadmin`.

---

## 2. Arquitetura atual

### 2.1 Interface -> estado

`src/app/superadmin/page.tsx`:

- `activeTab` controla a aba ativa.
- `useSearchParams()` interpreta `tab`.
- `Tabs`, `TabsList`, `TabsTrigger` e `TabsContent` renderizam as tres areas.
- `loadData()` carrega dados de acordo com a aba ativa.

Comportamento de carga:

- `activeTab === 'usuarios'`: chama `loadUsuarios()` e `loadPerfis()` em paralelo.
- Qualquer outra aba: chama `loadAuditoria()`.

Observacao: ao abrir `tab=perfis`, `loadData()` chama `loadAuditoria()` por cair no `else`. O componente `PerfilEditor` tambem carrega seus dados por conta propria. Isso nao altera autorizacao, mas e uma dependencia lateral desnecessaria identificada.

### 2.2 Usuarios

Fluxo atual:

1. UI chama `GET /api/superadmin/usuarios`.
2. API valida sessao com `requireAuthenticatedUser({ requireAllowedUser: true, requireActive: true, requiredRole: 'superadmin' })`.
3. API usa service role em `createServiceClient()`.
4. API consulta:
   - `usuarios_permitidos`
   - `app_usuarios_perfis`
   - `app_perfis_acesso`
5. API monta `perfil: { id, chave, nome, ativo } | null`.
6. UI renderiza email, role, perfil, status, data de criacao e acoes.

Acoes atuais:

- Adicionar usuario: `POST /api/superadmin/adicionar-usuario`.
- Bloquear/desbloquear: `PATCH /api/superadmin/usuarios/[id]/status`.
- Alterar role: `PATCH /api/superadmin/usuarios/[id]/role`.
- Atribuir perfil: `PUT /api/superadmin/usuarios/[id]/perfil`.
- Remover perfil: `DELETE /api/superadmin/usuarios/[id]/perfil`.

Campos atuais do cadastro:

- `email`
- `role` (`user` ou `superadmin`)

Nao existe campo de unidade no cadastro nem na edicao.

### 2.3 Perfis

`src/app/superadmin/_components/PerfilEditor.tsx`:

- Lista perfis via `GET /api/superadmin/perfis`.
- Ao selecionar perfil, carrega:
  - `GET /api/superadmin/perfis/[id]/permissoes`
  - `GET /api/superadmin/perfis/[id]/janelas`
- Salva:
  - `PUT /api/superadmin/perfis/[id]/permissoes`
  - `PUT /api/superadmin/perfis/[id]/janelas`

Permissoes sao armazenadas em tabelas relacionais:

- `app_modulos`: catalogo de modulos/telas.
- `app_perfis_acesso`: perfis.
- `app_permissoes_perfil`: matriz perfil x modulo.
- `app_usuarios_perfis`: vinculo usuario x perfil, com `UNIQUE(usuario_id)`.
- `app_permissoes_usuario`: excecoes individuais por usuario.

Uma nova tela aparece no editor de perfis quando existe linha ativa em `app_modulos` com:

- `ativo = true`
- `publico = false`
- `somente_superadmin = false`

Hoje o modulo `superadmin` existe em `app_modulos`, mas com `somente_superadmin = true`, portanto nao aparece na matriz de permissoes de perfis.

### 2.4 Menu lateral

`src/components/Sidebar.tsx`:

- Usa `usePermissoes()`.
- `usePermissoes()` chama `GET /api/me/permissoes`.
- Superadmin recebe `acessoTotal = true`.
- Usuario comum ve somente itens cujo `moduleKey` esta em `chavesPermitidas`.
- Itens da area Configuracoes:
  - `USUARIOS` -> `/superadmin?tab=usuarios`, marcado como `superadminOnly: true`.
  - `AUDITORIA ACESSOS` -> `/superadmin?tab=auditoria`, marcado como `superadminOnly: true`.

Hoje esconder item no menu nao e a protecao real. A protecao real de `/superadmin` ocorre no middleware e nas APIs.

---

## 3. Controle de acesso atual

### 3.1 Middleware

`src/middleware.ts`:

- Exige sessao Supabase para rotas protegidas.
- Consulta `usuarios_permitidos` por email.
- Bloqueia usuario ausente ou `ativo = false`.
- Aplica auto-logout apos 19h BRT para nao-superadmin.
- Para qualquer pathname iniciado por `/superadmin`, exige `usuarioPermitido.role === 'superadmin'`.
- Para qualquer pathname iniciado por `/configuracoes`, exige `usuarioPermitido.role === 'superadmin'`.

Resultado atual esperado:

- Usuario comum em `/superadmin`: redirect para `/inicio`.
- Usuario comum em `/superadmin?tab=usuarios`: redirect para `/inicio`.
- Usuario comum em `/superadmin?tab=perfis`: redirect para `/inicio`.
- Usuario comum em `/superadmin?tab=auditoria`: redirect para `/inicio`.

Esse comportamento foi confirmado no codigo. Nao foi executado teste manual em producao.

### 3.2 APIs de superadmin

Todas as APIs lidas sob `/api/superadmin/*` exigem `requiredRole: 'superadmin'`.

Isso inclui as APIs de:

- usuarios
- adicionar usuario
- status
- role
- perfil do usuario
- perfis
- permissoes do perfil
- janelas do perfil

Assim, mesmo que no futuro a aba Usuarios seja exibida para outro perfil, as APIs atuais continuariam retornando 403 ate serem alteradas com uma regra propria.

### 3.3 Auditoria de acessos

A aba Auditoria nao usa API propria. Ela consulta `auditoria_acessos` diretamente do browser com `createClient()`.

MCP Supabase confirmou:

- `auditoria_acessos` tem RLS ligada.
- Policy atual: `auditoria_acessos_select` para role `authenticated`, com `USING (is_superadmin())`.
- Existem grants amplos para `anon` e `authenticated`, mas a leitura efetiva fica limitada pela RLS.

Portanto, a protecao da aba Auditoria depende de:

- middleware bloqueando `/superadmin`;
- RLS `is_superadmin()` bloqueando leitura direta para nao-superadmin.

---

## 4. Diagnostico

### 4.1 O que ja existe e pode ser reaproveitado

- Modelo relacional de modulos e perfis ja existe.
- `app_modulos` ja e a fonte para permissoes exibidas em Perfis.
- `app_permissoes_perfil` ja permite liberar modulo por perfil.
- `app_usuarios_perfis` ja vincula usuario a um perfil.
- `app_auditoria_permissoes` ja registra alteracoes de perfil/permissoes/janelas.
- `GET /api/me/permissoes` ja alimenta o menu lateral.
- `checkModuleAndWindowAccess(moduleKey)` ja protege paginas internas por modulo.
- `requireModuleAccess(moduleKey)` ja protege APIs por modulo em alguns fluxos.

### 4.2 O que precisara ser alterado futuramente

Para permitir acesso somente a area Usuarios sem liberar Perfis e Auditoria:

1. Nao liberar o modulo `superadmin` inteiro para perfis comuns.
2. Criar uma permissao especifica para a area de Usuarios, seguindo o padrao de `app_modulos`.
3. Separar autorizacao da pagina `/superadmin` por aba ou extrair Usuarios para rota propria.
4. Alterar APIs de usuarios para aceitar a nova permissao especifica, sem permitir APIs de perfis/auditoria.
5. Manter APIs de perfis, role e auditoria restritas a superadmin, salvo decisao explicita em contrario.
6. Ajustar Sidebar para exibir apenas o item Usuarios quando o perfil tiver essa permissao.

### 4.3 Fragilidades e riscos atuais

- `/superadmin` e uma pagina unica; nao ha barreira por aba.
- `tab=perfis` e `tab=auditoria` sao controladas apenas pelo mesmo gate geral de `/superadmin`.
- `PerfilEditor` e Usuarios compartilham o mesmo espaco administrativo, mas com riscos diferentes.
- A aba Auditoria consulta Supabase direto do client; depende fortemente de RLS correta.
- As APIs de usuario permitem hoje alterar role para `superadmin`, atribuir/remover perfil e bloquear/desbloquear. Para um futuro perfil "gestor de usuarios", essas capacidades precisam ser separadas por endpoint/acao.
- A UI protege emails iniciais (`lucas@lebebe.com.br`, `robyson@lebebe.com.br`) contra bloqueio/alteracao visual, mas a protecao definitiva contra ultimo superadmin esta nas APIs de status/role por contagem de superadmins ativos. A lista de emails protegidos e regra de UX, nao modelo de seguranca completo.
- `loadData()` na aba Perfis chama `loadAuditoria()` por cair no `else`; isso nao libera dados para user comum hoje, mas e acoplamento indesejado para uma futura abertura parcial de `/superadmin`.

### 4.4 Inconsistencias ou dependencias ocultas

- O menu lateral usa `superadminOnly` para os links de `/superadmin`, nao `moduleKey`.
- O modulo `superadmin` existe no banco, mas e `somente_superadmin = true`, logo nao resolve o caso de liberar apenas Usuarios.
- `ModuleKey` em `src/lib/auth/module-access.ts` nao possui uma chave separada para Usuarios.
- Nao existe rota server wrapper para `/superadmin` usando `checkModuleAndWindowAccess`; a protecao de pagina vem do middleware.
- APIs de superadmin usam `requiredRole`, nao `requireModuleAccess`.

---

## 5. Estrutura atual de dados

### 5.1 Tabelas confirmadas por MCP Supabase

- `usuarios_permitidos`: usuario permitido, email, role, ativo e convite.
- `auditoria_acessos`: auditoria geral de auth/admin.
- `app_modulos`: catalogo de modulos.
- `app_perfis_acesso`: perfis de acesso.
- `app_usuarios_perfis`: vinculo usuario-perfil, um perfil por usuario.
- `app_permissoes_perfil`: permissoes por perfil.
- `app_permissoes_usuario`: excecoes individuais por usuario.
- `app_janelas_acesso_perfil`: janelas de horario por perfil.
- `app_janelas_acesso_usuario`: existe, mas a regra de precedencia esta documentada como pendente e nao e usada no helper atual.
- `app_auditoria_permissoes`: auditoria de alteracoes de permissoes/perfis/janelas.

### 5.2 Unidades

Nao foi encontrada estrutura atual de cadastro de unidades para usuarios.

Conceitos relacionados encontrados:

- `sgi_documentos_saida.filial`: filial da venda, no contexto SGI/Inteligencia Comercial.
- `sgi_documentos_saida.departamentos_venda`: departamentos da venda.
- `sgi_documentos_saida_produtos.departamento_classificado`: classificacao de produto.
- `digisac_triagem_loja.loja_detectada` e `departamento_destino`: triagem Digisac.
- `procurar_datas_config.unidade`: unidade de medida/configuracao, nao unidade operacional.

Essas estruturas nao devem ser reutilizadas diretamente para permissao de usuario por unidade, porque representam dados operacionais de vendas/configuracao ou triagem, nao um catalogo administrativo de unidades.

---

## 6. Estrutura recomendada para multiplas unidades

Recomendacao: criar estrutura relacional.

Modelo futuro sugerido:

- `app_unidades`
  - `id`
  - `chave` (`bigorrilho`, `portao`, `marechal`, `feira`, `pos_venda`)
  - `nome` (`BIGORRILHO`, `PORTAO`, `MARECHAL`, `FEIRA`, `POS VENDA`)
  - `ativo`
  - `ordem`
  - timestamps
- `app_usuarios_unidades`
  - `usuario_id`
  - `unidade_id`
  - `atribuido_por`
  - timestamps
  - `UNIQUE(usuario_id, unidade_id)`
- auditoria em `app_auditoria_permissoes` ou nova auditoria especifica, conforme decisao.

Comparativo:

| Alternativa | Vantagens | Desvantagens | Diagnostico |
|---|---|---|---|
| Coluna array/JSON em `usuarios_permitidos` | Simples e rapida | Sem FK, sem catalogo, dificil auditar e consultar | Nao recomendada para controle futuro por unidade |
| Tabela relacional usuario-unidade | Integridade, filtros, auditoria, multiunidade real | Exige migration e APIs novas | Recomendada |
| Reaproveitar SGI/Digisac | Evita tabela nova | Mistura conceitos operacionais com autorizacao | Nao recomendado |

Motivo da recomendacao:

O projeto ja usa modelo relacional para permissoes (`app_modulos`, `app_permissoes_perfil`, `app_usuarios_perfis`). Para unidade, o mesmo padrao facilita filtros futuros, controle de acesso por unidade, auditoria e migracao de usuarios existentes.

---

## 7. Usuarios existentes

Decisoes futuras necessarias:

- Usuarios antigos poderao ficar temporariamente sem unidade?
- Unidade sera obrigatoria para todo usuario novo?
- Superadmin precisa de todas as unidades implicitamente ou tambem tera vinculo explicito?
- Quem pode editar unidades de outro usuario?
- Um perfil com acesso a Usuarios pode editar usuarios de qualquer unidade ou apenas das suas unidades?
- Deve existir unidade default na migracao inicial?
- `POS VENDA` e unidade operacional, departamento, ou ambos?
- `FEIRA` tera comportamento igual a loja fisica?

Recomendacao tecnica:

- Permitir estado inicial sem unidade durante migracao.
- Exibir "Sem unidade" na tabela ate saneamento.
- Impedir obrigatoriedade dura no primeiro deploy, para nao quebrar usuarios existentes.
- Adicionar validacao obrigatoria apenas depois de migracao/dados saneados, se o negocio decidir.

---

## 8. Plano futuro de implementacao

1. Modelagem de unidades
   - Criar plano de migration para `app_unidades` e `app_usuarios_unidades`.
   - Seedar BIGORRILHO, PORTAO, MARECHAL, FEIRA, POS VENDA.
   - Definir RLS/grants seguindo padrao service role + APIs.

2. Permissao especifica da area Usuarios
   - Definir `moduleKey` conforme padrao real do projeto.
   - Criar modulo em `app_modulos` com `somente_superadmin = false`.
   - Nao alterar o modulo `superadmin` inteiro para comum.

3. Separacao da autorizacao
   - Preferencia tecnica: extrair Usuarios para rota propria, por exemplo `/superadmin/usuarios` ou `/usuarios-admin`, protegida por `checkModuleAndWindowAccess`.
   - Alternativa: manter `/superadmin?tab=usuarios`, mas adicionar gate server/middleware por query string. Essa alternativa e mais fragil, porque middleware por query/aba tende a ser mais facil de quebrar.

4. Separacao das APIs
   - Criar/ajustar APIs especificas para gestao limitada de usuarios.
   - Manter APIs de Perfis, Auditoria e role superadmin protegidas por `requiredRole: 'superadmin'`.
   - Separar capacidades:
     - listar usuarios;
     - convidar usuario comum;
     - editar perfil permitido;
     - editar unidades;
     - bloquear/desbloquear;
     - alterar role para superadmin.

5. Campo de multiplas unidades no cadastro
   - Adicionar seletor multiunidade ao modal de novo usuario.
   - Salvar vinculos em tabela relacional.
   - Auditar alteracao.

6. Edicao de unidades de usuarios existentes
   - Adicionar coluna ou acao na tabela de Usuarios.
   - Permitir edicao sem recriar usuario.
   - Exibir unidades vinculadas e estado "Sem unidade".

7. Tipos e contratos
   - Atualizar tipos TypeScript.
   - Atualizar respostas de APIs.
   - Atualizar hook/menu se necessario.

8. Auditoria
   - Registrar antes/depois de alteracoes de unidade.
   - Decidir se a aba Auditoria exibira `app_auditoria_permissoes`, `auditoria_acessos`, ou ambas.

9. Testes
   - Testes de helpers de autorizacao.
   - Testes de APIs com superadmin, perfil autorizado e perfil nao autorizado.
   - Testes de usuario tentando acessar Perfis/Auditoria por URL direta.

10. Validacao manual
   - Superadmin acessa tudo.
   - Perfil com Usuarios acessa somente Usuarios.
   - Perfil com Usuarios nao acessa Perfis.
   - Perfil com Usuarios nao acessa Auditoria.
   - Chamada direta de API de Perfis retorna 403.
   - Chamada direta de API de Auditoria nao retorna dados.
   - Usuario nao consegue criar outro superadmin nem promover a si mesmo.

---

## 9. Criterios de aceite propostos

- Perfil nao-superadmin com permissao de Usuarios abre a area Usuarios.
- O mesmo perfil nao abre Perfis por menu, URL direta ou componente.
- O mesmo perfil nao abre Auditoria por menu, URL direta ou consulta direta.
- APIs de Perfis continuam exigindo superadmin.
- APIs de Auditoria continuam exigindo superadmin ou RLS equivalente.
- API de Usuarios limitada nao permite criar superadmin.
- API de Usuarios limitada nao permite alterar o proprio role/perfil para obter privilegio maior.
- Usuarios podem ter zero, uma ou varias unidades conforme regra definida.
- Vinculo de unidades e salvo sem recriar usuario.
- Alteracoes de perfil/unidade ficam auditadas.
- Menu lateral mostra somente o que o perfil pode acessar.
- Acesso direto por URL e bloqueado quando nao autorizado.
- Nenhuma permissao depende apenas de esconder aba no frontend.

---

## 10. Arquivos realmente envolvidos

### Pagina, layout e rota

- `src/app/superadmin/page.tsx`: pagina client-side de Superadmin; controla `tab`, lista usuarios, renderiza Perfis e Auditoria.
- `src/app/layout.tsx`: layout raiz com `LayoutWrapper`.
- `src/components/LayoutWrapper.tsx`: renderiza Sidebar/Topbar nas rotas internas.

### Componentes

- `src/app/superadmin/_components/PerfilEditor.tsx`: editor de perfis, permissoes e janelas.
- `src/components/Sidebar.tsx`: menu lateral, hoje com links de Usuarios/Auditoria marcados como `superadminOnly`.

### Hooks e contexto de autenticacao

- `src/lib/hooks/usePermissoes.ts`: busca permissoes efetivas do usuario atual.
- `src/app/api/me/permissoes/route.ts`: retorna modulos permitidos, perfil atual e janelas.
- `src/lib/auth/api-auth.ts`: helper de autenticacao/autorizacao por role em APIs.
- `src/lib/auth/module-access.ts`: helper de autorizacao por modulo.
- `src/lib/auth/access-window.ts`: helper de janela de horario por perfil.

### Middleware

- `src/middleware.ts`: bloqueia `/superadmin` e `/configuracoes` por `role === 'superadmin'`.

### APIs

- `src/app/api/superadmin/usuarios/route.ts`: lista usuarios e perfis vinculados.
- `src/app/api/superadmin/adicionar-usuario/route.ts`: cria/reativa usuario permitido e envia convite.
- `src/app/api/superadmin/usuarios/[id]/status/route.ts`: bloqueia/desbloqueia usuario.
- `src/app/api/superadmin/usuarios/[id]/role/route.ts`: altera role.
- `src/app/api/superadmin/usuarios/[id]/perfil/route.ts`: atribui/remove perfil.
- `src/app/api/superadmin/perfis/route.ts`: lista perfis.
- `src/app/api/superadmin/perfis/[id]/permissoes/route.ts`: lista/salva permissoes de perfil.
- `src/app/api/superadmin/perfis/[id]/janelas/route.ts`: lista/salva janelas de perfil.
- `src/app/api/auditoria/registrar/route.ts`: grava `auditoria_acessos`.

### Servicos

- `src/lib/supabase/service.ts`: client service role server-side.
- `src/lib/supabase/client.ts`: client Supabase usado na aba Auditoria.
- `src/lib/supabase/server.ts`: client Supabase server/cookies.
- `src/lib/auth/helpers.ts`: `registrarAuditoria`.

### Tipos

- `src/types/supabase.ts`: tipos de usuarios, auditoria, modulos, perfis, permissoes e janelas.

### Schema e migrations

- `supabase/migrations/001_initial_schema.sql`: `usuarios_permitidos`, `auditoria_acessos`, RLS inicial.
- `supabase/migrations/002_fix_rls_recursion.sql`: `is_superadmin()`, `is_own_record()`, policies atuais.
- `supabase/migrations/003_add_invite_tracking.sql`: tracking de convite.
- `supabase/migrations/004_add_invite_token.sql`: token de convite.
- `supabase/migrations/005_add_invite_token_used_at.sql`: uso de token.
- `supabase/migrations/20260629120000_create_app_permissions_schema.sql`: `app_modulos`, `app_permissoes_usuario`, `app_janelas_acesso_usuario`, `app_auditoria_permissoes`.
- `supabase/migrations/20260629140000_seed_access_profile_permissions.sql`: matriz inicial de permissoes por perfil.
- `supabase/migrations/20260629150000_seed_procurar_datas_auditoria_module.sql`: modulo `procurar_datas_auditoria`.

### Documentacao

- `docs/ia/log_progress.md`: log de continuidade.
- `docs/ia/padrao-novas-telas-permissoes.md`: padrao vigente para novas telas/permissoes.
- `docs/ia/plano-fase-0-7-modelagem-permissoes-usuarios.md`: plano historico de modelagem de permissoes.
- `docs/ia/auditoria-usuarios-login-roles.md`: auditoria historica de usuarios/login/roles.
- `docs/plano-acesso-usuarios-e-unidades.md`: este documento.

### Testes

Nao foi encontrado teste especifico para `/superadmin` nesta auditoria. Foram encontrados testes em outros fluxos de permissao/modulo, mas nenhum teste dedicado a liberar somente a aba Usuarios.

---

## 11. Validacoes realizadas nesta auditoria

- Leitura do anexo do pedido.
- Leitura de `docs/ia/log_progress.md`.
- Busca de docs relacionadas a usuarios, perfis, auth, permissoes e superadmin.
- Leitura dos arquivos de rota, componentes, middleware, helpers, APIs, tipos e migrations listados.
- MCP Supabase em modo leitura:
  - colunas das tabelas relevantes;
  - constraints;
  - policies;
  - RLS/grants;
  - busca de tabelas/colunas relacionadas a unidade/filial/loja/departamento.

Nenhum teste automatizado foi executado, porque a tarefa e de auditoria e nao houve alteracao funcional.

---

## 12. Pendencias e decisoes de negocio

- Nome final da permissao especifica de Usuarios.
- Rota futura preferida: subrota dedicada ou manutencao de query string.
- Se gestores de Usuarios poderao convidar novos usuarios ou apenas editar usuarios existentes.
- Se gestores de Usuarios poderao alterar perfil, status e role, ou apenas unidades.
- Se algum nao-superadmin podera atribuir perfis a outros usuarios.
- Se usuario com acesso a Usuarios pode editar usuarios fora de suas unidades.
- Se unidade sera obrigatoria no cadastro.
- Como migrar usuarios existentes sem unidade.
- Se superadmin tera unidades explicitas ou acesso implicito a todas.
- Se `POS VENDA` deve ser unidade, departamento ou ambos.
- Se `FEIRA` tera regra operacional distinta.

---

## 13. Checklist futuro

- [ ] Decidir rota e `moduleKey` da area Usuarios.
- [ ] Criar migration de unidades.
- [ ] Criar permissao especifica de Usuarios.
- [ ] Separar pagina/aba Usuarios de Perfis e Auditoria.
- [ ] Separar APIs de usuarios comuns das APIs de superadmin completo.
- [ ] Impedir criacao/promocao indevida de superadmin.
- [ ] Adicionar multiunidade ao cadastro.
- [ ] Adicionar edicao de unidade para usuarios existentes.
- [ ] Auditar alteracoes de unidade.
- [ ] Cobrir URL direta e chamadas diretas de API.
- [ ] Validar manualmente com superadmin, perfil autorizado e perfil bloqueado.

---

## 14. Implementacao realizada em 2026-07-15

Tipo: implementacao local. Migration criada no repositorio, nao aplicada no Supabase por esta tarefa.

### 14.1 Decisoes aplicadas

- `moduleKey` criado: `superadmin_usuarios`.
- A rota publica de trabalho continua sendo `/superadmin?tab=usuarios`.
- A pagina `/superadmin` passou a ter wrapper server-side em `src/app/superadmin/page.tsx`.
- O conteudo client-side anterior foi movido para `src/app/superadmin/PageClient.tsx`.
- Perfis e Auditoria continuam exclusivos de superadmin.
- Usuarios pode ser acessado por superadmin ou por perfil com permissao no modulo `superadmin_usuarios`.
- Middleware deixou de bloquear previamente `/superadmin?tab=usuarios` para nao-superadmin ativo, mas a permissao real fica no server wrapper e nas APIs.
- URLs sem `tab` ou com `tab` invalida sao normalizadas para `/superadmin?tab=usuarios`.

### 14.2 Banco e migration local

Arquivo criado:

- `supabase/migrations/20260715120000_add_superadmin_users_units.sql`

Conteudo:

- Cria `app_unidades`.
- Cria `app_usuarios_unidades`.
- Ativa RLS nas duas tabelas e revoga acesso direto de `anon` e `authenticated`.
- Seed inicial:
  - `bigorrilho` / `BIGORRILHO`
  - `portao` / `PORTAO`
  - `marechal` / `MARECHAL`
  - `feira` / `FEIRA`
  - `pos_venda` / `POS VENDA`
- Cria/atualiza modulo `app_modulos.chave = 'superadmin_usuarios'`, com `somente_superadmin = false`.

Observacao: a migration nao concede permissao automaticamente a nenhum perfil. A liberacao deve ser feita pelo editor de Perfis apos aplicar a migration.

### 14.3 APIs alteradas/criadas

Alteradas:

- `GET /api/superadmin/usuarios`
  - Agora aceita superadmin ou permissao `superadmin_usuarios`.
  - Retorna `unidades` por usuario.
- `POST /api/superadmin/adicionar-usuario`
  - Agora aceita superadmin ou permissao `superadmin_usuarios`.
  - Acesso limitado sempre cria `role = user`.
  - Acesso limitado nao pode reativar/criar superadmin.
  - Aceita `perfilId` e `unidadeIds`.
  - Grava vinculos em `app_usuarios_perfis` e `app_usuarios_unidades`.
- `PATCH /api/superadmin/usuarios/[id]/status`
  - Agora aceita superadmin ou permissao `superadmin_usuarios`.
  - Acesso limitado nao pode alterar a si mesmo nem superadmins.
- `PUT/DELETE /api/superadmin/usuarios/[id]/perfil`
  - Agora aceita superadmin ou permissao `superadmin_usuarios`.
  - Acesso limitado nao pode alterar a si mesmo nem superadmins.
  - Acesso limitado nao pode atribuir perfil que possua permissao `superadmin_usuarios`.

Criadas:

- `GET /api/superadmin/usuarios/perfis-disponiveis`
- `GET /api/superadmin/unidades`
- `PUT /api/superadmin/usuarios/[id]/unidades`

Mantidas superadmin-only:

- APIs de Perfis.
- APIs de Janelas.
- API de alteracao de role.
- Aba Auditoria e leitura direta de `auditoria_acessos` via RLS `is_superadmin()`.

### 14.4 UI alterada

Arquivos:

- `src/app/superadmin/page.tsx`
- `src/app/superadmin/PageClient.tsx`
- `src/components/Sidebar.tsx`

Mudancas:

- Sidebar passou a exibir `USUARIOS` por `moduleKey = superadmin_usuarios`.
- Sidebar manteve `AUDITORIA ACESSOS` como `superadminOnly`.
- Abas `Perfis` e `Auditoria` so aparecem para superadmin.
- Cadastro de usuario agora permite selecionar perfil e multiplas unidades.
- Para acesso limitado, campo `Role` nao aparece e backend forca `user`.
- Tabela de Usuarios ganhou coluna `Unidades`.
- Edicao de unidades de usuario existente fica em modal.
- Usuarios antigos podem aparecer como `Sem unidade`.

### 14.5 Arquivos auxiliares

Criados:

- `src/lib/auth/superadmin-users-access.ts`
- `src/lib/superadmin/usuarios.ts`
- `src/lib/superadmin/usuarios.test.ts`

Alterado:

- `src/lib/auth/module-access.ts`
- `src/types/supabase.ts`

### 14.6 Validacoes realizadas

- MCP Supabase em modo leitura confirmou antes da implementacao:
  - `app_unidades` inexistente.
  - `app_usuarios_unidades` inexistente.
  - `app_modulos` existente e `superadmin` com `somente_superadmin = true`.
  - constraints/policies relevantes de `usuarios_permitidos`, `app_modulos`, `app_perfis_acesso`, `app_usuarios_perfis`, `app_permissoes_perfil`, `app_permissoes_usuario`, `app_auditoria_permissoes` e `auditoria_acessos`.
- `npx tsc --noEmit`: passou.
- `npm run test -- src/lib/superadmin/usuarios.test.ts`: passou, 1 arquivo e 2 testes.

### 14.7 Pendencias conhecidas

- Migration local precisa ser aplicada no Supabase antes de validar a tela em producao.
- Depois da migration, um superadmin precisa liberar `superadmin_usuarios` no perfil desejado.
- Nao foi executado teste manual autenticado em producao.
- Nao foi aplicada migration por MCP nesta tarefa.
- A gravacao de usuario, perfil e unidades acontece em etapas via API. Se uma etapa posterior falhar, o endpoint retorna erro, mas nao ha transacao SQL unica nesta implementacao.

---

## 15. Correcao de sincronizacao menu x Perfis em 2026-07-15

Tipo: implementacao local. Nenhuma migration aplicada no Supabase.

### 15.1 O que mudou

- Criado catalogo central em `src/lib/auth/modulos-app.ts`.
- `src/components/Sidebar.tsx` passou a consumir `NAVIGATION_GROUPS` desse catalogo.
- `ModuleKey` em `src/lib/auth/module-access.ts` passou a ser derivado de `AppModuleKey`.
- Criado teste `src/lib/auth/modulos-app.test.ts` para validar consistencia entre catalogo, Sidebar e migrations conhecidas.
- Criada migration local `supabase/migrations/20260715130000_ensure_menu_catalog_modules.sql` para garantir seeds locais de:
  - `digisac_finalizacoes_automaticas`
  - `procurar_datas_performance`

### 15.2 Resultado pratico

- Novo item controlado por perfil deve ser cadastrado em `APP_MODULES` e referenciado em `NAVIGATION_GROUPS`.
- Nao e mais necessario editar lista manual no Sidebar.
- O editor de Perfis continua lendo `app_modulos`.
- O modulo novo fica bloqueado por padrao quando nao existe linha em `app_permissoes_perfil`, pela regra `permitido: permissoesMap.get(m.id) ?? false`.
- Nenhuma permissao e concedida automaticamente pelas migrations criadas nesta correcao.

### 15.3 Validacao esperada

- `npm run test -- src/lib/auth/modulos-app.test.ts`
- `npx tsc --noEmit`
- ESLint nos arquivos alterados
- `git diff --check`

### 15.4 Pendencias

- A migration `20260715130000_ensure_menu_catalog_modules.sql` e local e nao foi aplicada em producao.
- Validacao em browser autenticado nao realizada nesta etapa.

---

## 16. Correcao complementar de modulos liberaveis em 2026-07-15

Tipo: implementacao local. Migration corretiva criada no repositorio, nao aplicada por esta tarefa.

### 16.1 Causa confirmada

O editor de Perfis filtra `app_modulos` por:

- `ativo = true`
- `publico = false`
- `somente_superadmin = false`

Mesmo com o menu centralizado, quatro itens do menu nao apareciam na matriz porque estavam ausentes desse filtro por classificacao incorreta ou por uso de modulo granular inexistente:

- `horarios_agendamentos`: estava como `publico = true`.
- `digisac_finalizacoes_automaticas`: estava como `somente_superadmin = true`.
- `configuracoes/procurar-datas`: usava o modulo generico `configuracoes`, que e `somente_superadmin = true`.
- `pos_venda_atendimento_automatico`: estava como `somente_superadmin = true`.

### 16.2 Estado real confirmado no Supabase antes da correcao

Consulta MCP usada:

```sql
select chave, nome, descricao, rota_base, categoria, ativo, publico, somente_superadmin, ordem
from public.app_modulos
where chave in (
  'dashboard',
  'agendamentos',
  'horarios_agendamentos',
  'chamados_finalizados',
  'inteligencia_comercial',
  'digisac_finalizacoes_automaticas',
  'procurar_datas',
  'procurar_datas_auditoria',
  'procurar_datas_performance',
  'configuracoes',
  'recebimento',
  'pos_venda',
  'pos_venda_atendimento_automatico',
  'superadmin_usuarios',
  'superadmin'
)
order by ordem nulls last, chave;
```

Resultado relevante:

- `horarios_agendamentos`: `ativo=true`, `publico=true`, `somente_superadmin=false`.
- `digisac_finalizacoes_automaticas`: `ativo=true`, `publico=false`, `somente_superadmin=true`.
- `configuracoes`: `ativo=true`, `publico=false`, `somente_superadmin=true`.
- `pos_venda_atendimento_automatico`: `ativo=true`, `publico=false`, `somente_superadmin=true`.
- `superadmin_usuarios`: `ativo=true`, `publico=false`, `somente_superadmin=false`.

### 16.3 Correcao local aplicada

- `src/lib/auth/modulos-app.ts`
  - `horarios_agendamentos`, `digisac_finalizacoes_automaticas` e `pos_venda_atendimento_automatico` passaram para `access = 'profile'`.
  - Criado modulo granular `configuracoes_procurar_datas` para `CONFIG BUSCA`.
  - `AUDITORIA ACESSOS` continua usando `superadmin` e `access = 'superadmin'`.
- `supabase/migrations/20260715140000_fix_profile_visible_menu_modules.sql`
  - Corrige/insere os quatro modulos liberaveis com `ativo=true`, `publico=false`, `somente_superadmin=false`.
  - Nao insere registros em `app_permissoes_perfil`.
- Paginas protegidas por modulo:
  - `/horarios-agendamentos` -> `horarios_agendamentos`.
  - `/digisac/finalizacoes-automaticas` -> `digisac_finalizacoes_automaticas`.
  - `/configuracoes/procurar-datas` -> `configuracoes_procurar_datas`.
  - `/pos-venda/atendimento-automatico` -> `pos_venda_atendimento_automatico`.
- APIs ajustadas:
  - `/api/digisac/schedule` -> `horarios_agendamentos`.
  - `/api/digisac/finalizacoes-automaticas/*` -> `digisac_finalizacoes_automaticas`, preservando `x-cron-secret` no diagnostico.
  - `/api/configuracoes/procurar-datas/*` -> `configuracoes_procurar_datas`.
  - APIs de `pos-venda/atendimento-automatico` ja usavam `pos_venda_atendimento_automatico`.

### 16.4 Teste corrigido

`src/lib/auth/modulos-app.test.ts` agora valida:

- lista explicita de itens liberaveis esperados no menu;
- simulacao do filtro real do editor de Perfis;
- `AUDITORIA ACESSOS` fora da matriz comum;
- seeds/migrations locais para os modulos liberaveis;
- ausencia de concessao automatica em `app_permissoes_perfil`;
- protecao das paginas e APIs das quatro telas corrigidas.

### 16.5 Resultado esperado apos aplicar a migration

Devem aparecer na matriz de Perfis:

- DASHBOARD
- AGENDAMENTOS
- HORARIOS AGENDAMENTOS
- CHAMADOS FINALIZADOS
- INTELIGENCIA COMERCIAL
- FINALIZACOES DIGISAC
- PROCURAR DATAS
- AUDITORIA DATAS
- PERFORMANCE DATAS
- CONFIG BUSCA
- RECEBIMENTO
- POS-VENDA
- ATENDIMENTO AUTOMATICO
- USUARIOS

Continua fora da matriz:

- AUDITORIA ACESSOS

Como a migration nao cria linhas em `app_permissoes_perfil`, os novos itens ficam bloqueados ate liberacao manual pelo superadmin.
