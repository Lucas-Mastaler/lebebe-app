/**
 * Lógica pura por trás do arrastar-para-rolar horizontal (`useHorizontalDragScroll`).
 * Extraída/generalizada do padrão já aprovado e em produção em
 * `/inteligencia-comercial` (`src/components/inteligencia-comercial/TabelaVendas.tsx`)
 * — auditado no piloto de `/chamados-finalizados` (Fase 4). Mesma regra de
 * threshold (5px) e mesma lista de seletores interativos, só reorganizada
 * para ser reutilizável e testável sem DOM real.
 */

export const DEFAULT_DRAG_THRESHOLD = 5

/** Não inicia drag em cima de controles interativos — o clique/foco deles precisa continuar funcionando normalmente. */
export const INTERACTIVE_DRAG_EXCLUDE_SELECTOR =
  'button, a, input, select, textarea, [role="button"], [role="menuitem"], [role="option"], [contenteditable="true"], [data-no-drag]'

export function isInteractiveDragTarget(target: Element | null): boolean {
  return target !== null && target.closest(INTERACTIVE_DRAG_EXCLUDE_SELECTOR) !== null
}

export function elementHasHorizontalOverflow(el: { scrollWidth: number; clientWidth: number }): boolean {
  return el.scrollWidth > el.clientWidth
}

export function hasExceededDragThreshold(startX: number, currentX: number, threshold: number = DEFAULT_DRAG_THRESHOLD): boolean {
  return Math.abs(currentX - startX) > threshold
}

export function computeDragScrollLeft(scrollStartLeft: number, startX: number, currentX: number): number {
  return scrollStartLeft - (currentX - startX)
}
