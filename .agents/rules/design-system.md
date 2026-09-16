# Design System

## Gatilho

Carregue esta regra para qualquer tarefa que crie ou altere uma tela,
componente ou padrão visual/de interação no frontend do Le Bébé App.

## Existe um Design System oficial

Antes de criar um padrão visual ou de comportamento novo numa tela,
consulte `docs/design-system/` (documentação canônica: foundations,
componentes, patterns, Interaction Standards). Reutilize tokens,
componentes (`src/components/design-system/`) e regras de comportamento
já aprovados em vez de reinventar localmente.

## Compatibilidade — não alterar `src/components/ui/*`

`src/components/ui/*` (Button, Input, Select, Tabs, Dialog, Table etc.,
estilo shadcn) continua em uso por todas as telas operacionais atuais e
**não deve ser alterado** para "virar" o Design System v1 — isso mudaria
o visual de todo o app silenciosamente. O padrão novo vive em
`src/components/design-system/`, ao lado do antigo, até a migração
controlada (fase futura, não iniciada).

## Quando um novo componente pode ser criado

Ver `docs/design-system/README.md`, "Quando um novo componente pode ser
criado" e "Como propor mudança". Mudança no próprio Design System (não
extensão local de uma tela) exige decisão humana explícita — não é uma
escolha técnica unilateral do agente.

## Onde consultar o histórico de decisão

`docs/projetos/design-system/` (Projeto Multifase) tem o histórico de
como cada decisão foi comparada e aprovada (`DECISOES.md`), o laboratório
de comparação vive na rota `/design-system`. Não duplicar esse conteúdo
na documentação canônica em `docs/design-system/`.
