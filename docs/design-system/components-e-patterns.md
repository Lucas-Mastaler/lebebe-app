# Components & Patterns — Design System v1

Todos em `src/components/design-system/` (patterns em `patterns/`
dentro da mesma pasta). Importe via `@/components/design-system` (barrel
`index.ts`) ou diretamente do arquivo.

## Ações

### `Button` / `IconButton` — BTN=B

Sistema tonal: `primary` (sólido), `secondary`/`destructive` (fundo suave,
tonal), `ghost` (neutro). `size`: `default`, `sm`, `lg`, `icon`.

```tsx
<Button variant="primary">Salvar pedido</Button>
<Button variant="secondary">Cancelar</Button>
<Button variant="destructive">Excluir</Button>
<IconButton aria-label="Editar"><Pencil /></IconButton>
```

**Loading = SAV=A com ajuste:** `loading` desabilita o botão e mostra
spinner — é a implementação, não decoração. Sempre combine com
`useAsyncAction`:

```tsx
const save = useAsyncAction(async () => { await api.save(payload) })
<Button loading={save.loading} onClick={() => save.run()}>Salvar pedido</Button>
```

Enquanto `save.loading` for `true`, o botão está `disabled` de verdade —
um segundo clique não dispara `run` de novo (ver
`src/lib/design-system/async-action.ts`, testado em `async-action.test.ts`).

## Containers

### `Card` / `CardHeader` / `CardContent` / `CardFooter` — CRD=C, SHD=C

Cabeçalho tonal (fundo `bg-primary/5`, ícone + título + descrição
opcional) + elevação por glow.

```tsx
<Card>
  <CardHeader icon={<Package />} title="Identificação" description="Dados do pedido" />
  <CardContent>...</CardContent>
  <CardFooter><Button>Salvar</Button></CardFooter>
</Card>
```

## Navegação

### `PageHeader` — HDR=A

```tsx
<PageHeader
  icon={<PackageSearch />}
  eyebrow="Pedidos personalizados"
  title="Gestão de pedidos"
  description="Consulte, revise e atualize pedidos no seu escopo."
  action={<Button>Novo pedido</Button>}
/>
```

### `SegmentedTabs*` — TAB=C

Reaproveita o `Tabs`/`TabsContent` do Radix já existente
(`src/components/ui/tabs.tsx`, não alterado); só troca o visual de
`TabsList`/`TabsTrigger` para o segmentado tonal aprovado.

```tsx
<Tabs defaultValue="abertos">
  <SegmentedTabsList>
    <SegmentedTabsTrigger value="abertos">Abertos</SegmentedTabsTrigger>
    <SegmentedTabsTrigger value="finalizados">Finalizados</SegmentedTabsTrigger>
  </SegmentedTabsList>
  <TabsContent value="abertos">...</TabsContent>
</Tabs>
```

## Status e feedback

### `Badge` — STA=A

`tone`: `neutral` | `success` | `warning` | `danger` | `info` | `brand`.
Puramente visual — cada tela decide o que cada tom significa para o seu
domínio (o DS não mapeia status de negócio).

```tsx
<Badge tone="warning">Aguardando aprovação</Badge>
```

### `Alert` — FBK=A (visual) + usado no padrão ERR para erro de servidor

`tone`: `success` | `warning` | `danger` | `info`. Para banners
persistentes (erro de servidor, avisos que devem continuar visíveis) —
**não** é o mesmo caso de uso do feedback inline pontual (`FDB=C`, ver
[interaction-standards.md](interaction-standards.md)).

```tsx
<Alert tone="danger" title="Não foi possível salvar as alterações.">
  Tente novamente.
</Alert>
```

### Hierarquia de loading — Loading Le Bébé, `Spinner`, `SkeletonRows` e `Progress`

O Design System usa quatro níveis, escolhidos pelo contexto — nunca por
ornamento:

| Indicador | Use quando | Tamanho usual | Não use para |
|---|---|---:|---|
| `LoadingLeBebe` | página, módulo, seção grande ou espera central perceptível | 48 / 64 / 96px | botões, filtros, paginação e áreas compactas; 20–24px são apenas teste de robustez |
| `Spinner` | microinteração, ação local, modal ou pequena área | 16 / 20 / 24px | carregamento institucional de página/módulo |
| `Skeleton` / `SkeletonRows` | a estrutura de cards, tabela, lista ou detalhe já é conhecida | conforme o conteúdo | uma espera cujo formato ainda não pode ser previsto |
| `Progress` | existe percentual real mensurável | largura disponível | estimar ou inventar percentual |

