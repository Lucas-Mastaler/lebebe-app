# Status — Higiene Estrutural do Repositório

Projeto: higiene-estrutural-repositorio
Estado: APROVADO
Fase atual: Onda 1 concluída (3/3 itens); Onda 2 concluída (1/1 item); Onda 3
concluída (3/3 itens)

## Última etapa concluída

Onda 2 (2026-08-10): decidida a retenção de `appscript/logs.md` (D-006).
Classificação **C — LOG GERADO/REPRODUZÍVEL**: captura manual de uma única
execução do Google Cloud Logging (Apps Script), 39 linhas, trace da função
`ResolverEnderecoComCache_`. A instrumentação que gera essas linhas
(`[LOOKUP]`, `[GEO-CACHE]`, `[GEO-PROVIDER]`) existe em código-fonte real
(`appscript/CEP-APIBACK.gs`), confirmando reprodutibilidade total. `git log
--follow --stat` mostrou o arquivo sobrescrito por completo 3 vezes
(2026-03-13 ×2, 2026-04-08) — padrão recorrente de colar captura de debug
fresca, não log cumulativo. Zero consumidor operacional (`git grep`
confirmou). Continha PII real (endereço de cliente em texto pleno,
confirmado desde a Fase C2) e um **achado de segurança separado**: uma
chave de API (LocationIQ) em texto pleno numa URL de debug, fora do padrão
de mascaramento do restante do log — não reproduzida em nenhum artefato,
tratamento (confirmar validade/rotacionar) recomendado como ação
independente, fora deste projeto de higiene. Nenhum conhecimento técnico
exclusivo foi perdido: a única análise de valor já extraída de uma captura
anterior deste mesmo arquivo está preservada, sanitizada, em
`appscript/OTIMIZACOES-PERFORMANCE.md` (citação histórica, não referência
operacional). **Ação executada: arquivo removido (`git rm`) e adicionada
regra específica ao `.gitignore` (`appscript/logs.md`) para evitar
recorrência.** Nenhum outro arquivo tocado. Detalhamento completo em D-006
(`DECISOES.md`). **Onda 2 concluída nesta sessão (1/1 item).**

## Etapa anterior

Onda 3, item 3 (2026-08-10): decidido o destino físico de
`CONTEXTO DO PROJETO.MD`. Leitura integral confirmou classificação **B —
histórico congelado útil**: o banner de congelamento aplicado na Fase C1 já
é suficiente (não é fonte operacional, código/`AGENTS.md`/`.agents/rules/`
sempre vencem, único conteúdo único já foi absorvido em
`.agents/rules/recebimento.md`). `git grep` pelo nome do arquivo encontrou 8
ocorrências — todas os artefatos deste Projeto Multifase, o próprio banner
autorreferenciado, e três menções puramente históricas (`.agents/README.md`,
`.agents/rules/README.md`, `.agents/rules/recebimento.md`) sem link de
caminho operacional, mais uma no log congelado (não tocado). Nenhuma
referência operacional quebrada. Destino avaliado: `docs/ia/` descartada por
misturar diagnósticos ativos com um documento hoje operacional
(`padrao-novas-telas-permissoes.md`); nenhuma outra pasta existente é
claramente melhor; instrução da tarefa proíbe criar pasta genérica nova só
para este arquivo. **Decisão: arquivo permanece na raiz — nenhum movimento
executado, nenhum conteúdo reescrito.** Ver D-013 (`DECISOES.md`).
**Onda 3 concluída nesta sessão (3/3 itens).**

## Etapa anterior

Onda 3, item 2 (2026-08-10): auditoria dos 30 arquivos soltos no nível
superior de `docs/` (inventário real — estimativa anterior de "35 itens"
não se confirmou). Todos os 30 classificados numa matriz completa (ver
entrega da sessão). Executados apenas 2 movimentos de baixo risco:
`docs/GOOGLE_SHEETS_SETUP.md` → `docs/tecnico/GOOGLE_SHEETS_SETUP.md`
(mesmo padrão da Onda 3 item 1) e os 4 documentos `inteligencia-comercial-
*.md` → nova pasta `docs/inteligencia-comercial/` (nomes de arquivo
preservados integralmente). `git grep` dirigido confirmou, antes e depois
do movimento, ausência de referência operacional quebrada.

