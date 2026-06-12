---
trigger: always_on
---

# Continuidade entre agentes — log_progress.md

## Antes de iniciar qualquer tarefa relevante

O agente deve:

1. Ler `docs/ia/log_progress.md`, se existir.
2. Tratar esse arquivo como resumo de continuidade — **não como fonte absoluta da verdade**.
3. Validar no código real qualquer informação necessária antes de alterar arquivos.
4. Consultar o MCP Supabase quando a tarefa envolver banco, tabelas, colunas, migrations, RLS, policies, constraints, relações ou queries.
5. Manter escopo mínimo e evitar refactors paralelos.

## Ao finalizar qualquer tarefa relevante

O agente deve atualizar `docs/ia/log_progress.md` com:

1. Data e agente/ferramenta usada.
2. Resumo curto do que foi feito.
3. Arquivos lidos.
4. Arquivos alterados/criados.
5. Validações realizadas.
6. Comandos rodados e resultados.
7. Pendências.
8. Riscos conhecidos.
9. Próximo passo recomendado.

## Regras obrigatórias

- Não apagar histórico validado.
- Não inventar validação que não foi realizada.
- Não registrar secrets, tokens, senhas ou dados sensíveis.
- Não transformar o log em cópia do chat.
- Não tratar o log como substituto da leitura do código.
- Se algo não foi confirmado, escrever explicitamente "não confirmado".
- Se a tarefa for pequena demais e não justificar atualização completa, pelo menos registrar um item curto no histórico resumido.
