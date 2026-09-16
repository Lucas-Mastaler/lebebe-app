'use client';

import { Cell } from 'recharts';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DashboardLinha, DashboardLinhaConsultora, DashboardResponse, EstatisticasDigisacResponse, VacuoAtivoResponse } from '@/types';
import { FiltrosDashboard } from '@/components/dashboard/FiltrosDashboard';
import { CardsEstatisticasDigisac } from '@/components/dashboard/CardsEstatisticasDigisac';
import { GraficoMensagensDigisac } from '@/components/dashboard/GraficoMensagensDigisac';
import { CardVacuoAtivo } from '@/components/dashboard/CardVacuoAtivo';
import { Skeleton } from '@/components/ui/skeleton';
import {
  PageContainer,
  PageHeader,
  Card,
  CardContent,
  CardHeader,
  ResponsiveTable,
  SegmentedTabsList,
  SegmentedTabsTrigger,
  Tabs,
  TabsContent,
} from '@/components/design-system';
import { ChartColumnIncreasing, LayoutDashboard } from 'lucide-react';
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

type FiltrosDashboardType = Record<string, unknown>;
type DashboardFilialTableRow = Omit<DashboardLinha, 'ratioAgendamentosPorCliente' | 'ratioChamadosAtivosPorUnicoAtivo' | 'ratioChamadosReceptivosPorUnicoReceptivo'> & {
  ratioAgendamentosPorCliente?: number | string;
  ratioChamadosAtivosPorUnicoAtivo?: number | string;
  ratioChamadosReceptivosPorUnicoReceptivo?: number | string;
  isTotal?: boolean;
};
type DashboardConsultoraTableRow = Omit<DashboardLinhaConsultora, 'ratioAgendamentosPorCliente' | 'ratioChamadosAtivosPorUnicoAtivo' | 'ratioChamadosReceptivosPorUnicoReceptivo'> & {
  ratioAgendamentosPorCliente?: number | string;
  ratioChamadosAtivosPorUnicoAtivo?: number | string;
  ratioChamadosReceptivosPorUnicoReceptivo?: number | string;
  isTotal?: boolean;
};

