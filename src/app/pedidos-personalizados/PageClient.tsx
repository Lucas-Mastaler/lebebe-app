'use client'

import { PackageSearch } from 'lucide-react'
import { GestaoPedidosPersonalizados } from '@/components/pedidos-personalizados/GestaoPedidosPersonalizados'

export default function PedidosPersonalizadosPageClient() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
      <header className="mb-6 flex items-start gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#00A5E6] text-white shadow-sm"><PackageSearch className="size-6" /></span>
        <div><p className="text-sm font-semibold uppercase tracking-wider text-[#00A5E6]">Pedidos personalizados</p><h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Gestão de pedidos</h1><p className="mt-1 text-sm text-slate-600 sm:text-base">Consulte, revise e atualize pedidos Moriah no seu escopo de unidades.</p></div>
      </header>
      <GestaoPedidosPersonalizados />
    </main>
  )
}
