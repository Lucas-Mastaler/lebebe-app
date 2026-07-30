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

  it('resolve origem fixa do deposito por string sem chamar geocodificadores externos', async () => {
    buscarEnderecoNoGeoCacheMock.mockResolvedValue({ status: 'miss', motivo: 'sem_match_seguro' })
    buscarEnderecoLocationIqMock.mockResolvedValue({
      status: 'success',
      resultado: enderecoResultado('123A', -25.44, -49.24, 'locationiq'),
      reservaUsada: false,
    })

    const response = await POST(criarRequest({
      ...payloadBase,
      origem: 'Rua Doutor Francisco Soares, 860, Curitiba - PR, 81030-470',
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.status).toBe('VALIDA')
    expect(body.origem).toMatchObject({
      status: 'RESOLVIDO_ORIGEM_FIXA',
      provider: 'fixed_known_location',
      lat: -25.4934984,
      lng: -49.2765509,
    })
    expect(buscarEnderecoNoGeoCacheMock).toHaveBeenCalledTimes(1) // apenas item
    expect(buscarEnderecoNoGeoCacheMock.mock.calls[0][0].logradouro).toBe('Rua Teste')
    expect(buscarEnderecoLocationIqMock).toHaveBeenCalledTimes(1) // item
    expect(consultarGoogleMock).not.toHaveBeenCalled()
  })

  it('resolve origem fixa da loja por string com acento', async () => {
    buscarEnderecoNoGeoCacheMock.mockResolvedValue({ status: 'miss', motivo: 'sem_match_seguro' })
    buscarEnderecoLocationIqMock.mockResolvedValue({
      status: 'success',
      resultado: enderecoResultado('123A', -25.44, -49.24, 'locationiq'),
      reservaUsada: false,
    })

    const response = await POST(criarRequest({
      ...payloadBase,
      origem: 'Rua Deputado Néo Martins, 872, Curitiba - PR, 81030-470',
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.status).toBe('VALIDA')
    expect(body.origem).toMatchObject({
      status: 'RESOLVIDO_ORIGEM_FIXA',
      provider: 'fixed_known_location',
      lat: -25.4944568,
      lng: -49.2771426,
    })
  })

  it('retorna FALHA_ORIGEM com motivo e tentativas para endereco desconhecido', async () => {
    buscarEnderecoNoGeoCacheMock.mockResolvedValue({ status: 'miss', motivo: 'sem_match_seguro' })
    buscarEnderecoLocationIqMock.mockResolvedValue({ status: 'failed', motivo: 'sem_resultado_valido' })
    consultarGoogleMock.mockResolvedValue({ status: 'failed', motivo: 'sem_resultado_valido' })

    const response = await POST(criarRequest({
      ...payloadBase,
      origem: 'Rua XV de Novembro, 100, Centro, Curitiba - PR',
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.status).toBe('FALHA_ORIGEM')
    expect(body.motivo).toBeTruthy()
    expect(body.origemRecebida).toBe('Rua XV de Novembro, 100, Centro, Curitiba - PR')
    expect(body.tentativas).toEqual(['fixed_known_location', 'geo_cache', 'locationiq', 'google'])
    expect(body.origem).toMatchObject({ status: 'REJEITADO' })
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
