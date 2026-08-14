import { NextResponse } from 'next/server'
import {
  FORMATOS_TAPETE_MORIAH,
  LIMITE_CORES_POR_TAPETE,
  LIMITE_TAPETES_POR_PEDIDO,
  MEDIDA_MAXIMA_CM,
  MEDIDA_MINIMA_CM,
  UNIDADE_PARA_EXIBICAO,
} from '../constantes'
import type {
  ParametrosCriarPedidoPersonalizadoLebebeExclusiveRpc,
  ParametrosAtualizarPedidoComercialMoriahRpc,
  ParametrosCriarPedidoPersonalizadoMoriahRpc,
  PedidoPersonalizadoMoriahNormalizado,
} from '../tipos'
import {
  montarPayloadTapetesMoriahRpc,
  validarPedidoPersonalizadoMoriah,
} from '../validacao'
import { permiteEdicaoAdministrativa } from '../status-fluxo'
import { classificarSituacaoPrazo } from '../prazo'
import {
  carregarContextoPedidosPersonalizados,
  type ContextoPedidosPersonalizados,
  type ResultadoContextoPedidos,
} from './contexto'
import {
  ehObjeto,
  ehUuid,
  codigoEstavelErroBanco,
  jsonErro,
  lerJsonLimitado,
  mapearErroBanco,
  registrarResultado,
  respostaProblemasDominio,
  type ContextoLogPedidos,
} from './http'
import {
  RepositorioPedidosPersonalizados,
  type CatalogosPedidos,
} from './repositorio'
import {
  montarEntradaPedido,
  statusDisponiveis,
  validarDadosAdministrativos,
  validarFiltrosPedidos,
} from './validacao-api'
import {
  validarEntradaLebebeExclusive,
  validarFiltrosCatalogoLebebeExclusive,
} from './lebebe-exclusive'
import { serializarIntegracaoProdutoSgi } from './produto-sgi'
import type { IntegracaoProdutoSgiRow } from './repositorio'

type Repositorio = RepositorioPedidosPersonalizados

export type DependenciasApiPedidos = {
  carregarContexto: typeof carregarContextoPedidosPersonalizados
  criarRepositorio: (contexto: ContextoPedidosPersonalizados) => Repositorio
}

const dependenciasPadrao: DependenciasApiPedidos = {
  carregarContexto: carregarContextoPedidosPersonalizados,
  criarRepositorio: (contexto) => new RepositorioPedidosPersonalizados(contexto.supabase),
}

function codigoPorStatus(status: number) {
  if (status === 401) return 'NAO_AUTENTICADO'
  if (status === 403) return 'ACESSO_NEGADO'
  if (status === 404) return 'PEDIDO_NAO_ENCONTRADO'
  if (status === 409) return 'CONFLITO_VERSAO'
  if (status >= 500) return 'ERRO_INTERNO'
  return 'DADOS_INVALIDOS'
}

async function carregar(
  modulos: Parameters<typeof carregarContextoPedidosPersonalizados>[0],
  log: ContextoLogPedidos,
  deps: DependenciasApiPedidos,
  opcoes?: Parameters<typeof carregarContextoPedidosPersonalizados>[1],
) {
  const resultado = opcoes === undefined
    ? await deps.carregarContexto(modulos)
    : await deps.carregarContexto(modulos, opcoes)
  if (!resultado.ok) {
    registrarResultado(log, 'erro', codigoPorStatus(resultado.response.status))
    return resultado
  }
  log.usuarioId = resultado.contexto.allowedUser.id
  return resultado
}

function falhaBanco(log: ContextoLogPedidos, error: { code?: string; message?: string }) {
  const response = mapearErroBanco(error)
  registrarResultado(log, 'erro', codigoEstavelErroBanco(error))
  return response
}

function falhaConfirmacaoCriacao(log: ContextoLogPedidos) {
  registrarResultado(log, 'erro', 'CRIACAO_PARCIAL_NAO_CONFIRMADA')
  return jsonErro(
    'CRIACAO_PARCIAL_NAO_CONFIRMADA',
    'O pedido foi salvo, mas os itens ainda não puderam ser confirmados. Tente novamente com a mesma chave de envio.',
    503
  )
}

function validarTapetesCriados(
  tapetes: unknown,
  quantidadeEsperada: number
): Array<{ id: string; ordem: number }> | null {
  if (!Array.isArray(tapetes) || tapetes.length !== quantidadeEsperada) return null
  const ids = new Set<string>()
  const ordens = new Set<number>()
  const normalizados: Array<{ id: string; ordem: number }> = []

  for (const valor of tapetes) {
    if (!ehObjeto(valor) || !ehUuid(valor.id) || !Number.isInteger(valor.ordem)) return null
    const ordem = valor.ordem as number
    if (ordem < 1 || ordem > quantidadeEsperada || ids.has(valor.id) || ordens.has(ordem)) return null
    ids.add(valor.id)
    ordens.add(ordem)
    normalizados.push({ id: valor.id, ordem })
  }

  normalizados.sort((a, b) => a.ordem - b.ordem)
  return normalizados.every((tapete, indice) => tapete.ordem === indice + 1) ? normalizados : null
}

