'use client'

import { Button, FormField } from '@/components/design-system'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PARENTESCOS_CLIENTE } from '@/lib/atendimento-presencial/clientes'

// O vínculo da criança usa texto; as chaves do cadastro legado de cliente não são seu contrato.
export function ParentescoCriancaField({ id, value, onChange, disabled, error }: {
  id: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  error?: string
}) {
  const padronizado = PARENTESCOS_CLIENTE.some((item) => item.label === value)
  return <div className="grid gap-2">
    <FormField id={id} label="Parentesco da cliente com a criança" required error={error}>
      {(field) => <Select value={padronizado ? value : ''} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger {...field} className="h-12 w-full text-base"><SelectValue placeholder="Selecione o parentesco" /></SelectTrigger>
        <SelectContent position="popper" className="max-h-60">
          {PARENTESCOS_CLIENTE.map((item) => <SelectItem key={item.chave} value={item.label}>{item.label}</SelectItem>)}
        </SelectContent>
      </Select>}
    </FormField>
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Atalhos de parentesco">
      <span className="text-xs text-muted-foreground">Sugestões rápidas:</span>
      {['Mãe', 'Avó', 'Tia'].map((label) => <Button key={label} type="button" variant="secondary" size="sm" disabled={disabled} onClick={() => onChange(label)}>{label}</Button>)}
    </div>
  </div>
}
