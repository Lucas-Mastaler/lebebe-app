import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ContextoPedidosPersonalizados } from './contexto'
import type { DependenciasApiPedidos } from './handlers'
import {
  atualizarAdministrativo,
  atualizarComercial,
  criarPedido,
  listarPedidos,
  obterDetalhePedido,
  obterOpcoes,
  pesquisarCatalogoLebebeExclusive,
} from './handlers'
import type { RepositorioPedidosPersonalizados } from './repositorio'

const USUARIO_ID = '10000000-0000-4000-8000-000000000001'
const PEDIDO_ID = '20000000-0000-4000-8000-000000000001'
const TAPETE_ID = '30000000-0000-4000-8000-000000000001'
const UNIDADE_BIGORRILHO_ID = '40000000-0000-4000-8000-000000000001'
const UNIDADE_PORTAO_ID = '40000000-0000-4000-8000-000000000002'
const FORNECEDOR_ID = '50000000-0000-4000-8000-000000000001'
const FORNECEDOR_EXCLUSIVE_ID = '50000000-0000-4000-8000-000000000002'
const IDEMPOTENCY_KEY = '60000000-0000-4000-8000-000000000001'

function uuidCor(indice: number) {
  return `70000000-0000-4000-8000-${String(indice).padStart(12, '0')}`
}

const unidades = [
  { id: UNIDADE_BIGORRILHO_ID, chave: 'bigorrilho' as const, nome: 'BIGORRILHO', nomeExibicao: 'BIGORRILHO' },
  { id: UNIDADE_PORTAO_ID, chave: 'portao' as const, nome: 'PORTAO', nomeExibicao: 'PORTÃO' },
]

const catalogos = {
  fornecedor: { id: FORNECEDOR_ID, chave: 'moriah_tapetes', nome: 'MORIAH TAPETES' },
  produtos: [
    { id: '80000000-0000-4000-8000-000000000001', codigo: '21157' as const, descricao: 'Produto 21157' },
    { id: '80000000-0000-4000-8000-000000000002', codigo: '21158' as const, descricao: 'Produto 21158' },
    { id: '80000000-0000-4000-8000-000000000003', codigo: '21159' as const, descricao: 'Produto 21159' },
  ],
  cores: Array.from({ length: 31 }, (_, indice) => ({
    id: uuidCor(indice + 1),
    numero: String(indice + 1).padStart(2, '0'),
    codigo: `K-${indice + 1}`,
    nome: `Cor ${indice + 1}`,
    ordem: indice + 1,
  })),
}

function contexto(overrides: Partial<ContextoPedidosPersonalizados> = {}): ContextoPedidosPersonalizados {
  return {
    supabase: {} as never,
    allowedUser: { id: USUARIO_ID, email: 'tecnico@example.com', role: 'user', ativo: true },
    moduloAutorizado: 'pedidos_personalizados_gestao',
    unidades,
    ...overrides,
  }
}

function criarRepo(overrides: Record<string, unknown> = {}) {
  return {
    carregarCatalogos: vi.fn().mockResolvedValue({ data: catalogos, error: null }),
    listarFornecedoresDisponiveis: vi.fn().mockResolvedValue({
      data: [
        catalogos.fornecedor,
        { id: FORNECEDOR_EXCLUSIVE_ID, chave: 'lebebe_exclusive', nome: 'LEBEBE EXCLUSIVE' },
      ],
      error: null,
    }),
    buscarCatalogoLebebeExclusive: vi.fn().mockResolvedValue({ data: { itens: [], total: 0 }, error: null }),
    criar: vi.fn().mockResolvedValue({
      data: { pedido_id: PEDIDO_ID, version: 1, reutilizado: false, tapetes: [{ id: TAPETE_ID }] },
      error: null,
    }),
    buscarPedidoCriado: vi.fn().mockResolvedValue({
      data: { id: PEDIDO_ID, unidade_id: UNIDADE_BIGORRILHO_ID, status: 'RASCUNHO', version: 1, tapetes: [{ id: TAPETE_ID, ordem: 1 }] },
      error: null,
    }),
    buscarPedidoNoEscopo: vi.fn().mockResolvedValue({
      data: { id: PEDIDO_ID, unidade_id: UNIDADE_BIGORRILHO_ID, status: 'RASCUNHO', version: 1, numero_lancamento: '0001', telefone_normalizado: '41999999999', data_entrega: '2026-08-10', data_pedido_fornecedor: '2026-08-05', numero_pedido_compra: '0002', comprador: 'JOÃO SILVA' },
      error: null,
    }),
    listar: vi.fn().mockResolvedValue({ data: { itens: [], total: 0 }, error: null }),
    carregarDetalhe: vi.fn().mockResolvedValue({ data: null, error: null }),
    listarTapeteIds: vi.fn().mockResolvedValue({ data: [TAPETE_ID], error: null }),
    atualizarComercial: vi.fn().mockResolvedValue({ data: { version: 2, tapetes: [] }, error: null }),
    atualizarAdministrativo: vi.fn().mockResolvedValue({ data: { version: 2 }, error: null }),
    ...overrides,
  }
}

