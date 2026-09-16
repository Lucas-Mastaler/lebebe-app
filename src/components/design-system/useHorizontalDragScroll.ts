'use client'

import * as React from 'react'
import {
  computeDragScrollLeft,
  DEFAULT_DRAG_THRESHOLD,
  elementHasHorizontalOverflow,
  hasExceededDragThreshold,
  isInteractiveDragTarget,
} from '@/lib/design-system/horizontal-drag-scroll'

/**
 * Arrastar tabelas/listas largas horizontalmente com o mouse — regra
 * global do Design System v1. Generalizado a partir da implementação já
 * aprovada em produção em `/inteligencia-comercial`
 * (`TabelaVendas.tsx`), auditada no piloto de `/chamados-finalizados`
 * (Fase 4): Pointer Events unificam mouse/touch/caneta, threshold de 5px
 * evita capturar cliques/seleção de texto como drag, elementos
 * interativos (`button`, `a`, `input`, `select`, `textarea`, `[role=button]`,
 * `[data-no-drag]`, ...) nunca iniciam drag, e o drag só é ativado quando
 * há overflow horizontal de verdade (`scrollWidth > clientWidth`).
 *
 * Scrollbar nativa, trackpad e touch continuam funcionando de forma
 * nativa via `overflow-x-auto` (não removidos/escondidos) — o drag é um
 * método adicional, nunca uma substituição.
 */
export function useHorizontalDragScroll<T extends HTMLElement>(threshold: number = DEFAULT_DRAG_THRESHOLD) {
  const ref = React.useRef<T | null>(null)
  const [isDragging, setIsDragging] = React.useState(false)
  const [hasOverflow, setHasOverflow] = React.useState(false)

  // Regra: cursor "grab" e a lógica de drag só existem quando a tabela
  // realmente tem overflow horizontal — reavaliado com ResizeObserver
  // porque o conteúdo (linhas carregadas via API) e a largura da viewport
  // podem mudar depois do primeiro render.
  React.useEffect(() => {
    const el = ref.current
    if (!el) return

    const update = () => setHasOverflow(elementHasHorizontalOverflow(el))
    update()

    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  })

  const isPointerDown = React.useRef(false)
  const isDraggingRef = React.useRef(false)
  const dragStartX = React.useRef(0)
  const scrollStartLeft = React.useRef(0)
  const activePointerId = React.useRef<number | null>(null)

  const onPointerDown = React.useCallback(
    (e: React.PointerEvent<T>) => {
      if (isInteractiveDragTarget(e.target as Element)) return

      const el = ref.current
      if (!el || !elementHasHorizontalOverflow(el)) return

      activePointerId.current = e.pointerId
      el.setPointerCapture?.(e.pointerId)

      isPointerDown.current = true
      isDraggingRef.current = false
      dragStartX.current = e.clientX
      scrollStartLeft.current = el.scrollLeft
    },
    []
  )

  const onPointerMove = React.useCallback(
    (e: React.PointerEvent<T>) => {
      if (!isPointerDown.current || activePointerId.current !== e.pointerId || !ref.current) return

      if (!isDraggingRef.current && hasExceededDragThreshold(dragStartX.current, e.clientX, threshold)) {
        isDraggingRef.current = true
        setIsDragging(true)
      }

      if (isDraggingRef.current) {
        e.preventDefault()
        ref.current.scrollLeft = computeDragScrollLeft(scrollStartLeft.current, dragStartX.current, e.clientX)
      }
    },
    [threshold]
  )

  const endDrag = React.useCallback((e?: React.PointerEvent<T>) => {
    if (e && activePointerId.current === e.pointerId) {
      ref.current?.releasePointerCapture?.(e.pointerId)
    }
    isPointerDown.current = false
    isDraggingRef.current = false
    activePointerId.current = null
    setIsDragging(false)
  }, [])

  return {
    ref,
    isDragging,
    hasOverflow,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerLeave: endDrag,
      onPointerCancel: endDrag,
    },
  }
}
