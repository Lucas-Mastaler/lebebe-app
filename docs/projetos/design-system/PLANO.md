# Plano — Design System Le Bébé App

**Estado do planejamento:** DEFINIDO

## Fase 1 — Auditoria visual e técnica

Objetivo: entender o sistema atual (foundations, componentes, patterns) sem
alterar nenhuma tela existente, para alimentar as alternativas da Fase 2.
Dependências: nenhuma.

- [x] Levantar foundations (`src/app/globals.css`, ausência de config
      `tailwind.config.*` — Tailwind v4 via `@theme inline`).
- [x] Levantar componentes base existentes (`src/components/ui/*`).
- [x] Auditar `/pedidos-personalizados` em detalhe (page header, cards,
      tabela, filtros, formulário, modais, badges, tipografia, espaçamento,
      responsividade, especificidades de "gosto local").
- [x] Auditar amostra representativa de outras telas: dashboard/KPIs,
      listagem/tabela com filtros, formulário/modal, Recebimento (só
      visual), navegação/Sidebar, uso de ícones.
- [x] Levantar uso de cores hardcoded (fora dos tokens do tema) como
      inconsistência.
- [x] Consolidar tudo em `AUDITORIA.md`.

Critérios de conclusão: `AUDITORIA.md` existe e cobre todas as seções do
pedido do usuário (foundations, componentes, patterns, avaliação de
`/pedidos-personalizados`, boas práticas a preservar, inconsistências).
Validações necessárias: nenhuma alteração de código nesta fase — só leitura.

## Fase 2 — Design System Lab (página `/design-system`)

Objetivo: página real e funcional para o usuário comparar 3 alternativas por
decisão de design e selecionar sua preferência, gerando um resumo copiável.
Dependências: Fase 1 concluída (alimenta as alternativas propostas).

- [x] Definir proteção de acesso da página sem migration (D-001) —
      `requireAuthenticatedUser({ requireActive: true, requiredRole: 'superadmin' })`.
- [x] Estruturar a página em categorias A–I (Identidade visual/Foundations,
      Ações, Formulários, Navegação, Containers, Dados, Feedback, Status,
      Patterns) com componentes auxiliares isolados em
      `src/app/design-system/_lab/`, sem tocar componentes usados pelas
      telas existentes.
- [x] Implementar cada decisão com exatamente 3 alternativas reais
      renderizadas (18 decisões ao todo — ver `DECISOES.md` D-002), mesmo
      conteúdo/contexto entre elas, código curto e seleção única A/B/C via
      `role="radiogroup"`/`role="radio"` com navegação por teclado.
- [x] Implementar previews desktop/mobile lado a lado na decisão `TBL`
      (`ResponsivePreview` — reflow real, não redução proporcional).
- [x] Implementar persistência local da seleção (localStorage,
      `le-bebe-design-system-lab-v1`) e área "MINHAS ESCOLHAS" com resumo
      automático + botão "Copiar escolhas".
- [x] Validar lint (`npm run lint`) e typecheck (`npx tsc --noEmit`) — sem
      erros novos. Validado em desktop e viewport mobile (375px) via
      Browser pane, usando rota temporária sem gate de auth só para QA
      (criada e removida na mesma tarefa — ver `STATUS.md`).
- [x] Confirmar que nenhuma tela existente mudou de comportamento — apenas
      arquivos novos foram criados; nenhum arquivo existente foi alterado.

Critérios de conclusão: página `/design-system` funcional, com todas as
categorias do pedido, seleção interativa, resumo e cópia funcionando, sem
regressão nas telas existentes.
Validações necessárias: lint, build/typecheck, teste manual de seleção e
cópia, teste de responsividade (375px), reload preservando seleção.

## Fase 2.5 — Padrões de comportamento e interação

Objetivo: complementar as decisões visuais (A–I) com uma camada de
Interaction Standards — como o sistema se comporta, não só como aparece —
sem consolidar o Design System v1 nem migrar telas existentes.
Dependências: Fase 2 concluída; as 18 escolhas visuais do usuário
recebidas e registradas (D-004).

- [x] Registrar as 18 escolhas visuais como aprovadas (D-004) e preencher
      `localStorage` de forma não-destrutiva via `_lab/presets.ts`.
- [x] Adicionar `kind: 'open' | 'fixed'` ao registry (`registry.ts`),
      distinguindo regra já aprovada de decisão em aberto.