function deps(repo = criarRepo(), contextoAtual = contexto()): DependenciasApiPedidos {
  return {
    carregarContexto: vi.fn().mockResolvedValue({ ok: true, contexto: contextoAtual }),
    criarRepositorio: vi.fn(() => repo as unknown as RepositorioPedidosPersonalizados),
  }
}

function tapete(overrides: Record<string, unknown> = {}) {
  return {
    ordem: 1,
    formato: 'RETANGULAR',
    tipo: 'PERSONALIZADO',
    dimensao1Metros: '2,00',
    dimensao2Metros: '3,00',
    cores: [{ id: uuidCor(1), ordem: 1 }],
    ...overrides,
  }
}

function pedido(overrides: Record<string, unknown> = {}) {
  return {
    idempotencyKey: IDEMPOTENCY_KEY,
    unidade: 'bigorrilho',
    consultora: 'Ana Silva',
    cliente: 'Cliente Teste',
    telefone: '(41) 99999-9999',
    tapetes: [tapete()],
    ...overrides,
  }
}

function requestJson(valor: unknown, method = 'POST') {
  return new Request('http://localhost/api/pedidos-personalizados/pedidos', {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(valor),
  })
}

describe('opções de pedidos personalizados', () => {
  it('propaga 401 e 403 do controle de acesso', async () => {
    for (const status of [401, 403]) {
      const response = new Response('{}', { status })
      const d = deps()
      vi.mocked(d.carregarContexto).mockResolvedValueOnce({ ok: false, response })
      expect((await obterOpcoes(new Request('http://localhost'), d)).status).toBe(status)
    }
  })

  it('retorna os fornecedores disponíveis, o catálogo Moriah e as unidades permitidas', async () => {
    const response = await obterOpcoes(new Request('http://localhost'), deps())
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.fornecedor.chave).toBe('moriah_tapetes')
    expect(body.fornecedores).toEqual([
      { id: FORNECEDOR_ID, chave: 'moriah_tapetes', nome: 'MORIAH TAPETES' },
      { id: FORNECEDOR_EXCLUSIVE_ID, chave: 'lebebe_exclusive', nome: 'LEBEBE EXCLUSIVE' },
    ])
    expect(body.produtos).toHaveLength(3)
    expect(body.cores).toHaveLength(31)
    expect(body.limites.coresPorTapete).toBe(6)
    expect(body.unidades).toContainEqual({ chave: 'portao', nome: 'PORTÃO' })
    expect(JSON.stringify(body)).not.toContain('decorisi')
  })

  it('expõe somente as unidades presentes no contexto do usuário', async () => {
    const d = deps(criarRepo(), contexto({ unidades: [unidades[0]] }))
    const body = await (await obterOpcoes(new Request('http://localhost'), d)).json()
    expect(body.unidades).toEqual([{ chave: 'bigorrilho', nome: 'BIGORRILHO' }])
  })
})

describe('catálogo Lebebe Exclusive', () => {
  it('carrega o contexto sem consultar unidades', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const d = deps()

    const response = await pesquisarCatalogoLebebeExclusive(
      new Request('http://localhost/api/pedidos-personalizados/catalogo/lebebe-exclusive?colecao=arvore'),
      d,
    )

    expect(response.status).toBe(200)
    expect(d.carregarContexto).toHaveBeenCalledWith(
      ['pedidos_personalizados_novo', 'pedidos_personalizados_gestao'],
      { carregarUnidades: false },
    )
  })

  it('expõe paginação de 30 itens e encaminha a página solicitada', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const repo = criarRepo({ buscarCatalogoLebebeExclusive: vi.fn().mockResolvedValue({ data: { itens: [{ id: 'produto-1' }], total: 61 }, error: null }) })
    const response = await pesquisarCatalogoLebebeExclusive(
      new Request('http://localhost/api/pedidos-personalizados/catalogo/lebebe-exclusive?colecao=arvore&pagina=2'),
      deps(repo),
    )

    expect(await response.json()).toMatchObject({ ok: true, pagina: 2, totalRegistros: 61, totalPaginas: 3, limite: 30 })
    expect(repo.buscarCatalogoLebebeExclusive).toHaveBeenCalledWith(
      { colecao: 'ARVORE', descricao: null, referencia: null, pagina: 2 },
      expect.any(Function),
    )
  })
})

