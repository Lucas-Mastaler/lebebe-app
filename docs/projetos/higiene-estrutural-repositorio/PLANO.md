# Plano — Higiene Estrutural do Repositório

**Estado do planejamento:** CONCLUÍDO — Ondas 1 a 6 executadas
(2026-08-10/11). Ver `STATUS.md` para o resumo final e `DECISOES.md`
(D-001 a D-015) para o detalhamento de cada decisão.

Ondas ordenadas por risco, mas sem bloqueio artificial entre frentes
independentes: (1) fontes concorrentes e resíduos seguros, (2) dados/logs
sensíveis localizados, (3) organização documental, (4) scripts/SQL
ambíguos, (5) legado `.devin`, (6) cosmética. Nenhuma onda abaixo foi
executada — esta é a fase C2.1 (reconciliação dos artefatos, ainda sem
execução).

Reconciliação (Fase C2.1, 2026-08-10): a antiga "Onda 1 — Segurança e
dados" misturava duas coisas distintas. O item de `test-apps-script.ps1`
foi decidido pelo proprietário como **fora de escopo** desta iniciativa
(ver `DECISOES.md` D-004) e removido deste plano — a sanitização do
segredo/token desse script é trabalho anterior já concluído e não é
reaberta aqui. O item de `appscript/logs.md` continua no projeto, mas como
decisão localizada (D-006) que não bloqueia as demais frentes independentes
— ver Onda 2 abaixo. A antiga "Onda 2 — Fonte de verdade / duplicados" foi
promovida a Onda 1, por não depender de nenhuma decisão de segurança/PII
pendente.

## Onda 1 — Fontes concorrentes e resíduos seguros

Objetivo: eliminar ambiguidade entre documentos/scripts concorrentes, sem
nenhuma dependência de decisão de segurança/PII pendente.
Dependências: nenhuma — pode começar primeiro.

- [x] Avaliar `RESUMO_STACK.MD` (raiz, 53 linhas) — resumo técnico solto,
      não referenciado por `AGENTS.md`/`.agents/`; decidir se é absorvido,
      congelado como histórico (como `CONTEXTO DO PROJETO.MD`) ou removido.
      **Resultado (2026-08-10):** removido. Era narração de chat de agente de
      IA deixada por engano (linha 1: "Vou analisar a stack tecnológica...");
      conteúdo técnico (Next.js 16.1.4, React 19.2.3 etc.) idêntico e já
      superado por `package.json`. Sem consumidor operacional — única
      referência textual (`.agents/README.md`) é histórica, descreve estado
      anterior à fundação e continua válida sem o arquivo existir. Ver D-007.
- [x] Avaliar `supabase-migration-digisac-conexoes-automacao.sql` (raiz,
      106 linhas) — SQL solto fora do padrão timestamped de
      `supabase/migrations/`; confirmar se já foi aplicado via migration
      oficial antes de decidir (mover, arquivar ou remover).
      **Resultado (2026-08-10):** classificação A (migration oficial
      necessária, não incorporada) — mantido, nada removido. Confirmado via
      MCP Supabase que a tabela `digisac_conexoes_automacao` existe em
      produção com estrutura idêntica ao arquivo, mas nenhum arquivo em
      `supabase/migrations/` nem entrada em
      `supabase_migrations.schema_migrations` contém o `CREATE TABLE`; a
      migration oficial `20260724200159_hub_vendas_fase1_base` só faz
      `INSERT` nela, assumindo pré-existência. Gap real de migration
      registrado em D-008.
