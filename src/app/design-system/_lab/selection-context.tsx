'use client'

import * as React from 'react'
import { PRESET_VISUAL_SELECTIONS } from './presets'

export type OptionLetter = 'A' | 'B' | 'C'
type Selections = Partial<Record<string, OptionLetter>>

const STORAGE_KEY = 'le-bebe-design-system-lab-v1'

interface SelectionContextValue {
  selections: Selections
  select: (code: string, letter: OptionLetter) => void
  reset: () => void
  hydrated: boolean
}

const SelectionContext = React.createContext<SelectionContextValue | null>(null)

export function SelectionProvider({ children }: { children: React.ReactNode }) {
  const [selections, setSelections] = React.useState<Selections>({})
  const [hydrated, setHydrated] = React.useState(false)

  React.useEffect(() => {
    let loaded: Selections = {}
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) loaded = JSON.parse(raw)
    } catch {
      // localStorage indisponível (modo privado, storage bloqueado) — segue com estado vazio
    }
    // Preenchimento não-destrutivo: um valor já salvo no navegador sempre
    // vence sobre o preset — isto só garante as 18 escolhas visuais já
    // feitas em caso de navegador/dispositivo sem o localStorage anterior.
    const merged: Selections = { ...PRESET_VISUAL_SELECTIONS, ...loaded }
    setSelections(merged)
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
    } catch {
      // segue sem persistir
    }
    setHydrated(true)
  }, [])

  const select = React.useCallback((code: string, letter: OptionLetter) => {
    setSelections((prev) => {
      const next = { ...prev, [code]: letter }
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        // segue sem persistir
      }
      return next
    })
  }, [])

  const reset = React.useCallback(() => {
    setSelections({})
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      // segue sem persistir
    }
  }, [])

  const value = React.useMemo(
    () => ({ selections, select, reset, hydrated }),
    [selections, select, reset, hydrated]
  )

  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>
}

function useSelectionContext() {
  const ctx = React.useContext(SelectionContext)
  if (!ctx) throw new Error('useSelection deve ser usado dentro de <SelectionProvider>')
  return ctx
}

export function useSelection(code: string) {
  const ctx = useSelectionContext()
  const select = React.useCallback((letter: OptionLetter) => ctx.select(code, letter), [ctx, code])
  return { value: ctx.selections[code], select }
}

export function useAllSelections() {
  return useSelectionContext()
}
