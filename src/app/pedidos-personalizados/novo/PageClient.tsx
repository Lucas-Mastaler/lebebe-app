'use client'

import { ClipboardPlus } from 'lucide-react'
import FormularioNovoPedido from '@/components/pedidos-personalizados/FormularioNovoPedido'

export default function NovoPedidoPersonalizadoPageClient() {
  return (
    <main className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
      <header className="mb-6">
        <div className="flex items-start gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#00A5E6] text-white shadow-sm"><ClipboardPlus className="size-6" /></span>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-[#00A5E6]">Pedidos personalizados</p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Novo pedido personalizado</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600 sm:text-base">Preencha os dados comerciais e escolha o fornecedor para continuar.</p>
          </div>
        </div>
      </header>
      <FormularioNovoPedido />
    </main>
  )
}
