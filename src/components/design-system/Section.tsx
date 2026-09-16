import * as React from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SECTION_TONE_CLASSES, type SectionTone } from '@/lib/design-system/section-tones'

/**
 * Seção temática oficial (SEC=C — surface levemente tintada + acento
 * lateral + divisor no header). Auditado a partir de
 * `/inteligencia-comercial` (`ModalDetalheVenda.tsx`, componente
 * `Section` interno, já aprovado em produção) — este componente
 * generaliza esse padrão sem amarrar a nenhum módulo específico.
 *
 * `tone` é só um dos 3 tons auxiliares (CLR=B, derivados da Color
 * Foundation da marca — ver `section-tones.ts`) — não tem significado de
 * negócio. A tela escolhe qual tom usar para qual assunto; não crie regra
 * fixa tipo "cliente = section-1".
 */
export interface SectionProps {
  title: React.ReactNode
  description?: React.ReactNode
  icon?: React.ReactNode
  /** Tom auxiliar 1/2/3 (CLR=B) — não semântico. Default: `section-1`. */
  tone?: SectionTone
  /** Permite recolher explicitamente blocos extensos, sem descartar seu conteúdo. */
  collapsible?: boolean
  /** Só tem efeito quando `collapsible` é verdadeiro. O padrão é expandida. */
  defaultCollapsed?: boolean
  /** Variante visual subordinada para agrupamentos dentro de uma Section principal. */
  variant?: 'default' | 'subsection'
  children: React.ReactNode
  className?: string
}

export function Section({ title, description, icon, tone = 'section-1', collapsible = false, defaultCollapsed = false, variant = 'default', children, className }: SectionProps) {
  const t = SECTION_TONE_CLASSES[tone]
  const [expanded, setExpanded] = React.useState(!defaultCollapsed)
  const contentId = React.useId()
  const subsection = variant === 'subsection'
  return (
    <div className={cn(
      subsection ? 'rounded-lg border border-slate-200 bg-white p-3' : 'rounded-xl border border-l-4 p-4',
      !subsection && t.surface,
      !subsection && t.border,
      !subsection && t.accentBar,
      className
    )}>
      <div className={cn('flex items-center gap-2 border-b', subsection ? 'mb-2 border-slate-100 pb-2' : 'mb-3 pb-2.5', !subsection && t.divider)}>
        {icon && <span className={cn('shrink-0', subsection ? 'text-slate-500' : t.icon)}>{icon}</span>}
        <div className="min-w-0">
          <h3 className={cn(subsection ? 'text-xs font-semibold uppercase tracking-wide text-slate-600' : 'text-sm font-semibold', !subsection && t.title)}>{title}</h3>
          {description && <p className="text-xs text-slate-500">{description}</p>}
        </div>
        {collapsible && (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            aria-controls={contentId}
            className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-white/60 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            {expanded ? <ChevronUp className="size-4" aria-hidden="true" /> : <ChevronDown className="size-4" aria-hidden="true" />}
            {expanded ? 'Recolher' : 'Expandir'}
          </button>
        )}
      </div>
      <div id={contentId} hidden={collapsible && !expanded} className="space-y-2">{children}</div>
    </div>
  )
}
