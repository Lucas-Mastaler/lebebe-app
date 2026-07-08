import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth/api-auth';
import { createServiceClient } from '@/lib/supabase/service';
import type { FiltrosListagemFechamentos, RegistroFechamentoAutomatico } from '@/lib/digisac/finalizacoesAutomaticas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireAuthenticatedUser({
    requireAllowedUser: true,
    requireActive: true,
    requiredRole: 'superadmin',
  });
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);

  const filtros: FiltrosListagemFechamentos = {
    status: (searchParams.get('status') ?? undefined) as FiltrosListagemFechamentos['status'],
    tipoChamado: (searchParams.get('tipoChamado') ?? undefined) as FiltrosListagemFechamentos['tipoChamado'],
    ultimaMensagemPor: (searchParams.get('ultimaMensagemPor') ?? undefined) as FiltrosListagemFechamentos['ultimaMensagemPor'],
    serviceId: searchParams.get('serviceId') ?? undefined,
    dataInicio: searchParams.get('dataInicio') ?? undefined,
    dataFim: searchParams.get('dataFim') ?? undefined,
    busca: searchParams.get('busca') ?? undefined,
    page: Number(searchParams.get('page') ?? 1),
    pageSize: Math.min(Number(searchParams.get('pageSize') ?? 30), 100),
  };

  const page = Math.max(1, filtros.page ?? 1);
  const pageSize = Math.max(1, filtros.pageSize ?? 30);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  console.log('[API][FINALIZACOES-AUTO] GET filtros=', {
    status: filtros.status,
    tipoChamado: filtros.tipoChamado,
    ultimaMensagemPor: filtros.ultimaMensagemPor,
    serviceId: filtros.serviceId,
    dataInicio: filtros.dataInicio,
    dataFim: filtros.dataFim,
    busca: filtros.busca ? '[presente]' : '[ausente]',
    page,
    pageSize,
  });

  try {
    const supabase = createServiceClient();

    let query = supabase
      .from('digisac_fechamentos_automaticos')
      .select('*', { count: 'exact' })
      .order('finalizado_em', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (filtros.status) {
      query = query.eq('status', filtros.status);
    }
    if (filtros.tipoChamado) {
      query = query.eq('tipo_chamado', filtros.tipoChamado);
    }
    if (filtros.ultimaMensagemPor) {
      query = query.eq('ultima_mensagem_por', filtros.ultimaMensagemPor);
    }
    if (filtros.serviceId) {
      query = query.eq('service_id', filtros.serviceId);
    }
    if (filtros.dataInicio) {
      query = query.gte('created_at', filtros.dataInicio);
    }
    if (filtros.dataFim) {
      query = query.lte('created_at', filtros.dataFim + 'T23:59:59.999Z');
    }
    if (filtros.busca && filtros.busca.trim().length > 0) {
      const termo = filtros.busca.trim();
      query = query.or(
        `nome_contato.ilike.%${termo}%,telefone_contato.ilike.%${termo}%,protocolo.ilike.%${termo}%`
      );
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('[API][FINALIZACOES-AUTO] Erro Supabase:', error.message);
      return NextResponse.json({ error: 'Erro ao buscar registros' }, { status: 500 });
    }

    console.log('[API][FINALIZACOES-AUTO] total=', count, 'items=', data?.length ?? 0);

    const semFiltros = !filtros.status && !filtros.tipoChamado && !filtros.ultimaMensagemPor && !filtros.serviceId && !filtros.dataInicio && !filtros.dataFim && !filtros.busca;

    let resumo: { total: number; pendentes: number; finalizados: number; erros: number; ignorados: number } | undefined;
    if (semFiltros) {
      const { data: statusRows } = await supabase
        .from('digisac_fechamentos_automaticos')
        .select('status');
      if (statusRows) {
        const counts = { pendente: 0, finalizado: 0, erro: 0, ignorado: 0 };
        for (const row of statusRows) {
          const s = row.status as keyof typeof counts;
          if (s in counts) counts[s]++;
        }
        resumo = {
          total: statusRows.length,
          pendentes: counts.pendente,
          finalizados: counts.finalizado,
          erros: counts.erro,
          ignorados: counts.ignorado,
        };
      }
    }

    return NextResponse.json({
      items: (data ?? []) as RegistroFechamentoAutomatico[],
      total: count ?? 0,
      page,
      pageSize,
      resumo,
    });
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : String(err);
    console.error('[API][FINALIZACOES-AUTO] Erro geral:', mensagem);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
