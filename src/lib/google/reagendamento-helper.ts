import {
  buscarEvento,
  criarEvento,
  atualizarEvento,
  moverEvento,
  EventoCalendar,
} from "./calendar-service";
import {
  ReagendarClientePayload,
  ReagendarClienteResponse,
  CALENDAR_ID_REAGENDAMENTO,
} from "@/types/reagendamento";

// ─────────────────────────────────────────────────────────
// 1.0 – Função principal de reagendamento
// ─────────────────────────────────────────────────────────

export async function reagendarEventoCliente(
  payload: ReagendarClientePayload
): Promise<ReagendarClienteResponse> {
  const {
    eventoId,
    calendarIdAtual,
    calendarIdNovo,
    dataOriginal,
    novaData,
    nomeCliente,
    pedidoVenda,
    enderecoCliente,
    produtos,
    motivo,
  } = payload;

  console.log(`[REAGENDAMENTO] ========================================`);
  console.log(`[REAGENDAMENTO] Iniciando reagendamento do evento ${eventoId}`);
  console.log(`[REAGENDAMENTO] Cliente: ${nomeCliente}`);
  console.log(`[REAGENDAMENTO] Pedido: ${pedidoVenda}`);
  console.log(`[REAGENDAMENTO] ========================================`);
  console.log(`[REAGENDAMENTO] DATAS:`);
  console.log(`[REAGENDAMENTO] - Data original: ${dataOriginal}`);
  console.log(`[REAGENDAMENTO] - Nova data: ${novaData}`);
  console.log(`[REAGENDAMENTO] - Tipo de evento: ALL-DAY (formato padrão do sistema)`);
  console.log(`[REAGENDAMENTO] ========================================`);
  console.log(`[REAGENDAMENTO] CALENDÁRIOS:`);
  console.log(`[REAGENDAMENTO] - Calendário atual: ${calendarIdAtual}`);
  console.log(`[REAGENDAMENTO] - Calendário novo: ${calendarIdNovo}`);

  // ─────────────────────────────────────────────────────────
  // 2.0 – Buscar evento original
  // ─────────────────────────────────────────────────────────
  console.log(`[REAGENDAMENTO] Buscando evento original...`);
  const eventoOriginal = await buscarEvento(calendarIdAtual, eventoId);

  if (!eventoOriginal) {
    throw new Error(
      `Evento ${eventoId} não encontrado no calendário ${calendarIdAtual}`
    );
  }

  console.log(`[REAGENDAMENTO] ✓ Evento original encontrado: "${eventoOriginal.summary}"`);
  console.log(`[REAGENDAMENTO] ========================================`);
  console.log(`[REAGENDAMENTO] EVENTO ORIGINAL:`);
  console.log(`[REAGENDAMENTO] - Título: ${eventoOriginal.summary}`);
  console.log(`[REAGENDAMENTO] - Start: ${JSON.stringify(eventoOriginal.start)}`);
  console.log(`[REAGENDAMENTO] - End: ${JSON.stringify(eventoOriginal.end)}`);
  console.log(`[REAGENDAMENTO] - Formato: ${eventoOriginal.start?.date ? 'ALL-DAY ✓' : 'DATETIME (inesperado)'}`);
  console.log(`[REAGENDAMENTO] ========================================`);

  // ─────────────────────────────────────────────────────────
  // 3.0 – Verificar se é mesma agenda ou agenda diferente
  // ─────────────────────────────────────────────────────────
  const mesmaAgenda = calendarIdAtual === calendarIdNovo;
  const modo = mesmaAgenda ? "mesma_agenda" : "nova_agenda";

  console.log(`[REAGENDAMENTO] Modo: ${modo}`);

  // ─────────────────────────────────────────────────────────
  // 4.0 – Processar reagendamento conforme modo
  // ─────────────────────────────────────────────────────────
  let eventoNovoId: string;
  let eventoHistoricoId: string;

  console.log(`[REAGENDAMENTO] Cenário: ${modo}`);
  console.log(`[REAGENDAMENTO] 1. Criar novo evento operacional com nova data`);
  console.log(`[REAGENDAMENTO] 2. Atualizar e mover evento original para calendário de histórico`);

  // ─── PASSO 1: Criar novo evento operacional ───
  const novoEvento = await criarEventoComNovaData(
    eventoOriginal,
    calendarIdNovo,
    novaData
  );
  eventoNovoId = novoEvento.id!;

  console.log(`[REAGENDAMENTO] ✓ Novo evento operacional criado: ${eventoNovoId}`);
  console.log(`[REAGENDAMENTO] ✓ Calendário do novo evento: ${calendarIdNovo}`);

  // ─── PASSO 2: Atualizar evento original (adicionar bloco de reagendamento) ───
  const eventoOriginalAtualizado = await atualizarEventoOriginalParaHistorico(
    eventoOriginal,
    calendarIdAtual,
    payload
  );

  console.log(`[REAGENDAMENTO] ✓ Evento original atualizado com bloco de reagendamento`);

  // ─── PASSO 3: Mover evento original para calendário de histórico ───
  const eventoHistorico = await moverEvento(
    calendarIdAtual,
    CALENDAR_ID_REAGENDAMENTO,
    eventoId
  );
  eventoHistoricoId = eventoHistorico.id!;

  console.log(`[REAGENDAMENTO] ✓ Evento original movido para calendário de histórico: ${eventoHistoricoId}`);
  console.log(`[REAGENDAMENTO] ✓ Calendário de histórico: ${CALENDAR_ID_REAGENDAMENTO}`);

  // ─────────────────────────────────────────────────────────
  // 5.0 – Montar resposta
  // ─────────────────────────────────────────────────────────
  const resposta: ReagendarClienteResponse = {
    ok: true,
    modo: modo,
    eventoOriginalId: eventoId,
    eventoNovoId: eventoNovoId,
    eventoHistoricoId: eventoHistoricoId,
    calendarIdAtual: calendarIdAtual,
    calendarIdNovo: calendarIdNovo,
    calendarIdHistorico: CALENDAR_ID_REAGENDAMENTO,
    dataOriginal: dataOriginal,
    novaData: novaData,
    mensagem: `Evento reagendado com sucesso. Modo: ${modo}. Total de eventos: 2 (novo operacional + original movido para histórico).`,
  };

  console.log(`[REAGENDAMENTO] ========================================`);
  console.log(`[REAGENDAMENTO] ✅ REAGENDAMENTO CONCLUÍDO COM SUCESSO`);
  console.log(`[REAGENDAMENTO] Total de eventos criados: 2`);
  console.log(`[REAGENDAMENTO] 1. Evento novo operacional: ${eventoNovoId} (calendário: ${calendarIdNovo})`);
  console.log(`[REAGENDAMENTO] 2. Evento original movido para histórico: ${eventoHistoricoId} (calendário: ${CALENDAR_ID_REAGENDAMENTO})`);
  console.log(`[REAGENDAMENTO] OBSERVAÇÃO: O ID do evento original pode ter mudado ao ser movido entre calendários`);
  console.log(`[REAGENDAMENTO] ========================================`);

  return resposta;
}

