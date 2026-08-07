# AGENTS.md — Le Bébé App

Fonte canônica e neutra de regras para qualquer agente de IA que trabalhe neste
repositório (Claude Code, Codex, Devin, Cursor ou outro). Ferramentas específicas
devem usar apenas um adaptador mínimo que aponte para este arquivo — nunca uma
cópia independente das regras. Ver `.agents/README.md` para o mapa completo da
arquitetura e o estado da migração.

## 1. Hierarquia de fontes

Em ordem de prioridade, quando houver dúvida ou conflito:

1. Pedido atual do usuário.
2. Código real do repositório.
3. Regras globais deste arquivo.
4. Regra contextual aplicável — hoje as 5 regras de módulo vivem em
   `.agents/rules/` (ver §7); uma regra contextual futura que ainda não
   tenha sido criada lá deve ser buscada no arquivo legado equivalente em
   `.devin/rules/` (ver `.agents/rules/README.md` para o mapeamento).
5. Documentação (`docs/`).
6. Histórico (`docs/ia/log_progress.md`).

Documentação e histórico nunca substituem a leitura do código real. Em caso de
divergência entre fontes, não escolha um lado no chute: informe a divergência
antes de agir.

## 2. Não inventar

- Não invente arquivo, função, tabela, coluna, fluxo, payload ou comportamento.
- Toda conclusão vem de leitura real — nunca de nome de arquivo/função,
  comentário isolado ou memória de tarefa anterior.
- O que não foi confirmado, registre explicitamente como "não confirmado".

## 3. Escopo mínimo

- Trabalhe somente no que foi pedido.
- Não faça refactor paralelo, não renomeie, não reorganize por estética.
- Problema extra encontrado: liste separadamente, não corrija sem autorização.
- Prefira sempre a menor alteração capaz de resolver a demanda.

## 4. Complexidade e risco

Classifique a tarefa antes de investigar. Complexidade (tamanho da mudança)
e risco (o que ela toca) são dimensões relacionadas, **mas não
equivalentes**. Um gatilho de risco sempre obriga investigação mais
cuidadosa no aspecto afetado — nunca pule essa parte. Ele *pode* elevar a
classificação geral da tarefa a crítica quando a gravidade justificar, mas
não faz isso automaticamente só por existir.

**Complexidade**
- **Pequena** — 1 arquivo, ajuste localizado (texto, log, condição simples,
  erro de typecheck já diagnosticado).
- **Média** — feature localizada, vários arquivos relacionados, mudança
  funcional controlada.
- **Grande** — múltiplos módulos ou mudança de contrato de API/dado.

**Gatilhos de risco que elevam a tarefa a crítica por padrão** (a gravidade
já justifica investigação máxima): regra de negócio, schema/migration/RLS,
autenticação/permissões, alteração destrutiva, dado financeiro, cálculo de
volumes/timer/finalização no Recebimento, alteração funcional no motor
`/procurar-datas` (sujeita também às regras próprias do módulo — `AGENTS.md`
§7).

**Gatilhos de risco contidos** — exigem a mesma investigação cuidadosa
*naquele ponto específico*, mas não elevam a tarefa inteira sozinhos: query/
leitura pontual em tabela já conhecida, integração externa já mapeada,
cálculo sensível isolado sem mudança de regra. Exemplo: alterar uma query
de leitura Supabase localizada continua exigindo validar a estrutura real
via MCP com cuidado — isso não torna a tarefa inteira crítica por si só.

**Importante:** pertencer a um módulo crítico não torna toda alteração
crítica. Trocar o texto de um botão no Recebimento é tarefa pequena. Alterar
o cálculo de volumes no Recebimento é tarefa crítica. Julgue pelo que a
mudança realmente toca, não pela pasta em que o arquivo está. Em caso de
dúvida real sobre o impacto, amplie a investigação — nunca reduza por
suposição.

## 5. Investigação proporcional

