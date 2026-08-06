import {
  AVISO_MUITAS_ALTERACOES_LAYOUT,
  AVISO_MUITAS_CORES,
  AVISO_MEDIDA_RECOMENDADA,
  FORNECEDOR_MORIAH,
  LIMITE_CORES_POR_TAPETE,
  LIMITE_TAPETES_POR_PEDIDO,
  ehFormatoTapeteMoriah,
  ehStatusPedidoPersonalizado,
  ehUnidadePedidoPersonalizado,
} from './constantes'
import {
  calcularAreaCobradaCentesimosM2,
  classificarProdutoMoriah,
  converterMedidaMetrosParaCentimetros,
  verificarMedidaRecomendada,
} from './medidas'
import {
  normalizarCliente,
  normalizarComprador,
  normalizarConsultora,
  normalizarNomeColecaoCatalogo,
  normalizarNumeroLancamento,
  normalizarNumeroPedidoCompra,
  normalizarObservacoes,
  normalizarReferenciaCatalogo,
} from './normalizacao'
import type {
  CodigoAvisoPedidoPersonalizado,
  CodigoErroPedidoPersonalizado,
  CorSelecionadaMoriahEntrada,
  CorSelecionadaMoriahNormalizada,
  LayoutTapeteMoriahRpc,
  PedidoPersonalizadoMoriahEntrada,
  PedidoPersonalizadoMoriahNormalizado,
  ProblemaPedidoPersonalizado,
  ProdutoCatalogoMoriah,
  ResultadoValidacao,
  TapeteMoriahNormalizado,
  TapeteMoriahRpc,
} from './tipos'

const LETRAS_E_ESPACOS = /^\p{L}+(?: \p{L}+)*$/u
const NUMERO_LANCAMENTO = /^\d{1,6}$/
const NUMERO_PEDIDO_COMPRA = /^\d{1,20}$/
const REFERENCIA_CATALOGO = /^[A-Z0-9-]+$/

type Erro = ProblemaPedidoPersonalizado<CodigoErroPedidoPersonalizado>
type Aviso = ProblemaPedidoPersonalizado<CodigoAvisoPedidoPersonalizado>

function comCampo<T extends { campo: string }>(problema: T, campo: string): T {
  return { ...problema, campo }
}

function erro(codigo: CodigoErroPedidoPersonalizado, campo: string, mensagem: string): Erro {
  return { codigo, campo, mensagem }
}

export function validarCoresSelecionadas(
  cores: readonly CorSelecionadaMoriahEntrada[]
): ResultadoValidacao<CorSelecionadaMoriahNormalizada[]> {
  const erros: Erro[] = []
  const avisos: Aviso[] = []
  const ids = new Set<string>()
  const ordens = new Set<number>()

  if (cores.length > LIMITE_CORES_POR_TAPETE) {
    erros.push(erro('LIMITE_CORES', 'cores', 'Cada tapete pode possuir no máximo 8 cores.'))
  }

  const dados = cores.map((cor, indice) => {
    const campo = `cores.${indice}`
    const id = cor.id.trim()
    if (!id) erros.push(erro('COR_INVALIDA', `${campo}.id`, 'A cor deve possuir um identificador.'))
    if (id && ids.has(id)) erros.push(erro('COR_DUPLICADA', `${campo}.id`, 'A mesma cor não pode se repetir.'))
    ids.add(id)

    if (!Number.isInteger(cor.ordem) || cor.ordem < 1 || cor.ordem > LIMITE_CORES_POR_TAPETE) {
      erros.push(erro('ORDEM_COR_INVALIDA', `${campo}.ordem`, 'A ordem da cor deve estar entre 1 e 8.'))
    } else if (ordens.has(cor.ordem)) {
      erros.push(erro('ORDEM_COR_DUPLICADA', `${campo}.ordem`, 'A ordem das cores não pode se repetir.'))
    }
    ordens.add(cor.ordem)

    return {
      id,
      ordem: cor.ordem,
      numero: cor.numero?.trim() || null,
      codigo: cor.codigo?.trim() || null,
      nome: cor.nome?.trim() || null,
    }
  })

  if (cores.length >= 7 && cores.length <= LIMITE_CORES_POR_TAPETE) {
    avisos.push({ codigo: 'MUITAS_CORES', campo: 'cores', mensagem: AVISO_MUITAS_CORES })
  }

  return { valido: erros.length === 0, dados: erros.length === 0 ? dados : null, erros, avisos }
}

