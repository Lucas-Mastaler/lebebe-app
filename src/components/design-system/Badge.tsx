import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/** Status/Badge oficial (STA=A — pílula suave). Tom semântico, não amarrado a nenhuma regra de negócio específica — cada tela decide qual `tone` representa cada status seu. */
export const badgeVariants = cva('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold', {
  variants: {
    tone: {
      neutral: 'bg-slate-100 text-slate-700',
      success: 'bg-success/10 text-emerald-700',
      warning: 'bg-warning/10 text-amber-800',
      danger: 'bg-destructive/10 text-red-700',
      info: 'bg-info/10 text-sky-700',
      brand: 'bg-primary/10 text-primary',
    },
  },
  defaultVariants: { tone: 'neutral' },
})

export interface BadgeProps extends React.ComponentProps<'span'>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span data-slot="ds-badge" className={cn(badgeVariants({ tone, className }))} {...props} />
}
