import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GrupoAgendamento } from '@/lib/google/sheets-service-account';
import {
  executarConsultaDatasMere,
  filtrarDatasDisponiveisPorAcaoMere,
  geocodificarEnderecoMere,
  montarPayloadConsultaDatasMere,
  montarPayloadEnderecoMere,
  resolverTempoServicoGrupoMere,
  validarCamposConsultaMere,
  type CoordenadasMere,
} from './consulta-datas-mere';

const createServiceClientMock = vi.hoisted(() => vi.fn());
const buscarEnderecoNoGeoCacheMock = vi.hoisted(() => vi.fn());
const salvarEnderecoNoGeoCacheMock = vi.hoisted(() => vi.fn());
const buscarEnderecoLocationIqMock = vi.hoisted(() => vi.fn());
const consultarGoogleGeocodingMock = vi.hoisted(() => vi.fn());
const chamarAppsScriptProcurarDatasMock = vi.hoisted(() => vi.fn());
const pesquisarDatasV2Mock = vi.hoisted(() => vi.fn());

function normalizarCepTeste(valor: string | null | undefined): string {
  return String(valor ?? '').replace(/\D/g, '');
}

function normalizarTextoTeste(valor: string | null | undefined): string {
  return String(valor ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9,\-\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: createServiceClientMock,
}));

vi.mock('@/lib/procurar-datas/endereco-cache', () => ({
  buscarEnderecoNoGeoCache: buscarEnderecoNoGeoCacheMock,
  salvarEnderecoNoGeoCache: salvarEnderecoNoGeoCacheMock,
  normalizarCep: normalizarCepTeste,
  normalizarTexto: normalizarTextoTeste,
  normalizarNumeroEndereco: (valor: string | null | undefined) => String(valor ?? '').replace(/\D/g, ''),
  normalizarLogradouroParaComparacao: (valor: string | null | undefined) =>
    normalizarTextoTeste(valor).replace(/^(AV|AVENIDA|R|RUA|AL|ALAMEDA|TRAV|TRAVESSA|ROD|RODOVIA|EST|ESTRADA)\s+/, ''),
}));

vi.mock('@/lib/procurar-datas/locationiq', () => ({
  buscarEnderecoLocationIq: buscarEnderecoLocationIqMock,
}));

vi.mock('@/lib/procurar-datas/google-geocoding', () => ({
  consultarGoogleGeocodingEnderecoDificil: consultarGoogleGeocodingMock,
}));

vi.mock('@/lib/procurar-datas/apps-script', () => ({
  chamarAppsScriptProcurarDatas: chamarAppsScriptProcurarDatasMock,
}));

