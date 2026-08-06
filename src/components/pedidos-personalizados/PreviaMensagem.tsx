'use client'

import { Check, Copy, MessageSquareText } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Props = {
  mensagem: string | null
  copiada: boolean
  onCopiar: () => void
}

export function PreviaMensagem({ mensagem, copiada, onCopiar }: Props) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6" aria-labelledby="titulo-previa-mensagem">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-sky-50 text-[#00A5E6]"><MessageSquareText /></span>
          <div>
            <h2 id="titulo-previa-mensagem" className="text-lg font-bold text-slate-900">Prévia da mensagem comercial</h2>
            <p className="text-sm text-slate-500">Gerada automaticamente a partir do formulário.</p>
          </div>
        </div>
        <Button type="button" variant="outline" className="min-h-11" disabled={!mensagem} onClick={onCopiar}>
          {copiada ? <Check /> : <Copy />}
          {copiada ? 'Copiada' : 'Copiar mensagem'}
        </Button>
      </div>
      <pre className="max-h-[32rem] min-h-40 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-950 p-4 text-sm leading-relaxed text-slate-50" aria-live="polite">
        {mensagem ?? 'Preencha os campos obrigatórios e as medidas para gerar a prévia.'}
      </pre>
    </section>
  )
}
