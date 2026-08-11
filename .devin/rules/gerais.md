---
trigger: always_on
---

# REGRAS GERAIS — ADAPTADOR

Este arquivo é um pointer curto. As regras gerais completas vivem em
`AGENTS.md` (raiz do repositório) — leia-o primeiro, junto de
`.devin/rules/Agent.md` (adaptador principal desta pasta).

## Onde estão as regras reais

- Escopo mínimo, não inventar, mudança mínima, segurança nas respostas,
  investigação obrigatória, respeito à arquitetura existente: `AGENTS.md`
  §2, §3, §5.
- Classificação de complexidade e risco antes de investigar: `AGENTS.md` §4.
- Investigação proporcional ao porte da tarefa: `AGENTS.md` §5.
- Banco de dados / Supabase: `.agents/rules/banco-supabase.md` (ver também
  `.devin/rules/supabase.md`, pointer específico).
- UI/UX: não alterar layout, texto ou experiência sem pedido explícito —
  mesma regra de `AGENTS.md` §3, sem arquivo próprio.
- `/procurar-datas`: `.agents/rules/procurar-datas.md` — classificar a
  Frente (0/Controle, 1/esquerda, 2/meio, 3/direita) antes de qualquer
  análise; Apps Script legado é fonte de verdade; Haversine nunca é cálculo
  oficial sem confirmação no legado.
- Novas telas e permissões: `.agents/rules/novas-telas-permissoes.md` +
  checklist completo em `docs/ia/padrao-novas-telas-permissoes.md`.
- Continuidade entre agentes: `.devin/rules/continuidade-agente.md`
  (adaptador) — `docs/ia/log_progress.md` está congelado, nunca escrever.

Este arquivo não duplica o conteúdo dessas fontes — carregue a fonte real
quando o gatilho da tarefa bater.
