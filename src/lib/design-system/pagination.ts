/**
 * TABLE-PAGE-SIZE (regra global, aprovada) — listagens/tabelas de dados
 * paginadas do sistema mostram no máximo `TABLE_PAGE_SIZE` registros por
 * página, e o limite é aplicado no BACKEND (a requisição paginada nunca
 * retorna mais que isso para o frontend cortar localmente). Mesmo valor
 * para desktop e mobile — não busca conjuntos diferentes por breakpoint.
 * Não é para tabelas estáticas pequenas ou conteúdo meramente informativo
 * embutido, que não usam paginação. Ver DECISOES.md TABLE-PAGE-SIZE.
 */
export const TABLE_PAGE_SIZE = 20

/** Sempre `Math.min(pedido, TABLE_PAGE_SIZE)` — nunca confia cegamente no valor pedido pelo cliente. */
export function clampPageSize(requested: number | undefined): number {
  if (!requested || requested < 1) return TABLE_PAGE_SIZE
  return Math.min(requested, TABLE_PAGE_SIZE)
}
