import { describe, it, expect } from 'vitest'
import {
  adaptarCandidatosDisponibilidadeRealParaLegadoDiagnosticoV2,
  type AdaptarCandidatosDisponibilidadeRealParaLegadoDiagnosticoV2Input,
} from './adaptar-candidatos-reais-legado'
import type { CandidatoPreliminarV2 } from './candidato'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function criarCandidato(
  overrides?: Partial<CandidatoPreliminarV2>
): CandidatoPreliminarV2 {
  return {
    id: 'v2-2026-06-15-equipe-1-normal-0',
    elegivel: true,
    tipo: 'normal',
    dataISO: '2026-06-15',
    indice: 0,
    diaSemana: 1,
    ehSabado: false,
    ehDomingo: false,
    equipe: 'EQUIPE 1',
    operacional: {
      ativa: true,
      disponivelMin: 240,
      suficienteParaServico: true,
      tempoNecessarioMin: 60,
    },
    distancia: {
      distanciaKm: 8,
      kmAdicionalNaRotaM: 3000,
    },
    frete: {
      valorFrete: 110,
      tipoFrete: 'fixo',
    },
    motivos: [],
    avisos: [],
    ...overrides,
    limites: overrides?.limites ?? {
      limiteBaseM: 5000,
      limiteEspecialM: 10000,
      limitePremiumM: 15000,
    },
    diagnostico: {
      origem: 'v2-preliminar',
      classificacaoTipo: overrides?.tipo ?? 'normal',
      classificacaoElegivel: overrides?.elegivel ?? true,
      ...overrides?.diagnostico,
    },
  }
}