- [x] Criar `FixedRuleBlock` (código + nome + regra + exemplo + selo
      "APROVADA", sem alternativas) e registrar `FLT-EXEC=MANUAL` (D-005).
- [x] Criar nova categoria J ("Comportamento e Interação") com 17 decisões
      abertas em 11 subgrupos temáticos (accordion `<details open>`,
      sub-navegação própria) — organização registrada em D-006:
      `FLT-CLR`, `VAL`, `ERR`, `REQ`, `MSK` (+ tabela de referência não
      votável para CPF/CNPJ/telefone/CEP/moeda/percentual/data/hora/
      quantidade/decimal), `SAV`, `UNS`, `DST`, `FDB`, `LDG`, `KBD` (+ nota
      técnica fixa sobre Escape/Tab/foco), `CMB`, `DAT`, `ROW` (+ aviso não
      votável sobre reset de paginação), `MOD`, `PER`, `MOB`.
- [x] Implementar demos funcionais reais com estado local (sem backend)
      para as decisões onde o comportamento só se prova ao vivo: `VAL`,
      `SAV`, `UNS`, `DST` (toast com desfazer via `sonner`), `FLT-EXEC`,
      `FLT-CLR`, `LDG`, `CMB`, `KBD`, `ROW` (hover), `MOD` (Dialog real).
- [x] Integrar ao sistema de escolhas existente: resumo agora separa
      `VISUAL` de `COMPORTAMENTO`; regra fixa sempre aparece com o valor
      aprovado; decisão aberta só aparece no resumo quando respondida.
      Contadores diferenciam regras aprovadas de decisões abertas
      respondidas.
- [x] Corrigir bug relatado pelo usuário em `TBL` (preview mobile vazando
      da borda do card — D-008) antes de prosseguir para a Fase 2.5.
- [x] Validar lint (`npm run lint`) e typecheck (`npx tsc --noEmit`) — sem
      erros novos.
- [ ] Validação visual (desktop, mobile, interações, persistência, resumo,
      "Copiar escolhas") — **feita pelo próprio usuário**, não pelo agente
      (pedido explícito — ver `STATUS.md`, "Não refazer").

Critérios de conclusão: categoria J funcional e integrada ao mesmo sistema
de seleção/persistência/resumo da Fase 2, sem alterar nenhuma escolha
visual já feita, sem tocar telas existentes.
Validações necessárias: lint, typecheck; validação visual pelo usuário.

## Fase 3 — Consolidação do Design System Le Bébé v1

Objetivo: transformar as 35 decisões aprovadas (18 visuais + 17 de
comportamento) numa implementação oficial, documentada, reutilizável e
parametrizada — fundação para migrações futuras, sem migrar nenhuma tela
existente ainda.
Dependências: Fase 2.5 concluída; usuário enviou todas as escolhas
(D-009), incluindo os ajustes definitivos de `ERR`, `SAV`, `DAT` (D-010).

- [x] Registrar as 35 escolhas como definitivas e os 3 ajustes (D-009, D-010).
- [x] Foundations: tokens `--success`/`--warning`/`--info` + utilitária
      `.ds-elevation-glow` (SHD=C) adicionados em `globals.css`, aditivos
      (D-012); radius/tipografia/espaçamento formalizados como papéis
      semânticos (`src/lib/design-system/typography.ts` +
      `docs/design-system/foundations.md`) sem token CSS novo onde o
      Tailwind já basta.
- [x] Lógica pura testável em `src/lib/design-system/`: `masks.ts`,
      `dates.ts`, `async-action.ts`, `filters.ts`, `errors.ts`,
      `validation.ts` — 37 testes (`*.test.ts`), todos passando.
- [x] Componentes oficiais em `src/components/design-system/`: `Button`/
      `IconButton` (BTN=B + loading bloqueado), `Card` (CRD=C+SHD=C),
      `Badge` (STA=A), `Alert` (FBK=A + banner de servidor do ERR
      ajustado), `PageHeader` (HDR=A), `SegmentedTabs*` (TAB=C, sobre o
      `Tabs` do Radix existente), `KpiCard` (KPI=B), `EmptyState`/
      `Spinner`/`SkeletonRows` (EST=B/LDG=A), `Textarea`, `FormField`
      (REQ=C + ERR inline), `FormErrorSummary` (resumo do ERR
      ajustado), `DateField` (DAT=A ajustado — digitação + ícone),
      `Combobox` (CMB=B), `FilterPanel`+`useFilterState` (FLT=A,
      FLT-EXEC=MANUAL, FLT-CLR=C), `ResponsiveTable` (TBL=B+ROW=A),
      `MobileActionBar` (MOB=A), `ConfirmDialog` (DST=A),
      `UnsavedChangesNotice` (UNS=B), `useAsyncAction` (SAV=A ajustado).
      `src/components/ui/*` não foi alterado (D-011).
