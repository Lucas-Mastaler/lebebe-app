# Interaction Standards — Design System v1

Regras de **comportamento** — como o sistema reage, não como aparece.
Design System não é só aparência: um agente/dev que só olhar `Button`/
`Card` e ignorar este documento vai implementar a tela errada mesmo
usando os componentes certos.

Todas as regras abaixo estão aprovadas (`docs/projetos/design-system/DECISOES.md`).
Nenhuma é uma sugestão.

## Filtros

**Regra fixa (`FLT-EXEC=MANUAL`):**

> Alterar os campos de filtro **NÃO** atualiza os resultados. O usuário
> escolhe/preenche os filtros, clica em **Filtrar**, e só então os
> resultados são atualizados.

Não dispare a consulta principal por `change`, `blur`, seleção, alteração
de data ou digitação em nenhum campo de filtro. Use `FilterPanel` +
`useFilterState` (`src/components/design-system/FilterPanel.tsx`) — a
API estrutural não tem como disparar consulta em `SET_FIELD`, só em
`APPLY` (testado em `src/lib/design-system/filters.test.ts`).

**Exceção explícita:** componentes cujo propósito é busca instantânea —
`Combobox` (`CMB=B`) e qualquer campo explicitamente definido como busca
instantânea. Não confunda com filtro de tela.

**Limpar filtros (`FLT-CLR=C`):** zera os campos **e** já reconsulta a
listagem imediatamente (volta ao estado inicial completo). "Limpar" nunca
altera o estado de expandido/recolhido do painel (ver `FLT-COLLAPSE=A`
abaixo) — só os valores dos campos.

**Painel colapsável (`FLT-COLLAPSE=A`, 2026-09-15):** `FilterPanel` pode
ser recolhido e reaberto pelo próprio usuário, para liberar espaço visual
depois de já ter aplicado os filtros desejados.

> O painel inicia **sempre expandido**. Só um clique explícito do usuário
> no botão "Recolher"/"Mostrar filtros" muda esse estado — nenhuma outra
> ação (aplicar filtro, limpar filtro, carregar a página, trocar de aba)
> expande ou recolhe o painel sozinha.

Reabrir mostra o conteúdo de volta dentro do mesmo painel, com os valores
de `draft` exatamente como estavam (recolher é só uma questão de
apresentação — não limpa, não reseta, não perde nenhum campo digitado).
"Limpar" continua visível e funcional mesmo com o painel recolhido — não
depende dos campos estarem à vista. Este é um estado de UI local ao
componente, não uma alteração de regra de consulta: `FLT-EXEC=MANUAL`
continua valendo exatamente igual, recolhido ou expandido.

**Ação principal à direita (`FILTER-ACTION-ALIGN=A`, 2026-09-15):**
"Filtrar" fica sempre ancorado ao final/direita do rodapé do painel,
independente da quantidade de campos ou do tamanho da tela — nunca preso
numa célula da grade de filtros, nunca no canto esquerdo por acidente de
layout.

## Formulários e validação

**Quando validar (`VAL=C` — progressiva):** o erro de um campo só aparece
a primeira vez ao sair do campo (blur) depois de interação — nunca antes
disso, nunca em campo vazio que o usuário ainda não tocou. Uma vez
visível, o erro some em tempo real assim que o valor volta a ficar válido
(não precisa de novo blur). Lógica em
`src/lib/design-system/validation.ts` (`computeFieldError`).

**Apresentação de erros (`ERR=C` com o ajuste aprovado — três casos distintos):**

1. **Erro de campo:** sempre mostrar (a) estado visual de erro no campo,
   (b) mensagem inline imediatamente abaixo, associada via
   `aria-describedby`/`aria-invalid` (nunca só cor/borda). Implementado
   por `FormField`.
2. **Vários erros simultâneos:** além dos erros inline, mostrar um
   **resumo no topo do formulário** (`FormErrorSummary`) — informa que há
   problemas, permite focar o campo correspondente quando aplicável.
   O resumo **complementa**, nunca substitui, os erros inline.
