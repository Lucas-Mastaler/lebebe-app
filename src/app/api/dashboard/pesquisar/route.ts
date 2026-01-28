import { NextRequest, NextResponse } from 'next/server';
import { pesquisarDashboard } from '@/lib/digisac/dashboard';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      dataInicio,
      dataFim,
      departmentIds = [],
      userIds = [],
    } = body || {};

    console.log('[API][DASHBOARD] POST /api/dashboard/pesquisar bodySummary=', {
      hasBody: !!body,
      dataInicio,
      dataFim,
      departmentsCount: Array.isArray(departmentIds) ? departmentIds.length : 0,
      usersCount: Array.isArray(userIds) ? userIds.length : 0,
    });

    if (!dataInicio || !dataFim) {
      return NextResponse.json({ error: 'Período (dataInicio e dataFim) é obrigatório' }, { status: 400 });
    }

    const resultado = await pesquisarDashboard({
      dataInicio,
      dataFim,
      departmentIds,
      userIds,
    });

    console.log('[API][DASHBOARD] linhasRetornadas=', resultado.linhas.length);
    if (resultado.linhas.length > 0) {
      console.log('[API][DASHBOARD] exemploLinha=', resultado.linhas[0]);
    }

    return NextResponse.json(resultado);
  } catch (error: any) {
    console.error('[API][DASHBOARD] Erro na rota /api/dashboard/pesquisar:', error?.message || error);
    return NextResponse.json({ error: 'Erro interno ao processar dashboard' }, { status: 500 });
  }
}
