---
trigger: always_on
---

# REGRAS CURTAS DO PROJETO

- Não invente comportamento, tabela, coluna, fluxo, payload ou regra.
- Antes de alterar, leia os arquivos realmente envolvidos.
- Trabalhe apenas no escopo pedido.
- Não faça refactors paralelos.
- Não altere layout, nomes, estrutura ou comportamento sem solicitação.
- Sempre prefira a menor mudança possível.
- Se envolver banco, query, migration, join, RLS, tipos ou persistência: consultar obrigatoriamente o MCP do Supabase antes.
- Nunca assumir estrutura do banco sem validar no MCP.
- Se houver dúvida, marcar explicitamente como não confirmado.
- Em módulo de recebimento, validar sempre impacto em: conferência, volumes, OS, divergências, timer, finalização, matic_sku e Google Sheets.
- Antes de editar, responder com: entendimento, arquivos envolvidos, diagnóstico confirmado, hipóteses, validação MCP, plano mínimo, impactos e o que não será alterado.