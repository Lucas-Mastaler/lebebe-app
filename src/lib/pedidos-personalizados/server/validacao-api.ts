import {
  CODIGOS_PRODUTO_MORIAH,
  FORNECEDOR_MORIAH,
  STATUS_PEDIDO_PERSONALIZADO,
  ehStatusPedidoPersonalizado,
} from '../constantes'
import {
  normalizarComprador,
  normalizarNumeroLancamento,
  normalizarNumeroPedidoCompra,
} from '../normalizacao'
import type {
  PedidoPersonalizadoMoriahEntrada,
  StatusPedidoPersonalizado,
  TapeteMoriahEntrada,
} from '../tipos'
import {
  converterDataAdministrativaParaISO,
  validarAlteracoesLayout,
} from '../validacao'
import { ehObjeto, ehUuid, possuiAlgumCampo } from './http'

const LETRAS_E_ESPACOS = /^\p{L}+(?: \p{L}+)*$/u
const NUMERO_LANCAMENTO = /^\d{1,6}$/
const NUMERO_PEDIDO_COMPRA = /^\d{1,5}$/
const CAMPOS_ADMINISTRATIVOS = [
  'numeroLancamento',
  'dataEntrega',
  'dataPedidoFornecedor',
  'numeroPedidoCompra',
  'comprador',
  'status',
  'layoutTapetes',
  'anexos',
] as const
const CAMPOS_COMERCIAIS = [
  'unidade',
  'consultora',
  'cliente',
  'telefone',
  'tapetes',
  'formato',
  'dimensao1Metros',
  'dimensao2Metros',
  'produto',
  'cores',
  'nomeColecaoCatalogo',
  'referenciaCatalogo',
  'observacoes',
] as const

export type FiltrosPedidos = {
  pagina: number
  unidade: string | null
  cliente: string | null
  consultora: string | null
  numeroLancamento: string | null
  status: StatusPedidoPersonalizado | null
  dataInicial: string | null
  dataFinal: string | null
  dataPedidoFornecedorInicial: string | null
  dataPedidoFornecedorFinal: string | null
  dataEntregaInicial: string | null
  dataEntregaFinal: string | null
  codigoProduto: '21157' | '21158' | '21159' | null
}

export type DadosAdministrativosNormalizados = {
  expectedVersion: number
  numeroLancamento: string | null
  dataEntrega: string | null
  dataPedidoFornecedor: string | null
  numeroPedidoCompra: string | null
  comprador: string | null
  status: StatusPedidoPersonalizado
  layoutTapetes: Array<{
    tapete_id: string
    teve_alteracao_layout: boolean
    quantidade_alteracoes_layout?: number
  }>
}

function stringOpcional(valor: unknown): string | null | undefined {
  if (valor === undefined) return undefined
  if (valor === null) return null
  return typeof valor === 'string' ? valor : undefined
}

function montarTapete(
  valor: unknown,
  preservarId: boolean,
  permitirLayout: boolean
): TapeteMoriahEntrada | null {
  if (!ehObjeto(valor)) return null
  if (
    typeof valor.ordem !== 'number'
    || typeof valor.formato !== 'string'
    || typeof valor.dimensao1Metros !== 'string'
    || (valor.dimensao2Metros !== undefined && valor.dimensao2Metros !== null && typeof valor.dimensao2Metros !== 'string')
    || (valor.cores !== undefined && !Array.isArray(valor.cores))
  ) return null

  if (!permitirLayout && possuiAlgumCampo(valor, ['teveAlteracaoLayout', 'quantidadeAlteracoesLayout'])) {
    return null
  }
  if (permitirLayout) {
    const teveAlteracao = valor.teveAlteracaoLayout ?? false
    const quantidade = valor.quantidadeAlteracoesLayout
    if (
      typeof teveAlteracao !== 'boolean'
      || teveAlteracao
      || (quantidade !== undefined && quantidade !== null && quantidade !== 0)
    ) return null
  }

  const cores = (valor.cores ?? []).map((cor) => {
    if (!ehObjeto(cor) || !ehUuid(cor.id) || typeof cor.ordem !== 'number') return null
    return { id: cor.id, ordem: cor.ordem }
  })
  if (cores.some((cor) => cor === null)) return null

  const id = preservarId && valor.id !== undefined && valor.id !== null
    ? (ehUuid(valor.id) ? valor.id : null)
    : undefined
  if (preservarId && valor.id !== undefined && valor.id !== null && id === null) return null

  return {
    ...(id ? { id } : {}),
    ordem: valor.ordem,
    formato: valor.formato,
    dimensao1Metros: valor.dimensao1Metros,
    dimensao2Metros: stringOpcional(valor.dimensao2Metros),
    nomeColecaoCatalogo: stringOpcional(valor.nomeColecaoCatalogo),
    referenciaCatalogo: stringOpcional(valor.referenciaCatalogo),
    observacoes: stringOpcional(valor.observacoes),
    cores: cores as Array<{ id: string; ordem: number }>,
    teveAlteracaoLayout: false,
    quantidadeAlteracoesLayout: null,
  }
}

