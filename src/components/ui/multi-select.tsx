'use client'

import { useState } from 'react'
import { Check, ChevronDown, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

  function toggleOption(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter(v => v !== value))
    } else {
      onChange([...selected, value])
    }
  }

  function clearAll() {
    onChange([])
  }

  return (
    <div className={cn('relative', className)}>
      <Select open={open} onOpenChange={setOpen}>
        <SelectTrigger className="h-9">
          <SelectValue placeholder={placeholder}>
            {selected.length === 0 ? (
              <span className="text-slate-400">{placeholder}</span>
            ) : (
              <span className="truncate">
                {selected.length} selecionado{selected.length !== 1 ? 's' : ''}
              </span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-60">
          {selected.length > 0 && (
            <div className="px-2 py-1.5 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">{selected.length} selecionado{selected.length !== 1 ? 's' : ''}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={(e) => { e.preventDefault(); clearAll() }}
              >
                Limpar
              </Button>
            </div>
          )}
          {options.length === 0 ? (
            <div className="px-2 py-4 text-sm text-slate-400 text-center">
              Nenhuma opção disponível
            </div>
          ) : (
            options.map(option => (
              <SelectItem
                key={option}
                value={option}
                onClick={(e) => { e.preventDefault(); toggleOption(option) }}
                className="cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selected.includes(option)}
                    onCheckedChange={() => toggleOption(option)}
                  />
                  <span className="flex-1 truncate">{option}</span>
                  {selected.includes(option) && <Check className="w-4 h-4 text-slate-500" />}
                </div>
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  )
}
