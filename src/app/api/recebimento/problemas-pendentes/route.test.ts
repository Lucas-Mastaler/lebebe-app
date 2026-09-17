import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, POST } from './route'
import { validateMaticUser } from '@/lib/auth/matic-auth'
import { createClient } from '@/lib/supabase/server'
import { TABLE_PAGE_SIZE } from '@/lib/design-system/pagination'

vi.mock('@/lib/auth/matic-auth', () => ({ validateMaticUser: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

function mockQuery(result: unknown) {
  const query: Record<string, unknown> = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    range: vi.fn(() => Promise.resolve(result)),
    insert: vi.fn(() => query),
    single: vi.fn(() => Promise.resolve(result)),
    then: (resolve: (value: unknown) => unknown, reject: (reason?: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  }

  vi.mocked(createClient).mockResolvedValue({
    from: vi.fn(() => query),
  } as never)

  return query
}

describe('/api/recebimento/problemas-pendentes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(validateMaticUser).mockResolvedValue({ authorized: true } as never)
  })

  it('pagina pendências no servidor com máximo de 20 e ordenação determinística', async () => {
    const query = mockQuery({ data: [{ id: 'p-1', resolvido: false }], error: null, count: 21 })

    const response = await GET(new Request('https://example.com/api/recebimento/problemas-pendentes?resolvido=false&page=2'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(query.eq).toHaveBeenCalledWith('resolvido', false)
    expect(query.order).toHaveBeenNthCalledWith(1, 'created_at', { ascending: false })
    expect(query.order).toHaveBeenNthCalledWith(2, 'id', { ascending: false })
    expect(query.range).toHaveBeenCalledWith(TABLE_PAGE_SIZE, (TABLE_PAGE_SIZE * 2) - 1)
    expect(body.pagination).toEqual({ page: 2, limit: TABLE_PAGE_SIZE, total: 21, totalPages: 2 })
  })

  it('preserva apenas_nao_resolvidos sem range e com resposta legada', async () => {
    const query = mockQuery({ data: [{ id: 'p-1', resolvido: false }], error: null })

    const response = await GET(new Request('https://example.com/api/recebimento/problemas-pendentes?apenas_nao_resolvidos=true'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(query.eq).toHaveBeenCalledWith('resolvido', false)
    expect(query.range).not.toHaveBeenCalled()
    expect(body).toEqual([{ id: 'p-1', resolvido: false }])
  })

  it('rejeita criação sem descrição', async () => {
    const response = await POST(new Request('https://example.com/api/recebimento/problemas-pendentes', {
      method: 'POST',
      body: JSON.stringify({ descricao: '   ' }),
    }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Descrição é obrigatória' })
    expect(createClient).not.toHaveBeenCalled()
  })

  it('cria pendência global apenas com descrição', async () => {
    const query = mockQuery({
      data: { id: 'p-1', recebimento_id: null, descricao: 'Pendência global', resolvido: false },
      error: null,
    })

    const response = await POST(new Request('https://example.com/api/recebimento/problemas-pendentes', {
      method: 'POST',
      body: JSON.stringify({ descricao: '  Pendência global  ' }),
    }))
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(query.insert).toHaveBeenCalledWith({ descricao: 'Pendência global' })
    expect(body).toMatchObject({ recebimento_id: null, resolvido: false })
  })

  it('exige autorização Matic para criar', async () => {
    vi.mocked(validateMaticUser).mockResolvedValue({ authorized: false } as never)

    const response = await POST(new Request('https://example.com/api/recebimento/problemas-pendentes', {
      method: 'POST',
      body: JSON.stringify({ descricao: 'Pendência global' }),
    }))

    expect(response.status).toBe(403)
    expect(createClient).not.toHaveBeenCalled()
  })
})
