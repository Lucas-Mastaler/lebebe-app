# Status — Design System Le Bébé App

## Estado geral

- **Projeto:** Design System Le Bébé App
- **Estado:** `EM_EXECUCAO`
- **Fase atual:** Fase 5.2 — segunda estabilização pós-validação manual, sem
  iniciar telas novas; limitada às quatro rotas apontadas na nova rodada.
- **Design System consolidado:** Brand Foundation, `Section`, `ResponsiveTable`,
  paginação de 20 itens, zebra, sticky opaco, Column Sizing e
  NO-CELL-OVERLAP (D-042 a D-046); `FilterPanel` colapsável
  (`FLT-COLLAPSE=A`), superfície de contraste ajustada (D-049);
  `FormPageContent` para largura interna de páginas de formulário
  (`FORM-PAGE-WIDTH`, D-050); `Select`/`Combobox` na família
  `FORM-CONTROL-SURFACE` e ação "Filtrar" ancorada à direita
  (`FILTER-ACTION-ALIGN=A`, D-051).
- **Estratégia oficial de loading:** `LoadingLeBebe` (institucional),
  `Spinner` (local), `Skeleton`/`SkeletonRows` (estrutura conhecida) e
  `Progress` (progresso real, com `tone` opcional desde D-057), com
  `useDelayedVisibility` para evitar flicker (D-052). **Frente de adoção
  ENCERRADA em 2026-09-16** — ver "Encerramento da frente de loading" abaixo
  para o estado final, exceções deliberadas e backlog não bloqueante.
- **Referências técnicas:** `/chamados-finalizados` e
  `/digisac/finalizacoes-automaticas`.
- **Rodada 5.2 concluída tecnicamente:** a hidratação da Ficha agora parte do
  mesmo `rascunhoId` no servidor e cliente; Registros ganhou subseções
  recolhíveis independentes que preservam o estado montado; MultiSelect usa
  trigger único e Popover portalizado com scroll interno. No histórico real de
  Clientes, a grade implícita do `DialogBody` encolhia seções com
  `overflow-hidden`; a composição local foi corrigida com linhas de conteúdo
  máximo e listas internas limitadas. O `Dialog` compartilhado não precisou
  mudar. A validação manual visual das rotas corrigidas é o próximo passo.

## Encerramento da frente de loading (2026-09-16)

**Estado: CONCLUÍDA.** Nenhum bloqueador conhecido. Não é uma migração total
do projeto — é a oficialização da hierarquia e sua adoção nos casos que
motivaram a auditoria original.

- **Componentes oficiais definidos e em uso:** `LoadingLeBebe` (institucional,
  D-052), `Spinner` (ação local), `Skeleton`/`SkeletonRows` (estrutura
  conhecida — `ui/skeleton.tsx` é o primitivo reaproveitado, `SkeletonRows` a
  abstração de linhas construída sobre ele, D-056), `Progress` (progresso
  real mensurável, com `tone` opcional desde D-057), `useDelayedVisibility`
  (só com justificativa concreta de flicker, nunca por padrão).
- **Casos que validaram a estratégia, todos funcionando:**
  - `/hub-vendas` — loading institucional inicial, piloto original (D-052).
  - `/procurar-datas` — `LoadingLeBebe` na área de resultados durante a
    pesquisa longa, `Spinner` no botão; validado ao vivo em desktop e
    375px (busca real, sem progresso mensurável disponível — `Progress` não
    se aplicava aqui, corretamente não usado).
  - `SyncLotePanel` e `ModalDetalheVenda` (barra de Análise IA) — barra
    manual migrada para `Progress`.
  - `ModalObservacoes` — `Loader2` cru migrado para `Spinner` (16px).
  - `RecebimentoCard` (`src/app/recebimento/PageClient.tsx`) — barra manual
    migrada para `Progress` com a nova prop `tone`, preservando a semântica
    verde/âmbar/cinza (concluído/parcial/vazio); percentual acima de 100%
    continua visível no texto, sem clamp. Validação visual ao vivo não foi
    possível na sessão (conta técnica sem acesso ao módulo); testes
    automatizados verdes, sem regressão de cálculo. **Único item que
    dependia de confirmação visual manual do usuário** — não bloqueia o
    encerramento por ser puramente apresentacional e já coberto por teste.
