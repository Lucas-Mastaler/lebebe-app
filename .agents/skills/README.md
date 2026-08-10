# Skills — catálogo atual (Fase 3 concluída)

A skill estrutural `projeto-multifase` foi criada na Fase 1.5 — exceção
deliberada à regra de "não implementar skills ainda", porque o harness de
continuidade precisava existir antes das demais. As 6 skills operacionais
abaixo foram implementadas na Fase 3 (2026-08-07), com o desenho desta
seção como especificação. As descrições resumidas abaixo continuam
servindo de índice; o conteúdo normativo de cada skill vive só no
respectivo `SKILL.md` — não duplique aqui quando revisar.

## Catálogo atual

| Skill | Status | Origem | Duplicada em |
|---|---|---|---|
| `supabase/` | Implementada | Pacote oficial `supabase/agent-skills` (GitHub), instalado via `npx skills add`, hash em `/skills-lock.json` | `.devin/skills/supabase/` (byte-idêntica) |
| `supabase-postgres-best-practices/` | Implementada | Mesmo pacote oficial | `.devin/skills/supabase-postgres-best-practices/` (byte-idêntica) |
| `projeto-multifase/` | Implementada (Fase 1.5, 2026-08-07) | Harness de continuidade para trabalho multifase | Nenhuma |
| `auditar-tarefa/` | Implementada (Fase 3, 2026-08-07) | Investigação proporcional antes de implementar | Nenhuma |
| `criar-plano/` | Implementada (Fase 3, 2026-08-07) | Investigação → plano executável | Nenhuma |
| `executar-plano/` | Implementada (Fase 3, 2026-08-07) | Implementação de plano aprovado | Nenhuma |
| `validar-entrega/` | Implementada (Fase 3, 2026-08-07) | Revisão de diff + relatório final | Nenhuma |
| `atualizar-log-progress/` | **Aposentada** (Fase B2, 2026-08-10) | Sem gatilho operacional — `docs/ia/log_progress.md` está congelado | Nenhuma |
| `procurar-datas/` | Implementada (Fase 3, 2026-08-07) | Navegador dos dossiês da migração `/procurar-datas` | Nenhuma |

A skill `login` existe só em `.devin/skills/login/` (21 bytes, só
frontmatter, sem corpo — abandonada) e não tem equivalente aqui. Nenhuma das
duplicações acima foi removida nesta tarefa (fora do escopo da Fase 3).

**Ferramenta de criação de skill:** a skill `skill-creator`
(`anthropic-skills:skill-creator`) está disponível no Claude Code usado
nesta sessão. Na execução da Fase 3, o formato `SKILL.md` de cada skill
nova foi escrito diretamente (frontmatter `name`/`description`/`metadata`
+ corpo Markdown), replicando fielmente o padrão já validado em
`projeto-multifase/SKILL.md` e no pacote oficial `supabase/SKILL.md` — não
foi necessário invocar `skill-creator` para gerar a estrutura. Nenhuma
skill final depende dessa ferramenta para funcionar (Markdown puro,
compatível com o padrão Agent Skills).

## Regra: skill oficial × regra contextual do projeto

Não recriar uma skill "supabase" própria do Le Bébé — a skill oficial já
cobre o procedimento técnico (CLI, MCP, checklist de segurança RLS
genérico). As exigências específicas do projeto (quando validar no MCP,
proibição de assumir estrutura, aviso de mudança destrutiva) são **regra
contextual**, não skill — vivem em `.agents/rules/banco-supabase.md`
(Fase 2, ver `../rules/README.md`). A skill oficial e a regra contextual se
complementam: a skill ensina *como* usar o Supabase; a regra contextual diz
*quando* e *com que cuidado* usá-lo neste projeto especificamente.

## RULE × SKILL — critério usado neste plano

- **RULE**: regra que deve ser obedecida sempre que um contexto aparecer
  (ex.: "ao alterar banco, validar schema real"). Vive em `.agents/rules/`.