Evite flicker: uma operação muito rápida não deve mostrar feedback
indeterminado. Para um estado local que realmente precise de atraso, use
`useDelayedVisibility(loading, 200)` no contêiner do estado — nunca timers
soltos em cada botão ou componente visual.

```tsx
<LoadingLeBebe size={64} label="Carregando Gestão Hub/Vendas" />
<Spinner size={20} label="Atualizando status" />
<SkeletonRows rows={5} />
<Progress value={67} label="Importando pedidos" showValue />
```

`LoadingLeBebe` não deve aparecer em toda chamada de API; seu valor é
institucional. `Spinner` permanece a escolha compacta. Em 32px, a estrela é
uma exceção visual; abaixo disso, prefira `Spinner`.

### `EmptyState` / `Spinner` / `SkeletonRows` — EST=B, LDG=A

```tsx
<EmptyState title="Nenhum pedido encontrado" description="Ajuste os filtros ou crie um novo pedido." action={<Button>Novo pedido</Button>} />
<SkeletonRows rows={5} />       {/* LDG=A: skeleton para conteúdo */}
<Spinner size={16} label="Salvando" />     {/* ação pontual */}
```

### `LoadingLeBebe` — indicador de marca em SVG

`LoadingLeBebe` é a estrela animada oficial da marca. É um SVG escalável,
sem imagem rasterizada, dependência nova ou animação em JavaScript. Use-o
quando a identidade de marca for desejada em uma área de espera explícita;
para carregamento de conteúdo e ações pontuais, preserve `SkeletonRows` e
`Spinner`, respectivamente. Tamanhos 20–24px na referência viva demonstram
robustez do SVG; em uso real compacto, prefira `Spinner`.

```tsx
<LoadingLeBebe size={48} />
<LoadingLeBebe size={96} label="Preparando seu pedido" />
```

`size` aceita número (pixels) ou unidade CSS, e `className` permite apenas
composição de layout/cor já baseada em tokens. O componente é transparente,
anuncia o `label` com `role="status"` e fica estático com
`prefers-reduced-motion`.

## Dados

### `KpiCard` — KPI=B

```tsx
<KpiCard label="Pedidos hoje" value="24" icon={<Package />} delta={{ value: '+12%', direction: 'up' }} />
```

Extensão genérica (achada na migração de `/hub-vendas`, 2026-09-15): telas
com muitas categorias de KPI (7+) precisavam diferenciar categoria/estado
sem espalhar cor ad hoc por métrica. Três props opcionais, aditivas:

```tsx
<KpiCard
  label="Erros"
  value={3}
  icon={<AlertCircle />}
  tone="danger"                 // 'neutral' (default) | 'success' | 'warning' | 'danger' | 'info' | 'brand' — mesmo vocabulário de Badge (STA=A)
  detail="12% do total"         // linha secundária opcional (percentual, detalhamento por loja, etc.)
  labelAction={<HelpTooltip />} // conteúdo extra ao lado do label (ex.: ícone de ajuda)
/>
```

`tone` resolve categorização visual através do MESMO vocabulário semântico
de `Badge`, em vez de cada tela inventar seu próprio mapa
`bg-sky-50`/`bg-violet-50`/etc. por métrica — consistente com Brand
Foundation ("brand colors ≠ semantic colors", nunca espalhar cor ad hoc).

### `ResponsiveTable` — TBL=B, ROW=A

Desktop: tabela real (reaproveita `Table` de `ui/table.tsx`). Mobile:
cards (reflow real, não redução). Ações de linha sempre visíveis
(`ROW=A`).

```tsx
<ResponsiveTable
  columns={[
    { key: 'cliente', header: 'Cliente', render: (r) => r.cliente },
    { key: 'status', header: 'Status', render: (r) => <Badge tone="info">{r.status}</Badge> },
  ]}
  rows={pedidos}
  rowKey={(r) => r.id}
  renderMobileCard={(r) => <><p className="font-semibold">{r.cliente}</p><p className="text-xs text-slate-500">{r.status}</p></>}
  rowActions={(r) => <IconButton aria-label="Ver"><Eye /></IconButton>}
  loading={loading}
  error={error}
/>
```

Não é um data-grid genérico (sem ordenação embutida) — paginação é
externa, controlada pela tela (ver "Paginação" abaixo). Ver pendências em
`README.md`.

**Extensões adicionadas no piloto de `/chamados-finalizados` (Fase 4,
2026-09-12), genéricas e opcionais (não quebram nenhum uso existente):**

- `rowClassName?: (row: Row) => string | undefined` — classe extra por
  linha (desktop e card mobile) — tipografia, borda, ou (caminho legado,
  quando `rowTone` não é usado) background de estado de negócio, que
  substitui o zebra dessa linha inteiramente.
