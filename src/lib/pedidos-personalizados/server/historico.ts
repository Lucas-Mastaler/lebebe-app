import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizarTelefone } from '@/lib/atendimento-presencial/telefone'
import { UNIDADE_PARA_EXIBICAO } from '../constantes'
import type { StatusPedidoPersonalizado, UnidadePedidoPersonalizado } from '../tipos'

export type HistoricoPedidoPersonalizadoDTO = {
  id: string
  createdAt: string
  unidade: string
  status: StatusPedidoPersonalizado
  numeroLancamento: string | null
  numeroPedidoCompra: string | null
  quantidadeTapetes: number
  dataPedidoFornecedor: string | null
  dataEntrega: string | null
  podeAbrirDetalhe: true
}

export async function buscarPedidosPersonalizadosPorTelefones(
  supabase: SupabaseClient,
  params: {
    telefones: readonly (string | null | undefined)[]
    unidadeIds: readonly string[]
    limit?: number
  }
): Promise<HistoricoPedidoPersonalizadoDTO[]> {
  const telefones = Array.from(new Set(params.telefones
    .map((telefone) => normalizarTelefone(telefone).telefoneNormalizado)
    .filter((telefone): telefone is string => Boolean(telefone))))

  if (telefones.length === 0 || params.unidadeIds.length === 0) return []

  const { data, error } = await supabase
    .from('pedidos_personalizados_pedidos')
    .select(`
      id, created_at, unidade_id, status, numero_lancamento,
      numero_pedido_compra, data_pedido_fornecedor, data_entrega,
      unidade:app_unidades!pedidos_personalizados_pedidos_unidade_id_fkey(chave, nome)
    `)
    .in('telefone_normalizado', telefones)
    .in('unidade_id', [...params.unidadeIds])
    .order('created_at', { ascending: false })
    .limit(params.limit ?? 10)

  if (error) throw new Error('Erro ao consultar pedidos personalizados por telefone')

  type PedidoRow = {
    id: string
    created_at: string
    unidade_id: string
    status: StatusPedidoPersonalizado
    numero_lancamento: string | null
    numero_pedido_compra: string | null
    data_pedido_fornecedor: string | null
    data_entrega: string | null
    unidade: { chave: string; nome: string } | null
  }
  const pedidos = (data ?? []) as unknown as PedidoRow[]
  if (pedidos.length === 0) return []

  const { data: tapetes, error: tapetesError } = await supabase
    .from('pedidos_personalizados_moriah_tapetes')
    .select('pedido_id')
    .in('pedido_id', pedidos.map((pedido) => pedido.id))

  if (tapetesError) throw new Error('Erro ao contar tapetes dos pedidos personalizados')
  const quantidades = new Map<string, number>()
  for (const tapete of tapetes ?? []) {
    quantidades.set(tapete.pedido_id, (quantidades.get(tapete.pedido_id) ?? 0) + 1)
  }

  return pedidos.map((pedido) => {
    const chave = pedido.unidade?.chave as UnidadePedidoPersonalizado | undefined
    return {
      id: pedido.id,
      createdAt: pedido.created_at,
      unidade: chave && chave in UNIDADE_PARA_EXIBICAO
        ? UNIDADE_PARA_EXIBICAO[chave]
        : pedido.unidade?.nome ?? 'Unidade não informada',
      status: pedido.status,
      numeroLancamento: pedido.numero_lancamento,
      numeroPedidoCompra: pedido.numero_pedido_compra,
      quantidadeTapetes: quantidades.get(pedido.id) ?? 0,
      dataPedidoFornecedor: pedido.data_pedido_fornecedor,
      dataEntrega: pedido.data_entrega,
      podeAbrirDetalhe: true,
    }
  })
}