- [x] Avaliar os `.sql` auxiliares em `appscript/`
      (`supabase-add-duration-tracking.sql`, `supabase-cache-analytics-real.sql`,
      `supabase-search-execution-audit.sql`, `supabase-views.sql`) frente às
      migrations oficiais — checar se representam rascunho já aplicado,
      script de apoio ainda usado, ou duplicação obsoleta.
      **Resultado (2026-08-10):** inventário real confirmou exatamente os 4
      arquivos previstos (nenhum a mais). Todos classificados **A — migration
      oficial necessária, não incorporada** (mesmo padrão do D-008): os
      objetos de banco de todos os 4 (tabelas `provider_costs`,
      `forex_config`, `geocoding_audit`, `search_execution_audit`, e 22 views
      analíticas) existem em produção e têm consumidor operacional real
      (`src/app/api/procurar-datas/performance/route.ts`,
      `src/app/api/procurar-datas/auditoria-legado/route.ts`), mas nenhuma
      migration oficial reproduz seus `CREATE TABLE`/`CREATE VIEW` — apenas
      migrations de hardening (RLS/revoke) os referenciam. Nenhum arquivo
      movido, arquivado ou removido — todos mantidos. Ver D-009 para o
      detalhamento por arquivo e D-010 para um achado de segurança crítico
      (não corrigido, apenas registrado) encontrado em `supabase-views.sql`:
      7 views herdadas dela rodam como SECURITY DEFINER com grants completos
      para `anon`/`authenticated`, contornando o RLS de `geo_cache` — as
      demais 15 views dos outros 3 arquivos já foram endurecidas
      corretamente por migration oficial, mas este conjunto de 7 ficou de
      fora dessa correção. Achado adicional registrado em D-009: a migration
      `20260626130504_add_motor_fields_search_execution_audit`, aplicada em
      produção (confirmado via `list_migrations`), não tem arquivo
      correspondente em `supabase/migrations/` — gap de reprodutibilidade
      distinto do D-008, que também explica por que
      `supabase-search-execution-audit.sql` está desatualizado frente ao
      schema real (faltam as colunas `motor`, `rota`, `tipo_execucao`,
      `run_id`).
      **Onda 1 concluída nesta ação** — os 3 itens da onda estão marcados.

Critérios de conclusão: cada arquivo tem destino decidido (mover, congelar
como histórico, ou manter) registrado em `DECISOES.md`.
Validações necessárias: `list_migrations`/MCP Supabase para confirmar o que
já está aplicado antes de qualquer remoção de SQL.

**Primeira ação executável definida (não executada nesta fase):** avaliar
`RESUMO_STACK.MD` — é o menor candidato (53 linhas, arquivo único,
autocontido, sem consumidor de código conhecido). Ação: `git grep -n
"RESUMO_STACK"` em todo o repositório para confirmar ausência de
referência; se confirmado sem referência, decidir entre absorver conteúdo
relevante em local canônico, congelar como histórico, ou remover; registrar
a decisão em `DECISOES.md`. Diff esperado: pequeno e revisável (um arquivo
movido/removido/congelado, nenhuma mudança funcional). Esta ação não
depende de `test-apps-script.ps1` nem de `appscript/logs.md`.

## Onda 2 — Dados/logs sensíveis localizados

Objetivo: decidir retenção/sanitização de `appscript/logs.md` (D-006).
Dependências: nenhuma — pode rodar em paralelo à Onda 1, mas não bloqueia
nem é bloqueada por ela.

- [x] Decidir retenção/sanitização de `appscript/logs.md` (confirmado em
      C2: contém endereços de cliente e e-mail de usuário — log operacional
      real, não é PII fictícia).
      **Resultado (2026-08-10):** classificação **C — LOG GERADO/
      REPRODUZÍVEL** — captura manual de execução única do Google Cloud
      Logging (Apps Script), 39 linhas, ~65s de trace da função
      `ResolverEnderecoComCache_`. A instrumentação que gera essas linhas
      (`[LOOKUP]`, `[GEO-CACHE]`, `[GEO-PROVIDER]`) existe no código-fonte
      real (`appscript/CEP-APIBACK.gs`), confirmando reprodutibilidade a
      qualquer momento via nova execução + Cloud Logging. `git log --stat`
      mostrou o arquivo sendo **sobrescrito por completo 3 vezes** (2026-03-13
      ×2, 2026-04-08) com capturas de debug diferentes — padrão recorrente de
      colar log fresco, não histórico acumulado. Zero consumidor operacional
      (`git grep` só encontrou os próprios artefatos deste projeto). Contém
      PII real (endereço de cliente em texto pleno) e um achado de segurança
      separado: uma chave de API (LocationIQ) em texto pleno numa URL de
      debug (não reproduzida aqui — ver D-006). Nenhum conhecimento técnico
      exclusivo perdido: a única análise de valor já extraída de uma captura
      anterior deste mesmo arquivo está preservada, sanitizada e sem PII, em
      `appscript/OTIMIZACOES-PERFORMANCE.md` (que cita "análise de logs.md"
      apenas como nota histórica de origem, não como referência operacional
      quebrável). **Ação: arquivo removido (`git rm`) e adicionada regra
      específica em `.gitignore` (`appscript/logs.md`) para evitar
      recorrência** — critério de remoção do prompt totalmente satisfeito
      (sem consumidor, reproduzível, sem fonte canônica, sem quebra de
      fluxo, conhecimento já preservado, risco de PII/segredo supera o
      benefício do bruto). Ver D-006 (`DECISOES.md`).

