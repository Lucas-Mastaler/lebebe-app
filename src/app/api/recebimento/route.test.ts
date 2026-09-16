import { describe, expect, it, vi, beforeEach } from 'vitest'
import { POST } from './route'
import { validateMaticUser } from '@/lib/auth/matic-auth'
import { createClient } from '@/lib/supabase/server'

vi.mock('@/lib/auth/matic-auth', () => ({
  validateMaticUser: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

function builder(result: unknown, onInsert: (payload: unknown) => void) {
  const chain: Record<string, unknown> = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    or: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    insert: vi.fn((payload: unknown) => {
      onInsert(payload)
      return chain
    }),
    single: vi.fn(() => Promise.resolve(result)),
    then: (resolve: (value: unknown) => unknown, reject: (reason?: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  }
  return chain
}

function mockSupabase(queues: Record<string, unknown[]>, insertLog: Record<string, unknown[]>) {
  vi.mocked(createClient).mockResolvedValue({
    from: vi.fn((table: string) => {
      const queue = queues[table]
      if (!queue || queue.length === 0) throw new Error(`Sem mock para tabela ${table}`)
      return builder(queue.shift(), (payload) => {
        insertLog[table] = insertLog[table] || []
        insertLog[table].push(payload)
      })
    }),
  } as never)
}

describe('POST /api/recebimento', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(validateMaticUser).mockResolvedValue({ authorized: true, userId: 'user-1' } as never)
  })

  it('não cria recebimento_itens para linha de NFe com ref batendo em produto cadastrado mas descrição contendo VOLUME (caso real do recebimento 33)', async () => {
    const insertLog: Record<string, unknown[]> = {}

    mockSupabase(
      {
        nfe_itens: [
          {
            data: [
              { id: 'ni-normal-1', nfe_id: 'nfe-1', codigo_produto: '00099999', descricao: 'PRODUTO NORMAL SEM VOLUME', quantidade: 2, volumes_por_item: 1, volumes_previstos_total: 2 },
              { id: 'ni-vol-1', nfe_id: 'nfe-1', codigo_produto: '00061714', descricao: 'VOLUME 01- OFF WHITE/FREIJO/ECO', quantidade: 2, volumes_por_item: 1, volumes_previstos_total: 2 },
            ],
            error: null,
          },
        ],
        nfe: [{ data: [{ id: 'nfe-1', numero_nf: '296631', is_os: false }], error: null }],
        matic_sku: [
          {
            data: [
              { codigo_produto: '17996', descricao: 'BERCO ZUPY NEW MATIC', ref_meia: null, ref_inteira: '61714', corredor_sugerido: null, nivel_sugerido: null, prateleira_sugerida: null, volumes_por_item: 2 },
            ],
          },
        ],
        recebimentos: [{ data: { id: 'rec-1' }, error: null }],
        recebimento_nfes: [{ error: null }],
        recebimento_itens: [{ data: { id: 'ri-1' }, error: null }],
        recebimento_item_volumes: [{ error: null }],
      },
      insertLog
    )

    const request = new Request('https://example.com/api/recebimento', {
      method: 'POST',
      body: JSON.stringify({
        periodo_inicio: '2026-08-18',
        periodo_fim: '2026-08-24',
        nfe_ids: ['nfe-1'],
      }),
    }) as never

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.id).toBe('rec-1')

    // Só o produto normal deve gerar recebimento_itens — a linha de volume avulso não.
    expect(insertLog.recebimento_itens).toHaveLength(1)
    expect(insertLog.recebimento_itens[0]).toMatchObject({
      nfe_item_id: 'ni-normal-1',
      volumes_previstos_total: 2,
    })
  })
})
