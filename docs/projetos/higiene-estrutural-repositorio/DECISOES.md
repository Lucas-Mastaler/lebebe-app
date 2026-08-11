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

- Data: 2026-08-10 (aberta) · Auditoria de evidências: 2026-08-10 (Onda 5,
  SOMENTE AUDITORIA) · **Resolvida: 2026-08-10 (Onda 5, execução — usuário
  confirmou uso ativo do Devin)**
- Decisão final: `.devin/` **permanece**, reduzida ao papel de **adaptador
  de compatibilidade mínimo** do Harness canônico — nunca mais segunda
  fonte independente de regras. Ver seção "Resolução" abaixo para o
  detalhamento completo da execução. As subseções anteriores (inventário,
  matriz, dependência, gate) permanecem como registro da evidência que
  fundamentou a decisão.

### Inventário real (45 arquivos, `.devin/` byte-intacta)

| Grupo | Arquivos | Linhas |
|---|---|---|
| `rules/` | 6 (`Agent.md`, `continuidade-agente.md`, `gerais.md`, `recebimentos.md`, `resumo.md`, `supabase.md`) | 509+39+132+95+16+64 = 855 |
| `skills/login/SKILL.md` | 1 | 4 (só frontmatter `name: login`, corpo vazio) |
| `skills/supabase-postgres-best-practices/` | 34 (`SKILL.md` + 33 `references/*.md`) | idêntico byte-a-byte a `.agents/skills/supabase-postgres-best-practices/` |
| `skills/supabase/` | 3 (`SKILL.md` + `assets/feedback-issue-template.md` + `references/skill-feedback.md`) | idêntico byte-a-byte a `.agents/skills/supabase/` |
| `workflows/login.md` | 1 | 0 (arquivo vazio) |

### Matriz comparativa `.devin/` × `.agents/`

| Item/grupo `.devin` | Equivalente `.agents` | Classificação | Conteúdo exclusivo | Dependência conhecida | Risco de remoção |
|---|---|---|---|---|---|
| `rules/Agent.md` (509 l.) | `AGENTS.md` completo + as 5 rules (mapeamento documentado em `.agents/rules/README.md`) | **C — legado superado** | Não (todo conteúdo de negócio já absorvido); contém instrução ativa (§6-8) de escrever em `docs/ia/log_progress.md`, hoje congelado — **instrução LEGADA/SUPERADA, não corrigida nesta auditoria** | Histórica confirmada (ver abaixo) + compatibilidade provável | Médio-alto |
| `rules/gerais.md` (132 l.) | `AGENTS.md` §2/3/5/9 + `procurar-datas.md` §12 + `novas-telas-permissoes.md` §13 | **C — legado superado** | Não; §11 também instrui escrever no log congelado — LEGADA/SUPERADA | Histórica confirmada + compatibilidade provável | Médio-alto |
| `rules/recebimentos.md` (95 l.) | `.agents/rules/recebimento.md` | **C — legado superado (equivalente, canônico tem mais conteúdo)** | Não — canônico herdou também o mapa de rotas/APIs de `CONTEXTO DO PROJETO.MD` | Histórica confirmada + compatibilidade provável | Médio-alto |
| `rules/resumo.md` (16 l.) | Coberto por `AGENTS.md` (condensado sem arquivo próprio) | **C/D — legado superado, condensado, sem conteúdo exclusivo** | Não | Histórica confirmada + compatibilidade provável | Médio-alto |
| `rules/supabase.md` (64 l.) | `.agents/rules/banco-supabase.md` | **C — equivalente com pequenas diferenças** (canônico adiciona pointer para skill oficial e nota de proporcionalidade que não existiam) | Não | Histórica confirmada + compatibilidade provável | Médio-alto |
| `rules/continuidade-agente.md` (39 l.) | Nenhum — formato de escrita do log, hoje sem função | **C — legado superado, instrução ativamente conflitante** | Não; **100% do conteúdo instrui escrever em `docs/ia/log_progress.md`**, congelado desde a Fase B2 (D-001) | Histórica confirmada + compatibilidade provável | Médio-alto (maior risco de conflito ativo do grupo) |
| `skills/login/SKILL.md` (4 l.) | Nenhum | **E — stub/artefato morto** | Não (só frontmatter `name: login`, sem corpo) | Nenhuma encontrada | Baixo |
| `workflows/login.md` (0 l.) | Nenhum | **E — stub/artefato morto** | Não (arquivo vazio) | Nenhuma encontrada | Baixo |
| `skills/supabase-postgres-best-practices/` (34 arq.) | `.agents/skills/supabase-postgres-best-practices/` | **D — duplicado puro / vendor copy** (`diff -rq` confirmou 0 diferenças) | Não; cópia órfã — `skills-lock.json` só rastreia a instalação em `.agents/skills/`, não referencia `.devin/` | Compatibilidade provável (se Devin só lê `.devin/skills/`) | Médio |
| `skills/supabase/` (3 arq.) | `.agents/skills/supabase/` | **D — duplicado puro / vendor copy** (`diff -rq` confirmou 0 diferenças) | Não; mesma observação de cópia órfã do lock file | Compatibilidade provável | Médio |

