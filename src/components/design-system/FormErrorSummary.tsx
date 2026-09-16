import { AlertCircle } from 'lucide-react'
import { buildErrorSummary, type FieldErrors } from '@/lib/design-system/errors'

/**
 * Resumo de erros no topo do formulário — ERR=C com o ajuste aprovado:
 * COMPLEMENTA os erros inline de cada campo, nunca os substitui. Só
 * renderiza algo quando há pelo menos um erro. Quando `onFocusField` é
 * passado, cada item vira um botão que foca o campo correspondente.
 */
export interface FormErrorSummaryProps {
  errors: FieldErrors
  title?: string
  onFocusField?: (field: string) => void
}

export function FormErrorSummary({ errors, title = 'Corrija os campos abaixo antes de continuar:', onFocusField }: FormErrorSummaryProps) {
  const items = buildErrorSummary(errors)
  if (items.length === 0) return null

  return (
    <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
      <p className="flex items-center gap-1.5 font-semibold">
        <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
        {title}
      </p>
      <ul className="mt-1 list-disc space-y-0.5 pl-6">
        {items.map((item) =>
          onFocusField ? (
            <li key={item.field}>
              <button type="button" onClick={() => onFocusField(item.field)} className="underline underline-offset-2 hover:text-red-900">
                {item.message}
              </button>
            </li>
          ) : (
            <li key={item.field}>{item.message}</li>
          )
        )}
      </ul>
    </div>
  )
}
