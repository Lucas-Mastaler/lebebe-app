import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, PUT } from './route'
import { validateMaticUser } from '@/lib/auth/matic-auth'
import { createServiceClient } from '@/lib/supabase/service'
vi.mock('@/lib/auth/matic-auth', () => ({ validateMaticUser: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }))
describe('classificações de recebimento', () => {
  beforeEach(() => vi.clearAllMocks())
  it('nega acesso antes de criar cliente privilegiado', async () => {
    vi.mocked(validateMaticUser).mockResolvedValue({ authorized: false } as never)
    expect((await GET()).status).toBe(403)
    expect(createServiceClient).not.toHaveBeenCalled()
  })
  it('salva descrição normalizada e categoria válida', async () => {
    vi.mocked(validateMaticUser).mockResolvedValue({ authorized: true } as never)
    const upsert = vi.fn().mockResolvedValue({ error: null })
    vi.mocked(createServiceClient).mockReturnValue({ from: vi.fn(() => ({ upsert })) } as never)
    const request = new Request('https://example.com', { method: 'PUT', body: JSON.stringify({ descricao: ' MÓDULO  ESPECIAL ', categoria: 'painel' }) })
    expect((await PUT(request as never)).status).toBe(200)
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ descricao_normalizada: 'modulo especial', categoria: 'painel' }), expect.anything())
  })
  it('rejeita categoria inválida antes de gravar', async () => {
    vi.mocked(validateMaticUser).mockResolvedValue({ authorized: true } as never)
    const request = new Request('https://example.com', { method: 'PUT', body: JSON.stringify({ descricao: 'item', categoria: 'invalida' }) })
    expect((await PUT(request as never)).status).toBe(400)
    expect(createServiceClient).not.toHaveBeenCalled()
  })
})