### Casos conhecidos (item 6 do prompt) — validados

- `skills/login/SKILL.md`: confirmado stub quase vazio (4 linhas, só
  frontmatter). ✅
- `workflows/login.md`: confirmado stub vazio (0 bytes). ✅
- Skills Supabase em `.devin/skills/`: confirmado, via `diff -rq`, serem
  cópias byte-idênticas das versões canônicas em `.agents/skills/`. ✅
- Rules `.devin/rules/*`: confirmado, via leitura integral dos 6 arquivos e
  comparação semântica com `.agents/rules/*.md` e `AGENTS.md`, estarem
  superadas pelo Harness atual — nenhum conteúdo de regra de negócio
  exclusivo encontrado. ✅

### Dependência real — o que o repositório mostra

`git grep` (excluindo o próprio `.devin/`) por `.devin`/`devin` não encontrou
**nenhuma** referência em código de aplicação (`src/`, `scripts/`,
`supabase/`, `appscript/`) nem em configuração (não existe `devin.yaml`,
`.devinrc`, workflow de CI, ou qualquer arquivo de config declarando
integração com Devin). Todas as ocorrências estão em:
1. Documentação do próprio Harness (`AGENTS.md` §1/§7/§12,
   `.agents/README.md`, `.agents/rules/README.md`, `.agents/skills/README.md`)
   — descrevem o histórico da migração e o estado do legado, não são
   consumo operacional.
2. Os quatro artefatos deste Projeto Multifase.
3. `docs/ia/log_progress.md` (congelado, consultado só por busca dirigida
   nesta auditoria) — contém **evidência histórica forte**: dezenas de
   entradas de sessões reais anteriores do agente "Devin" (algumas datadas
   de 2026-07 e 2026-08-06, poucos dias antes de hoje) que listam
   explicitamente `.devin/rules/*`, `.devin/skills/supabase/SKILL.md`,
   `.devin/skills/supabase-postgres-best-practices/SKILL.md` e
   `.devin/workflows/login.md` como "Arquivos lidos" da própria tarefa —
   ou seja, não é suposição: há registro real de que o Devin, quando usado
   neste projeto, leu esses arquivos diretamente como parte da execução.
   Uma auditoria anterior (registrada no mesmo log, ~2026-08-07) já havia
   identificado a duplicação `.agents/skills/` × `.devin/skills/` via
   `diff -rq` e listado exatamente a mesma pergunta de decisão humana que
   esta auditoria reabre: "se os 5 arquivos antigos de `.devin/rules/`
   devem virar stubs ou ser removidos após consolidação" — nunca
   respondida.
4. `.agents/README.md` (linha 73-76) faz uma **afirmação própria do
   Harness** (não verificável pelo repositório): "Devin — hoje só lê
   `.devin/rules/`, `.devin/skills/` e `.devin/workflows/`, que continuam
   intactos como fonte legada." Essa é uma convenção declarada da
   ferramenta externa, escrita por quem construiu o Harness em 2026-08-07 —
   não uma prova obtida nesta sessão de que o Devin ainda está configurado
   e ativo neste projeto **hoje** (2026-08-10).

