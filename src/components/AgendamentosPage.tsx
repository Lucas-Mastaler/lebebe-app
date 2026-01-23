'use client';

import { useState, useCallback, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FiltrosAgendamentos } from './FiltrosAgendamentos';
import { TabelaAgendamentos } from './TabelaAgendamentos';
import { PesquisaResponse, FiltrosPesquisa, Departamento, Usuario } from '@/types';

// Mock data for departamentos and usuarios (will be replaced with API)
// Mock data for usuarios (will be replaced with API if needed)
// const mockDepartamentos removed in favor of real API fetch

const mockUsuarios: Usuario[] = [
    { id: '1', nome: 'Ana Silva' },
    { id: '2', nome: 'João Santos' },
    { id: '3', nome: 'Maria Oliveira' },
];

export function AgendamentosPage() {
    const [activeTab, setActiveTab] = useState('pesquisa');
    const [data, setData] = useState<PesquisaResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
    const [clienteNomeFiltro, setClienteNomeFiltro] = useState('');
    const [currentFiltros, setCurrentFiltros] = useState<FiltrosPesquisa | null>(null);

    // Fetch Departments on Mount
    useEffect(() => {
        const fetchDeps = async () => {
            try {
                const res = await fetch('/api/departments');
                if (res.ok) {
                    const data = await res.json();
                    setDepartamentos(data);
                }
            } catch (err) {
                console.error('Falha ao buscar departamentos', err);
            }
        };
        fetchDeps();
    }, []);

    const handlePesquisar = useCallback(async (filtros: FiltrosPesquisa) => {
        setIsLoading(true);
        setError(null);
        setClienteNomeFiltro('');
        setCurrentFiltros(filtros);

        const startTime = performance.now();

        try {
            // Log filters being sent
            console.log('📤 Filtros enviados:', filtros);
            console.log('[UI] filtrosTickets', {
                conversaAberta: filtros.conversaAberta,
                dataUltimoChamadoFechadoInicio: filtros.dataUltimoChamadoFechadoInicio,
                dataUltimoChamadoFechadoFim: filtros.dataUltimoChamadoFechadoFim
            });

            const response = await fetch('/api/agendamentos/pesquisar', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(filtros),
            });

            if (!response.ok) {
                throw new Error(`Erro na requisição: ${response.status}`);
            }

            const result: PesquisaResponse = await response.json();

            const endTime = performance.now();

            // Log response info
            console.log('📥 Resposta recebida:', {
                tempoResposta: `${(endTime - startTime).toFixed(0)}ms`,
                total: result.meta.total,
                paginaAtual: result.meta.currentPage,
                ultimaPagina: result.meta.lastPage,
            });

            setData(result);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Erro ao pesquisar';
            setError(errorMessage);
            console.error('❌ Erro na pesquisa:', errorMessage);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const handlePageChange = useCallback((page: number) => {
        if (!currentFiltros) return;
        handlePesquisar({ ...currentFiltros, page });
    }, [currentFiltros, handlePesquisar]);

    const hasResults = (data?.items?.length ?? 0) > 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-900">AGENDAMENTOS</h1>
                <p className="text-slate-600 mt-1">Consulta e acompanhamento</p>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="bg-slate-100 p-1 rounded-xl">
                    <TabsTrigger
                        value="pesquisa"
                        className="rounded-lg px-6 py-2 data-[state=active]:bg-[rgba(0,165,230,0.15)] data-[state=active]:text-[#00A5E6] data-[state=active]:font-semibold transition-all"
                    >
                        BUSCA DE AGENDAMENTOS
                    </TabsTrigger>
                    <TabsTrigger
                        value="dashboard"
                        className="rounded-lg px-6 py-2 data-[state=active]:bg-[rgba(0,165,230,0.15)] data-[state=active]:text-[#00A5E6] data-[state=active]:font-semibold transition-all"
                    >
                        DASHBOARD
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="pesquisa" className="mt-6 space-y-6">
                    {/* Filters */}
                    <FiltrosAgendamentos
                        departamentos={departamentos}
                        usuarios={mockUsuarios}
                        hasResults={hasResults}
                        clienteNomeFiltro={clienteNomeFiltro}
                        onClienteNomeChange={setClienteNomeFiltro}
                        onPesquisar={handlePesquisar}
                        isLoading={isLoading}
                    />

                    {/* Results Table */}
                    <TabelaAgendamentos
                        data={data}
                        isLoading={isLoading}
                        error={error}
                        clienteNomeFiltro={clienteNomeFiltro}
                        onPageChange={handlePageChange}
                    />
                </TabsContent>

                <TabsContent value="dashboard" className="mt-6">
                    <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center card-shadow">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 mb-4">
                            <span className="text-2xl">📊</span>
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900 mb-2">Em breve</h3>
                        <p className="text-slate-500">
                            O dashboard de agendamentos está em desenvolvimento.
                        </p>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