- `rowTone?: (row: Row) => RowTone | undefined` **(novo, 2026-09-15,
  preferível a `rowClassName` para background de estado de linha)** —
  ver "Row tones" abaixo.
- `stickyHeader?: boolean` — mantida por compatibilidade. **Revisado em
  2026-09-12 (segunda vez)**: não ativa mais scroll vertical interno
  (`max-h-[70vh]` foi testado, o usuário reprovou — "scroll dentro de
  scroll" — e foi removido, ver TABLE-NO-INTERNAL-VSCROLL em
  `foundations.md`). A classe CSS `sticky` continua aplicada ao cabeçalho,
  mas sem efeito de fixação visível nesta arquitetura — é um no-op seguro,
  não uma feature funcional.
- `firstColumnSticky?: boolean` — fixa ao rolar horizontalmente a **primeira
  coluna declarada em `columns`**; não insere coluna, espaçador ou célula
  auxiliar. Portanto, a primeira definição deve ser um dado real (ou um
  controle operacional efetivamente necessário, como seleção). **Revisado em
  2026-09-14**: a célula sticky agora é sempre 100% opaca e acompanha a
  superfície real da linha (zebra ou `rowClassName`) — ver
  "TABLE-STICKY-OPAQUE" em `foundations.md`.
- `zebra?: boolean` (default `true`) — alternância sutil de superfícies
  entre linhas consecutivas (TABLE-ZEBRA=ON, ver `foundations.md`).
  Desative só quando realmente necessário.
- `columns[].width?: ColumnWidth` **(revisado em 2026-09-15)** —
  `'compact' | 'content' | 'standard' | 'wide' | 'fill'` (Column Sizing,
  ver `foundations.md`). Opcional — sem ele, a coluna mantém o
  comportamento anterior (só `className`). `content` é o papel novo para
  dado estruturado que precisa aparecer inteiro (nome de cliente,
  identificador) — cresce em vez de cortar/invadir a coluna seguinte
  (NO-CELL-OVERLAP).

```tsx
<ResponsiveTable
  columns={[
    { key: 'nome', header: 'Nome', width: 'content', render: (r) => r.nome },
    { key: 'loja', header: 'Loja', width: 'standard', render: (r) => r.loja },
    { key: 'obs', header: 'Observação', width: 'fill', render: (r) => r.observacao },
  ]}
  rows={rows}
  rowKey={(r) => r.id}
  rowTone={(r) => (r.semAgendamentoAberto ? 'dangerSubtle' : undefined)}
  firstColumnSticky
  renderMobileCard={(r) => ...}
/>
```

### Row tones — família + zebra interno (novo, 2026-09-15)

`rowTone` (preferível a `rowClassName` para background de estado de
linha) recebe o NOME de um tom (`RowTone` —
`src/lib/design-system/row-tones.ts`: `danger`/`dangerSubtle`/
`warning`/`success`/`info`) e o `ResponsiveTable` resolve sozinho:
paridade (zebra sobrevive dentro do estado — duas intensidades
`base`/`alternate`, nunca uma cor única uniforme para todas as linhas
naquele tom), opacidade (sempre sólida, `color-mix()` contra o token
semântico — nunca `bg-token/N` com alpha) e hover (embutido em cada
variante). A tela não precisa mais construir a classe de background —
só declara "esta linha está no tom X". `dangerSubtle` é uma intensidade
mais clara de `danger`, usada especificamente por
`/chamados-finalizados` (preferência daquela tela — não altera
`--destructive`). `rowClassName` continua aceito para classes que não
são background de estado (tipografia, borda) e, no caminho legado sem
`rowTone`, ainda pode conter background próprio (substitui o zebra
inteiramente, comportamento anterior preservado).

As classes de cada variante ficam declaradas literalmente no mapa do
componente, nunca interpoladas em runtime: esse é o requisito para o
Tailwind v4 emitir o CSS de `color-mix()` que torna tanto a linha quanto
a coluna sticky realmente opacas.

