// ─────────────────────────────────────────────────────────────────────────────
// motor/types.ts  —  Tipos do motor de cálculo de frete
//
// Tipos de entrada e saída para as funções puras de cálculo de frete.
// Não inclui dependências de I/O, planilha, Supabase ou OSRM.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parâmetros de frete extraídos da configuração normalizada.
 *
 * Mapeamento direto de ConfigNormalizada (config-service.ts):
 *   kmMaxViagem            ← KILOMETRAGEM MÁXIMA DE VIAGEM (km)
 *   kmMaxValorFixo         ← KILOMETRAGEM MÁXIMA DE VALOR FIXO (km)
 *   kmMaxLongaCidade       ← KILOMETRAGEM MÁXIMA DE LONGA CIDADE (km)
 *   kmMaxNaoViagem         ← KILOMETRAGEM MÁXIMA DE NÃO VIAGEM (km)
 *   valorSemanaAte10km     ← VALOR SEMANA ATÉ 10KM (R$)
 *   valorSabadoAte10km     ← VALOR SÁBADO ATÉ 10KM (R$)
 *   fatorMultiplicadorKmViagem ← FATOR MULTIPLICADOR PARA KILOMETRAGEM EM VIAGEM
 *   multiplicadorKmNaoViagem   ← MULTIPLICADOR DE KM NÃO VIAGEM
 *   valorDiaApos25kmSemana ← VALOR DIA APÓS 25KM: SEMANA (R$)
 *   valorDiaApos25kmSabado ← VALOR DIA APÓS 25KM: SÁBADO (R$)
 *   precoCondominioAdicional ← PREÇO CONDOMINIO ADICIONAL (R$)
 */
export interface FreteParams {
  kmMaxViagem: number
  kmMaxValorFixo: number
  kmMaxLongaCidade: number
  kmMaxNaoViagem: number
  valorSemanaAte10km: number
  valorSabadoAte10km: number
  fatorMultiplicadorKmViagem: number
  multiplicadorKmNaoViagem: number
  valorDiaApos25kmSemana: number
  valorDiaApos25kmSabado: number
  precoCondominioAdicional: number
}

/**
 * Entrada para calcularFreteBase (antes do ajuste global).
 */
export interface FreteBaseInput {
  distKm: number
  isSabado: boolean
  isRural: boolean
  isCondominio: boolean
  params: FreteParams
}

/**
 * Entrada completa para calcularFrete (com ajuste global + tipo de candidato).
 */
export interface FreteInput {
  distKm: number
  isSabado: boolean
  isRural: boolean
  isCondominio: boolean
  params: FreteParams
  tipo?: 'normal' | 'especial' | 'premium' | 'hora-marcada'
  valorAdicionalEspecial?: number
  valorAdicionalPremium?: number
  horaMarcadaValorAdicional?: number
}

/**
 * Faixa de distância aplicada no cálculo.
 *
 *   fixo     → distKm ≤ kmMaxValorFixo
 *   viagem   → kmMaxValorFixo < distKm ≤ kmMaxLongaCidade
 *   longa    → kmMaxLongaCidade < distKm ≤ kmMaxNaoViagem
 *   naoViagem → kmMaxNaoViagem < distKm ≤ kmMaxViagem
 *   recusado → distKm > kmMaxViagem
 */
export type FaixaFrete = 'fixo' | 'viagem' | 'longa' | 'naoViagem' | 'recusado'

/**
 * Resultado do cálculo de frete.
 */
export interface FreteResult {
  /** true se a distância está dentro do limite de viagem */
  ok: boolean
  /** Valor final do frete em reais (inteiro, arredondado) */
  valorFrete: number
  /** Valor formatado em pt-BR, ex: "R$ 250" */
  valorFormatado: string
  /** Faixa de distância que foi aplicada */
  faixaAplicada: FaixaFrete
  /** Tipo do candidato usado no cálculo */
  tipo: 'normal' | 'especial' | 'premium' | 'hora-marcada'
}

/**
 * Resultado quando a distância excede o limite máximo.
 */
export interface FreteRecusado {
  ok: false
  valorFrete: 0
  valorFormatado: 'Não fazemos'
  faixaAplicada: 'recusado'
  tipo: 'normal' | 'especial' | 'premium' | 'hora-marcada'
}

export type FreteOutput = FreteResult | FreteRecusado
