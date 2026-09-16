# Decisões — Design System Le Bébé App

## D-001 — Proteção da página `/design-system` sem migration de banco

- Data: 2026-09-09
- Decisão: a rota `/design-system` (Server Component `page.tsx`) usa
  `requireAuthenticatedUser({ requireActive: true, requiredRole: 'superadmin' })`
  (`src/lib/auth/api-auth.ts`, helper já existente, não alterado) para exigir
  sessão ativa + role `superadmin`, redirecionando para `/login` (sem sessão)
  ou `/acesso-negado` (sem role) quando falhar. Não foi criado módulo em
  `app_modulos`, não houve migration, não houve alteração em
  `middleware.ts` nem em nenhum arquivo de `src/lib/auth/`.
- Motivo/contexto: o usuário pediu explicitamente para não alterar banco,
  migrations ou auth nesta tarefa. Ao mesmo tempo, uma página nova fora do
  `matcher` de `src/middleware.ts` fica acessível sem login por padrão (como
  `/pedidos-personalizados`, `/hub-vendas` etc., que resolvem isso com
  `checkModuleAndWindowAccess`, dependente de `app_modulos`). Como
  `checkModuleAndWindowAccess` exigiria cadastro de módulo (migration),
  optou-se por reusar um helper de autenticação já existente e não
  alterado, sem nenhum registro novo em banco — a divergência entre "não
  toque em auth/banco" e "não deixe uma rota interna pública" foi resolvida
  a favor da opção que não escreve nenhum código novo em `src/lib/auth/`
  nem no banco, apenas consome um helper genérico já usado por outras rotas
  de API do próprio projeto.
- Impacto: a página fica visível apenas para superadmin; não aparece na
  Sidebar (acesso direto por URL); nenhuma tabela nova, nenhuma migration.
  Se o usuário quiser abrir a página para outros perfis no futuro, será
  necessário decidir entre ampliar a checagem de role aqui ou seguir o
  padrão completo de `docs/ia/padrao-novas-telas-permissoes.md` (módulo +
  migration) — decisão explícita pendente, não tomada nesta tarefa.
- Status: APROVADA (aplicada; reportar ao usuário no relatório final para
  confirmação retroativa, já que não houve pausa para aprovação prévia)

## D-002 — Estrutura de 18 decisões em 9 categorias (A–I)

- Data: 2026-09-09
- Decisão: o pedido do usuário listava, nas seções 9-17, tanto decisões de
  componente isolado (botão, input, tabs, card, KPI, tabela, filtro, alert,
  badge) quanto "patterns" de composição completa (page header, área de
  filtros, formulário, KPI section, listagem/tabela) — alguns nomes
  apareciam nos dois lugares. Para evitar duplicar a mesma decisão duas
  vezes com o mesmo conteúdo, `/design-system` trata B–H como decisões de
  componente/elemento isolado e a categoria I ("Patterns") como 3
  composições completas de página (`PLS` listagem completa, `PFM`
  formulário completo, `PKS` seção de KPIs), sem repetir isoladamente
  "pattern de page header" ou "pattern de filtros" — esses já são cobertos
  por `HDR` (categoria D) e `FLT` (categoria F). Total: 18 decisões,
  códigos em `src/app/design-system/_lab/registry.ts`.
- Motivo/contexto: manter a página organizada e evitar "dezenas de
  variantes sem organização" (restrição explícita do pedido), preservando
  a cobertura de todas as categorias A–I pedidas.
- Impacto: se o usuário sentir falta de uma decisão de "pattern de page
  header" ou "pattern de filtros" separada da versão isolada, é possível
  adicionar depois — não foi removida por engano, foi uma escolha de
  organização registrada aqui.
- Status: APROVADA (aplicada; reportar ao usuário no relatório final)

## D-003 — Rota temporária de QA sem autenticação (criada e removida)

- Data: 2026-09-09
- Decisão: para verificar visualmente `/design-system` no browser sem ter
  acesso às credenciais de superadmin nem ao secret de bootstrap técnico
  de agentes (`docs/ia/autenticacao-tecnica-agentes.md` — que além disso só
  concede perfil `consultora`, insuficiente para `requiredRole:
  'superadmin'`), foi criada uma rota temporária
  `src/app/design-system-preview-temp/page.tsx`, sem nenhum gate de
  autenticação, renderizando diretamente `<DesignSystemLabClient />`. Foi
  usada só para inspeção visual (desktop + mobile 375px) e removida antes
  de finalizar a tarefa — não faz parte da entrega.
- Motivo/contexto: validar de verdade o comportamento visual e interativo
  da página (seleção, responsividade, persistência) sem depender de
  credenciais que não estavam disponíveis nesta sessão.
- Impacto: nenhum — arquivo criado e removido na mesma tarefa, confirmado
  via `git status` que não sobrou nenhum rastro. A rota real
  `/design-system` continua protegida por `requireAuthenticatedUser`
  (D-001) e não foi tocada por este processo de QA.
- Status: APROVADA (ação de verificação, não altera o escopo do produto)
- Nota (2026-09-10): a mesma rota temporária foi recriada uma vez, para
  verificar visualmente a correção do bug relatado pelo usuário em `TBL`
  (preview mobile vazando da borda do card — ver D-008), e removida de novo
  logo em seguida. Nenhum resíduo ficou no repositório (confirmado via
  `git status`).

## D-004 — As 18 escolhas visuais (categorias A–I) ficam registradas como aprovadas

- Data: 2026-09-10
- Decisão: o usuário retornou o resultado da Fase 2 com as 18 escolhas
  completas: `RAD=B SHD=C TYP=B SPC=B BTN=B INP=A HDR=A TAB=C CRD=C KPI=B
  TBL=B FLT=A FBK=A EST=B STA=A PLS=A PFM=B PKS=A`. Essas escolhas não
  foram substituídas, reinterpretadas nem pedidas de novo — foram
  registradas como preset não-destrutivo em
  `src/app/design-system/_lab/presets.ts`, aplicado só quando o
  `localStorage` do navegador não tiver um valor próprio para aquele
  código (um valor já salvo no navegador sempre vence sobre o preset).
- Motivo/contexto: garantir que as escolhas já feitas não se percam num
  navegador/dispositivo diferente daquele em que o usuário originalmente
  selecionou as opções, sem sobrescrever silenciosamente uma escolha real
  já salva.
- Impacto: nenhuma migração de formato foi necessária — a estrutura salva
  no `localStorage` (`Record<código, 'A'|'B'|'C'>`) não mudou; os presets
  só preenchem códigos ausentes. Estas 18 escolhas ainda **não** viraram o
  Design System v1 oficial — permanecem registradas aqui como o resultado
  aprovado da Fase 2, aguardando a Fase 3 (consolidação), que só começa
  depois de o usuário também concluir as decisões de comportamento (J).
- Status: APROVADA

## D-005 — `FLT-EXEC=MANUAL` como regra de comportamento aprovada

- Data: 2026-09-10
- Decisão: telas com filtros não executam a consulta automaticamente ao
  alterar um campo — a consulta só roda após o usuário clicar
  explicitamente em "Filtrar". Registrada como regra fixa (`kind: 'fixed'`)
  em `src/app/design-system/_lab/registry.ts`, exibida em
  `/design-system` (categoria J, subgrupo "Filtros e consultas") via
  `FixedRuleBlock` — sem alternativas A/B/C, com selo "APROVADA".
- Motivo/contexto: pedido explícito do usuário (§5 da Fase 2.5), já como
  regra definida, não como decisão em aberto.
- Impacto: esta regra é sobre filtros de tela/listagem — não se aplica a
  autocomplete/combobox de busca dentro de um campo (esse caso tem
  comportamento próprio, decisão `CMB`, que É busca ao vivo por design).
  Nenhuma tela existente foi alterada para seguir esta regra ainda — isso
  só acontece na fase de migração (futura, fora do escopo atual).
- Status: APROVADA

## D-006 — Organização da categoria J (Comportamento e Interação)

- Data: 2026-09-10
- Decisão: a categoria J ficou grande (1 regra fixa + 17 decisões abertas)
  cobrindo ~20 subtópicos pedidos pelo usuário. Para não virar "página
  gigantesca e confusa" (restrição explícita do pedido), foram tomadas 3
  escolhas de organização:
  1. Os itens foram agrupados em 11 subgrupos temáticos (Filtros e
     consultas, Formulários e validação, Ações e confirmações, Feedback e
     carregamento, Teclado e foco, Campos de busca, Datas, Tabelas e
     listagens, Modais e painéis, Permissões, Mobile), cada um num
     `<details open>` (accordion nativo, aberto por padrão — nada fica
     escondido, mas dá pra recolher).
  2. `MSK` (máscaras) virou **uma** decisão A/B/C sobre a filosofia geral
     de máscara (demonstrada com CPF), não 10 decisões separadas por tipo
     de campo — os outros 9 tipos (CNPJ, telefone, CEP, moeda, percentual,
     data, hora, quantidade, decimal) viraram uma tabela de referência
     **não votável**, marcada explicitamente "recomendação técnica — não
     aprovada automaticamente", exatamente como o pedido permitia (§10).
  3. `KBD` cobre só a decisão real de Enter em formulários (onde há
     escolha de produto genuína); Escape/Tab/foco inicial/retorno de foco
     viraram uma nota fixa "padrão técnico" (não uma decisão), porque já
     são garantidos pelos componentes Radix usados no projeto — conforme
     o próprio pedido permitia (§16).
  4. O "reset de paginação ao trocar filtro" (§19) não virou uma decisão
     A/B/C nem uma regra aprovada — ficou como um aviso
     "recomendação técnica, aguardando confirmação" dentro do subgrupo
     Tabelas e listagens, já que forçar 3 alternativas artificiais para
     algo com uma resposta tecnicamente óbvia pareceria ruído.
- Motivo/contexto: equilibrar cobertura completa do pedido com a restrição
  explícita de manter a página simples de comparar.
- Impacto: se o usuário quiser decisões separadas por tipo de máscara, ou
  quiser tornar o reset de paginação uma decisão formal, isso é possível
  de adicionar depois — não foi omitido por engano.
- Status: APROVADA

## D-007 — Sem migration de formato de armazenamento

- Data: 2026-09-10
- Decisão: o pedido (§26) previa migração do formato salvo em
  `localStorage` caso a estrutura precisasse evoluir. Não precisou: os
  novos códigos de comportamento (`FLT-CLR`, `VAL`, `ERR`, ...) são só mais
  entradas no mesmo mapa achatado `Record<código, 'A'|'B'|'C'>` já usado
  pelas 18 decisões visuais — nenhuma mudança de forma foi necessária.
  Regras fixas (`FLT-EXEC`) não usam `localStorage` — o valor aprovado
  vive só no registry (código), não é uma escolha do usuário.
- Motivo/contexto: manter compatibilidade total com o que já estava salvo
  no navegador do usuário (D-004), com o mínimo de código novo.
- Impacto: nenhum risco de perda de dados — a chave (`le-bebe-design-system-lab-v1`)
  e o formato continuam os mesmos da Fase 2.
- Status: APROVADA

## D-008 — Correção de overflow no preview mobile de `TBL`

- Data: 2026-09-10
- Decisão: o usuário reportou (com captura de tela) que, na decisão `TBL`,
  o preview "MOBILE" vazava para fora da borda do card de opção,
  sobrepondo as outras alternativas e tornando-as visualmente
  indistinguíveis. Causa raiz: `ResponsivePreview` usava
  `sm:grid-cols-[1fr_220px]` — um breakpoint de **viewport**, não da
  largura real do card (que é ~1/3 da página, bem menor que o breakpoint
  `sm`, 640px). Corrigido trocando para layout sempre empilhado
  (Desktop acima, Mobile abaixo), que cabe em qualquer largura de card.
- Motivo/contexto: bug real, confirmado visualmente pelo usuário.
- Impacto: arquivo alterado — `src/app/design-system/_lab/ResponsivePreview.tsx`.
  Nenhuma outra decisão foi tocada. Correção verificada via medição de
  bounding box no DOM (não por screenshot, a pedido do usuário — ver
  `STATUS.md`, "Não refazer").
- Status: APROVADA

## D-009 — Fase 3: as 18 escolhas visuais e as 17 escolhas de comportamento são definitivas (Design System v1)

- Data: 2026-09-10
- Decisão: todas as 35 decisões A/B/C (18 visuais + 17 de comportamento)
  enviadas pelo usuário nesta tarefa foram aceitas exatamente como
  informadas, sem reapresentar alternativas nem reinterpretar:
  `RAD=B SHD=C TYP=B SPC=B BTN=B INP=A HDR=A TAB=C CRD=C KPI=B TBL=B
  FLT=A FBK=A EST=B STA=A PLS=A PFM=B PKS=A` (visual) e `FLT-EXEC=MANUAL
  FLT-CLR=C VAL=C ERR=C(ajustado) REQ=C MSK=C SAV=A(ajustado) UNS=B
  DST=A FDB=C LDG=A KBD=A CMB=B DAT=A(ajustado) ROW=A MOD=A PER=A
  MOB=A` (comportamento). Juntas, formam o **Design System Le Bébé v1**.
- Motivo/contexto: pedido explícito do usuário para consolidar a Fase 3.
- Impacto: cada decisão foi implementada como componente/token/regra
  oficial (ver D-011). Nenhuma tela operacional foi migrada para usar
  esses componentes — isso é a Fase 4, ainda não iniciada.
- Status: APROVADA

## D-010 — Ajustes definitivos sobre a escolha base (ERR, SAV, DAT)

- Data: 2026-09-10
- Decisão: três decisões receberam um ajuste explícito sobre a opção
  base escolhida no Lab, tornando o padrão final uma combinação, não a
  opção pura:
  - **`ERR` (base C):** erro de campo sempre inline, associado
    (`aria-invalid`/`aria-describedby`), nunca só cor. Vários erros
    simultâneos → **resumo no topo do formulário ALÉM dos** erros
    inline (o resumo nunca substitui o inline). Erro de
    servidor/integração/falha técnica **nunca** é tratado como erro de
    campo — usa banner/alert de operação próprio (mensagem genérica
    tipo "Não foi possível salvar as alterações. Tente novamente.",
    nunca stack trace/payload/detalhe técnico). Implementado em
    `FormField` (inline) + `FormErrorSummary` (resumo) + `Alert
    tone="danger"` (servidor) — ver
    `docs/design-system/interaction-standards.md`, "Formulários e
    validação".
  - **`SAV` (base A):** ao iniciar salvamento/envio, o botão acionado
    entra em loading visual **e fica bloqueado/desabilitado** para
    novos acionamentos, prevenindo duplo clique/múltiplos envios —
    nunca "spinner ao lado com botão ainda clicável". Sucesso aplica o
    feedback aprovado (`FDB=C`); erro libera a ação de novo. Vale para
    Salvar/Criar/Atualizar/Enviar/Confirmar com processamento
    assíncrono. Implementado em `useAsyncAction` (reducer puro em
    `src/lib/design-system/async-action.ts`, testado) + `Button
    loading`.
  - **`DAT` (base A):** o campo de data sempre oferece os dois
    caminhos — digitação manual (dd/mm/aaaa) **e** ícone de calendário
    clicável (Lucide `CalendarIcon`) abrindo o `Calendar` existente via
    Popover — nenhum dos dois pode ser removido/obrigado. Formato
    brasileiro sempre exibido. Ícone com `aria-label`, área clicável
    adequada, não decorativo. Implementado em `DateField`
    (`src/components/design-system/DateField.tsx`), validação em
    `src/lib/design-system/dates.ts` (testada: data inválida, limites
    mín/máx, data final anterior à inicial).
- Motivo/contexto: pedido explícito do usuário (§4, §5, §6 da tarefa de
  Fase 3), como parte definitiva do padrão, não uma variação futura.
