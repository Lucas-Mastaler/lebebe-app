import {
  AVISO_MEDIDA_RECOMENDADA,
  MEDIDA_MAXIMA_CM,
  MEDIDA_MINIMA_CM,
  ehFormatoTapeteMoriah,
} from './constantes'
import type {
  CodigoAvisoPedidoPersonalizado,
  CodigoErroPedidoPersonalizado,
  FormatoTapeteMoriah,
  ProblemaPedidoPersonalizado,
  ResultadoCalculoArea,
  ResultadoClassificacaoProdutoMoriah,
  ResultadoValidacao,
} from './tipos'

function erroMedida(
  codigo: Extract<CodigoErroPedidoPersonalizado, 'MEDIDA_INVALIDA' | 'MEDIDA_FORA_DO_LIMITE'>,
  mensagem: string
): ResultadoValidacao<number> {
  return {
    valido: false,
    dados: null,
    erros: [{ codigo, campo: 'medida', mensagem }],
    avisos: [],
  }
}

export function converterMedidaMetrosParaCentimetros(valor: unknown): ResultadoValidacao<number> {
  if (typeof valor !== 'string') {
    return erroMedida('MEDIDA_INVALIDA', 'Informe a medida em metros com até duas casas decimais.')
  }

  const texto = valor.trim()
  if (!/^\d{1,2}(?:[.,]\d{1,2})?$/.test(texto)) {
    return erroMedida('MEDIDA_INVALIDA', 'Informe a medida em metros com até duas casas decimais.')
  }

  const [inteiros, decimais = ''] = texto.replace(',', '.').split('.')
  const centimetros = Number(inteiros) * 100 + Number(decimais.padEnd(2, '0'))

  if (centimetros < MEDIDA_MINIMA_CM) {
    return erroMedida('MEDIDA_FORA_DO_LIMITE', 'A medida mínima é 0,10 m.')
  }
  if (centimetros > MEDIDA_MAXIMA_CM) {
    return erroMedida('MEDIDA_FORA_DO_LIMITE', 'A medida máxima é 15,00 m.')
  }

  return { valido: true, dados: centimetros, erros: [], avisos: [] }
}

export function mascararMedidaMetros(valor: string): string {
  if (!valor) return ''
  if (!/^[\d.,]+$/.test(valor)) return valor

  const digitos = valor.replace(/\D/g, '').replace(/^0+(?=\d)/, '')
  if (!digitos) return '0,00'

  const centesimos = digitos.padStart(3, '0')
  return `${centesimos.slice(0, -2)},${centesimos.slice(-2)}`
}

export function verificarMedidaRecomendada(
  centimetros: number
): ProblemaPedidoPersonalizado<CodigoAvisoPedidoPersonalizado> | null {
  if (!Number.isInteger(centimetros) || centimetros % 5 === 0) return null
  return {
    codigo: 'MEDIDA_FORA_INTERVALO_RECOMENDADO',
    campo: 'medida',
    mensagem: AVISO_MEDIDA_RECOMENDADA,
  }
}

export function validarDimensoesPorFormato(
  formato: string,
  dimensao1Cm: number | null,
  dimensao2Cm: number | null
): ResultadoValidacao<{ formato: FormatoTapeteMoriah; dimensao1Cm: number; dimensao2Cm: number | null }> {
  const erros: ProblemaPedidoPersonalizado<CodigoErroPedidoPersonalizado>[] = []

  if (!ehFormatoTapeteMoriah(formato)) {
    erros.push({ codigo: 'FORMATO_INVALIDO', campo: 'formato', mensagem: 'Formato de tapete inválido.' })
  }

  if (
    !Number.isInteger(dimensao1Cm) ||
    dimensao1Cm === null ||
    dimensao1Cm < MEDIDA_MINIMA_CM ||
    dimensao1Cm > MEDIDA_MAXIMA_CM
  ) {
    erros.push({
      codigo: 'MEDIDA_FORA_DO_LIMITE',
      campo: 'dimensao1',
      mensagem: 'A primeira dimensão deve estar entre 10 e 1500 cm.',
    })
  }

  if (ehFormatoTapeteMoriah(formato)) {
    if (formato === 'REDONDO' && dimensao2Cm !== null) {
      erros.push({
        codigo: 'DIMENSOES_INCOMPATIVEIS',
        campo: 'dimensao2',
        mensagem: 'Tapete redondo aceita somente o diâmetro.',
      })
    }

    if (formato !== 'REDONDO') {
      if (
        !Number.isInteger(dimensao2Cm) ||
        dimensao2Cm === null ||
        dimensao2Cm < MEDIDA_MINIMA_CM ||
        dimensao2Cm > MEDIDA_MAXIMA_CM
      ) {
        erros.push({
          codigo: 'DIMENSOES_INCOMPATIVEIS',
          campo: 'dimensao2',
          mensagem: 'Retangular e orgânico exigem duas dimensões entre 10 e 1500 cm.',
        })
      }
    }
  }

  if (erros.length > 0 || !ehFormatoTapeteMoriah(formato) || dimensao1Cm === null) {
    return { valido: false, dados: null, erros, avisos: [] }
  }

  return {
    valido: true,
    dados: { formato, dimensao1Cm, dimensao2Cm },
    erros: [],
    avisos: [],
  }
}

