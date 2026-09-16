'use client'

import { useCallback, useState } from 'react'
import { TrendingUp } from 'lucide-react'
import { Alert, EmptyState, PageContainer, PageHeader } from '@/components/design-system'
import { FiltrosSGI } from '@/components/inteligencia-comercial/FiltrosSGI'
import { CardsSGI } from '@/components/inteligencia-comercial/CardsSGI'
import { TabelaVendas } from '@/components/inteligencia-comercial/TabelaVendas'
import { ModalDetalheVenda } from '@/components/inteligencia-comercial/ModalDetalheVenda'
import { ModalObservacoes } from '@/components/inteligencia-comercial/ModalObservacoes'
import { SyncLotePanel } from '@/components/inteligencia-comercial/SyncLotePanel'
import { useSyncLote } from '@/hooks/useSyncLote'
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
  const [vendaObs, setVendaObs] = useState<SgiDocumento | null>(null)
  const [modalObsAberto, setModalObsAberto] = useState(false)

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

  const recarregarPaginaAtual = useCallback(() => {
    buscar({ ...filtrosAtivos, page })
  }, [buscar, filtrosAtivos, page])

  const { estado: estadoLote, iniciar: iniciarLote, cancelar: cancelarLote, resetar: resetarLote } =
    useSyncLote(recarregarPaginaAtual)

  function handlePageChange(novaPagina: number) {
    buscar({ ...filtrosAtivos, page: novaPagina })
  }

  function handleVerDetalhe(venda: SgiDocumento) {
    setVendaSelecionada(venda)
    setModalAberto(true)
  }

  function handleObsClick(venda: SgiDocumento) {
    setVendaObs(venda)
    setModalObsAberto(true)
  }

  function handleIniciarLote(forcar: boolean) {
    iniciarLote(vendas, forcar).then(() => {
      recarregarPaginaAtual()
    })
  }

  return (
    <PageContainer className="space-y-5">
      <PageHeader
        icon={<TrendingUp className="size-5" />}
        eyebrow="SGI"
        title="Inteligência Comercial"
        description="Vendas importadas do SGI Documentos de Saída"
      />

      {/* Filtros */}
      <FiltrosSGI onPesquisar={buscar} isLoading={isLoading} />

      {/* Erro */}
      {error && (
        <Alert tone="danger" title="Não foi possível buscar as vendas.">{error}</Alert>
      )}

      {/* Cards — só exibe após primeira busca */}
      {(buscouUmaVez || isLoading) && (
        <CardsSGI cards={cards} isLoading={isLoading} />
      )}

      {/* Sync em lote — só exibe após primeira busca */}
      {buscouUmaVez && (
        <SyncLotePanel
          vendas={vendas}
          estado={estadoLote}
          onIniciar={handleIniciarLote}
          onCancelar={cancelarLote}
          onResetar={resetarLote}
        />
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
          onObsClick={handleObsClick}
        />
      )}

      {/* Estado inicial */}
      {!buscouUmaVez && !isLoading && !error && (
        <EmptyState icon={<TrendingUp />} title="Consulte as vendas" description="Use os filtros acima e clique em Filtrar para visualizar as vendas." />
      )}

      {/* Modal de detalhe */}
      <ModalDetalheVenda
        venda={vendaSelecionada}
        open={modalAberto}
        onOpenChange={setModalAberto}
        onSyncCompleted={() => buscar({ ...filtrosAtivos, page })}
      />

      {/* Modal de observações */}
      {vendaObs && (
        <ModalObservacoes
          open={modalObsAberto}
          onOpenChange={setModalObsAberto}
          numeroLancamento={vendaObs.numero_lancamento}
          clienteNome={vendaObs.cliente ?? null}
        />
      )}
    </PageContainer>
  )
}
