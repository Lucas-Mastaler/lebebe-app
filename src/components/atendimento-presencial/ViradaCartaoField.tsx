'use client'

import { useState } from 'react'
import { FormField, Input } from '@/components/design-system'
import { prepararViradaCartaoInput, validarViradaCartaoInput } from '@/lib/atendimento-presencial/virada-cartao-input'

type Props = {
  id: string
  value: string
  onChange: (valor: string) => void
  error?: string
  className?: string
}

export function ViradaCartaoField({ id, value, onChange, error, className }: Props) {
  const [interagiu, setInteragiu] = useState(false)
  const [erroDigitacao, setErroDigitacao] = useState<string>()
  const erro = erroDigitacao ?? (interagiu ? validarViradaCartaoInput(value) : error)

  return (
    <FormField
      id={id}
      label="Virada do cartão — dia e mês"
      required
      helper="Digite DD/MM, sem ano. Dia: 01 a 31. Mês: 01 a 12. Exemplo: 05/08."
      error={erro}
    >
      {(field) => (
        <Input
          {...field}
          value={value}
          onChange={(event) => {
            const resultado = prepararViradaCartaoInput(event.target.value)
            setErroDigitacao(resultado.erro)
            if (!resultado.erro) onChange(resultado.valor)
          }}
          onBlur={() => {
            setInteragiu(true)
          }}
          inputMode="numeric"
          placeholder="DD/MM"
          className={className}
        />
      )}
    </FormField>
  )
}
