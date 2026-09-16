import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Input oficial (INP=A — visual bordado, sem mudar o estilo escolhido).
 * Ajuste aprovado: a superfície interna usa `bg-input-background` (branco
 * em vez de transparente) para se separar sutilmente do fundo da página
 * — antes o campo herdava `bg-transparent`, que ficava quase idêntico ao
 * `--background` da página. Ver `docs/design-system/foundations.md`,
 * "Superfície de campo". Encaminha `ref` (ex.: para autofoco ao entrar em
 * modo de edição) — achado no piloto de `/chamados-finalizados`.
 */
export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(function Input(
  { className, type, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      type={type}
      data-slot="ds-input"
      className={cn(
        'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground border-input bg-input-background flex h-9 w-full min-w-0 rounded-md border px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow] file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        'aria-invalid:ring-destructive/20 aria-invalid:border-destructive',
        'read-only:bg-muted read-only:text-muted-foreground',
        className
      )}
      {...props}
    />
  )
})
