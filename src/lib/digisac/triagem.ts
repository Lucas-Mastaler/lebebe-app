import { createServiceClient } from '@/lib/supabase/service';
import { transferirContatoParaDepartamento } from './transferencia';

type LojaTriagem = 'bigorrilho' | 'hauer' | 'portao';

export type RespostaTriagem =
  | { ok: true; ignored: true; reason: string }
  | { ok: true; routed: true; loja: string }
  | { ok: false; error: string };

const MAPA_LOJAS: Record<LojaTriagem, string[]> = {
  bigorrilho: ['1', 'bigorrilho', 'bigo', 'loja bigorrilho'],
  hauer: ['2', 'hauer', 'loja hauer'],
  portao: ['3', 'portao', 'loja portao'],
};

export function normalizarTextoDigisac(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function detectarLojaPorResposta(textoNormalizado: string): LojaTriagem | null {
  for (const [loja, variantes] of Object.entries(MAPA_LOJAS) as [LojaTriagem, string[]][]) {
    if (variantes.includes(textoNormalizado)) {
      return loja;
    }
  }
  return null;
}

export function obterDepartamentoDestino(loja: LojaTriagem): string {
  const mapa: Record<LojaTriagem, string | undefined> = {
    bigorrilho: process.env.DIGISAC_DEPARTAMENTO_BIGORRILHO,
    hauer: process.env.DIGISAC_DEPARTAMENTO_HAUER,
    portao: process.env.DIGISAC_DEPARTAMENTO_PORTAO,
  };

  const departmentId = mapa[loja];
  if (!departmentId) {
    throw new Error(`Env var de departamento para loja "${loja}" não configurada`);
  }
  return departmentId;
}

export async function processarTriagemLojaDigisac(rawPayload: unknown): Promise<RespostaTriagem> {
  try {
    const payload = rawPayload as Record<string, unknown>;
    const evento = payload.event as string | undefined;
    const msg = payload.data as Record<string, unknown> | undefined;

    if (evento !== 'message.created') {
      return { ok: true, ignored: true, reason: 'evento_invalido' };
    }
    if (!msg) {
      return { ok: true, ignored: true, reason: 'payload_sem_data' };
    }

    const messageId = msg.id as string | undefined;
    const contactId = msg.contactId as string | undefined;
    const serviceId = msg.serviceId as string | undefined;

    console.log(`[DIGISAC-TRIAGEM] mensagem recebida messageId=${messageId} contactId=${contactId} serviceId=${serviceId}`);

    if (serviceId !== process.env.DIGISAC_SERVICE_ID_VENDAS) {
      console.log('[DIGISAC-TRIAGEM] ignorado: conexão diferente');
      return { ok: true, ignored: true, reason: 'conexao_diferente' };
    }
    if (msg.isFromMe === true) {
      console.log('[DIGISAC-TRIAGEM] ignorado: mensagem enviada por nós');
      return { ok: true, ignored: true, reason: 'mensagem_nossa' };
    }
    if (msg.isFromBot === true) {
      console.log('[DIGISAC-TRIAGEM] ignorado: mensagem bot');
      return { ok: true, ignored: true, reason: 'mensagem_bot' };
    }
    if (msg.isComment === true) {
      console.log('[DIGISAC-TRIAGEM] ignorado: comentário interno');
      return { ok: true, ignored: true, reason: 'comentario_interno' };
    }
    if (msg.type !== 'chat') {
      console.log('[DIGISAC-TRIAGEM] ignorado: tipo não chat');
      return { ok: true, ignored: true, reason: 'tipo_nao_chat' };
    }

    const text = msg.text as string | undefined;
    if (!text?.trim()) {
      console.log('[DIGISAC-TRIAGEM] ignorado: texto vazio');
      return { ok: true, ignored: true, reason: 'texto_vazio' };
    }

    const ticketObj = msg.ticket as Record<string, unknown> | undefined;
    if (ticketObj?.isOpen === false) {
      console.log('[DIGISAC-TRIAGEM] ignorado: ticket fechado');
      return { ok: true, ignored: true, reason: 'ticket_fechado' };
    }

    const departamentoAtual =
      (ticketObj?.departmentId as string | undefined) ??
      (msg.ticketDepartmentId as string | undefined) ??
      null;

    if (departamentoAtual && departamentoAtual !== process.env.DIGISAC_DEPARTAMENTO_INICIAL_VENDAS) {
      console.log(`[DIGISAC-TRIAGEM] ignorado: departamento não inicial vendas departamento=${departamentoAtual}`);
      return { ok: true, ignored: true, reason: 'departamento_nao_inicial_vendas' };
    }

    const textoNormalizado = normalizarTextoDigisac(text);
    const loja = detectarLojaPorResposta(textoNormalizado);

    if (!loja) {
      console.log(`[DIGISAC-TRIAGEM] ignorado: texto não é escolha clara texto="${textoNormalizado}"`);
      return { ok: true, ignored: true, reason: 'texto_nao_eh_loja' };
    }

    console.log(`[DIGISAC-TRIAGEM] candidato: loja detectada=${loja}`);

    if (!messageId || !contactId) {
      console.error('[DIGISAC-TRIAGEM] erro: messageId ou contactId ausente no payload');
      return { ok: false, error: 'campos_obrigatorios_ausentes' };
    }

    const supabase = createServiceClient();

    console.log(`[DIGISAC-TRIAGEM] consultando idempotência no Supabase messageId=${messageId}`);

    const { data: existente } = await supabase
      .from('digisac_triagem_loja')
      .select('id, status')
      .eq('digisac_message_id', messageId)
      .maybeSingle();

    if (existente) {
      console.log(`[DIGISAC-TRIAGEM] ignorado: já processado messageId=${messageId} status=${existente.status}`);
      return { ok: true, ignored: true, reason: 'ignorado_ja_processado' };
    }

    const departmentId = obterDepartamentoDestino(loja);
    const ticketId = (msg.ticketId as string | undefined) ?? null;

    console.log(`[DIGISAC-TRIAGEM] transferindo contato contactId=${contactId} departamento=${departmentId} loja=${loja}`);

    let statusFinal: string;
    let erroMsg: string | null = null;

    try {
      await transferirContatoParaDepartamento({ contactId, departmentId });
      statusFinal = 'roteado';
      console.log(`[DIGISAC-TRIAGEM] transferência concluída contactId=${contactId}`);
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : String(err);
      statusFinal = 'erro_transferencia';
      erroMsg = errMessage;
      console.error(`[DIGISAC-TRIAGEM] erro na transferência contactId=${contactId} erro=${errMessage}`);
    }

    await supabase.from('digisac_triagem_loja').insert({
      digisac_message_id: messageId,
      digisac_contact_id: contactId,
      digisac_ticket_id: ticketId,
      digisac_service_id: serviceId,
      texto_normalizado: textoNormalizado,
      loja_detectada: loja,
      departamento_destino: departmentId,
      status: statusFinal,
      erro: erroMsg,
    });

    if (statusFinal === 'roteado') {
      return { ok: true, routed: true, loja };
    }

    return { ok: false, error: erroMsg ?? 'erro_transferencia' };
  } catch (err: unknown) {
    const errMessage = err instanceof Error ? err.message : String(err);
    console.error(`[DIGISAC-TRIAGEM] erro inesperado erro=${errMessage}`);
    return { ok: false, error: 'erro_interno' };
  }
}
