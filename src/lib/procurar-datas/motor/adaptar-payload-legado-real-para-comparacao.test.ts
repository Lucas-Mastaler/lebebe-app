import { describe, it, expect } from 'vitest'
import {
  adaptarCandidatoLegadoRealParaComparacao,
  adaptarCandidatosLegadoRealParaComparacao,
  extrairCandidatosDoFixtureLegadoReal,
  adaptarPayloadLegadoRealParaComparacao,
  adaptarPayloadLegadoRealParaComparacaoComChave,
} from './adaptar-payload-legado-real-para-comparacao'

// Fixture de teste baseado na estrutura real
const candidatoLegadoRealBase = {
  dateISO: '2026-06-23T03:00:00.000Z',
  dateDM: '23/06',
  weekday: 'Terça',
  tipo: 'normal',
  isExtra: false,
  frete: 'R$ 110',
  rank: 1,
  team: 'EQUIPE 1',
  daysLeftTxt: '11 d',
  encomenda: 'Não',
  avisoHoraMarcada: '',
}

const fixtureLegadoRealCompleto = {
  responseDone: {
    body: {
      progress: {
        payload: {
          candidates: [candidatoLegadoRealBase],
        },
      },
    },
  },
}

describe('adaptarCandidatoLegadoRealParaComparacao', () => {
  it('1. extrai dataISO no formato YYYY-MM-DD do dateISO legado-gmt3', () => {
    const resultado = adaptarCandidatoLegadoRealParaComparacao(candidatoLegadoRealBase, 0)
    expect(resultado.dataISO).toBe('2026-06-23')
  })

  it('2. normaliza equipe do team legado', () => {
    const resultado = adaptarCandidatoLegadoRealParaComparacao(candidatoLegadoRealBase, 0)
    expect(resultado.equipe).toBe('EQUIPE 1')
  })

  it('3. preserva tipo do candidato', () => {
    const resultado = adaptarCandidatoLegadoRealParaComparacao(
      { ...candidatoLegadoRealBase, tipo: 'premium' },
      0
    )
    expect(resultado.tipo).toBe('premium')
  })

  it('4. define elegivel como true (candidatos do payload legado sao sempre elegiveis)', () => {
    const resultado = adaptarCandidatoLegadoRealParaComparacao(candidatoLegadoRealBase, 0)
    expect(resultado.elegivel).toBe(true)
  })

  it('5. define horaMarcada false quando avisoHoraMarcada vazio', () => {
    const resultado = adaptarCandidatoLegadoRealParaComparacao(
      { ...candidatoLegadoRealBase, avisoHoraMarcada: '' },
      0
    )
    expect(resultado.horaMarcada).toBe(false)
    expect(resultado.elegivelHoraMarcada).toBe(false)
  })

  it('6. define horaMarcada true quando avisoHoraMarcada preenchido', () => {
    const resultado = adaptarCandidatoLegadoRealParaComparacao(
      { ...candidatoLegadoRealBase, avisoHoraMarcada: 'Horário definido: 14h' },
      0
    )
    expect(resultado.horaMarcada).toBe(true)
    expect(resultado.elegivelHoraMarcada).toBe(true)
  })

  it('7. preserva ordem do rank legado', () => {
    const resultado = adaptarCandidatoLegadoRealParaComparacao(
      { ...candidatoLegadoRealBase, rank: 5 },
      0
    )
    expect(resultado.ordem).toBe(5)
  })

  it('8. usa indice+1 como fallback quando rank ausente', () => {
    const candidatoSemRank = { ...candidatoLegadoRealBase }
    delete (candidatoSemRank as { rank?: number }).rank
    const resultado = adaptarCandidatoLegadoRealParaComparacao(candidatoSemRank, 2)
    expect(resultado.ordem).toBe(3)
  })

  it('9. define campos nao disponiveis no legado como null', () => {
    const resultado = adaptarCandidatoLegadoRealParaComparacao(candidatoLegadoRealBase, 0)
    expect(resultado.kmAdicionalNaRotaM).toBeNull()
    expect(resultado.slotTemPontos).toBeNull()
    expect(resultado.limiteBaseM).toBeNull()
    expect(resultado.limiteEspecialM).toBeNull()
    expect(resultado.limitePremiumM).toBeNull()
    expect(resultado.motivos).toBeNull()
  })

  it('10. nao gera comparacaoKey (eh gerado depois pelo helper)', () => {
    const resultado = adaptarCandidatoLegadoRealParaComparacao(candidatoLegadoRealBase, 0)
    expect(resultado.comparacaoKey).toBeUndefined()
  })
})

