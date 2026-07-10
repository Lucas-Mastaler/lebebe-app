import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GrupoAgendamento } from '@/lib/google/sheets-service-account';
import {
  geocodificarEnderecoMere,
  montarPayloadConsultaDatasMere,
  resolverTempoServicoGrupoMere,
  validarCamposConsultaMere,
  type CoordenadasMere,
} from './consulta-datas-mere';

const createServiceClientMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: createServiceClientMock,
}));

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
  origem: 'geo_cache_cep_numero',
  estrategia: 'cep_numero',
  confidence: null,
  provider: 'teste',
  geoCacheId: 'geo-1',
  cepResolvido: '81320260',
  numeroResolvido: '201',
};

type QueryResult = { data: unknown[] | null; error: { message: string } | null };

function criarGeoCacheRow(parcial: Record<string, unknown> = {}) {
  return {
    chave_endereco: 'geo-1',
    lat: -25.4753682,
    lng: -49.3113747,
    endereco_completo: 'Rua Doutor Manoel Francisco Ferreira Correia, 201, Portao, Curitiba, PR - 81320-260',
    logradouro: 'Rua Doutor Manoel Francisco Ferreira Correia',
    numero: '201',
    bairro: 'Portao',
    cidade: 'Curitiba',
    uf: 'PR',
    cep: '81320260',
    confidence: 0.9,
    provider: 'locationiq',
    updated_at: '2026-07-10T10:00:00.000Z',
    ...parcial,
  };
}

function mockGeoCacheResultados(resultados: QueryResult[]) {
  const builders = resultados.map((resultado) => {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      ilike: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(async () => resultado),
    };
    return builder;
  });
  const from = vi.fn(() => {
    const builder = builders.shift();
    if (!builder) throw new Error('Consulta geo_cache inesperada no teste');
    return builder;
  });
  createServiceClientMock.mockReturnValue({ from });
  return { from };
}

describe('consulta-datas-mere', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  it('resolve coordenadas por CEP + numero e nao tenta outras estrategias', async () => {
    const { from } = mockGeoCacheResultados([{ data: [criarGeoCacheRow()], error: null }]);

    const resultado = await geocodificarEnderecoMere(grupoBase().endereco_completo);

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.coordenadas.origem).toBe('geo_cache_cep_numero');
      expect(resultado.coordenadas.estrategia).toBe('cep_numero');
      expect(resultado.coordenadas.lat).toBe(-25.4753682);
      expect(resultado.coordenadas.lng).toBe(-49.3113747);
    }
    expect(from).toHaveBeenCalledTimes(1);
  });

  it('usa endereco completo quando CEP + numero nao encontra', async () => {
    mockGeoCacheResultados([
      { data: [], error: null },
      { data: [criarGeoCacheRow({ chave_endereco: 'geo-endereco' })], error: null },
    ]);

    const resultado = await geocodificarEnderecoMere(grupoBase().endereco_completo);

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.coordenadas.origem).toBe('geo_cache_endereco_completo');
      expect(resultado.coordenadas.geoCacheId).toBe('geo-endereco');
    }
  });

  it('usa logradouro + numero + cidade + UF quando endereco completo nao encontra', async () => {
    mockGeoCacheResultados([
      { data: [], error: null },
      { data: [], error: null },
      { data: [criarGeoCacheRow({ chave_endereco: 'geo-logradouro' })], error: null },
    ]);

    const resultado = await geocodificarEnderecoMere(grupoBase().endereco_completo);

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.coordenadas.origem).toBe('geo_cache_logradouro_numero');
      expect(resultado.coordenadas.geoCacheId).toBe('geo-logradouro');
    }
  });

  it('nao escolhe aleatoriamente quando CEP retorna multiplos candidatos', async () => {
    mockGeoCacheResultados([
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      {
        data: [
          criarGeoCacheRow({ chave_endereco: 'geo-a', numero: '100' }),
          criarGeoCacheRow({ chave_endereco: 'geo-b', numero: '200' }),
        ],
        error: null,
      },
    ]);

    const resultado = await geocodificarEnderecoMere(grupoBase().endereco_completo);

    expect(resultado).toEqual({ ok: false, motivo: 'geo_cache_ambiguo', candidatos: 2 });
  });

  it('rejeita lat/lng invalidos do geo_cache', async () => {
    mockGeoCacheResultados([
      { data: [criarGeoCacheRow({ lat: 0, lng: 0 })], error: null },
    ]);

    const resultado = await geocodificarEnderecoMere(grupoBase().endereco_completo);

    expect(resultado).toEqual({ ok: false, motivo: 'geo_cache_lat_lng_invalidos', candidatos: 1 });
  });

  it('retorna geo_cache_nao_resolvido quando nenhuma estrategia encontra', async () => {
    mockGeoCacheResultados([
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
    ]);

    const resultado = await geocodificarEnderecoMere(grupoBase().endereco_completo);

    expect(resultado).toEqual({ ok: false, motivo: 'geo_cache_nao_resolvido' });
  });
});
