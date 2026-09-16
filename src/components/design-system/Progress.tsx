import { cn } from '@/lib/utils'

export function clampProgress(value: number): number {
  return Math.min(100, Math.max(0, value))
}

/** Tom do preenchimento — `brand` (padrão) mantém a cor neutra de marca; os demais comunicam um estado semântico (ex.: concluído/parcial/vazio). */
export type ProgressTone = 'brand' | 'neutral' | 'success' | 'warning'

const TONE_FILL: Record<ProgressTone, string> = {
  brand: 'bg-primary',
  neutral: 'bg-slate-300',
  success: 'bg-emerald-500',
  warning: 'bg-amber-400',
}

/** Exportado só para teste unitário do mapeamento tom → classe (sem exigir render de DOM). */
export function progressToneClass(tone: ProgressTone): string {
  return TONE_FILL[tone]
}

export interface ProgressProps extends React.ComponentProps<'div'> {
  /** Percentual real já conhecido, de 0 a 100. */
  value: number
  label?: string
  showValue?: boolean
  /** Tom do preenchimento. Default `brand` — mesma cor de marca usada até aqui. */
  tone?: ProgressTone
}

/** Indicador determinístico: só use quando o processo informa progresso real. */
export function Progress({ value, label = 'Progresso', showValue = false, tone = 'brand', className, ...props }: ProgressProps) {
  const normalizedValue = clampProgress(value)

  return (
    <div className={cn('flex items-center gap-2', className)} {...props}>
      <div
        aria-label={label}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={normalizedValue}
        aria-valuetext={`${normalizedValue}%`}
        className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"
        role="progressbar"
      >
        <div className={cn('h-full rounded-full transition-[width] duration-300 ease-out', TONE_FILL[tone])} style={{ width: `${normalizedValue}%` }} />
      </div>
      {showValue && <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{normalizedValue}%</span>}
    </div>
  )
}