- **Exceção deliberada:** `/recebimento/[id]` (tela de conferência
  operacional — `PageClient.tsx`, `OSItemCard.tsx`, badge de progresso
  sticky, barras de item/volume) foi **excluída intencionalmente** desta
  frente por decisão do usuário — não é dívida técnica, é escopo definido.
  Não deve ser reaberta nesta frente sem novo pedido explícito.
- **Correção de auditoria registrada:** `ui/skeleton.tsx` não é um Skeleton
  "legado" — é o primitivo oficial reaproveitado (D-056); os cinco usos
  auditados (`ModalDetalheVenda`, `dashboard/PageClient`,
  `GraficoMensagensDigisac`, `procurar-datas/performance`,
  `ModalAgendamentosCliente`) estão corretos e não precisam de migração.
- **Backlog futuro, não bloqueante** (padronizações pontuais, sem
  inconsistência crítica com a hierarquia oficial): `Loader2` cru e SVGs de
  spinner manuais em telas de autenticação, `/superadmin`, `/pos-venda`,
  `Sidebar`, `digisac/finalizacoes-automaticas`, e textos `"Carregando..."`
  soltos em várias telas (mapeados na auditoria ampla). Nenhum deles
  contradiz a hierarquia oficial — são apenas casos ainda não adotados.
  Tratar em tarefas próprias, futuras, sob pedido explícito.

## Processo vigente (a partir de 2026-09-15)

A automação recorrente de fim de semana usada nas execuções anteriores foi
**encerrada pelo usuário**. A Fase 5 continua, mas agora conduzida
**manualmente**: cada novo chat recebe uma única tela e a expectativa é
concluí-la por completo na mesma tarefa (auditoria → implementação →
revisão de hardcodes → testes → QA → documentação), sem dividi-la em
execuções por "pedaço da tela" (filtros/cards/tabelas/modais em tarefas
separadas). `PRONTA_PARA_VALIDACAO_MANUAL` continua sendo o estado técnico
final antes da aprovação do usuário. Uma tela só vira `BLOQUEADA` diante de
impedimento técnico real (decisão indispensável, requisito ambíguo, acesso
obrigatório sem alternativa segura, conflito de código ou dependência
externa) — QA pendente, validação manual pendente ou indisponibilidade
temporária de ambiente/sessão nunca justificam `BLOQUEADA` nem manter
`EM_ANDAMENTO` sem implementação real faltando.

## Fila operacional

