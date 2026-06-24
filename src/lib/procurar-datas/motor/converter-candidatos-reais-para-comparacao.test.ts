// ─────────────────────────────────────────────────────────────────────────────
// motor/converter-candidatos-reais-para-comparacao.test.ts
//
// Testes de preservação de campos e diagnóstico para o conversor de candidatos
// reais para formato de comparação.
//
// Escopo: apenas diagnóstico, sem alterar regra de negócio.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import {
  converterCandidatosReaisParaComparacaoV2,
  type ConverterCandidatosReaisParaComparacaoV2Input,
} from './converter-candidatos-reais-para-comparacao'
import type { CandidatoPreliminarV2 } from './candidato'

// Helper para criar candidato preliminar mockado
function criarCandidatoPreliminarMock(
  overrides: Partial<CandidatoPreliminarV2> = {}
): CandidatoPreliminarV2 {
  return {
    id: 'v2-2026-07-03-equipe-1-normal-1',
    elegivel: true,
    tipo: 'normal',
    horaMarcada: false,
    elegivelHoraMarcada: false,
    dataISO: '2026-07-03',
    indice: 1,
    diaSemana: 5,
    ehSabado: false,
    ehDomingo: false,
    slotTemPontos: true,
    equipe: 'EQUIPE 1',
    operacional: {
      ativa: true,
      disponivelMin: 480,
      suficienteParaServico: true,
      tempoNecessarioMin: 60,
      slotAvailMin: 480,
      serviceMin: 60,
    },
    distancia: {
      distanciaKm: 10,
      kmAdicionalNaRotaM: 3988,
      origemKmAdicional: 'slot',
      chaveSlotKm: '2026-07-03::EQUIPE 1',
    },
    frete: {
      valorFrete: 100,
      tipoFrete: 'normal',
    },
    motivos: [],
    avisos: [],
    diagnostico: {
      origem: 'v2-preliminar',
      classificacaoTipo: 'normal',
      classificacaoElegivel: true,
      horaMarcada: false,
      elegivelHoraMarcada: false,
      motivoHoraMarcada: null,
      horaMarcadaHorasAMais: 2,
      limiteMinimoHoraMarcadaMin: 180,
      horaMarcadaCalculadaPorTempo: false,
    },
    limites: {
      limiteBaseM: 3000,
      limiteEspecialM: 8000,
      limitePremiumM: 13000,
    },
    ...overrides,
  }
}

