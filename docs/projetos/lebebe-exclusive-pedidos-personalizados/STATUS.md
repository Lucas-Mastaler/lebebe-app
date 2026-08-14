# Status — Lebebe Exclusive em Pedidos Personalizados

Projeto: lebebe-exclusive-pedidos-personalizados
Estado: EM EXECUÇÃO
Fase atual: Operação controlada da integração SGI — aguardando deploy e pedido elegível

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
- As migrations `20260814170000`, `20260814170100` e `20260814170200` foram
  ensaiadas com `ROLLBACK`, aplicadas via MCP e confirmadas no Supabase: tabela
  1:1 server-only, RPCs idempotentes de solicitação/claim/checkpoint e token do
  worker armazenado somente como hash.
- A Gestão ganhou ação SGI exclusiva para Lebebe Exclusive, no card e no
  detalhe, com confirmação dos valores congelados, polling, erro seguro e retry.
- O worker outbound foi instalado na VPS sem porta pública e com secret Docker;
  permanece com zero réplicas até o App ser publicado e haver pedido elegível.

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

Publicar o App na aplicação Vercel existente, confirmar as novas rotas e então
ativar uma única réplica do worker. Com um pedido Lebebe Exclusive em `VENDA
FECHADA` e lançamento válido, executar exatamente um teste real controlado.

## Pendências

- O modelo `39879` foi validado por leitura com código `21187` e nome esperado.
- Não existe hoje pedido Exclusive em `VENDA FECHADA`; o teste SGI real depende
  de surgir/criar de forma controlada um pedido elegível.
- O código ainda não foi publicado na aplicação Vercel existente. Por isso o
  worker segue inativo e a confirmação visual autenticada das novas ações está
  pendente.

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
- Regra de fechamento revisada: todo pedido exige número de lançamento válido
  ao passar de `RASCUNHO` para `VENDA FECHADA`. A Lebebe Exclusive pode editar
  os dados comerciais durante `VENDA FECHADA`, até entrar em produção. A
  migration `20260813203717` foi ensaiada com `ROLLBACK`, aplicada no Supabase
  e validada em transação sem deixar pedido de teste.
- Auditoria de UI/UX da tela de Gestão (`/pedidos-personalizados`) foi
  produzida, aprovada com ajustes e implementada — Fase 1 (lista): chips de
  contagem por status (fonte única `opcoes.status`, sincronizados com o
  dropdown existente), reorganização visual dos 13 filtros em três grupos
  (Busca/Classificação/Datas) sem remover nenhum campo, destaque de
  previsão/prazo no card (borda lateral + linha própria, reaproveitando
  `classePrazo`), paginação numerada reaproveitando
  `paginasVisiveisLebebeExclusive`, e diferenciação dos estados vazios
  (nenhum pedido cadastrado vs. nenhum resultado para os filtros) e do
  carregamento (mantém a lista anterior visível e esmaecida durante
  atualização, em vez de apagar a tela). Nenhuma regra de transição, validação
  administrativa ou diálogo existente foi alterado.
- Para os contadores, foi adicionado `GET
  /api/pedidos-personalizados/pedidos/contagem-status`, que conta pedidos por
  status em uma única requisição autenticada (consultas `head: true` por
  status, sem hidratar tapetes/itens/histórico), evitando repetir
  autenticação/permissão por status. Nenhuma migration, RLS ou tabela nova foi
  criada; a mesma tabela e os mesmos filtros já usados pela listagem foram
  reaproveitados.
- Fase 2 (Kanban) não foi implementada nesta rodada: a infraestrutura de dados
  (endpoint de contagem por status) já foi construída e é reaproveitável, mas
  a view em colunas, os cards compactos e a integração com o diálogo
  `Alterar status` ficaram para uma etapa futura, com recomendação técnica
  registrada na entrega — decisão feita dentro da permissão explícita do
  pedido para parar antes do Kanban se a complexidade não estivesse adequada
  para a mesma rodada da Fase 1.
- Validação: ESLint aprovado nos 7 arquivos alterados/criados; `npm run test
  -- --run src/lib/pedidos-personalizados src/components/pedidos-personalizados`
  com 21 arquivos e 484 testes aprovados (8 novos, cobrindo a contagem por
  status no repositório e no handler); `tsc --noEmit` sem novos erros; `npm
  run build` aprovado, incluindo a nova rota na saída do build. Smoke visual
  autenticado não foi possível nesta sessão pelo mesmo motivo já registrado
  (sem permissão de módulo na sessão local; permissões não alteradas).