**Regra global — container clipping / TABLE-VIEWPORT-CLIP (revisada duas
vezes em 2026-09-12, após uso manual real):** superfícies internas
(cabeçalho, última linha, linha destacada, zebra) nunca "vazam" quadrado
sobre a silhueta arredondada do container, **em qualquer posição de
scroll horizontal** — ver `foundations.md`, "Container clipping /
TABLE-VIEWPORT-CLIP". Histórico: (1) radius direto nas células — resolvia
só o caso estático; (2) `clip-path: inset(0 round 1rem)` no shell —
resolveu o scroll, mas usava um raio (16px) diferente do container real
(`rounded-2xl` = 20px), deixando os cantos "apagados" (bug real,
confirmado por inspeção); (3) versão atual: três camadas — OUTER SHELL
(só borda/radius, sem overflow/clip), INNER CLIP (`overflow-hidden
rounded-2xl`, MESMA classe de radius do OUTER, nunca um valor solto),
HORIZONTAL SCROLLER (`overflow-x-auto`) — testado com scroll totalmente à
esquerda/meio/direita, `getComputedStyle` confirmando radius/borda
idênticos nas três posições.

**Regra global — sem scroll vertical interno (TABLE-NO-INTERNAL-VSCROLL,
2026-09-12):** a página rola verticalmente; a tabela nunca tem scrollbar
vertical própria. Ver `foundations.md` para o motivo técnico completo
(por que isso também mudou o comportamento de `stickyHeader`).

**Regra global — linhas alternadas (TABLE-ZEBRA=ON, revisada em
2026-09-15):** `bg-white`/`bg-slate-50` (sólidas, sem alpha, com hover
próprio também sólido) por padrão. `rowTone` mantém zebra DENTRO do
estado (duas intensidades `base`/`alternate` da mesma família); sem
`rowTone`, `rowClassName` (legado) ainda pode substituir o zebra
inteiramente. Ver `foundations.md` para a precedência completa
(row-state > seleção > paridade zebra > hover > sticky usa a superfície
final) e para a distinção "Badge de status em célula não remove zebra
automaticamente" (achado real no uso manual de `/chamados-finalizados`).

**Regra global — sticky column opaca (TABLE-STICKY-OPAQUE, revisada em
2026-09-15):** bug real confirmado em uso manual — a coluna sticky
deixava conteúdo rolável "aparecer através" dela quando a superfície da
linha usava opacidade. Corrigido tornando zebra/`row-tones` (inclusive o
hover de ambos) sempre sólidos. Ver `foundations.md` para a hierarquia
de `z-index` e o divisor condicional.

**Regra global — NO-CELL-OVERLAP / Column Sizing (2026-09-15):**
conteúdo de célula nunca pode pintar sobre a coluna adjacente. Bug real
confirmado — "Nome Digisac" invadindo "Loja" em `/chamados-finalizados`,
causado por um papel de largura com `max-w` + `nowrap` sem
`whitespace-normal`. Corrigido: todo papel com `max-w` agora sempre
quebra linha; novo papel `content` para dado estruturado que precisa
crescer sem cortar. Ver `foundations.md` para a lista completa dos 5
papéis.

**Regra global — arrastar com o mouse (achada no piloto, 2026-09-12):**
sempre que a tabela tiver overflow horizontal de verdade
(`scrollWidth > clientWidth`), `ResponsiveTable` já ativa
`useHorizontalDragScroll` automaticamente — nenhuma prop adicional
necessária. Ver `interaction-standards.md`, "Tabelas horizontais",
para o comportamento completo (mouse, trackpad, touch, teclado, exclusão
de elementos interativos).

### `Section` — SEC=C (oficial desde 2026-09-12)

`src/components/design-system/Section.tsx` — seção temática com título,
descrição opcional, ícone opcional, um dos 3 tons auxiliares (`tone`,
CLR=B — `section-1`/`section-2`/`section-3`, de
`src/lib/design-system/section-tones.ts`) e conteúdo livre. Não amarrado
a nenhum módulo — a tela escolhe qual tom usar para qual assunto.

Para blocos extensos dentro de uma Section principal, use
`variant="subsection"` junto de `collapsible`. A variante mantém o mesmo
contrato de expansão, mas reduz o peso visual para uma surface neutra,
header menor e divisor sutil. O conteúdo não desmonta ao recolher, portanto
seus estados locais permanecem intactos. Não use subseções para criar uma
segunda camada de cards equivalentes à Section pai.

```tsx
<Section tone="section-1" icon={<User className="size-4" />} title="Dados do cliente">
  <FormField ...>...</FormField>
</Section>
```

Auditado a partir de `/inteligencia-comercial`
(`ModalDetalheVenda.tsx`, componente `Section` interno — já aprovado em
produção). `/inteligencia-comercial` **não foi migrada** para este
componente — continua com sua própria implementação, serviu só de
referência.

**Tons finais (Brand Foundation, 2026-09-13):** `section-1`=azul da marca
(Tailwind `blue`), `section-2`=ciano da marca (Tailwind `cyan`),
`section-3`=amarelo da estrela (Tailwind `yellow`, texto neutro
`slate-800` em vez de `yellow-800` para não "ler" como `warning`). Ver
`docs/design-system/foundations.md`, "Brand Foundation" e "Brand ×
Semantic", para a origem dos tokens e a distinção formal de `info`/
`warning`.

