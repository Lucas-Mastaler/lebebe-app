import type { SupabaseClient } from '@supabase/supabase-js'
import { escaparTermoIlike } from '@/lib/atendimento-presencial/clientes'
import type {
  ParametrosAtualizarPedidoAdministrativoRpc,
  ParametrosAtualizarPedidoComercialMoriahRpc,
  ParametrosCriarPedidoPersonalizadoMoriahRpc,
  ProdutoCatalogoMoriah,
  StatusPedidoPersonalizado,
} from '../tipos'
import type { UnidadeEscopoPedido } from './contexto'
import type { DadosAdministrativosNormalizados, FiltrosPedidos } from './validacao-api'
import { proximoDiaIso } from './validacao-api'

type ResultadoBanco<T> = { data: T; error: null } | { data: null; error: { code?: string; message?: string } }

export type FornecedorCatalogo = {
  id: string
  chave: string
  nome: string
}

export type CorCatalogo = {
  id: string
  numero: string
  codigo: string
  nome: string
  ordem: number
}

export type CatalogosPedidos = {
  fornecedor: FornecedorCatalogo
  produtos: ProdutoCatalogoMoriah[]
  cores: CorCatalogo[]
}

export type PedidoEscopoRow = {
  id: string
  unidade_id: string
  status: StatusPedidoPersonalizado
  version: number
}

export type TapeteCriadoRow = {
  id: string
  ordem: number
}

export type ResultadoCriacaoRpc = {
  pedido_id: string
  version: number
  reutilizado: boolean
  tapetes: unknown
}

export type ResultadoAtualizacaoComercialRpc = {
  version: number
  tapetes: unknown
}

export type ResultadoAtualizacaoAdministrativaRpc = {
  version: number
}

export class RepositorioPedidosPersonalizados {
  constructor(private readonly supabase: SupabaseClient) {}

  async carregarCatalogos(): Promise<ResultadoBanco<CatalogosPedidos>> {
    const fornecedorResult = await this.supabase
      .from('pedidos_personalizados_fornecedores')
      .select('id, chave, nome')
      .eq('chave', 'moriah_tapetes')
      .eq('disponivel', true)
      .maybeSingle()

    if (fornecedorResult.error || !fornecedorResult.data) {
      return { data: null, error: fornecedorResult.error ?? { message: 'CATALOGO_INDISPONIVEL' } }
    }

    const fornecedor = fornecedorResult.data as FornecedorCatalogo
    const [produtosResult, coresResult] = await Promise.all([
      this.supabase
        .from('pedidos_personalizados_produtos')
        .select('id, codigo, descricao, ordem')
        .eq('fornecedor_id', fornecedor.id)
        .eq('ativo', true)
        .order('ordem', { ascending: true }),
      this.supabase
        .from('pedidos_personalizados_cores')
        .select('id, numero, codigo, nome, ordem')
        .eq('fornecedor_id', fornecedor.id)
        .eq('ativo', true)
        .order('ordem', { ascending: true }),
    ])

    if (produtosResult.error) return { data: null, error: produtosResult.error }
    if (coresResult.error) return { data: null, error: coresResult.error }

    return {
      data: {
        fornecedor,
        produtos: (produtosResult.data ?? []) as unknown as ProdutoCatalogoMoriah[],
        cores: (coresResult.data ?? []) as CorCatalogo[],
      },
      error: null,
    }
  }

  async criar(parametros: ParametrosCriarPedidoPersonalizadoMoriahRpc): Promise<ResultadoBanco<ResultadoCriacaoRpc>> {
    const { data, error } = await this.supabase.rpc('criar_pedido_personalizado_moriah', parametros)
    if (error) return { data: null, error }
    const retorno = (Array.isArray(data) ? data[0] : data) as ResultadoCriacaoRpc | null
    return retorno ? { data: retorno, error: null } : { data: null, error: { message: 'RETORNO_RPC_INVALIDO' } }
  }