Critérios de conclusão: decisão humana registrada em `DECISOES.md` (D-006),
mesmo que a decisão seja "manter como está".
Validações necessárias: revisão manual do conteúdo tratado; confirmar se
há consumidor ativo do arquivo antes de mover/remover/sanitizar.
**Onda 2 concluída nesta ação.**

## Onda 3 — Organização documental

Objetivo: mover documentação solta para local temático coerente, sem
reescrever conteúdo.
Dependências: Onda 1 concluída. Não depende da Onda 2 (`appscript/logs.md`
é um dado operacional isolado, sem relação com a organização documental).

- [x] Avaliar guias de setup soltos na raiz (`AUTO_LOGOUT_SETUP.md`,
      `GOOGLE_OAUTH_SETUP.md`, `SUPABASE_SETUP.md`) — candidatos a mover
      para `docs/` ou subpasta temática; `README.md` permanece na raiz por
      convenção.
      **Resultado (2026-08-10):** os três classificados como documentação
      técnica atual (nenhum aponta para estrutura inexistente) e movidos
      via `git mv` para `docs/tecnico/` (pasta nova). Sem consumidor
      operacional externo ao projeto. Uma referência interna quebrada
      corrigida (auto-referência de caminho em `SUPABASE_SETUP.md`).
      Pendência de conteúdo registrada, não corrigida: `AUTO_LOGOUT_SETUP.md`
      usa `auditoria_acesso` (singular) nos exemplos SQL/JSON, tabela real é
      `auditoria_acessos` (plural). Ver D-011 (`DECISOES.md`).
- [x] Avaliar `docs/` (35 itens estimados no nível superior; inventário
      real confirmou 30, incluindo 16 arquivos `procurar-datas-*`) —
      candidato a subpastas temáticas, sem tocar nos documentos canônicos
      de `/procurar-datas` (fora de escopo por regra do módulo).
      **Resultado (2026-08-10):** auditoria completa dos 30 arquivos, matriz
      de classificação produzida. Executados apenas os movimentos de baixo
      risco: `GOOGLE_SHEETS_SETUP.md` → `docs/tecnico/` (mesmo padrão do
      item 1) e os 4 documentos `inteligencia-comercial-*.md` → nova pasta
      `docs/inteligencia-comercial/` (nomes preservados). Os demais 25
      arquivos foram mantidos na raiz — cada um com motivo registrado em
      D-012 (`DECISOES.md`): âncoras citadas por `docs/projetos/README.md`,
      grupos interligados por referência direta, arquivos protegidos pela
      regra do módulo `/procurar-datas` (incluindo `snippets-devtools-
      opcao-b-comparacao.md`, referenciado pelos dois documentos
      obrigatórios do módulo mesmo sem o prefixo no nome), um plano ainda
      não implementado, e dois arquivos órfãos sem grupo temático
      suficiente para justificar pasta nova (mantidos por cautela).
      Auditoria concluída; decisão sobre os 25 mantidos não é uma pendência
      aberta — é decisão registrada de não mover nesta ação.
- [x] Confirmar destino físico futuro de `CONTEXTO DO PROJETO.MD` (já
      congelado como histórico na Fase C1) — mover para pasta de histórico
      quando essa pasta existir; não reabrir o conteúdo.
      **Resultado (2026-08-10):** classificado **B — histórico congelado
      útil**. Papel já está claro no próprio arquivo (banner de congelamento
      da Fase C1, sem ambiguidade operacional). Destino decidido:
      **permanece na raiz** — nenhuma pasta existente é claramente melhor.
      `docs/ia/` foi avaliada e descartada como destino: mistura planos/
      diagnósticos ativos de segurança/auth (`plano-fase-0-*`,
      `diagnostico-fase-0-*`) com um documento operacional vigente
      (`padrao-novas-telas-permissoes.md`, referenciado por
      `.agents/rules/novas-telas-permissoes.md`) — não é uma pasta histórica
      pura, mover pioraria a descoberta em vez de melhorar. Nenhuma pasta
      genérica nova foi criada (proibido pela tarefa). Zero referência
      operacional quebrada — nenhum arquivo movido. Ver D-013
      (`DECISOES.md`).
      **Onda 3 concluída (3/3 itens).**