export function validarAlteracoesLayout(
  teveAlteracao: boolean,
  quantidade: number | null | undefined
): ResultadoValidacao<{ teveAlteracao: boolean; quantidade: number | null }> {
  const erros: Erro[] = []
  const avisos: Aviso[] = []

  if (!teveAlteracao && quantidade !== null && quantidade !== undefined && quantidade !== 0) {
    erros.push(erro('LAYOUT_INVALIDO', 'quantidadeAlteracoesLayout', 'Sem alteração de layout, a quantidade deve ser nula ou zero.'))
  }

  if (teveAlteracao && (!Number.isInteger(quantidade) || quantidade === null || quantidade === undefined || quantidade < 1)) {
    erros.push(erro('LAYOUT_INVALIDO', 'quantidadeAlteracoesLayout', 'Com alteração de layout, a quantidade deve ser um inteiro a partir de 1.'))
  }

  if (teveAlteracao && typeof quantidade === 'number' && Number.isInteger(quantidade) && quantidade > 5) {
    avisos.push({
      codigo: 'MUITAS_ALTERACOES_LAYOUT',
      campo: 'quantidadeAlteracoesLayout',
      mensagem: AVISO_MUITAS_ALTERACOES_LAYOUT,
    })
  }

  return {
    valido: erros.length === 0,
    dados: erros.length === 0
      ? { teveAlteracao, quantidade: teveAlteracao && typeof quantidade === 'number' ? quantidade : null }
      : null,
    erros,
    avisos,
  }
}

export function converterDataAdministrativaParaISO(
  valor: string | null | undefined
): ResultadoValidacao<string | null> {
  const texto = valor?.trim() ?? ''
  if (!texto) return { valido: true, dados: null, erros: [], avisos: [] }

  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto)
  if (!match) {
    return {
      valido: false,
      dados: null,
      erros: [erro('DATA_INVALIDA', 'data', 'Informe uma data real no formato DD/MM/AAAA.')],
      avisos: [],
    }
  }

  const dia = Number(match[1])
  const mes = Number(match[2])
  const ano = Number(match[3])
  const bissexto = ano % 4 === 0 && (ano % 100 !== 0 || ano % 400 === 0)
  const diasPorMes = [31, bissexto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

  if (ano < 1 || mes < 1 || mes > 12 || dia < 1 || dia > diasPorMes[mes - 1]) {
    return {
      valido: false,
      dados: null,
      erros: [erro('DATA_INVALIDA', 'data', 'Informe uma data real no formato DD/MM/AAAA.')],
      avisos: [],
    }
  }

  return {
    valido: true,
    dados: `${String(ano).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`,
    erros: [],
    avisos: [],
  }
}

function validarIdentificacao(
  entrada: PedidoPersonalizadoMoriahEntrada,
  erros: Erro[]
): Omit<PedidoPersonalizadoMoriahNormalizado, 'fornecedor' | 'unidade' | 'status' | 'tapetes' | 'dataEntrega' | 'dataPedidoFornecedor'> {
  const consultora = normalizarConsultora(entrada.consultora)
  const cliente = normalizarCliente(entrada.cliente)
  const numeroLancamento = normalizarNumeroLancamento(entrada.numeroLancamento)
  const numeroPedidoCompra = normalizarNumeroPedidoCompra(entrada.numeroPedidoCompra)
  const comprador = normalizarComprador(entrada.comprador)

  if (!consultora) erros.push(erro('CONSULTORA_OBRIGATORIA', 'consultora', 'Informe o nome da consultora.'))
  else if (consultora.length < 2 || consultora.length > 20 || !LETRAS_E_ESPACOS.test(consultora)) {
    erros.push(erro('CONSULTORA_INVALIDA', 'consultora', 'A consultora deve ter entre 2 e 20 caracteres e usar somente letras e espaços.'))
  }

  if (!cliente) erros.push(erro('CLIENTE_OBRIGATORIO', 'cliente', 'Informe o nome do cliente.'))
  else if (cliente.length > 40) erros.push(erro('CLIENTE_INVALIDO', 'cliente', 'O cliente deve ter no máximo 40 caracteres.'))

  if (numeroLancamento !== null && !NUMERO_LANCAMENTO.test(numeroLancamento)) {
    erros.push(erro('NUMERO_LANCAMENTO_INVALIDO', 'numeroLancamento', 'O número de lançamento deve conter somente números e ter no máximo 6 dígitos.'))
  }
  if (numeroPedidoCompra !== null && !NUMERO_PEDIDO_COMPRA.test(numeroPedidoCompra)) {
    erros.push(erro('NUMERO_PEDIDO_COMPRA_INVALIDO', 'numeroPedidoCompra', 'O pedido de compra deve conter de 1 a 20 dígitos.'))
  }
  if (comprador !== null && (comprador.length < 2 || comprador.length > 40 || !LETRAS_E_ESPACOS.test(comprador))) {
    erros.push(erro('COMPRADOR_INVALIDO', 'comprador', 'O comprador deve ter de 2 a 40 letras e espaços.'))
  }

  return { consultora, cliente, numeroLancamento, numeroPedidoCompra, comprador }
}