| Ordem | Rota | Estado | Próximo passo |
|---:|---|---|---|
| 1 | `/horarios-agendamentos` | PRONTA_PARA_VALIDACAO_MANUAL | QA mobile real pendente de validação manual/sessão disponível. |
| 2 | `/inteligencia-comercial` | PRONTA_PARA_VALIDACAO_MANUAL | Bug real corrigido e refinado (2026-09-15): o corte padrão de 1000 linhas do PostgREST fazia "LEBEBE PORTÃO" desaparecer da lista dinâmica. Filial passou a vir de `FILIAIS_VENDAS_SGI` (`src/lib/sgi/filiais-vendas-sgi.ts`), constante estrita do domínio SGI com as quatro grafias válidas de `sgi_documentos_saida.filial`, não compartilhada com DigiSac; uma filial sem movimento continua disponível para filtro. "LEBEBE DEPÓSITO (CD)" segue fora: é `local_estocagem` por produto, não filial de venda. Operação/status/vendedor continuam derivados dos documentos reais com paginação `.range()`. QA técnico local em 2026-09-16 confirmou as quatro opções, seleção de Portão e 567 vendas sem erro de console; aguarda validação manual. |
| 3 | `/dashboard` | PRONTA_PARA_VALIDACAO_MANUAL | Migração técnica concluída; QA visual manual pendente. |
| 4 | `/hub-vendas` | PRONTA_PARA_VALIDACAO_MANUAL | Migração técnica concluída (D-047); QA visual manual pendente — conta técnica de QA não tem o módulo `hub_vendas_gestao`. |
| 5 | `/pedidos-personalizados` | PRONTA_PARA_VALIDACAO_MANUAL | Migração técnica concluída (gestão + criação, Moriah e Lebebe Exclusive); QA visual manual pendente. |
| 6 | `/atendimento-presencial/ficha` | PRONTA_PARA_VALIDACAO_MANUAL | Hidratação determinística do rascunho corrigida; validar restauração e autosave com rascunho real. |
| 7 | `/atendimento-presencial/registros?tab=finalizados` | PRONTA_PARA_VALIDACAO_MANUAL | Edição passou a ter subseções independentes; validar com registro finalizado real. Correção pontual (2026-09-15): `SelectTrigger` de Consultora não tinha `className="w-full"` — `w-fit` (base do componente `ui/select.tsx`) vencia o `flex-1` do wrapper de `FilterFieldGroup`, deixando o campo estreito ao lado de Cliente; corrigido só nesta tela, mesmo padrão já usado em `/atendimento-presencial/ficha` e `pedidos-personalizados`. |
| 8 | `/atendimento-presencial/clientes` | PRONTA_PARA_VALIDACAO_MANUAL | Histórico real de LUCAS MASTALER permanece aprovado. Nova correção pontual: o `SelectTrigger` de Consultora de origem recebeu `w-full`, para não deixar o `w-fit` da base encolher o controle dentro do `FilterFieldGroup`; QA técnico local confirmou 491,33px para ambos os campos. Aguarda validação manual desta correção. |

Telas `PRONTA_PARA_VALIDACAO_MANUAL` ou `APROVADA` não impedem a próxima
elegível. Apenas uma tela `EM_ANDAMENTO` deve ser retomada; somente o usuário
promove uma tela para `APROVADA`.

**Fila técnica da Fase 5 concluída — aguardando validação visual manual das
telas.** As 8 telas da fila operacional estão todas em
`PRONTA_PARA_VALIDACAO_MANUAL`; nenhuma em `PENDENTE`, `EM_ANDAMENTO` ou
`BLOQUEADA`. Isso encerra só a execução técnica da fila — a Fase 5 não está
funcionalmente encerrada/aprovada pelo usuário, e nenhuma nova fila ou tela
deve ser iniciada sem pedido explícito.

## Última tela concluída — `/inteligencia-comercial`

- Concluídos: shell, filtros manuais, KPIs, tabela principal/paginação,
  sincronização em lote, diálogos, formulários, sections e listagens internas
  do modal, incluindo análise IA com `ResponsiveTable`, `Badge` e `Alert`
  oficiais.
- Preservado: SGI/Digisac, APIs, queries, permissões, cálculos, links de
  protocolo, observações e ações operacionais.
- QA: sessão autenticada local confirmou a tela e o modal em desktop e 375 px;
  a venda real disponível não tinha chamadas de IA. A validação manual
  complementar com linhas de IA reais permanece pendente, sem bloqueio técnico.

## Última tela concluída — `/dashboard`

- Concluído: mini-auditoria focada (rota protegida, cinco componentes, três
  endpoints de leitura, filtros manuais, cards, gráficos e duas tabelas largas);
  `PageContainer`, `PageHeader`, abas segmentadas, filtros oficiais com
  `FilterPanel`/`useFilterState`, `DateField` e `FormField`, KPIs/estados de
  Digisac e todos os gráficos com `KpiCard`, `KpiSection`, `Alert`,
  `EmptyState`, `Card` e tokens oficiais; tabelas de filiais e consultoras
  com `ResponsiveTable`, zebra, coluna inicial sticky, drag horizontal,
  cartões mobile e linha de total preservada.
