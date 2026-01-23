'use client';

import { useCallback, useState } from 'react';
import { PesquisaChamadosResponse } from '@/types';
import { FiltrosChamadosFinalizados } from '@/components/chamados/FiltrosChamadosFinalizados';
import { TabelaChamadosFinalizados } from '@/components/chamados/TabelaChamadosFinalizados';
import { ModalAgendamentosCliente } from '@/components/chamados/ModalAgendamentosCliente';

export default function Page() {
  const [data, setData] = useState<PesquisaChamadosResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentFiltros, setCurrentFiltros] = useState<any | null>(null);
  const [modalContactId, setModalContactId] = useState<string | null>(null);

  const handlePesquisar = useCallback(async (filtros: any) => {
    setIsLoading(true);
    setError(null);
    setCurrentFiltros(filtros);

    console.log('[UI][CHAMADOS] filtros=', filtros);

    try {
      const response = await fetch('/api/chamados-finalizados/pesquisar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filtros),
      });

      if (!response.ok) throw new Error(`Erro na requisição: ${response.status}`);
      const result: PesquisaChamadosResponse = await response.json();

      console.log(`[UI][CHAMADOS] resultados=${result.meta?.total ?? 0}`);

      setData(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao pesquisar';
      setError(errorMessage);
      console.error('Erro na pesquisa:', errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handlePageChange = useCallback((page: number) => {
    if (!currentFiltros) return;
    handlePesquisar({ ...currentFiltros, page });
  }, [currentFiltros, handlePesquisar]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">CHAMADOS FINALIZADOS</h1>
        <p className="text-slate-600 mt-1">Consulta de tickets fechados agregados por cliente</p>
      </div>

      <FiltrosChamadosFinalizados onPesquisar={handlePesquisar} isLoading={isLoading} />

      <TabelaChamadosFinalizados data={data} isLoading={isLoading} error={error} onPageChange={handlePageChange} onVerAgendamentos={(cid) => setModalContactId(cid)} />

      <ModalAgendamentosCliente contactId={modalContactId} open={!!modalContactId} onClose={() => setModalContactId(null)} />
    </div>
  );
}
