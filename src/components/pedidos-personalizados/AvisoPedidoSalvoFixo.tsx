'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, CheckCircle2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

const DURACAO_MS = 10000

/**
 * Aviso disparado uma vez quando `disparo` passa de falso para verdadeiro.
 * Fica visível por 10s ou até o usuário fechar. Deve ser renderizado como
 * irmão, logo antes, da barra fixa de resumo (`BarraResumoPedidoPersonalizado`)
 * dentro do mesmo contêiner `sticky bottom-0` — assim ele empilha acima da
 * barra (nunca a sobrepõe) e fica centralizado na mesma área de conteúdo
 * (sem invadir a faixa da sidebar), sem precisar de `position: fixed`.
 */
export function AvisoPedidoSalvoFixo({ disparo, titulo, mensagem }: { disparo: boolean; titulo: string; mensagem: string }) {
  const [fechado, setFechado] = useState(false)

  useEffect(() => {
    if (!disparo) return
    const temporizador = window.setTimeout(() => setFechado(true), DURACAO_MS)
    return () => window.clearTimeout(temporizador)
  }, [disparo])

  if (!disparo || fechado) return null

  return (
    <div className="flex w-full justify-center px-4" role="status">
      <div className="flex w-full max-w-xl items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-xl">
        <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-emerald-600" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="font-bold text-emerald-900">{titulo}</p>
          <p className="mt-1 text-sm text-emerald-800">{mensagem}</p>
          <Button asChild type="button" size="sm" variant="outline" className="mt-3 min-h-9 border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-100">
            <Link href="/pedidos-personalizados">Ir para a gestão de pedidos<ArrowRight /></Link>
          </Button>
        </div>
        <button
          type="button"
          aria-label="Fechar aviso"
          className="shrink-0 rounded-full p-1 text-emerald-700 hover:bg-emerald-100"
          onClick={() => setFechado(true)}
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