- QA: tentativa local única em `/dashboard` não abriu porque `localhost:3000`
  recusou a conexão; validação visual manual permanece pendente, sem bloqueio
  técnico.
- Próximo passo: aguardar validação manual do usuário.

## Decisão global mais recente — FORM-PAGE-WIDTH

- Concluído: `FormPageContent` oficial (`w-full max-w-6xl mx-auto`) para
  centralizar somente o conteúdo de páginas predominantemente de formulário;
  `PageContainer` permanece full-width, com seus gutters oficiais.
- Aplicado em `/pedidos-personalizados/novo`: header, Identificação e
  fornecedor compartilham o mesmo eixo de 1152px em desktop largo, sem
  alteração de grids, estado, regras ou APIs.
- QA: lint e 157 testes focados verdes; validação visual local confirmou
  margens equilibradas em desktop, largura natural sem overflow em tablet e
  mobile, e a demo oficial em `/design-system` sem erros de console.
- Próximo passo: aguardar validação manual complementar do usuário.

## Última tela concluída — `/hub-vendas`

- Concluído: `PageContainer`/`PageHeader`; dois `FilterPanel`
  (Período; Filtros de filas e envios — os 3 filtros de listagem que
  disparavam consulta ao mudar campo passaram a `FLT-EXEC=MANUAL`,
  D-047); 15 KPIs em 3 `KpiSection`; `Card`/`Section` (estado da
  automação, alertas/resumo com 3 tons, cards por loja, limite diário);
  `ResponsiveTable` da listagem de filas com card mobile; 3 `Dialog` de
  confirmação (motivo) + modal de detalhe + modal de teste de alerta.
  Extensão genérica em `KpiCard` (`tone`/`detail`/`labelAction`,
  documentada em `components-e-patterns.md`).
- Preservado: todas as APIs/rotas, polling de status, paginação (20,
  backend inalterado), ações manuais por status de fila, link de
  histórico de ticket Digisac, limite diário por loja.
- QA: lint e typecheck sem erros novos; suíte `src/lib/design-system`
  67/67. Tentativa de validação visual real via conta técnica de
  bootstrap bem-sucedida no login, mas bloqueada em `/hub-vendas` por
  `Acesso negado` — o perfil `consultora` da conta técnica não tem o
  módulo `hub_vendas_gestao`. Validação visual completa permanece
  pendente do usuário (não é bloqueio técnico da tela).
- Próximo passo: aguardar validação manual do usuário.

## Última tela concluída — `/pedidos-personalizados`

- Concluído: as duas rotas (`/pedidos-personalizados` gestão e
  `/pedidos-personalizados/novo` criação) e todos os 10 componentes da
  feature — `PageContainer`/`PageHeader`; `FilterPanel`/`FilterFieldGroup`
  para os filtros da gestão (estado próprio preservado, `FilterPanel` usado
  como wrapper visual puro — a semântica exclusiva do chip de status, que
  aplica imediatamente só o campo `status` sem sincronizar outros campos
  ainda não aplicados, foi mantida sem alteração); `Section`/`FormSection`
  para identificação, fornecedor, dados comerciais/administrativos/técnicos
  e agrupamentos de tapete; `Card`/`CardHeader` para os cards de pedido e
  de tapete; `Badge` com vocabulário semântico (`tomStatus`/`tomPrazo`) para
  status e prazo, substituindo o mapeamento de cor ad hoc anterior;
  `ResponsiveTable` para a tabela de itens Lebebe Exclusive (no detalhe e
  na busca de catálogo), com card mobile; `Dialog`/`DialogHeader`/
  `DialogBody` em todos os modais (detalhe do pedido, produto SGI, dados
  administrativos, transição de status, confirmações de anexo/novo
  pedido/troca de fornecedor); `Alert`/`EmptyState`/`Spinner` para
  erro/vazio/carregando; `FormField`/`Input`/DS `Button` em todos os
  formulários.
