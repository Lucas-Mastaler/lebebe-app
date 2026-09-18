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
    order: vi.fn(() => chain),
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

function mockDetalheComNfesOs(nfes: Array<{
  nfe_id: string
  nfe: {
    numero_nf: string
    is_os: boolean
    volumes_total: number
    obs: string
    nfe_assistencias: Array<{ id: string; os_oc_numero: string }>
  }
}>) {
  mockSupabase({
    recebimentos: [
      {
        data: { id: recebimentoId, status: 'aberto', timer_segundos_totais: 0, timer_rodando: false },
        error: null,
      },
    ],
    recebimento_nfes: [{ data: nfes }],
    recebimento_itens: [{ data: [] }],
    matic_sku: [{ data: [] }],
    nfe_itens: [{ data: [] }, { data: [] }],
    recebimento_os: [{ data: [] }],
    recebimento_pausas: [{ data: [] }],
  })
}

async function obterItensOs() {
  const response = await GET(
    new Request(`https://example.com/api/recebimento/${recebimentoId}`) as never,
    { params: Promise.resolve({ id: recebimentoId }) }
  )
  const body = await response.json()
  return body.itens.filter((item: { is_os: boolean }) => item.is_os)
}

const recebimentoId = '123e4567-e89b-12d3-a456-426614174000'

describe('GET /api/recebimento/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(validateMaticUser).mockResolvedValue({ authorized: true } as never)
  })

  it('associa o pedido ao par explícito N/PEDIDO e S/PEDIDO: OS', async () => {
    mockDetalheComNfesOs([
      {
        nfe_id: 'nfe-explicita',
        nfe: {
          numero_nf: '297769',
          is_os: true,
          volumes_total: 1,
          obs: 'N/PEDIDO: R0113428 S/PEDIDO: OS 4789',
          nfe_assistencias: [{ id: 'assist-4789', os_oc_numero: '4789' }],
        },
      },
    ])

    const itensOs = await obterItensOs()

    expect(itensOs).toHaveLength(1)
    expect(itensOs[0]).toMatchObject({ os_numero: '4789', pedido_numero: 'R0113428' })
  })

  it('associa um único pedido à única OS relevante da mesma NF', async () => {
    mockDetalheComNfesOs([
      {
        nfe_id: 'nfe-unica',
        nfe: {
          numero_nf: '297770',
          is_os: true,
          volumes_total: 1,
          obs: 'ASSIST.TECNICA N/PEDIDO: R0113429 OS 4790',
          nfe_assistencias: [{ id: 'assist-4790', os_oc_numero: '4790' }],
        },
      },
    ])

    const itensOs = await obterItensOs()

    expect(itensOs[0]).toMatchObject({ os_numero: '4790', pedido_numero: 'R0113429' })
  })

  it('preenche o fallback da NF OS com seu único pedido', async () => {
    mockDetalheComNfesOs([
      {
        nfe_id: 'nfe-fallback',
        nfe: {
          numero_nf: '297771',
          is_os: true,
          volumes_total: 1,
          obs: 'ASSIST.TECNICA N/PEDIDO: R0113430',
          nfe_assistencias: [],
        },
      },
    ])

    const itensOs = await obterItensOs()

    expect(itensOs[0]).toMatchObject({ os_numero: 'os-nf-297771', pedido_numero: 'R0113430' })
  })

  it('não associa pedido quando múltiplos pedidos e OS não têm pares explícitos', async () => {
    mockDetalheComNfesOs([
      {
        nfe_id: 'nfe-ambigua',
        nfe: {
          numero_nf: '297772',
          is_os: true,
          volumes_total: 1,
          obs: 'N/PEDIDO: R0113431 OS 4791 N/PEDIDO: R0113432 OS 4792',
          nfe_assistencias: [
            { id: 'assist-4791', os_oc_numero: '4791' },
            { id: 'assist-4792', os_oc_numero: '4792' },
          ],
        },
      },
    ])

    const itensOs = await obterItensOs()

    expect(itensOs).toHaveLength(2)
    expect(itensOs.every((item: { pedido_numero?: string | null }) => item.pedido_numero == null)).toBe(true)
  })

  it('isola o pedido pela NF quando a mesma OS aparece em NFs distintas', async () => {
    mockDetalheComNfesOs([
      {
        nfe_id: 'nfe-os-repetida-1',
        nfe: {
          numero_nf: '297773',
          is_os: true,
          volumes_total: 1,
          obs: 'N/PEDIDO: R0113433 S/PEDIDO: OS 4793',
          nfe_assistencias: [{ id: 'assist-4793-a', os_oc_numero: '4793' }],
        },
      },
      {
        nfe_id: 'nfe-os-repetida-2',
        nfe: {
          numero_nf: '297774',
          is_os: true,
          volumes_total: 1,
          obs: 'N/PEDIDO: R0113434 S/PEDIDO: OS 4793',
          nfe_assistencias: [{ id: 'assist-4793-b', os_oc_numero: '4793' }],
        },
      },
    ])

    const itensOs = await obterItensOs()

    expect(itensOs).toHaveLength(2)
    expect(itensOs.find((item: { numero_nf: string }) => item.numero_nf === '297773')).toMatchObject({ pedido_numero: 'R0113433' })
    expect(itensOs.find((item: { numero_nf: string }) => item.numero_nf === '297774')).toMatchObject({ pedido_numero: 'R0113434' })
  })

  it('mantém o card de OS sem pedido quando nfe.obs não tem padrão reconhecido', async () => {
    mockDetalheComNfesOs([
      {
        nfe_id: 'nfe-sem-pedido',
        nfe: {
          numero_nf: '297775',
          is_os: true,
          volumes_total: 1,
          obs: 'ASSIST.TECNICA S/PEDIDO: OS 4794',
          nfe_assistencias: [{ id: 'assist-4794', os_oc_numero: '4794' }],
        },
      },
    ])

    const itensOs = await obterItensOs()

    expect(itensOs[0]).toMatchObject({ os_numero: '4794' })
    expect(itensOs[0].pedido_numero).toBeNull()
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
      recebimento_os: [{ data: [{ os_numero: '4733', volumes_previstos: 2, volumes_recebidos: 0, divergencia_tipo: 'faltou', divergencia_obs: 'Volume ausente' }] }],
      recebimento_pausas: [{ data: [] }],
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
    expect(osItens.every((item: { divergencia_tipo: string; divergencia_obs: string }) => item.divergencia_tipo === 'faltou' && item.divergencia_obs === 'Volume ausente')).toBe(true)
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
      recebimento_pausas: [{ data: [] }],
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
      recebimento_pausas: [{ data: [] }],
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