### Paginação — TABLE-PAGE-SIZE=20 (regra global, 2026-09-12)

`src/lib/design-system/pagination.ts` — `TABLE_PAGE_SIZE = 20` e
`clampPageSize(requested)` (`Math.min(requested, 20)`, nunca confia no
valor pedido pelo cliente). `ResponsiveTable` não pagina sozinho — a tela
controla `page`/navegação e passa só a página atual em `rows`; o limite
de 20 é aplicado no BACKEND de cada endpoint paginado. Ver
`interaction-standards.md`, "Paginação de listagens", para o
comportamento completo, e o exemplo real em `/chamados-finalizados`
(`src/app/api/chamados-finalizados/pesquisar/route.ts` +
`src/lib/digisac/chamadosFinalizados.ts`).

### `FilterPanel` + `useFilterState` — FLT=A, FLT-EXEC=MANUAL, FLT-CLR=C, FLT-COLLAPSE=A

```tsx
const filters = useFilterState({ cliente: '', status: 'todos' })

<FilterPanel
  title="Filtros"
  dirty={filters.dirty}
  onApply={() => buscar(filters.applied)}
  onClear={filters.clear}
  applyDisabled={!filtrosValidos}
>
  <FilterFieldGroup label="Busca" icon={<Search className="size-4 text-slate-400" />}>
    <input value={filters.draft.cliente} onChange={(e) => filters.setField('cliente', e.target.value)} />
  </FilterFieldGroup>
</FilterPanel>
```

`setField` **nunca** dispara a busca — só altera `draft`. A tela só deve
observar `filters.applied` para decidir o que buscar, e só `onApply`
(clique em "Filtrar") deve disparar a consulta. Isso é estrutural, testado
em `src/lib/design-system/filters.test.ts`. `applyDisabled` (adicionado no
piloto de `/chamados-finalizados`) desabilita só o botão Filtrar — os
campos continuam editáveis — para o caso de campo obrigatório ainda
incompleto/inválido.

**Regra global — grid de campos preenche a linha (achada no piloto,
2026-09-12):** `FilterFieldGroup` distribui os campos com flexbox
(`flex-wrap` + `flex-1` por campo, mínimo 220px) — nunca deixa coluna
vazia quando há poucos campos, e a última linha (quando quebra) também
estica para ocupar a largura toda. Ver `foundations.md`, "Filter layout",
para o porquê de não ser CSS Grid `auto-fit` (ele não resolve a última
linha incompleta). Nenhuma prop nova — o comportamento é automático para
qualquer `FilterFieldGroup`.

**Painel colapsável — FLT-COLLAPSE=A (regra global, 2026-09-15):**
`FilterPanel` gerencia sozinho um estado interno `expanded` (default
`true`, sem prop nova nem callback externo — puramente de apresentação,
não faz parte de `useFilterState`/`draft`/`applied`). Um botão com
chevron + rótulo ("Recolher"/"Mostrar filtros"), ao lado de "Limpar",
alterna esse estado; ao recolher, os campos, o botão "Filtrar" e o aviso
de "Filtro alterado" somem visualmente (o `draft` continua intacto por
baixo), sobrando só o cabeçalho (título + Limpar + o próprio botão de
expandir). Reabrir mostra o conteúdo de volta, no mesmo painel, com os
valores exatamente como estavam. Regras: inicia sempre expandido; nunca
se recolhe sozinho (nem depois de `onApply`, nem por qualquer efeito
colateral — só o clique explícito do usuário muda `expanded`); "Limpar"
continua acessível mesmo recolhido (ação de baixo risco, não depende dos
campos estarem visíveis). Não introduz nenhuma prop nova em
`FilterPanelProps` nem altera a assinatura de `useFilterState` — é
comportamento interno do componente, automático para toda tela que já
usa `FilterPanel` (validado em `/pedidos-personalizados`,
`/chamados-finalizados`, `/dashboard`; `/hub-vendas` usa o mesmo
componente sem override de estilo, então herda automaticamente).

**Superfície do painel — ajuste de contraste (2026-09-15):** a superfície
base do `FilterPanel` (não a de `FilterFieldGroup`/campos internos) subiu
de `border-sky-100 bg-sky-50/40` para `border-sky-200 bg-sky-50/70` — a
mesma família de cor (ciano muito claro da marca), só um pouco mais
presente contra o fundo da página (`--background`), que antes deixava o
painel quase se confundir com o restante da tela. Ajuste discreto (mesma
paleta, sem token novo, sem mudança de radius/sombra) — não é o mesmo
caso de um `rowTone`/estado semântico; é só a superfície neutra padrão do
painel de filtros ficando um pouco mais legível.

