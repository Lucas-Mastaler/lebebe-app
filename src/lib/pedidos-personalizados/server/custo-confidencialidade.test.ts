import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ContextoPedidosPersonalizados } from './contexto'
import { listarPedidos, obterDetalhePedido, type DependenciasApiPedidos } from './handlers'
import { solicitarProdutoSgi } from './produto-sgi'
import { RepositorioPedidosPersonalizados, type IntegracaoProdutoSgiRow } from './repositorio'

const USUARIO_ID = '10000000-0000-4000-8000-000000000001'
const PEDIDO_ID = '20000000-0000-4000-8000-000000000001'
const UNIDADE_ID = '40000000-0000-4000-8000-000000000001'
const CUSTO_SGI = 77.55
const PRECO_SGI = 199.9
const CUSTO_UNITARIO = 40.05
const TOTAL_CUSTO = 80.1
const PRECO_UNITARIO = 199.9
const TOTAL_VENDA = 399.8

const produtoSgi = {
  pedido_id: PEDIDO_ID,
  status_integracao: 'CONCLUIDO',
  etapa: 'CUSTO_FINALIZADO',
  nome_produto_sgi: 'PRODUTO EXCLUSIVE',
  custo_enviado: String(CUSTO_SGI),
  preco_enviado: String(PRECO_SGI),
  produto_id_sgi: '9001',
  codigo_sgi: 'EX-1',
  operacao_pendente: null,
  lancamento_aplicado_em: null,
  status_renomeacao: 'CONCLUIDO',
  erro_renomeacao_mensagem: null,
  tentativas: 0,
  erro_codigo: null,
  erro_mensagem: null,
  solicitado_em: '2026-10-01T12:00:00Z',
  iniciado_em: null,
  concluido_em: null,
  updated_at: '2026-10-01T12:00:00Z',
} as IntegracaoProdutoSgiRow

const itemListagem = {
  id: PEDIDO_ID,
  created_at: '2026-10-01T12:00:00Z',
  updated_at: '2026-10-01T12:00:00Z',
  unidade: { chave: 'bigorrilho' },
  fornecedor: { chave: 'lebebe_exclusive', nome: 'LEBEBE EXCLUSIVE' },
  consultora: 'ANA',
  cliente: 'CLIENTE',
  telefone_normalizado: '41999999999',
  numero_lancamento: '000001',
  data_entrega: null,
  data_pedido_fornecedor: null,
  numero_pedido_compra: null,
  comprador: null,
  status: 'VENDA FECHADA',
  version: 1,
  quantidade_tapetes: 0,
  codigos_produtos: [],
  tipos_tapetes: [],
  quantidade_itens: 1,
  referencias_produtos: ['REF-1'],
  quantidade_decorisi_itens: 0,
  decorisi_dispensa_layout: false,
  referencias_decorisi: [],
  valor_total_centavos: 39980,
  recebido_em: null,
  produto_sgi: produtoSgi,
}

const detalhe = {
  pedido: {
    id: PEDIDO_ID,
    fornecedor: { chave: 'lebebe_exclusive', nome: 'LEBEBE EXCLUSIVE' },
    unidade: { chave: 'bigorrilho', nome: 'BIGORRILHO' },
    consultora: 'ANA',
    cliente: 'CLIENTE',
    telefone_normalizado: '41999999999',
    numero_lancamento: '000001',
    data_entrega: null,
    data_pedido_fornecedor: null,
    numero_pedido_compra: null,
    comprador: null,
    status: 'VENDA FECHADA',
    version: 1,
    created_at: '2026-10-01T12:00:00Z',
    updated_at: '2026-10-01T12:00:00Z',
  },
  tapetes: [],
  itens: [{
    id: '30000000-0000-4000-8000-000000000001',
    produto_id: '80000000-0000-4000-8000-000000000001',
    ordem: 1,
    quantidade: 2,
    nome_ou_letra: 'A',
    colecao_snapshot: 'COLECAO',
    descricao_snapshot: 'DESCRICAO',
    referencia_snapshot: 'REF-1',
    preco_unitario_snapshot: PRECO_UNITARIO,
    custo_unitario_snapshot: CUSTO_UNITARIO,
    total_venda: TOTAL_VENDA,
    total_custo: TOTAL_CUSTO,
  }],
  decorisiItens: [],
  historico: [],
  observacoes: [],
  produtoSgi,
}

function contexto(podeVerCustoInterno: boolean | undefined): ContextoPedidosPersonalizados {
  return {
    supabase: {} as never,
    allowedUser: { id: USUARIO_ID, email: 'tecnico@example.com', role: 'user', ativo: true },
    moduloAutorizado: 'pedidos_personalizados_gestao',
    unidades: [{ id: UNIDADE_ID, chave: 'bigorrilho', nome: 'BIGORRILHO', nomeExibicao: 'BIGORRILHO' }],
    ...(podeVerCustoInterno === undefined ? {} : { podeVerCustoInterno }),
  }
}

