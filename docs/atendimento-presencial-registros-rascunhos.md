# Plano: Rascunhos na tela de Registros do Atendimento Presencial

> Documento de plano para mover a listagem de rascunhos da ficha para a tela de registros, mantendo reaproveitamento de APIs e permissões existentes.

---

## 1. Entendimento do pedido

Refatorar a experiência de rascunhos do Atendimento Presencial:

- Remover da ficha (`/atendimento-presencial/ficha`) a lista geral de rascunhos em andamento, cards e chamadas de listagem.
- Adicionar na ficha um botão **"Ver rascunhos"** que leva à tela de registros com a aba de rascunhos ativa.
- Implementar na tela de registros (`/atendimento-presencial/registros`) duas abas controladas por URL: **Atendimentos finalizados** (comportamento atual) e **Rascunhos** (nova).
- A aba de rascunhos deve listar rascunhos ativos usando a API existente e oferecer ação **"Continuar atendimento"**, que carrega o rascunho na ficha via query param.
- Preservar permissões, APIs e regras de negócio existentes, mas permitir que a rota `/atendimento-presencial/registros` seja acessada por quem possui `atendimento_presencial_ficha` ou `atendimento_presencial_registros`, exibindo apenas as abas permitidas.

---

## 2. Arquivos que participam do fluxo

| Arquivo | Papel |
|--------|-------|
| `src/app/atendimento-presencial/ficha/page.tsx` | Carrega contexto (perfil e unidades) no servidor e passa ao `FichaPageClient`. |
| `src/app/atendimento-presencial/ficha/FichaPageClient.tsx` | Remove lista de rascunhos, adiciona botão "Ver rascunhos" e carrega rascunho por query param. |
| `src/app/atendimento-presencial/registros/page.tsx` | Verifica permissões de `registros` e/ou `ficha` e passa flags ao `RegistrosPageClient`. |
| `src/app/atendimento-presencial/registros/RegistrosPageClient.tsx` | Adiciona abas controladas por URL e lista de rascunhos com ação "Continuar". |
| `src/lib/atendimento-presencial/rascunho-display.ts` | Helpers `nomeClienteRascunho` e `nomeConsultoraRascunho` reutilizados na aba de rascunhos. |
| `src/lib/atendimento-presencial/rascunhos-shared.ts` | Tipos `AtendimentoPresencialDTO`, `ContextoAtendimento`. |
| `src/components/ui/tabs.tsx` | Componente `Tabs` do projeto. |
| `src/app/api/atendimento-presencial/atendimentos/rascunhos/route.ts` | API existente de listagem de rascunhos (GET). |
| `src/app/api/atendimento-presencial/atendimentos/[id]/rascunho/route.ts` | API existente de busca de rascunho por ID (GET). |
| `docs/atendimento-presencial-simplificacao-fluxo.md` | Documento de fluxo a ser atualizado. |
| `docs/ia/log_progress.md` | Log de progresso a ser atualizado. |

---

## 3. Diagnóstico confirmado no código

- `FichaPageClient` hoje chama `carregarRascunhos()` no mount para obter `contexto` **e** preencher o estado `rascunhos`. A lista é renderizada em uma seção condicional (`!ativo`) com cards que mostram nome do cliente, consultora, unidade, datas e botão "Continuar atendimento".
- O helper `aplicarRascunho(rascunho: AtendimentoPresencialDTO)` já inicializa o estado completo do atendimento: `ativo`, `unidadeId`, `ficha`, fila de autosave, cache local, status de sync e cliente.
- A rota `GET /api/atendimento-presencial/atendimentos/rascunhos` retorna `{ ok, rascunhos, contexto, consultorasDisponiveis }`, valida `requireAtendimentoPresencialFichaAccess` e filtra por perfil/unidades.
- A rota `GET /api/atendimento-presencial/atendimentos/[id]/rascunho` retorna `{ ok, rascunho }` ou 404/403/410, validando `usuarioPodeAcessarRascunho`.
- `RegistrosPageClient` hoje lista somente atendimentos concluídos, filtrando por virada de cartão.
- A tela de registros é protegida por `atendimento_presencial_registros`; a ficha por `atendimento_presencial_ficha`.

