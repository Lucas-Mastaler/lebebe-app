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
  console.log(`[REAGENDAMENTO] Data original: ${dataOriginal} -> Nova data: ${novaData}`);
  console.log(`[REAGENDAMENTO] Calendário atual: ${calendarIdAtual}`);
  console.log(`[REAGENDAMENTO] Calendário novo: ${calendarIdNovo}`);

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
  console.log(`[REAGENDAMENTO] Descrição original: ${eventoOriginal.description?.substring(0, 100)}...`);

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
  console.log(`[REAGENDAMENTO] Criando evento com nova data: ${novaData}`);

  const novoStart = calcularNovaData(eventoOriginal.start!, novaData);
  const novoEnd = calcularNovaData(eventoOriginal.end!, novaData);

  const novoEvento: Partial<EventoCalendar> = {
    summary: eventoOriginal.summary,
    description: eventoOriginal.description,
    location: eventoOriginal.location,
    start: novoStart,
    end: novoEnd,
    attendees: eventoOriginal.attendees,
    reminders: eventoOriginal.reminders,
  };

  return await criarEvento(calendarId, novoEvento);
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

function calcularNovaData(
  dataOriginal: { date?: string; dateTime?: string; timeZone?: string },
  novaDataStr: string
): { date?: string; dateTime?: string; timeZone?: string } {
  if (dataOriginal.date) {
    return {
      date: novaDataStr,
      timeZone: dataOriginal.timeZone,
    };
  }

  if (dataOriginal.dateTime) {
    const dataTimeOriginal = new Date(dataOriginal.dateTime);
    const [ano, mes, dia] = novaDataStr.split("-").map(Number);
    
    dataTimeOriginal.setFullYear(ano);
    dataTimeOriginal.setMonth(mes - 1);
    dataTimeOriginal.setDate(dia);

    return {
      dateTime: dataTimeOriginal.toISOString(),
      timeZone: dataOriginal.timeZone,
    };
  }

  return dataOriginal;
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