function deps(podeVerCustoInterno: boolean | undefined): { deps: DependenciasApiPedidos; repo: Record<string, ReturnType<typeof vi.fn>> } {
  const repo = {
    listar: vi.fn().mockResolvedValue({ data: { itens: [itemListagem], total: 1 }, error: null }),
    carregarDetalhe: vi.fn().mockResolvedValue({ data: detalhe, error: null }),
  }
  return {
    repo,
    deps: {
      carregarContexto: vi.fn().mockResolvedValue({ ok: true, contexto: contexto(podeVerCustoInterno) }),
      criarRepositorio: vi.fn(() => repo as never),
    },
  }
}

function chaves(valor: unknown, acum = new Set<string>()) {
  if (Array.isArray(valor)) {
    for (const item of valor) chaves(item, acum)
  } else if (valor && typeof valor === 'object') {
    for (const [chave, item] of Object.entries(valor)) {
      acum.add(chave)
      chaves(item, acum)
    }
  }
  return acum
}

async function respostas(podeVerCustoInterno: boolean | undefined) {
  const atual = deps(podeVerCustoInterno)
  const listagem = await listarPedidos(new Request('http://localhost/api/pedidos-personalizados/pedidos'), atual.deps)
  const detalheResposta = await obterDetalhePedido(new Request('http://localhost/api'), PEDIDO_ID, atual.deps)
  const produto = await solicitarProdutoSgi(new Request('http://localhost/api'), PEDIDO_ID, {
    carregarContexto: vi.fn().mockResolvedValue({ ok: true, contexto: contexto(podeVerCustoInterno) }),
    criarRepositorio: () => ({
      buscarPedidoNoEscopo: vi.fn().mockResolvedValue({
        data: { fornecedor: { chave: 'lebebe_exclusive' }, status: 'VENDA FECHADA' },
        error: null,
      }),
      solicitarProdutoSgi: vi.fn().mockResolvedValue({ data: produtoSgi, error: null }),
    }),
  })
  return {
    listagem: await listagem.json(),
    detalhe: await detalheResposta.json(),
    produto: await produto.json(),
    repo: atual.repo,
    status: [listagem.status, detalheResposta.status, produto.status],
  }
}

describe('confidencialidade de custo nos retornos de pedidos personalizados', () => {
  it.each([
    ['consultora', false],
    ['supervisora_loja', false],
  ])('%s não recebe custo e mantém preço e etapa', async (_perfil, permitido) => {
    const corpo = await respostas(permitido)
    const texto = JSON.stringify(corpo)
    const campos = chaves({ listagem: corpo.listagem, detalhe: corpo.detalhe, produto: corpo.produto })
    expect(corpo.status).toEqual([200, 200, 200])
    expect(campos.has('custo')).toBe(false)
    expect(campos.has('custoUnitario')).toBe(false)
    expect(campos.has('totalCusto')).toBe(false)
    expect(texto).not.toContain(String(CUSTO_SGI))
    expect(texto).not.toContain(String(CUSTO_UNITARIO))
    expect(texto).not.toContain(String(TOTAL_CUSTO))
    expect(corpo.listagem.itens[0].produtoSgi).toMatchObject({ etapa: 'CUSTO_FINALIZADO', preco: PRECO_SGI })
    expect(corpo.detalhe.pedido.itens[0]).toMatchObject({ precoUnitario: PRECO_UNITARIO, totalVenda: TOTAL_VENDA })
    expect(corpo.detalhe.pedido.produtoSgi.etapa).toBe('CUSTO_FINALIZADO')
    expect(corpo.produto.produtoSgi).toMatchObject({ etapa: 'CUSTO_FINALIZADO', preco: PRECO_SGI })
    expect(corpo.repo.listar).toHaveBeenCalledWith(expect.any(Object), expect.any(Array), { incluirCusto: false })
    expect(corpo.repo.carregarDetalhe).toHaveBeenCalledWith(PEDIDO_ID, [UNIDADE_ID], USUARIO_ID, { incluirCusto: false })
  })

  it.each(['gestao', 'pos_venda', 'superadmin'])('%s continua recebendo custo', async () => {
    const corpo = await respostas(true)
    const campos = chaves({ listagem: corpo.listagem, detalhe: corpo.detalhe, produto: corpo.produto })
    expect(campos.has('custo')).toBe(true)
    expect(campos.has('custoUnitario')).toBe(true)
    expect(campos.has('totalCusto')).toBe(true)
    expect(corpo.listagem.itens[0].produtoSgi.custo).toBe(CUSTO_SGI)
    expect(corpo.detalhe.pedido.itens[0]).toMatchObject({
      custoUnitario: CUSTO_UNITARIO,
      totalCusto: TOTAL_CUSTO,
      precoUnitario: PRECO_UNITARIO,
      totalVenda: TOTAL_VENDA,
    })
    expect(corpo.produto.produtoSgi.custo).toBe(CUSTO_SGI)
    expect(corpo.detalhe.pedido.produtoSgi.etapa).toBe('CUSTO_FINALIZADO')
    expect(corpo.repo.listar).toHaveBeenCalledWith(expect.any(Object), expect.any(Array), { incluirCusto: true })
  })

  it('autorização ausente não expõe custo', async () => {
    const corpo = await respostas(undefined)
    const campos = chaves({ listagem: corpo.listagem, detalhe: corpo.detalhe, produto: corpo.produto })
    expect(campos.has('custo')).toBe(false)
    expect(campos.has('custoUnitario')).toBe(false)
    expect(campos.has('totalCusto')).toBe(false)
    expect(corpo.listagem.itens[0].produtoSgi.preco).toBe(PRECO_SGI)
    expect(corpo.listagem.itens[0].status).toBe('VENDA FECHADA')
    expect(corpo.repo.listar).toHaveBeenCalledWith(expect.any(Object), expect.any(Array), { incluirCusto: false })
    expect(corpo.repo.carregarDetalhe).toHaveBeenCalledWith(PEDIDO_ID, [UNIDADE_ID], USUARIO_ID, { incluirCusto: false })
  })
})

