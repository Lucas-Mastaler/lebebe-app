# Plano — Lebebe Exclusive em Pedidos Personalizados

**Estado do planejamento:** APROVADO E EM EXECUÇÃO

## Objetivo

Implementar Lebebe Exclusive dentro de Pedidos Personalizados, compartilhando
somente o cabeçalho e os blocos administrativos realmente gerais e mantendo
catálogo, itens, resumo e regras operacionais separados da Moriah.

## Escopo preservado

- Não refatorar o fluxo Moriah fora dos pontos necessários para despachar por
  fornecedor.
- Não tocar nas alterações locais de Hub/Vendas.
- Não criar integração, endpoint ou botão SGI sem interface real confirmada.
- Não expor custo à API/tela de criação.
- Não tornar Google Sheets ou Apps Script dependência operacional.

## Fases e dependências

### Fase 1 — Auditoria e gates

- [x] Confirmar raiz, regras e projeto multifase.
- [x] Ler fluxo atual de criação, APIs, repositório, Gestão, detalhes,
  resumos, status, permissões e testes.
- [x] Ler integralmente os três arquivos legados e preservá-los junto ao
  projeto.
- [x] Validar schema, dados, migrations, grants, RLS, functions e extensões no
  Supabase real.
- [x] Procurar interface real de cadastro de produto no SGI.
- [x] Receber decisão humana sobre quais status vigentes são comuns e qual será
  o fluxo da Lebebe Exclusive; não definir status novos antes disso.
- [x] Receber e perfilar a exportação da aba `DADOS`, incluindo duplicidades,
  campos vazios, codificação e formatos monetários.

### Fase 2 — Banco e importação

Dependência: Fase 1 concluída.

- [x] Aprovar a modelagem proposta: reutilizar
  `pedidos_personalizados_produtos` para a identidade geral e criar uma extensão
  1:1 específica para coleção, referência, preço e custo Exclusive.
- [x] Modelar itens Exclusive com snapshots de coleção, descrição,
  referência, preço, custo, quantidade, nome/letra e totais exatos.
- [x] Criar constraints e índices nas colunas de filtro, relacionamento e
  histórico.
- [x] Habilitar RLS e manter privilégios mínimos, seguindo o padrão atual de
  acesso server-only por `service_role`.
- [x] Criar busca manual, combinada e limitada no backend, com validação de
  pelo menos três caracteres.
- [x] Criar importação idempotente e auditável do arquivo fornecido.
- [x] Ensaiar migration em transação com `ROLLBACK`, aplicar via MCP e
  verificar estado remoto.

### Fase 3 — APIs e regras por fornecedor

Dependência: Fase 2 concluída.

- [x] Ampliar tipos e despacho para `lebebe_exclusive` sem promover tipos de
  tapete a tipos gerais.
- [x] Implementar busca do catálogo sem custo no contrato da vendedora.
- [x] Implementar criação idempotente com preço/custo obtidos no servidor e
  snapshots gravados atomicamente.
- [x] Tornar listagem, detalhe, edição, status e resumos conscientes do
  fornecedor.
- [x] Restringir custo ao contexto autenticado da Gestão.

### Fase 4 — Interface de criação

Dependência: Fase 3 concluída.

- [x] Permitir a seleção de fornecedor mantendo a Moriah intacta.
- [x] Criar seção Exclusive com filtros manuais, tabela e estados de
  orientação/loading/erro/vazio.
- [x] Preservar seleções por identificador entre buscas e refetches.
- [x] Implementar os dois acessos a `Mostrar selecionados`, edição em linha,
  remoção, totais e proteção contra double submit.
- [x] Criar resumo operacional sem custo.

### Fase 5 — Gestão

Dependência: Fase 3 concluída.

- [x] Adaptar card para `Itens` e dados resumidos por fornecedor.
- [x] Criar seção `Produtos do pedido`, separada dos componentes Moriah.
- [x] Exibir custo somente na Gestão autorizada.
- [x] Criar resumo de Gestão com custo e omitir nome/letra vazio.
- [x] Não exibir ação SGI enquanto não existir interface efetiva e
  idempotente.

### Fase 6 — Validação

Dependência: Fases 2 a 5 concluídas.

