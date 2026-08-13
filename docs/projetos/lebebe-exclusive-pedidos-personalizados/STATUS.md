# Status — Lebebe Exclusive em Pedidos Personalizados

Projeto: lebebe-exclusive-pedidos-personalizados
Estado: EM VALIDAÇÃO
Fase atual: Smoke visual autenticado e entrega

## Última etapa concluída

- Raiz canônica confirmada em `C:/le-bebe`.
- Regras globais, adaptador Devin, regras de banco/permissões e skills aplicáveis lidas.
- Três arquivos legados recebidos, lidos integralmente e movidos sem alteração
  para `legado-apps-script/`.
- Fluxo atual confirmado como Moriah do frontend às functions do banco.
- Supabase real confirmado: fornecedor `lebebe_exclusive` já existe, mas está
  indisponível e sem produtos/pedidos; tabelas atuais usam RLS, sem policies e
  com grants somente para `service_role`.
- Tabela geral de produtos confirmada sem coleção, custo e preço, e com
  unicidade `(fornecedor_id, codigo)`.
- Interface de criação de produto no SGI não encontrada no repositório.
- CSV real recebido e perfilado: 3.078 linhas, sem campos obrigatórios vazios e
  com 14 referências normalizadas repetidas.
- Decisões finais aprovadas: cinco status globais, dois status exclusivos da
  Moriah, fluxo Exclusive sem layout e descarte somente da duplicata integral
  `76029`.
- Os cinco pedidos personalizados de teste foram reconfirmados, seus vínculos
  foram auditados e a exclusão controlada foi concluída e reconciliada no banco
  e no Storage.
- As migrations `20260813164120` e `20260813164134` foram ensaiadas com
  `ROLLBACK`, aplicadas via MCP e confirmadas no histórico remoto.
- O catálogo foi importado com 3.077 produtos ativos e códigos técnicos
  únicos; a duplicata integral `76029` ficou com uma ocorrência.
- APIs, criação, edição de rascunho, busca manual, cards, detalhes, resumos e
  transições foram adaptados por fornecedor.
- A criação passou a iniciar sem fornecedor selecionado: identificação comum
  estável, escolha explícita por botões e troca confirmada que preserva os
  dados comerciais e limpa apenas os dados específicos.
- A regressão focada passou com 21 arquivos e 463 testes; ESLint focado e build
  de produção também passaram.
- A pesquisa Exclusive foi medida em sessão autenticada: o gargalo estava em
  autenticação repetida e consultas auxiliares, não no SQL do catálogo. A rota
  deixou de repetir autenticação/permissão e de carregar unidades; `/opcoes`
  deixou de duplicar a requisição sob Strict Mode.
- Ajuste de UX do novo pedido Exclusive: a barra inferior agora exibe itens e
  total; a identificação foi reordenada para Unidade, Consultora e Número de
  lançamento; falhas de identificação ao salvar destacam todos os campos
  pendentes e focam o primeiro. O novo pedido reutiliza a prévia comercial da
  Moriah, enquanto a gestão preserva o resumo para o fornecedor.

## Diagnóstico vigente

- A seleção do fornecedor não é geral: criação, validação, opções,
  persistência, card, detalhe, resumo e transições estão codificados para
  `moriah_tapetes`.
- O fluxo anterior era `CADASTRADO → AGUARDANDO LAYOUT → AGUARDANDO APROVAÇÃO
  DO CLIENTE → EM PRODUÇÃO → RECEBIDO`. A decisão aprovada substitui
  tecnicamente `CADASTRADO` por `RASCUNHO → VENDA FECHADA` e separa as
  transições posteriores por fornecedor.
- Reutilizar esse fluxo para Exclusive contrariaria a separação de regras do
  pedido; alterar o fluxo sem definição humana mudaria regra de negócio.
- O legado confirma busca manual com mínimo de três caracteres, filtros
  combinados, seleção acumulada, quantidade em linha e total `preço ×
  quantidade`; por decisão posterior, a interface vigente usa paginação de 30
  resultados em vez do limite visual legado de 150.
- O arquivo `salvarPedidos.gs` é uma variante antiga e foi mantido somente como
  evidência histórica.
- A função remota ativa confirmou as dependências Moriah que precisam ser
  preservadas. Depois da limpeza autorizada, não restou pedido personalizado,
  tapete, histórico, anexo ou objeto de Storage pertencente aos cinco testes.
