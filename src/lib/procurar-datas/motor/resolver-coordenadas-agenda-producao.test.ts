import { describe, expect, it, beforeEach, vi } from 'vitest'
import { resolverCoordenadasAgendaProducao } from './resolver-coordenadas-agenda-producao'

const buscarEnderecosNoGeoCacheEmLoteMock = vi.hoisted(() => vi.fn())
const buscarEnderecoNoGeoCacheMock = vi.hoisted(() => vi.fn())
const salvarEnderecoNoGeoCacheMock = vi.hoisted(() => vi.fn())
const buscarEnderecoLocationIqMock = vi.hoisted(() => vi.fn())
const consultarGoogleGeocodingMock = vi.hoisted(() => vi.fn())

vi.mock('../endereco-cache', () => ({
  buscarEnderecosNoGeoCacheEmLote: buscarEnderecosNoGeoCacheEmLoteMock,
  buscarEnderecoNoGeoCache: buscarEnderecoNoGeoCacheMock,
  salvarEnderecoNoGeoCache: salvarEnderecoNoGeoCacheMock,
}))

vi.mock('../locationiq', () => ({
  buscarEnderecoLocationIq: buscarEnderecoLocationIqMock,
}))

vi.mock('../google-geocoding', () => ({
  consultarGoogleGeocodingEnderecoDificil: consultarGoogleGeocodingMock,
}))

const linhaAgenda = [
  '17/08/2026',
  '',
  'Entrega Orleans',
  '',
  '',
  'Rua Joao Baptista Groff, 605, Orleans, Curitiba - PR, 82310-350',
  '4- EQUIPE 01',
]

function linhaAgendaComEndereco(endereco: string) {
  return [
    '17/08/2026',
    '',
    `Entrega ${endereco}`,
    '',
    '',
    endereco,
    '4- EQUIPE 01',
  ]
}