**Classificação da dependência:**
- Operacional confirmada (por código do repositório): **inexistente**.
- Histórica: **confirmada** (múltiplas sessões reais registradas no log
  congelado).
- Compatibilidade provável (convenção externa da ferramenta, hoje):
  **não verificável por este repositório** — depende de como o Devin está
  configurado atualmente, informação que só o usuário tem.
- Externa/não verificável: se o Devin (enquanto produto/plataforma) ainda
  lê `.devin/` por convenção própria independente deste repositório.

Importante, conforme instrução da tarefa: a ausência de `git grep` apontando
consumo por código **não prova** que a plataforma Devin não lê `.devin/`
automaticamente — ela só prova que nenhum artefato deste repositório (fora
do próprio `.devin/` e do log histórico) depende desses arquivos.

### Achado de risco — instrução ativa conflitante

`rules/Agent.md` (§6-8), `rules/gerais.md` (§11) e `rules/continuidade-agente.md`
(integralmente) instruem o agente a **escrever** em `docs/ia/log_progress.md`
ao final de toda tarefa relevante. Esse arquivo está congelado desde a Fase
B2 (D-001, `AGENTS.md` §11) — nenhuma escrita nova é permitida, sem exceção,
no Harness atual. Se o Devin ainda ler `.devin/rules/` diretamente (ele não
lê `AGENTS.md` nem sabe do congelamento, conforme `.agents/README.md`), ele
pode voltar a escrever no log congelado em uma tarefa futura, violando D-001.
Este é o risco de maior gravidade encontrado nesta auditoria — não corrigido
nesta sessão (proibido pelo protocolo de SOMENTE AUDITORIA), registrado aqui
para decisão humana.

### Avaliação de risco de remoção por grupo (item 8 do prompt)

- **`rules/*` (6 arquivos):** repositório não depende; Devin pode depender
  automaticamente (histórico confirma leitura real passada); equivalente
  canônico existe para os 5 arquivos de conteúdo de negócio; sem conteúdo
  exclusivo; remover pode degradar o Devin **se** ele ainda estiver
  configurado e só ler `.devin/`; manter gera risco de conflito ativo
  (escrita no log congelado). **Risco: médio-alto.**
- **`skills/login/` + `workflows/login.md` (stubs):** nenhuma dependência
  encontrada, nenhum conteúdo. **Risco: baixo.**
- **`skills/supabase*/` (cópias vendor):** repositório não depende
  (`skills-lock.json` não referencia `.devin/`); Devin pode depender se só
  ler `.devin/skills/`; equivalente canônico byte-idêntico; sem conteúdo
  exclusivo; risco de conflito de instrução é baixo (conteúdo idêntico), mas
  há risco de desatualização silenciosa futura se só um lado for atualizado.
  **Risco: médio.**

### Estratégias possíveis por cenário (avaliadas, não executadas)

- **Se o Devin não é mais usado:** remover `.devin/` inteira seria seguro
  quanto a conteúdo (zero conteúdo exclusivo confirmado em todos os 45
  arquivos) — mas ainda seria uma remoção, não uma decisão desta sessão.
- **Se o Devin ainda é usado e lê `.devin/` diretamente:** manter os
  adaptadores mínimos seria necessário; os únicos itens seguros para limpar
  mesmo nesse cenário seriam os stubs mortos (`skills/login/`,
  `workflows/login.md`, que não têm função) e, possivelmente, corrigir (não
  remover) a instrução conflitante de `continuidade-agente.md`/`gerais.md`
  §11/`Agent.md` §6-8 para parar de instruir escrita no log congelado.
- **Se o uso é incerto:** preservar tudo até confirmação humana — nenhuma
  ação definitiva deve ser tomada sem essa resposta.

### Gate humano (obrigatório antes de qualquer ação)

