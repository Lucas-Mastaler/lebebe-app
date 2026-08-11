---
trigger: always_on
---

# RESUMO — ADAPTADOR (1 página)

- Leia `AGENTS.md` (raiz) primeiro — é a fonte canônica de processo deste
  projeto. `.devin/rules/Agent.md` é o adaptador que explica como navegar
  a partir daqui.
- Regras contextuais por módulo: `.agents/rules/` (banco, recebimento,
  procurar-datas, inteligência comercial, novas telas/permissões).
- Procedimentos reutilizáveis: `.agents/skills/` (auditar-tarefa,
  criar-plano, executar-plano, validar-entrega, procurar-datas,
  projeto-multifase, mais as skills vendor Supabase).
- Projeto Multifase ativo: `docs/projetos/<slug>/` — continuidade real vive
  lá, não na conversa.
- `docs/ia/log_progress.md`: **congelado**. Nunca escrever. Busca dirigida
  só quando necessário.
- Escopo mínimo, não inventar comportamento/tabela/função, validar banco
  via MCP antes de assumir estrutura, classificar complexidade/risco antes
  de investigar — regras completas em `AGENTS.md`.

Este arquivo não substitui nenhuma das fontes acima — é só o índice mais
curto possível para orientar por onde começar.