Os demais 25 arquivos foram mantidos na raiz de `docs/` por evidência
concreta, não por hesitação — cada grupo com motivo registrado em D-012
(`DECISOES.md`):
- 3 documentos citados por caminho explícito em `docs/projetos/README.md`
  (âncoras de índice: `PLANO FUNCIONAL ATUALIZADO — FICHA DE ATENDIMENTO
  PRESENCIAL.md`, `ficha-atendimento-presencial-progresso.md`,
  `digisac-hub-vendas-plano-progresso.md`) + 3 documentos interligados a
  eles por referência direta ou por autodeclaração de continuidade vigente
  (`atendimento-automatico-posvenda-mere-plano.md`,
  `atendimento-presencial-registros-rascunhos.md`,
  `atendimento-presencial-simplificacao-fluxo.md`,
  `digisac-hub-vendas-recuperacao-leads.md`).
- 16 arquivos `procurar-datas-*.md` — protegidos integralmente pela regra
  do módulo, não avaliados para movimento por instrução explícita da
  tarefa.
- `snippets-devtools-opcao-b-comparacao.md` — apesar de não ter o prefixo
  `procurar-datas-`, é referenciado por caminho relativo dentro dos dois
  documentos obrigatórios do módulo (`procurar-datas-escopo-equivalencia-
  legado-v2.md` e `procurar-datas-motor-v2-progresso.md`) — mesma proteção
  de regra de módulo.
- `plano-acesso-usuarios-e-unidades.md` — plano ainda não implementado
  (checagem pontual em `src/app/superadmin/page.tsx` confirmou ausência de
  separação de autorização por aba, como o próprio documento já indicava).
- `checklist-validacao-ficha-telefone-rascunhos.md` e
  `links-protocolos-digisac.md` — zero referência encontrada em qualquer
  lugar do repositório, mas sem grupo temático com massa suficiente para
  justificar pasta nova; mantidos por cautela (classificação G/D).

Nenhum código funcional, migration, schema, banco ou conteúdo de documento
reescrito nesta ação (além do inventário/leitura). `/procurar-datas`,
Onda 2 (`appscript/logs.md`) e a pendência `auditoria_acesso`/
`auditoria_acessos` do runbook movido na Onda 3 item 1 não foram tocados.

## Etapa anterior

Onda 3, item 1 (2026-08-10): avaliação e movimentação dos três runbooks
técnicos soltos na raiz (`AUTO_LOGOUT_SETUP.md`, `GOOGLE_OAUTH_SETUP.md`,
`SUPABASE_SETUP.md`). Leitura integral dos três confirmou: todos descrevem
fluxos ativos e reais (cron de auto-logout, login Google OAuth, setup geral
do Supabase/auth) — nenhum aponta para arquivo, tabela ou rota inexistente
no código atual (`src/app/api/cron/auto-logout/route.ts`,
`src/middleware.ts`, `src/app/(auth)/login/page.tsx`,
`src/app/auth/callback/route.ts`, `supabase/migrations/001_initial_schema.sql`
e `002_fix_rls_recursion.sql` todos confirmados existentes). Classificação:
**DOCUMENTAÇÃO TÉCNICA ATUAL** para os três. `git grep` dirigido pelo nome
dos três arquivos não encontrou nenhum consumidor operacional externo a este
Projeto Multifase. Movidos via `git mv` para `docs/tecnico/` (pasta nova,
único destino criado — sem subpastas adicionais). Uma referência interna
quebrada corrigida: a listagem de estrutura de pastas dentro do próprio
`SUPABASE_SETUP.md` citava seu próprio caminho antigo na raiz — atualizada
para `docs/tecnico/SUPABASE_SETUP.md`. Nenhum outro conteúdo reescrito.

Pendência de conteúdo registrada nesta ação, não corrigida (fora do escopo
de organização física — precisa de revisão dedicada do documento):
`AUTO_LOGOUT_SETUP.md` usa `auditoria_acesso` (singular) em todos os
exemplos SQL/JSON, mas a tabela real (confirmada em código e migration) é
`auditoria_acessos` (plural) — um humano copiando os exemplos consultaria
uma tabela inexistente. Ver D-011 (`DECISOES.md`).