Pergunta exata a fazer ao usuário/proprietário: **"Você ainda usa o Devin
neste repositório de forma que ele dependa da pasta `.devin/`?"**

- Se **sim**: D-005 deve decidir entre manter tudo como está, manter só os
  6 `rules/` + 2 `skills/` (removendo só os 2 stubs mortos), ou corrigir a
  instrução conflitante de escrita no log — sem remover nada que o Devin
  ainda leia.
- Se **não**: D-005 pode autorizar remoção completa de `.devin/` (45
  arquivos), já que nenhum conteúdo exclusivo foi encontrado em nenhum item.
- Se **incerto**: manter tudo intacto até nova confirmação; não escolher por
  suposição.

### Resolução (2026-08-10, mesma sessão — execução)

**O usuário confirmou explicitamente: Devin ainda é usado neste
repositório e depende da pasta `.devin/`.** Gate respondido — decisão de
ação tomada:

- **`.devin/` permanece** — não removida, não desativada.
- **Papel definido:** `.devin/` passa a ser explicitamente um **adaptador
  de compatibilidade mínimo**, nunca mais uma segunda fonte independente de
  regras. O Harness canônico (`AGENTS.md` + `.agents/rules/` +
  `.agents/skills/` + Projeto Multifase) é sempre quem vence em caso de
  divergência — essa precedência agora está escrita explicitamente dentro
  de `.devin/rules/Agent.md` (novo §2).
- **6 arquivos de `rules/` reescritos** (mesmos nomes preservados, para não
  quebrar qualquer descoberta por filename que o Devin faça), de 855 para
  244 linhas somadas (~71% de redução):
  - `Agent.md`: 509 → 102 linhas. Deixou de ser um segundo `AGENTS.md`
    completo e virou o adaptador principal — explica a hierarquia de
    fontes, a precedência entre camadas (código > Harness > docs de
    feature > Projeto Multifase > Git/histórico) e onde encontrar cada
    regra contextual.
  - `gerais.md`: 132 → 32 linhas — pointers para `AGENTS.md` §2-§5 e para
    as rules de módulo (`procurar-datas.md`, `novas-telas-permissoes.md`).
  - `recebimentos.md`: 95 → 14 linhas — pointer direto para
    `.agents/rules/recebimento.md`, sem duplicar o checklist crítico.
  - `supabase.md`: 64 → 25 linhas — pointer direto para
    `.agents/rules/banco-supabase.md`, mantendo só a regra central
    (validar sempre via MCP) e o apontamento para as skills vendor.
  - `continuidade-agente.md`: 39 → 47 linhas — **reescrita obrigatória**:
    a instrução antiga de escrever em `docs/ia/log_progress.md` foi
    **removida por completo** e substituída pela regra atual (log
    congelado, nunca escrever, busca dirigida só quando necessário,
    continuidade real via Projeto Multifase).
  - `resumo.md`: 16 → 24 linhas — condensado de uma página apontando para
    todas as fontes acima, sem repetir conteúdo.
- **Instruções conflitantes eliminadas:** as três únicas fontes ativas que
  instruíam escrever no log congelado (`Agent.md` §6-8, `gerais.md` §11,
  `continuidade-agente.md` integral) foram corrigidas. Validado por busca
  (`grep -rn -i "log_progress" .devin/`) que nenhuma menção restante em
  `.devin/` instrui escrita — todas as ocorrências restantes só explicam
  que o arquivo está congelado.
- **Stubs mortos removidos** (`git rm`), após busca dirigida final
  confirmar zero consumidor funcional: `skills/login/SKILL.md` (só
  frontmatter) e `workflows/login.md` (vazio). A busca dirigida em
  `docs/ia/log_progress.md` mostrou que `workflows/login.md` era listado
  mecanicamente como "arquivo lido" em quase toda sessão passada (porque a
  regra antiga mandava sempre listar `workflows/`), mas sempre vazio ou
  "(não aplicável)" — nunca consumido de fato. `skills/login/SKILL.md`
  nunca apareceu como usado em nenhuma sessão real.
