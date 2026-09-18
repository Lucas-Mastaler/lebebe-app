import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PATCH } from './route'
import { validateMaticUser } from '@/lib/auth/matic-auth'
import { createClient } from '@/lib/supabase/server'
import { pausarTimerManualmente, retomarTimerManualmente } from '@/lib/recebimento/timer-activity'

vi.mock('@/lib/auth/matic-auth', () => ({ validateMaticUser: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/recebimento/timer-activity', () => ({
  pausarTimerManualmente: vi.fn(),
  retomarTimerManualmente: vi.fn(),
}))

function mockRecebimento(status: string) {
  vi.mocked(createClient).mockResolvedValue({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: { status } })),
        })),
      })),
    })),
  } as never)
}

describe('PATCH /api/recebimento/[id]/timer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(validateMaticUser).mockResolvedValue({ authorized: true, email: 'teste@lebebe.com.br' } as never)
  })

  it('body.timer_rodando=true delega para retomarTimerManualmente, não para pausar', async () => {
    mockRecebimento('aberto')
    vi.mocked(retomarTimerManualmente).mockResolvedValue({ timer_rodando: true, timer_segundos_totais: 10, timer_ultima_acao: '2026-01-01T00:00:00Z' })

    const response = await PATCH(
      new Request('https://example.com', { method: 'PATCH', body: JSON.stringify({ timer_rodando: true }) }) as never,
      { params: Promise.resolve({ id: 'rec-1' }) }
    )

    expect(response.status).toBe(200)
    expect(retomarTimerManualmente).toHaveBeenCalledWith(expect.anything(), 'rec-1', expect.any(Date))
    expect(pausarTimerManualmente).not.toHaveBeenCalled()
  })

  it('body.timer_rodando=false delega para pausarTimerManualmente, não para retomar', async () => {
    mockRecebimento('aberto')
    vi.mocked(pausarTimerManualmente).mockResolvedValue({ timer_rodando: false, timer_segundos_totais: 300, timer_ultima_acao: '2026-01-01T00:05:00Z' })

    const response = await PATCH(
      new Request('https://example.com', { method: 'PATCH', body: JSON.stringify({ timer_rodando: false }) }) as never,
      { params: Promise.resolve({ id: 'rec-1' }) }
    )

    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body).toMatchObject({ timer_rodando: false, timer_segundos_totais: 300 })
    expect(pausarTimerManualmente).toHaveBeenCalledWith(expect.anything(), 'rec-1', expect.any(Date))
    expect(retomarTimerManualmente).not.toHaveBeenCalled()
  })

  it('recebimento já fechado: rejeita antes de chamar qualquer helper de timer', async () => {
    mockRecebimento('fechado')

    const response = await PATCH(
      new Request('https://example.com', { method: 'PATCH', body: JSON.stringify({ timer_rodando: true }) }) as never,
      { params: Promise.resolve({ id: 'rec-1' }) }
    )

    expect(response.status).toBe(400)
    expect(retomarTimerManualmente).not.toHaveBeenCalled()
    expect(pausarTimerManualmente).not.toHaveBeenCalled()
  })
})
