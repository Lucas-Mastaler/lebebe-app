import type { SupabaseClient } from '@supabase/supabase-js'
import type { IdentificacaoDecorisiRpc, ItemDecorisi } from '../decorisi/tipos'

export class RepositorioDecorisi {
  constructor(private readonly supabase: SupabaseClient) {}
  async disponivel(usuarioId: string) {
    return this.supabase.rpc('decorisi_fornecedor_para_usuario', { p_usuario: usuarioId })
  }
  async referencias(termo: string) {
    return this.supabase.from('pedidos_personalizados_decorisi_referencias').select('id, referencia, repeticao_m, versao').eq('ativo', true).ilike('referencia', `%${termo}%`).order('referencia')
  }
  async precos() {
    return this.supabase.from('sgi_produtos_cache').select('produto_id_sgi, codigo, descricao, preco, ativo, fora_linha, ultima_validacao_sgi').in('produto_id_sgi', [36565,36566,36567,36568])
  }
  async pedido(id: string, unidades: string[]) {
    return this.supabase.from('pedidos_personalizados_pedidos')
      .select('id, unidade_id, consultora, cliente, telefone_normalizado, created_by, status, version, fornecedor:pedidos_personalizados_fornecedores!inner(chave), itens:pedidos_personalizados_decorisi_itens(*, medidas:pedidos_personalizados_decorisi_medidas(*), anexos:pedidos_personalizados_decorisi_anexos(id, slot, nome_original, mime_type, tamanho_bytes, created_at))')
      .eq('id', id).in('unidade_id', unidades).eq('fornecedor.chave', 'decorisi')
      .order('ordem', { referencedTable: 'itens' })
      .order('ordem', { referencedTable: 'itens.medidas' })
      .order('slot', { referencedTable: 'itens.anexos' })
      .maybeSingle()
  }
  async criar(parametros: { p_usuario_id: string; p_idempotency_key: string; p_unidade_id: string; p_consultora: string; p_cliente: string; p_telefone_normalizado: string; p_itens: ItemDecorisi[] }) {
    return this.supabase.rpc('criar_pedido_personalizado_decorisi', parametros)
  }
  async atualizar(id: string, usuarioId: string, version: number, itens: ItemDecorisi[], identificacao: IdentificacaoDecorisiRpc | null = null) {
    return this.supabase.rpc('atualizar_pedido_personalizado_decorisi', { p_pedido_id: id, p_usuario_id: usuarioId, p_expected_version: version, p_itens: itens, p_identificacao: identificacao })
  }
  async cotar(id: string, usuarioId: string) {
    return this.supabase.rpc('cotar_pedido_personalizado_decorisi', { p_pedido_id: id, p_usuario_id: usuarioId })
  }
  async fechar(id: string, usuarioId: string, version: number, numeroLancamento: string, cotacao: Record<string, unknown>) {
    return this.supabase.rpc('fechar_pedido_personalizado_decorisi', { p_pedido_id: id, p_usuario_id: usuarioId, p_expected_version: version, p_numero_lancamento: numeroLancamento, p_cotacao_confirmada: cotacao })
  }
}