describe('criação de pedido personalizado', () => {
  beforeEach(() => vi.spyOn(console, 'info').mockImplementation(() => undefined))

  it('exige autenticação e o módulo de novo pedido', async () => {
    for (const status of [401, 403]) {
      const d = deps()
      vi.mocked(d.carregarContexto).mockResolvedValueOnce({ ok: false, response: new Response('{}', { status }) })
      expect((await criarPedido(requestJson(pedido()), d)).status).toBe(status)
      expect(d.carregarContexto).toHaveBeenCalledWith(['pedidos_personalizados_novo'])
    }
  })

  it('rejeita chave de idempotência inválida', async () => {
    const response = await criarPedido(requestJson(pedido({ idempotencyKey: 'invalida' })), deps())
    expect(response.status).toBe(422)
    expect((await response.json()).erro).toBe('IDEMPOTENCY_KEY_INVALIDA')
  })

  it.each(['feira', 'pos_venda'])('nega unidade fora do escopo: %s', async (unidade) => {
    const response = await criarPedido(requestJson(pedido({ unidade })), deps())
    expect(response.status).toBe(403)
  })

  it('recalcula área e produto e ignora valores calculados enviados pelo cliente', async () => {
    const repo = criarRepo()
    const response = await criarPedido(requestJson(pedido({
      tapetes: [tapete({ areaCobradaCentesimosM2: 1, codigoProduto: '21159', produtoId: 'forjado' })],
    })), deps(repo))
    const chamada = vi.mocked(repo.criar).mock.calls[0][0] as { p_telefone_normalizado: string; p_tapetes: Array<Record<string, unknown>> }
    expect(response.status).toBe(201)
    expect(chamada.p_telefone_normalizado).toBe('41999999999')
    expect(chamada.p_tapetes[0]).toMatchObject({
      area_cobrada_centesimos_m2: 600,
      produto_id: catalogos.produtos[1].id,
    })
  })

  it('aceita o formato inicial do domínio com layout falso, sem persistir layout no JSONB comercial', async () => {
    const repo = criarRepo()
    const response = await criarPedido(requestJson(pedido({
      tapetes: [tapete({ teveAlteracaoLayout: false, quantidadeAlteracoesLayout: 0 })],
    })), deps(repo))
    const chamada = vi.mocked(repo.criar).mock.calls[0][0] as { p_tapetes: unknown }
    expect(response.status).toBe(201)
    expect(JSON.stringify(chamada.p_tapetes)).not.toContain('layout')
  })

  it('aceita dez tapetes e rejeita onze', async () => {
    const dez = Array.from({ length: 10 }, (_, indice) => tapete({ ordem: indice + 1, cores: [] }))
    const tapetesCriados = Array.from({ length: 10 }, (_, indice) => ({
      id: `30000000-0000-4000-8000-${String(indice + 1).padStart(12, '0')}`,
      ordem: indice + 1,
    }))
    const repo = criarRepo({
      buscarPedidoCriado: vi.fn().mockResolvedValue({
        data: { id: PEDIDO_ID, unidade_id: UNIDADE_BIGORRILHO_ID, status: 'RASCUNHO', version: 1, tapetes: tapetesCriados },
        error: null,
      }),
    })
    const respostaDez = await criarPedido(requestJson(pedido({ tapetes: dez })), deps(repo))
    expect(respostaDez.status).toBe(201)
    expect((await respostaDez.json()).tapetes).toEqual(tapetesCriados)
    const onze = Array.from({ length: 11 }, (_, indice) => tapete({ ordem: indice + 1, cores: [] }))
    expect((await criarPedido(requestJson(pedido({ tapetes: onze })), deps())).status).toBe(422)
  })

  it('aceita seis cores e rejeita sete', async () => {
    const cores = (quantidade: number) => Array.from({ length: quantidade }, (_, indice) => ({ id: uuidCor(indice + 1), ordem: indice + 1 }))
    expect((await criarPedido(requestJson(pedido({ tapetes: [tapete({ cores: cores(6) })] })), deps())).status).toBe(201)
    expect((await criarPedido(requestJson(pedido({ tapetes: [tapete({ cores: cores(7) })] })), deps())).status).toBe(422)
  })

  it('bloqueia Catálogo sem nome/referência mesmo em chamada direta à API, ignorando o frontend', async () => {
    const semNome = await criarPedido(requestJson(pedido({
      tapetes: [tapete({ tipo: 'CATALOGO', nomeColecaoCatalogo: null, referenciaCatalogo: 'ABC-123', cores: [] })],
    })), deps())
    expect(semNome.status).toBe(422)
    expect((await semNome.json()).problemas).toContainEqual(expect.objectContaining({ codigo: 'NOME_COLECAO_CATALOGO_OBRIGATORIO' }))

    const semReferencia = await criarPedido(requestJson(pedido({
      tapetes: [tapete({ tipo: 'CATALOGO', nomeColecaoCatalogo: 'Coleção Formas', referenciaCatalogo: null, cores: [] })],
    })), deps())
    expect(semReferencia.status).toBe(422)
    expect((await semReferencia.json()).problemas).toContainEqual(expect.objectContaining({ codigo: 'REFERENCIA_CATALOGO_OBRIGATORIA' }))
  })

  it('aceita Catálogo completo e nunca envia cores no payload da RPC, mesmo enviadas pelo cliente', async () => {
    const repo = criarRepo()
    const response = await criarPedido(requestJson(pedido({
      tapetes: [tapete({ tipo: 'CATALOGO', nomeColecaoCatalogo: 'Coleção Formas', referenciaCatalogo: 'ABC-123', cores: [{ id: uuidCor(1), ordem: 1 }] })],
    })), deps(repo))
    expect(response.status).toBe(201)
    const chamada = vi.mocked(repo.criar).mock.calls[0][0] as { p_tapetes: Array<Record<string, unknown>> }
    expect(chamada.p_tapetes[0]).toMatchObject({ tipo: 'CATALOGO', cores: [] })
  })

  it('resolve cores no catálogo ativo', async () => {
    const response = await criarPedido(requestJson(pedido({ tapetes: [tapete({ cores: [{ id: uuidCor(99), ordem: 1 }] })] })), deps())
    expect(response.status).toBe(422)
    expect((await response.json()).erro).toBe('COR_INVALIDA')
  })

  it('retorna 200 e reutilizado no retry com a mesma chave', async () => {
    const repo = criarRepo({
      criar: vi.fn().mockResolvedValue({ data: { pedido_id: PEDIDO_ID, version: 3, reutilizado: true, tapetes: [] }, error: null }),
      buscarPedidoCriado: vi.fn().mockResolvedValue({ data: { id: PEDIDO_ID, status: 'RASCUNHO', version: 3, tapetes: [{ id: TAPETE_ID, ordem: 1 }] }, error: null }),
    })
    const response = await criarPedido(requestJson(pedido()), deps(repo))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ pedidoId: PEDIDO_ID, version: 3, reutilizado: true, quantidadeTapetes: 1, tapetes: [{ id: TAPETE_ID, ordem: 1 }] })
  })

  it.each([
    [[{ id: 'uuid-invalido', ordem: 1 }]],
    [[{ id: TAPETE_ID, ordem: 2 }]],
    [[{ id: TAPETE_ID, ordem: 1 }, { id: TAPETE_ID, ordem: 1 }]],
  ])('não associa retorno de tapetes inconsistente: %j', async (tapetesCriados) => {
    const repo = criarRepo({
      buscarPedidoCriado: vi.fn().mockResolvedValue({
        data: { id: PEDIDO_ID, unidade_id: UNIDADE_BIGORRILHO_ID, status: 'RASCUNHO', version: 1, tapetes: tapetesCriados },
        error: null,
      }),
    })
    const response = await criarPedido(requestJson(pedido()), deps(repo))
    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({ erro: 'CRIACAO_PARCIAL_NAO_CONFIRMADA' })
  })

  it('trata falha da consulta pós-criação como confirmação parcial e não repete a RPC', async () => {
    const repo = criarRepo({
      buscarPedidoCriado: vi.fn().mockResolvedValue({ data: null, error: { message: 'falha técnica' } }),
    })
    const response = await criarPedido(requestJson(pedido()), deps(repo))
    expect(response.status).toBe(503)
    expect(repo.criar).toHaveBeenCalledTimes(1)
    expect((await response.json()).mensagem).toContain('mesma chave de envio')
  })

  it('mapeia erro estável da RPC e não inclui PII nos logs', async () => {
    const info = vi.mocked(console.info)
    const repo = criarRepo({ criar: vi.fn().mockResolvedValue({ data: null, error: { code: '22023', message: 'LIMITE_TAPETES' } }) })
    const response = await criarPedido(requestJson(pedido({ cliente: 'SEGREDO CLIENTE', consultora: 'SEGREDO CONSULTORA' })), deps(repo))
    expect(response.status).toBe(422)
    await Promise.resolve()
    const logs = JSON.stringify(info.mock.calls)
    expect(logs).not.toContain('SEGREDO CLIENTE')
    expect(logs).not.toContain('SEGREDO CONSULTORA')
  })
})

