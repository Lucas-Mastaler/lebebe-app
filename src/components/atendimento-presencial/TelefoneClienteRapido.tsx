import { Phone } from 'lucide-react'
import { Input, Spinner } from '@/components/design-system'

type Props = {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  erro?: string | null
  loading?: boolean
  compact?: boolean
}

export function TelefoneClienteRapido({
  value,
  onChange,
  disabled = false,
  erro,
  loading = false,
  compact = false,
}: Props) {
  return (
    <div className={`grid gap-2 rounded-lg border border-slate-200 bg-slate-50 sm:grid-cols-[minmax(0,1fr)_minmax(14rem,22rem)] sm:items-center ${compact ? 'p-3' : 'p-4'}`}>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700" htmlFor="telefone-cliente-rapido">
          <Phone className="h-4 w-4 text-sky-700" aria-hidden="true" />
          Telefone da cliente
        </label>
        {loading && (
          <span className="flex items-center gap-1 text-xs text-slate-500">
            <Spinner label="Salvando" />
            Salvando...
          </span>
        )}
      </div>
      {!compact && (
        <p className="text-xs text-slate-500 sm:col-span-2">Você pode informar ou corrigir o telefone em qualquer etapa.</p>
      )}
      <Input
        id="telefone-cliente-rapido"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="h-11 w-full text-base"
        inputMode="tel"
        placeholder="(41) 99999-9999"
        aria-invalid={Boolean(erro)}
        aria-describedby={erro ? 'telefone-cliente-rapido-erro' : undefined}
      />
      {erro && (
        <p id="telefone-cliente-rapido-erro" className="text-sm text-red-700 sm:col-span-2">
          {erro}
        </p>
      )}
    </div>
  )
}
