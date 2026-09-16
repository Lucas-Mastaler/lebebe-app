import { describe, expect, it, vi, beforeEach } from 'vitest'
import { GET } from './route'
import { validateMaticUser } from '@/lib/auth/matic-auth'
import { createClient } from '@/lib/supabase/server'

vi.mock('@/lib/auth/matic-auth', () => ({
  validateMaticUser: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

function builder(result: unknown) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve(result)),
    then: (resolve: (value: unknown) => unknown, reject: (reason?: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  }
  return chain
}

function mockSupabase(queues: Record<string, unknown[]>) {
  vi.mocked(createClient).mockResolvedValue({
    from: vi.fn((table: string) => {
      const queue = queues[table]
      if (!queue || queue.length === 0) throw new Error(`Sem mock para tabela ${table}`)
      return builder(queue.shift())
    }),
  } as never)
}

const recebimentoId = '123e4567-e89b-12d3-a456-426614174000'

describe('GET /api/recebimento/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(validateMaticUser).mockResolvedValue({ authorized: true } as never)
  })

  it('gera ids únicos para OS com o mesmo os_oc_numero vindo de NFes diferentes (regressão da OS 4733 duplicada)', async () => {
    mockSupabase({
      recebimentos: [
        {
          data: {
            id: recebimentoId,
            status: 'fechado',
            timer_segundos_totais: 0,
            timer_rodando: false,
          },
          error: null,
        },
      ],
      recebimento_nfes: [
        {
          data: [
            {
              nfe_id: 'nfe-1',
              nfe: {
                numero_nf: '1001',
                is_os: true,
                volumes_total: 2,
                nfe_assistencias: [{ id: 'assist-1', os_oc_numero: '4733' }],
              },
            },
            {
              nfe_id: 'nfe-2',
              nfe: {
                numero_nf: '1002',
                is_os: true,
                volumes_total: 2,
                nfe_assistencias: [{ id: 'assist-2', os_oc_numero: '4733' }],
              },
            },
          ],
        },
      ],
      recebimento_itens: [{ data: [] }],
      matic_sku: [{ data: [] }],
      nfe_itens: [{ data: [] }, { data: [] }],
      recebimento_os: [{ data: [] }],
    })

    const response = await GET(
      new Request(`https://example.com/api/recebimento/${recebimentoId}`) as never,
      { params: Promise.resolve({ id: recebimentoId }) }
    )
    const body = await response.json()

    const osItens = body.itens.filter((item: { is_os: boolean }) => item.is_os)
    expect(osItens).toHaveLength(2)
    expect(osItens.every((item: { os_numero: string }) => item.os_numero === '4733')).toBe(true)

    // Raiz do bug: os dois registros da OS 4733 não podem compartilhar o mesmo id/key.
    const ids = osItens.map((item: { id: string }) => item.id)
    expect(new Set(ids).size).toBe(2)
  })

  it('trata linha de NFe com ref batendo em produto cadastrado, mas descrição contendo VOLUME, como OS e não como Item (caso real do recebimento 33)', async () => {
    mockSupabase({
      recebimentos: [
        { data: { id: recebimentoId, status: 'aberto', timer_segundos_totais: 0, timer_rodando: false }, error: null },
      ],
      recebimento_nfes: [
        {
          data: [
            {
              nfe_id: 'nfe-normal',
              nfe: { numero_nf: '1000', data_emissao: '', peso_total: 0, volumes_total: 2, obs: '', is_os: false, nfe_assistencias: [] },
            },
            {
              nfe_id: 'nfe-vol',
              nfe: { numero_nf: '296631', data_emissao: '', peso_total: 0, volumes_total: 4, obs: '', is_os: false, nfe_assistencias: [] },
            },
          ],
        },
      ],
      recebimento_itens: [
        {
          data: [
            {
              id: 'ri-1',
              nfe_item_id: 'ni-normal-1',
              volumes_previstos_total: 2,
              volumes_recebidos_total: 0,
              volumes_por_item: 1,
              corredor_final: null,
              nivel_final: null,
              prateleira_final: null,
              divergencia_tipo: null,
              divergencia_obs: null,
              avaria_foto_url: null,
              refs_display: '00099999',
              nfe_item: { codigo_produto: '00099999', descricao: 'PRODUTO NORMAL SEM VOLUME', quantidade: 2, volumes_por_item: 1 },
              recebimento_item_volumes: [],
            },
          ],
        },
      ],
      matic_sku: [
        {
          data: [
            { codigo_produto: '17996', descricao: 'BERCO ZUPY NEW MATIC', ref_meia: null, ref_inteira: '61714', corredor_sugerido: null, nivel_sugerido: null, prateleira_sugerida: null, volumes_por_item: 2 },
          ],
        },
      ],
      nfe_itens: [
        { data: [{ id: 'ni-normal-1', nfe_id: 'nfe-normal', nfe: { numero_nf: '1000' } }] },
        {
          data: [
            { id: 'ni-normal-1', nfe_id: 'nfe-normal', codigo_produto: '00099999', descricao: 'PRODUTO NORMAL SEM VOLUME', quantidade: 2, volumes_por_item: 1 },
            { id: 'ni-vol-1', nfe_id: 'nfe-vol', codigo_produto: '00061714', descricao: 'VOLUME 01- OFF WHITE/FREIJO/ECO', quantidade: 2, volumes_por_item: 2 },
          ],
        },
      ],
      recebimento_os: [{ data: [] }],
    })

    const response = await GET(
      new Request(`https://example.com/api/recebimento/${recebimentoId}`) as never,
      { params: Promise.resolve({ id: recebimentoId }) }
    )
    const body = await response.json()

    const itensNormais = body.itens.filter((item: { is_os: boolean }) => !item.is_os)
    const itensOS = body.itens.filter((item: { is_os: boolean }) => item.is_os)

    // O produto normal continua na aba Itens.
    expect(itensNormais).toHaveLength(1)
    expect(itensNormais[0].nfe_item.codigo_produto).toBe('00099999')

    // A linha "VOLUME 01- ..." não pode aparecer na aba Itens.
    expect(itensNormais.some((item: { sku_descricao?: string }) => item.sku_descricao?.includes('BERCO ZUPY'))).toBe(false)

    // Ela deve aparecer na aba OS. A quantidade da própria linha (2) já É a
    // contagem de volumes físicos — NÃO multiplicar por volumes_por_item do
    // produto completo (senão 2 unidades de "VOLUME 01" virariam 4).
    expect(itensOS).toHaveLength(1)
    expect(itensOS[0].sku_descricao).toContain('BERCO ZUPY NEW MATIC')
    expect(itensOS[0].volumes_previstos_total).toBe(2)
    expect(itensOS[0].volumes_recebidos_total).toBe(0)
  })

  it('regressão: recebimento_itens incorreto já gravado no banco antes da regra existir não aparece mais na aba Itens nem duplica na aba OS (recebimento 33)', async () => {
    mockSupabase({
      recebimentos: [
        { data: { id: recebimentoId, status: 'fechado', timer_segundos_totais: 0, timer_rodando: false }, error: null },
      ],
      recebimento_nfes: [
        {
          data: [
            {
              nfe_id: 'nfe-vol',
              nfe: { numero_nf: '296631', data_emissao: '', peso_total: 0, volumes_total: 4, obs: ';   OC 4769 N/PEDIDO: R0112927;.', is_os: false, nfe_assistencias: [{ id: 'assist-4769', os_oc_numero: '4769' }] },
            },
          ],
        },
      ],
      // Registro histórico incorreto: gravado ANTES desta regra existir,
      // classificando "VOLUME 01- OFF WHITE/FREIJO/ECO" como o produto
      // completo BERCO ZUPY NEW MATIC (4/4 já "recebido").
      recebimento_itens: [
        {
          data: [
            {
              id: 'ri-historico-errado',
              nfe_item_id: 'ni-vol-1',
              volumes_previstos_total: 4,
              volumes_recebidos_total: 4,
              volumes_por_item: 2,
              corredor_final: null,
              nivel_final: null,
              prateleira_final: null,
              divergencia_tipo: null,
              divergencia_obs: null,
              avaria_foto_url: null,
              refs_display: '00061714',
              nfe_item: { codigo_produto: '00061714', descricao: 'VOLUME 01- OFF WHITE/FREIJO/ECO', quantidade: 2, volumes_por_item: 2 },
              recebimento_item_volumes: [],
            },
          ],
        },
      ],
      matic_sku: [
        {
          data: [
            { codigo_produto: '17996', descricao: 'BERCO ZUPY NEW MATIC', ref_meia: null, ref_inteira: '61714', corredor_sugerido: null, nivel_sugerido: null, prateleira_sugerida: null, volumes_por_item: 2 },
          ],
        },
      ],
      nfe_itens: [
        { data: [{ id: 'ni-vol-1', nfe_id: 'nfe-vol', nfe: { numero_nf: '296631' } }] },
        { data: [{ id: 'ni-vol-1', nfe_id: 'nfe-vol', codigo_produto: '00061714', descricao: 'VOLUME 01- OFF WHITE/FREIJO/ECO', quantidade: 2, volumes_por_item: 2 }] },
      ],
      recebimento_os: [{ data: [] }],
    })

    const response = await GET(
      new Request(`https://example.com/api/recebimento/${recebimentoId}`) as never,
      { params: Promise.resolve({ id: recebimentoId }) }
    )
    const body = await response.json()

    const itensNormais = body.itens.filter((item: { is_os: boolean }) => !item.is_os)
    const itensOS = body.itens.filter((item: { is_os: boolean }) => item.is_os)

    // O registro histórico errado não pode mais aparecer como Item completo.
    expect(itensNormais).toHaveLength(0)

    // Aparece exatamente uma vez na aba OS (não duplica: histórico + síntese).
    expect(itensOS).toHaveLength(1)
    expect(itensOS[0].sku_descricao).toContain('BERCO ZUPY NEW MATIC')
    expect(itensOS[0].volumes_previstos_total).toBe(2)
    // O "recebido=4" do registro antigo não contamina o total — a OS
    // sintética começa do zero até haver tracking próprio em recebimento_os.
    expect(itensOS[0].volumes_recebidos_total).toBe(0)

    // Totais do recebimento não podem contar o registro antigo (4/4) nem
    // duplicar com a entrada sintética.
    expect(body.total_previsto).toBe(2)
    expect(body.total_recebido).toBe(0)
  })
})
