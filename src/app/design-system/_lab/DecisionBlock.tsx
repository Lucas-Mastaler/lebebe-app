'use client'

import * as React from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSelection, type OptionLetter } from './selection-context'

export interface DecisionOption {
  letter: OptionLetter
  label: string
  note?: string
  content: React.ReactNode
}

interface DecisionBlockProps {
  code: string
  title: string
  description: string
  options: [DecisionOption, DecisionOption, DecisionOption]
}

/**
 * Bloco de decisão: título + descrição + exatamente 3 alternativas
 * selecionáveis (radiogroup com navegação por teclado e foco visível).
 */
export function DecisionBlock({ code, title, description, options }: DecisionBlockProps) {
  const { value, select } = useSelection(code)
  const refs = React.useRef<Array<HTMLDivElement | null>>([])

  function focusIndex(index: number) {
    const len = options.length
    const target = ((index % len) + len) % len
    refs.current[target]?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      focusIndex(index + 1)
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      focusIndex(index - 1)
    } else if (e.key === 'Home') {
      e.preventDefault()
      focusIndex(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      focusIndex(options.length - 1)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      select(options[index].letter)
    }
  }

  return (
    <div id={`decisao-${code}`} className="scroll-mt-24">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2 border-b border-slate-200 pb-3">
        <div>
          <span className="font-mono text-xs font-bold tracking-wide text-[#00A5E6]">{code}</span>
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          <p className="text-sm text-slate-500">{description}</p>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold',
            value ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
          )}
        >
          {value ? `${code}=${value} selecionado` : 'ainda não escolhido'}
        </span>
      </div>

      <div role="radiogroup" aria-label={title} className="grid gap-4 md:grid-cols-3">
        {options.map((opt, index) => {
          const active = value === opt.letter
          return (
            <div
              key={opt.letter}
              ref={(el) => {
                refs.current[index] = el
              }}
              role="radio"
              aria-checked={active}
              aria-label={`${code}${opt.letter} — ${opt.label}`}
              tabIndex={value ? (active ? 0 : -1) : index === 0 ? 0 : -1}
              onClick={() => select(opt.letter)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={cn(
                'group flex min-w-0 cursor-pointer flex-col rounded-2xl border-2 bg-white p-3 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-[#00A5E6] focus-visible:ring-offset-2',
                active
                  ? 'border-[#00A5E6] shadow-md ring-1 ring-[#00A5E6]/20'
                  : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
              )}
            >
              <div className="mb-2 flex items-center gap-2">
                <span
                  className={cn(
                    'flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition',
                    active ? 'border-[#00A5E6] bg-[#00A5E6] text-white' : 'border-slate-300 text-slate-400'
                  )}
                  aria-hidden="true"
                >
                  {active ? <Check className="size-3.5" /> : opt.letter}
                </span>
                <span className="text-sm font-semibold text-slate-800">
                  {code}
                  {opt.letter} — {opt.label}
                </span>
              </div>
              {opt.note && <p className="mb-3 text-xs text-slate-500">{opt.note}</p>}
              <div className="flex-1 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3">
                {opt.content}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
