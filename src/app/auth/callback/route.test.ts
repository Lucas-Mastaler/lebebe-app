import { describe, expect, it, vi, beforeEach } from 'vitest'
import { GET } from './route'

const mocks = vi.hoisted(() => {
  const exchangeCodeForSession = vi.fn()
  const signOut = vi.fn()
  const insert = vi.fn()
  const single = vi.fn()
  const eq = vi.fn(() => ({ single }))
  const select = vi.fn(() => ({ eq }))
  const from = vi.fn((table: string) => {
    if (table === 'google_oauth_setup') {
      return { insert }
    }
    return { select }
  })
  const registrarAuditoria = vi.fn()

  return { exchangeCodeForSession, signOut, insert, single, eq, select, from, registrarAuditoria }
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
    mocks.insert.mockResolvedValue({ data: null, error: null })
    mocks.single.mockResolvedValue({ data: { ativo: true, role: 'user' }, error: null })
  })

  it('redireciona login Google bem-sucedido para /inicio', async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({
      data: {
        user: { email: 'Usuario@LeBebe.com.br' },
        session: {
          provider_refresh_token: null,
          provider_token: null,
        },
      },
      error: null,
    })

    const response = await GET(new Request('https://lebebe.cloud/auth/callback?code=abc'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://lebebe.cloud/inicio')
    expect(mocks.eq).toHaveBeenCalledWith('email', 'usuario@lebebe.com.br')
    expect(mocks.registrarAuditoria).toHaveBeenCalledWith('LOGIN_SUCESSO', 'usuario@lebebe.com.br', {
      role: 'user',
      provider: 'google',
    })
  })
})
