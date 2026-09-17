# Status — Design System Le Bébé App

## Estado geral

- **Projeto:** Design System Le Bébé App
- **Estado:** `EM_EXECUCAO`
- **Fase atual:** Fase 5.2 — segunda estabilização pós-validação manual, sem
  iniciar telas novas; limitada às quatro rotas apontadas na nova rodada.
  Em paralelo, a Fila 2 (auditoria de 2026-09-16) está tecnicamente
  concluída desde 2026-09-17, incluindo `/recebimento` (rota raiz),
  migrada por autorização explícita do usuário sem esperar a aprovação
  prévia das telas 1-10 — ver "Fila 2" abaixo.
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

## Fila 2 — auditoria inicial (2026-09-16, sem implementação)

Auditoria somente de leitura das 11 rotas indicadas para a próxima fila
(nenhuma tela alterada, nenhuma migração iniciada). `PENDENTE` é o estado
inicial de todos os itens abaixo.

| Ordem | Rota | Classificação | Estado | Justificativa resumida |
|---:|---|---|---|---|
| 1 | `/agendamentos` | BAIXA | PRONTA_PARA_VALIDACAO_MANUAL | Já usava `PageContainer`/`PageHeader`/`Tabs`/`FilterPanel`/`FormField`/`DateField`/`ResponsiveTable`/`KpiCard`/`Badge`/`Dialog`/`EmptyState`; zero cor hardcoded. Único ajuste técnico encontrado: os 4 `SelectTrigger` de `FiltrosAgendamentos.tsx` (Filial/Atendente/Status/Possui conversa aberta) não tinham `className="w-full"` — mesmo bug de `w-fit` (base `ui/select.tsx`) vencendo o `flex-1` do wrapper de `FilterFieldGroup` já corrigido em `/atendimento-presencial/clientes` e `/registros`. Corrigido só nesses 4 triggers. Aguarda validação manual. |
| 2 | `/atendimento-presencial/clientes` | BAIXA | PRONTA_PARA_VALIDACAO_MANUAL | Verificação nesta sessão (2026-09-16): o `SelectTrigger` de "Consultora de origem" (`PageClient.tsx`, linha 227) **já tinha** `className="w-full"` — correção já presente no código real (aplicada junto com a migração da tela, comitada em `1ab0a3f`), a nota de "pendente" na auditoria da Fila 2 estava desatualizada em relação ao código. Nenhum arquivo alterado nesta sessão; `npx eslint` no arquivo sem problemas. Nenhum outro `SelectTrigger` na tela. Aguarda validação manual apenas para confirmar visualmente a largura do campo (mesma pendência residual de sempre, não uma regressão nova). |
| 3 | `/pos-venda/importar-nfe` | BAIXA | PRONTA_PARA_VALIDACAO_MANUAL | Migração técnica concluída (2026-09-16): `PageContainer`/`FormPageContent` (largura preservada em `max-w-3xl`, mesmo padrão de override já usado em `/atendimento-presencial/ficha`); `PageHeader` no lugar do título manual; `Card`/`CardHeader`/`CardContent` no formulário, no resumo, na query Gmail e na lista de NFs; `FormField`/`DateField` nas duas datas (antes `<input type="date">` nativo — conversão de payload para a API, que exige `YYYY-MM-DD`, feita com `dateToIso`/`parseBrDate` de `src/lib/design-system/dates.ts`, sem mudar o contrato da rota); `KpiCard` nos 4 blocos de estatística (`tone="success"`/`"danger"` semânticos); `Alert` no erro de validação/requisição e no bloco de erros da importação; `EmptyState` para "nenhuma NF encontrada"; `Button`/`LoadingLeBebe` (verificação de acesso) oficiais no lugar do `Loader2`/classes hardcoded. Cor de marca hardcoded (`#00A5E6`/`#0090cc`) eliminada — substituída pelos tokens `primary` já usados pelos componentes do DS. Lista de NFs com `<details>` por item mantida como composição local (sem equivalente direto no DS), mesmo padrão de composição já aceito em outras telas da fila. |
| 4 | `/pos-venda/atendimento-automatico` | MÉDIA | PRONTA_PARA_VALIDACAO_MANUAL | Migração técnica concluída (2026-09-16) — ver "Última tela concluída — Fila 2 — `/pos-venda/atendimento-automatico`" abaixo. |
| 5 | `/procurar-datas/performance` | MÉDIA | PRONTA_PARA_VALIDACAO_MANUAL | Migração técnica concluída (2026-09-16) — ver "Última tela concluída — Fila 2 — `/procurar-datas/performance`" abaixo. |
| 6 | `/configuracoes/procurar-datas` | MÉDIA/ALTA | PRONTA_PARA_VALIDACAO_MANUAL | Migração técnica concluída (2026-09-16) — ver "Última tela concluída — Fila 2 — `/configuracoes/procurar-datas`" abaixo. |
| 7 | `/procurar-datas/auditoria` | ALTA | PRONTA_PARA_VALIDACAO_MANUAL | Migração técnica concluída (2026-09-16) — ver "Última tela concluída — Fila 2 — `/procurar-datas/auditoria`" abaixo. |
| 8 | `/procurar-datas` | ALTA | PRONTA_PARA_VALIDACAO_MANUAL | Migração técnica concluída (2026-09-16) — ver "Última tela concluída — Fila 2 — `/procurar-datas`" abaixo. |
| 9-10 | `/superadmin?tab=usuarios` + `/superadmin?tab=auditoria` | ALTA | PRONTA_PARA_VALIDACAO_MANUAL | Migração técnica concluída (2026-09-16) — ver "Última tela concluída — Fila 2 — `/superadmin` (abas Usuários + Auditoria)" abaixo. |
| 11 | `/recebimento` (rota raiz, não `/recebimento/[id]`) | CRÍTICA | PRONTA_PARA_VALIDACAO_MANUAL | Bloqueio de 2026-09-16 levantado em 2026-09-17 por autorização explícita do usuário (pedido direto para migrar esta rota nesta sessão, endereçando os mesmos pontos de risco já registrados aqui — proteção de `[id]`, preservação funcional, timer/volumes — sem exigir aprovação prévia das 10 telas anteriores). Migração técnica concluída — ver "Última tela concluída — Fila 2 — `/recebimento` (rota raiz)" abaixo. |

**FILA 2 CONCLUÍDA TECNICAMENTE.** Os 11 itens (incluindo `/recebimento`,
rota raiz, migrado em 2026-09-17 por autorização explícita do usuário —
ver tabela acima) estão em `PRONTA_PARA_VALIDACAO_MANUAL`. Nenhum item está
`PENDENTE`, `EM_ANDAMENTO` ou `BLOQUEADA`. Aguardando validação visual
manual do usuário para todos os 11 itens; nenhuma nova fila deve ser
iniciada sem pedido explícito.

### Ordem técnica recomendada para a futura execução automática

1. `/agendamentos`
2. `/atendimento-presencial/clientes` (ajuste pontual)
3. `/pos-venda/importar-nfe`
4. `/pos-venda/atendimento-automatico`
5. `/procurar-datas/performance`
6. `/configuracoes/procurar-datas`
7. `/procurar-datas/auditoria`
8. `/procurar-datas`
9. `/superadmin` (abas `usuarios` + `auditoria` juntas, mesmo arquivo)
10. `/recebimento` (rota raiz) — sempre por último

Critério: começar pelas telas pequenas e previsíveis (1-3), avançar para
telas médias com padrões já validados em fila anterior (4-6), consolidar o
aprendizado nas telas mais densas de `/procurar-datas` antes da tela
principal do motor (7-8), só então entrar em telas com gatilho de risco
elevado por padrão — permissões (9) e Recebimento (10, sempre por último,
após o processo já estar validado nas telas anteriores).