Nenhum código funcional, migration, schema ou banco alterado. Nenhum
arquivo fora do escopo desta ação tocado. Onda 2 (`appscript/logs.md`,
D-006) permanece independente e não foi executada.

## Etapa anterior

Onda 1, item 3 (2026-08-10): auditoria completa dos 4 SQL auxiliares em
`appscript/` (`supabase-views.sql`, `supabase-cache-analytics-real.sql`,
`supabase-add-duration-tracking.sql`, `supabase-search-execution-audit.sql`).
Inventário real confirmou exatamente os 4 arquivos previstos. Todos os 4
lidos integralmente e classificados **A — migration oficial necessária, não
incorporada** (mesmo padrão do D-008): os objetos de banco de todos eles
(tabelas `provider_costs`, `forex_config`, `geocoding_audit`,
`search_execution_audit`, 22 views analíticas) existem em produção
(validado via MCP Supabase, projeto `phsoawbdvhurroryfnok`, somente
leitura) e têm consumidor operacional real em
`src/app/api/procurar-datas/performance/route.ts` e
`src/app/api/procurar-datas/auditoria-legado/route.ts`, mas nenhuma
migration oficial em `supabase/migrations/` reproduz seus
`CREATE TABLE`/`CREATE VIEW` originais — apenas migrations de hardening
(RLS/revoke) os referenciam. Nenhum arquivo movido, arquivado ou removido.
Detalhamento completo em D-009 (`DECISOES.md`).

Dois achados adicionais registrados, nenhum corrigido (fora do escopo desta
higiene):
1. **Achado de segurança crítico (D-010):** 7 das 13 views de
   `supabase-views.sql` (`vw_bairros_atendidos`, `vw_performance_geocoding`,
   `vw_mapa_calor`, `vw_top_logradouros`, `vw_evolucao_temporal`,
   `vw_distribuicao_cep`, `vw_cache_stats`) estão marcadas pelo advisor de
   segurança do Supabase como `security_definer_view` (nível ERROR) e têm
   grants completos (SELECT/INSERT/UPDATE/DELETE/etc.) para
   `anon`/`authenticated`, contornando o RLS habilitado em `geo_cache`
   (que tem RLS ON e zero policies). As 15 views equivalentes dos outros 3
   arquivos já foram endurecidas corretamente por
   `20260626180000_hardening_revoke_audit_views_fase_0_4`; este conjunto de
   7 ficou de fora. Risco: exposição de dados de geocoding (bairro, cidade,
   endereço, coordenadas) via chave pública `anon`.
2. **Gap de migration adicional:** a migration
   `20260626130504_add_motor_fields_search_execution_audit` aparece como
   aplicada em produção (`list_migrations` via MCP) mas não tem arquivo
   correspondente em `supabase/migrations/` no worktree — explica por que
   `supabase-search-execution-audit.sql` está desatualizado (faltam as
   colunas `motor`, `rota`, `tipo_execucao`, `run_id` reais da tabela).

Também confirmado: a tabela `geo_cache_addresses` citada em
`supabase-views.sql` e em `docs/procurar-datas-codemap.md` não existe — o
nome real é `geo_cache` (renomeado após a criação das views; Postgres
manteve as definições das views atualizadas por rastrear dependência via
OID). Doc desatualizado não corrigido nesta ação (fora de escopo — seria
Onda 3).

Nenhuma migration, schema, RLS, policy ou dado alterado nesta ação — apenas
leitura/introspecção via MCP (`list_tables`, `execute_sql` somente leitura,
`list_migrations`, `get_advisors`). Nenhum outro arquivo de código alterado;
apenas os artefatos do Projeto Multifase.

**Onda 1 concluída nesta sessão (3/3 itens).**

## Etapa anterior

