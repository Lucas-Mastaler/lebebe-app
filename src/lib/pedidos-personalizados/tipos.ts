export type FormatoTapeteMoriah = 'REDONDO' | 'RETANGULAR' | 'ORGANICO'

export type TipoTapeteMoriah = 'CATALOGO' | 'PERSONALIZADO'

export type StatusPedidoPersonalizado =
  | 'RASCUNHO'
  | 'VENDA FECHADA'
  | 'AGUARDANDO LAYOUT'
  | 'AGUARDANDO APROVAÇÃO DO CLIENTE'
  | 'EM PRODUÇÃO'
  | 'RECEBIDO'
  | 'CANCELADO'

export type UnidadePedidoPersonalizado = 'bigorrilho' | 'portao' | 'marechal' | 'feira'
export type FornecedorPedidoPersonalizado = 'moriah_tapetes' | 'lebebe_exclusive'
export type CodigoProdutoMoriah = '21157' | '21158' | '21159'

export type CodigoErroPedidoPersonalizado =
  | 'FORNECEDOR_INVALIDO'
  | 'UNIDADE_INVALIDA'
  | 'STATUS_INVALIDO'
  | 'CONSULTORA_OBRIGATORIA'
  | 'CONSULTORA_INVALIDA'
  | 'CLIENTE_OBRIGATORIO'
  | 'CLIENTE_INVALIDO'
  | 'TELEFONE_OBRIGATORIO'
  | 'TELEFONE_INVALIDO'
  | 'NUMERO_LANCAMENTO_INVALIDO'
  | 'NUMERO_PEDIDO_COMPRA_INVALIDO'
  | 'COMPRADOR_INVALIDO'
  | 'LIMITE_TAPETES'
  | 'ORDEM_TAPETE_INVALIDA'
  | 'ORDEM_TAPETE_DUPLICADA'
  | 'FORMATO_INVALIDO'
  | 'MEDIDA_INVALIDA'
  | 'MEDIDA_FORA_DO_LIMITE'
  | 'DIMENSOES_INCOMPATIVEIS'
  | 'COLECAO_INVALIDA'
  | 'REFERENCIA_INVALIDA'
  | 'OBSERVACOES_EXCEDIDAS'
  | 'LIMITE_CORES'
  | 'COR_INVALIDA'
  | 'COR_DUPLICADA'
  | 'ORDEM_COR_INVALIDA'
  | 'ORDEM_COR_DUPLICADA'
  | 'LAYOUT_INVALIDO'
  | 'DATA_INVALIDA'
  | 'PRODUTO_CATALOGO_AUSENTE'
  | 'COR_CATALOGO_INCOMPLETA'
  | 'TAPETE_ID_INVALIDO'
  | 'TIPO_TAPETE_INVALIDO'
  | 'NOME_COLECAO_CATALOGO_OBRIGATORIO'
  | 'REFERENCIA_CATALOGO_OBRIGATORIA'
  | 'CLASSIFICACAO_CATALOGO_OBRIGATORIA'
  | 'CLASSIFICACAO_IGUAL_REFERENCIA_OBRIGATORIA'

export type CodigoAvisoPedidoPersonalizado =
  | 'MEDIDA_FORA_INTERVALO_RECOMENDADO'
  | 'MUITAS_ALTERACOES_LAYOUT'

export type ProblemaPedidoPersonalizado<
  Codigo extends string = CodigoErroPedidoPersonalizado | CodigoAvisoPedidoPersonalizado,
> = {
  codigo: Codigo
  campo: string
  mensagem: string
}

export type ResultadoValidacao<T> = {
  valido: boolean
  dados: T | null
  erros: ProblemaPedidoPersonalizado<CodigoErroPedidoPersonalizado>[]
  avisos: ProblemaPedidoPersonalizado<CodigoAvisoPedidoPersonalizado>[]
}

export type CorSelecionadaMoriahEntrada = {
  id: string
  ordem: number
  numero?: string
  codigo?: string
  nome?: string
}

export type CorSelecionadaMoriahNormalizada = {
  id: string
  ordem: number
  numero: string | null
  codigo: string | null
  nome: string | null
}

export type TapeteMoriahEntrada = {
  id?: string | null
  ordem: number
  formato: string
  tipo: string
  dimensao1Metros: string
  dimensao2Metros?: string | null
  nomeColecaoCatalogo?: string | null
  referenciaCatalogo?: string | null
  observacoes?: string | null
  cores?: readonly CorSelecionadaMoriahEntrada[]
  teveAlteracaoLayout?: boolean
  quantidadeAlteracoesLayout?: number | null
}

export type IdentificacaoPedidoPersonalizadoEntrada = {
  consultora: string
  cliente: string
  telefone: string
  numeroLancamento?: string | null
  numeroPedidoCompra?: string | null
  comprador?: string | null
}

export type PedidoPersonalizadoMoriahEntrada = IdentificacaoPedidoPersonalizadoEntrada & {
  fornecedor: string
  unidade: string
  dataEntrega?: string | null
  dataPedidoFornecedor?: string | null
  status?: string
  tapetes: readonly TapeteMoriahEntrada[]
}

export type ResultadoCalculoArea = {
  areaCm2: number
  areaCobradaCentesimosM2: number
}

export type ResultadoClassificacaoProdutoMoriah = {
  codigo: CodigoProdutoMoriah
  criterio: 'MEDIDA_PADRAO' | 'REDONDO' | 'DUAS_MEDIDAS_ACIMA_2M' | 'DEMAIS_CASOS'
}