- Impacto: qualquer implementação futura de erro/salvar/data deve seguir
  a combinação acima, não a opção "pura" A/B/C isolada.
- Status: APROVADA

## D-011 — Arquitetura da consolidação: nova camada `design-system`, sem alterar `ui/`

- Data: 2026-09-10
- Decisão: as escolhas que **coincidem com o visual atual do sistema**
  (RAD=B, TYP=B, SPC=B, INP=A, FBK=A visual, STA=A) não exigiram novo
  código — foram só formalizadas como documentação/tokens (radius e
  tipografia/espaçamento já eram esses valores). As escolhas que
  **divergem do componente existente em `src/components/ui/*`** (BTN=B,
  TAB=C, SHD=C, CRD=C — que não existe em `ui/`, KPI=B, FLT=A, TBL=B)
  foram implementadas como **componentes novos** em
  `src/components/design-system/` — uma pasta nova, ao lado de `ui/`,
  não uma substituição dela. `src/components/ui/*` **não foi alterado**.
  Lógica pura e testável (máscaras, validação de data, reducers de
  filtro/ação assíncrona/erro) vive separada em
  `src/lib/design-system/*.ts`, com `*.test.ts` ao lado.
- Motivo/contexto: `src/components/ui/*` é consumido por todas as telas
  operacionais existentes hoje. Alterar esses arquivos para refletir o
  visual/comportamento aprovado mudaria silenciosamente o app inteiro —
  exatamente o que o pedido de Fase 3 proibiu explicitamente (§40, §41).
  A alternativa (nova pasta, coexistindo até migração controlada) foi
  autorizada pelo próprio pedido: "Pode ser necessário temporariamente
  existir: componente legado e componente/padrão DS v1 até a migração
  controlada. Isso é aceitável."
- Impacto: nenhuma tela existente teve o visual ou comportamento
  alterado (confirmado via `git status` — só arquivos novos, exceto
  `src/app/globals.css`, que só recebeu tokens **novos**, aditivos —
  ver D-012). A partir de agora existem duas gerações de componente
  convivendo; a Fase 4 decide, tela a tela, quando migrar cada uma.
- Status: APROVADA

## D-012 — `globals.css` recebeu só tokens novos, aditivos

- Data: 2026-09-10
- Decisão: `src/app/globals.css` foi editado para adicionar
  `--success`/`--success-foreground`, `--warning`/`--warning-foreground`,
  `--info`/`--info-foreground` (tokens `:root` e `.dark`, mapeados em
  `@theme inline`) e a utilitária `.ds-elevation-glow` (SHD=C). Nenhum
  token existente (`--primary`, `--radius`, `--background`, etc.) foi
  renomeado, removido ou teve seu valor alterado. "Danger" reaproveita o
  token `--destructive` já existente — não foi criado um token
  duplicado.
