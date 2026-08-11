# .agents/ — fonte canônica estruturada

A entrada global do projeto é `/AGENTS.md` (raiz) — leia-o primeiro. Este
diretório guarda a parte estruturada dessa fonte: regras contextuais e
skills reutilizáveis.

## Estrutura

- **`rules/`** — regras contextuais (por tipo de tarefa ou por módulo),
  pensadas para carregar apenas quando a tarefa realmente se aplica. Estado
  atual: as 5 rules planejadas existem e são a fonte vigente
  (`banco-supabase.md`, `recebimento.md`, `procurar-datas.md`,
  `inteligencia-comercial.md`, `novas-telas-permissoes.md`); `rules/README.md`
  guarda o plano/mapeamento original usado na migração.
- **`skills/`** — procedimentos reutilizáveis (Agent Skills). Contém o
  pacote oficial `supabase/agent-skills` (skills `supabase` e
  `supabase-postgres-best-practices`, instaladas via `npx skills add` e
  registradas em `/skills-lock.json`), `projeto-multifase` (Fase 1.5) e as
  seis skills de projeto criadas na Fase 3 (`auditar-tarefa`, `criar-plano`,
  `executar-plano`, `validar-entrega`, `atualizar-log-progress`,
  `procurar-datas`) — ver o catálogo completo em `skills/README.md`.
  `atualizar-log-progress` está **aposentada** desde a Fase B2
  (2026-08-10, ver abaixo).

## Por que isso existe

Antes desta fundação, o mesmo conjunto de regras vivia duplicado em
`.devin/rules/` (6 arquivos, duas gerações sobrepostas) e parcialmente em
`AGENTS.md`, `CONTEXTO DO PROJETO.MD` e `RESUMO_STACK.MD`, sem hierarquia
clara entre ferramentas. Diagnóstico completo na auditoria de 2026-08-07,
registrada em `docs/ia/log_progress.md`.

`CONTEXTO DO PROJETO.MD` (raiz do repositório) foi congelado como histórico
na Fase C1 (2026-08-10): todo conteúdo único e ainda válido (mapa de
rotas/APIs/entidades e pontos frágeis do Recebimento) foi absorvido em
`.agents/rules/recebimento.md` (ver `rules/README.md`, item 2). O arquivo
permanece no lugar, com aviso no topo, só para valor histórico — não é mais
consultado como fonte operacional por nenhuma regra ou skill vigente.

## Estado da migração

| Fase | Status | O que faz |
|---|---|---|
| Fundação | Concluída em 2026-08-07 | `AGENTS.md` canônico + `.agents/rules/` e `.agents/skills/` com plano; adaptador `CLAUDE.md` para Claude Code |
| Fase 2 — regras | Concluída em 2026-08-07 | 5 regras migradas de `.devin/rules/*` para `.agents/rules/*.md` sem perda de conteúdo; `AGENTS.md` §6/§7 apontam para elas |
| Fase 3 — skills | Concluída em 2026-08-07 | 6 skills de projeto criadas em `.agents/skills/*/SKILL.md` (auditar-tarefa, criar-plano, executar-plano, validar-entrega, atualizar-log-progress, procurar-datas); `AGENTS.md` §9 aponta para elas |
| Fase B/B2 — log global | Concluída em 2026-08-10 | `docs/ia/log_progress.md` congelado (histórico legado, byte-preservado, ver `docs/ia/log_progress_legacy.md`); escrita global aposentada; continuidade longa passa a ser exclusivamente `docs/projetos/<slug>/`; skill `atualizar-log-progress` aposentada |
| Fase C1 — consolidação documental | Concluída em 2026-08-10 | `CONTEXTO DO PROJETO.MD` auditado seção a seção e congelado como histórico (mapa único de rotas/APIs/entidades do Recebimento absorvido em `.agents/rules/recebimento.md`); reconciliação de `/procurar-datas` × log congelado já estava resolvida pela Fase B/B2, só verificada |
| Onda 5 (Projeto Multifase `higiene-estrutural-repositorio`) | Concluída em 2026-08-10 | Usuário confirmou uso ativo do Devin dependente de `.devin/`; pasta mantida e transformada em **adaptador de compatibilidade mínimo** (não mais segunda fonte de regras) — os 6 `rules/` reescritos como pointers curtos para este Harness (855 → 244 linhas), 2 stubs mortos removidos (`skills/login/`, `workflows/login.md`), skills vendor preservadas intactas. Ver `docs/projetos/higiene-estrutural-repositorio/DECISOES.md` (D-005) |

As 5 regras da Fase 2 já migraram para `.agents/rules/` e são a fonte
vigente. Os arquivos legados equivalentes em `.devin/rules/` não são mais
cópias completas: desde a Onda 5 (D-005) são pointers curtos para este
Harness, mantidos como adaptador de compatibilidade porque o Devin ainda
depende diretamente de `.devin/` — ver `AGENTS.md` §1 e §7.

## Compatibilidade por ferramenta

- **Claude Code** — lê `CLAUDE.md` (raiz) automaticamente como memória de
  projeto. `CLAUDE.md` aqui contém só um import (`@AGENTS.md`, sintaxe
  nativa do Claude Code) — zero duplicação de conteúdo. Claude Code **não**
  reconhece `AGENTS.md` nem `.agents/skills/` nativamente como diretório
  nativo de skills (ele só descobre skills em `.claude/skills/`); por isso o
  adaptador existe para o arquivo global. Skills em `.agents/skills/` são
  descobertas via pointer em `AGENTS.md` §9 (lido pelo Claude Code através
  do adaptador): o agente aprende o gatilho e o caminho canônico e lê o
  `SKILL.md` diretamente quando aplicável — decisão tomada na Fase 3, sem
  criar cópias em `.claude/skills/` (ver `skills/README.md`, seção
  "Compatibilidade Claude Code").
- **Codex** — já lê `AGENTS.md` por convenção de mercado; nenhum adaptador
  extra deveria ser necessário. Não confirmado neste ambiente (não há como
  testar Codex a partir desta sessão).
- **Devin** — confirmado pelo usuário (2026-08-10) que ainda lê
  `.devin/rules/` e `.devin/skills/` diretamente e depende dessa pasta.
  Desde a Onda 5 do Projeto Multifase `higiene-estrutural-repositorio`
  (D-005), `.devin/rules/*` é um adaptador mínimo que aponta para este
  Harness em vez de duplicar conteúdo — ver `.devin/rules/Agent.md`.
  `.devin/workflows/` ficou vazia (o único arquivo, `login.md`, era um
  stub sem conteúdo, removido). Se/quando o Devin passar a ler `AGENTS.md`
  nativamente, o adaptador em `.devin/` pode ser reduzido ainda mais.
- **Cursor, Windsurf, outros** — sem adaptador ainda; nenhum uso confirmado
  neste projeto no momento (ver histórico de migração Windsurf → Devin em
  `docs/ia/log_progress.md`).
