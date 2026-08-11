Você está trabalhando no repositório do projeto Le Bébé App.

Este arquivo é o ADAPTADOR de compatibilidade do Devin com o Harness
canônico do projeto. Ele não é mais uma segunda fonte independente de
regras — é a porta de entrada que ensina onde estão as fontes reais.

## 1. Fonte canônica — leia nesta ordem

1. `AGENTS.md` (raiz do repositório) — hierarquia de fontes, regra de não
   inventar, escopo mínimo, classificação de complexidade/risco (§4),
   investigação proporcional (§5), banco/Supabase (§6), roteamento de
   skills (§9), continuidade e relatório final (§11).
2. `.agents/rules/*.md` — regras contextuais por módulo, carregadas só
   quando o gatilho da tarefa bate: `banco-supabase.md`, `recebimento.md`,
   `procurar-datas.md`, `inteligencia-comercial.md`,
   `novas-telas-permissoes.md`. Ver `.agents/rules/README.md` para o
   catálogo completo.
3. `.agents/skills/*/SKILL.md` — procedimentos reutilizáveis:
   `auditar-tarefa`, `criar-plano`, `executar-plano`, `validar-entrega`,
   `procurar-datas`, `projeto-multifase`, mais as skills vendor `supabase` e
   `supabase-postgres-best-practices`.
4. `docs/projetos/<slug>/` — quando a tarefa pertencer a um Projeto
   Multifase em andamento, use `STATUS.md`/`PLANO.md`/`DECISOES.md`/
   `ESCOPO.md` desse projeto como contexto, em vez de reconstruir do zero.

Este arquivo e os demais em `.devin/rules/` não repetem o conteúdo das
fontes acima — leia a fonte real quando o gatilho se aplicar.

## 2. Precedência quando houver dúvida ou divergência

1. Código/banco real = estado técnico vigente.
2. `AGENTS.md` + Harness atual (`.agents/rules/`, `.agents/skills/`) =
   processo e regra de trabalho.
3. Documentação canônica da feature (`docs/...`) = regra de negócio
   específica do módulo.
4. Projeto Multifase (`docs/projetos/<slug>/`), quando aplicável =
   continuidade entre sessões.
5. Git/histórico (`docs/ia/log_progress.md`, commits) = contexto antigo,
   consultado só por busca dirigida — nunca fonte de verdade do estado
   atual.

Não escolha um lado no chute em caso de divergência real entre essas
camadas — informe a divergência antes de agir, como `AGENTS.md` já exige.

## 3. Papel desta pasta

`.devin/` existe só para o Devin conseguir localizar as regras e skills sem
precisar descobrir `.agents/` sozinho. Se qualquer conteúdo aqui divergir do
Harness canônico listado acima, **o Harness canônico vence** — trate
qualquer divergência encontrada como bug deste adaptador, não como duas
opções válidas.

Demais arquivos desta pasta são pointers curtos, não cópias completas:
- `gerais.md` — regras gerais e módulos com regra própria.
- `recebimentos.md` — aponta para `.agents/rules/recebimento.md`.
- `supabase.md` — aponta para `.agents/rules/banco-supabase.md`.
- `continuidade-agente.md` — regra atual de continuidade (log congelado).
- `resumo.md` — resumo de uma página com todos os pointers acima.

## 4. `docs/ia/log_progress.md` está CONGELADO

Este arquivo é histórico legado desde a Fase B2 do Harness canônico.
Regra atual, sem exceção:
- **Nunca escrever** nova entrada nele, por nenhum motivo, inclusive ao
  final de tarefa.
- **Nunca ler o arquivo inteiro** por padrão — ele tem dezenas de milhares
  de linhas.
- Consulta permitida apenas por **busca dirigida** (grep por termo, módulo
  ou data) quando for material para a tarefa atual.

Continuidade corrente:
- Se a tarefa pertence a um Projeto Multifase (`docs/projetos/<slug>/`):
  atualize só os artefatos que mudaram (`STATUS.md`/`PLANO.md`/
  `DECISOES.md`/`ESCOPO.md`), conforme `AGENTS.md` §8/§11.
- Caso contrário: o relatório final da tarefa já é suficiente. Não existe
  mais persistência global automática de continuidade.

## 5. Skills vendor nesta pasta

`.devin/skills/supabase/` e `.devin/skills/supabase-postgres-best-practices/`
são cópias intencionais, byte-idênticas, das skills oficiais do pacote
`supabase/agent-skills` que também vivem em `.agents/skills/`. Mantidas
aqui só para o Devin acessá-las sem depender de `.agents/`. Não são
divergentes — se um dia divergirem, isso é um bug de sincronização a
corrigir, não uma segunda versão válida.

## 6. Investigação, escopo e relatório final

Siga integralmente `AGENTS.md` para: não inventar comportamento/tabela/
função (§2), escopo mínimo e menor alteração possível (§3), classificação
de complexidade e risco antes de investigar (§4), investigação proporcional
(§5), validação obrigatória via MCP do Supabase quando a tarefa tocar banco
(§6), roteamento pelas skills de projeto quando aplicável (§9), e formato do
relatório final (§11). Este arquivo não repete esse conteúdo.

## 7. Módulos com regra própria

Recebimento, `/procurar-datas`, Inteligência Comercial e novas telas/
permissões têm regra contextual dedicada em `.agents/rules/` (ver §1 acima
e a tabela completa em `AGENTS.md` §7). Carregue a regra do módulo antes de
qualquer alteração nesses contextos — não decida com base só no nome do
arquivo ou em memória de tarefa anterior.
