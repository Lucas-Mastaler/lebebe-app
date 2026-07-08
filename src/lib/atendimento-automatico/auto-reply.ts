import { enviarMensagemDigisac } from '@/lib/digisac/enviar-mensagem';
import type { RespostaSugerida, TipoRespostaSugerida } from './respostas';

export function respostaAutomaticaHabilitada(): boolean {
  return process.env.ATENDIMENTO_POSVENDA_AUTO_REPLY_ENABLED === 'true';
}

export function chaveRespostaAutomatica(
  sessaoId: string,
  estado: string,
  tipoResposta: TipoRespostaSugerida,
  digisacMessageId?: string | null
): string {
  return `${sessaoId}:${estado}:${tipoResposta}:${digisacMessageId ?? 'sem-msg-id'}`;
}

export function respostaAutomaticaJaEnviada(
  metadata: Record<string, unknown> | null,
  chave: string
): boolean {
  if (!metadata) return false;
  const ultimaChave = metadata.ultima_resposta_automatica_chave as string | undefined;
  return ultimaChave === chave;
}

export type ResultadoAutoReply =
  | {
      enviado: true;
      digisac_message_id?: string;
      erro?: undefined;
    }
  | {
      enviado: false;
      digisac_message_id?: undefined;
      erro?: string;
    };

export async function processarEnvioAutomatico(params: {
  sessaoId: string;
  estado: string;
  resposta: RespostaSugerida;
  digisacMessageId?: string | null;
  contactId: string | null;
  ticketId: string | null;
  metadataAtual: Record<string, unknown> | null;
  telefoneAutorizado: boolean;
}): Promise<ResultadoAutoReply> {
  if (!params.telefoneAutorizado) {
    return { enviado: false, erro: 'telefone_nao_autorizado' };
  }

  if (!respostaAutomaticaHabilitada()) {
    return { enviado: false };
  }

  if (!params.contactId || !params.ticketId) {
    return { enviado: false, erro: 'contact_id_ou_ticket_id_ausente' };
  }

  const chave = chaveRespostaAutomatica(
    params.sessaoId,
    params.estado,
    params.resposta.tipo,
    params.digisacMessageId
  );

  if (respostaAutomaticaJaEnviada(params.metadataAtual, chave)) {
    return { enviado: false, erro: 'ja_enviada' };
  }

  const resultado = await enviarMensagemDigisac({
    contactId: params.contactId,
    ticketId: params.ticketId,
    texto: params.resposta.texto,
  });

  if (!resultado.ok) {
    return { enviado: false, erro: resultado.erro };
  }

  return { enviado: true, digisac_message_id: resultado.digisac_message_id };
}
