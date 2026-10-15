export type SinaisEstadoOperacionalHubVendas = {
  automacaoPausada: boolean
  /** Filas que ainda estão em erro, de qualquer dia, até serem resolvidas. */
  errosPendentes: number
  resultadoIncerto: number
  analiseManual: number
  conexoesPausadas: number
}

/**
 * Mesma regra do status geral do resumo diário.
 * Avisos informativos (resumo do dia, teste) não entram: o estado olha só
 * condições que ainda estão abertas na operação.
 */
export function operacaoHubVendasPrecisaAtencao(sinais: SinaisEstadoOperacionalHubVendas): boolean {
  return sinais.automacaoPausada
    || sinais.errosPendentes > 0
    || sinais.resultadoIncerto > 0
    || sinais.analiseManual > 0
    || sinais.conexoesPausadas > 0
}