describe('listagem de pedidos personalizados', () => {
  it('exige exclusivamente o módulo de gestão', async () => {
    const d = deps()
    await listarPedidos(new Request('http://localhost/api'), d)
    expect(d.carregarContexto).toHaveBeenCalledWith(['pedidos_personalizados_gestao'])
  })
  it('fixa limite 20, paginação e serializa somente campos resumidos', async () => {
    const repo = criarRepo({
      listar: vi.fn().mockResolvedValue({
        data: {
          total: 21,
          itens: [{
            id: PEDIDO_ID,
            created_at: '2026-08-05T12:00:00Z',
            updated_at: '2026-08-05T12:10:00Z',
            unidade: { chave: 'portao' },
            consultora: 'ANA',
            cliente: 'CLIENTE',
            telefone_normalizado: '41999999999',
            numero_lancamento: '0001',
            data_entrega: '2026-08-20',
            data_pedido_fornecedor: '2026-08-07',
            numero_pedido_compra: '00001',
            comprador: 'ANA SILVA',
            status: 'RASCUNHO',
            version: 1,
            quantidade_tapetes: 2,
            codigos_produtos: ['21157', '21158'],
            recebido_em: null,
            observacoes: 'não deve sair',
          }],
        },
        error: null,
      }),
    })
    const response = await listarPedidos(new Request('http://localhost/api/pedidos-personalizados/pedidos?page=2'), deps(repo))
    const body = await response.json()
    expect(body).toMatchObject({ pagina: 2, totalPaginas: 2, totalRegistros: 21, limite: 20 })
    expect(body.itens[0]).toMatchObject({
      unidade: { chave: 'portao', nome: 'PORTÃO' },
      quantidadeTapetes: 2,
      dataEntrega: '2026-08-20',
      dataPedidoFornecedor: '2026-08-07',
      numeroPedidoCompra: '00001',
      comprador: 'ANA SILVA',
      telefone: '41999999999',
      situacaoPrazo: expect.stringMatching(/NO PRAZO|PRESTES A VENCER|ATRASADO/),
      recebidoEm: null,
    })
    expect(body.itens[0]).not.toHaveProperty('observacoes')
  })

  it.each([
    ['cliente=A', 422],
    ['consultora=B', 422],
    ['dataInicial=2026-02-30', 422],
    ['dataInicial=2026-08-10&dataFinal=2026-08-01', 422],
    ['dataPedidoFornecedorInicial=2026-08-10&dataPedidoFornecedorFinal=2026-08-01', 422],
    ['dataEntregaInicial=2026-08-10&dataEntregaFinal=2026-08-01', 422],
    ['pageSize=21', 422],
    ['codigoProduto=99999', 422],
    ['numeroLancamento=12A', 422],
    ['numeroLancamento=1234567', 422],
    ['situacaoPrazo=VENCIDO', 422],
  ])('valida filtro %s', async (query, status) => {
    expect((await listarPedidos(new Request(`http://localhost/api?${query}`), deps())).status).toBe(status)
  })

  it('rejeita filtro de unidade fora do escopo', async () => {
    expect((await listarPedidos(new Request('http://localhost/api?unidade=feira'), deps())).status).toBe(403)
  })

  it('encaminha todos os filtros válidos ao repositório', async () => {
    const repo = criarRepo()
    const url = 'http://localhost/api?page=3&unidade=bigorrilho&cliente=Maria&consultora=Ana&numeroLancamento=0001&status=RASCUNHO&dataInicial=2026-08-01&dataFinal=2026-08-05&dataPedidoFornecedorInicial=2026-08-02&dataPedidoFornecedorFinal=2026-08-06&dataEntregaInicial=2026-08-20&dataEntregaFinal=2026-08-31&situacaoPrazo=PRESTES%20A%20VENCER&codigoProduto=21158'
    expect((await listarPedidos(new Request(url), deps(repo))).status).toBe(200)
    expect(repo.listar).toHaveBeenCalledWith(expect.objectContaining({
      pagina: 3,
      unidade: 'bigorrilho',
      cliente: 'Maria',
      consultora: 'Ana',
      numeroLancamento: '0001',
      dataPedidoFornecedorInicial: '2026-08-02',
      dataPedidoFornecedorFinal: '2026-08-06',
      dataEntregaInicial: '2026-08-20',
      dataEntregaFinal: '2026-08-31',
      situacaoPrazo: 'PRESTES A VENCER',
      codigoProduto: '21158',
    }), unidades)
  })
})