function unidadeDoContexto(contexto: ContextoPedidosPersonalizados, chave: string) {
  return contexto.unidades.find((unidade) => unidade.chave === chave) ?? null
}

function validarRelacoesCatalogo(
  pedido: PedidoPersonalizadoMoriahNormalizado,
  catalogos: CatalogosPedidos
) {
  const coresAtivas = new Set(catalogos.cores.map((cor) => cor.id))
  const corInvalida = pedido.tapetes.some((tapete) => tapete.cores.some((cor) => !coresAtivas.has(cor.id)))
  if (corInvalida) {
    return jsonErro('COR_INVALIDA', 'Uma ou mais cores não pertencem ao catálogo Moriah ativo.', 422)
  }

  const payload = montarPayloadTapetesMoriahRpc(pedido.tapetes, catalogos.produtos)
  if (!payload.valido || !payload.dados) return respostaProblemasDominio(payload.erros)
  return payload.dados
}

function serializarItemListagem(valor: unknown) {
  const row = valor as Record<string, unknown>
  const unidade = row.unidade as { chave?: string } | null
  const fornecedor = row.fornecedor as { chave?: string; nome?: string } | null
  const chave = typeof unidade?.chave === 'string' ? unidade.chave : ''
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    unidade: {
      chave,
      nome: chave in UNIDADE_PARA_EXIBICAO
        ? UNIDADE_PARA_EXIBICAO[chave as keyof typeof UNIDADE_PARA_EXIBICAO]
        : null,
    },
    fornecedor: fornecedor ? { chave: fornecedor.chave, nome: fornecedor.nome } : null,
    consultora: row.consultora,
    cliente: row.cliente,
    telefone: row.telefone_normalizado,
    numeroLancamento: row.numero_lancamento,
    dataEntrega: row.data_entrega,
    dataPedidoFornecedor: row.data_pedido_fornecedor,
    numeroPedidoCompra: row.numero_pedido_compra,
    comprador: row.comprador,
    status: row.status,
    version: row.version,
    quantidadeTapetes: row.quantidade_tapetes,
    codigosProdutos: row.codigos_produtos,
    tiposTapetes: row.tipos_tapetes,
    quantidadeItens: row.quantidade_itens,
    referenciasProdutos: row.referencias_produtos,
    situacaoPrazo: classificarSituacaoPrazo(
      typeof row.data_entrega === 'string' ? row.data_entrega : null,
      row.status as import('../tipos').StatusPedidoPersonalizado
    ),
    recebidoEm: row.recebido_em,
    produtoSgi: serializarIntegracaoProdutoSgi(
      (row.produto_sgi as IntegracaoProdutoSgiRow | null | undefined) ?? null
    ),
  }
}

function serializarDetalhe(valor: {
  pedido: unknown
  tapetes: unknown[]
  itens: unknown[]
  historico: unknown[]
  produtoSgi: IntegracaoProdutoSgiRow | null
}) {
  const pedido = valor.pedido as Record<string, unknown>
  const fornecedor = pedido.fornecedor as Record<string, unknown> | null
  const unidade = pedido.unidade as Record<string, unknown> | null
  const chaveUnidade = typeof unidade?.chave === 'string' ? unidade.chave : ''

  return {
    id: pedido.id,
    fornecedor: fornecedor
      ? { chave: fornecedor.chave, nome: fornecedor.nome }
      : null,
    unidade: {
      chave: chaveUnidade,
      nome: chaveUnidade in UNIDADE_PARA_EXIBICAO
        ? UNIDADE_PARA_EXIBICAO[chaveUnidade as keyof typeof UNIDADE_PARA_EXIBICAO]
        : unidade?.nome ?? null,
    },
    consultora: pedido.consultora,
    cliente: pedido.cliente,
    telefone: pedido.telefone_normalizado,
    numeroLancamento: pedido.numero_lancamento,
    dataEntrega: pedido.data_entrega,
    dataPedidoFornecedor: pedido.data_pedido_fornecedor,
    numeroPedidoCompra: pedido.numero_pedido_compra,
    comprador: pedido.comprador,
    status: pedido.status,
    version: pedido.version,
    createdAt: pedido.created_at,
    updatedAt: pedido.updated_at,
    produtoSgi: serializarIntegracaoProdutoSgi(valor.produtoSgi),
    tapetes: valor.tapetes.map((item) => {
      const tapete = item as Record<string, unknown>
      return {
        id: tapete.id,
        ordem: tapete.ordem,
        formato: tapete.formato,
        tipo: tapete.tipo,
        dimensao1Cm: tapete.dimensao_1_cm,
        dimensao2Cm: tapete.dimensao_2_cm,
        areaCobradaCentesimosM2: tapete.area_cobrada_centesimos_m2,
        produto: tapete.produto,
        nomeColecaoCatalogo: tapete.nome_colecao_catalogo,
        referenciaCatalogo: tapete.referencia_catalogo,
        observacoes: tapete.observacoes,
        teveAlteracaoLayout: tapete.teve_alteracao_layout,
        quantidadeAlteracoesLayout: tapete.quantidade_alteracoes_layout,
        cores: tapete.cores,
        anexos: ((tapete.anexos as Array<Record<string, unknown>> | undefined) ?? []).map((anexo) => ({
          anexoId: anexo.id,
          slot: anexo.slot,
          nomeOriginal: anexo.nome_original,
          mime: anexo.mime_type,
          tamanho: anexo.tamanho_bytes,
          createdAt: anexo.created_at,
        })),
      }
    }),
    itens: valor.itens.map((item) => {
      const produto = item as Record<string, unknown>
      return {
        id: produto.id,
        produtoId: produto.produto_id,
        ordem: produto.ordem,
        quantidade: produto.quantidade,
        nomeOuLetra: produto.nome_ou_letra,
        colecao: produto.colecao_snapshot,
        descricao: produto.descricao_snapshot,
        referencia: produto.referencia_snapshot,
        precoUnitario: Number(produto.preco_unitario_snapshot),
        custoUnitario: Number(produto.custo_unitario_snapshot),
        totalVenda: Number(produto.total_venda),
        totalCusto: Number(produto.total_custo),
      }
    }),
    historico: (valor.historico ?? []).map((item) => {
      const evento = item as Record<string, unknown>
      const usuario = evento.usuario as Record<string, unknown> | null
      const unidadeHistorico = evento.unidade as Record<string, unknown> | null
      return {
        id: evento.id,
        statusAnterior: evento.status_anterior,
        statusNovo: evento.status_novo,
        versionAnterior: evento.version_anterior,
        versionNova: evento.version_nova,
        justificativa: evento.justificativa,
        createdAt: evento.created_at,
        usuario: typeof usuario?.email === 'string' ? { email: usuario.email } : null,
        unidade: typeof unidadeHistorico?.chave === 'string' && typeof unidadeHistorico?.nome === 'string'
          ? { chave: unidadeHistorico.chave, nome: unidadeHistorico.nome }
          : null,
      }
    }),
  }
}

