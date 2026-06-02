export interface SgiDocumento {
  id: string
  importacao_id: string | null
  numero_lancamento: string
  numero_lancamento_original: string | null
  numero_documento: string | null
  cliente: string | null
  contatos: string | null
  telefone_principal: string | null
  telefone_normalizado: string | null
  filial: string | null
  operacao: string | null
  emissao_texto: string | null
  data_fechamento: string | null
  reserva: string | null
  vendedor: string | null
  status: string | null
  valor_mercadorias: number | null
  valor_mercadorias_texto: string | null
  valor_descontos: number | null
  valor_descontos_texto: string | null
  percentual_desconto: number | null
  percentual_desconto_texto: string | null
  valor_frete: number | null
  valor_frete_texto: string | null
  valor_total: number | null
  valor_total_texto: string | null
  valor_credito_troca: number | null
  valor_pendente_pagamento: number | null
  valor_pago_novo: number | null
  created_at: string
  updated_at: string
  // Digisac enrichment (optional — populated when synced)
  digisac_chamados_janela_90?: number | null
  digisac_interacoes_janela_90?: number | null
  digisac_primeiro_contato?: 'ativo' | 'receptivo' | 'indefinido' | null
  digisac_status?: 'nao_sincronizado' | 'pendente' | 'processando' | 'concluido' | 'erro' | 'ignorado_cache_valido' | null
  digisac_ultima_sync?: string | null
}

export interface SgiContato {
  id: string
  documento_saida_id: string
  numero_lancamento: string
  telefone_original: string | null
  telefone_normalizado: string | null
  telefone_normalizado_ddi: string | null
  principal: boolean
}

export interface SgiProduto {
  id: string
  documento_saida_id: string
  numero_lancamento: string
  codigo: string | null
  produto: string | null
  local_estocagem: string | null
  quantidade: number | null
  quantidade_texto: string | null
  valor_total: number | null
  valor_total_texto: string | null
  categoria_sugerida: string | null
}

export interface SgiPagamento {
  id: string
  documento_saida_id: string
  numero_lancamento: string
  forma_pagamento: string | null
  numero_parcelas: number | null
  numero_parcelas_texto: string | null
  percentual: number | null
  percentual_texto: string | null
  valor: number | null
  valor_texto: string | null
  nsu: string | null
  numero_autorizacao: string | null
}

export interface SgiVendaDetalhe extends SgiDocumento {
  contatos_lista: SgiContato[]
  produtos: SgiProduto[]
  pagamentos: SgiPagamento[]
}

export interface SgiCards {
  total_vendas: number
  valor_total: number
  valor_pago_novo: number
  valor_credito_troca: number
  valor_pendente_pagamento: number
  valor_frete: number
  percentual_desconto_medio: number
  ticket_medio: number
  total_finalizadas: number
}

export interface SgiFiltros {
  dataInicio?: string
  dataFim?: string
  cliente?: string
  telefone?: string
  filiais?: string[]
  vendedores?: string[]
  operacoes?: string[]
  status?: string[]
  numeroLancamento?: string
  page?: number
}

export interface SgiVendasResponse {
  vendas: SgiDocumento[]
  total: number
  cards: SgiCards
}