describe('detalhe de pedido personalizado', () => {
  it.each([null, undefined])('retorna 404 sem revelar inexistência/fora do escopo', async () => {
    const repo = criarRepo({ carregarDetalhe: vi.fn().mockResolvedValue({ data: null, error: null }) })
    expect((await obterDetalhePedido(new Request('http://localhost'), PEDIDO_ID, deps(repo))).status).toBe(404)
  })

  it('retorna dados administrativos, tapetes e cores ordenadas sem caminho de Storage', async () => {
    const repo = criarRepo({
      carregarDetalhe: vi.fn().mockResolvedValue({
        data: {
          pedido: {
            id: PEDIDO_ID,
            fornecedor: { chave: 'moriah_tapetes', nome: 'MORIAH TAPETES' },
            unidade: { chave: 'bigorrilho', nome: 'BIGORRILHO' },
            consultora: 'ANA', cliente: 'CLIENTE', telefone_normalizado: '4133334444', numero_lancamento: '001',
            data_entrega: '2026-08-10', data_pedido_fornecedor: '2026-08-05',
            numero_pedido_compra: '002', comprador: 'JOÃO', status: 'RASCUNHO',
            version: 4, created_at: 'agora', updated_at: 'agora', caminho_objeto: 'privado',
          },
          tapetes: [{
            id: TAPETE_ID, ordem: 1, formato: 'RETANGULAR', tipo: 'PERSONALIZADO', dimensao_1_cm: 200,
            dimensao_2_cm: 300, area_cobrada_centesimos_m2: 600,
            produto: catalogos.produtos[1], nome_colecao_catalogo: null,
            referencia_catalogo: null, observacoes: 'OBS', teve_alteracao_layout: false,
            quantidade_alteracoes_layout: null,
            cores: [{ id: uuidCor(1), ordem: 1, codigo: 'K-1' }],
            anexos: [{ id: '90000000-0000-4000-8000-000000000001', slot: 1, nome_original: 'layout.pdf', mime_type: 'application/pdf', tamanho_bytes: 123, created_at: 'agora', caminho_objeto: 'privado' }],
          }],
          itens: [],
          historico: [],
        },
        error: null,
      }),
    })
    const body = await (await obterDetalhePedido(new Request('http://localhost'), PEDIDO_ID, deps(repo))).json()
    expect(body.pedido).toMatchObject({ version: 4, telefone: '4133334444', dataEntrega: '2026-08-10', numeroPedidoCompra: '002' })
    expect(body.pedido.tapetes[0].tipo).toBe('PERSONALIZADO')
    expect(body.pedido.tapetes[0].cores[0]).toMatchObject({ ordem: 1, codigo: 'K-1' })
    expect(body.pedido.tapetes[0].anexos[0]).toEqual({
      anexoId: '90000000-0000-4000-8000-000000000001', slot: 1,
      nomeOriginal: 'layout.pdf', mime: 'application/pdf', tamanho: 123, createdAt: 'agora',
    })
    expect(JSON.stringify(body)).not.toContain('caminho_objeto')
    expect(JSON.stringify(body)).not.toContain('privado')
  })

  it('rejeita ID inválido', async () => {
    expect((await obterDetalhePedido(new Request('http://localhost'), 'invalido', deps())).status).toBe(400)
  })
})

