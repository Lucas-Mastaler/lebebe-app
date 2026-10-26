import { randomUUID } from 'node:crypto';
import { fetchDigisac, fetchDigisacRaw } from '@/lib/digisac/clienteDigisac';
import { DEPARTAMENTO_POS_VENDA_ID } from '@/lib/digisac/departamentosFixos';
import { createServiceClient } from '@/lib/supabase/service';

const TIPO_RESERVA = 'transferencia_pos_venda';
// Cobre consulta, POST e nova consulta, cada uma com timeout de 30s.
const RESERVA_VALIDA_MS = 120_000;
const ESTADOS_FIM = new Set([
  'transferido_humano',
  'pedido_confirmado',
  'reagendamento_confirmado',
  'reagendamento_cancelado',
]);

type StatusTransferencia = 'aceita' | 'erro' | 'incerta' | 'em_andamento';

export type ResultadoTransferenciaPosVenda = {
  status: StatusTransferencia;
  motivo: string | null;
  departmentId: string;
  ticketId: string | null;
  httpStatus: number | null;
  em: string;
};

type TicketLido = {
  id: string;
  isOpen: boolean | null;
  endedAt: string | null;
  contactId: string | null;
  departmentId: string | null;
  userId: string | null;
};

type MetaReserva = {
  status?: StatusTransferencia;
  token?: string;
  ticketId?: string | null;
  em?: string;
};

type ClienteBanco = ReturnType<typeof createServiceClient>;

type LinhaReserva = {
  id: string;
  metadata: MetaReserva | null;
  created_at: string;
};

export function estadoEncerraAtendimentoAutomatico(estado: string | null | undefined): boolean {
  return !!estado && ESTADOS_FIM.has(estado);
}

export function atendimentoAutomaticoEncerrado(params: {
  estado: string | null | undefined;
  metadata: Record<string, unknown> | null | undefined;
}): boolean {
  if (params.metadata?.atendimento_automatico_encerrado === true) return true;
  if (estadoEncerraAtendimentoAutomatico(params.estado)) return true;
  const bloco = params.metadata?.transferencia_pos_venda;
  if (!bloco || typeof bloco !== 'object') return false;
  return (bloco as { status?: unknown }).status === 'aceita';
}

function resultado(parcial: {
  status: StatusTransferencia;
  motivo?: string | null;
  ticketId?: string | null;
  httpStatus?: number | null;
}): ResultadoTransferenciaPosVenda {
  return {
    status: parcial.status,
    motivo: parcial.motivo ?? null,
    departmentId: DEPARTAMENTO_POS_VENDA_ID,
    ticketId: parcial.ticketId ?? null,
    httpStatus: parcial.httpStatus ?? null,
    em: new Date().toISOString(),
  };
}

function texto(valor: unknown): string | null {
  return typeof valor === 'string' && valor.trim() ? valor : null;
}

function objeto(valor: unknown): Record<string, unknown> | null {
  return valor && typeof valor === 'object' ? valor as Record<string, unknown> : null;
}

function erroSeguro(erro: unknown): string {
  return erro instanceof Error ? erro.message : 'erro_desconhecido';
}

function ehConflitoUnico(erro: { code?: string; message?: string } | null): boolean {
  if (!erro) return false;
  return erro.code === '23505' || /duplicate key/i.test(erro.message ?? '');
}

function incerto(status: number | null, erro: unknown): boolean {
  if (status !== null && (status >= 500 || status === 408)) return true;
  if (!(erro instanceof Error)) return false;
  return erro.name === 'AbortError' || /timeout/i.test(erro.message);
}

/**
 * Lê o ticket no formato já usado por GET /tickets/{id} neste repositório:
 * campos planos (Hub Vendas) ou objetos aninhados department/user/contact (sincronização SGI).
 */