- [x] Patterns em `src/components/design-system/patterns/`: `FormSection`
      (PFM=B), `KpiSection` (PKS=A); PLS=A documentado como guia de
      composição (`PageHeader`+`FilterPanel`+`ResponsiveTable`), sem
      componente monolítico.
- [x] Documentação canônica em `docs/design-system/` (`README.md`,
      `foundations.md`, `components-e-patterns.md`,
      `interaction-standards.md`) — fonte única, sem duplicar o histórico
      de decisão do Projeto Multifase.
- [x] Harness: `.agents/rules/design-system.md` + linha nova em
      `AGENTS.md` §7 (D-014).
- [x] `/design-system` evoluído para referência viva: banner corrigido
      (não diz mais "nada é oficial"), nova seção "Referência oficial"
      usando os componentes reais criados nesta fase, resumo de
      Interaction Standards, presets atualizados com as 17 escolhas de
      comportamento (histórico A–J preservado, não apagado).
- [x] Validar lint (`npm run lint`) e typecheck (`npx tsc --noEmit`) — sem
      erros novos. Suíte completa (`npx vitest run`): as únicas falhas
      são 19 testes pré-existentes em 5 arquivos não relacionados
      (`procurar-datas`, `modulos-app`, `atendimento-automatico`) — não
      tocados nesta tarefa.
- [x] Validação visual (desktop, mobile, overflow, foco, calendário,
      resumo de erros) — feita pelo agente numa tarefa seguinte, por
      pedido explícito ("desta vez é obrigatória"), com 2 ajustes finais
      (D-015, D-016) e 1 bug real corrigido (D-017).

Critérios de conclusão: ver `ESCOPO.md`, "Critérios de aceite — Fase 3".
Validações necessárias: lint, typecheck, testes (`src/lib/design-system`),
validação visual — concluída.

## Ajustes finais pós-Fase 3 (2026-09-11)

Objetivo: dois ajustes pontuais sobre o já consolidado, sem reabrir
nenhuma decisão de aparência/comportamento: `INP=A` (D-015, superfície do
campo) e uma Foundation nova de Layout/Page Container (D-016), mais
validação visual obrigatória desta vez.

- [x] `Input` novo componente com `bg-input-background`; `Textarea`,
      `DateField`, `Combobox` atualizados para a mesma superfície.
- [x] Token `--input-background` (aditivo) em `globals.css`.
- [x] `PageContainer` (`patterns/`) com gutters 16/24/32px, cancelando o
      padding ambiente do `LayoutWrapper` (não alterado).
- [x] `/design-system` → "Referência oficial": seções "Superfície do
      campo" e "Layout / Page Shell".
- [x] Documentação (`foundations.md`, `components-e-patterns.md`,
      `README.md`) atualizada.
- [x] Validação visual real pelo agente — overflow (375/800/desktop),
      superfície do campo, foco. Bug de overflow em `TBL` encontrado e
      corrigido (D-017, `min-w-0` em `DecisionBlock.tsx`).
- [x] Lint, typecheck, testes (`src/lib/design-system`, 37/37) sem erros
      novos.

Com isso, a Fase 3 é considerada encerrada — Design System Le Bébé v1
pronto para a Fase 4.

## Fase 4 — Piloto de adoção do Design System

Objetivo: migrar SOMENTE a camada visual/UX de `/chamados-finalizados`
para o DS v1, preservando toda regra de negócio/API/permissão, e avaliar
se o DS v1 é sustentável antes de ampliar a adoção.
Dependências: Fase 3 encerrada.

- [x] Auditoria da tela real (arquivo principal, componentes filhos, API,
      filtros, estados) antes de alterar.
- [x] Migração de `PageClient.tsx` (`PageContainer` + `PageHeader`),
      `FiltrosChamadosFinalizados.tsx` (`FilterPanel` + `DateField` +
      `Input`/`Button` do DS + `Checkbox` de `ui/`),
      `TabelaChamadosFinalizados.tsx` (`ResponsiveTable` + `Badge` +
      `EmptyState` + `Alert` + `Card`), `CelulaObservacao.tsx` (toque
      leve). `ModalAgendamentosCliente.tsx` deliberadamente fora do
      escopo (fronteira registrada, D-018 a D-024 em `DECISOES.md`).
