import {
  converterDataAdministrativaParaISO,
  gerarMensagemPedidoPersonalizado,
  normalizarComprador,
  normalizarNumeroLancamento,
  normalizarNumeroPedidoCompra,
} from '@/lib/pedidos-personalizados'
import type { CodigoProdutoMoriah, PedidoPersonalizadoMoriahNormalizado, StatusPedidoPersonalizado, UnidadePedidoPersonalizado } from '@/lib/pedidos-personalizados'
import type { AnexoFormulario, EstadoNovoPedido, OpcoesNovoPedido, TapeteFormulario } from './novo-pedido-modelo'
import { ehErroHttpNovoPedido } from './novo-pedido-modelo'

export type FiltrosGestao = {
  cliente: string
  consultora: string
  numeroLancamento: string
  status: '' | StatusPedidoPersonalizado
  unidade: '' | UnidadePedidoPersonalizado
  dataInicial: string
  dataFinal: string
  dataPedidoFornecedorInicial: string
  dataPedidoFornecedorFinal: string
  dataEntregaInicial: string
  dataEntregaFinal: string
}

export type ItemPedidoGestao = {
  id: string
  createdAt: string
  updatedAt: string
  fornecedor: { chave: string; nome: string } | null
  unidade: { chave: UnidadePedidoPersonalizado; nome: string }
  consultora: string
  cliente: string
  telefone: string | null
  numeroLancamento: string | null
  dataEntrega: string | null
  dataPedidoFornecedor: string | null
  numeroPedidoCompra: string | null
  comprador: string | null
  status: StatusPedidoPersonalizado
  version: number
  quantidadeTapetes: number
  codigosProdutos: string[]
}

export type CorDetalhe = { id: string; ordem: number; numero: string; codigo: string; nome: string }
export type TapeteDetalhe = {
  id: string
  ordem: number
  formato: TapeteFormulario['formato']
  dimensao1Cm: number
  dimensao2Cm: number | null
  areaCobradaCentesimosM2: number
  produto: { id: string; codigo: string; descricao: string }
  nomeColecaoCatalogo: string | null
  referenciaCatalogo: string | null
  observacoes: string | null
  teveAlteracaoLayout: boolean
  quantidadeAlteracoesLayout: number | null
  cores: CorDetalhe[]
  anexos: AnexoFormulario[]
}

export type PedidoDetalhe = {
  id: string
  fornecedor: { chave: string; nome: string } | null
  unidade: { chave: UnidadePedidoPersonalizado; nome: string }
  consultora: string
  cliente: string
  telefone: string | null
  numeroLancamento: string | null
  dataEntrega: string | null
  dataPedidoFornecedor: string | null
  numeroPedidoCompra: string | null
  comprador: string | null
  status: StatusPedidoPersonalizado
  version: number
  createdAt: string
  updatedAt: string
  tapetes: TapeteDetalhe[]
}

export type PaginaPedidos = {
  itens: ItemPedidoGestao[]
  pagina: number
  totalPaginas: number
  totalRegistros: number
  limite: number
}

export type EstadoAdministrativo = {
  numeroLancamento: string
  dataEntrega: string
  dataPedidoFornecedor: string
  numeroPedidoCompra: string
  comprador: string
}

export type ErrosAdministrativos = Partial<Record<keyof EstadoAdministrativo, string>>

export const FILTROS_VAZIOS: FiltrosGestao = {
  cliente: '', consultora: '', numeroLancamento: '', status: '', unidade: '', dataInicial: '', dataFinal: '',
  dataPedidoFornecedorInicial: '', dataPedidoFornecedorFinal: '', dataEntregaInicial: '', dataEntregaFinal: '',
}

async function erroResposta(response: Response): Promise<Error> {
  let mensagem = 'Não foi possível concluir a operação.'
  try {
    const body = await response.json() as { mensagem?: unknown }
    if (typeof body.mensagem === 'string') mensagem = body.mensagem
  } catch {
    // Respostas técnicas não são exibidas integralmente.
  }
  if (response.status === 401) mensagem = 'Sua sessão expirou. Entre novamente.'
  if (response.status === 403) mensagem = 'Você não possui acesso à gestão de pedidos personalizados.'
  if (response.status === 404) mensagem = 'Pedido não encontrado ou fora do seu escopo.'
  if (response.status === 409) mensagem = 'Este pedido foi alterado por outra pessoa. Recarregue os dados antes de continuar.'
  return Object.assign(new Error(mensagem), { status: response.status })
}

