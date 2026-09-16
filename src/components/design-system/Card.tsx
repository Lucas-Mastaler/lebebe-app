import * as React from 'react'
import { cn } from '@/lib/utils'

/** Card oficial (CRD=C — cabeçalho tonal; SHD=C — elevação por contorno/glow, ver `.ds-elevation-glow` em globals.css). RAD=B (radius atual) já é o padrão do projeto. */
export function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="ds-card"
      className={cn('ds-elevation-glow overflow-hidden rounded-2xl border border-slate-200 bg-white', className)}
      {...props}
    />
  )
}

export function CardHeader({
  className,
  icon,
  title,
  description,
  action,
  ...props
}: React.ComponentProps<'div'> & {
  icon?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div data-slot="ds-card-header" className={cn('flex items-center gap-2 border-b border-slate-100 bg-primary/5 px-4 py-3', className)} {...props}>
      {icon && <span className="flex size-6 shrink-0 items-center justify-center text-primary">{icon}</span>}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-slate-900">{title}</p>
        {description && <p className="truncate text-xs text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="ds-card-content" className={cn('p-4', className)} {...props} />
}

export function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="ds-card-footer" className={cn('flex items-center justify-end gap-2 border-t border-slate-100 px-4 py-3', className)} {...props} />
}
