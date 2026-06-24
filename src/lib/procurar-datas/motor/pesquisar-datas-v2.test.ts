import { beforeEach, describe, expect, it, vi } from 'vitest'
import { pesquisarDatasV2 } from './pesquisar-datas-v2'

const buscarConfigMock = vi.hoisted(() => vi.fn())
const buscarDisponibilidadeMock = vi.hoisted(() => vi.fn())
const buscarAgendaMock = vi.hoisted(() => vi.fn())
const resolverCacheMock = vi.hoisted(() => vi.fn())
const calcularMapaMock = vi.hoisted(() => vi.fn())
const criarBuscarMatrizMock = vi.hoisted(() => vi.fn(() => vi.fn()))
const buscarRotaMock = vi.hoisted(() => vi.fn())
const criarBuscarRotaMock = vi.hoisted(() => vi.fn(() => buscarRotaMock))

vi.mock('../config-service', () => ({
  buscarConfiguracoesProcurarDatas: buscarConfigMock,
}))

vi.mock('./disponibilidade-real-helper', () => ({
  buscarDisponibilidadeRealDiagnosticaComDados: buscarDisponibilidadeMock,
}))

vi.mock('./agenda-real-helper', () => ({
  buscarAgendaRealDiagnosticaComDados: buscarAgendaMock,
}))

vi.mock('./cache-coordenadas-agenda-diagnostico', () => ({
  resolverCacheCoordenadasAgendaDiagnostico: resolverCacheMock,
}))

vi.mock('./calcular-mapa-km-adicional-por-slot', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./calcular-mapa-km-adicional-por-slot')>()
  return {
    ...actual,
    calcularMapaKmAdicionalPorSlotControladoV2: calcularMapaMock,
  }
})

vi.mock('./osrm-table-client-diagnostico', () => ({
  criarBuscarMatrizOSRMTableDiagnosticoV2: criarBuscarMatrizMock,
}))

vi.mock('./osrm-route-client-diagnostico', () => ({
  criarBuscarRotaOSRMRouteDiagnosticoV2: criarBuscarRotaMock,
}))

