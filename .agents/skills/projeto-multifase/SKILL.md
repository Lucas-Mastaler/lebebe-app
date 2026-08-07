---
name: projeto-multifase
description: "Use quando uma tarefa provavelmente atravessa múltiplas fases, sessões ou agentes: implementação dividida em fases, escopo funcional que precisa permanecer estável, troca provável de sessão/ferramenta/agente, vários módulos/arquivos relacionados, várias decisões de negócio, etapas dependentes, necessidade de checkpoints, trabalho que provavelmente não termina numa única tarefa, ou pedido explícito de desenvolvimento por fases / auditoria+plano+implementação em etapas. Use também no início de qualquer tarefa relevante só para checar se ela já pertence a um projeto existente em docs/projetos/. NÃO use para ajuste de texto, correção localizada, bug simples, erro de lint/typecheck já identificado, ou qualquer tarefa que claramente termina na mesma sessão."
metadata:
  author: le-bebe-app
  version: "1.0.0"
---

# Projeto Multifase

Harness próprio do Le Bébé App para preservar o contexto de trabalhos
grandes **no repositório**, não na conversa. Não é Spec Kit, Conductor nem
outro framework externo — é o padrão específico deste projeto.

Princípio central: **repositório > contexto da conversa**. Depois que uma
decisão importante é aprovada, ela precisa sobreviver ao fim da conversa,
à troca de agente e à troca de ferramenta (Claude, Codex, Devin, outro).

## Quando usar (gatilhos)

Considere um Projeto Multifase quando uma ou mais condições fortes
aparecerem:

- implementação dividida em várias fases;
- escopo funcional relevante que precisa permanecer estável;
- trabalho provavelmente continuará em outra sessão;
- possibilidade real de troca de agente ou plataforma;
- vários módulos/arquivos relacionados;
- várias decisões de negócio;
- etapas dependentes entre si;
- necessidade de checkpoints;
- desenvolvimento que provavelmente não termina numa única tarefa;
- usuário pede explicitamente desenvolvimento por fases;
- usuário pede auditoria + plano + implementação em etapas.

Use julgamento proporcional — a existência de um gatilho não obriga a criar
projeto sozinho se a tarefa claramente é pequena.

## Quando NÃO usar

Nunca crie projeto para: typo, texto, ajuste visual pequeno, log pontual,
correção localizada, erro de lint/typecheck já identificado, bug simples,
alteração pequena que termina na mesma tarefa, ou tarefa média simples sem
necessidade real de continuidade. O harness existe para reduzir contexto e
retrabalho — não para gerar documentação por si.

Se o usuário ainda está só explorando uma ideia e não há escopo suficiente
para um `ESCOPO.md` de verdade, não crie a pasta ainda — espere existir
decisão real de iniciar.

## Antes de qualquer coisa: detectar projeto existente

1. Existe pasta relacionada em `docs/projetos/`? Consulte
   `docs/projetos/README.md` (índice) e, se necessário, o `STATUS.md` de
   candidatos prováveis.
2. Se já existir projeto relacionado ao pedido atual: **não crie outro**.
   Use a operação CONTINUAR. Evite duplicação do tipo
   `pedidos-personalizados` / `pedidos-personalizados-v2` /
   `nova-tela-pedidos` para o mesmo trabalho.
3. Só se não existir e os gatilhos baterem: use a operação INICIAR.

## Estrutura de um projeto

```
docs/projetos/<slug>/
├── ESCOPO.md      # O QUE construir — contrato depois de APROVADO
├── PLANO.md       # COMO construir — fases com checkbox de progresso real
├── STATUS.md      # ONDE estamos agora — principal arquivo de retomada
└── DECISOES.md    # Decisões que precisam sobreviver entre sessões (D-001, D-002, ...)
```

Os quatro arquivos sempre existem juntos desde a criação do projeto — nunca
um projeto com só parte deles. Se `PLANO.md` ainda não tem fases reais, ele
existe mesmo assim, no estado mínimo do template (`Estado do planejamento:
PENDENTE`) — nunca é omitido nem tem fases inventadas antes da hora.

Nunca misturar os quatro papéis. Slug: minúsculo, sem acento, palavras
separadas por hífen, curto, estável. Não criar arquivo de escopo/plano/
progresso/status/decisão fora de `docs/projetos/<slug>/` — nunca solto na
raiz, em `docs/`, em `.agents/` ou em pasta de código.

Templates prontos (pequenos, só esqueleto) em `docs/projetos/_template/`.

## Operação INICIAR

