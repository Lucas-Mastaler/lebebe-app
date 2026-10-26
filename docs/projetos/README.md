# Projetos multifase — índice

Índice leve dos projetos que usam o harness de continuidade
(`.agents/skills/projeto-multifase/SKILL.md`). Isto **não é histórico** —
é só o ponto de entrada para descobrir projetos ativos rapidamente. Estado
detalhado de cada um vive em `<slug>/STATUS.md`; não duplique aqui.

| Projeto | Status | Fase atual | Entrada |
|---|---|---|---|
| confidencialidade-custos | EM_EXECUCAO | Fase 2 validada e publicada | [STATUS.md](confidencialidade-custos/STATUS.md) |
| prancheta-virtual | EM_EXECUCAO | D-031/D-032 publicados; ajustes visuais D-033 no commit 6b9877d, READY em lebebe.cloud; homologação humana pendente | [STATUS.md](prancheta-virtual/STATUS.md) |
| mere-ia | EM_EXECUCAO | D-020: cinco reais analisados; 2 sintéticos válidos; 8 tentativas; revisão humana pendente, Fase 1C não aprovada | [STATUS.md](mere-ia/STATUS.md) |
| decorisi-pedidos-personalizados | EM_EXECUCAO | Fases 1–5 validadas; Xadrezia (222 DB/XP) e ajustes do formulário entregues; aguardando rehomologação local; ativação comercial desativada | [STATUS.md](decorisi-pedidos-personalizados/STATUS.md) |
| higiene-estrutural-repositorio | CONCLUIDO | Ondas 1-6 concluídas (2026-08-11) | [STATUS.md](higiene-estrutural-repositorio/STATUS.md) |
| lebebe-exclusive-pedidos-personalizados | CONCLUIDO | Implementação, publicação e validação do fluxo Exclusive → SGI concluídas | [STATUS.md](lebebe-exclusive-pedidos-personalizados/STATUS.md) |
| design-system | EM_EXECUCAO | Fase 5 (manual, uma tela por chat) + Fila 2 (auditoria 2026-09-16) — todas as telas concluídas tecnicamente estão `PRONTA_PARA_VALIDACAO_MANUAL`, incluindo `/recebimento` (rota raiz, migrada em 2026-09-17); aguardando validação manual do usuário; nenhuma nova tela iniciada | [STATUS.md](design-system/STATUS.md) |

Estados possíveis: `PLANEJAMENTO` · `APROVADO` · `EM_EXECUCAO` ·
`BLOQUEADO` · `CONCLUIDO` · `CANCELADO`.

## Como adicionar uma linha

Só quando `.agents/skills/projeto-multifase/SKILL.md` (operação INICIAR)
criar `docs/projetos/<slug>/`. Não adicionar projeto ao índice sem a pasta
correspondente existir, e vice-versa.

## Projetos existentes ainda fora do harness

Não migrados nesta tarefa (Fase 1.5 só cria o padrão para frente — ver
relatório de 2026-08-07 em `docs/ia/log_progress.md`). Candidatos para uma
migração futura e controlada, cada um já com documentação própria fora
deste padrão:

- Pedidos Personalizados — `src/lib/pedidos-personalizados/`, sem pasta de
  projeto dedicada em `docs/`.
- `/procurar-datas` — `docs/procurar-datas-escopo-equivalencia-legado-v2.md`
  e `docs/procurar-datas-motor-v2-progresso.md` continuam sendo o contrato
  e o progresso vigentes; migração para este padrão exigiria decisão própria
  e cuidadosa (documentos muito grandes, com histórico de negócio sensível).
- Hub/Vendas — `docs/digisac-hub-vendas-plano-progresso.md`.
- Atendimento Presencial — `docs/PLANO FUNCIONAL ATUALIZADO — FICHA DE
  ATENDIMENTO PRESENCIAL.md` e `docs/ficha-atendimento-presencial-progresso.md`.