- [x] Validar migration, constraints, índices, RLS e grants no banco real.
- [x] Executar testes automatizados de pesquisa, seleção, cálculos, snapshots, permissões,
  criação, card, detalhes, resumos, loading, erros e double submit.
- [x] Executar a regressão focada da Moriah.
- [x] Executar TypeScript, lint e build, separando falhas preexistentes.
- [x] Fazer smoke autenticado e registrar explicitamente qualquer gate visual
  ou de produção remanescente.

### Fase 7 — Correção da transição com lançamento

Dependência: Fase 6 concluída e reprodução autenticada do `422` Moriá.

- [x] Corrigir a serialização da ordem das cores no payload comercial Moriá.
- [x] Persistir o número de lançamento e a mudança para `VENDA FECHADA` na
  mesma transação do banco, para ambos os fornecedores.
- [x] Expor mensagens estruturadas de validação no frontend e registrar na
  rota comercial código, fornecedor e campos inválidos sem dados pessoais.
- [x] Cobrir com testes o payload `1/15/29`, a atomicidade do lançamento e a
  matriz vigente de transições Moriá/Lebebe Exclusive.
- [ ] Reexecutar regressão focada, SQL transacional, lint, typecheck/build e
  smoke autenticado proporcional.
  - [x] Regressão focada, SQL transacional com `ROLLBACK`, lint e build.
  - [x] Typecheck sem erro novo no fluxo; bloqueio global preexistente em
    `hub-vendas/alertas/teste/route.test.ts`.
  - [x] Aplicar a migration autorizada e confirmar a nova assinatura pelo
    PostgREST sem mutação de dados.
  - [ ] Concluir o smoke autenticado da transição real pela interface.

## Critérios de aceite

Os 26 blocos do pedido original são obrigatórios. Em especial: nenhuma busca
automática, nenhum catálogo completo no browser, nenhuma perda de seleção,
nenhum custo na criação, snapshots históricos independentes do catálogo atual e
nenhuma regressão funcional da Moriah.

## Modelagem aprovada do catálogo

### Evidência do CSV

- Arquivo UTF-8 sem BOM, SHA-256
  `A5C769093DF468998DD03B513B33C1F4007BD68D9E8223B5E9116DE624CBCAB6`.
- 3.078 linhas, 71 coleções e nenhum campo obrigatório vazio.
- Todos os custos e preços usam formato monetário brasileiro válido e são
  positivos; custo entre R$ 25,00 e R$ 1.433,00, preço entre R$ 59,90 e
  R$ 3.299,90.
- 3.073 referências textuais exatas e 3.064 depois de normalizar pontuação;
  existem 14 colisões normalizadas. Referência não pode ser chave única.
- Uma linha é duplicata integral: linhas CSV 621 e 652, referência `76029`.
- Há 146 descrições com espaço externo, 320 com espaço interno duplicado e 193
  referências com hífen Unicode; a importação deve limpar espaços para exibição
  e preservar a referência original para apresentação.

### Reuso da estrutura geral

`pedidos_personalizados_produtos` continua como identidade compartilhada:

- `id`, `fornecedor_id`, `descricao`, `ativo`, `ordem` e timestamps existentes;
- `codigo` recebe identificador técnico determinístico da importação e não é
  exibido como referência comercial;
- `produto_id_sgi` permanece nulo para os itens do catálogo Exclusive, porque a
  integração futura criará um único produto SGI consolidado por pedido.

### Extensão específica Exclusive

Criar uma relação 1:1 proposta, ainda sem migration:

- `produto_id` como chave primária e FK para `pedidos_personalizados_produtos`;
- `colecao` e `referencia` como textos obrigatórios, sem unicidade na referência;
- `preco_unitario` e `custo_unitario` como `numeric(12,2)` positivos;
- timestamps de atualização do catálogo.

Isso evita colocar custo/coleção/referência da Exclusive nas regras Moriah e
reutiliza a identidade por fornecedor já existente.

### Pesquisa proposta

- API protegida pelo módulo de criação; nenhuma consulta ao digitar.
- Pelo menos um filtro normalizado com três caracteres; filtros combinados com
  `AND`.
- Busca sem acento em coleção/descrição e busca de referência ignorando espaços,
  pontos e diferentes tipos de hífen.
