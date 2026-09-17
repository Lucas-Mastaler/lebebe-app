import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from './route'
import { validateMaticUser } from '@/lib/auth/matic-auth'
import { createClient } from '@/lib/supabase/server'
import { TABLE_PAGE_SIZE } from '@/lib/design-system/pagination'

vi.mock('@/lib/auth/matic-auth', () => ({ validateMaticUser: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

function mockQuery(result: unknown) {
  const query: Record<string, unknown> = {
    select: vi.fn(() => query),
    gte: vi.fn(() => query),
    lte: vi.fn(() => query),
    ilike: vi.fn(() => query),
    order: vi.fn(() => query),
    range: vi.fn(() => Promise.resolve(result)),
  }

  vi.mocked(createClient).mockResolvedValue({
    from: vi.fn(() => query),
  } as never)

  return query
}

describe('GET /api/recebimento/notas-vinculadas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(validateMaticUser).mockResolvedValue({ authorized: true } as never)
  })

  it('pagina no servidor com no máximo 20 NFs e retorna o total', async () => {
    const query = mockQuery({
      data: [{ id: 'nfe-1', numero_nf: '12345', recebimento_nfes: [{ nfe_id: 'nfe-1' }] }],
      error: null,
      count: 21,
    })

    const response = await GET(new Request('https://example.com/api/recebimento/notas-vinculadas?page=2') as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(query.range).toHaveBeenCalledWith(TABLE_PAGE_SIZE, (TABLE_PAGE_SIZE * 2) - 1)
    expect(body.pagination).toEqual({ page: 2, limit: TABLE_PAGE_SIZE, total: 21, totalPages: 2 })
    expect(body.data[0]).toMatchObject({ id: 'nfe-1', numero_nf: '12345', is_vinculada: true })
  })

  it('combina filtros de data inclusivos e número da NF normalizado', async () => {
    const query = mockQuery({ data: [], error: null, count: 0 })

    await GET(new Request('https://example.com/api/recebimento/notas-vinculadas?data_inicio=2026-09-01&data_fim=2026-09-17&numero_nf=12.345') as never)

    expect(query.gte).toHaveBeenCalledWith('data_emissao', '2026-09-01')
    expect(query.lte).toHaveBeenCalledWith('data_emissao', '2026-09-17')
    expect(query.ilike).toHaveBeenCalledWith('numero_nf', '%12345%')
  })

  it('normaliza página inválida para a primeira', async () => {
    const query = mockQuery({ data: [], error: null, count: 0 })

    const response = await GET(new Request('https://example.com/api/recebimento/notas-vinculadas?page=0') as never)
    const body = await response.json()

    expect(query.range).toHaveBeenCalledWith(0, TABLE_PAGE_SIZE - 1)
    expect(body.pagination).toEqual({ page: 1, limit: TABLE_PAGE_SIZE, total: 0, totalPages: 0 })
  })
})
