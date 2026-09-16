import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Alert oficial (FBK=A — borda + fundo claro). Usado para banners
 * persistentes: erro de servidor/integração (ver ERR — nunca renderize
 * erro de servidor como erro de campo), avisos e mensagens informativas
 * que precisam continuar visíveis (diferente de `FDB=C`, que é feedback
 * inline pontual perto da própria ação — ver `docs/design-system/interaction-standards.md`).
 */
const TONE = {
  success: { classes: 'border-emerald-200 bg-emerald-50 text-emerald-800', Icon: CheckCircle2 },
  warning: { classes: 'border-amber-200 bg-amber-50 text-amber-800', Icon: AlertTriangle },
  danger: { classes: 'border-red-200 bg-red-50 text-red-700', Icon: XCircle },
  info: { classes: 'border-sky-200 bg-sky-50 text-sky-800', Icon: Info },
} as const

export type AlertTone = keyof typeof TONE

export interface AlertProps extends Omit<React.ComponentProps<'div'>, 'title'> {
  tone: AlertTone
  title?: React.ReactNode
}

export function Alert({ tone, title, className, children, ...props }: AlertProps) {
  const { classes, Icon } = TONE[tone]
  return (
    <div data-slot="ds-alert" role="alert" className={cn('flex items-start gap-2 rounded-md border px-3 py-2 text-sm', classes, className)} {...props}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? 'mt-0.5' : undefined}>{children}</div>}
      </div>
    </div>
  )
}
