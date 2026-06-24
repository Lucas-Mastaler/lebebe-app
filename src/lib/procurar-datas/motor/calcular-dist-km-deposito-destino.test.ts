import { describe, expect, it, vi } from 'vitest'
import { calcularDistKmDepositoDestino } from './calcular-dist-km-deposito-destino'

const CONFIG = {
  latDeposito: -25.4876648,
  lngDeposito: -49.2692262,
}

const DESTINO = {
  lat: -25.442,
  lng: -49.2407,
}

describe('calcularDistKmDepositoDestino', () => {
  it('calcula distKm deposito -> destino convertendo metros da OSRM para km', async () => {
    const buscarRota = vi.fn().mockResolvedValue({
      ok: true,
      distanciaM: 11533,
    })

    const resultado = await calcularDistKmDepositoDestino({
      config: CONFIG,
      destino: DESTINO,
      buscarRota,
    })

    expect(resultado.ok).toBe(true)
    expect(resultado.distM).toBe(11533)
    expect(resultado.distKm).toBe(11.533)
    expect(resultado.origemDistancia).toBe('osrm-route-deposito-destino')
    expect(resultado.origem).toEqual({ lat: CONFIG.latDeposito, lng: CONFIG.lngDeposito })
    expect(resultado.destino).toEqual(DESTINO)
    expect(buscarRota).toHaveBeenCalledWith(
      { lat: CONFIG.latDeposito, lng: CONFIG.lngDeposito },
      DESTINO
    )
  })

  it('usa sempre o deposito oficial como origem, nao casa de equipe', async () => {
    const buscarRota = vi.fn().mockResolvedValue({
      ok: true,
      distanciaM: 5000,
    })

    const configComCasas = {
      ...CONFIG,
      latCasaE1: -25.1,
      lngCasaE1: -49.1,
      latCasaE2: -25.2,
      lngCasaE2: -49.2,
    }

    await calcularDistKmDepositoDestino({
      config: configComCasas,
      destino: DESTINO,
      buscarRota,
    })

    expect(buscarRota).toHaveBeenCalledTimes(1)
    expect(buscarRota.mock.calls[0][0]).toEqual({
      lat: CONFIG.latDeposito,
      lng: CONFIG.lngDeposito,
    })
  })

  it('arredonda metros antes de converter para km, como o cliente OSRM diagnostico', async () => {
    const buscarRota = vi.fn().mockResolvedValue({
      ok: true,
      distanciaM: 3500.5,
    })

    const resultado = await calcularDistKmDepositoDestino({
      config: CONFIG,
      destino: DESTINO,
      buscarRota,
    })

    expect(resultado.ok).toBe(true)
    expect(resultado.distM).toBe(3501)
    expect(resultado.distKm).toBe(3.501)
  })

  it('retorna erro sem chamar OSRM quando deposito e invalido', async () => {
    const buscarRota = vi.fn()

    const resultado = await calcularDistKmDepositoDestino({
      config: { latDeposito: NaN, lngDeposito: CONFIG.lngDeposito },
      destino: DESTINO,
      buscarRota,
    })

    expect(resultado.ok).toBe(false)
    expect(resultado.distKm).toBeNull()
    expect(resultado.distM).toBeNull()
    expect(resultado.erros[0]).toContain('deposito')
    expect(buscarRota).not.toHaveBeenCalled()
  })

  it('retorna erro sem chamar OSRM quando destino e invalido', async () => {
    const buscarRota = vi.fn()

    const resultado = await calcularDistKmDepositoDestino({
      config: CONFIG,
      destino: { lat: DESTINO.lat, lng: Infinity },
      buscarRota,
    })

    expect(resultado.ok).toBe(false)
    expect(resultado.distKm).toBeNull()
    expect(resultado.distM).toBeNull()
    expect(resultado.origem).toEqual({ lat: CONFIG.latDeposito, lng: CONFIG.lngDeposito })
    expect(resultado.erros[0]).toContain('destino')
    expect(buscarRota).not.toHaveBeenCalled()
  })

  it('propaga falha OSRM sem fabricar distKm por kmAdicionalNaRotaM', async () => {
    const buscarRota = vi.fn().mockResolvedValue({
      ok: false,
      distanciaM: null,
      erro: 'HTTP 503',
    })

    const resultado = await calcularDistKmDepositoDestino({
      config: CONFIG,
      destino: DESTINO,
      buscarRota,
    })

    expect(resultado.ok).toBe(false)
    expect(resultado.distKm).toBeNull()
    expect(resultado.distM).toBeNull()
    expect(resultado.erros).toEqual(['HTTP 503'])
    expect(buscarRota).toHaveBeenCalledTimes(1)
  })
})