describe('atualização comercial', () => {
  function payloadComercial(overrides: Record<string, unknown> = {}) {
    return { expectedVersion: 1, unidade: 'bigorrilho', consultora: 'Ana Silva', cliente: 'Cliente', telefone: '(41) 99999-9999', tapetes: [tapete({ id: TAPETE_ID })], ...overrides }
  }

  it('recalcula dados e retorna nova versão', async () => {
    const repo = criarRepo()
    const response = await atualizarComercial(requestJson(payloadComercial(), 'PATCH'), PEDIDO_ID, deps(repo))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ pedidoId: PEDIDO_ID, version: 2 })
    expect(repo.atualizarComercial).toHaveBeenCalledWith(expect.objectContaining({
      p_expected_version: 1,
      p_telefone_normalizado: '41999999999',
      p_tapetes: [expect.objectContaining({ area_cobrada_centesimos_m2: 600, produto_id: catalogos.produtos[1].id })],
    }))
  })

  it.each([
    ['status', 'RECEBIDO'],
    ['comprador', 'JOÃO'],
    ['numeroPedidoCompra', '1'],
    ['dataEntrega', '05/08/2026'],
  ])('rejeita campo administrativo %s', async (campo, valor) => {
    const response = await atualizarComercial(requestJson(payloadComercial({ [campo]: valor }), 'PATCH'), PEDIDO_ID, deps())
    expect(response.status).toBe(422)
    expect((await response.json()).erro).toBe('CAMPO_NAO_PERMITIDO')
  })

  it.each([
    ['RASCUNHO', { code: 'P0003', message: 'CONFLITO_VERSAO' }, 409, 'CONFLITO_VERSAO'],
    ['EM PRODUÇÃO', { code: 'P0001', message: 'EDICAO_COMERCIAL_BLOQUEADA' }, 422, 'EDICAO_COMERCIAL_BLOQUEADA'],
    ['RECEBIDO', { code: 'P0001', message: 'EDICAO_COMERCIAL_BLOQUEADA' }, 422, 'EDICAO_COMERCIAL_BLOQUEADA'],
  ])('mapeia erro da RPC no status %s', async (statusAtual, error, status, codigo) => {
    const repo = criarRepo({
      buscarPedidoNoEscopo: vi.fn().mockResolvedValue({
        data: { id: PEDIDO_ID, unidade_id: UNIDADE_BIGORRILHO_ID, status: statusAtual, version: 1 },
        error: null,
      }),
      atualizarComercial: vi.fn().mockResolvedValue({ data: null, error }),
    })
    const response = await atualizarComercial(requestJson(payloadComercial(), 'PATCH'), PEDIDO_ID, deps(repo))
    expect(response.status).toBe(status)
    expect((await response.json()).erro).toBe(codigo)
  })

  it('retorna 404 para pedido ou tapete fora do escopo', async () => {
    const semPedido = criarRepo({ buscarPedidoNoEscopo: vi.fn().mockResolvedValue({ data: null, error: null }) })
    expect((await atualizarComercial(requestJson(payloadComercial(), 'PATCH'), PEDIDO_ID, deps(semPedido))).status).toBe(404)
    const outroTapete = criarRepo({ listarTapeteIds: vi.fn().mockResolvedValue({ data: [], error: null }) })
    expect((await atualizarComercial(requestJson(payloadComercial(), 'PATCH'), PEDIDO_ID, deps(outroTapete))).status).toBe(404)
  })

  it('nega nova unidade fora do escopo', async () => {
    expect((await atualizarComercial(requestJson(payloadComercial({ unidade: 'feira' }), 'PATCH'), PEDIDO_ID, deps())).status).toBe(403)
  })

  it('permite editar comercial de pedido legado sem telefone em operação atômica única', async () => {
    const repoLegacy = criarRepo({
      buscarPedidoNoEscopo: vi.fn().mockResolvedValue({
        data: { id: PEDIDO_ID, unidade_id: UNIDADE_BIGORRILHO_ID, status: 'RASCUNHO', version: 1, numero_lancamento: '0001', telefone_normalizado: null, data_entrega: null, data_pedido_fornecedor: null, numero_pedido_compra: null, comprador: null },
        error: null,
      }),
    })
    const response = await atualizarComercial(
      requestJson(payloadComercial({ telefone: '', numeroLancamento: '0002' }), 'PATCH'),
      PEDIDO_ID,
      deps(repoLegacy),
    )
    expect(response.status).toBe(200)
    expect(repoLegacy.atualizarComercial).toHaveBeenCalledTimes(1)
    expect(repoLegacy.atualizarComercial).toHaveBeenCalledWith(expect.objectContaining({
      p_telefone_normalizado: null,
      p_numero_lancamento: '0002',
    }))
  })
})

