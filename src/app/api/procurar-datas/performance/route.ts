import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth/api-auth';
import { requireModuleAccess } from '@/lib/auth/module-access';
import { createServiceClient } from '@/lib/supabase/service';
import { normalizarListaBairros } from '@/lib/procurar-datas/normalizar-bairro';
import type { PerformanceResponse, FiltrosPerformance } from '@/types/procurar-datas-performance';

export const runtime = 'nodejs';

function buildDateRange(filtros: FiltrosPerformance): { inicio: string; fim: string } {
  const now = new Date();
  const fim = now.toISOString();

  if (filtros.periodo === 'personalizado' && filtros.dataInicio && filtros.dataFim) {
    return {
      inicio: new Date(filtros.dataInicio + 'T00:00:00-03:00').toISOString(),
      fim: new Date(filtros.dataFim + 'T23:59:59-03:00').toISOString(),
    };
  }

  const dias = filtros.periodo === 'hoje' ? 0 : filtros.periodo === '7dias' ? 7 : 30;
  const inicio = new Date(now);
  inicio.setDate(inicio.getDate() - dias);
  inicio.setHours(0, 0, 0, 0);

  return { inicio: inicio.toISOString(), fim };
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser({
      requireAllowedUser: true,
      requireActive: true,
    });
    if (!auth.ok) return auth.response;

    const moduleAccess = await requireModuleAccess('procurar_datas_performance');
    if (!moduleAccess.ok) return moduleAccess.response;

    const body = await request.json();
    const filtros: FiltrosPerformance = {
      periodo: body.periodo || '30dias',
      dataInicio: body.dataInicio,
      dataFim: body.dataFim,
      motor: body.motor || 'todos',
      status: body.status || 'todos',
      cidade: body.cidade,
      provider: body.provider,
      cache: body.cache || 'todos',
    };

    const { inicio, fim } = buildDateRange(filtros);
    const supabase = createServiceClient();

    const motorFilter = filtros.motor === 'todos' ? null : filtros.motor;
    const statusFilter = filtros.status === 'todos' ? null : filtros.status;

    // --- Bloco A: Resumo legado x v2 ---
    let resumoQuery = supabase
      .from('search_execution_audit')
      .select('motor, total_duration_ms, status')
      .gte('created_at', inicio)
      .lte('created_at', fim);

    if (motorFilter) resumoQuery = resumoQuery.eq('motor', motorFilter);
    if (statusFilter) resumoQuery = resumoQuery.eq('status', statusFilter);

    const { data: resumoRaw, error: resumoErr } = await resumoQuery;
    if (resumoErr) throw new Error('Erro ao buscar resumo: ' + resumoErr.message);

    const resumoMap = new Map<string, { total: number; durations: number[]; erros: number; ate30: number; acima60: number }>([]);
    for (const row of resumoRaw || []) {
      const m = row.motor || 'legado';
      const existing = resumoMap.get(m) || { total: 0, durations: [] as number[], erros: 0, ate30: 0, acima60: 0 };
      existing.total++;
      existing.durations.push(row.total_duration_ms || 0);
      if (row.status === 'error') existing.erros++;
      if ((row.total_duration_ms || 0) <= 30000) existing.ate30++;
      if ((row.total_duration_ms || 0) > 60000) existing.acima60++;
      resumoMap.set(m, existing);
    }

    const resumo = Array.from(resumoMap.entries()).map(([motor, d]) => {
      const sorted = d.durations.sort((a, b) => a - b);
      const mediana = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 0;
      const p95 = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.95)] : 0;
      const avg = sorted.length > 0 ? Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length) : 0;
      return {
        motor,
        total_buscas: d.total,
        tempo_medio_ms: avg,
        tempo_tipico_ms: mediana,
        casos_mais_lentos_ms: p95,
        erros: d.erros,
        buscas_ate_30s: d.ate30,
        buscas_acima_60s: d.acima60,
      };
    });

    // --- Bloco B: Faixas de tempo ---
    const faixas: { faixa: string; motor: string; total: number }[] = [];
    const faixaLabels = ['ate_15s', '15s_a_30s', '30s_a_60s', 'acima_60s'];
    for (const [motor, d] of resumoMap.entries()) {
      const counts = { ate_15s: 0, '15s_a_30s': 0, '30s_a_60s': 0, acima_60s: 0 };
      for (const dur of d.durations) {
        if (dur <= 15000) counts.ate_15s++;
        else if (dur <= 30000) counts['15s_a_30s']++;
        else if (dur <= 60000) counts['30s_a_60s']++;
        else counts.acima_60s++;
      }
      for (const faixa of faixaLabels) {
        faixas.push({ faixa, motor, total: counts[faixa as keyof typeof counts] });
      }
    }

    // --- Bloco C: Evolução diária ---
    let evolucaoQuery = supabase
      .from('search_execution_audit')
      .select('motor, total_duration_ms, created_at')
      .gte('created_at', inicio)
      .lte('created_at', fim);

    if (motorFilter) evolucaoQuery = evolucaoQuery.eq('motor', motorFilter);
    if (statusFilter) evolucaoQuery = evolucaoQuery.eq('status', statusFilter);

    const { data: evolucaoRaw, error: evolucaoErr } = await evolucaoQuery;
    if (evolucaoErr) throw new Error('Erro ao buscar evolução: ' + evolucaoErr.message);

    const evolucaoMap = new Map<string, { motor: string; total: number; durations: number[] }>([]);
    for (const row of evolucaoRaw || []) {
      const data = (row.created_at || '').slice(0, 10);
      const motor = row.motor || 'legado';
      const key = `${data}|${motor}`;
      const existing = evolucaoMap.get(key) || { motor, total: 0, durations: [] as number[] };
      existing.total++;
      existing.durations.push(row.total_duration_ms || 0);
      evolucaoMap.set(key, existing);
    }

    const evolucao = Array.from(evolucaoMap.entries())
      .map(([key, d]) => {
        const [data] = key.split('|');
        const sorted = d.durations.sort((a, b) => a - b);
        const mediana = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 0;
        const avg = sorted.length > 0 ? Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length) : 0;
        return {
          data,
          motor: d.motor,
          total_buscas: d.total,
          tempo_medio_ms: avg,
          tempo_tipico_ms: mediana,
        };
      })
      .sort((a, b) => a.data.localeCompare(b.data));

    // --- Bloco D: Provedores e cache ---
    let providerQuery = supabase
      .from('geocoding_audit')
      .select('provider, cache_hit, duration_ms, confidence')
      .gte('created_at', inicio)
      .lte('created_at', fim)
      .not('duration_ms', 'is', null);

    if (filtros.provider && filtros.provider !== 'todos') {
      providerQuery = providerQuery.eq('provider', filtros.provider);
    }
    if (filtros.cache === 'hit') providerQuery = providerQuery.eq('cache_hit', true);
    if (filtros.cache === 'miss') providerQuery = providerQuery.eq('cache_hit', false);

    const { data: providerRaw, error: providerErr } = await providerQuery;
    if (providerErr) throw new Error('Erro ao buscar provedores: ' + providerErr.message);

    const providerMap = new Map<string, { provider: string; cache_hit: boolean; durations: number[]; confidences: number[] }>([]);
    for (const row of providerRaw || []) {
      const key = `${row.provider}|${row.cache_hit}`;
      const existing = providerMap.get(key) || { provider: row.provider, cache_hit: row.cache_hit, durations: [] as number[], confidences: [] as number[] };
      existing.durations.push(row.duration_ms || 0);
      if (row.confidence != null) existing.confidences.push(Number(row.confidence));
      providerMap.set(key, existing);
    }

    const provedores = Array.from(providerMap.entries())
      .map(([_, d]) => {
        const sorted = d.durations.sort((a, b) => a - b);
        const mediana = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 0;
        const p95 = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.95)] : 0;
        const avg = sorted.length > 0 ? Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length) : 0;
        const confAvg = d.confidences.length > 0 ? d.confidences.reduce((a, b) => a + b, 0) / d.confidences.length : 0;
        return {
          provider: d.provider,
          cache_hit: d.cache_hit,
          chamadas: d.durations.length,
          tempo_medio_ms: avg,
          tempo_tipico_ms: mediana,
          casos_mais_lentos_ms: p95,
          confianca_media: Math.round(confAvg * 100) / 100,
        };
      })
      .sort((a, b) => b.chamadas - a.chamadas);

    // --- Bloco E: Bairros (do geo_cache) ---
    let bairroQuery = supabase
      .from('geo_cache')
      .select('bairro, cidade, uf, provider')
      .gte('updated_at', inicio);

    if (filtros.cidade && filtros.cidade !== 'todas') {
      bairroQuery = bairroQuery.eq('cidade', filtros.cidade);
    }

    const { data: bairroRaw, error: bairroErr } = await bairroQuery;
    if (bairroErr) throw new Error('Erro ao buscar bairros: ' + bairroErr.message);

    const bairrosNormalizados = normalizarListaBairros(
      (bairroRaw || []).map(r => ({
        bairro: r.bairro,
        total: 1,
        cidade: r.cidade,
        uf: r.uf,
        provider: r.provider,
      }))
    ).slice(0, 30);

    // --- Bloco E: CEPs mais pesquisados ---
    let cepQuery = supabase
      .from('search_execution_audit')
      .select('cep, motor')
      .gte('created_at', inicio)
      .lte('created_at', fim)
      .not('cep', 'is', null);

    if (motorFilter) cepQuery = cepQuery.eq('motor', motorFilter);
    if (statusFilter) cepQuery = cepQuery.eq('status', statusFilter);

    const { data: cepRaw, error: cepErr } = await cepQuery;
    if (cepErr) throw new Error('Erro ao buscar CEPs: ' + cepErr.message);

    const cepMap = new Map<string, { cep: string; total: number; motor: string }>();
    for (const row of cepRaw || []) {
      const cep = row.cep || '';
      const existing = cepMap.get(cep);
      if (existing) {
        existing.total++;
      } else {
        cepMap.set(cep, { cep, total: 1, motor: row.motor || 'legado' });
      }
    }

    const ceps = Array.from(cepMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 15);

    // --- Bloco F: Pontos de atenção ---
    const v2Acima30s = (resumoRaw || []).filter(r => r.motor === 'v2' && (r.total_duration_ms || 0) > 30000).length;

    const buscasErro: { motor: string; total: number }[] = [];
    const erroMap = new Map<string, number>();
    for (const row of resumoRaw || []) {
      if (row.status === 'error') {
        const m = row.motor || 'legado';
        erroMap.set(m, (erroMap.get(m) || 0) + 1);
      }
    }
    for (const [motor, total] of erroMap.entries()) {
      buscasErro.push({ motor, total });
    }

    const cacheSemBairro = (bairroRaw || []).filter(r => !r.bairro || r.bairro.trim() === '').length;

    const providersLentos = provedores
      .filter(p => !p.cache_hit && p.tempo_medio_ms > 10000)
      .map(p => ({ provider: p.provider, tempo_medio_ms: p.tempo_medio_ms }));

    // --- Economia estimada do cache ---
    let totalEconomiaCacheSec: number | null = null;
    try {
      const { data: econData } = await supabase
        .from('geocoding_audit')
        .select('cache_hit, duration_ms')
        .gte('created_at', inicio)
        .lte('created_at', fim)
        .not('duration_ms', 'is', null);

      if (econData) {
        const apiDurations = econData.filter(r => !r.cache_hit).map(r => r.duration_ms || 0);
        const allDurations = econData.map(r => r.duration_ms || 0);
        if (apiDurations.length > 0 && allDurations.length > 0) {
          const avgApi = apiDurations.reduce((a, b) => a + b, 0) / apiDurations.length;
          const totalActual = allDurations.reduce((a, b) => a + b, 0);
          const estimatedWithoutCache = avgApi * allDurations.length;
          totalEconomiaCacheSec = Math.round((estimatedWithoutCache - totalActual) / 1000);
        }
      }
    } catch {
      // não bloquear a tela se esta query falhar
    }

    const response: PerformanceResponse = {
      resumo,
      faixas,
      evolucao,
      provedores,
      bairros: bairrosNormalizados,
      ceps,
      pontos_atencao: {
        v2_acima_30s: v2Acima30s,
        buscas_erro: buscasErro,
        cache_sem_bairro: cacheSemBairro,
        providers_lentos: providersLentos,
      },
      total_economia_cache_sec: totalEconomiaCacheSec,
    };

    return NextResponse.json(response);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[API][PERFORMANCE] Erro:', errorMessage);
    return NextResponse.json({ error: 'Erro interno ao buscar performance' }, { status: 500 });
  }
}
