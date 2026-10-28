import { NextRequest, NextResponse } from 'next/server';
import { processarTriagemLojaDigisac } from '@/lib/digisac/triagem';
import { HUB_VENDAS_SERVICE_ID } from '@/lib/digisac/hub-vendas/constants';
import { processarWebhookHubVendas } from '@/lib/digisac/hub-vendas/processar-webhook';

export const runtime = 'nodejs';

type WebhookPayloadRecord = Record<string, unknown>

let secretAusenteAvisado = false

function asRecord(value: unknown): WebhookPayloadRecord | null {
  return value && typeof value === 'object' ? (value as WebhookPayloadRecord) : null
}

function extrairResumoSeguro(rawPayload: unknown) {
  const payload = asRecord(rawPayload)
  const data = asRecord(payload?.data)
  const interactive = asRecord(data?.interactive)
  const nestedData = asRecord(data?.data)
  const nestedInteractive = asRecord(nestedData?.interactive)

  return {
    event: typeof payload?.event === 'string' ? payload.event : null,
    messageId: typeof data?.id === 'string' ? data.id : null,
    serviceId: typeof data?.serviceId === 'string' ? data.serviceId : null,
    type: typeof data?.type === 'string' ? data.type : null,
    isFromMe: data?.isFromMe === true,
    isFromBot: data?.isFromBot === true,
    isComment: data?.isComment === true,
    temTexto: typeof data?.text === 'string' && Boolean(data.text.trim()),
    temInterativo: Boolean(interactive ?? nestedInteractive),
  }
}

function eventoElegivelParaTriagemLegada(rawPayload: unknown): boolean {
  const resumo = extrairResumoSeguro(rawPayload)
  const serviceIdTriagem = process.env.DIGISAC_SERVICE_ID_VENDAS || HUB_VENDAS_SERVICE_ID

  return (
    resumo.event === 'message.created' &&
    resumo.serviceId === serviceIdTriagem &&
    resumo.isFromMe === false &&
    resumo.isFromBot === false &&
    resumo.isComment === false
  )
}

function descreverErro(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason)
}

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
    console.log(`[DIGISAC-WEBHOOK] Evento recebido ${JSON.stringify(extrairResumoSeguro(rawPayload))}`);

    if (!secret && !secretAusenteAvisado) {
      secretAusenteAvisado = true
      console.warn('[DIGISAC-WEBHOOK] DIGISAC_WEBHOOK_SECRET nao configurado');
    }

    const triagemAtiva = process.env.DIGISAC_TRIAGEM_LOJA_ATIVA === 'true';
    if (!triagemAtiva && eventoElegivelParaTriagemLegada(rawPayload)) {
      console.log('[DIGISAC-WEBHOOK] Triagem legada desativada por DIGISAC_TRIAGEM_LOJA_ATIVA');
    }

    const [resultadoHubVendas, resultadoTriagem] = await Promise.allSettled([
      processarWebhookHubVendas(rawPayload),
      triagemAtiva
        ? processarTriagemLojaDigisac(rawPayload)
        : Promise.resolve({ ok: true, ignored: true, reason: 'triagem_desativada' } as const),
    ]);

    if (resultadoHubVendas.status === 'rejected') {
      console.error(`[DIGISAC-WEBHOOK] Falha no Hub/Vendas erro=${descreverErro(resultadoHubVendas.reason)}`);
    } else if (!resultadoHubVendas.value.ok) {
      console.error(`[DIGISAC-WEBHOOK] Falha no Hub/Vendas erro=${resultadoHubVendas.value.error}`);
    }

    if (resultadoTriagem.status === 'rejected') {
      console.error(`[DIGISAC-WEBHOOK] Falha na triagem erro=${descreverErro(resultadoTriagem.reason)}`);
    } else if (!resultadoTriagem.value.ok) {
      console.error(`[DIGISAC-WEBHOOK] Falha na triagem erro=${resultadoTriagem.value.error}`);
    }

    if (triagemAtiva && resultadoTriagem.status === 'fulfilled') {
      return NextResponse.json(resultadoTriagem.value, { status: 200 });
    }

    if (resultadoHubVendas.status === 'fulfilled') {
      return NextResponse.json(resultadoHubVendas.value, { status: 200 });
    }

    return NextResponse.json({ ok: false, error: 'erro_interno' }, { status: 200 });
  } catch {
    return NextResponse.json({ ok: false, error: 'erro_interno' }, { status: 200 });
  }
}
