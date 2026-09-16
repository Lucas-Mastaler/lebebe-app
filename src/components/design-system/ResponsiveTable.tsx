import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState, SkeletonRows } from './EmptyState'
import { Alert } from './Alert'
import { useHorizontalDragScroll } from './useHorizontalDragScroll'
import { COLUMN_WIDTH_CLASSES, type ColumnWidth } from '@/lib/design-system/column-sizing'
import { resolveRowToneClass, type RowTone } from '@/lib/design-system/row-tones'
import { cn } from '@/lib/utils'

/**
 * Listagem oficial (TBL=B — tabela no desktop, cards no mobile; ROW=A —
 * ações de linha sempre visíveis). `columns` descreve as colunas
 * (desktop); `renderMobileCard` decide como cada linha vira um card no
 * mobile — não é uma redução proporcional da tabela.
 *
 * `stickyHeader`/`firstColumnSticky` e `rowClassName` foram adicionados
 * no piloto de `/chamados-finalizados` (Fase 4) — extensões genéricas
 * (não específicas dessa tela) para tabelas largas que precisam manter
 * orientação ao rolar horizontalmente, e para destacar linhas por estado
 * de negócio. Arrastar com o mouse (`useHorizontalDragScroll`) foi
 * generalizado do padrão já aprovado em `/inteligencia-comercial`. Todos
 * opcionais — não quebram nenhum uso existente.
 *
 * Container/radius/borda (TABLE-VIEWPORT-CLIP, revisado — ver DECISOES.md
 * D-032): a silhueta pertence à JANELA VISÍVEL, não a uma célula
 * específica (radius por célula não sobrevive a scroll horizontal — ver
 * histórico no componente antes desta revisão). A estrutura tem 3 níveis,
 * cada um com uma responsabilidade só:
 *   OUTER SHELL — só `rounded-2xl border ...`, SEM overflow/clip-path.
 *     Dona da borda/silhueta externa — nítida, imóvel, nunca afetada por
 *     antialiasing de máscara.
 *   INNER CLIP — `rounded-2xl overflow-hidden bg-white`, mesma classe de
 *     radius do OUTER (não um valor hardcoded separado — antes usava
 *     `clip-path: inset(0 round 1rem)`, 16px, enquanto o container real é
 *     `rounded-2xl` = 20px; esse descompasso de 4px é a causa confirmada
 *     do "canto apagado" relatado pelo usuário — inspecionado via
 *     `getComputedStyle`, não assumido). Corta qualquer superfície interna
 *     (cabeçalho colorido, hover, linha destacada, zebra) que tente passar
 *     do contorno. `overflow-hidden` aqui é seguro (não quebra sticky) só
 *     porque, com a decisão TABLE-NO-INTERNAL-VSCROLL, nenhuma tabela
 *     depende mais de `stickyHeader` ficar preso a um scroll vertical —
 *     ver abaixo.
 *   HORIZONTAL SCROLLER — `overflow-x-auto`: dono do scroll horizontal
 *     (nativo + arrastar com o mouse). Fica dentro do INNER CLIP.
 * O 1px de diferença entre o box do OUTER e o do INNER CLIP (a borda do
 * OUTER) é aceito como desprezível — mesmo padrão usado em qualquer card
 * "borda + conteúdo com overflow-hidden" (não é um valor de radius
 * divergente, é o mesmo `rounded-2xl` aplicado a uma caixa 1px menor).
 *
 * TABLE-NO-INTERNAL-VSCROLL (regra global, aprovada): tabelas/listagens
 * paginadas NÃO têm scroll vertical interno — a página é responsável pelo
 * scroll vertical. Uma versão anterior deste componente dava
 * `max-h-[70vh] overflow-y-auto` ao scroller quando `stickyHeader` estava
 * ativo (única forma de fazer o cabeçalho realmente grudar, já que
 * qualquer elemento com overflow-x não-visible força o eixo vertical a
 * também virar não-visible, interceptando `position: sticky` relativo à
 * página — ver git history). O usuário testou e reprovou: gera scroll
 * dentro de scroll (o mouse precisa "terminar" o scroll interno da
 * tabela antes de continuar rolando a página). Removido. `stickyHeader`
 * continua aceito como prop (compatibilidade, não quebra nenhum
 * consumidor existente) e a classe CSS `sticky top-0` continua aplicada
 * ao cabeçalho, mas SEM efeito visível de fato nesta arquitetura (não há
 * ancestral com scroll vertical delimitado para o header grudar) — é
 * documentado aqui como um no-op seguro, não como uma feature funcional.
 * Combinado com TABLE-PAGE-SIZE (máx. 20 linhas por página), o cabeçalho
 * sempre fica a poucos scrolls de distância — não há necessidade real de
 * cabeçalho fixo em tabelas desse tamanho.
 *
 * TABLE-ZEBRA=ON (regra global, aprovada): linhas alternam
 * `bg-white`/`bg-slate-50` por padrão (sutil, tokens neutros — nunca cor
 * de marca/semântica; sempre sólidas, sem alpha — ver "STICKY COLUMNS").
 * Reinicia a cada página (não mantém paridade global). `ZEBRA_EVEN`/
 * `ZEBRA_ODD` embutem seu próprio `hover:` sólido (`hover:bg-slate-100`,
 * não o `hover:bg-muted/50` herdado de `ui/table.tsx`) — necessário porque
 * a célula sticky pinta sua própria superfície por cima da `<tr>`, então
 * um hover que só existisse na `<tr>` nunca apareceria ali (ver "STICKY
 * COLUMNS"). Precedência: `rowTone`/`rowClassName` (estado semântico da
 * tela — ver "ROW TONES" abaixo) tem prioridade sobre o zebra padrão. O
 * Design System não sabe o que cada tom significa (chamado sem ação,
 * pedido pendente, etc.) — só resolve a superfície final. Não é
 * obrigatório manter zebra nos cards do mobile (eles já têm separação
 * visual própria via borda/sombra/`space-y`).
 *
 * STICKY COLUMNS — superfície opaca (bug real corrigido em uso manual de
 * `/chamados-finalizados`, ver DECISOES.md TABLE-STICKY-OPAQUE): a
 * primeira coluna sticky (`firstColumnSticky`) reaplicava a MESMA classe
 * de superfície da linha na célula sticky — correto em intenção, mas o
 * zebra ímpar (`ZEBRA_ODD`) e alguns `rowClassName` de tela usavam
 * opacidade (`bg-x/10`, `bg-x/70`), que deixa o conteúdo rolável por
 * baixo aparecer através da célula fixa (confirmado visualmente: texto
 * de outras colunas "fantasma" sobre a primeira coluna ao arrastar).
 * Corrigido em duas frentes: (1) `ZEBRA_ODD`/`ZEBRA_EVEN` (incluindo seu
 * `hover:`) deixaram de usar alpha; (2) tons de linha inteira usam
 * `src/lib/design-system/row-tones.ts` (`color-mix(in srgb, var(--token)
 * X%, white)`, opaco por construção, ainda derivado do token semântico
 * oficial). Fonte única da superfície: `resolveRowSurface()` (abaixo)
 * calcula a classe uma vez por linha e alimenta TANTO a `<tr>` quanto a
 * célula sticky — nunca duas implementações de precedência em paralelo.
 * Hierarquia de camadas: conteúdo normal (z automático) < célula sticky
 * do corpo (`z-10`) < cabeçalho sticky (`z-20`) < célula de interseção
 * cabeçalho+coluna sticky (`z-30`, explícita — nunca depender de herança
 * implícita para o canto). Um divisor sutil (`border-r border-slate-200`)
 * aparece na borda direita da coluna sticky só quando há overflow
 * horizontal de verdade (`hasOverflow`), reforçando que há conteúdo
 * passando por baixo.
 *
 * ROW TONES — família visual + zebra interno (revisado em 2026-09-14,
 * achado real em `/chamados-finalizados`: a linha destacada por
 * `rowClassName` cobria o zebra inteiro, e todas as linhas especiais
 * ficavam com a MESMA cor uniforme, perdendo a orientação visual entre
 * registros). Um estado de linha explícito não precisa eliminar toda
 * alternância — em vez de UMA cor fixa por estado, `rowTone` (prop nova)
 * recebe o NOME de uma família (`RowTone` — `danger`/`dangerSubtle`/
 * `warning`/`success`/`info`, `src/lib/design-system/row-tones.ts`) e o
 * `ResponsiveTable` resolve a variante `base`/`alternate` pela MESMA
 * paridade que o zebra normal usaria — a tela nunca calcula paridade.
 * Precedência conceitual (não precisa ser literalmente essa sequência de
 * código, mas o resultado visual segue essa lógica): (1) `rowTone` define
 * a família visual da linha; (2) zebra escolhe a variante base/alternate
 * dentro da família; (3) hover (embutido em cada variante, sempre sólido)
 * aplica-se sobre a superfície resultante; (4) a célula sticky usa
 * exatamente essa mesma superfície final — nunca fica branca sobre uma
 * linha destacada, nem transparente sobre zebra. `rowClassName` continua
 * aceito (compatibilidade — tipografia, borda, outras classes que não são
 * background de linha) e, quando não há `rowTone`, seu valor de retorno
 * ainda pode conter uma classe de background própria (comportamento
 * legado, substitui o zebra inteiramente); quando `rowTone` está presente,
 * ele resolve o background e `rowClassName` complementa (não deve trazer
 * outro background, para não ter duas fontes conflitantes). `dangerSubtle`
 * é uma intensidade mais clara da família `danger`, usada especificamente
 * por `/chamados-finalizados` (preferência daquela tela — não altera
 * `--destructive` nem a família `danger` padrão).
 *
 * COLUMN SIZING — papéis semânticos de largura
 * (`src/lib/design-system/column-sizing.ts`: `compact`/`content`/
 * `standard`/`wide`/`fill`) em vez de `w-[Npx]` espalhados por tela.
 * Opcional — uma coluna sem `width` mantém o comportamento anterior (só
 * `className`).
 *
 * NO-CELL-OVERLAP (regra global, achada em uso manual real de
 * `/chamados-finalizados`: "Nome Digisac" — `Ana Toledo | Biramar Baby
 * Atacado (2255)` — pintava visualmente sobre a coluna "Loja"): conteúdo
 * de uma célula nunca pode pintar sobre uma coluna adjacente. Causa raiz
 * confirmada, não hipotética — `TableCell` (`ui/table.tsx`) já aplica
 * `whitespace-nowrap` por padrão a toda célula; o antigo papel `standard`
 * (`min-w-[120px] max-w-[220px]`, sem `whitespace-normal`) combinava
 * largura limitada + `nowrap` + `overflow: visible` (nenhuma das três
 * classes do Design System jamais aplicou `overflow-hidden` a uma célula
 * de conteúdo) — o texto não aumentava a coluna, não quebrava, nem era
 * cortado: só continuava pintando depois da borda da célula, sobre a
 * coluna seguinte. Toda coluna agora escolhe explicitamente uma de duas
 * estratégias válidas (nunca essa combinação inválida) — ver
 * `column-sizing.ts` para o detalhe de cada papel:
 *   CRESCER (`compact`/`content`) — sem `max-w`, com `nowrap`: a coluna
 *   cresce pelo maior conteúdo real (layout `auto` da tabela, sem
 *   `table-fixed`/`colgroup`); o scroll horizontal absorve o aumento.
 *   QUEBRAR (`standard`/`wide`/`fill`) — todo papel com `max-w` agora
 *   também tem `whitespace-normal break-words`: se o conteúdo excede o
 *   teto, quebra em vez de vazar.
 * `content`/`intrinsic` é o papel novo para dado ESTRUTURADO que precisa
 * aparecer inteiro (nome de cliente, "Nome Digisac", identificador) —
 * mecanicamente igual a `compact`, mas semanticamente distinto (`compact`
 * é para valores curtos/previsíveis; `content` é para valores que variam
 * bastante mas nunca podem ser cortados). Texto narrativo potencialmente
 * ilimitado continua em `wide`/`fill` (quebra, nunca cresce sem teto).
 *
 * Geometria do sticky: como a primeira coluna sticky é a MESMA célula
 * (`<td>`/`<th>`) que participa do layout normal da tabela — só ganha
 * `position: sticky; left: 0` — sua largura é sempre exatamente a largura
 * real da coluna calculada pelo navegador (header, corpo e sticky nunca
 * divergem; não há uma "largura do sticky" calculada à parte). Validado
 * com nomes curto/médio/longo.
 *
 * Não usamos mais o `Table` de `ui/table.tsx` diretamente (que já embute
 * seu próprio wrapper de scroll sem expor `ref`) — só os subcomponentes
 * (`TableHeader`/`TableBody`/...), dentro do nosso próprio wrapper de
 * scroll (necessário para o `ref` do drag). `ui/table.tsx` não foi alterado.
 */
