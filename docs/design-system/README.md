# Design System Le Bébé App — v1

Existe um Design System oficial para o Le Bébé App. Antes de criar um
padrão visual ou de comportamento novo numa tela, **verifique aqui
primeiro**.

> Esta é a documentação técnica canônica (o "o que é e como usar"). O
> histórico de como cada decisão foi tomada, as alternativas comparadas e
> o processo de aprovação vivem em `docs/projetos/design-system/`
> (Projeto Multifase) — não duplicado aqui.

## O que já existe

| Camada | Onde vive | Doc |
|---|---|---|
| **Foundations** (tokens: cor, radius, elevação, tipografia, espaçamento, layout/gutters) | `src/app/globals.css` (tokens CSS) + `src/lib/design-system/typography.ts` (papéis tipográficos) + `PageContainer` (layout) | [foundations.md](foundations.md) |
| **Components** (Button, Card, Badge, Alert, FormField, DateField, Combobox, FilterPanel, ResponsiveTable, ...) | `src/components/design-system/*.tsx` | [components-e-patterns.md](components-e-patterns.md) |
| **Patterns** (composições recorrentes: formulário em seções, seção de KPIs, listagem completa) | `src/components/design-system/patterns/*.tsx` + guias de composição | [components-e-patterns.md](components-e-patterns.md) |
| **Interaction Standards** (regras de comportamento — filtros, validação, salvar, erros, datas, etc.) | Aplicadas via a API dos componentes acima; regras descritas em prosa | [interaction-standards.md](interaction-standards.md) |
| **Lógica pura testável** (máscaras, validação de data, reducers de filtro/ação assíncrona) | `src/lib/design-system/*.ts` (com `*.test.ts` ao lado) | [foundations.md](foundations.md) / [interaction-standards.md](interaction-standards.md) |
| **Laboratório de decisão** (como as 36 decisões foram comparadas e escolhidas) | `/design-system` (rota da aplicação) | Ver `docs/projetos/design-system/` |

## Compatibilidade — leia antes de mexer em qualquer coisa aqui

`src/components/ui/*` (o `Button`, `Input`, `Select`, `Tabs`, `Dialog`,
`Table` etc. já existentes, estilo shadcn) **continua em uso por todas as
telas operacionais atuais** (`/pedidos-personalizados`, Recebimento, Hub
Vendas, dashboards, etc.) e **não foi alterado** por este Design System
v1. `src/components/design-system/*` é uma camada nova, ao lado da antiga,
implementando os padrões oficialmente aprovados (que em alguns casos —
ex. Button, Tabs — têm visual diferente do que `ui/` já tem hoje).

Isso é intencional, não uma duplicação por descuido: até a migração
controlada de cada tela (Fase 4, ainda não iniciada), as duas convivem.
**Nunca** altere `src/components/ui/*` para "virar" o padrão novo — isso
mudaria o visual de toda tela existente silenciosamente. Ver
`docs/projetos/design-system/DECISOES.md` (D-009) para o racional
completo.

## Como criar uma nova tela usando o Design System

1. Envolva a página inteira em `PageContainer` (Layout / Page Shell —
   100% da área útil, gutters oficiais) — nunca `max-w-*xl mx-auto` ou
   `width: 80%/90%` copiado de outra tela.
2. Dentro dele, comece pelo `PageHeader` (padrão HDR=A) para o topo da
   página. Use `Card`/`FormSection`/`KpiSection` como containers — nunca
   `<div className="rounded-2xl border ...">` copiado de outra tela.
3. Formulários: envolva cada campo em `FormField`; use `FormErrorSummary` no topo se o formulário tiver mais de ~3 campos.
4. Listagens: `FilterPanel` (+ `useFilterState`) para filtros, `ResponsiveTable` para a tabela/listagem.
5. Ações que chamam API: use `useAsyncAction` + `Button loading={...}` — nunca um `onClick` que dispara `fetch` sem bloquear o próprio botão.
6. Erros de servidor: `Alert tone="danger"`, nunca reaproveite o erro de campo do `FormField` para isso.
7. Consulte [interaction-standards.md](interaction-standards.md) antes de decidir *quando* uma consulta deve rodar, *quando* validar, *como* confirmar uma exclusão, etc. — isso já está decidido, não é uma escolha nova por tela.

## Quando um novo componente pode ser criado

1. Primeiro, verifique se um componente ou composição de componentes já existentes resolve (ex.: um "card de aviso" quase sempre é só `Alert` ou `Card` + conteúdo).
2. Se realmente faltar algo, crie a extensão **na tela** primeiro (não amplie o Design System especulativamente).
3. Só promova a extensão para `src/components/design-system/` quando ela for genuinamente genérica (usada ou claramente reutilizável por mais de uma tela) — documente aqui quando isso acontecer.
4. Nunca duplique um componente do DS com nome ligeiramente diferente só porque uma tela "quase" se encaixa — ajuste os props do componente existente em vez disso.

## Como propor mudança neste Design System

Qualquer mudança visual ou de comportamento no DS v1 (não uma extensão
local numa tela) é uma decisão de produto, não uma decisão técnica
unilateral do agente. Para propor:

1. Registre a proposta como pendência em `docs/projetos/design-system/STATUS.md` (ou reabra o Projeto Multifase se ele já tiver sido encerrado).
2. Explique o motivo e o impacto nas telas que já usam o padrão atual.
3. Aguarde decisão humana explícita antes de implementar — não altere um token ou componente do DS "porque parece melhor".

## Responsividade e acessibilidade — princípios gerais

- **Não existe um Design System mobile separado.** Todo componente aqui é
  o mesmo componente para desktop e mobile, com comportamento responsivo
  embutido (ex.: `ResponsiveTable` já decide sozinho quando mostrar tabela
  ou cards; `MobileActionBar` só some/aparece por breakpoint).
- Foco visível (`focus-visible:ring-*`) já vem de série em todos os
  componentes interativos — não remova.
- Todo campo com erro usa `aria-invalid` + `aria-describedby` (via
  `FormField`) — nunca dependa só de cor.
- Ver `interaction-standards.md` para as regras específicas de teclado
  (Enter, Escape, Tab, foco) e mobile (ação principal, filtros, tabelas).

## Pendências conhecidas (não inventadas, registradas para não virarem decisão silenciosa)

- `RadioGroup` e `Switch` não existem em `ui/` nem no DS v1 — nenhuma
  decisão aprovada cobriu o visual deles especificamente. Não foram
  criados nesta fase; se uma tela precisar, trate como gap e proponha
  antes de inventar.
- `ResponsiveTable` cobre o padrão aprovado (tabela desktop / cards
  mobile + ações de linha sempre visíveis), mas não é um data-grid
  genérico completo (sem ordenação/paginação embutidas — a tela
  consumidora continua responsável pelo estado de paginação/ordenação;
  ver `interaction-standards.md`, "Tabelas e listagens").
- Testes de componente (renderização, interação via DOM) não existem
  porque o `vitest.config.ts` atual roda em ambiente `node` (sem
  `jsdom`/`@testing-library/react`) e só inclui `src/**/*.test.ts`. Os
  testes desta fase cobrem a lógica pura extraída para
  `src/lib/design-system/*.ts` (que é exatamente onde vivem as regras
  comportamentais críticas — bloqueio de duplo clique, resumo de erros,
  filtro manual, validação de data). Adicionar testes de renderização é
  uma mudança de infraestrutura, não decidida nesta fase.