- **SKILL**: procedimento reutilizável que o agente executa para chegar a um
  resultado (ex.: "auditar uma tarefa", "criar um plano"). Vive em
  `.agents/skills/`.

Nem toda regra vira skill, nem toda skill precisa de regra própria. As 6
skills abaixo foram mantidas porque representam processos repetíveis reais
(auditoria → plano → execução → validação), não porque a lista original
foi aceita sem revisão. `atualizar-log-progress` foi aposentada na Fase B2
— ver subseção própria.

## Desenho da Fase 3 — skills de projeto (especificação original)

O conteúdo abaixo é o desenho que guiou a implementação de cada `SKILL.md`.
Mantido como referência de intenção/critérios de qualidade — em caso de
divergência entre esta seção e o `SKILL.md` publicado, o `SKILL.md` é a
fonte vigente (é o que o agente realmente carrega em tarefa real).

### `auditar-tarefa`

- **Finalidade:** entender o pedido, classificar complexidade+risco
  (`AGENTS.md` §4), localizar arquivos, carregar só o contexto relevante,
  separar confirmado de hipótese, entregar investigação usável por outra
  skill.
- **Gatilho:** início de qualquer tarefa não trivial.
- **Inputs esperados:** pedido do usuário; acesso ao repositório.
- **Processo:** classificar complexidade/risco → localizar arquivos
  (Grep/Glob dirigido pelo pedido) → ler a regra contextual aplicável →
  para `/procurar-datas`, delegar a navegação para a skill `procurar-datas`
  em vez de ler os dossiês diretamente → para gatilho de banco, consultar
  MCP Supabase → separar "confirmado no código" de "hipótese" → produzir
  resumo estruturado.
- **Outputs:** relatório de investigação em formato fixo (pedido,
  complexidade/risco, arquivos envolvidos, diagnóstico confirmado,
  hipóteses, regras aplicáveis, pendências de validação).
- **Arquivos auxiliares:** nenhum obrigatório.
- **Regras contextuais consultadas:** as aplicáveis ao módulo identificado.
- **Documentação consultada:** dirigida por módulo — nunca
  `log_progress.md` inteiro.
- **Nível de modelo recomendado:** médio-alto — erro de classificação aqui
  contamina as skills seguintes.
- **Como evita releitura desnecessária:** produz output estruturado que
  `criar-plano` consome sem reinvestigar do zero.
- **Como validar a qualidade:** classificação de risco bate com revisão
  humana amostral; nenhuma alteração é proposta (skill é só leitura); volume
  do relatório proporcional ao nível classificado.
- **Integração com Projeto Multifase:** primeiro passo da investigação é
  checar `docs/projetos/README.md` — se a tarefa já pertence a um projeto
  ativo, usar `STATUS.md`/`PLANO.md`/`ESCOPO.md` dele como contexto em vez
  de reconstruir do zero (ver `.agents/skills/projeto-multifase/SKILL.md`,
  operação CONTINUAR).

### `criar-plano`

- **Finalidade:** receber a investigação de `auditar-tarefa` e produzir
  plano de implementação.
- **Gatilho:** investigação concluída e tarefa média/grande/crítica (tarefa
  pequena pode pular direto para execução).
- **Inputs esperados:** relatório de `auditar-tarefa` (ou investigação
  equivalente já feita na conversa).
- **Processo:** não repetir a auditoria → traduzir diagnóstico em passos
  concretos → explicitar o que fica intacto → definir critérios de aceite
  testáveis → apontar risco residual.
- **Outputs:** plano estruturado (objetivo, arquivos, alterações, regras
  preservadas, critérios de aceite, testes, riscos), pronto para aprovação.
- **Arquivos auxiliares:** nenhum obrigatório.
- **Regras contextuais consultadas:** as mesmas da auditoria, só para
  checagem cruzada.
- **Documentação consultada:** nenhuma nova, salvo lacuna identificada.
- **Nível de modelo recomendado:** médio-alto.
- **Como evita releitura desnecessária:** consome o output estruturado da
  auditoria, não o pedido original bruto.
