# Decisões — Higiene Estrutural do Repositório

## D-001 — Log global permanece congelado

- Data: 2026-08-10
- Decisão: `docs/ia/log_progress.md` continua com escrita operacional
  aposentada (Fase B2) e **congelado sem exceção** — nenhuma entrada nova é
  criada nele, inclusive ao final de sessão. Continuidade corrente deste
  Projeto Multifase vive exclusivamente em `STATUS.md`, `PLANO.md`,
  `DECISOES.md` e `ESCOPO.md`. Consulta ao log antigo é permitida somente
  de forma histórica e dirigida (busca por termo/data), nunca como destino
  de escrita.
- Motivo/contexto: decisão já tomada e certificada em
  `docs/ia/log_progress_legacy.md` antes deste projeto existir; certificado
  proíbe explicitamente qualquer entrada nova, sem exceção.
- Impacto: continuidade deste projeto vive só nos quatro artefatos de
  `docs/projetos/higiene-estrutural-repositorio/`.
- Status: APROVADA

## D-002 — Projeto Multifase executado por ondas

- Data: 2026-08-10
- Decisão: a higiene estrutural é executada em ondas sequenciais ordenadas
  por risco (segurança → fontes concorrentes → movimentos seguros →
  scripts/SQL ambíguos → `.devin` → cosmética), não como tarefa única.
- Motivo/contexto: escopo tem múltiplas categorias de artefato, PII e
  legado de compatibilidade — risco de misturar decisão de segurança com
  reorganização estética.
- Impacto: nenhuma onda avança sem a anterior concluída ou explicitamente
  adiada por decisão humana (ver `PLANO.md`).
- Status: APROVADA

## D-003 — Segredos não ficam hardcoded em scripts

- Data: 2026-08-10
- Decisão: nenhum token, senha ou credencial literal deve existir em
  scripts versionados; uso de variável de ambiente é o padrão (já aplicado
  em `test-apps-script.ps1` antes deste projeto).
- Motivo/contexto: princípio de segurança geral do projeto; confirmado
  vigente ao reconfirmar `test-apps-script.ps1` nesta fase.
- Impacto: qualquer script futuro identificado com segredo literal vira
  bloqueio P0 imediato, fora da sequência normal de ondas.
- Status: APROVADA

## D-004 — Tratamento do payload de exemplo em test-apps-script.ps1

