import { describe, expect, it, vi, beforeEach } from 'vitest'
import { GET } from './route'

const mocks = vi.hoisted(() => {
  const exchangeCodeForSession = vi.fn()
  const signOut = vi.fn()
  const single = vi.fn()
  const eq = vi.fn(() => ({ single }))
  const select = vi.fn(() => ({ eq }))
  const from = vi.fn(() => ({ select }))
  const registrarAuditoria = vi.fn()

  return { exchangeCodeForSession, signOut, single, eq, select, from, registrarAuditoria }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      exchangeCodeForSession: mocks.exchangeCodeForSession,
      signOut: mocks.signOut,
    },
    from: mocks.from,
  })),
}))

vi.mock('@/lib/auth/helpers', () => ({
  registrarAuditoria: mocks.registrarAuditoria,
}))

describe('GET /auth/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.single.mockResolvedValue({ data: { ativo: true, role: 'user' }, error: null })
  })

  it('redireciona login Google bem-sucedido para /inicio', async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({
      data: {
        user: { email: 'Usuario@LeBebe.com.br' },
        session: {
          provider_refresh_token: 'test-refresh-token',
          provider_token: 'test-provider-token',
        },
      },
      error: null,
    })

    const response = await GET(new Request('https://lebebe.cloud/auth/callback?code=abc'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://lebebe.cloud/inicio')
    expect(mocks.eq).toHaveBeenCalledWith('email', 'usuario@lebebe.com.br')
    expect(mocks.from).toHaveBeenCalledTimes(1)
    expect(mocks.from).toHaveBeenCalledWith('usuarios_permitidos')
    expect(mocks.registrarAuditoria).toHaveBeenCalledWith('LOGIN_SUCESSO', 'usuario@lebebe.com.br', {
      role: 'user',
      provider: 'google',
    })
  })
})
