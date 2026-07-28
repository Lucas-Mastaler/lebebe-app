import { NextRequest, NextResponse } from 'next/server';
import { processarTriagemLojaDigisac } from '@/lib/digisac/triagem';
import { processarWebhookHubVendas } from '@/lib/digisac/hub-vendas/processar-webhook';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const secret = process.env.DIGISAC_WEBHOOK_SECRET;
    if (secret) {
      const headerSecret =
        request.headers.get('x-digisac-secret') ??
        request.nextUrl.searchParams.get('secret');

      if (headerSecret !== secret) {
        return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
      }
    }

    const rawPayload: unknown = await request.json();
    const [resultadoTriagem, resultadoHubVendas] = await Promise.allSettled([
      processarTriagemLojaDigisac(rawPayload),
      secret || process.env.NODE_ENV !== 'production'
        ? processarWebhookHubVendas(rawPayload)
        : Promise.resolve({ ok: true, ignored: true, reason: 'secret_nao_configurado' } as const),
    ]);

    if (resultadoHubVendas.status === 'rejected') {
      const message = resultadoHubVendas.reason instanceof Error
        ? resultadoHubVendas.reason.message
        : String(resultadoHubVendas.reason);
      console.error(`[HUB VENDAS] handler interno falhou erro=${message}`);
    } else if (!resultadoHubVendas.value.ok) {
      console.error(`[HUB VENDAS] handler interno retornou erro=${resultadoHubVendas.value.error}`);
    }

    if (resultadoTriagem.status === 'fulfilled') {
      return NextResponse.json(resultadoTriagem.value, { status: 200 });
    }

    const message = resultadoTriagem.reason instanceof Error
      ? resultadoTriagem.reason.message
      : String(resultadoTriagem.reason);
    console.error(`[DIGISAC-TRIAGEM] handler interno falhou erro=${message}`);
    return NextResponse.json({ ok: false, error: 'erro_interno' }, { status: 200 });
  } catch {
    return NextResponse.json({ ok: false, error: 'erro_interno' }, { status: 200 });
  }
}
