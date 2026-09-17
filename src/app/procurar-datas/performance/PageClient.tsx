'use client';

import { useCallback, useState } from 'react';
import { Activity, AlertTriangle, Clock, Gauge, MapPin, Search, TrendingDown, Zap } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  PageContainer, PageHeader, FilterPanel, FilterFieldGroup, useFilterState, FormField, DateField,
  Card, CardHeader, CardContent, KpiCard, Alert, EmptyState, ResponsiveTable, Badge,
} from '@/components/design-system';
import { parseBrDate, dateToIso } from '@/lib/design-system/dates';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  Line, ComposedChart,
} from 'recharts';
import type { PerformanceResponse, FiltrosPerformance, ProviderCache } from '@/types/procurar-datas-performance';

const FAIXA_LABELS: Record<string, string> = {
  ate_15s: 'Até 15s',
  '15s_a_30s': '15s a 30s',
  '30s_a_60s': '30s a 60s',
  acima_60s: 'Acima de 60s',
};

const FILTROS_VAZIOS: FiltrosPerformance = {
  periodo: '30dias',
  motor: 'todos',
  status: 'todos',
  cache: 'todos',
};

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatPct(n: number, d: number): string {
  if (d === 0) return '-';
  return `${Math.round((n / d) * 100)}%`;
}

