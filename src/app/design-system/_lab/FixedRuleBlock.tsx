import { CheckCircle2 } from 'lucide-react'

interface FixedRuleBlockProps {
  code: string
  title: string
  rule: string
  fixedValue: string
  content: React.ReactNode
  note?: string
}

/**
 * Regra de comportamento já definida pelo usuário — não é uma decisão
 * A/B/C. Mostra código, nome, regra, valor aprovado e um exemplo
 * visual/funcional, com indicação clara de que já está aprovada.
 */
export function FixedRuleBlock({ code, title, rule, fixedValue, content, note }: FixedRuleBlockProps) {
  return (
    <div id={`decisao-${code}`} className="scroll-mt-24">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2 border-b border-slate-200 pb-3">
        <div>
          <span className="font-mono text-xs font-bold tracking-wide text-emerald-600">{code}</span>
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          <p className="text-sm text-slate-500">{rule}</p>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
          <CheckCircle2 className="size-3.5" />
          APROVADA · {code}={fixedValue}
        </span>
      </div>

      <div className="max-w-md rounded-2xl border-2 border-emerald-200 bg-emerald-50/40 p-3">
        <div className="mb-2 flex items-center gap-2">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-emerald-500 bg-emerald-500 text-white">
            <CheckCircle2 className="size-3.5" />
          </span>
          <span className="text-sm font-semibold text-slate-800">
            {code} = {fixedValue}
          </span>
        </div>
        {note && <p className="mb-3 text-xs text-slate-500">{note}</p>}
        <div className="rounded-xl border border-dashed border-emerald-200 bg-white p-3">{content}</div>
      </div>
    </div>
  )
}
