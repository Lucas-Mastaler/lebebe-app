---
name: auditar-tarefa
description: "Use no início de qualquer tarefa não trivial para investigar antes de implementar: entender o pedido, classificar complexidade+risco, localizar o fluxo realmente envolvido, carregar só as rules aplicáveis e separar confirmado de hipótese. NÃO use para auditoria completa do sistema, nem para tarefa pequena e sem risco já clara (ex.: typo, texto, log pontual, erro de typecheck já diagnosticado) — nesse caso vá direto para execução."
metadata:
  author: le-bebe-app
  version: "1.0.0"
---

# Auditar Tarefa

Investigação proporcional antes de implementar. Produz um relatório que a
skill `.agents/skills/criar-plano/SKILL.md` (ou a execução direta, em
tarefa pequena) consome sem reinvestigar do zero.

## Quando pular esta skill

Se o pedido já é pequeno, sem gatilho de risco (`AGENTS.md` §4) e o arquivo
envolvido já é conhecido, não produza relatório — leia o arquivo e a
dependência imediata, e siga direto para execução. Fabricar um relatório
grande para uma tarefa pequena é o erro que esta skill existe para evitar.

## Processo

1. **Entender o pedido.** Reformule em uma frase o que está sendo pedido e
   o que não está.
2. **Checar Projeto Multifase.** Consulte `docs/projetos/README.md`. Se a
   tarefa já pertence a um projeto ativo, use `STATUS.md`/`PLANO.md`/
   `ESCOPO.md` dele como contexto em vez de reconstruir do zero — siga a
   operação CONTINUAR de `.agents/skills/projeto-multifase/SKILL.md` e não
   repita o que já está registrado lá.
3. **Classificar complexidade e risco** conforme `AGENTS.md` §4. Gatilho de
   risco eleva a tarefa a crítica só quando a gravidade justificar — não
   automaticamente.
4. **Localizar o fluxo realmente envolvido** (Grep/Glob dirigido pelo
   pedido, não exploração ampla por padrão).
5. **Carregar só a(s) rule(s) aplicável(is)** — ver `AGENTS.md` §7 para o
   mapa módulo → rule. Para `/procurar-datas`, delegue a navegação para a
   skill `.agents/skills/procurar-datas/SKILL.md` em vez de ler os dois
   dossiês diretamente. Para
   gatilho de banco, siga `.agents/rules/banco-supabase.md` e valide via MCP
   Supabase.
6. **Aplicar a investigação proporcional** de `AGENTS.md` §5 conforme a
   classificação do passo 3.
7. **Separar** o que foi confirmado por leitura real do que é hipótese e do
   que não foi confirmado — nunca misture as três categorias.
8. **Identificar impacto provável** (o que a mudança toca, o que fica de
   fora).

Amplie a investigação a qualquer momento se aparecer evidência concreta de
impacto maior do que o esperado — mesmo depois de já ter classificado a
tarefa como pequena.

## Output

Formato compacto e estruturado:

```
Pedido: ...
Classificação: complexidade=<pequena|média|grande> risco=<nenhum|contido|crítico>
Projeto multifase relacionado: <slug ou "nenhum">
Rules consultadas: ...
Arquivos/fluxo confirmado: ...
Diagnóstico: ...
Hipóteses: ...
Não confirmado: ...
Impacto provável: ...
Pendências: ...
Recomendação de próximo passo: <executar direto | criar-plano | pendência para o usuário>
```

Esta skill não implementa nada — é só leitura e diagnóstico.

## Esforço recomendado

Médio-alto: um erro de classificação aqui contamina as skills seguintes.
Tarefa claramente pequena e sem risco pode usar esforço baixo (ou pular a
skill, ver acima).