- **Pequena, sem gatilho de risco:** leia o arquivo envolvido e a
  dependência imediata quando necessária. Não faça auditoria ampla por
  padrão.
- **Pequena ou média com gatilho de risco contido (não elevado a
  crítica):** mantenha o porte da tarefa, mas aprofunde a investigação
  nesse aspecto específico (ex.: validar a query/tabela no MCP mesmo sendo
  1 arquivo).
- **Média, sem gatilho que eleve a crítica:** leia o fluxo envolvido,
  arquivos relacionados, a regra contextual aplicável e os testes
  relacionados.
- **Grande, ou qualquer tarefa classificada como crítica pela §4:** leia o
  fluxo completo relevante, a regra contextual, integrações, banco (via MCP
  quando aplicável), testes e a documentação/legado quando a regra
  contextual exigir.

Amplie a investigação a qualquer momento se aparecer evidência concreta de
impacto maior do que o esperado, em qualquer nível.

## 6. Banco de dados / Supabase

Se a tarefa envolver schema, tabelas, colunas, migrations, queries,
persistência, RLS, policies, constraints ou relacionamento real do banco:
consulte `.agents/rules/banco-supabase.md` e valide o estado real via MCP do
Supabase antes de alterar ou assumir estrutura. Nunca assuma nome de
tabela/coluna/tipo a partir do código ou de migration antiga.

## 7. Módulos com regra contextual própria

| Módulo | Regra canônica | Nota |
|---|---|---|
| Recebimento | `.agents/rules/recebimento.md` | Fluxo crítico — timer, volumes, OS, divergências, finalização, `matic_sku`, Google Sheets |
| `/procurar-datas` | `.agents/rules/procurar-datas.md` | Classifique a Frente (0/Controle, 1/esquerda, 2/meio, 3/direita) antes de qualquer análise. Legado Apps Script é fonte de verdade. Haversine nunca é cálculo oficial sem confirmação no legado. Não avance a Frente 2 sem equivalência OSRM validada |
| Inteligência Comercial | `.agents/rules/inteligencia-comercial.md` | SGI é a fonte operacional primária; bloco sem cliente é ignorado nos cálculos |
| Novas telas / permissões | `.agents/rules/novas-telas-permissoes.md` (gatilho) → `docs/ia/padrao-novas-telas-permissoes.md` (checklist completo) | Checklist obrigatório: `app_modulos`, `checkModuleAndWindowAccess`, redirects, Sidebar via `NAVIGATION_GROUPS` |

Fase 2 concluída em 2026-08-07: as rules acima são a fonte canônica vigente.
Os arquivos legados equivalentes em `.devin/rules/` (`supabase.md`,
`recebimentos.md`, `gerais.md` §12, `Agent.md` §14/§16/§17) continuam
disponíveis, intactos, para comparação e compatibilidade até a fase de
limpeza (não iniciada) — ver `.agents/rules/README.md`.

## 8. Projetos multifase

Trabalho que provavelmente atravessa várias sessões ou agentes (fases
múltiplas, escopo que precisa ficar estável, troca provável de sessão ou
ferramenta, vários módulos relacionados, várias decisões de negócio) usa o
harness de **Projeto Multifase**: contexto persistido em
`docs/projetos/<slug>/`, nunca só na conversa. Antes de planejar tarefa
relevante, verifique `docs/projetos/README.md` — nunca crie um segundo
projeto para o mesmo trabalho.

Quando os gatilhos baterem, leia e siga
`.agents/skills/projeto-multifase/SKILL.md` (lista completa de gatilhos,
critérios de exclusão e as operações iniciar/continuar/atualizar/
finalizar) — ela decide sozinha o que fazer, mesmo sem o pedido mencionar
isso. Ajuste pontual (texto, log, bug simples, correção localizada) nunca
precisa desse harness.

