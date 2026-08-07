import type { StatusPedidoPersonalizado } from './tipos'

const AGUARDANDO_APROVACAO = 'AGUARDANDO APROVA\u00c7\u00c3O DO CLIENTE' as const
const EM_PRODUCAO = 'EM PRODU\u00c7\u00c3O' as const

export const TRANSICOES_STATUS_PEDIDO: Readonly<Record<StatusPedidoPersonalizado, readonly StatusPedidoPersonalizado[]>> = {
  CADASTRADO: ['AGUARDANDO LAYOUT', 'CANCELADO'],
  'AGUARDANDO LAYOUT': [AGUARDANDO_APROVACAO, 'CANCELADO'],
  [AGUARDANDO_APROVACAO]: [EM_PRODUCAO, 'AGUARDANDO LAYOUT', 'CANCELADO'],
  [EM_PRODUCAO]: ['RECEBIDO', 'CANCELADO'],
  RECEBIDO: [],
  CANCELADO: [],
}

export function destinosPermitidosStatus(status: StatusPedidoPersonalizado) {
  return TRANSICOES_STATUS_PEDIDO[status]
}

export function podeTransicionarStatus(origem: StatusPedidoPersonalizado, destino: StatusPedidoPersonalizado) {
  return destinosPermitidosStatus(origem).includes(destino)
}

export function permiteEdicaoComercial(status: StatusPedidoPersonalizado) {
  return status === 'CADASTRADO' || status === 'AGUARDANDO LAYOUT' || status === AGUARDANDO_APROVACAO
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
