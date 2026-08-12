import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { RepositorioPedidosPersonalizados } from './repositorio'
import type { FiltrosPedidos } from './validacao-api'

function builder(resultado: unknown, rastreio: { order: Array<[string, unknown]> }) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    ilike: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    lte: vi.fn(() => chain),
    lt: vi.fn(() => chain),
    gt: vi.fn(() => chain),
    not: vi.fn(() => chain),
    order: vi.fn((campo: string, opcoes?: unknown) => {
      rastreio.order.push([campo, opcoes])
      return chain
    }),
    range: vi.fn(() => Promise.resolve(resultado)),
    maybeSingle: vi.fn(() => Promise.resolve(resultado)),
    then: (resolve: (valor: unknown) => unknown, reject: (erro?: unknown) => unknown) =>
      Promise.resolve(resultado).then(resolve, reject),
  }
  return chain
}

function filtros(overrides: Partial<FiltrosPedidos> = {}): FiltrosPedidos {
  return {
    pagina: 1,
    unidade: null,
    cliente: null,
    consultora: null,
    numeroLancamento: null,
    status: null,
    dataInicial: null,
    dataFinal: null,
    dataPedidoFornecedorInicial: null,
    dataPedidoFornecedorFinal: null,
    dataEntregaInicial: null,
    dataEntregaFinal: null,
    situacaoPrazo: null,
    codigoProduto: null,
    tipoTapete: null,
    ...overrides,
  }
}

const unidades = [{ id: 'unidade-1', chave: 'bigorrilho' as const, nome: 'BIGORRILHO', nomeExibicao: 'BIGORRILHO' }]