- Data: 2026-08-10 (aberta) · Reconciliada: 2026-08-10 (Fase C2.1)
- Decisão: o payload de exemplo em `test-apps-script.ps1` (seção "TESTE API
  — REAGENDAR CLIENTE") está **fora do escopo** desta iniciativa de higiene
  estrutural. Não é gate, pendência nem próximo passo deste projeto. A
  sanitização do segredo/token desse script é trabalho anterior e considerado
  encerrado para fins deste projeto (D-003 permanece válida e cobre o
  princípio geral de segredo). Se um segredo literal atual for encontrado no
  worktree no futuro, trata-se de questão de segurança independente, fora
  desta iniciativa.
- Motivo/contexto: decisão do proprietário registrada em 2026-08-10 (Fase
  C2.1). O achado original (fase C2) misturava dois assuntos distintos —
  payload de exemplo em `test-apps-script.ps1` e log operacional em
  `appscript/logs.md`. A parte de `appscript/logs.md` foi desmembrada para
  `D-006` para não confundir o escopo desta decisão.
- Impacto: nenhum item relativo a `test-apps-script.ps1` bloqueia mais
  qualquer onda deste projeto.
- Status: APROVADA

## D-005 — Destino do legado .devin/

- Data: 2026-08-10
- Decisão: ainda não tomada.
- Motivo/contexto: `.devin/rules/` (6 arquivos) e `.devin/workflows/login.md`
  permanecem intactos como legado de compatibilidade desde a Fase 2
  (`.agents/README.md`). Decisão de remover, arquivar ou manter depende de
  confirmar se Devin (ou outra ferramenta) ainda lê esses arquivos
  diretamente neste projeto.
- Impacto: bloqueia apenas a Onda 5 (`PLANO.md`) — não impede as ondas
  anteriores.
- Status: PENDENTE

## D-008 — supabase-migration-digisac-conexoes-automacao.sql mantido; gap de migration oficial

- Data: 2026-08-10
- Decisão: `supabase-migration-digisac-conexoes-automacao.sql` (raiz) **não é
  removido**. Classificado como A — MIGRATION OFICIAL NECESSÁRIA, ainda não
  incorporada ao histórico versionado de `supabase/migrations/`.
- Motivo/contexto: validado via MCP Supabase (projeto `phsoawbdvhurroryfnok`)
  que a tabela `public.digisac_conexoes_automacao` existe em produção com
  estrutura idêntica ao arquivo (colunas, PK, `UNIQUE(service_id)`, índice
  parcial `idx_digisac_conexoes_automacao_ativo`, RLS habilitado, as 3
  policies de superadmin com corpo idêntico). Porém nenhum arquivo em
  `supabase/migrations/` e nenhuma linha em
  `supabase_migrations.schema_migrations` contém o `CREATE TABLE` dessa
  tabela — a única migration oficial que a referencia
  (`20260724200159_hub_vendas_fase1_base`) apenas faz `INSERT` nela,
  assumindo que já existe. `created_at` da primeira linha (Bigorrilho,
  2026-07-06 19:07 UTC) bate com a data do commit que introduziu o arquivo
  (`git log`, 2026-07-06) e com o registro histórico dirigido em
  `docs/ia/log_progress.md` (linhas ~4289 e ~4337: arquivo criado como
  migration a ser aplicada via MCP quando disponível, marcado "CRÍTICO" —
  MCP estava indisponível na sessão original, então a DDL foi aplicada fora
  do mecanismo oficial). Código de produção (`src/lib/digisac/
  finalizacoesAutomaticas.ts`, rotas `finalizacoes-automaticas/*`) consulta
  essa tabela diretamente em runtime — dependência operacional real.
  Consequência prática: reconstruir o banco só a partir de
  `supabase/migrations/` quebraria a migration `hub_vendas_fase1_base` (INSERT
  em tabela inexistente) e todo o fluxo de finalizações automáticas.
  Achado adicional, não acionado nesta decisão (fora do escopo desta ação de
  higiene): 2 das 4 linhas atuais da tabela (Portão, Marechal — created_at
  2026-07-06 19:18 UTC) não constam nem no arquivo solto nem em nenhuma
  migration oficial, evidência de mais uma inserção manual fora de qualquer
  arquivo versionado.
- Impacto: nenhuma remoção/movimentação de arquivo nesta ação. Fica como
  pendência de banco/migration — não de higiene estrutural — decidir se uma
  migration oficial retroativa (documentando o `CREATE TABLE` já aplicado)
  deve ser criada. Não bloqueia os demais itens independentes da Onda 1.
- Status: APROVADA (classificação e decisão de não remover); a criação de
  migration retroativa é uma ação separada, fora do escopo deste projeto de
  higiene estrutural, e não foi executada.

## D-007 — Remoção de RESUMO_STACK.MD

- Data: 2026-08-10
- Decisão: `RESUMO_STACK.MD` (raiz) removido definitivamente, sem
  substituto criado.
- Motivo/contexto: conteúdo era narração de resposta de chat de agente de
  IA deixada por engano no arquivo (linha 1 começa com "Vou analisar a
  stack tecnológica..."), não documentação técnica intencional. Todo dado
  técnico (Next.js 16.1.4, React 19.2.3 etc.) é idêntico e já coberto por
  `package.json`, fonte superior e sempre atualizada. `git grep` confirmou
  ausência de consumidor operacional; a única menção textual restante
  (`.agents/README.md`) é histórica ("antes desta fundação... vivia
  duplicado... em RESUMO_STACK.MD"), permanece correta descrevendo estado
  passado mesmo sem o arquivo existir.
- Impacto: primeiro item da Onda 1 concluído; nenhuma referência quebrada.
- Status: APROVADA

## D-009 — SQL auxiliares de appscript/ mantidos; gap de migration oficial (4 arquivos)

- Data: 2026-08-10
- Decisão: os 4 arquivos `.sql` de `appscript/` (`supabase-views.sql`,
  `supabase-cache-analytics-real.sql`, `supabase-add-duration-tracking.sql`,
  `supabase-search-execution-audit.sql`) **não são movidos, arquivados nem
  removidos**. Todos classificados **A — MIGRATION OFICIAL NECESSÁRIA, ainda
  não incorporada** — mesmo padrão do D-008.
- Motivo/contexto: validado via MCP Supabase (projeto `phsoawbdvhurroryfnok`)
  que todos os objetos de banco criados pelos 4 arquivos existem em produção
  e têm consumidor operacional real em código
  (`src/app/api/procurar-datas/performance/route.ts`,
  `src/app/api/procurar-datas/auditoria-legado/route.ts`,
  `src/lib/procurar-datas/endereco-cache.ts`). Nenhuma migration oficial em
  `supabase/migrations/` reproduz o `CREATE TABLE`/`CREATE VIEW` original de
  nenhum dos 4 — apenas as migrations de hardening
  (`20260626160000_hardening_rls_grants_fase_0_3`,
  `20260626170000_hardening_rls_grants_fase_0_4_audit_tables`,
  `20260626180000_hardening_revoke_audit_views_fase_0_4`) os referenciam
  (RLS/REVOKE), assumindo pré-existência. Os 4 arquivos vieram de um único
  commit de importação (`7108ebc`, 2026-03-13) que trouxe todo o legado
  Apps Script para o repositório de uma vez — não representam a ordem real
  de execução no banco, que ocorreu antes dessa importação, diretamente no
  SQL Editor do Supabase.
  Detalhe por arquivo:
  - `supabase-cache-analytics-real.sql`: cria `provider_costs` (7 linhas
    reais, batendo com o INSERT do arquivo), `forex_config` (1 linha),
    `geocoding_audit` (colunas base) e 5 views `vw_economia_*`. Sintaxe do
    arquivo usa `INDEX idx_... (...)` inline dentro do `CREATE TABLE`, que
    não é válido em Postgres — os índices reais em produção têm nomes
    diferentes dos do arquivo, confirmando que o texto do arquivo não foi
    executado literalmente (alguém corrigiu a sintaxe na hora de rodar).
    Views com grants corretamente restritos (hardening aplicado).
  - `supabase-add-duration-tracking.sql`: `ALTER TABLE geocoding_audit ADD
    duration_ms` + 2 índices + 5 views `vw_performance_*`. Única exceção
    onde a sintaxe do arquivo bate exatamente com os índices reais
    (`idx_geocoding_audit_duration`, `idx_geocoding_audit_created_duration`).
    Coluna `duration_ms` é consumida diretamente por
    `performance/route.ts`. GRANTs originais do arquivo (anon/authenticated)
    foram revogados depois pela migration de hardening 0.4 — estado atual
    seguro.
  - `supabase-search-execution-audit.sql`: cria `search_execution_audit`
    (26 colunas originais) + 4 índices + 5 views `vw_search_*`. Tabela real
    em produção tem 4 colunas a mais (`motor`, `rota`, `tipo_execucao`,
    `run_id`) que não constam no arquivo — ver achado adicional abaixo.
    Views com grants corretamente restritos (hardening aplicado).
  - `supabase-views.sql`: cria 13 views sobre uma tabela chamada
    `geo_cache_addresses` no arquivo, mas essa tabela **não existe** no
    banco real — o nome real é `geo_cache`. Das 13 views do arquivo, apenas
    7 existem em produção (`vw_bairros_atendidos`, `vw_cache_stats`,
    `vw_distribuicao_cep`, `vw_evolucao_temporal`, `vw_mapa_calor`,
    `vw_performance_geocoding`, `vw_top_logradouros`) — suas definições reais
    (`pg_views`) já apontam para `geo_cache`, confirmando que a tabela foi
    renomeada depois da criação das views (Postgres atualiza a definição
    automaticamente por rastrear dependência por OID, não por nome). As
    outras 6 views do arquivo (`vw_volume_por_hora`,
    `vw_volume_por_dia_semana`, `vw_confidence_buckets`,
    `vw_provider_share`, `vw_ultimas_buscas`, `vw_atividade_recente`) nunca
    foram criadas — aplicação parcial. Ver D-010 para o achado de segurança
    associado a este arquivo.
  Achado adicional, fora do escopo desta decisão (registrado aqui apenas
  como contexto): a migration `20260626130504_add_motor_fields_search_execution_audit`
  aparece em `list_migrations` do MCP Supabase (aplicada em produção) mas
  **não tem arquivo correspondente em `supabase/migrations/`** no worktree
  atual — gap de reprodutibilidade distinto do D-008, mas do mesmo tipo.
  Explica por que `supabase-search-execution-audit.sql` está desatualizado
  frente ao schema real.
- Impacto: nenhuma remoção/movimentação de arquivo nesta ação. Onda 1
  (`PLANO.md`) concluída. Fica como pendência de banco/migration — não de
  higiene estrutural — decidir se migrations oficiais retroativas devem ser
  criadas para os 4 arquivos e para a migration
  `add_motor_fields_search_execution_audit`. Não bloqueia as demais ondas.
- Status: APROVADA (classificação e decisão de não remover/mover); criação
  de migrations retroativas é ação separada, fora do escopo deste projeto de
  higiene estrutural, e não foi executada.

## D-010 — Achado de segurança crítico: views derivadas de supabase-views.sql com SECURITY DEFINER e grants completos para anon/authenticated

- Data: 2026-08-10 (identificado); **corrigido em 2026-08-10, em iniciativa
  de segurança separada** (fora do harness de higiene estrutural, conforme
  §16 do AGENTS.md/prompt daquela iniciativa).
- Decisão original (nesta higiene): nenhuma correção aplicada aqui — fora do
  escopo desta iniciativa de higiene estrutural, conforme regra explícita de
  não corrigir banco/RLS/policy. Achado registrado como pendência de
  segurança independente.
- Resolução (iniciativa separada, 2026-08-10): aplicada a migration oficial
  `supabase/migrations/20260810191107_hardening_revoke_geo_cache_views_d010.sql`
  via MCP Supabase, revogando grants de `anon`/`authenticated`/`PUBLIC` nas 7
  views (mesmo padrão de
  `20260626180000_hardening_revoke_audit_views_fase_0_4`). Nenhuma view ou
  tabela base foi alterada; apenas grants. Validado pós-aplicação: `anon` não
  consegue mais consultar as views (`permission denied`); RLS/policies de
  `geo_cache` inalterados; os 7 findings `security_definer_view` (ERROR)
  desapareceram do `get_advisors` de segurança; nenhum consumidor
  encontrado no repositório (`src/**`, docs, appscript) para essas 7 views
  especificamente. Detalhes completos fora dos artefatos deste projeto de
  higiene (achado tratado como iniciativa própria, não documentado em
  PLANO/ESCOPO desta higiene).
- Motivo/contexto: validado via MCP Supabase (`get_advisors` tipo security e
  `information_schema.role_table_grants`) que as 7 views reais derivadas de
  `supabase-views.sql` (`vw_bairros_atendidos`, `vw_performance_geocoding`,
  `vw_mapa_calor`, `vw_top_logradouros`, `vw_evolucao_temporal`,
  `vw_distribuicao_cep`, `vw_cache_stats`) estão marcadas pelo linter de
  segurança do Supabase como `security_definer_view` (nível **ERROR**) e têm
  grants completos (SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES,
  TRIGGER) concedidos a `anon` e `authenticated`. Como essas views rodam com
  o privilégio do dono (SECURITY DEFINER), elas **contornam o RLS
  habilitado em `geo_cache`** (que tem RLS ON e zero policies — ou seja,
  sem as views, `anon`/`authenticated` não veriam nenhuma linha da tabela
  base). Isso expõe dados de geocoding (bairro, cidade, endereço completo,
  coordenadas lat/lng — ver `vw_ultimas_buscas`/`vw_mapa_calor`) para
  qualquer portador da chave `anon`. As 15 views equivalentes derivadas dos
  outros 3 arquivos SQL (`geocoding_audit`/`search_execution_audit`) já
  foram corretamente endurecidas pela migration
  `20260626180000_hardening_revoke_audit_views_fase_0_4` — este conjunto de
  7 views (originado de `geo_cache`) ficou fora dessa migration de
  hardening e continua exposto.
- Impacto: risco de exposição de dados operacionais (endereços de clientes,
  coordenadas) via chave pública `anon`, sem necessidade de autenticação.
  Não corrigido nesta ação (fora de escopo de higiene estrutural, banco
  intacto). Recomenda-se abrir uma iniciativa de segurança dedicada,
  seguindo o mesmo padrão da migration 0.4 (`ALTER TABLE ... ENABLE ROW
  LEVEL SECURITY` já está em `geo_cache`; falta apenas revogar os grants
  amplos dessas 7 views e/ou recriá-las como `SECURITY INVOKER`).
- Status: APROVADA (classificação e decisão de não corrigir nesta
  iniciativa); tratamento fica como bloqueio/pendência de segurança
  separada, fora do escopo deste projeto de higiene estrutural.

## D-006 — Retenção/sanitização de appscript/logs.md

- Data: 2026-08-10 (desmembrada de D-004 na Fase C2.1); **decidida em
  2026-08-10 (Onda 2)**.
- Decisão: `appscript/logs.md` classificado **C — LOG GERADO/REPRODUZÍVEL**.
  **Removido do worktree** (`git rm`, sem substituto criado) e adicionada
  regra específica ao `.gitignore` (`appscript/logs.md`) para evitar
  recorrência.
- Motivo/contexto: leitura integral confirmou que o arquivo é uma captura
  manual de uma única execução do Google Cloud Logging (Apps Script) — 39
  linhas, ~65 segundos de trace da função `ResolverEnderecoComCache_`
  (cascata de geocoding: LocationIQ → maps.co → ViaCEP, cache L1/Supabase).
  Toda a instrumentação que gera essas linhas de log (`[LOOKUP]`,
  `[GEO-CACHE]`, `[GEO-PROVIDER]`, etc.) está implementada em código-fonte
  real e presente no repositório (`appscript/CEP-APIBACK.gs`, 17
  ocorrências dos mesmos marcadores) — ou seja, o arquivo é 100%
  reproduzível a qualquer momento re-executando a função e consultando o
  Cloud Logging, não é fonte de conhecimento exclusivo.
  `git log --follow --stat` sobre o arquivo mostrou histórico de **3
  substituições completas** do conteúdo (7108ebc 2026-03-13: criação, 1294
  linhas; d91aff9 2026-03-13: reescrita total, 1295 linhas; 97c650b
  2026-04-08: reescrita total, reduzida a 39 linhas) — confirma padrão
  recorrente de "colar captura de debug fresca por cima da anterior", não
  um log cumulativo com valor histórico. Nenhum consumidor operacional
  encontrado: `git grep` pelo caminho do arquivo só retornou os próprios
  artefatos deste Projeto Multifase.
  Conteúdo sensível confirmado (não reproduzido aqui, por regra da tarefa):
  endereço residencial completo de cliente em texto pleno (rua, número,
  bairro, cidade/UF) repetido em várias linhas, e-mail do usuário operador
  do script (domínio interno da empresa, não de cliente), e coordenadas
  geográficas resultantes.
  **Achado de segurança separado e prioritário identificado nesta análise:**
  uma das linhas de debug (chamada HTTP ao provider LocationIQ) expõe a
  chave de API desse provider **em texto pleno na query string da URL**,
  fora do padrão de mascaramento (`***xxxx`) que o restante do log usa para
  a mesma chave. Não reproduzido aqui — tipo: chave de API LocationIQ;
  localização: estava em `appscript/logs.md` (arquivo já removido do
  worktree; permanece recuperável do histórico Git, ver nota abaixo). A
  resposta da chamada indicava rate limit diário, mas isso não garante que
  a chave esteja inválida ou revogada — recomenda-se tratamento
  independente (confirmar validade/rotacionar a chave junto de quem
  administra as credenciais do LocationIQ), fora do escopo desta higiene
  estrutural.
  Valor técnico/diagnóstico: a única análise de performance que já foi
  extraída de uma captura anterior deste mesmo arquivo (gargalos de cache
  Supabase e audit logging) está preservada de forma sanitizada e sem PII
  em `appscript/OTIMIZACOES-PERFORMANCE.md`, que cita "análise de logs.md"
  apenas como nota histórica de origem — não é uma referência de caminho
  operacional e não quebra com a remoção.
  Nota sobre histórico Git: remover o arquivo do worktree não apaga as 3
  versões anteriores do objeto no histórico do Git (permanecem recuperáveis
  via `git log`/`git show` para quem tiver acesso ao repositório). Reescrita
  de histórico (`filter-repo`/BFG/force-push) está fora do escopo desta
  ação, por instrução explícita da tarefa; se a chave exposta acima for
  confirmada como credencial ainda válida, a limpeza de histórico Git seria
  uma ação adicional a avaliar separadamente pelo responsável de segurança.
- Impacto: `appscript/logs.md` removido do worktree; `.gitignore` ganhou uma
  entrada específica (`appscript/logs.md`) para essa recorrência conhecida
  não voltar a ser versionada. Nenhuma referência operacional quebrada.
  Onda 2 (`PLANO.md`) concluída.
- Status: APROVADA

## D-011 — docs/tecnico/ como destino canônico de runbooks técnicos; AUTO_LOGOUT_SETUP.md, GOOGLE_OAUTH_SETUP.md e SUPABASE_SETUP.md movidos

- Data: 2026-08-10 (Onda 3, item 1)
- Decisão: os três runbooks soltos na raiz (`AUTO_LOGOUT_SETUP.md`,
  `GOOGLE_OAUTH_SETUP.md`, `SUPABASE_SETUP.md`) foram classificados como
  **DOCUMENTAÇÃO TÉCNICA ATUAL** e movidos via `git mv` para
  `docs/tecnico/` (pasta nova, criada nesta ação). `docs/tecnico/` passa a
  ser o destino canônico de runbooks técnicos operacionais (distinto de
  `docs/` genérico e de `docs/ia/` histórico).
- Motivo/contexto: validação confirmou que os três continuam descrevendo
  fluxos reais e ativos do sistema — nenhum aponta para estrutura
  inexistente:
  - `AUTO_LOGOUT_SETUP.md`: cron `src/app/api/cron/auto-logout/route.ts`,
    `src/middleware.ts`, migration `006_auto_logout_audit.sql` e a tabela
    `sessoes_logout_automatico` existem e continuam referenciados no código
    atual.
  - `GOOGLE_OAUTH_SETUP.md`: fluxo de login via Google confirmado ativo em
    `src/app/(auth)/login/page.tsx` e `src/app/auth/callback/route.ts`;
    tabela `usuarios_permitidos` confirmada em uso.
  - `SUPABASE_SETUP.md`: `supabase/migrations/001_initial_schema.sql` e
    `002_fix_rls_recursion.sql`, citados no documento, ainda existem no
    formato numerado legado (o repositório mistura numerado antigo e
    timestamped novo em `supabase/migrations/`, então a referência não está
    quebrada).
  - Nenhum arquivo externo ao projeto referenciava os três pelo nome
    (`git grep` dirigido, sem resultado fora dos próprios artefatos deste
    Projeto Multifase). Única referência interna corrigida: a listagem de
    estrutura de pastas dentro do próprio `SUPABASE_SETUP.md`, que citava
    `SUPABASE_SETUP.md` na raiz — atualizada para
    `docs/tecnico/SUPABASE_SETUP.md`.
- Pendência de conteúdo registrada, não corrigida nesta ação (fora de
  escopo de uma ação de organização física — ver `PLANO.md` Onda 3):
  `AUTO_LOGOUT_SETUP.md` usa `auditoria_acesso` (singular) em todos os
  exemplos SQL e JSON, mas a tabela real (confirmada em
  `supabase/migrations/001_initial_schema.sql` e no código de
  `src/app/api/cron/auto-logout/route.ts`,
  `src/app/api/auditoria/registrar/route.ts`,
  `src/app/superadmin/PageClient.tsx`) é `auditoria_acessos` (plural). Um
  humano que copiar os exemplos SQL do documento vai consultar uma tabela
  inexistente. Classificação: DOCUMENTAÇÃO TÉCNICA PARCIALMENTE
  DESATUALIZADA nesse ponto específico — não corrigido aqui por exigir
  revisão dedicada do documento, não uma correção pontual inequívoca no
  escopo desta ação de mover arquivos.
- Impacto: nenhuma alteração funcional; três arquivos relocados, uma linha
  de referência interna corrigida em um deles.
- Status: APROVADA

## D-013 — CONTEXTO DO PROJETO.MD classificado histórico congelado útil; permanece na raiz

- Data: 2026-08-10 (Onda 3, item 3)
- Decisão: `CONTEXTO DO PROJETO.MD` classificado **B — HISTÓRICO CONGELADO
  ÚTIL**. Destino físico: **permanece na raiz do repositório** — nenhum
  movimento executado, nenhum conteúdo reescrito.
- Motivo/contexto: leitura integral confirmou que o arquivo já possui banner
  de congelamento claro e suficiente (aplicado na Fase C1, 2026-08-10):
  declara explicitamente que não é mais fonte operacional, aponta
  `AGENTS.md`/`.agents/rules/`/`.agents/skills/` como fonte vigente, afirma
  que o código real sempre vence em divergência, e já registra que seu
  único conteúdo único e válido (mapa de rotas/APIs/entidades do
  Recebimento, §6.2–§6.4, e pontos frágeis, §6.6) foi absorvido em
  `.agents/rules/recebimento.md`. Nada foi encontrado que ainda pudesse ser
  confundido com fonte canônica. `git grep` pelo caminho/nome do arquivo
  encontrou 8 ocorrências: as próprias entradas deste Projeto Multifase
  (`STATUS.md`, `PLANO.md`, `ESCOPO.md`, este arquivo), o autorreferência do
  banner dentro do próprio `CONTEXTO DO PROJETO.MD`, duas menções
  puramente históricas em `.agents/README.md` e
  `.agents/rules/README.md` (narrando a migração da Fase 2/C1, sem link de
  caminho operacional) e uma menção histórica dentro de
  `.agents/rules/recebimento.md` (nota de proveniência do mapa herdado,
  também sem link de caminho operacional) e uma no log congelado
  `docs/ia/log_progress.md` (não tocado, por regra). Nenhuma dessas
  referências é operacional atual nem quebra com o arquivo permanecendo no
  lugar. Avaliado `docs/ia/` como possível destino de pasta histórica (única
  candidata plausível no repositório) e descartado: a pasta mistura
  diagnósticos/planos ativos de segurança/auth com um documento hoje
  operacional (`padrao-novas-telas-permissoes.md`, referenciado por
  `.agents/rules/novas-telas-permissoes.md`) — não é uma pasta puramente
  histórica, e mover para lá associaria o documento congelado a conteúdo
  vigente de outro domínio, piorando a descoberta em vez de melhorá-la.
  Instrução da tarefa proíbe criar pasta genérica nova (`docs/historico/`
  ou similar) só para este arquivo. Sem candidata melhor, a regra "na
  dúvida, preservar" se aplica: manter na raiz é a decisão correta.
- Impacto: nenhum arquivo movido, nenhuma referência alterada, nenhum
  conteúdo reescrito. Onda 3 (`PLANO.md`) concluída (3/3 itens).
- Status: APROVADA

## D-012 — Auditoria de docs/ (nível superior): dois movimentos de baixo risco; maioria mantida em raiz por ser âncora de índice, grupo interligado ou protegida por regra de módulo

- Data: 2026-08-10 (Onda 3, item 2)
- Decisão: dos 30 arquivos soltos no nível superior de `docs/` (inventário
  real; STATUS anterior estimava ~35), apenas dois movimentos foram
  executados nesta ação — os demais foram mantidos por evidência concreta
  de que mover geraria custo de descoberta maior que o ganho estético:
  1. `docs/GOOGLE_SHEETS_SETUP.md` → `docs/tecnico/GOOGLE_SHEETS_SETUP.md`
     (mesmo padrão do D-011: runbook técnico atual, zero referência externa,
     mesma pasta que já recebeu os três runbooks da Onda 3 item 1).
  2. Quatro documentos `inteligencia-comercial-*.md` → nova pasta
     `docs/inteligencia-comercial/` (nomes de arquivo preservados
     integralmente, só o diretório mudou): `inteligencia-comercial-
     contexto-vendas-anteriores-ia.md`, `-influencia-temporal-historico-
     chamados.md`, `-mensagens-contato-sem-ticket.md`,
     `-multiplas-conexoes-digisac.md`. Grupo semanticamente coeso (mesma
     feature, mesmo módulo coberto por `.agents/rules/inteligencia-
     comercial.md`), todos com status "concluído/implementado" no próprio
     texto, nenhum referenciado por `AGENTS.md`, `.agents/`,
     `docs/projetos/README.md` ou por outro documento além do log
     congelado — confirmado via `git grep` dirigido pelos quatro nomes de
     arquivo antes do movimento.
- Motivo/contexto para os itens **mantidos** em `docs/` (não movidos nesta
  ação, evidência registrada por grupo):
  - `docs/PLANO FUNCIONAL ATUALIZADO — FICHA DE ATENDIMENTO PRESENCIAL.md`,
    `docs/ficha-atendimento-presencial-progresso.md` e
    `docs/digisac-hub-vendas-plano-progresso.md`: citados por caminho
    explícito em `docs/projetos/README.md` como ponto de entrada conhecido
    de projetos ainda fora do harness — mover exigiria atualizar esse
    índice canônico e reduziria o custo de descoberta que o índice existe
    para evitar.
  - `docs/atendimento-automatico-posvenda-mere-plano.md`: o próprio
    documento se autodeclara "fonte de continuidade vigente da feature"
    (Fase 1B ainda pendente) — mantido no mesmo padrão de
    `atendimento-automatico-posvenda-mere-plano.md` como documento vivo.
  - `docs/atendimento-presencial-registros-rascunhos.md` e
    `docs/atendimento-presencial-simplificacao-fluxo.md`: interligados por
    referência direta (`registros-rascunhos.md` cita `simplificacao-
    fluxo.md` como "documento de fluxo a ser atualizado") e parte do mesmo
    grupo temático dos dois documentos-âncora citados acima que precisam
    ficar na raiz — separar apenas parte do grupo prejudicaria a
    descoberta, não ajudaria.
  - `docs/digisac-hub-vendas-recuperacao-leads.md`: referenciado por
    caminho relativo dentro de `docs/digisac-hub-vendas-plano-progresso.md`
    (o documento-âncora que precisa ficar na raiz) — mover só este exigiria
    atualizar essa referência e separaria conteúdo do mesmo tema.
  - `docs/snippets-devtools-opcao-b-comparacao.md`: referenciado por
    caminho relativo dentro dos dois documentos obrigatórios do módulo
    `/procurar-datas` (`procurar-datas-escopo-equivalencia-legado-v2.md` e
    `procurar-datas-motor-v2-progresso.md`) — protegido pela regra do
    módulo (`.agents/rules/procurar-datas.md`) mesmo sem o prefixo
    `procurar-datas-` no nome.
  - Todos os 16 arquivos `procurar-datas-*.md`: protegidos integralmente
    pela regra do módulo — não avaliados para movimento nesta ação, por
    instrução explícita da tarefa.
  - `docs/plano-acesso-usuarios-e-unidades.md`: o próprio documento declara
    "nenhuma implementação funcional realizada"; checagem pontual no código
    atual (`src/app/superadmin/page.tsx`) confirmou que ainda não existe
    separação de autorização por aba — plano ainda não implementado
    (classificação C, ativo/pendente), mantido para fácil descoberta.
  - `docs/checklist-validacao-ficha-telefone-rascunhos.md` e
    `docs/links-protocolos-digisac.md`: zero referência encontrada em
    qualquer lugar do repositório (nem mesmo no log congelado), mas também
    nenhum grupo temático claro com massa suficiente para justificar pasta
    nova — classificação G/D (incerto/histórico provável), mantidos em
    `docs/` por padrão de cautela (regra: na dúvida, preservar; não criar
    pasta genérica só para reduzir contagem de arquivos soltos).
- Impacto: 5 arquivos relocados (1 para `docs/tecnico/`, 4 para
  `docs/inteligencia-comercial/`, pasta nova); 25 arquivos permanecem no
  nível superior de `docs/`, cada um com motivo registrado nesta decisão.
  Nenhum conteúdo reescrito, nenhuma referência operacional quebrada
  (confirmado via `git grep` pós-movimento).
- Status: APROVADA
