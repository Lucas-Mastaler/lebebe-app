# Escopo — Design System Le Bébé App

**Estado:** APROVADO

## Objetivo

Construir, de forma incremental e multifase, um Design System próprio para o
Le Bébé App — fundação visual (tokens), componentes e patterns reutilizáveis
para desktop, tablet e mobile — usando a stack já existente (TailwindCSS v4,
Radix UI, Lucide, CVA, clsx, tailwind-merge), evitando adotar uma lib visual
grande (Material UI, Ant Design etc.) sem justificativa extremamente forte.

Esta é a Fase 1 (Auditoria) + Fase 2 (Design System Lab / seletor interativo)
+ Fase 2.5 (Padrões de comportamento e interação) + Fase 3 (Consolidação do
Design System Le Bébé v1) de uma iniciativa maior. A Fase 3 transforma as
35 decisões aprovadas (18 visuais + 17 de comportamento) em tokens,
componentes, patterns e Interaction Standards oficiais, reutilizáveis e
documentados — **sem migrar nenhuma tela operacional existente ainda**.
A Fase 4 (piloto de adoção numa primeira tela real) **não faz parte** deste
escopo e só deve começar depois de decisão humana explícita.

**Aditivo aprovado — consolidação pós-validação manual (2026-09-15):** sem
iniciar telas novas, esta etapa curta pode consolidar contratos globais do DS
e corrigir exclusivamente `/atendimento-presencial/ficha`,
`/atendimento-presencial/registros?tab=finalizados`,
`/atendimento-presencial/clientes` e `/inteligencia-comercial`, inclusive
paginação backend e um defeito de HTML/hydration compartilhado.

## Problema resolvido

Hoje o sistema não tem um Design System documentado: não existe `Card` nem
`Badge` reutilizáveis em `src/components/ui/`, várias páginas reinventam
padrões visuais próprios (cores hardcoded fora do tema, radius/spacing
inconsistentes), e `/pedidos-personalizados` — hoje a referência visual mais
próxima do gosto do usuário — nunca foi validada como padrão oficial nem
comparada com alternativas.

## Comportamento esperado

- Fase 1: auditoria do frontend atual (foundations, componentes, patterns),
  sem alterar nenhuma tela existente.
- Fase 2: página interna `/design-system` (Design System Lab) que apresenta,
  para cada decisão de design relevante, exatamente 3 alternativas
  renderizadas de verdade (não descrições em texto), com seleção única
  A/B/C, resumo automático das escolhas e botão "Copiar escolhas".
- Fase 2.5: nova categoria J ("Comportamento e Interação") na mesma página,
  com dois tipos de item — regra já definida pelo usuário (sem A/B/C,
  marcada "APROVADA", ex. `FLT-EXEC=MANUAL`) e decisão em aberto (A/B/C,
  igual às demais categorias). Resumo unificado agora separa VISUAL de
  COMPORTAMENTO.
- Fase 3: as 35 decisões (18 visuais + 17 de comportamento, mais os 3
  ajustes definitivos de `ERR`/`SAV`/`DAT`) tornam-se o Design System
  Le Bébé v1 — implementado como tokens (`src/app/globals.css`, aditivo),
  lógica pura testável (`src/lib/design-system/`), componentes
  (`src/components/design-system/`) e documentação canônica
  (`docs/design-system/`). `/design-system` passa a funcionar também como
  referência viva do padrão aprovado, sem apagar o histórico de
  comparação A–J.

## Regras de negócio

Não aplicável — este projeto é puramente de frontend/UI, sem regra de
negócio nova. Nenhuma alteração de banco, migration, auth ou regra de
negócio está no escopo desta tarefa (restrição explícita do usuário).

## Entradas

- Código real do repositório (`src/app/`, `src/components/`, `src/app/globals.css`).
- Preferências visuais do usuário, capturadas via seleção na página `/design-system`.

## Saídas

- Relatório de auditoria (`AUDITORIA.md` neste projeto).
- Página funcional em `/design-system` com decisões comparáveis.
- Resumo copiável de escolhas (texto simples, formato `COD=OPCAO`).

## Permissões

Página `/design-system` restrita a usuários autenticados com role
`superadmin` (ver `DECISOES.md` D-001) — sem criar módulo novo em
`app_modulos`, sem migration, para respeitar a restrição de não alterar
banco/auth nesta tarefa. Não está registrada na Sidebar/menu (acesso direto
por URL).

## Integrações relevantes

Nenhuma integração externa. Persistência da seleção do usuário é local
(localStorage do navegador), sem backend nesta primeira versão.

## Restrições

- Não migrar/alterar visualmente nenhuma página operacional existente
  (`/pedidos-personalizados`, Recebimento, Hub Vendas, Inteligência
  Comercial, dashboards, etc.) — nem mesmo indiretamente, via alteração
  de `src/components/ui/*` (ver `DECISOES.md` D-011).
- Não fazer refactor paralelo de componentes existentes.
- Não fazer migration de banco, alteração de auth ou regra de negócio.
- Priorizar a stack existente; não introduzir lib visual grande sem
  justificativa forte (nenhuma foi identificada até aqui).
- Não reapresentar nem reinterpretar as 35 decisões já aprovadas.
- Quando uma lacuna não estiver coberta por uma decisão aprovada,
  documentar como pendência em vez de inventar um padrão novo.

## Dentro do escopo

- Auditoria de foundations, componentes e patterns em uma amostra
  representativa de telas (ver `AUDITORIA.md`).