export function lerTicketDigisac(raw: unknown): TicketLido | null {
  const ticket = objeto(raw);
  if (!ticket) return null;
  const id = texto(ticket.id);
  if (!id) return null;
  const department = objeto(ticket.department);
  const user = objeto(ticket.user);
  const contact = objeto(ticket.contact);
  return {
    id,
    isOpen: typeof ticket.isOpen === 'boolean' ? ticket.isOpen : null,
    endedAt: texto(ticket.endedAt),
    contactId: texto(ticket.contactId) ?? texto(contact?.id),
    departmentId: texto(ticket.departmentId) ?? texto(department?.id),
    userId: ticket.userId === null ? null : (texto(ticket.userId) ?? texto(user?.id)),
  };
}

function ticketTransferido(ticket: TicketLido, contactId: string): boolean {
  return ticket.isOpen === true
    && !ticket.endedAt
    && ticket.contactId === contactId
    && ticket.departmentId === DEPARTAMENTO_POS_VENDA_ID
    && !ticket.userId;
}

async function consultarTicket(ticketId: string): Promise<TicketLido | null> {
  try {
    const raw = await fetchDigisac(`/tickets/${encodeURIComponent(ticketId)}`);
    return lerTicketDigisac(raw);
  } catch (erro) {
    console.warn(`[posvenda-transferencia] consulta do ticket falhou ticketId=${ticketId} erro=${erroSeguro(erro)}`);
    return null;
  }
}

function extrairTicketIdResposta(bodyText: string): string | null {
  try {
    const json = JSON.parse(bodyText || '{}') as Record<string, unknown>;
    const ticket = objeto(json.ticket);
    return texto(json.ticketId) ?? texto(ticket?.id);
  } catch {
    return null;
  }
}

async function concluirReserva(
  supabase: ClienteBanco,
  reservaId: string,
  token: string,
  final: ResultadoTransferenciaPosVenda,
): Promise<void> {
  const { error } = await supabase
    .from('atendimento_automatico_eventos')
    .update({
      descricao: `Transferencia pos-venda ${final.status}`,
      metadata: {
        status: final.status,
        token,
        motivo: final.motivo,
        ticketId: final.ticketId,
        httpStatus: final.httpStatus,
        departmentId: DEPARTAMENTO_POS_VENDA_ID,
        em: final.em,
      },
    })
    .eq('id', reservaId)
    .eq('metadata->>token', token);
  if (error) {
    console.error(`[posvenda-transferencia] nao atualizou a reserva reservaId=${reservaId} codigo=${error.code ?? 'sem_codigo'}`);
  }
}

