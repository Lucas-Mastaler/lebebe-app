// ─────────────────────────────────────────────────────────────────────────────
// motor/frete.ts  —  Cálculo de frete puro (sem I/O)
//
// Porta fiel da lógica de frete do Apps Script (CEP-CONFIG.gs / CEP-APIBACK.gs):
//   - calcularFrete()       → calcularFreteBase()
//   - aplicarAjusteFrete()  → aplicarAjusteGlobal()
//   - adicionais por tipo   → aplicados em calcularFrete()
//
// Pipeline completo no Apps Script:
//   1. calcularFrete(distKm, isSat, isRural, isCondo, p)  → preço bruto
//   2. aplicarAjusteFrete(preço bruto)                     → ×1.2, ceil dezena, min R$110
//   3. + VALOR_ADICIONAL_ESPECIAL / PREMIUM / HORA_MARCADA → tipo != normal
//
// Essa mesma ordem é reproduzida aqui.
//
// NÃO FAZ:
//   - Leitura de planilha, Supabase, OSRM, ou qualquer I/O
//   - Nenhuma alteração em APIs existentes ou frontend
// ─────────────────────────────────────────────────────────────────────────────

import type {
  FreteParams,
  FreteInput,
  FreteOutput,
  FaixaFrete,
} from './types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Arredonda para cima na dezena mais próxima (idêntico ao Apps Script). */
function ceilDezena(n: number): number {
  return Math.ceil(n / 10) * 10
}

/** Formata valor inteiro em reais no padrão BR: "R$ 1.250" */
function fmtMoneyBR(n: number): string {
  return 'R$ ' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

// ─── Faixa de distância ──────────────────────────────────────────────────────

function identificarFaixa(distKm: number, p: FreteParams): FaixaFrete {
  if (distKm > p.kmMaxViagem) return 'recusado'
  if (distKm <= p.kmMaxValorFixo) return 'fixo'
  if (distKm <= p.kmMaxLongaCidade) return 'viagem'
  if (distKm <= p.kmMaxNaoViagem) return 'longa'
  return 'naoViagem'
}

// ─── Cálculo base (equivale a calcularFrete do Apps Script) ──────────────────

/**
 * Reprodução fiel de `calcularFrete(distKm, isSat, isRural, isCondominio, p)`
 * do CEP-CONFIG.gs (linhas 1813-1851).
 *
 * Retorna o preço bruto (antes do ajuste global ×1.2).
 * Retorna null se distKm > kmMaxViagem ("Não fazemos").
 */
export function calcularFreteBase(
  distKm: number,
  isSabado: boolean,
  isRural: boolean,
  isCondominio: boolean,
  p: FreteParams
): number | null {
  // Limite máximo de viagem
  if (distKm > p.kmMaxViagem) return null

  // Preço base conforme dia da semana
  const base = isSabado ? p.valorSabadoAte10km : p.valorSemanaAte10km

  let preco: number

  if (distKm <= p.kmMaxValorFixo) {
    // Faixa 1: até km fixo → preço base
    preco = base
  } else if (distKm <= p.kmMaxLongaCidade) {
    // Faixa 2: em viagem (normal)
    preco = base + (distKm - p.kmMaxValorFixo) * p.fatorMultiplicadorKmViagem
  } else if (distKm <= p.kmMaxNaoViagem) {
    // Faixa 3: em viagem após "longa cidade"
    const add25 = isSabado ? p.valorDiaApos25kmSabado : p.valorDiaApos25kmSemana
    preco = base + add25 + (distKm - p.kmMaxLongaCidade) * p.fatorMultiplicadorKmViagem
  } else {
    // Faixa 4: não viagem
    const add25 = isSabado ? p.valorDiaApos25kmSabado : p.valorDiaApos25kmSemana
    preco = base + add25 + (distKm - p.kmMaxLongaCidade) * p.multiplicadorKmNaoViagem
  }

  // Adicionais
  if (isRural) preco += 100
  if (isCondominio) preco += p.precoCondominioAdicional

  // Arredonda para cima na dezena
  return ceilDezena(preco)
}

// ─── Ajuste global (equivale a aplicarAjusteFrete do Apps Script) ────────────

/**
 * Reprodução fiel de `aplicarAjusteFrete(v)` do CEP-APIBACK.gs (linhas 377-384):
 *   1. ×1.2
 *   2. ceil dezena
 *   3. mínimo R$ 110
 */
export function aplicarAjusteGlobal(valor: number): number {
  let num = valor * 1.2
  num = ceilDezena(num)
  if (num < 110) num = 110
  return num
}

// ─── Função principal ────────────────────────────────────────────────────────

/**
 * Calcula o frete completo para um candidato.
 *
 * Pipeline (reproduz fielmente o Apps Script CEP-APIBACK.gs linhas 1475-1502):
 *   1. calcularFreteBase → preço bruto com adicionais (rural, condomínio)
 *   2. aplicarAjusteGlobal → ×1.2, ceil dezena, min R$110
 *   3. + adicional por tipo (especial / premium / hora-marcada)
 *
 * Todos os valores de adicional por tipo vêm da entrada, nunca hard-coded.
 */
export function calcularFrete(input: FreteInput): FreteOutput {
  const {
    distKm,
    isSabado,
    isRural,
    isCondominio,
    params,
    tipo = 'normal',
    valorAdicionalEspecial = 0,
    valorAdicionalPremium = 0,
    horaMarcadaValorAdicional = 0,
  } = input

  const faixa = identificarFaixa(distKm, params)

  // Distância excede limite → recusado
  if (faixa === 'recusado') {
    return {
      ok: false,
      valorFrete: 0,
      valorFormatado: 'Não fazemos',
      faixaAplicada: 'recusado',
      tipo,
    }
  }

  // 1. Preço bruto (calcularFrete do Apps Script)
  const brutoPre = calcularFreteBase(distKm, isSabado, isRural, isCondominio, params)
  // brutoPre nunca será null aqui porque faixa !== 'recusado', mas TypeScript exige guard
  const bruto = brutoPre as number

  // 2. Ajuste global: ×1.2, ceil dezena, min R$110
  let valor = aplicarAjusteGlobal(bruto)

  // 3. Adicional por tipo de candidato
  if (tipo === 'especial') {
    valor += valorAdicionalEspecial
  } else if (tipo === 'premium') {
    valor += valorAdicionalPremium
  } else if (tipo === 'hora-marcada') {
    valor += horaMarcadaValorAdicional
  }

  return {
    ok: true,
    valorFrete: valor,
    valorFormatado: fmtMoneyBR(valor),
    faixaAplicada: faixa,
    tipo,
  }
}

// ─── Helpers exportados para testes e reutilização ───────────────────────────

export { ceilDezena, fmtMoneyBR, identificarFaixa }
