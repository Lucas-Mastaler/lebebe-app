'use client'

import * as React from 'react'

export type FilterPanelVariant = 'v1' | 'v2'

/** Fora de um `FilterPanel` a variante é `v1` (comportamento neutro de `FormField`). */
export const FilterPanelVariantContext = React.createContext<FilterPanelVariant>('v1')

/** Variante do `FilterPanel` mais próximo. */
export function useFilterPanelVariant() {
  return React.useContext(FilterPanelVariantContext)
}
