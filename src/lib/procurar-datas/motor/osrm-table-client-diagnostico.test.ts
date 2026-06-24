import { describe, it, expect, vi, beforeEach } from 'vitest'
import { criarBuscarMatrizOSRMTableDiagnosticoV2 } from './osrm-table-client-diagnostico'
import type { Coordenada } from './distancia'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_URL = 'https://osrm-test.example.com'

const COORDS: Coordenada[] = [
  { lat: -25.45, lng: -49.29 },
  { lat: -25.43, lng: -49.27 },
  { lat: -25.42, lng: -49.26 },
]

const RESPOSTA_OSRM_VALIDA = {
  code: 'Ok',
  distances: [
    [0, 1500, 2800],
    [1500, 0, 900],
    [2800, 900, 0],
  ],
}

// Helper para montar um mock de fetch que retorna uma resposta JSON
function mockFetch(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response)
}

// Helper para montar um mock que rejeita
function mockFetchRejeita(erro: Error) {
  return vi.fn().mockRejectedValue(erro)
}

// ─── Testes ───────────────────────────────────────────────────────────────────

describe('criarBuscarMatrizOSRMTableDiagnosticoV2', () => {

  // ── 1. Monta URL correta com lng,lat (nao lat,lng) ───────────────────────
  it('1. monta URL com lng,lat (OSRM usa lng primeiro)', async () => {
    const fetchMock = mockFetch(RESPOSTA_OSRM_VALIDA)
    const buscar = criarBuscarMatrizOSRMTableDiagnosticoV2({
      baseUrl: BASE_URL,
      fetchImpl: fetchMock,
    })

    await buscar(COORDS)

    const urlChamada = (fetchMock.mock.calls[0][0] as string)
    // Verificar ordem lng,lat para cada ponto
    expect(urlChamada).toContain('-49.29,-25.45')  // lng,lat do ponto 0
    expect(urlChamada).toContain('-49.27,-25.43')  // lng,lat do ponto 1
    expect(urlChamada).toContain('-49.26,-25.42')  // lng,lat do ponto 2
    // Garantir que lat nao veio antes de lng
    expect(urlChamada).not.toContain('-25.45,-49.29')
  })

  // ── 2. URL usa annotations=distance ─────────────────────────────────────
  it('2. URL contem annotations=distance', async () => {
    const fetchMock = mockFetch(RESPOSTA_OSRM_VALIDA)
    const buscar = criarBuscarMatrizOSRMTableDiagnosticoV2({
      baseUrl: BASE_URL,
      fetchImpl: fetchMock,
    })

    await buscar(COORDS)

    const urlChamada = (fetchMock.mock.calls[0][0] as string)
    expect(urlChamada).toContain('annotations=distance')
    expect(urlChamada).toContain('/table/v1/driving/')
    expect(urlChamada).toContain(BASE_URL)
  })

  // ── 3. Usa fetchImpl injetado (nao fetch global) ─────────────────────────
  it('3. usa fetchImpl injetado, nao fetch global', async () => {
    const fetchMock = mockFetch(RESPOSTA_OSRM_VALIDA)
    const buscar = criarBuscarMatrizOSRMTableDiagnosticoV2({
      baseUrl: BASE_URL,
      fetchImpl: fetchMock,
    })

    await buscar(COORDS)

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  // ── 4. Retorna matriz de distâncias válida ───────────────────────────────
  it('4. retorna matriz de distancias valida com 3 pontos', async () => {
    const buscar = criarBuscarMatrizOSRMTableDiagnosticoV2({
      baseUrl: BASE_URL,
      fetchImpl: mockFetch(RESPOSTA_OSRM_VALIDA),
    })

    const resultado = await buscar(COORDS)

    expect(resultado.distances).toHaveLength(3)
    expect(resultado.distances[0][1]).toBe(1500)
    expect(resultado.distances[1][2]).toBe(900)
    expect(resultado.distances[2][0]).toBe(2800)
  })

  // ── 5. Preserva null vindo da OSRM ──────────────────────────────────────
  it('5. preserva null vindo da OSRM sem substituir por 0', async () => {
    const respostaComNull = {
      code: 'Ok',
      distances: [
        [0, null],
        [null, 0],
      ],
    }
    const buscar = criarBuscarMatrizOSRMTableDiagnosticoV2({
      baseUrl: BASE_URL,
      fetchImpl: mockFetch(respostaComNull),
    })

    const resultado = await buscar(COORDS.slice(0, 2))

    expect(resultado.distances[0][1]).toBeNull()
    expect(resultado.distances[1][0]).toBeNull()
    expect(resultado.distances[0][1]).not.toBe(0)
  })

  // ── 6. HTTP 500 vira erro controlado ────────────────────────────────────
  it('6. HTTP 500 lanca erro com status na mensagem', async () => {
    const buscar = criarBuscarMatrizOSRMTableDiagnosticoV2({
      baseUrl: BASE_URL,
      fetchImpl: mockFetch({ code: 'Error' }, 500),
    })

    await expect(buscar(COORDS)).rejects.toThrow('OSRM respondeu HTTP 500')
  })

  // ── 7. code !== 'Ok' vira erro controlado ───────────────────────────────
  it('7. code != Ok lanca erro com code na mensagem', async () => {
    const buscar = criarBuscarMatrizOSRMTableDiagnosticoV2({
      baseUrl: BASE_URL,
      fetchImpl: mockFetch({ code: 'InvalidUrl', message: 'Bad coordinates' }),
    })

    await expect(buscar(COORDS)).rejects.toThrow('OSRM retornou code=InvalidUrl')
  })

  // ── 8. JSON inválido vira erro controlado ────────────────────────────────
  it('8. JSON invalido lanca erro controlado', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockRejectedValue(new SyntaxError('Unexpected token')),
    } as unknown as Response)

    const buscar = criarBuscarMatrizOSRMTableDiagnosticoV2({
      baseUrl: BASE_URL,
      fetchImpl: fetchMock,
    })

    await expect(buscar(COORDS)).rejects.toThrow('OSRM resposta nao e JSON valido')
  })

  // ── 9. distances ausente vira erro controlado ────────────────────────────
  it('9. distances ausente lanca erro controlado', async () => {
    const buscar = criarBuscarMatrizOSRMTableDiagnosticoV2({
      baseUrl: BASE_URL,
      fetchImpl: mockFetch({ code: 'Ok' }), // sem distances
    })

    await expect(buscar(COORDS)).rejects.toThrow('OSRM resposta sem campo distances')
  })

  // ── 10. distances nao-array vira erro controlado ─────────────────────────
  it('10. distances nao-array lanca erro controlado', async () => {
    const buscar = criarBuscarMatrizOSRMTableDiagnosticoV2({
      baseUrl: BASE_URL,
      fetchImpl: mockFetch({ code: 'Ok', distances: 'invalido' }),
    })

    await expect(buscar(COORDS)).rejects.toThrow('OSRM distances com formato invalido')
  })

  // ── 11. Timeout aborta e lança erro controlado ───────────────────────────
  it('11. timeout aborta chamada e lanca erro controlado', async () => {
    // Simula AbortError — o que AbortController.abort() causa
    const abortError = new Error('The operation was aborted')
    abortError.name = 'AbortError'
    const fetchMock = mockFetchRejeita(abortError)

    const buscar = criarBuscarMatrizOSRMTableDiagnosticoV2({
      baseUrl: BASE_URL,
      fetchImpl: fetchMock,
      timeoutMs: 100,
    })

    await expect(buscar(COORDS)).rejects.toThrow(/timeout/i)
  })

  // ── 12. Não usa process.env ──────────────────────────────────────────────
  it('12. baseUrl vem da config, nao de process.env', async () => {
    const fetchMock = mockFetch(RESPOSTA_OSRM_VALIDA)
    const meuBaseUrl = 'https://meu-osrm-custom.example.com'
    const buscar = criarBuscarMatrizOSRMTableDiagnosticoV2({
      baseUrl: meuBaseUrl,
      fetchImpl: fetchMock,
    })

    await buscar(COORDS)

    const urlChamada = (fetchMock.mock.calls[0][0] as string)
    expect(urlChamada).toContain(meuBaseUrl)
  })

  // ── 13. Nao chama fetch real nos testes ──────────────────────────────────
  it('13. sempre usa fetchImpl injetado, nunca fetch real', async () => {
    const fetchMock = mockFetch(RESPOSTA_OSRM_VALIDA)
    const buscar = criarBuscarMatrizOSRMTableDiagnosticoV2({
      baseUrl: BASE_URL,
      fetchImpl: fetchMock,
    })

    await buscar(COORDS)

    // Prova que o mock foi chamado e nao o fetch global
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain(BASE_URL)
    // signal deve estar presente (AbortController)
    expect(opts.signal).toBeDefined()
  })

  // ── 14. Não faz retry ────────────────────────────────────────────────────
  it('14. nao faz retry: fetch e chamado exatamente uma vez mesmo em erro', async () => {
    const fetchMock = mockFetch({ code: 'Error' }, 503)
    const buscar = criarBuscarMatrizOSRMTableDiagnosticoV2({
      baseUrl: BASE_URL,
      fetchImpl: fetchMock,
    })

    await expect(buscar(COORDS)).rejects.toThrow()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  // ── 15. Nunca retorna 0 como fallback ────────────────────────────────────
  it('15. nao retorna 0 como fallback: NaN e Infinity viram null', async () => {
    const respostaComInvalidos = {
      code: 'Ok',
      distances: [
        [0, NaN],
        [Infinity, 0],
      ],
    }
    const buscar = criarBuscarMatrizOSRMTableDiagnosticoV2({
      baseUrl: BASE_URL,
      fetchImpl: mockFetch(respostaComInvalidos),
    })

    const resultado = await buscar(COORDS.slice(0, 2))

    expect(resultado.distances[0][1]).toBeNull()
    expect(resultado.distances[1][0]).toBeNull()
    expect(resultado.distances[0][1]).not.toBe(0)
    expect(resultado.distances[1][0]).not.toBe(0)
  })

  // ── 16. Nao muta o array de coordenadas de entrada ───────────────────────
  it('16. nao muta o array de coordenadas recebido', async () => {
    const coords = COORDS.map((c) => ({ ...c }))
    const copiaAntes = JSON.stringify(coords)
    const buscar = criarBuscarMatrizOSRMTableDiagnosticoV2({
      baseUrl: BASE_URL,
      fetchImpl: mockFetch(RESPOSTA_OSRM_VALIDA),
    })

    await buscar(coords)

    expect(JSON.stringify(coords)).toBe(copiaAntes)
  })

  // ── Extra: distância negativa vira null ──────────────────────────────────
  it('extra. distancia negativa vinda da OSRM vira null', async () => {
    const respostaComNegativo = {
      code: 'Ok',
      distances: [
        [0, -300],
        [-300, 0],
      ],
    }
    const buscar = criarBuscarMatrizOSRMTableDiagnosticoV2({
      baseUrl: BASE_URL,
      fetchImpl: mockFetch(respostaComNegativo),
    })

    const resultado = await buscar(COORDS.slice(0, 2))

    expect(resultado.distances[0][1]).toBeNull()
    expect(resultado.distances[1][0]).toBeNull()
  })

  // ── Extra: erro de rede (nao abort) vira erro controlado ─────────────────
  it('extra. erro de rede generico lanca erro controlado', async () => {
    const buscar = criarBuscarMatrizOSRMTableDiagnosticoV2({
      baseUrl: BASE_URL,
      fetchImpl: mockFetchRejeita(new Error('Failed to fetch')),
    })

    await expect(buscar(COORDS)).rejects.toThrow('OSRM erro de rede: Failed to fetch')
  })

  // ── Extra: logger e chamado com URL ─────────────────────────────────────
  it('extra. logger recebe URL quando configurado', async () => {
    const log = vi.fn()
    const buscar = criarBuscarMatrizOSRMTableDiagnosticoV2({
      baseUrl: BASE_URL,
      fetchImpl: mockFetch(RESPOSTA_OSRM_VALIDA),
      log,
    })

    await buscar(COORDS)

    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(BASE_URL),
      expect.objectContaining({ n: COORDS.length })
    )
  })
})
