'use client'

import * as React from 'react'
import { CalendarIcon } from 'lucide-react'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { dateToBr, formatDateBr, parseBrDate } from '@/lib/design-system/dates'

/**
 * Campo de data oficial (DAT=A com o ajuste aprovado): digitação manual
 * SEMPRE disponível (dd/mm/aaaa) E ícone de calendário clicável ao lado —
 * nenhum dos dois é opcional/removível. O ícone abre o calendário
 * (`Calendar` já existente); escolher uma data lá também atualiza o texto
 * digitado. `aria-invalid`/`aria-describedby` são repassados pelo
 * `FormField` — este componente não decide sozinho o texto do erro
 * (a validação em si vive em `src/lib/design-system/dates.ts`).
 */
export interface DateFieldProps {
  id?: string
  value: string
  onChange: (display: string) => void
  onBlur?: () => void
  placeholder?: string
  disabled?: boolean
  min?: Date
  max?: Date
  'aria-invalid'?: boolean
  'aria-describedby'?: string
}

export function DateField({ id, value, onChange, onBlur, placeholder = 'dd/mm/aaaa', disabled, min, max, ...aria }: DateFieldProps) {
  const [open, setOpen] = React.useState(false)
  const selectedDate = parseBrDate(value) ?? undefined
  const disabledMatchers = React.useMemo(() => {
    const matchers: Array<{ before: Date } | { after: Date }> = []
    if (min) matchers.push({ before: min })
    if (max) matchers.push({ after: max })
    return matchers.length > 0 ? matchers : undefined
  }, [min, max])

  return (
    <div className="relative">
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(formatDateBr(e.target.value))}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        inputMode="numeric"
        className={cn(
          'border-input bg-input-background h-9 w-full rounded-md border py-1 pr-9 pl-3 text-sm shadow-xs outline-none transition-[color,box-shadow]',
          'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
          'aria-invalid:ring-destructive/20 aria-invalid:border-destructive',
          'disabled:cursor-not-allowed disabled:opacity-50'
        )}
        {...aria}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-label="Abrir calendário"
            className="absolute right-1.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:pointer-events-none disabled:opacity-50"
          >
            <CalendarIcon className="size-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto p-0">
          <Calendar
            mode="single"
            selected={selectedDate}
            defaultMonth={selectedDate}
            disabled={disabledMatchers}
            onSelect={(date) => {
              if (date) onChange(dateToBr(date))
              setOpen(false)
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