export async function obterOpcoes(
  _request: Request,
  deps: DependenciasApiPedidos = dependenciasPadrao
) {
  const inicioPerformance = performance.now()
  const log: ContextoLogPedidos = { rota: '/api/pedidos-personalizados/opcoes', operacao: 'opcoes', inicio: Date.now() }
  const acesso = await carregar(['pedidos_personalizados_novo', 'pedidos_personalizados_gestao'], log, deps)
  if (!acesso.ok) return acesso.response

  const repo = deps.criarRepositorio(acesso.contexto)
  const inicioConsultas = performance.now()
  const [catalogos, fornecedores] = await Promise.all([
    repo.carregarCatalogos(),
    repo.listarFornecedoresDisponiveis(),
  ])
  const consultasMs = performance.now() - inicioConsultas
  if (catalogos.error) return falhaBanco(log, catalogos.error)
  if (fornecedores.error) return falhaBanco(log, fornecedores.error)
  if (catalogos.data.produtos.length !== 3 || catalogos.data.cores.length !== 31) {
    return falhaBanco(log, { message: 'CATALOGO_INCOMPATIVEL' })
  }

  registrarResultado(log, 'sucesso', 'OPCOES_CARREGADAS')
  console.info('[pedidos-personalizados][opcoes][perf]', {
    ...acesso.contexto.metricasPerformance,
    consultasMs: Math.round(consultasMs * 100) / 100,
    totalMs: Math.round((performance.now() - inicioPerformance) * 100) / 100,
  })
  const response = NextResponse.json({
    ok: true,
    fornecedor: catalogos.data.fornecedor,
    fornecedores: fornecedores.data,
    unidades: acesso.contexto.unidades.map(({ chave, nomeExibicao }) => ({ chave, nome: nomeExibicao })),
    produtos: catalogos.data.produtos.map(({ id, codigo, descricao, produtoIdSgi, precoM2Centavos }) => ({
      id,
      codigo,
      descricao,
      produtoIdSgi: produtoIdSgi ?? null,
      precoM2Centavos: precoM2Centavos ?? null,
    })),
    cores: catalogos.data.cores,
    formatos: [...FORMATOS_TAPETE_MORIAH],
    status: statusDisponiveis(),
    limites: {
      tapetesPorPedido: LIMITE_TAPETES_POR_PEDIDO,
      coresPorTapete: LIMITE_CORES_POR_TAPETE,
      medidaMinimaCm: MEDIDA_MINIMA_CM,
      medidaMaximaCm: MEDIDA_MAXIMA_CM,
    },
  })
  const metricas = acesso.contexto.metricasPerformance
  if (metricas) response.headers.set('Server-Timing', [
    `auth;dur=${metricas.autenticacaoMs.toFixed(2)}`,
    `permission;dur=${metricas.permissaoMs.toFixed(2)}`,
    `window;dur=${metricas.janelaMs.toFixed(2)}`,
    `units;dur=${metricas.unidadesMs.toFixed(2)}`,
    `queries;dur=${consultasMs.toFixed(2)}`,
  ].join(', '))
  return response
}