export interface ResponsiveTableColumn<Row> {
  key: string
  header: string
  render: (row: Row) => React.ReactNode
  className?: string
  /** Papel semântico de largura (Column Sizing) — ver `column-sizing.ts`. Opcional; sem ele, a coluna mantém o comportamento anterior (só `className`). */
  width?: ColumnWidth
}

export interface ResponsiveTableProps<Row> {
  columns: ResponsiveTableColumn<Row>[]
  rows: Row[]
  rowKey: (row: Row) => string
  renderMobileCard: (row: Row) => React.ReactNode
  rowActions?: (row: Row) => React.ReactNode
  /** Classe extra por linha (ex.: tipografia, borda) — aplicada tanto na linha desktop quanto no card mobile. Sem `rowTone`, também pode conter background (legado) e substitui o zebra dessa linha. Com `rowTone`, o background é resolvido por ele — evite duplicar background aqui. */
  rowClassName?: (row: Row) => string | undefined
  /** Tom semântico de linha (família + zebra interno + hover + sticky, tudo resolvido pelo componente) — ver `row-tones.ts`. A tela só declara "esta linha está no tom X"; paridade, opacidade e variantes são responsabilidade do `ResponsiveTable`. Preferível a `rowClassName` para background de estado de linha. */
  rowTone?: (row: Row) => RowTone | undefined
  /**
   * Mantida por compatibilidade. Aplica as classes CSS de cabeçalho fixo,
   * mas SEM scroll vertical interno (decisão TABLE-NO-INTERNAL-VSCROLL) —
   * nesta arquitetura o cabeçalho não fica de fato preso à rolagem. Ver
   * comentário do componente.
   */
  stickyHeader?: boolean
  /** Primeira coluna fixa ao rolar a tabela horizontalmente — útil quando há muitas colunas. */
  firstColumnSticky?: boolean
  /** Desativa a alternância de linhas (zebra) quando realmente necessário. Default: `true`. */
  zebra?: boolean
  loading?: boolean
  error?: string
  emptyTitle?: string
  emptyDescription?: string
}