### Observação separada — divergência funcional (não corrigir aqui)

Nenhuma divergência funcional de regra de negócio, cálculo, ranking,
classificação, OSRM/Haversine ou equivalência com o legado Apps Script foi
identificada durante esta auditoria (que foi só de leitura de tamanho/
estrutura/uso de componentes, não uma reconferência de equivalência linha a
linha com `docs/procurar-datas-escopo-equivalencia-legado-v2.md`).

## Última tela concluída — Fila 2 — `/pos-venda/importar-nfe`

- Concluído: mini-auditoria (rota simples de 1 arquivo — formulário de
  período + 4 blocos de estatística + lista de NFs + bloco de erros, sem
  Dialog, sem tabela); `PageContainer`/`FormPageContent` (largura `max-w-3xl`
  preservada via `className`); `PageHeader`; `Card`/`CardHeader`/
  `CardContent` no formulário, no resumo, na query Gmail exibida e na lista
  de NFs; `FormField`/`DateField` nas duas datas; `KpiCard` nos 4 blocos de
  estatística; `Alert`/`EmptyState`/`LoadingLeBebe`/`Button` oficiais.
- Mudança de contrato de dado registrada (puramente de transporte, não de
  regra de negócio): o `<input type="date">` nativo enviava `YYYY-MM-DD`
  direto ao estado; o `DateField` oficial trabalha com `dd/mm/aaaa` — a
  conversão para `YYYY-MM-DD` (formato exigido por
  `src/app/api/nfe/importar/route.ts`, validado por regex no backend) passou
  a ser feita no cliente com `dateToIso`/`parseBrDate` de
  `src/lib/design-system/dates.ts`, sem alterar a API, a validação do
  backend ou a janela máxima de 90 dias.
- Preservado: autenticação client-side (`isMaticEmail`) redundante à
  verificação server-side já existente em `page.tsx`
  (`checkModuleAndWindowAccess('pos_venda')`) — não era escopo desta tarefa
  consolidar as duas; fetch, payload, logs de depuração no console e toda a
  lógica de importação/erro.
- Correção de cor hardcoded: `#00A5E6`/`#0090cc` (idênticos ao token
  `--primary` em `globals.css`) substituídos pelos componentes oficiais do
  DS, que já usam o token — nenhuma cor nova introduzida.
- Lacuna registrada, sem solução forçada: a lista expansível de itens por NF
  (`<details>`/`<summary>`) não tem equivalente direto no DS — mantida como
  composição local, mesmo padrão já aceito em outras telas da fila.
- QA: `npx eslint` no arquivo sem problemas; `npx tsc --noEmit` sem erros
  novos (mesmo baseline pré-existente de outros arquivos, não relacionado).
  Build de produção (`next build`) não pôde ser executado nesta sessão
  autônoma (comando bloqueado por falta de superfície de aprovação
  interativa) — sem indício de quebra a partir de lint/typecheck. Validação
  visual manual (desktop/mobile) e um teste funcional real do fluxo de
  importação (Gmail/BD) permanecem pendentes do usuário — sem bloqueio
  técnico.
- Próximo passo: aguardar validação manual do usuário.

## Última tela concluída — Fila 2 — `/pos-venda/atendimento-automatico`

- Concluído: mini-auditoria (rota simples de 1 arquivo — painel de filtros +
  1 tabela larga de 13 colunas com ações de linha, sem Dialog);
  `PageContainer`/`PageHeader` (ação "Atualizar" com `Button loading`);
  `FilterPanel`/`useFilterState`/`FilterFieldGroup`/`FormField` para Status,
  Solicitação (`Select` de `ui/select.tsx`, `className="w-full"` desde o
  início — mesmo bug de `w-fit` corrigido em outras telas evitado aqui por
  já nascer certo) e Busca (`Input` com ícone de lupa, mesma composição já
  usada em `/atendimento-presencial/clientes`); `ResponsiveTable` (13
  colunas via `width: 'compact'` + `className` com `truncate`/`title` nas 4
  colunas de texto longo — Pedido, Situação, Resposta Sugerida, Última
  Mensagem — preservando exatamente os mesmos resumos/tooltips da tela
  original); `Badge` para status (`STATUS_TONE`) e para os indicadores
  "auto"/"sugerida"; `Alert`/`IconButton` para erro e para as 4 ações de
  linha (parar/bloquear 24h/bloquear permanente/desbloquear), com
  `loading` por ação (bloqueio de duplo clique, SAV=A) substituindo o
  `actionLoading` manual anterior.
- Mudança de comportamento registrada (alinhamento com `FLT-EXEC=MANUAL`,
  D-005, mesmo ajuste já feito em `/hub-vendas` D-047 e
  `/atendimento-presencial/clientes` D-053): os 3 filtros (Status,
  Solicitação, Busca) disparavam a consulta a cada mudança de campo antes
  da migração (efeito reagindo a `filtroStatus`/`filtroSolicitacao`/
  `busca`) — passaram a exigir o clique em "Filtrar". Nenhuma API, rota ou
  payload foi alterado, só o gatilho.
- Lacuna registrada, sem solução forçada: o Design System tem só 6 tons de
  `Badge` (`neutral`/`success`/`warning`/`danger`/`info`/`brand`); a tela
  original tinha 6 cores ad hoc distintas, incluindo laranja
  (`bloqueado_24h`) e roxo (`transferido_humano`), que o DS não tem.
  Mapeamento aplicado: `ativa`→success, `pausado_humano`→warning,
  `transferido_humano`→info, `bloqueado_24h`→warning (mesmo tom de
  `pausado_humano`), `bloqueado_permanente`→danger, `finalizado`→neutral.
  Documentado no próprio código (`STATUS_TONE`), mesmo padrão já aceito
  para a lacuna de `Section` (só 3 tons) em `/atendimento-presencial/ficha`.
- Bug evitado durante a migração (não introduzido, não corrigido em outro
  lugar): a chamada de `carregar()` logo após `filtros.clear()`/
  `filtros.apply()` leria o estado antigo por causa da atualização
  assíncrona do `useReducer` de `useFilterState` — corrigido usando uma
  função `buscar(valores)` parametrizada, chamada com `filtros.draft`
  (em "Filtrar") ou com os valores vazios (em "Limpar") diretamente, em
  vez de depender do próximo render — mesmo padrão já usado em
  `/hub-vendas` (`aplicarFiltrosFila`/`limparFiltrosFila`).
- Preservado: as duas rotas de API (`listar` e as 4 ações por sessão),
  toda a lógica de mascaramento de mensagem/documento, os resumos de
  pedido/situação (`resumoPedido`/`detalhesPedido`/`resumoSituacao`),
  formatação de data em `America/Sao_Paulo`, e as 4 regras condicionais de
  quais ações aparecem por status/bloqueio.
- QA: `npx eslint` no arquivo sem problemas; `npx tsc --noEmit` sem erros
  novos (baseline preexistente de outros arquivos não relacionado); suíte
  `src/lib/design-system` 68/68. Validação visual manual (desktop/mobile) e
  um teste funcional real das 4 ações de sessão (parar/bloquear/
  desbloquear) permanecem pendentes do usuário — não foi possível abrir a
  aplicação nesta sessão autônoma (sem superfície de aprovação interativa
  para o dev server/browser) — sem indício de quebra a partir de
  lint/typecheck/testes.
- Próximo passo: aguardar validação manual do usuário.

## Última tela concluída — Fila 2 — `/procurar-datas/performance`

- Frente (regra `procurar-datas.md`): **Frente 3** (diagnóstico/performance) —
  tarefa exclusivamente visual, nenhuma query, cálculo, agregação ou
  comportamento de negócio foi alterado.
