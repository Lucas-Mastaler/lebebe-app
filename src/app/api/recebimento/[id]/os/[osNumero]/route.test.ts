import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PATCH } from './route'
import { validateMaticUser } from '@/lib/auth/matic-auth'
import { createClient } from '@/lib/supabase/server'
import { registrarAtividadeConferencia } from '@/lib/recebimento/timer-activity'

vi.mock('@/lib/auth/matic-auth', () => ({ validateMaticUser: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/recebimento/timer-activity', () => ({ registrarAtividadeConferencia: vi.fn() }))

function builder(result: unknown, onUpsert: (payload: unknown) => void) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    upsert: vi.fn((payload: unknown) => {
      onUpsert(payload)
      return chain
    }),
    single: vi.fn(() => Promise.resolve(result)),
  }
  return chain
}

describe('PATCH /api/recebimento/[id]/os/[osNumero]', () => {
  const payloads: unknown[] = []

  beforeEach(() => {
    vi.clearAllMocks()
    payloads.length = 0
    vi.mocked(validateMaticUser).mockResolvedValue({ authorized: true } as never)
    const results = {
      recebimentos: [{ data: { status: 'aberto' } }],
      recebimento_os: [{ data: { os_numero: '4733' } }],
    }
    vi.mocked(createClient).mockResolvedValue({
      from: vi.fn((table: keyof typeof results) => builder(results[table].shift(), payload => payloads.push(payload))),
    } as never)
  })

  it('persiste divergência e preserva os volumes informados', async () => {
    const response = await PATCH(
      new Request('https://example.com', {
        method: 'PATCH',
        body: JSON.stringify({ volumes_previstos: 5, volumes_recebidos: 3, divergencia_tipo: 'faltou', divergencia_obs: 'Dois volumes ausentes' }),
      }) as never,
      { params: Promise.resolve({ id: 'rec-1', osNumero: '4733' }) }
    )

    expect(response.status).toBe(200)
    expect(payloads[0]).toMatchObject({
      recebimento_id: 'rec-1',
      os_numero: '4733',
      volumes_previstos: 5,
      volumes_recebidos: 3,
      divergencia_tipo: 'faltou',
      divergencia_obs: 'Dois volumes ausentes',
    })
    expect(registrarAtividadeConferencia).toHaveBeenCalled()
  })

  it('permite limpar tipo e observação sem alterar os volumes', async () => {
    await PATCH(
      new Request('https://example.com', {
        method: 'PATCH',
        body: JSON.stringify({ volumes_previstos: 5, volumes_recebidos: 3, divergencia_tipo: null, divergencia_obs: null }),
      }) as never,
      { params: Promise.resolve({ id: 'rec-1', osNumero: '4733' }) }
    )

    expect(payloads[0]).toMatchObject({
      volumes_previstos: 5,
      volumes_recebidos: 3,
      divergencia_tipo: null,
      divergencia_obs: null,
    })
  })
})