  async atualizarComercial(
    parametros: ParametrosAtualizarPedidoComercialMoriahRpc
  ): Promise<ResultadoBanco<ResultadoAtualizacaoComercialRpc>> {
    const { data, error } = await this.supabase.rpc('atualizar_pedido_personalizado_comercial_moriah', parametros)
    if (error) return { data: null, error }
    const retorno = (Array.isArray(data) ? data[0] : data) as ResultadoAtualizacaoComercialRpc | null
    return retorno ? { data: retorno, error: null } : { data: null, error: { message: 'RETORNO_RPC_INVALIDO' } }
  }

  async atualizarAdministrativo(params: {
    pedidoId: string
    usuarioId: string
    dados: DadosAdministrativosNormalizados
  }): Promise<ResultadoBanco<ResultadoAtualizacaoAdministrativaRpc>> {
    const parametros: ParametrosAtualizarPedidoAdministrativoRpc = {
      p_pedido_id: params.pedidoId,
      p_expected_version: params.dados.expectedVersion,
      p_usuario_id: params.usuarioId,
      p_numero_lancamento: params.dados.numeroLancamento,
      p_data_entrega: params.dados.dataEntrega,
      p_data_pedido_fornecedor: params.dados.dataPedidoFornecedor,
      p_numero_pedido_compra: params.dados.numeroPedidoCompra,
      p_comprador: params.dados.comprador,
      p_status: params.dados.status,
      p_layout_tapetes: params.dados.layoutTapetes,
    }
    const { data, error } = await this.supabase.rpc('atualizar_pedido_personalizado_administrativo', parametros)
    if (error) return { data: null, error }
    const retorno = (Array.isArray(data) ? data[0] : data) as ResultadoAtualizacaoAdministrativaRpc | null
    return retorno ? { data: retorno, error: null } : { data: null, error: { message: 'RETORNO_RPC_INVALIDO' } }
  }

  async buscarPedidoNoEscopo(
    pedidoId: string,
    unidadeIds: readonly string[]
  ): Promise<ResultadoBanco<PedidoEscopoRow | null>> {
    if (unidadeIds.length === 0) return { data: null, error: null }
    const { data, error } = await this.supabase
      .from('pedidos_personalizados_pedidos')
      .select('id, unidade_id, status, version')
      .eq('id', pedidoId)
      .in('unidade_id', [...unidadeIds])
      .maybeSingle()
    if (error) return { data: null, error }
    return { data: data as PedidoEscopoRow | null, error: null }
  }

  async buscarPedidoCriado(
    pedidoId: string,
    unidadeIds: readonly string[]
  ): Promise<ResultadoBanco<(PedidoEscopoRow & { tapetes: TapeteCriadoRow[] }) | null>> {
    const pedido = await this.buscarPedidoNoEscopo(pedidoId, unidadeIds)
    if (pedido.error || !pedido.data) return pedido as ResultadoBanco<null>
    const { data, error } = await this.supabase
      .from('pedidos_personalizados_moriah_tapetes')
      .select('id, ordem')
      .eq('pedido_id', pedidoId)
      .order('ordem', { ascending: true })
    if (error) return { data: null, error }
    return { data: { ...pedido.data, tapetes: (data ?? []) as TapeteCriadoRow[] }, error: null }
  }