export function validarPedidoPersonalizadoMoriah(
  entrada: PedidoPersonalizadoMoriahEntrada
): ResultadoValidacao<PedidoPersonalizadoMoriahNormalizado> {
  const erros: Erro[] = []
  const avisos: Aviso[] = []
  const fornecedor = entrada.fornecedor.trim()
  const unidade = entrada.unidade.trim()

  if (fornecedor !== FORNECEDOR_MORIAH) {
    erros.push(erro('FORNECEDOR_INVALIDO', 'fornecedor', 'Somente o fornecedor Moriah está disponível.'))
  }
  if (!unidade) {
    erros.push(erro('UNIDADE_INVALIDA', 'unidade', 'Selecione uma unidade.'))
  } else if (!ehUnidadePedidoPersonalizado(unidade)) {
    erros.push(erro('UNIDADE_INVALIDA', 'unidade', 'A unidade informada não pertence ao módulo.'))
  }

  const statusInformado = entrada.status?.trim() ?? 'CADASTRADO'
  if (!ehStatusPedidoPersonalizado(statusInformado)) {
    erros.push(erro('STATUS_INVALIDO', 'status', 'Status de pedido personalizado inválido.'))
  }

  const identificacao = validarIdentificacao(entrada, erros)
  const dataEntrega = converterDataAdministrativaParaISO(entrada.dataEntrega)
  const dataPedidoFornecedor = converterDataAdministrativaParaISO(entrada.dataPedidoFornecedor)
  erros.push(...dataEntrega.erros.map((item) => comCampo(item, 'dataEntrega')))
  erros.push(...dataPedidoFornecedor.erros.map((item) => comCampo(item, 'dataPedidoFornecedor')))

  if (entrada.tapetes.length < 1 || entrada.tapetes.length > LIMITE_TAPETES_POR_PEDIDO) {
    erros.push(erro('LIMITE_TAPETES', 'tapetes', 'O pedido deve possuir entre 1 e 10 tapetes.'))
  }

  const ordens = new Set<number>()
  const tapetesNormalizados: TapeteMoriahNormalizado[] = []

  entrada.tapetes.forEach((tapete, indice) => {
    const base = `tapetes.${indice}`
    const errosAntes = erros.length
    const formato = tapete.formato.trim()

    if (!Number.isInteger(tapete.ordem) || tapete.ordem < 1 || tapete.ordem > LIMITE_TAPETES_POR_PEDIDO) {
      erros.push(erro('ORDEM_TAPETE_INVALIDA', `${base}.ordem`, 'A ordem do tapete deve estar entre 1 e 10.'))
    } else if (ordens.has(tapete.ordem)) {
      erros.push(erro('ORDEM_TAPETE_DUPLICADA', `${base}.ordem`, 'A ordem dos tapetes não pode se repetir.'))
    }
    ordens.add(tapete.ordem)

    if (!ehFormatoTapeteMoriah(formato)) {
      erros.push(erro('FORMATO_INVALIDO', `${base}.formato`, 'Formato de tapete inválido.'))
    }

    const dimensao1 = converterMedidaMetrosParaCentimetros(tapete.dimensao1Metros)
    const dimensao2 = formato === 'REDONDO' && (tapete.dimensao2Metros === null || tapete.dimensao2Metros === undefined || !tapete.dimensao2Metros.trim())
      ? { valido: true, dados: null, erros: [], avisos: [] } satisfies ResultadoValidacao<number | null>
      : converterMedidaMetrosParaCentimetros(tapete.dimensao2Metros)

    const nomeDimensao1 = formato === 'REDONDO' ? 'diâmetro' : formato === 'ORGANICO' ? 'maior largura' : 'largura'
    const nomeDimensao2 = formato === 'ORGANICO' ? 'maior comprimento' : 'comprimento'
    erros.push(...dimensao1.erros.map((item) => comCampo({
      ...item,
      mensagem: !tapete.dimensao1Metros.trim() ? `Informe ${nomeDimensao1 === 'diâmetro' ? 'o' : 'a'} ${nomeDimensao1} do tapete.` : item.mensagem,
    }, `${base}.dimensao1Metros`)))
    erros.push(...dimensao2.erros.map((item) => comCampo({
      ...item,
      mensagem: !tapete.dimensao2Metros?.trim() ? `Informe o ${nomeDimensao2} do tapete.` : item.mensagem,
    }, `${base}.dimensao2Metros`)))

    if (formato === 'REDONDO' && tapete.dimensao2Metros?.trim()) {
      erros.push(erro('DIMENSOES_INCOMPATIVEIS', `${base}.dimensao2Metros`, 'Tapete redondo aceita somente o diâmetro.'))
    }

    const colecao = normalizarNomeColecaoCatalogo(tapete.nomeColecaoCatalogo)
    const referencia = normalizarReferenciaCatalogo(tapete.referenciaCatalogo)
    const observacoes = normalizarObservacoes(tapete.observacoes)
    if (colecao !== null && colecao.length > 30) erros.push(erro('COLECAO_INVALIDA', `${base}.nomeColecaoCatalogo`, 'O nome da coleção deve ter no máximo 30 caracteres.'))
    if (referencia !== null && referencia.length > 20) {
      erros.push(erro('REFERENCIA_INVALIDA', `${base}.referenciaCatalogo`, 'A referência deve ter no máximo 20 caracteres.'))
    } else if (referencia !== null && !REFERENCIA_CATALOGO.test(referencia)) {
      erros.push(erro('REFERENCIA_INVALIDA', `${base}.referenciaCatalogo`, 'A referência aceita somente letras, números e hífen, sem espaços.'))
    }
    if (observacoes !== null && observacoes.length > 500) erros.push(erro('OBSERVACOES_EXCEDIDAS', `${base}.observacoes`, 'As observações devem ter no máximo 500 caracteres.'))

    const cores = validarCoresSelecionadas(tapete.cores ?? [])
    erros.push(...cores.erros.map((item) => comCampo(item, `${base}.${item.campo}`)))
    avisos.push(...cores.avisos.map((item) => comCampo(item, `${base}.${item.campo}`)))

    const layout = validarAlteracoesLayout(tapete.teveAlteracaoLayout ?? false, tapete.quantidadeAlteracoesLayout)
    erros.push(...layout.erros.map((item) => comCampo(item, `${base}.${item.campo}`)))
    avisos.push(...layout.avisos.map((item) => comCampo(item, `${base}.${item.campo}`)))

    if (erros.length !== errosAntes || !dimensao1.dados || !ehFormatoTapeteMoriah(formato)) return

    const dimensao2Cm = dimensao2.dados
    const area = calcularAreaCobradaCentesimosM2(formato, dimensao1.dados, dimensao2Cm)
    if (!area.valido || !area.dados) {
      erros.push(...area.erros.map((item) => comCampo(item, `${base}.${item.campo}`)))
      return
    }

    const avisoMedida1 = verificarMedidaRecomendada(dimensao1.dados)
    const avisoMedida2 = dimensao2Cm === null ? null : verificarMedidaRecomendada(dimensao2Cm)
    if (avisoMedida1 || avisoMedida2) {
      avisos.push({
        codigo: 'MEDIDA_FORA_INTERVALO_RECOMENDADO',
        campo: `${base}.medidas`,
        mensagem: AVISO_MEDIDA_RECOMENDADA,
      })
    }

    tapetesNormalizados.push({
      id: tapete.id?.trim() || null,
      ordem: tapete.ordem,
      formato,
      dimensao1Cm: dimensao1.dados,
      dimensao2Cm,
      areaCobradaCentesimosM2: area.dados.areaCobradaCentesimosM2,
      codigoProduto: classificarProdutoMoriah(formato, dimensao1.dados, dimensao2Cm).codigo,
      nomeColecaoCatalogo: colecao,
      referenciaCatalogo: referencia,
      observacoes,
      cores: cores.dados ?? [],
      teveAlteracaoLayout: layout.dados?.teveAlteracao ?? false,
      quantidadeAlteracoesLayout: layout.dados?.quantidade ?? null,
    })
  })

  const valido = erros.length === 0 && tapetesNormalizados.length === entrada.tapetes.length
  const dados = valido && ehUnidadePedidoPersonalizado(unidade) && ehStatusPedidoPersonalizado(statusInformado)
    ? {
        fornecedor: FORNECEDOR_MORIAH,
        unidade,
        ...identificacao,
        dataEntrega: dataEntrega.dados,
        dataPedidoFornecedor: dataPedidoFornecedor.dados,
        status: statusInformado,
        tapetes: tapetesNormalizados,
      }
    : null

  return { valido, dados, erros, avisos }
}