const OUTER_SHELL_CLASS = 'hidden rounded-2xl border border-slate-200 shadow-sm md:block'
const INNER_CLIP_CLASS = 'overflow-hidden rounded-2xl bg-white'
// Sólidas de propósito, incluindo o hover (sem alpha em nenhum estado) — ver comentário do componente, "STICKY COLUMNS".
const ZEBRA_EVEN = 'bg-white hover:bg-slate-100'
const ZEBRA_ODD = 'bg-slate-50 hover:bg-slate-100'

/**
 * Fonte única da superfície de uma linha — usada tanto na `<tr>` quanto na
 * célula sticky (nunca duas implementações de precedência em paralelo).
 * Com `toneName`: resolve a família (`row-tones.ts`) pela paridade da
 * linha (zebra sobrevive dentro do row-state) e ainda mescla `rowClassName`
 * por cima (para classes não-background, ex. tipografia/borda). Sem
 * `toneName`: `rowClassName` (legado) substitui o zebra inteiramente,
 * senão cai no zebra padrão.
 */
function resolveRowSurface(rowIndex: number, extraRowClass: string | undefined, toneName: RowTone | undefined, zebra: boolean): string | undefined {
  const parity = rowIndex % 2 === 1 ? 'alternate' : 'base'
  if (toneName) return cn(extraRowClass, resolveRowToneClass(toneName, parity))
  if (extraRowClass) return extraRowClass
  if (!zebra) return undefined
  return parity === 'alternate' ? ZEBRA_ODD : ZEBRA_EVEN
}