async function vincularTicketConfirmado(
  supabase: ClienteBanco,
  sessaoId: string,
  ticketOriginal: string,
  ticketConfirmado: string,
): Promise<string | null> {
  if (ticketConfirmado === ticketOriginal) return null;
  const { data, error } = await supabase
    .from('atendimento_automatico_sessoes')
    .update({
      digisac_ticket_id: ticketConfirmado,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessaoId)
    .eq('digisac_ticket_id', ticketOriginal)
    .select('id');
  if (error || !Array.isArray(data) || data.length === 0) {
    console.error(`[posvenda-transferencia] ticket confirmado nao vinculado sessaoId=${sessaoId} codigo=${error?.code ?? 'sem_linha'}`);
    return 'ticket_novo_nao_vinculado';
  }
  return null;
}

async function reservar(
  supabase: ClienteBanco,
  sessaoId: string,
): Promise<{ ok: true; id: string; token: string } | { ok: false; resultado: ResultadoTransferenciaPosVenda }> {
  const token = randomUUID();
  const inserido = await supabase
    .from('atendimento_automatico_eventos')
    .insert({
      sessao_id: sessaoId,
      tipo: TIPO_RESERVA,
      descricao: 'Reserva da transferencia para o departamento Pos-Venda',
      metadata: { status: 'em_andamento', token, em: new Date().toISOString() },
    })
    .select('id')
    .single();

  if (!inserido.error && inserido.data?.id) {
    return { ok: true, id: inserido.data.id, token };
  }

  if (!ehConflitoUnico(inserido.error)) {
    console.error(`[posvenda-transferencia] reserva falhou sessaoId=${sessaoId} codigo=${inserido.error?.code ?? 'sem_codigo'}`);
    return { ok: false, resultado: resultado({ status: 'erro', motivo: 'reserva_indisponivel' }) };
  }

  const existente = await supabase
    .from('atendimento_automatico_eventos')
    .select('id, metadata, created_at')
    .eq('sessao_id', sessaoId)
    .eq('tipo', TIPO_RESERVA)
    .maybeSingle();

  const linha = existente.data as LinhaReserva | null;
  if (existente.error || !linha?.id) {
    return { ok: false, resultado: resultado({ status: 'erro', motivo: 'reserva_indisponivel' }) };
  }

  const meta = (linha.metadata ?? {}) as MetaReserva;
  if (meta.status === 'aceita') {
    return {
      ok: false,
      resultado: resultado({ status: 'aceita', motivo: 'ja_transferida', ticketId: meta.ticketId ?? null }),
    };
  }

  const criadaEm = Date.parse(linha.created_at);
  const fresca = Number.isFinite(criadaEm) && Date.now() - criadaEm < RESERVA_VALIDA_MS;
  if (meta.status === 'em_andamento' && fresca) {
    return { ok: false, resultado: resultado({ status: 'em_andamento', motivo: 'reserva_em_andamento' }) };
  }

  if (!meta.token) {
    return { ok: false, resultado: resultado({ status: 'em_andamento', motivo: 'reserva_em_andamento' }) };
  }

  const novoToken = randomUUID();
  const retomada = await supabase
    .from('atendimento_automatico_eventos')
    .update({
      descricao: 'Reserva da transferencia para o departamento Pos-Venda',
      metadata: { status: 'em_andamento', token: novoToken, em: new Date().toISOString(), retomada: true },
    })
    .eq('id', linha.id)
    .eq('metadata->>token', meta.token)
    .select('id');

  const linhas = Array.isArray(retomada.data) ? retomada.data : [];
  if (retomada.error || linhas.length === 0) {
    return { ok: false, resultado: resultado({ status: 'em_andamento', motivo: 'reserva_em_andamento' }) };
  }
  return { ok: true, id: linha.id, token: novoToken };
}

async function executarTransferencia(params: {
  supabase: ClienteBanco;
  sessaoId: string;
  contactId: string;
  ticketId: string;
  reservaId: string;
  token: string;
  byUserId: string;
  expectedUserId?: string;
}): Promise<ResultadoTransferenciaPosVenda> {
  const antes = await consultarTicket(params.ticketId);
  if (params.expectedUserId && (!antes || antes.contactId !== params.contactId
    || antes.isOpen !== true || antes.endedAt
    || (antes.userId !== params.expectedUserId && !ticketTransferido(antes, params.contactId)))) {
    const final = resultado({ status: 'erro', motivo: 'controle_chamado_alterado', ticketId: params.ticketId });
    await concluirReserva(params.supabase, params.reservaId, params.token, final);
    return final;
  }
  if (antes && ticketTransferido(antes, params.contactId)) {
    const vinculo = await vincularTicketConfirmado(params.supabase, params.sessaoId, params.ticketId, antes.id);
    const final = resultado({
      status: 'aceita',
      motivo: vinculo ?? 'ja_no_departamento',
      ticketId: antes.id,
      httpStatus: null,
    });
    await concluirReserva(params.supabase, params.reservaId, params.token, final);
    return final;
  }

  let httpStatus: number | null = null;
  let ticketInformado: string | null = null;
  try {
    const response = await fetchDigisacRaw(`/contacts/${encodeURIComponent(params.contactId)}/ticket/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        departmentId: DEPARTAMENTO_POS_VENDA_ID,
        userId: null,
        comments: '',
        byUserId: params.byUserId,
      }),
    });
    httpStatus = response.status;
    const bodyText = await response.text().catch(() => '');
    if (!response.ok) {
      const final = resultado({
        status: incerto(httpStatus, null) ? 'incerta' : 'erro',
        motivo: incerto(httpStatus, null) ? 'resposta_incerta' : 'resposta_rejeitada',
        ticketId: params.ticketId,
        httpStatus,
      });
      await concluirReserva(params.supabase, params.reservaId, params.token, final);
      return final;
    }
    ticketInformado = extrairTicketIdResposta(bodyText);
  } catch (erro) {
    const final = resultado({
      status: incerto(null, erro) ? 'incerta' : 'erro',
      motivo: incerto(null, erro) ? 'timeout_ou_falha_de_rede' : 'falha_de_rede',
      ticketId: params.ticketId,
      httpStatus,
    });
    await concluirReserva(params.supabase, params.reservaId, params.token, final);
    return final;
  }

  const candidatos = [...new Set([params.ticketId, ticketInformado].filter((id): id is string => !!id))];
  for (const candidato of candidatos) {
    const ticket = await consultarTicket(candidato);
    if (!ticket || !ticketTransferido(ticket, params.contactId)) continue;
    const vinculo = await vincularTicketConfirmado(params.supabase, params.sessaoId, params.ticketId, ticket.id);
    const final = resultado({
      status: 'aceita',
      motivo: vinculo,
      ticketId: ticket.id,
      httpStatus,
    });
    await concluirReserva(params.supabase, params.reservaId, params.token, final);
    return final;
  }

  const final = resultado({
    status: 'incerta',
    motivo: 'transferencia_nao_confirmada',
    ticketId: ticketInformado ?? params.ticketId,
    httpStatus,
  });
  await concluirReserva(params.supabase, params.reservaId, params.token, final);
  return final;
}

export async function transferirAtendimentoPosVenda(params: {
  supabase?: ClienteBanco;
  sessaoId: string;
  contactId: string | null;
  ticketId: string | null;
  expectedUserId?: string;
}): Promise<ResultadoTransferenciaPosVenda> {
  const supabase = params.supabase ?? createServiceClient();
  try {
    if (!params.contactId || !params.ticketId) {
      console.log(`[posvenda-transferencia] sessaoId=${params.sessaoId} status=erro motivo=identificador_ausente`);
      return resultado({ status: 'erro', motivo: 'identificador_ausente', ticketId: params.ticketId });
    }

    const byUserId = process.env.DIGISAC_BOT_USER_ID;
    if (!byUserId) {
      console.error(`[posvenda-transferencia] sessaoId=${params.sessaoId} status=erro motivo=DIGISAC_BOT_USER_ID_nao_configurado`);
      return resultado({ status: 'erro', motivo: 'DIGISAC_BOT_USER_ID_nao_configurado', ticketId: params.ticketId });
    }

    const reserva = await reservar(supabase, params.sessaoId);
    if (!reserva.ok) {
      console.log(`[posvenda-transferencia] sessaoId=${params.sessaoId} status=${reserva.resultado.status} motivo=${reserva.resultado.motivo ?? '-'}`);
      return reserva.resultado;
    }

    const final = await executarTransferencia({
      supabase,
      sessaoId: params.sessaoId,
      contactId: params.contactId,
      ticketId: params.ticketId,
      reservaId: reserva.id,
      token: reserva.token,
      byUserId,
      expectedUserId: params.expectedUserId,
    });
    console.log(`[posvenda-transferencia] sessaoId=${params.sessaoId} status=${final.status} motivo=${final.motivo ?? '-'} http=${final.httpStatus ?? '-'} ticketId=${final.ticketId ?? '-'}`);
    return final;
  } catch (erro) {
    console.error(`[posvenda-transferencia] falha isolada sessaoId=${params.sessaoId} erro=${erroSeguro(erro)}`);
    return resultado({ status: 'erro', motivo: 'falha_isolada', ticketId: params.ticketId });
  }
}