describe('converterCandidatosReaisParaComparacaoV2', () => {
  it('preserva campos essenciais do candidato preliminar', () => {
    const candidato = criarCandidatoPreliminarMock()
    const input: ConverterCandidatosReaisParaComparacaoV2Input = {
      candidatosReais: [candidato],
    }

    const resultado = converterCandidatosReaisParaComparacaoV2(input)

    expect(resultado.ok).toBe(true)
    expect(resultado.quantidadeRecebida).toBe(1)
    expect(resultado.quantidadeConvertida).toBe(1)
    expect(resultado.candidatos).toHaveLength(1)

    const convertido = resultado.candidatos[0]
    expect(convertido.dataISO).toBe('2026-07-03')
    expect(convertido.equipe).toBe('EQUIPE 1')
    expect(convertido.tipo).toBe('normal')
    expect(convertido.elegivel).toBe(true)
    expect(convertido.horaMarcada).toBe(false)
    expect(convertido.elegivelHoraMarcada).toBe(false)
    expect(convertido.kmAdicionalNaRotaM).toBe(3988)
    expect(convertido.origemKmAdicional).toBe('slot')
    expect(convertido.chaveSlotKm).toBe('2026-07-03::EQUIPE 1')
    expect(convertido.slotTemPontos).toBe(true)
  })

  it('adiciona campos de diagnostico para equivalencia legado x v2', () => {
    const candidato = criarCandidatoPreliminarMock()
    const input: ConverterCandidatosReaisParaComparacaoV2Input = {
      candidatosReais: [candidato],
    }

    const resultado = converterCandidatosReaisParaComparacaoV2(input)
    const convertido = resultado.candidatos[0]

    // Campos de diagnostico novos
    expect(convertido.fonteSlotTemPontos).toBe('agenda-real-via-mapa')
    expect(convertido.fonteLimites).toBe('config-slot-pontos')
    expect(convertido.regraTipoAplicada).toBe('normal-km-base')
    expect(convertido.regraHoraMarcadaAplicada).toBeNull() // motivoHoraMarcada = null
    expect(convertido.etapaLista).toBe('ordenada')

    // Limites propagados da classificacao para o candidato
    expect(convertido.limiteBaseM).toBe(3000)
    expect(convertido.limiteEspecialM).toBe(8000)
    expect(convertido.limitePremiumM).toBe(13000)
  })

  it('detecta corretamente fonte de slotTemPontos quando origemKmAdicional eh global-fallback', () => {
    const candidato = criarCandidatoPreliminarMock({
      distancia: {
        distanciaKm: 10,
        kmAdicionalNaRotaM: 5000,
        origemKmAdicional: 'global-fallback',
        chaveSlotKm: null,
      },
    })
    const input: ConverterCandidatosReaisParaComparacaoV2Input = {
      candidatosReais: [candidato],
    }

    const resultado = converterCandidatosReaisParaComparacaoV2(input)
    const convertido = resultado.candidatos[0]

    expect(convertido.fonteSlotTemPontos).toBe('default-fallback')
    expect(convertido.fonteLimites).toBe('config-slot-pontos') // slotTemPontos = true
  })

  it('detecta corretamente horaMarcada = tempo-suficiente quando elegivel', () => {
    const candidato = criarCandidatoPreliminarMock({
      elegivelHoraMarcada: true,
      diagnostico: {
        origem: 'v2-preliminar',
        classificacaoTipo: 'normal',
        classificacaoElegivel: true,
        horaMarcada: true,
        elegivelHoraMarcada: true,
        motivoHoraMarcada: null,
        horaMarcadaHorasAMais: 2,
        limiteMinimoHoraMarcadaMin: 180,
        horaMarcadaCalculadaPorTempo: true,
      },
    })
    const input: ConverterCandidatosReaisParaComparacaoV2Input = {
      candidatosReais: [candidato],
    }

    const resultado = converterCandidatosReaisParaComparacaoV2(input)
    const convertido = resultado.candidatos[0]

    expect(convertido.regraHoraMarcadaAplicada).toBe('tempo-suficiente')
  })

  it('retorna ok: false quando input nao eh array', () => {
    const input = { candidatosReais: null as unknown as CandidatoPreliminarV2[] }
    const resultado = converterCandidatosReaisParaComparacaoV2(input)

    expect(resultado.ok).toBe(false)
    expect(resultado.quantidadeRecebida).toBe(0)
    expect(resultado.quantidadeConvertida).toBe(0)
    expect(resultado.candidatos).toHaveLength(0)
    expect(resultado.avisos).toContain('Input candidatosReais não é um array válido.')
  })

  it('retorna aviso quando array de candidatos esta vazio', () => {
    const input: ConverterCandidatosReaisParaComparacaoV2Input = {
      candidatosReais: [],
    }
    const resultado = converterCandidatosReaisParaComparacaoV2(input)

    expect(resultado.ok).toBe(true)
    expect(resultado.avisos).toContain('Nenhum candidato real recebido para conversão.')
  })

  it('ordem eh sequencial iniciando em 1', () => {
    const candidatos = [
      criarCandidatoPreliminarMock({ dataISO: '2026-07-03' }),
      criarCandidatoPreliminarMock({ dataISO: '2026-07-08' }),
      criarCandidatoPreliminarMock({ dataISO: '2026-07-11' }),
    ]
    const input: ConverterCandidatosReaisParaComparacaoV2Input = {
      candidatosReais: candidatos,
    }

    const resultado = converterCandidatosReaisParaComparacaoV2(input)

    expect(resultado.candidatos[0].ordem).toBe(1)
    expect(resultado.candidatos[0].rank).toBe(1)
    expect(resultado.candidatos[1].ordem).toBe(2)
    expect(resultado.candidatos[1].rank).toBe(2)
    expect(resultado.candidatos[2].ordem).toBe(3)
    expect(resultado.candidatos[2].rank).toBe(3)
  })
})