Onda 1, item 2 (2026-08-10): `supabase-migration-digisac-conexoes-automacao.sql`
avaliado e **mantido** (não removido, não movido). Classificação A — migration
oficial necessária, ainda não incorporada a `supabase/migrations/`. Validado
via MCP Supabase (projeto `phsoawbdvhurroryfnok`): a tabela
`digisac_conexoes_automacao` existe em produção com estrutura idêntica ao
arquivo, mas nenhuma migration versionada contém o `CREATE TABLE` — a
migration oficial `20260724200159_hub_vendas_fase1_base` só insere nela,
assumindo pré-existência. Gap real entre `supabase/migrations/` e o banco
real, não uma duplicação a limpar. Decisão e evidência completas em D-008
(`DECISOES.md`). Nenhuma migration, schema, RLS, policy ou dado alterado —
apenas leitura/introspecção via MCP. Nenhum outro arquivo de código alterado
nesta ação; apenas os artefatos do Projeto Multifase.

Microcorreção de continuidade (2026-08-10): eliminada a contradição entre
`docs/ia/log_progress_legacy.md` (proíbe qualquer nova entrada, sem
exceção) e a exceção de "atualização de continuidade padrão ao final de
sessão" que constava em D-001 (`DECISOES.md`) e em `ESCOPO.md`. Ambos os
trechos foram corrigidos para deixar inequívoco que `docs/ia/log_progress.md`
está congelado sem exceção e que a continuidade corrente deste projeto vive
só nos quatro artefatos. Onda 1 item 1 permanece concluída; próximo passo
não mudou (ver abaixo).

Onda 1, item 1 (2026-08-10): `RESUMO_STACK.MD` removido. `git grep -n
"RESUMO_STACK"` confirmou ausência de consumidor operacional (única menção
textual restante, `.agents/README.md`, é histórica e continua correta sem
o arquivo). Conteúdo técnico do arquivo era idêntico e já superado por
`package.json` (Next.js 16.1.4, React 19.2.3 conferidos). Decisão registrada
em D-007 (`DECISOES.md`), item marcado concluído em `PLANO.md`. Nenhum outro
arquivo alterado nesta ação.

Fase C2.1 (2026-08-10): reconciliação dos quatro artefatos após decisão do
proprietário. `test-apps-script.ps1` removido de gates/pendências/próximo
passo deste projeto (D-004 atualizada para APROVADA — fora de escopo).
`appscript/logs.md` desmembrado para decisão própria e não bloqueante
(D-006, PENDENTE). Plano reordenado: fontes concorrentes promovidas a
Onda 1 (sem dependência de segurança/PII pendente); `appscript/logs.md`
passou a Onda 2, independente e não bloqueante das demais. ESCOPO aprovado
pelo proprietário (contrato geral da higiene estrutural aprovado nesta
fase). Nenhuma limpeza, remoção ou movimentação de arquivo candidato
executada nesta fase — apenas os quatro artefatos do projeto foram
alterados.

Fase C2 (2026-08-10): criação dos quatro artefatos do Projeto Multifase
(`ESCOPO.md`, `PLANO.md`, `STATUS.md`, `DECISOES.md`) e registro no índice
`docs/projetos/README.md`. Nenhuma limpeza, remoção ou movimentação
executada nesta fase.

Pré-condições já concluídas antes deste projeto (fases anteriores, fora
deste harness):
- Fase B/B2 — `docs/ia/log_progress.md` congelado como histórico legado;
  escrita global aposentada (ver `docs/ia/log_progress_legacy.md`).
- Fase C1 — `CONTEXTO DO PROJETO.MD` auditado e congelado; conteúdo único
  (mapa de Recebimento) absorvido em `.agents/rules/recebimento.md`.
- C0 (segurança) — token de `test-apps-script.ps1` sanitizado; script usa
  `$env:LEBEBE_APPS_SCRIPT_TEST_TOKEN`, sem valor literal no worktree
  atual (reconfirmado nesta fase).
- C1.5 — zero instrução operacional canônica escrevendo no log congelado;
  resíduos restantes são apenas históricos ou `.devin`.

## Em andamento

Nada em execução. Ondas 1, 2 e 3 concluídas (Onda 2 nesta sessão, 1/1 item
— `appscript/logs.md` removido, D-006 resolvida). Nenhuma frente aberta e
não bloqueada restante além das ondas ainda não iniciadas — ver "Próximo
passo".

## Próximo passo