---

## 4. Hipóteses / pontos ainda não confirmados

- **URL de retorno:** não confirmado se existe preferência por `?tab=rascunhos` ou outro nome; será usado `tab` por ser simples e previsível.
- **Permissões cruzadas:** resolvido no plano. A página de registros aceitará qualquer uma das permissões e renderizará apenas as abas autorizadas.

---

## 5. Validação de banco no MCP Supabase

Não aplicável. Não haverá alteração de schema, migrations, queries, RLS, policies, triggers, views, funções SQL ou tipos gerados. Todos os dados continuam sendo lidos pelos endpoints existentes.

---

## 5.1. Regras de permissão

A tela de registros passa a ser um ponto de entrada compartilhado entre dois módulos independentes:

| Ação / aba | Permissão necessária | API envolvida | Comportamento |
|---|---|---|---|
| Acessar a rota `/atendimento-presencial/registros` | `atendimento_presencial_registros` **OU** `atendimento_presencial_ficha` | `checkModuleAndWindowAccess` em `page.tsx` | Bloqueio padrão (`/acesso-negado` ou `/fora-do-horario`) se nenhuma for concedida. |
| Aba "Atendimentos finalizados" | `atendimento_presencial_registros` | `GET /api/atendimento-presencial/atendimentos` | API já exige a permissão. Cliente só chama quando autorizado. |
| Aba "Rascunhos" | `atendimento_presencial_ficha` | `GET /api/atendimento-presencial/atendimentos/rascunhos` e `GET /api/atendimento-presencial/atendimentos/[id]/rascunho` | APIs já exigem a permissão da ficha. Cliente só chama quando autorizado. |

- A `page.tsx` de registros calculará `podeVerRegistros` e `podeVerRascunhos` e passará ao `RegistrosPageClient`.
- Aba padrão (sem `tab`): a primeira aba permitida para aquele usuário.
- Tab inválido ou proibido: `router.replace` para a primeira aba permitida; nenhum conteúdo proibido é renderizado.
- Usuário com apenas ficha visualiza somente a aba Rascunhos; usuário com apenas registros visualiza somente Finalizados.

---

## 6. Plano de alteração mínimo

### 6.1 `page.tsx` da ficha

- Continuar usando `checkModuleAndWindowAccess('atendimento_presencial_ficha')`.
- Carregar `perfil` e `unidadesPermitidas` no servidor via `carregarPerfilAtendimento` e `listarUnidadesDoContexto` (funções exportadas de `@/lib/atendimento-presencial/rascunhos`).
- Passar `contextoInicial` e `unidadeIdInicial` como props para `FichaPageClient`, eliminando o GET da lista geral de rascunhos.
- `unidadeIdInicial` será vazio quando houver `?rascunho=<id>`, para não disparar criação automática antes do carregamento.

### 6.2 `FichaPageClient.tsx`

1. **Props**
   - Receber `contextoInicial: ContextoAtendimento` e `unidadeIdInicial: string`.
2. **Importações**
   - Adicionar `useRouter`, `useSearchParams` do `next/navigation`.
   - Remover `nomeClienteRascunho`, `nomeConsultoraRascunho` e o tipo `ApiListarRascunhosResponse` (não usados).
3. **Estado**
   - Inicializar `contexto` com `contextoInicial` e `unidadeId` com `unidadeIdInicial`.
   - Remover `rascunhos` e `carregando` (usados pela lista geral).
   - Adicionar `carregandoRascunhoInicial` e `erroRascunhoInicial` para o carregamento por URL.