- **Skills vendor preservadas integralmente, sem edição:**
  `skills/supabase/` e `skills/supabase-postgres-best-practices/`
  permanecem byte-idênticas às equivalentes em `.agents/skills/`
  (`diff -rq` confirmado = 0 diferenças, revalidado após a ação). Mantidas
  deliberadamente como duplicação intencional de compatibilidade — não são
  mais tratadas como "duplicado a limpar", e sim como parte do adaptador.
- Impacto: `.devin/` passou de 45 para 43 arquivos (2 stubs removidos); os
  6 `rules/` foram reescritos como adaptadores curtos, sem perda de
  nenhum conteúdo de negócio (tudo já vivia, de forma completa, no Harness
  canônico); as 37 arquivos de skills vendor permanecem intocados.
- Status: **APROVADA** — decisão executada nesta sessão, com autorização
  explícita do usuário/proprietário.

## D-015 — Onda 6: resíduos finais e fechamento do projeto

- Data: 2026-08-11
- Decisão: Onda 6 executada como "documentação/referências residuais",
  não como cosmética de arquivos soltos (nenhum candidato novo de baixo
  risco foi encontrado além do já tratado nas Ondas 1-5). Dois grupos de
  ação, ambos de baixíssimo risco (correção de texto/documentação, zero
  código, zero banco, zero regra de negócio):
  1. **Conteúdo do D-011 corrigido:** `docs/tecnico/AUTO_LOGOUT_SETUP.md`
     usava `auditoria_acesso` (singular) em 9 ocorrências nos exemplos
     SQL/JSON; corrigido para `auditoria_acessos` (plural), nome real já
     confirmado em D-011. Nenhuma mudança de comportamento — só o texto do
     runbook.
  2. **Referências obsoletas causadas pela própria execução aprovada da
     Onda 5 (D-005) corrigidas** — documentos do Harness que ainda
     descreviam `.devin/` como "legado intacto" ou "fase de limpeza não
     iniciada", desatualizados após a Onda 5 transformar `.devin/rules/`
     em adaptador mínimo: `AGENTS.md` (§10 e §12), `.agents/README.md`
     (tabela "Estado da migração" + nota de compatibilidade Devin),
     `.agents/rules/README.md` (nota de abertura), `.agents/skills/README.md`
     (nota sobre a skill `login`, removida na Onda 5). Nenhuma regra nova
     de negócio introduzida — só sincronização de descrição com o estado
     real já decidido e executado.
  Busca dirigida final (`git grep`) confirmou zero referência operacional
  quebrada restante no repositório para todos os caminhos removidos/
  movidos ao longo do projeto (`RESUMO_STACK.MD`, `desloc_backup.md`,
  `scriptsreal.md`, `appscript/logs.md`, `.devin/skills/login/SKILL.md`,
  `.devin/workflows/login.md`) — as únicas ocorrências restantes são
  históricas/explicativas (nota em `.agents/README.md` sobre a origem do
  Harness; entrada em `.gitignore` para `appscript/logs.md`, que é o
  comportamento correto).
- Motivo/contexto: fechamento do Projeto Multifase — nenhum item cosmético
  de arquivo solto adicional foi identificado (Ondas 1-4 já trataram todos
  os candidatos reais da raiz/`docs/`); os únicos resíduos genuínos
  restantes eram os dois acima.
- Impacto: `docs/tecnico/AUTO_LOGOUT_SETUP.md`, `AGENTS.md`,
  `.agents/README.md`, `.agents/rules/README.md`,
  `.agents/skills/README.md` alterados. Nenhum código, banco, migration ou
  regra de negócio tocado.
- Status: APROVADA

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

## D-014 — Onda 4: classificação dos 5 scripts/dados auxiliares da raiz