Critérios de conclusão: cada movimento tem consumidores/referências
identificados e atualizados (grep dirigido antes de mover).
Validações necessárias: `git grep` por nome do arquivo movido em todo o
repositório (código, docs, scripts) antes de considerar a onda concluída.

## Onda 4 — Scripts e dados auxiliares

Objetivo: aproximar scripts/dados de seus consumidores ou registrar decisão
de mantê-los separados.
Dependências: Ondas 1 e 3 concluídas. Não depende da Onda 2.

- [x] Avaliar `procvlojas.md` (raiz, 683 linhas) frente a
      `scripts/converter-procvlojas-csv.py` — mesmo tema, locais diferentes.
      **Resultado (2026-08-10):** classificação **C — dado de entrada
      atual**. Consumidor confirmado (`converter-procvlojas-csv.py` lê o
      arquivo via caminho hardcoded assumindo raiz do repo). Mantido na
      raiz — separação atual já é o desenho original do script; mover
      exigiria alterar `base_dir` no script para ganho só estético. Ver
      D-014.
- [x] Avaliar `desloc_backup.md` (raiz, 1493 linhas, backup) e
      `deslocamentos.gs` (raiz, 2597 linhas) frente aos `.gs` já
      organizados em `appscript/` (`CEP-APIBACK.gs`, `PublicAPI.gs`,
      `TEMPO SERVIÇOS.gs`, `recebimento-to-sheets.gs`) — por que um está em
      `appscript/` e o outro solto na raiz.
      **Resultado (2026-08-10):** `deslocamentos.gs` classificado **A —
      fonte operacional atual / legado ativo**, referenciado diretamente
      pelos dois documentos obrigatórios do módulo `/procurar-datas`
      (integração backend OSRM, ajustes de segurança recentes) — mantido na
      raiz, protegido pela regra do módulo, nenhuma ação. `desloc_backup.md`
      classificado **D — backup histórico superado**: comparação função a
      função confirmou zero função exclusiva (todas já existem, iguais ou
      evoluídas, no arquivo atual), zero consumidor, único commit nunca mais
      tocado, antecede a integração com backend OSRM — **removido**
      (`git rm`). Ver D-014.
- [x] Avaliar `digisac_docs.md` e `scriptsreal.md` (raiz) — destino
      (mover para `docs/` ou pasta de scripts, ou arquivar como histórico).
      **Resultado (2026-08-10):** `digisac_docs.md` classificado **C — dado
      de referência ativo**, referenciado por plano ativo não concluído
      (`docs/ia/plano-dashboard-digisac-metricas.md`) e usado como apoio
      recorrente em implementações reais de integração Digisac — mantido na
      raiz, nenhum destino existente claramente melhor. `scriptsreal.md`
      classificado **F — duplicado/superado**: diff normalizado contra
      `scripts/appscript-importar-nfe-matic.js` mostrou conteúdo idêntico
      exceto uma função (`doPost`) que foi substituída por versão mais
      robusta um dia depois no `.js`; zero consumidor — **removido**
      (`git rm`). Ver D-014.
      **Onda 4 concluída (3/3 itens).**

Critérios de conclusão: cada arquivo tem destino decidido e consumidores
atualizados.
Validações necessárias: confirmar se cada script/arquivo ainda é executado
ou apenas histórico, antes de mover ou remover.

## Onda 5 — Legado `.devin` (gate tardio) — CONCLUÍDA (2026-08-10)

Objetivo: decidir o destino de `.devin/rules/` (6 arquivos) e
`.devin/workflows/login.md`.
Dependências: Ondas 1 e 3 apenas — não depende de Onda 2 (`appscript/logs.md`)
nem de Onda 4.

**Resultado final:** usuário confirmou uso ativo do Devin dependente de
`.devin/`. Pasta mantida, transformada em adaptador de compatibilidade
mínimo (não mais segunda fonte de regras). Ver checklist abaixo e D-005
(`DECISOES.md`) para o detalhamento completo.