- Preservado: 100% das regras de negócio — cálculo de área/preço do
  tapete, classificação Catálogo/Personalizado, limite de 6 cores e 10
  tapetes, máscara de telefone, idempotência de criação, fluxo de status e
  transições permitidas (`status-fluxo.ts`), criação/retomada de produto
  SGI, upload/substituição/remoção de anexos com contabilização de
  alteração de layout, paginação, resumo para fornecedor/venda.
- Lacunas/decisões: `type="date"` nativo mantido (não migrado para
  `DateField`) nos campos ligados a payloads administrativos/transição —
  `DateField` trabalha com string `dd/mm/aaaa` e exigiria conversão
  ISO↔BR espalhada por `gestao-modelo.ts`, fora do escopo visual desta
  tarefa; os filtros de data da listagem (efêmeros, sem payload direto)
  poderiam adotar `DateField` numa iteração futura dedicada. Botões de
  alternância (existe no catálogo/idêntico à referência/formato) e os
  cards de escolha de fornecedor continuam como composição local (sem
  equivalente direto no DS, mesmo padrão de "toggle" já usado antes da
  migração).
- Correção no Design System compartilhado: `Button` (`asChild`) quebrava
  com `React.Children.only` sempre que `loading` (default `false`) também
  era passado como filho condicional ao `Slot` — combinação nunca exercida
  antes desta tela (as duas telas que já usavam `asChild` importavam o
  `Button` antigo de `ui/button.tsx`). Corrigido para só compor
  spinner+children quando `asChild` é falso; sem mudança de comportamento
  para nenhum uso existente (suíte de 67 testes de `design-system`
  continua verde).
- Correção pontual: `BarraResumoPedidoPersonalizado` (barra fixa de
  itens/total/ações) estourava horizontalmente a 375px quando os três
  botões (selecionados/novo pedido/salvar) apareciam juntos — bug
  pré-existente à migração, só visível ao testar o fluxo Lebebe Exclusive
  em mobile. Corrigido com `flex-wrap`.
- QA: lint e `tsc --noEmit` sem erros novos nas duas telas; suíte de
  `pedidos-personalizados`/`design-system` 565/565 (2 asserts de "código
  fonte literal" desatualizados pelo refactor de nomes/markup —
  `classeStatus`→`tomStatus`, tabela HTML→`ResponsiveTable` — foram
  atualizadas para verificar o comportamento equivalente, não removidas).
  Sessão autenticada real confirmou listagem, filtros, chips, cards,
  detalhe (Moriah e Lebebe Exclusive), formulário de criação (ambos
  fornecedores) e responsividade em 375px (sem overflow de página,
  `ResponsiveTable` alterna para cards) — a única limitação da sessão de
  QA foi a Sidebar do app sobrepor visualmente o conteúdo em 375px neste
  ambiente de preview, comportamento do shell global (`Sidebar`/
  `LayoutWrapper`), não desta tela, e confirmado sem relação por medição
  direta de `scrollWidth`.
- Atualização (mesma tarefa, D-049): incorporadas duas decisões globais
  novas no `FilterPanel` compartilhado — painel de filtros colapsável
  (`FLT-COLLAPSE=A`, inicia expandido, nunca se recolhe sozinho) e
  contraste de superfície levemente ajustado
  (`border-sky-100 bg-sky-50/40` → `border-sky-200 bg-sky-50/70`).
  Validado em `/pedidos-personalizados` (expandir/recolher/reabrir, sem
  quebrar campos/responsividade) e regressão conferida ao vivo em
  `/chamados-finalizados` e `/dashboard`; `/hub-vendas` e `/design-system`
  confirmados por leitura de código + suíte de testes (conta desta sessão
  sem acesso a essas rotas — mesma limitação de D-047).
