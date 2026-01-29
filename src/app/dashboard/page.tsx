'use client';

import { Cell } from 'recharts';
import { useCallback, useMemo, useState } from 'react';
import { DashboardClienteDetalhe, DashboardLinha, DashboardLinhaConsultora, DashboardResponse } from '@/types';
import { FiltrosDashboard } from '@/components/dashboard/FiltrosDashboard';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export default function Page() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentFiltros, setCurrentFiltros] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState('filiais');

  const handlePesquisar = useCallback(async (filtros: any) => {
    setIsLoading(true);
    setError(null);
    setCurrentFiltros(filtros);

    try {
      const response = await fetch('/api/dashboard/pesquisar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filtros),
      });
      if (!response.ok) throw new Error(`Erro na requisição: ${response.status}`);
      const result: DashboardResponse = await response.json();
      setData(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao pesquisar dashboard';
      setError(errorMessage);
      console.error('[UI][DASHBOARD] erro:', errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const chartDataFiliais = useMemo(() => {
    const linhas = data?.linhas || [];
    return linhas.map((l: DashboardLinha) => ({
      filial: l.filial || 'Sem filial',
      totalClientesUnicos: l.totalClientesUnicos,
    }));
  }, [data]);

  const CORES_FILIAIS = [
    '#0EA5E9', // azul
    '#10B981', // verde
    '#F59E0B', // amarelo
    '#6366F1', // roxo
    '#EF4444', // vermelho
    '#14B8A6', // teal
    '#8B5CF6', // violeta
  ];

  const mapaCorPorFilial = useMemo(() => {
    // ordena para a cor não mudar se vier em ordem diferente
    const filiaisOrdenadas = [...(data?.linhas ?? [])]
      .map((l) => l.filial || 'Sem filial')
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));

    const mapa = new Map<string, string>();
    filiaisOrdenadas.forEach((filial, idx) => {
      mapa.set(filial, CORES_FILIAIS[idx % CORES_FILIAIS.length]);
    });

    return mapa;
  }, [data]);

  const totaisFiliais = useMemo(() => {
    const linhas = data?.linhas ?? [];

    const totalClientesUnicos = linhas.reduce((acc, l) => acc + (Number(l.totalClientesUnicos) || 0), 0);
    const agendamentosCriadosNoPeriodo = linhas.reduce((acc, l) => acc + (Number(l.agendamentosCriadosNoPeriodo) || 0), 0);
    const totalChamadosAtivosNoPeriodo = linhas.reduce((acc, l) => acc + (Number(l.totalChamadosAtivosNoPeriodo) || 0), 0);
    const totalChamadosReceptivosNoPeriodo = linhas.reduce((acc, l) => acc + (Number(l.totalChamadosReceptivosNoPeriodo) || 0), 0);
    const totalClientesUnicosAtivo = linhas.reduce((acc, l) => acc + (Number(l.totalClientesUnicosAtivo) || 0), 0);
    const totalClientesUnicosReceptivo = linhas.reduce((acc, l) => acc + (Number(l.totalClientesUnicosReceptivo) || 0), 0);
    const totalChamadosHistoricoSomadoFilial = linhas.reduce((acc, l) => acc + (Number(l.totalChamadosHistoricoSomadoFilial) || 0), 0);

    const ratioAgendamentosPorCliente =
      totalClientesUnicos > 0 ? (agendamentosCriadosNoPeriodo / totalClientesUnicos).toFixed(2) : '-';

    return {
      totalClientesUnicos,
      agendamentosCriadosNoPeriodo,
      ratioAgendamentosPorCliente,
      totalChamadosAtivosNoPeriodo,
      totalChamadosReceptivosNoPeriodo,
      totalClientesUnicosAtivo,
      totalClientesUnicosReceptivo,
      totalChamadosHistoricoSomadoFilial,
    };
  }, [data]);

  const totaisConsultoras = useMemo(() => {
    const linhas = data?.linhasConsultoras ?? [];

    const totalClientesUnicos = linhas.reduce((acc, l) => acc + (Number(l.totalClientesUnicos) || 0), 0);
    const agendamentosCriadosNoPeriodo = linhas.reduce((acc, l) => acc + (Number(l.agendamentosCriadosNoPeriodo) || 0), 0);
    const totalChamadosAtivosNoPeriodo = linhas.reduce((acc, l) => acc + (Number(l.totalChamadosAtivosNoPeriodo) || 0), 0);
    const totalChamadosReceptivosNoPeriodo = linhas.reduce((acc, l) => acc + (Number(l.totalChamadosReceptivosNoPeriodo) || 0), 0);
    const totalClientesUnicosAtivo = linhas.reduce((acc, l) => acc + (Number(l.totalClientesUnicosAtivo) || 0), 0);
    const totalClientesUnicosReceptivo = linhas.reduce((acc, l) => acc + (Number(l.totalClientesUnicosReceptivo) || 0), 0);
    const totalChamadosHistoricoSomadoConsultora = linhas.reduce((acc, l) => acc + (Number(l.totalChamadosHistoricoSomadoConsultora) || 0), 0);

    const ratioAgendamentosPorCliente =
      totalClientesUnicos > 0 ? (agendamentosCriadosNoPeriodo / totalClientesUnicos).toFixed(2) : '-';

    const ratioChamadosAtivosPorUnicoAtivo =
      totalClientesUnicosAtivo > 0 ? (totalChamadosAtivosNoPeriodo / totalClientesUnicosAtivo).toFixed(2) : '-';

    const ratioChamadosReceptivosPorUnicoReceptivo =
      totalClientesUnicosReceptivo > 0 ? (totalChamadosReceptivosNoPeriodo / totalClientesUnicosReceptivo).toFixed(2) : '-';

    return {
      totalClientesUnicos,
      agendamentosCriadosNoPeriodo,
      ratioAgendamentosPorCliente,
      totalChamadosAtivosNoPeriodo,
      totalClientesUnicosAtivo,
      ratioChamadosAtivosPorUnicoAtivo,
      totalChamadosReceptivosNoPeriodo,
      totalClientesUnicosReceptivo,
      ratioChamadosReceptivosPorUnicoReceptivo,
      totalChamadosHistoricoSomadoConsultora,
    };
  }, [data]);

  const totaisClientesHistoricoTop = useMemo(() => {
    const arr = data?.clientesHistoricoTop ?? [];
    const chamadosNoPeriodo = arr.reduce((acc, c) => acc + (Number(c.chamadosNoPeriodo) || 0), 0);
    const totalChamadosHistorico = arr.reduce((acc, c) => acc + (Number(c.totalChamadosHistorico) || 0), 0);
    return { chamadosNoPeriodo, totalChamadosHistorico };
  }, [data]);


  const chartDataAtivoReceptivo = useMemo(() => {
    const linhas = data?.linhas || [];
    return linhas.map((l: DashboardLinha) => ({
      filial: l.filial || 'Sem filial',
      ativos: l.totalChamadosAtivosNoPeriodo,
      receptivos: l.totalChamadosReceptivosNoPeriodo,
    }));
  }, [data]);

  const chartDataUnicosAtivoReceptivo = useMemo(() => {
    const linhas = data?.linhas || [];
    return linhas.map((l: DashboardLinha) => ({
      filial: l.filial || 'Sem filial',
      unicosAtivo: l.totalClientesUnicosAtivo,
      unicosReceptivo: l.totalClientesUnicosReceptivo,
    }));
  }, [data]);

  const clientesHistoricoTop = useMemo(() => {
    return data?.clientesHistoricoTop ?? [];
  }, [data]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">DASHBOARD</h1>
        <p className="text-slate-600 mt-1">Métricas agregadas por filial</p>
      </div>

      <FiltrosDashboard onPesquisar={handlePesquisar} isLoading={isLoading} />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-100 p-1 rounded-xl">
          <TabsTrigger
            value="filiais"
            className="rounded-lg px-6 py-2 data-[state=active]:bg-[rgba(0,165,230,0.15)] data-[state=active]:text-[#00A5E6] data-[state=active]:font-semibold transition-all"
          >
            FILIAIS
          </TabsTrigger>
          <TabsTrigger
            value="consultoras"
            className="rounded-lg px-6 py-2 data-[state=active]:bg-[rgba(0,165,230,0.15)] data-[state=active]:text-[#00A5E6] data-[state=active]:font-semibold transition-all"
          >
            CONSULTORAS
          </TabsTrigger>
        </TabsList>

        <TabsContent value="filiais" className="mt-6 space-y-6">
      {/* Tabela */}
      {isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 card-shadow">
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-6 w-20" />
          </div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
      ) : error ? (
        <div className="bg-white rounded-2xl border border-red-200 p-6">
          <div className="flex items-center gap-3 text-red-600">
            <span className="text-lg">⚠️</span>
            <p>{error}</p>
          </div>
        </div>
      ) : !data ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <p className="text-slate-500">Use os filtros acima para pesquisar.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 card-shadow overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Resultados</h3>
            <span className="px-3 py-1 bg-slate-100 text-slate-600 text-sm rounded-full">
              {data.linhas.length} {data.linhas.length === 1 ? 'filial' : 'filiais'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[960px] w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-2">Filial</th>
                  <th className="text-center px-4 py-2">Clientes únicos</th>
                  <th className="text-center px-4 py-2">Agendamentos criados</th>
                  <th className="text-center px-4 py-2">Agendamentos/Cliente</th>
                  <th className="text-center px-4 py-2">
                    Chamados ATIVOS<br />
                    (Chamamos o cliente)
                  </th>
                  <th className="text-center px-4 py-2">
                    Chamados RECEPTIVOS<br />
                    (Cliente chamou)
                  </th>

                  <th className="text-center px-4 py-2">Cl. Únicos<br /> ATIVO</th>
                  <th className="text-center px-4 py-2">Cl. Únicos<br /> RECEPTIVO</th>
                  <th className="text-center px-4 py-2">Chamados históricos (soma)</th>
                </tr>
              </thead>
              <tbody>
                {data.linhas.map((l: DashboardLinha, index: number) => (
                  <tr
                    key={l.departmentId}
                    className={`
                      border-b last:border-0
                      ${index % 2 === 0 ? 'bg-white' : 'bg-sky-50'}
                    `}
                  >
                    <td className="px-4 py-2 font-medium text-left">{l.filial || '-'}</td>
                    <td className="px-4 py-2 text-center">{l.totalClientesUnicos}</td>
                    <td className="px-4 py-2 text-center">{l.agendamentosCriadosNoPeriodo}</td>
                    <td className="px-4 py-2 text-center">{l.ratioAgendamentosPorCliente}</td>
                    <td className="px-4 py-2 text-center">{l.totalChamadosAtivosNoPeriodo}</td>
                    <td className="px-4 py-2 text-center">{l.totalChamadosReceptivosNoPeriodo}</td>
                    <td className="px-4 py-2 text-center">{l.totalClientesUnicosAtivo}</td>
                    <td className="px-4 py-2 text-center">{l.totalClientesUnicosReceptivo}</td>
                    <td className="px-4 py-2 text-center font-semibold">{l.totalChamadosHistoricoSomadoFilial ?? '-'}</td>
                  </tr>
                ))}

                {/* TOTAL */}
                <tr className="border-t bg-slate-100 font-semibold">
                  <td className="px-4 py-3 text-left">TOTAL</td>
                  <td className="px-4 py-3 text-center">{totaisFiliais.totalClientesUnicos}</td>
                  <td className="px-4 py-3 text-center">{totaisFiliais.agendamentosCriadosNoPeriodo}</td>
                  <td className="px-4 py-3 text-center">{totaisFiliais.ratioAgendamentosPorCliente}</td>
                  <td className="px-4 py-3 text-center">{totaisFiliais.totalChamadosAtivosNoPeriodo}</td>
                  <td className="px-4 py-3 text-center">{totaisFiliais.totalChamadosReceptivosNoPeriodo}</td>
                  <td className="px-4 py-3 text-center">{totaisFiliais.totalClientesUnicosAtivo}</td>
                  <td className="px-4 py-3 text-center">{totaisFiliais.totalClientesUnicosReceptivo}</td>
                  <td className="px-4 py-3 text-center">{totaisFiliais.totalChamadosHistoricoSomadoFilial}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Gráficos */}
      {data && data.linhas.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* 1) Barras: totalClientesUnicos por filial */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 card-shadow h-[360px] flex flex-col">
            <h3 className="font-semibold text-slate-900 mb-3">Clientes únicos por filial</h3>

            <div className="flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartDataFiliais}
                  margin={{ top: 10, right: 20, left: 0, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="filial" hide={chartDataFiliais.length > 6} />
                  <YAxis />
                  <Tooltip />

                  <Bar dataKey="totalClientesUnicos" radius={[6, 6, 0, 0]}>
                    {chartDataFiliais.map((row, index) => (
                      <Cell
                        key={`cell-clientes-${index}`}
                        fill={mapaCorPorFilial.get(row.filial) ?? '#94A3B8'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Legenda customizada (padrão visual dos outros gráficos) */}
            <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-slate-600 mt-2">
              {chartDataFiliais.map((row, index) => (
                <div key={`legenda-filial-${index}`} className="flex items-center gap-2">
                  <span
                    className="inline-block w-3 h-3 rounded-full"
                    style={{
                      backgroundColor: mapaCorPorFilial.get(row.filial) ?? '#94A3B8',
                    }}
                  />
                  <span>{row.filial}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 2) Comparativo: Ativos vs Receptivos (mesma cor por filial) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 card-shadow h-[360px] flex flex-col">
            <h3 className="font-semibold text-slate-900 mb-3">Chamados que Chamamos (ativo) vs Cliente chamou (receptivo)</h3>

            <div className="flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartDataAtivoReceptivo} margin={{ top: 10, right: 20, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="filial" hide={chartDataAtivoReceptivo.length > 6} />
                  <YAxis />
                  <Tooltip />

                  {/* ATIVOS */}
                  <Bar dataKey="ativos" name="Ativos" radius={[6, 6, 0, 0]}>
                    {chartDataAtivoReceptivo.map((row, index) => (
                      <Cell
                        key={`cell-ativos-${index}`}
                        fill={mapaCorPorFilial.get(row.filial) ?? '#94A3B8'}
                      />
                    ))}
                  </Bar>

                  {/* RECEPTIVOS (mesma cor da filial, só que mais “claro”) */}
                  <Bar dataKey="receptivos" name="Receptivos" radius={[6, 6, 0, 0]}>
                    {chartDataAtivoReceptivo.map((row, index) => (
                      <Cell
                        key={`cell-receptivos-${index}`}
                        fill={mapaCorPorFilial.get(row.filial) ?? '#94A3B8'}
                        fillOpacity={0.45}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Legenda visual: forte x apagado */}
            <div className="flex items-center justify-center gap-6 text-sm text-slate-600 mt-2">
              <div className="flex items-center gap-2">
                <span className="inline-block w-4 h-4 rounded-sm bg-slate-700" />
                <span>ATIVO</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-4 h-4 rounded-sm bg-slate-700 opacity-40" />
                <span>RECEPTIVO</span>
              </div>
            </div>
          </div>

          {/* 3) Comparativo: Únicos Ativo vs Receptivo (mesma cor por filial) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 card-shadow h-[360px] flex flex-col">
            <h3 className="font-semibold text-slate-900 mb-3">Clientes únicos: ATIVO vs RECEPTIVO</h3>

            <div className="flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartDataUnicosAtivoReceptivo} margin={{ top: 10, right: 20, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="filial" hide={chartDataUnicosAtivoReceptivo.length > 6} />
                  <YAxis />
                  <Tooltip />

                  {/* ÚNICOS ATIVO */}
                  <Bar dataKey="unicosAtivo" name="Únicos (Ativo)" radius={[6, 6, 0, 0]}>
                    {chartDataUnicosAtivoReceptivo.map((row, index) => (
                      <Cell
                        key={`cell-unico-ativo-${index}`}
                        fill={mapaCorPorFilial.get(row.filial) ?? '#94A3B8'}
                      />
                    ))}
                  </Bar>

                  {/* ÚNICOS RECEPTIVO (mesma cor da filial, mais claro) */}
                  <Bar dataKey="unicosReceptivo" name="Únicos (Receptivo)" radius={[6, 6, 0, 0]}>
                    {chartDataUnicosAtivoReceptivo.map((row, index) => (
                      <Cell
                        key={`cell-unico-receptivo-${index}`}
                        fill={mapaCorPorFilial.get(row.filial) ?? '#94A3B8'}
                        fillOpacity={0.45}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Legenda visual: forte x apagado */}
            <div className="flex items-center justify-center gap-6 text-sm text-slate-600 mt-2">
              <div className="flex items-center gap-2">
                <span className="inline-block w-4 h-4 rounded-sm bg-slate-700" />
                <span>ATIVO</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-4 h-4 rounded-sm bg-slate-700 opacity-40" />
                <span>RECEPTIVO</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Legendas de cálculo (Filiais) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 card-shadow">
        <h3 className="font-semibold text-slate-900 mb-3">Legenda dos cálculos (Filiais)</h3>
        <div className="overflow-x-auto">
          <table className="min-w-[720px] w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-2">Coluna</th>
                <th className="text-left px-4 py-2">Como é calculado</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b last:border-0">
                <td className="px-4 py-2 font-medium">Filial</td>
                <td className="px-4 py-2">Departamento/filial do chamado.</td>
              </tr>
              <tr className="border-b last:border-0 bg-sky-50/40">
                <td className="px-4 py-2 font-medium">Clientes únicos</td>
                <td className="px-4 py-2">Quantidade de clientes distintos com chamados no período filtrado.</td>
              </tr>
              <tr className="border-b last:border-0">
                <td className="px-4 py-2 font-medium">Agendamentos criados</td>
                <td className="px-4 py-2">Total de agendamentos criados no período (considerando os filtros escolhidos).</td>
              </tr>
              <tr className="border-b last:border-0 bg-sky-50/40">
                <td className="px-4 py-2 font-medium">Agendamentos/Cliente</td>
                <td className="px-4 py-2">Agendamentos criados ÷ Clientes únicos (arredondado em 2 casas decimais).</td>
              </tr>
              <tr className="border-b last:border-0">
                <td className="px-4 py-2 font-medium">Chamados ATIVOS</td>
                <td className="px-4 py-2">Chamados em que a loja iniciou a conversa no período.</td>
              </tr>
              <tr className="border-b last:border-0 bg-sky-50/40">
                <td className="px-4 py-2 font-medium">Chamados RECEPTIVOS</td>
                <td className="px-4 py-2">Chamados em que o cliente iniciou a conversa no período.</td>
              </tr>
              <tr className="border-b last:border-0">
                <td className="px-4 py-2 font-medium">Cl. Únicos ATIVO</td>
                <td className="px-4 py-2">Clientes únicos entre os chamados ATIVOS.</td>
              </tr>
              <tr className="border-b last:border-0 bg-sky-50/40">
                <td className="px-4 py-2 font-medium">Cl. Únicos RECEPTIVO</td>
                <td className="px-4 py-2">Clientes únicos entre os chamados RECEPTIVOS.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
        </TabsContent>

        <TabsContent value="consultoras" className="mt-6">
          {isLoading ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 card-shadow">
              <div className="flex items-center justify-between mb-4">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-6 w-20" />
              </div>
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            </div>
          ) : error ? (
            <div className="bg-white rounded-2xl border border-red-200 p-6">
              <div className="flex items-center gap-3 text-red-600">
                <span className="text-lg">⚠️</span>
                <p>{error}</p>
              </div>
            </div>
          ) : !data || !(data.linhasConsultoras && data.linhasConsultoras.length > 0) ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
              <p className="text-slate-500">Nenhum resultado. Use os filtros acima para pesquisar.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 card-shadow overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <h3 className="font-semibold text-slate-900">Resultados por consultora</h3>
                <span className="px-3 py-1 bg-slate-100 text-slate-600 text-sm rounded-full">
                  {data.linhasConsultoras.length} {data.linhasConsultoras.length === 1 ? 'consultora' : 'consultoras'}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-[960px] w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-4 py-2">Consultora</th>
                      <th className="text-center px-4 py-2">Clientes únicos</th>
                      <th className="text-center px-4 py-2">Agendamentos criados</th>
                      <th className="text-center px-4 py-2">Agendamentos/<br></br>Cliente</th>
                      <th className="text-center px-4 py-2">Chamados ATIVOS</th>
                      <th className="text-center px-4 py-2">Cl. Únicos ATIVO</th>
                      <th className="text-center px-4 py-2">Chamados ativos/<br></br>Cl. Únicos ativos</th>
                      <th className="text-center px-4 py-2">Chamados RECEPTIVOS</th>
                      <th className="text-center px-4 py-2">Cl. Únicos RECEPTIVO</th>
                      <th className="text-center px-4 py-2">Chamados RECEPTIVO/<br></br>Cl. Únicos RECEPTIVOS</th>
                      <th className="text-center px-4 py-2">Chamados históricos (soma)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.linhasConsultoras.map((l: DashboardLinhaConsultora, index: number) => (
                      <tr
                        key={l.userId}
                        className={`
                          border-b last:border-0
                          ${index % 2 === 0 ? 'bg-white' : 'bg-sky-50'}
                        `}
                      >
                        <td className="px-4 py-2 font-medium text-left">{l.consultora || '-'}</td>

                        <td className="px-4 py-2 text-center">{l.totalClientesUnicos}</td>
                        <td className="px-4 py-2 text-center">{l.agendamentosCriadosNoPeriodo}</td>
                        <td className="px-4 py-2 text-center">{l.ratioAgendamentosPorCliente}</td>

                        <td className="px-4 py-2 text-center">{l.totalChamadosAtivosNoPeriodo}</td>
                        <td className="px-4 py-2 text-center">{l.totalClientesUnicosAtivo}</td>
                        <td className="px-4 py-2 text-center">{l.ratioChamadosAtivosPorUnicoAtivo}</td>

                        <td className="px-4 py-2 text-center">{l.totalChamadosReceptivosNoPeriodo}</td>
                        <td className="px-4 py-2 text-center">{l.totalClientesUnicosReceptivo}</td>
                        <td className="px-4 py-2 text-center">{l.ratioChamadosReceptivosPorUnicoReceptivo}</td>

                        <td className="px-4 py-2 text-center font-semibold">{l.totalChamadosHistoricoSomadoConsultora ?? '-'}</td>
                      </tr>
                    ))}

                    {/* TOTAL */}
                    <tr className="border-t bg-slate-100 font-semibold">
                      <td className="px-4 py-3 text-left">TOTAL</td>

                      <td className="px-4 py-3 text-center">{totaisConsultoras.totalClientesUnicos}</td>
                      <td className="px-4 py-3 text-center">{totaisConsultoras.agendamentosCriadosNoPeriodo}</td>
                      <td className="px-4 py-3 text-center">{totaisConsultoras.ratioAgendamentosPorCliente}</td>

                      <td className="px-4 py-3 text-center">{totaisConsultoras.totalChamadosAtivosNoPeriodo}</td>
                      <td className="px-4 py-3 text-center">{totaisConsultoras.totalClientesUnicosAtivo}</td>
                      <td className="px-4 py-3 text-center">{totaisConsultoras.ratioChamadosAtivosPorUnicoAtivo}</td>

                      <td className="px-4 py-3 text-center">{totaisConsultoras.totalChamadosReceptivosNoPeriodo}</td>
                      <td className="px-4 py-3 text-center">{totaisConsultoras.totalClientesUnicosReceptivo}</td>
                      <td className="px-4 py-3 text-center">{totaisConsultoras.ratioChamadosReceptivosPorUnicoReceptivo}</td>

                      <td className="px-4 py-3 text-center">{totaisConsultoras.totalChamadosHistoricoSomadoConsultora}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Legendas de cálculo (Consultoras) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 card-shadow mt-6">
            <h3 className="font-semibold text-slate-900 mb-3">Legenda dos cálculos (Consultoras)</h3>
            <div className="overflow-x-auto">
              <table className="min-w-[720px] w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-2">Coluna</th>
                    <th className="text-left px-4 py-2">Como é calculado</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b last:border-0">
                    <td className="px-4 py-2 font-medium">Consultora</td>
                    <td className="px-4 py-2">Atendente responsável pelos chamados/atendimentos.</td>
                  </tr>
                  <tr className="border-b last:border-0 bg-sky-50/40">
                    <td className="px-4 py-2 font-medium">Clientes únicos</td>
                    <td className="px-4 py-2">Quantidade de clientes distintos com chamados no período atribuídos à consultora.</td>
                  </tr>
                  <tr className="border-b last:border-0">
                    <td className="px-4 py-2 font-medium">Agendamentos criados</td>
                    <td className="px-4 py-2">Total de agendamentos criados no período atribuídos à consultora (respeitando os filtros).</td>
                  </tr>
                  <tr className="border-b last:border-0 bg-sky-50/40">
                    <td className="px-4 py-2 font-medium">Agendamentos/Cliente</td>
                    <td className="px-4 py-2">Agendamentos criados ÷ Clientes únicos (arredondado em 2 casas decimais).</td>
                  </tr>
                  <tr className="border-b last:border-0">
                    <td className="px-4 py-2 font-medium">Chamados ATIVOS</td>
                    <td className="px-4 py-2">Chamados em que a loja iniciou a conversa atribuídos à consultora.</td>
                  </tr>
                  <tr className="border-b last:border-0 bg-sky-50/40">
                    <td className="px-4 py-2 font-medium">Cl. Únicos ATIVO</td>
                    <td className="px-4 py-2">Clientes únicos entre os chamados ATIVOS da consultora.</td>
                  </tr>
                  <tr className="border-b last:border-0">
                    <td className="px-4 py-2 font-medium">Chamados ATIVOS / Cl. Únicos ATIVO</td>
                    <td className="px-4 py-2">Chamados ATIVOS ÷ Clientes únicos ATIVO (arredondado em 2 casas decimais).</td>
                  </tr>
                  <tr className="border-b last:border-0 bg-sky-50/40">
                    <td className="px-4 py-2 font-medium">Chamados RECEPTIVOS</td>
                    <td className="px-4 py-2">Chamados em que o cliente iniciou a conversa atribuídos à consultora.</td>
                  </tr>
                  <tr className="border-b last:border-0">
                    <td className="px-4 py-2 font-medium">Cl. Únicos RECEPTIVO</td>
                    <td className="px-4 py-2">Clientes únicos entre os chamados RECEPTIVOS da consultora.</td>
                  </tr>
                  <tr className="border-b last:border-0 bg-sky-50/40">
                    <td className="px-4 py-2 font-medium">Chamados RECEPTIVO / Cl. Únicos RECEPTIVOS</td>
                    <td className="px-4 py-2">Chamados RECEPTIVOS ÷ Clientes únicos RECEPTIVO (arredondado em 2 casas decimais).</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {clientesHistoricoTop && clientesHistoricoTop.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 card-shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900">Clientes únicos e seus chamados (histórico) – Top 50</h3>
            <span className="px-3 py-1 bg-slate-100 text-slate-600 text-sm rounded-full">
              {clientesHistoricoTop.length}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[720px] w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-2">Cliente</th>
                  <th className="text-left px-4 py-2">Filial</th>
                  <th className="text-center px-4 py-2">Chamados no período</th>
                  <th className="text-center px-4 py-2">Chamados no histórico</th>
                </tr>
              </thead>
              <tbody>
                {clientesHistoricoTop.map((c: DashboardClienteDetalhe, i: number) => (
                  <tr key={`${c.contactId}-${i}`} className={`border-b last:border-0 ${i % 2 === 0 ? 'bg-white' : 'bg-sky-50'}`}>
                    <td className="px-4 py-2">{c.nome || '-'}</td>
                    <td className="px-4 py-2">{c.filial || '-'}</td>
                    <td className="px-4 py-2 text-center">{c.chamadosNoPeriodo ?? '-'}</td>
                    <td className="px-4 py-2 text-center font-semibold">{c.totalChamadosHistorico}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function LegendaAtivoReceptivo() {
  return (
    <div className="flex items-center justify-center gap-6 text-sm text-slate-600 mt-2">
      <div className="flex items-center gap-2">
        <span className="inline-block w-4 h-4 rounded-sm bg-slate-700" />
        <span>ATIVO</span>
      </div>

      <div className="flex items-center gap-2">
        <span className="inline-block w-4 h-4 rounded-sm bg-slate-700 opacity-40" />
        <span>RECEPTIVO</span>
      </div>
    </div>
  );
}