export async function listarPedidosGestao(filtros: FiltrosGestao, pagina: number, signal?: AbortSignal): Promise<PaginaPedidos> {
  if (filtros.dataInicial && filtros.dataFinal && filtros.dataInicial > filtros.dataFinal) {
    throw new Error('A data inicial do cadastro não pode ser posterior à data final.')
  }
  if (filtros.dataPedidoFornecedorInicial && filtros.dataPedidoFornecedorFinal && filtros.dataPedidoFornecedorInicial > filtros.dataPedidoFornecedorFinal) {
    throw new Error('A data inicial do pedido ao fornecedor não pode ser posterior à data final.')
  }
  if (filtros.dataEntregaInicial && filtros.dataEntregaFinal && filtros.dataEntregaInicial > filtros.dataEntregaFinal) {
    throw new Error('A data inicial da entrega não pode ser posterior à data final.')
  }
  const params = new URLSearchParams({ page: String(pagina) })
  for (const [chave, valor] of Object.entries(filtros)) if (valor) params.set(chave, valor)
  const response = await fetch(`/api/pedidos-personalizados/pedidos?${params}`, { cache: 'no-store', signal })
  if (!response.ok) throw await erroResposta(response)
  const body = await response.json() as PaginaPedidos & { ok?: boolean }
  if (body.ok !== true || !Array.isArray(body.itens)) throw new Error('Resposta de listagem inválida.')
  return body
}

export async function carregarDetalheGestao(id: string): Promise<PedidoDetalhe> {
  const response = await fetch(`/api/pedidos-personalizados/pedidos/${id}`, { cache: 'no-store' })
  if (!response.ok) throw await erroResposta(response)
  const body = await response.json() as { ok?: boolean; pedido?: PedidoDetalhe }
  if (body.ok !== true || !body.pedido) throw new Error('Resposta de detalhe inválida.')
  return body.pedido
}

