# Escopo — Confidencialidade de custos

**Estado:** APROVADO em 2026-10-26, pela autorização para executar a Fase 2 documentada.

## Objetivo

Impedir que os perfis `consultora` e `supervisora_loja` recebam ou visualizem custo interno da empresa, em qualquer tela, API, relatório ou exportação.

## Problema resolvido

Hoje a Gestão de Pedidos Personalizados entrega custo de Le Bébé Exclusive no JSON da listagem e do detalhe, e a tela mostra esse custo no modal. Os dois perfis têm o módulo liberado. Não existe regra central que impeça a entrega.

## Comportamento esperado

- `consultora` e `supervisora_loja` continuam operando pedidos, vendas, preços cobrados, descontos, frete cobrado e totais comerciais.
- As respostas que hoje incluem `custoUnitario`, `totalCusto` e `produtoSgi.custo` omitem esses campos para os dois perfis.
- `gestao`, `pos_venda` e superadmin continuam recebendo e vendo os mesmos custos.
- A interface não mostra custo enquanto a permissão não estiver confirmada.

## Regras de negócio

Fonte permanente: `.agents/rules/confidencialidade-custos.md`.

A restrição é só desses dois perfis. Preço de venda não é custo.

## Dentro do escopo

- Omissão dos campos de custo nas APIs de Pedidos Personalizados que já os devolvem.
- Ocultação correspondente na Gestão, depois que a resposta deixar de trazê-los.
- Testes dos perfis restritos e dos perfis que permanecem autorizados.
- Regra permanente no Harness. Já registrada nesta auditoria.

## Fora do escopo

- Alterar cálculo, preço de venda, catálogo ou valor armazenado.
- Remover coluna do banco ou executar migration.
- Esconder preço de venda, total cotado Decorisi, frete cobrado em `/procurar-datas` ou valores comerciais do SGI.
- Mudar permissão de módulo de outros perfis.
- Endurecer `is_comercial_user()` ou o acesso de `supervisora_loja` a `superadmin_usuarios`. Achados separados, sem autorização.

## Critérios de aceite

- Consultora e supervisora de loja não veem custo na Gestão e não o recebem nas APIs protegidas.
- Perfis autorizados continuam recebendo custo.
- Preço de venda e totais comerciais continuam nas respostas e na tela.
- Teste automatizado cobre a omissão e a permanência dos campos.
- A proteção não depende só de condição visual.

## Decisões funcionais já aprovadas

- D-001 — a regra de negócio dos dois perfis, pedida nesta auditoria.
