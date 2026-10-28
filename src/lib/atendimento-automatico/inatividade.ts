import { createServiceClient } from '@/lib/supabase/service';
import { fetchDigisac } from '@/lib/digisac/clienteDigisac';
import { atendimentoAutomaticoEncerrado, transferirAtendimentoPosVenda } from '@/lib/digisac/transferencia-pos-venda';
import { consultarControleChamado, estadoAguardaCliente } from './controle-chamado';
import { DEPARTAMENTO_POS_VENDA_ID, DEPARTAMENTO_POS_VENDA_AUTO_ATENDIMENTO_ID } from '@/lib/digisac/departamentosFixos';
import type { DigisacMensagem } from '@/lib/digisac/sgi-sync';

export const INATIVIDADE_CLIENTE_MS = 60 * 60 * 1000;

type Sessao = {
  id: string; status: string; estado: string; updated_at: string;
  digisac_contact_id: string; digisac_ticket_id: string;
  ultima_mensagem_em: string | null;
  metadata: Record<string, unknown> | null;
};

export function sessaoAguardandoClienteExpirada(sessao: Sessao, agora: number): boolean {
  const meta = sessao.metadata;
  const desde = Date.parse(String(meta?.aguardando_cliente_desde ?? ''));
  const clienteEm = sessao.ultima_mensagem_em ? Date.parse(sessao.ultima_mensagem_em) : NaN;
  return sessao.status === 'ativa'
    && estadoAguardaCliente(sessao.estado)
    && !atendimentoAutomaticoEncerrado(sessao)
    && meta?.resposta_automatica_enviada === true
    && typeof meta?.controle_automacao_user_id === 'string'
    && typeof meta?.aguardando_cliente_message_id === 'string'
    && Number.isFinite(desde) && agora - desde > INATIVIDADE_CLIENTE_MS
    && (!Number.isFinite(clienteEm) || clienteEm < desde);
}

function timestamp(m: DigisacMensagem): number {
  if (typeof m.timestamp === 'number') return m.timestamp < 1e12 ? m.timestamp * 1000 : m.timestamp;
  return Date.parse(m.timestamp ?? '');
}

/** Lê todas as páginas do ticket; histórico incompleto nunca autoriza transferência. */
export async function ultimaMensagemAindaAguardaCliente(ticketId: string, messageId: string): Promise<boolean | null> {
  const mensagens: DigisacMensagem[] = [];
  for (let page = 1; page <= 10; page++) {
    const params = new URLSearchParams({ 'where[ticketId]': ticketId, perPage: '100', page: String(page) });
    const resp = await fetchDigisac(`/messages?${params}`) as {
      data?: DigisacMensagem[]; total?: number; lastPage?: number;
    };
    if (!Array.isArray(resp.data) || resp.data.some(m => m.ticketId !== ticketId)) return null;
    mensagens.push(...resp.data);
    if (resp.data.length < 100 || (resp.lastPage != null && page >= resp.lastPage)) {
      if (resp.total != null && mensagens.length < resp.total) return null;
      // Mídia do cliente também interrompe a espera; ignora apenas eventos de sistema.
      const relevantes = mensagens.filter(m => m.visible !== false && !m.isComment && !m.deletedAt
        && !['ticket', 'contact', 'notification', 'bot'].includes(m.type ?? ''));
      if (!relevantes.length || relevantes.some(m => !Number.isFinite(timestamp(m)))) return null;
      relevantes.sort((a, b) => timestamp(b) - timestamp(a));
      const ultima = relevantes[0];
      // Timestamp empatado com outra mensagem: sem prova de qual veio depois.
      if (relevantes.some(m => m.id !== ultima.id && timestamp(m) === timestamp(ultima))) return null;
      return ultima.id === messageId && ultima.type === 'chat' && ultima.isFromMe === true;
    }
  }
  return null;
}

