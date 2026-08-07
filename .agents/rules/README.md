# Plano de migração — Fase 2 (regras contextuais)

> **Status: executado em 2026-08-07.** As 5 rules abaixo foram criadas em
> `.agents/rules/*.md` seguindo este plano e são a fonte vigente — `AGENTS.md`
> §6/§7 apontam para elas. Este arquivo permanece como registro histórico da
> decisão e do mapeamento arquivo a arquivo; não precisa ser lido para operar
> as rules, só para entender a origem de cada uma.

Este arquivo era o plano da Fase 2 antes da execução. O conteúdo real das
regras vivia em `.devin/rules/`, que continua disponível e intacto para
comparação/compatibilidade até a fase de limpeza (não iniciada).

## Auditoria da lista candidata original

A lista inicial sugerida era: `banco-supabase.md`, `recebimento.md`,
`procurar-datas.md`, `inteligencia-comercial.md`,
`novas-telas-permissoes.md`, `integracoes.md`. Avaliação arquivo a arquivo:

| Candidato | Decisão | Motivo |
|---|---|---|
| `banco-supabase.md` | **Criar** | Gatilho específico e crítico (schema/RLS/migration); conteúdo já existe concentrado em `.devin/rules/supabase.md`, só precisa mover |
| `recebimento.md` | **Criar** | Módulo crítico com regra de negócio própria (timer, volumes, divergências); hoje o conteúdo está partido entre `.devin/rules/recebimentos.md` e um mapa de rotas/tabelas órfão em `CONTEXTO DO PROJETO.MD` §6 |
| `procurar-datas.md` | **Criar** | Módulo com mais regras especiais do projeto; precisa ficar pequeno (navegador, não cópia dos dossiês de 4-5 mil linhas) |
| `inteligencia-comercial.md` | **Criar** | Pequeno (hoje 16 linhas dentro de `Agent.md` §16), mas domínio sensível o bastante para não diluir dentro de um arquivo maior |
| `novas-telas-permissoes.md` | **Criar, porém mínimo** | O checklist completo já mora no lugar certo (`docs/ia/padrao-novas-telas-permissoes.md`, 324 linhas, bem estruturado). Este arquivo deve ser só gatilho + pointer (~10-15 linhas), não uma segunda cópia do checklist |
| `integracoes.md` | **Não criar agora** | Conteúdo genérico demais (localizar config, ler tipos, não inventar payload) — já coberto pelo princípio "não inventar" do `AGENTS.md`. Sem regra de negócio específica por integração hoje. Reavaliar só se surgir regra própria de uma integração (ex.: Digisac) que não caiba no genérico |

Nenhum outro contexto do repositório apresentou evidência de regra de
comportamento própria hoje (Hub de Vendas e Pedidos Personalizados têm
documentação extensa de feature em `docs/`, mas não uma "regra que deve ser
obedecida sempre que o contexto aparecer" distinta do genérico — se isso
mudar, tratar como novo candidato na Fase 2).

## Mapeamento arquivo a arquivo

### 1. `.agents/rules/banco-supabase.md`

- **Origem:** `.devin/rules/supabase.md` (íntegra, 64 linhas).
- **Conteúdo mantido:** validação obrigatória no MCP; proibição de assumir
  estrutura; checklist antes de alterar query/migration; aviso de mudança
  destrutiva; tratamento de divergência código × banco; exigência de invocar
  a skill oficial `supabase` ao usar o MCP.
- **Duplicação eliminada:** as restatements da mesma regra em
  `.devin/rules/Agent.md` §12, `gerais.md` §7/§12.2/§12.6 e
  `CONTEXTO DO PROJETO.MD` §8.3 não migram — viram só o pointer que já está
  em `AGENTS.md` §6.
- **Trigger/contexto:** schema, tabela, coluna, tipo, enum, migration, FK,
  join, view, índice, trigger, função SQL, constraint, RLS, policy,
  persistência, query de leitura ou escrita.
- **Validação necessária antes de migrar:** nenhuma alteração de conteúdo,
  só de local — comparar o novo arquivo linha a linha com `supabase.md`
  antes de considerar a migração concluída.
- **Quando o arquivo antigo pode ser desativado:** depois que
  `banco-supabase.md` existir, pelo menos uma tarefa real de banco tiver
  usado a regra nova com sucesso, e o usuário aprovar a fase de limpeza.

### 2. `.agents/rules/recebimento.md`