export function ResponsiveTable<Row>({
  columns,
  rows,
  rowKey,
  renderMobileCard,
  rowActions,
  rowClassName,
  rowTone,
  stickyHeader,
  firstColumnSticky,
  zebra = true,
  loading,
  error,
  emptyTitle = 'Nenhum resultado encontrado',
  emptyDescription,
}: ResponsiveTableProps<Row>) {
  const { ref: dragRef, isDragging, hasOverflow, handlers: dragHandlers } = useHorizontalDragScroll<HTMLDivElement>()

  if (error) {
    return (
      <Alert tone="danger" title="Não foi possível carregar os dados.">
        {error}
      </Alert>
    )
  }

  if (loading) {
    return (
      <div className={cn(OUTER_SHELL_CLASS, 'block bg-white p-4')}>
        <SkeletonRows rows={5} />
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className={cn(OUTER_SHELL_CLASS, 'block bg-white')}>
        <EmptyState title={emptyTitle} description={emptyDescription} />
      </div>
    )
  }

  return (
    <>
      <div className={OUTER_SHELL_CLASS}>
        <div className={INNER_CLIP_CLASS}>
          <div
            ref={dragRef}
            {...dragHandlers}
            className={cn(
              'overflow-x-auto touch-pan-y',
              isDragging && 'cursor-grabbing select-none',
              !isDragging && hasOverflow && 'cursor-grab'
            )}
          >
            <table className="w-full caption-bottom text-sm">
              <TableHeader className={stickyHeader ? 'sticky top-0 z-20' : undefined}>
                <TableRow className={stickyHeader ? 'bg-slate-50' : undefined}>
                  {columns.map((col, i) => {
                    const isFirstCol = i === 0
                    const isStickyCorner = firstColumnSticky && isFirstCol
                    return (
                      <TableHead
                        key={col.key}
                        className={cn(
                          col.width && COLUMN_WIDTH_CLASSES[col.width],
                          col.className,
                          isStickyCorner && cn('sticky left-0 z-30 bg-slate-50', hasOverflow && 'border-r border-slate-200')
                        )}
                      >
                        {col.header}
                      </TableHead>
                    )
                  })}
                  {rowActions && <TableHead className="text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, rowIndex) => {
                  const extraRowClass = rowClassName?.(row)
                  const toneName = rowTone?.(row)
                  const rowSurface = resolveRowSurface(rowIndex, extraRowClass, toneName, zebra)
                  return (
                    <TableRow key={rowKey(row)} className={rowSurface}>
                      {columns.map((col, i) => {
                        const isFirstCol = i === 0
                        const isStickyBody = firstColumnSticky && isFirstCol
                        return (
                          <TableCell
                            key={col.key}
                            className={cn(
                              col.width && COLUMN_WIDTH_CLASSES[col.width],
                              col.className,
                              isStickyBody && cn('sticky left-0 z-10', rowSurface ?? 'bg-white', hasOverflow && 'border-r border-slate-200')
                            )}
                          >
                            {col.render(row)}
                          </TableCell>
                        )
                      })}
                      {rowActions && <TableCell className="text-right">{rowActions(row)}</TableCell>}
                    </TableRow>
                  )
                })}
              </TableBody>
            </table>
          </div>
        </div>
      </div>

      <div className={cn('space-y-2 md:hidden')}>
        {rows.map((row) => {
          const toneName = rowTone?.(row)
          const toneClass = toneName ? resolveRowToneClass(toneName, 'base') : undefined
          return (
            <div key={rowKey(row)} className={cn('rounded-xl border border-slate-200 bg-white p-3 shadow-sm', rowClassName?.(row), toneClass)}>
              {renderMobileCard(row)}
              {rowActions && <div className="mt-2 flex items-center gap-1 border-t border-slate-100 pt-2">{rowActions(row)}</div>}
            </div>
          )
        })}
      </div>
    </>
  )
}