- A modelagem aprovada reutiliza a tabela geral de produtos, adiciona extensão
  1:1 Exclusive e itens históricos com snapshots de preço e custo.

## Próximo passo

Publicar o código da aplicação pelo fluxo normal de deploy para alinhar o
frontend/API de produção ao banco já migrado.

## Pendências

- A interface externa de cadastro de produto no SGI não foi encontrada; nenhum
  botão ou integração fictícia foi criado.
- O código ainda não foi publicado. Como as migrations já estão no banco, o
  deploy da aplicação é a próxima operação recomendada.

## Decisões aguardando aprovação

- Nenhuma decisão de negócio pendente para a fase atual.

## Arquivos principais envolvidos

- `src/components/pedidos-personalizados/`
- `src/lib/pedidos-personalizados/`
- `src/app/api/pedidos-personalizados/`
- `src/app/pedidos-personalizados/`
- `supabase/migrations/20260813164120_pedidos_personalizados_lebebe_exclusive.sql`
- `supabase/migrations/20260813164134_pedidos_personalizados_lebebe_exclusive_funcoes.sql`
- `supabase/tests/pedidos_personalizados_lebebe_exclusive.sql`
- `scripts/importar-catalogo-lebebe-exclusive.mjs`
- `legado-apps-script/`

## Validações já realizadas

- Auditoria local completa do fluxo relacionado.
- Consultas somente leitura no projeto Supabase `lebebe.app` para schema,
  dados, migrations, constraints, índices, RLS, grants, functions e extensões.
- Verificação por SHA-256 de que os três legados permaneceram idênticos depois
  da movimentação.
- Perfil somente leitura do CSV e confirmação remota, via MCP, da função de
  status, fornecedor, produtos, extensões, RLS e grants vigentes.
- Exclusão remota controlada validada: 5 pedidos, 5 tapetes, 5 eventos de
  histórico, 2 registros de anexos e 2 objetos de Storage removidos; zero
  registros remanescentes para os IDs autorizados.
- Ensaio integral das duas migrations em transação com `ROLLBACK` e aplicação
  remota confirmada nas versões `20260813164120` e `20260813164134`.
- Importação reconciliada: 3.078 linhas de origem, 3.077 produtos finais,
  3.077 produtos ativos e uma ocorrência da referência `76029`.
- Grants confirmados: sem `SELECT` para `anon`/`authenticated` e com acesso de
  `service_role`; RLS habilitado sem policies por desenho server-only.
- Fluxo Exclusive real validado em `BEGIN/ROLLBACK`, incluindo snapshots
  imutáveis e `RASCUNHO → VENDA FECHADA → EM PRODUÇÃO → RECEBIDO`;
  zero pedidos permaneceram após o rollback.
- Regressão SQL Moriah validada com anexo e retorno de aprovação para layout;
  o teste transacional versionado passou e terminou com zero pedidos/históricos.
- `npm run test -- --run src/lib/pedidos-personalizados
  src/components/pedidos-personalizados`: 21 arquivos e 463 testes aprovados.
- ESLint focado nos arquivos alterados: aprovado.
- `npm run build`: aprovado. O `tsc --noEmit` isolado continua bloqueado somente
  por erros preexistentes de tipos em `hub-vendas/alertas/teste/route.test.ts`.
- Ajuste de UX da criação: 21 arquivos e 464 testes focados aprovados; ESLint e
  build de produção aprovados. Nenhuma migration, RLS ou regra de negócio foi
  alterada.
- Smoke autenticado da pesquisa Exclusive concluído para coleção (144),
  descrição com limite (150), referência (1), filtros combinados (58) e sem
  resultado (0); Enter disparou uma única requisição.
- MCP: plano SQL aquecido em 11,883 ms para coleção, sem evidência para criar
  índice novo. No navegador, a busca quente caiu de 1.746 ms para 659–907 ms,
  com autenticação/permissão repetida reduzida de 736,80 ms para cerca de
  323–399 ms, unidades de 163,12 ms para 0 ms e permissão para menos de 1 ms.
- Validação focada de performance: ESLint aprovado e 167 testes aprovados. O
  `tsc --noEmit` permaneceu bloqueado apenas pelos erros preexistentes em
  `hub-vendas/alertas/teste/route.test.ts`.