  async listar(
    filtros: FiltrosPedidos,
    unidades: readonly UnidadeEscopoPedido[]
  ): Promise<ResultadoBanco<{ itens: unknown[]; total: number }>> {
    const unidadeIds = unidades.map((unidade) => unidade.id)
    if (unidadeIds.length === 0) return { data: { itens: [], total: 0 }, error: null }

    let pedidoIdsProduto: string[] | null = null
    if (filtros.codigoProduto) {
      const { data: produtos, error: produtoError } = await this.supabase
        .from('pedidos_personalizados_produtos')
        .select('id, fornecedor:pedidos_personalizados_fornecedores!inner(chave)')
        .eq('codigo', filtros.codigoProduto)
        .eq('ativo', true)
        .eq('fornecedor.chave', 'moriah_tapetes')
      if (produtoError) return { data: null, error: produtoError }
      const produtoIds = (produtos ?? []).map((produto) => produto.id)
      if (produtoIds.length === 0) return { data: { itens: [], total: 0 }, error: null }

      const { data: tapetes, error: tapetesError } = await this.supabase
        .from('pedidos_personalizados_moriah_tapetes')
        .select('pedido_id')
        .in('produto_id', produtoIds)
      if (tapetesError) return { data: null, error: tapetesError }
      pedidoIdsProduto = Array.from(new Set((tapetes ?? []).map((tapete) => tapete.pedido_id)))
      if (pedidoIdsProduto.length === 0) return { data: { itens: [], total: 0 }, error: null }
    }

    let query = this.supabase
      .from('pedidos_personalizados_pedidos')
      .select(`
        id, created_at, updated_at, unidade_id, consultora, cliente,
        numero_lancamento, data_entrega, data_pedido_fornecedor,
        numero_pedido_compra, comprador, status, version,
        fornecedor:pedidos_personalizados_fornecedores!pedidos_personalizados_pedidos_fornecedor_id_fkey(chave, nome),
        unidade:app_unidades!pedidos_personalizados_pedidos_unidade_id_fkey(chave, nome)
      `, { count: 'exact' })
      .in('unidade_id', unidadeIds)

    if (filtros.unidade) {
      const unidade = unidades.find((item) => item.chave === filtros.unidade)
      if (!unidade) return { data: { itens: [], total: 0 }, error: null }
      query = query.eq('unidade_id', unidade.id)
    }
    if (filtros.cliente) query = query.ilike('cliente', `%${escaparTermoIlike(filtros.cliente)}%`)
    if (filtros.consultora) query = query.ilike('consultora', `%${escaparTermoIlike(filtros.consultora)}%`)
    if (filtros.numeroLancamento) query = query.eq('numero_lancamento', filtros.numeroLancamento)
    if (filtros.status) query = query.eq('status', filtros.status)
    if (filtros.dataInicial) query = query.gte('created_at', `${filtros.dataInicial}T00:00:00-03:00`)
    if (filtros.dataFinal) query = query.lt('created_at', `${proximoDiaIso(filtros.dataFinal)}T00:00:00-03:00`)
    if (filtros.dataPedidoFornecedorInicial) query = query.gte('data_pedido_fornecedor', filtros.dataPedidoFornecedorInicial)
    if (filtros.dataPedidoFornecedorFinal) query = query.lte('data_pedido_fornecedor', filtros.dataPedidoFornecedorFinal)
    if (filtros.dataEntregaInicial) query = query.gte('data_entrega', filtros.dataEntregaInicial)
    if (filtros.dataEntregaFinal) query = query.lte('data_entrega', filtros.dataEntregaFinal)
    if (pedidoIdsProduto) query = query.in('id', pedidoIdsProduto)

    const inicio = (filtros.pagina - 1) * 20
    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(inicio, inicio + 19)
    if (error) return { data: null, error }

    const rows = data ?? []
    const pedidoIds = rows.map((row) => row.id)
    const resumoPorPedido = new Map<string, { quantidade: number; codigos: Set<string> }>()
    if (pedidoIds.length > 0) {
      const { data: tapetesPagina, error: paginaError } = await this.supabase
        .from('pedidos_personalizados_moriah_tapetes')
        .select('pedido_id, produto:pedidos_personalizados_produtos!pedidos_personalizados_moriah_tapetes_produto_id_fkey(codigo)')
        .in('pedido_id', pedidoIds)
      if (paginaError) return { data: null, error: paginaError }
      for (const tapete of (tapetesPagina ?? []) as unknown as Array<{ pedido_id: string; produto: { codigo: string } }>) {
        const resumo = resumoPorPedido.get(tapete.pedido_id) ?? { quantidade: 0, codigos: new Set<string>() }
        resumo.quantidade += 1
        resumo.codigos.add(tapete.produto.codigo)
        resumoPorPedido.set(tapete.pedido_id, resumo)
      }
    }

    return {
      data: {
        itens: rows.map((row) => ({
          ...row,
          quantidade_tapetes: resumoPorPedido.get(row.id)?.quantidade ?? 0,
          codigos_produtos: Array.from(resumoPorPedido.get(row.id)?.codigos ?? []).sort(),
        })),
        total: count ?? rows.length,
      },
      error: null,
    }
  }

