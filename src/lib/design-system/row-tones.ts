/**
 * Row tones — famílias de superfície para destacar uma linha inteira de
 * tabela (`rowTone` do `ResponsiveTable`) — reservado para quando a TELA
 * decide, explicitamente, que um registro precisa de destaque de linha
 * completa (ex.: falta uma ação importante, erro operacional crítico).
 * Não é para "combinar com o Badge de status da coluna" — um Badge
 * sozinho não justifica destacar a linha (ver
 * `docs/design-system/foundations.md`, "Zebra × status em célula").
 *
 * Um `row-state` explícito não elimina toda alternância de linhas: cada
 * tom é uma FAMÍLIA com duas variantes (`base`/`alternate`), resolvidas
 * pela mesma paridade que o zebra normal usaria — mantém simultaneamente
 * o significado da linha (destaque visível) e a diferenciação entre
 * registros (é possível seguir uma linha horizontalmente mesmo dentro do
 * estado especial). `ResponsiveTable.resolveRowSurface()` escolhe
 * `base`/`alternate` pela paridade do índice da linha — a tela só declara
 * o tom, nunca a paridade.
 *
 * TOTALMENTE OPACOS de propósito (`color-mix` contra branco, não
 * `bg-x/N` com alpha) — uma linha com `rowTone` pode ficar sob a primeira
 * coluna quando `firstColumnSticky` está ativo, e a célula sticky precisa
 * de uma superfície 100% opaca (ver ResponsiveTable.tsx, "Sticky
 * columns"); uma classe com alpha deixaria o conteúdo rolável por baixo
 * aparecer através dela. `color-mix(in srgb, var(--token) X%, white)`
 * produz uma cor sólida a partir do token semântico oficial — não um hex
 * novo. As classes Tailwind ficam LITERAIS no mapa abaixo: Tailwind v4
 * não emite CSS para classes arbitrárias interpoladas em runtime, o que
 * deixaria a linha e a sticky transparentes. Cada variante já inclui seu
 * próprio `hover:` sólido (também via `color-mix`) — necessário porque a
 * célula sticky pinta sua própria superfície por cima da linha, então o
 * `hover:bg-muted/50` herdado de `ui/table.tsx` nunca apareceria ali.
 *
 * `dangerSubtle` — intensidade mais clara da família `danger`, reutilizável
 * por qualquer tela (não é um hack local): criada porque
 * `/chamados-finalizados` achou a intensidade padrão de `danger` forte
 * demais para uma tabela inteira de linhas destacadas (preferência
 * específica da tela, não uma mudança do token `--destructive` — ver
 * DECISOES.md). `warning`/`success`/`info` seguem a mesma estrutura
 * base/alternate para uso futuro, mesmo sem consumidor hoje.
 */
export type RowTone = 'dangerSubtle' | 'danger' | 'warning' | 'success' | 'info'
export type RowToneParity = 'base' | 'alternate'

interface RowToneVariants {
  base: string
  alternate: string
}

const ROW_TONES: Record<RowTone, RowToneVariants> = {
  dangerSubtle: {
    base: 'bg-[color-mix(in_srgb,var(--destructive)_5%,white)] hover:bg-[color-mix(in_srgb,var(--destructive)_9%,white)]',
    alternate: 'bg-[color-mix(in_srgb,var(--destructive)_9%,white)] hover:bg-[color-mix(in_srgb,var(--destructive)_13%,white)]',
  },
  danger: {
    base: 'bg-[color-mix(in_srgb,var(--destructive)_10%,white)] hover:bg-[color-mix(in_srgb,var(--destructive)_15%,white)]',
    alternate: 'bg-[color-mix(in_srgb,var(--destructive)_16%,white)] hover:bg-[color-mix(in_srgb,var(--destructive)_21%,white)]',
  },
  warning: {
    base: 'bg-[color-mix(in_srgb,var(--warning)_10%,white)] hover:bg-[color-mix(in_srgb,var(--warning)_15%,white)]',
    alternate: 'bg-[color-mix(in_srgb,var(--warning)_16%,white)] hover:bg-[color-mix(in_srgb,var(--warning)_21%,white)]',
  },
  success: {
    base: 'bg-[color-mix(in_srgb,var(--success)_10%,white)] hover:bg-[color-mix(in_srgb,var(--success)_15%,white)]',
    alternate: 'bg-[color-mix(in_srgb,var(--success)_16%,white)] hover:bg-[color-mix(in_srgb,var(--success)_21%,white)]',
  },
  info: {
    base: 'bg-[color-mix(in_srgb,var(--info)_10%,white)] hover:bg-[color-mix(in_srgb,var(--info)_15%,white)]',
    alternate: 'bg-[color-mix(in_srgb,var(--info)_16%,white)] hover:bg-[color-mix(in_srgb,var(--info)_21%,white)]',
  },
}

/** Fonte única de resolução tom+paridade — usada por `ResponsiveTable` tanto na `<tr>` quanto na célula sticky. */
export function resolveRowToneClass(tone: RowTone, parity: RowToneParity): string {
  return ROW_TONES[tone][parity]
}
