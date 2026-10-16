'use client'

import * as React from 'react'
import { Button } from '@/components/design-system'
import type { UnidadeIdadeCrianca } from '@/lib/atendimento-presencial/ficha-schema'

type Props = {
  unidade?: UnidadeIdadeCrianca
  valor?: number
  disabled?: boolean
  onChange: (idade: { idadeUnidade: UnidadeIdadeCrianca; idadeValor?: number }) => void
}

/** Mesmos limites e seleção por toque para cadastro novo e confirmação histórica. */
export function IdadeCriancaSelector({ unidade, valor, disabled, onChange }: Props) {
  const estilo = (selected: boolean) => `min-h-12 whitespace-normal border ${selected ? 'border-primary bg-primary/10 text-primary' : 'border-input bg-input-background text-slate-700'}`
  return <div className="grid gap-3">
    <div className="grid grid-cols-2 gap-2" role="group" aria-label="Unidade da idade">
      {(['meses', 'anos'] as const).map((item) => <Button key={item} type="button" variant="secondary" disabled={disabled} aria-pressed={unidade === item} className={estilo(unidade === item)} onClick={() => onChange({ idadeUnidade: item, idadeValor: undefined })}>{item === 'meses' ? 'Meses' : 'Anos'}</Button>)}
    </div>
    {unidade && <div className="grid grid-cols-4 gap-2" role="group" aria-label="Valor da idade">
      {Array.from({ length: unidade === 'meses' ? 11 : 6 }, (_, i) => i + 1).map((item) => <Button key={item} type="button" variant="secondary" disabled={disabled} aria-pressed={valor === item} className={estilo(valor === item)} onClick={() => onChange({ idadeUnidade: unidade, idadeValor: item })}>{item}</Button>)}
    </div>}
  </div>
}