describe('resolverCoordenadasAgendaProducao', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    buscarEnderecosNoGeoCacheEmLoteMock.mockResolvedValue({
      resultadosPorChave: {},
      candidatosPorChave: {},
      hashesConsultados: 0,
      chunks: 1,
      registrosRetornados: 0,
    })
    buscarEnderecoNoGeoCacheMock.mockResolvedValue({ status: 'miss', motivo: 'sem_match_seguro' })
    buscarEnderecoLocationIqMock.mockResolvedValue({ status: 'failed', motivo: 'sem_resultado_valido' })
    consultarGoogleGeocodingMock.mockResolvedValue({ status: 'failed', motivo: 'sem_resultado_valido' })
    salvarEnderecoNoGeoCacheMock.mockResolvedValue({ ok: true, chaveEndereco: 'cache-key' })
  })

  it('resolve ponto sem coordenada por geo_cache seguro antes de usar fallback externo', async () => {
    buscarEnderecosNoGeoCacheEmLoteMock.mockResolvedValueOnce({
      resultadosPorChave: {
        'rua joao baptista groff, 605, orleans, curitiba - pr, 82310-350': {
          status: 'hit',
          motivo: 'match_seguro',
          resultado: { ok: true, lat: -25.4250253, lng: -49.3560778 },
        },
      },
      candidatosPorChave: {},
      hashesConsultados: 2,
      chunks: 1,
      registrosRetornados: 1,
    })

    const resultado = await resolverCoordenadasAgendaProducao({
      linhasAgenda: [linhaAgenda],
      datasAlvoISO: ['2026-08-17'],
      equipesAlvo: ['EQUIPE 1'],
      cacheCoordenadasPorEndereco: {},
    })

    expect(resultado.resolvidosPorCache).toBe(1)
    expect(resultado.cacheHitsLote).toBe(1)
    expect(resultado.consultasCacheAntesEstimadas).toBe(1)
    expect(resultado.consultasCacheDepois).toBe(1)
    expect(resultado.resolvidosPorFallback).toBe(0)
    expect(resultado.aindaSemCoordenada).toBe(0)
    expect(resultado.cacheCoordenadasPorEndereco).toMatchObject({
      'rua joao baptista groff, 605, orleans, curitiba - pr, 82310-350': {
        lat: -25.4250253,
        lng: -49.3560778,
      },
    })
    expect(buscarEnderecosNoGeoCacheEmLoteMock).toHaveBeenCalledTimes(1)
    expect(buscarEnderecoNoGeoCacheMock).not.toHaveBeenCalled()
    expect(buscarEnderecoLocationIqMock).not.toHaveBeenCalled()
    expect(consultarGoogleGeocodingMock).not.toHaveBeenCalled()
  })

  it('usa fallback externo controlado e salva no geo_cache quando cache seguro nao resolve', async () => {
    buscarEnderecoLocationIqMock.mockResolvedValueOnce({
      status: 'success',
      reservaUsada: false,
      resultado: { ok: true, lat: -25.425, lng: -49.356, provider: 'locationiq' },
    })

    const resultado = await resolverCoordenadasAgendaProducao({
      linhasAgenda: [linhaAgenda],
      datasAlvoISO: ['2026-08-17'],
      equipesAlvo: ['EQUIPE 1'],
      cacheCoordenadasPorEndereco: {},
      maxGeocodificacoesExternas: 1,
    })

    expect(resultado.resolvidosPorCache).toBe(0)
    expect(resultado.resolvidosPorFallback).toBe(1)
    expect(resultado.geocodificacoesExternasTentadas).toBe(1)
    expect(resultado.fallbacksConcorrencia).toBe(4)
    expect(salvarEnderecoNoGeoCacheMock).toHaveBeenCalledTimes(1)
    expect(resultado.cacheCoordenadasPorEndereco['rua joao baptista groff, 605, orleans, curitiba - pr, 82310-350']).toEqual({
      lat: -25.425,
      lng: -49.356,
    })
  })

  it('mantem pendente quando cache e fallback falham sem criar coordenada falsa', async () => {
    const resultado = await resolverCoordenadasAgendaProducao({
      linhasAgenda: [linhaAgenda],
      datasAlvoISO: ['2026-08-17'],
      equipesAlvo: ['EQUIPE 1'],
      cacheCoordenadasPorEndereco: {},
      maxGeocodificacoesExternas: 1,
    })

    expect(resultado.resolvidosPorCache).toBe(0)
    expect(resultado.resolvidosPorFallback).toBe(0)
    expect(resultado.aindaSemCoordenada).toBe(1)
    expect(Object.keys(resultado.cacheCoordenadasPorEndereco)).toHaveLength(0)
    expect(resultado.avisos.join(' ')).toContain('permaneceram sem coordenada')
  })

  it('deduplica dez eventos iguais e faz uma entrada logica no lote', async () => {
    const linhas = Array.from({ length: 10 }, () => linhaAgenda)

    const resultado = await resolverCoordenadasAgendaProducao({
      linhasAgenda: linhas,
      datasAlvoISO: ['2026-08-17'],
      equipesAlvo: ['EQUIPE 1'],
      cacheCoordenadasPorEndereco: {},
      maxGeocodificacoesExternas: 0,
    })

    expect(buscarEnderecosNoGeoCacheEmLoteMock).toHaveBeenCalledTimes(1)
    expect(buscarEnderecosNoGeoCacheEmLoteMock.mock.calls[0][0]).toHaveLength(1)
    expect(resultado.eventosComEndereco).toBe(10)
    expect(resultado.enderecosUnicos).toBe(1)
    expect(resultado.duplicatasEliminadas).toBe(9)
    expect(resultado.consultasCacheAntesEstimadas).toBe(1)
  })

  it('mantem enderecos diferentes separados no lote e associa cada coordenada ao evento original', async () => {
    const enderecoA = 'Rua A, 10, Hauer, Curitiba - PR, 81610-000'
    const enderecoB = 'Rua B, 20, Xaxim, Curitiba - PR, 81720-000'
    buscarEnderecosNoGeoCacheEmLoteMock.mockResolvedValueOnce({
      resultadosPorChave: {
        'rua a, 10, hauer, curitiba - pr, 81610-000': {
          status: 'hit',
          motivo: 'match_seguro',
          resultado: { ok: true, lat: -25.1, lng: -49.1 },
        },
        'rua b, 20, xaxim, curitiba - pr, 81720-000': {
          status: 'hit',
          motivo: 'match_seguro',
          resultado: { ok: true, lat: -25.2, lng: -49.2 },
        },
      },
      candidatosPorChave: {},
      hashesConsultados: 4,
      chunks: 1,
      registrosRetornados: 2,
    })

    const resultado = await resolverCoordenadasAgendaProducao({
      linhasAgenda: [linhaAgendaComEndereco(enderecoA), linhaAgendaComEndereco(enderecoB)],
      datasAlvoISO: ['2026-08-17'],
      equipesAlvo: ['EQUIPE 1'],
      cacheCoordenadasPorEndereco: {},
    })

    expect(buscarEnderecosNoGeoCacheEmLoteMock.mock.calls[0][0]).toHaveLength(2)
    expect(resultado.cacheCoordenadasPorEndereco['rua a, 10, hauer, curitiba - pr, 81610-000']).toEqual({ lat: -25.1, lng: -49.1 })
    expect(resultado.cacheCoordenadasPorEndereco['rua b, 20, xaxim, curitiba - pr, 81720-000']).toEqual({ lat: -25.2, lng: -49.2 })
  })

  it('nao envia CARREGAMENTO sem endereco nem evento sem endereco para o lote', async () => {
    const resultado = await resolverCoordenadasAgendaProducao({
      linhasAgenda: [
        ['17/08/2026', '', '9 (00:30) CARREGAMENTO SEG-QUI', '00:30', '', '', '4- EQUIPE 01'],
        ['17/08/2026', '', 'EVENTO DESCONHECIDO', '00:30', '', '', '4- EQUIPE 01'],
      ],
      datasAlvoISO: ['2026-08-17'],
      equipesAlvo: ['EQUIPE 1'],
      cacheCoordenadasPorEndereco: {},
    })

    expect(buscarEnderecosNoGeoCacheEmLoteMock).not.toHaveBeenCalled()
    expect(resultado.eventosComEndereco).toBe(0)
    expect(resultado.enderecosComEnderecoSemCoordenada).toBe(0)
  })

  it('respeita limite de concorrencia dos fallbacks externos restantes', async () => {
    let emAndamento = 0
    let maximo = 0
    buscarEnderecoLocationIqMock.mockImplementation(async () => {
      emAndamento++
      maximo = Math.max(maximo, emAndamento)
      await new Promise((resolve) => setTimeout(resolve, 5))
      emAndamento--
      return { status: 'failed', motivo: 'sem_resultado_valido' }
    })

    const linhas = Array.from({ length: 6 }, (_, index) =>
      linhaAgendaComEndereco(`Rua ${index}, ${index + 1}, Hauer, Curitiba - PR, 81610-00${index}`)
    )

    const resultado = await resolverCoordenadasAgendaProducao({
      linhasAgenda: linhas,
      datasAlvoISO: ['2026-08-17'],
      equipesAlvo: ['EQUIPE 1'],
      cacheCoordenadasPorEndereco: {},
      maxGeocodificacoesExternas: 6,
    })

    expect(resultado.fallbacksExecutados).toBe(6)
    expect(maximo).toBeLessThanOrEqual(4)
  })
})
