import { NextRequest, NextResponse } from 'next/server';
import { processarWebhookPosVenda } from '@/lib/atendimento-automatico/webhook-processor';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const secret =
      process.env.DIGISAC_POSVENDA_WEBHOOK_SECRET ??
      process.env.DIGISAC_WEBHOOK_SECRET;

    if (secret) {
      const headerSecret =
        request.headers.get('x-digisac-secret') ??
        request.nextUrl.searchParams.get('secret');

      if (headerSecret !== secret) {
        return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
      }
    }

    const rawPayload: unknown = await request.json();
    const resultado = await processarWebhookPosVenda(rawPayload);

    return NextResponse.json(resultado, { status: 200 });
  } catch {
    return NextResponse.json({ ok: false, error: 'erro_interno' }, { status: 200 });
  }
}
