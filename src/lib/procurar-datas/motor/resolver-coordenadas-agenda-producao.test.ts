import { describe, expect, it, beforeEach, vi } from 'vitest'
import { resolverCoordenadasAgendaProducao } from './resolver-coordenadas-agenda-producao'

const buscarEnderecoNoGeoCacheMock = vi.hoisted(() => vi.fn())
const salvarEnderecoNoGeoCacheMock = vi.hoisted(() => vi.fn())
const buscarEnderecoLocationIqMock = vi.hoisted(() => vi.fn())
const consultarGoogleGeocodingMock = vi.hoisted(() => vi.fn())

vi.mock('../endereco-cache', () => ({
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

describe('resolverCoordenadasAgendaProducao', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    buscarEnderecoNoGeoCacheMock.mockResolvedValue({ status: 'miss', motivo: 'sem_match_seguro' })
    buscarEnderecoLocationIqMock.mockResolvedValue({ status: 'failed', motivo: 'sem_resultado_valido' })
    consultarGoogleGeocodingMock.mockResolvedValue({ status: 'failed', motivo: 'sem_resultado_valido' })
    salvarEnderecoNoGeoCacheMock.mockResolvedValue({ ok: true, chaveEndereco: 'cache-key' })
  })

  it('resolve ponto sem coordenada por geo_cache seguro antes de usar fallback externo', async () => {
    buscarEnderecoNoGeoCacheMock.mockResolvedValueOnce({
      status: 'hit',
      motivo: 'match_seguro',
      resultado: { ok: true, lat: -25.4250253, lng: -49.3560778 },
    })

    const resultado = await resolverCoordenadasAgendaProducao({
      linhasAgenda: [linhaAgenda],
      datasAlvoISO: ['2026-08-17'],
      equipesAlvo: ['EQUIPE 1'],
      cacheCoordenadasPorEndereco: {},
    })

    expect(resultado.resolvidosPorCache).toBe(1)
    expect(resultado.resolvidosPorFallback).toBe(0)
    expect(resultado.aindaSemCoordenada).toBe(0)
    expect(resultado.cacheCoordenadasPorEndereco).toMatchObject({
      'rua joao baptista groff, 605, orleans, curitiba - pr, 82310-350': {
        lat: -25.4250253,
        lng: -49.3560778,
      },
    })
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
})