**Ação principal alinhada à direita — `FILTER-ACTION-ALIGN=A` (2026-09-15):**
o botão "Filtrar" (ação principal do painel) fica ancorado ao final/
direita da área de ações do rodapé (`justify-end`), independente de
quantos campos existem — nunca preenche uma célula vazia da grade de
`FilterFieldGroup`. O aviso "Filtro alterado" (quando `dirty`), por ser
uma informação secundária, vem antes do botão dentro do mesmo grupo
alinhado à direita — nunca à esquerda sozinho. Em telas estreitas o grupo
pode quebrar linha (`flex-wrap`), mas continua terminando no lado direito
disponível; não existe um caminho de layout que devolva o botão ao canto
esquerdo. `FLT-EXEC=MANUAL` inalterado — é só reposicionamento visual do
mesmo botão.

### `MultiSelect` — trigger inteiro e overlay portalizado

`src/components/ui/multi-select.tsx` é o MultiSelect compartilhado atual.
Seu trigger é um único `button` semanticamente válido: texto, espaço vazio e
seta abrem o mesmo Popover, sem `button` aninhado. O conteúdo usa
`PopoverContent`, que porta para fora de containers com `overflow-hidden`
(como `FilterPanel`), respeita colisão com a viewport e limita a própria
altura; somente a lista de opções rola quando necessário. A seleção múltipla,
checkboxes, teclado e ação `Limpar` continuam disponíveis.

## Formulários

### `FormField` — REQ=C, ERR (campo)

Render-prop: recebe os atributos de acessibilidade já prontos para
qualquer controle (`Input` de `ui/`, `DateField`, `Combobox`, etc.).

```tsx
<FormField id="nome" label="Nome" required error={erros.nome}>
  {(f) => <Input {...f} value={nome} onChange={(e) => setNome(e.target.value)} />}
</FormField>
<FormField id="obs" label="Observações" helper="Opcional, até 200 caracteres.">
  {(f) => <Textarea {...f} />}
</FormField>
```

### `FormErrorSummary` — ERR (resumo no topo)

Só renderiza quando há erro; complementa (não substitui) os erros
inline de cada `FormField`.

```tsx
<FormErrorSummary errors={erros} onFocusField={(campo) => document.getElementById(campo)?.focus()} />
```

### `DateField` — DAT=A com ajuste

Digitação manual (`dd/mm/aaaa`) **e** ícone de calendário clicável —
nenhum dos dois é removível.

```tsx
<FormField id="data" label="Data de entrega" error={erros.data}>
  {(f) => <DateField {...f} value={data} onChange={setData} min={hoje} />}
</FormField>
```

### `Combobox` — CMB=B

Busca ao vivo (debounce + skeleton no dropdown) — **não** é filtro de
tela, `FLT-EXEC=MANUAL` não se aplica aqui.

```tsx
<Combobox value={cliente} onChange={setCliente} onSearch={(q) => api.buscarClientes(q)} minChars={2} />
```

### `Input` — INP=A (com o ajuste de superfície de 2026-09-11)