export async function pesquisarCatalogoLebebeExclusive(
  request: Request,
  deps: DependenciasApiPedidos = dependenciasPadrao
) {
  const inicioPerformance = performance.now()
  const log: ContextoLogPedidos = {
    rota: '/api/pedidos-personalizados/catalogo/lebebe-exclusive',
    operacao: 'pesquisar_catalogo',
    inicio: Date.now(),
  }
  const acesso = await carregar(
    ['pedidos_personalizados_novo', 'pedidos_personalizados_gestao'],
    log,
    deps,
    { carregarUnidades: false },
  )
  if (!acesso.ok) return acesso.response
  const inicioNormalizacao = performance.now()
  const validacao = validarFiltrosCatalogoLebebeExclusive(new URL(request.url))
  const normalizacaoMs = performance.now() - inicioNormalizacao
  if (!validacao.ok) return jsonErro('FILTRO_INSUFICIENTE', validacao.mensagem, 422)
  const inicioRepositorio = performance.now()
  const repo = deps.criarRepositorio(acesso.contexto)
  const repositorioMs = performance.now() - inicioRepositorio
  let metricasConsulta = { fornecedorMs: 0, consultaMs: 0, transformacaoMs: 0 }
  const resultado = await repo.buscarCatalogoLebebeExclusive(
    validacao.filtros,
    (metricas) => { metricasConsulta = metricas },
  )
  if (resultado.error) return falhaBanco(log, resultado.error)
  registrarResultado(log, 'sucesso', 'CATALOGO_FILTRADO')
  console.info('[pedidos-personalizados][catalogo-exclusive][perf]', {
    ...acesso.contexto.metricasPerformance,
    normalizacaoMs: Math.round(normalizacaoMs * 100) / 100,
    repositorioMs: Math.round(repositorioMs * 100) / 100,
    fornecedorMs: Math.round(metricasConsulta.fornecedorMs * 100) / 100,
    consultaMs: Math.round(metricasConsulta.consultaMs * 100) / 100,
    transformacaoMs: Math.round(metricasConsulta.transformacaoMs * 100) / 100,
    quantidade: resultado.data.itens.length,
    totalMs: Math.round((performance.now() - inicioPerformance) * 100) / 100,
  })
  const limite = 30
  const totalPaginas = Math.ceil(resultado.data.total / limite)
  const response = NextResponse.json({
    ok: true,
    itens: resultado.data.itens,
    pagina: validacao.filtros.pagina,
    totalRegistros: resultado.data.total,
    totalPaginas,
    limite,
  })
  const metricas = acesso.contexto.metricasPerformance
  if (metricas) response.headers.set('Server-Timing', [
    `auth;dur=${metricas.autenticacaoMs.toFixed(2)}`,
    `permission;dur=${metricas.permissaoMs.toFixed(2)}`,
    `window;dur=${metricas.janelaMs.toFixed(2)}`,
    `units;dur=${metricas.unidadesMs.toFixed(2)}`,
    `supplier;dur=${metricasConsulta.fornecedorMs.toFixed(2)}`,
    `catalog;dur=${metricasConsulta.consultaMs.toFixed(2)}`,
    `transform;dur=${metricasConsulta.transformacaoMs.toFixed(2)}`,
  ].join(', '))
  return response
}

async function criarPedidoLebebeExclusive(
  corpo: Record<string, unknown>,
  contexto: ContextoPedidosPersonalizados,
  log: ContextoLogPedidos,
  repo: Repositorio
) {
  log.fornecedor = 'lebebe_exclusive'
  const validacao = validarEntradaLebebeExclusive(corpo, { comercial: false })
  if (!validacao.ok) {
    log.camposInvalidos = validacao.problemas.map((problema) => problema.campo)
    registrarResultado(log, 'erro_validacao', validacao.codigo)
    return jsonErro(
      validacao.codigo,
      'Não foi possível salvar o pedido. Revise os campos indicados.',
      422,
      { campo: validacao.campo, problemas: validacao.problemas }
    )
  }
  const unidade = unidadeDoContexto(contexto, validacao.dados.unidade)
  if (!unidade) return jsonErro('UNIDADE_NAO_PERMITIDA', 'Unidade não permitida.', 403)
  const fornecedores = await repo.listarFornecedoresDisponiveis()
  if (fornecedores.error) return falhaBanco(log, fornecedores.error)
  const fornecedor = fornecedores.data.find((item) => item.chave === 'lebebe_exclusive')
  if (!fornecedor) return jsonErro('FORNECEDOR_INDISPONIVEL', 'Fornecedor indisponível.', 422)

  const parametros: ParametrosCriarPedidoPersonalizadoLebebeExclusiveRpc = {
    p_usuario_id: contexto.allowedUser.id,
    p_idempotency_key: corpo.idempotencyKey as string,
    p_fornecedor_id: fornecedor.id,
    p_unidade_id: unidade.id,
    p_consultora: validacao.dados.consultora,
    p_cliente: validacao.dados.cliente,
    p_telefone_normalizado: validacao.dados.telefoneNormalizado,
    p_numero_lancamento: validacao.dados.numeroLancamento,
    p_itens: validacao.dados.itens,
  }
  const criado = await repo.criarLebebeExclusive(parametros)
  if (criado.error) return falhaBanco(log, criado.error)
  log.pedidoId = criado.data.pedido_id
  const confirmado = await repo.buscarPedidoExclusiveCriado(
    criado.data.pedido_id,
    contexto.unidades.map((item) => item.id)
  )
  if (confirmado.error || !confirmado.data) return falhaConfirmacaoCriacao(log)
  const itens = validarTapetesCriados(confirmado.data.itens, validacao.dados.itens.length)
  if (!itens) return falhaConfirmacaoCriacao(log)
  registrarResultado(log, 'sucesso', criado.data.reutilizado ? 'PEDIDO_REUTILIZADO' : 'PEDIDO_CRIADO')
  return NextResponse.json({
    ok: true,
    pedidoId: criado.data.pedido_id,
    version: confirmado.data.version,
    status: confirmado.data.status,
    quantidadeItens: itens.length,
    reutilizado: criado.data.reutilizado,
    itens,
  }, { status: criado.data.reutilizado ? 200 : 201 })
}