4. **Header**
   - Manter botão "Novo atendimento" (visível quando `ativo`).
   - Adicionar botão "Ver rascunhos" ao lado, que faz flush seguro do autosave e navega para `/atendimento-presencial/registros?tab=rascunhos`.
5. **Remover listagem**
   - Remover estado, função, chamadas e JSX de listagem geral de rascunhos.
6. **Carregar rascunho por `?rascunho=<id>`**
   - Validar UUID, chamar `GET /api/atendimento-presencial/atendimentos/${id}/rascunho`.
   - Em sucesso, chamar `aplicarRascunho(data.rascunho)`.
   - Em erro, exibir mensagem clara e botões para "Novo atendimento" e "Ver rascunhos".
   - Durante o carregamento, ocultar o formulário principal (`!carregandoRascunhoInicial`) e exibir "Carregando rascunho...".
   - Não iniciar criação automática de rascunho enquanto o parâmetro está presente ou durante o loading.

### 6.3 `page.tsx` de registros

- Verificar as duas permissões: `atendimento_presencial_registros` e `atendimento_presencial_ficha`.
- Se nenhuma for concedida, redirecionar para `/acesso-negado` (ou `/fora-do-horario` se a falha for de janela de acesso).
- Passar `podeVerRegistros` e `podeVerRascunhos` como props para `RegistrosPageClient`.

### 6.4 `RegistrosPageClient.tsx`

1. **Props**
   - Receber `podeVerRegistros: boolean` e `podeVerRascunhos: boolean`.
2. **Importações**
   - Adicionar `useRouter`, `useSearchParams` do `next/navigation`.
   - Adicionar `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` de `@/components/ui/tabs`.
   - Adicionar `AtendimentoPresencialDTO` e `ContextoAtendimento` de `@/lib/atendimento-presencial/rascunhos-shared`.
   - Adicionar `nomeClienteRascunho` e `nomeConsultoraRascunho` de `@/lib/atendimento-presencial/rascunho-display`.
3. **Aba ativa**
   - Calcular abas permitidas a partir das props.
   - `tabAtual` vem de `searchParams.get('tab')` e deve estar dentro das permitidas.
   - Fallback: primeira aba permitida.
   - `router.replace` para a aba padrão quando o parâmetro estiver ausente, inválido ou proibido.
4. **Listagem de rascunhos**
   - Chamar `GET /api/atendimento-presencial/atendimentos/rascunhos` somente quando `tabAtual === 'rascunhos'` e `podeVerRascunhos` for true.
   - Renderizar loading, erro e estados vazios.
   - Exibir cards com: última atualização, filial, consultora, cliente, etapa e ação.
   - Botão **"Continuar atendimento"** navega para `/atendimento-presencial/ficha?rascunho=${rascunho.id}`.
5. **Aba finalizados**
   - Chamar `GET /api/atendimento-presencial/atendimentos` somente quando `tabAtual === 'finalizados'` e `podeVerRegistros` for true.
   - Manter listagem, filtros e detalhes existentes dentro de `TabsContent value="finalizados"`.

### 6.5 Documentação

- Manter este arquivo de plano (`docs/atendimento-presencial-registros-rascunhos.md`) atualizado.
- Atualizar `docs/atendimento-presencial-simplificacao-fluxo.md` com a nova divisão de telas e permissões.
- Atualizar `docs/ia/log_progress.md` com data, arquivos e validações.

---

## 7. Impactos esperados

- **Ficha mais enxuta:** remove a lista de rascunhos e o GET da lista geral, focando a ficha no atendimento ativo.
- **Navegação por URL:** a aba de rascunhos é compartilhável (`?tab=rascunhos`) e o botão "Continuar" carrega o rascunho via URL (`?rascunho=<id>`).
- **Permissões mantidas:** cada aba continua protegida por sua permissão original (`atendimento_presencial_registros` e `atendimento_presencial_ficha`).
- **Rota compartilhada:** `/atendimento-presencial/registros` passa a permitir acesso com qualquer uma das permissões, mas exibe apenas as abas autorizadas.
- **Recarregamento seguro:** a ficha com `?rascunho=<id>` recarrega o rascunho a cada refresh, sem criar rascunho novo automaticamente.
- **Autosave preservado:** `aplicarRascunho` recria a fila de autosave com a versão do servidor.