export function montarPayloadTapetesMoriahRpc(
  tapetes: readonly TapeteMoriahNormalizado[],
  produtos: readonly ProdutoCatalogoMoriah[]
): ResultadoValidacao<TapeteMoriahRpc[]> {
  const erros: Erro[] = []
  const dados = tapetes.map((tapete, indice) => {
    const produto = produtos.find((item) => item.codigo === tapete.codigoProduto && item.id.trim())
    if (!produto) {
      erros.push(erro('PRODUTO_CATALOGO_AUSENTE', `tapetes.${indice}.produto`, 'O produto calculado não está disponível no catálogo informado.'))
    }
    for (const [corIndice, cor] of tapete.cores.entries()) {
      if (!cor.id.trim()) erros.push(erro('COR_INVALIDA', `tapetes.${indice}.cores.${corIndice}.id`, 'A cor deve possuir um identificador.'))
    }

    return {
      ...(tapete.id ? { id: tapete.id } : {}),
      ordem: tapete.ordem,
      formato: tapete.formato,
      dimensao_1_cm: tapete.dimensao1Cm,
      dimensao_2_cm: tapete.dimensao2Cm,
      area_cobrada_centesimos_m2: tapete.areaCobradaCentesimosM2,
      produto_id: produto?.id ?? '',
      nome_colecao_catalogo: tapete.nomeColecaoCatalogo,
      referencia_catalogo: tapete.referenciaCatalogo,
      observacoes: tapete.observacoes,
      cores: tapete.cores.map((cor) => ({ cor_id: cor.id, ordem: cor.ordem })),
    }
  })

  return { valido: erros.length === 0, dados: erros.length === 0 ? dados : null, erros, avisos: [] }
}

export function montarPayloadLayoutMoriahRpc(
  tapetes: readonly TapeteMoriahNormalizado[]
): ResultadoValidacao<LayoutTapeteMoriahRpc[]> {
  const erros: Erro[] = []
  const dados = tapetes.map((tapete, indice) => {
    if (!tapete.id) erros.push(erro('TAPETE_ID_INVALIDO', `tapetes.${indice}.id`, 'O layout administrativo exige o identificador do tapete.'))
    return {
      tapete_id: tapete.id ?? '',
      teve_alteracao_layout: tapete.teveAlteracaoLayout,
      ...(tapete.teveAlteracaoLayout && tapete.quantidadeAlteracoesLayout !== null
        ? { quantidade_alteracoes_layout: tapete.quantidadeAlteracoesLayout }
        : {}),
    }
  })
  return { valido: erros.length === 0, dados: erros.length === 0 ? dados : null, erros, avisos: [] }
}
