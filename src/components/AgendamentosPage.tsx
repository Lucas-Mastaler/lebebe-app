'use client'

import { useCallback, useEffect, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { FiltrosAgendamentos } from './FiltrosAgendamentos'
import { TabelaAgendamentos } from './TabelaAgendamentos'
import { PageContainer, PageHeader, SegmentedTabsList, SegmentedTabsTrigger, Tabs, TabsContent } from '@/components/design-system'
import type { Departamento, FiltrosPesquisa, PesquisaResponse } from '@/types'

export function AgendamentosPage() {
  const [activeTab, setActiveTab] = useState('pesquisa')
  const [data, setData] = useState<PesquisaResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [departamentos, setDepartamentos] = useState<Departamento[]>([])
  const [clienteNomeFiltro, setClienteNomeFiltro] = useState('')
  const [currentFiltros, setCurrentFiltros] = useState<FiltrosPesquisa | null>(null)

  useEffect(() => {
    async function fetchDeps() {
      try {
        const response = await fetch('/api/departments')
        if (response.ok) setDepartamentos(await response.json())
      } catch (err) {
        console.error('Falha ao buscar departamentos', err)
      }
    }
    fetchDeps()
  }, [])

  const handlePesquisar = useCallback(async (filtros: FiltrosPesquisa) => {
    setIsLoading(true)
    setError(null)
    setClienteNomeFiltro('')
    setCurrentFiltros(filtros)

    try {
      const response = await fetch('/api/agendamentos/pesquisar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filtros),
      })
      if (!response.ok) throw new Error(`Erro na requisição: ${response.status}`)
      setData(await response.json())
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao pesquisar'
      setError(errorMessage)
      console.error('Erro na pesquisa:', errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handlePageChange = useCallback((page: number) => {
    if (currentFiltros) handlePesquisar({ ...currentFiltros, page })
  }, [currentFiltros, handlePesquisar])

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        icon={<CalendarDays className="size-5" />}
        eyebrow="Digisac"
        title="AGENDAMENTOS"
        description="Consulta e acompanhamento"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <SegmentedTabsList className="max-w-md">
          <SegmentedTabsTrigger value="pesquisa">BUSCA DE AGENDAMENTOS</SegmentedTabsTrigger>
        </SegmentedTabsList>

        <TabsContent value="pesquisa" className="mt-6 space-y-6">
          <FiltrosAgendamentos
            departamentos={departamentos}
            hasResults={(data?.items.length ?? 0) > 0}
            clienteNomeFiltro={clienteNomeFiltro}
            onClienteNomeChange={setClienteNomeFiltro}
            onPesquisar={handlePesquisar}
            onLimpar={() => {
              setData(null)
              setError(null)
              setCurrentFiltros(null)
            }}
            isLoading={isLoading}
          />
          <TabelaAgendamentos
            data={data}
            isLoading={isLoading}
            error={error}
            clienteNomeFiltro={clienteNomeFiltro}
            onPageChange={handlePageChange}
          />
        </TabsContent>
      </Tabs>
    </PageContainer>
  )
}