- [x] Extensões genéricas no DS onde necessário:
      `ResponsiveTable.rowClassName/stickyHeader/firstColumnSticky`,
      `FilterPanel.applyDisabled`, correção de `ref` em `Input`.
- [x] Lacuna registrada sem solução forçada: multi-select com busca.
- [x] Validação funcional (filtros, máscara, popover, limpar, erro real
      via API) e visual real (desktop/tablet/mobile, gutter
      `PageContainer`×`LayoutWrapper` medido nos 3 breakpoints).
- [x] Lint, typecheck, testes do DS — sem regressão.
- [x] Classificação do piloto: **B — aprovado com pequenos ajustes**.
- [x] Nenhuma segunda tela iniciada; recomendação de próximas 2-3
      candidatas registrada em `STATUS.md`.

Critérios de conclusão: ver `DECISOES.md` D-018 a D-024 e `STATUS.md`.
Validações necessárias: lint, typecheck, testes do DS, validação
funcional e visual — todas concluídas.

### Refinamento pós-piloto (uso manual real, 2026-09-12)

Três regras globais achadas usando `/chamados-finalizados` manualmente,
transformadas em regras do DS (não corrigidas só na tela):

- [x] Filtros preenchem a linha — `FilterFieldGroup` reescrito em
      flexbox (D-025); CSS Grid `auto-fit` testado e descartado.
- [x] Container clipping — radius direto no cabeçalho/última linha de
      `ResponsiveTable`, sem `overflow-hidden` (D-026).
- [x] Arrastar tabela com o mouse — `/inteligencia-comercial` auditada
      (classificação B), extraída para `useHorizontalDragScroll` +
      lógica pura testada (9 testes), integrada ao `ResponsiveTable`
      (D-027). `/inteligencia-comercial` não alterada.
- [x] `/chamados-finalizados` herdou os 3 ajustes sem alteração própria.
- [x] Validação funcional/visual real (medições de layout, radius,
      simulação de drag via `PointerEvent`) em ambas as telas.
- [x] Classificação final revisada: **A — DS atendeu naturalmente após
      refinamento de piloto** (D-028), justificada, não artificial.

### Segundo refinamento pós-piloto (uso manual real, 2026-09-12)

Dois bugs adicionais achados no mesmo uso manual, corrigidos como regras
globais; duas decisões de cor apresentadas como alternativas (não
decididas):

- [x] TABLE-VIEWPORT-CLIP — radius por célula (D-026) provou não ser
      estrutural (o canto errado trocava de lado conforme a posição de
      scroll). Corrigido com OUTER SHELL (`clip-path`) + INNER SCROLLER
      (`overflow-x-auto`) em `ResponsiveTable` (D-029).
- [x] `overflow-hidden`/`overflow-clip` testados contra `stickyHeader` —
      confirmados quebrando de verdade (não só por suposição), como o
      pedido exigiu (D-029).
- [x] Achado durante o teste: `stickyHeader` nunca esteve de fato preso à
      rolagem da página, mesmo antes desta tarefa (limitação de CSS, não
      do componente) — corrigido com scroll vertical interno limitado
      (`max-h-[70vh]`) (D-029).
- [x] NO-OVERLAP — causa raiz do bug do modal "Ver agendamentos"
      identificada (disputa de `z-index` entre header `sticky` e botão
      fechar). `Dialog`/`DialogHeader`/`DialogBody` oficiais criados com
      header em flexbox, fora da área de scroll (D-030).
      `ModalAgendamentosCliente.tsx` migrado.
- [x] CLR/SEC — auditoria de `/inteligencia-comercial` (`ModalDetalheVenda`,
      componente `Section`) usada para informar `SEC=C`. Duas decisões
      A/B/C adicionadas ao Lab (`/design-system`), nenhuma pré-selecionada
      (D-031). **Permanecem PENDENTES** — não decididas nesta tarefa.
- [x] Validação real (não suposição): `PointerEvent` sintético, `scrollTop`/
      `scrollLeft` diretos, `getBoundingClientRect`/`getComputedStyle` —
      radius em qualquer posição de scroll, `stickyHeader`,
      `firstColumnSticky`, drag, NO-OVERLAP (título curto/longo,
      desktop/mobile). Dado real de `/chamados-finalizados` não pôde ser
      validado (API exige autenticação que a rota de QA temporária não
      contorna) — registrado como limitação em STATUS.md, não contornado.
