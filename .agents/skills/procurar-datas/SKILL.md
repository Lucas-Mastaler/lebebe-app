---
name: procurar-datas
description: "Use para qualquer tarefa mencionando /procurar-datas, motor v2, legado Apps Script (CEP-APIBACK/CEP-CONFIG), ou cálculo de frete/distância/OSRM/Haversine relacionado a esse fluxo. Navega os dossiês e a rule do módulo sem copiar o conteúdo deles. NÃO use para alterar regra de negócio do motor sem confirmação explícita no legado, nem para carregar os dossiês inteiros por padrão."
metadata:
  author: le-bebe-app
  version: "1.0.0"
---

# Navegador de `/procurar-datas`

Esta skill é lógica de navegação, não uma cópia dos dossiês da migração
(~9 mil linhas somadas). A regra normativa vigente é
`.agents/rules/procurar-datas.md` — leia-a primeiro, sempre.

## Passo 1 — classificar a Frente

Antes de qualquer análise, identifique explicitamente:

- **Frente 0 / Controle** — escopo, documentação, checklist, decisões,
  controle de acesso/tela.
- **Frente 1 / esquerda** — distância, agenda, geocodificação, OSRM,
  Haversine, origem, delta de inserção, helpers puros.
- **Frente 2 / meio** — candidatos, classificação, adaptação do legado,
  ranking.
- **Frente 3 / direita** — rota diagnóstica
  `/api/procurar-datas/v2/diagnostico`, flags, snippets DevTools,
  validações manuais.

Nunca prossiga sem essa classificação — ela determina o nível de cuidado
exigido pelo restante do processo.

## Passo 2 — localizar a decisão vigente (consulta dirigida)

Não leia os documentos inteiros. Busque a seção relevante ao
assunto/regra específica da tarefa em:

- `docs/procurar-datas-escopo-equivalencia-legado-v2.md` — contrato de
  escopo da migração;
- `docs/procurar-datas-motor-v2-progresso.md` — progresso técnico atual;
- `docs/ia/log_progress.md` — busca dirigida por "procurar-datas"/módulo,
  não leitura integral.

## Passo 3 — aplicar o contrato fixo

- O legado Apps Script (`appscript/CEP-APIBACK.gs`, `appscript/CEP-CONFIG.gs`)
  é a fonte de verdade de toda regra de negócio. A v2 busca equivalência
  funcional, não reinterpretação.
- OSRM é o cálculo oficial de rota/distância onde o legado o usa assim.
  Haversine nunca é cálculo oficial de `kmAdicionalNaRotaM` sem confirmação
  explícita no legado.
- Frente 2 não avança enquanto a equivalência OSRM legado × v2 não estiver
  validada.
- Dúvida sobre comportamento esperado (cálculo, fallback, origem,
  classificação, fonte de dados) → consultar o código legado antes de
  alterar ou propor. Não inventar. Se o trecho necessário não estiver
  disponível, registrar a pendência e dizer exatamente o que falta.

## Passo 4 — só então investigar o código v2

Depois de ter a Frente e a decisão vigente localizadas, investigue o código
v2 relevante — proporcional ao porte da tarefa (`AGENTS.md` §5).

## Se a tarefa tocar telas dentro de `/procurar-datas` sem tocar o motor

Isso é Frente 0 — siga `.agents/rules/novas-telas-permissoes.md` e ainda
assim não altere APIs `/api/procurar-datas/*` sem autorização.

## Atualização de documentação

Quando uma regra da migração for validada ou uma pendência resolvida,
atualize `docs/procurar-datas-escopo-equivalencia-legado-v2.md` e
`docs/ia/log_progress.md` (via
`.agents/skills/atualizar-log-progress/SKILL.md`) — preservando encoding,
sem reformatar o documento inteiro.

## Output

- Frente identificada;
- pointer exato (arquivo + trecho) para a decisão vigente — não o histórico
  inteiro colado na resposta;
- pendência explícita quando a decisão não foi encontrada, em vez de
  suposição.

## Projeto Multifase

`/procurar-datas` ainda não migrou para `docs/projetos/` (decisão não
tomada). Se isso mudar no futuro, esta skill passa a navegar também
`ESCOPO.md`/`PLANO.md`/`DECISOES.md` do projeto, mas Frentes, regra
Haversine e bloqueio da Frente 2 continuam sendo a fonte de verdade, nunca
substituídas pelo harness genérico.

## Esforço recomendado

Alto para Frente 1/2 (risco de negócio real); médio para Frente 0/3.
