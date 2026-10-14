import type { MedidaDecorisi } from './tipos'

export const VERSAO_CALCULO_DECORISI = 1
// Limite técnico para manter medidas inteiras no PostgreSQL; não é limite comercial.
export const DIMENSAO_MAXIMA_DECORISI_CM = 2147483647
const ZERO = BigInt(0)
const UM = BigInt(1)
function inteiroPositivo(valor: number) {
  if (!Number.isInteger(valor) || valor < 1 || valor > DIMENSAO_MAXIMA_DECORISI_CM) {
    throw new Error('MEDIDA_DECORISI_INVALIDA')
  }
}
function validarMedidas(medidas: readonly MedidaDecorisi[]) {
  if (medidas.length < 1 || medidas.length > 20) throw new Error('LIMITE_MEDIDAS_DECORISI')
  for (const m of medidas) { inteiroPositivo(m.larguraCm); inteiroPositivo(m.alturaCm) }
}
function mdc(a: bigint, b: bigint): bigint {
  while (b !== ZERO) { const resto = a % b; a = b; b = resto }
  return a
}

export function calcularPapelDecorisi(medidas: readonly MedidaDecorisi[], repeticaoCm: number) {
  validarMedidas(medidas)
  if (!Number.isInteger(repeticaoCm) || repeticaoCm < 0 || repeticaoCm > DIMENSAO_MAXIMA_DECORISI_CM) {
    throw new Error('REPETICAO_DECORISI_INVALIDA')
  }
  const alturas = new Map<number, bigint>()
  for (const medida of medidas) alturas.set(medida.alturaCm, (alturas.get(medida.alturaCm) ?? ZERO) + BigInt(medida.larguraCm))
  let numerador = ZERO
  let denominador = UM
  const grupos = [...alturas.entries()].sort(([a], [b]) => a - b).map(([alturaCm, larguraCm]) => {
    const comprimentoFaixaCm = alturaCm + repeticaoCm + 5
    const faixasPorRolo = Math.floor(1000 / comprimentoFaixaCm)
    if (faixasPorRolo < 1) throw new Error('ALTURA_EXCEDE_ROLO_DECORISI')
    const divisor = BigInt(faixasPorRolo * 62)
    numerador = numerador * divisor + larguraCm * denominador
    denominador *= divisor
    const fator = mdc(numerador, denominador)
    numerador /= fator; denominador /= fator
    return { alturaCm, larguraCm: larguraCm.toString(), comprimentoFaixaCm, faixasPorRolo }
  })
  const rolos = (numerador + denominador - UM) / denominador
  return { quantidade: rolos.toString(), unidade: 'ROLO' as const, numerador: numerador.toString(), denominador: denominador.toString(), grupos }
}

export function calcularPainelDecorisi(medidas: readonly MedidaDecorisi[]) {
  validarMedidas(medidas)
  const areaCm2 = medidas.reduce((total, m) => total + BigInt(m.larguraCm) * BigInt(m.alturaCm), ZERO)
  return { quantidade: `${areaCm2 / BigInt(10000)}.${(areaCm2 % BigInt(10000)).toString().padStart(4, '0')}`, areaCm2: areaCm2.toString(), unidade: 'M2' as const }
}

/** Decimal SGI sem perda de precisão; arredondamento só no subtotal da arte. */
export function subtotalDecorisiCentavos(quantidade: string, preco: string | number): string {
  function decimal(valor: string) {
    if (!/^\d+(?:\.\d+)?$/.test(valor) || valor.length > 100) throw new Error('PRECO_DECORISI_INVALIDO')
    const [inteira, fracao = ''] = valor.split('.')
    return { valor: BigInt(inteira + fracao), escala: BigInt(10) ** BigInt(fracao.length) }
  }
  const q = decimal(quantidade), p = decimal(String(preco))
  if (q.valor <= ZERO || p.valor <= ZERO) throw new Error('PRECO_DECORISI_INVALIDO')
  const divisor = q.escala * p.escala
  return ((q.valor * p.valor * BigInt(100) * BigInt(2) + divisor) / (divisor * BigInt(2))).toString()
}