Mesmo visual bordado de `ui/input.tsx` (`ui/` não alterado), com
superfície `bg-input-background` (ver `foundations.md`, "Superfície de
campo"). É o `Input` a usar em componentes novos do DS — `ui/input.tsx`
continua existindo para as telas que já o usam.

```tsx
import { Input } from '@/components/design-system'
<Input placeholder="Nome do cliente" />
```

### `Textarea`

Mesmo visual bordado + mesma superfície do `Input` — arquivo próprio
porque `ui/` não tinha textarea.

## Layout

### `PageContainer` (patterns/) — Foundation de layout (2026-09-11)

Ver `foundations.md`, "Layout / Page Shell", para a regra completa
(100% da área útil, gutters 16/24/32px, sem `max-width` na página).

```tsx
import { PageContainer, PageHeader, FilterPanel, ResponsiveTable } from '@/components/design-system'

<PageContainer>
  <PageHeader title="Pedidos" />
  <FilterPanel ...>...</FilterPanel>
  <ResponsiveTable ... />
</PageContainer>
```

### `FormPageContent` (patterns/) — FORM-PAGE-WIDTH

Para criação, edição, cadastro e configuração predominantemente de
formulário, envolva header e sections no mesmo `FormPageContent`. Ele
centraliza somente esse conteúdo com `w-full max-w-6xl mx-auto`; não
altera o `PageContainer` e não deve envolver tabelas/listagens largas.

```tsx
<PageContainer className="space-y-6">
  <FormPageContent className="space-y-6">
    <PageHeader title="Novo pedido" />
    <FormSection title="Identificação">...</FormSection>
  </FormPageContent>
  <ResponsiveTable ... />
</PageContainer>
```

## Patterns (composições)

### `FormSection` (patterns/) — PFM=B

Um `Card` por seção temática do formulário; várias visíveis ao mesmo
tempo, em grid — não uma coluna única, não um wizard por etapas.

```tsx
<div className="grid gap-4 sm:grid-cols-2">
  <FormSection icon={<User />} title="Identificação">...</FormSection>
  <FormSection icon={<Truck />} title="Fornecedor">...</FormSection>
</div>
```

### `KpiSection` (patterns/) — PKS=A

KPIs em grid no topo, gráfico/conteúdo abaixo.

```tsx
<KpiSection kpis={<>
  <KpiCard label="Pedidos hoje" value="24" />
  <KpiCard label="Em atraso" value="3" />
</>}>
  <div className="rounded-2xl border p-4">{/* gráfico */}</div>
</KpiSection>
```

### Pattern de listagem completa — PLS=A (guia de composição, sem componente único)

Não existe um componente monolítico "ListingPage" — a composição correta
é `PageHeader` + `FilterPanel` (sempre visível, `PLS=A`) + `ResponsiveTable`
+ paginação (a tela controla o estado de página):

```tsx
<PageHeader title="Pedidos" action={<Button>Novo</Button>} />
<FilterPanel ...>...</FilterPanel>
<ResponsiveTable ... />
```

### `Dialog` / `DialogHeader` / `DialogBody` — MOD=A, NO-OVERLAP (oficial desde 2026-09-12)

`src/components/design-system/Dialog.tsx` — antes deste ajuste, o DS
reaproveitava `Dialog` de `ui/dialog.tsx` sem alteração. Passou a existir
uma versão oficial porque o piloto revelou um bug de sobreposição real
(botão fechar coberto pelo cabeçalho do modal em
`ModalAgendamentosCliente.tsx` — ver `foundations.md`, "No accidental
overlap"). `ui/dialog.tsx` **não foi alterado** — o wrapper novo só
reexporta `Dialog`/`DialogTrigger`/`DialogFooter`/`DialogDescription` como
estão e substitui `DialogContent`/`DialogHeader` por versões
estruturalmente seguras:

```tsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent className="max-w-lg">
    <DialogHeader title="Agendamentos do cliente" description="Opcional" />
    <DialogBody>{/* conteúdo rolável */}</DialogBody>
  </DialogContent>
</Dialog>
```

`DialogHeader` é uma linha flex — título/descrição em `min-w-0 flex-1`
(encolhe, quebra linha em vez de estourar) e o botão fechar em
`shrink-0`, na mesma linha — nunca sobrepõe, mesmo com título muito
longo. `DialogContent` desliga o `showCloseButton` absoluto do Radix
(`ui/dialog.tsx`) e vira um flex column: header (fora do scroll) +
`DialogBody` (`flex-1 overflow-y-auto`, quem rola) — por isso o header
não depende de `sticky`/`z-index` para continuar visível. `ConfirmDialog`
(DST=A) continua usando `ui/dialog.tsx` diretamente (título curto, sem o
problema) — não foi migrado nesta tarefa (fora do escopo pedido).

### SCROLL-BOUNDED-LIST — coleção potencialmente ilimitada dentro de um Dialog (oficial desde 2026-09-15)

**Regra:** uma região de conteúdo **potencialmente ilimitado** dentro de
um `Dialog` recebe altura máxima própria e passa a rolar internamente
quando ultrapassa esse limite — sem fazer o `Dialog` inteiro crescer.
Isso é a aplicação concreta de uma regra já existente em
`interaction-standards.md` ("Affordances e contenção": *"scroll interno
adicional exige lista limitada real"*) — este é o padrão nomeado e o
exemplo de implementação dela.

**Quando usar:** histórico de observações/comentários, logs, histórico de
status, listas extensas, catálogos de itens selecionáveis — qualquer
coleção que cresce com o uso real do sistema e não tem um teto natural.

**Quando NÃO usar:** `Input`/`Textarea` (nunca ganham altura máxima
própria por este padrão), uma seção pequena/finita, ou qualquer conteúdo
que já cabe naturalmente no `Dialog` sem esforço. Não é uma regra de
"todo bloco dentro de um modal precisa de altura máxima" — só as coleções
genuinamente sem limite.

**Implementação (`GestaoPedidosPersonalizados.tsx`, histórico de status e
histórico de observações do pedido):**
```
max-h-[min(18rem,40dvh)] overflow-y-auto overscroll-contain pr-2
```
- `max-h-[min(18rem,40dvh)]` — o limite considera conteúdo (~4-5 itens
  visíveis em desktop, `18rem`) **e** viewport (nunca mais que `40dvh`,
  para não dominar a tela em telas baixas/mobile). Não é um valor fixo
  universal — cada lista escolhe o próprio teto proporcional ao que
  exibe (compare com o catálogo de cores em `SeletorCores.tsx`, que usa
  `max-h-80 sm:max-h-[30rem] lg:max-h-[36rem]` por ser uma grade, não uma
  lista de texto).
- `overscroll-contain` — evita "scroll chaining": rolar até o fim da
  lista interna não continua o gesto rolando o `DialogBody` por trás.
- `pr-2` — afasta o conteúdo da scrollbar interna quando ela aparece.
- O controle de criação (`Textarea` + botão "Adicionar observação") fica
  **fora** da região rolável, sempre visível, nunca precisa de scroll
  para ser encontrado.

**Diferença de `TABLE-NO-INTERNAL-VSCROLL` (`foundations.md`):** aquela
regra proíbe scroll vertical interno na **listagem/tabela principal
paginada de uma página** (o usuário testou e reprovou "scroll dentro de
scroll" ali). `SCROLL-BOUNDED-LIST` é o caso oposto: uma coleção
**subordinada**, dentro de um `Dialog` que já tem seu próprio scroll
principal (`DialogBody`) — não é a navegação primária da tela, é uma
seção de detalhe que pode crescer. As duas regras não conflitam porque
resolvem problemas diferentes.

## Componentes reaproveitados sem alteração (já adequados)

`Checkbox`, `Table`, `Tabs` (visual padrão, fora do `SegmentedTabs`),
`Tooltip`, `Popover`, `Calendar`, `Skeleton` — todos de
`src/components/ui/`, usados como estão hoje. `UnsavedChangesNotice`
(UNS=B) é um wrapper fino sobre botões, não recria nada. **`Input`** tem
versão própria no DS
(`src/components/design-system/Input.tsx`) desde o ajuste de superfície
de 2026-09-11 — `ui/input.tsx` permanece intocado, com `bg-transparent`,
para as telas que já o usam.

### `Select` — família visual de controles (FORM-CONTROL-SURFACE, 2026-09-15)

`Select`/`SelectTrigger` continuam de `src/components/ui/select.tsx`
(Radix, não substituído por um wrapper próprio do DS) — mas a superfície
deixou de ser `bg-transparent` e passou a `bg-input-background`, o mesmo
token que `Input`/`Textarea`/`DateField`/`Combobox` já usam. **Achado
real (2026-09-15):** dentro de um `FilterPanel` (superfície tintada), um
`SelectTrigger` transparente ficava visualmente quase idêntico ao fundo
do painel — o usuário via o texto e a seta, mas não percebia que havia um
campo interativo ali. Como `border-input`, `focus-visible:border-ring
focus-visible:ring-ring/50` e `disabled:opacity-50` já eram idênticos aos
do `Input`, a única peça fora da família era o fundo — corrigida na
camada mais baixa apropriada (`ui/select.tsx`, usado por toda a base,
sem CSS extra em cada tela). Sem impacto visual em usos sobre fundo
branco (`bg-input-background` é `#FFFFFF`, igual ao `--card`/fundo mais
comum do app) — o efeito só aparece (corretamente) sobre superfícies
tintadas como o `FilterPanel` ou blocos de `Section`. `Combobox`
(`CMB=B`) já usava `bg-input-background`/`border-input` desde sua
criação — não precisou de ajuste, mas confirma que `Input`, `DateField`,
`Select` e `Combobox` já compartilham a mesma superfície/borda/focus/
disabled: a família `FORM-CONTROL-SURFACE`.

## Consolidação pós-validação

- `FilterPanel`: header tonal próprio, separado do body neutro; `Limpar` e
  recolhimento ficam no header, `Filtrar` segue no rodapé à direita.
- `Section`: `collapsible` ativa explicitamente recolher/expandir; inicia
  expandida por padrão e não descarta valores/estado.
- `DialogContent`/`DialogBody`: altura máxima baseada em `100dvh`; header e
  fechar não rolam, e o `DialogBody` é o scroller vertical principal.
- `CardFooter`: ações contextuais de card ficam ao final/direita quando a
  composição permitir; no mobile podem ocupar largura maior.
