import { afterEach, describe, expect, it, vi } from 'vitest'
const acesso = vi.hoisted(() => ({ check: vi.fn(), redirect: vi.fn((destino: string) => { throw new Error(`redirect:${destino}`) }) }))
vi.mock('next/navigation', () => ({ redirect: acesso.redirect }))
vi.mock('@/lib/auth/api-auth', () => ({ requireAuthenticatedUser: acesso.check }))
vi.mock('./PageClient', () => ({ default: () => null }))
import Pagina from './page'
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks() })
describe('acesso do laboratório em produção', () => {
  it('redireciona visitante sem sessão para o login', async () => {
    acesso.check.mockResolvedValue({ ok:false, response: { status:401 } })
    await expect(Pagina()).rejects.toThrow('redirect:/login')
  })
  it.each([403,500])('não libera acesso quando a autenticação retorna %i', async status => {
    acesso.check.mockResolvedValue({ ok:false, response: { status } })
    await expect(Pagina()).rejects.toThrow('redirect:/acesso-negado')
  })
  it.each(['consultora','gestao','superadmin','sem_perfil'])('aceita login ativo %s sem exigir módulo ou perfil específico', async perfil => {
    vi.stubEnv('NODE_ENV','production')
    acesso.check.mockResolvedValue({ ok:true, allowedUser:{ ativo:true, role:perfil==='superadmin' ? 'superadmin' : 'user' } })
    expect(await Pagina()).toBeTruthy()
    expect(acesso.check).toHaveBeenCalledWith({ requireAllowedUser:true, requireActive:true })
  })
})