describe('pesquisarDatasV2', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    buscarConfigMock.mockResolvedValue({
      ok: true,
      origem: 'supabase',
      faltantesNoSupabase: [],
      usandoFallbackPlanilha: false,
      lido_em: '2026-06-22T00:00:00.000Z',
      config: {
        supabaseTable: 'geo_cache',
        diasPesquisaAgenda: 5,
        osrmBaseUrl: 'https://osrm.lebebe.cloud',
        equipe1Ativa: true,
        equipe2Ativa: false,
        latDeposito: -25.4876648,
        lngDeposito: -49.2692262,
        latCasaE1: -25.494297,
        lngCasaE1: -49.277091,
        latCasaE2: -25.494297,
        lngCasaE2: -49.277091,
        kmAdicionalMaxNaRotaM: 5000,
        kmAdicionalMaxNaRotaEspecialM: 8000,
        kmAdicionalMaxNaRotaPremiumM: 15000,
        kmMaximoNaSemanaM: 40000,
        kmMaximoNoSabadoM: 45000,
        horaMarcadaHorasAMais: 2,
      },
    })
    buscarDisponibilidadeMock.mockResolvedValue({
      diagnostico: { ok: true, executado: true },
      disponibilidades: [
        { dataISO: '2026-07-10', equipe: 'EQUIPE 1', disponivelMin: 300, ativa: true },
        { dataISO: '2026-07-11', equipe: 'EQUIPE 1', disponivelMin: 300, ativa: true },
        { dataISO: '2026-07-13', equipe: 'EQUIPE 1', disponivelMin: 300, ativa: true },
        { dataISO: '2026-07-14', equipe: 'EQUIPE 1', disponivelMin: 300, ativa: true },
      ],
    })
    buscarAgendaMock.mockResolvedValue({
      diagnostico: { ok: true, executado: true },
      linhasAgenda: [
        ['14/07/2026 00:00:00', '', 'Entrega 55576', '', '', 'Rua Maria Zanao Machado, 219, Gralha Azul, Fazenda Rio Grande - PR, 83824-543', '4- EQUIPE 01'],
        ['14/07/2026 00:00:00', '', 'Entrega 64973', '', '', 'Avenida Mato Grosso, 2464, Estados, Fazenda Rio Grande - PR, 83830-481', '4- EQUIPE 01'],
      ],
    })
    resolverCacheMock.mockResolvedValue({
      cacheCoordenadasPorEndereco: {
        'rua maria zanao machado, 219, gralha azul, fazenda rio grande - pr, 83824-543': {
          lat: -25.6841821,
          lng: -49.3046792,
        },
        'avenida mato grosso, 2464, estados, fazenda rio grande - pr, 83830-481': {
          lat: -25.6705907,
          lng: -49.3320594,
        },
      },
      hashesConsultados: 2,
      hitsSupabase: 2,
      enderecosSemHash: 0,
      avisos: ['Cache Supabase de coordenadas da agenda: 2/2 hit(s).'],
    })
    calcularMapaMock.mockResolvedValue({
      ok: true,
      modo: 'mapa-km-adicional-por-slot-diagnostico',
      mapa: {
        '2026-07-10::EQUIPE 1': 33100,
        '2026-07-11::EQUIPE 1': 32241,
        '2026-07-13::EQUIPE 1': 33100,
        '2026-07-14::EQUIPE 1': 11533,
      },
      detalhesPorSlot: [
        detalheSlot('2026-07-10::EQUIPE 1', 0),
        detalheSlot('2026-07-11::EQUIPE 1', 0),
        detalheSlot('2026-07-13::EQUIPE 1', 0),
        detalheSlot('2026-07-14::EQUIPE 1', 2),
      ],
      contadores: {
        slotsRecebidos: 5,
        slotsProcessados: 5,
        slotsComKm: 4,
        slotsComFallbackHaversine: 0,
        slotsComErro: 0,
        slotsDescartados: 0,
      },
      avisos: [],
      erros: [],
    })
    buscarRotaMock.mockResolvedValue({ ok: true, distanciaM: 1000 })
  })

  it('executa fluxo v2 real paralelo com recorte maxNormais=3 e cache Supabase automatico', async () => {
    const result = await pesquisarDatasV2({
      cep: '83800-000',
      dataInicial: '2026-07-10',
      tempoNecessario: '00:40',
      destLat: -25.769705,
      destLng: -49.325586,
      destDisplay: 'R. Jose Schueda Sobrinho, Mandirituba - PR',
    } as never)

    expect(result.ok).toBe(true)
    expect(result.modo).toBe('v2-pesquisar-paralelo')
    expect(result.resultadoFinal.resumo.maxNormaisAplicado).toBe(3)
    expect(result.resultadoFinal.resumo.normaisRecortados).toBe(3)
    // Premium 07-14 removido pela regra full-window: 07-14 >= última normal 07-13
    expect(result.resultadoFinal.resumo.premiumsRecortados).toBe(0)
    expect(result.resultadoFinal.candidatosFinais.map((c) => `${c.dataISO}:${c.tipo}`)).toEqual([
      '2026-07-10:normal',
      '2026-07-11:normal',
      '2026-07-13:normal',
    ])
    expect(result.diagnosticoMinimo.osrmBaseUrlUsado).toBe('https://osrm.lebebe.cloud')
    expect(result.diagnosticoMinimo.osrmFallbackUsado).toBe(false)
    expect(result.diagnosticoMinimo.cacheAgenda.hitsSupabase).toBe(2)
    expect(result.diagnosticoMinimo.quantidadeSlotsComPontos).toBe(1)
    expect(result.diagnosticoMinimo.quantidadeSlotsSemPontos).toBe(3)
    expect(resolverCacheMock).toHaveBeenCalledWith(
      expect.objectContaining({
        supabaseTable: 'geo_cache',
      })
    )
    expect(criarBuscarMatrizMock).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: 'https://osrm.lebebe.cloud',
      })
    )
    expect(calcularMapaMock).toHaveBeenCalledWith(
      expect.objectContaining({
        incluirDetalhesInsercao: false,
      })
    )
  })

  it('nao mantem 27/06 como normal quando Sao Lourenco entra no mapa por slot', async () => {
    buscarDisponibilidadeMock.mockResolvedValueOnce({
      diagnostico: { ok: true, executado: true },
      disponibilidades: [
        { dataISO: '2026-06-27', equipe: 'EQUIPE 1', disponivelMin: 300, ativa: true },
        { dataISO: '2026-07-02', equipe: 'EQUIPE 1', disponivelMin: 300, ativa: true },
        { dataISO: '2026-07-11', equipe: 'EQUIPE 1', disponivelMin: 300, ativa: true },
        { dataISO: '2026-07-13', equipe: 'EQUIPE 1', disponivelMin: 300, ativa: true },
      ],
    })
    buscarAgendaMock.mockResolvedValueOnce({
      diagnostico: { ok: true, executado: true },
      linhasAgenda: [
        ['27/06/2026 00:00:00', '', 'Entrega Sao Lourenco', '', '', 'Rua Greg\u00f3rio de Matos, 708, S\u00e3o Louren\u00e7o, Curitiba - PR, 82200-110', '4- EQUIPE 01'],
      ],
    })
    resolverCacheMock.mockResolvedValueOnce({
      cacheCoordenadasPorEndereco: {
        'rua greg\u00f3rio de matos, 708, s\u00e3o louren\u00e7o, curitiba - pr, 82200-110': {
          lat: -25.3953811,
          lng: -49.2684535,
        },
      },
      hashesConsultados: 1,
      hitsSupabase: 1,
      enderecosSemHash: 0,
      avisos: ['Cache Supabase de coordenadas da agenda: 1/1 hit(s).'],
    })
    calcularMapaMock.mockResolvedValueOnce({
      ok: true,
      modo: 'mapa-km-adicional-por-slot-diagnostico',
      mapa: {
        '2026-06-27::EQUIPE 1': 15597,
        '2026-07-02::EQUIPE 1': 7650,
        '2026-07-11::EQUIPE 1': 4657,
        '2026-07-13::EQUIPE 1': 4019,
      },
      detalhesPorSlot: [
        detalheSlot('2026-06-27::EQUIPE 1', 1, 15597),
        detalheSlot('2026-07-02::EQUIPE 1', 2, 7650),
        detalheSlot('2026-07-11::EQUIPE 1', 0, 4657),
        detalheSlot('2026-07-13::EQUIPE 1', 0, 4019),
      ],
      contadores: {
        slotsRecebidos: 30,
        slotsProcessados: 30,
        slotsComKm: 4,
        slotsComFallbackHaversine: 0,
        slotsComErro: 0,
        slotsDescartados: 0,
      },
      avisos: [],
      erros: [],
    })

    const result = await pesquisarDatasV2({
      cep: '81925-370',
      dataInicial: '2026-06-25',
      tempoNecessario: '00:40',
      destLat: -25.545418,
      destLng: -49.261836,
      destDisplay: 'Rua Attilio Silva Fonseca, Sitio Cercado, Curitiba - PR',
    } as never)

    expect(result.ok).toBe(true)
    expect(result.resultadoFinal.candidatosFinais).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dataISO: '2026-06-27',
          equipe: 'EQUIPE 1',
          tipo: 'normal',
        }),
      ])
    )
    expect(result.diagnosticoMinimo.quantidadeSlotsComPontos).toBe(2)
    expect(result.diagnosticoMinimo.cacheAgenda.hitsSupabase).toBe(1)
  })

  it('com flag retorna diagnosticoResultadoTelaV2SantoAmaro para o payload exato da tela', async () => {
    buscarConfigMock.mockResolvedValueOnce({
      ok: true,
      origem: 'supabase',
      faltantesNoSupabase: [],
      usandoFallbackPlanilha: false,
      lido_em: '2026-06-24T00:00:00.000Z',
      config: {
        supabaseTable: 'geo_cache',
        diasPesquisaAgenda: 40,
        osrmBaseUrl: 'https://osrm.lebebe.cloud',
        equipe1Ativa: true,
        equipe2Ativa: false,
        latDeposito: -25.4876648,
        lngDeposito: -49.2692262,
        latCasaE1: -25.494297,
        lngCasaE1: -49.277091,
        latCasaE2: -25.494297,
        lngCasaE2: -49.277091,
        kmAdicionalMaxNaRotaM: 5000,
        kmAdicionalMaxNaRotaEspecialM: 8000,
        kmAdicionalMaxNaRotaPremiumM: 15000,
        kmMaximoNaSemanaM: 40000,
        kmMaximoNoSabadoM: 45000,
        horaMarcadaHorasAMais: 2,
      },
    })
    buscarDisponibilidadeMock.mockResolvedValueOnce({
      diagnostico: { ok: true, executado: true },
      disponibilidades: [
        { dataISO: '2026-07-02', equipe: 'EQUIPE 1', disponivelMin: 150, ativa: true },
        { dataISO: '2026-07-10', equipe: 'EQUIPE 1', disponivelMin: 300, ativa: true },
        { dataISO: '2026-07-16', equipe: 'EQUIPE 1', disponivelMin: 150, ativa: true },
        { dataISO: '2026-07-24', equipe: 'EQUIPE 1', disponivelMin: 150, ativa: true },
        { dataISO: '2026-07-25', equipe: 'EQUIPE 1', disponivelMin: 300, ativa: true },
        { dataISO: '2026-07-31', equipe: 'EQUIPE 1', disponivelMin: 300, ativa: true },
      ],
    })
    calcularMapaMock.mockResolvedValueOnce({
      ok: true,
      modo: 'mapa-km-adicional-por-slot-diagnostico',
      mapa: {
        '2026-07-02::EQUIPE 1': 7650,
        '2026-07-10::EQUIPE 1': 3000,
        '2026-07-16::EQUIPE 1': 16000,
        '2026-07-24::EQUIPE 1': 8000,
        '2026-07-25::EQUIPE 1': 3000,
        '2026-07-31::EQUIPE 1': 3000,
      },
      detalhesPorSlot: [
        detalheSlot('2026-07-02::EQUIPE 1', 1, 7650),
        detalheSlot('2026-07-10::EQUIPE 1', 0, 3000),
        detalheSlot('2026-07-16::EQUIPE 1', 1, 16000),
        detalheSlot('2026-07-24::EQUIPE 1', 1, 8000),
        detalheSlot('2026-07-25::EQUIPE 1', 0, 3000),
        detalheSlot('2026-07-31::EQUIPE 1', 0, 3000),
      ],
      contadores: {
        slotsRecebidos: 40,
        slotsProcessados: 40,
        slotsComKm: 6,
        slotsComFallbackHaversine: 0,
        slotsComErro: 0,
        slotsDescartados: 0,
      },
      avisos: [],
      erros: [],
    })

    const result = await pesquisarDatasV2({
      cep: '80620-220',
      enderecoCompleto: 'Rua Santo Amaro, Agua Verde, Curitiba, Parana, 80620-220, Brasil',
      logradouro: 'r. santo amaro',
      numero: '300',
      bairro: 'agua verde',
      cidade: 'curitiba',
      uf: 'PR',
      dataInicial: '2026-06-26',
      tempoNecessario: '2:05',
      isRural: false,
      isCondominio: true,
      isEncomenda: false,
      tipoBerco: 'DIVERSOS',
      comoda: '2 COMODAS',
      roupeiro: '',
      poltrona: '',
      painel: '',
      destLat: -25.4574104,
      destLng: -49.2753292,
    } as never, { diagnosticoResultadoTelaV2SantoAmaro: true })

    expect(result.ok).toBe(true)
    expect(result.diagnosticoResultadoTelaV2SantoAmaro).toBeDefined()
    const diagnostico = result.diagnosticoResultadoTelaV2SantoAmaro!
    expect(diagnostico.payloadExatoTelaEsperado).toMatchObject({
      dataInicial: '2026-06-26',
      cep: '80620-220',
      isCondominio: true,
      tempoNecessario: '2:05',
    })
    expect(diagnostico.analisePorData['2026-07-02'].candidatoGerado).toBe(true)
    expect(diagnostico.analisePorData['2026-07-02'].classificacaoAntesRecorte?.tipo).toBe('especial')
    expect(diagnostico.analisePorData['2026-07-02'].filtroEarlyHaversineLegado.aplicadoNaV2).toBe(false)
    expect(diagnostico.analisePorData['2026-07-16'].candidatoGerado).toBe(true)
    expect(diagnostico.analisePorData['2026-07-16'].classificacaoAntesRecorte?.tipo).toBe('indisponivel')
    expect(diagnostico.analisePorData['2026-07-24'].classificacaoAntesRecorte?.tipo).toBe('especial')
    expect(diagnostico.analisePorData['2026-07-25'].candidatoGerado).toBe(true)
    expect(diagnostico.analisePorData['2026-07-25'].classificacaoAntesRecorte?.tipo).toBe('normal')
    expect(diagnostico.recorteFinal.especiaisAntesRecorte.length).toBeGreaterThanOrEqual(2)
    expect(diagnostico.recorteFinal.exclusoesDatasAlvo.map((item) => item.dataISO)).toEqual([
      '2026-07-02',
      '2026-07-16',
      '2026-07-24',
      '2026-07-25',
    ])
    expect(diagnostico.recorteFinal.porQue02VenceuComoExtra).toContain('02/07 entrou')
    expect(diagnostico.comparacaoLegado.aplicaFiltroEarlyHaversineEquivalente).toBe(true)
    expect(calcularMapaMock).toHaveBeenCalledWith(
      expect.objectContaining({
        incluirDetalhesInsercao: true,
      })
    )
  })

  it('com flag de delta Santo Amaro expõe rota base, agenda_89 e comparativo route vs table sem alterar resultado', async () => {
    buscarConfigMock.mockResolvedValueOnce({
      ok: true,
      origem: 'supabase',
      faltantesNoSupabase: [],
      usandoFallbackPlanilha: false,
      lido_em: '2026-06-24T00:00:00.000Z',
      config: {
        supabaseTable: 'geo_cache',
        diasPesquisaAgenda: 40,
        osrmBaseUrl: 'https://osrm.lebebe.cloud',
        equipe1Ativa: true,
        equipe2Ativa: false,
        latDeposito: -25.4876648,
        lngDeposito: -49.2692262,
        latCasaE1: -25.494297,
        lngCasaE1: -49.277091,
        latCasaE2: -25.494297,
        lngCasaE2: -49.277091,
        kmAdicionalMaxNaRotaM: 5000,
        kmAdicionalMaxNaRotaEspecialM: 5000,
        kmAdicionalMaxNaRotaPremiumM: 10000,
        kmMaxEntrePontosKm: 8,
        kmMaximoNaSemanaM: 40000,
        kmMaximoNoSabadoM: 45000,
        horaMarcadaHorasAMais: 2,
      },
    })
    buscarDisponibilidadeMock.mockResolvedValueOnce({
      diagnostico: { ok: true, executado: true },
      disponibilidades: [
        { dataISO: '2026-07-10', equipe: 'EQUIPE 1', disponivelMin: 300, ativa: true },
        { dataISO: '2026-07-16', equipe: 'EQUIPE 1', disponivelMin: 300, ativa: true },
        { dataISO: '2026-07-25', equipe: 'EQUIPE 1', disponivelMin: 300, ativa: true },
        { dataISO: '2026-07-31', equipe: 'EQUIPE 1', disponivelMin: 300, ativa: true },
      ],
    })
    calcularMapaMock.mockResolvedValueOnce({
      ok: true,
      modo: 'mapa-km-adicional-por-slot-diagnostico',
      mapa: {
        '2026-07-10::EQUIPE 1': 3000,
        '2026-07-16::EQUIPE 1': 9437,
        '2026-07-25::EQUIPE 1': 3000,
        '2026-07-31::EQUIPE 1': 3000,
      },
      detalhesPorSlot: [
        detalheSlot('2026-07-10::EQUIPE 1', 0, 3000),
        detalheSlotComInsercao16Jul(),
        detalheSlot('2026-07-25::EQUIPE 1', 0, 3000),
        detalheSlot('2026-07-31::EQUIPE 1', 0, 3000),
      ],
      contadores: {
        slotsRecebidos: 40,
        slotsProcessados: 40,
        slotsComKm: 4,
        slotsComFallbackHaversine: 0,
        slotsComErro: 0,
        slotsDescartados: 0,
      },
      avisos: [],
      erros: [],
    })
    buscarRotaMock
      .mockResolvedValueOnce({ ok: true, distanciaM: 7000 })
      .mockResolvedValueOnce({ ok: true, distanciaM: 6000 })
      .mockResolvedValueOnce({ ok: true, distanciaM: 3000 })
      .mockResolvedValueOnce({ ok: true, distanciaM: 5200 })
      .mockResolvedValueOnce({ ok: true, distanciaM: 780 })
      .mockResolvedValueOnce({ ok: true, distanciaM: 10465 })
      .mockResolvedValueOnce({ ok: true, distanciaM: 10480 })

    const result = await pesquisarDatasV2({
      cep: '80620-220',
      enderecoCompleto: 'Rua Santo Amaro, Agua Verde, Curitiba, Parana, 80620-220, Brasil',
      dataInicial: '2026-06-26',
      tempoNecessario: '2:05',
      isRural: false,
      isCondominio: true,
      destLat: -25.4574104,
      destLng: -49.2753292,
    } as never, { diagnosticoDeltaSantoAmaro16Jul: true })

    expect(result.ok).toBe(true)
    expect(calcularMapaMock).toHaveBeenCalledWith(
      expect.objectContaining({
        incluirDetalhesInsercao: true,
      })
    )
    expect(criarBuscarRotaMock).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: 'https://osrm.lebebe.cloud',
      })
    )

    const diagnostico = result.diagnosticoDeltaSantoAmaro16Jul as Record<string, unknown>
    expect(diagnostico).toBeDefined()
    expect((diagnostico.rotaBaseV2 as { pontos: unknown[] }).pontos).toHaveLength(3)
    expect(diagnostico.agenda89).toMatchObject({
      id: 'agenda_89',
      lat: -25.5101,
      lng: -49.301,
      endereco: 'Rua Professor Oscar Martins Gomes, 163, Xaxim, Curitiba - PR, 81830-110',
    })
    expect(diagnostico.melhorInsercaoV2).toMatchObject({
      indiceInsercao: 0,
      anteriorDetalhado: expect.objectContaining({ id: 'deposito' }),
      proximoDetalhado: expect.objectContaining({ id: 'agenda_89' }),
    })
    expect(diagnostico.comparativoOsrmRouteTable).toMatchObject({
      executado: true,
      ok: true,
      table: { deltaM: 9437 },
      route: { deltaM: 10000 },
      comparacao: {
        deltaLegadoEsperadoM: 10460,
        diferencaTableVsRouteM: -563,
        diferencaRouteVsLegadoM: 460,
        diferencaTableVsLegadoM: 1023,
      },
      origemLegadoInformada: {
        lat: -25.493498,
        lng: -49.276551,
        insercaoInicioRoute: {
          origemLegadoNovoM: 5200,
          novoAgenda89M: 6000,
          origemLegadoAgenda89M: 780,
          deltaM: 10420,
          diferencaVsRouteV2M: 420,
          diferencaVsLegadoEsperadoM: 40,
        },
      },
      agenda90: {
        routeAgenda90DestinoM: 10465,
        routeDestinoAgenda90M: 10480,
        diferencaAgenda90DestinoVsLegadoEsperadoM: -5,
      },
    })
  })
})

