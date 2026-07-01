import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth/api-auth';
import { listarServicosDigisac } from '@/lib/digisac/estatisticas';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const auth = await requireAuthenticatedUser({
      requireAllowedUser: true,
      requireActive: true,
    });
    if (!auth.ok) return auth.response;

    const servicos = await listarServicosDigisac();

    console.log('[API][DASHBOARD][SERVICOS] servicosRetornados=', servicos.length);

    return NextResponse.json({ servicos });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[API][DASHBOARD][SERVICOS] Erro:', errorMessage);
    return NextResponse.json(
      { error: 'Erro interno ao buscar serviços Digisac' },
      { status: 500 }
    );
  }
}