- Concluído: mini-auditoria (rota de 1 arquivo — filtros + resumo (5 KPIs) +
  2 gráficos Recharts + 1 tabela de provedores + 2 listas de ranking + 4 KPIs
  de pontos de atenção, sem Dialog); `PageContainer`/`PageHeader`;
  `FilterPanel`/`useFilterState`/`FilterFieldGroup`/`FormField` para os 6
  filtros (Período, Motor, Status, Provider, Cache via `Select` de
  `ui/select.tsx`, `className="w-full"` desde o início; Data início/fim via
  `DateField`, exibido apenas quando Período = Personalizado); `Card`/
  `CardHeader`/`CardContent` em todos os 6 blocos (Resumo, Faixas de tempo,
  Evolução diária, Provedores e cache, Bairros/CEPs, Pontos de atenção);
  `KpiCard` (com `tone` semântico) nos 9 cartões de métrica que antes usavam
  o componente local `CardMetric` (removido); `ResponsiveTable` na tabela de
  provedores (7 colunas, incluindo `Badge` para a coluna Origem); `Alert`
  (`tone="warning"`) no aviso de telemetria parcial e (`tone="danger"`) no
  estado de erro; `EmptyState` no estado inicial ("Use os filtros acima para
  pesquisar") e nas duas listas de ranking quando vazias.
- Mudança de contrato de dado registrada (puramente de transporte, mesmo
  padrão já usado em `/pos-venda/importar-nfe`): os dois campos de data
  personalizada eram `<input type="date">` nativo enviando `YYYY-MM-DD`
  direto ao estado; passaram a usar `DateField` (`dd/mm/aaaa`), convertido
  para `YYYY-MM-DD` só no momento do fetch com `parseBrDate`/`dateToIso` de
  `src/lib/design-system/dates.ts` — a API
  (`src/app/api/procurar-datas/performance/route.ts`) e sua lógica de
  fallback de período (quando a data personalizada está incompleta, usa os
  30 dias padrão) não foram alteradas nem tocadas.
- Preservado: as 6 queries/agregações do endpoint (resumo, faixas, evolução,
  provedores, bairros, CEPs, pontos de atenção), toda a lógica de
  `faixasChartData`/`evolucaoChartData`, os dois gráficos Recharts
  (`BarChart`/`ComposedChart`, cores de série mantidas como estão — atributo
  `fill`/`stroke` de SVG, fora do escopo de token CSS), o aviso de telemetria
  parcial de geocodificação, e `Skeleton` do estado de carregamento (uso já
  confirmado oficial pela auditoria da Fila 2, D-056 — não alterado).
- Correção de cor hardcoded: os dois ícones (`text-[#00A5E6]`) idênticos ao
  token `--primary` foram substituídos por `text-primary`/pelo slot de ícone
  tonal do `CardHeader`; as cores de série dos gráficos (`fill`/`stroke` do
  Recharts) foram mantidas como estão por serem atributos SVG, não classes
  Tailwind.
- Lint sem warnings novos (1 warning pré-existente de import não usado,
  `LineChart`, corrigido junto por ser trivial e no mesmo arquivo).
- QA: `npx eslint` no arquivo sem problemas; `npx tsc --noEmit` sem erros no
  arquivo; suíte `src/lib/design-system` 68/68. Não foi possível abrir a
  aplicação nesta sessão autônoma (sem superfície de aprovação interativa
  para dev server/browser) — validação visual manual (desktop/mobile, os 6
  filtros, os 2 gráficos, a tabela de provedores e as listas de bairro/CEP
  com dado real) permanece pendente do usuário, sem bloqueio técnico.
- Próximo passo: aguardar validação manual do usuário.

## Última tela concluída — Fila 2 — `/configuracoes/procurar-datas`

- Frente (regra `procurar-datas.md`): **Frente 0/Controle** — tela de
  configuração/edição de parâmetros do motor, não o motor em si; tarefa
  exclusivamente visual, nenhuma query, chave editável, cálculo de
  distância/frete ou comportamento de importação/edição foi alterado.
- Concluído: mini-auditoria (rota de 1 arquivo — painel de meta/timestamp,
  resumo de comparação banco×planilha, card de snapshot/importação e 7
  cards de seção com linhas de configuração editáveis inline, sem Dialog);
  `PageContainer`/`FormPageContent` (largura `max-w-4xl` preservada via
  `className`); `PageHeader` (ação "Recarregar" com `Button loading`,
  mesmo padrão já usado em `/pos-venda/atendimento-automatico`); `Card`/
  `CardHeader`/`CardContent` no painel "Banco de dados interno" e em cada
  uma das 7 seções de configuração (`SecaoCard`); `Alert` nos estados
  informativo (banco vazio), sucesso/erro de importação, sucesso de edição
  inline (toast) e erro ao carregar configurações; `LoadingLeBebe` no
  carregamento inicial de página inteira (mesmo padrão institucional já
  usado em `/hub-vendas`/`/procurar-datas`); `Input` oficial nos 3 tipos de
  campo de texto/numérico da edição inline (endereço, HH:MM, numérico com
  sufixo); `Badge` no valor `secret`/`boolean` (`ValorItem`) e no chip de
  comparação (`BadgeComparacao`).
- Mapeamento de tom registrado (lacuna: `Badge` tem só 6 tons, a tela
  original usava uma cor ad hoc — violeta — para "editado no banco", sem
  equivalente direto): `diferente`+editável (violeta)→`brand`,
  `diferente`+não editável (âmbar)→`warning`, `ausente_no_banco`
  (azul)→`info`, `ausente_na_planilha` (cinza)→`neutral`. Documentado no
  próprio código, mesmo padrão de mapeamento já aceito para `STATUS_TONE`
  em `/pos-venda/atendimento-automatico`.
- Preservado: as 4 rotas de API (`GET` configurações, `GET` snapshot,
  `POST` importar, `PATCH` por chave), a whitelist `CHAVES_EDITAVEIS_FASE3`,
  toda a lógica de comparação banco×planilha (`status_comparacao`,
  contadores do resumo), a conversão metro↔km de `distance_m`
  (`formatarValorDb`/`valorDbParaInput`), o campo especial HH:MM de "TEMPO
  MAXIMO DE VIAGEM SÁBADO", o toggle SIM/NÃO de boolean (mantido como
  composição local — sem componente de switch no DS, mesma lacuna já
  registrada para outros paddings de composição local em telas anteriores
  da fila), a atualização otimista local (`handleSalvo`) sem recarregar a
  lista, e o aviso de que secrets nunca são salvos/exibidos como editáveis.
  Cor hardcoded (`#00A5E6`/`#0090cc`) eliminada — substituída pelos tokens
  `primary` já usados pelos componentes oficiais do DS (`Button`, link de
  `url` em `ValorItem`).
- Nenhuma divergência funcional de cálculo/config do motor foi identificada
  durante esta migração (consistente com a observação já registrada na
  auditoria geral da Fila 2, seção "Observação separada" abaixo).
- QA: `npx eslint` no arquivo sem problemas; `npx tsc --noEmit` sem erros
  no arquivo; suíte `src/lib/design-system` 68/68. Não foi possível abrir a
  aplicação nesta sessão autônoma (sem superfície de aprovação interativa
  para dev server/browser) — validação visual manual (desktop/mobile, os 7
  cards de seção, edição inline de pelo menos um valor de cada tipo, o
  fluxo de importação da planilha) permanece pendente do usuário, sem
  bloqueio técnico.
- Próximo passo: aguardar validação manual do usuário.

## Última tela concluída — Fila 2 — `/procurar-datas/auditoria`

- Frente (regra `procurar-datas.md`): **Frente 0/Controle** — ferramenta de
  auditoria/comparação read-only, não o motor em si; tarefa exclusivamente
  visual, nenhuma query, cálculo, filtro de negócio ou payload foi alterado.
