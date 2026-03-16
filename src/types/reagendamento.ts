// ─────────────────────────────────────────────────────────
// Types para API de Reagendamento de Eventos Google Calendar
// ─────────────────────────────────────────────────────────

export interface ReagendarClientePayload {
  eventoId: string;
  calendarIdAtual: string;
  calendarIdNovo: string;
  dataOriginal: string;
  novaData: string;
  nomeCliente: string;
  pedidoVenda: string;
  enderecoCliente: string;
  produtos: string;
  motivo: string;
}

export interface ReagendarClienteResponse {
  ok: boolean;
  modo: "mesma_agenda" | "nova_agenda";
  eventoOriginalId: string;
  eventoNovoId: string;
  eventoHistoricoId: string;
  calendarIdAtual: string;
  calendarIdNovo: string;
  calendarIdHistorico: string;
  dataOriginal: string;
  novaData: string;
  mensagem?: string;
}

export interface ReagendarClienteResponseDetalhada extends ReagendarClienteResponse {
  observacao: string;
}

export interface ReagendarClienteError {
  ok: false;
  erro: string;
  detalhes?: string;
}

export const CALENDAR_ID_REAGENDAMENTO = 
  "c_5d423c9be1ad48fe2ec6f15e571fe0879b703d3c60d27245d024413c09e73bd8@group.calendar.google.com";