---

## 8. O que NÃO será alterado

- Nenhuma API route será alterada (sem mudança de permissões, payloads, queries ou respostas).
- Nenhum endpoint novo será criado.
- Nenhuma migration, tabela, coluna, RLS, policy, view ou trigger será criado/alterado.
- Nenhum módulo novo será criado no banco e nenhuma permissão existente terá seu significado alterado.
- A lógica de autosave, validação, conclusão, cache local e criação de rascunho na ficha permanece intacta.
- O fluxo de registros concluídos (filtros, detalhes, edição) permanece inalterado.
- As regras de visibilidade dos rascunhos (acesso por perfil/unidade) permanecem as mesmas.

---

## 9. Checklist de implementação

- [ ] `ficha/page.tsx`: carregar `contextoInicial` no servidor e passar ao `FichaPageClient`.
- [ ] `FichaPageClient`: remover listagem de rascunhos, estados e imports não utilizados.
- [ ] `FichaPageClient`: adicionar botão "Ver rascunhos" com flush seguro do autosave.
- [ ] `FichaPageClient`: carregar rascunho por `?rascunho=<id>` com loading e erros.
- [ ] `registros/page.tsx`: verificar permissões `registros` e `ficha`; passar flags ao client.
- [ ] `RegistrosPageClient`: adicionar controle de abas por URL com fallback e `router.replace`.
- [ ] `RegistrosPageClient`: adicionar aba de rascunhos com loading/erro/vazio e ação "Continuar".
- [ ] `RegistrosPageClient`: só chamar API de finalizados quando autorizado; só chamar API de rascunhos quando autorizado.
- [ ] Atualizar `docs/atendimento-presencial-simplificacao-fluxo.md`.
- [ ] Atualizar `docs/ia/log_progress.md`.
- [ ] Rodar `typecheck`, `eslint`, `test`, `build` e validar manualmente.

---

## 10. Riscos conhecidos

- **Teste `modulos-app.test.ts`:** a página de registros continuará contendo `checkModuleAndWindowAccess('atendimento_presencial_registros')`, mas também referenciará `atendimento_presencial_ficha` no mesmo arquivo. O teste unitário que valida a guarda exata pode precisar de ajuste se a asserção for rígida demais.
- **Verificações duplicadas:** a `page.tsx` de registros pode chamar `checkModuleAndWindowAccess` duas vezes (uma para cada permissão), gerando consultas extras ao banco. Isso é aceitável para preservar o helper existente e manter a alteração mínima.
- **Carregamento por URL:** o `useSearchParams` pode retornar `null` no primeiro render, causando um breve estado sem loading. O `unidadeIdInicial` vazio quando há `?rascunho=<id>` evita criação automática nesse intervalo.
- **Permissões cruzadas:** resolvido no design. Usuários com apenas `atendimento_presencial_registros` não verão a aba Rascunhos; usuários com apenas `atendimento_presencial_ficha` não verão Finalizados.

---

## 11. Próximos passos recomendados

1. Aplicar as alterações nos arquivos `ficha/page.tsx`, `FichaPageClient`, `registros/page.tsx` e `RegistrosPageClient`.
2. Rodar validações automáticas (`typecheck`, `eslint`, `testes`) e ajustar o teste `modulos-app.test.ts` se necessário.
3. Validar manualmente os cenários de permissão: somente ficha, somente registros, ambas, nenhuma.
4. Validar navegação ficha → registros → continuar rascunho, refresh em `?rascunho=<id>` e fallback de abas.
5. Revisar perfis de acesso no ambiente real, garantindo que usuários que precisam de ambas as visões possuam os dois módulos.