export default function PageClient() {
  const [data, setData] = useState<PerformanceResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const filtros = useFilterState<FiltrosPerformance>(FILTROS_VAZIOS);

  const buscar = useCallback(async (valores: FiltrosPerformance) => {
    setIsLoading(true);
    setError(null);
    try {
      const dInicio = valores.dataInicio ? parseBrDate(valores.dataInicio) : null;
      const dFim = valores.dataFim ? parseBrDate(valores.dataFim) : null;
      const payload: FiltrosPerformance = {
        ...valores,
        dataInicio: dInicio ? dateToIso(dInicio) : undefined,
        dataFim: dFim ? dateToIso(dFim) : undefined,
      };
      const response = await fetch('/api/procurar-datas/performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(`Erro ${response.status}`);
      const result: PerformanceResponse = await response.json();
      setData(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao buscar performance';
      setError(msg);
      console.error('[PERFORMANCE] erro:', msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  function aplicarFiltros() {
    filtros.apply();
    void buscar(filtros.draft);
  }

  function limparFiltros() {
    filtros.clear();
    void buscar(FILTROS_VAZIOS);
  }

  const legado = data?.resumo.find(r => r.motor === 'legado');
  const v2 = data?.resumo.find(r => r.motor === 'v2');
  const reducaoPct = legado && v2 && legado.tempo_medio_ms > 0
    ? Math.round((1 - v2.tempo_medio_ms / legado.tempo_medio_ms) * 100)
    : null;

  const faixasChartData = (() => {
    if (!data) return [];
    const faixas = ['ate_15s', '15s_a_30s', '30s_a_60s', 'acima_60s'];
    return faixas.map(f => {
      const row: Record<string, string | number> = { faixa: FAIXA_LABELS[f] };
      for (const item of data.faixas) {
        if (item.faixa === f) {
          row[item.motor] = item.total;
        }
      }
      return row;
    });
  })();

  const evolucaoChartData = (() => {
    if (!data) return [];
    const datas = [...new Set(data.evolucao.map(e => e.data))].sort();
    return datas.map(d => {
      const row: Record<string, string | number> = { data: d.slice(5) };
      for (const e of data.evolucao) {
        if (e.data === d) {
          row[`tempo_${e.motor}`] = Math.round(e.tempo_medio_ms / 1000);
          row[`buscas_${e.motor}`] = e.total_buscas;
        }
      }
      return row;
    });
  })();

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        icon={<Gauge className="size-6" />}
        title="Performance da busca de datas"
        description={
          <>
            Velocidade e estabilidade do motor de busca — versão anterior vs versão atual.
            <br />
            <span className="text-sm text-slate-400">Para ver execuções individuais, use a tela de Auditoria.</span>
          </>
        }
      />

      <FilterPanel dirty={filtros.dirty} onApply={aplicarFiltros} onClear={limparFiltros}>
        <FilterFieldGroup label="Filtros">
          <FormField id="filtro-periodo" label="Período">
            {(f) => (
              <Select
                value={filtros.draft.periodo}
                onValueChange={(v) => filtros.setField('periodo', v as FiltrosPerformance['periodo'])}
              >
                <SelectTrigger id={f.id} className="w-full" aria-invalid={f['aria-invalid']}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hoje">Hoje</SelectItem>
                  <SelectItem value="7dias">7 dias</SelectItem>
                  <SelectItem value="30dias">30 dias</SelectItem>
                  <SelectItem value="personalizado">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            )}
          </FormField>

          {filtros.draft.periodo === 'personalizado' && (
            <>
              <FormField id="filtro-data-inicio" label="Data início">
                {(f) => <DateField {...f} value={filtros.draft.dataInicio || ''} onChange={(v) => filtros.setField('dataInicio', v)} />}
              </FormField>
              <FormField id="filtro-data-fim" label="Data fim">
                {(f) => <DateField {...f} value={filtros.draft.dataFim || ''} onChange={(v) => filtros.setField('dataFim', v)} />}
              </FormField>
            </>
          )}

          <FormField id="filtro-motor" label="Motor">
            {(f) => (
              <Select
                value={filtros.draft.motor}
                onValueChange={(v) => filtros.setField('motor', v as FiltrosPerformance['motor'])}
              >
                <SelectTrigger id={f.id} className="w-full" aria-invalid={f['aria-invalid']}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="legado">Versão anterior</SelectItem>
                  <SelectItem value="v2">Versão atual</SelectItem>
                </SelectContent>
              </Select>
            )}
          </FormField>

          <FormField id="filtro-status" label="Status">
            {(f) => (
              <Select
                value={filtros.draft.status}
                onValueChange={(v) => filtros.setField('status', v as FiltrosPerformance['status'])}
              >
                <SelectTrigger id={f.id} className="w-full" aria-invalid={f['aria-invalid']}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="success">Sucesso</SelectItem>
                  <SelectItem value="error">Erro</SelectItem>
                </SelectContent>
              </Select>
            )}
          </FormField>

          <FormField id="filtro-provider" label="Provider">
            {(f) => (
              <Select
                value={filtros.draft.provider || 'todos'}
                onValueChange={(v) => filtros.setField('provider', v === 'todos' ? undefined : v)}
              >
                <SelectTrigger id={f.id} className="w-full" aria-invalid={f['aria-invalid']}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="locationiq">LocationIQ</SelectItem>
                  <SelectItem value="supabase">Supabase</SelectItem>
                  <SelectItem value="photon">Photon</SelectItem>
                  <SelectItem value="google_geocoding">Google</SelectItem>
                  <SelectItem value="maps.co">Maps.co</SelectItem>
                </SelectContent>
              </Select>
            )}
          </FormField>

          <FormField id="filtro-cache" label="Cache">
            {(f) => (
              <Select
                value={filtros.draft.cache || 'todos'}
                onValueChange={(v) => filtros.setField('cache', v as FiltrosPerformance['cache'])}
              >
                <SelectTrigger id={f.id} className="w-full" aria-invalid={f['aria-invalid']}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="hit">Encontrado no cache</SelectItem>
                  <SelectItem value="miss">Consultou provedor externo</SelectItem>
                </SelectContent>
              </Select>
            )}
          </FormField>
        </FilterFieldGroup>
      </FilterPanel>

      {isLoading ? (
        <Card>
          <CardContent>
            <Skeleton className="h-6 w-48 mb-4" />
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
            </div>
          </CardContent>
        </Card>
      ) : error ? (
        <Alert tone="danger">{error}</Alert>
      ) : !data ? (
        <Card>
          <CardContent>
            <EmptyState icon={<Search className="size-5" />} title="Use os filtros acima para pesquisar." />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Bloco A: Resumo principal */}
          <Card>
            <CardHeader icon={<Gauge className="size-5" />} title="Resumo principal" />
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <KpiCard
                  label="Tempo médio — versão anterior"
                  value={legado ? formatMs(legado.tempo_medio_ms) : '-'}
                  detail={legado ? `${legado.total_buscas} buscas` : ''}
                  icon={<Clock className="size-4" />}
                />
                <KpiCard
                  label="Tempo médio — versão atual"
                  value={v2 ? formatMs(v2.tempo_medio_ms) : '-'}
                  detail={v2 ? `${v2.total_buscas} buscas` : ''}
                  icon={<Zap className="size-4" />}
                  tone="success"
                />
                <KpiCard
                  label="Redução de tempo"
                  value={reducaoPct !== null ? `${reducaoPct}%` : '-'}
                  detail={reducaoPct !== null && reducaoPct > 0 ? 'mais rápido' : ''}
                  icon={<TrendingDown className="size-4" />}
                  tone={reducaoPct !== null && reducaoPct > 0 ? 'success' : 'neutral'}
                />
                <KpiCard
                  label="Buscas dentro da meta (até 30s)"
                  value={v2 ? formatPct(v2.buscas_ate_30s, v2.total_buscas) : '-'}
                  detail={v2 ? `${v2.buscas_ate_30s} de ${v2.total_buscas}` : ''}
                  icon={<Activity className="size-4" />}
                />
                <KpiCard
                  label="Erros — versão atual"
                  value={v2 ? String(v2.erros) : '-'}
                  detail={v2 && v2.erros === 0 ? 'sem erros' : ''}
                  icon={<AlertTriangle className="size-4" />}
                  tone={v2 && v2.erros > 0 ? 'danger' : 'neutral'}
                />
              </div>
            </CardContent>
          </Card>

          {/* Bloco B: Faixas de tempo */}
          <Card>
            <CardHeader title="Comparação por faixa de tempo" />
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={faixasChartData} margin={{ top: 10, right: 20, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="faixa" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="legado" name="Versão anterior" fill="#94A3B8" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="v2" name="Versão atual" fill="#00A5E6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Bloco C: Evolução diária */}
          <Card>
            <CardHeader title="Evolução diária" />
            <CardContent>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={evolucaoChartData} margin={{ top: 10, right: 20, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="data" />
                    <YAxis yAxisId="left" label={{ value: 'segundos', angle: -90, position: 'insideLeft' }} />
                    <YAxis yAxisId="right" orientation="right" label={{ value: 'buscas', angle: 90, position: 'insideRight' }} />
                    <Tooltip />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="tempo_legado" name="Tempo médio — anterior (s)" stroke="#94A3B8" strokeWidth={2} />
                    <Line yAxisId="left" type="monotone" dataKey="tempo_v2" name="Tempo médio — atual (s)" stroke="#00A5E6" strokeWidth={2} />
                    <Bar yAxisId="right" dataKey="buscas_legado" name="Buscas — anterior" fill="#CBD5E1" radius={[3, 3, 0, 0]} />
                    <Bar yAxisId="right" dataKey="buscas_v2" name="Buscas — atual" fill="#7DD3FC" radius={[3, 3, 0, 0]} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Bloco D: Provedores e cache */}
          <Card>
            <CardHeader title="Provedores e cache" />
            <CardContent>
              <Alert tone="warning" className="mb-4">
                Dados de geocodificação ainda não representam toda a telemetria da v2. Estes são dados gerais de cache e provedores.
              </Alert>
              <ResponsiveTable<ProviderCache>
                columns={[
                  { key: 'provider', header: 'Provedor', width: 'content', render: (p) => <span className="font-medium">{p.provider}</span> },
                  { key: 'chamadas', header: 'Chamadas', width: 'compact', className: 'text-center', render: (p) => p.chamadas },
                  { key: 'tempo_medio', header: 'Tempo médio', width: 'compact', className: 'text-center', render: (p) => formatMs(p.tempo_medio_ms) },
                  { key: 'tempo_tipico', header: 'Tempo típico', width: 'compact', className: 'text-center', render: (p) => formatMs(p.tempo_tipico_ms) },
                  { key: 'casos_lentos', header: 'Casos mais lentos', width: 'compact', className: 'text-center', render: (p) => formatMs(p.casos_mais_lentos_ms) },
                  {
                    key: 'origem', header: 'Origem', width: 'standard', className: 'text-center',
                    render: (p) => (p.cache_hit ? <Badge tone="success">Encontrado no cache</Badge> : <Badge tone="warning">Consultou provedor externo</Badge>),
                  },
                  {
                    key: 'confianca', header: 'Confiança média', width: 'compact', className: 'text-center',
                    render: (p) => (p.confianca_media > 0 ? `${(p.confianca_media * 100).toFixed(0)}%` : '-'),
                  },
                ]}
                rows={data.provedores}
                rowKey={(p) => `${p.provider}-${p.cache_hit}`}
                firstColumnSticky
                renderMobileCard={(p) => (
                  <>
                    <p className="font-semibold">{p.provider}</p>
                    <p className="text-xs text-slate-500">{p.chamadas} chamadas — {formatMs(p.tempo_medio_ms)}</p>
                    <p className="text-xs">{p.cache_hit ? <Badge tone="success">Encontrado no cache</Badge> : <Badge tone="warning">Consultou provedor externo</Badge>}</p>
                  </>
                )}
                emptyTitle="Nenhum dado encontrado"
              />
              {data.total_economia_cache_sec !== null && data.total_economia_cache_sec > 0 && (
                <p className="text-sm text-green-600 mt-3">
                  ⏱️ Tempo economizado pelo cache: ~{data.total_economia_cache_sec}s no período
                </p>
              )}
            </CardContent>
          </Card>

          {/* Bloco E: Bairros e CEPs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader icon={<MapPin className="size-5" />} title="Bairros mais cacheados" />
              <CardContent>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {data.bairros.map((b, i) => (
                    <div
                      key={`${b.bairro}-${i}`}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg ${b.bairro === '(sem bairro)' ? 'bg-amber-50' : 'bg-slate-50'}`}
                    >
                      <span className="text-sm font-medium text-slate-700">{b.bairro}</span>
                      <span className="text-sm text-slate-500">{b.total} {b.total === 1 ? 'endereço' : 'endereços'}</span>
                    </div>
                  ))}
                  {data.bairros.length === 0 && (
                    <EmptyState title="Nenhum dado encontrado" />
                  )}
                </div>
                {data.pontos_atencao.cache_sem_bairro > 0 && (
                  <p className="text-xs text-amber-600 mt-3">
                    {data.pontos_atencao.cache_sem_bairro} endereços sem bairro no cache — indica oportunidade de melhoria.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader icon={<Search className="size-5" />} title="CEPs mais pesquisados" />
              <CardContent>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {data.ceps.map((c, i) => (
                    <div key={`${c.cep}-${i}`} className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50">
                      <span className="text-sm font-medium text-slate-700">{c.cep || '(sem CEP)'}</span>
                      <span className="text-sm text-slate-500">{c.total} buscas</span>
                    </div>
                  ))}
                  {data.ceps.length === 0 && (
                    <EmptyState title="Nenhum dado encontrado" />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Bloco F: Pontos de atenção */}
          <Card>
            <CardHeader icon={<AlertTriangle className="size-5" />} title="Pontos de atenção" description="Indicadores para monitorar. Não são erros críticos, mas merecem atenção." />
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <KpiCard
                  label="Buscas v2 acima de 30s"
                  value={String(data.pontos_atencao.v2_acima_30s)}
                  icon={<Clock className="size-4" />}
                  tone={data.pontos_atencao.v2_acima_30s > 0 ? 'warning' : 'neutral'}
                />
                <KpiCard
                  label="Buscas com erro"
                  value={String(data.pontos_atencao.buscas_erro.reduce((acc, e) => acc + e.total, 0))}
                  detail={data.pontos_atencao.buscas_erro.map(e => `${e.motor}: ${e.total}`).join(', ') || 'sem erros'}
                  icon={<AlertTriangle className="size-4" />}
                  tone={data.pontos_atencao.buscas_erro.reduce((acc, e) => acc + e.total, 0) > 0 ? 'danger' : 'neutral'}
                />
                <KpiCard
                  label="Cache sem bairro"
                  value={String(data.pontos_atencao.cache_sem_bairro)}
                  icon={<MapPin className="size-4" />}
                  tone={data.pontos_atencao.cache_sem_bairro > 0 ? 'warning' : 'neutral'}
                />
                <KpiCard
                  label="Provedores lentos"
                  value={String(data.pontos_atencao.providers_lentos.length)}
                  detail={data.pontos_atencao.providers_lentos.map(p => `${p.provider} (${formatMs(p.tempo_medio_ms)})`).join(', ') || 'nenhum'}
                  icon={<Gauge className="size-4" />}
                  tone={data.pontos_atencao.providers_lentos.length > 0 ? 'warning' : 'neutral'}
                />
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </PageContainer>
  );
}