export type TapeteMoriahNormalizado = {
  id: string | null
  ordem: number
  formato: FormatoTapeteMoriah
  tipo: TipoTapeteMoriah
  dimensao1Cm: number
  dimensao2Cm: number | null
  areaCobradaCentesimosM2: number
  codigoProduto: CodigoProdutoMoriah
  nomeColecaoCatalogo: string | null
  referenciaCatalogo: string | null
  observacoes: string | null
  cores: CorSelecionadaMoriahNormalizada[]
  teveAlteracaoLayout: boolean
  quantidadeAlteracoesLayout: number | null
}

export type IdentificacaoPedidoPersonalizadoNormalizada = {
  consultora: string
  cliente: string
  telefoneNormalizado: string
  numeroLancamento: string | null
  numeroPedidoCompra: string | null
  comprador: string | null
}

export type PedidoPersonalizadoMoriahNormalizado = IdentificacaoPedidoPersonalizadoNormalizada & {
  fornecedor: FornecedorPedidoPersonalizado
  unidade: UnidadePedidoPersonalizado
  dataEntrega: string | null
  dataPedidoFornecedor: string | null
  status: StatusPedidoPersonalizado
  tapetes: TapeteMoriahNormalizado[]
}

export type ProdutoCatalogoMoriah = {
  id: string
  codigo: CodigoProdutoMoriah
  descricao: string
  /** `produto_id_sgi` vinculado em `pedidos_personalizados_produtos`; `null` quando o produto não tem preço SGI vinculado. */
  produtoIdSgi?: number | null
  /** Preço oficial por m² (`sgi_produtos_cache.preco`), em centavos. `null` quando indisponível, inválido, inativo ou fora de linha no SGI. */
  precoM2Centavos?: number | null
}

export type DadosMensagemPedidoPersonalizado = {
  pedido: PedidoPersonalizadoMoriahNormalizado
  produtos: readonly ProdutoCatalogoMoriah[]
}

export type CorTapeteMoriahRpc = {
  cor_id: string
  ordem: number
}

/** Estrutura exata de cada item do JSONB `p_tapetes` das RPCs comerciais da Fase 1B. */
export type TapeteMoriahRpc = {
  id?: string
  ordem: number
  formato: FormatoTapeteMoriah
  tipo: TipoTapeteMoriah
  dimensao_1_cm: number
  dimensao_2_cm: number | null
  area_cobrada_centesimos_m2: number
  produto_id: string
  nome_colecao_catalogo: string | null
  referencia_catalogo: string | null
  observacoes: string | null
  cores: CorTapeteMoriahRpc[]
}

/** Estrutura exata de cada item do JSONB `p_layout_tapetes` da RPC administrativa da Fase 1B. */
export type LayoutTapeteMoriahRpc = {
  tapete_id: string
  teve_alteracao_layout: boolean
  quantidade_alteracoes_layout?: number
}

export type ParametrosCriarPedidoPersonalizadoMoriahRpc = {
  p_usuario_id: string
  p_idempotency_key: string
  p_fornecedor_id: string
  p_unidade_id: string
  p_consultora: string
  p_cliente: string
  p_telefone_normalizado: string
  p_tapetes: TapeteMoriahRpc[]
  p_numero_lancamento: string | null
  p_data_entrega: string | null
  p_data_pedido_fornecedor: string | null
  p_numero_pedido_compra: string | null
  p_comprador: string | null
}

export type ParametrosAtualizarPedidoComercialMoriahRpc = {
  p_pedido_id: string
  p_expected_version: number
  p_usuario_id: string
  p_unidade_id: string
  p_consultora: string
  p_cliente: string
  p_telefone_normalizado: string | null
  p_numero_lancamento: string | null
  p_tapetes: TapeteMoriahRpc[]
}

export type ParametrosAtualizarPedidoAdministrativoRpc = {
  p_pedido_id: string
  p_expected_version: number
  p_usuario_id: string
  p_numero_lancamento: string | null
  p_data_entrega: string | null
  p_data_pedido_fornecedor: string | null
  p_numero_pedido_compra: string | null
  p_comprador: string | null
  p_status: StatusPedidoPersonalizado
  p_layout_tapetes: LayoutTapeteMoriahRpc[]
}

export type ParametrosTransicionarPedidoPersonalizadoRpc = {
  p_pedido_id: string
  p_expected_version: number
  p_usuario_id: string
  p_status_destino: StatusPedidoPersonalizado
  p_numero_lancamento: string | null
  p_numero_pedido_compra: string | null
  p_data_pedido_fornecedor: string | null
  p_comprador: string | null
  p_data_entrega: string | null
  p_justificativa: string | null
}

export type ProdutoCatalogoLebebeExclusive = {
  id: string
  colecao: string
  descricao: string
  referencia: string
  precoUnitario: number
}

export type ItemPedidoLebebeExclusiveEntrada = {
  produtoId: string
  ordem: number
  quantidade: number
  nomeOuLetra?: string | null
}

export type ItemPedidoLebebeExclusiveRpc = {
  produto_id: string
  ordem: number
  quantidade: number
  nome_ou_letra: string | null
}

export type ParametrosCriarPedidoPersonalizadoLebebeExclusiveRpc = {
  p_usuario_id: string
  p_idempotency_key: string
  p_fornecedor_id: string
  p_unidade_id: string
  p_consultora: string
  p_cliente: string
  p_telefone_normalizado: string
  p_numero_lancamento: string | null
  p_itens: ItemPedidoLebebeExclusiveRpc[]
}

export type ParametrosAtualizarPedidoComercialLebebeExclusiveRpc = {
  p_pedido_id: string
  p_expected_version: number
  p_usuario_id: string
  p_unidade_id: string
  p_consultora: string
  p_cliente: string
  p_telefone_normalizado: string
  p_numero_lancamento: string | null
  p_itens: ItemPedidoLebebeExclusiveRpc[]
}