- [x] Classificação do piloto mantida em **A** (não houve necessidade de
      rebaixar — os 2 bugs foram absorvidos pela camada do DS sem lógica
      nova específica da tela).

### Consolidação final da Fase 4 (2026-09-12) — Fase 4 ENCERRADA

Decisões definitivas + último refinamento técnico da tabela, disparados
por validação manual do usuário sobre a rodada anterior:

- [x] `CLR=B`/`SEC=C` consolidadas como oficiais — sem A/B/C reapresentado
      (D-032). Tokens em `section-tones.ts`, componente `Section.tsx`.
- [x] Bug real de radius diagnosticado por inspeção (não assumido):
      `clip-path` hardcoded (16px) divergia do radius real do container
      (`rounded-2xl` = 20px) — causa do canto "apagado". Corrigido com
      arquitetura de 3 camadas (OUTER SHELL / INNER CLIP / HORIZONTAL
      SCROLLER), mesma classe de radius em ambas as camadas que desenham
      curva (D-033).
- [x] `max-h-[70vh]` removido — usuário testou e reprovou "scroll dentro
      de scroll". Tabelas voltam a crescer livremente; página rola
      (D-034, TABLE-NO-INTERNAL-VSCROLL).
- [x] Paginação oficial: 20 registros/página, backend-enforced
      (`TABLE_PAGE_SIZE`/`clampPageSize`), aplicada em
      `/chamados-finalizados` (D-035).
- [x] Zebra sutil por padrão em `ResponsiveTable`, com `rowClassName`
      sempre tendo precedência sobre o zebra (nunca mistura) (D-036).
- [x] `Dialog` (NO-OVERLAP) testado pelo usuário e reconfirmado aprovado
      — nenhuma alteração de código (D-037).
- [x] Validação real: radius/borda em 3 posições de scroll, ausência de
      scroll vertical interno, zebra + precedência, drag, CLR/SEC no
      Lab, mobile 375px, modal. Achado fora de escopo registrado (não
      corrigido): overflow de página pré-existente na decisão `TBL`.
- [x] Fase 4 considerada ENCERRADA — próxima decisão fica com o usuário
      (iniciar Fase 5 ou não).

## Fase 5 — Migração gradual (em andamento)

Princípio: migrar uma tela por vez, preservando comportamento. A validação
manual do usuário promove uma tela a `APROVADA`, mas uma tela
`PRONTA_PARA_VALIDACAO_MANUAL` não bloqueia a próxima elegível da fila.

- [x] Consolidar `/chamados-finalizados` como primeira referência da Brand
      Foundation (D-043 a D-045).
- [x] Reproduzir e corrigir estruturalmente a falha de emissão de CSS dos
      `rowTone`, com QA real de sticky/zebra/hover em desktop e mobile
      (D-046).
- [x] Obter a validação manual do usuário sobre `/chamados-finalizados`.
- [x] Migrar `/digisac/finalizacoes-automaticas` como segunda tela, sem
      iniciar outra tela.
- [x] Obter a validação visual manual do usuário sobre
      `/digisac/finalizacoes-automaticas` antes de escolher a próxima tela.
- [x] Migrar `/agendamentos` como terceira tela, reutilizando o DS existente
      e preservando a tabela ampla, sem iniciar outra tela.
- [ ] Obter QA real em tablet e mobile (~375px) de `/agendamentos` quando
      houver sessão disponível; a tela pode aguardar validação manual sem
      bloquear a fila.
- [x] Migrar `/inteligencia-comercial`; tecnicamente pronta para validação
      manual complementar.
- [x] Migrar `/dashboard`; tecnicamente pronta para validação manual.
- [x] Migrar `/hub-vendas` (quarta tela), incluindo conversão dos filtros
      de listagem para `FLT-EXEC=MANUAL` (D-047); tecnicamente pronta,
      QA visual manual pendente (bloqueio de permissão da conta técnica
      de QA — não é bloqueio da tela).
- [x] Formalizar `FORM-PAGE-WIDTH`: `FormPageContent` centraliza apenas
      conteúdo de formulário, preservando `PageContainer` full-width;
      aplicado em `/pedidos-personalizados/novo`, documentado e demonstrado
      em `/design-system` (D-050).
- [x] Formalizar `LoadingLeBebe`: estrela SVG escalável como indicador de
      marca complementar a `LDG=A`, documentada e demonstrada em seis tamanhos
      na referência viva (D-052), sem substituir loaders existentes.

