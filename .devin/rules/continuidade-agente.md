---
trigger: always_on
---

# Continuidade entre agentes — ADAPTADOR (regra corrigida)

Esta regra substitui integralmente a versão anterior deste arquivo, que
instruía escrever em `docs/ia/log_progress.md`. Essa instrução está
SUPERADA e não deve mais ser seguida por nenhum motivo.

## Regra atual

`docs/ia/log_progress.md` está **congelado** desde a Fase B2 do Harness
canônico (`AGENTS.md` §1/§11):

1. **Nunca escrever** nova entrada nele — nem ao final de tarefa, nem por
   ela ser "pequena demais para justificar", nem por nenhum outro motivo.
2. **Nunca ler o arquivo inteiro** por padrão.
3. Consulta permitida apenas por **busca dirigida** (grep por termo, módulo
   ou data), quando for material para a tarefa atual — nunca como destino
   de escrita.

## Continuidade corrente

1. Antes de iniciar tarefa relevante: se ela pertencer a um Projeto
   Multifase (`docs/projetos/<slug>/`), leia `STATUS.md` desse projeto como
   ponto de partida — ver `.agents/skills/projeto-multifase/SKILL.md`.
2. Valide sempre no código real qualquer informação necessária antes de
   alterar arquivos — nunca assuma que algo foi implementado só porque
   aparece em documentação antiga.
3. Consulte o MCP Supabase quando a tarefa envolver banco, tabelas,
   colunas, migrations, RLS, policies, constraints, relações ou queries
   (`.agents/rules/banco-supabase.md`).
4. Ao finalizar tarefa relevante: se ela pertence a um Projeto Multifase,
   atualize só os artefatos que mudaram (`STATUS.md`/`PLANO.md`/
   `DECISOES.md`/`ESCOPO.md`). Caso contrário, o relatório final da tarefa
   (`AGENTS.md` §11) já é suficiente — não existe mais persistência global
   automática.
5. Mantenha escopo mínimo e evite refactors paralelos (`AGENTS.md` §3).

## Regras obrigatórias que continuam válidas

- Não apagar histórico validado.
- Não inventar validação que não foi realizada.
- Não registrar secrets, tokens, senhas ou dados sensíveis em nenhum
  artefato persistente.
- Se algo não foi confirmado, escrever explicitamente "não confirmado".
