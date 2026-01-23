import { NextRequest, NextResponse } from 'next/server';
import { pesquisarChamadosFinalizados } from '@/lib/digisac/chamadosFinalizados';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      dataUltimoChamadoFechadoInicio,
      dataUltimoChamadoFechadoFim,
      departmentId,
      userId,
      page = 1,
      perPage = 30,
    } = body || {};

    if (!dataUltimoChamadoFechadoInicio || !dataUltimoChamadoFechadoFim) {
      return NextResponse.json({ error: 'Datas de último chamado fechado são obrigatórias' }, { status: 400 });
    }

    const resultado = await pesquisarChamadosFinalizados({
      dataUltimoChamadoFechadoInicio,
      dataUltimoChamadoFechadoFim,
      departmentId,
      userId,
      page,
      perPage,
    });

    return NextResponse.json(resultado);
  } catch (error: any) {
    console.error('[API][CHAMADOS] Erro na rota /api/chamados-finalizados/pesquisar:', error);
    if (typeof error?.message === 'string' && error.message.includes('inválid')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Erro interno ao processar pesquisa' }, { status: 500 });
  }
}