- **Como validar a qualidade:** todo item do plano tem critério de aceite
  verificável; nenhum item contradiz regra global/contextual.
- **Integração com Projeto Multifase:** se a tarefa pertence a um projeto
  existente, o plano gerado atualiza o `PLANO.md` do projeto (marca fases/
  tarefas, não recria do zero); se é um projeto novo detectado pelos
  gatilhos, aciona `projeto-multifase` (operação INICIAR) antes de escrever
  o plano.

### `executar-plano`

- **Finalidade:** implementar um plano já aprovado pelo usuário.
- **Gatilho:** plano aprovado explicitamente.
- **Inputs esperados:** plano aprovado.
- **Processo:** não reiniciar auditoria ampla, só reler o que o plano aponta
  → implementar a mudança mínima → se encontrar contradição concreta entre
  plano e código, parar e reportar (nunca decidir sozinho) → rodar
  validações proporcionais (`AGENTS.md` §5).
- **Outputs:** diff aplicado + lista de comandos/validações executados.
- **Arquivos auxiliares:** nenhum.
- **Regras contextuais consultadas:** só se a execução tocar algo fora do
  previsto no plano — sinal de plano incompleto, reportar antes de seguir.
- **Documentação consultada:** nenhuma nova por padrão.
- **Nível de modelo recomendado:** proporcional à complexidade do plano;
  tarefa crítica continua exigindo modelo forte.
- **Como evita releitura desnecessária:** só lê o que o plano lista como
  envolvido — é o ponto central desta skill.
- **Como validar a qualidade:** diff corresponde exatamente ao escopo do
  plano; toda contradição encontrada foi reportada, não resolvida por
  suposição.
- **Integração com Projeto Multifase:** se o plano vem de um projeto
  existente, executa só a fase atual do `PLANO.md` sem reabrir planejamento
  já aprovado; contradição concreta entre plano e código vira pendência em
  `STATUS.md`, não decisão unilateral.

### `validar-entrega`

- **Finalidade:** revisar diff, verificar critérios de aceite, rodar
  validações proporcionais, identificar regressão, produzir relatório
  final.
- **Gatilho:** após `executar-plano` — obrigatório em tarefa média/grande/
  crítica, recomendado em pequena.
- **Inputs esperados:** diff; plano (critérios de aceite); nível de
  complexidade/risco.
- **Processo:** `git diff` completo → checar que só arquivos do escopo
  mudaram → rodar typecheck/lint/testes/build pertinentes → comparar contra
  critérios de aceite um a um → montar relatório final (`AGENTS.md` §11).
- **Outputs:** relatório final padronizado + veredito (aprovado/pendências).
- **Arquivos auxiliares:** nenhum.
- **Regras contextuais consultadas:** a do módulo, para checagem final.
- **Documentação consultada:** nenhuma nova.
- **Nível de modelo recomendado:** médio — checklist mecânico, mas exige
  bom julgamento para diferenciar erro novo de erro preexistente.
- **Como evita releitura desnecessária:** usa o plano como checklist, não
  reabre a investigação original.
- **Como validar a qualidade:** toda alegação de "passou" tem comando real
  associado; nenhuma falha preexistente é escondida.
- **Integração com Projeto Multifase:** antes de fechar a fase, atualiza o
  resultado relevante em `STATUS.md`/`PLANO.md` do projeto (operação
  ATUALIZAR de `projeto-multifase`) — a validação de uma fase não fica só
  no relatório da conversa.

### `atualizar-log-progress` (APOSENTADA — Fase B2, 2026-08-10)

Esta subseção descreve o desenho original (Fase 3), mantido só como
registro histórico. `docs/ia/log_progress.md` foi congelado na Fase B2 —
a skill não escreve mais nesse arquivo e não tem gatilho operacional. Ver
`.agents/skills/atualizar-log-progress/SKILL.md` (versão vigente) e
`docs/ia/log_progress_legacy.md` (regra de consulta histórica).

### `procurar-datas`