function detalheSlot(chave: string, pontosValidos: number, kmAdicionalNaRotaM = 11533) {
  const [dataISO, equipe] = chave.split('::')
  return {
    chave,
    dataISO,
    equipe,
    equipeNormalizada: equipe,
    kmAdicionalNaRotaM,
    ok: true,
    origemKmAdicionalNaRotaM: 'osrm-table-diagnostico',
    avisos: [],
    erros: [],
    descartados: [],
    parseAgenda: {
      ok: true,
      pontos: [],
      descartados: [],
      avisos: [],
      erros: [],
      resumo: {
        linhasRecebidas: 2,
        linhasDaData: pontosValidos,
        linhasDaEquipe: pontosValidos,
        pontosValidos,
        pontosDescartados: 0,
        semEndereco: 0,
        semCoordenadas: 0,
      },
    },
    deltaInsercao: null,
    origemOperacional: null,
    ordenacaoRotaBase: null,
  }
}

function detalheSlotComInsercao16Jul() {
  return {
    ...detalheSlot('2026-07-16::EQUIPE 1', 2, 9437),
    origemOperacional: {
      ok: true,
      tipo: 'deposito',
      origem: { lat: -25.4876648, lng: -49.2692262 },
      contexto: { dataISO: '2026-07-16', equipe: 'EQUIPE 1' },
    },
    ordenacaoRotaBase: {
      ordemOriginal: [
        'Rua Professor Oscar Martins Gomes, 163, Xaxim, Curitiba - PR, 81830-110',
        'Rua Nicanor do Rosario, 96, Pinheirinho, Curitiba - PR, 81870-620',
      ],
      ordemOtimizada: [
        'DEPOSITO',
        'Rua Professor Oscar Martins Gomes, 163, Xaxim, Curitiba - PR, 81830-110',
        'Rua Nicanor do Rosario, 96, Pinheirinho, Curitiba - PR, 81870-620',
      ],
      criterioOrdenacao: 'greedy-haversine',
      twoOptExecutado: false,
      twoOptAplicado: false,
    },
    deltaInsercao: {
      ok: true,
      modo: 'matriz-distancia-diagnostico',
      kmAdicionalNaRotaM: 9437,
      melhorInsercao: {
        indiceInsercao: 0,
        antes: 'deposito',
        depois: 'agenda_89',
        custoOriginalM: 3794,
        custoComDestinoM: 13231,
        deltaM: 9437,
        trechoAnteriorNovoM: 7000,
        trechoNovoProximoM: 6231,
        trechoAnteriorProximoM: 3794,
      },
      resumo: {
        quantidadePontosAgenda: 2,
        quantidadePontosValidos: 2,
        quantidadePontosInvalidos: 0,
        quantidadeDistanciasCalculadas: 9,
        quantidadeDistanciasInvalidas: 0,
      },
      avisos: [],
      descartados: [],
      erros: [],
      candidatosInsercao: [
        {
          indiceInsercao: 0,
          antes: 'deposito',
          depois: 'agenda_89',
          custoOriginalM: 3794,
          custoComDestinoM: 13231,
          deltaM: 9437,
          trechoAnteriorNovoM: 7000,
          trechoNovoProximoM: 6231,
          trechoAnteriorProximoM: 3794,
        },
      ],
      pontosRotaBase: [
        {
          indice: 0,
          tipo: 'origem',
          label: 'deposito',
          lat: -25.4876648,
          lng: -49.2692262,
        },
        {
          indice: 1,
          tipo: 'agenda',
          label: 'agenda_89',
          lat: -25.5101,
          lng: -49.301,
          endereco: 'Rua Professor Oscar Martins Gomes, 163, Xaxim, Curitiba - PR, 81830-110',
        },
        {
          indice: 2,
          tipo: 'agenda',
          label: 'agenda_90',
          lat: -25.525,
          lng: -49.298,
          endereco: 'Rua Nicanor do Rosario, 96, Pinheirinho, Curitiba - PR, 81870-620',
        },
      ],
    },
  }
}
