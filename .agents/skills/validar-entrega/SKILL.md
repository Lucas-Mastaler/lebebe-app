---
name: validar-entrega
description: "Use depois de executar-plano (ou de qualquer implementação) para verificar se a entrega atende ao que foi pedido: critérios de aceite, diff, escopo, rules contextuais, testes/build/lint quando aplicável, e regressão plausível no fluxo tocado. Produz o relatório final. NÃO use para iniciar auditoria geral do módulo sem evidência concreta de problema, nem para caçar 'qualquer problema possível' fora do escopo entregue."
metadata:
  author: le-bebe-app
  version: "1.0.0"
---

# Validar Entrega

Responde uma pergunta só: **a alteração implementada está correta para os
requisitos aprovados?** Não é uma segunda auditoria do módulo.

## O que validar, em ordem de prioridade

1. Critérios de aceite do plano (ou do pedido, se não houve plano formal) —
   um a um.
2. `git diff` real — confirme que só arquivos dentro do escopo mudaram.
3. Rules contextuais aplicáveis ainda respeitadas (`AGENTS.md` §7).
4. Testes relacionados ao fluxo tocado.
5. Build/typecheck/lint quando pertinentes à mudança.
6. Regressão plausível no fluxo diretamente tocado — não em módulos não
   relacionados.

## O que não fazer

- Não iniciar auditoria geral do módulo sem evidência concreta de que algo
  está errado.
- Não procurar "qualquer problema possível" fora do escopo entregue.
- Não propor refactor ou melhorias não pedidas (overengineering) — se
  encontrar algo relevante fora do escopo, liste separadamente
  (`AGENTS.md` §3), não corrija sozinho.
- Toda alegação de "passou" precisa de comando real associado — não afirme
  sucesso sem ter rodado a validação.
- Nenhuma falha preexistente deve ser escondida do relatório, mesmo que não
  tenha sido causada por esta mudança.

## Projeto Multifase

Se esta validação conclui uma fase/etapa: atualize `PLANO.md` (checkboxes
reais) e `STATUS.md` (estado vigente, não acumulado) do projeto, conforme
`.agents/skills/projeto-multifase/SKILL.md` operação ATUALIZAR. Não altere
`ESCOPO.md` sem
decisão explícita do usuário. Registre em `DECISOES.md` só se houve decisão
nova real.

## Relatório final

Este relatório é o que o usuário pode enviar para outra IA revisar — não
seja excessivamente reduzido, mas mantenha proporcional.

**Tarefa pequena:**
- o que mudou;
- arquivos;
- validações rodadas e resultado;
- teste manual, se aplicável.

**Tarefa média/crítica** (`AGENTS.md` §11):
- pedido;
- diagnóstico;
- alterações;
- arquivos;
- decisões preservadas;
- regras contextuais respeitadas;
- comandos e resultados;
- testes;
- testes manuais realizados;
- pendências;
- riscos;
- próximo passo.

Finalize com um veredito explícito: aprovado, ou pendências a resolver
antes de considerar concluído.

## Esforço recomendado

Médio para tarefa normal; médio-alto para tarefa crítica, onde julgar
"regressão plausível" exige mais cuidado.
