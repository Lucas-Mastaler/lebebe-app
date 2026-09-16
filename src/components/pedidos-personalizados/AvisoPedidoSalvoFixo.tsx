'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, X } from 'lucide-react'
import { Alert, Button } from '@/components/design-system'

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
    <div className="flex w-full justify-center px-4">
      <div className="w-full max-w-xl shadow-xl">
        <Alert tone="success" title={titulo} className="items-start rounded-2xl">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p>{mensagem}</p>
              <Button asChild type="button" size="sm" variant="secondary" className="mt-3">
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
        </Alert>
      </div>
    </div>
  )
}
