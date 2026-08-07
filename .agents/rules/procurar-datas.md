# Motor `/procurar-datas` (migração legado × v2)

## Gatilho

Carregue esta regra para qualquer tarefa em `/procurar-datas`, no motor v2,
no legado Apps Script (`appscript/CEP-APIBACK.gs`, `appscript/CEP-CONFIG.gs`)
ou em cálculo de frete/distância relacionado a esse fluxo.

## Classifique a Frente antes de qualquer análise

Toda tarefa deve começar informando explicitamente a Frente:
- **Frente 0 / Controle** — escopo, documentação, checklist, decisões,
  critérios de aceite, controle de acesso/tela.
- **Frente 1 / esquerda** — distância, agenda, geocodificação, OSRM,
  Haversine, origem, delta de inserção, helpers puros.
- **Frente 2 / meio** — candidatos, classificação, adaptação do legado,
  ranking.
- **Frente 3 / direita** — rota diagnóstica
  `/api/procurar-datas/v2/diagnostico`, flags, snippets DevTools, validações
  manuais.

## Leitura obrigatória (consulta dirigida, não leitura integral)

Antes de iniciar, localize a seção relevante — não leia os dossiês inteiros
por padrão (alguns têm milhares de linhas):
- `docs/procurar-datas-escopo-equivalencia-legado-v2.md` — **contrato de
  escopo da migração**
- `docs/procurar-datas-motor-v2-progresso.md` — progresso técnico atual
- `docs/ia/log_progress.md` — continuidade entre agentes (busca dirigida)

## Fonte de verdade

O legado Apps Script é a fonte de verdade de toda regra de negócio do motor.
A meta da v2 é **equivalência funcional** com o legado, não reinterpretação
ou "melhoria" da regra.

Se houver dúvida sobre cálculo de distância/frete/delta, fallback de erro,
origem (depósito vs. casa da equipe em sábado), classificação
(normal/especial/premium/hora-marcada/indisponível), fonte de dados (agenda,
disponibilidade, OSRM) ou qualquer comportamento esperado: consultar o
código legado antes de alterar ou propor alteração. Não inventar
comportamento por suposição — se o trecho necessário não estiver disponível,
registrar a pendência e informar exatamente o que precisa ser fornecido.

## OSRM e Haversine

- OSRM é o cálculo oficial de rota/distância quando o legado o usa dessa
  forma.
- Haversine só pode ser usado como apoio, filtro, ordenação preliminar ou
  fallback nos pontos em que o legado também o usa assim.
- Nunca tratar Haversine como cálculo oficial de `kmAdicionalNaRotaM` sem
  confirmação explícita no legado — risco alto.

## Proibições sem decisão explícita do usuário

- Não substituir regra do legado por "melhoria" sem decisão explícita.
- Não alterar Frente 2 (candidatos/classificação/adaptação do legado/ranking)
  enquanto a equivalência OSRM legado × v2 não estiver validada.
- Não avançar Frente 1, 2 ou 3 além do que foi pedido nesta tarefa.

## Atualização de documentação

Quando uma regra da migração for validada ou uma pendência resolvida,
atualizar também `docs/procurar-datas-escopo-equivalencia-legado-v2.md` (e
`docs/ia/log_progress.md`). Preservar encoding e não reformatar o documento
inteiro.

## Pendência técnica herdada — não confirmada como resolvida

O modal "Procurar datas de entrega" pode calcular o `VALOR INICIAL` sem usar
distância real (base semanal + adicional rural + adicional condomínio +
ajuste de +20% + arredondamento), enquanto o backend real usa
`calcularFrete(distKm, isSat, isRural, isCondominio)` com `distKm` de
`getDrivingKm` (OSRM primeiro, Haversine como fallback) e o mesmo ajuste de
+20%. Não foi encontrada evidência nos dossiês de que isso já tenha sido
corrigido. Antes de implementar qualquer mudança nesse ponto, confirmar com
o usuário se a pendência ainda é válida e tratar como mudança de Frente 1/2
com plano cuidadoso — o fluxo atual deve ser mantido intacto até decisão
explícita.

## Cruzamento com outras regras

Criar ou alterar tela dentro de `/procurar-datas` sem tocar o motor é
Frente 0 — seguir `.agents/rules/novas-telas-permissoes.md` e ainda assim
não alterar APIs `/api/procurar-datas/*` sem autorização.
