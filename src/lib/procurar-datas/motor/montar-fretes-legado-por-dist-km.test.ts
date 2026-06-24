import { describe, expect, it } from 'vitest'
import { montarFretesLegadoPorDistKm } from './montar-fretes-legado-por-dist-km'
import type { CandidatoFinalPesquisarDatasV2 } from './pesquisar-datas-v2'
import type { FreteParams } from './types'

const PARAMS: FreteParams = {
  kmMaxViagem: 80,
  kmMaxValorFixo: 10,
  kmMaxLongaCidade: 25,
  kmMaxNaoViagem: 50,
  valorSemanaAte10km: 130,
  valorSabadoAte10km: 200,
  fatorMultiplicadorKmViagem: 8,
  multiplicadorKmNaoViagem: 12,
  valorDiaApos25kmSemana: 50,
  valorDiaApos25kmSabado: 80,
  precoCondominioAdicional: 30,
}

function candidato(
  dataISO: string,
  tipo: string,
  rank: number,
  kmAdicionalNaRotaM: number
): CandidatoFinalPesquisarDatasV2 {
  return {
    dataISO,
    equipe: 'EQUIPE 1',
    tipo,
    rank,
    elegivel: true,
    horaMarcada: tipo === 'hora-marcada',
    kmAdicionalNaRotaM,
    origemKmAdicional: 'slot',
  }
}

describe('montarFretesLegadoPorDistKm', () => {
  it('monta fretes formatados usando distKm deposito -> destino e calcularFrete real', () => {
    const resultado = montarFretesLegadoPorDistKm({
      candidatos: [
        candidato('2026-07-10', 'normal', 1, 99999),
        candidato('2026-07-11', 'normal', 2, 1),
        candidato('2026-07-12', 'especial', 3, 110),
        candidato('2026-07-13', 'premium', 4, 120),
        candidato('2026-07-14', 'hora-marcada', 5, 130),
      ],
      distKm: 8,
      isRural: false,
      isCondominio: true,
      params: PARAMS,
      valorAdicionalEspecial: 70,
      valorAdicionalPremium: 120,
      horaMarcadaValorAdicional: 80,
    })

    expect(resultado.avisos).toEqual([])
    expect(resultado.fretes.map((f) => f.frete)).toEqual([
      'R$ 200',
      'R$ 280',
      'R$ 270',
      'R$ 320',
      'R$ 280',
    ])
    expect(resultado.fretes[0]).toMatchObject({
      dataISO: '2026-07-10',
      equipe: 'EQUIPE 1',
      tipo: 'normal',
      rank: 1,
    })
  })

  it('nao usa kmAdicionalNaRotaM para frete', () => {
    const base = {
      candidatos: [candidato('2026-07-10', 'normal', 1, 50000)],
      isRural: false,
      isCondominio: true,
      params: PARAMS,
      valorAdicionalEspecial: 70,
      valorAdicionalPremium: 120,
      horaMarcadaValorAdicional: 80,
    }

    const distCurta = montarFretesLegadoPorDistKm({ ...base, distKm: 8 })
    const distLonga = montarFretesLegadoPorDistKm({ ...base, distKm: 20 })

    expect(distCurta.fretes[0].frete).toBe('R$ 200')
    expect(distLonga.fretes[0].frete).toBe('R$ 290')
  })

  it('retorna lista vazia quando distKm nao foi fornecido', () => {
    const resultado = montarFretesLegadoPorDistKm({
      candidatos: [candidato('2026-07-10', 'normal', 1, 110)],
      distKm: null,
      isRural: false,
      isCondominio: false,
      params: PARAMS,
      valorAdicionalEspecial: 70,
      valorAdicionalPremium: 120,
      horaMarcadaValorAdicional: 80,
    })

    expect(resultado.fretes).toEqual([])
    expect(resultado.avisos[0]).toContain('distKm deposito -> destino')
  })
})
