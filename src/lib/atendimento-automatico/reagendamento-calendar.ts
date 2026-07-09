import type { EventoCalendar } from '@/lib/google/calendar-service';
import { atualizarEvento, buscarEvento, criarEvento } from '@/lib/google/calendar-service';
import type { EventoGrupo, GrupoAgendamento } from '@/lib/google/sheets-service-account';

export const CALENDAR_REAGENDAMENTO_REM_CLIENTE_FALLBACK =
  'c_5d423c9be1ad48fe2ec6f15e571fe0879b703d3c60d27245d024413c09e73bd8@group.calendar.google.com';

export type EventoReagendamento = Pick<EventoGrupo, 'evento_id' | 'calendar_id' | 'pedido_venda' | 'equipe_agenda'>;

export type ResultadoEventoReagendamento = {
  evento_id: string;
  calendar_id: string;
  status: 'dry_run' | 'duplicado' | 'movido' | 'erro';
  duplicate_event_id?: string | null;
  erro_codigo?: string;
  erro_mensagem?: string;
};

export type ResultadoReagendamentoCalendar = {
  ok: boolean;
  dryRun: boolean;
  status: 'dry_run' | 'aplicado' | 'erro' | 'parcial';
  calendarDestinoId: string;
  totalEventos: number;
  eventos: ResultadoEventoReagendamento[];
  erros: Array<{ codigo: string; mensagem: string; evento_id?: string; calendar_id?: string }>;
};

type CalendarDeps = {
  buscarEvento: typeof buscarEvento;
  criarEvento: typeof criarEvento;
  atualizarEvento: typeof atualizarEvento;
};

const depsPadrao: CalendarDeps = {
  buscarEvento,
  criarEvento,
  atualizarEvento,
};

function erro(codigo: string, mensagem: string, evento?: Partial<EventoReagendamento>) {
  return {
    codigo,
    mensagem,
    evento_id: evento?.evento_id,
    calendar_id: evento?.calendar_id,
  };
}

export function dataBRParaISO(dataBR: string): string | null {
  const match = dataBR.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
}