- Ajustes de UI/UX pós-teste com usuários reais (2026-08-14): (1) coluna de
  ação com botão X (ícone Lucide, tooltip + `aria-label` "Remover produto",
  alvo de toque `size-11`) ao final de cada linha/card de produto selecionado
  em `FormularioLebebeExclusive`, reaproveitando a remoção já existente
  (limpar quantidade preservando Nome ou Letra); (2) destaque do botão
  Filtrar quando há filtro pendente (anel de foco persistente + animação
  `animate-in zoom-in-95` de um único disparo só na transição
  nenhum→pendente, sem loop) com texto "Filtro preenchido — clique em
  Filtrar" que some após buscar ou apagar os campos, e texto reforçando que
  cada campo funciona sozinho; Enter já disparava a busca (nenhuma mudança
  necessária). (3) e (4): modal "Alterar status" passou a mostrar a
  transição Origem → Destino com ícone de seta, e o botão de confirmação
  usa o rótulo contextual "Avançar para {destino}" quando o destino
  selecionado é o primeiro da lista de `destinosPermitidosStatus` (o
  caminho principal); outras transições (ex. Cancelado) mantêm "Confirmar
  transição". Quando a transição é RASCUNHO → VENDA FECHADA, o modal exibe
  o campo Número de lançamento (pré-preenchido se já existir) sem exigir
  sair para editar dados comerciais.
- Número de lançamento no modal de status foi resolvido só no frontend, sem
  mudança de backend: ao confirmar, se o número informado no modal diverge
  do já persistido, o componente reutiliza a mesma rota
  `PATCH /pedidos/[id]/comercial` e os mesmos payloads já usados pela edição
  de dados comerciais (`payloadAtualizacaoComercial` + `detalheParaFormulario`
  para Moriah; `montarPayloadLebebeExclusive` reaproveitado de
  `FormularioLebebeExclusive` para Exclusive, remontando os itens a partir de
  `detalhe.itens`) — não existe um segundo campo nem uma segunda fonte de
  verdade. Só depois de confirmar essa gravação (usando a nova `version`
  retornada) o componente chama a transição de status existente. Se a
  gravação do lançamento falhar, a transição não é tentada. Se a gravação
  tiver sucesso mas a transição falhar depois, o detalhe é recarregado do
  servidor (não só em 409) para refletir o lançamento já salvo sem duplicar
  estado local desatualizado.
- Validação: ESLint focado nos 3 arquivos alterados aprovado; `npm run test
  -- --run src/lib/pedidos-personalizados src/components/pedidos-personalizados`
  com 21 arquivos e 487 testes aprovados (sem teste novo — mudança reaproveitou
  infraestrutura existente sem alterar contratos testados); `tsc --noEmit`
  sem novos erros (bloqueio remanescente é só o preexistente em
  `hub-vendas/alertas/teste/route.test.ts`); `npm run build` aprovado. Smoke
  visual autenticado não foi possível nesta sessão pelo mesmo motivo já
  registrado (sessão local sem permissão de módulo para
  `/pedidos-personalizados`; permissões não foram alteradas).

- Complemento de status na Gestão (2026-08-14): a regra de "campo obrigatório
  ausente" deixou de ser hardcoded para RASCUNHO → VENDA FECHADA. Foi extraída
  para `camposComerciaisPendentesTransicao(pedido, destino)` em
  `gestao-modelo.ts` — fonte única usada tanto por `requisitosPendentesTransicao`
  quanto pelo componente da Gestão para decidir quando mostrar o campo Número
  de lançamento no modal. Investigação confirmou que, hoje, esse é o único
  campo obrigatório que vive fora do payload de transição (dados comerciais);
  os demais campos obrigatórios por transição (pedido de compra, data ao
  fornecedor, comprador, data de entrega, data de recebimento, justificativa)
  já fazem parte do próprio payload de `transicionarStatusGestao` e já tinham
  campo no modal — não precisaram de mudança. Anexo (Moriah) continua fora
  desse mecanismo por natureza (upload de arquivo, não campo de texto) e
  mantém sua pendência informativa já existente.
