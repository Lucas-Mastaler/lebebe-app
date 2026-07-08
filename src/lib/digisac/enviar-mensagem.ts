import { fetchDigisacRaw } from './clienteDigisac';

export type ResultadoEnvioMensagem =
  | { ok: true; digisac_message_id?: string }
  | { ok: false; erro: string };

export async function enviarMensagemDigisac(params: {
  contactId: string;
  ticketId: string;
  texto: string;
}): Promise<ResultadoEnvioMensagem> {
  try {
    const response = await fetchDigisacRaw('/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: params.texto,
        type: 'chat',
        contactId: params.contactId,
        ticketId: params.ticketId,
        fromMe: true,
      }),
    });

    const bodyText = await response.text().catch(() => '');

    if (!response.ok) {
      return {
        ok: false,
        erro: `Erro ao enviar mensagem Digisac. Status=${response.status}. Body=${bodyText.substring(0, 200)}`,
      };
    }

    let digisacMessageId: string | undefined;
    try {
      const json = JSON.parse(bodyText) as Record<string, unknown>;
      const data = json?.data as Record<string, unknown> | undefined;
      digisacMessageId = (json?.id as string | undefined) ?? (data?.id as string | undefined);
    } catch {
      digisacMessageId = undefined;
    }

    return { ok: true, digisac_message_id: digisacMessageId };
  } catch (err: unknown) {
    const erro = err instanceof Error ? err.message : String(err);
    return { ok: false, erro };
  }
}