A partir desta tarefa, a migração passou a ser conduzida manualmente
(automação recorrente encerrada pelo usuário — ver `STATUS.md`,
"Processo vigente"): cada novo chat recebe uma tela, com expectativa de
concluí-la por completo (auditoria → implementação → revisão de
hardcodes → testes → QA → `PRONTA_PARA_VALIDACAO_MANUAL`) na mesma
tarefa.

### Fila operacional de migração

`STATUS.md` é a fonte do estado vigente; esta lista preserva a ordem
aprovada da fila.

1. `/horarios-agendamentos` — PRONTA_PARA_VALIDACAO_MANUAL (QA mobile real pendente)
2. `/inteligencia-comercial` — PRONTA_PARA_VALIDACAO_MANUAL (validação complementar com chamadas de IA reais, quando disponível)
3. `/dashboard` — PRONTA_PARA_VALIDACAO_MANUAL (QA visual manual pendente)
4. `/hub-vendas` — PRONTA_PARA_VALIDACAO_MANUAL (QA visual manual pendente — ver D-047)
5. `/pedidos-personalizados` — PRONTA_PARA_VALIDACAO_MANUAL (QA visual manual pendente — ver D-048)
6. `/atendimento-presencial/ficha` — PRONTA_PARA_VALIDACAO_MANUAL (migração técnica concluída; validar manualmente fluxo completo)
7. `/atendimento-presencial/registros?tab=finalizados` — PRONTA_PARA_VALIDACAO_MANUAL
8. `/atendimento-presencial/clientes` — PRONTA_PARA_VALIDACAO_MANUAL

## Fase 5.1 — Consolidação pós-validação manual (concluída tecnicamente)

- [x] Consolidar headers tonais de Card/FilterPanel, Sections opcionais
      colapsáveis, sequência canônica, Dialog e affordance de cursor.
- [x] Corrigir action bar/scroll da Ficha, cards/paginação/dialog de Registros
      e cards/histórico de Clientes.
- [x] Corrigir MultiSelect, filiais, sections e affordances de Inteligência.
- [x] Rodar regressão estática proporcional e preparar nova validação manual.

## Fase 5.2 — Segunda estabilização pós-validação manual (concluída tecnicamente)

- [x] Eliminar a divergência de hidratação da Ficha entre o estado inicial do
      servidor e a leitura de `window.location.search` no cliente, sem mover a
      restauração/autosave para fora do efeito pós-hidratação.
- [x] Separar Identificação e crianças, Necessidades, Produtos, Resultado e
      condições e Observações no modal de edição de Registros com subseções
      recolhíveis independentes que não desmontam o conteúdo oculto.
- [x] Confirmar o contrato do Dialog para viewport baixa e conteúdo alto; não
      alterar o componente compartilhado sem falha estrutural reproduzível.
- [x] Tornar todo o campo MultiSelect acionável e portalizar sua lista para
      escapar do `overflow-hidden` de FilterPanel, com altura limitada e scroll
      interno; demonstrar a variante longa na referência viva.
- [x] Rodar lint, testes focados, typecheck de regressão e QA em navegador
      proporcional; registrar limitações de dados reais para validação manual.

### Correção dirigida — histórico longo de Clientes (concluída tecnicamente)

- [x] Reproduzir em `/atendimento-presencial/clientes` com LUCAS MASTALER e
      medir a cadeia real do modal, sem usar somente o laboratório.
- [x] Corrigir a grade implícita do `DialogBody`, que encolhia as seções com
      `overflow-hidden` e escondia conteúdo sem aumentar o `scrollHeight` do
      scroller principal.
- [x] Aplicar `SCROLL-BOUNDED-LIST` às coleções de atendimentos, compras SGI e
      pedidos personalizados; listas curtas mantêm altura natural.
- [x] Validar em desktop que body e lista interna possuem scroll real e que o
      botão Fechar permanece acessível; rodar lint, testes focados e diff-check.
- [x] Validar manualmente em viewport ~375px; correção aprovada pelo usuário
      após a validação manual.

### Correção dirigida — largura do filtro de Clientes

- [x] Corrigir somente o `SelectTrigger` de Consultora de origem para ocupar o
      slot flexível já fornecido por `FilterFieldGroup`, sem alterar o padrão
      compartilhado nem o modal de histórico.
- [ ] Obter validação manual da correção visual em `/atendimento-presencial/clientes`.
