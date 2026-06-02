'use client'

import { useCallback, useState } from 'react'
import { TrendingUp } from 'lucide-react'
import { FiltrosSGI } from '@/components/inteligencia-comercial/FiltrosSGI'
import { CardsSGI } from '@/components/inteligencia-comercial/CardsSGI'
import { TabelaVendas } from '@/components/inteligencia-comercial/TabelaVendas'
import { ModalDetalheVenda } from '@/components/inteligencia-comercial/ModalDetalheVenda'
import type { SgiCards, SgiDocumento, SgiFiltros, SgiVendasResponse } from '@/types/sgi'

export default function InteligenciaComercialPage() {
  const [vendas, setVendas] = useState<SgiDocumento[]>([])
  const [total, setTotal] = useState(0)
  const [cards, setCards] = useState<SgiCards | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filtrosAtivos, setFiltrosAtivos] = useState<SgiFiltros>({})
  const [page, setPage] = useState(1)
  const [buscouUmaVez, setBuscouUmaVez] = useState(false)

  const [vendaSelecionada, setVendaSelecionada] = useState<SgiDocumento | null>(null)
  const [modalAberto, setModalAberto] = useState(false)

  const buscar = useCallback(async (filtros: SgiFiltros) => {
    setIsLoading(true)
    setError(null)

    const paginaAtual = filtros.page ?? 1
    setFiltrosAtivos(filtros)
    setPage(paginaAtual)

    try {
      const res = await fetch('/api/sgi/vendas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...filtros, page: paginaAtual }),
      })

      if (!res.ok) throw new Error(`Erro ${res.status}`)

      const data: SgiVendasResponse = await res.json()
      setVendas(data.vendas)
      setTotal(data.total)
      setCards(data.cards)
      setBuscouUmaVez(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao buscar vendas'
      setError(msg)
      console.error('[UI][INTELIGENCIA-COMERCIAL] erro:', msg)
    } finally {
      setIsLoading(false)
    }
  }, [])

  function handlePageChange(novaPagina: number) {
    buscar({ ...filtrosAtivos, page: novaPagina })
  }

  function handleVerDetalhe(venda: SgiDocumento) {
    setVendaSelecionada(venda)
    setModalAberto(true)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-sky-50">
          <TrendingUp className="w-5 h-5 text-sky-600" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-slate-800">Inteligência Comercial</h1>
          <p className="text-xs text-slate-500">Vendas importadas do SGI Documentos de Saída</p>
        </div>
      </div>

      {/* Filtros */}
      <FiltrosSGI onPesquisar={buscar} isLoading={isLoading} />

      {/* Erro */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Cards — só exibe após primeira busca */}
      {(buscouUmaVez || isLoading) && (
        <CardsSGI cards={cards} isLoading={isLoading} />
      )}

      {/* Tabela — só exibe após primeira busca */}
      {(buscouUmaVez || isLoading) && (
        <TabelaVendas
          vendas={vendas}
          total={total}
          page={page}
          isLoading={isLoading}
          onPageChange={handlePageChange}
          onVerDetalhe={handleVerDetalhe}
        />
      )}

      {/* Estado inicial */}
      {!buscouUmaVez && !isLoading && !error && (
        <div className="bg-white border border-slate-200 rounded-xl py-16 flex flex-col items-center justify-center gap-3 text-slate-400">
          <TrendingUp className="w-10 h-10 opacity-30" />
          <p className="text-sm">Use os filtros acima e clique em Pesquisar para visualizar as vendas.</p>
        </div>
      )}

      {/* Modal de detalhe */}
      <ModalDetalheVenda
        venda={vendaSelecionada}
        open={modalAberto}
        onOpenChange={setModalAberto}
        onSyncCompleted={() => buscar({ ...filtrosAtivos, page })}
      />
    </div>
  )
}