export async function criarPedido(
  request: Request,
  deps: DependenciasApiPedidos = dependenciasPadrao
) {
  const log: ContextoLogPedidos = { rota: '/api/pedidos-personalizados/pedidos', operacao: 'criar', inicio: Date.now() }
  const acesso = await carregar(['pedidos_personalizados_novo'], log, deps)
  if (!acesso.ok) return acesso.response

  const corpo = await lerJsonLimitado(request)
  if (!corpo.ok) {
    registrarResultado(log, 'erro', codigoPorStatus(corpo.response.status))
    return corpo.response
  }
  if (!ehObjeto(corpo.valor) || !ehUuid(corpo.valor.idempotencyKey)) {
    registrarResultado(log, 'erro', 'IDEMPOTENCY_KEY_INVALIDA')
    return jsonErro('IDEMPOTENCY_KEY_INVALIDA', 'A chave de idempotência deve ser um UUID válido.', 422)
  }

  const repo = deps.criarRepositorio(acesso.contexto)
  if (corpo.valor.fornecedor === 'lebebe_exclusive') {
    return criarPedidoLebebeExclusive(corpo.valor, acesso.contexto, log, repo)
  }

  const entrada = montarEntradaPedido(corpo.valor, { comercial: false })
  if (!entrada.ok) {
    registrarResultado(log, 'erro', entrada.codigo)
    return jsonErro(entrada.codigo, 'Payload inválido.', entrada.codigo === 'CAMPO_NAO_PERMITIDO' ? 422 : 400)
  }
  const unidade = unidadeDoContexto(acesso.contexto, entrada.entrada.unidade)
  if (!unidade) {
    registrarResultado(log, 'erro', 'UNIDADE_NAO_PERMITIDA')
    return jsonErro('UNIDADE_NAO_PERMITIDA', 'Unidade não permitida.', 403)
  }
  log.unidade = unidade.chave

  const validacao = validarPedidoPersonalizadoMoriah(entrada.entrada)
  if (!validacao.valido || !validacao.dados) {
    registrarResultado(log, 'erro', 'DADOS_INVALIDOS')
    return respostaProblemasDominio(validacao.erros)
  }

  const catalogos = await repo.carregarCatalogos()
  if (catalogos.error) return falhaBanco(log, catalogos.error)
  const tapetesRpc = validarRelacoesCatalogo(validacao.dados, catalogos.data)
  if (tapetesRpc instanceof NextResponse) {
    registrarResultado(log, 'erro', 'RELACAO_CATALOGO_INVALIDA')
    return tapetesRpc
  }

  const parametros: ParametrosCriarPedidoPersonalizadoMoriahRpc = {
    p_usuario_id: acesso.contexto.allowedUser.id,
    p_idempotency_key: corpo.valor.idempotencyKey,
    p_fornecedor_id: catalogos.data.fornecedor.id,
    p_unidade_id: unidade.id,
    p_consultora: validacao.dados.consultora,
    p_cliente: validacao.dados.cliente,
    p_telefone_normalizado: validacao.dados.telefoneNormalizado,
    p_tapetes: tapetesRpc,
    p_numero_lancamento: validacao.dados.numeroLancamento,
    p_data_entrega: validacao.dados.dataEntrega,
    p_data_pedido_fornecedor: validacao.dados.dataPedidoFornecedor,
    p_numero_pedido_compra: validacao.dados.numeroPedidoCompra,
    p_comprador: validacao.dados.comprador,
  }
  const criado = await repo.criar(parametros)
  if (criado.error) return falhaBanco(log, criado.error)
  log.pedidoId = criado.data.pedido_id

  const pedidoCriado = await repo.buscarPedidoCriado(
    criado.data.pedido_id,
    acesso.contexto.unidades.map((item) => item.id)
  )
  if (pedidoCriado.error || !pedidoCriado.data) return falhaConfirmacaoCriacao(log)
  const tapetesCriados = validarTapetesCriados(pedidoCriado.data.tapetes, validacao.dados.tapetes.length)
  if (!tapetesCriados) return falhaConfirmacaoCriacao(log)

  registrarResultado(log, 'sucesso', criado.data.reutilizado ? 'PEDIDO_REUTILIZADO' : 'PEDIDO_CRIADO')
  return NextResponse.json({
    ok: true,
    pedidoId: criado.data.pedido_id,
    version: pedidoCriado.data.version,
    status: pedidoCriado.data.status,
    quantidadeTapetes: tapetesCriados.length,
    reutilizado: criado.data.reutilizado,
    tapetes: tapetesCriados,
  }, { status: criado.data.reutilizado ? 200 : 201 })
}