// ─────────────────────────────────────────────────────────
// 6.0 – Helpers para criação de eventos
// ─────────────────────────────────────────────────────────

async function criarEventoComNovaData(
  eventoOriginal: EventoCalendar,
  calendarId: string,
  novaData: string
): Promise<EventoCalendar> {
  console.log(`[REAGENDAMENTO] ========================================`);
  console.log(`[REAGENDAMENTO] Criando evento operacional com nova data`);
  console.log(`[REAGENDAMENTO] Nova data solicitada: ${novaData}`);
  console.log(`[REAGENDAMENTO] Calendário destino: ${calendarId}`);
  
  // Calcular start e end para all-day event
  const { start, end } = calcularDatasAllDay(novaData);
  
  console.log(`[REAGENDAMENTO] Montando objeto do evento:`);
  console.log(`[REAGENDAMENTO] - Título: ${eventoOriginal.summary}`);
  console.log(`[REAGENDAMENTO] - Start: ${JSON.stringify(start)}`);
  console.log(`[REAGENDAMENTO] - End: ${JSON.stringify(end)}`);
  console.log(`[REAGENDAMENTO] - Location: ${eventoOriginal.location || "não definido"}`);

  const novoEvento: Partial<EventoCalendar> = {
    summary: eventoOriginal.summary,
    description: eventoOriginal.description,
    location: eventoOriginal.location,
    start: start,
    end: end,
    attendees: eventoOriginal.attendees,
    reminders: eventoOriginal.reminders,
  };

  console.log(`[REAGENDAMENTO] Enviando evento para Google Calendar API...`);
  const eventoCriado = await criarEvento(calendarId, novoEvento);
  console.log(`[REAGENDAMENTO] ✓ Evento operacional criado com ID: ${eventoCriado.id}`);
  console.log(`[REAGENDAMENTO] ========================================`);
  
  return eventoCriado;
}

async function atualizarEventoOriginalParaHistorico(
  eventoOriginal: EventoCalendar,
  calendarIdAtual: string,
  payload: ReagendarClientePayload
): Promise<EventoCalendar> {
  console.log(`[REAGENDAMENTO] Atualizando evento original com informações de reagendamento`);

  const dataHoraAtual = new Date().toISOString();
  const blocoReagendamento = montarBlocoReagendamento(payload, dataHoraAtual);

  const descricaoComHistorico = eventoOriginal.description
    ? `${eventoOriginal.description}\n\n${blocoReagendamento}`
    : blocoReagendamento;

  const tituloHistorico = `[REM. CLIENTE] ${eventoOriginal.summary || "Sem título"}`;

  const eventoAtualizado: Partial<EventoCalendar> = {
    summary: tituloHistorico,
    description: descricaoComHistorico,
  };

  console.log(`[REAGENDAMENTO] Título atualizado: ${tituloHistorico}`);
  console.log(`[REAGENDAMENTO] Descrição atualizada (primeiros 200 chars): ${descricaoComHistorico.substring(0, 200)}...`);

  return await atualizarEvento(calendarIdAtual, eventoOriginal.id!, eventoAtualizado);
}