function metros(cm: number | null) {
  return cm === null ? '' : (cm / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function detalheParaFormulario(pedido: PedidoDetalhe): EstadoNovoPedido {
  return {
    unidade: pedido.unidade.chave,
    consultora: pedido.consultora,
    cliente: pedido.cliente,
    telefone: pedido.telefone ?? '',
    numeroLancamento: pedido.numeroLancamento ?? '',
    tapetes: pedido.tapetes.map((tapete) => ({
      chaveLocal: tapete.id,
      tapeteId: tapete.id,
      anexos: tapete.anexos,
      anexosLocais: [],
      formato: tapete.formato,
      dimensao1Metros: metros(tapete.dimensao1Cm),
      dimensao2Metros: metros(tapete.dimensao2Cm),
      corIds: tapete.cores.sort((a, b) => a.ordem - b.ordem).map((cor) => cor.id),
      nomeColecaoCatalogo: tapete.nomeColecaoCatalogo ?? '',
      referenciaCatalogo: tapete.referenciaCatalogo ?? '',
      observacoes: tapete.observacoes ?? '',
    })),
  }
}

export function detalheParaAdministrativo(pedido: PedidoDetalhe): EstadoAdministrativo {
  return {
    numeroLancamento: pedido.numeroLancamento ?? '',
    dataEntrega: pedido.dataEntrega ?? '',
    dataPedidoFornecedor: pedido.dataPedidoFornecedor ?? '',
    numeroPedidoCompra: pedido.numeroPedidoCompra ?? '',
    comprador: pedido.comprador ?? '',
  }
}

export function gerarResumoFornecedorDetalhe(pedido: PedidoDetalhe) {
  const normalizado: PedidoPersonalizadoMoriahNormalizado = {
    fornecedor: 'moriah_tapetes',
    unidade: pedido.unidade.chave,
    consultora: pedido.consultora,
    cliente: pedido.cliente,
    telefoneNormalizado: pedido.telefone ?? '',
    numeroLancamento: pedido.numeroLancamento,
    numeroPedidoCompra: pedido.numeroPedidoCompra,
    comprador: pedido.comprador,
    dataEntrega: pedido.dataEntrega,
    dataPedidoFornecedor: pedido.dataPedidoFornecedor,
    status: pedido.status,
    tapetes: pedido.tapetes.map((tapete) => ({
      id: tapete.id,
      ordem: tapete.ordem,
      formato: tapete.formato,
      dimensao1Cm: tapete.dimensao1Cm,
      dimensao2Cm: tapete.dimensao2Cm,
      areaCobradaCentesimosM2: tapete.areaCobradaCentesimosM2,
      codigoProduto: tapete.produto.codigo as CodigoProdutoMoriah,
      nomeColecaoCatalogo: tapete.nomeColecaoCatalogo,
      referenciaCatalogo: tapete.referenciaCatalogo,
      observacoes: tapete.observacoes,
      cores: tapete.cores.map((cor) => ({ ...cor })),
      teveAlteracaoLayout: tapete.teveAlteracaoLayout,
      quantidadeAlteracoesLayout: tapete.quantidadeAlteracoesLayout,
    })),
  }
  const resultado = gerarMensagemPedidoPersonalizado(
    normalizado,
    pedido.tapetes.map((tapete) => ({
      id: tapete.produto.id,
      codigo: tapete.produto.codigo as CodigoProdutoMoriah,
      descricao: tapete.produto.descricao,
    }))
  )
  return resultado.valido ? resultado.dados : null
}

export function validarAdministrativo(estado: EstadoAdministrativo): ErrosAdministrativos {
  const erros: ErrosAdministrativos = {}
  const numeroLancamento = normalizarNumeroLancamento(estado.numeroLancamento)
  const numeroPedidoCompra = normalizarNumeroPedidoCompra(estado.numeroPedidoCompra)
  const comprador = normalizarComprador(estado.comprador)

  if (numeroLancamento !== null && !/^\d{1,6}$/.test(numeroLancamento)) {
    erros.numeroLancamento = 'O lançamento deve conter de 1 a 6 dígitos.'
  }
  if (numeroPedidoCompra !== null && !/^\d+$/.test(numeroPedidoCompra)) {
    erros.numeroPedidoCompra = 'Use somente números no pedido de compra.'
  } else if (numeroPedidoCompra !== null && !/^\d{1,5}$/.test(numeroPedidoCompra)) {
    erros.numeroPedidoCompra = 'O pedido de compra deve conter no máximo 5 dígitos.'
  }
  if (comprador !== null && (comprador.length < 2 || comprador.length > 40 || !/^\p{L}+(?: \p{L}+)*$/u.test(comprador))) {
    erros.comprador = 'O comprador deve ter de 2 a 40 letras e espaços.'
  }
  if (!converterDataAdministrativaParaISO(estado.dataEntrega).valido) {
    erros.dataEntrega = 'Informe uma data de entrega válida.'
  }
  if (!converterDataAdministrativaParaISO(estado.dataPedidoFornecedor).valido) {
    erros.dataPedidoFornecedor = 'Informe uma data do pedido ao fornecedor válida.'
  }
  return erros
}

export function payloadAtualizacaoAdministrativa(
  pedido: PedidoDetalhe,
  estado: EstadoAdministrativo
) {
  return {
    expectedVersion: pedido.version,
    numeroLancamento: normalizarNumeroLancamento(estado.numeroLancamento),
    dataEntrega: estado.dataEntrega.trim() || null,
    dataPedidoFornecedor: estado.dataPedidoFornecedor.trim() || null,
    numeroPedidoCompra: normalizarNumeroPedidoCompra(estado.numeroPedidoCompra),
    comprador: normalizarComprador(estado.comprador),
    status: pedido.status,
    layoutTapetes: pedido.tapetes.map((tapete) => ({
      tapeteId: tapete.id,
      teveAlteracaoLayout: tapete.teveAlteracaoLayout,
      quantidadeAlteracoesLayout: tapete.quantidadeAlteracoesLayout,
    })),
  }
}

export function payloadAtualizacaoComercial(estado: EstadoNovoPedido, expectedVersion: number, opcoes: OpcoesNovoPedido) {
  const cores = new Map(opcoes.cores.map((cor) => [cor.id, cor]))
  return {
    expectedVersion,
    unidade: estado.unidade,
    consultora: estado.consultora,
    cliente: estado.cliente,
    telefone: estado.telefone,
    tapetes: estado.tapetes.map((tapete, indice) => ({
      id: tapete.tapeteId,
      ordem: indice + 1,
      formato: tapete.formato,
      dimensao1Metros: tapete.dimensao1Metros,
      dimensao2Metros: tapete.formato === 'REDONDO' ? null : tapete.dimensao2Metros,
      nomeColecaoCatalogo: tapete.nomeColecaoCatalogo,
      referenciaCatalogo: tapete.referenciaCatalogo,
      observacoes: tapete.observacoes,
      cores: tapete.corIds.map((id, ordem) => ({ id, ordem: ordem + 1, ...cores.get(id) })),
    })),
  }
}

export async function atualizarComercialGestao(id: string, payload: ReturnType<typeof payloadAtualizacaoComercial>) {
  const response = await fetch(`/api/pedidos-personalizados/pedidos/${id}/comercial`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  })
  if (!response.ok) throw await erroResposta(response)
  const body = await response.json() as { ok?: boolean; version?: number }
  if (body.ok !== true || !Number.isInteger(body.version)) throw new Error('Resposta de atualização inválida.')
  return body.version as number
}

export async function atualizarAdministrativoGestao(
  id: string,
  payload: ReturnType<typeof payloadAtualizacaoAdministrativa>
) {
  const response = await fetch(`/api/pedidos-personalizados/pedidos/${id}/administrativo`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  })
  if (!response.ok) throw await erroResposta(response)
  const body = await response.json() as { ok?: boolean; version?: number }
  if (body.ok !== true || !Number.isInteger(body.version)) throw new Error('Resposta de atualização administrativa inválida.')
  return body.version as number
}

export function mensagemErroGestao(error: unknown) {
  if (ehErroHttpNovoPedido(error)) return error.mensagem
  return error instanceof Error ? error.message : 'Não foi possível concluir a operação.'
}
