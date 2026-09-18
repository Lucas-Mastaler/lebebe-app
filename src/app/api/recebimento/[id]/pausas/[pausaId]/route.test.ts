import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PATCH } from './route'
import { validateMaticUser } from '@/lib/auth/matic-auth'
import { createClient } from '@/lib/supabase/server'
import { aplicarDecisaoPausa } from '@/lib/recebimento/pausas-revisao'

vi.mock('@/lib/auth/matic-auth', () => ({ validateMaticUser: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/recebimento/pausas-revisao', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/recebimento/pausas-revisao')>()
  return { ...original, aplicarDecisaoPausa: vi.fn() }
})

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

function requestBody(body: Record<string, unknown>) {
  return new Request('https://example.com', { method: 'PATCH', body: JSON.stringify(body) }) as never
}

describe('PATCH /api/recebimento/[id]/pausas/[pausaId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(validateMaticUser).mockResolvedValue({ authorized: true, email: 'teste@lebebe.com.br' } as never)
  })

  it('decisão válida (trabalhando): delega para aplicarDecisaoPausa e retorna 200', async () => {
    mockRecebimento('aberto')
    vi.mocked(aplicarDecisaoPausa).mockResolvedValue({ ok: true, pausa: { id: 'pausa-1', status: 'revisado' } as never })

    const response = await PATCH(requestBody({ decisao: 'trabalhando' }), { params: Promise.resolve({ id: 'rec-1', pausaId: 'pausa-1' }) })

    expect(response.status).toBe(200)
    expect(aplicarDecisaoPausa).toHaveBeenCalledWith(expect.anything(), 'rec-1', 'pausa-1', {
      decisao: 'trabalhando',
      periodoInicio: undefined,
      periodoFim: undefined,
    })
  })

  it('decisão inválida (string arbitrária): rejeita sem chamar aplicarDecisaoPausa', async () => {
    mockRecebimento('aberto')

    const response = await PATCH(requestBody({ decisao: 'qualquer-coisa' }), { params: Promise.resolve({ id: 'rec-1', pausaId: 'pausa-1' }) })

    expect(response.status).toBe(400)
    expect(aplicarDecisaoPausa).not.toHaveBeenCalled()
  })

  it('propaga erro de validação (ex.: período fora da janela) como 400', async () => {
    mockRecebimento('aberto')
    vi.mocked(aplicarDecisaoPausa).mockResolvedValue({ ok: false, erro: 'O período informado precisa estar dentro da janela da pausa.' })

    const response = await PATCH(
      requestBody({ decisao: 'editado', periodo_trabalhado_inicio: '2026-01-01T09:00:00Z', periodo_trabalhado_fim: '2026-01-01T10:00:00Z' }),
      { params: Promise.resolve({ id: 'rec-1', pausaId: 'pausa-1' }) }
    )
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toMatch(/dentro da janela/)
  })

  it('recebimento já fechado: rejeita antes de chamar aplicarDecisaoPausa', async () => {
    mockRecebimento('fechado')

    const response = await PATCH(requestBody({ decisao: 'trabalhando' }), { params: Promise.resolve({ id: 'rec-1', pausaId: 'pausa-1' }) })

    expect(response.status).toBe(400)
    expect(aplicarDecisaoPausa).not.toHaveBeenCalled()
  })
})