- Data: 2026-08-10
- Decisão, arquivo a arquivo:
  - **`deslocamentos.gs`** — classificação **A (fonte operacional atual /
    legado ativo)**. Confirmado por referência direta e recente nos dois
    documentos obrigatórios do módulo `/procurar-datas`
    (`docs/procurar-datas-escopo-equivalencia-legado-v2.md` linha 3968,
    `docs/procurar-datas-motor-v2-progresso.md` linha 5118 — descrevem
    ajustes de segurança e integração com backend OSRM feitos diretamente
    neste arquivo). **Mantido na raiz, nenhuma ação** — protegido pela regra
    do módulo (`.agents/rules/procurar-datas.md`), prioridade é
    descoberta/estabilidade, não estética.
  - **`desloc_backup.md`** — classificação **D (backup histórico
    superado)**. Comparação função a função contra `deslocamentos.gs`
    (normalizando CRLF→LF antes do diff) mostrou que **toda** função
    presente no backup já existe, idêntica ou evoluída, no arquivo atual
    (nenhuma função exclusiva do backup); o arquivo atual tem 32 funções a
    mais, incluindo a integração com backend OSRM (`PROP_DESLOC_BACKEND_URL`,
    `DESLOC_BACKEND_ENDPOINT_PATH`) ausente do backup — confirmando que o
    backup antecede essa integração (mtime 2026-07-29 vs. 2026-07-31 do
    arquivo atual; único commit em 2026-07-30, nunca mais tocado). `git grep`
    não encontrou nenhum consumidor operacional (só os artefatos deste
    projeto). **Ação: removido (`git rm`).**
  - **`scriptsreal.md`** — classificação **F (duplicado/superado)**.
    Diff normalizado (CRLF→LF) contra `scripts/appscript-importar-nfe-matic.js`
    mostrou uma única diferença: a função `doPost` do `.js` é uma versão mais
    robusta (parsing de form-urlencoded bruto, tratamento de
    `invalid_body`) da mesma função presente no `.md` — todo o restante do
    arquivo é idêntico. `git log --follow` confirmou que `scriptsreal.md`
    parou de ser tocado em 2026-02-26, um dia antes do commit que introduziu
    essa versão mais robusta em `scripts/appscript-importar-nfe-matic.js`
    (2026-02-27). `git grep` não encontrou nenhum consumidor operacional.
    **Ação: removido (`git rm`).**
  - **`procvlojas.md`** — classificação **C (dado de entrada atual)**.
    Consumidor confirmado: `scripts/converter-procvlojas-csv.py` lê o
    arquivo via caminho hardcoded (`base_dir` calculado como raiz do repo,
    dois níveis acima do script). **Mantido na raiz, nenhuma ação** — a
    separação atual (dado na raiz, script em `scripts/`) já é o desenho
    original do próprio script; mover o dado exigiria alterar a lógica de
    `base_dir` no script para ganho puramente estético, contrariando o
    princípio de menor alteração (`AGENTS.md` §3).
  - **`digisac_docs.md`** — classificação **C (dado de referência ativo)**.
    Não tem consumidor de código (nenhum import/leitura programática), mas é
    referenciado por um plano ativo e não concluído,
    `docs/ia/plano-dashboard-digisac-metricas.md` (linha 203, tabela "Arquivo
    | Papel": "Lista de departamentos e IDs"), e citado repetidamente em
    entradas do log congelado como material de apoio a implementações reais
    de integração Digisac (`src/lib/digisac/*`). **Mantido na raiz, nenhuma
    ação** — nenhuma pasta existente (`docs/tecnico/` guarda runbooks em
    prosa, não dumps de API) é claramente melhor destino; mover exigiria
    reescrever a referência de caminho no plano ativo para ganho marginal.
- Motivo/contexto: Onda 4 do `PLANO.md` — objetivo era aproximar
  scripts/dados de seus consumidores ou registrar decisão de mantê-los
  separados; inventário real confirmou exatamente os 5 candidatos previstos,
  nenhum adicional.
- Impacto: 2 arquivos removidos (`desloc_backup.md`, `scriptsreal.md`); 3
  mantidos na raiz por evidência concreta de consumidor/proteção de módulo
  (`deslocamentos.gs`, `procvlojas.md`, `digisac_docs.md`). Nenhuma
  referência operacional quebrada. Nenhuma regra funcional de
  `/procurar-datas` alterada.
- Status: APROVADA
