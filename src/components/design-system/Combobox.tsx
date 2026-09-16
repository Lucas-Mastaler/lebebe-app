'use client'

import * as React from 'react'
import { Check, ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SkeletonRows } from './EmptyState'

/**
 * Combobox oficial (CMB=B — skeleton dentro do dropdown durante a busca).
 * Busca AO VIVO enquanto digita (debounce), diferente de um filtro de
 * tela (FLT-EXEC=MANUAL não se aplica aqui — ver
 * `docs/design-system/interaction-standards.md`).
 */
export interface ComboboxOption<T> {
  value: T
  label: string
}

export interface ComboboxProps<T> {
  value: ComboboxOption<T> | null
  onChange: (option: ComboboxOption<T> | null) => void
  onSearch: (query: string) => Promise<ComboboxOption<T>[]>
  placeholder?: string
  minChars?: number
  debounceMs?: number
  disabled?: boolean
  id?: string
  'aria-invalid'?: boolean
  'aria-describedby'?: string
}

export function Combobox<T>({
  value,
  onChange,
  onSearch,
  placeholder = 'Buscar...',
  minChars = 2,
  debounceMs = 300,
  disabled,
  id,
  ...aria
}: ComboboxProps<T>) {
  const [query, setQuery] = React.useState(value?.label ?? '')
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [results, setResults] = React.useState<ComboboxOption<T>[]>([])
  const [errored, setErrored] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const listboxId = React.useId()

  React.useEffect(() => {
    if (query.length < minChars) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    setErrored(false)
    const timer = setTimeout(() => {
      onSearch(query)
        .then((r) => setResults(r))
        .catch(() => setErrored(true))
        .finally(() => setLoading(false))
    }, debounceMs)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, minChars, debounceMs])

  React.useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function select(option: ComboboxOption<T>) {
    onChange(option)
    setQuery(option.label)
    setOpen(false)
  }

  function clear() {
    onChange(null)
    setQuery('')
    setResults([])
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          id={id}
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
            if (value) onChange(null)
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className={cn(
            'border-input bg-input-background h-9 w-full rounded-md border py-1 pr-14 pl-3 text-sm shadow-xs outline-none transition-[color,box-shadow]',
            'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
            'aria-invalid:ring-destructive/20 aria-invalid:border-destructive',
            'disabled:cursor-not-allowed disabled:opacity-50'
          )}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls={listboxId}
          {...aria}
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1 text-slate-400">
          {query && (
            <button type="button" onClick={clear} aria-label="Limpar" className="rounded p-0.5 hover:bg-slate-100 hover:text-slate-600">
              <X className="size-3.5" />
            </button>
          )}
          <ChevronDown className="size-3.5" />
        </div>
      </div>

      {open && query.length >= minChars && (
        <div id={listboxId} role="listbox" className="absolute z-50 mt-1 w-full rounded-md border border-slate-200 bg-white p-1 shadow-md">
          {loading && <SkeletonRows rows={3} className="p-1.5" />}
          {!loading && errored && <p className="px-2 py-1.5 text-xs text-destructive">Não foi possível buscar. Tente novamente.</p>}
          {!loading && !errored && results.length === 0 && <p className="px-2 py-1.5 text-xs text-slate-400">Nenhum resultado para &quot;{query}&quot;.</p>}
          {!loading &&
            !errored &&
            results.map((option, i) => (
              <button
                key={i}
                type="button"
                role="option"
                aria-selected={value?.label === option.label}
                onClick={() => select(option)}
                className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-slate-50"
              >
                {option.label}
                {value?.label === option.label && <Check className="size-3.5 text-primary" />}
              </button>
            ))}
        </div>
      )}
      {open && query.length > 0 && query.length < minChars && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-slate-200 bg-white p-2 text-xs text-slate-400 shadow-md">
          Digite ao menos {minChars} caracteres.
        </div>
      )}
    </div>
  )
}
