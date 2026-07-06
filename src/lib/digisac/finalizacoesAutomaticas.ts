import { fetchDigisacRaw, fetchDigisac } from './clienteDigisac';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type StatusFechamento = 'pendente' | 'finalizado' | 'erro' | 'ignorado';
export type TipoChamadoFechamento = 'ativo' | 'receptivo' | 'indefinido';
export type UltimaMensagemPor = 'cliente' | 'nos' | 'desconhecido';

export interface RegistroFechamentoAutomatico {
  id: string;
  digisac_ticket_id: string;
  digisac_contact_id: string;
  protocolo: string | null;
  ticket_history_url: string | null;
  service_id: string;
  service_name: string | null;
  nome_contato: string | null;
  telefone_contato: string | null;
  tipo_chamado: TipoChamadoFechamento | null;
  ultima_mensagem_em: string | null;
  ultima_mensagem_por: UltimaMensagemPor | null;
  preview_ultima_mensagem: string | null;
  horas_sem_interacao: number | null;
  fechamento_motivo_id: string | null;
  fechamento_motivo_nome: string | null;
  endpoint_fechamento: string | null;
  status: StatusFechamento;
  erro: string | null;
  finalizado_em: string | null;
  created_at: string;
  updated_at: string;
}

export interface FiltrosListagemFechamentos {
  status?: StatusFechamento;
  tipoChamado?: TipoChamadoFechamento;
  ultimaMensagemPor?: UltimaMensagemPor;
  dataInicio?: string;
  dataFim?: string;
  busca?: string;
  page?: number;
  pageSize?: number;
}