describe('extrairCandidatosDoFixtureLegadoReal', () => {
  it('11. extrai candidatos do path responseDone.body.progress.payload.candidates', () => {
    const resultado = extrairCandidatosDoFixtureLegadoReal(fixtureLegadoRealCompleto)
    expect(resultado).toHaveLength(1)
    expect(resultado[0].tipo).toBe('normal')
  })

  it('12. retorna array vazio quando fixture invalido', () => {
    expect(extrairCandidatosDoFixtureLegadoReal(null)).toEqual([])
    expect(extrairCandidatosDoFixtureLegadoReal(undefined)).toEqual([])
    expect(extrairCandidatosDoFixtureLegadoReal({})).toEqual([])
    expect(extrairCandidatosDoFixtureLegadoReal('string')).toEqual([])
  })

  it('13. retorna array vazio quando candidates ausente', () => {
    const fixtureSemCandidates = {
      responseDone: {
        body: {
          progress: {
            payload: {},
          },
        },
      },
    }
    expect(extrairCandidatosDoFixtureLegadoReal(fixtureSemCandidates)).toEqual([])
  })
})

describe('adaptarPayloadLegadoRealParaComparacao', () => {
  it('14. adapta fixture completo para array de CandidatoComparacaoLegadoV2', () => {
    const resultado = adaptarPayloadLegadoRealParaComparacao(fixtureLegadoRealCompleto)
    expect(resultado).toHaveLength(1)
    expect(resultado[0].dataISO).toBe('2026-06-23')
    expect(resultado[0].equipe).toBe('EQUIPE 1')
    expect(resultado[0].tipo).toBe('normal')
  })

  it('15. retorna array vazio quando fixture invalido', () => {
    expect(adaptarPayloadLegadoRealParaComparacao(null)).toEqual([])
    expect(adaptarPayloadLegadoRealParaComparacao({})).toEqual([])
  })
})

describe('adaptarPayloadLegadoRealParaComparacaoComChave', () => {
  it('16. gera comparacaoKey no formato v2 com fonte default diagnostico-candidatos', () => {
    const resultado = adaptarPayloadLegadoRealParaComparacaoComChave(
      fixtureLegadoRealCompleto
    )
    expect(resultado).toHaveLength(1)
    expect(resultado[0].comparacaoKey).toBeDefined()
    // Formato esperado: dataISO::equipeNormalizada::diagnostico-candidatos::ordemLocal
    expect(resultado[0].comparacaoKey).toMatch(/^2026-06-23::EQUIPE 1::diagnostico-candidatos::\d+$/)
  })

  it('17. gera comparacaoKey com fonte customizada quando fornecida', () => {
    const resultado = adaptarPayloadLegadoRealParaComparacaoComChave(
      fixtureLegadoRealCompleto,
      'disponibilidade-real'
    )
    expect(resultado).toHaveLength(1)
    expect(resultado[0].comparacaoKey).toBeDefined()
    // Formato esperado: dataISO::equipeNormalizada::disponibilidade-real::ordemLocal
    expect(resultado[0].comparacaoKey).toMatch(/^2026-06-23::EQUIPE 1::disponibilidade-real::\d+$/)
  })

  it('18. retorna array vazio quando fixture invalido', () => {
    expect(adaptarPayloadLegadoRealParaComparacaoComChave(null)).toEqual([])
    expect(adaptarPayloadLegadoRealParaComparacaoComChave({})).toEqual([])
  })
})
