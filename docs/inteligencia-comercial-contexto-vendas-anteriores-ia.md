# Inteligencia Comercial - Contexto de vendas anteriores na IA

**Data:** 2026-07-14  
**Status:** Implementado e validado com teste especifico, typecheck, lint e build.

---

## 1. Objetivo

Ajustar a analise por IA da tela de Inteligencia Comercial para que a IA receba contexto separado das vendas anteriores do mesmo cliente. O foco e evitar que produto citado na conversa atual seja classificado como "produto de interesse nao fechado" quando esse produto ja foi comprado em uma venda anterior do mesmo cliente.

Caso obrigatorio validado por banco:
- Venda atual `65431`: produto da venda atual e `CARRINHO TS ROMANZO DUO C/MOISES INFANTI (PRETO/BRONZE)`.
- Venda anterior `65295`: produtos historicos incluem `BERCO ZUPY NEW MATIC (BRANCO SOFT/NATURAL)` e colchao.
- Ambas as vendas estao vinculadas ao mesmo cliente/telefone no SGI.

---

## 2. Fluxo auditado

### Tela e detalhe da venda

- `src/components/inteligencia-comercial/ModalDetalheVenda.tsx` carrega o detalhe por `GET /api/sgi/vendas/[numero_lancamento]`.
- A rota `src/app/api/sgi/vendas/[numero_lancamento]/route.ts` ja busca "Vendas do cliente".
- Essa busca usa contatos da venda atual em `sgi_documentos_saida_contatos`, gera variacoes por `gerarVariacoesTelefone`, consulta outros lancamentos por `telefone_normalizado` e `telefone_normalizado_ddi`, busca os documentos em `sgi_documentos_saida` e marca `venda_atual`.
- O modal exibe essas vendas na secao "Vendas do cliente", mas esse contexto nao era enviado para a IA.

### IA individual

- Entrada: `POST /api/sgi/ia/iniciar-analise` cria job e registros por chamado do ciclo em `digisac_chamados_analise_ia`.
- Processamento: `POST /api/sgi/ia/processar-proximo` busca chamado pendente, metadados em `digisac_conversas_resumo`, vinculo em `venda_conversa_vinculos`, venda atual em `sgi_documentos_saida`, produtos da venda atual em `sgi_documentos_saida_produtos`, transcript via Digisac e monta `montarPromptChamado`.
- Antes da alteracao, o prompt individual recebia apenas `PRODUTOS COMPRADOS NESTA VENDA`.

### IA consolidada

- Ao finalizar o job, `finalizarJob` busca analises individuais concluidas, protocolos, ordem do ciclo, trechos fatuais dos transcripts, produtos da venda atual e monta `montarPromptConsolidado`.
- Antes da alteracao, o prompt consolidado recebia apenas `PRODUTOS COMPRADOS NESTA VENDA`.
- A classificacao de `produtos_fechados`, `produtos_interesse_nao_fechados`, `produtos_de_interesse`, `oportunidades_melhoria` e `conclusao_comercial` era feita sem contexto historico de compras anteriores.

---

## 3. Banco validado no MCP Supabase

Tabelas e colunas reais confirmadas:

- `sgi_documentos_saida`: `numero_lancamento`, `numero_documento`, `emissao_texto`, `data_fechamento`, `cliente`, `filial`, `vendedor`, `operacao`, `status`, `valor_total`, `valor_total_texto`.
- `sgi_documentos_saida_contatos`: `numero_lancamento`, `telefone_normalizado`, `telefone_normalizado_ddi`.
- `sgi_documentos_saida_produtos`: `numero_lancamento`, `codigo`, `produto`, `quantidade`, `quantidade_texto`, `valor_total`, `valor_total_texto`, `departamento_classificado`, `subgrupo_classificado`.
- `sgi_documentos_saida_pagamentos`: `numero_lancamento`, `forma_pagamento`, `numero_parcelas`, `valor`, `valor_texto`.
- `digisac_conversas_resumo`, `venda_conversa_vinculos`, `digisac_chamados_analise_ia`, `ia_analise_comercial_fila` e `venda_analise_comercial_ia` foram confirmadas como tabelas envolvidas no fluxo de IA e status.

Nao houve migration, alteracao de schema, policy, trigger ou RLS.

---

## 4. Criterio de mesmo cliente

O criterio implementado e o mesmo ja usado pela rota de detalhe da venda:

1. Buscar telefones da venda atual em `sgi_documentos_saida_contatos`.
2. Gerar variacoes por `gerarVariacoesTelefone`.
3. Buscar outros lancamentos com `telefone_normalizado` ou `telefone_normalizado_ddi` nessas variacoes.
4. Excluir a venda atual.
5. Considerar apenas vendas anteriores a data de fechamento da venda atual quando ambas as datas existem.

Nao foi criado vinculo por nome de cliente, documento ou homonimo. Risco de cliente homonimo e reduzido porque a regra usa telefone, nao nome. Ainda existe risco operacional se o mesmo telefone for compartilhado por clientes diferentes; esse risco ja existe no fluxo atual de "Vendas do cliente" e esta preservado.

---

## 5. Limite aplicado

O limite aplicado e `5` vendas anteriores, ordenadas da mais recente para a mais antiga.

Motivo:
- suficiente para contexto historico recente;
- reduz risco de prompt excessivo;
- preserva o padrao solicitado de 3 a 5 vendas;
- evita historico ilimitado.

---

## 6. Campos enviados para a IA

Para cada venda anterior:

- numero do lancamento;
- numero do documento;
- data de emissao (`emissao_texto`, porque nao ha coluna `data_emissao` confirmada nessa tabela);
- data de fechamento;
- filial;
- vendedor;
- operacao;
- status;
- valor total;
- indicador `Compra confirmada pelo status`;
- produtos registrados:
  - codigo;
  - produto;
  - quantidade;
  - valor;
  - departamento;
  - subgrupo.

