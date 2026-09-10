import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from './route'

const mocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  set: vi.fn(),
  checkRateLimit: vi.fn(),
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: { signInWithPassword: mocks.signInWithPassword },
  })),
}))

vi.mock('@/lib/ratelimit', () => ({ checkRateLimit: mocks.checkRateLimit }))

const baseEnvironment = {
  NODE_ENV: 'development',
  AGENT_TEST_BOOTSTRAP_ENABLED: 'true',
  AGENT_TEST_BOOTSTRAP_SECRET: 'bootstrap-secret',
  AGENT_TEST_EMAIL: 'agente.teste@lebebe.cloud',
  AGENT_TEST_PASSWORD: 'technical-password',
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
}

function request(secret: unknown) {
  return new NextRequest('http://localhost/api/auth/agente', {
    method: 'POST',
    body: JSON.stringify({ secret }),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('POST /api/auth/agente', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.assign(process.env, baseEnvironment)
    delete process.env.VERCEL_ENV
    mocks.checkRateLimit.mockResolvedValue({ success: true })
    mocks.signInWithPassword.mockResolvedValue({ error: null })
  })

  it('creates a normal Supabase session for a valid bootstrap secret', async () => {
    const response = await POST(request('bootstrap-secret'))

    expect(response.status).toBe(200)
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: 'agente.teste@lebebe.cloud',
      password: 'technical-password',
    })
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('rejects an invalid bootstrap secret before password authentication', async () => {
    const response = await POST(request('invalid'))

    expect(response.status).toBe(401)
    expect(mocks.signInWithPassword).not.toHaveBeenCalled()
  })

  it('rejects the bootstrap in production', async () => {
    process.env.NODE_ENV = 'production'

    const response = await POST(request('bootstrap-secret'))

    expect(response.status).toBe(404)
    expect(mocks.signInWithPassword).not.toHaveBeenCalled()
  })

  it('does not expose an authentication failure', async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: new Error('Invalid login credentials') })

    const response = await POST(request('bootstrap-secret'))
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.message).toBe('Não foi possível iniciar a sessão técnica.')
  })
})
