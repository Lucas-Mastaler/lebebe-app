'use client'

import { useState } from 'react'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface MultiSelectProps {
  options: string[]
  selected: string[]
  onChange: (selected: string[]) => void
  placeholder?: string
  className?: string
  enableSearch?: boolean
}

export function toggleMultiSelectValue(selected: string[], value: string) {
  return selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]
}

export function MultiSelect({ options, selected, onChange, placeholder = 'Selecione...', className, enableSearch = false }: MultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const filteredOptions = enableSearch
    ? options.filter(opt => opt.toLowerCase().includes(searchQuery.toLowerCase()))
    : options

  function toggleOption(value: string) {
    onChange(toggleMultiSelectValue(selected, value))
  }

  function clearAll() {
    onChange([])
    setSearchQuery('')
  }

  return (
    <Popover open={open} onOpenChange={(nextOpen) => {
      setOpen(nextOpen)
      if (!nextOpen) setSearchQuery('')
    }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={selected.length === 0 ? placeholder : `${selected.length} opções selecionadas`}
          className={cn(
            'flex h-9 w-full cursor-pointer items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-left text-sm transition-colors',
            'hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2',
            className
          )}
        >
          {selected.length === 0 ? (
            <span className="truncate text-slate-400">{placeholder}</span>
          ) : (
            <span className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
              {selected.slice(0, 3).map((value) => (
                <span key={value} className="truncate rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                  {value}
                </span>
              ))}
              {selected.length > 3 && <span className="shrink-0 text-xs text-slate-500">+{selected.length - 3}</span>}
            </span>
          )}
          <ChevronDown className={cn('ml-auto size-4 shrink-0 text-slate-400 transition-transform', open && 'rotate-180')} aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        collisionPadding={16}
        className="flex w-[var(--radix-popover-trigger-width)] max-h-[min(24rem,var(--radix-popover-content-available-height))] min-h-0 flex-col overflow-hidden p-0"
      >
        <div className="shrink-0">
          {selected.length > 0 && (
            <div className="border-b border-slate-100 bg-slate-50 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-500">{selected.length} selecionado{selected.length !== 1 ? 's' : ''}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={clearAll}
                >
                  Limpar
                </Button>
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {selected.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleOption(value)}
                    className="inline-flex max-w-full items-center gap-1 rounded-full bg-white px-2 py-0.5 text-xs text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                    aria-label={`Remover ${value}`}
                  >
                    <span className="truncate">{value}</span>
                    <X className="size-3 shrink-0" aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>
          )}
          {enableSearch && (
            <div className="px-3 py-2 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Buscar..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-7 pl-8 text-xs"
                />
              </div>
            </div>
          )}
        </div>
        {filteredOptions.length === 0 ? (
          <div className="px-3 py-4 text-center text-sm text-slate-400">
            {searchQuery ? 'Nenhuma opção encontrada' : 'Nenhuma opção disponível'}
          </div>
        ) : (
          <div className="min-h-0 overflow-y-auto p-1">
            {filteredOptions.map((option) => {
              const checked = selected.includes(option)
              return (
                <label key={option} className={cn('flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-slate-50', checked && 'bg-slate-100')}>
                  <Checkbox checked={checked} onCheckedChange={() => toggleOption(option)} />
                  <span className="min-w-0 flex-1 truncate">{option}</span>
                  {checked && <Check className="size-4 shrink-0 text-slate-500" aria-hidden="true" />}
                </label>
              )
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