function clienteConsulta() {
  const selects: string[] = []
  const from = vi.fn((tabela: string) => {
    const chain: Record<string, unknown> = {}
    const devolver = () => chain
    chain.select = vi.fn((colunas: string) => {
      selects.push(colunas)
      return chain
    })
    for (const metodo of ['eq', 'in', 'ilike', 'gte', 'lte', 'lt', 'gt', 'not', 'order']) {
      chain[metodo] = vi.fn(devolver)
    }
    chain.range = vi.fn(() => Promise.resolve(
      tabela === 'pedidos_personalizados_pedidos'
        ? { data: [{ id: PEDIDO_ID, fornecedor: { chave: 'lebebe_exclusive' } }], error: null, count: 1 }
        : { data: [], error: null },
    ))
    chain.maybeSingle = vi.fn(() => Promise.resolve(
      tabela === 'pedidos_personalizados_pedidos'
        ? { data: { id: PEDIDO_ID, fornecedor: { chave: 'lebebe_exclusive' } }, error: null }
        : { data: null, error: null },
    ))
    chain.then = (resolve: (valor: unknown) => unknown, reject: (erro?: unknown) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(resolve, reject)
    return chain
  })
  return { from, selects }
}

describe('consultas de pedidos personalizados sem custo para perfil restrito', () => {
  it('não seleciona colunas de custo e mantém preço e etapa', async () => {
    const restrito = clienteConsulta()
    const repo = new RepositorioPedidosPersonalizados({ from: restrito.from } as unknown as SupabaseClient)
    const filtros = {
      pagina: 1, unidade: null, cliente: null, consultora: null, numeroLancamento: null, status: null,
      dataInicial: null, dataFinal: null, dataPedidoFornecedorInicial: null, dataPedidoFornecedorFinal: null,
      dataEntregaInicial: null, dataEntregaFinal: null, situacaoPrazo: null, codigoProduto: null, tipoTapete: null,
    }
    await repo.listar(filtros, [{ id: UNIDADE_ID, chave: 'bigorrilho', nome: 'BIGORRILHO', nomeExibicao: 'BIGORRILHO' }], { incluirCusto: false })
    await repo.carregarDetalhe(PEDIDO_ID, [UNIDADE_ID], USUARIO_ID, { incluirCusto: false })
    const texto = restrito.selects.join('\n')
    expect(texto).not.toContain('custo_enviado')
    expect(texto).not.toContain('custo_unitario_snapshot')
    expect(texto).not.toContain('total_custo')
    expect(texto).not.toContain('procedimento_custo_sgi')
    expect(texto).toContain('preco_enviado')
    expect(texto).toContain('preco_unitario_snapshot')
    expect(texto).toContain('total_venda')
    expect(texto).toContain('etapa')

    const autorizado = clienteConsulta()
    const repoAutorizado = new RepositorioPedidosPersonalizados({ from: autorizado.from } as unknown as SupabaseClient)
    await repoAutorizado.listar(filtros, [{ id: UNIDADE_ID, chave: 'bigorrilho', nome: 'BIGORRILHO', nomeExibicao: 'BIGORRILHO' }])
    await repoAutorizado.carregarDetalhe(PEDIDO_ID, [UNIDADE_ID], USUARIO_ID)
    const textoAutorizado = autorizado.selects.join('\n')
    expect(textoAutorizado).toContain('custo_enviado')
    expect(textoAutorizado).toContain('custo_unitario_snapshot')
    expect(textoAutorizado).toContain('total_custo')
    expect(textoAutorizado).toContain('preco_enviado')
  })
})