- Paginação server-side de 30 resultados por página, com total exato e
  navegação compacta entre páginas.
- Resposta da criação retorna preço, mas nunca custo.
- Com apenas 3.078 linhas e pesquisa manual limitada, usar inicialmente a
  extensão `unaccent` já instalada e validar com `EXPLAIN`; `pg_trgm` só será
  adicionado se a medição demonstrar necessidade.

### Importação proposta

- Validar hash, cabeçalhos, número de linhas, campos obrigatórios, moedas e
  duplicidades antes de abrir a transação.
- Manter as referências repetidas quando representam descrições/coleções
  diferentes.
- Descartar somente a segunda ocorrência da duplicata integral das linhas
  621/652 (`76029`), sem deduplicar genericamente por referência.
- Gerar código técnico estável a partir da linha original do arquivo fixado e
  fazer upsert transacional, com reconciliação das contagens antes/depois.
- Não usar essa rotina como sincronização permanente com a planilha.

### Itens históricos do pedido

Criar uma tabela específica proposta com:

- `pedido_id`, `produto_id`, `ordem`, quantidade positiva e nome/letra opcional;
- snapshots obrigatórios de coleção, descrição, referência, preço e custo;
- totais de venda e custo gerados e armazenados a partir dos snapshots e da
  quantidade;
- unicidade de `(pedido_id, ordem)` e índices nas FKs.

Alterar preço/custo no catálogo não poderá modificar esses snapshots.

## Riscos residuais

- A referência não é única no catálogo real; a implementação não pode criar
  unicidade nem deduplicação genérica por esse campo.
- O CSV não oferece um identificador imutável de origem; o código técnico da
  importação inicial ficará vinculado ao arquivo/hash aprovado, não a futuras
  sincronizações por planilha.
- A automação externa de cadastro de produto no SGI não está conectada nem
  documentada no repositório atual.

### Fase 8 — Integração SGI: banco e backend

Dependência: fluxo Exclusive, snapshots e fechamento de venda vigentes.

- [x] Auditar App, Supabase, VPS e validar por leitura o modelo SGI `39879`.
- [x] Criar tabela 1:1 server-only de integração com estado, etapa, valores
  congelados, IDs parciais, claim, erro e timestamps.
- [x] Criar RPCs transacionais para iniciar/retry, claim do worker e checkpoint
  condicional por token, sem manter lock durante HTTP externo.
- [x] Ensaiar migration com `ROLLBACK`, aplicar via MCP e confirmar schema,
  grants, RLS, constraints, índices e advisors.
- [x] Criar rota autenticada da Gestão para iniciar/tentar novamente e rotas
  internas Bearer específicas para claim/checkpoint do worker.
- [x] Incluir o estado SGI nas respostas de listagem e detalhe sem expor custo
  fora da Gestão.

### Fase 9 — Integração SGI: worker e interface

Dependência: Fase 8 concluída.

- [x] Parametrizar somente o necessário do fluxo HTTP validado, mantendo o
  modelo `39879` fixo server-side.
- [x] Criar worker outbound sem porta pública, com polling autenticado do App,
  estado local atômico, logs por pedido e callback após cada etapa.
- [x] Validar nome do modelo antes de duplicar e recuperar produto existente
  pelo nome exato antes de qualquer nova duplicação.
- [x] Adicionar componente compartilhado no card e detalhe, modal de
  confirmação, estados disponível/processando/erro/concluído e polling.
- [x] Garantir que Moriah não receba ação, estado ou alteração funcional.

### Fase 10 — Validação e operação controlada

Dependência: Fases 8 e 9 concluídas.

- [x] Cobrir elegibilidade, valores canônicos, nome, concorrência, double-click,
  timeout, falhas parciais, retry e congelamento pós-sucesso.
- [x] Executar regressão focada, SQL transacional, lint, typecheck e build.
- [x] Instalar o worker na VPS sem expor porta nem secrets; mantê-lo inativo até o deploy do App.
- [ ] Executar exatamente um teste SGI real com pedido Exclusive elegível,
  preservando o mesmo produto em qualquer falha parcial.
- [ ] Confirmar visualmente card/modal e registrar o gate se não houver pedido
  elegível ou sessão autenticada adequada.
