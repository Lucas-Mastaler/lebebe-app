import { NextRequest, NextResponse } from 'next/server';
import { devolverSessoesInativas } from '@/lib/atendimento-automatico/inatividade';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ ok: false, error: 'cron_secret_nao_configurado' }, { status: 500 });
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  try {
    const simulacao = request.nextUrl.searchParams.get('simulacao') === 'true';
    const resultado = await devolverSessoesInativas({ simulacao });
    console.log(`[posvenda-inatividade] ${JSON.stringify({ simulacao, ...resultado })}`);
    return NextResponse.json({ ok: resultado.erros === 0, simulacao, ...resultado }, { status: resultado.erros ? 500 : 200 });
  } catch (erro) {
    console.error(`[posvenda-inatividade] falha=${erro instanceof Error ? erro.message : 'desconhecida'}`);
    return NextResponse.json({ ok: false, error: 'erro_processar_inatividade' }, { status: 500 });
  }
}