- **Finalidade:** ser o navegador das regras especiais da migração
  `/procurar-datas` sem copiar o conteúdo dos dossiês.
- **Gatilho:** qualquer tarefa mencionando `/procurar-datas`, motor v2,
  Apps Script `CEP-APIBACK`/`CEP-CONFIG`, ou OSRM/Haversine no contexto de
  frete/distância.
- **Inputs esperados:** pedido do usuário relacionado ao módulo.
- **Processo:** determinar a Frente (0/Controle, 1/esquerda, 2/meio,
  3/direita) → apontar a seção exata dos dossiês relevante (busca dirigida,
  nunca leitura integral dos ~9 mil linhas somadas) → se a dúvida envolver
  OSRM/Haversine, aplicar a regra fixa (Haversine nunca é oficial sem
  confirmação no legado) → se tocar Frente 2, checar se a equivalência OSRM
  já foi validada (bloqueio conhecido) → apontar quando consultar o legado
  Apps Script diretamente.
- **Outputs:** classificação da Frente + pointers exatos (arquivo + trecho)
  para a decisão vigente, sem colar o histórico inteiro na resposta.
- **Arquivos auxiliares:** nenhum — a skill é a lógica de navegação; os
  dossiês continuam sendo os documentos-fonte.
- **Regras contextuais consultadas:** `.agents/rules/procurar-datas.md`
  (Fase 2).
- **Documentação consultada:** os 2 dossiês (dirigido) + `appscript/CEP-APIBACK.gs`/`CEP-CONFIG.gs` quando a dúvida for de regra de negócio do
  legado.
- **Nível de modelo recomendado:** alto quando a tarefa é Frente 1/2 (risco
  de negócio real); médio quando é Frente 0/3.
- **Como evita releitura desnecessária:** é o próprio propósito da skill —
  nunca carregar os dois dossiês inteiros por padrão, só a seção localizada.
- **Como validar a qualidade:** a skill nunca propõe mudança de regra de
  negócio sozinha; quando não encontra a decisão vigente, marca como
  pendência e pede o trecho do legado, em vez de inventar.
- **Integração com Projeto Multifase:** coexiste normalmente com o
  harness — se `/procurar-datas` migrar para `docs/projetos/procurar-datas/`
  no futuro (não decidido nesta tarefa), a skill passa a navegar também
  `ESCOPO.md`/`PLANO.md`/`DECISOES.md` do projeto, mas as regras especiais
  da migração (Frentes, Haversine, bloqueio da Frente 2) continuam sendo a
  fonte de verdade, nunca substituídas pelo harness.

## Estado de implementação

Todas as 7 skills de projeto estão implementadas: `projeto-multifase`
(Fase 1.5, 2026-08-07 — exceção deliberada porque o harness de
continuidade precisava existir antes das demais) e as seis skills
operacionais desta seção (Fase 3, 2026-08-07) —
`.agents/skills/<nome>/SKILL.md` para cada uma. Nenhuma foi deixada vazia
ou como esqueleto.

## Compatibilidade Claude Code

Claude Code não reconhece `.agents/skills/` como diretório nativo de
skills (só descobre `.claude/skills/`) — confirmado na fundação (ver
`.agents/README.md`). Na Fase 3, a descoberta automática das seis skills
novas foi resolvida via pointer em `AGENTS.md` §9 (lido pelo Claude Code
através do adaptador `CLAUDE.md` → `@AGENTS.md`): o agente aprende o
gatilho e o caminho canônico (`.agents/skills/<nome>/SKILL.md`) e lê o
arquivo diretamente quando o gatilho bate, sem precisar de descoberta
nativa de skill. Nenhuma cópia foi criada em `.claude/skills/` — duplicaria
conteúdo e criaria manutenção frágil (dois arquivos por skill a manter
sincronizados) sem ganho real, já que o pointer em `AGENTS.md` já é
suficiente na prática. Decisão registrada aqui para não ser reaberta sem
evidência de que o pointer não está funcionando em uso real.