export async function devolverSessoesInativas(params: { simulacao?: boolean } = {}) {
  const supabase = createServiceClient();
  const contadores = { examinadas: 0, elegiveis: 0, devolvidas: 0, ignoradas: 0, erros: 0 };
  if (process.env.ATENDIMENTO_POSVENDA_AUTO_REPLY_ENABLED !== 'true') return contadores;
  const userId = process.env.DIGISAC_BOT_USER_ID;
  if (!userId) throw new Error('DIGISAC_BOT_USER_ID_nao_configurado');
  const limite = new Date(Date.now() - INATIVIDADE_CLIENTE_MS).toISOString();
  const { data, error } = await supabase.from('atendimento_automatico_sessoes')
    .select('id,status,estado,updated_at,digisac_contact_id,digisac_ticket_id,ultima_mensagem_em,metadata')
    .eq('metadata->>controle_automacao_user_id', userId)
    .in('status', ['ativa', 'transferido_humano'])
    .or(`and(status.eq.ativa,metadata->>aguardando_cliente_desde.lt.${limite}),metadata->>devolucao_pos_venda_pendente.eq.true`)
    .order('updated_at', { ascending: true }).limit(20);
  if (error) throw new Error(`inatividade_selecao_${error.code}`);

  const inicio = Date.now();
  async function cancelarEspera(sessao: Sessao) {
    if (params.simulacao) return;
    const { error: erroCancelamento } = await supabase.from('atendimento_automatico_sessoes')
      .update({ metadata: { ...sessao.metadata, aguardando_cliente_desde: null,
        devolucao_pos_venda_pendente: false }, updated_at: new Date().toISOString() })
      .eq('id', sessao.id).eq('updated_at', sessao.updated_at);
    if (erroCancelamento) throw new Error(`inatividade_cancelamento_${erroCancelamento.code}`);
  }
  for (const candidata of (data ?? []) as Sessao[]) {
    // Deixa margem para uma transferência (até três requests de 30s).
    if (Date.now() - inicio > 20_000) break;
    contadores.examinadas++;
    try {
      const { data: atual, error: erroLeitura } = await supabase.from('atendimento_automatico_sessoes')
        .select('*').eq('id', candidata.id).single();
      if (erroLeitura || !atual) throw new Error('sessao_nao_revalidada');
      const sessao = atual as Sessao;
      const pendente = sessao.metadata?.devolucao_pos_venda_pendente === true;
      if (!pendente && !sessaoAguardandoClienteExpirada(sessao, Date.now())) {
        await cancelarEspera(sessao);
        contadores.ignoradas++; continue;
      }
      const ticket = await consultarControleChamado(sessao.digisac_ticket_id, sessao.digisac_contact_id);
      if (!ticket) throw new Error('ticket_nao_confirmado');
      if (ticket.isOpen !== true || ticket.endedAt
        || (ticket.departmentId !== DEPARTAMENTO_POS_VENDA_AUTO_ATENDIMENTO_ID
          && !(pendente && ticket.departmentId === DEPARTAMENTO_POS_VENDA_ID))
        || (ticket.userId !== userId && !(pendente && ticket.userId === null))) {
        await cancelarEspera(sessao);
        contadores.ignoradas++; continue;
      }
      if (!pendente) {
        const aguardando = await ultimaMensagemAindaAguardaCliente(sessao.digisac_ticket_id,
          String(sessao.metadata?.aguardando_cliente_message_id));
        if (aguardando === null) throw new Error('historico_nao_confirmado');
        if (!aguardando) { await cancelarEspera(sessao); contadores.ignoradas++; continue; }
      }
      contadores.elegiveis++;
      if (params.simulacao) continue;

      const metadata = { ...sessao.metadata,
        motivo_transferencia_humano: pendente ? sessao.metadata?.motivo_transferencia_humano : 'inatividade_cliente',
        atendimento_automatico_encerrado: true,
        devolucao_pos_venda_pendente: true };
      // Reserva otimista: outra execução, resposta do cliente ou pausa humana invalida o snapshot.
      const { data: reservada, error: erroReserva } = await supabase.from('atendimento_automatico_sessoes')
        .update({ estado: 'transferido_humano', status: 'transferido_humano', metadata,
          updated_at: new Date().toISOString() })
        .eq('id', sessao.id).eq('updated_at', sessao.updated_at).eq('status', sessao.status)
        .select('id').maybeSingle();
      if (erroReserva) throw new Error(`inatividade_reserva_${erroReserva.code}`);
      if (!reservada) { contadores.ignoradas++; continue; }

      const transferencia = await transferirAtendimentoPosVenda({
        supabase, sessaoId: sessao.id, ticketId: sessao.digisac_ticket_id, contactId: sessao.digisac_contact_id,
        expectedUserId: userId,
      });
      const { error: erroFim } = await supabase.from('atendimento_automatico_sessoes')
        .update({ metadata: { ...metadata, transferencia_pos_venda: transferencia,
          devolucao_pos_venda_pendente: transferencia.status !== 'aceita' }, updated_at: new Date().toISOString() })
        .eq('id', sessao.id).eq('estado', 'transferido_humano');
      if (erroFim) throw new Error(`inatividade_resultado_${erroFim.code}`);
      if (transferencia.status === 'aceita') contadores.devolvidas++;
      else contadores.erros++;
      console.log(`[posvenda-inatividade] sessaoId=${sessao.id} status=${transferencia.status}`);
    } catch (erro) {
      contadores.erros++;
      console.error(`[posvenda-inatividade] sessaoId=${candidata.id} erro=${erro instanceof Error ? erro.message : 'desconhecido'}`);
    }
  }
  return contadores;
}
