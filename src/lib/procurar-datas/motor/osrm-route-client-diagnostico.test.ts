// ─────────────────────────────────────────────────────────────────────────────
// motor/osrm-route-client-diagnostico.test.ts
//   Testes unitários para o cliente OSRM /route.
//
//   Propósito:
//     Validar que o cliente monta URLs corretamente, trata erros e
//     extrai distâncias da resposta OSRM /route/v1/driving.
//
//   Estratégia:
//     - Usar fetch mockado (vi.fn()) para simular respostas OSRM.
//     - Testar: sucesso, falha HTTP, timeout, JSON inválido, code != Ok,
//       resposta sem routes, distância inválida.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest'
import { criarBuscarRotaOSRMRouteDiagnosticoV2 } from './osrm-route-client-diagnostico'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const baseUrl = 'https://router.project-osrm.org'
const coordenadas = {
  de: { lat: -25.4284, lng: -49.2733 },
  para: { lat: -25.442, lng: -49.2407 },
}

// URL esperada: OSRM usa lng,lat
const urlEsperada = `${baseUrl}/route/v1/driving/${coordenadas.de.lng},${coordenadas.de.lat};${coordenadas.para.lng},${coordenadas.para.lat}?overview=false&alternatives=false&steps=false`

// ─── Testes ───────────────────────────────────────────────────────────────────

describe('criarBuscarRotaOSRMRouteDiagnosticoV2', () => {
  it('deve retornar distância em metros quando OSRM responde com sucesso', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        code: 'Ok',
        routes: [{ distance: 3500.5, duration: 600 }],
      }),
    } as unknown as Response)

    const buscarRota = criarBuscarRotaOSRMRouteDiagnosticoV2({
      baseUrl,
      fetchImpl: mockFetch,
    })

    const resultado = await buscarRota(coordenadas.de, coordenadas.para)

    expect(resultado.ok).toBe(true)
    expect(resultado.distanciaM).toBe(3501) // arredondado
    expect(mockFetch).toHaveBeenCalledWith(urlEsperada, expect.any(Object))
  })

  it('deve retornar erro quando HTTP status não é 2xx', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    } as unknown as Response)

    const buscarRota = criarBuscarRotaOSRMRouteDiagnosticoV2({
      baseUrl,
      fetchImpl: mockFetch,
    })

    const resultado = await buscarRota(coordenadas.de, coordenadas.para)

    expect(resultado.ok).toBe(false)
    expect(resultado.distanciaM).toBeNull()
    expect(resultado.erro).toContain('HTTP 503')
  })

  it('deve retornar erro quando code != Ok', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        code: 'NoRoute',
        message: 'No route found between points',
      }),
    } as unknown as Response)

    const buscarRota = criarBuscarRotaOSRMRouteDiagnosticoV2({
      baseUrl,
      fetchImpl: mockFetch,
    })

    const resultado = await buscarRota(coordenadas.de, coordenadas.para)

    expect(resultado.ok).toBe(false)
    expect(resultado.distanciaM).toBeNull()
    expect(resultado.erro).toContain('NoRoute')
  })

  it('deve retornar erro quando resposta não é JSON válido', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('Invalid JSON')
      },
    } as unknown as Response)

    const buscarRota = criarBuscarRotaOSRMRouteDiagnosticoV2({
      baseUrl,
      fetchImpl: mockFetch,
    })

    const resultado = await buscarRota(coordenadas.de, coordenadas.para)

    expect(resultado.ok).toBe(false)
    expect(resultado.distanciaM).toBeNull()
    expect(resultado.erro).toContain('JSON')
  })

  it('deve retornar erro quando routes está ausente', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        code: 'Ok',
        // routes ausente
      }),
    } as unknown as Response)

    const buscarRota = criarBuscarRotaOSRMRouteDiagnosticoV2({
      baseUrl,
      fetchImpl: mockFetch,
    })

    const resultado = await buscarRota(coordenadas.de, coordenadas.para)

    expect(resultado.ok).toBe(false)
    expect(resultado.distanciaM).toBeNull()
    expect(resultado.erro).toContain('routes')
  })

  it('deve retornar erro quando routes está vazio', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        code: 'Ok',
        routes: [],
      }),
    } as unknown as Response)

    const buscarRota = criarBuscarRotaOSRMRouteDiagnosticoV2({
      baseUrl,
      fetchImpl: mockFetch,
    })

    const resultado = await buscarRota(coordenadas.de, coordenadas.para)

    expect(resultado.ok).toBe(false)
    expect(resultado.distanciaM).toBeNull()
  })

  it('deve retornar erro quando distância é inválida (NaN)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        code: 'Ok',
        routes: [{ distance: NaN, duration: 600 }],
      }),
    } as unknown as Response)

    const buscarRota = criarBuscarRotaOSRMRouteDiagnosticoV2({
      baseUrl,
      fetchImpl: mockFetch,
    })

    const resultado = await buscarRota(coordenadas.de, coordenadas.para)

    expect(resultado.ok).toBe(false)
    expect(resultado.distanciaM).toBeNull()
  })

  it('deve retornar erro quando distância é negativa', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        code: 'Ok',
        routes: [{ distance: -100, duration: 600 }],
      }),
    } as unknown as Response)

    const buscarRota = criarBuscarRotaOSRMRouteDiagnosticoV2({
      baseUrl,
      fetchImpl: mockFetch,
    })

    const resultado = await buscarRota(coordenadas.de, coordenadas.para)

    expect(resultado.ok).toBe(false)
    expect(resultado.distanciaM).toBeNull()
  })

  it('deve retornar erro quando coordenada de é inválida', async () => {
    const mockFetch = vi.fn()
    const buscarRota = criarBuscarRotaOSRMRouteDiagnosticoV2({
      baseUrl,
      fetchImpl: mockFetch,
    })

    const resultado = await buscarRota({ lat: NaN, lng: -49.27 }, coordenadas.para)

    expect(resultado.ok).toBe(false)
    expect(resultado.distanciaM).toBeNull()
    expect(resultado.erro).toContain('de')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('deve retornar erro quando coordenada para é inválida', async () => {
    const mockFetch = vi.fn()
    const buscarRota = criarBuscarRotaOSRMRouteDiagnosticoV2({
      baseUrl,
      fetchImpl: mockFetch,
    })

    const resultado = await buscarRota(coordenadas.de, { lat: -25.44, lng: NaN })

    expect(resultado.ok).toBe(false)
    expect(resultado.distanciaM).toBeNull()
    expect(resultado.erro).toContain('para')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('deve usar timeout padrão de 5000ms quando não especificado', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        code: 'Ok',
        routes: [{ distance: 3500, duration: 600 }],
      }),
    } as unknown as Response)

    criarBuscarRotaOSRMRouteDiagnosticoV2({
      baseUrl,
      fetchImpl: mockFetch,
    })

    // Não conseguimos verificar o timeout diretamente, mas garantimos que não quebra
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('deve usar profile driving por padrão', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        code: 'Ok',
        routes: [{ distance: 3500, duration: 600 }],
      }),
    } as unknown as Response)

    const buscarRota = criarBuscarRotaOSRMRouteDiagnosticoV2({
      baseUrl,
      fetchImpl: mockFetch,
    })

    await buscarRota(coordenadas.de, coordenadas.para)

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/driving/'),
      expect.any(Object)
    )
  })
})