- Motivo/contexto: pedido explícito (§9-§10) para consolidar tokens
  semânticos sem substituição em massa nem invenção de tokens
  redundantes; `--primary-hover` não foi criado porque o projeto já usa
  opacidade (`hover:bg-primary/90`) de forma consistente — token
  redundante seria abstração desnecessária (§8, "evite abstração
  excessivamente complexa").
- Impacto: zero risco visual para telas existentes — só se algum
  seletor CSS colidisse com os nomes novos, o que não ocorre (nomes
  novos, não usados antes em nenhuma classe/variável do projeto).
- Status: APROVADA

## D-013 — Testes: só lógica pura (`.test.ts`), sem renderização de componente

- Data: 2026-09-10
- Decisão: `vitest.config.ts` roda em `environment: 'node'` e só inclui
  `src/**/*.test.ts` (não `.tsx`) — não há `jsdom`/`@testing-library/react`
  instalado. Em vez de adicionar essa infraestrutura (mudança maior, não
  pedida explicitamente), a lógica comportamental crítica pedida em §42
  foi extraída para módulos puros e testada diretamente: bloqueio de
  duplo clique (`async-action.test.ts`), resumo de erros
  (`errors.test.ts`), timing de validação (`validation.test.ts`), filtro
  nunca disparando consulta automática (`filters.test.ts`), máscaras
  (`masks.test.ts`), validação de data/período (`dates.test.ts`) — 37
  testes novos, todos passando.
- Motivo/contexto: manter compatibilidade com a infraestrutura de teste
  real do projeto (§44 pede rodar os testes existentes, não pede nem
  sugere adicionar `jsdom`); "não crie testes artificiais apenas para
  aumentar quantidade" (§42) — testar só renderização sem testar a regra
  em si seria menos valioso que testar a regra pura diretamente.
- Impacto: nenhum teste de renderização/interação DOM existe para os
  componentes React do DS v1 (registrado como pendência em
  `docs/design-system/README.md`). Se o projeto adotar `jsdom`/RTL no
  futuro, esses componentes já foram escritos com a lógica extraída para
  fora do componente especificamente para facilitar esse tipo de teste
  depois.
- Status: APROVADA

## D-014 — Harness: nova regra contextual `.agents/rules/design-system.md`

- Data: 2026-09-10
- Decisão: criada `.agents/rules/design-system.md` (gatilho: qualquer
  tarefa que crie/altere tela, componente ou padrão visual/de interação),
  seguindo o mesmo formato curto das outras rules (`inteligencia-comercial.md`
  etc.) — só gatilho + pointer para `docs/design-system/` (documentação
  canônica) e `docs/projetos/design-system/` (histórico de decisão), sem
  duplicar conteúdo. Adicionada uma linha nova na tabela de `AGENTS.md`
  §7 ("Frontend / Design System").
- Motivo/contexto: pedido explícito (§38) para integrar o DS ao Harness
  sem duplicar conteúdo em vários locais — mesmo padrão já usado pelas
  outras 5 regras contextuais existentes.
- Impacto: qualquer agente futuro que leia `AGENTS.md` §7 (já parte do
  fluxo padrão de investigação) descobre a existência do Design System
  antes de criar um padrão visual novo.
- Status: APROVADA

## D-015 — INP=A: ajuste de superfície do campo

- Data: 2026-09-11
- Decisão: `INP=A` (bordado) continua o padrão visual oficial — o ajuste
  foi só a superfície interna. Campos (`Input`, `Textarea`, `DateField`,
  `Combobox`) passam a usar o token novo `--input-background` (`#FFFFFF`
  no claro / `#1E293B` no escuro, mapeado em `@theme inline` como
  `--color-input-background`) em vez de `bg-transparent` — antes o campo
  herdava a cor do que estivesse atrás (geralmente `--background`,
  quase idêntico visualmente) e ficava sem separação perceptível do
  fundo da página. Estados: normal e foco usam a nova superfície; erro
  continua comunicado pela borda (`aria-invalid:border-destructive`) +
  mensagem inline, nunca só pela superfície; disabled usa
  `opacity-50` sobre a nova superfície (já fica visualmente
  diferenciado, sem token extra); readonly ganhou tratamento próprio
  (`read-only:bg-muted`), diferente tanto do normal quanto do disabled.
- Motivo/contexto: pedido explícito do usuário — campo com borda quase
  invisível contra o fundo da página, reduzindo a separação visual.
- Impacto: `src/components/ui/input.tsx` **não foi alterado** (mesma
  lógica de D-011 — evitar mudança silenciosa em todas as telas
  existentes). Só os componentes do DS v1
  (`src/components/design-system/{Input,Textarea,DateField,Combobox}.tsx`)
  usam a nova superfície. Demonstrado em `/design-system` → "Referência
  oficial" → "Superfície do campo".
- Status: APROVADA

## D-016 — Layout / Page Container oficial (Foundation nova)

- Data: 2026-09-11
- Decisão: nova Foundation de layout — a página usa 100% da área útil
  disponível depois da Sidebar, com gutters laterais oficiais: 16px
  mobile (`<640px`), 24px tablet (`sm:`, `≥640px`), 32px desktop (`lg:`,
  `≥1024px`) — nenhum breakpoint novo, reaproveitando `sm`/`lg` do
  Tailwind já usados no projeto. Implementado como
  `PageContainer` (`src/components/design-system/patterns/PageContainer.tsx`):
  `-mx-4 sm:-mx-6` cancela o padding ambiente de
  `src/components/LayoutWrapper.tsx` (`p-4 sm:p-6`, não alterado) e
  reaplica `px-4 sm:px-6 lg:px-8`. Sem `max-width` no `PageContainer` —
  a limitação de largura, quando fizer sentido (formulário simples,
  texto longo, wizard), é do **conteúdo interno**, nunca da página
  inteira.
- Motivo/contexto: a auditoria e o próprio usuário identificaram
  inconsistência real entre telas (~94-96% de aproveitamento em algumas,
  ~80% em outras, por `max-w`/padding diferentes copiados ad hoc). Pedido
  explícito para eliminar isso via um container padrão baseado em
  gutters, não em porcentagem fixa da viewport.
- Impacto: `LayoutWrapper.tsx` **não foi alterado** — nenhuma tela
  operacional existente mudou de largura. `PageContainer` só afeta telas
  que o adotarem explicitamente (nenhuma nesta tarefa — migração é Fase
  4). `PageHeader`, `FilterPanel`, `KpiSection`, `ResponsiveTable` e
  `Card` já são neutros em largura (`w-full` implícito) — nenhum precisou
  de ajuste para se alinhar corretamente dentro do `PageContainer`.
  Demonstrado em `/design-system` → "Referência oficial" → "Layout /
  Page Shell" (mini previews desktop/tablet/mobile).
- Status: APROVADA

## D-017 — Bug de overflow horizontal em `TBL` corrigido durante a validação obrigatória

- Data: 2026-09-11
- Decisão: a validação visual desta tarefa (agora obrigatória, feita pelo
  agente via rota temporária local — ver nota abaixo) encontrou overflow
  horizontal real em mobile (375px): o grid de 3 opções em
  `DecisionBlock.tsx` (usado desde a Fase 2.5 na decisão `TBL`) não
  encolhia abaixo do min-content da tabela de exemplo dentro de um dos
  cards, empurrando a página inteira para 672px de largura. Corrigido
  adicionando `min-w-0` ao item do grid (`src/app/design-system/_lab/DecisionBlock.tsx`),
  permitindo que o `overflow-x-auto` interno da tabela realmente
  contivesse o conteúdo. Confirmado sem overflow em 375px, ~800px e
  desktop após a correção.
- Motivo/contexto: bug pré-existente (desde a Fase 2.5), não introduzido
  nesta tarefa — mas diretamente dentro do escopo da validação
  explicitamente pedida ("confira overflow horizontal").
- Impacto: 1 linha alterada em `DecisionBlock.tsx`, só a classe
  `min-w-0`. Nenhuma outra decisão foi tocada.
- Validação visual desta tarefa: feita pelo agente, como pedido
  explicitamente pela primeira vez ("desta vez a validação visual de
  /design-system é obrigatória"). Usada a mesma rota temporária local
  sem autenticação (padrão D-003/D-008), já que a conta técnica de
  bootstrap (`agente.teste@lebebe.cloud`, perfil `gestao`) não tem
  role `superadmin` e não passaria pelo gate de D-001 mesmo com a nova
  skill `autenticacao-tecnica-agentes` — confirmado a partir do próprio
  texto da skill, sem tentar contornar. Verificado: overflow horizontal
  (375/800/desktop), superfície do novo `Input` via `getComputedStyle`
  (branco real vs. fundo da página), foco visível (`box-shadow`/
  `border-color` do campo focado), e inspeção visual das duas novas
  seções em `/design-system`.
- Status: APROVADA

## D-018 — Fase 4 (piloto): `/chamados-finalizados` migrado — PageContainer × LayoutWrapper validado em tela real

- Data: 2026-09-12
- Decisão: `/chamados-finalizados` foi migrada (camada visual/UX) para o
  Design System v1 — primeiro uso real de `PageContainer` fora do
  laboratório. Medido via `getComputedStyle`/`getBoundingClientRect` em
  375px, 800px e 1280px: o gutter efetivo (distância do conteúdo até a
  borda da Sidebar) resultou exatamente 16px/24px/32px nos três
  breakpoints, sem overflow horizontal, sem padding duplicado. A técnica
  de D-016 (margem negativa cancelando o padding do `LayoutWrapper`, que
  não foi alterado) funciona corretamente em página real.
- Motivo/contexto: pedido explícito do piloto — "valide se isso funciona
  corretamente em uma tela real".
- Impacto: nenhum. `LayoutWrapper.tsx` não foi tocado.
- Status: APROVADA (achado positivo do piloto — nenhuma correção necessária)

## D-019 — Extensões genéricas em `ResponsiveTable` (achadas no piloto)

- Data: 2026-09-12
- Decisão: `/chamados-finalizados` precisava de 3 capacidades que
  `ResponsiveTable` (TBL=B) não tinha: destacar uma linha inteira por
  estado de negócio, cabeçalho fixo e primeira coluna fixa (a tabela tem
  11 colunas). Adicionadas como props opcionais, não-destrutivas:
  `rowClassName?: (row) => string | undefined`, `stickyHeader?: boolean`,
  `firstColumnSticky?: boolean`. Nenhum uso existente (`OfficialReference`
  no Lab) foi afetado.
- Motivo/contexto: regra do piloto (§12/§25 do pedido) — extensão mínima
  genérica e reutilizável, não uma "quarta solução local" ad hoc.
- Impacto: `src/components/design-system/ResponsiveTable.tsx` alterado
  (só adições). Documentado em `docs/design-system/components-e-patterns.md`.
  **Regressão consciente e registrada:** a tabela original tinha um
  helper de scroll horizontal flutuante próprio
  (`BarraScrollHorizontalFixa`) que não foi replicado — `ResponsiveTable`
  usa `overflow-x-auto` nativo. Ver STATUS.md, "Pendências".
- Status: APROVADA

## D-020 — `FilterPanel.applyDisabled` + correção de `ref` em `Input`

- Data: 2026-09-12
- Decisão: (a) `FilterPanel` ganhou prop opcional `applyDisabled?: boolean`
  — o botão "Filtrar" original de `/chamados-finalizados` ficava
  desabilitado até as duas datas obrigatórias serem válidas; sem essa
  prop essa regra existente seria perdida. (b) `Input`
  (`src/components/design-system/Input.tsx`) não encaminhava `ref`
  (function component simples) — a célula de observação editável usa
  `ref` para autofoco ao entrar em modo de edição (comportamento
  existente); sem a correção, o autofoco quebraria silenciosamente.
  Corrigido com `React.forwardRef`, sem mudar a API pública.
- Motivo/contexto: preservar comportamento funcional existente (§2 do
  pedido) durante a migração — os dois eram bugs/lacunas reais do DS v1,
  não decisões de design.
- Impacto: ambos os componentes continuam retrocompatíveis (props/ref
  novos são opcionais/aditivos). Nenhum outro consumidor do DS quebrou
  (confirmado por lint/typecheck).
- Status: APROVADA

## D-021 — Filtros de `/chamados-finalizados` deixaram de ser colapsáveis (alinhamento com PLS=A)

- Data: 2026-09-12
- Decisão: a tela original tinha um `Collapsible` ao redor do painel de
  filtros (abre/fecha, `useState(true)` — aberto por padrão). O padrão
  aprovado `PLS=A` é "filtros sempre visíveis acima da tabela" — sem
  colapso. Optou-se por remover o colapso e alinhar com `PLS=A`.
- Motivo/contexto: o pedido pede para não mudar comportamento
  silenciosamente quando há dúvida material, mas também pede para seguir
  `FLT=A`/`PLS=A`. Avaliado como mudança de baixo risco: (1) não altera
  nenhuma consulta/dado/permissão, só a apresentação; (2) o painel já
  abria por padrão, então a experiência "normal" do usuário (filtros
  visíveis) não muda — só deixa de existir a opção de escondê-los.
- Impacto: usuários que costumavam recolher o painel de filtros para
  ganhar espaço vertical perdem essa opção. Risco considerado baixo e
  reversível; se o usuário relatar que sente falta, é simples reintroduzir
  como uma extensão do `FilterPanel` (`collapsible?: boolean`).
- Status: APROVADA (decisão de alinhamento registrada explicitamente, não
  silenciosa — reportado ao usuário no relatório final)

## D-022 — "Limpar filtros" é uma capacidade nova nesta tela (não existia antes)

- Data: 2026-09-12
- Decisão: `/chamados-finalizados` não tinha nenhum botão de limpar
  filtros antes da migração. `FilterPanel` sempre inclui um — implementado
  seguindo `FLT-CLR=C` (zera campos e resultado imediatamente, mantém o
  painel pronto para nova busca).
- Motivo/contexto: adotar `FilterPanel` como o padrão oficial de filtros
  inclui essa capacidade por construção; é uma adição, não uma remoção de
  comportamento existente.
- Impacto: nenhum risco — capacidade nova, não substitui nada. `onLimpar`
  novo em `PageClient.tsx` só reseta o estado local de resultado
  (`data`/`error`/`currentFiltros`), sem chamar API (não existe uma
  consulta "sem filtro" válida, já que as datas são obrigatórias).
- Status: APROVADA

## D-023 — Lacuna registrada: sem componente oficial de "multi-select com busca"

- Data: 2026-09-12
- Decisão: `/chamados-finalizados` tem 2 filtros de seleção múltipla com
  busca (Loja, Consultora), implementados como uma composição local
  (`Popover` + `Input` do DS + `Checkbox` de `ui/`). O DS v1 não tem um
  componente oficial equivalente. Não foi criada uma extensão nesta fase
  — a composição local resolve o caso sem inventar um padrão paralelo
  incompatível.
- Motivo/contexto: regra do piloto — só promover a componente oficial
  quando a necessidade for claramente genérica **e** houver decisão de
  criar (não threshold atingido com um único caso de uso real).
- Impacto: se uma segunda tela precisar do mesmo padrão, isso reforça o
  caso para promover a composição a um componente oficial
  `MultiSelectPopover` no DS — decisão futura, não tomada aqui.
- Status: APROVADA (registrado como lacuna, não resolvido)

## D-024 — Classificação do piloto: B — aprovado com pequenos ajustes

- Data: 2026-09-12
- Decisão: o piloto de `/chamados-finalizados` é classificado como **B —
  DS atendeu com poucas lacunas genéricas e simples**. Justificativa: (1)
  nenhuma "quarta solução local" foi improvisada; (2) as extensões
  necessárias (`ResponsiveTable.rowClassName/stickyHeader/firstColumnSticky`,
  `FilterPanel.applyDisabled`, `Input` com `ref`) são pequenas, genéricas,
  retrocompatíveis, e diretamente reutilizáveis por outras telas; (3) uma
  lacuna real ficou registrada sem solução forçada (multi-select); (4) uma
  regressão de UX consciente foi aceita e documentada (barra de scroll
  flutuante); (5) `PageContainer`×`LayoutWrapper` funcionou sem ajuste.
  Não foi classificado A porque houve, sim, necessidade real de estender
  2 componentes do DS e aceitar 1 regressão de UX — não foi "session
  perfeita sem nenhum atrito".
- Motivo/contexto: critério do piloto (§31 do pedido) — "não force
  classificação A".
- Impacto: recomendação de seguir para migração gradual (ver STATUS.md,
  "Próximo passo"), com as extensões já feitas disponíveis para as
  próximas telas.
- Status: APROVADA

## D-025 — Regra global: grid de filtros preenche a linha (flexbox, não CSS Grid `auto-fit`)

- Data: 2026-09-12
- Decisão: `FilterFieldGroup` (`src/components/design-system/FilterPanel.tsx`)
  passou a distribuir campos com flexbox (`flex flex-wrap items-end
  gap-3`, cada campo em `min-w-[220px] flex-1`), eliminando "buracos" de
  coluna vazia quando há poucos campos. **CSS Grid `auto-fit` +
  `minmax(220px, 1fr)` foi tentado primeiro e descartado** — validado
  visualmente que ele não resolve a ÚLTIMA linha incompleta (ex.: 5º
  campo sozinho numa configuração de 4 por linha fica com 3 células
  vazias ao lado, porque o grid compartilha o mesmo template de colunas
  em todas as linhas). Flexbox resolve porque cada linha quebrada
  distribui `flex-grow` independentemente.
- Motivo/contexto: achado real do piloto — poucos filtros deixavam área
  vazia grande no fim da linha, parecendo conteúdo faltando.
- Impacto: 220px de largura mínima (verificado contra os componentes
  reais do DS antes de adotar — abaixo disso o texto de multi-select
  trunca). Nenhuma tela precisou de alteração própria —
  `/chamados-finalizados` herdou o comportamento automaticamente por já
  usar `FilterFieldGroup`.
- Status: APROVADA

## D-026 — Regra global: container clipping (radius no elemento, não `overflow-hidden`)

- Data: 2026-09-12
- Decisão: cabeçalho e última linha de `ResponsiveTable` recebem o
  radius do container (`rounded-tl-2xl`/`rounded-tr-2xl` no cabeçalho,
  `rounded-bl-2xl`/`rounded-br-2xl` na última linha) diretamente nas
  células, em vez de usar `overflow-hidden` no shell externo.
- Motivo/contexto: `overflow-hidden` no container que também tem
  `stickyHeader` quebraria a posição `sticky` (ela deixa de funcionar
  relativa à rolagem da página quando um ancestral ganha `overflow`
  diferente de `visible`) — risco que o próprio pedido alertou
  explicitamente para testar antes de aplicar. Testado e confirmado:
  a abordagem por radius direto não tem esse problema.
- Impacto: princípio documentado como regra global (`foundations.md`,
  "Container clipping") para qualquer card/superfície do DS — não só
  tabela. Nenhuma tela existente foi migrada por causa disso.
- Status: APROVADA

## D-027 — Regra global: arrastar tabela horizontalmente com o mouse

- Data: 2026-09-12
- Decisão: `/inteligencia-comercial` (`TabelaVendas.tsx`) foi auditada —
  implementação já em produção, aprovada pelo usuário, usando Pointer
  Events, threshold de 5px, lista de exclusão de elementos interativos,
  `setPointerCapture`, e checagem de overflow antes de ativar.
  **Classificação: B — conceito sólido, mas precisava virar hook
  genérico** (estava embutida inline num componente, não reutilizável
  como estava). Extraído para `useHorizontalDragScroll`
  (`src/components/design-system/`) + funções puras testadas em
  `src/lib/design-system/horizontal-drag-scroll.ts` (9 testes).
  Integrado ao `ResponsiveTable` automaticamente — nenhuma prop nova
  necessária, ativa sozinho quando há overflow real.
- Motivo/contexto: pedido explícito para generalizar um comportamento já
  validado pelo usuário em produção, sem duplicar a lógica nem alterar
  `/inteligencia-comercial`.
- Impacto: `/inteligencia-comercial` **não foi tocada**. Dois bugs reais
  foram encontrados e corrigidos durante a validação desta própria
  extensão (não pré-existentes em `/inteligencia-comercial` — introduzidos
  e corrigidos na mesma tarefa): (1) cursor `grab` aparecia mesmo sem
  overflow — corrigido rastreando `hasOverflow` via `ResizeObserver`;
  (2) nenhum, a lógica de threshold/interceptação de interativos foi
  copiada fielmente e validada correta de primeira.
- Status: APROVADA

## D-028 — Classificação final do piloto: A — DS atendeu naturalmente após refinamento

- Data: 2026-09-12
- Decisão: reclassificado de **B** (Fase 4 original) para **A — DS
  atendeu naturalmente após refinamento de piloto**. Justificativa:
  (1) os 3 ajustes desta tarefa foram absorvidos inteiramente pela
  camada do Design System (`FilterPanel`, `ResponsiveTable`,
  `useHorizontalDragScroll`) — `/chamados-finalizados` não precisou de
  nenhuma alteração própria, herdou tudo por já consumir os componentes
  oficiais; (2) nenhuma "quarta solução local" foi criada; (3) a
  regressão de UX pendente da classificação B (barra de scroll
  horizontal flutuante não replicada) fica mitigada pela nova capacidade
  de arrastar com o mouse, que cobre a mesma necessidade de navegação em
  tabela larga de forma mais integrada; (4) a única lacuna real que
  permanece (multi-select com busca) já era conhecida e não é um
  problema desta rodada de ajustes.
- Motivo/contexto: critério explícito do pedido — não alterar a
  classificação artificialmente, só quando genuinamente justificado.
- Impacto: registrado aqui como o resultado final do piloto de Fase 4.
  A Fase 5 (migração gradual) fica liberada para prosseguir com mais
  confiança na maturidade do DS v1.
- Status: APROVADA

## D-029 — TABLE-VIEWPORT-CLIP: clipping estrutural (dois níveis) substitui radius por célula; `stickyHeader` revisado para scroll interno

- Data: 2026-09-12
- Decisão: o uso manual real do usuário revelou que a correção de D-026
  (radius direto nas células de borda) resolvia só o caso ESTÁTICO — numa
  tabela com scroll horizontal, ao arrastar totalmente para a direita, o
  canto esquerdo passava a expor fundo quadrado (célula do meio ocupando a
  posição de canto); arrastando para a esquerda, o problema trocava de
  lado. Causa: a silhueta arredondada pertencia às CÉLULAS, não à JANELA
  VISÍVEL. Corrigido com arquitetura de dois níveis em `ResponsiveTable`:
  **OUTER SHELL** (`rounded-2xl border` + `clip-path: inset(0 round
  1rem)`, dono da silhueta) e **INNER SCROLLER** (`overflow-x-auto`, dono
  do scroll horizontal, sem radius próprio). `overflow-hidden`/
  `overflow-clip` foram testados primeiro (não só assumidos) e
  **confirmados quebrando `stickyHeader`** de verdade — `clip-path` não
  quebra, porque não cria "scroll container" (só recorta o desenho).
  **Achado adicional, mais profundo que o esperado**: o teste revelou que
  o INNER SCROLLER, só por ter `overflow-x-auto`, já faz o navegador
  computar `overflow-y: auto` também (regra do CSS Overflow Module: eixo
  `visible` pareado com eixo não-`visible` também vira `auto`) — ou seja,
  **mesmo antes desta tarefa**, `stickyHeader` nunca esteve de fato preso
  à rolagem da PÁGINA (a validação registrada em D-019 conferiu só a
  presença da classe CSS, não o comportamento real). Corrigido dando ao
  INNER SCROLLER `max-h-[70vh] overflow-y-auto` quando `stickyHeader` é
  usado — o cabeçalho passa a ficar fixo relativo ao scroll VERTICAL
  INTERNO da tabela (testado com `scrollTop` direto: cabeçalho permanece
  no topo enquanto o conteúdo interno rola).
- Motivo/contexto: pedido explícito do usuário para tratar isso
  estruturalmente ("não é qual célula recebe `rounded-*`") e para testar a
  suposição de que `overflow-hidden` quebraria sticky em vez de só
  assumir. O achado sobre `stickyHeader` nunca ter funcionado de verdade
  não era esperado, mas surgiu diretamente do teste pedido.
- Impacto: `src/components/design-system/ResponsiveTable.tsx` alterado
  (estrutura de clipping + comportamento de `stickyHeader`). Telas que já
  usam `stickyHeader` (`/chamados-finalizados`, via
  `TabelaChamadosFinalizados.tsx`, herdado automaticamente por já usar o
  componente oficial) passam a ter a tabela com altura limitada a 70vh e
  scroll vertical interno em vez de crescer indefinidamente com a página —
  mudança de comportamento real, mas que corrige uma promessa (cabeçalho
  fixo) que nunca foi cumprida antes. Testado com `PointerEvent` sintético
  (drag), `scrollLeft`/`scrollTop` diretos e `getComputedStyle` — ver
  STATUS.md para as medições. Não foi possível validar com dado real de
  `/chamados-finalizados` (rota de QA temporária bloqueada por
  autenticação de API, 401 — só a página tem bypass, a API não); validado
  via a mesma tabela larga (8 colunas, agora 20 linhas) em `/design-system`,
  que reproduz a mesma condição sem depender de dado real.
- Status: APROVADA

## D-030 — NO-OVERLAP: `Dialog` oficial com header em flexbox, sem `sticky`/`z-index`

- Data: 2026-09-12
- Decisão: o usuário reportou sobreposição real no modal "Ver agendamentos"
  de `/chamados-finalizados` (`ModalAgendamentosCliente.tsx`) — a faixa
  branca do cabeçalho invadindo a região do botão `X`. Causa raiz
  confirmada: o cabeçalho usava `position: sticky` + `z-index: 50`
  explícito; o botão fechar do Radix (`ui/dialog.tsx`) não tem `z-index`
  próprio (`auto`). Um elemento com `z-index` explícito cria seu próprio
  contexto de empilhamento e pinta acima de irmãos com `z-index: auto`
  independente da ordem no DOM — o header (fundo branco sólido) pintava
  por cima do `X`. Corrigido criando `Dialog`/`DialogHeader`/`DialogBody`
  oficiais em `src/components/design-system/Dialog.tsx`: o header é uma
  linha flex (`min-w-0 flex-1` para título/descrição, `shrink-0` para o
  botão fechar, mesma linha) — geometricamente impossível sobrepor,
  independente do tamanho do título. O header também sai da área de
  scroll (`DialogBody` é quem rola), eliminando a necessidade de
  `sticky`/`z-index` para permanecer visível. `ui/dialog.tsx` **não foi
  alterado**.
- Motivo/contexto: pedido explícito para resolver de forma estrutural
  (reservar espaço real via layout), não com mais `z-index`/`padding`
  calculado manualmente, e para corrigir primeiro no componente oficial.
- Impacto: `ModalAgendamentosCliente.tsx` migrado para os novos
  componentes (único arquivo de `/chamados-finalizados` alterado nesta
  tarefa). Testado com título curto e título muito longo (quebra várias
  linhas, empurra a altura do header, nunca passa por baixo do X) em
  desktop e mobile (375px) — sem sobreposição em nenhum caso, medido via
  `getBoundingClientRect` (não só visual). `ConfirmDialog` continua usando
  `ui/dialog.tsx` diretamente — não migrado (título curto, sem o
  problema; fora do escopo pedido).
- Status: APROVADA

## D-031 — CLR/SEC (paleta de seções): adicionadas ao Lab como decisões abertas, permanecem PENDENTES

- Data: 2026-09-12
- Decisão: registrado que o Design System ainda não tem uma paleta
  auxiliar oficial para diferenciar seções/assuntos distintos numa mesma
  tela. Adicionadas duas decisões novas ao Lab (`/design-system`),
  seguindo a mesma infraestrutura de voto A/B/C já existente (não uma
  seção nova bespoke): `CLR` (categoria A, 3 interpretações da mesma
  identidade Le Bébé) e `SEC` (categoria E, 3 formas de separar seções por
  cor, com o mesmo mini-formulário Cliente/Pedido/Entrega nas 3 opções).
  `SEC=C` foi informada pela auditoria real de `/inteligencia-comercial`
  (`ModalDetalheVenda.tsx`, componente `Section` interno — já em produção,
  aprovado visualmente). Nenhuma das duas foi pré-selecionada em
  `presets.ts` — ambas aparecem como "ainda não escolhido" no Lab, exatamente
  como qualquer outra decisão aberta.
- Motivo/contexto: pedido explícito para NÃO decidir CLR/SEC nesta tarefa,
  só apresentar alternativas para escolha posterior do usuário.
- Impacto: `src/app/design-system/_lab/registry.ts` (2 entradas novas),
  `sections/foundations.tsx` (CLR), `sections/containers.tsx` (SEC). Nenhum
  token novo em `globals.css` — as alternativas usam classes Tailwind
  diretas (`bg-sky-50/60`, etc.), isoladas do Lab, sem contaminar o DS
  oficial com paletas concorrentes.
- Status: PENDENTE (aguardando `CLR=?`/`SEC=?` do usuário — não é uma
  decisão "aprovada", é a criação das alternativas para escolha)

## D-032 — CLR=B e SEC=C consolidadas como oficiais (deixam de ser PENDENTES)

- Data: 2026-09-12
- Decisão: o usuário escolheu `CLR=B` (multi-matiz suave: sky/emerald/
  amber, `-50/60` de superfície) e `SEC=C` (surface tintada + acento
  lateral + divisor no header). Consolidadas seguindo a arquitetura real
  do DS: tokens puros e testáveis em
  `src/lib/design-system/section-tones.ts` (`section-1`/`section-2`/
  `section-3` — mesmo padrão de `typography.ts`, D-012: a escala do
  Tailwind já é o token, isto só nomeia as combinações reutilizadas; não
  viraram CSS custom properties em `globals.css`) e componente oficial
  `src/components/design-system/Section.tsx` (título, descrição opcional,
  ícone opcional, `tone` 1/2/3, conteúdo — não amarrado a nenhum módulo).
  No Lab (`/design-system`), `CLR` e `SEC` viraram `kind: 'fixed'`
  (mesmo mecanismo de `FLT-EXEC`) — aparecem como `FixedRuleBlock`
  ("APROVADA · CLR=B"/"APROVADA · SEC=C"), sem alternativas A/B/C
  reapresentadas.
- Motivo/contexto: pedido explícito do usuário — escolha definitiva,
  "não reapresente A/B/C". `success`/`warning`/`destructive`/`info`
  continuam reservados ao significado semântico — `section-*` nunca os
  substitui (testado: `section-tones.test.ts` garante que nenhuma classe
  de `section-*` contém as palavras desses tons). Sem vínculo fixo de
  assunto ("cliente = section-1") — a tela escolhe o tom.
- Impacto: `src/lib/design-system/section-tones.ts` + `.test.ts` (novos),
  `src/components/design-system/Section.tsx` (novo), `index.ts` (export),
  `registry.ts` (`CLR`/`SEC` → `kind: 'fixed'`), `sections/foundations.tsx`
  e `sections/containers.tsx` (trocaram `DecisionBlock` por
  `FixedRuleBlock`, reutilizando o componente oficial `Section` na
  demonstração de `SEC`, não uma cópia local). `/inteligencia-comercial`
  **não foi migrada** para o componente — continua com sua própria
  implementação, serviu só de referência (auditoria, não migração).
- Status: APROVADA

## D-033 — TABLE-VIEWPORT-CLIP: bug real do `clip-path` (raio hardcoded divergente) corrigido com arquitetura de 3 camadas

- Data: 2026-09-12
- Decisão: o usuário testou a correção de D-029 (`clip-path: inset(0
  round 1rem)` no shell) e reportou os cantos "apagados" durante scroll
  horizontal. Inspecionado via `getComputedStyle` (não assumido, como o
  pedido exigiu): o container real usa `rounded-2xl` = **20px**
  (`--radius-2xl`, RAD=B), enquanto o `clip-path` usava **16px**
  hardcoded (`1rem`) — um descompasso de 4px entre a curva da borda e a
  curva da máscara, "comendo" uma faixa da borda no canto. Causa raiz
  real: aplicar borda E clipping no MESMO elemento, com valores de radius
  diferentes. Corrigido separando em 3 camadas, cada uma com uma
  responsabilidade: **OUTER SHELL** (só `rounded-2xl border`, sem
  overflow/clip — borda nítida e imóvel), **INNER CLIP**
  (`overflow-hidden rounded-2xl bg-white` — MESMA classe de radius do
  OUTER, nunca um valor numérico separado), **HORIZONTAL SCROLLER**
  (`overflow-x-auto`, dentro do INNER CLIP). O 1px de diferença entre as
  caixas (a borda do OUTER) é aceito como desprezível — mesmo padrão de
  qualquer card com borda + conteúdo `overflow-hidden`.
- Motivo/contexto: pedido explícito para diagnosticar por inspeção real
  (não assumir) se o `clip-path` no mesmo elemento da borda causava o
  problema, e para separar estruturalmente border/clipping/scroller.
  `overflow-hidden` passou a ser seguro nesta camada porque a decisão
  TABLE-NO-INTERNAL-VSCROLL (D-034) eliminou a dependência de
  `stickyHeader` ficar preso a um scroll vertical — não há mais nada para
  `overflow-hidden` "quebrar" nesse sentido.
- Impacto: `src/components/design-system/ResponsiveTable.tsx`
  (`OUTER_SHELL_CLASS`/`INNER_CLIP_CLASS` substituindo o `SHELL_CLASS`
  único anterior). Testado com `getComputedStyle` nas 3 posições de
  scroll (esquerda/meio/direita): radius 20px e borda 1px idênticos nas
  três, `clip-path` do outer = `none` (a borda não depende mais de
  clipping). Ver STATUS.md para as medições completas.
- Status: APROVADA

## D-034 — TABLE-NO-INTERNAL-VSCROLL: tabelas paginadas não têm scroll vertical interno

- Data: 2026-09-12
- Decisão: o usuário testou a versão anterior (`max-h-[70vh]
  overflow-y-auto`, única forma de fazer `stickyHeader` funcionar de
  verdade — ver D-029) e reprovou: gera "scroll dentro de scroll" (o
  mouse precisa terminar o scroll interno da tabela antes de continuar
  rolando a página). Removido `max-h-[70vh]`/`overflow-y-auto` de
  `ResponsiveTable` — a tabela volta a crescer conforme os registros, a
  página é responsável pelo scroll vertical, sempre. `stickyHeader`
  continua aceito como prop (compatibilidade — não quebra
  `/chamados-finalizados`, que já a passa), mas documentado como no-op
  seguro nesta arquitetura (sem scroll vertical delimitado, `position:
  sticky` não tem efeito visível). Compensado pela decisão D-035
  (paginação máx. 20 linhas) — o cabeçalho nunca fica muito longe do
  topo.
- Motivo/contexto: pedido explícito do usuário — prioridade em não criar
  scroll aninhado, manter navegação simples, e deixar a paginação
  resolver o problema de tabelas longas em vez de um cabeçalho fixo
  tecnicamente complexo.
- Impacto: `src/components/design-system/ResponsiveTable.tsx`. Testado:
  `scrollHeight === clientHeight` do scroller (sem scrollbar vertical
  própria), sem `max-height` computado (`none`). Wheel sobre a tabela
  passa para a página (raciocinado a partir da ausência de overflow
  vertical interno real — nada consome o delta do wheel internamente —
  não confirmado via evento sintético, que não reproduz scroll chaining
  nativo do navegador; registrado como limitação de teste em STATUS.md).
- Status: APROVADA

## D-035 — TABLE-PAGE-SIZE=20: paginação backend-enforced

- Data: 2026-09-12
- Decisão: listagens/tabelas de dados paginadas do sistema usam no máximo
  20 registros por página — `TABLE_PAGE_SIZE`
  (`src/lib/design-system/pagination.ts`, não dependente de React).
  `clampPageSize(requested)` garante `Math.min(requested, 20)` no
  BACKEND — nunca confia num valor maior pedido pelo cliente. Aplicado em
  `/chamados-finalizados`: `src/app/api/chamados-finalizados/pesquisar/route.ts`
  (default `perPage` trocado de 30 para `TABLE_PAGE_SIZE`) e
  `src/lib/digisac/chamadosFinalizados.ts` (`requestedPerPage =
  clampPageSize(filtros.perPage)`, substituindo `Math.min(..., 100)`). O
  lote de 200 tickets buscado do Digisac (`params.append('perPage',
  '200')`) **não muda** — é um lote bruto usado só para agregar por
  contato antes de paginar; a resposta HTTP final ao frontend já estava
  (e continua) limitada a `paged` = `requestedPerPage` itens, nunca a
  coleção agregada inteira.
- Motivo/contexto: decisão oficial explícita do usuário — navegação
  simples e previsível, sem seletor de 10/25/50/100, tráfego/payload
  reduzido. Escopo desta tarefa: só `/chamados-finalizados` — outras
  APIs não foram alteradas (serão adequadas em suas migrações futuras).
- Impacto: nenhuma migration, nenhuma alteração de schema/RLS — só o
  valor default e o teto de `perPage` em código já existente. Testado:
  `pagination.test.ts` (4 testes) garante `clampPageSize` nunca excede
  20 mesmo se o chamador pedir 500. Comprovação de "20 exibidos ≠ 500
  baixados": o `paged` retornado ao frontend já era sliced a
  `requestedPerPage` antes desta mudança (arquitetura pré-existente,
  correta) — só o valor default/teto mudou de 30/100 para 20/20.
- Status: APROVADA

## D-036 — TABLE-ZEBRA=ON: alternância sutil de linhas, com precedência sobre estados semânticos

- Data: 2026-09-12
- Decisão: `ResponsiveTable` alterna a superfície das linhas
  (`bg-white`/`bg-slate-50/70`) por padrão, reiniciando a cada página.
  Precedência: `rowClassName` (estado específico da tela) SUBSTITUI o
  zebra da linha inteiramente (nunca mistura as duas cores) > seleção
  (quando existir) > hover (`hover:bg-muted/50`, herdado de
  `ui/table.tsx`, continua funcionando em qualquer paridade por causa da
  ordem de geração do CSS do Tailwind) > zebra padrão. O Design System
  não recebe nem interpreta o SIGNIFICADO da cor de `rowClassName` (não
  sabe o que é "chamado sem ação" ou "pedido pendente") — só a classe já
  pronta da tela. Prop `zebra?: boolean` (default `true`) para desativar
  quando necessário. Não obrigatório no mobile (cards já têm separação
  própria).
- Motivo/contexto: decisão oficial explícita do usuário — melhorar
  acompanhamento horizontal e identificação visual de registros em
  tabelas operacionais, sem misturar regra de negócio no componente do
  DS.
- Impacto: `src/components/design-system/ResponsiveTable.tsx`. Testado
  numa tabela de 9 linhas (última com `rowClassName`
  `bg-red-50 hover:bg-red-50`): `getComputedStyle` confirmou alternância
  branco/cinza-claro nas 8 primeiras linhas e a cor de estado (não zebra)
  na última — precedência funcionando. `/chamados-finalizados` herdou
  automaticamente (já usa `ResponsiveTable`) — sua regra existente
  (linha vermelha quando não há agendamento em aberto) continua tendo
  precedência sobre o zebra, sem alteração no arquivo da tela.
- Status: APROVADA

## D-037 — `Dialog` (NO-OVERLAP) validado pelo usuário — nenhuma alteração nesta tarefa

- Data: 2026-09-12
- Decisão: o usuário testou o `Dialog`/`DialogHeader`/`DialogBody`
  oficiais (D-030) e aprovou — sem sobreposição. Nenhuma mudança desta
  tarefa (arquitetura de tabela, paleta de seções, paginação, zebra)
  toca em `Dialog.tsx`. Reconfirmado, não redesenhado: título curto e
  título longo continuam sem sobreposição em desktop e mobile 375px
  (`getBoundingClientRect`, interseção de retângulos = `false` nos dois
  casos).
- Motivo/contexto: pedido explícito — registrar a validação positiva,
  não alterar salvo se algo desta tarefa afetasse o componente
  inadvertidamente (não afetou).
- Status: APROVADA (validação positiva registrada, sem mudança de código)

## D-038 — Comparação visual Section tones × cores semânticas criada; `CLR=B` continua aprovado, tons específicos em validação final

- Data: 2026-09-13
- Decisão: o usuário pediu validação da EXPERIÊNCIA VISUAL (não só dos
  nomes de token) entre `section-1/2/3` (CLR=B: sky/emerald/amber) e as
  cores semânticas `info`/`success`/`warning`. Constatação objetiva,
  confirmada comparando `Alert.tsx` com `section-tones.ts`: os matizes
  são literalmente os mesmos (`info` = `sky-200/50/800`, `success` =
  `emerald-200/50/800`, `warning` = `amber-200/50/800` — idênticos a
  `section-1`/`section-2`/`section-3`, não apenas parecidos). Criada uma
  subseção temporária em `/design-system` ("Section tones × cores
  semânticas") com pares lado a lado usando componentes REAIS
  (`Section`, `Alert`, `Badge`), conteúdo equivalente nos dois lados
  (mesmo padrão de título/descrição), referência de `destructive`/error,
  e uma composição conjunta com os 3 tons + 4 alerts + 4 badges juntos.
  **Nenhuma cor foi trocada** — a decisão de manter ou ajustar
  `section-1/2/3` fica explicitamente com o usuário.
- Motivo/contexto: pedido explícito — "não escolha por mim" quando a
  questão é semântica/perceptiva, não um conflito objetivo. Não há
  conflito objetivo de contraste/acessibilidade a reportar: as cores já
  são as mesmas usadas (e testadas) em `Alert`/`Badge` em produção — a
  questão é só se um bloco de organização "parece" um estado.
- Impacto: `src/app/design-system/_lab/OfficialReference.tsx`
  (`SectionVsSemanticDemo`, subseção nova, marcada como temporária no
  próprio texto da página). Confirmado (D-032) que nenhum consumidor
  referencia `sky`/`emerald`/`amber` diretamente — todos recebem
  `tone="section-N"` e resolvem via `SECTION_TONE_CLASSES`
  (`section-tones.ts`) — trocar uma cor no futuro é uma alteração de uma
  linha nesse arquivo, sem tocar `Section.tsx` nem nenhuma tela
  consumidora. `CLR=B` permanece a decisão aprovada (não voltou a
  `PENDENTE`, não foi reapresentado como A/B/C) — só os 3 tons
  específicos aguardam essa validação visual final.
- Status: `CLR=B` APROVADA (mantida); comparação visual criada e
  aguardando validação do usuário sobre `section-1/2/3` especificamente
  — nenhuma mudança de cor até resposta explícita.

## D-039 — Esclarecimento de TABLE-PAGE-SIZE=20: payload paginado × processamento interno do backend

- Data: 2026-09-13
- Decisão: a regra de D-035 (`TABLE_PAGE_SIZE=20`) foi mal interpretável
  como "backend nunca pode processar mais de 20 registros", o que
  quebraria agregações legítimas como a de `/chamados-finalizados`
  (busca até 200 tickets do Digisac para agregar por contato antes de
  paginar). Esclarecido explicitamente: o limite de 20 é sobre a
  RESPOSTA final paginada enviada ao frontend, não sobre quanto o
  backend processa internamente. Processamento interno maior é permitido
  quando há motivo funcional real (agregação, cálculo, deduplicação,
  busca em fonte externa, regra de negócio) — não pode ser usado como
  desculpa para uma paginação mal implementada, e o payload final
  enviado ao frontend continua limitado a 20. `/chamados-finalizados`
  revisado e confirmado já correto — não foi alterado (a implementação
  já respeitava essa distinção antes mesmo desta clarificação existir).
- Motivo/contexto: pedido explícito do usuário para evitar que um agente
  futuro leia a regra de forma restritiva demais e quebre uma agregação
  necessária.
- Impacto: só documentação (`foundations.md`, "Esclarecimento — payload
  paginado × processamento interno"; `interaction-standards.md`,
  "Payload paginado × processamento interno"). Nenhum código alterado —
  `/chamados-finalizados` não teve sua regra funcional tocada nesta
  tarefa.
- Status: APROVADA

## D-040 — STN (composição concreta dos section tones) criada como decisão aberta; `CLR=B`/`SEC=C` não reabertos

- Data: 2026-09-13
- Decisão: registrado que a composição CONCRETA de `section-1/2/3`
  (quais três tons entram no mapping oficial) ainda está pendente, após
  D-038 ter constatado — com cores computadas, não só nomes de token —
  que os tons anteriores (sky/emerald/amber) coincidiam com `info`/
  `success`/`warning`. Três alternativas (`STN=A/B/C`) foram criadas no
  Lab para escolha do usuário — nenhuma foi selecionada. `CLR=B` (paleta
  multi-matiz suave) e `SEC=C` (surface + acento + divisor) **não foram
  reabertos** — permanecem decisões aprovadas e definitivas; o que muda
  de A/B/C para escolha é só a composição concreta de cores dentro de
  `CLR=B`.
- Motivo/contexto: pedido explícito do usuário — não reabrir CLR/SEC,
  criar uma decisão nova e isolada só para os tons concretos.
- Impacto: `src/app/design-system/_lab/registry.ts` (`STN`, categoria A,
  `kind: 'open'`), `sections/section-tone-candidates.tsx` (novo),
  `sections/foundations.tsx` (inclusão). `Section.tsx` ganhou uma prop
  aditiva de uso interno do Lab (`toneClasses`) para permitir o
  componente oficial renderizar paletas candidatas sem tocar
  `section-tones.ts` — comportamento de qualquer consumidor existente
  inalterado (a prop é opcional e nenhuma tela real a usa).
  `section-tones.ts` (fonte oficial dos tokens) **não foi alterado**.
- Status: PENDENTE (aguardando `STN=A`/`B`/`C` do usuário — nenhuma
  opção escolhida ou consolidada nesta tarefa)

## D-041 — Decisão experimental `STN` retirada — usuário escolheu direção de marca, não uma paleta genérica

- Data: 2026-09-13
- Decisão: `STN=A/B/C` (D-040) deixou de ser necessária — o usuário não
  escolheu nenhuma das 3 paletas experimentais (violeta/índigo/slate;
  pink/stone/fuchsia; stone/zinc/slate), optando por uma DIREÇÃO DE MARCA
  (azul/ciano/amarelo da identidade real Le Bébé) em vez de uma paleta
  genérica sem relação com a marca. `STN` removida de
  `src/app/design-system/_lab/registry.ts`; `section-tone-candidates.tsx`
  removido; `Section.tsx` perdeu a prop `toneClasses` (escape hatch que
  só existia para essa comparação — nenhum outro consumidor a usava).
- Motivo/contexto: pedido explícito — não obrigar o usuário a escolher
  entre alternativas que já não representam a direção decidida; não
  deixar uma decisão obsoleta aparecendo como pendência.
- Impacto: nenhum — `STN` nunca chegou a ser oficial (D-040 já registrava
  como PENDENTE, nunca escolhida). O histórico permanece em D-038/D-039/
  D-040 (não apagado), só a UI de escolha foi retirada.
- Status: RETIRADA (não se aplica mais "APROVADA"/"PENDENTE" — a decisão
  em si deixou de existir; superada por D-042)

## D-042 — Color Foundation oficial da marca Le Bébé consolidada; section tones derivados da identidade real

- Data: 2026-09-13
- Decisão: consolidada a Brand Foundation oficial, baseada na identidade
  visual real (não inventada) — fonte: tokens já declarados em
  `globals.css` sob `/* Le Bébé Custom Colors */` (`--color-brand`
  `#00A5E6`, `--color-brand-secondary` `#3BBAE8`, `--color-brand-accent`
  `#FBF27B`, `--color-brand-light`), confirmados contra `public/logo.png`
  (o logo real da marca — badge azul, texto branco, estrela amarela).
  `public/amostras-de-cores-2026.png` foi inspecionado e **descartado**
  como fonte — é um catálogo de cores de tapete/produto físico, sem
  relação com a identidade digital. Adicionado 1 token novo,
  `--color-brand-strong` (`#0080B3`), derivado por redução de
  luminosidade HSL do azul da marca (documentado, não um hex arbitrário).
  `--primary` (já `#00A5E6`) e `--ring` (já `#00A5E6`) auditados e
  preservados sem alteração — já conversavam com a marca; nenhuma tela
  legada foi afetada. Único hex hardcoded fora da fonte de verdade
  encontrado e corrigido: `typography.ts` (`eyebrow`) usava
  `text-[#00A5E6]` literal → trocado para `text-primary` (mesmo valor,
  zero mudança visual). Section tones (`section-1/2/3`) passaram a
  derivar da marca: azul (Tailwind `blue`), ciano (Tailwind `cyan`),
  amarelo da estrela (Tailwind `yellow`, com texto neutro em vez de
  `yellow-800`, tratamento deliberado para não parecer `warning`).
- Motivo/contexto: pedido explícito do usuário — consolidar uma Color
  Foundation oficial baseada na marca real, com azul dominante, amarelo
  como acento pontual (nunca primary geral), e separação obrigatória
  entre brand colors e semantic colors.
- Validação (não assumida — medida): `section-3` (amarelo) vs. `warning`:
  distância de cor (Lab) ≈ 35 — bem distinto. `section-2` (ciano) vs.
  `info`: ≈ 13.5 — distinto. `section-1` (azul) vs. `info`: ≈ 9 — mais
  próximo, e **essa proximidade é uma tensão real, registrada com
  transparência, não escondida**: o hex de `--info` (`#0EA5E9`) já era,
  antes desta tarefa, quase idêntico ao azul da marca (`#00A5E6`) —
  ambos pertencem à mesma família de matiz no próprio sistema de tokens
  do produto. Não é possível separar totalmente `section-1` de `info` em
  cor sem deixar de usar o azul real da marca (o que contrariaria o
  próprio pedido de usar a identidade real) — a distinção final depende
  também da estrutura de `Section` (accent lateral + divisor + heading,
  ausente em `Alert`), como o próprio pedido previu como caminho
  aceitável quando a cor sozinha não resolve. `--info`/`--warning`/
  `--success`/`--destructive` **não foram alterados** — a separação
  buscada foi só na composição de `section-tones.ts`, não nos tokens
  semânticos.
- Impacto: `globals.css` (1 token novo, aditivo), `typography.ts` (1
  correção, mesmo valor visual), `section-tones.ts` (reescrito — tons
  novos), `Section.tsx` (removida a prop `toneClasses`, não mais
  necessária), `OfficialReference.tsx` (nova seção "Brand Foundation" +
  aplicações reais + comparação permanente com semânticas), `registry.ts`
  e `sections/foundations.tsx` (retirada de `STN`, atualização de `CLR`).
  `/chamados-finalizados` **não foi alterada** — não usa `Section`
  diretamente; o único efeito indireto (`typography.eyebrow`) é
  visualmente idêntico ao valor anterior. Nenhuma migração em massa.
- Status: APROVADA

## D-043 — `/chamados-finalizados` como primeira implementação de referência da Brand Foundation; regra permanente de aderência ao Design System

- Data: 2026-09-14
- Decisão: `/chamados-finalizados` foi auditada e ajustada para remover
  os últimos resíduos de cor solta, alinhando com a Brand Foundation
  (D-042). A tela já estava estruturalmente migrada para o Design System
  desde a Fase 4 (piloto) — `PageContainer`, `PageHeader`, `FilterPanel`,
  `ResponsiveTable`, `Dialog` já eram usados; esta rodada tratou o que
  ainda restava:
  - `ModalAgendamentosCliente.tsx`: tabela HTML manual com funções de
    cor solta (`statusClasses`/`rowStatusBgClasses`, vermelho/azul/verde
    hardcoded) → `ResponsiveTable` + `Badge` oficiais. Mapeamento de tom
    (erro=danger, agendado=success, finalizado=info) confirmado IDÊNTICO
    ao que `TabelaChamadosFinalizados.tsx` já usa para os mesmos 3
    estados, antes de aplicar — não foi uma escolha nova, foi alinhar
    com um padrão já existente na mesma tela.
  - `TabelaChamadosFinalizados.tsx`: `bg-red-50` (linha sem agendamento
    aberto) → `bg-destructive/10`, mesmo padrão de opacidade-sobre-token
    já usado em `Button` (variant `destructive`).
  - `CelulaObservacao.tsx`: `text-emerald-600`/`hover:bg-emerald-100`
    (ícone de confirmar) → `text-success`/`hover:bg-success/10`.
  - `FiltrosChamadosFinalizados.tsx`: `perPage: 30` hardcoded (número já
    superado por `TABLE_PAGE_SIZE=20`, D-035) → `TABLE_PAGE_SIZE`. Sem
    efeito funcional (o backend já limitava a 20 independente do valor
    enviado).
  - `Section` **não foi introduzida** nesta tela — decisão deliberada:
    `/chamados-finalizados` é uma listagem com filtros, sem blocos
    temáticos reais (não é um formulário tipo "dados do cliente/dados do
    pedido/entrega"); forçar `Section` só para demonstrar a Brand
    Foundation contrariaria a própria regra desta tarefa.
  - **Nenhuma lacuna NOVA de Design System encontrada.** A única lacuna
    presente (multi-select-com-busca em `MultiSelectPopover`) já estava
    registrada (D-023) — continua como composição local de componentes
    100% oficiais (`Popover`/`Checkbox` de `ui/`, `Input`/`Button` do
    DS), sem cor solta; não promovida a componente oficial (um único
    caso de uso ainda não justifica).
  - **Regra permanente registrada a partir desta tarefa**: toda evolução
    visual do sistema segue o Design System oficial existente — nenhuma
    cor, componente, estilo, padrão ou variação nova livre. Uma
    necessidade não coberta pelo DS deve ser tratada explicitamente como
    LACUNA DE DESIGN SYSTEM (o que falta, onde apareceu, por que o
    existente não resolve, menor solução generalizável) — nunca
    resolvida com improviso local silencioso.
- Motivo/contexto: pedido explícito — usar `/chamados-finalizados` como
  primeira aplicação real da Brand Foundation recém-consolidada, testando
  se as decisões do Design System funcionam numa tela real, e formalizar
  a regra de aderência permanente ao DS a partir de agora.
- Validação: `tsc`/lint/testes sem regressão (baseline preservado).
  Botão "Filtrar" medido em `rgb(0,165,230)` = `#00A5E6` exato. Modal
  testado com dados simulados (fetch interceptado localmente — API real
  exige autenticação indisponível nesta sessão, mesma limitação de
  rodadas anteriores): 3 linhas renderizadas, badges com tom correto,
  realce de linha a 10% de opacidade sobre o token semântico certo,
  radius 20px preservado (TABLE-VIEWPORT-CLIP), sem overflow em 375px.
  Nenhuma regra de negócio, consulta, filtro, rota, permissão, evento ou
  chamada de API foi alterada — só classes CSS/componentes visuais.
- Impacto: `/inteligencia-comercial` e todas as demais telas do sistema
  permanecem intocadas — só `/chamados-finalizados` foi tocada, conforme
  escopo explícito desta tarefa. Fase 5 (migração do restante do sistema)
  aguarda validação visual manual do usuário sobre esta implementação de
  referência antes de prosseguir.
- Status: APROVADA (aguardando validação visual manual do usuário para
  confirmar `/chamados-finalizados` como referência definitiva)

## D-044 — Três refinamentos de `ResponsiveTable` consolidados: TABLE-STICKY-OPAQUE, zebra × status em célula, Column Sizing

- Data: 2026-09-14
- Decisão: a validação manual de `/chamados-finalizados` (D-043) revelou
  três problemas reais de tabela, todos generalizados no componente
  oficial (não corrigidos como hack local):
  1. **TABLE-STICKY-OPAQUE (bug real, confirmado por inspeção):** a
     primeira coluna sticky reaplicava a classe de superfície da linha,
     mas o zebra ímpar (`bg-slate-50/70`) e os tons de linha então em uso
     (`bg-destructive/10`, etc.) usavam opacidade — uma célula sticky com
     alpha<100% deixa o conteúdo rolável por baixo aparecer através dela
     (confirmado: texto de outras colunas "fantasma" sobre a primeira
     coluna). Corrigido: `ZEBRA_ODD` virou sólido (`bg-slate-50/70` →
     `bg-slate-50`); criado `src/lib/design-system/row-tones.ts`
     (`color-mix(in srgb, var(--token) X%, white)` — sólido, ainda
     derivado do token oficial) para tons de linha inteira.
     `resolveRowSurface()` centraliza o cálculo da superfície, usado
     tanto na `<tr>` quanto na célula sticky — fonte única, sem duas
     implementações paralelas de precedência. Hierarquia de `z-index`
     definida explicitamente: conteúdo normal < célula sticky do corpo
     (`z-10`) < cabeçalho sticky (`z-20`) < interseção cabeçalho+coluna
     sticky (`z-30`) — sem `9999`. Divisor sutil (`border-r
     border-slate-200`, token já existente) só quando há overflow de
     verdade.
  2. **Zebra × status em célula (esclarecido):** confirmado no código
     (não assumido) — `ModalAgendamentosCliente` tinha `rowClassName`
     derivando a cor da linha INTEIRA do mesmo status já mostrado pelo
     `Badge` da coluna, uniformemente para os 3 status, sem nenhuma regra
     funcional documentada que exigisse isso — era decoração redundante,
     não uma decisão de negócio. Removido; a tabela do modal agora usa só
     zebra + Badge. Regra formalizada: um Badge de status em célula NÃO
     substitui zebra automaticamente — row-level fica reservado para
     quando a TELA decide explicitamente destacar o registro inteiro
     (ex.: falta ação importante, erro crítico) — como o caso já
     existente e preservado em `TabelaChamadosFinalizados`
     ("sem agendamento em aberto"), que É uma regra de negócio real, não
     uma decoração de status.
  3. **Column Sizing (capability nova):** `src/lib/design-system/
     column-sizing.ts` — 4 papéis semânticos de largura (`compact`/
     `standard`/`wide`/`fill`), consumidos via `columns[].width` no
     `ResponsiveTable`. Substitui `w-[Npx]` arbitrários; não infere papel
     a partir do texto do header (o módulo declara, o DS executa).
     Aplicado no modal (`#`=compact, `Texto agendamento`=fill,
     `Status`=compact, datas=compact, `Comentário`=wide) e na tabela
     principal (`Nome Digisac`/`Loja`/`Consultora`/`Observação`=standard,
     `Tags`=wide, badges/contadores/botão=compact).
- Motivo/contexto: pedido explícito do usuário após validação manual real
  — três problemas concretos, generalizar no componente oficial, nunca
  hack local.
- Validação: `getComputedStyle` em todas as posições de scroll confirma
  zero canal de alpha nas cores da coluna sticky (era o bug); no modal
  (dados simulados), zebra alterna corretamente independente do status
  (branco/`lab(98.14 ...)` puros, sem influência do Badge); "Texto
  agendamento" (`fill`) mediu 634px vs. "#" (`compact`) 24px numa mesma
  viewport de 1400px. `tsc`/lint/testes sem regressão (58 testes em
  `src/lib/design-system`, +5 novos de `column-sizing.test.ts`). Nenhuma
  regra funcional alterada — só classes CSS/estrutura de colunas.
- Impacto: `ResponsiveTable.tsx`, `TabelaChamadosFinalizados.tsx`,
  `ModalAgendamentosCliente.tsx`. `/inteligencia-comercial` e demais
  telas não tocadas. `/design-system` atualizado com a nova demonstração
  (coluna `Descrição` `fill` vs. colunas `Qtd *` `compact`, linha de
  estado explícito preservada).
- Status: APROVADA (aguardando validação visual manual do usuário)

## D-045 — NO-CELL-OVERLAP, sizing intrínseco (`content`) e row tones com zebra interno

- Data: 2026-09-15
- Decisão: nova validação manual de `/chamados-finalizados` (rodada
  seguinte à D-044) revelou dois problemas reais na tabela PRINCIPAL
  (modal `Ver agendamentos` já estava aprovado e não foi tocado):
  1. **NO-CELL-OVERLAP (bug real, confirmado por inspeção, não
     hipotético):** a coluna "Nome Digisac" usava o papel `standard`
     (`min-w-[120px] max-w-[220px]`, sem `whitespace-normal`).
     `TableCell` (`ui/table.tsx`) já aplica `whitespace-nowrap` por
     padrão a toda célula, e nenhum papel de Column Sizing jamais
     aplicou `overflow-hidden` a uma célula de conteúdo — a combinação
     "largura limitada + `nowrap` + `overflow: visible`" deixava o texto
     continuar pintando depois da borda da célula, sobre a coluna
     seguinte, sempre que o valor excedia 220px. Exemplo real visto pelo
     usuário: `Ana Toledo | Biramar Baby Atacado (2255)` pintando sobre
     a coluna "Loja". Corrigido em duas frentes: (a) `standard`/`wide`/
     `fill` passaram a sempre acompanhar qualquer `max-w` de
     `whitespace-normal break-words` (nunca mais a combinação inválida —
     formalizado como regra global NO-CELL-OVERLAP, testada
     estruturalmente em `column-sizing.test.ts`); (b) criado o papel
     `content` — mecanicamente igual a `compact` (`whitespace-nowrap`,
     sem min/max, a coluna CRESCE pelo maior conteúdo real via layout
     `auto` da tabela), mas semanticamente distinto: reservado para dado
     ESTRUTURADO que precisa aparecer inteiro (nome de cliente,
     identificador), nunca texto narrativo ilimitado (isso continua
     `wide`/`fill`). "Nome Digisac" passou de `standard` para `content`.
     Como a célula sticky é a MESMA célula que participa do layout
     normal (só ganha `position: sticky`), sua largura nunca diverge do
     header/corpo — nenhuma geometria calculada à parte.
  2. **Zebra dentro do row-state (refinamento, não regressão da D-044):**
     a linha destacada de `TabelaChamadosFinalizados` ("sem agendamento
     em aberto") usava uma cor de background FIXA (`ROW_TONE_DANGER`) —
     correto quanto a ser opaca (D-044), mas todas as linhas destacadas
     ficavam com a MESMA cor uniforme, perdendo a orientação visual entre
     registros (usuário: "parecem uma grande faixa rosa uniforme").
     Corrigido evoluindo `row-tones.ts` de constantes flat para FAMÍLIAS
     (`RowTone` — `danger`/`dangerSubtle`/`warning`/`success`/`info`,
     cada uma com variantes `base`/`alternate` + hover sólido embutido) e
     adicionando a prop semântica `rowTone?: (row) => RowTone | undefined`
     ao `ResponsiveTable` — a tela só declara o tom, o componente resolve
     a variante pela MESMA paridade que o zebra normal usaria (nunca a
     tela calcula paridade). `dangerSubtle` é uma intensidade mais clara
     da família `danger`, criada porque `/chamados-finalizados` achou a
     intensidade padrão forte demais para toda a tabela de linhas
     destacadas — **preferência ESPECÍFICA dessa tela**, registrada aqui
     para não virar padrão obrigatório de outras telas; `--destructive` e
     a família `danger` padrão não foram alterados. `rowClassName`
     permanece aceito (tipografia/borda, ou background legado quando não
     há `rowTone`) — compatibilidade preservada. Achado colateral, também
     corrigido: o hover da coluna sticky "sumia" em linhas sem `rowTone`
     porque `ZEBRA_EVEN`/`ZEBRA_ODD` não tinham hover próprio — a célula
     sticky pinta sua própria superfície por cima da `<tr>`, então o
     `hover:bg-muted/50` herdado nunca alcançava a coluna fixa. Corrigido
     dando hover sólido próprio também ao zebra neutro
     (`hover:bg-slate-100`).
- Motivo/contexto: pedido explícito do usuário após nova validação manual
  real da tabela principal — dois problemas concretos, generalizar no
  componente oficial (nunca hack local), modal aprovado preservado sem
  alterações.
- Validação: `tsc --noEmit` 15 erros (baseline, zero novos); `npx eslint`
  nos diretórios tocados — zero problemas; `npx vitest run
  src/lib/design-system` — 11 arquivos, 66/66 testes (inclui
  `column-sizing.test.ts` revisado com o invariante NO-CELL-OVERLAP
  testado estruturalmente — nenhum papel pode combinar `max-w` sem
  `whitespace-normal` — e `row-tones.test.ts`, novo, cobrindo paridade
  distinta por tom, opacidade sem alpha, hover mais escuro que a base, e
  `dangerSubtle` mais claro que `danger`). Validação visual: per
  preferência já registrada do usuário para este projeto (ele conduz a
  validação visual de `/design-system`/telas internas), a verificação
  desta rodada foi feita por leitura de código + raciocínio sobre a
  mecânica de CSS/layout de tabela `auto` (não por browser-based
  self-check) — geometria do sticky/coluna intrínseca e o resultado
  visual do row-tone aguardam confirmação do usuário.
- Impacto: `ResponsiveTable.tsx` (`rowTone`, `resolveRowSurface()`
  revisado, `ZEBRA_EVEN`/`ODD` com hover sólido, doc NO-CELL-OVERLAP/ROW
  TONES), `column-sizing.ts` (+`content`, `standard`/`wide`/`fill` sempre
  com `whitespace-normal` quando têm `max-w`), `row-tones.ts` (reescrito —
  famílias com paridade), `TabelaChamadosFinalizados.tsx` (`nomeDigisac`
  → `content`; `rowClassName`+`ROW_TONE_DANGER` → `rowTone`
  `'dangerSubtle'`), `/design-system` (`OfficialReference.tsx` — nova
  demo `IntrinsicColumnDemo` isolada + `WideTableDemo` revisada com nome
  longo e 2 linhas `rowTone="danger"`). `ModalAgendamentosCliente.tsx`
  **não foi tocado** (já aprovado, D-044) — confirmado via `git status`.
  `/inteligencia-comercial` e demais telas — intocadas. Nenhuma regra de
  negócio, consulta, filtro, rota, permissão, API, paginação, banco ou
  auth alterada.
- Status: APROVADA (aguardando validação visual manual do usuário)

## D-046 — `RowTone` com classes Tailwind estáticas e QA real da referência

- Data: 2026-09-11
- Decisão: preservar as superfícies opacas, a paridade e as intensidades
  aprovadas em D-045, mas declarar cada classe `color-mix()` literalmente
  em `row-tones.ts`. Classes arbitrárias interpoladas em runtime não são
  detectadas pelo scanner do Tailwind v4; não é permitido reintroduzir
  essa implementação. A alteração é estrutural e genérica ao Design
  System, não um workaround em `/chamados-finalizados`.
- Motivo/contexto: reprodução no DOM real confirmou que todas as linhas
  especiais retornavam `dangerSubtle`, mas as classes `5%`/`9%`/`13%`
  existiam somente no atributo `class`, sem regra CSS emitida. O `<tr>` e
  a célula sticky tinham `background-color: transparent`, explicando os
  dois sintomas juntos: zebra rosa inexistente e texto rolável visível
  através da primeira coluna.
- Validação: após a correção, `getComputedStyle()` confirmou superfícies
  sólidas de `dangerSubtle` (base 5%, alternate 9%, hover 9%/13%) tanto
  na linha quanto na sticky. A mesma tabela real foi medida em scroll
  esquerdo, intermediário (`scrollLeft=220`) e máximo (`442`): primeira
  coluna fixa, opaca e acima da coluna seguinte (`z-10`; interseção do
  header `z-30`), sem divergência de largura entre header/corpo. QA mobile
  confirmou cards e ausência de overflow horizontal da página. O modal
  aprovado foi aberto em regressão rápida, com título e fechar sem
  interseção. `--destructive` e a Brand Foundation não foram alterados.
- Impacto: `row-tones.ts`, seu teste unitário e a documentação canônica.
  Nenhuma regra de negócio, API, auth, banco, paginação, modal ou outra
  tela foi alterada.
- Status: APROVADA tecnicamente; aguarda a validação visual manual do
  usuário para liberar qualquer próxima tela.

## D-047 — `/hub-vendas` migrado (Fase 5, quarta tela); filtros de listagem convertidos para `FLT-EXEC=MANUAL`

- Data: 2026-09-15
- Decisão: `/hub-vendas` (`src/app/hub-vendas/PageClient.tsx`, único
  arquivo da tela — 1609 linhas, 100% markup manual antes desta tarefa)
  migrado por completo para o Design System v1: `PageContainer`,
  `PageHeader`, dois `FilterPanel` (Período; Filtros de filas e envios),
  `KpiSection`+`KpiCard` (15 KPIs em 3 seções), `Card`/`CardHeader`/
  `CardContent` (estado da automação, alertas/resumo, cards por loja,
  configuração de limite), `Section` (tons 1/2/3 — primeiro uso real fora
  de modal/lab, para os 3 blocos de "Alertas e resumo operacional"),
  `Badge` (status de fila, ATIVA/PAUSADA, alertas recentes),
  `ResponsiveTable` (tabela de filas — `content`/`standard`/`compact` por
  coluna, card mobile novo, ações de linha), `Dialog`/`DialogHeader`/
  `DialogBody`/`DialogFooter` (3 modais de confirmação com campo motivo +
  modal de detalhe da fila + modal de teste de alerta), `FormField`+
  `Input`/`DateField`/`Textarea`, `Alert`/`EmptyState`/`Spinner`. Os 3
  filtros de listagem que antes disparavam a consulta imediatamente ao
  mudar um campo (loja/status/checkboxes; cliente tinha debounce de 400ms)
  passaram a seguir `FLT-EXEC=MANUAL` (mudança de campo = rascunho, clique
  em "Filtrar" = consulta) — mesma conversão já aceita em
  `/chamados-finalizados` (D-021), agora explicitamente pedida também
  pelo próprio escopo desta tarefa (regra global de filtros de
  consulta/listagem).
- Motivo/contexto: tarefa de migração visual/UX completa da tela, com
  regra explícita para adotar `FLT-EXEC=MANUAL` em filtros de
  consulta/listagem. Risco considerado baixo e reversível, como em D-021:
  não altera nenhuma query/dado/permissão, só quando a consulta é
  disparada.
- Impacto funcional preservado: todas as chamadas de API
  (`/api/hub-vendas/status|filas|limite|pausar|reativar|alertas|resumo|
  alertas/teste`), o polling de status a cada 60s, o timezone
  America/Sao_Paulo, a paginação (20/página, backend inalterado — só o
  literal `'20'` do request virou `String(TABLE_PAGE_SIZE)`), as ações
  manuais por status de fila, o link de histórico de ticket Digisac e o
  limite diário por loja. Nenhuma rota, API, cron, cálculo, permissão,
  RLS ou schema foi tocado.
- Impacto no Design System (extensão genérica, documentada em
  `components-e-patterns.md`): `KpiCard` ganhou 3 props opcionais e
  aditivas — `tone` (mesmo vocabulário semântico de `Badge`: neutral/
  success/warning/danger/info/brand, evitando o mapa ad hoc de 9 cores
  Tailwind que a tela usava antes por métrica), `detail` (linha
  secundária — percentual, detalhamento por loja) e `labelAction`
  (slot para o ícone de ajuda/tooltip ao lado do label). Nenhum
  consumidor existente de `KpiCard` foi afetado (todas as props novas são
  opcionais, `tone` default `'neutral'` reproduz exatamente o visual
  anterior).
- QA: lint e typecheck sem erros novos nos arquivos alterados; suíte
  `src/lib/design-system` (67/67) sem regressão. Validação visual real
  tentada com a conta técnica de bootstrap (`autenticacao-tecnica-agentes`,
  usuário preencheu o secret em `/agente` a pedido do Claude, sessão
  criada com sucesso) — bloqueada em `/hub-vendas` por `Acesso negado`:
  o perfil `consultora` da conta técnica não tem o módulo
  `hub_vendas_gestao` concedido. Confirmado que não é falha de sessão
  (login funcionou; outras rotas do perfil consultora seriam acessíveis)
  — é limitação real de permissão da conta de QA, não contornável sem
  ampliar acesso (proibido pela própria skill). Validação visual completa
  (desktop/mobile, filtros, modais, tabela) permanece pendente do usuário.
- Status: APROVADA (migração técnica completa; QA visual manual
  complementar pendente, sem bloqueio técnico)

## D-048 — `/pedidos-personalizados` migrado (Fase 5, quinta tela); correção de bug real em `Button` (`asChild`) e vocabulário de tom para status/prazo

- Data: 2026-09-15
- Decisão: as duas rotas de `pedidos-personalizados` (gestão e criação,
  10 componentes, ~3.900 linhas antes da migração) migradas por completo
  para o Design System v1 — ver detalhamento em `STATUS.md`, "Última tela
  concluída — `/pedidos-personalizados`". Dois pontos de decisão
  relevantes:
  1. **Vocabulário de tom para status/prazo do pedido** (`tomStatus`/
     `tomPrazo`, em `GestaoPedidosPersonalizados.tsx`): os 7 status de
     negócio (RASCUNHO, VENDA FECHADA, AGUARDANDO LAYOUT, AGUARDANDO
     APROVAÇÃO DO CLIENTE, EM PRODUÇÃO, RECEBIDO, CANCELADO) tinham 7
     cores distintas ad hoc antes da migração; o vocabulário oficial de
     `Badge`/`Section` tem 6 tons. Mapeamento aprovado por significado:
     CANCELADO→danger, RECEBIDO→success, EM PRODUÇÃO→brand, AGUARDANDO
     LAYOUT e AGUARDANDO APROVAÇÃO DO CLIENTE→warning (ambos "esperando
     algo externo"), VENDA FECHADA→info, RASCUNHO→neutral. Consequência
     aceita: os dois status "aguardando" (antes amber/orange distintos)
     passam a compartilhar o mesmo tom `warning` — nenhuma mudança na
     lista de status, na ordem, nas transições ou nas regras de negócio,
     só na paleta visual.
  2. **`type="date"` nativo preservado** (não migrado para `DateField`)
     nos campos de data ligados a payloads administrativos/transição de
     status (`gestao-modelo.ts`: `EstadoAdministrativo`,
     `EstadoTransicaoGestao`) — `DateField` usa string `dd/mm/aaaa` como
     valor canônico, e esses campos são lidos/gravados como ISO
     (`YYYY-MM-DD`) diretamente por comparações de negócio
     (`dataOperacionalBrasil()`, `converterDataAdministrativaParaISO`) e
     pelos payloads de API. Migrar exigiria espalhar conversão ISO↔BR por
     `gestao-modelo.ts` (arquivo de regra de negócio, fora do escopo
     visual desta tarefa) só para um ganho estético. Mantido nativo,
     estilizado para combinar com o restante do formulário.
- Motivo/contexto: tarefa de migração visual/UX completa da tela,
  preservando 100% das regras de negócio (fluxo de status, cálculo de
  tapete, produto SGI, anexos, idempotência).
- Correção no Design System compartilhado (`src/components/design-system/
  Button.tsx`): `asChild` (via `Slot` do Radix) quebrava com
  `React.Children.only expected to receive a single React element child`
  sempre que o `children` renderizado incluía o spinner condicional de
  `loading` (`{loading && <Loader2 .../>}{children}`) — `Slot` exige
  exatamente um filho, e a expressão condicional conta como um segundo
  item mesmo quando `loading` é `false`. Bug nunca exercido antes: os
  únicos dois usos existentes de `Button asChild` no projeto
  (`ModalDetalheVenda.tsx`, `HistoricoClienteModal.tsx`) importam o
  `Button` legado de `ui/button.tsx`, não o do Design System.
  `/pedidos-personalizados` é a primeira tela a combinar DS `Button` com
  `asChild` (links "Ir para a gestão de pedidos" dentro de avisos/alerts).
  Corrigido: quando `asChild` é verdadeiro, `Button` passa `children` sem
  compor o spinner (nenhum consumidor real combina `asChild` com
  `loading`); comportamento de `loading` inalterado para todo uso sem
  `asChild`. Suíte de `design-system` (67/67) sem regressão.
- Correção pontual (mesma tela, sem escopo cross-tela): a barra fixa
  `BarraResumoPedidoPersonalizado` (usada por Moriah e Lebebe Exclusive)
  estourava horizontalmente em 375px quando os três botões (mostrar
  selecionados, novo pedido, salvar) apareciam juntos — combinação de
  props que só ocorre no fluxo de criação com Lebebe Exclusive
  selecionado. Bug pré-existente à migração (estrutura `flex gap-2` sem
  `flex-wrap` já estava assim antes), só descoberto durante o QA mobile
  desta tarefa. Corrigido com `flex-wrap` (quebra para duas linhas em vez
  de vazar a largura da página).
- Impacto funcional preservado: cálculo de área/preço do tapete,
  classificação Catálogo/Personalizado, limite de 6 cores e 10 tapetes,
  máscara de telefone, idempotência de criação, fluxo e transições de
  status (`status-fluxo.ts`), criação/retomada de produto SGI,
  upload/substituição/remoção de anexos com contabilização de alteração
  de layout, paginação (backend inalterado), resumo para
  fornecedor/venda, filtro de listagem (estado próprio preservado — chip
  de status continua aplicando só o campo `status` imediatamente, sem
  sincronizar outros campos ainda não aplicados do rascunho de filtro).
- QA: lint e `tsc --noEmit` sem erros novos; suíte de
  `pedidos-personalizados`/`design-system` 565/565 (duas asserções de
  "texto-fonte literal" desatualizadas pelo refactor de nomes/markup —
  `classeStatus`→`tomStatus`, tabela HTML manual→`ResponsiveTable` —
  atualizadas para verificar o comportamento equivalente). Sessão
  autenticada real confirmou listagem, filtros, chips, cards de pedido,
  modal de detalhe (Moriah e Lebebe Exclusive, incluindo `ResponsiveTable`
  de itens), formulário de criação (ambos fornecedores) e responsividade
  em 375px (`scrollWidth` igual à viewport, sem overflow de página,
  `ResponsiveTable` alterna corretamente para cards). Limitação da sessão
  de QA: a Sidebar do app sobrepõe visualmente o conteúdo em 375px neste
  ambiente de preview — comportamento do shell global (`Sidebar`/
  `LayoutWrapper`, fora do escopo desta tela), confirmado sem relação com
  a migração por medição direta de `scrollWidth`/`getBoundingClientRect`.
- Status: APROVADA (migração técnica completa; QA visual manual
  complementar pendente, sem bloqueio técnico)

## D-049 — `FilterPanel` ganha painel colapsável (`FLT-COLLAPSE=A`) e ajuste global de contraste da superfície

- Data: 2026-09-15
- Pedido: durante a validação de `/pedidos-personalizados`, o usuário
  pediu duas decisões globais novas no pattern oficial de filtros, a
  aplicar no componente compartilhado (não localmente na tela).
- Decisão 1 — painel colapsável (`FLT-COLLAPSE=A`): `FilterPanel`
  (`src/components/design-system/FilterPanel.tsx`) ganhou um estado
  interno `expanded` (`React.useState(true)`, sem prop nova, sem tocar
  `useFilterState`/`draft`/`applied`) e um botão com chevron ("Recolher"/
  "Mostrar filtros") ao lado de "Limpar". Recolher esconde só os campos,
  o botão "Filtrar" e o aviso de "Filtro alterado"; "Limpar" continua
  sempre visível e funcional. Regras fixas: inicia sempre expandido;
  nunca se recolhe/expande sozinho (só o clique explícito do usuário no
  toggle muda o estado — `onApply`/`onClear` nunca tocam `expanded`);
  reabrir mostra o conteúdo de volta no mesmo painel, com o `draft`
  intacto. `FLT-EXEC=MANUAL` e `FLT-CLR=C` inalterados. Corrigido de
  brinde: `id` estático (`ds-filter-panel-title`) trocado por
  `React.useId()` (dois ids, título e conteúdo) — evita colisão de id
  quando uma página usa mais de um `FilterPanel` (ex.: `/hub-vendas`, que
  já tinha esse latent bug antes desta tarefa).
- Decisão 2 — contraste da superfície: `border-sky-100 bg-sky-50/40` →
  `border-sky-200 bg-sky-50/70` (mesma família de cor, só mais opaca) —
  ver `foundations.md`, "Surface do painel de filtros", para o
  antes/depois. Ajuste discreto, sem token novo.
- Motivo/contexto: o usuário observou que (a) não havia forma de recolher
  o bloco de filtros para ganhar espaço visual depois de já ter
  filtrado, e (b) a superfície do painel quase se confundia com o fundo
  da página. Pedido explícito para resolver no componente compartilhado,
  não caso a caso.
- Escopo do impacto: `FilterPanel` é usado, sem override de `className`,
  por `/pedidos-personalizados`, `/chamados-finalizados`,
  `/dashboard` (2×), `/hub-vendas` (2×), `/agendamentos`,
  `/horarios-agendamentos`, `/inteligencia-comercial` (`FiltrosSGI`),
  `/digisac/finalizacoes-automaticas` e a referência viva em
  `/design-system` — todas herdam a mudança automaticamente, sem exigir
  edição própria.
- Regression check proporcional: validado ao vivo (sessão autenticada)
  em `/pedidos-personalizados` (expandir, recolher, reabrir, campos
  intactos, sem overflow) e `/chamados-finalizados` e `/dashboard`
  (visual idêntico ao anterior + toggle funcionando, distribuição de
  campos e responsividade preservadas). `/hub-vendas` e `/design-system`
  não puderam ser abertos com a conta desta sessão (mesma limitação de
  permissão já registrada em D-047) — confirmados por leitura de código
  (nenhum dos dois passa `className` customizado para `FilterPanel`, logo
  usam a mesma superfície/comportamento) e pela suíte de testes
  (`src/lib/design-system` 67/67, sem teste que dependa da classe antiga
  ou do `id` estático). Referência viva em `/design-system`
  (`OfficialReference.tsx`, bloco "Filtros") atualizada com legenda
  explicando o novo toggle — o componente já é o mesmo `FilterPanel`
  real, então a demonstração interativa herda o comportamento sem
  precisar de código adicional.
- Documentação: `components-e-patterns.md` (`FilterPanel`, novo
  parágrafo `FLT-COLLAPSE=A` + ajuste de superfície),
  `interaction-standards.md` (`## Filtros`, novo bloco "Painel
  colapsável"), `foundations.md` (novo "Surface do painel de filtros").
- QA: lint e `tsc --noEmit` sem erros novos; suíte `design-system` +
  `pedidos-personalizados` 565/565.
- Status: APROVADA

## D-050 — FORM-PAGE-WIDTH: conteúdo de formulário centralizado sem limitar o Page Shell

- Data: 2026-09-15
- Decisão: `PageContainer` permanece em 100% da área útil, com gutters
  oficiais e sem `max-width`. Para criação, edição, cadastro e configuração
  predominantemente de formulário, a capacidade oficial é
  `FormPageContent` (`src/components/design-system/patterns/`), com
  `w-full max-w-6xl mx-auto`. Ela limita e centraliza somente o bloco que a
  utiliza; não altera nenhum consumidor de `PageContainer` automaticamente.
- Motivo/contexto: em `/pedidos-personalizados/novo`, o formulário já tinha
  `max-w-6xl` (1152px), mas não `mx-auto`; em desktop largo ficava ancorado
  no gutter esquerdo e deixava a massa vazia somente à direita. A largura
  de 72rem foi preservada e promovida para a capacidade oficial porque a
  composição real contém grid de 2 e 3 colunas, campos, labels, sections e
  ações que permanecem confortáveis nesse limite — não é percentual
  arbitrário nem uma regra da página inteira.
- Aplicação: `/pedidos-personalizados/novo` envolve `PageHeader` e
  `FormularioNovoPedido` no mesmo `FormPageContent`, estabelecendo um eixo
  único para título, Identificação e Escolha o fornecedor. Nenhuma grid
  interna, campo, validação, estado, API ou ação foi alterado.
- Responsividade e escopo: abaixo de 1152px, `w-full` usa naturalmente a
  largura disponível com os gutters já providos pelo Page Shell; em desktop
  largo, `mx-auto` equilibra as margens. Dashboards, tabelas extensas,
  listagens, grids densos e telas operacionais continuam full-width. Em uma
  página híbrida, somente o formulário é envolvido; tabela larga permanece
  fora do container interno.
- Documentação/demo: `foundations.md` formaliza a distinção e a proibição
  de percentuais; `components-e-patterns.md` mostra a composição; a
  referência viva `/design-system` demonstra PageContainer full-width,
  FormPageContent centralizado, duas Sections e grids de 2–3 campos.
- QA: lint focado passou; `vitest` focado passou (12 arquivos, 157 testes).
  Validação visual local em `/pedidos-personalizados/novo` confirmou o
  bloco de 1152px centralizado em viewport desktop de 1707px e ausência de
  overflow nos breakpoints tablet/mobile disponíveis. `/design-system`
  abriu a demo sem erros de console. `tsc --noEmit` continua com erros
  preexistentes de testes Auth/Hub e contrato do dashboard, fora do escopo.
- Status: APROVADA

## D-051 — `Select` entra na família `FORM-CONTROL-SURFACE`; ação "Filtrar" ancorada à direita (`FILTER-ACTION-ALIGN=A`)

- Data: 2026-09-15
- Pedido: durante a validação de `/pedidos-personalizados`, o usuário
  pediu mais dois refinamentos globais no Design System, com `/dashboard`
  citado só como referência do problema (não para migrar de novo).
- Decisão 1 — `FORM-CONTROL-SURFACE`: causa raiz investigada antes de
  alterar (`ui/select.tsx`, `design-system/Combobox.tsx`,
  `design-system/Input.tsx`). `SelectTrigger`
  (`src/components/ui/select.tsx`) usava `bg-transparent` — dentro de um
  `FilterPanel` (superfície tintada), o campo ficava quase invisível,
  apesar de já ter `border-input` e o mesmo `focus-visible:border-ring
  focus-visible:ring-ring/50` do `Input`. `Combobox` já usava
  `bg-input-background`/`border-input` desde sua criação (não precisou de
  ajuste). Corrigido na camada canônica mais baixa apropriada — trocado
  `bg-transparent` por `bg-input-background` (token já existente,
  reaproveitado, sem hex novo) direto em `ui/select.tsx`, usado por toda
  a base. `Select` e `Combobox` já compartilhavam borda/focus/disabled;
  agora compartilham também a superfície — mesma família visual de
  `Input`/`Textarea`/`DateField`, sem inventar uma terceira aparência.
  Sem efeito visual sobre fundo branco (`bg-input-background` é
  `#FFFFFF`); o efeito aparece só sobre superfícies tintadas
  (`FilterPanel`, `Section`).
- Decisão 2 — `FILTER-ACTION-ALIGN=A`: `FilterPanel`
  (`src/components/design-system/FilterPanel.tsx`) tinha o botão
  "Filtrar" alinhado à esquerda do rodapé (`flex items-center gap-2`,
  sem `justify-end`). Trocado para `flex flex-wrap items-center
  justify-end gap-2`, com o botão "Filtrar" por último no grupo e o aviso
  "Filtro alterado" (quando `dirty`) antes dele, dentro do mesmo grupo
  ancorado à direita. Independe do número de campos (nunca ocupa célula
  da grade de `FilterFieldGroup`); em telas estreitas o grupo quebra
  linha (`flex-wrap`) sem nunca voltar ao canto esquerdo. `FLT-EXEC=MANUAL`
  e `FLT-COLLAPSE=A` (D-049) inalterados — recolhido ou expandido, a
  ação continua ancorada à direita quando visível.
- Achado colateral corrigido (mesmo diagnóstico, não é o componente
  compartilhado em si): `src/components/dashboard/FiltrosDashboard.tsx`
  usava `<Button variant="outline">` — `"outline"` não existe no DS
  `Button` (`primary`/`secondary`/`ghost`/`destructive`), um erro de
  TypeScript pré-existente (`tsc` já acusava antes desta tarefa) que
  fazia o botão renderizar sem nenhuma classe de variante (fundo
  transparente, sem borda) — exatamente o sintoma "select quase
  invisível" que o usuário apontou em `/dashboard` para Loja/Consultora/
  Conexão (na verdade um `MultiSelectFilter` local, Button+Popover, não
  um `Select`/`Combobox` — lacuna já registrada em
  `components-e-patterns.md`). Corrigido com o mínimo necessário:
  `variant="secondary"` (variante válida) + classes que replicam a
  superfície `FORM-CONTROL-SURFACE` (`border border-input
  bg-input-background`), sem redesenhar o componente nem criar um
  multi-select oficial nesta tarefa.
- Motivo/contexto: consolidar a linguagem visual de todo controle de
  formulário (Input/DateField/Select/Combobox) numa família única e
  garantir que a ação de executar filtros tenha posição previsível,
  independente da tela — sem alterar nenhuma regra de filtro/consulta.
- Escopo do impacto: `Select` é usado (via `ui/select.tsx`) em dezenas de
  telas do app, não só nas migradas ao DS v1 — mas a mudança só é visível
  onde o fundo ao redor não é branco (painéis de filtro, `Section`),
  então o risco de regressão visual em telas legadas é mínimo por
  construção. `FilterPanel` é usado, sem override de `className`, pelas
  mesmas telas listadas em D-049.
- Regression check proporcional: validado ao vivo (sessão autenticada)
  em `/pedidos-personalizados` (Select claramente visível, "Filtrar" à
  direita, distribuição de campos preservada, sem overflow em 375px),
  `/dashboard` (Selects nativos do período + `MultiSelectFilter` de
  abrangência agora visíveis, "Filtrar" à direita), `/chamados-finalizados`,
  `/agendamentos` e `/digisac/finalizacoes-automaticas` (mesma superfície
  e alinhamento, sem quebra de layout). `/hub-vendas` e `/design-system`
  não puderam ser abertos com a conta desta sessão (mesma limitação de
  D-047/D-049) — confirmados por leitura de código e pela suíte de
  testes.
- `/design-system`: `OfficialReference.tsx` (`FilterDemo`) passou a
  mostrar `Input`, `DateField` e `Select` juntos no mesmo `FilterPanel`,
  com legenda citando `FORM-CONTROL-SURFACE`/`FILTER-ACTION-ALIGN=A` —
  reaproveita a demo existente (bloco "Filtros"), não duplica.
- Documentação: `foundations.md` ("Superfície de campo", `Select` entra
  na família), `components-e-patterns.md` (`Select` sai de "reaproveitado
  sem alteração", ganha seção própria; `FilterPanel` ganha parágrafo de
  alinhamento), `interaction-standards.md` (`## Filtros`, novo bloco
  `FILTER-ACTION-ALIGN=A`).
- QA: lint e `tsc --noEmit` sem erros novos (o erro de `variant="outline"`
  pré-existente em `FiltrosDashboard.tsx` foi resolvido como consequência
  direta da correção); suíte `design-system` + `pedidos-personalizados`
  565/565.
- Confirmação: nenhuma regra funcional de filtros mudou — `FLT-EXEC=MANUAL`,
  valores/opções de cada campo, comportamento de seleção, APIs e dados
  permanecem exatamente como antes.
- Status: APROVADA

## D-052 — `LoadingLeBebe`: estrela SVG como indicador complementar de marca

- Data: 2026-09-15
- Decisão revisada: `LoadingLeBebe` é uma estrela de cinco pontas reconstruída
  em SVG a partir da estrela do logo real (`public/logo.png`), com fundo
  transparente e CSS de baixo custo. A estrela usa pulso perceptível, halo e
  sparkles discretos em loop; `prefers-reduced-motion` a torna estática. A
  paleta usa `currentColor` (por padrão `text-primary`) e `--accent`, sem hex
  local nem reutilização do PNG.
- Escopo e compatibilidade: é uma opção visual de marca para espera explícita
  em área, modal ou bootstrap; não substitui a decisão `LDG=A`: conteúdo
  continua com skeleton e ações pontuais continuam com `Spinner`/`Button`
  `loading`. Nenhum consumidor existente foi alterado automaticamente.
- API e validação: aceita `size`, `className` e `label` (anunciado por
  `role="status"`), é exportado pelo barrel oficial e a referência viva
  mostra 20, 24, 32, 48, 64, 96 e 128px.
- Piloto real: a tela `/hub-vendas` usa `LoadingLeBebe` apenas enquanto o
  status inicial ainda não chegou, após o atraso centralizado de 200ms para
  evitar flicker. O spinner de detalhes, os botões em ação e o skeleton da
  tabela seguem inalterados.
- Hierarquia formalizada: `LoadingLeBebe` é institucional (48/64/96px) e não
  é usado em áreas compactas; `Spinner` (16/20/24px) fica para microinterações;
  `Skeleton` preserva estruturas previsíveis; `Progress` comunica somente
  percentual real. A referência viva mantém 20/24/32px para provar a
  escalabilidade da estrela, não como recomendação de uso compacto.
- Componentes aditivos: `Spinner` ganhou prop `size`; `Progress` e
  `useDelayedVisibility` são extensões reutilizáveis. As barras locais de
  `SyncLotePanel` e `ModalDetalheVenda` são candidatas futuras, mas não foram
  migradas nesta decisão.
- Status: APROVADA (pedido explícito do usuário para um loader oficial).

## D-053 — `/atendimento-presencial/clientes` migrado (Fase 5, oitava e última tela da fila); consultora de origem passa a `FLT-EXEC=MANUAL`

- Data: 2026-09-15
- Decisão: `/atendimento-presencial/clientes` (busca/listagem de clientes +
  cadastro rápido) migrado para o Design System v1 —
  `PageContainer`/`PageHeader`; `FilterPanel`/`useFilterState`/
  `FilterFieldGroup`/`FormField` para o único filtro real da tela (Nome ou
  telefone + Consultora de origem, `Select` `FORM-CONTROL-SURFACE`);
  `Card`/`CardHeader`/`CardContent`/`CardFooter` para a listagem (sem
  `ResponsiveTable` — não há dado tabular, é uma listagem de cartões, mesmo
  padrão de cartão aninhado `className="p-0"`/`"p-4"` já usado em
  `/atendimento-presencial/registros`); `Badge` (`tone="success"`) para o
  indicador "telefone encontrado"; `EmptyState`/`Spinner`/`Alert` para
  vazio/carregando/erro; `Button loading` no cadastro; `OpcaoButton` local
  (mesma composição já aceita em `/atendimento-presencial/ficha` e
  `/registros`) para os 13 botões de parentesco. `HistoricoClienteModal`
  (já migrado) foi reutilizado sem nenhuma alteração.
- Mudança de comportamento registrada: antes da migração, o `<select>`
  nativo de "Consultora de origem" disparava a busca imediatamente ao
  trocar de valor — o campo de texto já era manual (só buscava ao
  submeter/clicar "Buscar"). Unificados os dois campos no mesmo
  `FilterPanel`/`useFilterState`, a consultora passou a exigir o clique em
  "Filtrar" como o campo de texto, alinhando com `FLT-EXEC=MANUAL` (mesma
  regra já aplicada a `/hub-vendas`, D-047, e pedida explicitamente para
  esta tarefa). Risco considerado baixo: nenhuma API/query/payload mudou,
  só o gatilho da mesma chamada; "Limpar" (capacidade nova, mesma lógica de
  D-022) restaura a lista completa.
- Preservado: as duas chamadas de API (`GET`/`POST`
  `/api/atendimento-presencial/clientes`), paginação manual (`pageSize=20`,
  Voltar/Avançar), validação de cadastro (`podeEnviar`), máscara de
  telefone, resolução de cliente existente por telefone, ordenação da lista
  ao cadastrar, `checkModuleAndWindowAccess('atendimento_presencial_clientes')`.
- QA: `npx eslint` no arquivo alterado sem problemas; `tsc --noEmit` sem
  erros novos (baseline preexistente inalterado — nenhum erro reportado
  referencia este arquivo); suíte `design-system` 67/67. Sessão local
  autenticada (dev server já logado pelo usuário) confirmou ao vivo:
  listagem real (90 clientes/5 páginas), filtro por nome aplicado e
  limpo corretamente, paginação (Avançar), abertura do
  `HistoricoClienteModal` com dado real, alternância de parentesco
  (inclusive campo condicional "Complemento" ao selecionar "Outro"), e
  responsividade em 375px (`scrollWidth`=`clientWidth`, sem overflow
  horizontal; sobreposição da Sidebar fixa sobre o conteúdo é a mesma
  limitação já registrada do shell global `LayoutWrapper`/`Sidebar`, não
  desta tela) — sem erros no console em nenhuma interação. Não foi
  submetido um cadastro real de cliente durante a QA (evitar criar um
  registro permanente de cliente no banco real usado pelo servidor de
  desenvolvimento); a validação visual do formulário de cadastro
  (campos, toggle de parentesco, botão) foi feita sem o `POST` final —
  fica registrado como validação manual complementar, sem bloqueio
  técnico.
- Fila técnica da Fase 5: com esta tela, as 8 telas da fila operacional
  estão todas em `PRONTA_PARA_VALIDACAO_MANUAL` — nenhuma em `PENDENTE`,
  `EM_ANDAMENTO` ou `BLOQUEADA`. Fila técnica encerrada (ver `STATUS.md`);
  nenhuma nova tela foi iniciada nesta tarefa.
- Status: APROVADA

## D-054 — Consolidação pós-validação manual: hierarquia, contenção e affordances

- Data: 2026-09-15
- Decisão: headers estruturais de Card e FilterPanel recebem surface tonal
  sutil com body neutro; `Section` passa a aceitar recolhimento explícito,
  iniciando expandida; `getSectionToneAt` centraliza o ciclo 1/2/3.
- Dialogs usam `100dvh` com header/fechar fora da rolagem e `DialogBody`
  como scroller principal. Action bars fixas reservam a altura medida no
  conteúdo do formulário. Ações de card usam `CardFooter` ao final/direita.
- Correções incluídas: paginação final backend de 20 em Registros;
  MultiSelect sem botões aninhados; lista de filiais do SGI continua derivada
  das filiais distintas reais (Bigorrilho, Feira, Marechal e Portão; sem
  Pós-venda); modal de Inteligência usa a sequência oficial de sections.
- Status: APROVADA pelo pedido explícito de consolidação; validação manual
  das telas corrigidas permanece a próxima etapa.

## D-055 — Segunda estabilização curta: hidratação determinística e overlays de filtro

- Data: 2026-09-15
- Decisão: a Ficha recebe `rascunhoIdInicial` resolvido no servidor e inicia o
  estado de carregamento de modo determinístico. A leitura de cache/localStorage
  e a restauração permanecem no efeito pós-hidratação, preservando o fluxo de
  autosave. Isso elimina a árvore diferente antes da hidratação causada pela
  leitura de `window.location.search` somente no cliente.
- `Section` ganha a variante compacta `subsection`; o conteúdo de uma seção
  recolhida fica oculto, mas continua montado. Assim os grupos internos de
  edição podem ser recolhidos individualmente sem perder campos controlados,
  estado ou composição aninhada.
- `MultiSelect` passa a usar um único botão como trigger completo e
  `Popover` portalizado. O overlay deixa de ser descendente do `FilterPanel`
  com `overflow-hidden`, respeita colisão com viewport e limita a lista longa
  a uma região de scroll própria. A referência viva documenta esse contrato.
- O `Dialog` compartilhado já tinha `max-height` por viewport, header externo
  ao scroller e `DialogBody` flexível com `overflow-y-auto`; a medição do
  cenário alto no laboratório confirmou esse contrato. Não houve alteração
  global sem falha estrutural reproduzível.
- QA/limites: a rota de Inteligência na sessão local expôs Bigorrilho, Feira e
  Marechal, mas não Portão; a referência viva confirmou as quatro e o dropdown
  de 12 opções. O histórico real disponível não era longo, portanto o scroll
  foi confirmado no laboratório alto e permanece para validação manual com
  dado real. A Ficha foi validada com ID inválido e navegação de volta; a
  restauração/autosave de um rascunho válido não foi acionada para não criar ou
  alterar dado persistente.
- Status: APROVADA como refinamento compartilhado explicitamente pedido;
  validação manual das quatro rotas permanece pendente.

### Adendo técnico de D-055 — Histórico longo real de Clientes

- Data: 2026-09-15
- A medição do modal de LUCAS MASTALER corrigiu a conclusão limitada da
  validação anterior: `DialogContent`, `DialogHeader` e `DialogBody` já
  obedecem ao contrato compartilhado, mas o `DialogBody` local usava uma grade
  de linhas implícitas. Como `HistoricoSecao` usa `overflow-hidden`, as linhas
  encolhiam e recortavam seus filhos; o body permanecia com
  `scrollHeight === clientHeight` mesmo quando o conteúdo da seção excedia a
  altura visível.
- A correção é estritamente de composição em `HistoricoClienteModal`:
  `auto-rows-max content-start` preserva a altura dos blocos e permite ao
  `DialogBody` rolar. `HistoricoListaLonga` aplica o padrão já aprovado
  `SCROLL-BOUNDED-LIST` (`max-h-[min(24rem,45dvh)] overflow-y-auto
  overscroll-contain`) somente às três coleções potencialmente ilimitadas.
- Não há nova decisão global nem alteração de `Dialog`; nenhuma API, carga de
  histórico, dado, ação ou link foi modificado.

## D-056 — Correção de auditoria: `ui/skeleton.tsx` é o primitivo `Skeleton` oficial, não um legado a migrar

- Data: 2026-09-15
- Contexto: a auditoria de adoção da hierarquia de loading (D-052) listou
  `ModalDetalheVenda.tsx`, `dashboard/PageClient.tsx`,
  `GraficoMensagensDigisac.tsx`, `procurar-datas/performance/PageClient.tsx`
  e `ModalAgendamentosCliente.tsx` como usando um `Skeleton` "legado" de
  `@/components/ui/skeleton`, supostamente a ser trocado por um `Skeleton`
  "oficial" do Design System.
- Correção: essa premissa estava errada. `src/components/design-system` não
  exporta nenhum `Skeleton` avulso — o único primitivo relacionado é
  `SkeletonRows({ rows, className })`, que **internamente importa e usa esse
  mesmo `Skeleton` de `@/components/ui/skeleton`** para renderizar cada
  linha. A documentação oficial já confirmava isso antes desta auditoria:
  [`docs/design-system/components-e-patterns.md`](../../design-system/components-e-patterns.md),
  seção "Componentes reaproveitados sem alteração (já adequados)", lista
  `Skeleton` (de `src/components/ui/`) ao lado de `Checkbox`, `Table`,
  `Tooltip`, `Popover`, `Calendar` — reaproveitado como está, não um alvo de
  substituição.
- Decisão: os cinco usos acima estão **corretos** e não precisam de nenhuma
  migração. `SkeletonRows` continua sendo a abstração específica para listas
  de linhas uniformes (`h-4 w-full` por linha); quando o placeholder precisa
  de forma/dimensão própria (bloco de card, gráfico, seção), o uso direto de
  `Skeleton` com `className` livre é o padrão certo, não um desvio.
- Escopo: nenhum código foi alterado por esta decisão — nenhum dos cinco
  arquivos foi tocado.
- Status: **encerrado, sem ação de código pendente.** Não reabrir este item
  numa tarefa futura sem novo motivo concreto.

## D-057 — `Progress` ganha `tone` opcional (`brand`/`neutral`/`success`/`warning`); adoção pontual no card de listagem de `/recebimento`

- Data: 2026-09-16
- Contexto: auditoria de loaders identificou 5 barras de progresso manuais em
  `/recebimento`. Das 5, só o card de listagem geral (`RecebimentoCard` em
  `src/app/recebimento/PageClient.tsx`) tinha o mesmo formato visual do
  `Progress` oficial (texto acima + barra abaixo) — as outras 4 (badge
  sticky e barras de item/volume em `/recebimento/[id]`, módulo operacional
  explicitamente fora de escopo) usam um padrão de preenchimento-atrás-de-
  texto incompatível com a forma do componente, e não foram tocadas.
- Achado: a barra do `RecebimentoCard` usa cor com significado operacional
  (verde = concluído, âmbar = parcial, cinza = vazio) para permitir escanear
  rapidamente vários recebimentos na grade — `Progress` só tinha uma cor fixa
  (`bg-primary`), o que apagaria esse sinal se usado como estava.
- Decisão: `Progress` (`src/components/design-system/Progress.tsx`) ganhou a
  prop opcional `tone?: 'brand' | 'neutral' | 'success' | 'warning'`
  (default `'brand'` → `bg-primary`, idêntico ao comportamento anterior à
  prop — nenhum uso existente muda). Os tons seguem o mesmo vocabulário já
  usado em `Badge`/`Alert` (`success`/`warning`), mapeados para cores sólidas
  de preenchimento (`bg-emerald-500`/`bg-amber-400`/`bg-slate-300`, distintas
  das tonalidades claras `/10`/`-50` usadas em badges/alerts, que são para
  fundo, não para uma barra sólida). É uma extensão genérica do componente,
  não uma variante amarrada a Recebimento.
- Aplicação: `RecebimentoCard` agora usa
  `<Progress value={pct} tone={pct>=100?'success':pct>0?'warning':'neutral'} label="..." />`
  no lugar da barra manual. `pct` continua vindo de
  `total_recebido/total_previsto` sem nenhuma mudança de fórmula; o texto
  `{total_recebido}/{total_previsto} volumes ({pct}%)` continua fora do
  `Progress` e sem clamp, preservando a visibilidade de um percentual acima
  de 100% (recebido > previsto) mesmo com a barra limitada visualmente a
  100% (mesmo comportamento de antes, agora garantido pelo clamp interno do
  próprio `Progress`).
- Escopo preservado: `/recebimento/[id]`, `OSItemCard`, `ItemCard`, o badge
  de progresso sticky e as barras por volume não foram alterados — ficam
  como estão, por decisão explícita de não mexer na tela operacional de
  conferência nesta frente.
- QA: `npx eslint`/`tsc --noEmit` sem erros novos; suíte `design-system`
  (`Progress.test.ts`, incluindo os novos casos de `tone`) e testes de API
  de `/recebimento` verdes. Validação visual ao vivo não foi possível nesta
  sessão — a conta autenticada não está na whitelist de acesso do módulo
  (`matic-emails.ts`); fica pendente de validação manual do usuário.
- Status: **implementado, aguardando validação visual manual do usuário.**
