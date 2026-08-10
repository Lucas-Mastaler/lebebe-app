---
name: atualizar-log-progress
description: "APOSENTADA (Fase B2, 2026-08-10). docs/ia/log_progress.md está congelado — nenhum agente deve escrever nesse arquivo. Esta skill não tem mais gatilho operacional e não deve ser invocada para registrar continuidade. Para consulta histórica dirigida ao log congelado, ver docs/ia/log_progress_legacy.md. Para continuidade real entre sessões, ver .agents/skills/projeto-multifase/SKILL.md."
metadata:
  author: le-bebe-app
  version: "2.0.0"
  status: aposentada
---

# Atualizar Log Progress (APOSENTADA)

Esta skill padronizava a escrita em `docs/ia/log_progress.md`. Desde a
Fase B2 (2026-08-10), a escrita global nesse arquivo foi aposentada —
`docs/ia/log_progress.md` é histórico congelado (ver
`docs/ia/log_progress_legacy.md`). Esta skill **não tem mais gatilho
operacional** e não deve ser usada para registrar nada, em nenhuma
circunstância.

## O que fazer em vez disso

- **Tarefa normal:** nenhum registro global — código, worktree e o
  relatório final ao usuário já bastam (`AGENTS.md` §11).
- **Trabalho com continuidade real e estrutura substancial:**
  `docs/projetos/<slug>/`, via `.agents/skills/projeto-multifase/SKILL.md`.
- **Consulta ao histórico anterior ao congelamento:** busca dirigida em
  `docs/ia/log_progress.md`, seguindo a regra descrita em
  `docs/ia/log_progress_legacy.md` — nunca leitura integral, nunca
  escrita.

## Contexto histórico

Esta skill existiu como skill de escrita entre 2026-06-12 e 2026-08-10.
Durante esse período, um round-trip de leitura/escrita ingênuo chegou a
corromper `docs/ia/log_progress.md` uma vez (revertido antes de qualquer
commit), o que motivou um procedimento de escrita byte-safe. Esse
procedimento perdeu efeito prático com o congelamento — está preservado
aqui apenas como contexto histórico, não como instrução válida.