const CM2_POR_CENTESIMO_M2 = 100 // 1 centésimo de m² = 100 cm²
const PASSO_ARREDONDAMENTO_CENTESIMOS_M2 = 5 // Área cobrada é sempre múltiplo de 0,05 m² (5 centésimos)
const PASSO_ARREDONDAMENTO_CM2 = PASSO_ARREDONDAMENTO_CENTESIMOS_M2 * CM2_POR_CENTESIMO_M2 // 500 cm²

/**
 * Arredonda a área cobrada SEMPRE para cima, para o próximo múltiplo de 0,05 m² — nunca para baixo,
 * e mantém o valor quando já é um múltiplo exato. Opera inteiramente em cm² (inteiro, produto exato
 * de duas medidas em centímetros) para não introduzir erro de ponto flutuante.
 */
export function arredondarAreaCobradaParaCimaCincoCentesimos(areaCm2: number): number {
  const resto = areaCm2 % PASSO_ARREDONDAMENTO_CM2
  const areaCm2Arredondada = resto === 0 ? areaCm2 : areaCm2 + (PASSO_ARREDONDAMENTO_CM2 - resto)
  return areaCm2Arredondada / CM2_POR_CENTESIMO_M2
}

export function calcularAreaCobradaCentesimosM2(
  formato: string,
  dimensao1Cm: number | null,
  dimensao2Cm: number | null
): ResultadoValidacao<ResultadoCalculoArea> {
  const dimensoes = validarDimensoesPorFormato(formato, dimensao1Cm, dimensao2Cm)
  if (!dimensoes.valido || !dimensoes.dados) {
    return { valido: false, dados: null, erros: dimensoes.erros, avisos: dimensoes.avisos }
  }

  const segundaDimensao = dimensoes.dados.formato === 'REDONDO'
    ? dimensoes.dados.dimensao1Cm
    : dimensoes.dados.dimensao2Cm
  if (segundaDimensao === null) {
    return {
      valido: false,
      dados: null,
      erros: [{
        codigo: 'DIMENSOES_INCOMPATIVEIS',
        campo: 'dimensao2',
        mensagem: 'Retangular e orgânico exigem duas dimensões.',
      }],
      avisos: [],
    }
  }
  const areaCm2 = dimensoes.dados.dimensao1Cm * segundaDimensao

  return {
    valido: true,
    dados: {
      areaCm2,
      areaCobradaCentesimosM2: arredondarAreaCobradaParaCimaCincoCentesimos(areaCm2),
    },
    erros: [],
    avisos: [],
  }
}

export function classificarProdutoMoriah(
  formato: FormatoTapeteMoriah,
  dimensao1Cm: number,
  dimensao2Cm: number | null
): ResultadoClassificacaoProdutoMoriah {
  if (
    dimensao1Cm === 95 ||
    dimensao1Cm === 195 ||
    dimensao2Cm === 95 ||
    dimensao2Cm === 195
  ) {
    return { codigo: '21157', criterio: 'MEDIDA_PADRAO' }
  }

  if (formato === 'REDONDO') {
    return { codigo: '21158', criterio: 'REDONDO' }
  }

  if (dimensao2Cm !== null && dimensao1Cm > 200 && dimensao2Cm > 200) {
    return { codigo: '21159', criterio: 'DUAS_MEDIDAS_ACIMA_2M' }
  }

  return { codigo: '21158', criterio: 'DEMAIS_CASOS' }
}

export function formatarAreaMetrosQuadrados(centesimosM2: number): string {
  if (!Number.isInteger(centesimosM2) || centesimosM2 < 0) {
    throw new RangeError('A área deve ser um inteiro não negativo em centésimos de m².')
  }
  const inteiros = Math.floor(centesimosM2 / 100)
  const centesimos = String(centesimosM2 % 100).padStart(2, '0')
  return `${inteiros},${centesimos} m²`
}

export function formatarMedidaMetros(centimetros: number): string {
  if (!Number.isInteger(centimetros) || centimetros < 0) {
    throw new RangeError('A medida deve ser um inteiro não negativo em centímetros.')
  }
  const metros = Math.floor(centimetros / 100)
  const centesimos = String(centimetros % 100).padStart(2, '0')
  return `${metros},${centesimos}`
}