**Ondas 1, 2 e 3 (`PLANO.md`) estão concluídas.** Nenhuma pendência aberta
nelas. Próximas ondas disponíveis, ambas dependem de Ondas 1 e 3
(satisfeitas) e não dependem uma da outra:
- **Onda 4:** avaliar scripts/dados auxiliares soltos na raiz
  (`procvlojas.md`, `desloc_backup.md`, `deslocamentos.gs`,
  `digisac_docs.md`, `scriptsreal.md`) frente aos equivalentes já
  organizados em `appscript/`/`scripts/`.
- **Onda 5:** legado `.devin/` (D-005, PENDENTE) — requer confirmação
  humana explícita se Devin (ou outra ferramenta) ainda depende desses
  arquivos diretamente; nunca decidida só por evidência de código.
Onda 6 (cosmética) só é detalhada depois de Ondas 4 e 5. Nenhum destes
itens foi executado nesta sessão.

## Pendências

- **Achado de segurança separado (não corrigido, apenas registrado em
  D-006):** `appscript/logs.md` (já removido do worktree) continha, numa
  linha de debug, a chave de API do LocationIQ em texto pleno numa URL —
  fora do padrão de mascaramento do restante do log. Recomenda-se
  confirmar validade/rotacionar a chave junto de quem administra as
  credenciais, como ação de segurança independente. A chave permanece
  recuperável nas 3 versões anteriores do arquivo no histórico Git
  (reescrita de histórico está fora do escopo desta higiene).
- `.devin/` aguarda decisão de compatibilidade antes de qualquer ação
  (Onda 5, D-005 PENDENTE).
- Achado (D-008, APROVADA quanto à classificação/decisão de não remover o
  arquivo solto): a tabela `digisac_conexoes_automacao` existe em produção
  sem migration oficial correspondente em `supabase/migrations/` — gap real
  de banco/migration, não uma pendência de organização de arquivos.
- Achado (D-009, APROVADA quanto à classificação): os 4 SQL auxiliares de
  `appscript/` têm o mesmo gap — objetos em produção (tabelas e 22 views)
  sem migration oficial de origem. Inclui gap adicional: migration
  `20260626130504_add_motor_fields_search_execution_audit` aplicada em
  produção sem arquivo correspondente no worktree.
- **Achado de segurança crítico (D-010) — RESOLVIDO em 2026-08-10, fora
  deste projeto de higiene:** as 7 views derivadas de `supabase-views.sql`
  (`vw_bairros_atendidos`, `vw_performance_geocoding`, `vw_mapa_calor`,
  `vw_top_logradouros`, `vw_evolucao_temporal`, `vw_distribuicao_cep`,
  `vw_cache_stats`) tinham grants completos para `anon`/`authenticated`,
  contornando o RLS de `geo_cache`. Corrigido em iniciativa de segurança
  separada via migration oficial
  `supabase/migrations/20260810191107_hardening_revoke_geo_cache_views_d010.sql`
  (revoke de grants, mesmo padrão da migration irmã já existente). Validado:
  `anon` não acessa mais as views; advisors não reportam mais os 7 findings
  `security_definer_view`. Ver D-010 (`DECISOES.md`) para detalhe completo.
- Decisão sobre criar migrations retroativas (D-008 e D-009) é de quem
  mantém o schema, não deste projeto de higiene estrutural.
- Achado de conteúdo (D-011, APROVADA quanto à classificação/movimento; não
  corrigido): `AUTO_LOGOUT_SETUP.md` (agora em `docs/tecnico/`) usa
  `auditoria_acesso` (singular) nos exemplos SQL/JSON; a tabela real é
  `auditoria_acessos` (plural). Precisa de revisão de conteúdo dedicada,
  fora do escopo desta ação de organização física.

## Decisões aguardando aprovação

Ver `DECISOES.md` — D-005 (`.devin/`) é a única PENDENTE. D-004
(`test-apps-script.ps1`), D-006 (`appscript/logs.md`), D-008, D-009, D-010,
D-011, D-012 e D-013 foram decididas (classificação/ação aprovadas).

## Arquivos principais envolvidos

