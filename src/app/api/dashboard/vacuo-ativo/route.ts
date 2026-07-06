import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth/api-auth';
import { calcularVacuoAtivoDashboard } from '@/lib/digisac/vacuoAtivo';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser({
      requireAllowedUser: true,
      requireActive: true,
    });
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const { dataInicio, dataFim, departmentIds, userIds, serviceIds } = body || {};

    console.log('[API][DASHBOARD][VACUO_ATIVO] POST bodySummary=', {
      hasBody: !!body,
      dataInicio,
      dataFim,
      departmentsCount: Array.isArray(departmentIds) ? departmentIds.length : 0,
      usersCount: Array.isArray(userIds) ? userIds.length : 0,
      servicesCount: Array.isArray(serviceIds) ? serviceIds.length : 0,
    });

    if (!dataInicio || !dataFim) {
      return NextResponse.json(
        { error: 'Período (dataInicio e dataFim) é obrigatório' },
        { status: 400 }
      );
    }

    const resultado = await calcularVacuoAtivoDashboard({
      dataInicio,
      dataFim,
      departmentIds: Array.isArray(departmentIds) ? departmentIds : undefined,
      userIds: Array.isArray(userIds) ? userIds : undefined,
      serviceIds: Array.isArray(serviceIds) ? serviceIds : undefined,
    });

    return NextResponse.json(resultado);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[API][DASHBOARD][VACUO_ATIVO] Erro:', errorMessage);
    return NextResponse.json(
      { error: 'Erro interno ao calcular taxa de vácuo ativo' },
      { status: 500 }
    );
  }
}
