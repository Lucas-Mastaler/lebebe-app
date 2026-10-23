import { describe, expect, it, vi } from 'vitest'
import { lerEmailComRepeticao } from './email-retry'

describe('repetição de leituras do Gmail', () => {
  it('sucesso não repete', async () => {
    const ler = vi.fn().mockResolvedValue('ok'), esperar = vi.fn()
    expect(await lerEmailComRepeticao(ler, esperar)).toBe('ok')
    expect(ler).toHaveBeenCalledTimes(1)
    expect(esperar).not.toHaveBeenCalled()
  })
  it('permite duas novas tentativas e recupera', async () => {
    const ler = vi.fn().mockRejectedValueOnce({ response: { status: 503 } }).mockRejectedValueOnce({ code: 'ECONNRESET' }).mockResolvedValue('ok')
    const esperar = vi.fn()
    expect(await lerEmailComRepeticao(ler, esperar)).toBe('ok')
    expect(ler).toHaveBeenCalledTimes(3)
    expect(esperar.mock.calls).toEqual([[500], [1500]])
  })
  it('para na terceira tentativa temporária', async () => {
    const ler = vi.fn().mockRejectedValue({ response: { status: 429 } })
    await expect(lerEmailComRepeticao(ler, vi.fn())).rejects.toEqual({ response: { status: 429 } })
    expect(ler).toHaveBeenCalledTimes(3)
  })
  it.each([400, 401, 403, 404])('HTTP %s permanente não repete', async status => {
    const ler = vi.fn().mockRejectedValue({ response: { status } })
    await expect(lerEmailComRepeticao(ler, vi.fn())).rejects.toBeDefined()
    expect(ler).toHaveBeenCalledTimes(1)
  })
  it('cota temporária 403 é distinta de falta de permissão', async () => {
    const ler = vi.fn().mockRejectedValueOnce({ response: { status: 403, data: { error: { errors: [{ reason: 'userRateLimitExceeded' }] } } } }).mockResolvedValue('ok')
    expect(await lerEmailComRepeticao(ler, vi.fn())).toBe('ok')
    expect(ler).toHaveBeenCalledTimes(2)
  })
})
