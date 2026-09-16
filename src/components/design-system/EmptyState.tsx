import { Inbox, Loader2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/** Empty state oficial (EST=B — ícone em círculo tonal + título + descrição + ação). */
export interface EmptyStateProps extends React.ComponentProps<'div'> {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({ icon, title, description, action, className, ...props }: EmptyStateProps) {
  return (
    <div data-slot="ds-empty-state" className={cn('flex flex-col items-center gap-2 py-8 text-center', className)} {...props}>
      <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">{icon ?? <Inbox className="size-5" />}</span>
      <div>
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        {description && <p className="text-xs text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  )
}

/** Spinner compacto para ações pontuais e áreas pequenas. */
export function Spinner({ className, label = 'Carregando', size = 16 }: { className?: string; label?: string; size?: number | string }) {
  return (
    <span role="status" className="inline-flex items-center gap-1.5">
      <Loader2 className={cn('animate-spin text-primary', className)} size={size} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  )
}

export function SkeletonRows({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)} role="status" aria-label="Carregando">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-4 w-full" />
      ))}
    </div>
  )
}
