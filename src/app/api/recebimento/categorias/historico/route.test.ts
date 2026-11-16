import { describe, expect, it, vi } from 'vitest'
import { GET } from './route'
import { validateMaticUser } from '@/lib/auth/matic-auth'
import { createClient } from '@/lib/supabase/server'
vi.mock('@/lib/auth/matic-auth', () => ({ validateMaticUser: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
describe('histórico de categorias', () => {
  it('retorna quantidade consolidada apenas para itens normais de recebimentos fechados', async () => {
    vi.mocked(validateMaticUser).mockResolvedValue({ authorized: true } as never)
    const eq = vi.fn()
    const range = vi.fn().mockResolvedValue({ data: [
      { volumes_previstos_total: 12, volumes_recebidos_total: 7, volumes_por_item: 3, nfe_item: { descricao: 'ROUPEIRO', nfe: { is_os: false } } },
      { volumes_previstos_total: 1, volumes_recebidos_total: 1, volumes_por_item: 1, nfe_item: { descricao: 'ASSISTENCIA', nfe: { is_os: true } } },
    ], error: null })
    const chain = { select: vi.fn(), eq, order: vi.fn(), range }
    chain.select.mockReturnValue(chain); eq.mockReturnValue(chain); chain.order.mockReturnValue(chain)
    vi.mocked(createClient).mockResolvedValue({ from: vi.fn(() => chain) } as never)
    const response = await GET()
    expect(eq).toHaveBeenCalledWith('recebimento.status', 'fechado')
    expect(await response.json()).toEqual([{ descricao: 'ROUPEIRO', quantidade: 4, previstos: 12, conferidos: 7 }])
  })
})
