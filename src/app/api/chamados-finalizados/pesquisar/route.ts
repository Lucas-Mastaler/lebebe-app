import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth/api-auth';
import { pesquisarChamadosFinalizados } from '@/lib/digisac/chamadosFinalizados';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser({
      requireAllowedUser: true,
      requireActive: true,
    });
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const {
      dataUltimoChamadoFechadoInicio,
      dataUltimoChamadoFechadoFim,
      departmentIds = [],
      userIds = [],
      page = 1,
      perPage = 30,
    } = body || {};

    console.log('[API][CHAMADOS][ROUTE] POST /api/chamados-finalizados/pesquisar bodySummary=', {
      hasBody: !!body,
      page,
      perPage,
      departmentsCount: Array.isArray(departmentIds) ? departmentIds.length : 0,
      usersCount: Array.isArray(userIds) ? userIds.length : 0,
      dataUltimoChamadoFechadoInicio,
      dataUltimoChamadoFechadoFim,
    });

    if (!dataUltimoChamadoFechadoInicio || !dataUltimoChamadoFechadoFim) {
      return NextResponse.json({ error: 'Datas de último chamado fechado são obrigatórias' }, { status: 400 });
    }

    const resultado = await pesquisarChamadosFinalizados({
      dataUltimoChamadoFechadoInicio,
      dataUltimoChamadoFechadoFim,
      departmentIds,
      userIds,
      page,
      perPage,
    });

    try {
      const items = Array.isArray(resultado?.items) ? resultado.items : [];
      const nomeParaIds = new Map<string, string[]>();
      for (const it of items) {
        const nome = (it.nomeDigisac || '').trim();
        const arr = nomeParaIds.get(nome) || [];
        arr.push(it.contactId);
        nomeParaIds.set(nome, arr);
      }
      const duplicados = Array.from(nomeParaIds.entries()).filter(([n, ids]) => n && ids.length > 1);
      console.log('[API][CHAMADOS][ROUTE] resultado.items=', items.length, 'duplicates=', duplicados.length);
      if (duplicados.length > 0) {
        console.warn('[API][CHAMADOS][ROUTE] nomesDuplicadosDetectados=', duplicados.map(([nome, ids]) => ({ nome, contactIds: ids })));
      }
    } catch (e) {
      console.warn('[API][CHAMADOS][ROUTE] logResumoResultado falhou:', e);
    }

    return NextResponse.json(resultado);
  } catch (error: unknown) {
    console.error('[API][CHAMADOS] Erro na rota /api/chamados-finalizados/pesquisar:', error);
    const errorMessage = error instanceof Error ? error.message : '';
    if (typeof errorMessage === 'string' && errorMessage.includes('inválid')) {
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }
    return NextResponse.json({ error: 'Erro interno ao processar pesquisa' }, { status: 500 });
  }
}
