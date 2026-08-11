# Status — Higiene Estrutural do Repositório

Projeto: higiene-estrutural-repositorio
**Estado: CONCLUÍDO (2026-08-11)**

## Resultado final

Todas as 6 ondas do `PLANO.md` concluídas. Todas as 15 decisões em
`DECISOES.md` (D-001 a D-015) estão APROVADAS — nenhuma PENDENTE.

- **Onda 1** — fontes concorrentes: `RESUMO_STACK.MD` removido (D-007);
  `supabase-migration-digisac-conexoes-automacao.sql` e os 4 SQL
  auxiliares de `appscript/` mantidos, gap de migration oficial registrado
  como pendência de banco fora deste projeto (D-008, D-009).
- **Onda 2** — `appscript/logs.md` removido (PII + achado de segurança da
  chave LocationIQ, tratamento de rotação recomendado fora de escopo,
  D-006).
- **Onda 3** — 3 runbooks técnicos + `GOOGLE_SHEETS_SETUP.md` movidos para
  `docs/tecnico/`; 4 documentos de Inteligência Comercial movidos para
  `docs/inteligencia-comercial/`; `CONTEXTO DO PROJETO.MD` mantido na raiz
  como histórico congelado (D-011 a D-013).
- **Onda 4** — `desloc_backup.md` e `scriptsreal.md` removidos (duplicados
  superados); `procvlojas.md`, `deslocamentos.gs` e `digisac_docs.md`
  mantidos por consumidor/proteção de módulo confirmados (D-014).
- **Onda 5** — `.devin/` mantida (Devin confirmado em uso ativo pelo
  usuário) e transformada em adaptador de compatibilidade mínimo: os 6
  `rules/` reescritos como pointers curtos para o Harness canônico (855 →
  244 linhas), 2 stubs mortos removidos, skills vendor Supabase
  preservadas intactas (D-005).
- **Onda 6** — pendência de conteúdo do D-011 corrigida
  (`auditoria_acesso` → `auditoria_acessos` em
  `docs/tecnico/AUTO_LOGOUT_SETUP.md`); referências obsoletas ao estado
  pré-Onda-5 de `.devin/` corrigidas em `AGENTS.md`, `.agents/README.md`,
  `.agents/rules/README.md`, `.agents/skills/README.md` (D-015).

## Validação final (2026-08-11)

- Estrutura: raiz sem resíduos classificados como removíveis; `docs/tecnico/`
  e `docs/inteligencia-comercial/` coerentes; `.devin/` funcional como
  adaptador (43 arquivos: 6 rules + 37 skills vendor); `.agents/` canônico
  e sincronizado com o estado real; `docs/ia/log_progress.md` congelado,
  não tocado.
- Referências: busca dirigida (`git grep`) por todos os caminhos removidos/
  movidos no projeto inteiro confirmou **zero referência operacional
  quebrada**. Únicas ocorrências restantes são históricas/explicativas
  legítimas (nota de proveniência em `.agents/README.md`; entrada em
  `.gitignore` para `appscript/logs.md`).
- Git: `git diff --check` limpo (só avisos de CRLF/LF do Windows);
  `git status --short` mostra só os arquivos de documentação/Harness
  alterados nesta iniciativa. Nenhum código de aplicação, banco, migration
  ou trabalho externo/concorrente foi tocado.

## Pendências futuras não bloqueantes (fora do escopo desta higiene)

- Rotação/confirmação de validade da chave LocationIQ exposta em versão
  histórica já removida de `appscript/logs.md` (D-006) — ação de segurança
  independente.
- Gap de migration oficial retroativa para `digisac_conexoes_automacao`
  (D-008) e para os 4 SQL auxiliares de `appscript/` + migration
  `add_motor_fields_search_execution_audit` sem arquivo correspondente
  (D-009) — decisão de quem mantém o schema.
- Doc desatualizado `docs/procurar-datas-codemap.md` citando tabela
  inexistente `geo_cache_addresses` (nome real: `geo_cache`) — não tocado,
  módulo `/procurar-datas` fora do escopo desta higiene.

Nenhuma dessas pendências bloqueia o encerramento deste projeto — são
achados registrados, de responsabilidade de iniciativas próprias.

## Não refazer

Não reabrir nenhuma decisão D-001 a D-015 sem evidência nova de risco
crítico causada pelo estado atual. Detalhamento completo de cada decisão,
evidência e critério de reabertura: `DECISOES.md`.

## Consultar

- `ESCOPO.md` — objetivo, critérios de aceite (estado CONCLUÍDO).
- `PLANO.md` — Ondas 1 a 6, todas concluídas.
- `DECISOES.md` — D-001 a D-015, todas APROVADAS.

**Projeto `higiene-estrutural-repositorio`: CONCLUÍDO.**