Regra permanente: escopo/plano/status/decisões de um projeto grande vivem
só em `docs/projetos/<slug>/` — nunca soltos em `docs/`, `.agents/` ou na
raiz. Depois de um escopo aprovado, regra de negócio não muda por parecer
melhor — só por decisão humana explícita, registrada em `DECISOES.md`.

## 9. Skills operacionais

Procedimentos reutilizáveis em `.agents/skills/` — catálogo completo,
processo e esforço recomendado por skill em `.agents/skills/README.md`.
Gatilhos curtos para descoberta automática:

- pedido de investigação/auditoria antes de implementar → `auditar-tarefa`
- tarefa média/grande/crítica pronta para virar plano → `criar-plano`
- plano já aprovado, hora de implementar → `executar-plano`
- entrega concluída, hora de revisar e produzir relatório → `validar-entrega`
- fim de tarefa relevante → `atualizar-log-progress`
- qualquer tarefa em `/procurar-datas` → rule (§7) + skill `procurar-datas`
- trabalho que atravessa sessões/fases → `projeto-multifase` (§8)

Nenhuma tarefa é obrigada a passar pelas cinco primeiras skills em
sequência — tarefa pequena e já clara pode ir direto para execução e,
quando relevante, só `validar-entrega` + `atualizar-log-progress`. Cada
skill decide sozinha quando pode ser pulada; não force o fluxo completo por
padrão.

## 10. Onde encontrar o resto

- `.agents/rules/` — regras contextuais por módulo (Fase 2 concluída; ver
  README para o histórico do mapeamento).
- `.agents/skills/` — procedimentos reutilizáveis (skills; ver §9).
- `docs/` — documentação de negócio e de módulo.
- `docs/ia/log_progress.md` — histórico de continuidade. **Consulta
  dirigida**: busque por módulo/assunto e priorize entradas recentes. Não
  leia o arquivo inteiro por padrão — tem dezenas de milhares de linhas.
- `.devin/` — regras/skills legadas. As regras globais já foram absorvidas
  por este arquivo e as 5 regras de módulo já migraram para
  `.agents/rules/` (§7); `.devin/` permanece intacto para
  comparação/compatibilidade até a fase de limpeza (não iniciada).

## 11. Continuidade e relatório final

- Antes de tarefa relevante: consulta dirigida a `docs/ia/log_progress.md`.
- Ao final: atualize o log (data, agente, resumo, arquivos, validações,
  comandos, pendências, riscos, próximo passo) — use a skill
  `atualizar-log-progress` (§9) para não repetir aqui o procedimento de
  encoding que ela já padroniza. Resumo do procedimento: preserve encoding
  — leia antes de editar, nunca use `echo >>` com acento, prefira Node.js
  com `fs.readFileSync`/`fs.writeFileSync` em `'utf8'` explícito, e confira
  o resultado por comparação de bytes antes de finalizar (não confie apenas
  no round-trip de leitura/escrita).
- Relatório final proporcional: compacto para tarefa pequena; completo
  (pedido, diagnóstico, arquivos, decisões, validações, riscos, pendências,
  próximo passo) para tarefa média/grande ou com gatilho de risco.
- Nunca registre secrets, tokens, senhas ou dados sensíveis no log.

## 12. Estado desta arquitetura

Fundação criada em 2026-08-07; harness de Projeto Multifase adicionado em
2026-08-07 (Fase 1.5); Fase 2 (regras contextuais em `.agents/rules/`)
concluída em 2026-08-07; Fase 3 (skills operacionais em `.agents/skills/`:
`auditar-tarefa`, `criar-plano`, `executar-plano`, `validar-entrega`,
`atualizar-log-progress`, `procurar-datas`, além de `projeto-multifase` já
existente) concluída em 2026-08-07. `.devin/rules/`, `.devin/skills/`,
`.devin/workflows/` e o pacote oficial Supabase em `.agents/skills/`
continuam disponíveis como fonte legada/interina até a fase de limpeza (não
iniciada) — nada foi removido. Mapa completo, plano de migração e decisões
pendentes: `.agents/README.md`.