- Próximo passo: aguardar validação manual do usuário.

## Última tela concluída — `/atendimento-presencial/ficha`

- Concluído: mini-auditoria (formulário wizard de 3 etapas — Ficha, Resultado,
  Revisão — com rascunho autosave, busca/cadastro de cliente, uma ou mais
  crianças, departamentos, produtos de interesse em texto livre, motivos de
  resultado e conclusão); `PageContainer`/`PageHeader`/`FormPageContent`
  (largura de leitura de 48rem preservada via `className`, mais estreita que
  o padrão de 72rem de `FORM-PAGE-WIDTH` — este wizard é uma coluna única
  mobile-first, não um formulário de grade 2-3 colunas); `Section` (CLR=B/
  SEC=C) ciclando entre os 3 tons oficiais no lugar das 6 cores ad hoc que a
  tela tinha antes (LACUNA DE DESIGN SYSTEM: `Section` só tem 3 tons);
  `FormField`/`Input`/`Textarea`/`Select` (`FORM-CONTROL-SURFACE`, D-051)/
  `DateField` (campo de data prevista de nascimento, compatível com
  dd/mm/aaaa) em todos os campos de texto/data/seleção; `Card`/`CardContent`
  para o cartão de cliente vinculada, "Nova cliente" e cada criança; `Badge`
  para o indicador de sincronização (`StatusSync`); `Alert` para banners de
  erro/aviso/sucesso; `Spinner` para os estados de carregamento; `Dialog`/
  `DialogHeader`/`DialogBody` no modal de histórico da cliente
  (`HistoricoClienteModal`, compartilhado com `/atendimento-presencial/
  registros` e `/clientes` — migração estrutural do próprio Dialog, sem
  alterar essas duas telas ainda pendentes).
- Preservado: barra fixa de navegação Voltar/Continuar/Concluir em todos os
  breakpoints (não usa `MobileActionBar`, que é `md:hidden` — LACUNA: sem
  padrão oficial para barra de ação de wizard visível em toda largura);
  `OpcaoButton` (grade de opções tipo toggle) como composição local, mesmo
  padrão já aceito em `/pedidos-personalizados`; autosave, fila de
  sincronização, validação por etapa, criação/conclusão de rascunho, busca e
  cadastro de cliente, histórico, telefone rápido — nenhuma API, regra de
  negócio ou payload alterado.
