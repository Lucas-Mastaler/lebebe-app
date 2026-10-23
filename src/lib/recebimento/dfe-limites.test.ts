import { afterEach, describe, expect, it, vi } from 'vitest'
import { reservarConsulta, redisFiscal, RESERVAR_DFE, FINALIZAR_DFE, type RedisDfe } from './dfe-limites'

describe('limites fiscais compartilhados', () => {
  afterEach(() => vi.unstubAllEnvs())
  it('sem Redis bloqueia, diferente do limitador genérico', () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '')
    expect(() => redisFiscal()).toThrow(/controle compartilhado/)
  })
  it('reserva e libera somente com o mesmo token, sem guardar chave/CNPJ', async () => {
    const evalMock = vi.fn().mockResolvedValueOnce(['ok', 0]).mockResolvedValueOnce(1)
    const redis = { eval: evalMock } as unknown as RedisDfe
    const reserva = await reservarConsulta('12345678000195', '2', 'chave-nao-guardar', redis, 10000)
    await reserva.finalizar(3600, 60)
    expect(evalMock.mock.calls[0][0]).toBe(RESERVAR_DFE)
    expect(evalMock.mock.calls[1][0]).toBe(FINALIZAR_DFE)
    expect(evalMock.mock.calls[1][2][0]).toBe(evalMock.mock.calls[0][2][1])
    expect(evalMock.mock.calls[1][2].slice(1)).toEqual([3600, 60])
    expect(JSON.stringify(evalMock.mock.calls)).not.toContain('12345678000195')
    expect(JSON.stringify(evalMock.mock.calls)).not.toContain('chave-nao-guardar')
  })
  it.each(['bloqueado', 'concorrente', 'intervalo', 'limite'])('impede SOAP quando %s', async status => {
    await expect(reservarConsulta('cnpj', '2', 'chave', { eval: vi.fn().mockResolvedValue([status, 60]) } as unknown as RedisDfe)).rejects.toMatchObject({ estado: 'limite', retryAfter: 60, httpStatus: 429 })
  })
  it('falha fechada se Redis estiver indisponível', async () => {
    await expect(reservarConsulta('cnpj', '2', 'chave', { eval: vi.fn().mockRejectedValue(new Error('credencial secreta')) } as unknown as RedisDfe)).rejects.toMatchObject({ estado: 'temporario', message: expect.not.stringContaining('secreta') })
  })
  it('falha ao registrar intervalo é explícita', async () => {
    const reserva = await reservarConsulta('cnpj', '2', 'chave', { eval: vi.fn().mockResolvedValueOnce(['ok', 0]).mockRejectedValueOnce(new Error()) } as unknown as RedisDfe)
    await expect(reserva.finalizar(3600)).rejects.toMatchObject({ retryAfter: 3600 })
  })
})