export interface ListagemFechamentosResponse {
  items: RegistroFechamentoAutomatico[];
  total: number;
  page: number;
  pageSize: number;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const DIGISAC_WEB_BASE_URL = 'https://lebebe.digisac.me';

/** ID do tópico "FECHAMENTO AUTOMATICO AUTOMACAO" registrado no Digisac. */
export const DIGISAC_TICKET_TOPIC_ID_FECHAMENTO_AUTOMATICO = '422e6abf-66ad-45fd-a0ee-217648398d3e';
export const DIGISAC_TICKET_TOPIC_NOME_FECHAMENTO_AUTOMATICO = 'FECHAMENTO AUTOMATICO AUTOMACAO';

/** serviceId da conexão Bigorrilho no Digisac. */
export const BIGORRILHO_SERVICE_ID = '0973f84b-8294-4615-9657-ba95b6346246';

// ─── Fechamento reutilizavel ──────────────────────────────────────────────────

const BY_USER_ID_FECHAMENTO = '2674db7a-0beb-4e1d-8f32-20c71023c1ea';

export interface RegistroParaFechar {
  id: string;
  digisac_ticket_id: string;
  digisac_contact_id: string;
  service_id: string;
  status: string;
  protocolo: string | null;
  nome_contato: string | null;
  ticket_history_url: string | null;
}

export interface ResultadoFechamento {
  ok: boolean;
  id: string;
  digisac_ticket_id: string;
  protocolo: string | null;
  nome_contato: string | null;
  ticket_history_url: string | null;
  erro?: string;
  finalizado_em?: string;
  aviso?: string;
}

export interface ResultadoVerificacao {
  confirmado: boolean;
  fechado: boolean;
  motivo?: string;
}

/**
 * Consulta o Digisac para verificar se o ticket esta fechado.
 * Usa GET /tickets/{ticketId} que retorna o ticket com campo isOpen.
 * Fallback: GET /tickets?where[contactId]=...&where[isOpen]=true para checar se ha ticket aberto.
 */
export async function verificarChamadoFechadoNoDigisac(
  digisacTicketId: string,
  digisacContactId: string
): Promise<ResultadoVerificacao> {
  console.log(
    '[VERIFICAR-STATUS] Consultando Digisac.' +
    ' ticketId=' + digisacTicketId.slice(0, 8) +
    ' contactId=' + digisacContactId.slice(0, 8)
  );

  try {
    const ticket = await fetchDigisac(`/tickets/${digisacTicketId}`);
    if (ticket && typeof ticket.isOpen === 'boolean') {
      const fechado = !ticket.isOpen;
      console.log('[VERIFICAR-STATUS] Ticket consultado. isOpen=' + ticket.isOpen + ' fechado=' + fechado);
      return { confirmado: true, fechado };
    }

    if (ticket && ticket.id) {
      const fechado = ticket.isOpen === false || ticket.isOpen === undefined;
      console.log('[VERIFICAR-STATUS] Ticket consultado (sem isOpen explicito). fechado=' + fechado);
      return { confirmado: true, fechado };
    }

    console.warn('[VERIFICAR-STATUS] Resposta nao reconhecida, tentando fallback por contactId.');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[VERIFICAR-STATUS] Falha ao buscar ticket por id, tentando fallback por contactId:', msg);
  }

  try {
    const params = new URLSearchParams();
    params.append('where[contactId]', digisacContactId);
    params.append('where[isOpen]', 'true');
    params.append('page', '1');
    params.append('perPage', '1');

    const res = await fetchDigisac(`/tickets?${params.toString()}`);
    const tickets = Array.isArray(res) ? res : (res.rows || res.data || []);
    const total = (res && (res.count || res.total)) ?? tickets.length;

    const haTicketAberto = total > 0;
    console.log('[VERIFICAR-STATUS] Fallback contactId. ticketsAbertos=' + total + ' fechado=' + !haTicketAberto);

    return { confirmado: true, fechado: !haTicketAberto };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[VERIFICAR-STATUS] Falha ao verificar status via fallback:', msg);
    return { confirmado: false, fechado: false, motivo: 'Nao foi possivel confirmar o status do chamado no Digisac' };
  }
}

/**
 * Funcao server-side reutilizavel que fecha um chamado no Digisac e atualiza
 * o registro na tabela digisac_fechamentos_automaticos.
 *
 * Pre-condicoes: o registro ja foi validado (status, service_id, contact_id, ticket_id).
 * Esta funcao apenas executa o fechamento e atualiza o banco.
 */
export async function fecharRegistroAutomaticoDigisac(
  reg: RegistroParaFechar,
  supabase: ReturnType<typeof import('@/lib/supabase/service').createServiceClient>
): Promise<ResultadoFechamento> {
  const endpoint = `/contacts/${reg.digisac_contact_id}/ticket/close`;
  const payload = {
    byUserId: BY_USER_ID_FECHAMENTO,
    comments: 'FECHAMENTO AUTOMATICO',
    ticketTopicIds: [DIGISAC_TICKET_TOPIC_ID_FECHAMENTO_AUTOMATICO],
  };

  console.log(
    '[FECHAR-CHAMADO] Chamando Digisac.' +
    ' ticketId=' + reg.digisac_ticket_id.slice(0, 8) +
    ' contactId=' + reg.digisac_contact_id.slice(0, 8)
  );

  try {
    const digisacRes = await fetchDigisacRaw(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!digisacRes.ok) {
      const bodyTxt = await digisacRes.text().catch(() => '');
      const mensagemSegura = `Erro Digisac ${digisacRes.status}: ${bodyTxt.substring(0, 200)}`;

      console.error('[FECHAR-CHAMADO] Digisac retornou erro:', digisacRes.status);
      console.log('[FECHAR-CHAMADO] Verificando se o chamado foi fechado mesmo assim...');

      const verificacao = await verificarChamadoFechadoNoDigisac(reg.digisac_ticket_id, reg.digisac_contact_id);
      if (verificacao.confirmado && verificacao.fechado) {
        const agoraIso = new Date().toISOString();
        const { error: errUpdate } = await supabase
          .from('digisac_fechamentos_automaticos')
          .update({
            status: 'finalizado',
            finalizado_em: agoraIso,
            erro: null,
            updated_at: agoraIso,
          })
          .eq('id', reg.id);

        if (errUpdate) {
          console.error('[FECHAR-CHAMADO] Confirmado fechado mas erro ao atualizar banco:', errUpdate.message);
        }

        console.log('[FECHAR-CHAMADO] Confirmado fechado apos erro. registroId=' + reg.id);
        return {
          ok: true,
          id: reg.id,
          digisac_ticket_id: reg.digisac_ticket_id,
          protocolo: reg.protocolo,
          nome_contato: reg.nome_contato,
          ticket_history_url: reg.ticket_history_url,
          finalizado_em: agoraIso,
          aviso: `Digisac retornou erro ${digisacRes.status}, mas o chamado foi confirmado como fechado.`,
        };
      }

      await supabase
        .from('digisac_fechamentos_automaticos')
        .update({
          status: 'erro',
          erro: mensagemSegura,
          updated_at: new Date().toISOString(),
        })
        .eq('id', reg.id);

      return {
        ok: false,
        id: reg.id,
        digisac_ticket_id: reg.digisac_ticket_id,
        protocolo: reg.protocolo,
        nome_contato: reg.nome_contato,
        ticket_history_url: reg.ticket_history_url,
        erro: mensagemSegura,
      };
    }

    const agoraIso = new Date().toISOString();

    const { error: errUpdate } = await supabase
      .from('digisac_fechamentos_automaticos')
      .update({
        status: 'finalizado',
        finalizado_em: agoraIso,
        erro: null,
        updated_at: agoraIso,
      })
      .eq('id', reg.id);

    if (errUpdate) {
      console.error('[FECHAR-CHAMADO] Digisac fechou mas erro ao atualizar banco:', errUpdate.message);
      return {
        ok: true,
        id: reg.id,
        digisac_ticket_id: reg.digisac_ticket_id,
        protocolo: reg.protocolo,
        nome_contato: reg.nome_contato,
        ticket_history_url: reg.ticket_history_url,
        finalizado_em: agoraIso,
        erro: 'Chamado fechado no Digisac, mas erro ao atualizar banco',
      };
    }

    console.log('[FECHAR-CHAMADO] Sucesso. registroId=' + reg.id + ' status=finalizado');

    return {
      ok: true,
      id: reg.id,
      digisac_ticket_id: reg.digisac_ticket_id,
      protocolo: reg.protocolo,
      nome_contato: reg.nome_contato,
      ticket_history_url: reg.ticket_history_url,
      finalizado_em: agoraIso,
    };
  } catch (digisacErr) {
    const mensagem = digisacErr instanceof Error ? digisacErr.message : 'Erro desconhecido';

    console.error('[FECHAR-CHAMADO] Erro ao chamar Digisac:', mensagem);
    console.log('[FECHAR-CHAMADO] Verificando se o chamado foi fechado mesmo assim...');

    const verificacao = await verificarChamadoFechadoNoDigisac(reg.digisac_ticket_id, reg.digisac_contact_id);
    if (verificacao.confirmado && verificacao.fechado) {
      const agoraIso = new Date().toISOString();
      const { error: errUpdate } = await supabase
        .from('digisac_fechamentos_automaticos')
        .update({
          status: 'finalizado',
          finalizado_em: agoraIso,
          erro: null,
          updated_at: agoraIso,
        })
        .eq('id', reg.id);

      if (errUpdate) {
        console.error('[FECHAR-CHAMADO] Confirmado fechado mas erro ao atualizar banco:', errUpdate.message);
      }

      console.log('[FECHAR-CHAMADO] Confirmado fechado apos excecao. registroId=' + reg.id);
      return {
        ok: true,
        id: reg.id,
        digisac_ticket_id: reg.digisac_ticket_id,
        protocolo: reg.protocolo,
        nome_contato: reg.nome_contato,
        ticket_history_url: reg.ticket_history_url,
        finalizado_em: agoraIso,
        aviso: 'Chamado confirmado como fechado apos erro de comunicacao.',
      };
    }

    await supabase
      .from('digisac_fechamentos_automaticos')
      .update({
        status: 'erro',
        erro: mensagem.substring(0, 300),
        updated_at: new Date().toISOString(),
      })
      .eq('id', reg.id);

    return {
      ok: false,
      id: reg.id,
      digisac_ticket_id: reg.digisac_ticket_id,
      protocolo: reg.protocolo,
      nome_contato: reg.nome_contato,
      ticket_history_url: reg.ticket_history_url,
      erro: mensagem.substring(0, 300),
    };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function montarUrlHistoricoTicket(ticketId: string): string {
  return `${DIGISAC_WEB_BASE_URL}/ticket-history/${ticketId}`;
}

export function normalizarStatusFechamento(status: string): StatusFechamento {
  if (status === 'finalizado' || status === 'erro' || status === 'ignorado') return status;
  return 'pendente';
}

/**
 * Mapeia um item elegível retornado pelo diagnóstico dry-run para o formato
 * de inserção na tabela `digisac_fechamentos_automaticos`.
 * Não executa nenhuma ação no Digisac — apenas prepara o registro de auditoria.
 *
 * Endpoint de fechamento (APENAS para referência da Fase 3 — NÃO chamar aqui):
 * POST /api/v1/contacts/{contactId}/ticket/close
 *
 * Payload futuro (Fase 3):
 * { byUserId: "<validar antes>", comments: "", ticketTopicIds: ["422e6abf-66ad-45fd-a0ee-217648398d3e"] }
 */
export function montarRegistroFechamentoAutomatico(item: {
  ticketId: string;
  protocolo: string | null;
  ticketHistoryUrl: string;
  contactId: string | null;
  nomeContato: string | null;
  telefoneContato: string | null;
  serviceIdContato: string | null;
  serviceNameContato: string | null;
  tipoChamado: TipoChamadoFechamento;
  ultimaMensagemEm: string | null;
  ultimaMensagemPor: UltimaMensagemPor;
  horasSemInteracao: number;
  previewUltimaMensagem: string | null;
  endpointFechamentoPrevisto: string | null;
}): Omit<RegistroFechamentoAutomatico, 'id' | 'created_at' | 'updated_at'> {
  return {
    digisac_ticket_id: item.ticketId,
    digisac_contact_id: item.contactId ?? '',
    protocolo: item.protocolo,
    ticket_history_url: item.ticketHistoryUrl,
    service_id: item.serviceIdContato ?? BIGORRILHO_SERVICE_ID,
    service_name: item.serviceNameContato,
    nome_contato: item.nomeContato,
    telefone_contato: item.telefoneContato,
    tipo_chamado: item.tipoChamado,
    ultima_mensagem_em: item.ultimaMensagemEm,
    ultima_mensagem_por: item.ultimaMensagemPor,
    preview_ultima_mensagem: item.previewUltimaMensagem,
    horas_sem_interacao: item.horasSemInteracao,
    fechamento_motivo_id: DIGISAC_TICKET_TOPIC_ID_FECHAMENTO_AUTOMATICO,
    fechamento_motivo_nome: DIGISAC_TICKET_TOPIC_NOME_FECHAMENTO_AUTOMATICO,
    endpoint_fechamento: item.endpointFechamentoPrevisto,
    status: 'pendente',
    erro: null,
    finalizado_em: null,
  };
}
