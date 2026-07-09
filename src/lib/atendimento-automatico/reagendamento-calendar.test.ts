import { describe, expect, it, vi } from 'vitest';
import type { EventoCalendar } from '@/lib/google/calendar-service';
import type { GrupoAgendamento } from '@/lib/google/sheets-service-account';
import {
  deduplicarEventosGrupo,
  executarReagendamentoCalendar,
  montarEventoDuplicado,
} from './reagendamento-calendar';

function grupoBase(): GrupoAgendamento {
  return {
    indice: 1,
    nome_cliente: 'Cliente',
    cpf_mascarado: '123.***.***-00',
    data_entrega: '17/07/2026',
    endereco_completo: 'Rua Teste, 1',
    endereco_curto: 'Rua Teste, 1',
    pedidos_venda: ['PV1'],
    produtos: [],
    tempo_para_entrega: '10 dias',
    tempo_servico: '30 min',
    equipe_agenda: 'Equipe A',
    pendente_pagamento: 'Nao',
    status_estoque: 'Completo',
    produtos_pendentes: '',
    eventos: [
      {
        pedido_venda: 'PV1',
        evento_id: 'evt-1',
        calendar_id: 'cal-1',
        tempo_servico: '30 min',
        equipe_agenda: 'Equipe A',
        data_agenda_google: '17/07/2026',
        endereco_cliente: 'Rua Teste, 1',
      },
      {
        pedido_venda: 'PV1',
        evento_id: 'evt-1',
        calendar_id: 'cal-1',
        tempo_servico: '30 min',
        equipe_agenda: 'Equipe A',
        data_agenda_google: '17/07/2026',
        endereco_cliente: 'Rua Teste, 1',
      },
    ],
    itens_originais: [],
  };
}

function eventoOriginal(parcial: Partial<EventoCalendar> = {}): EventoCalendar {
  return {
    id: 'evt-1',
    summary: 'Entrega PV1',
    description: 'Descricao',
    location: 'Rua Teste, 1',
    start: { date: '2026-07-17' },
    end: { date: '2026-07-18' },
    ...parcial,
  };
}

describe('reagendamento-calendar', () => {
  it('deduplica por calendar_id e evento_id', () => {
    expect(deduplicarEventosGrupo(grupoBase())).toHaveLength(1);
  });

  it('monta duplicado all-day com prefixo apenas uma vez', () => {
    const duplicado = montarEventoDuplicado(eventoOriginal({ summary: '[REAG. AUTOMATICO] Entrega PV1' }), '2026-07-17');
    expect(duplicado.summary).toBe('[REAG. AUTOMATICO] Entrega PV1');
    expect(duplicado.start).toEqual({ date: '2026-07-17' });
    expect(duplicado.end).toEqual({ date: '2026-07-18' });
  });

  it('dry-run valida eventos sem chamar Google Calendar', async () => {
    const deps = {
      buscarEvento: vi.fn(),
      criarEvento: vi.fn(),
      atualizarEvento: vi.fn(),
    };

    const r = await executarReagendamentoCalendar({
      grupo: grupoBase(),
      dataOriginalISO: '2026-07-17',
      dataNovaISO: '2026-08-03',
      calendarWriteEnabled: false,
    }, deps);

    expect(r.ok).toBe(true);
    expect(r.status).toBe('dry_run');
    expect(r.eventos).toHaveLength(1);
    expect(deps.buscarEvento).not.toHaveBeenCalled();
    expect(deps.criarEvento).not.toHaveBeenCalled();
    expect(deps.atualizarEvento).not.toHaveBeenCalled();
  });

  it('duplica no calendario de reagendamento antes de mover o original', async () => {
    const deps = {
      buscarEvento: vi.fn().mockResolvedValue(eventoOriginal()),
      criarEvento: vi.fn().mockResolvedValue({ id: 'dup-1' } as EventoCalendar),
      atualizarEvento: vi.fn().mockResolvedValue(eventoOriginal({ start: { date: '2026-08-03' }, end: { date: '2026-08-04' } })),
    };

    const r = await executarReagendamentoCalendar({
      grupo: grupoBase(),
      dataOriginalISO: '2026-07-17',
      dataNovaISO: '2026-08-03',
      calendarWriteEnabled: true,
      calendarDestinoId: 'cal-reag',
    }, deps);

    expect(r.ok).toBe(true);
    expect(deps.criarEvento.mock.invocationCallOrder[0]).toBeLessThan(deps.atualizarEvento.mock.invocationCallOrder[0]);
    expect(deps.criarEvento.mock.calls[0][0]).toBe('cal-reag');
    expect(deps.atualizarEvento.mock.calls[0][2]).toMatchObject({
      start: { date: '2026-08-03' },
      end: { date: '2026-08-04' },
    });
  });

  it('bloqueia evento que nao e all-day antes de duplicar', async () => {
    const deps = {
      buscarEvento: vi.fn().mockResolvedValue(eventoOriginal({ start: { dateTime: '2026-07-17T10:00:00-03:00' } })),
      criarEvento: vi.fn(),
      atualizarEvento: vi.fn(),
    };

    const r = await executarReagendamentoCalendar({
      grupo: grupoBase(),
      dataOriginalISO: '2026-07-17',
      dataNovaISO: '2026-08-03',
      calendarWriteEnabled: true,
    }, deps);

    expect(r.ok).toBe(false);
    expect(r.erros[0].codigo).toBe('evento_nao_eh_dia_inteiro');
    expect(deps.criarEvento).not.toHaveBeenCalled();
  });

  it('registra falha parcial quando move falha apos duplicar', async () => {
    const deps = {
      buscarEvento: vi.fn().mockResolvedValue(eventoOriginal()),
      criarEvento: vi.fn().mockResolvedValue({ id: 'dup-1' } as EventoCalendar),
      atualizarEvento: vi.fn().mockRejectedValue(new Error('falhou patch')),
    };

    const r = await executarReagendamentoCalendar({
      grupo: grupoBase(),
      dataOriginalISO: '2026-07-17',
      dataNovaISO: '2026-08-03',
      calendarWriteEnabled: true,
    }, deps);

    expect(r.status).toBe('parcial');
    expect(r.eventos[0]).toMatchObject({
      status: 'erro',
      duplicate_event_id: 'dup-1',
      erro_codigo: 'falha_mover_original_apos_duplicar',
    });
  });
});
