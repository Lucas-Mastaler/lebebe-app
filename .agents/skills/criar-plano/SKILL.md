---
name: criar-plano
description: "Use depois de uma investigação (própria ou de auditar-tarefa) para transformar requisitos + evidência já existente em plano executável, quando a tarefa é média/grande/crítica. NÃO use para tarefa pequena já clara (vá direto para execução), nem para reinvestigar do zero quando já existe auditoria válida ou um Projeto Multifase com STATUS.md/PLANO.md atual."
metadata:
  author: le-bebe-app
  version: "1.0.0"
---

# Criar Plano

Traduz diagnóstico em passos concretos e aprováveis. Não é uma segunda
investigação.

## Princípio central: não reinvestigar por padrão

Antes de explorar de novo, procure o que já existe:

- relatório de `.agents/skills/auditar-tarefa/SKILL.md` nesta conversa;
- projeto multifase relacionado — `docs/projetos/README.md` →
  `STATUS.md`/`PLANO.md`/`ESCOPO.md` do projeto (ver
  `.agents/skills/projeto-multifase/SKILL.md`, operação CONTINUAR);
- decisões já registradas em `DECISOES.md`, se houver projeto.

Só reabra investigação quando houver **um** destes sinais concretos:
contradição com o código real, evidência insuficiente para decidir, risco
não avaliado, plano tecnicamente impossível com a evidência atual, ou
mudança de escopo pedida pelo usuário. Curiosidade genérica não é motivo
para reabrir.

## Conteúdo do plano

Inclua só o que for proporcionalmente necessário à tarefa (`AGENTS.md`
§4-§5):

- objetivo;
- escopo (o que entra);
- o que **não** será alterado;
- arquivos/áreas envolvidas;
- etapas;
- dependências entre etapas;
- rules contextuais relevantes;
- decisões já tomadas que o plano preserva;
- critérios de aceite testáveis;
- testes/validações previstas;
- riscos residuais.

Tarefa pequena com diagnóstico já claro pode dispensar esta skill — vá
direto para `.agents/skills/executar-plano/SKILL.md` ou execução direta.

## Projeto Multifase

Se a tarefa pertence a um projeto existente: atualize o `PLANO.md` dele
(marcando fases/tarefas reais, não recriando do zero) e respeite o
`ESCOPO.md` — escopo aprovado não muda enquanto o plano é escrito. Se
houver conflito entre o pedido atual e o escopo aprovado, **não decida
sozinho**: registre a pendência (em `STATUS.md` do projeto, ou no próprio
relatório se não houver projeto) e peça decisão humana.

Se a tarefa é nova, de porte grande, e os gatilhos de
`.agents/skills/projeto-multifase/SKILL.md` baterem, acione a operação
INICIAR antes de escrever o plano.

Nunca crie plano solto em `.md` fora de `docs/projetos/<slug>/PLANO.md` —
se não há projeto multifase, o plano vive na resposta da conversa, não em
um arquivo novo.

## Output

Plano estruturado pronto para aprovação do usuário quando a tarefa exigir
aprovação (crítica, ou mudança de escopo). Tarefa média sem risco elevado
pode seguir direto para `.agents/skills/executar-plano/SKILL.md` a
critério do agente.

## Esforço recomendado

Médio para tarefa média; alto para tarefa crítica.
