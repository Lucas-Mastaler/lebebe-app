import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { calcularFrete, type EtapaCalculoFrete } from './frete'
import type { FreteInput, FreteParams } from './types'

const params: FreteParams = {
  kmMaxViagem: 150, kmMaxValorFixo: 10, kmMaxLongaCidade: 25, kmMaxNaoViagem: 40,
  valorSemanaAte10km: 90, valorSabadoAte10km: 140, fatorMultiplicadorKmViagem: 2.05,
  multiplicadorKmNaoViagem: 3, valorDiaApos25kmSemana: 50, valorDiaApos25kmSabado: 100, precoCondominioAdicional: 50,
}
const fonte = readFileSync(new URL('../../../../appscript/CEP-CONFIG.gs', import.meta.url), 'utf8')
const inicio = fonte.indexOf('function calcularFrete(distKm, isSat, isRural, isCondominio, p)')
const fim = fonte.indexOf('/* ===================================================== */', inicio)
if (inicio < 0 || fim < 0) throw new Error('Função de frete do legado não localizada para teste de equivalência.')
const legado = runInNewContext('(' + fonte.slice(inicio, fim).trim() + ')') as
  (distKm: number, sabado: boolean, rural: boolean, condominio: boolean, config: Record<string, number>) => number | string
const configLegado = {
  'KILOMETRAGEM MÁXIMA DE VIAGEM': params.kmMaxViagem,
  'KILOMETRAGEM MÁXIMA DE VALOR FIXO': params.kmMaxValorFixo,
  'KILOMETRAGEM MÁXIMA DE LONGA CIDADE': params.kmMaxLongaCidade,
  'KILOMETRAGEM MÁXIMA DE NÃO VIAGEM': params.kmMaxNaoViagem,
  'VALOR SEMANA ATÉ 10KM': params.valorSemanaAte10km,
  'VALOR SÁBADO ATÉ 10KM': params.valorSabadoAte10km,
  'FATOR MULTIPLICADOR PARA KILOMETRAGEM EM VIAGEM': params.fatorMultiplicadorKmViagem,
  'MULTIPLICADOR DE KM NÃO VIAGEM': params.multiplicadorKmNaoViagem,
  'VALOR DIA APÓS 25KM: SEMANA': params.valorDiaApos25kmSemana,
  'VALOR DIA APÓS 25KM: SÁBADO': params.valorDiaApos25kmSabado,
  'PREÇO CONDOMINIO ADICIONAL': params.precoCondominioAdicional,
}

describe('captura passiva preserva a fórmula do legado', () => {
  it.each([0, 10, 10.001, 25, 25.001, 38.948, 40, 40.001, 150, 150.001])('distância %s km e combinações de condições', (distKm) => {
    for (const isSabado of [false, true]) for (const isRural of [false, true]) for (const isCondominio of [false, true]) {
      for (const tipo of ['normal', 'especial', 'premium', 'hora-marcada'] as const) {
        const entrada: FreteInput = { distKm, isSabado, isRural, isCondominio, tipo, params,
          valorAdicionalEspecial: 70, valorAdicionalPremium: 120, horaMarcadaValorAdicional: 80 }
        const etapas: EtapaCalculoFrete[] = []
        const rastreado = calcularFrete(entrada, etapas)
        expect(rastreado).toEqual(calcularFrete(entrada))
        const bruto = legado(distKm, isSabado, isRural, isCondominio, configLegado)
        if (typeof bruto === 'string') {
          expect(rastreado.valorFormatado).toBe(bruto)
        } else {
          const adicional = { normal: 0, especial: 70, premium: 120, 'hora-marcada': 80 }[tipo]
          expect(rastreado.valorFrete).toBe(Math.max(110, Math.ceil(bruto * 1.2 / 10) * 10) + adicional)
          expect(etapas.at(-1)?.valor).toBe(rastreado.valorFrete)
        }
      }
    }
  })
  it('registra o piso global e o adicional aplicado após o piso', () => {
    const etapas: EtapaCalculoFrete[] = []
    const frete = calcularFrete({ distKm: 0, isSabado: false, isRural: false, isCondominio: false,
      tipo: 'especial', valorAdicionalEspecial: 70, params: { ...params, valorSemanaAte10km: 0 } }, etapas)
    expect(etapas.find((etapa) => etapa.descricao === 'Piso global de R$ 110')?.valor).toBe(110)
    expect(frete.valorFrete).toBe(180)
  })
})
