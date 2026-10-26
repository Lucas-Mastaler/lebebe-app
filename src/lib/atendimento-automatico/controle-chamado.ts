import { fetchDigisac, fetchDigisacRaw } from '@/lib/digisac/clienteDigisac';
import { lerTicketDigisac } from '@/lib/digisac/transferencia-pos-venda';
import { DEPARTAMENTO_POS_VENDA_ID } from '@/lib/digisac/departamentosFixos';

export type ControleChamado =
  | { ok: true; ticketId: string; userId: string }
  | { ok: false; motivo: string };

const ESTADOS_AGUARDANDO_CLIENTE = new Set([
  'aguardando_documento', 'pedido_nao_localizado', 'aguardando_confirmacao_pedido',
  'aguardando_escolha_grupo', 'aguardando_novo_documento_ou_esclarecimento',
  'aguardando_acao_apos_confirmacao', 'aguardando_escolha_acao',
  'aguardando_confirmacao_endereco', 'aguardando_data_desejada', 'datas_encontradas',
  'aguardando_confirmacao_reagendamento',
]);

export function estadoAguardaCliente(estado: string): boolean {
  return ESTADOS_AGUARDANDO_CLIENTE.has(estado);
}

export async function consultarControleChamado(ticketId: string, contactId: string) {
  const ticket = lerTicketDigisac(await fetchDigisac(`/tickets/${encodeURIComponent(ticketId)}`));
  if (!ticket || ticket.id !== ticketId || ticket.contactId !== contactId) return null;
  return ticket;
}

/** Nunca toma de um humano nem atribui ticket fechado ou de outro departamento. */
export async function assumirChamadoAutomacao(ticketId: string, contactId: string): Promise<ControleChamado> {
  const userId = process.env.DIGISAC_BOT_USER_ID;
  if (!userId) return { ok: false, motivo: 'usuario_automacao_ausente' };
  try {
    const antes = await consultarControleChamado(ticketId, contactId);
    if (!antes || antes.isOpen !== true || antes.endedAt) return { ok: false, motivo: 'ticket_indisponivel' };
    if (antes.departmentId !== DEPARTAMENTO_POS_VENDA_ID) return { ok: false, motivo: 'outro_departamento' };
    if (antes.userId === userId) return { ok: true, ticketId, userId };
    if (antes.userId) return { ok: false, motivo: 'atribuido_humano' };

    const response = await fetchDigisacRaw(`/contacts/${encodeURIComponent(contactId)}/ticket/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ departmentId: DEPARTAMENTO_POS_VENDA_ID, userId, byUserId: userId, comments: '' }),
    });
    if (!response.ok) return { ok: false, motivo: `atribuicao_http_${response.status}` };
    // A transferência pode criar outro ticket; somente aceita o ID retornado e confirmado.
    const raw = await response.text();
    let novoId = ticketId;
    try {
      const body = JSON.parse(raw || '{}');
      novoId = body.ticketId ?? body.ticket?.id ?? ticketId;
    } catch { /* Resposta sem JSON: confirma o ticket original por GET. */ }
    const depois = await consultarControleChamado(novoId, contactId);
    if (!depois || depois.isOpen !== true || depois.endedAt
      || depois.departmentId !== DEPARTAMENTO_POS_VENDA_ID || depois.userId !== userId) {
      return { ok: false, motivo: 'atribuicao_nao_confirmada' };
    }
    console.log(`[posvenda-controle] atribuido ticketId=${novoId}`);
    return { ok: true, ticketId: novoId, userId };
  } catch (erro) {
    console.error(`[posvenda-controle] falha ticketId=${ticketId} causa=${erro instanceof Error ? erro.name : 'desconhecida'}`);
    return { ok: false, motivo: 'erro_atribuicao' };
  }
}