1. Confirmar que não existe projeto equivalente (seção acima).
2. Definir o slug.
3. Copiar `docs/projetos/_template/` para `docs/projetos/<slug>/` — **os
   quatro arquivos (`ESCOPO.md`, `PLANO.md`, `STATUS.md`, `DECISOES.md`)
   nascem sempre juntos nesta cópia**, mesmo que alguns fiquem no estado
   mínimo do template. Nenhum projeto multifase existe com só parte dos
   quatro artefatos.
4. Registrar a linha no índice `docs/projetos/README.md`.
5. Preencher `ESCOPO.md` com o que já se sabe, estado `RASCUNHO`.
6. Preencher `PLANO.md` com fases reais quando já houver informação
   suficiente, mudando `Estado do planejamento` para `DEFINIDO`. Se ainda
   não houver, o arquivo permanece como veio do template — `Estado do
   planejamento: PENDENTE`, sem fases inventadas.
7. Registrar em `DECISOES.md` qualquer decisão já aprovada até aqui.
8. Preencher `STATUS.md` com o estado inicial.
9. Seguir o fluxo normal de planejamento da tarefa (`AGENTS.md` §5).

## Operação CONTINUAR

Ordem obrigatória — não leia tudo de uma vez:

1. Ler `STATUS.md` do projeto.
2. Identificar a fase atual.
3. Ler só a parte relevante de `PLANO.md` (a fase atual, não o arquivo
   inteiro se for longo).
4. Consultar as partes necessárias de `ESCOPO.md`.
5. Consultar as decisões referenciadas em `DECISOES.md` (não o arquivo
   inteiro se houver muitas decisões antigas).
6. Validar no código real o que for necessário.
7. Carregar a regra contextual / skill específica da tarefa
   (`.agents/rules/`, ver `AGENTS.md` §7).
8. Continuar.

Amplie a leitura só se aparecer necessidade concreta: contradição, risco
não identificado, diferença entre plano e código real, dependência ausente,
impossibilidade técnica. Registre o problema antes de desviar do plano —
não reinicie auditoria/planejamento já aprovados por conta própria.

## Operação ATUALIZAR

Ao concluir uma fase ou etapa relevante, atualizar proporcionalmente:

- **`PLANO.md`** — marcar checkboxes realmente concluídos.
- **`STATUS.md`** — substituir o estado desatualizado pelo vigente (nunca
  acumular); atualizar próximo passo.
- **`DECISOES.md`** — só se houve decisão nova relevante; nova entrada
  `D-00X`.
- **`ESCOPO.md`** — só se houve alteração de escopo explicitamente
  aprovada pelo usuário (ver regra de scope drift abaixo).

Não regravar documentos sem necessidade real.

## Operação FINALIZAR

Quando todos os critérios de aceite do `ESCOPO.md` estiverem concluídos e
validados:

1. Marcar o projeto como `CONCLUIDO`.
2. Fechar os checkboxes restantes do `PLANO.md`.
3. Atualizar `STATUS.md` com o resultado final.
4. Registrar as validações finais.
5. Atualizar `docs/projetos/README.md` (status `CONCLUIDO`).
6. Registrar um resumo curto em `docs/ia/log_progress.md`, apontando para
   `<slug>/STATUS.md` — não reproduza o projeto inteiro no log global.

Depois de concluído, a pasta permanece como documentação, mas agentes
futuros **não devem lê-la automaticamente** em tarefas não relacionadas.

## Regra crítica: escopo aprovado não muda sozinho

Depois que `ESCOPO.md` estiver `APROVADO`, não altere regra de negócio só
porque encontrou solução diferente, arquitetura que parece melhor, ou
abordagem mais elegante. Se surgir necessidade real de mudar o escopo:

1. Não altere silenciosamente.
2. Registre a questão como pendência em `STATUS.md`.
3. Explique o impacto.
4. Peça decisão humana.
5. Só depois da decisão, atualize `ESCOPO.md`.
6. Registre a decisão em `DECISOES.md`.

## Log global

`docs/ia/log_progress.md` continua existindo para continuidade global
resumida. Para projeto multifase ativo, o detalhe fica na pasta do
projeto — o log global registra só uma linha curta apontando para o
`STATUS.md` (ver operação ATUALIZAR/FINALIZAR acima e a skill
`atualizar-log-progress`, `.agents/skills/README.md`).

## Integração com as outras skills planejadas

Ver `.agents/skills/README.md` para o desenho completo — resumo aqui:
`auditar-tarefa` detecta e usa o contexto de um projeto existente;
`criar-plano` gera/atualiza `PLANO.md` quando há projeto; `executar-plano`
executa a fase atual sem reiniciar planejamento aprovado; `validar-entrega`
atualiza o resultado antes de fechar fase; `atualizar-log-progress` mantém
o log global resumido apontando para `STATUS.md`; `procurar-datas` coexiste
normalmente, preservando suas regras especiais mesmo dentro de um projeto.