  async carregarDetalhe(
    pedidoId: string,
    unidadeIds: readonly string[]
  ): Promise<ResultadoBanco<{ pedido: unknown; tapetes: unknown[] } | null>> {
    if (unidadeIds.length === 0) return { data: null, error: null }
    const { data: pedido, error: pedidoError } = await this.supabase
      .from('pedidos_personalizados_pedidos')
      .select(`
        id, fornecedor_id, unidade_id, consultora, cliente, numero_lancamento,
        data_entrega, data_pedido_fornecedor, numero_pedido_compra, comprador,
        status, version, created_at, updated_at,
        fornecedor:pedidos_personalizados_fornecedores!pedidos_personalizados_pedidos_fornecedor_id_fkey(chave, nome),
        unidade:app_unidades!pedidos_personalizados_pedidos_unidade_id_fkey(chave, nome)
      `)
      .eq('id', pedidoId)
      .in('unidade_id', [...unidadeIds])
      .maybeSingle()
    if (pedidoError) return { data: null, error: pedidoError }
    if (!pedido) return { data: null, error: null }

    const { data: tapetes, error: tapetesError } = await this.supabase
      .from('pedidos_personalizados_moriah_tapetes')
      .select(`
        id, ordem, formato, dimensao_1_cm, dimensao_2_cm,
        area_cobrada_centesimos_m2, nome_colecao_catalogo, referencia_catalogo,
        observacoes, teve_alteracao_layout, quantidade_alteracoes_layout,
        produto:pedidos_personalizados_produtos!pedidos_personalizados_moriah_tapetes_produto_id_fkey(id, codigo, descricao)
      `)
      .eq('pedido_id', pedidoId)
      .order('ordem', { ascending: true })
    if (tapetesError) return { data: null, error: tapetesError }

    const tapeteIds = (tapetes ?? []).map((tapete) => tapete.id)
    let cores: Array<{ tapete_id: string; ordem: number; cor: unknown }> = []
    let anexos: Array<{ tapete_id: string; id: string; slot: number; nome_original: string; mime_type: string; tamanho_bytes: number; created_at: string }> = []
    if (tapeteIds.length > 0) {
      const [coresResult, anexosResult] = await Promise.all([
        this.supabase
          .from('pedidos_personalizados_tapete_cores')
          .select('tapete_id, ordem, cor:pedidos_personalizados_cores!pedidos_personalizados_tapete_cores_cor_id_fkey(id, numero, codigo, nome)')
          .in('tapete_id', tapeteIds)
          .order('ordem', { ascending: true }),
        this.supabase
          .from('pedidos_personalizados_anexos')
          .select('tapete_id, id, slot, nome_original, mime_type, tamanho_bytes, created_at')
          .in('tapete_id', tapeteIds)
          .order('slot', { ascending: true }),
      ])
      const { data: coresData, error: coresError } = coresResult
      if (coresError) return { data: null, error: coresError }
      if (anexosResult.error) return { data: null, error: anexosResult.error }
      cores = (coresData ?? []) as unknown as typeof cores
      anexos = (anexosResult.data ?? []) as typeof anexos
    }

    return {
      data: {
        pedido,
        tapetes: (tapetes ?? []).map((tapete) => ({
          ...tapete,
          cores: cores
            .filter((item) => item.tapete_id === tapete.id)
            .sort((a, b) => a.ordem - b.ordem)
            .map((item) => ({ ordem: item.ordem, ...(item.cor as Record<string, unknown>) })),
          anexos: anexos
            .filter((item) => item.tapete_id === tapete.id)
            .map((anexo) => ({
              id: anexo.id,
              slot: anexo.slot,
              nome_original: anexo.nome_original,
              mime_type: anexo.mime_type,
              tamanho_bytes: anexo.tamanho_bytes,
              created_at: anexo.created_at,
            })),
        })),
      },
      error: null,
    }
  }

  async listarTapeteIds(pedidoId: string): Promise<ResultadoBanco<string[]>> {
    const { data, error } = await this.supabase
      .from('pedidos_personalizados_moriah_tapetes')
      .select('id')
      .eq('pedido_id', pedidoId)
    if (error) return { data: null, error }
    return { data: (data ?? []).map((tapete) => tapete.id), error: null }
  }
}
