import type { FornecedorPedidoPersonalizado, StatusPedidoPersonalizado } from './tipos'

const AGUARDANDO_APROVACAO = 'AGUARDANDO APROVA\u00c7\u00c3O DO CLIENTE' as const
const EM_PRODUCAO = 'EM PRODU\u00c7\u00c3O' as const

export const TRANSICOES_STATUS_PEDIDO: Readonly<Record<StatusPedidoPersonalizado, readonly StatusPedidoPersonalizado[]>> = {
  RASCUNHO: ['VENDA FECHADA', 'CANCELADO'],
  'VENDA FECHADA': ['AGUARDANDO LAYOUT', 'CANCELADO'],
  'AGUARDANDO LAYOUT': [AGUARDANDO_APROVACAO, 'CANCELADO'],
  [AGUARDANDO_APROVACAO]: [EM_PRODUCAO, 'AGUARDANDO LAYOUT', 'CANCELADO'],
  [EM_PRODUCAO]: ['RECEBIDO', 'CANCELADO'],
  RECEBIDO: [],
  CANCELADO: [],
}

const TRANSICOES_STATUS_EXCLUSIVE: Readonly<Record<StatusPedidoPersonalizado, readonly StatusPedidoPersonalizado[]>> = {
  RASCUNHO: ['VENDA FECHADA', 'CANCELADO'],
  'VENDA FECHADA': [EM_PRODUCAO, 'CANCELADO'],
  'AGUARDANDO LAYOUT': [],
  [AGUARDANDO_APROVACAO]: [],
  [EM_PRODUCAO]: ['RECEBIDO', 'CANCELADO'],
  RECEBIDO: [],
  CANCELADO: [],
}

export function destinosPermitidosStatus(
  status: StatusPedidoPersonalizado,
  fornecedor: FornecedorPedidoPersonalizado = 'moriah_tapetes'
) {
  return fornecedor === 'lebebe_exclusive'
    ? TRANSICOES_STATUS_EXCLUSIVE[status]
    : TRANSICOES_STATUS_PEDIDO[status]
}

export function podeTransicionarStatus(
  origem: StatusPedidoPersonalizado,
  destino: StatusPedidoPersonalizado,
  fornecedor: FornecedorPedidoPersonalizado = 'moriah_tapetes'
) {
  return destinosPermitidosStatus(origem, fornecedor).includes(destino)
}

export function permiteEdicaoComercial(
  status: StatusPedidoPersonalizado,
  fornecedor: FornecedorPedidoPersonalizado = 'moriah_tapetes'
) {
  if (fornecedor === 'lebebe_exclusive') return status === 'RASCUNHO'
  return status === 'RASCUNHO' || status === 'VENDA FECHADA'
    || status === 'AGUARDANDO LAYOUT' || status === AGUARDANDO_APROVACAO
}

export function permiteEdicaoAdministrativa(status: StatusPedidoPersonalizado) {
  return status !== 'RECEBIDO' && status !== 'CANCELADO'
}

export function operacoesAnexoGestao(status: StatusPedidoPersonalizado) {
  if (status === 'CANCELADO') return { abrir: true, adicionar: false, substituir: false, remover: false, contabilizar: false }
  if (status === 'RECEBIDO') return { abrir: true, adicionar: true, substituir: false, remover: false, contabilizar: false }
  if (status === EM_PRODUCAO) return { abrir: true, adicionar: true, substituir: false, remover: false, contabilizar: true }
  return { abrir: true, adicionar: true, substituir: true, remover: true, contabilizar: true }
}
