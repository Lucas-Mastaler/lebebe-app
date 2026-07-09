import { describe, it, expect } from 'vitest';
import { agruparAgendamentosPorEntrega, type AgendamentoEncontrado } from './sheets-service-account';

function baseItem(parcial: Partial<AgendamentoEncontrado> = {}): AgendamentoEncontrado {
  return {
    filial_venda: 'Filial A',
    nome_cliente: 'RAQUEL DA SILVA',
    pedido_venda: '65469',
    data_agenda_google: '17/07/2026',
    status_estoque: 'Completo',
    quanto_tempo_entrega: '15 dias',
    produtos_pendentes: '',
    endereco_cliente: 'Rua das Flores, 123, Curitiba, PR',
    produtos_lancamento: 'Carrinho;Berço',
    equipe_agenda: 'Equipe A',
    pendente_pagamento: 'Não',
    cpf_mascarado: '109.***.***-14',
    tempo_servico: '30 min',
    evento_id: 'evt-1',
    calendar_id: 'cal-1',
    ...parcial,
  };
}

describe('agruparAgendamentosPorEntrega', () => {
  it('agrupa dois registros com mesma data e mesmo endereco em um unico grupo', () => {
    const agendamentos = [
      baseItem({ pedido_venda: '65469', produtos_lancamento: 'Carrinho' }),
      baseItem({ pedido_venda: '65470', produtos_lancamento: 'Berço' }),
    ];

    const grupos = agruparAgendamentosPorEntrega(agendamentos);

    expect(grupos).toHaveLength(1);
    expect(grupos[0].pedidos_venda).toEqual(['65469', '65470']);
    expect(grupos[0].produtos).toEqual(['Carrinho', 'Berço']);
    expect(grupos[0].eventos).toHaveLength(2);
    expect(grupos[0].indice).toBe(1);
    expect(grupos[0].data_entrega).toBe('17/07/2026');
  });

  it('cria dois grupos quando enderecos sao diferentes', () => {
    const agendamentos = [
      baseItem({ pedido_venda: '65469' }),
      baseItem({ pedido_venda: '65470', endereco_cliente: 'Av. Brasil, 500, Curitiba, PR' }),
    ];

    const grupos = agruparAgendamentosPorEntrega(agendamentos);

    expect(grupos).toHaveLength(2);
    expect(grupos[0].pedidos_venda).toEqual(['65469']);
    expect(grupos[1].pedidos_venda).toEqual(['65470']);
    expect(grupos[1].indice).toBe(2);
  });

  it('cria dois grupos quando datas sao diferentes', () => {
    const agendamentos = [
      baseItem({ pedido_venda: '65469' }),
      baseItem({ pedido_venda: '65470', data_agenda_google: '18/07/2026' }),
    ];

    const grupos = agruparAgendamentosPorEntrega(agendamentos);

    expect(grupos).toHaveLength(2);
    expect(grupos[0].data_entrega).toBe('17/07/2026');
    expect(grupos[1].data_entrega).toBe('18/07/2026');
  });

  it('retorna um grupo para um unico registro', () => {
    const agendamentos = [baseItem()];

    const grupos = agruparAgendamentosPorEntrega(agendamentos);

    expect(grupos).toHaveLength(1);
    expect(grupos[0].pedidos_venda).toEqual(['65469']);
    expect(grupos[0].endereco_curto).toBe('Rua das Flores, 123...');
  });

  it('retorna lista vazia quando nao ha registros', () => {
    const grupos = agruparAgendamentosPorEntrega([]);
    expect(grupos).toHaveLength(0);
  });

  it('remove duplicados de pedidos e produtos dentro do grupo', () => {
    const agendamentos = [
      baseItem({ pedido_venda: '65469', produtos_lancamento: 'Carrinho;Berço' }),
      baseItem({ pedido_venda: '65469', produtos_lancamento: 'Carrinho;Mesa' }),
    ];

    const grupos = agruparAgendamentosPorEntrega(agendamentos);

    expect(grupos).toHaveLength(1);
    expect(grupos[0].pedidos_venda).toEqual(['65469']);
    expect(grupos[0].produtos).toEqual(['Carrinho', 'Berço', 'Mesa']);
  });

  it('mantem tempo de servico valido quando primeiro registro do grupo esta 00:00', () => {
    const agendamentos = [
      baseItem({ pedido_venda: '65469', tempo_servico: '00:00' }),
      baseItem({ pedido_venda: '65470', tempo_servico: '00:40' }),
    ];

    const grupos = agruparAgendamentosPorEntrega(agendamentos);

    expect(grupos).toHaveLength(1);
    expect(grupos[0].tempo_servico).toBe('00:40');
  });

  it('normaliza enderecos equivalentes para mesma chave', () => {
    const agendamentos = [
      baseItem({ pedido_venda: '65469', endereco_cliente: 'Rua das Flores, 123 - CURITIBA/PR' }),
      baseItem({ pedido_venda: '65470', endereco_cliente: '  rua das flores 123, curitiba pr  ' }),
    ];

    const grupos = agruparAgendamentosPorEntrega(agendamentos);

    expect(grupos).toHaveLength(1);
    expect(grupos[0].pedidos_venda).toEqual(['65469', '65470']);
  });
});