- Concluído: mini-auditoria (rota de 1 arquivo — painel de filtros com 10
  campos, listagem principal de 12 colunas e um modal de detalhe com 5
  seções, incluindo uma sub-tabela de resultados e uma lista de
  pré-agendamentos); `PageContainer`/`PageHeader`; `FilterPanel`/
  `useFilterState`/`FilterFieldGroup`/`FormField` para os 10 filtros (3
  grupos — Período, Busca, Status e pré-agendamento), com `DateField`
  (`dd/mm/aaaa`) nas 3 datas (antes `<input type="date">` nativo) e `Select`
  de `ui/select.tsx` (`className="w-full"` desde o início) para Status e
  Pré-agendamento; `ResponsiveTable` na listagem principal (12 colunas,
  `rowActions` com o botão "Ver") e também na sub-tabela "Resultados
  exibidos" dentro do modal (antes duas `<table>` cruas); `Dialog`/
  `DialogHeader`/`DialogBody` (`MOD=A`) no modal de detalhe; `Section`
  (ciclando os 3 tons oficiais no lugar das 5 cores ad hoc que a tela tinha
  antes — LACUNA DE DESIGN SYSTEM já registrada em `/atendimento-presencial/
  ficha`: `Section` só tem 3 tons) nas 5 seções do detalhe, com
  `variant="subsection"` nos dois blocos internos (Resultado escolhido/
  Payload resumido) do card de pré-agendamento; `Badge` nos indicadores de
  status/motor/duração da pesquisa, no tipo de cada resultado e no status de
  cada pré-agendamento; `Alert` para erro de listagem e para "Sem
  pré-agendamento vinculado"; `Card`/`CardContent` para cada item de
  pré-agendamento (antes `div` local).
- Preservado: a API `/api/procurar-datas/auditoria` (listagem paginada e
  detalhe por `id`), os 10 filtros e seus nomes de parâmetro, a busca ao
  vivo com debounce de 250ms no campo "Rua pesquisada" (única exceção a
  `FLT-EXEC=MANUAL` nesta tela — preservada tal como estava, agora com
  `helper` explicando o comportamento no próprio campo), a paginação de 20,
  a formatação de moeda/data/hora, `extrairResumoPreAgendamento` e toda a
  leitura de JSON bruto (parâmetros, resultados, payloads) — nenhuma query,
  cálculo ou payload alterado.
- Mudança de contrato de dado registrada (puramente de transporte, mesmo
  padrão já usado em `/pos-venda/importar-nfe` e `/procurar-datas/
  performance`): os 3 campos de data (`dataInicial`/`dataFinal`/
  `dataPreAgendada`) eram `<input type="date">` nativo enviando
  `YYYY-MM-DD` direto ao estado; passaram a usar `DateField` (exibição
  `dd/mm/aaaa`), convertidos para `YYYY-MM-DD` só no momento do fetch
  (`parseBrDate`/`dateToIso` de `src/lib/design-system/dates.ts`) — a API
  não foi alterada.
- Mudança de comportamento registrada (alinhamento com `FLT-EXEC=MANUAL`,
  mesmo ajuste já feito em outras telas da fila): os 6 filtros que antes
  exigiam clicar em "Pesquisar" continuam exigindo aplicar (agora "Filtrar",
  rótulo padrão do `FilterPanel`); a paginação (Anterior/Próxima) passou a
  usar sempre os filtros já aplicados (`filtros.applied`) em vez do estado
  bruto do formulário — mais correto que o comportamento anterior (que
  paginava com qualquer edição não aplicada ainda no campo), sem mudar o
  contrato da API.
- Nenhuma divergência funcional de cálculo/ranking/OSRM ou equivalência com
  o legado foi identificada durante esta migração (consistente com a
  observação já registrada na auditoria geral da Fila 2).
- QA: `npx eslint` no arquivo sem problemas (`--max-warnings=0`); `npx tsc
  --noEmit` sem erros no arquivo (15 erros pré-existentes no baseline, todos
  em outros arquivos de teste não relacionados); suíte `src/lib/design-
  system` 68/68. Não foi possível abrir a aplicação nesta sessão autônoma
  (sem superfície de aprovação interativa para dev server/browser) —
  validação visual manual (desktop/mobile, os 10 filtros incluindo a busca
  ao vivo por rua, a listagem de 12 colunas, o modal de detalhe com as 5
  seções, a sub-tabela de resultados e a lista de pré-agendamentos com dado
  real) permanece pendente do usuário, sem bloqueio técnico.
- Próximo passo: aguardar validação manual do usuário.

## Última tela concluída — Fila 2 — `/procurar-datas`

- Frente (regra `procurar-datas.md`): **Frente 0/Controle** — a tela é o
  formulário/dashboard operacional do motor, não o cálculo em si; tarefa
  exclusivamente visual. Nenhuma query, cálculo de frete/distância, regra de
  classificação de candidato, chamada a `/api/procurar-datas/*` ou payload
  foi alterado. A pendência técnica herdada já registrada nesta regra
  (VALOR INICIAL sem distância real no modal) não foi tocada nem investigada
  nesta tarefa — fora de escopo.
