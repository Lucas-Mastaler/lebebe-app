import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth/api-auth';
import { buscarEstatisticasDigisac } from '@/lib/digisac/estatisticas';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser({
      requireAllowedUser: true,
      requireActive: true,
    });
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const { dataInicio, dataFim, serviceId } = body || {};

    console.log('[API][DASHBOARD][ESTATISTICAS] POST bodySummary=', {
      hasBody: !!body,
      dataInicio,
      dataFim,
      hasServiceId: !!serviceId,
    });

    if (!dataInicio || !dataFim) {
      return NextResponse.json(
        { error: 'Período (dataInicio e dataFim) é obrigatório' },
        { status: 400 }
      );
    }

    const resultado = await buscarEstatisticasDigisac({
      dataInicio,
      dataFim,
      serviceId: serviceId || undefined,
    });

    console.log('[API][DASHBOARD][ESTATISTICAS] diarioItems=', resultado.diario.length);

    return NextResponse.json(resultado);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[API][DASHBOARD][ESTATISTICAS] Erro:', errorMessage);
    return NextResponse.json(
      { error: 'Erro interno ao buscar estatísticas Digisac' },
      { status: 500 }
    );
  }
}