export async function listarPedidos(
  request: Request,
  deps: DependenciasApiPedidos = dependenciasPadrao
) {
  const log: ContextoLogPedidos = { rota: '/api/pedidos-personalizados/pedidos', operacao: 'listar', inicio: Date.now() }
  const acesso = await carregar(['pedidos_personalizados_gestao'], log, deps)
  if (!acesso.ok) return acesso.response

  const validacao = validarFiltrosPedidos(new URL(request.url))
  if (!validacao.ok) {
    registrarResultado(log, 'erro', 'FILTROS_INVALIDOS')
    return jsonErro('FILTROS_INVALIDOS', validacao.mensagem, 422)
  }
  if (validacao.filtros.unidade && !unidadeDoContexto(acesso.contexto, validacao.filtros.unidade)) {
    registrarResultado(log, 'erro', 'UNIDADE_NAO_PERMITIDA')
    return jsonErro('UNIDADE_NAO_PERMITIDA', 'Unidade não permitida.', 403)
  }

  const repo = deps.criarRepositorio(acesso.contexto)
  const resultado = await repo.listar(validacao.filtros, acesso.contexto.unidades)
  if (resultado.error) return falhaBanco(log, resultado.error)
  const totalPaginas = Math.max(Math.ceil(resultado.data.total / 20), 1)
  registrarResultado(log, 'sucesso', 'PEDIDOS_LISTADOS')
  return NextResponse.json({
    ok: true,
    itens: resultado.data.itens.map(serializarItemListagem),
    pagina: validacao.filtros.pagina,
    totalPaginas,
    totalRegistros: resultado.data.total,
    limite: 20,
  })
}

export async function contarPedidosPorStatus(
  request: Request,
  deps: DependenciasApiPedidos = dependenciasPadrao
) {
  const log: ContextoLogPedidos = { rota: '/api/pedidos-personalizados/pedidos/contagem-status', operacao: 'contar_status', inicio: Date.now() }
  const acesso = await carregar(['pedidos_personalizados_gestao'], log, deps)
  if (!acesso.ok) return acesso.response

  const validacao = validarFiltrosPedidos(new URL(request.url))
  if (!validacao.ok) {
    registrarResultado(log, 'erro', 'FILTROS_INVALIDOS')
    return jsonErro('FILTROS_INVALIDOS', validacao.mensagem, 422)
  }
  if (validacao.filtros.unidade && !unidadeDoContexto(acesso.contexto, validacao.filtros.unidade)) {
    registrarResultado(log, 'erro', 'UNIDADE_NAO_PERMITIDA')
    return jsonErro('UNIDADE_NAO_PERMITIDA', 'Unidade não permitida.', 403)
  }

  const repo = deps.criarRepositorio(acesso.contexto)
  const resultado = await repo.contarPorStatus(validacao.filtros, acesso.contexto.unidades)
  if (resultado.error) return falhaBanco(log, resultado.error)
  const total = Object.values(resultado.data).reduce((soma, valor) => soma + valor, 0)
  registrarResultado(log, 'sucesso', 'CONTAGENS_STATUS_LISTADAS')
  return NextResponse.json({ ok: true, contagens: resultado.data, total })
}

export async function obterDetalhePedido(
  _request: Request,
  pedidoId: string,
  deps: DependenciasApiPedidos = dependenciasPadrao
) {
  const log: ContextoLogPedidos = { rota: '/api/pedidos-personalizados/pedidos/[id]', operacao: 'detalhar', inicio: Date.now(), pedidoId }
  const acesso = await carregar(['pedidos_personalizados_gestao'], log, deps)
  if (!acesso.ok) return acesso.response
  if (!ehUuid(pedidoId)) {
    registrarResultado(log, 'erro', 'ID_INVALIDO')
    return jsonErro('ID_INVALIDO', 'ID do pedido inválido.', 400)
  }

  const repo = deps.criarRepositorio(acesso.contexto)
  const detalhe = await repo.carregarDetalhe(pedidoId, acesso.contexto.unidades.map((item) => item.id))
  if (detalhe.error) return falhaBanco(log, detalhe.error)
  if (!detalhe.data) {
    registrarResultado(log, 'erro', 'PEDIDO_NAO_ENCONTRADO')
    return jsonErro('PEDIDO_NAO_ENCONTRADO', 'Pedido não encontrado.', 404)
  }

  registrarResultado(log, 'sucesso', 'PEDIDO_CARREGADO')
  return NextResponse.json({ ok: true, pedido: serializarDetalhe(detalhe.data) })
}

