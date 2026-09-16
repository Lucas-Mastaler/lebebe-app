import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Área interna para páginas predominantemente de formulário. Mantém o
 * `PageContainer` em largura total e centraliza só o conteúdo que não se
 * beneficia da área ampla, com espaço confortável para três campos por linha.
 */
export const FormPageContent = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(
  ({ children, className, ...props }, ref) => (
    <div ref={ref} className={cn('mx-auto w-full max-w-6xl', className)} {...props}>{children}</div>
  )
)

FormPageContent.displayName = 'FormPageContent'