- Ajuste da tabela Exclusive: checkbox e coluna `Selecionar` removidos. A
  quantidade inteira maior que zero é a única fonte de seleção; apagar, zero
  ou valor inválido remove o item imediatamente, preservando o texto de Nome
  ou Letra para posterior preenchimento. Desktop usa sete colunas sem largura
  mínima fixa e mobile usa cartões editáveis. Smoke autenticado confirmou
  quantidade, remoção, total, Mostrar selecionados e responsividade.
- Ajuste complementar de UX: lint focado aprovado e 114 testes focados
  aprovados para a barra inferior, ordem da identificação, validação visual e
  separação entre a prévia comercial do novo pedido e o resumo da gestão.
- Paginação do catálogo Exclusive: a API passou a retornar no máximo 30 itens,
  total exato e total de páginas; a interface permite navegar pelas páginas
  sem perder a seleção acumulada. Lint focado e 173 testes focados aprovados.
- Auditoria de UI/UX da tela de Novo Pedido Personalizado (foco Exclusive) foi
  produzida, aprovada com ajustes e implementada: cabeçalho de identidade
  Lebebe Exclusive (ícone + eyebrow), cabeçalho da seção Produtos, rótulos
  visíveis nos filtros, verde-esmeralda sutil como cor de apoio para item
  selecionado (linha da tabela e card mobile, sem checkbox/coluna nova),
  contraste e hover na tabela, diferenciação visual dos três estados vazios,
  feedback de carregamento na área de resultados (incluindo `Skeleton` na
  primeira busca), indicação clara do modo "Mostrar selecionados" (mantidos
  os dois acessos, um no topo e um no fim da listagem), resumo inline
  reduzido a informação auxiliar com a barra fixa como referência principal,
  e ícone/subtítulo nos dois botões de escolha de fornecedor (compartilhado
  com a Moriah, sem alterar seu comportamento). Nenhuma regra de negócio,
  API, banco ou paginação foi alterada.
- Implementação da auditoria de UI/UX: ESLint focado nos dois arquivos
  alterados aprovado; `npm run test -- --run src/lib/pedidos-personalizados
  src/components/pedidos-personalizados` com 21 arquivos e 474 testes
  aprovados; `tsc --noEmit` sem novos erros (bloqueio remanescente é só o
  preexistente em `hub-vendas/alertas/teste/route.test.ts`); `npm run build`
  aprovado. Smoke visual autenticado não foi possível nesta sessão — o
  usuário logado não possui permissão de módulo para
  `/pedidos-personalizados` e as permissões não foram alteradas para
  viabilizar o teste.
- Correção do erro 422 ao salvar Exclusive: o frontend deixou de propagar o
  estado completo do novo pedido e agora monta uma lista explícita dos campos
  aceitos pela API, impedindo o envio indevido do campo Moriah `tapetes`.
  Validações 422 passaram a retornar caminhos e mensagens por campo/item, com
  log estruturado sem valores pessoais. O fluxo Moriah permaneceu separado.
- Smoke autenticado completo da correção: pedido Exclusive criado como
  `RASCUNHO`, versão 1, exibido na gestão com 1 item, snapshots de venda
  (R$ 569,90) e custo (R$ 249,00) conferidos no banco e na interface. O pedido
  de teste e seu item foram removidos em seguida; a reconciliação final
  confirmou zero registros remanescentes para o identificador usado.
- Validação focada da correção: ESLint aprovado e 177 testes aprovados. O
  `tsc --noEmit` não apontou erro nos arquivos tocados e permaneceu bloqueado
  somente pelos erros preexistentes de Hub/Vendas. O primeiro build ficou
  bloqueado pela restrição de rede ao baixar as fontes Google; repetido com
  acesso de rede, compilou, executou o TypeScript e gerou as 114 páginas com
  sucesso.

## Não refazer

- Não reler `docs/ia/log_progress.md` integralmente.
- Não tratar migrations locais ou memória como estado atual do banco.
- Não tocar nas alterações locais de Hub/Vendas.

## Consultar

- `ESCOPO.md` para requisitos funcionais.
- `PLANO.md` para fases e critérios de aceite.
- `DECISOES.md` para decisões aprovadas.
- `legado-apps-script/` para comportamento anterior.
