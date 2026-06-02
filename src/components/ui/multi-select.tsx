'use client'

import { useState, useRef, useEffect } from 'react'
import { Check, X, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

interface MultiSelectProps {
  options: string[]
  selected: string[]
  onChange: (selected: string[]) => void
  placeholder?: string
  className?: string
}

export function MultiSelect({ options, selected, onChange, placeholder = 'Selecione...', className }: MultiSelectProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  function toggleOption(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter(v => v !== value))
    } else {
      onChange([...selected, value])
    }
  }

  function removeOption(value: string) {
    onChange(selected.filter(v => v !== value))
  }

  function clearAll() {
    onChange([])
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Trigger button with selected badges */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'w-full h-9 px-3 py-1.5 rounded-md border border-slate-200 bg-white',
          'flex items-center gap-1.5 text-left text-sm',
          'hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2',
          'transition-colors'
        )}
      >
        {selected.length === 0 ? (
          <span className="text-slate-400">{placeholder}</span>
        ) : (
          <div className="flex flex-wrap gap-1 items-center">
            {selected.slice(0, 3).map(value => (
              <span
                key={value}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs"
              >
                {value}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeOption(value) }}
                  className="hover:text-slate-900"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {selected.length > 3 && (
              <span className="text-xs text-slate-500">+{selected.length - 3}</span>
            )}
          </div>
        )}
        <ChevronDown className={cn('w-4 h-4 ml-auto text-slate-400 transition-transform', open && 'rotate-180')} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {selected.length > 0 && (
            <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <span className="text-xs text-slate-500">{selected.length} selecionado{selected.length !== 1 ? 's' : ''}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={(e) => { e.stopPropagation(); clearAll() }}
              >
                Limpar
              </Button>
            </div>
          )}
          {options.length === 0 ? (
            <div className="px-3 py-4 text-sm text-slate-400 text-center">
              Nenhuma opção disponível
            </div>
          ) : (
            <div className="p-1">
              {options.map(option => (
                <button
                  key={option}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggleOption(option) }}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left',
                    'hover:bg-slate-50 transition-colors',
                    selected.includes(option) && 'bg-slate-100'
                  )}
                >
                  <Checkbox
                    checked={selected.includes(option)}
                    onCheckedChange={() => toggleOption(option)}
                  />
                  <span className="flex-1 truncate">{option}</span>
                  {selected.includes(option) && <Check className="w-4 h-4 text-slate-500" />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