3. **Erro de servidor/integração:** **nunca** é erro de campo. Usa um
   banner de operação (`Alert tone="danger"`), com mensagem genérica e
   seguro (`src/lib/design-system/errors.ts`, `serverErrorMessage`) —
   nunca stack trace, payload interno ou detalhe técnico para o usuário
   operacional.

**Campos obrigatórios e opcionais (`REQ=C`):** obrigatório sempre leva
`*` no label (`Nome *`); opcional sempre leva `(opcional)` explícito
(`Observações (opcional)`) — os dois marcados, sem ambiguidade em nenhum
campo. Label sempre visível; placeholder nunca substitui label.

**Máscaras e formatos (`MSK=C` — progressiva):** formatação aparece
conforme os dígitos avançam, sem separador fixo antes da hora. Ver
`src/lib/design-system/masks.ts` para CPF/CNPJ/telefone/CEP/moeda/
percentual/data/hora/quantidade/decimal — cada máscara separa o **valor
exibido** do **valor normalizado** (ex.: CPF exibido `123.456.789-00`,
normalizado como string de 11 dígitos). Colar um valor já formatado deve
ser normalizado antes de reaplicar a máscara.

## Salvar / enviar

**Regra fixa (`SAV=A` com ajuste obrigatório):**

> Ao iniciar salvamento/envio, o botão acionado entra em loading visual,
> fica bloqueado para novos acionamentos, impede duplo clique/múltiplos
> envios, e continua reconhecível como a ação em execução.

```
ANTES:    [ Salvar ]
DURANTE:  [ ⟳ Salvando... ]   ← botão desabilitado, não apenas "com spinner ao lado"
```

Depois: sucesso aplica o padrão de feedback aprovado (`FDB=C`, inline
perto da ação); erro libera a ação de novo para nova tentativa. Vale para
Salvar, Criar, Atualizar, Enviar, Confirmar — qualquer ação com
processamento assíncrono.

Use `useAsyncAction` + `<Button loading={...}>` — não implemente essa
regra à mão em cada tela (ver `components-e-patterns.md`).

## Alterações não salvas

**`UNS=B`:** ao tentar fechar/sair com um formulário alterado, mostrar um
indicador inline discreto ("Alterações não salvas") + um botão
"Descartar" explícito — **sem modal**. Sem alterações, a ação de
fechar/sair acontece direto, sem perguntar nada (evitar confirmação
desnecessária). Componente: `UnsavedChangesNotice`.

## Ações destrutivas

**`DST=A`:** confirmação padrão (modal) para ações destrutivas —
`ConfirmDialog`. Diferencie:

- **Reversível** (ex. mover para lixeira com "desfazer" disponível por um
  tempo): pode dispensar confirmação modal.
- **Irreversível**: sempre confirmar via modal.
- **Crítica** (ex. excluir em definitivo, cancelar contrato): confirmar
  via modal, considerar exigir uma ação extra (digitar o nome do item).

Não use confirmação para qualquer ação trivial.

## Feedback

- **Ação pontual (salvar, criar, atualizar) → `FDB=C`:** mensagem inline
  perto da própria ação, sem popup. **Não é toast** — a escolha aprovada
  foi especificamente a mensagem inline.
- **Banner persistente (erro de servidor, aviso que deve continuar
  visível) → `Alert` (`FBK=A`):** borda + fundo claro, tom semântico.
- **Não duplique feedback** — uma ação não deveria emitir inline **e**
  banner **e** alteração de estado do card ao mesmo tempo para o mesmo
  evento.
- **Loading institucional:** `LoadingLeBebe` para página, módulo, seção
  relevante ou espera central perceptível (48/64/96px). Não cabe em botão,
  filtro, paginação nem em toda chamada de API.
- **Loading compacto:** `Spinner` para ação pontual e áreas pequenas
  (16/20/24px), inclusive dentro do botão via `loading`.
- **Loading estrutural:** `Skeleton`/`SkeletonRows` quando o formato do
  conteúdo é conhecido (cards, tabelas, listas, KPIs e detalhes), preservando
  o layout durante a busca.
- **Progresso real:** `Progress` quando há percentual/etapa mensurável; uma
  animação indefinida não substitui a informação determinística.
- **Operação rápida:** não mostre feedback indeterminado só por padrão. Use
  `useDelayedVisibility` (200ms por default) no contêiner de estado quando o
  atraso for apropriado, sem espalhar timers.