Vendas com status cancelado ou nao finalizado podem aparecer como contexto, mas o bloco instrui a IA a usar como compra confirmada apenas quando `Compra confirmada pelo status: sim`.

---

## 7. Alteracoes realizadas

### Helper novo

Arquivo: `src/lib/ia/contexto-vendas-anteriores.ts`

- `buscarContextoVendasAnterioresIA`: busca vendas anteriores pelo mesmo criterio de telefone da UI, limita em 5, carrega produtos e marca se a compra foi confirmada pelo status.
- `montarBlocoVendasAnterioresIA`: monta bloco separado:

```text
VENDAS ANTERIORES DO CLIENTE - CONTEXTO HISTORICO
```

O bloco explicita que:
- as vendas anteriores nao fazem parte da venda atual;
- produtos historicos nao devem ser automaticamente classificados como oportunidade nao fechada;
- entrega, retirada, montagem e suporte de produto historico devem ser interpretados como contexto logistico quando fizer sentido;
- produtos historicos so sao compra confirmada se o status indicar compra confirmada.

### Rota de IA

Arquivo: `src/app/api/sgi/ia/processar-proximo/route.ts`

- Analise individual: busca contexto historico antes de montar `montarPromptChamado` e injeta o bloco entre `PRODUTOS COMPRADOS NESTA VENDA` e `CONVERSA`.
- Analise consolidada: busca contexto historico em `finalizarJob` e injeta o bloco logo apos `PRODUTOS COMPRADOS NESTA VENDA (fonte: SGI)`.
- Prompt consolidado reforcado em:
  - `produtos_fechados`: produtos de vendas anteriores sao contexto historico, nao produtos fechados da venda atual.
  - `produtos_interesse_nao_fechados`: verificar historico antes de classificar produto como nao fechado; entrega/retirada/montagem/suporte de produto historico nao devem virar oportunidade nao convertida.
- Log seguro adicionado:

```text
[IA][CONTEXTO-HISTORICO] vendaAtual=65431 vendasAnteriores=... produtosHistoricos=... criterio=telefone limite=5
```

Nao registra dados pessoais, prompts ou transcripts.

---

## 8. Testes

Arquivo novo: `src/lib/ia/contexto-vendas-anteriores.test.ts`

Cenarios cobertos:

1. Produto citado e comprado na venda anterior confirmada.
2. Produto comprado na venda atual nao entra no historico.
3. Cliente sem vendas anteriores.
4. Venda anterior cancelada ou nao finalizada fica sem compra confirmada.
5. Venda posterior a venda atual e ignorada.
6. Historico grande respeita limite.
7. Bloco explicita que produto historico nao e oportunidade nao convertida.
8. Produto generico/semelhante exige cautela de correspondencia historica.
9. Campos comerciais exigidos aparecem no bloco.
10. Reanalise preserva schema persistido; o contexto entra no prompt, nao cria coluna nova.

---

## 9. Validacoes realizadas

- MCP Supabase: colunas/tabelas reais confirmadas antes da query.
- MCP Supabase: caso `65431`/`65295` confirmado:
  - `65431`: venda atual finalizada em 07/07/2026, produto carrinho.
  - `65295`: venda anterior finalizada em 22/06/2026, produtos berco e colchao.
- `npx vitest run src/lib/ia/contexto-vendas-anteriores.test.ts`: 10 testes passando.
- `npx tsc --noEmit --pretty false`: passou.
- `npx eslint src/lib/ia/contexto-vendas-anteriores.ts src/lib/ia/contexto-vendas-anteriores.test.ts src/app/api/sgi/ia/processar-proximo/route.ts`: passou.
- `npx next build`: passou. O primeiro build falhou no sandbox por `EPERM` ao remover arquivo em `.next`; reexecutado fora do sandbox e passou. O build emitiu avisos existentes de `Dynamic server usage` em rotas autenticadas, sem falhar.

---

## 10. Resultado esperado para o caso 65431

Antes:
- A IA podia ver apenas o carrinho da venda atual.
- Se a conversa mencionasse entrega de berco, havia risco de classificar o berco como produto de interesse nao fechado ou oportunidade nao convertida.

Depois:
- A IA recebe bloco historico com a venda anterior `65295` e o produto `BERCO ZUPY NEW MATIC`.
- O carrinho continua como produto fechado da venda atual.
- O berco comprado anteriormente deve ser tratado como contexto historico/logistico quando a conversa mencionar entrega, retirada, montagem ou suporte.
- O berco nao deve aparecer como oportunidade comercial nao convertida apenas por nao estar na venda atual.

Reanalise real da venda `65431` nao foi executada neste ambiente porque exigiria acionar a rota autenticada/DeepSeek no fluxo da aplicacao. Resultado final da classificacao pos-IA depende de executar "Reanalisar IA" na tela ou chamar o fluxo autenticado apos deploy/rebuild.

---

## 11. Pendencias e riscos

- Validar manualmente a reanalise real da venda `65431` apos deploy/rebuild.
- Comparar o consolidado anterior e posterior para confirmar que o berco saiu de `produtos_interesse_nao_fechados`, `produtos_de_interesse` e `oportunidades_melhoria`, se estava presente.
- Risco conservado: telefone compartilhado por pessoas diferentes pode trazer vendas de outro comprador; o risco ja existia na secao "Vendas do cliente" e nao foi ampliado por nome/homonimo.
- Vendas canceladas aparecem como contexto, mas nao como compra confirmada. Se a regra de negocio futura exigir ocultar canceladas, ajustar o helper sem mudar schema.
