'use client'

import * as React from 'react'
import { Check, CheckCircle2, Copy, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CATEGORIES, DECISIONS, FIXED_DECISIONS, OPEN_DECISIONS, type Layer } from './registry'
import { useAllSelections } from './selection-context'

const LAYER_LABEL: Record<Layer, string> = {
  visual: 'VISUAL',
  behavior: 'COMPORTAMENTO',
}

function buildSummaryText(selections: Record<string, string | undefined>) {
  const lines = [
    'DESIGN SYSTEM LE BÉBÉ — SELEÇÕES',
    `(gerado em ${new Date().toLocaleDateString('pt-BR')})`,
    '',
  ]

  for (const layer of ['visual', 'behavior'] as Layer[]) {
    const categoriesInLayer = CATEGORIES.filter((c) => c.layer === layer)
    const itemsInLayer = DECISIONS.filter((d) => categoriesInLayer.some((c) => c.id === d.categoryId))
    if (itemsInLayer.length === 0) continue

    lines.push(LAYER_LABEL[layer])
    for (const item of itemsInLayer) {
      if (item.kind === 'fixed') {
        lines.push(`${item.code}=${item.fixedValue}  (${item.title} — aprovada)`)
        continue
      }
      const val = selections[item.code]
      if (!val) continue // decisão em aberto ainda não escolhida — não entra no resumo
      lines.push(`${item.code}=${val}  (${item.title})`)
    }
    lines.push('')
  }

  return lines.join('\n').trim()
}

export function SummaryPanel() {
  const { selections, reset, hydrated } = useAllSelections()
  const [copied, setCopied] = React.useState(false)

  const answeredOpen = OPEN_DECISIONS.filter((d) => selections[d.code]).length
  const totalOpen = OPEN_DECISIONS.length
  const totalFixed = FIXED_DECISIONS.length
  const summaryText = React.useMemo(() => buildSummaryText(selections), [selections])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(summaryText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard indisponível — o texto continua selecionável manualmente no <pre> abaixo
    }
  }

  return (
    <section id="minhas-escolhas" className="scroll-mt-24 rounded-2xl border-2 border-[#00A5E6] bg-white p-4 shadow-md sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Minhas escolhas</h2>
          {hydrated ? (
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
              <span className="flex items-center gap-1 text-emerald-700">
                <CheckCircle2 className="size-3.5" />
                {totalFixed} regra{totalFixed !== 1 ? 's' : ''} aprovada{totalFixed !== 1 ? 's' : ''}
              </span>
              <span>·</span>
              <span>
                {answeredOpen} de {totalOpen} decisões abertas respondidas
              </span>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Carregando suas seleções salvas...</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <RotateCcw className="size-3.5" />
            Limpar seleções
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold text-white transition',
              copied ? 'bg-emerald-600' : 'bg-[#00A5E6] hover:bg-[#0090cc]'
            )}
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? 'Copiado!' : 'Copiar escolhas'}
          </button>
        </div>
      </div>

      <pre className="max-h-80 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-700 whitespace-pre-wrap">
        {summaryText}
      </pre>

      <p className="mt-3 text-xs text-slate-500">
        Envie este texto para continuar o projeto — ele identifica exatamente cada escolha (ex.: <code className="rounded bg-slate-100 px-1 py-0.5">BTN=B</code>)
        e as regras de comportamento já aprovadas (ex.: <code className="rounded bg-slate-100 px-1 py-0.5">FLT-EXEC=MANUAL</code>). Decisões ainda não
        respondidas não aparecem na lista — só a contagem acima.
      </p>
    </section>
  )
}
