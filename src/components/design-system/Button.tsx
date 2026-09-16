import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Button oficial do Design System v1 (BTN=B — sistema tonal). Vive fora
 * de `src/components/ui/button.tsx` de propósito: aquele componente já é
 * usado por todas as telas existentes com o visual sólido/outline atual
 * (ver `docs/design-system/README.md`, "Compatibilidade") — sobrescrever
 * o visual dele silenciosamente quebraria o app inteiro. Este é o padrão
 * novo, para telas que adotarem o DS v1.
 */
export const dsButtonVariants = cva(
  'inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*=size-])]:size-4 shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90',
        secondary: 'bg-primary/10 text-primary hover:bg-primary/15',
        ghost: 'text-slate-500 hover:bg-slate-100 hover:text-slate-700',
        destructive: 'bg-destructive/10 text-destructive hover:bg-destructive/15',
      },
      size: {
        default: 'h-9 px-4 has-[>svg]:px-3',
        sm: 'h-8 px-3 text-xs has-[>svg]:px-2.5',
        lg: 'h-10 px-6',
        icon: 'size-9 rounded-full',
      },
    },
    defaultVariants: { variant: 'primary', size: 'default' },
  }
)

export interface ButtonProps
  extends Omit<React.ComponentProps<'button'>, 'children'>,
    VariantProps<typeof dsButtonVariants> {
  asChild?: boolean
  /** SAV=A com ajuste: enquanto `loading` é true, o botão fica desabilitado e mostra spinner — nunca permite duplo clique. */
  loading?: boolean
  children?: React.ReactNode
}

export function Button({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp
      data-slot="ds-button"
      data-variant={variant}
      className={cn(dsButtonVariants({ variant, size, className }))}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {asChild ? children : (
        <>
          {loading && <Loader2 className="animate-spin" aria-hidden="true" />}
          {children}
        </>
      )}
    </Comp>
  )
}

export function IconButton({ className, 'aria-label': ariaLabel, ...props }: ButtonProps & { 'aria-label': string }) {
  return <Button size="icon" className={className} aria-label={ariaLabel} {...props} />
}
