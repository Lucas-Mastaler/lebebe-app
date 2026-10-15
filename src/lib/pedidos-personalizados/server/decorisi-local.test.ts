import { afterEach, describe, expect, it, vi } from 'vitest'
import { backendDecorisiHabilitado, expiracaoDecorisiLocal, requisicaoDecorisiLocal } from './decorisi-local'
import { executarApiDecorisi, type DependenciasDecorisi } from './decorisi-handlers'

const estado = globalThis as typeof globalThis & { decorisiLocalExpiraEm?: number }
afterEach(() => {
  vi.unstubAllEnvs()
  vi.useRealTimers()
  delete estado.decorisiLocalExpiraEm
})
function desenvolvimento() {
  vi.stubEnv('NODE_ENV', 'development')
  vi.stubEnv('VERCEL_ENV', '')
  vi.stubEnv('PEDIDOS_DECORISI_BACKEND', '')
}
describe('homologação Decorisi no localhost normal', () => {
  it('não prepara acesso sem autenticação e autorização do contexto', async () => {
    desenvolvimento()
    const criarRepositorio = vi.fn()
    const deps = {
      habilitado: backendDecorisiHabilitado,
      carregarContexto: vi.fn(async () => ({ ok: false as const, response: new Response(null, { status: 403 }) })),
      criarRepositorio,
    } as DependenciasDecorisi
    const response = await executarApiDecorisi(new Request('http://localhost:3000/api/pedidos-personalizados/decorisi/opcoes'), 'opcoes', undefined, deps)
    expect(response.status).toBe(403)
    expect(criarRepositorio).not.toHaveBeenCalled()
    expect(estado.decorisiLocalExpiraEm).toBeUndefined()
  })
  it('aceita somente endereços locais em desenvolvimento', () => {
    desenvolvimento()
    for (const host of ['localhost', '127.0.0.1', '[::1]']) {
      expect(backendDecorisiHabilitado(new Request(`http://${host}:3000`))).toBe(true)
    }
    expect(requisicaoDecorisiLocal(new Request('http://192.168.0.10:3000'))).toBe(false)
  })
  it('preserva o bloqueio em produção e previews', () => {
    desenvolvimento()
    vi.stubEnv('NODE_ENV', 'production')
    expect(backendDecorisiHabilitado(new Request('http://localhost:3000'))).toBe(false)
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('VERCEL_ENV', 'preview')
    expect(backendDecorisiHabilitado(new Request('http://localhost:3000'))).toBe(false)
  })
  it('não renova a janela de oito horas a cada requisição', () => {
    desenvolvimento()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-14T12:00:00Z'))
    const request = new Request('http://localhost:3000')
    expect(expiracaoDecorisiLocal(request)).toBe('2026-10-14T20:00:00.000Z')
    vi.advanceTimersByTime(60 * 60 * 1000)
    expect(expiracaoDecorisiLocal(request)).toBe('2026-10-14T20:00:00.000Z')
    vi.advanceTimersByTime(7 * 60 * 60 * 1000)
    expect(expiracaoDecorisiLocal(request)).toBeUndefined()
  })
})