- **Origem:** `.devin/rules/recebimentos.md` (íntegra, 95 linhas) +
  `CONTEXTO DO PROJETO.MD` §6.2–§6.4 (mapa de rotas/APIs/entidades do
  módulo, hoje órfão — nenhuma regra atual referencia esse mapa, mas o
  conteúdo é útil e não está duplicado em `recebimentos.md`).
- **Conteúdo mantido:** fluxo crítico; checklist antes de mexer em
  recebimento; proibição de alterar cálculo de conferência no chute;
  dependências cruzadas; regra de timer; regra de volumes; regra de
  finalização; regra de XML/importação; regra de permissões — mais o mapa
  de rotas (`src/app/recebimento/...`), APIs
  (`src/app/api/recebimento/...`) e entidades (`recebimentos`,
  `recebimento_itens`, `matic_sku` etc.) hoje só em `CONTEXTO DO PROJETO.MD`.
- **Duplicação eliminada:** o resumo em `Agent.md` §15 não migra — vira só
  o pointer de `AGENTS.md` §7.
- **Trigger/contexto:** qualquer alteração em listagem, conferência, itens,
  volumes, OS, divergências, timer, recálculo, finalização, cancelamento,
  `matic_sku`, exportação Google Sheets, importação de XML.
- **Validação necessária:** confirmar que o mapa de rotas/tabelas herdado de
  `CONTEXTO DO PROJETO.MD` ainda bate com o código real antes de migrar (o
  documento é de 2026-06-09; pode ter ficado desatualizado).
- **Quando o arquivo antigo pode ser desativado:** mesmo critério do item 1.

### 3. `.agents/rules/procurar-datas.md`

- **Origem:** `.devin/rules/gerais.md` §12 (íntegra) + `.devin/rules/Agent.md`
  §17 (mesmo conteúdo, redundante) + `docs/ia/padrao-novas-telas-permissoes.md`
  §8 (regra de classificação de Frente para telas do módulo) + o `AGENTS.md`
  antigo (nota técnica pendente, preservada abaixo).
- **Conteúdo mantido:** classificação obrigatória de Frente (0/Controle,
  1/esquerda, 2/meio, 3/direita) antes de qualquer análise; leitura
  obrigatória dos 3 documentos-fonte reformulada como **consulta dirigida**
  (localizar a seção relevante, não ler os dossiês inteiros por padrão);
  Apps Script como fonte de verdade; proibição de Haversine como cálculo
  oficial sem confirmação no legado; bloqueio de avanço da Frente 2 sem
  equivalência OSRM validada; obrigação de atualizar
  `docs/procurar-datas-escopo-equivalencia-legado-v2.md` quando uma regra da
  migração for validada.
- **Conteúdo herdado do `AGENTS.md` antigo, preservado como pendência
  técnica ainda aberta (não confirmado como resolvido em nenhum dos
  dossiês, verificado nesta tarefa):** o modal "Procurar datas de entrega"
  hoje calcula o `VALOR INICIAL` sem usar distância real (base semanal +
  adicional rural + adicional condomínio + ajuste de +20% + arredondamento);
  o backend real usa `calcularFrete(distKm, isSat, isRural, isCondominio)`
  com `distKm` de `getDrivingKm` (OSRM primeiro, Haversine como fallback) e
  o mesmo ajuste de +20%. Pendência: fazer o modal usar a distância real do
  destino em vez da estimativa estática — fluxo deve ser mantido intacto e
  a mudança requer plano cuidadoso antes de implementar.
- **Conteúdo que NÃO migra:** o conteúdo integral dos dois dossiês (4.018 e
  5.182 linhas) — eles continuam existindo como documentação própria; a
  regra só aponta para eles e ensina como navegá-los (ver também a skill
  `procurar-datas` planejada na Fase 3).
- **Trigger/contexto:** qualquer tarefa em `/procurar-datas`, no motor v2,
  no legado Apps Script (`CEP-APIBACK.gs`, `CEP-CONFIG.gs`) ou em cálculo de
  frete/distância relacionado.
- **Validação necessária:** confirmar com o usuário se a pendência do
  `VALOR INICIAL` ainda é válida antes de qualquer implementação futura —
  não foi encontrada evidência nos dossiês de que já tenha sido resolvida.
- **Quando o arquivo antigo pode ser desativado:** mesmo critério do item 1,
  mais confirmação explícita de que nenhuma regra de negócio do motor foi
  alterada no processo (Frente 0/Controle apenas).

### 4. `.agents/rules/inteligencia-comercial.md`

- **Origem:** `.devin/rules/Agent.md` §16 (íntegra, 16 linhas — não existe
  arquivo `.devin/rules` dedicado hoje).
