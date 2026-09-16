import { TrendingDown, TrendingUp } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { typography } from '@/lib/design-system/typography'

/** Tom semântico do card — mesmo vocabulário de `Badge` (STA=A), nunca uma cor ad hoc por categoria. */
export type KpiCardTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand'

const TONE_CLASSES: Record<KpiCardTone, string> = {
  neutral: 'border-slate-200 bg-white',
  success: 'border-emerald-100 bg-success/5',
  warning: 'border-amber-100 bg-warning/5',
  danger: 'border-red-100 bg-destructive/5',
  info: 'border-sky-100 bg-info/5',
  brand: 'border-primary/10 bg-primary/5',
}

/** KPI Card oficial (KPI=B — label + ícone + valor + variação percentual). */
export interface KpiCardProps extends React.ComponentProps<'div'> {
  label: string
  value?: React.ReactNode
  icon?: React.ReactNode
  delta?: { value: string; direction: 'up' | 'down' }
  loading?: boolean
  /** Tom semântico do card (achado real: telas com muitos KPIs precisavam diferenciar categoria sem espalhar cor ad hoc por métrica). Default: `neutral`. */
  tone?: KpiCardTone
  /** Conteúdo extra ao lado do label (ex.: ícone de ajuda/tooltip explicando a métrica). */
  labelAction?: React.ReactNode
  /** Linha secundária opcional abaixo do valor (ex.: percentual, detalhamento por loja). */
  detail?: React.ReactNode
}

export function KpiCard({ label, value, icon, delta, loading, tone = 'neutral', labelAction, detail, className, ...props }: KpiCardProps) {
  return (
    <div data-slot="ds-kpi-card" className={cn('rounded-2xl border p-3 shadow-sm', TONE_CLASSES[tone], className)} {...props}>
      <div className="flex items-center justify-between gap-1">
        <div className="flex min-w-0 items-center gap-1">
          <p className={cn(typography.caption, 'truncate')}>{label}</p>
          {labelAction}
        </div>
        {icon && <span className="shrink-0 text-slate-400">{icon}</span>}
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-16" />
      ) : (
        <>
          <div className="mt-1 flex items-baseline gap-1.5">
            <p className={typography.kpiValue}>{value}</p>
            {delta && (
              <span className={cn('flex items-center gap-0.5 text-xs font-semibold', delta.direction === 'up' ? 'text-emerald-600' : 'text-red-600')}>
                {delta.direction === 'up' ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                {delta.value}
              </span>
            )}
          </div>
          {detail && <div className="mt-0.5 text-[11px] text-slate-500">{detail}</div>}
        </>
      )}
    </div>
  )
}
