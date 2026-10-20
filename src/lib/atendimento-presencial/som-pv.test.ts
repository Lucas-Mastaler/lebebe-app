import { afterEach, describe, expect, it, vi } from 'vitest'
import { SomPv, DURACAO_SOM_PV_SEGUNDOS } from './som-pv'

function contextoFake() {
  const notas: Array<{ start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn>; frequency: { setValueAtTime: ReturnType<typeof vi.fn> }; onended?: () => void }> = []
  const ganhos: Array<{ gain: { setValueAtTime: ReturnType<typeof vi.fn>; linearRampToValueAtTime: ReturnType<typeof vi.fn>; exponentialRampToValueAtTime: ReturnType<typeof vi.fn> }; connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }> = []
  const contexto = {
    state: 'running', currentTime: 10, destination: {},
    resume: vi.fn(async () => { contexto.state = 'running' }), close: vi.fn(async () => { contexto.state = 'closed' }),
    createOscillator: vi.fn(() => { const nota = { type: 'sine', start: vi.fn(), stop: vi.fn(), connect: vi.fn(), disconnect: vi.fn(), frequency: { setValueAtTime: vi.fn() } }; notas.push(nota); return nota }),
    createGain: vi.fn(() => { const ganho = { gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() }; ganhos.push(ganho); return ganho }),
  }
  vi.stubGlobal('window', {})
  vi.stubGlobal('AudioContext', class { constructor() { return contexto } })
  return { contexto, notas, ganhos }
}

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('vinheta PV', () => {
  it('toca três notas ascendentes e encerra todas em 1,5 segundo', async () => {
    const { contexto, notas, ganhos } = contextoFake()
    const som = new SomPv()
    expect(await som.preparar()).toBe(true)
    expect(som.tocar()).toBe(true)
    expect(notas).toHaveLength(3)
    expect(notas.map(n => n.frequency.setValueAtTime.mock.calls[0][0])).toEqual([523.25, 659.25, 783.99])
    expect(notas.map(n => n.stop.mock.calls[0][0])).toEqual([11.5, 11.5, 11.5])
    expect(DURACAO_SOM_PV_SEGUNDOS).toBe(1.5)
    ganhos.forEach(g => expect(g.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(0, 11.5))
    som.parar()
    notas.forEach(n => expect(n.stop).toHaveBeenLastCalledWith())
    som.encerrar()
    expect(contexto.close).toHaveBeenCalledTimes(1)
  })
  it('prepara contexto suspenso no gesto, sem tocar antes da confirmação', async () => {
    const { contexto } = contextoFake()
    contexto.state = 'suspended'
    const som = new SomPv()
    expect(await som.preparar()).toBe(true)
    expect(contexto.resume).toHaveBeenCalledOnce()
    expect(contexto.createOscillator).not.toHaveBeenCalled()
  })
  it('falha de áudio é recuperável e não lança erro para o atendimento', async () => {
    vi.stubGlobal('window', {})
    vi.stubGlobal('AudioContext', class { constructor() { throw new DOMException('Bloqueado', 'NotAllowedError') } })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const som = new SomPv()
    expect(await som.preparar()).toBe(false)
    expect(som.tocar()).toBe(false)
    expect(() => som.parar()).not.toThrow()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[PV áudio]'), 'NotAllowedError')
  })
})