export async function atualizarComercial(
  request: Request,
  pedidoId: string,
  deps: DependenciasApiPedidos = dependenciasPadrao
) {
  const log: ContextoLogPedidos = { rota: '/api/pedidos-personalizados/pedidos/[id]/comercial', operacao: 'atualizar_comercial', inicio: Date.now(), pedidoId }
  const acesso = await carregar(['pedidos_personalizados_gestao'], log, deps)
  if (!acesso.ok) return acesso.response
  if (!ehUuid(pedidoId)) return jsonErro('ID_INVALIDO', 'ID do pedido inválido.', 400)

  const corpo = await lerJsonLimitado(request)
  if (!corpo.ok) return corpo.response
  const repo = deps.criarRepositorio(acesso.contexto)
  const atual = await repo.buscarPedidoNoEscopo(pedidoId, acesso.contexto.unidades.map((item) => item.id))
  if (atual.error) return falhaBanco(log, atual.error)
  if (!atual.data) return jsonErro('PEDIDO_NAO_ENCONTRADO', 'Pedido não encontrado.', 404)
  log.fornecedor = atual.data.fornecedor?.chave

  if (atual.data.fornecedor?.chave === 'lebebe_exclusive') {
    const validacao = validarEntradaLebebeExclusive(corpo.valor, { comercial: true })
    if (!validacao.ok || validacao.dados.expectedVersion === undefined) {
      if (!validacao.ok) {
        log.camposInvalidos = validacao.problemas.map((problema) => problema.campo)
        registrarResultado(log, 'erro_validacao', validacao.codigo)
      } else {
        registrarResultado(log, 'erro_validacao', 'VERSAO_INVALIDA')
      }
      return jsonErro(
        validacao.ok ? 'VERSAO_INVALIDA' : validacao.codigo,
        validacao.ok ? 'Versão do pedido inválida.' : validacao.mensagem,
        422,
        !validacao.ok && validacao.campo ? { campo: validacao.campo } : undefined
      )
    }
    const unidadeExclusive = unidadeDoContexto(acesso.contexto, validacao.dados.unidade)
    if (!unidadeExclusive) return jsonErro('UNIDADE_NAO_PERMITIDA', 'Unidade não permitida.', 403)
    const resultadoExclusive = await repo.atualizarComercialLebebeExclusive({
      p_pedido_id: pedidoId,
      p_expected_version: validacao.dados.expectedVersion,
      p_usuario_id: acesso.contexto.allowedUser.id,
      p_unidade_id: unidadeExclusive.id,
      p_consultora: validacao.dados.consultora,
      p_cliente: validacao.dados.cliente,
      p_telefone_normalizado: validacao.dados.telefoneNormalizado,
      p_numero_lancamento: validacao.dados.numeroLancamento,
      p_itens: validacao.dados.itens,
    })
    if (resultadoExclusive.error) return falhaBanco(log, resultadoExclusive.error)
    registrarResultado(log, 'sucesso', 'PEDIDO_COMERCIAL_ATUALIZADO')
    return NextResponse.json({ ok: true, pedidoId, version: resultadoExclusive.data.version })
  }

  const entrada = montarEntradaPedido(corpo.valor, { comercial: true })
  if (!entrada.ok) {
    registrarResultado(log, 'erro', entrada.codigo)
    return jsonErro(entrada.codigo, entrada.codigo === 'CAMPO_NAO_PERMITIDO' ? 'Campo administrativo não permitido nesta rota.' : 'Payload inválido.', 422)
  }
  if (entrada.expectedVersion === undefined) {
    registrarResultado(log, 'erro', 'PAYLOAD_INVALIDO')
    return jsonErro('PAYLOAD_INVALIDO', 'Payload inválido.', 422)
  }

  const unidade = unidadeDoContexto(acesso.contexto, entrada.entrada.unidade)
  if (!unidade) return jsonErro('UNIDADE_NAO_PERMITIDA', 'Unidade não permitida.', 403)
  log.unidade = unidade.chave

  const telefoneLegadoNulo = !atual.data.telefone_normalizado && !entrada.entrada.telefone.trim()
  const validacaoCompleta = validarPedidoPersonalizadoMoriah(
    telefoneLegadoNulo ? { ...entrada.entrada, telefone: '1100000000' } : entrada.entrada
  )
  const errosFiltrados = telefoneLegadoNulo
    ? validacaoCompleta.erros.filter((item) => item.campo !== 'telefone')
    : validacaoCompleta.erros
  if (errosFiltrados.length > 0 || !validacaoCompleta.dados) {
    log.camposInvalidos = errosFiltrados.map((item) => item.campo)
    registrarResultado(log, 'erro_validacao', 'DADOS_INVALIDOS')
    return respostaProblemasDominio(errosFiltrados)
  }
  const dados = validacaoCompleta.dados

  const idsAtuais = await repo.listarTapeteIds(pedidoId)
  if (idsAtuais.error) return falhaBanco(log, idsAtuais.error)
  const conjuntoIds = new Set(idsAtuais.data)
  if (dados.tapetes.some((tapete) => tapete.id && !conjuntoIds.has(tapete.id))) {
    return jsonErro('PEDIDO_NAO_ENCONTRADO', 'Pedido não encontrado.', 404)
  }

  const catalogos = await repo.carregarCatalogos()
  if (catalogos.error) return falhaBanco(log, catalogos.error)
  const tapetesRpc = validarRelacoesCatalogo(dados, catalogos.data)
  if (tapetesRpc instanceof NextResponse) return tapetesRpc

  const resultado = await repo.atualizarComercial({
    p_pedido_id: pedidoId,
    p_expected_version: entrada.expectedVersion,
    p_usuario_id: acesso.contexto.allowedUser.id,
    p_unidade_id: unidade.id,
    p_consultora: dados.consultora,
    p_cliente: dados.cliente,
    p_telefone_normalizado: telefoneLegadoNulo ? null : dados.telefoneNormalizado,
    p_numero_lancamento: dados.numeroLancamento,
    p_tapetes: tapetesRpc,
  } satisfies ParametrosAtualizarPedidoComercialMoriahRpc)
  if (resultado.error) return falhaBanco(log, resultado.error)

  registrarResultado(log, 'sucesso', 'PEDIDO_COMERCIAL_ATUALIZADO')
  return NextResponse.json({ ok: true, pedidoId, version: resultado.data.version })
}

