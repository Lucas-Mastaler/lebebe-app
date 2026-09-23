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
  if (fornecedor === 'lebebe_exclusive') return status === 'RASCUNHO' || status === 'VENDA FECHADA'
  return status === 'RASCUNHO' || status === 'VENDA FECHADA'
    || status === 'AGUARDANDO LAYOUT' || status === AGUARDANDO_APROVACAO
}

/**
 * Composição do pedido (tapetes/cores na Moriah; itens na Lebebe Exclusive) — decisão de
 * negócio: só editável em RASCUNHO, para os dois fornecedores. Regra própria, independente de
 * `permiteEdicaoComercial` (que continua cobrindo só unidade/consultora/cliente/telefone/
 * lançamento e permanece com o range de status já existente).
 */
export function permiteEdicaoProdutos(status: StatusPedidoPersonalizado) {
  return status === 'RASCUNHO'
}

export function permiteEdicaoAdministrativa(status: StatusPedidoPersonalizado) {
  return status !== 'RECEBIDO' && status !== 'CANCELADO'
}

/** Fonte única de UI para "este status pode ir para CANCELADO" — mesma regra de `TRANSICOES_STATUS_PEDIDO`/`_EXCLUSIVE`, sem lista paralela. */
export function podeCancelarPedido(
  status: StatusPedidoPersonalizado,
  fornecedor: FornecedorPedidoPersonalizado = 'moriah_tapetes'
) {
  return podeTransicionarStatus(status, 'CANCELADO', fornecedor)
}

/**
 * Chaves de `app_perfis_acesso` (ver AGENTS.md/módulo permissões) cujos usuários operam as etapas
 * pós-Venda Fechada. Regra apenas de UI/UX: perfis fora desta lista continuam podendo chamar a API
 * normalmente (nenhum bloqueio novo de backend) — só deixam de ver o botão de avanço para reduzir
 * confusão sobre quem realmente opera essas etapas.
 */
export const PERFIS_OPERACIONAIS_AVANCO_STATUS = ['gestao', 'pos_venda'] as const

/**
 * Enquanto RASCUNHO, todo perfil que já pode acessar a tela continua vendo o avanço para Venda
 * Fechada (regra inalterada). A partir de Venda Fechada (inclusive), só perfis operacionais
 * (`PERFIS_OPERACIONAIS_AVANCO_STATUS`) ou acesso total (superadmin) veem o botão.
 */
export function permiteVerAvancoStatus(
  status: StatusPedidoPersonalizado,
  perfilChave: string | null,
  acessoTotal: boolean
) {
  if (status === 'RASCUNHO') return true
  return acessoTotal || (perfilChave !== null && (PERFIS_OPERACIONAIS_AVANCO_STATUS as readonly string[]).includes(perfilChave))
}

export function operacoesAnexoGestao(status: StatusPedidoPersonalizado) {
  if (status === 'CANCELADO') return { abrir: true, adicionar: false, substituir: false, remover: false, contabilizar: false }
  if (status === 'RECEBIDO') return { abrir: true, adicionar: true, substituir: false, remover: false, contabilizar: false }
  if (status === EM_PRODUCAO) return { abrir: true, adicionar: true, substituir: false, remover: false, contabilizar: true }
  return { abrir: true, adicionar: true, substituir: true, remover: true, contabilizar: true }
}
