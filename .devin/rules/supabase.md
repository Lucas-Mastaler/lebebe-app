---
trigger: always_on
---

# BANCO / SUPABASE — ADAPTADOR

A regra completa vive em `.agents/rules/banco-supabase.md` — leia-a antes
de qualquer tarefa que toque schema, tabela, coluna, tipo, migration,
foreign key, join, view, índice, trigger, função SQL, constraint, RLS,
policy ou persistência (insert/update/delete/select).

Regra central, sem exceção: nunca assumir estrutura do banco a partir do
código ou de migration antiga — validar sempre o estado real via MCP do
Supabase antes de alterar ou concluir qualquer coisa sobre o schema.

Ao operar o MCP, use o procedimento técnico da skill oficial `supabase`
(`.devin/skills/supabase/SKILL.md`, idêntica a
`.agents/skills/supabase/SKILL.md`) e, para otimização de query/índice/
lock/schema, `supabase-postgres-best-practices`
(`.devin/skills/supabase-postgres-best-practices/SKILL.md`).

Este arquivo não duplica o conteúdo completo da regra — leia
`.agents/rules/banco-supabase.md` para o checklist inteiro (mudanças
destrutivas, divergência código × banco, o que fazer se o MCP não estiver
disponível).
