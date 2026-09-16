import { describe, expect, it } from 'vitest'
import {
  computeDragScrollLeft,
  DEFAULT_DRAG_THRESHOLD,
  elementHasHorizontalOverflow,
  hasExceededDragThreshold,
  isInteractiveDragTarget,
} from './horizontal-drag-scroll'

describe('elementHasHorizontalOverflow (regra: drag só quando há overflow)', () => {
  it('sem overflow quando scrollWidth <= clientWidth', () => {
    expect(elementHasHorizontalOverflow({ scrollWidth: 800, clientWidth: 800 })).toBe(false)
    expect(elementHasHorizontalOverflow({ scrollWidth: 700, clientWidth: 800 })).toBe(false)
  })

  it('tem overflow quando scrollWidth > clientWidth', () => {
    expect(elementHasHorizontalOverflow({ scrollWidth: 1200, clientWidth: 800 })).toBe(true)
  })
})

describe('hasExceededDragThreshold (movimento pequeno ainda pode ser clique)', () => {
  it('não excede com movimento menor que o threshold padrão', () => {
    expect(hasExceededDragThreshold(100, 103, DEFAULT_DRAG_THRESHOLD)).toBe(false)
    expect(hasExceededDragThreshold(100, 97, DEFAULT_DRAG_THRESHOLD)).toBe(false)
  })

  it('excede com movimento maior que o threshold, em qualquer direção', () => {
    expect(hasExceededDragThreshold(100, 110, DEFAULT_DRAG_THRESHOLD)).toBe(true)
    expect(hasExceededDragThreshold(100, 90, DEFAULT_DRAG_THRESHOLD)).toBe(true)
  })
})

describe('computeDragScrollLeft (cálculo de scroll)', () => {
  it('arrastar para a esquerda (currentX < startX) aumenta o scrollLeft', () => {
    expect(computeDragScrollLeft(0, 200, 150)).toBe(50)
  })

  it('arrastar para a direita (currentX > startX) diminui o scrollLeft', () => {
    expect(computeDragScrollLeft(50, 200, 250)).toBe(0)
  })
})

describe('isInteractiveDragTarget (não interceptar cliques em controles)', () => {
  function fakeElement(matches: boolean): Element {
    return { closest: () => (matches ? ({} as Element) : null) } as unknown as Element
  }

  it('null não é alvo interativo', () => {
    expect(isInteractiveDragTarget(null)).toBe(false)
  })

  it('elemento dentro de um seletor interativo é excluído do drag', () => {
    expect(isInteractiveDragTarget(fakeElement(true))).toBe(true)
  })

  it('elemento fora de qualquer seletor interativo permite drag', () => {
    expect(isInteractiveDragTarget(fakeElement(false))).toBe(false)
  })
})