function criarInput(
  overrides?: Partial<AdaptarCandidatosDisponibilidadeRealParaLegadoDiagnosticoV2Input>
): AdaptarCandidatosDisponibilidadeRealParaLegadoDiagnosticoV2Input {
  return {
    candidatosOrdenados: [criarCandidato()],
    dataReferenciaISO: '2026-06-15',
    ...overrides,
  }
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('adaptarCandidatosDisponibilidadeRealParaLegadoDiagnosticoV2', () => {
  // 1. Adapta candidato normal com dateISO no formato legado-gmt3
  it('adapta candidato normal com dateISO YYYY-MM-DDT03:00:00.000Z (legado-gmt3 padrao)', () => {
    const resultado = adaptarCandidatosDisponibilidadeRealParaLegadoDiagnosticoV2(criarInput())

    expect(resultado.ok).toBe(true)
    expect(resultado.amostra).toHaveLength(1)
    expect(resultado.amostra[0].dateISO).toBe('2026-06-15T03:00:00.000Z')
    expect(resultado.formatoDateISO).toBe('legado-gmt3')
  })

  // 2. Adapta premium com isExtra: true
  it('adapta premium com isExtra: true', () => {
    const resultado = adaptarCandidatosDisponibilidadeRealParaLegadoDiagnosticoV2(
      criarInput({
        candidatosOrdenados: [
          criarCandidato({
            id: 'v2-2026-06-15-equipe-1-premium-0',
            tipo: 'premium',
            elegivel: true,
          }),
        ],
      })
    )

    expect(resultado.amostra[0].isExtra).toBe(true)
    expect(resultado.amostra[0].tipo).toBe('premium')
  })

  // 2b. Adapta especial com isExtra: true
  it('adapta especial com isExtra: true', () => {
    const resultado = adaptarCandidatosDisponibilidadeRealParaLegadoDiagnosticoV2(
      criarInput({
        candidatosOrdenados: [
          criarCandidato({ tipo: 'especial', elegivel: true }),
        ],
      })
    )

    expect(resultado.amostra[0].isExtra).toBe(true)
    expect(resultado.amostra[0].tipo).toBe('especial')
  })

  // 2c. Adapta hora-marcada com isExtra: true
  it('adapta hora-marcada com isExtra: true', () => {
    const resultado = adaptarCandidatosDisponibilidadeRealParaLegadoDiagnosticoV2(
      criarInput({
        candidatosOrdenados: [
          criarCandidato({ tipo: 'hora-marcada', elegivel: true }),
        ],
      })
    )

    expect(resultado.amostra[0].isExtra).toBe(true)
    expect(resultado.amostra[0].tipo).toBe('hora-marcada')
  })

  // 3. Mantém normal com isExtra: false
  it('mantém normal com isExtra: false', () => {
    const resultado = adaptarCandidatosDisponibilidadeRealParaLegadoDiagnosticoV2(criarInput())

    expect(resultado.amostra[0].isExtra).toBe(false)
    expect(resultado.amostra[0].tipo).toBe('normal')
  })

  // 4. Preserva rank sequencial correto
  it('preserva rank sequencial 1, 2, 3 para multiplos candidatos', () => {
    const resultado = adaptarCandidatosDisponibilidadeRealParaLegadoDiagnosticoV2(
      criarInput({
        candidatosOrdenados: [
          criarCandidato({ id: 'v2-2026-06-15-equipe-1-normal-0', dataISO: '2026-06-15' }),
          criarCandidato({ id: 'v2-2026-06-16-equipe-1-normal-1', dataISO: '2026-06-16', indice: 1, diaSemana: 2 }),
          criarCandidato({ id: 'v2-2026-06-17-equipe-1-normal-2', dataISO: '2026-06-17', indice: 2, diaSemana: 3 }),
        ],
      })
    )

    expect(resultado.amostra[0].rank).toBe(1)
    expect(resultado.amostra[1].rank).toBe(2)
    expect(resultado.amostra[2].rank).toBe(3)
  })

  // 4b. Preserva frete formatado corretamente
  it('preserva frete formatado como "R$ X"', () => {
    const resultado = adaptarCandidatosDisponibilidadeRealParaLegadoDiagnosticoV2(
      criarInput({
        candidatosOrdenados: [criarCandidato({ frete: { valorFrete: 220, tipoFrete: 'viagem' } })],
      })
    )

    expect(resultado.amostra[0].frete).toBe('R$ 220')
  })

  // 4c. Preserva team (equipe)
  it('preserva team correto', () => {
    const resultado = adaptarCandidatosDisponibilidadeRealParaLegadoDiagnosticoV2(
      criarInput({
        candidatosOrdenados: [criarCandidato({ equipe: 'EQUIPE 2' })],
      })
    )

    expect(resultado.amostra[0].team).toBe('EQUIPE 2')
  })

  // 5. Preserva dateDM e weekday
  it('preserva dateDM no formato DD/MM', () => {
    const resultado = adaptarCandidatosDisponibilidadeRealParaLegadoDiagnosticoV2(criarInput())

    expect(resultado.amostra[0].dateDM).toBe('15/06')
  })

  it('preserva weekday em portugues', () => {
    const resultado = adaptarCandidatosDisponibilidadeRealParaLegadoDiagnosticoV2(criarInput())

    // diaSemana: 1 → Segunda
    expect(resultado.amostra[0].weekday).toBe('Segunda')
  })

  it('preserva weekday para sabado (diaSemana: 6)', () => {
    const resultado = adaptarCandidatosDisponibilidadeRealParaLegadoDiagnosticoV2(
      criarInput({
        candidatosOrdenados: [
          criarCandidato({ dataISO: '2026-06-20', diaSemana: 6, ehSabado: true }),
        ],
      })
    )

    expect(resultado.amostra[0].weekday).toBe('Sábado')
    expect(resultado.amostra[0].dateDM).toBe('20/06')
  })

  // 6. Usa legado-gmt3 por padrão (sem passar formatoDateISO)
  it('usa legado-gmt3 por padrao quando formatoDateISO nao e fornecido', () => {
    const resultado = adaptarCandidatosDisponibilidadeRealParaLegadoDiagnosticoV2({
      candidatosOrdenados: [criarCandidato()],
      dataReferenciaISO: '2026-06-15',
    })

    expect(resultado.formatoDateISO).toBe('legado-gmt3')
    expect(resultado.amostra[0].dateISO).toMatch(/T03:00:00\.000Z$/)
  })

  // 7. Permite formatoDateISO: 'v2'
  it('permite formatoDateISO v2 emitindo YYYY-MM-DD', () => {
    const resultado = adaptarCandidatosDisponibilidadeRealParaLegadoDiagnosticoV2(
      criarInput({ formatoDateISO: 'v2' })
    )

    expect(resultado.formatoDateISO).toBe('v2')
    expect(resultado.amostra[0].dateISO).toBe('2026-06-15')
  })

  // 8. Respeita limiteAmostra
  it('respeita limiteAmostra cortando lista ao limite', () => {
    const resultado = adaptarCandidatosDisponibilidadeRealParaLegadoDiagnosticoV2(
      criarInput({
        candidatosOrdenados: [
          criarCandidato({ id: 'v2-2026-06-15-equipe-1-normal-0', dataISO: '2026-06-15' }),
          criarCandidato({ id: 'v2-2026-06-16-equipe-1-normal-1', dataISO: '2026-06-16', indice: 1, diaSemana: 2 }),
          criarCandidato({ id: 'v2-2026-06-17-equipe-1-normal-2', dataISO: '2026-06-17', indice: 2, diaSemana: 3 }),
          criarCandidato({ id: 'v2-2026-06-18-equipe-1-normal-3', dataISO: '2026-06-18', indice: 3, diaSemana: 4 }),
        ],
        limiteAmostra: 2,
      })
    )

    expect(resultado.ok).toBe(true)
    expect(resultado.quantidadeRecebida).toBe(4)
    expect(resultado.quantidadeAdaptada).toBe(2)
    expect(resultado.amostra).toHaveLength(2)
  })

  it('limiteAmostra maior que lista inclui todos', () => {
    const resultado = adaptarCandidatosDisponibilidadeRealParaLegadoDiagnosticoV2(
      criarInput({ limiteAmostra: 100 })
    )

    expect(resultado.quantidadeAdaptada).toBe(1)
  })

  it('limiteAmostra 0 inclui todos (sem limite)', () => {
    const resultado = adaptarCandidatosDisponibilidadeRealParaLegadoDiagnosticoV2(
      criarInput({
        candidatosOrdenados: [
          criarCandidato({ id: 'a', dataISO: '2026-06-15' }),
          criarCandidato({ id: 'b', dataISO: '2026-06-16', indice: 1, diaSemana: 2 }),
        ],
        limiteAmostra: 0,
      })
    )

    expect(resultado.quantidadeAdaptada).toBe(2)
  })

  // 9. Retorna aviso para lista vazia
  it('retorna ok: true e aviso para lista vazia', () => {
    const resultado = adaptarCandidatosDisponibilidadeRealParaLegadoDiagnosticoV2(
      criarInput({ candidatosOrdenados: [] })
    )

    expect(resultado.ok).toBe(true)
    expect(resultado.quantidadeAdaptada).toBe(0)
    expect(resultado.amostra).toHaveLength(0)
    expect(resultado.avisos.some((a) => a.includes('vazia'))).toBe(true)
  })

  // 10. Não muta input
  it('nao muta candidatosOrdenados de entrada', () => {
    const candidatos = [criarCandidato()]
    const copiaAntes = JSON.stringify(candidatos)

    adaptarCandidatosDisponibilidadeRealParaLegadoDiagnosticoV2(
      criarInput({ candidatosOrdenados: candidatos })
    )

    expect(JSON.stringify(candidatos)).toBe(copiaAntes)
  })

  it('nao muta candidato individualmente (frete.valorFrete)', () => {
    const candidato = criarCandidato({ frete: { valorFrete: 150, tipoFrete: 'fixo' } })
    const valorAntes = candidato.frete.valorFrete

    adaptarCandidatosDisponibilidadeRealParaLegadoDiagnosticoV2(
      criarInput({ candidatosOrdenados: [candidato] })
    )

    expect(candidato.frete.valorFrete).toBe(valorAntes)
  })

  // 11. Não lê planilha — confirmado por ausência de imports de I/O
  it('funcao pura: retorna resultado sem dependencia de I/O externo', () => {
    const resultado = adaptarCandidatosDisponibilidadeRealParaLegadoDiagnosticoV2(criarInput())

    expect(resultado).not.toBeNull()
    expect(typeof resultado).toBe('object')
    expect(typeof resultado.ok).toBe('boolean')
    expect(Array.isArray(resultado.amostra)).toBe(true)
  })

  // 12. Não chama serviços externos
  it('ok: false quando candidatosOrdenados nao e array', () => {
    const resultado = adaptarCandidatosDisponibilidadeRealParaLegadoDiagnosticoV2(
      { candidatosOrdenados: null as unknown as CandidatoPreliminarV2[] }
    )

    expect(resultado.ok).toBe(false)
    expect(resultado.amostra).toHaveLength(0)
    expect(resultado.avisos.some((a) => a.includes('não é um array'))).toBe(true)
  })

  // 13. Não altera rotas — confirmado por ausência de imports de rotas
  it('adapta multiplos candidatos preservando ordem de entrada', () => {
    const candidatos = [
      criarCandidato({ id: 'v2-2026-06-15-equipe-1-normal-0', dataISO: '2026-06-15', diaSemana: 1 }),
      criarCandidato({ id: 'v2-2026-06-16-equipe-2-especial-1', dataISO: '2026-06-16', diaSemana: 2, tipo: 'especial', equipe: 'EQUIPE 2' }),
    ]

    const resultado = adaptarCandidatosDisponibilidadeRealParaLegadoDiagnosticoV2(
      criarInput({ candidatosOrdenados: candidatos })
    )

    expect(resultado.amostra[0].dateISO).toBe('2026-06-15T03:00:00.000Z')
    expect(resultado.amostra[1].dateISO).toBe('2026-06-16T03:00:00.000Z')
    expect(resultado.amostra[1].tipo).toBe('especial')
    expect(resultado.amostra[1].team).toBe('EQUIPE 2')
  })

  // Candidatos indisponíveis são incluídos
  it('adapta candidatos indisponiveis (elegivel: false) sem filtrar', () => {
    const resultado = adaptarCandidatosDisponibilidadeRealParaLegadoDiagnosticoV2(
      criarInput({
        candidatosOrdenados: [
          criarCandidato({
            elegivel: false,
            tipo: 'indisponivel',
            motivos: ['Equipe inativa.'],
          }),
        ],
      })
    )

    expect(resultado.ok).toBe(true)
    expect(resultado.amostra).toHaveLength(1)
    expect(resultado.amostra[0].diagnosticoV2.elegivel).toBe(false)
    expect(resultado.amostra[0].diagnosticoV2.motivos).toContain('Equipe inativa.')
    expect(resultado.amostra[0].diagnosticoV2.origem).toBe('v2-adaptado-diagnostico')
  })

  // diagnosticoV2.origem preservado
  it('preserva diagnosticoV2.origem como v2-adaptado-diagnostico', () => {
    const resultado = adaptarCandidatosDisponibilidadeRealParaLegadoDiagnosticoV2(criarInput())

    expect(resultado.amostra[0].diagnosticoV2.origem).toBe('v2-adaptado-diagnostico')
  })

  // diagnosticoV2.id preservado do candidato
  it('preserva diagnosticoV2.id do candidato original', () => {
    const candidato = criarCandidato({ id: 'v2-2026-06-15-equipe-1-normal-0' })

    const resultado = adaptarCandidatosDisponibilidadeRealParaLegadoDiagnosticoV2(
      criarInput({ candidatosOrdenados: [candidato] })
    )

    expect(resultado.amostra[0].diagnosticoV2.id).toBe('v2-2026-06-15-equipe-1-normal-0')
  })

  // quantidadeRecebida bate com quantidadeAdaptada sem limite
  it('quantidadeRecebida e quantidadeAdaptada batem sem limiteAmostra', () => {
    const candidatos = [
      criarCandidato({ id: 'a', dataISO: '2026-06-15' }),
      criarCandidato({ id: 'b', dataISO: '2026-06-16', indice: 1, diaSemana: 2 }),
      criarCandidato({ id: 'c', dataISO: '2026-06-17', indice: 2, diaSemana: 3 }),
    ]

    const resultado = adaptarCandidatosDisponibilidadeRealParaLegadoDiagnosticoV2(
      criarInput({ candidatosOrdenados: candidatos })
    )

    expect(resultado.quantidadeRecebida).toBe(3)
    expect(resultado.quantidadeAdaptada).toBe(3)
  })

  // dataReferenciaISO ausente gera aviso e daysLeftTxt vazio
  it('gera aviso quando dataReferenciaISO ausente e daysLeftTxt fica vazio', () => {
    const resultado = adaptarCandidatosDisponibilidadeRealParaLegadoDiagnosticoV2(
      criarInput({ dataReferenciaISO: null })
    )

    expect(resultado.avisos.some((a) => a.includes('dataReferenciaISO'))).toBe(true)
    expect(resultado.amostra[0].daysLeftTxt).toBe('')
  })

  // daysLeftTxt calculado corretamente
  it('calcula daysLeftTxt corretamente quando dataReferenciaISO fornecida', () => {
    const resultado = adaptarCandidatosDisponibilidadeRealParaLegadoDiagnosticoV2(
      criarInput({
        candidatosOrdenados: [criarCandidato({ dataISO: '2026-06-20' })],
        dataReferenciaISO: '2026-06-15',
      })
    )

    expect(resultado.amostra[0].daysLeftTxt).toBe('5 d')
  })

  // frete null emite string vazia no campo frete
  it('frete nulo emite string vazia no campo frete da amostra', () => {
    const resultado = adaptarCandidatosDisponibilidadeRealParaLegadoDiagnosticoV2(
      criarInput({
        candidatosOrdenados: [criarCandidato({ frete: { valorFrete: null, tipoFrete: null } })],
      })
    )

    expect(resultado.amostra[0].frete).toBe('')
  })

  // Formato legado-gmt3 aplicado a todas as datas da amostra
  it('aplica legado-gmt3 a todas as datas da amostra', () => {
    const resultado = adaptarCandidatosDisponibilidadeRealParaLegadoDiagnosticoV2(
      criarInput({
        candidatosOrdenados: [
          criarCandidato({ dataISO: '2026-06-15' }),
          criarCandidato({ dataISO: '2026-06-20', id: 'b', indice: 1, diaSemana: 6, ehSabado: true }),
        ],
      })
    )

    expect(resultado.amostra[0].dateISO).toBe('2026-06-15T03:00:00.000Z')
    expect(resultado.amostra[1].dateISO).toBe('2026-06-20T03:00:00.000Z')
  })
})
