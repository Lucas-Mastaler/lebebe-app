# Escopo — Lebebe Exclusive em Pedidos Personalizados

**Estado:** RASCUNHO

## Objetivo

Adicionar o fornecedor Lebebe Exclusive à funcionalidade existente de Pedidos
Personalizados, preservando os blocos comuns da Gestão e isolando as regras de
catálogo/produtos das regras específicas de tapetes Moriah.

## Comportamento esperado

- A criação reutiliza identificação, unidade, lançamento, consultora, cliente,
  telefone e fornecedor, e apresenta uma seção própria de produtos.
- O catálogo operacional fica no Supabase depois da importação inicial.
- A pesquisa começa vazia, exige ao menos um filtro com 3 caracteres e só é
  executada por `Filtrar` ou Enter, sem carregar o catálogo inteiro no browser.
- Seleções persistem entre pesquisas e podem ser revistas/removidas no modo
  `Mostrar selecionados`, acessível no topo e no fim da listagem.
- Quantidade e nome/letra são editáveis por linha; totais usam preço unitário
  vezes quantidade.
- Preço e custo do momento da venda são persistidos historicamente nos itens.
- Criação e resumo da vendedora não exibem custo; a Gestão autorizada pode
  consultar custo.
- Card, detalhes, histórico e edição preservam os blocos comuns atuais e usam
  `Itens`/`Produtos`, nunca `Tapetes`, para a Lebebe Exclusive.

## Regras de negócio

- Não generalizar regras de tapetes, medidas, cores, layout ou anexos Moriah.
- Não manter Google Sheets ou Apps Script como dependência operacional.
- Não reconstruir valores históricos por `JOIN` com o catálogo atual.
- Não criar integração SGI fictícia. A futura criação deve consolidar toda a
  venda em um único produto e ser idempotente.
- Não expor custo no contexto de criação usado pela vendedora.

## Permissões

- Reutilizar e validar os módulos existentes de criação e Gestão.
- Proteger a API de catálogo/criação no backend.
- Restringir custo ao contexto autorizado da Gestão, com validação no servidor
  e no banco; ocultação visual isolada não é suficiente.

## Integrações relevantes

- Supabase: schema, catálogo, persistência histórica, índices, constraints e RLS.
- Google Sheets/Apps Script: somente fonte da migração inicial e referência
  comportamental, preservada em `legado-apps-script/`.
- SGI/Sólidus: somente mapear nesta frente, salvo se uma interface real e segura
  já estiver confirmada no repositório.

## Restrições

- Preservar dados e comportamento da Moriah.
- Preservar as alterações locais de Hub/Vendas existentes no worktree.
- Não aplicar migration remota destrutiva.
- Não inventar nomes, contratos, endpoints ou dados de catálogo.

## Dentro do escopo

- Auditoria completa do fluxo atual e do banco real.
- Modelagem e persistência do fornecedor, catálogo e itens históricos.
- Pesquisa, seleção, criação, cards, detalhes e resumos Lebebe Exclusive.
- Importação inicial segura e repetível quando os dados-fonte forem fornecidos.
- Testes proporcionais e verificação de regressão da Moriah.

## Fora do escopo

- Refactor geral da Moriah.
- Sincronização permanente com Google Sheets.
- Integração SGI baseada em mock, endpoint presumido ou botão sem ação real.

## Critérios de aceite

Os critérios detalhados são os 26 blocos do pedido de 2026-08-13, incluindo
pesquisa manual e combinada, preservação de seleções, cálculos, segurança do
custo, persistência histórica, Gestão, detalhes, resumos, regressão da Moriah e
validações de banco/TypeScript/lint/build.

## Decisões funcionais já aprovadas

- [D-001](DECISOES.md#d-001--isolamento-por-fornecedor): regras específicas ficam isoladas por fornecedor.
- [D-002](DECISOES.md#d-002--catálogo-operacional-no-supabase): o catálogo operacional fica no Supabase.
- [D-003](DECISOES.md#d-003--preço-e-custo-históricos): preço e custo são snapshots históricos por item.
- [D-004](DECISOES.md#d-004--sgi-fora-sem-interface-real): SGI não será simulado sem interface real confirmada.