`docs/tecnico/AUTO_LOGOUT_SETUP.md` · `docs/tecnico/GOOGLE_OAUTH_SETUP.md` ·
`docs/tecnico/SUPABASE_SETUP.md` (movidos na Onda 3 item 1) ·
`docs/tecnico/GOOGLE_SHEETS_SETUP.md` ·
`docs/inteligencia-comercial/inteligencia-comercial-*.md` (4 arquivos,
movidos na Onda 3 item 2) ·
`RESUMO_STACK.MD` · `supabase-migration-digisac-conexoes-automacao.sql` ·
`appscript/*.sql` · `procvlojas.md` ·
`desloc_backup.md` · `deslocamentos.gs` · `digisac_docs.md` ·
`scriptsreal.md` · `.devin/` · `docs/` (raiz, 25 itens restantes após a
Onda 3 item 2 — inventário real, ver D-012) · `CONTEXTO DO PROJETO.MD`
(mantido na raiz, D-013 — Onda 3 item 3 concluído).
`test-apps-script.ps1` não é mais um arquivo envolvido neste projeto
(D-004: fora de escopo). `appscript/logs.md` removido (Onda 2, D-006);
`.gitignore` ganhou entrada específica para esse caminho.

## Validações já realizadas

- MCP Supabase (2026-08-10, item 3 da Onda 1): `list_projects`,
  `list_tables`, `list_migrations`, `get_advisors` (security), `execute_sql`
  somente leitura (`information_schema.tables/views/columns/role_table_grants`,
  `pg_views`, `pg_indexes`, `pg_policies`) sobre `provider_costs`,
  `forex_config`, `geocoding_audit`, `search_execution_audit`, `geo_cache` e
  as 22 views analíticas dos 4 arquivos — confirmou estrutura real, dados,
  grants e ausência de migration oficial correspondente para todos. Nenhuma
  escrita executada no banco.
- MCP Supabase (2026-08-10, item 2 da Onda 1): `list_migrations`,
  `execute_sql` read-only (`information_schema.columns`, `pg_policies`,
  `pg_indexes`, `pg_constraint`, `pg_class.relrowsecurity`,
  `supabase_migrations.schema_migrations`, `SELECT` de metadados da tabela
  `digisac_conexoes_automacao`) — confirmou estrutura real e ausência de
  migration oficial correspondente. Nenhuma escrita executada no banco.
- `git status --short` no início e no fim da fase C2 e da fase C2.1
  (worktree preexistente preservado, nenhuma alteração descartada).
- Leitura de `test-apps-script.ps1` completo — confirmado token via env var,
  identificado payload com PII real (decisão: fora de escopo, D-004).
- Leitura integral de `appscript/logs.md` (Onda 2) — confirmado conteúdo com
  endereço de cliente, e-mail de usuário e chave de API LocationIQ em texto
  pleno; `git log --follow --stat` confirmou 3 substituições completas do
  conteúdo; `git grep` confirmou zero consumidor operacional; confirmado
  que a mesma instrumentação de log existe em `appscript/CEP-APIBACK.gs`
  (decisão tomada, D-006 — arquivo removido, `.gitignore` atualizado).
- Listagem de raiz, `.devin/`, `docs/`, `scripts/`, `appscript/`,
  `supabase/migrations/` para mapear candidatos.

## Não refazer

- Não repetir a auditoria estrutural completa — este projeto já reconstruiu
  o mínimo necessário por busca dirigida em C2.
- Não reabrir `CONTEXTO DO PROJETO.MD` além do já validado na Fase C1.
- Não reprocessar `docs/ia/log_progress.md` além de busca dirigida.
- Não reabrir o payload/dados de exemplo de `test-apps-script.ps1` nem a
  sanitização do segredo/token desse script — decidido como fora de escopo
  (D-004, APROVADA). Segredo literal atual encontrado no futuro é questão
  de segurança independente, fora desta iniciativa.

## Consultar

- ESCOPO.md — objetivo, dentro/fora de escopo, critérios de aceite (estado
  APROVADO).
- PLANO.md — Ondas 1, 2 e 3 concluídas; Onda 4 e Onda 5 para as opções de
  próximo passo.
- DECISOES.md — D-001 a D-013.