export function montarEntradaPedido(
  valor: unknown,
  opcoes: { comercial: boolean }
):
  | { ok: true; entrada: PedidoPersonalizadoMoriahEntrada; expectedVersion?: number }
  | { ok: false; codigo: 'PAYLOAD_INVALIDO' | 'CAMPO_NAO_PERMITIDO' } {
  if (!ehObjeto(valor)) return { ok: false, codigo: 'PAYLOAD_INVALIDO' }
  if (opcoes.comercial && possuiAlgumCampo(valor, CAMPOS_ADMINISTRATIVOS)) {
    return { ok: false, codigo: 'CAMPO_NAO_PERMITIDO' }
  }
  if (
    typeof valor.unidade !== 'string'
    || typeof valor.consultora !== 'string'
    || typeof valor.cliente !== 'string'
    || typeof valor.telefone !== 'string'
    || !Array.isArray(valor.tapetes)
  ) return { ok: false, codigo: 'PAYLOAD_INVALIDO' }

  const tapetes = valor.tapetes.map((tapete) => montarTapete(tapete, opcoes.comercial, !opcoes.comercial))
  if (tapetes.some((tapete) => tapete === null)) {
    return { ok: false, codigo: opcoes.comercial ? 'CAMPO_NAO_PERMITIDO' : 'PAYLOAD_INVALIDO' }
  }

  const entrada: PedidoPersonalizadoMoriahEntrada = {
    fornecedor: FORNECEDOR_MORIAH,
    unidade: valor.unidade,
    consultora: valor.consultora,
    cliente: valor.cliente,
    telefone: valor.telefone,
    numeroLancamento: opcoes.comercial ? null : stringOpcional(valor.numeroLancamento),
    dataEntrega: opcoes.comercial ? null : stringOpcional(valor.dataEntrega),
    dataPedidoFornecedor: opcoes.comercial ? null : stringOpcional(valor.dataPedidoFornecedor),
    numeroPedidoCompra: opcoes.comercial ? null : stringOpcional(valor.numeroPedidoCompra),
    comprador: opcoes.comercial ? null : stringOpcional(valor.comprador),
    status: 'CADASTRADO',
    tapetes: tapetes as TapeteMoriahEntrada[],
  }

  if (!opcoes.comercial) return { ok: true, entrada }
  const expectedVersion = valor.expectedVersion
  if (!Number.isInteger(expectedVersion) || (expectedVersion as number) < 1) {
    return { ok: false, codigo: 'PAYLOAD_INVALIDO' }
  }
  return { ok: true, entrada, expectedVersion: expectedVersion as number }
}

function dataIsoReal(valor: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor)
  if (!match) return false
  const ano = Number(match[1])
  const mes = Number(match[2])
  const dia = Number(match[3])
  if (ano < 1 || mes < 1 || mes > 12) return false
  const bissexto = ano % 4 === 0 && (ano % 100 !== 0 || ano % 400 === 0)
  const dias = [31, bissexto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return dia >= 1 && dia <= dias[mes - 1]
}