- Correção de bug real encontrada durante o QA mobile (não pré-existente à
  migração): os dois botões de ação do `PageHeader` ("Novo Atendimento"/"Ver
  rascunhos") causavam overflow horizontal a 375px porque o slot `action` do
  `PageHeader` é sempre `flex` em linha — o wizard precisava do empilhamento
  vertical em mobile que a tela original tinha. Corrigido envolvendo os dois
  botões num wrapper `flex-col sm:flex-row` dentro do próprio `action`.
- QA: lint e `tsc --noEmit` sem erros novos; suíte `design-system`/
  `atendimento-presencial` 201/201. Sessão local autenticada (dev server já
  logado pelo usuário) confirmou o fluxo completo — seleção de unidade,
  criação de rascunho (status `Salvo`), campo de consultora, busca de
  cliente, `Select`/`DateField` da criança (máscara `dd/mm/aaaa` testada) —
  em desktop e 375px, sem overflow horizontal (`scrollWidth`=`clientWidth`
  medido antes e depois da correção acima) e sem erros no console.
- Próximo passo: aguardar validação manual do usuário.

## Última tela concluída — `/atendimento-presencial/registros?tab=finalizados`

- Concluído: mini-auditoria (rota compartilhada por duas abas — `finalizados`
  e `rascunhos` — controladas por `?tab=` e `checkModuleAndWindowAccess`
  independentes; a aba `finalizados` é uma listagem master-detail em cards,
  não uma `ResponsiveTable` — não havia tabela operacional para migrar, então
  o layout de dois painéis foi preservado); `PageContainer`/`PageHeader`;
  `SegmentedTabsList`/`SegmentedTabsTrigger` nas duas abas, preservando nome,
  estado ativo, query param e navegação; `FilterPanel`/`useFilterState`/
  `FilterFieldGroup`/`FormField` para os filtros da aba `finalizados`
  (Cliente, Consultora via `Select` `FORM-CONTROL-SURFACE`, Virada do cartão
  De/Até) — estado próprio de draft/`clienteNomeAplicado` substituído pelo
  hook oficial, mesma semântica de filtro manual (o botão de busca já disparava
  a consulta manualmente antes da migração, então não houve mudança de
  comportamento, só a estrutura); `Card`/`CardHeader`/`CardContent` na lista de
  concluídos, no painel de detalhe e nos cards de rascunho; `Badge` (`tone`
  `warning`) no chip "Rascunho"; `EmptyState` (lista vazia de registros/
  rascunhos) e `Spinner` (carregando lista/detalhe/rascunhos); `Alert` (erro
  de carregamento, mensagem de edição salva, motivo de bloqueio de edição);
  modal "Editar atendimento" migrado para `Dialog`/`DialogHeader`/`DialogBody`
  com `FormField`/`Input`/`Select`/`DateField`/`Textarea` e `OpcaoButton` local
  (mesmo padrão local já aceito em `/atendimento-presencial/ficha` e
  `/pedidos-personalizados`) — campo de data prevista de nascimento da criança
  passou a usar o `DateField` oficial (mesma função de conversão `dd/mm/aaaa`
  ↔ ISO já usada na Ficha, sem qualquer novo formato).
- Reaproveitado sem alteração: `HistoricoClienteModal` (compartilhado com
  `/atendimento-presencial/ficha`, já migrado para `Dialog`/`Badge`/`Alert`
  oficiais numa tarefa anterior) — consumido como está, nenhuma nova migração
  feita nele nesta tarefa.
- Preservado: as duas verificações de acesso (`atendimento_presencial_registros`/
  `atendimento_presencial_ficha`), toda a lógica de carregamento/detalhe/edição/
  rascunhos, validação de ficha, payload de edição PATCH, máscaras de virada do
  cartão e nome da criança, janela de permissão de edição (`podeEditar`/
  `motivoBloqueio`), paginação e contagem de consultoras devolvidas pela API,
  navegação para `/atendimento-presencial/ficha?rascunho=` — nenhuma API, regra
  de negócio, query ou permissão alterada. A chip "Venda fechada?" nos cards
  manteve o mesmo composto visual local (label + valor) já usado e aprovado em
  `HistoricoClienteModal`, por ser um par label/valor de duas linhas sem
  equivalente direto em `Badge` (pílula de uma linha).
- QA: `npx eslint` no arquivo alterado sem problemas; `tsc --noEmit` sem erros
  novos (baseline preexistente inalterado); suíte `design-system`/
  `atendimento-presencial` 201/201. Sessão local autenticada (dev server já
  logado pelo usuário) confirmou ao vivo em `/atendimento-presencial/
  registros?tab=finalizados`: listagem real de atendimentos concluídos,
  abertura de detalhe (departamentos/produtos/motivos/crianças/observações/
  histórico), `HistoricoClienteModal` abrindo e carregando dados reais, modal
  "Editar atendimento" abrindo corretamente tanto para registro sem permissão
  de edição (mensagem de bloqueio) quanto a navegação para a aba `Rascunhos`
  (cards reais, badge, "Continuar atendimento"), aplicar/limpar filtro por
  nome (lista reduzida e restaurada corretamente), sincronização da URL
  (`?tab=rascunhos`) e responsividade em 375px (`scrollWidth`=`clientWidth`,
  sidebar sobreposta é limitação já registrada do shell global, não desta
  tela) sem erros no console. Não foi possível localizar, nos dados reais
  disponíveis nesta sessão, um registro dentro da janela de edição
  (`podeEditar=true`) para validar visualmente o formulário completo do modal
  de edição preenchido — a mesma composição de campos (`Select`/`DateField`/
  `OpcaoButton`) já está validada visualmente em `/atendimento-presencial/
  ficha`; sem bloqueio técnico, fica registrado como validação manual
  complementar.
- Próximo passo: aguardar validação manual do usuário (em especial o
  preenchimento do modal de edição com um atendimento dentro da janela de
  edição).

## Última tela concluída — `/atendimento-presencial/clientes`

- Concluído: mini-auditoria (rota simples de uma seção — busca/listagem de
  clientes em cartões, sem tabela operacional, mais um formulário de
  cadastro rápido ao lado; sem painel de detalhe/seleção — a única "ação de
  detalhe" é o histórico já compartilhado); `PageContainer`/`PageHeader`;
  `FilterPanel`/`useFilterState`/`FilterFieldGroup`/`FormField` para busca
  por nome/telefone + `Select` de consultora de origem; `Card`/
  `CardHeader`/`CardContent`/`CardFooter` para a listagem (cartão aninhado
  por cliente, mesmo padrão de `/atendimento-presencial/registros`);
  `Badge` (`tone="success"`) no indicador "telefone encontrado";
  `EmptyState`/`Spinner`/`Alert` para vazio/carregando/erro/sucesso;
  `Button loading` no cadastro; `OpcaoButton` local para os 13 botões de
  parentesco (mesma composição aceita em `/ficha` e `/registros`).
- Reaproveitado sem alteração: `HistoricoClienteModal` (compartilhado com
  `/atendimento-presencial/ficha` e `/registros`, já migrado numa tarefa
  anterior) — consumido como está.
- Mudança de comportamento registrada (D-053): a consultora de origem
  deixou de disparar a busca imediatamente ao trocar de valor — unificada
  no mesmo `FilterPanel` do campo de nome/telefone (já manual), passou a
  exigir o clique em "Filtrar", alinhando com `FLT-EXEC=MANUAL` (mesmo
  ajuste já feito em `/hub-vendas`, D-047). Nenhuma API, query ou payload
  foi alterado — só o gatilho da mesma chamada.
- Preservado: as duas APIs de clientes (busca/listagem e cadastro),
  paginação manual (20 por página), validação de cadastro, máscara de
  telefone, resolução de cliente existente por telefone, verificação de
  acesso ao módulo `atendimento_presencial_clientes`.
- QA: `npx eslint`/`tsc --noEmit` sem erros novos no arquivo; suíte
  `design-system` 67/67. Sessão local autenticada (dev server já logado
  pelo usuário) confirmou ao vivo: listagem real (90 clientes/5 páginas),
  filtro aplicado/limpo, paginação, `HistoricoClienteModal` com dado real,
  toggle de parentesco (incluindo campo condicional "Complemento"), e
  responsividade em 375px sem overflow horizontal (sobreposição da Sidebar
  fixa é a mesma limitação já registrada do shell global, não desta tela) —
  sem erros de console. Não foi submetido cadastro real de cliente durante
  a QA (evitar gravação permanente no banco real) — fica como validação
  manual complementar, sem bloqueio técnico.
- Próximo passo: aguardar validação manual do usuário. Com esta tela, a
  fila técnica da Fase 5 está encerrada (ver aviso na seção "Fila
  operacional" acima) — nenhuma nova tela deve ser iniciada sem pedido
  explícito do usuário.

## Referências

- [PLANO.md](PLANO.md) — fases e ordem da fila.
- [DECISOES.md](DECISOES.md) — decisões D-042 a D-046.
- [ESCOPO.md](ESCOPO.md) — contrato do projeto.
- [Foundations](../../design-system/foundations.md),
  [components e patterns](../../design-system/components-e-patterns.md) e
  [interaction standards](../../design-system/interaction-standards.md).