- **Conteúdo mantido:** SGI como fonte operacional primária para auditoria;
  ordem de investigação de divergência (SGI → HTML bruto → parser → JSON →
  importador → Supabase → API → frontend); bloco sem cliente ignorado
  integralmente nos cálculos; lista de itens a validar antes de alterar
  indicadores (filtros, status, operações, devoluções, pagamentos, crédito
  de troca, pendência, frete, descontos, ticket médio).
- **Duplicação eliminada:** nenhuma — este conteúdo só existe em um lugar
  hoje.
- **Trigger/contexto:** qualquer tarefa tocando indicadores, dashboards ou
  cálculos de Inteligência Comercial.
- **Validação necessária:** nenhuma além da cópia fiel.
- **Quando o arquivo antigo pode ser desativado:** mesmo critério do item 1.

### 5. `.agents/rules/novas-telas-permissoes.md`

- **Origem:** `.devin/rules/Agent.md` §14 + `gerais.md` §13 (resumos
  redundantes entre si) — **não** o checklist completo, que já mora em
  `docs/ia/padrao-novas-telas-permissoes.md`.
- **Conteúdo mantido:** só o gatilho e o pointer — "antes de criar/alterar
  tela interna, leia `docs/ia/padrao-novas-telas-permissoes.md` e siga o
  checklist da seção 3 por completo". Meta: 10-15 linhas.
- **Conteúdo que NÃO migra:** o checklist em si — permanece único em
  `docs/ia/padrao-novas-telas-permissoes.md`, que já está bem estruturado e
  não deve ser duplicado.
- **Trigger/contexto:** nova página, sub-rota, item de menu, área
  administrativa, tela operacional interna.
- **Validação necessária:** nenhuma.
- **Quando o arquivo antigo pode ser desativado:** mesmo critério do item 1.

## Consolidação das regras globais (não vão para `.agents/rules/`)

O conteúdo abaixo já foi absorvido em `AGENTS.md` nesta própria tarefa
(fundação). Os arquivos de origem permanecem intactos como referência
histórica/interina até a fase de limpeza:

- `.devin/rules/gerais.md` — seções 1-11 (escopo, suposição, investigação,
  mudança mínima, segurança, banco genérico, UI, logs, arquitetura,
  continuidade) → `AGENTS.md` §2, §3, §5, §9.
- `.devin/rules/resumo.md` — condensado de tudo acima → mesma cobertura em
  `AGENTS.md`, sem necessidade de um resumo separado.
- `.devin/rules/continuidade-agente.md` — formato do log → `AGENTS.md` §9.
- `.devin/rules/Agent.md` — as seções 1-11, 18-20 (protocolo geral,
  investigação, resposta antes de editar, validações, relatório final,
  regra final) → `AGENTS.md` completo. As seções 12-17 (banco, integrações,
  telas, recebimento, inteligência comercial, procurar-datas) foram
  distribuídas para os arquivos contextuais acima.

## Regra nova introduzida nesta fundação (sem arquivo de origem)

A classificação por complexidade + risco (`AGENTS.md` §4) e a investigação
proporcional (`AGENTS.md` §5) não existiam em nenhum arquivo antigo — é
conteúdo novo, pedido explicitamente para resolver o achado da auditoria de
que toda tarefa recebia o mesmo nível de investigação independente do porte.

## Compatibilidade Claude Code (adaptador desta fundação)

O Claude Code lê `CLAUDE.md` na raiz automaticamente como memória de
projeto, mas **não** reconhece `AGENTS.md` nativamente — confirmado via
consulta à documentação oficial (agente `claude-code-guide` desta sessão).
O `CLAUDE.md` criado nesta tarefa usa a sintaxe nativa de import
(`@AGENTS.md`), suportada pelo Claude Code com resolução de caminho relativa
ao arquivo que contém o import e profundidade máxima de 4 níveis — por isso
o adaptador não duplica nenhum conteúdo, só aponta.

Quando a Fase 2 criar os arquivos reais em `.agents/rules/`, o mecanismo
nativo `.claude/rules/*.md` (também confirmado, com suporte a frontmatter
`paths:` para carregamento sob demanda por padrão de arquivo) é candidato
natural para tornar cada regra contextual visível ao Claude Code sem
duplicar conteúdo: um arquivo curto em `.claude/rules/<nome>.md` com
`paths: <padrão relevante>` e corpo `@../../.agents/rules/<nome>.md`. Isso
fica para a execução da Fase 2, não desta fundação.