export function proximoDiaIso(valor: string) {
  const [ano, mes, dia] = valor.split('-').map(Number)
  const data = new Date(Date.UTC(ano, mes - 1, dia + 1))
  return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, '0')}-${String(data.getUTCDate()).padStart(2, '0')}`
}

export function validarFiltrosPedidos(url: URL):
  | { ok: true; filtros: FiltrosPedidos }
  | { ok: false; mensagem: string } {
  const paginaTexto = url.searchParams.get('page') ?? '1'
  const pagina = Number(paginaTexto)
  if (!Number.isInteger(pagina) || pagina < 1) return { ok: false, mensagem: 'Página inválida.' }

  const pageSize = url.searchParams.get('pageSize')
  if (pageSize !== null && Number(pageSize) > 20) {
    return { ok: false, mensagem: 'O limite máximo é de 20 registros por página.' }
  }

  const cliente = url.searchParams.get('cliente')?.trim() || null
  const consultora = url.searchParams.get('consultora')?.trim() || null
  if (cliente && cliente.length < 2) return { ok: false, mensagem: 'Cliente deve ter ao menos 2 caracteres.' }
  if (consultora && consultora.length < 2) return { ok: false, mensagem: 'Consultora deve ter ao menos 2 caracteres.' }

  const numeroLancamento = url.searchParams.get('numeroLancamento')?.trim() || null
  if (numeroLancamento && !NUMERO_LANCAMENTO.test(numeroLancamento)) {
    return { ok: false, mensagem: 'Número de lançamento inválido.' }
  }

  const statusTexto = url.searchParams.get('status')?.trim() || null
  if (statusTexto && !ehStatusPedidoPersonalizado(statusTexto)) {
    return { ok: false, mensagem: 'Status inválido.' }
  }

  const dataInicial = url.searchParams.get('dataInicial')?.trim() || null
  const dataFinal = url.searchParams.get('dataFinal')?.trim() || null
  if ((dataInicial && !dataIsoReal(dataInicial)) || (dataFinal && !dataIsoReal(dataFinal))) {
    return { ok: false, mensagem: 'Período inválido.' }
  }
  if (dataInicial && dataFinal && dataInicial > dataFinal) {
    return { ok: false, mensagem: 'A data inicial não pode ser posterior à data final.' }
  }

  const dataPedidoFornecedorInicial = url.searchParams.get('dataPedidoFornecedorInicial')?.trim() || null
  const dataPedidoFornecedorFinal = url.searchParams.get('dataPedidoFornecedorFinal')?.trim() || null
  const dataEntregaInicial = url.searchParams.get('dataEntregaInicial')?.trim() || null
  const dataEntregaFinal = url.searchParams.get('dataEntregaFinal')?.trim() || null
  const datasAdministrativas = [
    dataPedidoFornecedorInicial,
    dataPedidoFornecedorFinal,
    dataEntregaInicial,
    dataEntregaFinal,
  ]
  if (datasAdministrativas.some((data) => data !== null && !dataIsoReal(data))) {
    return { ok: false, mensagem: 'Filtro de data administrativa inválido.' }
  }
  if (dataPedidoFornecedorInicial && dataPedidoFornecedorFinal && dataPedidoFornecedorInicial > dataPedidoFornecedorFinal) {
    return { ok: false, mensagem: 'O início do pedido ao fornecedor não pode ser posterior ao fim.' }
  }
  if (dataEntregaInicial && dataEntregaFinal && dataEntregaInicial > dataEntregaFinal) {
    return { ok: false, mensagem: 'O início da entrega não pode ser posterior ao fim.' }
  }

  const codigoProdutoTexto = url.searchParams.get('codigoProduto')?.trim() || null
  if (codigoProdutoTexto && !CODIGOS_PRODUTO_MORIAH.includes(codigoProdutoTexto as never)) {
    return { ok: false, mensagem: 'Código de produto inválido.' }
  }

  return {
    ok: true,
    filtros: {
      pagina,
      unidade: url.searchParams.get('unidade')?.trim() || null,
      cliente,
      consultora,
      numeroLancamento,
      status: statusTexto as StatusPedidoPersonalizado | null,
      dataInicial,
      dataFinal,
      dataPedidoFornecedorInicial,
      dataPedidoFornecedorFinal,
      dataEntregaInicial,
      dataEntregaFinal,
      codigoProduto: codigoProdutoTexto as FiltrosPedidos['codigoProduto'],
    },
  }
}

export function validarDadosAdministrativos(valor: unknown):
  | { ok: true; dados: DadosAdministrativosNormalizados }
  | { ok: false; codigo: 'PAYLOAD_INVALIDO' | 'CAMPO_NAO_PERMITIDO'; problemas?: Array<{ campo: string; mensagem: string }> } {
  if (!ehObjeto(valor)) return { ok: false, codigo: 'PAYLOAD_INVALIDO' }
  if (possuiAlgumCampo(valor, CAMPOS_COMERCIAIS)) {
    return { ok: false, codigo: 'CAMPO_NAO_PERMITIDO' }
  }
  if (!Number.isInteger(valor.expectedVersion) || (valor.expectedVersion as number) < 1) {
    return { ok: false, codigo: 'PAYLOAD_INVALIDO' }
  }
  for (const campo of ['numeroLancamento', 'dataEntrega', 'dataPedidoFornecedor', 'numeroPedidoCompra', 'comprador'] as const) {
    const informado = valor[campo]
    if (informado !== undefined && informado !== null && typeof informado !== 'string') {
      return {
        ok: false,
        codigo: 'PAYLOAD_INVALIDO',
        problemas: [{ campo, mensagem: 'Campo inválido.' }],
      }
    }
  }
  if (typeof valor.status !== 'string' || !ehStatusPedidoPersonalizado(valor.status)) {
    return { ok: false, codigo: 'PAYLOAD_INVALIDO', problemas: [{ campo: 'status', mensagem: 'Status inválido.' }] }
  }
  if (!Array.isArray(valor.layoutTapetes)) return { ok: false, codigo: 'PAYLOAD_INVALIDO' }

  const problemas: Array<{ campo: string; mensagem: string }> = []
  const numeroLancamento = normalizarNumeroLancamento(stringOpcional(valor.numeroLancamento))
  const numeroPedidoCompra = normalizarNumeroPedidoCompra(stringOpcional(valor.numeroPedidoCompra))
  const comprador = normalizarComprador(stringOpcional(valor.comprador))
  if (numeroLancamento !== null && !NUMERO_LANCAMENTO.test(numeroLancamento)) problemas.push({ campo: 'numeroLancamento', mensagem: 'Número de lançamento inválido.' })
  if (numeroPedidoCompra !== null && !/^\d+$/.test(numeroPedidoCompra)) {
    problemas.push({ campo: 'numeroPedidoCompra', mensagem: 'Use somente números no pedido de compra.' })
  } else if (numeroPedidoCompra !== null && !NUMERO_PEDIDO_COMPRA.test(numeroPedidoCompra)) {
    problemas.push({ campo: 'numeroPedidoCompra', mensagem: 'O pedido de compra deve conter no máximo 5 dígitos.' })
  }
  if (comprador !== null && (comprador.length < 2 || comprador.length > 40 || !LETRAS_E_ESPACOS.test(comprador))) {
    problemas.push({ campo: 'comprador', mensagem: 'Comprador inválido.' })
  }

  const dataEntrega = converterDataAdministrativaParaISO(stringOpcional(valor.dataEntrega))
  const dataPedidoFornecedor = converterDataAdministrativaParaISO(stringOpcional(valor.dataPedidoFornecedor))
  if (!dataEntrega.valido) problemas.push({ campo: 'dataEntrega', mensagem: 'Data de entrega inválida.' })
  if (!dataPedidoFornecedor.valido) problemas.push({ campo: 'dataPedidoFornecedor', mensagem: 'Data do pedido ao fornecedor inválida.' })

  const ids = new Set<string>()
  const layoutTapetes = valor.layoutTapetes.map((item, indice) => {
    if (!ehObjeto(item) || !ehUuid(item.tapeteId) || typeof item.teveAlteracaoLayout !== 'boolean') {
      problemas.push({ campo: `layoutTapetes.${indice}`, mensagem: 'Layout inválido.' })
      return null
    }
    if (ids.has(item.tapeteId)) problemas.push({ campo: `layoutTapetes.${indice}.tapeteId`, mensagem: 'Tapete duplicado.' })
    ids.add(item.tapeteId)
    const layout = validarAlteracoesLayout(item.teveAlteracaoLayout, item.quantidadeAlteracoesLayout as number | null | undefined)
    if (!layout.valido || !layout.dados) {
      problemas.push({ campo: `layoutTapetes.${indice}`, mensagem: 'Layout inválido.' })
      return null
    }
    return {
      tapete_id: item.tapeteId,
      teve_alteracao_layout: layout.dados.teveAlteracao,
      ...(layout.dados.quantidade !== null ? { quantidade_alteracoes_layout: layout.dados.quantidade } : {}),
    }
  })

  if (problemas.length > 0 || layoutTapetes.some((item) => item === null)) {
    return { ok: false, codigo: 'PAYLOAD_INVALIDO', problemas }
  }

  return {
    ok: true,
    dados: {
      expectedVersion: valor.expectedVersion as number,
      numeroLancamento,
      dataEntrega: dataEntrega.dados,
      dataPedidoFornecedor: dataPedidoFornecedor.dados,
      numeroPedidoCompra,
      comprador,
      status: valor.status,
      layoutTapetes: layoutTapetes as DadosAdministrativosNormalizados['layoutTapetes'],
    },
  }
}

export function statusDisponiveis() {
  return [...STATUS_PEDIDO_PERSONALIZADO]
}