- **Empty state (`EST=B`):** ícone em círculo tonal + título + descrição +
  ação — nunca deixe uma lista vazia sem nenhuma orientação.

## Status

**`STA=A`:** pílula suave (`Badge`), tom semântico — o significado nunca
depende só da cor (o texto do badge já é a informação; a cor reforça).
Este DS não mapeia status de negócio para tom automaticamente — cada tela
decide.

## Navegação e teclado

- **`KBD=A`:** Enter em um campo de formulário envia o formulário
  (comportamento padrão do navegador) — não interceptar para "avançar
  campo" sem motivo forte.
- **Padrão técnico, não uma decisão** (já garantido pelos componentes
  Radix usados no projeto — `ui/dialog.tsx`, `ui/popover.tsx`,
  `ui/select.tsx`): Escape fecha modal/popover/dropdown aberto; Tab/
  Shift+Tab seguem a ordem lógica do DOM; foco inicial de um modal vai
  para o primeiro elemento focável; ao fechar um modal/popover, o foco
  volta para o elemento que o abriu. Não sobrescreva esse comportamento
  sem motivo documentado.

## Combobox / autocomplete

**`CMB=B`:** busca ao vivo com debounce; enquanto carrega, mostra
**skeleton dentro do dropdown** (não um ícone discreto no campo). Mínimo
de 2 caracteres antes de buscar; trata explicitamente nenhum resultado,
erro da consulta, limpar seleção e texto digitado que não corresponde a
nenhuma opção válida. Ver `Combobox` em `components-e-patterns.md`.
**Não muda `FLT-EXEC=MANUAL`** — combobox pesquisar ao vivo é permitido
porque seu propósito é esse; filtro de tela continua exigindo "Filtrar".

## MultiSelect / overlays de filtro

Todo o trigger do `MultiSelect` é clicável, inclusive o texto, a área vazia e
a seta. Ele deve ser um único controle de abertura — nunca envolva botões de
remover/checkbox dentro de outro botão. Para escapar do clipping geométrico
de `FilterPanel` ou outro container colapsável, o menu usa
`PopoverContent` com Portal e collision detection, não um `z-index` alto.
Menus longos limitam a própria altura e rolam internamente sem aumentar a
altura do painel de filtros.

## Datas e períodos

**`DAT=A` com o ajuste aprovado:** o campo de data sempre permite os dois
caminhos — **digitação manual** (`dd/mm/aaaa`, formato brasileiro) **e**
um **ícone de calendário clicável** que abre o `Calendar` (Popover).
Nenhum dos dois pode ser removido; o ícone tem `aria-label`, área clicável
adequada e não é meramente decorativo (é o único jeito de abrir o
calendário, então precisa funcionar de verdade — ver `DateField`).
Selecionar uma data no calendário também atualiza o texto digitado.

Validações (todas em `src/lib/design-system/dates.ts`, testadas):
data inválida → mensagem inline; limites mínimo/máximo → dias desabilitados
no calendário + mensagem se digitado fora do limite; período com data
final anterior à inicial → mensagem específica.

## Tabelas e listagens

**`TBL=B` (visual, já aprovado — não mexer) + `ROW=A`:** ações de linha
sempre visíveis numa coluna de ação (não reveladas só no hover — pior
para touch). Ver `ResponsiveTable`.

### Paginação de listagens (TABLE-PAGE-SIZE=20, regra global, aprovada em 2026-09-12)

**Regra:** listagens/tabelas de dados paginadas do sistema usam no máximo
**20 registros por página** (`TABLE_PAGE_SIZE`,
`src/lib/design-system/pagination.ts`). Sem seletor de
10/25/50/100 — navegação simples via Anterior/Próxima. Mesma paginação
para desktop e mobile (mesma página de dados, não busca conjuntos
diferentes por breakpoint). Não se aplica a tabelas estáticas pequenas ou
conteúdo meramente informativo embutido sem paginação.

**Backend-enforced:** o limite é aplicado no BACKEND — a requisição
paginada nunca retorna mais que 20 para o frontend cortar localmente
(`clampPageSize()`, mesmo módulo, ignora um valor maior pedido pelo
cliente). Comportamento esperado:

- página inicial = 1;
- aplicar um novo filtro → volta para a página 1 (antes uma recomendação
  técnica não confirmada; agora regra aprovada);
- "Limpar filtros" → volta para a página 1;
- a navegação solicita só a página necessária (não pré-carrega páginas
  futuras);
- a alternância de linhas (zebra, ver `foundations.md`) pode reiniciar a
  cada página — não precisa manter paridade global.

Exemplo real: `/chamados-finalizados` (`src/app/api/chamados-finalizados/pesquisar/route.ts`
+ `src/lib/digisac/chamadosFinalizados.ts`) — ver `components-e-patterns.md`.

**Payload paginado × processamento interno (esclarecido em 2026-09-13,
D-039) — não confunda os dois:** listagens paginadas exibem e retornam ao
cliente no máximo 20 itens por página; o limite se aplica à COLEÇÃO FINAL
paginada que chega ao frontend. Processamentos internos do backend podem
trabalhar com conjuntos maiores quando necessário para agregação,
cálculo, deduplicação ou outra regra de negócio — desde que isso não
resulte em envio desnecessário desses dados ao frontend. Errado: buscar
500 registros simples e fatiar 20 no frontend. Correto: processar 200
registros de uma fonte externa para formar (agregar) 38 entidades, então
paginar essas 38 e enviar só os 20 da página pedida — exatamente o que
`/chamados-finalizados` já faz (lote de até 200 tickets do Digisac
agregados por contato, resposta final limitada a `TABLE_PAGE_SIZE`).

### Tabelas horizontais — arrastar com o mouse (regra global, 2026-09-12)

**Regra:** tabelas com overflow horizontal aceitam **todos** estes
métodos de navegação ao mesmo tempo — nenhum exclui os outros:

- scrollbar nativa (`overflow-x-auto`, nunca escondida);
- trackpad (scroll horizontal nativo);
- touch (swipe nativo — `touch-action: pan-y` libera o eixo vertical
  para o navegador, o eixo horizontal é interceptado pelo mesmo
  Pointer Event do mouse, já que Pointer Events unificam mouse/touch/caneta);
- **arrastar com o mouse** (clicar/segurar numa área não-interativa e
  arrastar) — `ResponsiveTable` já ativa isso automaticamente, sem prop
  extra, via `useHorizontalDragScroll`.

**Generalizado a partir de uma implementação real já aprovada em
produção** (`/inteligencia-comercial`, `TabelaVendas.tsx`) — auditada no
piloto de `/chamados-finalizados`: Pointer Events, threshold de 5px antes
de considerar drag (evita interceptar clique/seleção de texto), lista de
seletores interativos (`button`, `a`, `input`, `select`, `textarea`,
`[role=button]`, `[data-no-drag]`, ...) que nunca iniciam drag, e captura
de ponteiro (`setPointerCapture`) para não perder o arraste se o cursor
sair do elemento. `/inteligencia-comercial` **não foi alterada** — a
lógica foi extraída para `useHorizontalDragScroll`
(`src/components/design-system/`) + funções puras testadas em
`src/lib/design-system/horizontal-drag-scroll.ts`.

**Cursor:** `grab` durante disponibilidade, `grabbing` durante o
arraste — mas **só quando há overflow de verdade**
(`scrollWidth > clientWidth`, reavaliado via `ResizeObserver`). Sem
overflow, a tabela é uma tabela normal — sem cursor especial, sem lógica
de drag ativa.

**Nunca intercepta:** cliques em links, botões, checkbox, input, select,
textarea, dropdown, menu, ações de linha — a lista de exclusão roda
`Element.closest()` no alvo do `pointerdown` antes de decidir se inicia
o drag.

**Teclado:** não afetado — o drag é só ponteiro (mouse/touch/caneta);
navegação por Tab/foco continua exatamente como o `Table`/`ui/` já
fornecia, sem mudança.