export async function atualizarAdministrativo(
  request: Request,
  pedidoId: string,
  deps: DependenciasApiPedidos = dependenciasPadrao
) {
  const log: ContextoLogPedidos = { rota: '/api/pedidos-personalizados/pedidos/[id]/administrativo', operacao: 'atualizar_administrativo', inicio: Date.now(), pedidoId }
  const acesso = await carregar(['pedidos_personalizados_gestao'], log, deps)
  if (!acesso.ok) return acesso.response
  if (!ehUuid(pedidoId)) return jsonErro('ID_INVALIDO', 'ID do pedido inválido.', 400)

  const corpo = await lerJsonLimitado(request)
  if (!corpo.ok) return corpo.response
  const validacao = validarDadosAdministrativos(corpo.valor)
  if (!validacao.ok) {
    const mensagem = validacao.codigo === 'CAMPO_NAO_PERMITIDO'
      ? 'Campo comercial não permitido nesta rota.'
      : 'Revise os dados administrativos.'
    return jsonErro(validacao.codigo, mensagem, 422, validacao.problemas ? { problemas: validacao.problemas } : undefined)
  }

  const repo = deps.criarRepositorio(acesso.contexto)
  const atual = await repo.buscarPedidoNoEscopo(pedidoId, acesso.contexto.unidades.map((item) => item.id))
  if (atual.error) return falhaBanco(log, atual.error)
  if (!atual.data) return jsonErro('PEDIDO_NAO_ENCONTRADO', 'Pedido não encontrado.', 404)
  if (!permiteEdicaoAdministrativa(atual.data.status)) {
    return jsonErro(
      'EDICAO_ADMINISTRATIVA_BLOQUEADA',
      'Os dados administrativos nao podem ser alterados neste status.',
      422
    )
  }
  if (validacao.dados.status !== atual.data.status) {
    return jsonErro(
      'TRANSICAO_STATUS_NAO_DEFINIDA',
      'A alteração de status ainda não está disponível.',
      422
    )
  }
  if (atual.data.status === 'EM PRODUÇÃO' && (
    validacao.dados.numeroPedidoCompra !== atual.data.numero_pedido_compra
    || validacao.dados.dataPedidoFornecedor !== atual.data.data_pedido_fornecedor
    || validacao.dados.comprador !== atual.data.comprador
  )) {
    return jsonErro(
      'CAMPOS_ADMINISTRATIVOS_BLOQUEADOS',
      'Em produção, somente a previsão de entrega do fornecedor pode ser alterada.',
      422
    )
  }

  const idsAtuais = await repo.listarTapeteIds(pedidoId)
  if (idsAtuais.error) return falhaBanco(log, idsAtuais.error)
  const conjuntoIds = new Set(idsAtuais.data)
  if (validacao.dados.layoutTapetes.some((tapete) => !conjuntoIds.has(tapete.tapete_id))) {
    return jsonErro('PEDIDO_NAO_ENCONTRADO', 'Pedido não encontrado.', 404)
  }

  const resultado = await repo.atualizarAdministrativo({
    pedidoId,
    usuarioId: acesso.contexto.allowedUser.id,
    numeroLancamentoAtual: atual.data.numero_lancamento,
    dados: validacao.dados,
  })
  if (resultado.error) return falhaBanco(log, resultado.error)

  registrarResultado(log, 'sucesso', 'PEDIDO_ADMINISTRATIVO_ATUALIZADO')
  return NextResponse.json({ ok: true, pedidoId, version: resultado.data.version })
}

export type { ResultadoContextoPedidos }