vi.mock('@/lib/procurar-datas/motor/pesquisar-datas-v2', () => ({
  pesquisarDatasV2: pesquisarDatasV2Mock,
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
    tempo_servico: '00:40',
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
  origem: 'geo_cache',
  estrategia: 'geo_cache_match_seguro',
  confidence: null,
  provider: 'teste',
  geoCacheId: 'geo-1',
  cepResolvido: '81320260',
  numeroResolvido: '201',
  geoCacheHit: true,
  geocodingProviderConsultado: false,
  geocodingProvider: null,
  geoCacheSalvo: false,
};

const enderecoValidado = {
  ok: true,
  lat: -25.4753682,
  lng: -49.3113747,
  enderecoCompleto: 'Rua Doutor Manoel Francisco Ferreira Correia, 201, Portao, Curitiba - PR, Brasil',
  display: 'Rua Doutor Manoel Francisco Ferreira Correia, 201, Portao, Curitiba - PR, Brasil',
  cep: '81320260',
  provider: 'locationiq',
  confidence: 0.8,
  address: {
    road: 'Rua Doutor Manoel Francisco Ferreira Correia',
    house_number: '201',
    suburb: 'Portao',
    city: 'Curitiba',
    state: 'PR',
    postcode: '81320260',
  },
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
    buscarEnderecoNoGeoCacheMock.mockResolvedValue({ status: 'miss', motivo: 'sem_match_seguro', candidatosAvaliados: 0 });
    buscarEnderecoLocationIqMock.mockResolvedValue({ status: 'failed', motivo: 'sem_resultado_valido' });
    consultarGoogleGeocodingMock.mockResolvedValue({ status: 'failed', motivo: 'google_status_ZERO_RESULTS' });
    chamarAppsScriptProcurarDatasMock.mockRejectedValue(new Error('appsscript indisponivel'));
    salvarEnderecoNoGeoCacheMock.mockResolvedValue({ ok: true, chaveEndereco: 'geo-cache-upsert' });
    pesquisarDatasV2Mock.mockResolvedValue({
      ok: true,
      erros: [],
      entradaNormalizada: {
        dataInicialISO: '2026-08-03',
        tempoNecessarioMin: 40,
        temCoordenadasDestino: true,
        isRural: false,
        isCondominio: false,
        avisos: [],
      },
      resultadoFinal: {
        resumo: {
          totalRecebidos: 1,
          totalElegiveis: 1,
          totalRecortados: 1,
        },
        candidatosFinais: [
          {
            dataISO: '2026-08-03',
            equipe: 'EQUIPE 1',
            tipo: 'normal',
            elegivel: true,
          },
        ],
      },
    });
  });

  it('usa tempo de servico valido de outro item do grupo quando o primeiro esta 00:00', () => {
    const grupo = grupoBase({
      tempo_servico: '00:00',
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

  it.skip('resolve coordenadas por CEP + numero e nao tenta outras estrategias', async () => {
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

  it.skip('usa endereco completo quando CEP + numero nao encontra', async () => {
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

  it.skip('usa logradouro + numero + cidade + UF quando endereco completo nao encontra', async () => {
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

  it.skip('nao escolhe aleatoriamente quando CEP retorna multiplos candidatos', async () => {
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

  it.skip('rejeita lat/lng invalidos do geo_cache', async () => {
    mockGeoCacheResultados([
      { data: [criarGeoCacheRow({ lat: 0, lng: 0 })], error: null },
    ]);

    const resultado = await geocodificarEnderecoMere(grupoBase().endereco_completo);

    expect(resultado).toEqual({ ok: false, motivo: 'geo_cache_lat_lng_invalidos', candidatos: 1 });
  });

  it.skip('retorna geo_cache_nao_resolvido quando nenhuma estrategia encontra', async () => {
    mockGeoCacheResultados([
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
    ]);

    const resultado = await geocodificarEnderecoMere(grupoBase().endereco_completo);

    expect(resultado).toEqual({ ok: false, motivo: 'geo_cache_nao_resolvido' });
  });

  it('monta payload de endereco equivalente ao de procurar-datas', () => {
    expect(montarPayloadEnderecoMere(grupoBase().endereco_completo)).toMatchObject({
      logradouro: 'Rua Doutor Manoel Francisco Ferreira Correia',
      numero: '201',
      bairro: 'Portao',
      cidade: 'Curitiba',
      uf: 'PR',
      cep: '81320260',
    });
  });

  it('usa geo_cache quando existe hit e nao chama provider', async () => {
    buscarEnderecoNoGeoCacheMock.mockResolvedValueOnce({
      status: 'hit',
      motivo: 'match_seguro',
      resultado: { ...enderecoValidado, provider: 'supabase', cache: 'geo_cache', chaveEndereco: 'geo-1' },
    });

    const resultado = await geocodificarEnderecoMere(grupoBase().endereco_completo, { sessaoId: 'sessao-1' });

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.coordenadas.fonte).toBe('geo_cache');
      expect(resultado.coordenadas.geoCacheHit).toBe(true);
      expect(resultado.coordenadas.geoCacheId).toBe('geo-1');
    }
    expect(buscarEnderecoLocationIqMock).not.toHaveBeenCalled();
    expect(consultarGoogleGeocodingMock).not.toHaveBeenCalled();
    expect(salvarEnderecoNoGeoCacheMock).not.toHaveBeenCalled();
  });

  it('quando cache falha e provider resolve, salva geo_cache e continua consulta de datas', async () => {
    buscarEnderecoLocationIqMock.mockResolvedValueOnce({ status: 'success', resultado: enderecoValidado, reservaUsada: false });

    const resultado = await executarConsultaDatasMere({
      grupo: grupoBase(),
      dataDesejadaISO: '2026-08-03',
      sessaoId: 'sessao-provider',
    });

    expect(buscarEnderecoNoGeoCacheMock).toHaveBeenCalled();
    expect(buscarEnderecoLocationIqMock).toHaveBeenCalled();
    expect(salvarEnderecoNoGeoCacheMock).toHaveBeenCalledWith(
      expect.objectContaining({ cep: '81320260', numero: '201', cidade: 'Curitiba', uf: 'PR' }),
      expect.objectContaining({ lat: enderecoValidado.lat, lng: enderecoValidado.lng, provider: 'locationiq' })
    );
    expect(pesquisarDatasV2Mock).toHaveBeenCalledWith(expect.objectContaining({
      destLat: enderecoValidado.lat,
      destLng: enderecoValidado.lng,
      cep: '81320260',
      numero: '201',
      cidade: 'Curitiba',
      uf: 'PR',
    }));
    expect(resultado.estado).toBe('datas_encontradas');
    expect(resultado.geoCacheHit).toBe(false);
    expect(resultado.geocodingProvider).toBe('locationiq');
    expect(resultado.geoCacheSalvo).toBe(true);
  });

  it('quando cache nao encontra e providers falham, retorna motivo controlado sem chamar motor', async () => {
    const resultado = await executarConsultaDatasMere({
      grupo: grupoBase(),
      dataDesejadaISO: '2026-08-03',
      sessaoId: 'sessao-falha',
    });

    expect(resultado.estado).toBe('erro_coordenadas');
    expect(resultado.motivo).toBe('geocoding_provider_falhou');
    expect(resultado.geocodingProviderConsultado).toBe(true);
    expect(pesquisarDatasV2Mock).not.toHaveBeenCalled();
  });

  it('nao chama provider quando endereco esta incompleto', async () => {
    const resultado = await executarConsultaDatasMere({
      grupo: grupoBase({ endereco_completo: 'Rua Sem Numero, Curitiba, PR' }),
      dataDesejadaISO: '2026-08-03',
      sessaoId: 'sessao-incompleto',
    });

    expect(resultado.estado).toBe('erro_coordenadas');
    expect(resultado.motivo).toBe('endereco_incompleto_para_geocoding');
    expect(buscarEnderecoNoGeoCacheMock).not.toHaveBeenCalled();
    expect(buscarEnderecoLocationIqMock).not.toHaveBeenCalled();
    expect(pesquisarDatasV2Mock).not.toHaveBeenCalled();
  });

  it('bloqueia coordenadas invalidas do provider e nao chama motor', async () => {
    buscarEnderecoLocationIqMock.mockResolvedValueOnce({
      status: 'success',
      resultado: { ...enderecoValidado, lat: 0, lng: 0 },
      reservaUsada: false,
    });

    const resultado = await executarConsultaDatasMere({
      grupo: grupoBase(),
      dataDesejadaISO: '2026-08-03',
      sessaoId: 'sessao-coordenada-invalida',
    });

    expect(resultado.estado).toBe('erro_coordenadas');
    expect(resultado.motivo).toBe('geo_cache_lat_lng_invalidos');
    expect(pesquisarDatasV2Mock).not.toHaveBeenCalled();
  });

  it('caso real com geo_cache_nao_resolvido nao para no cache miss', async () => {
    buscarEnderecoNoGeoCacheMock.mockResolvedValueOnce({ status: 'miss', motivo: 'geo_cache_nao_resolvido', candidatosAvaliados: 0 });
    buscarEnderecoLocationIqMock.mockResolvedValueOnce({ status: 'success', resultado: enderecoValidado, reservaUsada: false });

    const resultado = await executarConsultaDatasMere({
      grupo: grupoBase(),
      dataDesejadaISO: '2026-08-03',
      sessaoId: 'b85ec798-6801-4073-81f6-a2ac97aaa0ff',
    });

    expect(buscarEnderecoLocationIqMock).toHaveBeenCalled();
    expect(salvarEnderecoNoGeoCacheMock).toHaveBeenCalled();
    expect(pesquisarDatasV2Mock).toHaveBeenCalled();
    expect(resultado.estado).toBe('datas_encontradas');
  });

  it('adiantar exibe apenas datas anteriores e remove a data atual', () => {
    const filtro = filtrarDatasDisponiveisPorAcaoMere({
      dataAtualISO: '2026-08-13',
      acao: 'adiantar',
      datas: [
        { dataISO: '2026-08-05', dataBR: '05/08/2026', equipe: 'EQUIPE 1', tipo: 'normal', rank: 1 },
        { dataISO: '2026-08-08', dataBR: '08/08/2026', equipe: 'EQUIPE 1', tipo: 'normal', rank: 2 },
        { dataISO: '2026-08-13', dataBR: '13/08/2026', equipe: 'EQUIPE 1', tipo: 'normal', rank: 3 },
      ],
    });

    expect(filtro.datasExibidas.map((d) => `${d.rank}:${d.dataISO}`)).toEqual([
      '1:2026-08-05',
      '2:2026-08-08',
    ]);
    expect(filtro.removidasMesmaData).toBe(1);
    expect(filtro.removidasContrariasAcao).toBe(0);
  });

  it('adiantar sem opcoes anteriores separa posteriores para oferta de postergar', () => {
    const filtro = filtrarDatasDisponiveisPorAcaoMere({
      dataAtualISO: '2026-08-13',
      acao: 'adiantar',
      datas: [
        { dataISO: '2026-08-13', dataBR: '13/08/2026', equipe: 'EQUIPE 1', tipo: 'normal', rank: 1 },
        { dataISO: '2026-08-21', dataBR: '21/08/2026', equipe: 'EQUIPE 1', tipo: 'normal', rank: 2 },
        { dataISO: '2026-08-25', dataBR: '25/08/2026', equipe: 'EQUIPE 1', tipo: 'normal', rank: 3 },
      ],
    });

    expect(filtro.datasExibidas).toEqual([]);
    expect(filtro.datasPosteriores.map((d) => `${d.rank}:${d.dataISO}`)).toEqual([
      '1:2026-08-21',
      '2:2026-08-25',
    ]);
    expect(filtro.removidasMesmaData).toBe(1);
    expect(filtro.removidasContrariasAcao).toBe(2);
    expect(filtro.semOpcoesParaAcao).toBe(true);
  });

  it('postergar exibe apenas datas posteriores e remove a data atual', () => {
    const filtro = filtrarDatasDisponiveisPorAcaoMere({
      dataAtualISO: '2026-08-13',
      acao: 'postergar',
      datas: [
        { dataISO: '2026-08-13', dataBR: '13/08/2026', equipe: 'EQUIPE 1', tipo: 'normal', rank: 1 },
        { dataISO: '2026-08-21', dataBR: '21/08/2026', equipe: 'EQUIPE 1', tipo: 'normal', rank: 2 },
        { dataISO: '2026-08-25', dataBR: '25/08/2026', equipe: 'EQUIPE 1', tipo: 'normal', rank: 3 },
      ],
    });

    expect(filtro.datasExibidas.map((d) => `${d.rank}:${d.dataISO}`)).toEqual([
      '1:2026-08-21',
      '2:2026-08-25',
    ]);
    expect(filtro.removidasMesmaData).toBe(1);
  });

  it('postergar sem opcoes posteriores nao exibe datas anteriores', () => {
    const filtro = filtrarDatasDisponiveisPorAcaoMere({
      dataAtualISO: '2026-08-13',
      acao: 'postergar',
      datas: [
        { dataISO: '2026-08-05', dataBR: '05/08/2026', equipe: 'EQUIPE 1', tipo: 'normal', rank: 1 },
        { dataISO: '2026-08-08', dataBR: '08/08/2026', equipe: 'EQUIPE 1', tipo: 'normal', rank: 2 },
        { dataISO: '2026-08-13', dataBR: '13/08/2026', equipe: 'EQUIPE 1', tipo: 'normal', rank: 3 },
      ],
    });

    expect(filtro.datasExibidas).toEqual([]);
    expect(filtro.removidasMesmaData).toBe(1);
    expect(filtro.removidasContrariasAcao).toBe(2);
  });
});
