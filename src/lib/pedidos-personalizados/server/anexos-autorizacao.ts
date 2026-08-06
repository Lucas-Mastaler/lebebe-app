import type { ContextoPedidosPersonalizados } from './contexto'
import type { EscopoAnexo } from './anexos-repositorio'

const MODULO_GESTAO = 'pedidos_personalizados_gestao'
const MODULO_NOVO = 'pedidos_personalizados_novo'

export function verificarAcessoAnexoPedidoPersonalizado(
  contexto: ContextoPedidosPersonalizados,
  pedido: EscopoAnexo['pedido']
): boolean {
  if (contexto.moduloAutorizado === MODULO_GESTAO) return true

  return contexto.moduloAutorizado === MODULO_NOVO
    && pedido.created_by === contexto.allowedUser.id
    && pedido.status === 'CADASTRADO'
    && pedido.fornecedor?.chave === 'moriah_tapetes'
}
