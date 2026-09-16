'use client'

import * as React from 'react'

/**
 * Evita o flash de feedback indeterminado em operações curtas. O atraso deve
 * ser usado apenas no contêiner que controla o estado de carregamento.
 */
export function useDelayedVisibility(visible: boolean, delayMs = 200): boolean {
  const [delayedVisible, setDelayedVisible] = React.useState(false)

  React.useEffect(() => {
    if (!visible) {
      setDelayedVisible(false)
      return
    }

    const timeout = window.setTimeout(() => setDelayedVisible(true), delayMs)
    return () => window.clearTimeout(timeout)
  }, [delayMs, visible])

  return delayedVisible
}