**Cabeçalho fixo (`stickyHeader`) — revisado duas vezes em 2026-09-12:**
ao testar de verdade contra a estrutura de clipping, descobriu-se que uma
tabela com scroll horizontal nunca consegue ficar com o cabeçalho preso à
rolagem da PÁGINA inteira (limitação do CSS — qualquer elemento com
`overflow-x: auto` força o navegador a também tratar o eixo vertical como
não-`visible`, o que intercepta `position: sticky`). A primeira correção
dava à tabela um scroll vertical interno limitado (`max-h-[70vh]`) para
que o cabeçalho ficasse fixo relativo a ESSE scroll — o usuário testou e
reprovou (gera "scroll dentro de scroll": o mouse precisa terminar o
scroll interno da tabela antes de continuar rolando a página). Removido
(ver `foundations.md`, "TABLE-NO-INTERNAL-VSCROLL") — `stickyHeader`
continua aceito como prop, sem quebrar nenhum consumidor, mas não tem
mais efeito de fixação visível: é um no-op seguro nesta arquitetura,
compensado pela paginação de no máximo 20 linhas (o cabeçalho nunca fica
muito longe do topo).

**Linhas alternadas (`TABLE-ZEBRA=ON`, regra global, 2026-09-12):**
`ResponsiveTable` alterna a superfície das linhas por padrão (sutil,
nunca cor de marca/semântica) — ver `foundations.md` para a precedência
completa entre zebra, hover, seleção e estado específico da tela.

## Modais e painéis

**No accidental overlap (regra global, 2026-09-12):** ver `foundations.md`,
"No accidental overlap", para a regra completa e a causa raiz do bug
encontrado (disputa de `z-index` entre um header `sticky` e o botão
fechar em `/chamados-finalizados` → "Ver agendamentos"). Use sempre
`Dialog`/`DialogHeader`/`DialogBody` de `src/components/design-system/Dialog.tsx`
para qualquer modal novo — o header reserva espaço real para o botão
fechar via flexbox (`min-w-0 flex-1` + `shrink-0`), nunca via
`padding`/`z-index` calculados manualmente.

## Modais e drawers

**`MOD=A`:** modal para tudo — confirmações, formulários curtos e longos.
**Nenhum drawer foi implementado nesta fase** (não há decisão aprovada
que peça um — `MOD=A` escolheu especificamente "modal para tudo"). Se uma
tela futura precisar de um painel lateral, isso é uma decisão nova, não
uma extensão automática do DS v1.

Comportamento (herdado do Radix `Dialog` existente, não alterado): fecha
pelo X, por Escape, por clique fora — **exceto** quando há alteração não
salva (nesse caso, aplicar `UNS=B` antes de fechar, não simplesmente
ignorar o clique fora). Loading trava os botões de ação do rodapé
(mesmo princípio de `SAV=A`).

## Permissões

**`PER=A`:** esconder completamente ações que o usuário não tem
permissão para executar — o botão/menu nem aparece. Isto é só o padrão de
**UX** — o backend continua sendo responsável pela autorização real; a
interface nunca é a única barreira.

## Mobile

**`MOB=A`:** ação principal fixa numa barra no rodapé (`MobileActionBar`,
`sticky bottom-0`, só visível abaixo do breakpoint `md`), independente do
scroll. Válido para qualquer tela com uma ação principal clara (salvar
formulário, confirmar, etc.) — não crie uma barra fixa para ações
secundárias.

Não existe um Design System mobile separado — os mesmos componentes
(`PageHeader`, `FilterPanel`, `ResponsiveTable`, `FormSection`, `Dialog`)
já se comportam de forma responsiva.

## Affordances e contenção

- Elemento realmente interativo usa `cursor-pointer`; isso se aplica ao
  controle dentro da célula, nunca à linha inteira sem ação. O scroller do
  `ResponsiveTable` preserva `grab`/`grabbing` para drag horizontal.
- Dialogs não ultrapassam a viewport: header e fechar ficam acessíveis e só
  o body rola por padrão. Scroll interno adicional exige lista limitada
  real — ver `SCROLL-BOUNDED-LIST` em `components-e-patterns.md` (quando
  usar, quando não usar, e a distinção com `TABLE-NO-INTERNAL-VSCROLL`).
- Wizard/formulário com action bar fixa reserva no conteúdo a altura medida
  da barra mais um gutter; não usa margem no último campo.