function montarBlocoReagendamento(
  payload: ReagendarClientePayload,
  dataHoraAtual: string
): string {
  return `------------------------------
REAGENDAMENTO SOLICITADO PELO CLIENTE
Cliente: ${payload.nomeCliente}
Pedido: ${payload.pedidoVenda}
Data original: ${payload.dataOriginal}
Nova data: ${payload.novaData}
Calendário original: ${payload.calendarIdAtual}
Calendário novo: ${payload.calendarIdNovo}
Motivo: ${payload.motivo}
Endereço: ${payload.enderecoCliente}
Produtos: ${payload.produtos}
Registrado em: ${dataHoraAtual}
------------------------------`;
}

/**
 * Calcula start e end para all-day events no Google Calendar.
 * 
 * Regra Google Calendar:
 * - start.date = data do evento (YYYY-MM-DD)
 * - end.date = dia seguinte (exclusivo)
 * 
 * Exemplo: evento no dia 2026-03-20
 * - start.date = "2026-03-20"
 * - end.date = "2026-03-21"
 * 
 * @param dataStr - Data no formato YYYY-MM-DD (ex: "2026-03-20")
 * @returns Objeto com start e end para all-day event
 */
function calcularDatasAllDay(
  dataStr: string
): { start: { date: string }, end: { date: string } } {
  console.log(`[REAGENDAMENTO] Calculando datas all-day para: ${dataStr}`);
  
  // Parse da data (YYYY-MM-DD)
  const [ano, mes, dia] = dataStr.split("-").map(Number);
  
  // Start date = data do evento
  const startDate = new Date(ano, mes - 1, dia);
  
  // End date = dia seguinte (exclusivo no Google Calendar)
  const endDate = new Date(ano, mes - 1, dia);
  endDate.setDate(endDate.getDate() + 1);
  
  // Formatar para YYYY-MM-DD
  const startDateStr = formatarDataYYYYMMDD(startDate);
  const endDateStr = formatarDataYYYYMMDD(endDate);
  
  console.log(`[REAGENDAMENTO] Tipo do evento: all-day`);
  console.log(`[REAGENDAMENTO] Start date calculado: ${startDateStr}`);
  console.log(`[REAGENDAMENTO] End date calculado: ${endDateStr} (exclusivo - dia seguinte)`);
  
  return {
    start: { date: startDateStr },
    end: { date: endDateStr }
  };
}

/**
 * Formata Date para string YYYY-MM-DD
 */
function formatarDataYYYYMMDD(data: Date): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

// ─────────────────────────────────────────────────────────
// 7.0 – Validação de payload
// ─────────────────────────────────────────────────────────

export function validarPayloadReagendamento(
  payload: any
): { valido: boolean; erros: string[] } {
  const erros: string[] = [];

  if (!payload.eventoId || typeof payload.eventoId !== "string") {
    erros.push("eventoId é obrigatório e deve ser uma string");
  }

  if (!payload.calendarIdAtual || typeof payload.calendarIdAtual !== "string") {
    erros.push("calendarIdAtual é obrigatório e deve ser uma string");
  }

  if (!payload.calendarIdNovo || typeof payload.calendarIdNovo !== "string") {
    erros.push("calendarIdNovo é obrigatório e deve ser uma string");
  }

  if (!payload.dataOriginal || typeof payload.dataOriginal !== "string") {
    erros.push("dataOriginal é obrigatório e deve ser uma string");
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.dataOriginal)) {
    erros.push("dataOriginal deve estar no formato YYYY-MM-DD");
  }

  if (!payload.novaData || typeof payload.novaData !== "string") {
    erros.push("novaData é obrigatório e deve ser uma string");
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.novaData)) {
    erros.push("novaData deve estar no formato YYYY-MM-DD");
  }

  if (!payload.nomeCliente || typeof payload.nomeCliente !== "string") {
    erros.push("nomeCliente é obrigatório e deve ser uma string");
  }

  if (!payload.pedidoVenda || typeof payload.pedidoVenda !== "string") {
    erros.push("pedidoVenda é obrigatório e deve ser uma string");
  }

  if (!payload.enderecoCliente || typeof payload.enderecoCliente !== "string") {
    erros.push("enderecoCliente é obrigatório e deve ser uma string");
  }

  if (!payload.produtos || typeof payload.produtos !== "string") {
    erros.push("produtos é obrigatório e deve ser uma string");
  }

  if (!payload.motivo || typeof payload.motivo !== "string") {
    erros.push("motivo é obrigatório e deve ser uma string");
  }

  return {
    valido: erros.length === 0,
    erros: erros,
  };
}