- [x] Auditar `.devin/` (inventário + dependência + comparação semântica
      com `.agents/`) para reunir evidência suficiente antes do gate humano.
      **Resultado (2026-08-10, SOMENTE AUDITORIA — nenhuma remoção/edição em
      `.devin/`):** 45 arquivos inventariados e classificados (6 `rules/` —
      C, legado superado; 2 stubs — E, artefato morto; 2 pacotes de skill —
      D, duplicado puro/vendor copy). Zero conteúdo exclusivo encontrado em
      qualquer item. Zero consumo por código de aplicação (`git grep`).
      Evidência histórica forte de leitura real passada pelo agente "Devin"
      encontrada em `docs/ia/log_progress.md` (busca dirigida, congelado).
      Achado de risco: 3 dos 6 `rules/` ainda instruem escrever no log
      congelado (D-001) — conflito ativo se o Devin seguir isso
      literalmente. Matriz completa em D-005 (`DECISOES.md`).
- [x] Confirmar com o usuário se Devin (ou outra ferramenta) ainda depende
      de `.devin/` diretamente. **Respondida (2026-08-10): sim, Devin
      continua em uso e depende da pasta.**
- [x] Confirmado que o uso continua: `.devin/` transformada em adaptador de
      compatibilidade mínimo, não removida.
      **Resultado (2026-08-10):** os 6 `rules/` reescritos como pointers
      curtos para o Harness canônico (855 → 244 linhas somadas), sem perda
      de conteúdo de negócio (tudo já vivia em `AGENTS.md`/`.agents/rules/`).
      Instrução de escrever em `docs/ia/log_progress.md` (congelado)
      removida das 3 fontes que a continham (`Agent.md`, `gerais.md`,
      `continuidade-agente.md`). Stubs mortos (`skills/login/SKILL.md`,
      `workflows/login.md`) removidos após confirmação final de zero
      consumidor. Skills vendor (`skills/supabase/`,
      `skills/supabase-postgres-best-practices/`) preservadas intactas,
      byte-idênticas às de `.agents/skills/`. Ver D-005 (`DECISOES.md`)
      para o detalhamento completo.

Critérios de conclusão: decisão registrada em `DECISOES.md` (D-005) com
aprovação humana explícita — cumprido, decisão executada com autorização
do usuário. **Onda 5 concluída (2026-08-10).**
Validações necessárias: `git grep`/`diff -rq`/busca dirigida no log
congelado (auditoria) + `grep -rn -i "log_progress" .devin/` pós-edição
(confirmou zero instrução de escrita restante) + `diff -rq` revalidando as
skills vendor intactas — todas executadas.

## Onda 6 — Cosmética / resíduos finais — CONCLUÍDA (2026-08-11)

Objetivo: ajustes de nome/local/referência de baixo risco que não se
qualificaram para as ondas anteriores, e fechamento do Projeto Multifase.
Dependências: Ondas 1-5 concluídas — cumprido.

**Resultado:** revisão dirigida final não encontrou nenhum arquivo solto
adicional elegível (Ondas 1-4 já esgotaram os candidatos reais da raiz e
de `docs/`). Dois resíduos genuínos identificados e corrigidos — ver D-015
(`DECISOES.md`):

- [x] Corrigir conteúdo do D-011 (`auditoria_acesso` → `auditoria_acessos`
      em `docs/tecnico/AUTO_LOGOUT_SETUP.md`, 9 ocorrências) — pendência de
      conteúdo registrada na Onda 3, item 1, deixada para revisão dedicada.
- [x] Corrigir referências obsoletas ao estado pré-Onda-5 de `.devin/`
      criadas pela própria execução aprovada da Onda 5 (D-005):
      `AGENTS.md` (§10, §12), `.agents/README.md`, `.agents/rules/README.md`,
      `.agents/skills/README.md`.
- [x] Busca dirigida final (`git grep`) por todos os caminhos removidos/
      movidos no projeto inteiro — zero referência operacional quebrada
      confirmada; ocorrências restantes são históricas/explicativas
      legítimas (nota de proveniência em `.agents/README.md`, entrada em
      `.gitignore`).

Critérios de conclusão: nenhuma referência operacional quebrada;
correções restritas a texto/documentação, sem código/banco/regra de
negócio tocados — cumprido.
Validações necessárias: `git grep` dirigido, `git diff --check`,
`git status --short` — todas executadas (ver relatório final da sessão).
