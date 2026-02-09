'use client';

import { useCallback, useState, useRef } from 'react';
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
  const [modalNomeDigisac, setModalNomeDigisac] = useState<string | null>(null);
  const [observacoes, setObservacoes] = useState<Record<string, string>>({});
  const observacoesRef = useRef<Record<string, string>>({});

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
      try {
        const items = Array.isArray(result?.items) ? result.items : [];
        const nomeParaIds = new Map<string, string[]>();
        for (const it of items) {
          const nome = (it.nomeDigisac || '').trim();
          const arr = nomeParaIds.get(nome) || [];
          arr.push(it.contactId);
          nomeParaIds.set(nome, arr);
        }
        const duplicados = Array.from(nomeParaIds.entries()).filter(([n, ids]) => n && ids.length > 1);
        if (duplicados.length > 0) {
          console.warn('[UI][CHAMADOS] nomesDuplicadosDetectados=', duplicados.map(([nome, ids]) => ({ nome, contactIds: ids })));
        }
      } catch (e) {
        console.warn('[UI][CHAMADOS] logResumoResultado falhou', e);
      }

      setData(result);

      // Buscar observações para os contactIds retornados
      try {
        const ids = (result.items || []).map((it) => it.contactId).filter(Boolean);
        if (ids.length > 0) {
          const obsRes = await fetch(`/api/usuarios-info?contactIds=${ids.join(',')}`);
          if (obsRes.ok) {
            const obsJson = await obsRes.json();
            const merged = { ...observacoesRef.current, ...(obsJson.data || {}) };
            observacoesRef.current = merged;
            setObservacoes(merged);
          }
        }
      } catch (e) {
        console.warn('[UI][CHAMADOS] Erro ao buscar observações:', e);
      }
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

      <TabelaChamadosFinalizados
        data={data}
        isLoading={isLoading}
        error={error}
        onPageChange={handlePageChange}
        onVerAgendamentos={(cid, nomeDigisac) => {
          setModalContactId(cid);
          setModalNomeDigisac(nomeDigisac?.trim() || null);
        }}
        observacoes={observacoes}
        onSalvarObservacao={async (contactId, observacao) => {
          const res = await fetch('/api/usuarios-info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contactId, observacao }),
          });
          if (!res.ok) throw new Error('Erro ao salvar');
          const updated = { ...observacoesRef.current, [contactId]: observacao };
          observacoesRef.current = updated;
          setObservacoes(updated);
        }}
      />

      <ModalAgendamentosCliente
        contactId={modalContactId}
        nomeDigisac={modalNomeDigisac}
        open={!!modalContactId}
        onClose={() => {
          setModalContactId(null);
          setModalNomeDigisac(null);
        }}
      />
    </div>
  );
}
