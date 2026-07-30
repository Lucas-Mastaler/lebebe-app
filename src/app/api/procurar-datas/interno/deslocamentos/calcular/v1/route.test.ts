import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from './route'

const buscarEnderecoNoGeoCacheMock = vi.hoisted(() => vi.fn())
const buscarEnderecoLocationIqMock = vi.hoisted(() => vi.fn())
const consultarGoogleMock = vi.hoisted(() => vi.fn())
const buscarConfiguracoesMock = vi.hoisted(() => vi.fn())
const buscarMatrizMock = vi.hoisted(() => vi.fn())
const criarBuscarMatrizMock = vi.hoisted(() => vi.fn(() => buscarMatrizMock))

vi.mock('@/lib/procurar-datas/endereco-cache', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/procurar-datas/endereco-cache')>()
  return {
    ...actual,
    buscarEnderecoNoGeoCache: buscarEnderecoNoGeoCacheMock,
  }
})

vi.mock('@/lib/procurar-datas/locationiq', () => ({
  buscarEnderecoLocationIq: buscarEnderecoLocationIqMock,
}))

vi.mock('@/lib/procurar-datas/google-geocoding', () => ({
  consultarGoogleGeocodingEnderecoDificil: consultarGoogleMock,
}))

vi.mock('@/lib/procurar-datas/config-service', () => ({
  buscarConfiguracoesProcurarDatas: buscarConfiguracoesMock,
}))

vi.mock('@/lib/procurar-datas/motor/osrm-table-client-diagnostico', () => ({
  criarBuscarMatrizOSRMTableDiagnosticoV2: criarBuscarMatrizMock,
}))

function criarRequest(body: object, token = 'token-teste'): NextRequest {
  return new NextRequest('http://localhost/api/procurar-datas/interno/deslocamentos/calcular/v1', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
}

function enderecoResultado(numero: string, lat: number, lng: number, provider = 'supabase') {
  return {
    ok: true,
    lat,
    lng,
    enderecoCompleto: `Rua Teste, ${numero}, Curitiba - PR`,
    display: `Rua Teste, ${numero}, Curitiba - PR`,
    provider,
    address: {
      house_number: numero,
      road: 'Rua Teste',
      suburb: 'Centro',
      city: 'Curitiba',
      state: 'PR',
      postcode: '80000000',
    },
  }
}

const payloadBase = {
  runId: 'run-desloc-test',
  dataISO: '2026-08-01',
  equipe: 'EQUIPE 1',
  origem: {
    logradouro: 'Rua Deposito',
    numero: '860',
    bairro: 'Novo Mundo',
    cidade: 'Curitiba',
    uf: 'PR',
    cep: '81030470',
  },
  itens: [
    {
      id: 'evt-1',
      eventId: 'calendar-1',
      endereco: {
        logradouro: 'Rua Teste',
        numero: '123A',
        bairro: 'Centro',
        cidade: 'Curitiba',
        uf: 'PR',
        cep: '80000000',
      },
    },
  ],
}

describe('POST /api/procurar-datas/interno/deslocamentos/calcular/v1', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.APPS_SCRIPT_DESLOCAMENTOS_TOKEN = 'token-teste'
    process.env.DESLOCAMENTOS_MAX_ITENS = ''
    buscarConfiguracoesMock.mockResolvedValue({
      ok: true,
      origem: 'supabase',
      config: { osrmBaseUrl: 'https://osrm.lebebe.cloud' },
    })
    buscarMatrizMock.mockResolvedValue({
      distances: [
        [0, 1000],
        [1000, 0],
      ],
      durations: [
        [0, 120],
        [120, 0],
      ],
    })
    consultarGoogleMock.mockResolvedValue({ status: 'failed', motivo: 'nao_chamado' })
  })

  it('rejeita chamada sem Bearer dedicado valido', async () => {
    const response = await POST(criarRequest(payloadBase, 'token-errado'))
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({ ok: false, error: 'unauthorized' })
  })

  it('nao aceita cache com numero 123 para payload 123A e cai para LocationIQ sem salvar cache', async () => {
    buscarEnderecoNoGeoCacheMock
      .mockResolvedValueOnce({ status: 'hit', resultado: enderecoResultado('860', -25.49, -49.27), motivo: 'match_seguro' })
      .mockResolvedValueOnce({ status: 'hit', resultado: enderecoResultado('123', -25.43, -49.23), motivo: 'match_seguro' })
    buscarEnderecoLocationIqMock.mockResolvedValueOnce({
      status: 'success',
      resultado: enderecoResultado('123A', -25.44, -49.24, 'locationiq'),
      reservaUsada: false,
    })

    const response = await POST(criarRequest(payloadBase))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.status).toBe('VALIDA')
    expect(body.itens[0]).toMatchObject({
      status: 'RESOLVIDO_LOCATIONIQ',
      motivo: 'cache_numero_estrito_divergente',
      provider: 'locationiq',
    })
    expect(criarBuscarMatrizMock).toHaveBeenCalledWith(expect.objectContaining({
      annotations: 'distance,duration',
      baseUrl: 'https://osrm.lebebe.cloud',
    }))
  })

  it('retorna PARCIAL quando pelo menos um endereco falha e preserva rota dos aproveitados', async () => {
    buscarEnderecoNoGeoCacheMock
      .mockResolvedValueOnce({ status: 'hit', resultado: enderecoResultado('860', -25.49, -49.27), motivo: 'match_seguro' })
      .mockResolvedValueOnce({ status: 'hit', resultado: enderecoResultado('123A', -25.44, -49.24), motivo: 'match_seguro' })
      .mockResolvedValueOnce({ status: 'miss', motivo: 'cache_ambiguo' })
    buscarEnderecoLocationIqMock
      .mockResolvedValueOnce({ status: 'failed', motivo: 'sem_resultado_valido' })
    consultarGoogleMock
      .mockResolvedValueOnce({ status: 'failed', motivo: 'sem_resultado_valido' })

    const response = await POST(criarRequest({
      ...payloadBase,
      itens: [
        payloadBase.itens[0],
        {
          id: 'evt-2',
          endereco: {
            logradouro: 'Rua Ruim',
            numero: '999',
            bairro: 'Centro',
            cidade: 'Curitiba',
            uf: 'PR',
          },
        },
      ],
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.status).toBe('PARCIAL')
    expect(body.rota.ordem).toHaveLength(1)
    expect(body.itens.map((item: { status: string }) => item.status)).toEqual(['CACHE_HIT', 'CACHE_AMBIGUO'])
  })
})
