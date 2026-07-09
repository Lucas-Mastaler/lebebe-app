import { describe, expect, it } from 'vitest';
import type { GrupoAgendamento } from '@/lib/google/sheets-service-account';
import {
  montarPayloadConsultaDatasMere,
  resolverTempoServicoGrupoMere,
  validarCamposConsultaMere,
  type CoordenadasMere,
} from './consulta-datas-mere';

function grupoBase(parcial: Partial<GrupoAgendamento> = {}): GrupoAgendamento {
  return {
    indice: 1,
    nome_cliente: 'RAQUEL DA SILVA',
    cpf_mascarado: '109.***.***-14',
    data_entrega: '17/07/2026',
    endereco_completo: 'Rua Doutor Manoel Francisco Ferreira Correia, 201, Portao, Curitiba, PR - 81320-260',
    endereco_curto: 'Rua Doutor Manoel Francisco Ferreira Correia, 201...',
    pedidos_venda: ['65469'],
    produtos: ['Produto A'],
    tempo_para_entrega: '8',
    tempo_servico: '00:00',
    equipe_agenda: 'EQUIPE 1',
    pendente_pagamento: 'Nao',
    status_estoque: 'Completo',
    produtos_pendentes: '',
    eventos: [],
    itens_originais: [],
    ...parcial,
  };
}

const coordenadas: CoordenadasMere = {
  lat: -25.4753682,
  lng: -49.3113747,
  fonte: 'geo_cache',
  confidence: null,
  provider: 'teste',
  geoCacheId: 'geo-1',
  cepResolvido: '81320260',
  numeroResolvido: '201',
};

describe('consulta-datas-mere', () => {
  it('usa tempo de servico valido de outro item do grupo quando o primeiro esta 00:00', () => {
    const grupo = grupoBase({
      eventos: [
        {
          pedido_venda: '65469',
          evento_id: 'evt-1',
          calendar_id: 'cal-1',
          tempo_servico: '00:00',
          equipe_agenda: 'EQUIPE 1',
          data_agenda_google: '17/07/2026',
          endereco_cliente: 'Rua X, 201',
        },
        {
          pedido_venda: '65470',
          evento_id: 'evt-2',
          calendar_id: 'cal-1',
          tempo_servico: '00:40',
          equipe_agenda: 'EQUIPE 1',
          data_agenda_google: '17/07/2026',
          endereco_cliente: 'Rua X, 201',
        },
      ],
    });

    expect(resolverTempoServicoGrupoMere(grupo)).toBe('00:40');
    expect(montarPayloadConsultaDatasMere(grupo, '2026-07-30', coordenadas).tempoNecessario).toBe('00:40');
  });

  it('normaliza tempo de servico em minutos para HH:MM', () => {
    expect(resolverTempoServicoGrupoMere(grupoBase({ tempo_servico: '40 min' }))).toBe('00:40');
    expect(resolverTempoServicoGrupoMere(grupoBase({ tempo_servico: '40' }))).toBe('00:40');
  });

  it('bloqueia consulta quando nenhum tempo de servico valido existe', () => {
    const validacao = validarCamposConsultaMere({
      dataDesejadaISO: '2026-07-30',
      grupo: grupoBase({ tempo_servico: '00:00' }),
      coordenadas,
    });

    expect(validacao.ok).toBe(false);
    if (!validacao.ok) {
      expect(validacao.motivo).toBe('tempo_servico_indisponivel');
      expect(validacao.camposFaltando).toContain('tempo_servico');
    }
  });
});
