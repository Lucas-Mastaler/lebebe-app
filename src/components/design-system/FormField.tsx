import * as React from 'react'
import { cn } from '@/lib/utils'
import { requiredSuffix } from '@/lib/design-system/validation'
import { typography } from '@/lib/design-system/typography'

export interface FormFieldRenderProps {
  id: string
  'aria-invalid': boolean
  'aria-describedby'?: string
}

/**
 * Infraestrutura oficial de campo (label + controle + helper + erro),
 * cobrindo REQ=C (obrigatório com "*", opcional com "(opcional)", sempre
 * os dois marcados) e o padrão ERR de erro de campo (estado visual +
 * mensagem inline + associação acessível via `aria-invalid`/
 * `aria-describedby` — nunca só cor). Não amarra a nenhum controle
 * específico: `children` é uma render prop que recebe os atributos já
 * prontos para o campo real (`Input`, `Select`, `DateField`, `Combobox`,
 * etc.).
 */
export interface FormFieldProps {
  id: string
  label: string
  required?: boolean
  helper?: string
  error?: string
  className?: string
  children: (fieldProps: FormFieldRenderProps) => React.ReactNode
}

export function FormField({ id, label, required = false, helper, error, className, children }: FormFieldProps) {
  const helperId = helper ? `${id}-helper` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [helperId, errorId].filter(Boolean).join(' ') || undefined
  const suffix = requiredSuffix(required)

  return (
    <div className={cn('space-y-1', className)}>
      <label htmlFor={id} className={typography.label}>
        {label}
        <span className={suffix.kind === 'required' ? 'text-destructive' : 'text-slate-400'}>{suffix.text}</span>
      </label>
      {children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': describedBy })}
      {helper && !error && (
        <p id={helperId} className={typography.helper}>
          {helper}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
