# Plano — Higiene Estrutural do Repositório

**Estado do planejamento:** DEFINIDO

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

- [ ] Avaliar `procvlojas.md` (raiz, 683 linhas) frente a
      `scripts/converter-procvlojas-csv.py` — mesmo tema, locais diferentes.
- [ ] Avaliar `desloc_backup.md` (raiz, 1493 linhas, backup) e
      `deslocamentos.gs` (raiz, 2597 linhas) frente aos `.gs` já
      organizados em `appscript/` (`CEP-APIBACK.gs`, `PublicAPI.gs`,
      `TEMPO SERVIÇOS.gs`, `recebimento-to-sheets.gs`) — por que um está em
      `appscript/` e o outro solto na raiz.
- [ ] Avaliar `digisac_docs.md` e `scriptsreal.md` (raiz) — destino
      (mover para `docs/` ou pasta de scripts, ou arquivar como histórico).

Critérios de conclusão: cada arquivo tem destino decidido e consumidores
atualizados.
Validações necessárias: confirmar se cada script/arquivo ainda é executado
ou apenas histórico, antes de mover ou remover.

## Onda 5 — Legado `.devin` (gate tardio)

Objetivo: decidir o destino de `.devin/rules/` (6 arquivos) e
`.devin/workflows/login.md` (~2.946 linhas no total).
Dependências: Ondas 1 e 3 apenas — não depende de Onda 2 (`appscript/logs.md`)
nem de Onda 4, mas deve ser a última onda antes da cosmética, por ser a
mudança de maior impacto em compatibilidade (Devin ainda lê `.devin/`
diretamente).

- [ ] Confirmar com o usuário se Devin (ou outra ferramenta) ainda depende
      de `.devin/` diretamente.
- [ ] Se confirmado obsoleto: decidir entre manter como histórico,
      arquivar fora do fluxo ativo, ou remover.
- [ ] Se ainda necessário: registrar decisão de manter e critério de
      quando reavaliar.

Critérios de conclusão: decisão registrada em `DECISOES.md` (D-005) com
aprovação humana explícita — este item nunca é decidido só por evidência de
código.
Validações necessárias: nenhuma automática — depende de confirmação humana
sobre uso real de Devin no projeto.

## Onda 6 — Cosmética

Objetivo: ajustes de nome/local de baixo risco que não se qualificaram para
as ondas anteriores.
Dependências: todas as ondas anteriores concluídas ou explicitamente
adiadas por decisão humana.

- [ ] A definir no momento em que as Ondas 1–5 estiverem concluídas —
      não antecipar itens cosméticos enquanto houver pendência de fonte
      concorrente ou dado sensível.

Critérios de conclusão: N/A até a onda ser detalhada.
Validações necessárias: N/A até a onda ser detalhada.