export default function Page() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentFiltros, setCurrentFiltros] = useState<FiltrosDashboardType | null>(null);
  const [activeTab, setActiveTab] = useState('filiais');
  const [estatisticasDigisac, setEstatisticasDigisac] = useState<EstatisticasDigisacResponse | null>(null);
  const [isLoadingEstatisticas, setIsLoadingEstatisticas] = useState(false);
  const [errorEstatisticas, setErrorEstatisticas] = useState<string | null>(null);
  const [vacuoAtivo, setVacuoAtivo] = useState<VacuoAtivoResponse | null>(null);
  const [isLoadingVacuoAtivo, setIsLoadingVacuoAtivo] = useState(false);
  const [errorVacuoAtivo, setErrorVacuoAtivo] = useState<string | null>(null);

  const handlePesquisar = useCallback(async (filtros: FiltrosDashboardType) => {
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

  useEffect(() => {
    if (!currentFiltros?.dataInicio || !currentFiltros?.dataFim) return;

    const controller = new AbortController();

    (async () => {
      setIsLoadingEstatisticas(true);
      setErrorEstatisticas(null);

      try {
        const response = await fetch('/api/dashboard/estatisticas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dataInicio: currentFiltros.dataInicio,
            dataFim: currentFiltros.dataFim,
            serviceIds: currentFiltros.serviceIds || undefined,
          }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Erro na requisição: ${response.status}`);
        const result: EstatisticasDigisacResponse = await response.json();
        setEstatisticasDigisac(result);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        const errorMessage = err instanceof Error ? err.message : 'Erro ao buscar estatísticas Digisac';
        setErrorEstatisticas(errorMessage);
        console.error('[UI][DASHBOARD][ESTATISTICAS] erro:', errorMessage);
      } finally {
        setIsLoadingEstatisticas(false);
      }
    })();

    return () => controller.abort();
  }, [currentFiltros?.dataInicio, currentFiltros?.dataFim, currentFiltros?.serviceIds]);

  useEffect(() => {
    if (!currentFiltros?.dataInicio || !currentFiltros?.dataFim) return;

    const controller = new AbortController();

    (async () => {
      setIsLoadingVacuoAtivo(true);
      setErrorVacuoAtivo(null);

      try {
        const response = await fetch('/api/dashboard/vacuo-ativo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dataInicio: currentFiltros.dataInicio,
            dataFim: currentFiltros.dataFim,
            departmentIds: currentFiltros.departmentIds || undefined,
            userIds: currentFiltros.userIds || undefined,
            serviceIds: currentFiltros.serviceIds || undefined,
          }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Erro na requisição: ${response.status}`);
        const result: VacuoAtivoResponse = await response.json();
        setVacuoAtivo(result);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        const errorMessage = err instanceof Error ? err.message : 'Erro ao buscar taxa de vácuo ativo';
        setErrorVacuoAtivo(errorMessage);
        console.error('[UI][DASHBOARD][VACUO_ATIVO] erro:', errorMessage);
      } finally {
        setIsLoadingVacuoAtivo(false);
      }
    })();

    return () => controller.abort();
  }, [currentFiltros?.dataInicio, currentFiltros?.dataFim, currentFiltros?.departmentIds, currentFiltros?.userIds, currentFiltros?.serviceIds]);

  const chartDataFiliais = useMemo(() => {
    const linhas = data?.linhas || [];
    return linhas.map((l: DashboardLinha) => ({
      filial: l.filial || 'Sem filial',
      totalClientesUnicos: l.totalClientesUnicos,
    }));
  }, [data]);

  const CORES_FILIAIS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];

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

    const ratioChamadosAtivosPorUnicoAtivo =
      totalClientesUnicosAtivo > 0 ? (totalChamadosAtivosNoPeriodo / totalClientesUnicosAtivo).toFixed(2) : '-';

    const ratioChamadosReceptivosPorUnicoReceptivo =
      totalClientesUnicosReceptivo > 0 ? (totalChamadosReceptivosNoPeriodo / totalClientesUnicosReceptivo).toFixed(2) : '-';

    return {
      totalClientesUnicos,
      agendamentosCriadosNoPeriodo,
      ratioAgendamentosPorCliente,
      totalChamadosAtivosNoPeriodo,
      ratioChamadosAtivosPorUnicoAtivo,
      totalChamadosReceptivosNoPeriodo,
      totalClientesUnicosAtivo,
      totalClientesUnicosReceptivo,
      ratioChamadosReceptivosPorUnicoReceptivo,
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

  const filiaisTableRows = useMemo<DashboardFilialTableRow[]>(() => [
    ...(data?.linhas ?? []),
    {
      departmentId: 'total',
      filial: 'TOTAL',
      totalClientesUnicos: totaisFiliais.totalClientesUnicos,
      agendamentosCriadosNoPeriodo: totaisFiliais.agendamentosCriadosNoPeriodo,
      ratioAgendamentosPorCliente: totaisFiliais.ratioAgendamentosPorCliente,
      totalChamadosAtivosNoPeriodo: totaisFiliais.totalChamadosAtivosNoPeriodo,
      totalClientesUnicosAtivo: totaisFiliais.totalClientesUnicosAtivo,
      ratioChamadosAtivosPorUnicoAtivo: totaisFiliais.ratioChamadosAtivosPorUnicoAtivo,
      totalChamadosReceptivosNoPeriodo: totaisFiliais.totalChamadosReceptivosNoPeriodo,
      totalClientesUnicosReceptivo: totaisFiliais.totalClientesUnicosReceptivo,
      ratioChamadosReceptivosPorUnicoReceptivo: totaisFiliais.ratioChamadosReceptivosPorUnicoReceptivo,
      totalChamadosHistoricoSomadoFilial: totaisFiliais.totalChamadosHistoricoSomadoFilial,
      isTotal: true,
    },
  ], [data?.linhas, totaisFiliais]);

  const consultorasTableRows = useMemo<DashboardConsultoraTableRow[]>(() => [
    ...(data?.linhasConsultoras ?? []),
    {
      userId: 'total',
      consultora: 'TOTAL',
      totalClientesUnicos: totaisConsultoras.totalClientesUnicos,
      agendamentosCriadosNoPeriodo: totaisConsultoras.agendamentosCriadosNoPeriodo,
      ratioAgendamentosPorCliente: totaisConsultoras.ratioAgendamentosPorCliente,
      totalChamadosAtivosNoPeriodo: totaisConsultoras.totalChamadosAtivosNoPeriodo,
      totalClientesUnicosAtivo: totaisConsultoras.totalClientesUnicosAtivo,
      ratioChamadosAtivosPorUnicoAtivo: totaisConsultoras.ratioChamadosAtivosPorUnicoAtivo,
      totalChamadosReceptivosNoPeriodo: totaisConsultoras.totalChamadosReceptivosNoPeriodo,
      totalClientesUnicosReceptivo: totaisConsultoras.totalClientesUnicosReceptivo,
      ratioChamadosReceptivosPorUnicoReceptivo: totaisConsultoras.ratioChamadosReceptivosPorUnicoReceptivo,
      totalChamadosHistoricoSomadoConsultora: totaisConsultoras.totalChamadosHistoricoSomadoConsultora,
      isTotal: true,
    },
  ], [data?.linhasConsultoras, totaisConsultoras]);

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

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        icon={<LayoutDashboard className="size-6" />}
        eyebrow="Operação"
        title="Dashboard"
        description="Métricas agregadas por filial"
      />

      <FiltrosDashboard onPesquisar={handlePesquisar} isLoading={isLoading} />

      {/* Estatísticas Digisac */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Estatísticas Digisac</h2>
          <p className="text-sm text-slate-500">Métricas agregadas de mensagens e tempos de atendimento</p>
        </div>
        <CardsEstatisticasDigisac
          totais={estatisticasDigisac?.totais ?? null}
          isLoading={isLoadingEstatisticas}
          error={errorEstatisticas}
        />
        <GraficoMensagensDigisac
          diario={estatisticasDigisac?.diario ?? []}
          isLoading={isLoadingEstatisticas}
          error={errorEstatisticas}
        />
        <CardVacuoAtivo
          data={vacuoAtivo}
          isLoading={isLoadingVacuoAtivo}
          error={errorVacuoAtivo}
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <SegmentedTabsList className="w-fit">
          <SegmentedTabsTrigger value="filiais" className="min-w-32">
            FILIAIS
          </SegmentedTabsTrigger>
          <SegmentedTabsTrigger value="consultoras" className="min-w-32">
            CONSULTORAS
          </SegmentedTabsTrigger>
        </SegmentedTabsList>

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
        <Card>
          <CardHeader title="Resultados por filial" description={`${data.linhas.length} ${data.linhas.length === 1 ? 'filial' : 'filiais'}`} />
          <CardContent>
            <ResponsiveTable
              columns={[
                { key: 'filial', header: 'Filial', width: 'content', render: (row) => row.filial || '-' },
                { key: 'clientes', header: 'Clientes únicos', width: 'compact', className: 'text-center', render: (row) => row.totalClientesUnicos },
                { key: 'agendamentos', header: 'Agendamentos criados', width: 'compact', className: 'text-center', render: (row) => row.agendamentosCriadosNoPeriodo },
                { key: 'agendamento-cliente', header: 'Agendamentos/Cliente', width: 'compact', className: 'text-center', render: (row) => row.ratioAgendamentosPorCliente },
                { key: 'ativos', header: 'Chamados ativos', width: 'compact', className: 'text-center', render: (row) => row.totalChamadosAtivosNoPeriodo },
                { key: 'unicos-ativo', header: 'Cl. únicos ativo', width: 'compact', className: 'text-center', render: (row) => row.totalClientesUnicosAtivo },
                { key: 'ratio-ativo', header: 'Ativos/Cl. únicos', width: 'compact', className: 'text-center', render: (row) => row.ratioChamadosAtivosPorUnicoAtivo },
                { key: 'receptivos', header: 'Chamados receptivos', width: 'compact', className: 'text-center', render: (row) => row.totalChamadosReceptivosNoPeriodo },
                { key: 'unicos-receptivo', header: 'Cl. únicos receptivo', width: 'compact', className: 'text-center', render: (row) => row.totalClientesUnicosReceptivo },
                { key: 'ratio-receptivo', header: 'Receptivos/Cl. únicos', width: 'compact', className: 'text-center', render: (row) => row.ratioChamadosReceptivosPorUnicoReceptivo },
                { key: 'historico', header: 'Chamados históricos', width: 'compact', className: 'text-center font-semibold', render: (row) => row.totalChamadosHistoricoSomadoFilial ?? '-' },
              ]}
              rows={filiaisTableRows}
              rowKey={(row) => row.departmentId}
              firstColumnSticky
              rowClassName={(row) => row.isTotal ? 'bg-slate-100 font-semibold hover:bg-slate-200' : undefined}
              renderMobileCard={(row) => <DashboardMobileCard label={row.filial || '-'} row={row} />}
            />
          </CardContent>
        </Card>
      )}

      {/* Gráficos */}
      {data && data.linhas.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* 1) Barras: totalClientesUnicos por filial */}
          <Card className="h-[360px]">
            <CardHeader icon={<ChartColumnIncreasing className="size-4" />} title="Clientes únicos por filial" />

            <CardContent className="flex h-[calc(100%-53px)] flex-col">
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
                        fill={mapaCorPorFilial.get(row.filial) ?? 'var(--muted-foreground)'}
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
                      backgroundColor: mapaCorPorFilial.get(row.filial) ?? 'var(--muted-foreground)',
                    }}
                  />
                  <span>{row.filial}</span>
                </div>
              ))}
            </div>
            </CardContent>
          </Card>

          {/* 2) Comparativo: Ativos vs Receptivos (mesma cor por filial) */}
          <Card className="h-[360px]">
            <CardHeader icon={<ChartColumnIncreasing className="size-4" />} title="Chamados: ativo vs. receptivo" />

            <CardContent className="flex h-[calc(100%-53px)] flex-col">
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
                        fill={mapaCorPorFilial.get(row.filial) ?? 'var(--muted-foreground)'}
                      />
                    ))}
                  </Bar>

                  {/* RECEPTIVOS (mesma cor da filial, só que mais “claro”) */}
                  <Bar dataKey="receptivos" name="Receptivos" radius={[6, 6, 0, 0]}>
                    {chartDataAtivoReceptivo.map((row, index) => (
                      <Cell
                        key={`cell-receptivos-${index}`}
                        fill={mapaCorPorFilial.get(row.filial) ?? 'var(--muted-foreground)'}
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
                <span className="inline-block size-4 rounded-sm bg-chart-1" />
                <span>ATIVO</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block size-4 rounded-sm bg-chart-1 opacity-40" />
                <span>RECEPTIVO</span>
              </div>
            </div>
            </CardContent>
          </Card>

          {/* 3) Comparativo: Únicos Ativo vs Receptivo (mesma cor por filial) */}
          <Card className="h-[360px]">
            <CardHeader icon={<ChartColumnIncreasing className="size-4" />} title="Clientes únicos: ativo vs. receptivo" />

            <CardContent className="flex h-[calc(100%-53px)] flex-col">
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
                        fill={mapaCorPorFilial.get(row.filial) ?? 'var(--muted-foreground)'}
                      />
                    ))}
                  </Bar>

                  {/* ÚNICOS RECEPTIVO (mesma cor da filial, mais claro) */}
                  <Bar dataKey="unicosReceptivo" name="Únicos (Receptivo)" radius={[6, 6, 0, 0]}>
                    {chartDataUnicosAtivoReceptivo.map((row, index) => (
                      <Cell
                        key={`cell-unico-receptivo-${index}`}
                        fill={mapaCorPorFilial.get(row.filial) ?? 'var(--muted-foreground)'}
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
                <span className="inline-block size-4 rounded-sm bg-chart-1" />
                <span>ATIVO</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block size-4 rounded-sm bg-chart-1 opacity-40" />
                <span>RECEPTIVO</span>
              </div>
            </div>
            </CardContent>
          </Card>
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
            <Card>
              <CardHeader title="Resultados por consultora" description={`${data.linhasConsultoras.length} ${data.linhasConsultoras.length === 1 ? 'consultora' : 'consultoras'}`} />
              <CardContent>
                <ResponsiveTable
                  columns={[
                    { key: 'consultora', header: 'Consultora', width: 'content', render: (row) => row.consultora || '-' },
                    { key: 'clientes', header: 'Clientes únicos', width: 'compact', className: 'text-center', render: (row) => row.totalClientesUnicos },
                    { key: 'agendamentos', header: 'Agendamentos criados', width: 'compact', className: 'text-center', render: (row) => row.agendamentosCriadosNoPeriodo },
                    { key: 'agendamento-cliente', header: 'Agendamentos/Cliente', width: 'compact', className: 'text-center', render: (row) => row.ratioAgendamentosPorCliente },
                    { key: 'ativos', header: 'Chamados ativos', width: 'compact', className: 'text-center', render: (row) => row.totalChamadosAtivosNoPeriodo },
                    { key: 'unicos-ativo', header: 'Cl. únicos ativo', width: 'compact', className: 'text-center', render: (row) => row.totalClientesUnicosAtivo },
                    { key: 'ratio-ativo', header: 'Ativos/Cl. únicos', width: 'compact', className: 'text-center', render: (row) => row.ratioChamadosAtivosPorUnicoAtivo },
                    { key: 'receptivos', header: 'Chamados receptivos', width: 'compact', className: 'text-center', render: (row) => row.totalChamadosReceptivosNoPeriodo },
                    { key: 'unicos-receptivo', header: 'Cl. únicos receptivo', width: 'compact', className: 'text-center', render: (row) => row.totalClientesUnicosReceptivo },
                    { key: 'ratio-receptivo', header: 'Receptivos/Cl. únicos', width: 'compact', className: 'text-center', render: (row) => row.ratioChamadosReceptivosPorUnicoReceptivo },
                    { key: 'historico', header: 'Chamados históricos', width: 'compact', className: 'text-center font-semibold', render: (row) => row.totalChamadosHistoricoSomadoConsultora ?? '-' },
                  ]}
                  rows={consultorasTableRows}
                  rowKey={(row) => row.userId}
                  firstColumnSticky
                  rowClassName={(row) => row.isTotal ? 'bg-slate-100 font-semibold hover:bg-slate-200' : undefined}
                  renderMobileCard={(row) => <DashboardMobileCard label={row.consultora || '-'} row={row} />}
                />
              </CardContent>
            </Card>
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

    </PageContainer>
  );
}

type DashboardMobileRow = {
  totalClientesUnicos: number;
  agendamentosCriadosNoPeriodo: number;
  totalChamadosAtivosNoPeriodo: number;
  totalChamadosReceptivosNoPeriodo: number;
  totalChamadosHistoricoSomadoFilial?: number | null;
  totalChamadosHistoricoSomadoConsultora?: number | null;
};

function DashboardMobileCard({ label, row }: { label: string; row: DashboardMobileRow }) {
  const chamadosHistoricos = row.totalChamadosHistoricoSomadoFilial ?? row.totalChamadosHistoricoSomadoConsultora ?? '-';

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <p className="font-semibold text-slate-900">{label}</p>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div><dt className="text-slate-500">Clientes únicos</dt><dd className="font-medium">{row.totalClientesUnicos}</dd></div>
        <div><dt className="text-slate-500">Agendamentos</dt><dd className="font-medium">{row.agendamentosCriadosNoPeriodo}</dd></div>
        <div><dt className="text-slate-500">Chamados ativos</dt><dd className="font-medium">{row.totalChamadosAtivosNoPeriodo}</dd></div>
        <div><dt className="text-slate-500">Chamados receptivos</dt><dd className="font-medium">{row.totalChamadosReceptivosNoPeriodo}</dd></div>
        <div className="col-span-2"><dt className="text-slate-500">Chamados históricos</dt><dd className="font-medium">{chamadosHistoricos}</dd></div>
      </dl>
    </article>
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
