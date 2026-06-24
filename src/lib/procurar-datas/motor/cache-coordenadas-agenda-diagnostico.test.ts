import { describe, expect, it, vi, beforeEach } from 'vitest'
import { resolverCacheCoordenadasAgendaDiagnostico } from './cache-coordenadas-agenda-diagnostico'
import { parsearPontosAgendaDoDiaV2 } from './parse-agenda-shag'

const supabaseInMock = vi.hoisted(() => vi.fn())
const supabaseSelectMock = vi.hoisted(() => vi.fn(() => ({ in: supabaseInMock })))
const supabaseFromMock = vi.hoisted(() => vi.fn(() => ({ select: supabaseSelectMock })))
const createServiceClientMock = vi.hoisted(() => vi.fn(() => ({ from: supabaseFromMock })))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: createServiceClientMock,
}))

describe('resolverCacheCoordenadasAgendaDiagnostico', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('preenche todas as chaves textuais que compartilham o mesmo hash legado sem numero', async () => {
    const linhasAgenda = [
      [
        '27/06/2026 00:00:00',
        '',
        'Entrega Sao Lourenco 708',
        '',
        '',
        'Rua Greg\u00f3rio de Matos, 708, S\u00e3o Louren\u00e7o, Curitiba - PR, 82200-110',
        '4- EQUIPE 01',
      ],
      [
        '28/06/2026 00:00:00',
        '',
        'Entrega Sao Lourenco 564',
        '',
        '',
        'Rua Greg\u00f3rio de Matos, 564, S\u00e3o Louren\u00e7o, Curitiba - PR, 82200-110',
        '4- EQUIPE 01',
      ],
    ]

    supabaseInMock.mockResolvedValueOnce({
      data: [
        {
          chave_endereco: '41dc44699f62c91f1c153512bb8d35a859db6d1d',
          lat: '-25.3953811',
          lng: '-49.2684535',
        },
      ],
      error: null,
    })

    const cache = await resolverCacheCoordenadasAgendaDiagnostico({
      linhasAgenda,
      cacheInjetado: {},
      supabaseTable: 'geo_cache',
    })

    expect(supabaseFromMock).toHaveBeenCalledWith('geo_cache')
    expect(supabaseInMock).toHaveBeenCalledWith('chave_endereco', [
      '41dc44699f62c91f1c153512bb8d35a859db6d1d',
    ])
    expect(cache.cacheCoordenadasPorEndereco).toEqual(
      expect.objectContaining({
        'rua greg\u00f3rio de matos, 708, s\u00e3o louren\u00e7o, curitiba - pr, 82200-110': {
          lat: -25.3953811,
          lng: -49.2684535,
        },
        'rua greg\u00f3rio de matos, 564, s\u00e3o louren\u00e7o, curitiba - pr, 82200-110': {
          lat: -25.3953811,
          lng: -49.2684535,
        },
      })
    )

    const parseSlot27 = parsearPontosAgendaDoDiaV2({
      linhasAgenda,
      dataAlvoISO: '2026-06-27',
      equipeAlvo: 'EQUIPE 1',
      cacheCoordenadasPorEndereco: cache.cacheCoordenadasPorEndereco,
    })

    expect(parseSlot27.resumo.pontosValidos).toBe(1)
    expect(parseSlot27.resumo.semCoordenadas).toBe(0)
    expect(parseSlot27.pontos[0]).toMatchObject({
      endereco: 'Rua Greg\u00f3rio de Matos, 708, S\u00e3o Louren\u00e7o, Curitiba - PR, 82200-110',
      coordenadas: {
        lat: -25.3953811,
        lng: -49.2684535,
      },
    })
  })
})