describe('repositório server-only de pedidos personalizados', () => {
  it('confirma a criação em duas consultas fixas e ordena os IDs dos tapetes por ordem', async () => {
    const rastreio = { order: [] as Array<[string, unknown]> }
    const filas: Record<string, unknown[]> = {
      pedidos_personalizados_pedidos: [{
        data: { id: 'pedido-1', unidade_id: 'unidade-1', status: 'CADASTRADO', version: 1 },
        error: null,
      }],
      pedidos_personalizados_moriah_tapetes: [{
        data: [{ id: 'tapete-1', ordem: 1 }, { id: 'tapete-2', ordem: 2 }],
        error: null,
      }],
    }
    const builders: ReturnType<typeof builder>[] = []
    const from = vi.fn((tabela: string) => {
      const atual = builder(filas[tabela].shift(), rastreio)
      builders.push(atual)
      return atual
    })
    const repo = new RepositorioPedidosPersonalizados({ from } as unknown as SupabaseClient)
    const resultado = await repo.buscarPedidoCriado('pedido-1', ['unidade-1'])

    expect(resultado.data?.tapetes).toEqual([{ id: 'tapete-1', ordem: 1 }, { id: 'tapete-2', ordem: 2 }])
    expect(from).toHaveBeenCalledTimes(2)
    expect(builders[1].select).toHaveBeenCalledWith('id, ordem')
    expect(builders[1].eq).toHaveBeenCalledWith('pedido_id', 'pedido-1')
    expect(rastreio.order).toContainEqual(['ordem', { ascending: true }])
  })

  it('carrega o preço SGI embutido na mesma consulta de produtos, sem preço quando ausente/inativo/fora de linha', async () => {
    const rastreio = { order: [] as Array<[string, unknown]> }
    const filas: Record<string, unknown[]> = {
      pedidos_personalizados_fornecedores: [
        { data: { id: 'fornecedor-1', chave: 'moriah_tapetes', nome: 'MORIAH TAPETES' }, error: null },
      ],
      pedidos_personalizados_produtos: [{
        data: [
          {
            id: 'produto-1', codigo: '21157', descricao: 'Produto 21157', ordem: 1,
            produto_id_sgi: 39744, sgi_produtos_cache: { preco: '1029.90', ativo: true, fora_linha: false },
          },
          {
            id: 'produto-2', codigo: '21158', descricao: 'Produto 21158', ordem: 2,
            produto_id_sgi: null, sgi_produtos_cache: null,
          },
          {
            id: 'produto-3', codigo: '21159', descricao: 'Produto 21159', ordem: 3,
            produto_id_sgi: 39746, sgi_produtos_cache: { preco: '1259.90', ativo: false, fora_linha: false },
          },
        ],
        error: null,
      }],
      pedidos_personalizados_cores: [{ data: [], error: null }],
    }
    const from = vi.fn((tabela: string) => builder(filas[tabela].shift(), rastreio))
    const repo = new RepositorioPedidosPersonalizados({ from } as unknown as SupabaseClient)
    const resultado = await repo.carregarCatalogos()

    expect(resultado.error).toBeNull()
    expect(resultado.data?.produtos).toEqual([
      { id: 'produto-1', codigo: '21157', descricao: 'Produto 21157', produtoIdSgi: 39744, precoM2Centavos: 102990 },
      { id: 'produto-2', codigo: '21158', descricao: 'Produto 21158', produtoIdSgi: null, precoM2Centavos: null },
      { id: 'produto-3', codigo: '21159', descricao: 'Produto 21159', produtoIdSgi: 39746, precoM2Centavos: null },
    ])
  })

  it('lista com ordem estável e carrega resumo e recebimento em lote sem N+1', async () => {
    const rastreio = { order: [] as Array<[string, unknown]> }
    const filas: Record<string, unknown[]> = {
      pedidos_personalizados_pedidos: [{
        data: [{ id: 'pedido-1', unidade: { chave: 'bigorrilho' } }],
        error: null,
        count: 41,
      }],
      pedidos_personalizados_moriah_tapetes: [{
        data: [
          { pedido_id: 'pedido-1', produto: { codigo: '21158' } },
          { pedido_id: 'pedido-1', produto: { codigo: '21158' } },
        ],
        error: null,
      }],
      pedidos_personalizados_status_historico: [{
        data: [{ pedido_id: 'pedido-1', data_recebimento: '2026-08-06', created_at: '2026-08-07T12:00:00Z' }], error: null,
      }],
    }
    const from = vi.fn((tabela: string) => builder(filas[tabela].shift(), rastreio))
    const repo = new RepositorioPedidosPersonalizados({ from } as unknown as SupabaseClient)
    const resultado = await repo.listar(filtros({ pagina: 2 }), unidades)

    expect(resultado.error).toBeNull()
    expect(resultado.data?.total).toBe(41)
    expect(resultado.data?.itens[0]).toMatchObject({ quantidade_tapetes: 2, codigos_produtos: ['21158'], recebido_em: '2026-08-06' })
    expect(from).toHaveBeenCalledTimes(3)
    expect(rastreio.order.slice(0, 2)).toEqual([
      ['created_at', { ascending: false }],
      ['id', { ascending: false }],
    ])
  })

  it('usa data_recebimento do evento quando preenchida e fallback em created_at quando legado null', async () => {
    const rastreio = { order: [] as Array<[string, unknown]> }
    const filas: Record<string, unknown[]> = {
      pedidos_personalizados_pedidos: [{
        data: [
          { id: 'pedido-1', unidade: { chave: 'bigorrilho' } },
          { id: 'pedido-2', unidade: { chave: 'bigorrilho' } },
        ],
        error: null,
        count: 2,
      }],
      pedidos_personalizados_moriah_tapetes: [{
        data: [{ pedido_id: 'pedido-1', produto: { codigo: '21158' } }],
        error: null,
      }],
      pedidos_personalizados_status_historico: [{
        data: [
          { pedido_id: 'pedido-1', data_recebimento: '2026-08-06', created_at: '2026-08-07T12:00:00Z' },
          { pedido_id: 'pedido-2', data_recebimento: null, created_at: '2026-08-10T15:30:00Z' },
        ],
        error: null,
      }],
    }
    const from = vi.fn((tabela: string) => builder(filas[tabela].shift(), rastreio))
    const repo = new RepositorioPedidosPersonalizados({ from } as unknown as SupabaseClient)
    const resultado = await repo.listar(filtros(), unidades)

    expect(resultado.error).toBeNull()
    const item1 = resultado.data?.itens.find((item) => item.id === 'pedido-1')
    const item2 = resultado.data?.itens.find((item) => item.id === 'pedido-2')
    expect(item1?.recebido_em).toBe('2026-08-06')
    expect(item2?.recebido_em).toBe('2026-08-10')
  })

  it('aplica situação de prazo no banco e exclui estados finais', async () => {
    const rastreio = { order: [] as Array<[string, unknown]> }
    const pedidosBuilder = builder({ data: [], error: null, count: 0 }, rastreio)
    const from = vi.fn(() => pedidosBuilder)
    const repo = new RepositorioPedidosPersonalizados({ from } as unknown as SupabaseClient)
    await repo.listar(filtros({ situacaoPrazo: 'ATRASADO' }), unidades)
    expect(pedidosBuilder.not).toHaveBeenCalledWith('status', 'in', '(RECEBIDO,CANCELADO)')
    expect(pedidosBuilder.lt).toHaveBeenCalledWith('data_entrega', expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/))
  })

  it('aplica filtros escapados, período semiaberto e produto sem SQL concatenado', async () => {
    const rastreio = { order: [] as Array<[string, unknown]> }
    const pedidosBuilder = builder({ data: [], error: null, count: 0 }, rastreio)
    const builders: Record<string, ReturnType<typeof builder>[]> = {
      pedidos_personalizados_produtos: [builder({ data: [{ id: 'produto-1' }], error: null }, rastreio)],
      pedidos_personalizados_moriah_tapetes: [
        builder({ data: [{ pedido_id: 'pedido-1' }], error: null }, rastreio),
        builder({ data: [], error: null }, rastreio),
      ],
      pedidos_personalizados_pedidos: [pedidosBuilder],
    }
    const from = vi.fn((tabela: string) => builders[tabela].shift())
    const repo = new RepositorioPedidosPersonalizados({ from } as unknown as SupabaseClient)
    await repo.listar(filtros({
      cliente: 'A%_B',
      consultora: 'C_D',
      numeroLancamento: '0001',
      status: 'CADASTRADO',
      dataInicial: '2026-08-01',
      dataFinal: '2026-08-05',
      dataPedidoFornecedorInicial: '2026-08-02',
      dataPedidoFornecedorFinal: '2026-08-06',
      dataEntregaInicial: '2026-08-20',
      dataEntregaFinal: '2026-08-31',
      codigoProduto: '21158',
    }), unidades)

    const pedidos = builders.pedidos_personalizados_pedidos[0]
    expect(pedidos).toBeUndefined()
    expect(from).toHaveBeenCalledTimes(3)
    expect(pedidosBuilder.ilike).toHaveBeenCalledWith('cliente', '%A\\%\\_B%')
    expect(pedidosBuilder.ilike).toHaveBeenCalledWith('consultora', '%C\\_D%')
    expect(pedidosBuilder.gte).toHaveBeenCalledWith('created_at', '2026-08-01T00:00:00-03:00')
    expect(pedidosBuilder.lt).toHaveBeenCalledWith('created_at', '2026-08-06T00:00:00-03:00')
    expect(pedidosBuilder.gte).toHaveBeenCalledWith('data_pedido_fornecedor', '2026-08-02')
    expect(pedidosBuilder.lte).toHaveBeenCalledWith('data_pedido_fornecedor', '2026-08-06')
    expect(pedidosBuilder.gte).toHaveBeenCalledWith('data_entrega', '2026-08-20')
    expect(pedidosBuilder.lte).toHaveBeenCalledWith('data_entrega', '2026-08-31')
  })

  it('carrega detalhe e historico, com tapetes e cores ordenados', async () => {
    const rastreio = { order: [] as Array<[string, unknown]> }
    const filas: Record<string, unknown[]> = {
      pedidos_personalizados_pedidos: [{ data: { id: 'pedido-1' }, error: null }],
      pedidos_personalizados_moriah_tapetes: [{ data: [{ id: 'tapete-1', ordem: 1 }], error: null }],
      pedidos_personalizados_tapete_cores: [{ data: [{ tapete_id: 'tapete-1', ordem: 1, cor: { id: 'cor-1' } }], error: null }],
      pedidos_personalizados_anexos: [{ data: [{ tapete_id: 'tapete-1', id: 'anexo-1', slot: 1, nome_original: 'arquivo.pdf', mime_type: 'application/pdf', tamanho_bytes: 10, created_at: '2026-08-05T10:00:00Z' }], error: null }],
      pedidos_personalizados_status_historico: [{ data: [], error: null }],
    }
    const from = vi.fn((tabela: string) => builder(filas[tabela].shift(), rastreio))
    const repo = new RepositorioPedidosPersonalizados({ from } as unknown as SupabaseClient)
    const resultado = await repo.carregarDetalhe('pedido-1', ['unidade-1'])
    expect(resultado.data?.tapetes[0]).toMatchObject({
      cores: [{ ordem: 1, id: 'cor-1' }],
      anexos: [{ id: 'anexo-1', slot: 1, nome_original: 'arquivo.pdf', mime_type: 'application/pdf', tamanho_bytes: 10 }],
    })
    expect(JSON.stringify(resultado.data)).not.toContain('caminho_objeto')
    expect(from).toHaveBeenCalledTimes(5)
    expect(rastreio.order).toContainEqual(['ordem', { ascending: true }])
  })
})
