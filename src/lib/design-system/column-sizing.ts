/**
 * Column Sizing — papéis de largura semânticos para colunas do
 * `ResponsiveTable` (regra global). Cada coluna declara sua INTENÇÃO de
 * layout (`compact`/`content`/`standard`/`wide`/`fill`); o Design System
 * resolve os valores reais. Nunca inferir o papel a partir do texto do
 * header em runtime — o módulo declara, o DS executa.
 *
 * NO-CELL-OVERLAP (regra global, ver ResponsiveTable.tsx e
 * `docs/design-system/foundations.md`): conteúdo de uma célula nunca pode
 * pintar visualmente sobre uma coluna adjacente. Cada papel abaixo só usa
 * uma de duas estratégias válidas — nunca a combinação inválida "largura
 * limitada + `nowrap` + `overflow: visible`" (bug real, confirmado em
 * `/chamados-finalizados`, coluna "Nome Digisac" invadindo "Loja" — ver
 * DECISOES.md):
 *   - CRESCER: sem `max-w-*`, com `whitespace-nowrap` — a tabela (layout
 *     `auto`, sem `table-fixed`/`colgroup`) dimensiona a coluna pelo maior
 *     conteúdo real da coluna; o scroll horizontal (já existente em
 *     `ResponsiveTable`) absorve o aumento. Usado por `compact` e
 *     `content`.
 *   - QUEBRAR: `max-w-*` sempre acompanhado de `whitespace-normal
 *     break-words` — se o conteúdo exceder o teto, quebra em vez de
 *     vazar sobre a coluna seguinte. Usado por `standard`, `wide` e
 *     `fill`.
 *
 * Valores calibrados contra a densidade/tipografia já aprovadas
 * (SPC=B, `text-sm` = 14px, células `p-2`), não números universais:
 *   compact  — hugging de conteúdo (`whitespace-nowrap`, sem min forçado)
 *              para IDs, contadores, status curto, datas/horas em
 *              formato fixo (ex. "01/09/2026 10:00" já cabe sem quebrar).
 *              Uso típico: valores curtos e previsíveis.
 *   content  — hugging de conteúdo, mecanicamente igual a `compact`
 *              (`whitespace-nowrap`, sem min/max forçado), mas papel
 *              semântico DISTINTO: campos ESTRUTURADOS que precisam
 *              aparecer INTEIROS numa linha só, mesmo quando o valor real
 *              varia bastante em tamanho (nome do cliente, "Nome
 *              Digisac", identificador legível, loja quando o nome
 *              varia). Não é para texto narrativo ilimitado (isso é
 *              `wide`/`fill`) — é para dado estruturado e finito que
 *              nunca deve ser cortado/truncado. A tabela cresce
 *              horizontalmente; o scroll absorve a largura extra.
 *   standard — nomes curtos, loja, consultora, categorias — min 120px
 *              evita esmagar, max 220px evita uma coluna "média" tomar
 *              espaço desproporcional; quebra (`whitespace-normal
 *              break-words`) se um valor pontual exceder o teto, em vez
 *              de vazar sobre a próxima coluna (NO-CELL-OVERLAP).
 *   wide     — texto narrativo secundário, potencialmente longo
 *              (observação, comentário, endereço) — min 240px já garante
 *              ~2-3 palavras por linha sem quebra excessiva; max 420px
 *              evita uma única coluna wide dominar sozinha ao lado de
 *              outra wide/fill; sempre quebra.
 *   fill     — o campo narrativo PRINCIPAL da tabela, também
 *              potencialmente ilimitado — mesmo min de `wide`, mas sem
 *              teto e com `w-full`: absorve o espaço que sobra depois que
 *              as colunas compact/content/standard já couberam
 *              (comportamento do layout automático de tabela); sempre
 *              quebra.
 *
 * Distinção conceitual (não confundir `content` com `wide`/`fill`):
 * conteúdo ESTRUTURADO e finito que precisa aparecer inteiro numa linha
 * só → `content`; conteúdo NARRATIVO potencialmente longo, onde quebra de
 * linha é aceitável e esperada → `wide`/`fill`.
 */
export type ColumnWidth = 'compact' | 'content' | 'standard' | 'wide' | 'fill'

export const COLUMN_WIDTH_CLASSES: Record<ColumnWidth, string> = {
  compact: 'whitespace-nowrap',
  content: 'whitespace-nowrap',
  standard: 'min-w-[120px] max-w-[220px] whitespace-normal break-words',
  wide: 'min-w-[240px] max-w-[420px] whitespace-normal break-words',
  fill: 'min-w-[240px] w-full whitespace-normal break-words',
}
