import { cn } from '@/lib/utils'
import { typography } from '@/lib/design-system/typography'

/** PageHeader oficial (HDR=A — ícone em badge sólido + eyebrow + título + descrição + ação principal). */
export interface PageHeaderProps extends Omit<React.ComponentProps<'header'>, 'title'> {
  icon?: React.ReactNode
  eyebrow?: string
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
}

export function PageHeader({ icon, eyebrow, title, description, action, className, ...props }: PageHeaderProps) {
  return (
    <header data-slot="ds-page-header" className={cn('flex flex-wrap items-start justify-between gap-4', className)} {...props}>
      <div className="flex items-start gap-3">
        {icon && (
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            {icon}
          </span>
        )}
        <div>
          {eyebrow && <p className={typography.eyebrow}>{eyebrow}</p>}
          <h1 className={typography.pageTitle}>{title}</h1>
          {description && <p className={cn(typography.secondaryBody, 'mt-1')}>{description}</p>}
        </div>
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </header>
  )
}