- Concluído: mini-auditoria (maior tela da Fila 2, 1561 linhas — formulário
  único de CEP/endereço/serviço com múltiplos estados condicionais de
  bloqueio de campo, mais um painel de resultados com 2 tabelas de
  candidatos, sem Dialog); `PageContainer`/`PageHeader` (ação "Nova
  consulta"); `Card`/`CardHeader`/`CardContent` nos dois blocos principais
  ("Dados da busca" e "Resultados"); `FormField`/`Input` em CEP, Número,
  Logradouro, Bairro, Cidade, UF (o estado visual de erro/somente-leitura
  passou a vir das classes nativas do `Input`/`FormField`
  `aria-invalid`/`read-only`, no lugar do `className` condicional manual
  anterior — mesmo resultado visual); `Select`/`SelectTrigger`
  (`className="w-full"` desde o início, mesmo cuidado já usado em outras
  telas da fila)/`SelectContent`/`SelectItem` nos 5 campos de opção
  (Berço/cama, Cômoda, Roupeiro, Poltrona, Painel) — sentinela
  `__NONE__` mapeada para `''` internamente, já que o Radix Select não aceita
  `SelectItem value=""` (mesmo problema e solução já usados em
  `/pos-venda/atendimento-automatico` com "TODOS"/"TODAS"); `DateField`
  (`dd/mm/aaaa`) no campo "Data inicial" (antes `<input type="date">`
  nativo); `Alert` (`warning`/`info`/`success`/`danger`) em todos os banners
  de status do fluxo de CEP/endereço (avisos de encomenda/showroom, CEP
  geral/não encontrado, confirmação "O CEP é desse endereço?", erro de
  validação com ações de recuperação, endereço confirmado, endereço
  localizado, divergência de bairro/cidade/UF, serviço bloqueado) — extensão
  pontual do uso do `Alert` para banners com botões de ação embutidos (não
  só texto passivo), mantendo os mesmos tons semânticos já usados no resto
  da fila; `ResponsiveTable` nas duas listagens de candidatos (antes 2
  `<table>` cruas) com `rowActions`/`renderMobileCard` (botão "Pré-agendar"
  por candidato, com `loading` nativo do `Button` substituindo o `Loader2`
  manual); `Badge` no indicador de tipo de candidato (Normal/Especial/
  Premium/Hora marcada).
- Mapeamento de tom registrado (lacuna: `Badge` tem só 6 tons, a tela
  original usava 4 cores ad hoc distintas — violeta, âmbar, laranja e
  esmeralda — sem equivalente direto para violeta/laranja): `normal`
  (esmeralda)→`success`, `especial` (violeta)→`brand`, `premium`
  (âmbar)→`warning`, `hora-marcada` (laranja)→`info`. Documentado no
  próprio código (`getTipoBadgeTone`), mesmo padrão já aceito para
  `STATUS_TONE` em `/pos-venda/atendimento-automatico`.
- Mudança de contrato de dado registrada (puramente de transporte, mesmo
  padrão já usado em outras telas da fila): a "Data inicial" era um
  `<input type="date">` nativo lendo/escrevendo `form.dataInicial`
  diretamente em ISO (`YYYY-MM-DD`) — o `DateField` oficial trabalha com
  exibição `dd/mm/aaaa`. `form.dataInicial` continua ISO internamente, sem
  nenhuma mudança (mesma comparação lexical `>=`/`<=` com `minDate`/
  `maxDate`, mesmo payload `monthYear` enviado ao backend); um novo estado
  local só de exibição (`dataInicialDisplay`, sincronizado por `useEffect`
  sempre que `form.dataInicial` muda) guarda o texto `dd/mm/aaaa` do campo,
  convertido para ISO (`parseBrDate`/`dateToIso` de
  `src/lib/design-system/dates.ts`) só quando a digitação resulta numa data
  válida — nenhuma API ou cálculo tocado.
- Preservado: toda a máquina de estados do fluxo (CEP → confirmação →
  validação de endereço → divergência → confirmação de local → cálculo de
  tempo de serviço e valor inicial → pesquisa assíncrona com polling →
  pré-agendamento), os 3 `useEffect` de cálculo automático (data mínima por
  encomenda, tempo de serviço, valor inicial com debounce de 300ms), o
  polling de progresso e timeout de 7 minutos, `document.getElementById(
  'dataInicial').focus()` ao confirmar local (continua funcionando — o
  `DateField` mantém `id="dataInicial"` no `<input>` real), a barra de aviso
  fixa de encomenda/showroom, e o bloqueio de campos por estado do CEP
  (`cepBloqueado`/`numeroBloqueado`/`logradouroBloqueado`/`bairroBloqueado`/
  `cidadeUfBloqueado`) — nenhuma condição de bloqueio foi alterada, só a
  forma como o bloqueio é representado visualmente.
- Botões `variant="outline"` (não existe no DS `Button`, que só tem
  `primary`/`secondary`/`ghost`/`destructive`) mapeados para `secondary`
  (ações secundárias tonais — Nova consulta, Pesquisar CEP, Ajustar
  endereço, Não é esse endereço, Pesquisar outro CEP, Editar filtros, Nova
  busca) ou `destructive` (Revisar CEP e endereço, que antes usava
  `bg-red-700 text-white` customizado — agora usa o tom `destructive`
  oficial do DS, mais claro que o vermelho sólido anterior; mudança visual
  aceita como parte da adoção do tom oficial, mesmo padrão de "adotar o tom
  em vez do vermelho customizado" já usado em outras telas).
- QA: `npx eslint` no arquivo sem problemas (1 warning pré-existente,
  `progressSnapshot` não utilizado, confirmado presente também no código
  antes desta migração — não é regressão); `npx tsc --noEmit` sem erros no
  arquivo (baseline pré-existente de outros arquivos de teste inalterado);
  suíte `src/lib/design-system` 68/68. Não foi possível abrir a aplicação
  nem rodar `next build` nesta sessão autônoma (sem superfície de aprovação
  interativa para dev server/browser/build) — validação visual manual
  (desktop/mobile) é o próximo passo obrigatório antes de aprovar esta
  tela, com atenção especial a: os 5 `Select` de opção de serviço, os
  estados de bloqueio/desbloqueio de CEP/endereço em sequência real, o
  campo "Data inicial" (`DateField`, incluindo o foco automático após
  confirmar o local e os limites min/max por encomenda), as duas tabelas de
  candidatos (desktop e card mobile) com uma pesquisa real, e o
  pré-agendamento de um candidato.
- Próximo passo: aguardar validação manual do usuário.

## Última tela concluída — Fila 2 — `/superadmin` (abas Usuários + Auditoria)

- Escopo confirmado por leitura: `PageClient.tsx` (828 linhas) é um único
  arquivo compartilhado pelas 3 abas (`usuarios`/`perfis`/`auditoria`); o
  item 9-10 da Fila 2 pediu explicitamente só as abas Usuários e Auditoria
  — a aba Perfis (`PerfilEditor.tsx`, componente separado) **não foi
  tocada**, permanece fora de escopo desta tarefa.
- Gatilho de risco elevado por padrão (§4 do Harness — autenticação/
  permissões): `page.tsx` (verificação de acesso server-side —
  `requireAuthenticatedUser`, `checkModuleAccess('superadmin_usuarios')`,
  redirects por aba/role) foi só lido, nunca alterado. `EMAILS_PROTEGIDOS`,
  todas as 7 rotas de API (`usuarios`, `perfis-disponiveis`, `unidades`,
  `adicionar-usuario`, `status`, `role`, `perfil`, `unidades` por usuário),
  a query direta de `auditoria_acessos` via `createClient()` e todas as
  regras de proteção (bloquear/alterar role de `EMAILS_PROTEGIDOS`,
  restrição de aba para não-superadmin) permanecem idênticas — nenhuma
  linha de `page.tsx` ou de rota de API foi modificada.
- Concluído: `PageContainer`/`PageHeader`; `Tabs`/`SegmentedTabsList`/
  `SegmentedTabsTrigger` (reaproveitando o `Tabs`/`TabsContent` do Radix já
  usado, só trocando o `className` das duas abas visíveis para
  não-superadmin/3 para superadmin — mesma lógica condicional preservada);
  `Card`/`CardHeader`/`CardContent` nas duas abas; `Dialog`/`DialogHeader`/
  `DialogBody` nos dois modais (Adicionar Usuário, Editar Unidades) —
  estrutura MOD=A oficial, `DialogTrigger asChild` com `Button`;
  `FormField`/`Input`/`Select` (`ui/select.tsx`, sentinela `__SEM_PERFIL__`
  para a opção "Sem perfil", já que o Radix Select não aceita
  `SelectItem value=""` — mesmo padrão já usado em `/procurar-datas` e
  `/pos-venda/atendimento-automatico`) no formulário de novo usuário;
  `ResponsiveTable` nas duas tabelas (antes 2 `<table>` cruas) — a de
  Usuários mantém os controles interativos por linha (`Select` de
  role/perfil, botão remover perfil, botão editar unidades) dentro das
  células da própria coluna, e as ações de bloquear/desbloquear como
  `rowActions`; `Badge` para Status (Ativo/Bloqueado), para "Acesso total"
  e para a Ação de auditoria; `Alert` para erro/sucesso do formulário de
  novo usuário; `FilterPanel`/`useFilterState`/`FilterFieldGroup` para os
  2 filtros de Auditoria (Email, Ação) — já eram manuais (botão "Filtrar"
  explícito antes da migração), formalizados com o hook oficial sem mudar
  o comportamento (`buscar(valores)` parametrizado, mesmo padrão já usado
  em `/pos-venda/atendimento-automatico` para evitar closure velha do
  `useReducer`).
- Mapeamento de tom registrado (lacuna: `Badge` tem só 6 tons; "Acesso
  total" era roxo ad hoc, sem equivalente direto): mapeado para `brand`
  (indicador de privilégio elevado), mesmo padrão de mapeamento já aceito
  em outras telas da fila (`STATUS_TONE`/`BadgeComparacao`). As 3 cores da
  Ação de auditoria (verde/vermelho/azul por substring) mapeiam
  diretamente para `success`/`danger`/`info`, sem lacuna.
- Preservado: o comportamento intencional já existente de o `Select` de
  perfil na tabela não fazer nada ao escolher "Sem perfil" (só o botão
  dedicado remove o perfil) — mantido com a sentinela também retornando
  cedo; a proteção de `EMAILS_PROTEGIDOS` (desabilita bloquear/alterar
  role); o perfil "órfão" (atribuído mas fora da lista de disponíveis)
  continua aparecendo como opção desabilitada no `Select`; paginação
  ausente (a API já limita a 100 registros de auditoria, comportamento
  não tocado); toda a lógica de carregamento por aba (`loadData`),
  atualização otimista após cada ação (`loadUsuarios()`), e a sincronização
  de aba com a URL (`?tab=`).
- Cor hardcoded eliminada: a paleta indigo (`bg-indigo-600`, `ring-indigo-500`,
  etc.) usada em botões/inputs/checkboxes nativos foi substituída pelos
  componentes oficiais do DS, que usam o token `primary` (sky) — mesmo
  padrão de "adotar o token oficial" já usado em outras telas da fila
  (`/pos-venda/importar-nfe`, `/procurar-datas/performance`).
- QA: `npx eslint` no arquivo sem problemas (`--max-warnings=0`); `npx tsc
  --noEmit` sem erros novos no arquivo (baseline pré-existente de outro
  arquivo de teste, não relacionado, inalterado); suíte
  `src/lib/design-system` 68/68. Não foi possível abrir a aplicação nesta
  sessão autônoma (sem superfície de aprovação interativa para dev
  server/browser) — validação visual manual (desktop/mobile, as duas
  abas, os dois modais, os `Select` inline de role/perfil na tabela, e em
  especial o comportamento de acesso restrito para um usuário não-superadmin,
  que só deve ver a aba Usuários) permanece pendente do usuário, sem
  bloqueio técnico. A aba Perfis não foi tocada e não precisa de validação
  nesta tarefa.
- Próximo passo: aguardar validação manual do usuário.

## Auditoria transversal — Tables e Filtros (2026-09-16)

Tarefa dedicada, anterior à migração de `/recebimento` (rota raiz),
pedida pelo usuário depois de observar dois padrões recorrentes
escapando da validação técnica em telas já migradas. Só código
visual — nenhuma API, query, regra de negócio, schema ou permissão foi
tocada.

**Causa raiz — Tables (Padrão A):** `firstColumnSticky` (`ResponsiveTable`)
é opcional, sem valor padrão, e nada no componente lembra a tela de
declará-lo — cada migração precisa decidir isso conscientemente. Em pelo
menos 9 tabelas com colunas suficientes para provavelmente exigir scroll
horizontal, a prop foi esquecida. Não é defeito do componente (o padrão
`firstColumnSticky` funciona corretamente onde já é usado — `/dashboard`,
`/chamados-finalizados`, `/inteligencia-comercial`, etc.) — é Causa A
(páginas não aplicaram) reforçada com Causa C (checklist agora explícito
em `docs/design-system/README.md`).

**Causa raiz — Filtros (Padrão B):** a base de `SelectTrigger`
(`src/components/ui/select.tsx`) usa `w-fit` — sem `className="w-full"`
explícito por uso, o campo fica estreito dentro de `FilterFieldGroup`.
Confirmado como bug recorrente (já corrigido pontualmente antes em
`/agendamentos`, `/atendimento-presencial/clientes`,
`/atendimento-presencial/registros` — ver Fila 2 acima); `/hub-vendas`
tinha os dois `SelectTrigger` do grupo "Loja e status" sem o override.
Não alteramos o padrão de `ui/select.tsx` (mudaria a largura de TODO
consumidor existente, inclusive fora de filtros — avaliado e descartado,
ver `README.md` "Compatibilidade"); fortalecida a documentação canônica
(Causa C) em vez de mudança global no componente.

**Telas auditadas (todas as `ResponsiveTable`/`FilterPanel` do app, fora
`/recebimento` e `/recebimento/[id]`):** as 8 telas da fila 1, as 10 da
fila 2 (excluindo o item 11 bloqueado), `ModalDetalheVenda`,
`TabelaVendas`, `TabelaChamadosFinalizados`, `TabelaAgendamentos`,
`ModalAgendamentosCliente`, `digisac/finalizacoes-automaticas`,
`GestaoPedidosPersonalizados`/`FormularioLebebeExclusive`
(`/pedidos-personalizados`) e o laboratório `/design-system` (não
alterado — é referência comparativa, fora de escopo de produção).

**Telas/arquivos corrigidos (Padrão A — `firstColumnSticky` adicionado):**
`src/app/hub-vendas/PageClient.tsx`,
`src/app/pos-venda/atendimento-automatico/PageClient.tsx`,
`src/app/procurar-datas/auditoria/PageClient.tsx` (tabela principal E a
sub-tabela "Resultados exibidos" dentro do modal de detalhe),
`src/app/procurar-datas/PageClient.tsx` (tabela de candidatos, função
compartilhada pelas duas ocorrências), `src/app/procurar-datas/
performance/PageClient.tsx` (tabela de provedores/cache),
`src/app/superadmin/PageClient.tsx` (tabela de Usuários — a de Auditoria,
5 colunas sem ações, não precisa), `src/components/pedidos-
personalizados/GestaoPedidosPersonalizados.tsx` (tabela de itens Lebebe
Exclusive no detalhe) e `src/components/pedidos-personalizados/
FormularioLebebeExclusive.tsx` (tabela de busca de catálogo).

**Correção adicional necessária para não quebrar TABLE-STICKY-OPAQUE:**
`FormularioLebebeExclusive.tsx` tinha `rowClassName` com destaque de
seleção (`border-l-4 border-l-emerald-400`) sem nenhum `bg-*` — ativar
`firstColumnSticky` ali exporia essa lacuna (célula sticky transparente
ao rolar uma linha selecionada). Adicionado `bg-emerald-50` à mesma
classe (cor já usada no mesmo arquivo para o mesmo estado de "selecionado",
linha do resumo "Mostrando N produto(s) selecionado(s)") — não é uma cor
nova, é a mesma família já aprovada tornada opaca.

**Deliberadamente NÃO alterado (tabela não precisa ou coluna não é dado
real):** `superadmin` aba Auditoria (5 colunas, sem ações, não demonstrou
necessidade real de scroll); `ModalAgendamentosCliente` (a primeira
coluna declarada é um índice `#` decorativo, não um dado real — fixá-la
violaria a própria regra de "não fixar coluna artificial"); tabelas que
já tinham `firstColumnSticky` (`/dashboard` ×2, `/inteligencia-comercial`,
`/chamados-finalizados`, `TabelaAgendamentos`,
`digisac/finalizacoes-automaticas`).

**Telas/arquivos corrigidos (Padrão B — `className="w-full"` adicionado):**
`src/app/hub-vendas/PageClient.tsx` — os dois `SelectTrigger` do grupo
"Loja e status" ("Todas as lojas"/"Todos os status"). Nenhum outro
`SelectTrigger` dentro de um `FilterPanel`/`FilterFieldGroup` em qualquer
tela auditada estava sem o override (todos os outros ~20 usos já tinham
`className="w-full"` — confirmado por leitura de todos os 16 arquivos que
importam `ui/select.tsx`).

**`/procurar-datas/performance` (Padrão B relatado pelo usuário):**
investigado a fundo — todos os 5 `SelectTrigger` do único `FilterPanel`
da tela já têm `className="w-full"`, `DateField` já é `w-full` por
padrão, e o botão "Filtrar" não esticar é o comportamento intencional já
aprovado (`FILTER-ACTION-ALIGN=A`). Não foi encontrado, por leitura de
código, nenhum campo/botão estreito além do que já está corrigido nesta
mesma tarefa (Fila 2, migração técnica concluída no mesmo dia). Hipótese
mais provável: a observação do usuário é anterior a essa migração e ainda
não foi revalidada visualmente — registrado aqui para o usuário confirmar
na validação manual; nenhuma correção adicional foi inventada sem causa
identificada.

**Mudança global no Design System:** nenhuma. `ResponsiveTable` e
`FilterPanel` não foram alterados — só consumidores (telas) e a
documentação canônica (`docs/design-system/README.md` ganhou a seção
"Checklist de migração — Tables e Filtros"; `components-e-patterns.md`
ganhou os achados reais de `firstColumnSticky` e `SelectTrigger`
`w-fit`). `src/components/ui/select.tsx` não foi tocado.

**Testes executados:** `npx eslint` nos 8 arquivos alterados
(`--max-warnings=0`) — 2 warnings pré-existentes não relacionados
(`progressSnapshot` em `procurar-datas/PageClient.tsx`, dependência de
`useEffect` em `GestaoPedidosPersonalizados.tsx`, ambos já presentes
antes desta tarefa); `npx tsc --noEmit` sem nenhum erro novo nos arquivos
alterados (baseline pré-existente de outros arquivos de teste
inalterado); suíte `src/lib/design-system` 68/68. Não foi possível abrir
a aplicação nesta sessão para QA visual ao vivo — validação manual do
usuário é o próximo passo (lista abaixo).

**QA manual pendente do usuário:**

- `/hub-vendas`: arrastar a tabela de filas horizontalmente e confirmar
  que a primeira coluna (Data/hora) fica fixa; confirmar que os selects
  "Loja" e "Status" no painel "Filtros de filas e envios" agora preenchem
  a largura do campo.
- `/pos-venda/atendimento-automatico`: arrastar a tabela (13 colunas) e
  confirmar que a coluna "Status" fica fixa.
- `/procurar-datas/auditoria`: arrastar a listagem principal (12 colunas)
  e confirmar coluna "Data/hora" fixa; abrir o modal de detalhe de uma
  pesquisa com resultados e confirmar a sub-tabela "Resultados exibidos"
  também com a coluna "Data" fixa ao arrastar.
- `/procurar-datas`: pesquisar candidatos e arrastar as tabelas de
  resultado, confirmando a coluna "Data" fixa em ambas.
- `/procurar-datas/performance`: confirmar visualmente se o problema de
  largura de botão/campo relatado ainda ocorre (não localizado por
  leitura de código nesta tarefa — ver nota acima); se persistir, apontar
  exatamente qual elemento (nome do campo/botão e breakpoint) para
  investigação dirigida.
- `/superadmin` (aba Usuários): arrastar a tabela e confirmar coluna
  "Email" fixa, sem sobreposição visual dos controles de Role/Perfil.
- `/pedidos-personalizados`: no detalhe de um pedido Lebebe Exclusive,
  arrastar a tabela de itens e confirmar coluna "Coleção" fixa; na busca
  de catálogo (novo pedido), arrastar a tabela de resultados e confirmar
  coluna "Coleção" fixa E que uma linha selecionada mantém o destaque
  (borda + fundo verde-claro) visível corretamente atrás da coluna fixa.

**Confirmação explícita:** `/recebimento` (rota raiz) e
`/recebimento/[id]` não foram tocados nesta tarefa — nenhum arquivo
exclusivo dessas rotas foi lido para edição nem alterado. A próxima
tarefa pode ser a migração de `/recebimento` (rota raiz), condicionada ao
mesmo requisito já registrado no item 11 da Fila 2 (aprovação/commit de
amostra representativa das telas já migradas, ou autorização explícita do
usuário para pular essa validação).

## Pendência residual corrigida — `/procurar-datas`, bloco "Dados da busca" (2026-09-16)

Ajuste localizado, exclusivamente visual, pedido depois da validação
manual da auditoria acima (os padrões de Tables já aprovados não foram
reabertos). Frente 1/esquerda (bloco CEP/endereço/geocodificação) — nenhuma
regra de CEP, geocodificação, validação, API, payload ou cálculo foi
tocada.

**Causa confirmada:** o grid do bloco (`grid md:grid-cols-6`) tem duas
linhas cujas colunas somavam menos que 6 — `Numero` e `UF` usavam o span
padrão (1, implícito, sem classe) e `Bairro` usava `md:col-span-2` — cada
um desses três campos sobrava uma "coluna morta" (sem conteúdo) ao final
da própria linha, sem que nada expandisse para ocupá-la. `CEP`/
`Logradouro`/`Cidade` já tinham span explícito e preenchiam a linha
inteira (por isso pareciam corretos). Confirmado numericamente com uma
reprodução isolada (mesmo `grid-template-columns: repeat(6, minmax(0,
1fr))`) antes de editar o arquivo real.

**Arquivo alterado:** `src/app/procurar-datas/PageClient.tsx` (função de
formulário do bloco "Dados da busca").

- **Numero:** `md:col-span-2` adicionado (antes: sem classe = span 1).
  Junto com CEP (2) e o botão "Pesquisar CEP" (2), a linha agora fecha
  em 6/6 sem coluna morta.
- **Bairro:** `md:col-span-2` → `md:col-span-3`, igualando a largura de
  Logradouro (3) na mesma linha — 3+3=6/6 sem coluna morta.
- **UF:** a linha de Cidade(3)+UF(1)+"Ajustar endereço"(2) já fechava em
  6/6 sem coluna morta — o campo já ocupava 100% da própria coluna. A
  largura reduzida real só aparece quando o botão "Ajustar endereço" não
  está visível (`addressResult?.ok` falso, o estado mais comum antes de
  confirmar um endereço): o wrapper do botão continuava reservando 2
  colunas vazias ao lado de um UF de 1 coluna. Corrigido tornando o
  `className` de UF condicional — `md:col-span-3` quando não há botão
  (ocupa a linha inteira ao lado de Cidade), voltando ao span padrão (1)
  só quando `addressResult?.ok` é verdadeiro e o botão precisa das 2
  colunas ao lado. O wrapper do botão passou a ser renderizado condicional
  (`{addressResult?.ok && (...)}`) em vez de sempre presente e vazio. Não
  reduzimos a largura do botão "Ajustar endereço" para evitar overflow de
  texto (`whitespace-nowrap` no `Button` oficial) — avaliado e descartado.
- **"Pesquisar CEP":** não alterado, exceto por permanecer no mesmo
  wrapper `md:col-span-2` que já tinha (necessário para a linha de
  Numero fechar em 6/6, mas nenhuma classe do próprio botão mudou).

**Validações executadas:** `npx eslint --max-warnings=0` no arquivo (1
warning pré-existente não relacionado, `progressSnapshot`, já registrado
antes desta tarefa); `npx tsc --noEmit` sem erro novo no arquivo;
`git diff --check` sem problema de espaço em branco. Reprodução isolada
(HTML/CSS estático, mesma `grid-template-columns`) confirmou numericamente
que as três linhas fecham em 6/6 colunas sem espaço morto, nos dois
estados de UF (com e sem o botão "Ajustar endereço"), antes de aplicar no
arquivo real. Não foi possível abrir a aplicação autenticada nesta sessão
para QA visual ao vivo.

**Confirmação:** nenhuma regra de CEP, geocodificação, validação, API,
payload, cálculo de distância, agenda ou OSRM/Haversine foi alterada —
só classes de layout (`className`) e a condição de renderização do
wrapper do botão "Ajustar endereço" (puramente de apresentação). A
auditoria de Tables já aprovada não foi reaberta.

**QA manual pendente do usuário:**

- Abrir `/procurar-datas`, bloco "Dados da busca", em desktop.
- Confirmar que `Numero` preenche a largura da sua coluna (ao lado de CEP
  e do botão "Pesquisar CEP").
- Confirmar que `Bairro` preenche a largura da sua coluna (ao lado de
  Logradouro).
- Confirmar que `UF` preenche a largura disponível quando não há botão
  "Ajustar endereço" visível, e que a linha Cidade/UF/"Ajustar endereço"
  continua correta depois de confirmar um endereço (botão visível).
- Repetir em mobile (375px) e confirmar que não há overflow horizontal.

## Última tela concluída — Fila 2 — `/recebimento` (rota raiz)

- **Escopo e fronteira:** tarefa exclusiva da rota raiz (`src/app/recebimento/PageClient.tsx`
  e `page.tsx`). `/recebimento/[id]` (`PageClient.tsx`, `OSItemCard.tsx`, `page.tsx`)
  e `/recebimento/produtos` **não foram lidos para edição nem alterados** —
  confirmado por `git status`/`git diff --stat` no fim da tarefa: zero diff
  nesses caminhos. Confirmado por leitura (auditoria da própria Fila 2): a
  rota raiz não importa nada de `[id]` (nem `OSItemCard`, nem seu
  `PageClient`) — acoplamento visual real é zero.
- Mini-auditoria: 1 arquivo (1791 linhas antes da migração) — header com 3
  ações, 4 abas (Recebimentos/Notas Vinculadas/Problemas Pendentes/
  Dashboard), filtros (Data Início/Fim/Número NF, já `FLT-EXEC=MANUAL` antes
  da migração — só o clique em "Filtrar"/Enter no campo de NF disparava
  busca), listagem de cards de recebimento com paginação (20/página, já
  respeitado antes), 4 modais (detalhe de NFs, cancelar, criar recebimento,
  importar NF-e) e 2 sub-telas internas (Notas Vinculadas com modal de
  itens; Problemas Pendentes).
- Concluído: `PageContainer`/`PageHeader` (3 ações: Produtos/Importar NFe
  secundárias, Novo Recebimento primária); `Tabs`/`SegmentedTabsList`/
  `SegmentedTabsTrigger` substituindo a barra de abas customizada (mesmo
  texto/ícone/tooltip de cada aba, mesmo comportamento de montar/desmontar
  conteúdo ao trocar de aba); `FilterPanel`/`FilterFieldGroup`/
  `useFilterState`/`FormField`/`DateField`/`Input` nos 3 filtros da aba
  Recebimentos (o botão "Filtrar" e "Limpar" do próprio `FilterPanel`
  substituem os botões manuais — o campo de NF manteve o gatilho por Enter);
  `Card`/`CardHeader`/`CardContent` em todos os cards de listagem, resumo e
  métricas; `Badge` para status (ABERTO/FECHADO/CANCELADO), indicador OS,
  vinculação de NF e contagem/tipo de divergência; `EmptyState`/`Spinner`/
  `SkeletonRows` para vazio/carregando; `Progress` (já oficial, D-057,
  preservado sem alteração); `Dialog`/`DialogHeader`/`DialogBody` nos 4
  modais (detalhe de NFs, criar recebimento, importar NF-e, itens da NF em
  Notas Vinculadas); `ConfirmDialog` oficial no modal de cancelar
  recebimento (ação destrutiva, `DST=A`); `KpiCard` nos 4 indicadores do
  Dashboard; cor de marca hardcoded (`#00A5E6`/`#0090cc`) eliminada em favor
  dos tokens `primary`/`bg-primary`/`text-primary` já usados pelos
  componentes do DS.
- Mudança de contrato de dado registrada (puramente de transporte, mesmo
  padrão já usado em `/pos-venda/importar-nfe` e
  `/procurar-datas/performance`): os campos de data (filtro da listagem,
  criação de recebimento, importação por data) eram `<input type="date">`
  nativo (`YYYY-MM-DD` direto no estado); passaram a usar `DateField`
  (`dd/mm/aaaa`), convertidos para `YYYY-MM-DD` só no momento da chamada
  (Supabase ou `/api/recebimento`/`/api/nfe/importar`) com
  `dateToIso`/`parseBrDate` de `src/lib/design-system/dates.ts` — nenhuma
  API, query Supabase ou regra de validação (período obrigatório, janela
  máxima de 90 dias na importação) foi alterada, só reimplementada em cima
  de `Date` em vez de comparação de string ISO.
- Lacunas registradas, sem solução forçada: os pequenos chips de número de
  NF dentro do card (até 5 por card + "+N") mantidos como composição local
  — o `Badge` oficial (padding/tamanho de pílula) quebraria a densidade
  necessária para várias etiquetas por linha; o checkbox de seleção de NF
  no preview de criação de recebimento manteve `<input type="checkbox">`
  nativo (só com cor de marca trocada para token `primary`) — não há
  checkbox no catálogo oficial do Design System v1; o botão "Marcar como
  resolvido" (Problemas Pendentes) manteve um verde sólido local — o
  `Button` oficial não tem variante semântica de sucesso (mesma lacuna já
  aceita para `Badge`/`Section` em telas anteriores); o input de arquivo
  XML manteve estilo nativo (sem componente de upload no catálogo).
- Preservado: as 7 rotas de API usadas (`/api/recebimento` GET/POST,
  `/api/recebimento/[id]`, `/api/recebimento/[id]/cancelar`,
  `/api/recebimento/importar-xml`, `/api/nfe/importar`,
  `/api/recebimento/problemas-pendentes`,
  `/api/recebimento/problemas-pendentes/resolver`), as 3 queries Supabase
  diretas (`nfe` para preview/listagem, `nfe_itens` para detalhe), o cálculo
  de progresso/percentual e o mapeamento de tom do `Progress`
  (concluído/parcial/vazio, D-057), a lógica de detecção de divergências por
  NF, a paginação (20/página, backend inalterado), a janela de 90 dias na
  importação por data, a auto-busca de NFs ao completar o período na
  criação de recebimento, e todas as métricas calculadas do Dashboard.
  Nenhuma regra de negócio, cálculo de volumes, timer, finalização,
  `matic_sku` ou integração com Google Sheets foi tocada — nada disso existe
  nesta rota (vive em `/recebimento/[id]`, fora do escopo).
- QA técnico: `npx eslint` no arquivo sem problemas; `npx tsc --noEmit` sem
  erro novo (mesmo baseline pré-existente em arquivos não relacionados);
  suíte `src/lib/design-system` 68/68; `git diff --check` sem problema de
  espaço em branco; `git status`/`git diff --stat` confirmando que só
  `src/app/recebimento/PageClient.tsx` foi alterado dentro de
  `src/app/recebimento/`.
- QA visual: não foi possível abrir `/recebimento` autenticado nesta sessão
  — a conta técnica disponível não tem acesso ao módulo `recebimento`
  (mesma limitação já registrada em `/hub-vendas` e outras telas da fila:
  `checkModuleAndWindowAccess`/`isMaticEmail` redirecionam para
  `/dashboard`). Sem indício de quebra a partir de lint/typecheck/testes.
  Validação visual manual (desktop e 375px, os 4 modais, as 4 abas, os
  estados vazio/carregando/erro) permanece pendente do usuário, sem
  bloqueio técnico.
- **Confirmação explícita:** `/recebimento/[id]` **NÃO FOI MIGRADO NEM
  ALTERADO NESTA TAREFA** — nenhum arquivo exclusivo dessa rota foi lido
  para edição, nenhum componente compartilhado com ela existe nesta rota
  raiz (acoplamento real = zero, confirmado antes e depois da migração), e
  nenhuma regra funcional usada por `[id]` foi tocada.
- Próximo passo: aguardar validação manual do usuário (layout geral,
  filtros, cards/indicadores, os 4 modais, paginação, estados vazio/
  carregando/erro, responsividade, ações principais, e ausência de qualquer
  regressão em `/recebimento/[id]`).

## Referências

- [PLANO.md](PLANO.md) — fases e ordem da fila.
- [DECISOES.md](DECISOES.md) — decisões D-042 a D-046.
- [ESCOPO.md](ESCOPO.md) — contrato do projeto.
- [Foundations](../../design-system/foundations.md),
  [components e patterns](../../design-system/components-e-patterns.md) e
  [interaction standards](../../design-system/interaction-standards.md).
