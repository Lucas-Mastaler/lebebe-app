# Projetos multifase — índice

Índice leve dos projetos que usam o harness de continuidade
(`.agents/skills/projeto-multifase/SKILL.md`). Isto **não é histórico** —
é só o ponto de entrada para descobrir projetos ativos rapidamente. Estado
detalhado de cada um vive em `<slug>/STATUS.md`; não duplique aqui.

| Projeto | Status | Fase atual | Entrada |
|---|---|---|---|
| higiene-estrutural-repositorio | APROVADO | C2.1 — reconciliação concluída, pronto para Onda 1 | [STATUS.md](higiene-estrutural-repositorio/STATUS.md) |

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