- Página `/design-system` com categorias A–J (ver `PLANO.md`) — mantida
  como registro histórico de comparação, com as 35 escolhas já refletidas.
- **Fase 3:** tokens oficiais (`globals.css`, aditivo), lógica pura
  testável (`src/lib/design-system/`), componentes oficiais
  (`src/components/design-system/`), patterns (`FormSection`,
  `KpiSection`, guia de composição de listagem), documentação canônica
  (`docs/design-system/`), integração ao Harness
  (`.agents/rules/design-system.md` + `AGENTS.md` §7), evolução de
  `/design-system` para referência viva (seção "Referência oficial").
- Testes proporcionais da infraestrutura crítica do DS (loading
  bloqueado, resumo de erros, filtro manual, validação de data, máscaras).
- Responsividade real de tudo o que foi criado (desktop/mobile).
- Preenchimento não-destrutivo das 35 escolhas já feitas, para não
  perdê-las num navegador diferente.

## Fora do escopo

- Migração de qualquer tela existente para os componentes/padrões do DS
  v1 (Fase 4, futura, não iniciada).
- Qualquer alteração funcional em `/pedidos-personalizados`, Recebimento,
  Hub Vendas, Inteligência Comercial ou qualquer outra tela operacional.
- Registro da página `/design-system` em `app_modulos` / Sidebar /
  sistema de permissões por perfil (decisão pendente, não tomada).
- Substituição massiva de cor de marca hardcoded pelas telas existentes
  (achado da auditoria — token correto já existe, mas a migração fica
  para depois).
- `RadioGroup`/`Switch` como componentes do DS (nenhuma decisão aprovada
  cobriu o visual deles — registrado como pendência, não inventado).
- Infraestrutura de teste de renderização de componente (`jsdom`/RTL) —
  não instalada; testes desta fase cobrem a lógica pura extraída (ver
  `DECISOES.md` D-013).

## Critérios de aceite

Fase 1/2/2.5 (concluídos em tarefas anteriores):

- [x] `AUDITORIA.md` cobre foundations, componentes, patterns, amostra de
      telas (incluindo `/pedidos-personalizados` e Recebimento — só visual).
- [x] Página `/design-system` acessível, funcional, protegida por
      autenticação + role superadmin.
- [x] Categorias A–J com decisões A/B/C ou regra fixa, resumo automático,
      "Copiar escolhas", persistência local, responsivo.

Fase 3 (esta tarefa):

- [x] Todas as escolhas visuais e comportamentais consolidadas (D-009).
- [x] `ERR` com resumo no topo + inline + banner de servidor (D-010).
- [x] `SAV` bloqueia o botão em loading (D-010).
- [x] `DAT` permite digitação manual + ícone de calendário (D-010).
- [x] `FLT-EXEC` continua manual, estruturalmente garantido pela API do
      `FilterPanel`/`useFilterState` (testado).
- [x] Tokens oficiais existem, aditivos (D-012).
- [x] Componentes oficiais necessários estão estruturados
      (`src/components/design-system/`).
- [x] Patterns oficiais estão estruturados
      (`src/components/design-system/patterns/`).
- [x] Interaction Standards documentados
      (`docs/design-system/interaction-standards.md`).
- [x] `/design-system` representa o padrão aprovado (seção "Referência
      oficial" + banner corrigido).
- [x] Harness direciona agentes futuros ao Design System (D-014).
- [x] Nenhuma tela operacional foi migrada.
- [x] Nenhuma regra de negócio foi alterada.
- [x] Nenhuma migration/banco/auth foi alterado.
- [x] Validações técnicas (lint, typecheck, testes) passaram
      proporcionalmente — sem erros novos.
- [x] Documentação multifase (`ESCOPO.md`/`PLANO.md`/`STATUS.md`/
      `DECISOES.md`) atualizada.
- [x] Validação visual — feita pelo agente nesta tarefa específica, por
      pedido explícito do usuário ("desta vez é obrigatória"); a
      preferência padrão (usuário valida) volta a valer depois desta
      tarefa, salvo pedido em contrário. Ver D-017 (bug real encontrado e
      corrigido durante essa validação).

Ajustes finais sobre a Fase 3 (mesma tarefa que fechou este critério):

- [x] `INP=A` — ajuste de superfície do campo (D-015).
- [x] Layout / Page Container oficial, nova Foundation (D-016).

## Decisões funcionais já aprovadas

- D-001 — proteção da página `/design-system` sem migration.
- D-004 — as 18 escolhas visuais (A–I) enviadas pelo usuário.
- D-005 — `FLT-EXEC=MANUAL`, regra de comportamento aprovada.
- D-009 — as 35 decisões (visuais + comportamento) são definitivas —
  Design System Le Bébé v1.
- D-010 — ajustes definitivos de `ERR`, `SAV`, `DAT`.
- D-011 — nova camada `src/components/design-system/`, `ui/` intocado.
- D-012 — tokens novos em `globals.css`, só aditivos.
- D-013 — testes cobrem lógica pura, não renderização.
- D-014 — Harness aponta para o Design System via
  `.agents/rules/design-system.md` + `AGENTS.md` §7.
- D-015 — `INP=A`: ajuste de superfície do campo (`--input-background`).
- D-016 — Layout / Page Container oficial (gutters 16/24/32px).
- D-017 — bug de overflow horizontal em `TBL` corrigido durante a
  validação visual obrigatória desta tarefa.

Ver `DECISOES.md` para o detalhe completo de cada uma.