export function adicionarUmDiaISO(dataISO: string): string {
  const [ano, mes, dia] = dataISO.split('-').map(Number);
  const date = new Date(Date.UTC(ano, mes - 1, dia));
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function deduplicarEventosGrupo(grupo: GrupoAgendamento | null): EventoReagendamento[] {
  const eventos = grupo?.eventos ?? [];
  const vistos = new Set<string>();
  const dedup: EventoReagendamento[] = [];

  for (const evento of eventos) {
    const eventoId = evento.evento_id?.trim();
    const calendarId = evento.calendar_id?.trim();
    if (!eventoId || !calendarId) continue;
    const chave = `${calendarId}|||${eventoId}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    dedup.push({
      evento_id: eventoId,
      calendar_id: calendarId,
      pedido_venda: evento.pedido_venda,
      equipe_agenda: evento.equipe_agenda,
    });
  }

  return dedup;
}

function prefixarTitulo(summary: string | undefined): string {
  const prefixo = '[REAG. AUTOMATICO]';
  const titulo = summary?.trim() || 'Entrega reagendada';
  if (titulo.startsWith(prefixo)) return titulo;
  return `${prefixo} ${titulo}`;
}

export function montarEventoDuplicado(eventoOriginal: EventoCalendar, dataOriginalISO: string): Partial<EventoCalendar> {
  return {
    summary: prefixarTitulo(eventoOriginal.summary),
    description: eventoOriginal.description,
    location: eventoOriginal.location,
    start: { date: dataOriginalISO },
    end: { date: adicionarUmDiaISO(dataOriginalISO) },
    colorId: eventoOriginal.colorId,
    transparency: eventoOriginal.transparency,
    visibility: eventoOriginal.visibility,
    reminders: eventoOriginal.reminders,
  };
}

function montarEventoOriginalMovido(eventoOriginal: EventoCalendar, dataNovaISO: string): Partial<EventoCalendar> {
  return {
    ...eventoOriginal,
    start: { date: dataNovaISO },
    end: { date: adicionarUmDiaISO(dataNovaISO) },
  };
}

export async function executarReagendamentoCalendar(
  params: {
    grupo: GrupoAgendamento | null;
    dataOriginalISO: string;
    dataNovaISO: string;
    calendarWriteEnabled: boolean;
    calendarDestinoId?: string | null;
  },
  deps: CalendarDeps = depsPadrao
): Promise<ResultadoReagendamentoCalendar> {
  const calendarDestinoId = params.calendarDestinoId?.trim() || CALENDAR_REAGENDAMENTO_REM_CLIENTE_FALLBACK;
  const eventos = deduplicarEventosGrupo(params.grupo);
  const resultado: ResultadoReagendamentoCalendar = {
    ok: false,
    dryRun: !params.calendarWriteEnabled,
    status: params.calendarWriteEnabled ? 'erro' : 'dry_run',
    calendarDestinoId,
    totalEventos: eventos.length,
    eventos: [],
    erros: [],
  };

  if (!params.grupo) {
    resultado.erros.push(erro('grupo_nao_encontrado', 'Grupo de agendamento selecionado nao encontrado.'));
    return resultado;
  }

  if (!params.dataOriginalISO || !params.dataNovaISO) {
    resultado.erros.push(erro('datas_invalidas', 'Data original ou nova data ausente/invalida.'));
    return resultado;
  }

  if (eventos.length === 0) {
    resultado.erros.push(erro('eventos_originais_ausentes', 'Nenhum evento original com calendar_id e evento_id foi encontrado.'));
    return resultado;
  }

  if (!params.calendarWriteEnabled) {
    resultado.ok = true;
    resultado.eventos = eventos.map((evento) => ({
      evento_id: evento.evento_id,
      calendar_id: evento.calendar_id,
      status: 'dry_run',
    }));
    return resultado;
  }

  for (const evento of eventos) {
    try {
      const original = await deps.buscarEvento(evento.calendar_id, evento.evento_id);
      if (!original) {
        resultado.erros.push(erro('evento_original_nao_encontrado', 'Evento original nao encontrado no Google Calendar.', evento));
        resultado.eventos.push({ evento_id: evento.evento_id, calendar_id: evento.calendar_id, status: 'erro', erro_codigo: 'evento_original_nao_encontrado' });
        resultado.status = resultado.eventos.some((e) => e.status === 'movido') ? 'parcial' : 'erro';
        return resultado;
      }

      if (original.start?.dateTime || original.end?.dateTime || !original.start?.date || !original.end?.date) {
        resultado.erros.push(erro('evento_nao_eh_dia_inteiro', 'Evento original nao e all-day; reagendamento automatico bloqueado.', evento));
        resultado.eventos.push({ evento_id: evento.evento_id, calendar_id: evento.calendar_id, status: 'erro', erro_codigo: 'evento_nao_eh_dia_inteiro' });
        resultado.status = resultado.eventos.some((e) => e.status === 'movido') ? 'parcial' : 'erro';
        return resultado;
      }

      if (original.start.date !== params.dataOriginalISO) {
        resultado.erros.push(erro('data_original_divergente', `Evento original esta em ${original.start.date}, esperado ${params.dataOriginalISO}.`, evento));
        resultado.eventos.push({ evento_id: evento.evento_id, calendar_id: evento.calendar_id, status: 'erro', erro_codigo: 'data_original_divergente' });
        resultado.status = resultado.eventos.some((e) => e.status === 'movido') ? 'parcial' : 'erro';
        return resultado;
      }

      const duplicado = await deps.criarEvento(calendarDestinoId, montarEventoDuplicado(original, params.dataOriginalISO));
      const registro: ResultadoEventoReagendamento = {
        evento_id: evento.evento_id,
        calendar_id: evento.calendar_id,
        status: 'duplicado',
        duplicate_event_id: duplicado.id ?? null,
      };
      resultado.eventos.push(registro);

      try {
        await deps.atualizarEvento(evento.calendar_id, evento.evento_id, montarEventoOriginalMovido(original, params.dataNovaISO));
        registro.status = 'movido';
      } catch (err) {
        const mensagem = err instanceof Error ? err.message : String(err);
        registro.status = 'erro';
        registro.erro_codigo = 'falha_mover_original_apos_duplicar';
        registro.erro_mensagem = mensagem;
        resultado.erros.push(erro('falha_mover_original_apos_duplicar', mensagem, evento));
        resultado.status = 'parcial';
        return resultado;
      }
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : String(err);
      resultado.erros.push(erro('falha_reagendamento_evento', mensagem, evento));
      resultado.eventos.push({
        evento_id: evento.evento_id,
        calendar_id: evento.calendar_id,
        status: 'erro',
        erro_codigo: 'falha_reagendamento_evento',
        erro_mensagem: mensagem,
      });
      resultado.status = resultado.eventos.some((e) => e.status === 'movido') ? 'parcial' : 'erro';
      return resultado;
    }
  }

  resultado.ok = resultado.eventos.length === eventos.length && resultado.eventos.every((e) => e.status === 'movido');
  resultado.status = resultado.ok ? 'aplicado' : 'parcial';
  return resultado;
}