describe('atualização administrativa', () => {
  function payloadAdministrativo(overrides: Record<string, unknown> = {}) {
    return {
      expectedVersion: 1,
      dataEntrega: '10/08/2026',
      dataPedidoFornecedor: '05/08/2026',
      numeroPedidoCompra: '0002',
      comprador: 'João Silva',
      status: 'RASCUNHO',
      layoutTapetes: [{ tapeteId: TAPETE_ID, teveAlteracaoLayout: true, quantidadeAlteracoesLayout: 2 }],
      ...overrides,
    }
  }

  it.each(['123456', '12A45'])('rejeita pedido de compra acima do limite ou não numérico: %s', async (numeroPedidoCompra) => {
    const response = await atualizarAdministrativo(requestJson(payloadAdministrativo({ numeroPedidoCompra }), 'PATCH'), PEDIDO_ID, deps())
    expect(response.status).toBe(422)
  })

  it.each(['RASCUNHO', 'VENDA FECHADA', 'AGUARDANDO LAYOUT', 'AGUARDANDO APROVAÇÃO DO CLIENTE', 'EM PRODUÇÃO'])(
    'preserva o status administrativo editavel %s',
    async (status) => {
      const repo = criarRepo({
        buscarPedidoNoEscopo: vi.fn().mockResolvedValue({
          data: { id: PEDIDO_ID, unidade_id: UNIDADE_BIGORRILHO_ID, status, version: 1, numero_lancamento: '0001', data_entrega: '2026-08-10', data_pedido_fornecedor: '2026-08-05', numero_pedido_compra: '0002', comprador: 'JOÃO SILVA' },
          error: null,
        }),
      })
      const response = await atualizarAdministrativo(requestJson(payloadAdministrativo({ status }), 'PATCH'), PEDIDO_ID, deps(repo))
      expect(response.status).toBe(200)
      expect(repo.atualizarAdministrativo).toHaveBeenCalledWith(expect.objectContaining({
        numeroLancamentoAtual: '0001',
        dados: expect.objectContaining({ status, dataEntrega: '2026-08-10' }),
      }))
    }
  )

  it.each(['RECEBIDO', 'CANCELADO'])('bloqueia edicao administrativa em %s', async (status) => {
    const repo = criarRepo({
      buscarPedidoNoEscopo: vi.fn().mockResolvedValue({
        data: { id: PEDIDO_ID, unidade_id: UNIDADE_BIGORRILHO_ID, status, version: 1, numero_lancamento: '0001', data_entrega: '2026-08-10', data_pedido_fornecedor: '2026-08-05', numero_pedido_compra: '0002', comprador: 'JOÃO SILVA' },
        error: null,
      }),
    })
    const response = await atualizarAdministrativo(requestJson(payloadAdministrativo({ status }), 'PATCH'), PEDIDO_ID, deps(repo))
    expect(response.status).toBe(422)
    expect((await response.json()).erro).toBe('EDICAO_ADMINISTRATIVA_BLOQUEADA')
    expect(repo.atualizarAdministrativo).not.toHaveBeenCalled()
  })

  it('em produção permite somente alterar a previsão de entrega', async () => {
    const atual = { id: PEDIDO_ID, unidade_id: UNIDADE_BIGORRILHO_ID, status: 'EM PRODUÇÃO', version: 1, numero_lancamento: '0001', data_entrega: '2026-08-10', data_pedido_fornecedor: '2026-08-05', numero_pedido_compra: '0002', comprador: 'JOÃO SILVA' }
    const repo = criarRepo({ buscarPedidoNoEscopo: vi.fn().mockResolvedValue({ data: atual, error: null }) })
    expect((await atualizarAdministrativo(requestJson(payloadAdministrativo({ status: 'EM PRODUÇÃO', dataEntrega: '11/08/2026' }), 'PATCH'), PEDIDO_ID, deps(repo))).status).toBe(200)
    const bloqueado = await atualizarAdministrativo(requestJson(payloadAdministrativo({ status: 'EM PRODUÇÃO', numeroPedidoCompra: '0003' }), 'PATCH'), PEDIDO_ID, deps(repo))
    expect(bloqueado.status).toBe(422)
    expect((await bloqueado.json()).erro).toBe('CAMPOS_ADMINISTRATIVOS_BLOQUEADOS')
  })

  it.each(['AGUARDANDO LAYOUT', 'AGUARDANDO APROVAÇÃO DO CLIENTE', 'EM PRODUÇÃO', 'RECEBIDO'])(
    'não inventa transição administrativa para %s',
    async (status) => {
      const repo = criarRepo()
      const response = await atualizarAdministrativo(requestJson(payloadAdministrativo({ status }), 'PATCH'), PEDIDO_ID, deps(repo))
      expect(response.status).toBe(422)
      expect((await response.json()).erro).toBe('TRANSICAO_STATUS_NAO_DEFINIDA')
      expect(repo.atualizarAdministrativo).not.toHaveBeenCalled()
    }
  )

  it('rejeita campo comercial', async () => {
    const response = await atualizarAdministrativo(requestJson(payloadAdministrativo({ cliente: 'ALTERADO' }), 'PATCH'), PEDIDO_ID, deps())
    expect(response.status).toBe(422)
    expect((await response.json()).erro).toBe('CAMPO_NAO_PERMITIDO')
  })

  it('retorna 404 para tapete de outro pedido', async () => {
    const repo = criarRepo({ listarTapeteIds: vi.fn().mockResolvedValue({ data: [], error: null }) })
    expect((await atualizarAdministrativo(requestJson(payloadAdministrativo(), 'PATCH'), PEDIDO_ID, deps(repo))).status).toBe(404)
  })

  it('mapeia conflito de versão', async () => {
    const repo = criarRepo({ atualizarAdministrativo: vi.fn().mockResolvedValue({ data: null, error: { code: 'P0003', message: 'CONFLITO_VERSAO' } }) })
    const response = await atualizarAdministrativo(requestJson(payloadAdministrativo(), 'PATCH'), PEDIDO_ID, deps(repo))
    expect(response.status).toBe(409)
    expect((await response.json()).erro).toBe('CONFLITO_VERSAO')
  })

  it('valida datas, comprador e layout', async () => {
    for (const invalido of [
      { dataEntrega: '31/02/2026' },
      { comprador: 'J@' },
      { layoutTapetes: [{ tapeteId: TAPETE_ID, teveAlteracaoLayout: true, quantidadeAlteracoesLayout: 0 }] },
    ]) {
      expect((await atualizarAdministrativo(requestJson(payloadAdministrativo(invalido), 'PATCH'), PEDIDO_ID, deps())).status).toBe(422)
    }
  })

  it('rejeita lançamento na rota administrativa', async () => {
    const response = await atualizarAdministrativo(requestJson(payloadAdministrativo({ numeroLancamento: '000001' }), 'PATCH'), PEDIDO_ID, deps())
    expect(response.status).toBe(422)
    expect((await response.json()).erro).toBe('CAMPO_NAO_PERMITIDO')
  })

  it('rejeita data do pedido ao fornecedor futura na edição administrativa', async () => {
    const response = await atualizarAdministrativo(
      requestJson(payloadAdministrativo({ dataPedidoFornecedor: '2099-01-01' }), 'PATCH'),
      PEDIDO_ID,
      deps(),
    )
    expect(response.status).toBe(422)
    const body = await response.json()
    expect(body.problemas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ campo: 'dataPedidoFornecedor', mensagem: expect.stringContaining('não pode ser futura') }),
      ])
    )
  })
})

describe('erros desconhecidos e segurança da resposta', () => {
  it('retorna 500 sem stack, SQL ou PII', async () => {
    const repo = criarRepo({ listar: vi.fn().mockResolvedValue({ data: null, error: { code: 'XX000', message: 'select segredo from cliente' } }) })
    const response = await listarPedidos(new Request('http://localhost/api'), deps(repo))
    const texto = JSON.stringify(await response.json())
    expect(response.status).toBe(500)
    expect(texto).not.toContain('select segredo')
    expect(texto).not.toContain('stack')
  })
})