- Alteração de status ficou acessível direto do card da listagem, sem abrir
  `Ver pedido`: novo botão `BotaoAvancoStatus` (reaproveitado também no botão
  que já existia dentro do pedido, substituindo o rótulo genérico "ALTERAR
  STATUS") mostra o rótulo contextual "Avançar para {destino}" com ícone de
  seta (Lucide `ArrowRight`) quando existe um único caminho "para frente" além
  de Cancelado, ou "Alterar status" quando há mais de um caminho possível (ex.
  Aguardando aprovação do cliente). A progressão aparece no próprio botão-
  gatilho, antes de abrir o modal — não só depois, dentro dele. O card usa o
  botão em variante sólida (mais destaque que o outline "Ver pedido") e
  posicionado acima dele.
  Reutiliza o mesmo modal oficial (`alterandoStatus`/`transicao`): ao clicar
  no atalho do card, o pedido é carregado (mesma `carregarDetalheGestao` já
  usada por "Ver pedido") e o modal abre diretamente, sem abrir o diálogo
  grande de detalhe — controlado por um novo estado `transicaoOrigemCard` que
  suprime a abertura do diálogo de detalhe e, ao fechar (cancelar ou
  confirmar), limpa o `detalhe` para voltar limpo à listagem. Quando aberto de
  dentro de "Ver pedido" (fluxo já existente), o comportamento de fechamento
  não mudou.
- Validação do complemento: ESLint focado aprovado; `tsc --noEmit` sem novos
  erros; `npm run test -- --run src/lib/pedidos-personalizados
  src/components/pedidos-personalizados` com 21 arquivos e 487 testes
  aprovados (nenhum teste quebrou; nenhum teste novo foi necessário porque a
  mudança reaproveitou funções e payloads já cobertos); `npm run build`
  aprovado. Smoke visual autenticado novamente não foi possível nesta sessão
  pela mesma restrição de permissão de módulo já registrada; permissões não
  foram alteradas.
- Correção do `422` Moriá na transição `RASCUNHO → VENDA FECHADA`: a causa
  confirmada foi a serialização da ordem global do catálogo (`1/15/29`) no
  lugar da ordem da seleção (`1/2/3`). O payload comercial agora envia apenas
  `id` e a ordem sequencial escolhida. A interface exibe os itens de
  `problemas` retornados pela API e a rota registra fornecedor, código e campos
  inválidos sem valores pessoais.
- O fluxo intermediário `PATCH /comercial` seguido de `POST /status`, descrito
  acima, foi substituído no código por uma única chamada de status. A migration
  nova substitui a assinatura antiga da RPC por uma assinatura única com o
  número de lançamento e preserva o corpo vigente da transição na mesma função,
  evitando tanto persistência parcial quanto sobrecarga incompatível com o
  PostgREST. O mesmo contrato é usado por Moriá e Lebebe Exclusive.
- Validação desta correção: 21 arquivos e 491 testes passaram; ESLint focado
  passou sem avisos; o teste SQL completo dos dois fornecedores passou no
  Supabase dentro de `BEGIN/ROLLBACK` e confirmou ausência de persistência
  parcial. `npm run build` passou após permitir o download das fontes Geist.
  `npx tsc --noEmit` não apontou erro no fluxo e segue bloqueado somente pelos
  erros preexistentes de Hub/Vendas. O pedido Moriá observado permaneceu em
  `RASCUNHO`, versão 2 e sem lançamento após todos os ensaios.
- Tentativa real do usuário em 2026-08-14 confirmou o gate: o endpoint Next
  retornou `500`, enquanto os logs do Supabase registraram `POST 404` para
  `/rest/v1/rpc/transicionar_pedido_personalizado`. O banco ainda expõe somente
  a assinatura antiga de 9 parâmetros; o código já envia 10. A migration foi
  refeita para `DROP/CREATE` transacional da assinatura única, sem dependências
  registradas no catálogo. Os testes SQL `lebebe_exclusive` e `fase_5c`
  passaram com `BEGIN/ROLLBACK`.
- A substituição remota foi autorizada e aplicada em 2026-08-14 como migration
  `20260814160620_pedidos_personalizados_transicao_lancamento_atomica`. O banco
  expõe somente a nova assinatura de 10 parâmetros; `service_role` possui
  `EXECUTE`, enquanto `anon` e `authenticated` não possuem. Um teste seguro
  pelo PostgREST, com versão propositalmente inválida, encontrou a RPC e
  retornou `P0003 / CONFLITO_VERSAO`, confirmando que o 404 de assinatura foi
  removido sem alterar dados. O pedido permaneceu em `RASCUNHO`, versão 2 e
  `numero_lancamento` nulo. O smoke real pela interface continua pendente.

## Não refazer

- Não reler `docs/ia/log_progress.md` integralmente.
- Não tratar migrations locais ou memória como estado atual do banco.
- Não tocar nas alterações locais de Hub/Vendas.

## Consultar

- `ESCOPO.md` para requisitos funcionais.
- `PLANO.md` para fases e critérios de aceite.
- `DECISOES.md` para decisões aprovadas.
- `legado-apps-script/` para comportamento anterior.
