'use client';

import { useCallback, useState } from 'react';
import { Activity, AlertTriangle, Clock, Gauge, MapPin, Search, TrendingDown, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, ComposedChart,
} from 'recharts';
import type { PerformanceResponse, FiltrosPerformance } from '@/types/procurar-datas-performance';

const FAIXA_LABELS: Record<string, string> = {
  ate_15s: 'Até 15s',
  '15s_a_30s': '15s a 30s',
  '30s_a_60s': '30s a 60s',
  acima_60s: 'Acima de 60s',
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
  const [filtros, setFiltros] = useState<FiltrosPerformance>({
    periodo: '30dias',
    motor: 'todos',
    status: 'todos',
    cache: 'todos',
  });

  const handlePesquisar = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/procurar-datas/performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filtros),
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
  }, [filtros]);

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Performance da busca de datas</h1>
        <p className="text-slate-600 mt-1">
          Velocidade e estabilidade do motor de busca — versão anterior vs versão atual.
          <br />
          <span className="text-sm text-slate-400">Para ver execuções individuais, use a tela de Auditoria.</span>
        </p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 card-shadow">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm text-slate-600 mb-1">Período</label>
            <select
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white"
              value={filtros.periodo}
              onChange={e => setFiltros(f => ({ ...f, periodo: e.target.value as FiltrosPerformance['periodo'] }))}
            >
              <option value="hoje">Hoje</option>
              <option value="7dias">7 dias</option>
              <option value="30dias">30 dias</option>
              <option value="personalizado">Personalizado</option>
            </select>
          </div>

          {filtros.periodo === 'personalizado' && (
            <>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Data início</label>
                <input
                  type="date"
                  className="border border-slate-200 rounded-xl px-3 py-2 text-sm"
                  value={filtros.dataInicio || ''}
                  onChange={e => setFiltros(f => ({ ...f, dataInicio: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Data fim</label>
                <input
                  type="date"
                  className="border border-slate-200 rounded-xl px-3 py-2 text-sm"
                  value={filtros.dataFim || ''}
                  onChange={e => setFiltros(f => ({ ...f, dataFim: e.target.value }))}
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm text-slate-600 mb-1">Motor</label>
            <select
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white"
              value={filtros.motor}
              onChange={e => setFiltros(f => ({ ...f, motor: e.target.value as FiltrosPerformance['motor'] }))}
            >
              <option value="todos">Todos</option>
              <option value="legado">Versão anterior</option>
              <option value="v2">Versão atual</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-slate-600 mb-1">Status</label>
            <select
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white"
              value={filtros.status}
              onChange={e => setFiltros(f => ({ ...f, status: e.target.value as FiltrosPerformance['status'] }))}
            >
              <option value="todos">Todos</option>
              <option value="success">Sucesso</option>
              <option value="error">Erro</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-slate-600 mb-1">Provider</label>
            <select
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white"
              value={filtros.provider || 'todos'}
              onChange={e => setFiltros(f => ({ ...f, provider: e.target.value }))}
            >
              <option value="todos">Todos</option>
              <option value="locationiq">LocationIQ</option>
              <option value="supabase">Supabase</option>
              <option value="photon">Photon</option>
              <option value="google_geocoding">Google</option>
              <option value="maps.co">Maps.co</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-slate-600 mb-1">Cache</label>
            <select
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white"
              value={filtros.cache || 'todos'}
              onChange={e => setFiltros(f => ({ ...f, cache: e.target.value as FiltrosPerformance['cache'] }))}
            >
              <option value="todos">Todos</option>
              <option value="hit">Encontrado no cache</option>
              <option value="miss">Consultou provedor externo</option>
            </select>
          </div>

          <Button onClick={handlePesquisar} disabled={isLoading} className="rounded-xl">
            <Search className="w-4 h-4 mr-2" /> PESQUISAR
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 card-shadow">
          <Skeleton className="h-6 w-48 mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
          </div>
        </div>
      ) : error ? (
        <div className="bg-white rounded-2xl border border-red-200 p-6">
          <div className="flex items-center gap-3 text-red-600">
            <AlertTriangle className="w-5 h-5" />
            <p>{error}</p>
          </div>
        </div>
      ) : !data ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <p className="text-slate-500">Use os filtros acima para pesquisar.</p>
        </div>
      ) : (
        <>
          {/* Bloco A: Resumo principal */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 card-shadow">
            <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Gauge className="w-5 h-5 text-[#00A5E6]" /> Resumo principal
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <CardMetric
                label="Tempo médio — versão anterior"
                value={legado ? formatMs(legado.tempo_medio_ms) : '-'}
                sub={legado ? `${legado.total_buscas} buscas` : ''}
                icon={<Clock className="w-4 h-4 text-slate-400" />}
              />
              <CardMetric
                label="Tempo médio — versão atual"
                value={v2 ? formatMs(v2.tempo_medio_ms) : '-'}
                sub={v2 ? `${v2.total_buscas} buscas` : ''}
                icon={<Zap className="w-4 h-4 text-green-500" />}
              />
              <CardMetric
                label="Redução de tempo"
                value={reducaoPct !== null ? `${reducaoPct}%` : '-'}
                sub={reducaoPct !== null && reducaoPct > 0 ? 'mais rápido' : ''}
                icon={<TrendingDown className="w-4 h-4 text-green-500" />}
                highlight={reducaoPct !== null && reducaoPct > 0}
              />
              <CardMetric
                label="Buscas dentro da meta (até 30s)"
                value={v2 ? formatPct(v2.buscas_ate_30s, v2.total_buscas) : '-'}
                sub={v2 ? `${v2.buscas_ate_30s} de ${v2.total_buscas}` : ''}
                icon={<Activity className="w-4 h-4 text-[#00A5E6]" />}
              />
              <CardMetric
                label="Erros — versão atual"
                value={v2 ? String(v2.erros) : '-'}
                sub={v2 && v2.erros === 0 ? 'sem erros' : ''}
                icon={<AlertTriangle className="w-4 h-4 text-amber-500" />}
                highlight={v2 && v2.erros > 0}
              />
            </div>
          </div>

          {/* Bloco B: Faixas de tempo */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 card-shadow">
            <h2 className="font-semibold text-slate-900 mb-4">Comparação por faixa de tempo</h2>
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
          </div>

          {/* Bloco C: Evolução diária */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 card-shadow">
            <h2 className="font-semibold text-slate-900 mb-4">Evolução diária</h2>
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
          </div>

          {/* Bloco D: Provedores e cache */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 card-shadow">
            <h2 className="font-semibold text-slate-900 mb-2">Provedores e cache</h2>
            <p className="text-sm text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mb-4">
              ⚠️ Dados de geocodificação ainda não representam toda a telemetria da v2. Estes são dados gerais de cache e provedores.
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-[760px] w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-2">Provedor</th>
                    <th className="text-center px-4 py-2">Chamadas</th>
                    <th className="text-center px-4 py-2">Tempo médio</th>
                    <th className="text-center px-4 py-2">Tempo típico</th>
                    <th className="text-center px-4 py-2">Casos mais lentos</th>
                    <th className="text-center px-4 py-2">Origem</th>
                    <th className="text-center px-4 py-2">Confiança média</th>
                  </tr>
                </thead>
                <tbody>
                  {data.provedores.map((p, i) => (
                    <tr key={`${p.provider}-${p.cache_hit}`} className={`border-b last:border-0 ${i % 2 === 0 ? 'bg-white' : 'bg-sky-50'}`}>
                      <td className="px-4 py-2 font-medium">{p.provider}</td>
                      <td className="px-4 py-2 text-center">{p.chamadas}</td>
                      <td className="px-4 py-2 text-center">{formatMs(p.tempo_medio_ms)}</td>
                      <td className="px-4 py-2 text-center">{formatMs(p.tempo_tipico_ms)}</td>
                      <td className="px-4 py-2 text-center">{formatMs(p.casos_mais_lentos_ms)}</td>
                      <td className="px-4 py-2 text-center">
                        {p.cache_hit ? (
                          <span className="text-green-600">Encontrado no cache</span>
                        ) : (
                          <span className="text-orange-600">Consultou provedor externo</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-center">
                        {p.confianca_media > 0 ? `${(p.confianca_media * 100).toFixed(0)}%` : '-'}
                      </td>
                    </tr>
                  ))}
                  {data.provedores.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-4 text-center text-slate-400">Nenhum dado encontrado</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {data.total_economia_cache_sec !== null && data.total_economia_cache_sec > 0 && (
              <p className="text-sm text-green-600 mt-3">
                ⏱️ Tempo economizado pelo cache: ~{data.total_economia_cache_sec}s no período
              </p>
            )}
          </div>

          {/* Bloco E: Bairros e CEPs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 card-shadow">
              <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[#00A5E6]" /> Bairros mais cacheados
              </h2>
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
                  <p className="text-slate-400 text-sm text-center py-4">Nenhum dado encontrado</p>
                )}
              </div>
              {data.pontos_atencao.cache_sem_bairro > 0 && (
                <p className="text-xs text-amber-600 mt-3">
                  {data.pontos_atencao.cache_sem_bairro} endereços sem bairro no cache — indica oportunidade de melhoria.
                </p>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 card-shadow">
              <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Search className="w-5 h-5 text-[#00A5E6]" /> CEPs mais pesquisados
              </h2>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {data.ceps.map((c, i) => (
                  <div key={`${c.cep}-${i}`} className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50">
                    <span className="text-sm font-medium text-slate-700">{c.cep || '(sem CEP)'}</span>
                    <span className="text-sm text-slate-500">{c.total} buscas</span>
                  </div>
                ))}
                {data.ceps.length === 0 && (
                  <p className="text-slate-400 text-sm text-center py-4">Nenhum dado encontrado</p>
                )}
              </div>
            </div>
          </div>

          {/* Bloco F: Pontos de atenção */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 card-shadow">
            <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" /> Pontos de atenção
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              Indicadores para monitorar. Não são erros críticos, mas merecem atenção.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <CardMetric
                label="Buscas v2 acima de 30s"
                value={String(data.pontos_atencao.v2_acima_30s)}
                icon={<Clock className="w-4 h-4 text-amber-500" />}
                highlight={data.pontos_atencao.v2_acima_30s > 0}
              />
              <CardMetric
                label="Buscas com erro"
                value={String(data.pontos_atencao.buscas_erro.reduce((acc, e) => acc + e.total, 0))}
                sub={data.pontos_atencao.buscas_erro.map(e => `${e.motor}: ${e.total}`).join(', ') || 'sem erros'}
                icon={<AlertTriangle className="w-4 h-4 text-red-400" />}
                highlight={data.pontos_atencao.buscas_erro.reduce((acc, e) => acc + e.total, 0) > 0}
              />
              <CardMetric
                label="Cache sem bairro"
                value={String(data.pontos_atencao.cache_sem_bairro)}
                icon={<MapPin className="w-4 h-4 text-amber-400" />}
                highlight={data.pontos_atencao.cache_sem_bairro > 0}
              />
              <CardMetric
                label="Provedores lentos"
                value={String(data.pontos_atencao.providers_lentos.length)}
                sub={data.pontos_atencao.providers_lentos.map(p => `${p.provider} (${formatMs(p.tempo_medio_ms)})`).join(', ') || 'nenhum'}
                icon={<Gauge className="w-4 h-4 text-orange-400" />}
                highlight={data.pontos_atencao.providers_lentos.length > 0}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function CardMetric({
  label,
  value,
  sub,
  icon,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs text-slate-500">{label}</span>
      </div>
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}
